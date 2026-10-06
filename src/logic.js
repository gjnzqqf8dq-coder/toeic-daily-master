'use strict';
// =========================================================
// 記憶の仕組み（間隔反復）
//   新出で○ → 3日後 / ✕ → 翌日＋今日もう一度
//   復習で○ → 次の段（1→3→7→14→30→60日）/ ✕ → 翌日に戻す
// =========================================================
const INT = [0, 1, 3, 7, 14, 30, 60];
const GROUPS = { tc: '行く回の登壇者', idea: 'アイデアの学校 講師', peer: 'アイデアの学校 同期', toraA: '虎ノ門広告祭 必修', toraB: '虎ノ門広告祭 その他', tcy: '虎子屋 講師候補' };
const LS = 'tdm2';
const W = window.WORDS, P = window.PEOPLE;
const pById = Object.fromEntries(P.map(p => [p.id, p]));
const wByEn = Object.fromEntries(W.map(w => [w.en, w]));

function dayNum(d = new Date()) { return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); }
function dayStr(n = dayNum()) { return new Date(n * 86400000).toISOString().slice(0, 10); }
function shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pgroup(p) { return p.g === 'tora' ? 'tora' + p.tier : p.g; }

// =========================================================
// 保存（localStorage ＋ IndexedDB の二重化・1問ごとに即保存）
// =========================================================
const DEF_SETTINGS = { wordGoal: 100, wordExtra: 100, faceGoal: 40, faceExtra: 20, ratio: 60, eff: 70, sp: 90, rate: 90, voice: '', auto: true, hap: true, timer: 6, mode: { w: 'quiz', p: 'quiz' }, ja: false, name: false, groups: { tc: true, idea: true, peer: true, toraA: true, toraB: false, tcy: true } };
let S;
function fresh() {
  return { v: 2, updatedAt: 0, cards: {}, days: {}, today: {}, order: shuffle(W.map(w => w.en)), settings: structuredClone(DEF_SETTINGS) };
}
const IDB = {
  db: null,
  open() {
    return new Promise(res => {
      try {
        const r = indexedDB.open('tdm', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => res(null);
      } catch { res(null); }
    });
  },
  get() {
    return new Promise(res => {
      if (!this.db) return res(null);
      try { const q = this.db.transaction('kv').objectStore('kv').get(LS); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }
      catch { res(null); }
    });
  },
  put(v) { try { this.db && this.db.transaction('kv', 'readwrite').objectStore('kv').put(v, LS); } catch {} },
};
let idbTimer = null;
function save() {
  S.updatedAt = Date.now();
  clearTimeout(idbTimer);
  idbTimer = setTimeout(flush, 250); // 連続回答の書き込みをまとめる
}
function flush() {
  clearTimeout(idbTimer); idbTimer = null;
  if (!S) return;
  const json = JSON.stringify(S);
  try { localStorage.setItem(LS, json); } catch {}
  IDB.put(json);
  if (typeof Sync !== 'undefined') Sync.later();
}

// =========================================================
// 端末間の同期（スマホとPCで同じ記録）。Cloudflare Worker に1つのJSONを置き、取ってきたら手元と合わせる
// =========================================================
const SYNC_URL = 'https://tdm-sync.human-captcha.workers.dev/s/';
const SYNC_KEY = (() => { try { return localStorage.getItem('tdm-sync-key') || 'kx-wO4eBZmuKdnGid_tYGkqK'; } catch { return 'kx-wO4eBZmuKdnGid_tYGkqK'; } })();
function mergeState(a, b) {
  if (!b || !b.cards) return a;
  const out = Object.assign({}, a);
  // カード：解いた回数が多い方（同じなら最後に解いた日が新しい方）
  out.cards = Object.assign({}, b.cards);
  for (const [k, c] of Object.entries(a.cards || {})) {
    const o = out.cards[k];
    if (!o || (c.n || 0) > (o.n || 0) || ((c.n || 0) === (o.n || 0) && (c.l || 0) >= (o.l || 0))) out.cards[k] = c;
  }
  // 日ごとの記録：数は大きい方
  out.days = Object.assign({}, b.days);
  for (const [d, x] of Object.entries(a.days || {})) {
    const o = out.days[d]; if (!o) { out.days[d] = x; continue; }
    const m = Object.assign({}, o, x);
    for (const f of ['w', 'wc', 'p', 'pc', 'xp']) if (o[f] != null || x[f] != null) m[f] = Math.max(o[f] || 0, x[f] || 0);
    out.days[d] = m;
  }
  // 今日の出題：日付が新しい方、同じ日なら種類ごとに進んでいる方
  const ta = a.today || {}, tb = b.today || {};
  if ((tb.date || '') > (ta.date || '')) out.today = tb;
  else if (tb.date === ta.date) {
    out.today = Object.assign({}, ta);
    for (const t of ['w', 'p']) if (tb[t] && (!ta[t] || (tb[t].pos || 0) > (ta[t].pos || 0))) out.today[t] = tb[t];
  }
  out.xp = Math.max(a.xp || 0, b.xp || 0);
  out.best = Object.assign({}, b.best); for (const [k, v] of Object.entries(a.best || {})) out.best[k] = Math.max(v || 0, out.best[k] || 0);
  if (Object.keys(b.cards).length > Object.keys(a.cards || {}).length) out.order = b.order || a.order;
  if ((b.updatedAt || 0) > (a.updatedAt || 0)) out.settings = b.settings;
  for (const f of ['migrated', 'v3', 'v4', 'v5', 'v6']) out[f] = a[f] || b[f];
  out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
  return out;
}
const Sync = {
  last: 0, busy: false, timer: null,
  async pull() {
    try {
      const r = await fetch(SYNC_URL + SYNC_KEY, { cache: 'no-store' }); if (!r.ok) return false;
      const remote = await r.json();
      if (remote && remote.cards) { const u = S.updatedAt; S = normalize(mergeState(S, remote)); S.updatedAt = Math.max(u, S.updatedAt); flush(); }
      this.last = Date.now(); return true;
    } catch { return false; }
  },
  async push(keepalive) {
    if (this.busy && !keepalive) return; this.busy = true;
    try {
      if (!keepalive) await this.pull(); // 先に相手の分を取り込んでから上書き
      await fetch(SYNC_URL + SYNC_KEY, { method: 'PUT', body: JSON.stringify(S), keepalive: !!keepalive && JSON.stringify(S).length < 60000 });
      this.last = Date.now();
    } catch {}
    this.busy = false;
  },
  later() { clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 20000); },
};

addEventListener('pagehide', () => { flush(); Sync.push(true); });
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) { flush(); Sync.push(true); }
  else if (S && !G) {
    if (await newVersion()) { flush(); return location.reload(); } // ホーム画面のアプリは裏に残ると古い画面のままなので、新しい版があれば読み直す
    if (await Sync.pull()) show(tab); // 別の端末でやった分を開いた時に取り込む
  }
});
const BUILD = '__BUILD__';
async function newVersion() {
  try { const t = await (await fetch('./?chk=' + Date.now(), { cache: 'no-store' })).text(); const m = t.match(/const BUILD = '(\w+)'/); return !!(m && m[1] !== BUILD && BUILD !== '__' + 'BUILD__'); } catch { return false; }
}
function loadLocal() {
  try { const v = localStorage.getItem(LS); return v ? JSON.parse(v) : null; } catch { return null; }
}
function normalize(s) {
  const f = fresh();
  s = Object.assign(f, s);
  s.settings = Object.assign(structuredClone(DEF_SETTINGS), s.settings || {});
  s.settings.groups = Object.assign(structuredClone(DEF_SETTINGS.groups), (s.settings.groups) || {});
  // 新しい単語が増えた場合に備えて出題順へ追加
  const known = new Set(s.order); W.forEach(w => { if (!known.has(w.en)) s.order.push(w.en); });
  return s;
}
// 旧版（v1）の記録を引き継ぐ
function migrateV1(s) {
  try {
    const hist = JSON.parse(localStorage.getItem('tdm-history-v1') || '{}');
    for (const [d, h] of Object.entries(hist)) {
      if (!s.days[d]) s.days[d] = { w: h.solved || 0, wc: h.solved || 0, p: 0, pc: 0, goalW: true, old: true };
    }
    const wrong = JSON.parse(localStorage.getItem('tdm-wrong-v1') || '[]');
    wrong.forEach(w => { const k = 'w:' + w.en; if (wByEn[w.en] && !s.cards[k]) s.cards[k] = { b: 1, d: dayNum(), n: 1, w: 1 }; });
    const st = JSON.parse(localStorage.getItem('tdm-settings-v1') || '{}');
    if (st.effectVolume != null) s.settings.eff = Math.round(st.effectVolume * 100);
    if (st.speechVolume != null) s.settings.sp = Math.round(st.speechVolume * 100);
  } catch {}
  s.migrated = true;
  return s;
}

// =========================================================
// 今日の出題を組む
// =========================================================
function deckKeys(type) {
  if (type === 'w') return S.order.map(en => 'w:' + en);
  const g = S.settings.groups;
  const rank = { tc: -1, toraA: 0, tcy: 0.5, idea: 1, peer: 2, toraB: 3 }; // 広告祭(10/9〜)が近いので必修を先に
  return P.filter(p => g[pgroup(p)] || (p.also || []).some(x => g[x])).sort((a, b) => rank[pgroup(a)] - rank[pgroup(b)] || b.pri - a.pri).map(p => 'p:' + p.id);
}
function counts(type) {
  const today = dayNum(); let learned = 0, dueTomorrow = 0, unseen = 0;
  for (const k of deckKeys(type)) {
    const c = S.cards[k];
    if (!c) { unseen++; continue; }
    if (c.b >= 3) learned++;
    if (c.d <= today + 1) dueTomorrow++;
  }
  return { learned, dueTomorrow, unseen };
}
function build(type, n, exclude) {
  const today = dayNum();
  const keys = deckKeys(type).filter(k => !exclude.has(k));
  const due = [], fresh = [];
  for (const k of keys) {
    const c = S.cards[k];
    if (!c) fresh.push(k); else if (c.d <= today) due.push(k);
  }
  due.sort((a, b) => S.cards[a].d - S.cards[b].d || S.cards[a].b - S.cards[b].b);
  const maxRev = Math.round(n * S.settings.ratio / 100);
  let rev = due.slice(0, maxRev);
  let nw = fresh.slice(0, n - rev.length);
  if (rev.length + nw.length < n) rev = due.slice(0, n - nw.length); // 新出が尽きたら復習で埋める
  if (rev.length + nw.length < n) { // それでも足りなければ先取り復習
    const ahead = keys.filter(k => S.cards[k] && S.cards[k].d > today).sort((a, b) => S.cards[a].d - S.cards[b].d);
    rev = rev.concat(ahead.slice(0, n - rev.length - nw.length));
  }
  // 最初の数問は新出から始めて気持ちよく入る
  const mixed = shuffle(rev.concat(nw));
  const head = mixed.filter(k => !S.cards[k]).slice(0, 3);
  return { list: head.concat(mixed.filter(k => !head.includes(k))), rev: rev.length, nw: nw.length };
}
function getToday(type) {
  const ds = dayStr();
  if (!S.today || S.today.date !== ds) S.today = { date: ds };
  if (!S.today[type]) {
    const goal = type === 'w' ? S.settings.wordGoal : S.settings.faceGoal;
    const b = build(type, goal, new Set());
    S.today[type] = { q: b.list, pos: 0, goal, base: b.list.length, rev: b.rev, nw: b.nw, extra: 0 };
    save();
  }
  return S.today[type];
}
function addExtra(type) {
  const t = getToday(type);
  const n = type === 'w' ? S.settings.wordExtra : S.settings.faceExtra;
  const used = new Set(t.q.map(k => k.replace(/^!/, '')));
  const b = build(type, n, used);
  t.q = t.q.concat(b.list); t.goal += b.list.length; t.extra += b.list.length;
  save();
}
function doneCount(t) { return t.q.slice(0, t.pos).filter(k => k[0] !== '!').length; }
function dayLog() {
  const ds = dayStr();
  return S.days[ds] || (S.days[ds] = { w: 0, wc: 0, p: 0, pc: 0 });
}


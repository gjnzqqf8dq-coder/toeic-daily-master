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
const DEF_SETTINGS = { wordGoal: 100, wordExtra: 100, faceGoal: 40, faceExtra: 20, ratio: 60, eff: 70, sp: 90, rate: 90, voice: '', auto: true, hap: true, timer: 6, flash: 0, mode: { w: 'quiz', p: 'quiz' }, ja: false, name: false, groups: { tc: true, idea: true, peer: true, toraA: true, toraB: false, tcy: true } };
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
function flush(fromSync) {
  clearTimeout(idbTimer); idbTimer = null;
  if (!S) return;
  const json = JSON.stringify(S);
  try { localStorage.setItem(LS, json); } catch {}
  IDB.put(json);
  if (!fromSync && typeof Sync !== 'undefined') Sync.later();
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
    for (const f of ['w', 'wc', 'p', 'pc', 'xp', 'rtc', 'rnc', 'rfc', 'rtq', 'rnq', 'rfq', 'rtf', 'rnf', 'rff', 'sp', 'spx']) if (o[f] != null || x[f] != null) m[f] = Math.max(o[f] || 0, x[f] || 0);
    out.days[d] = m;
  }
  // 今日の出題：日付が新しい方、同じ日なら種類ごとに進んでいる方
  const ta = a.today || {}, tb = b.today || {};
  if ((tb.date || '') > (ta.date || '')) out.today = tb;
  else if (tb.date === ta.date) {
    out.today = Object.assign({}, ta);
    for (const t of ['w', 'p']) if (tb[t] && (!ta[t] || (tb[t].pos || 0) > (ta[t].pos || 0))) out.today[t] = tb[t];
  }
  // 1問ごとの記録（AIの分析用）：両方を合わせて新しい順に EV_MAX 件
  if (a.ev || b.ev) { const seen = new Set(), ev = []; for (const e of [...(b.ev || []), ...(a.ev || [])]) { const k = e[0] + '|' + e[1]; if (!seen.has(k)) { seen.add(k); ev.push(e); } } out.ev = ev.sort((x, y) => x[0] - y[0]).slice(-EV_MAX); }
  out.xp = Math.max(a.xp || 0, b.xp || 0);
  out.best = Object.assign({}, b.best); for (const [k, v] of Object.entries(a.best || {})) out.best[k] = Math.max(v || 0, out.best[k] || 0);
  if (Object.keys(b.cards).length > Object.keys(a.cards || {}).length) out.order = b.order || a.order;
  if ((b.updatedAt || 0) > (a.updatedAt || 0)) out.settings = b.settings;
  for (const f of ['migrated', 'v3', 'v4', 'v5', 'v6']) out[f] = a[f] || b[f];
  out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
  return out;
}
// =========================================================
// AIコーチの計画（同期サーバーが1時間ごとに記録を分析して置く・読むだけ）
//   prio: 苦手度（高いほど先に出す） focus: 期日前でも混ぜる苦手語 flash: 高速モードの制限時間 spot: 抜き打ちの割合 note: ひとこと
// =========================================================
const EV_MAX = 4000;
const Plan = {
  v: (() => { try { return JSON.parse(localStorage.getItem('tdm-plan')) || null; } catch { return null; } })(),
  async pull() {
    try {
      const r = await fetch(SYNC_URL + SYNC_KEY + '-plan', { cache: 'no-store' }); if (!r.ok) return;
      const p = await r.json(); if (!p || !p.updated) return;
      this.v = p; try { localStorage.setItem('tdm-plan', JSON.stringify(p)); } catch {}
    } catch {}
  },
  prio(en) { return (this.v && this.v.prio && this.v.prio[en]) || 0; },
};
// 1問の結果を記録（間隔反復・日ごとの数・答えるまでの時間・1問ごとのログ）。md: q=4択 c=カード f=高速
function record(key, again, ok, ms, md) {
  const log = dayLog(), today = dayNum(), isW = key[0] === 'w';
  if (isW) { S.ev = S.ev || []; S.ev.push([Math.floor(Date.now() / 1000), key.slice(2), ok ? 1 : 0, ms == null ? -1 : ms, md + (again ? '!' : '')]); if (S.ev.length > EV_MAX + 200) S.ev = S.ev.slice(-EV_MAX); }
  if (again) return;
  const c = S.cards[key] || { b: 0, n: 0, w: 0 };
  const isNew = c.n === 0; c.n++;
  if (ok) c.b = isNew ? 2 : Math.min(c.b + 1, INT.length - 1); else { c.b = 1; c.w++; }
  c.d = today + INT[c.b]; c.l = today; S.cards[key] = c;
  const f = isW ? ['w', 'wc'] : ['p', 'pc'];
  log[f[0]]++; if (ok) log[f[1]]++;
  if (isW && ok && ms != null) {
    log['rt' + md] = (log['rt' + md] || 0) + ms; log['rn' + md] = (log['rn' + md] || 0) + 1;
    if (ms <= 1500) log['rf' + md] = (log['rf' + md] || 0) + 1;
    c.t = Math.round(ms / 100); // 0.1秒単位・最後に正解した時の速さ
  }
  return c;
}
const SYNC_EVERY = 5 * 60 * 1000; // 5分ごとに裏で送る（画面は読み直さない）
const Sync = {
  last: 0, busy: false, dirty: false, state: '', hiddenAt: 0,
  async pull() {
    try {
      Plan.pull();
      const r = await fetch(SYNC_URL + SYNC_KEY, { cache: 'no-store' }); if (!r.ok) return false;
      const remote = await r.json();
      if (remote && remote.cards) { const u = S.updatedAt; S = normalize(mergeState(S, remote)); S.updatedAt = Math.max(u, S.updatedAt); flush(true); }
      return true;
    } catch { return false; }
  },
  async push(keepalive) {
    if (!keepalive && (this.busy || G || F)) return false; // 解いている途中は手元の記録を差し替えない（終わってから送る）
    if (!navigator.onLine) { this.status('offline'); return false; }
    this.busy = true; let ok = false;
    try {
      if (!keepalive) { this.status('busy'); if (!await this.pull()) throw 0; } // 先に相手の分を取り込んでから上書き
      const body = JSON.stringify(S);
      const r = await fetch(SYNC_URL + SYNC_KEY, { method: 'PUT', body, keepalive: !!keepalive && body.length < 60000 });
      ok = r.ok; if (ok) { this.last = Date.now(); this.dirty = false; }
    } catch {}
    this.busy = false; this.status(ok ? 'ok' : navigator.onLine ? 'error' : 'offline');
    return ok;
  },
  later() { this.dirty = true; },
  status(st) { if (st) this.state = st; if (typeof syncInfo === 'function') syncInfo(); },
};
setInterval(() => { if (!document.hidden) Sync.push(); }, SYNC_EVERY);
addEventListener('online', () => Sync.push()); // 電波が戻ったら、たまっていた分を送る
addEventListener('offline', () => Sync.status('offline'));

addEventListener('pagehide', () => { flush(); if (Sync.dirty) Sync.push(true); });
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) { Sync.hiddenAt = Date.now(); flush(); if (Sync.dirty) Sync.push(true); return; }
  if (!S || G || F) return;
  // 1時間以上たってから開いた時だけ、新しい版があれば読み直す（使っている途中では読み直さない）
  if (Sync.hiddenAt && Date.now() - Sync.hiddenAt > 60 * 60 * 1000 && await newVersion()) { flush(); return location.reload(); }
  if (await Sync.pull()) { show(tab); Sync.push(); } // 別の端末でやった分を開いた時に取り込む
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
  const pr = k => type === 'w' ? Plan.prio(k.slice(2)) : 0; // AIコーチの苦手度が高い語を先に
  due.sort((a, b) => pr(b) - pr(a) || S.cards[a].d - S.cards[b].d || S.cards[a].b - S.cards[b].b);
  const maxRev = Math.round(n * S.settings.ratio / 100);
  let rev = due.slice(0, maxRev);
  // 期日前でも苦手語を混ぜる（AIコーチの focus・最大で1回分の20%）
  if (type === 'w' && Plan.v && Plan.v.focus) {
    const inRev = new Set(rev), cap = Math.round(n * (Plan.v.boost || .2));
    const weak = Plan.v.focus.map(en => 'w:' + en).filter(k => S.cards[k] && !inRev.has(k) && !exclude.has(k)).slice(0, Math.max(0, Math.min(cap, n - rev.length)));
    rev = rev.concat(weak);
  }
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


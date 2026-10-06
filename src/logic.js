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
}
addEventListener('pagehide', () => flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
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


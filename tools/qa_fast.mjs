// 高速モード（裏返す→正解・ひとつ前を間違えた）と写真なしの顔の除外を確かめる
//   node qa_fast.mjs <出力dir>   ※同期サーバーへの通信は全部止める（本番KVに触らない）
import { webkit, chromium, devices } from 'playwright';
const OUT = process.argv[2], sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = 'http://localhost:8791/?qa=' + Date.now();
const cfgs = [
  ['ios', webkit, { ...devices['iPhone 13'] }],
  ['ios375', webkit, { ...devices['iPhone 13'], viewport: { width: 375, height: 667 } }],
  ['pc', chromium, { viewport: { width: 1280, height: 800 } }],
];
let fail = 0; const ck = (name, cond, msg) => { if (!cond) { fail++; console.log('  NG', name, msg); } };
for (const [name, eng, opt] of cfgs) {
  const b = await eng.launch(eng === chromium ? { channel: 'chrome' } : {}); const ctx = await b.newContext(opt);
  await ctx.route(/workers\.dev/, r => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('tdm-sync-key', 'qa-test-fast-0000001'));
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/workers\.dev|Failed to load resource|ERR_FAILED/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL); await sleep(1500);
  const tap = async sel => { if (opt.hasTouch) await p.tap(sel); else await p.click(sel); };
  const A = f => p.evaluate(f);
  // ---- 写真なしの顔 ----
  const faces = await A(() => { const A = window.__app, P = A.P; const deck = [...new Set(Object.values(A.S.today.p ? A.S.today.p.q : []))];
    return { n: P.length, stubs: P.filter(x => x.stub || /_stub/.test(x.img)).length, all: window.PEOPLE.length, stubAll: window.PEOPLE.filter(x => x.stub).length }; });
  ck(name, faces.stubs === 0, 'P に写真なしが残っている');
  // 虎子屋だけにして出題を組む → 写真なしは出ない
  const tcy = await A(() => { const A = window.__app, S = A.S; S.settings.groups = { tc: false, idea: false, peer: false, toraA: false, toraB: false, tcy: true }; delete S.today.p; A.show('sFaces');
    const q = S.today.p.q; return { len: q.length, stub: q.filter(k => /^!?p:k\d/.test(k)).length }; });
  ck(name, tcy.stub === 0 && tcy.len > 0, 'tcy の出題に stub ' + JSON.stringify(tcy));
  // 古い出題（stub入り）を持った状態で読み直す → 外される
  await A(() => { const S = window.__app.S; S.today.p.q = ['p:k1', 'p:k2', ...S.today.p.q]; S.today.p.pos = 1; localStorage.setItem('tdm2', JSON.stringify(S)); });
  await p.reload(); await sleep(1500);
  const cleaned = await A(() => { const t = window.__app.S.today.p; return { stub: t.q.filter(k => /^!?p:k\d/.test(k)).length, pos: t.pos }; });
  ck(name, cleaned.stub === 0 && cleaned.pos === 0, '古い出題の stub が残る ' + JSON.stringify(cleaned));
  const chips = await (async () => { await tap('nav label[data-t="sFaces"]'); await sleep(300); return p.$$eval('#gChips .chip', a => a.map(x => x.textContent.trim())); })();
  // ---- 高速モード ----
  await A(() => { const S = window.__app.S; S.settings.flash = 30; S.settings.mode.w = 'fast'; }); // 3秒（撮影の間に時間切れにしない）
  await tap('nav label[data-t="sWords"]'); await sleep(300);
  await tap('.seg[data-type="w"] label[data-m="fast"]'); await sleep(100);
  await tap('#wStart'); await sleep(500);
  ck(name, await A(() => document.getElementById('fUndo').classList.contains('dis')), '最初の1語で「ひとつ前」が押せる');
  ck(name, await A(() => !document.getElementById('fNo') && !document.getElementById('fchk')), '旧ボタンが残っている');
  await p.screenshot({ path: `${OUT}/${name}_fast_1_front.png` });
  await sleep(300); await tap('#fGo'); await sleep(250);
  const flip = await A(() => ({ ph: window.__app.F.phase, mean: document.getElementById('fmean').textContent, btn: document.getElementById('fGo').textContent.trim() }));
  ck(name, flip.ph === 'flip' && flip.mean && flip.btn === '正解', '裏返し後 ' + JSON.stringify(flip));
  await p.screenshot({ path: `${OUT}/${name}_fast_2_flipped.png` });
  // 正解を押す前の状態を控える
  const pre = await A(() => { const A = window.__app, S = A.S, F = A.F, k = F.key; const d = S.days[A.dayStr()] || {};
    return { key: k, card: S.cards[k] ? { ...S.cards[k] } : null, wc: d.wc || 0, w: d.w || 0, xp: S.xp || 0, dxp: d.xp || 0, rnf: d.rnf || 0, rtf: d.rtf || 0, evn: (S.ev || []).length, again: F.again }; });
  await tap('#fGo'); await sleep(250);
  const mid = await A(() => { const A = window.__app, S = A.S, e = S.ev[S.ev.length - 1]; return { e: [...e], card: { ...S.cards[A.F.prev.key] }, ph: A.F.phase, undoDis: document.getElementById('fUndo').classList.contains('dis'), prev: document.getElementById('fprev').textContent }; });
  ck(name, mid.e[2] === 1 && mid.e[4] === 'f' && mid.e[3] > 0 && mid.e.length === 6 && mid.e[5] >= mid.e[3], '正解の行 ' + JSON.stringify(mid.e));
  ck(name, !mid.undoDis && mid.ph === 'ask', '正解の後に次へ進まない/押せない');
  // ひとつ前を間違えた（2回押す → 1回分だけ）
  await tap('#fUndo'); await sleep(150);
  await A(() => window.__app.fastUndo());
  await sleep(250);
  await p.screenshot({ path: `${OUT}/${name}_fast_3_undo.png` });
  const post = await A(() => { const A = window.__app, S = A.S, F = A.F, u = F.prev, d = S.days[A.dayStr()];
    const e = S.ev.find(x => x === u.ev); const q = S.today.w.q, pos = S.today.w.pos;
    return { e: [...e], card: { ...S.cards[u.key] }, wc: d.wc || 0, w: d.w || 0, xp: S.xp || 0, dxp: d.xp || 0, rnf: d.rnf || 0, rtf: d.rtf || 0, evn: S.ev.length, again: q.slice(pos).indexOf('!' + u.key), againN: q.filter(k => k === '!' + u.key).length,
      btn: document.getElementById('fUndo').textContent.trim(), dis: document.getElementById('fUndo').classList.contains('dis'), note: document.getElementById('fprev').textContent }; });
  const today = await A(() => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000));
  ck(name, post.e[2] === 0 && post.e[3] === -1 && post.e[4] === 'fx' && post.e.length === 5, '直した行 ' + JSON.stringify(post.e));
  ck(name, post.evn === pre.evn + 1, '行が増えすぎ ' + pre.evn + '→' + post.evn);
  ck(name, post.wc === pre.wc && post.w === pre.w + 1, `日ごとの数 w ${pre.w}→${post.w} wc ${pre.wc}→${post.wc}`);
  ck(name, post.xp === pre.xp && post.dxp === pre.dxp, `XP ${pre.xp}→${post.xp}`);
  ck(name, post.rnf === pre.rnf && post.rtf === pre.rtf, `時間 rnf ${pre.rnf}→${post.rnf}`);
  const exp = pre.card ? { n: pre.card.n + 1, w: (pre.card.w || 0) + 1 } : { n: 1, w: 1 };
  ck(name, post.card.b === 1 && post.card.d === today + 1 && post.card.n === exp.n && post.card.w === exp.w, 'カード ' + JSON.stringify(post.card));
  ck(name, post.againN === 1 && post.again >= 5 && post.again <= 7, 'もう一度の位置 ' + post.again + ' x' + post.againN);
  ck(name, post.dis && post.btn === '間違いにしました', '2回目が押せる ' + post.btn);
  // 時間切れ：自動で✕・ひとつ前は押せない
  await A(() => { window.__app.S.settings.flash = 4; }); await A(() => { const F = window.__app.F; }); 
  await sleep(300); await tap('#fGo'); await sleep(200); await tap('#fGo'); await sleep(200); // もう1語は正解
  await sleep(600);
  const to = await A(() => new Promise(r => setTimeout(() => { const A = window.__app, S = A.S; r({ e: S.ev[S.ev.length - 1], dis: document.getElementById('fUndo').classList.contains('dis') }); }, 700)));
  ck(name, to.e[2] === 0 && to.e[4][0] === 'f' && to.dis, '時間切れ ' + JSON.stringify(to));
  // 同期の合わせ: 同じ行が○（相手）と fx（手元）→ fx を残す
  const mg = await A(() => { const S = window.__app.S, e = S.ev.find(x => x[4] === 'fx'); const remote = JSON.parse(JSON.stringify(S)); const r = remote.ev.find(x => x[0] === e[0] && x[1] === e[1]); r[2] = 1; r[4] = 'f'; r[3] = 800;
    const m = mergeState(S, remote); const m2 = mergeState(remote, S); const f = x => x.ev.filter(y => y[0] === e[0] && y[1] === e[1]); return [f(m), f(m2)]; }).catch(e => String(e));
  ck(name, Array.isArray(mg) && mg.every(a => a.length === 1 && a[0][4] === 'fx'), '同期の合わせ ' + JSON.stringify(mg));
  await A(() => document.getElementById('fxClose').click()); await sleep(300);
  console.log(name, 'faces', JSON.stringify(faces), 'tcyDeck', tcy.len, 'chips', chips.join(' / '), 'errors', JSON.stringify(errs.slice(0, 5)));
  await b.close();
}
console.log(fail ? `FAIL ${fail}` : 'ALL OK');

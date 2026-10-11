// 常識クイズ・顔タブ・今日の単語カードの確認（同期は止めてQA用キー）。node qa_trivia.mjs <dir> [url]
import { webkit, chromium, devices } from 'playwright';
const OUT = process.argv[2], URL = (process.argv[3] || 'http://localhost:8791/') + '?qa=' + Date.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (const [name, eng, opt] of [['ios', webkit, { ...devices['iPhone 13'], viewport: { width: 375, height: 812 } }], ['pc', chromium, { viewport: { width: 1280, height: 800 } }]]) {
  const b = await eng.launch(eng === chromium ? { channel: 'chrome' } : {}); const ctx = await b.newContext({ ...opt, serviceWorkers: "block" });
  await ctx.route(/workers\.dev/, r => r.abort()); await ctx.addInitScript(() => localStorage.setItem('tdm-sync-key', 'qa-test-trivia-0000001'));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const tap = async sel => { if (process.env.V) console.log("tap", sel, await st().catch(()=>""));  if (opt.hasTouch) await p.tap(sel); else await p.click(sel); await sleep(350); };
  const shot = async t => p.screenshot({ path: `${OUT}/${name}_${t}.png` });
  const st = () => p.evaluate(() => { const A = window.__app; return [document.querySelector('.screen.on').id, A.G && A.G.type, A.F ? 'F' : '', A.D ? 'D' : '', document.getElementById('dlyN').textContent].join(' '); });
  const of = () => p.evaluate(() => [document.documentElement, ...document.querySelectorAll('.screen.on, .screen.on *, nav, nav *')].filter(e => e.scrollWidth > e.clientWidth + 1 && !['hidden', 'visible'].includes(getComputedStyle(e).overflowX)).map(e => (e.id || e.className) + ' ' + e.scrollWidth + '>' + e.clientWidth).join('|') || 'ok');
  await p.goto(URL); await sleep(1200);
  const log = [];
  log.push('home ' + await st() + ' of=' + await of()); await shot('1home');
  log.push('daily-in-view ' + await p.evaluate(() => { const r = document.getElementById('dlyGo').getBoundingClientRect(); return r.bottom <= innerHeight - document.getElementById('nav').offsetHeight; }));
  await tap('nav label[data-t=sFaces]'); log.push('faces ' + await st() + ' of=' + await of()); await shot('2faces');
  await tap('nav label[data-t=sQuiz]'); log.push('quiz ' + await st() + ' of=' + await of()); await shot('3quiz');
  await tap('#kStart'); await sleep(300); log.push('kplay ' + await st() + ' of=' + await of()); await shot('4kq');
  await tap('#opts .opt:nth-child(1)'); await sleep(400); await shot('5ksheet');
  await tap('#bNext'); await sleep(300); log.push('after next pos=' + await p.evaluate(() => window.__app.S.today.k.pos));
  await tap('#xClose'); log.push('closed ' + await st());
  await tap('#sQuiz .seg label[data-m=card]'); await tap('#kStart'); await sleep(300); await shot('6kcard');
  await tap('#fcard'); await sleep(500); await shot('7kcardback'); await tap('#bOk'); await sleep(400); await tap('#xClose');
  // 今日の単語カード：小さい配分で最後まで（単語は4択、2問目で途中離脱→続きから）
  await p.evaluate(() => { const S = window.__app.S; S.settings.daily = { w: 3, p: 2, k: 2 }; S.settings.mode.w = 'quiz'; S.settings.timer = 0; window.__app.show('sWords'); });
  await sleep(300); log.push('daily0 ' + await st() + await p.evaluate(() => JSON.stringify([window.__app.dailyProg().segs, window.__app.S.today.dx, window.__app.S.today.date]))); await shot('8daily0');
  const ans = async () => { const ok = await p.evaluate(() => [...document.querySelectorAll('#opts .opt')].findIndex(o => o._o && o._o.ok)); await tap(`#opts .opt:nth-child(${ok + 1})`); await sleep(200); const sh = await p.evaluate(() => document.getElementById('sheet').classList.contains('on')); if (sh) await tap('#bNext'); else await sleep(800); };
  await tap('#dlyGo'); await sleep(300); log.push('d1 ' + await st() + ' lbl=' + await p.evaluate(() => document.getElementById('dlyP').textContent)); await shot('9dplay');
  await ans(); await tap('#xClose'); log.push('quit ' + await st());
  await tap('#dlyGo'); await sleep(300); log.push('resume ' + await st());
  for (let i = 0; i < 12; i++) { const s = await st(); if (s.startsWith('sDone')) break; await ans(); log.push('  ' + await st()); }
  await sleep(1500); await shot('10ddone'); log.push('done ' + await st() + ' title=' + await p.evaluate(() => document.getElementById('dTitle').textContent));
  await tap('#dHome'); log.push('home2 ' + await st() + ' btn=' + await p.evaluate(() => document.getElementById('dlyGo').textContent)); await shot('11home2');
  // 高速モードでも今日の単語カードが回るか
  await p.evaluate(() => { const S = window.__app.S; S.settings.daily = { w: 6, p: 2, k: 3 }; S.settings.mode.w = 'fast'; window.__app.show('sWords'); });
  await tap('#dlyGo'); await sleep(300); log.push('fast ' + await st() + ' ' + await p.evaluate(() => document.getElementById('dlyF').textContent)); await shot('12dfast');
  for (let i = 0; i < 3; i++) { await p.dispatchEvent('#fGo', 'pointerdown', { button: 0 }); await sleep(250); await p.dispatchEvent('#fGo', 'pointerdown', { button: 0 }); await sleep(250); }
  log.push('fast->next ' + await st());
  console.log(name, '\n ' + log.join('\n '), '\n errors', JSON.stringify(errs)); await b.close();
}

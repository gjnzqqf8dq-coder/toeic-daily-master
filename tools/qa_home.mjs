// ホームの実力カードの確認：同期は止める。空→ダミー記録→カードを押して分析へ
import { webkit, chromium, devices } from 'playwright';
const OUT = process.argv[2], URL = (process.argv[3] || 'http://localhost:8791/') + '?qa=' + Date.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (const [name, eng, opt] of [['ios', webkit, { ...devices['iPhone 13'] }], ['se', webkit, { ...devices['iPhone 13'], viewport: { width: 375, height: 812 } }], ['pc', chromium, { viewport: { width: 1280, height: 800 } }]]) {
  const b = await eng.launch(eng === chromium ? { channel: 'chrome' } : {}); const ctx = await b.newContext(opt);
  await ctx.route(/workers\.dev/, r => r.abort()); await ctx.addInitScript(() => localStorage.setItem('tdm-sync-key', 'qa-test-ana-0000001'));
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(URL); await sleep(1200);
  const of = () => p.evaluate(() => [document.documentElement, ...document.querySelectorAll('.screen.on, .screen.on *')].filter(e => e.scrollWidth > e.clientWidth + 1 && !['hidden', 'visible'].includes(getComputedStyle(e).overflowX)).map(e => (e.id || e.className) + ' ' + e.scrollWidth + '>' + e.clientWidth).join('|') || 'ok');
  const shot = async t => { await p.screenshot({ path: `${OUT}/${name}_${t}_0.png` }); await p.evaluate(() => document.getElementById('hk').scrollIntoView({ block: 'end' })); await sleep(150); await p.screenshot({ path: `${OUT}/${name}_${t}_1.png` }); await p.evaluate(() => document.getElementById('sWords').scrollTop = 0); };
  const r1 = await of(); await shot('empty');
  await p.evaluate(() => { const A = window.__app, S = A.S, W = window.WORDS, now = Date.now() / 1000; let sd = 3; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < 7; i++) { const ds = A.dayStr(Math.floor((Date.now() - new Date().getTimezoneOffset() * 6e4) / 864e5) - i); S.days[ds] = { w: 120, wc: 90 + i, p: 0, pc: 0 }; }
    S.ev = Array.from({ length: 300 }, (_, k) => [Math.floor(now - 3000 + k), W[k].en, rnd() < .8 ? 1 : 0, Math.round(300 + rnd() * 900), 'f']);
    W.slice(0, 900).forEach((w, i) => S.cards['w:' + w.en] = { b: i < 450 ? 4 : rnd() < .5 ? 2 : 1, n: 2, w: 1, d: 0, l: 0 }); A.show('sWords'); });
  await sleep(400); const r2 = await of(); await shot('data');
  if (opt.hasTouch) await p.tap('#hk'); else await p.click('#hk'); await sleep(300);
  const on = await p.evaluate(() => document.querySelector('.screen.on').id + '/' + document.querySelector('nav label.on').dataset.t);
  console.log(name, 'overflow', r1, r2, 'tap->', on, 'errors', JSON.stringify(errs)); await b.close();
}

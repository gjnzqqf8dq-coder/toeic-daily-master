// 分析タブの確認：同期サーバーへの通信は止める（本番KVを汚さない）。空の状態と、QA用のダミー記録を入れた状態を撮る
import { webkit, chromium, devices } from 'playwright';
const OUT = process.argv[2], URL = (process.argv[3] || 'http://localhost:8791/') + '?qa=' + Date.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cfgs = [['ios', webkit, { ...devices['iPhone 13'] }], ['se', webkit, { ...devices['iPhone 13'], viewport: { width: 375, height: 812 } }], ['pc', chromium, { viewport: { width: 1280, height: 800 } }]];
for (const [name, eng, opt] of cfgs) {
  const b = await eng.launch(eng === chromium ? { channel: 'chrome' } : {}); const ctx = await b.newContext(opt);
  await ctx.route(/workers\.dev/, r => r.abort());
  await ctx.addInitScript(() => localStorage.setItem('tdm-sync-key', 'qa-test-ana-0000001'));
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error' && !/workers\.dev|Failed to load/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL); await sleep(1200);
  const tap = async sel => { if (opt.hasTouch) await p.tap(sel); else await p.click(sel); };
  const of = async () => p.evaluate(() => [document.documentElement, ...document.querySelectorAll('.screen.on, .screen.on *')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'hidden' && getComputedStyle(e).overflowX !== 'visible').map(e => (e.id || e.className) + ' ' + e.scrollWidth + '>' + e.clientWidth).join('|') || 'ok');
  const shots = async tag => { for (let i = 0; i < 4; i++) { await p.evaluate(y => document.getElementById('sAna').scrollTop = y, i * 680); await sleep(150); await p.screenshot({ path: `${OUT}/${name}_${tag}_${i}.png` }); } await p.evaluate(() => document.getElementById('sAna').scrollTop = 0); };
  await tap('nav label[data-t="sAna"]'); await sleep(400);
  const r1 = await of(); await shots('empty');
  await p.evaluate(() => {
    const A = window.__app, S = A.S, now = Date.now() / 1000, W = window.WORDS; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    S.ev = [];
    for (let i = 29; i >= 0; i--) {
      if (rnd() < .3 && i) continue; const ds = A.dayStr(Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 864e5) - i);
      const w = Math.floor(40 + rnd() * 160), p = rnd() < .5 ? Math.floor(rnd() * 60) : 0; S.days[ds] = { w, wc: Math.floor(w * (.6 + rnd() * .35)), p, pc: Math.floor(p * .7), xp: 0 };
      if (i < 4) for (let k = 0; k < w; k++) { const h = [7, 8, 12, 21, 22, 23][Math.floor(rnd() * 6)]; const t = now - i * 86400 - (new Date().getHours() - h) * 3600 + rnd() * 3000; const md = ['f', 'f', 'q', 'c'][Math.floor(rnd() * 4)]; S.ev.push([Math.floor(Math.min(t, now - 5)), W[Math.floor(rnd() * 600)].en, rnd() < .8 ? 1 : 0, Math.round(250 + Math.exp(rnd() * 3) * 180), md]); }
    }
    S.ev.sort((a, b) => a[0] - b[0]);
    W.slice(0, 700).forEach((w, i) => { const b = Math.floor(rnd() * 7), n = 1 + Math.floor(rnd() * 6); S.cards['w:' + w.en] = { b, n, w: Math.min(n - 1, Math.floor(rnd() * 4)), d: 0, l: 0 }; });
    A.show('sAna');
  });
  await sleep(400);
  const r2 = await of(); await shots('data');
  const md = await p.$$('#anMode button:not([disabled])'); if (md.length > 1) { await md[1].click(); await sleep(200); }
  await p.evaluate(() => document.getElementById('anTime').scrollIntoView()); await sleep(150); await p.screenshot({ path: `${OUT}/${name}_mode.png` });
  // 他のタブへ行って戻る
  await tap('nav label[data-t="sLog"]'); await sleep(300); await tap('nav label[data-t="sAna"]'); await sleep(300);
  const on = await p.evaluate(() => document.querySelector('nav label.on').dataset.t + ' ' + document.querySelector('.screen.on').id);
  console.log(name, 'overflow empty:', r1, ' data:', r2, ' nav:', on, ' errors:', JSON.stringify(errs.slice(0, 5)));
  await b.close();
}

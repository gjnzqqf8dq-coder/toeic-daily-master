import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });   // 低速スマホ相当
await p.addInitScript(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); });
const t0 = Date.now(); await p.goto('http://localhost:8791/?perf=' + Date.now()); await p.waitForLoadState('load'); const loadMs = Date.now() - t0;
await sleep(3000);
const boot = await p.evaluate(() => { const r = window.__lt.slice(); window.__lt = []; return r; });
await p.evaluate(() => { window.__app.S.settings.timer = 6; });
await p.tap('#wStart'); await sleep(800);
const first = await p.evaluate(() => { const r = window.__lt.slice(); window.__lt = []; return r; });
const per = [];
for (let i = 0; i < 8; i++) {
  const s = Date.now();
  await p.evaluate(() => { const o = [...document.querySelectorAll('#opts .opt')]; (o.find(e => e._o.ok) || o[0]).click(); });
  await sleep(1000); per.push(Date.now() - s);
}
const ans = await p.evaluate(() => { const r = window.__lt.slice(); window.__lt = []; return r; });
await p.evaluate(() => window.__app.finish()); await sleep(2500);
const fin = await p.evaluate(() => window.__lt.slice());
const sum = a => a.reduce((s, x) => s + x[1], 0);
console.log(JSON.stringify({ loadMs, bootLong: sum(boot), bootN: boot.length, firstTap: sum(first), answers8: sum(ans), ansMax: Math.max(0, ...ans.map(x => x[1])), finish: sum(fin), finMax: Math.max(0, ...fin.map(x => x[1])) }));
await b.close();

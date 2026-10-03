import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await chromium.launch({ channel: 'chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
await p.addInitScript(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true }); });
await p.goto('http://localhost:8791/?perf=' + Date.now()); await sleep(2500);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
await p.evaluate(() => { const A = window.__app; A.S.settings.timer = 0; A.S.settings.mode = { w: 'card', p: 'card' }; A.show('sWords'); });
await p.tap('#wStart'); await sleep(1200);
const res = [];
for (let i = 0; i < 6; i++) {
  await p.evaluate(() => { window.__lt = []; window.__fr = []; const loop = t => { window.__fr.push(t); if (window.__fr.length < 60) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
  await sleep(100);
  await p.evaluate(() => { window.__t0 = performance.now(); document.getElementById('fcard').click(); });
  await sleep(900);
  const r = await p.evaluate(() => { const f = window.__fr.filter(t => t >= window.__t0); let gap = 0; for (let i = 1; i < f.length; i++) gap = Math.max(gap, f[i] - f[i - 1]); return { first: Math.round(f[0] - window.__t0), maxGap: Math.round(gap), lt: window.__lt.reduce((a, b) => a + b, 0) }; });
  res.push(r);
  await p.evaluate(() => document.getElementById('bOk').click()); await sleep(1200);
}
const avg = k => Math.round(res.reduce((s, r) => s + r[k], 0) / res.length);
console.log(JSON.stringify({ firstFrameMs: avg('first'), maxFrameGapMs: avg('maxGap'), longTaskMs: avg('lt'), raw: res }));
await b.close();

import { webkit, chromium, devices } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
for (const [n, eng, opt] of [['ios', webkit, devices['iPhone 13']], ['pc', chromium, { viewport: { width: 1280, height: 800 } }]]) {
  const b = await eng.launch(eng === chromium ? { channel: 'chrome' } : {}); const p = await (await b.newContext(opt)).newPage();
  await p.goto('http://localhost:8791/?o=' + Date.now()); await sleep(1500);
  const res = [];
  const check = async label => res.push(label + ':' + await p.evaluate(() => [...document.querySelectorAll('.screen.on, .screen.on *')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'hidden' && getComputedStyle(e).overflowX !== 'visible').map(e => (e.id || e.className) + ' ' + e.scrollWidth + '>' + e.clientWidth).join('|') || 'ok'));
  for (const m of ['quiz', 'card']) for (const t of ['w', 'p']) {
    await p.evaluate(([m, t]) => { const A = window.__app; A.S.settings.timer = 0; A.S.settings.mode = { w: m, p: m }; A.show(t === 'w' ? 'sWords' : 'sFaces'); A.start(t); }, [m, t]); await sleep(500);
    await check(m + t);
    if (m === 'card') { await p.evaluate(() => window.__app.flipCard()); await sleep(500); await check(m + t + '-back'); }
    await p.evaluate(() => document.getElementById('xClose').click()); await sleep(200);
  }
  for (const s of ['sWords', 'sFaces', 'sLog', 'sSet']) { await p.evaluate(s => window.__app.show(s), s); await sleep(200); await check(s); }
  console.log(n, res.join('  ')); await b.close();
}

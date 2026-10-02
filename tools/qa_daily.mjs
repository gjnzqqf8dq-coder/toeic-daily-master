import { webkit, chromium, devices } from 'playwright';
const OUT = process.argv[2], URL = 'http://localhost:8791/?qa=' + Date.now();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cfgs = [
  ['ios', webkit, { ...devices['iPhone 13'] }],
  ['pc', chromium, { viewport: { width: 1280, height: 800 } }],
];
for (const [name, eng, opt] of cfgs) {
  const b = await eng.launch(eng === chromium ? { channel: 'chrome' } : {}); const ctx = await b.newContext(opt); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL); await sleep(1500);
  const shot = async n => { await sleep(450); await p.screenshot({ path: `${OUT}/${name}_${n}.png` }); };
  const tap = async sel => { if (opt.hasTouch) await p.tap(sel); else await p.click(sel); };
  await p.evaluate(() => { window.__app.S.settings.timer = 0; });
  await shot('01_home');
  await tap('nav label[data-t="sFaces"]'); await shot('02_faces');
  await tap('nav label[data-t="sLog"]'); await shot('03_log');
  await tap('nav label[data-t="sSet"]'); await shot('04_set');
  await tap('nav label[data-t="sWords"]'); await sleep(200);
  await tap('#wStart'); await shot('05_wquiz');
  const wrong = await p.$$('#opts .opt'); let wi = 0;
  for (let i = 0; i < wrong.length; i++) if (!(await wrong[i].evaluate(e => e._o.ok))) { wi = i; break; }
  await wrong[wi].click(); await shot('06_wquiz_wrong');
  await tap('#bNext'); await sleep(300);
  const opts = await p.$$('#opts .opt'); for (const o of opts) if (await o.evaluate(e => e._o.ok)) { await o.click(); break; }
  await sleep(150); await p.screenshot({ path: `${OUT}/${name}_07_wquiz_ok.png` });
  await sleep(900); await tap('#xClose'); await sleep(200);
  await tap('nav label[data-t="sFaces"]'); await sleep(200);
  await tap('#pStart'); await shot('08_pquiz');
  const po = await p.$$('#opts .opt'); for (const o of po) if (await o.evaluate(e => e._o.ok)) { await o.click(); break; }
  await shot('09_pquiz_sheet');
  await tap('#bNext'); await sleep(200); await tap('#xClose'); await sleep(200);
  await tap('.seg[data-type="p"] label[data-m="card"]'); await sleep(100);
  await tap('#pStart'); await shot('10_pcard_front');
  await tap('#fcard'); await shot('11_pcard_back');
  await tap('#bOk'); await sleep(300); await tap('#xClose'); await sleep(200);
  await tap('nav label[data-t="sWords"]'); await sleep(200);
  await tap('.seg[data-type="w"] label[data-m="card"]'); await sleep(100);
  await tap('#wStart'); await shot('12_wcard_front');
  await tap('#fcard'); await shot('13_wcard_back');
  await p.evaluate(() => window.__app.finish()); await sleep(1800); await p.screenshot({ path: `${OUT}/${name}_14_done.png` });
  await p.evaluate(() => window.__app.levelUp(5)); await shot('15_lvup');
  console.log(name, 'errors:', JSON.stringify(errs.slice(0, 5)));
  await b.close();
}

import { webkit, devices } from 'playwright';
const out = process.argv[2]; const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = await webkit.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], recordVideo: { dir: out, size: { width: 390, height: 844 } } });
const p = await ctx.newPage(); await p.goto('http://localhost:8791/?v=' + Date.now()); await sleep(1500);
await p.evaluate(() => { const A = window.__app; A.S.settings.timer = 0; A.S.settings.mode = { w: 'card', p: 'card' }; A.show('sWords'); });
await p.tap('#wStart'); await sleep(700);
// 各フレームで「表示中の面」と「不透明度」を記録
await p.evaluate(() => { window.__f = []; const fc = document.getElementById('fcard'); const loop = () => { const r = fc.classList.contains('rev'); const tr = getComputedStyle(fc.querySelector('.flip')).transform; window.__f.push([Math.round(performance.now()), r ? 'B' : 'A', getComputedStyle(fc).opacity, document.getElementById(r ? 'fb' : 'fa').innerText.slice(0, 12), tr]); requestAnimationFrame(loop); }; loop(); });
for (let i = 0; i < 3; i++) { await p.tap('#fcard'); await sleep(700); await p.tap('#bOk'); await sleep(700); }
const f = await p.evaluate(() => window.__f);
// 次のカードへ移る瞬間：不透明度>0 で裏面(B)が見えているのに、内容が新しい問題に変わっているフレームがないか
let bad = 0; for (let i = 1; i < f.length; i++) { if (f[i][1] === 'B' && +f[i][2] > 0.05 && f[i - 1][1] === 'B' && f[i][3] !== f[i - 1][3]) bad++; }
const flips = f.filter(x => x[4] !== 'none').length;
console.log(JSON.stringify({ frames: f.length, rotatingFrames: flips, badFrames: bad }));
await ctx.close(); await b.close();

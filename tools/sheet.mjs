import { chromium } from 'playwright'; import fs from 'fs';
const [dir, prefix, cols, w, out] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter(f => f.startsWith(prefix) && f.endsWith('.png') && !f.startsWith('s_')).sort();
const html = `<body style="margin:0;background:#888;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:6px;padding:6px;font:12px sans-serif">` +
  files.map(f => `<div style="background:#fff"><div>${f}</div><img src="file://${dir}/${f}" style="width:${w}px;display:block"></div>`).join('') + '</body>';
fs.writeFileSync(dir + '/sheet.html', html);
const b = await chromium.launch({ channel: 'chrome' }); const p = await b.newPage({ viewport: { width: cols * (+w + 6) + 6, height: 600 } });
await p.goto('file://' + dir + '/sheet.html'); await p.waitForTimeout(500); await p.screenshot({ path: out, fullPage: true }); await b.close();


// =========================================================
// 端末
// =========================================================
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = n => `<svg><use href="#i-${n}"/></svg>`;
const POP = [{ transform: 'scale(.6)' }, { transform: 'scale(1.18)', offset: .6 }, { transform: 'none' }];
function pop(el, ms = 350) { try { el.animate(POP, { duration: ms, easing: 'cubic-bezier(.34,1.56,.64,1)' }); } catch {} }
// ボタンは <label> の中に <input type=checkbox switch> を入れてある。
// iPhoneでは「指で直接押したスイッチ」だけが本体を振動させるため、押した瞬間に Safari が触覚を返す。
function onTap(el, fn) { el.addEventListener('click', e => { if (e.target.classList && e.target.classList.contains('hsw')) return; fn(e); }); }
function setTx(el, t) { (el.querySelector('.tx') || el).textContent = t; }
function hswHTML() { return `<input type="checkbox" switch class="hsw"${S && !S.settings.hap ? ' disabled' : ''}>`; }
function applyHap() { document.querySelectorAll('.hsw').forEach(i => i.disabled = !S.settings.hap); }

// Android は vibrate で強弱のパターンを付ける（iPhone はタップ時の触覚のみ）
const Haptic = {
  native(kind) { try { const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.haptic; if (h) { h.postMessage(kind); return true; } } catch {} return false; },
  run(ms, kind) { if (!S || !S.settings.hap) return; if (this.native(kind || 'light')) return; if (isIOS || !navigator.vibrate) return; try { navigator.vibrate(ms); } catch {} },
  ok(m = 1) { const a = [30]; for (let i = 1; i < Math.min(m, 4); i++) a.push(70, 25); this.run(a, 'success'); },
  ng() { this.run([60, 90, 60, 90, 60], 'error'); },
  up() { this.run([30, 70, 30, 70, 30, 70, 90], 'heavy'); },
  big() { this.run([40, 90, 40, 90, 40, 130, 140], 'heavy'); },
};

// =========================================================
// 効果音：起動時に全部を音声ファイル（WAV）として作っておく。
// iPhone は <audio> で鳴らす（マナーモードでも鳴り、Web Audio の制限も受けない）
// =========================================================
// 効果音でほかのアプリの音楽を止めたり小さくしたりしない（iOS 16.4+ の Audio Session API。消音スイッチONなら効果音は鳴らない）
try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch {}
const SFX = {
  SR: 32000, buf: {}, url: {}, pool: {}, idx: {}, ctx: null, silent: null, rendering: null,
  defs() {
    const D = {};
    const env = (c, t, g, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); };
    const tone = (c, f, t, d, type, a) => { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); env(c, t, g, a, d); o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .02); return o; };
    const bell = (c, f, t, d, a) => { tone(c, f, t, d, 'sine', a); tone(c, f * 2.01, t, d * .6, 'sine', a * .3); tone(c, f * 3.02, t, d * .3, 'sine', a * .1); };
    const chirp = (c, f0, f1, t, d, a) => { const o = tone(c, f0, t, d, 'sine', a); o.frequency.exponentialRampToValueAtTime(f1, t + d * .7); };
    // 「ト↗ピン」：短く柔らかいマリンバの「ト」→高く澄んだグロッケンの「ピン」（余韻長め）
    const mallet = (c, f, t, d, a, bright) => {
      tone(c, f, t, d, 'sine', a);                       // 基音
      tone(c, f * 2, t, d * .5, 'sine', a * (bright ? .28 : .12));
      tone(c, f * 3.98, t, d * .12, 'sine', a * (bright ? .18 : .25)); // 打鍵の硬さ
      tone(c, f * 9.2, t, .03, 'sine', a * .06);         // 当たりのカチッ
    };
    const coin = (c, p, v) => {
      mallet(c, 1046.5 * p, 0, .11, .28 * v, false);     // ト（C6・短い）
      mallet(c, 1568 * p, .085, .7, .32 * v, true);      // ピン（G6・伸ばす）
      tone(c, 3136 * p, .09, .35, 'sine', .035 * v);     // きらめき
    };
    for (let k = 0; k <= 12; k++) {
      const p = Math.pow(2, k / 24);
      D['ok' + k] = [.9, (c, v) => coin(c, p, v)];
    }
    D.ng = [.55, (c, v) => { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(c.destination);
      [[311, 0, .16], [233, .13, .34]].forEach(([f, t, d]) => { const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.32 * v, t + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(lp); o.start(t); o.stop(t + d + .02); }); }];
    D.flip = [.18, (c, v) => { const o = tone(c, 420, 0, .12, 'sine', .12 * v); o.frequency.exponentialRampToValueAtTime(880, .1); }];
    D.tap = [.08, (c, v) => tone(c, 680, 0, .05, 'sine', .08 * v)];
    D.tick = [.07, (c, v) => tone(c, 1000, 0, .04, 'square', .05 * v)];
    D.tickHi = [.07, (c, v) => tone(c, 1500, 0, .05, 'square', .06 * v)];
    D.sheet = [.25, (c, v) => { tone(c, 520, 0, .08, 'sine', .07 * v); tone(c, 780, .04, .12, 'sine', .06 * v); }];
    for (let m = 2; m <= 5; m++) D['mult' + m] = [.9, (c, v) => [0, 4, 7, 12, 16, 19].slice(0, m + 2).forEach((st, i) => bell(c, 784 * Math.pow(2, st / 12), i * .06, .4, .17 * v))];
    D.levelUp = [2, (c, v) => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => bell(c, f, i * .09, .6, .2 * v)); [523, 784, 1047].forEach(f => tone(c, f, .6, 1.3, 'triangle', .1 * v)); }];
    D.fanfare = [2.2, (c, v) => { [[523, 0], [659, .12], [784, .24], [1047, .36], [784, .54], [1047, .66]].forEach(([f, t]) => tone(c, f, t, .3, 'triangle', .26 * v)); [523, 659, 784, 1047].forEach(f => tone(c, f, .9, 1.2, 'sine', .12 * v)); }];
    return D;
  },
  wav(b) {
    const d = b.getChannelData(0), n = d.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, b.sampleRate, true); v.setUint32(28, b.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  },
  async render() {
    const O = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!O) return;
    const vol = Math.max(0.0001, S.settings.eff / 100);
    const defs = this.defs();
    for (const [name, [dur, draw]] of Object.entries(defs)) {
      try {
        const oc = new O(1, Math.ceil(this.SR * dur), this.SR); draw(oc, vol);
        const b = await oc.startRendering();
        this.buf[name] = b;
        if (!isIOS) continue;
        if (this.url[name]) URL.revokeObjectURL(this.url[name]);
        this.url[name] = this.wav(b);
        const a = this.pool[name]; if (a && a._u) a.src = this.url[name];
        await new Promise(r => setTimeout(r, 0)); // 1音ずつ間を空けて画面を止めない
      } catch (e) { console.warn('sfx', name, e); }
    }
  },
  silentURL() {
    if (this.silent) return this.silent;
    const O = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const fake = { getChannelData: () => new Float32Array(1600), sampleRate: 16000 };
    return (this.silent = this.wav(fake));
  },
  // 操作の外（タイマー・自動送り）で鳴る音だけ、タップのたびに数個ずつ鳴らせる状態にしておく
  EAGER: ['ng', 'tick', 'tickHi', 'fanfare', 'mult2', 'mult3', 'sheet', 'flip', 'mult4', 'mult5', 'levelUp'],
  el(name) {
    let a = this.pool[name];
    if (!a) { a = this.pool[name] = new Audio(); a.preload = 'auto'; a.setAttribute('playsinline', ''); }
    return a;
  },
  unlock() {
    if (!isIOS) {
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
      if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      return;
    }
    let n = 0;
    for (const name of this.EAGER) {
      if (!this.url[name]) continue;
      const a = this.el(name);
      if (a._u || a._p) continue;
      if (n++ >= 3) break;
      a._p = true; a.src = this.silentURL();
      a.play().then(() => { a.pause(); a._u = true; a._p = false; a.src = this.url[name]; }).catch(() => { a._p = false; });
    }
  },
  play(name) {
    if (!S || S.settings.eff <= 0) return;
    if (!isIOS) {
      if (!this.ctx || !this.buf[name]) return;
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      const s = this.ctx.createBufferSource(); s.buffer = this.buf[name]; s.connect(this.ctx.destination); s.start();
      return;
    }
    if (!this.url[name]) return;
    const a = this.el(name);
    if (a._p) return;
    if (!a._u) { a.src = this.url[name]; a._u = true; } // タップの中なら初回でもそのまま鳴る
    try { a.currentTime = 0; } catch {}
    a.play().then(() => { this.last = name + ' ok'; }).catch(e => { this.last = name + ' ' + e.name; });
  },
};
const Sound = {
  ok(combo) { SFX.play('ok' + Math.min(12, combo)); },
  ng() { SFX.play('ng'); }, tap() { SFX.play('tap'); }, tick(hi) { SFX.play(hi ? 'tickHi' : 'tick'); },
  sheet() { SFX.play('sheet'); }, flip() { SFX.play('flip'); }, multUp(m) { SFX.play('mult' + Math.min(5, m)); },
  levelUp() { SFX.play('levelUp'); }, fanfare() { SFX.play('fanfare'); },
  voices: [],
  loadVoices() { if (!('speechSynthesis' in window)) return; this.voices = speechSynthesis.getVoices(); renderVoices(); },
  pickVoice(lang) {
    const vs = this.voices;
    if (lang === 'en' && S.settings.voice) { const v = vs.find(v => v.voiceURI === S.settings.voice); if (v) return v; }
    const cand = vs.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(lang));
    return cand.find(v => /Samantha|Google US|Ava|Allison|Kyoko|O-Ren/.test(v.name)) || cand[0] || null;
  },
  say(text, lang = 'en') {
    if (!('speechSynthesis' in window) || S.settings.sp <= 0) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'en' ? 'en-US' : 'ja-JP';
      const v = this.pickVoice(lang); if (v) u.voice = v;
      u.volume = S.settings.sp / 100; u.rate = (S.settings.rate / 100) * (lang === 'ja' ? 1.1 : 1);
      speechSynthesis.speak(u);
    } catch {}
  },
};
function wake() { SFX.unlock(); }

// =========================================================
// 演出
// =========================================================
const FX = {
  cv: null, cx: null, parts: [], raf: 0,
  setup() {
    this.cv = $('fx'); this.cx = this.cv.getContext('2d');
    const r = () => { const d = Math.min(2, devicePixelRatio || 1); this.cv.width = innerWidth * d; this.cv.height = innerHeight * d; this.cx.setTransform(d, 0, 0, d, 0, 0); };
    r(); addEventListener('resize', r);
  },
  C: ['#58cc02', '#1cb0f6', '#ff4b4b', '#ffc800', '#ce82ff', '#ff9600'],
  burst(x, y, n = 16, p = 6) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = p * (.4 + Math.random() * .8);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, g: .28, s: 4 + Math.random() * 5, c: this.C[i % 6], life: 1, dec: .025 + Math.random() * .02, sh: i % 2, r: Math.random() * 6, vr: (Math.random() - .5) * .4 }); }
    this.run();
  },
  confetti() {
    for (let i = 0; i < 150; i++) this.parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * .6, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 3, g: .06, s: 6 + Math.random() * 6, c: this.C[i % 6], life: 1, dec: .0035, sh: 2, r: Math.random() * 6, vr: (Math.random() - .5) * .3, sw: Math.random() * 6 });
    this.run();
  },
  run() {
    if (this.raf) return;
    const step = () => {
      const cx = this.cx; cx.clearRect(0, 0, innerWidth, innerHeight);
      this.parts = this.parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
      for (const p of this.parts) {
        p.vy += p.g; p.x += p.vx + (p.sw ? Math.sin(p.y / 30 + p.sw) * .8 : 0); p.y += p.vy; p.r += p.vr; p.life -= p.dec;
        cx.save(); cx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5)); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillStyle = p.c;
        if (p.sh === 0) { cx.beginPath(); cx.arc(0, 0, p.s / 2, 0, 7); cx.fill(); } else if (p.sh === 1) cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
        else cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * Math.abs(Math.cos(p.r * 2)) + 1);
        cx.restore();
      }
      if (this.parts.length) this.raf = requestAnimationFrame(step); else { this.raf = 0; cx.clearRect(0, 0, innerWidth, innerHeight); }
    };
    this.raf = requestAnimationFrame(step);
  },
  float(text, x, y) { const e = document.createElement('div'); e.className = 'xp'; e.textContent = text; e.style.left = (x - 20) + 'px'; e.style.top = (y - 24) + 'px'; document.body.appendChild(e); setTimeout(() => e.remove(), 850); },
  praise(html) { const e = document.createElement('div'); e.className = 'praise'; e.innerHTML = html; document.body.appendChild(e); setTimeout(() => e.remove(), 1050); },
};
function countUp(el, to, fmt = v => v, ms = 900) {
  const t0 = performance.now();
  const f = now => { const k = Math.min(1, (now - t0) / ms); el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}

// =========================================================
// レベル・倍率
// =========================================================
const LV_T = [[1, 'たまご'], [3, 'ルーキー'], [6, '見習い'], [10, '職人'], [15, '戦士'], [20, 'ハンター'], [30, '達人'], [40, 'レジェンド'], [50, '神']];
const lvNeed = n => 100 * n * (n - 1);
function lvOf(xp) { let n = 1; while (lvNeed(n + 1) <= xp) n++; return n; }
function lvTitle(n) { let t = ''; LV_T.forEach(([k, v]) => { if (n >= k) t = v; }); return t; }
function lvHTML(xp, extra = '') {
  const n = lvOf(xp), a = lvNeed(n), b = lvNeed(n + 1);
  return `<div class="lvrow"><div class="lvb"><small>LV</small><b>${n}</b></div><div class="lvi"><div class="t">${lvTitle(n)}</div><div class="bar bee"><i style="width:${(xp - a) / (b - a) * 100}%"></i></div><div class="s">次のレベルまで ${b - xp} XP</div></div>${extra}</div>`;
}
const MULT = c => c >= 30 ? 5 : c >= 20 ? 4 : c >= 10 ? 3 : c >= 5 ? 2 : 1;

// =========================================================
// 画面
// =========================================================
let tab = 'sWords';
document.querySelectorAll('.m').forEach(m => m.innerHTML = $('mascotT').innerHTML);
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  document.body.classList.toggle('playing', id === 'play' || id === 'sDone');
  if (id !== 'play') $('sheet').classList.remove('on');
  if (['sWords', 'sFaces', 'sLog', 'sSet'].includes(id)) { tab = id; document.querySelectorAll('nav label').forEach(b => b.classList.toggle('on', b.dataset.t === id)); }
  if (id === 'sWords') renderHome('w');
  if (id === 'sFaces') renderHome('p');
  if (id === 'sLog') renderLog();
  if (id === 'sSet') renderSettings();
  if (id !== 'play') renderHud();
}
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 1700); }
function todayXp() { const x = S.days[dayStr()]; return x ? (x.xp || 0) : 0; }
function renderHud() {
  const st = streak();
  document.querySelectorAll('[data-streak]').forEach(e => { e.querySelector('b').textContent = st; e.classList.toggle('off', st === 0); });
  document.querySelectorAll('[data-xp] b').forEach(e => e.textContent = todayXp());
  document.querySelectorAll('[data-lv] b').forEach(e => e.textContent = lvOf(S.xp || 0));
  document.querySelectorAll('[data-lvcard]').forEach(e => {
    const type = e.closest('#sFaces') ? 'p' : 'w';
    e.innerHTML = lvHTML(S.xp || 0, `<div class="best">ベスト<b>${(S.best && S.best[type]) || 0}</b></div>`);
  });
}
function say(type, done, goal, fin) {
  const u = type === 'w' ? '語' : '人', rem = goal - done;
  if (fin) return ['今日はクリア！明日も待ってるね', 'えらい！おかわりもできるよ', '完璧！この調子'][done % 3];
  if (done === 0) return type === 'w' ? `今日は${goal}語。いこう！` : `今日は${goal}人。顔と名前、覚えよう！`;
  if (rem <= 20) return `ラストスパート！あと${rem}${u}`;
  if (done / goal >= .5) return `半分こえた！あと${rem}${u}`;
  return `いい調子！あと${rem}${u}`;
}
function renderHome(type) {
  const t = getToday(type), done = doneCount(t), pre = type, fin = t.pos >= t.q.length;
  renderHud();
  $(pre + 'Done').textContent = done;
  $(pre + 'Of').textContent = ` / ${t.goal}`;
  requestAnimationFrame(() => $(pre + 'Bar').style.width = (done / Math.max(1, t.goal) * 100) + '%');
  $(pre + 'Mix').innerHTML = `<span class="pill n">新しい ${t.nw}</span><span class="pill r">復習 ${t.rev}</span>` + (t.extra ? `<span class="pill">追加 ${t.extra}</span>` : '');
  $(pre + 'Say').textContent = say(type, done, t.goal, fin);
  document.querySelector(`#${type === 'w' ? 'sWords' : 'sFaces'} .mascot`).classList.toggle('joy', fin);
  const sb = $(pre + 'Start');
  setTx(sb, fin ? '今日はクリア' : done > 0 ? '続きから' : 'スタート'); sb.classList.toggle('dis', fin);
  $(pre + 'More').style.display = fin ? 'flex' : 'none';
  setTx($(pre + 'More'), `＋${type === 'w' ? S.settings.wordExtra + '語' : S.settings.faceExtra + '人'}`);
  const c = counts(type);
  $(pre + 'Learned').textContent = c.learned; $(pre + 'Due').textContent = c.dueTomorrow; $(pre + 'New').textContent = c.unseen;
  if (type === 'p') renderChips();
  const md = (S.settings.mode && S.settings.mode[type]) || 'quiz';
  document.querySelectorAll(`.seg[data-type="${type}"] label`).forEach(l => l.classList.toggle('on', l.dataset.m === md));
}
function renderChips() {
  const box = $('gChips'); box.innerHTML = '';
  const n = {}; P.forEach(p => [pgroup(p), ...(p.also || [])].forEach(g => { n[g] = (n[g] || 0) + 1; }));
  for (const [g, label] of Object.entries(GROUPS)) {
    const b = document.createElement('label');
    b.className = 'chip' + (S.settings.groups[g] ? ' on' : '');
    b.innerHTML = hswHTML() + `<span class="tx">${label} ${n[g] || 0}</span>`;
    onTap(b, () => {
      wake(); Sound.tap();
      S.settings.groups[g] = !S.settings.groups[g];
      if (!Object.values(S.settings.groups).some(Boolean)) S.settings.groups[g] = true;
      const t = S.today.p; if (t && t.pos === 0) delete S.today.p;
      save(); renderHome('p');
      if (t && t.pos > 0) toast('明日の出題から反映します');
    });
    box.appendChild(b);
  }
}

// =========================================================
// レッスン（4択）
// =========================================================
let G = null, autoT = 0;
function start(type) {
  wake(); clearTimeout(autoT);
  const t = getToday(type);
  if (t.pos >= t.q.length) return;
  G = { type, mode: (S.settings.mode && S.settings.mode[type]) || 'quiz', combo: 0, maxCombo: 0, ok: 0, n: 0, score: 0, answered: false };
  const c = type === 'w' ? ['var(--owl)', 'var(--owl-d)'] : ['var(--bet)', 'var(--bet-d)'];
  $('play').style.setProperty('--c', c[0]); $('play').style.setProperty('--cd', c[1]);
  $('score').querySelector('b').textContent = 0; setMult(false); setCombo(false);
  show('play');
  load();
}
function curKey() { const t = S.today[G.type]; return t.q[t.pos]; }
function pickWordOpts(w) {
  const len = w.jp.length, head = s => s.split(/[、,（(]/)[0];
  const cand = [];
  for (let i = 0; i < 60; i++) { const x = W[Math.random() * W.length | 0]; if (x.en !== w.en && head(x.jp) !== head(w.jp) && !cand.includes(x)) cand.push(x); }
  cand.sort((a, b) => Math.abs(a.jp.length - len) - Math.abs(b.jp.length - len));
  return shuffle(cand.slice(0, 8)).slice(0, 3);
}
function pickFaceOpts(p) {
  const g = pgroup(p);
  let pool = P.filter(x => x.id !== p.id && pgroup(x) === g);
  if (pool.length < 3) pool = P.filter(x => x.id !== p.id);
  return shuffle(pool).slice(0, 3);
}
function load() {
  const t = S.today[G.type];
  if (t.pos >= t.q.length) return finish();
  const raw = curKey(), again = raw[0] === '!', key = raw.replace(/^!/, ''), c = S.cards[key];
  G.answered = false; G.left = null;
  const tag = $('tag');
  if (again) { tag.textContent = 'もう一度'; tag.className = 'tag again'; }
  else if (!c) { tag.textContent = 'NEW'; tag.className = 'tag new'; }
  else { tag.textContent = '復習'; tag.className = 'tag rev'; }
  const opts = $('opts'), prompt = $('prompt');
  opts.className = 'opts'; opts.innerHTML = '';
  const card = G.mode === 'card';
  G.flipped = false;
  prompt.hidden = card; opts.hidden = card; $('bSkip').hidden = card;
  $('flash').hidden = !card; $('fhint').hidden = !card; $('bFlip').hidden = !card; $('bDuo').hidden = true;
  if (card) return loadCard(t, key);
  let list;
  if (G.type === 'w') {
    const w = wByEn[key.slice(2)];
    G.ans = w;
    $('qText').textContent = 'この単語の意味は？';
    prompt.className = 'prompt';
    prompt.innerHTML = `<label class="spk" id="spk">${hswHTML()}${ICON('spk')}</label><div class="word" style="font-size:${w.en.length > 14 ? 26 : 32}px">${esc(w.en)}</div>`;
    onTap($('spk'), () => { wake(); speakWord(); });
    list = shuffle([{ t: w.jp, ok: true }, ...pickWordOpts(w).map(x => ({ t: x.jp }))]);
    if (S.settings.auto) setTimeout(speakWord, 120);
  } else {
    const p = pById[key.slice(2)];
    G.ans = p;
    $('qText').textContent = 'この人はだれ？';
    prompt.className = 'prompt pface';
    prompt.innerHTML = p.stub ? stubHTML(p, 'photo') : `<img class="photo" src="${p.img}" alt="">`;
    opts.classList.add('two');
    list = shuffle([{ t: p.name, ok: true }, ...pickFaceOpts(p).map(x => ({ t: x.name }))]);
    const nk = t.q[t.pos + 1]; if (nk) { const np = pById[nk.replace(/^!/, '').slice(2)]; if (np) new Image().src = np.img; }
  }
  list.forEach((o, i) => {
    const el = document.createElement('label');
    el.className = 'opt'; el.innerHTML = hswHTML() + `<span class="k">${i + 1}</span><span>${esc(o.t)}</span>`;
    el._o = o; onTap(el, () => choose(el));
    opts.appendChild(el);
  });
  $('bSkip').classList.remove('dis');
  const done = doneCount(t);
  $('pbar').style.width = (done / Math.max(1, t.goal) * 100) + '%';
  const L = $('lesson'); L.scrollTop = 0; try { L.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 140 }); } catch {}
  startTimer();
}
function loadCard(t, key) {
  const fc = $('fcard'), fa = $('fa'), fb = $('fb');
  fc.style.opacity = '0'; fc.className = 'fcard'; fb.className = 'face b';
  if (G.type === 'w') {
    const w = wByEn[key.slice(2)]; G.ans = w;
    $('qText').textContent = '意味、覚えてる？';
    fa.innerHTML = `<button class="spk" id="spk">${ICON('spk')}</button><div class="word" style="font-size:${w.en.length > 14 ? 28 : 36}px">${esc(w.en)}</div>`;
    $('spk').onclick = e => { e.preventDefault(); e.stopPropagation(); wake(); speakWord(); };
    fb.innerHTML = `<div class="en">${esc(w.en)}</div><div class="mean">${esc(w.jp)}</div>`;
    if (S.settings.auto) setTimeout(speakWord, 120);
  } else {
    const p = pById[key.slice(2)]; G.ans = p;
    $('qText').textContent = 'この人、だれ？';
    fa.innerHTML = p.stub ? stubHTML(p, 'pbig') : `<img class="pbig" src="${p.img}" alt="">`;
    fb.className = 'face b pf'; fb.innerHTML = profHTML(p);
    const nk = t.q[t.pos + 1]; if (nk) { const np = pById[nk.replace(/^!/, '').slice(2)]; if (np) new Image().src = np.img; }
  }
  $('fhint').textContent = 'カードをタップでめくる';
  requestAnimationFrame(() => { fc.style.opacity = ''; try { fc.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 }); } catch {} });
  $('pbar').style.width = (doneCount(t) / Math.max(1, t.goal) * 100) + '%';
  const L = $('lesson'); L.scrollTop = 0; try { L.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 140 }); } catch {}
  startTimer();
}
function flipCard(auto) {
  if (!G || G.mode !== 'card' || G.flipped || G.answered) return;
  G.flipped = true;
  $('fcard').classList.add('rev'); // 回転は CSS だけで進む（途中で JS を待たない）
  $('fhint').textContent = auto ? '時間切れ！' : '';
  $('bFlip').hidden = true; $('bDuo').hidden = false;
  Sound.flip(); stopTimer();
  // 重い処理（音の準備・読み上げ）はめくり終わってから
  const g = G; setTimeout(() => { wake(); if (G === g && G.type === 'p' && S.settings.name) Sound.say(G.ans.kana || G.ans.name, 'ja'); }, 280);
  if (auto) { G.answered = true; setTimeout(() => { if (G) result(false, 'time'); }, 1300); }
}
function cardGrade(ok) {
  if (!G || G.mode !== 'card' || !G.flipped || G.answered) return;
  wake(); G.answered = true;
  result(ok, null, $(ok ? 'bOk' : 'bNg'));
}
function speakWord() { if (G && G.type === 'w' && G.ans) Sound.say(G.ans.en); }
function setMult(anim) {
  const m = MULT(G.combo), e = $('mult');
  e.textContent = '×' + m; e.className = 'mult m' + m;
  if (anim) pop(e, 500);
}
function setCombo(anim) {
  const e = $('combo'); e.querySelector('span').textContent = G.combo; e.classList.toggle('zero', G.combo === 0);
  if (anim) pop(e, 400);
}
function addScore(pts) {
  if (!pts) return;
  G.score += pts; S.xp = (S.xp || 0) + pts;
  const log = dayLog(); log.xp = (log.xp || 0) + pts;
  const e = $('score'); e.querySelector('b').textContent = G.score.toLocaleString(); pop(e);
}
function choose(el, reason) {
  if (!G || G.answered) return;
  wake();
  G.answered = true; stopTimer();
  const opts = $('opts'); opts.classList.add('locked');
  const ok = !!(el && el._o.ok);
  [...opts.children].forEach(o => { if (o._o.ok) o.classList.add('ok'); else if (o === el) o.classList.add('ng'); else o.classList.add('dim'); });
  $('bSkip').classList.add('dis');
  result(ok, reason, el);
}
const PRAISE = ['すばらしい！', '正解！', 'いいね！', '完璧！', 'その調子！', 'ナイス！'];
function result(ok, reason, el) {
  const t = S.today[G.type], raw = curKey(), again = raw[0] === '!', key = raw.replace(/^!/, '');
  const log = dayLog(), today = dayNum();
  if (!again) {
    const c = S.cards[key] || { b: 0, n: 0, w: 0 };
    const isNew = c.n === 0; c.n++;
    if (ok) c.b = isNew ? 2 : Math.min(c.b + 1, INT.length - 1); else { c.b = 1; c.w++; }
    c.d = today + INT[c.b]; c.l = today; S.cards[key] = c;
    const f = G.type === 'w' ? ['w', 'wc'] : ['p', 'pc'];
    log[f[0]]++; if (ok) log[f[1]]++;
    G.n++; if (ok) G.ok++;
  }
  if (!ok && !again) { t.q = t.q.slice(); t.q.splice(Math.min(t.pos + 8, t.q.length), 0, '!' + key); }
  t.pos++;
  if (doneCount(t) >= t.base) log[G.type === 'w' ? 'goalW' : 'goalP'] = true;
  const m0 = MULT(G.combo);
  G.combo = ok ? G.combo + 1 : 0; G.maxCombo = Math.max(G.maxCombo, G.combo);
  const m = MULT(G.combo);
  const fast = G.left != null && G.left > .5;
  const pts = ok ? ((again ? 5 : 10) + (fast ? 5 : 0)) * m : 0;
  const lvBefore = lvOf(S.xp || 0);
  addScore(pts);
  save();
  setCombo(ok); setMult(m > m0);
  $('pbar').style.width = (doneCount(t) / Math.max(1, t.goal) * 100) + '%';

  if (ok) {
    Sound.ok(G.combo); Haptic.ok(m);
    const r = (el || $('bOk')).getBoundingClientRect();
    if (G.type === 'w' || G.mode === 'card') FX.float('+' + pts, r.right - 40, r.top + 8);
    if (m > m0) setTimeout(() => { Sound.multUp(m); Haptic.up(); FX.praise(`${ICON('fire')}×${m} コンボ！`); FX.burst(innerWidth / 2, innerHeight * .36, 30 + m * 10, 9 + m); }, 160);
  } else { Sound.ng(); Haptic.ng(); }
  if (lvOf(S.xp || 0) > lvBefore) G.pendingLv = lvOf(S.xp || 0);
  if (G.mode === 'card') {
    $('fcard').classList.add(ok ? 'out-ok' : 'out-ng');
    setTimeout(next, 180);
    return;
  }
  if (ok && G.type === 'w') { clearTimeout(autoT); autoT = setTimeout(next, 650); return; }
  showSheet(ok, reason, pts, fast);
}
// 写真がまだない人（スタブ）は、会社・役職・どの回の講師かを手がかりに出す
function stubHTML(p, cls) {
  return `<div class="${cls} stubq"><span class="co">${esc(p.co || '所属 未登録')}</span><b>${esc(p.role)}</b><small>${esc(p.tagline.replace(/ 講師.*$/, ''))}</small></div>`;
}
function profHTML(p) {
  // 並び：名前（よみ）→ 会社 → 役職 → 行く回（1行）
  return `<div class="prof"><img src="${p.img}" alt=""><div style="min-width:0;flex:1"><div class="nm">${esc(p.name)}<span class="kn">${esc(p.kana)}</span></div>` +
    (p.co ? `<span class="co">${esc(p.co)}</span>` : '') + (p.role ? `<div class="rl">${esc(p.role)}</div>` : '') + (p.tagline ? `<div class="go">${esc(p.tagline)}</div>` : '') + `</div></div>` +
    (p.works && p.works.length ? `<ul class="works">${p.works.map(w => `<li>${ICON('star')}${esc(w)}</li>`).join('')}</ul>` : '');
}
function showSheet(ok, reason, pts, fast) {
  const sh = $('sheet'), a = G.ans;
  sh.className = 'sheet ' + (ok ? 'ok' : 'ng');
  $('shIc').innerHTML = `<svg style="color:${ok ? 'var(--owl)' : 'var(--car)'}"><use href="#i-${ok ? 'ok' : 'x'}"/></svg>`;
  $('shT').textContent = ok ? PRAISE[Math.random() * PRAISE.length | 0] : reason === 'time' ? '時間切れ！' : reason === 'skip' ? '正解はこちら' : 'おしい！';
  $('shPts').innerHTML = ok ? `${ICON('bolt')}+${pts}` : '';
  if (G.type === 'w') $('shB').innerHTML = ok ? `<span class="ans">${esc(a.en)}</span>　${esc(a.jp)}` : `<div class="lb">正解：</div><div class="ans">${esc(a.jp)}</div><div>${esc(a.en)}</div>`;
  else $('shB').innerHTML = profHTML(a);
  setTx($('bNext'), ok ? 'つぎへ' : 'わかった');
  requestAnimationFrame(() => sh.classList.add('on'));
  if (!ok || G.type === 'p') Sound.sheet();
  if (G.type === 'p' && S.settings.name) Sound.say(a.kana || a.name, 'ja');
  clearTimeout(autoT);
  if (ok && G.type === 'w') autoT = setTimeout(next, 1100); // 単語の正解はテンポ優先で自動で進む
}
function next() {
  if (!G) return;
  clearTimeout(autoT);
  $('sheet').classList.remove('on');
  if (G.pendingLv) { const n = G.pendingLv; G.pendingLv = 0; return levelUp(n); }
  setTimeout(load, $('sheet').classList.contains('on') ? 0 : 0);
}
function levelUp(n) {
  $('lvN').textContent = n; $('lvT').textContent = lvTitle(n) + ' に昇格';
  $('lvup').classList.add('on'); Sound.levelUp(); Haptic.big(); FX.confetti();
}
$('lvup').onclick = () => { wake(); $('lvup').classList.remove('on'); if (G) load(); };

// 制限時間（答えるまで）
function startTimer() {
  stopTimer();
  const sec = S.settings.timer, el = $('timer'), bar = $('tbar');
  G.left = null; G.tStart = 0;
  if (!sec) { el.classList.add('off'); return; }
  el.classList.remove('off', 'danger');
  bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)';
  G.tLen = sec * 1000; G.tPaused = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!G || G.answered) return;
    G.tStart = performance.now();
    bar.style.transition = `transform ${sec}s linear, background-color .3s`; bar.style.transform = 'scaleX(0)';
    const at = (ms, fn) => G.tids.push(setTimeout(fn, ms));
    G.tids = [];
    at(G.tLen * .8, () => el.classList.add('danger'));
    [3, 2, 1].forEach(s2 => { if (sec > s2) at(G.tLen - s2 * 1000, () => { if (!document.hidden) Sound.tick(s2 === 1); }); });
    at(G.tLen, () => { if (!G || G.answered) return; G.left = 0; G.mode === 'card' ? flipCard(true) : choose(null, 'time'); });
  }));
}
function timeLeft() { return G && G.tStart ? Math.max(0, 1 - (performance.now() - G.tStart) / G.tLen) : null; }
function stopTimer() {
  if (!G) return;
  if (G.tStart) G.left = timeLeft();
  (G.tids || []).forEach(clearTimeout); G.tids = [];
  const bar = $('tbar'), cs = getComputedStyle(bar).transform; bar.style.transition = 'none'; if (cs && cs !== 'none') bar.style.transform = cs;
}

function finish() {
  stopTimer();
  const type = G.type, t = S.today[type];
  const acc = G.n ? Math.round(G.ok / G.n * 100) : 100, xp = G.score;
  S.best = S.best || {}; const rec = xp > (S.best[type] || 0) && xp > 0; if (rec) { S.best[type] = xp; save(); }
  show('sDone');
  const d = $('sDone');
  d.style.setProperty('--c', type === 'w' ? 'var(--owl)' : 'var(--bet)'); d.style.setProperty('--cd', type === 'w' ? 'var(--owl-d)' : 'var(--bet-d)');
  const m = d.querySelector('.mascot'); m.classList.add('joy'); m.classList.remove('jump'); void m.offsetWidth; m.classList.add('jump');
  $('dTitle').textContent = type === 'w' ? `${doneCount(t)}語 クリア！` : `${doneCount(t)}人 クリア！`;
  const c = counts(type);
  $('dSub').textContent = `定着 ${c.learned} ／ 明日の復習 ${c.dueTomorrow}`;
  d.querySelectorAll('.dstat').forEach(e => e.classList.remove('on'));
  $('dXp').textContent = 0; $('dAcc').textContent = '0%'; $('dCombo').textContent = 0;
  $('dRec').classList.remove('on'); if (rec) setTimeout(() => { $('dRec').classList.add('on'); Sound.multUp(4); Haptic.up(); }, 1250);
  const lc = d.querySelector('[data-lvcard-done]'), xpNow = S.xp || 0;
  lc.innerHTML = lvHTML(Math.max(0, xpNow - xp)); setTimeout(() => { lc.innerHTML = lvHTML(xpNow); }, 1100);
  const st = streak(), sp = $('dStreak'); sp.classList.remove('on'); sp.innerHTML = `${ICON('fire')}${st}日連続！`;
  Sound.fanfare(); Haptic.big(); FX.confetti();
  [[$('dXp'), xp, v => v], [$('dAcc'), acc, v => v + '%'], [$('dCombo'), G.maxCombo, v => v]].forEach(([el, v, f], i) =>
    setTimeout(() => { d.querySelectorAll('.dstat')[i].classList.add('on'); Sound.tap(); countUp(el, v, f); }, 500 + i * 260));
  setTimeout(() => { if (st > 0) sp.classList.add('on'); }, 1400);
  setTx($('dMore'), `＋${type === 'w' ? S.settings.wordExtra + '語' : S.settings.faceExtra + '人'}`);
  $('dMore')._type = type;
}
function closePlay() { stopTimer(); const type = G ? G.type : (tab === 'sFaces' ? 'p' : 'w'); clearTimeout(autoT); G = null; try { speechSynthesis.cancel(); } catch {} if (Sync.dirty && Date.now() - Sync.last > SYNC_EVERY) Sync.push(); show(type === 'w' ? 'sWords' : 'sFaces'); }

// =========================================================
// 記録
// =========================================================
let cal = (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })();
function streak() {
  let n = 0, d = dayNum();
  const act = ds => { const x = S.days[ds]; return x && (x.w + x.p) > 0; };
  if (!act(dayStr(d))) d--;
  while (act(dayStr(d))) { n++; d--; }
  return n;
}
function renderLog() {
  const days = Object.entries(S.days).filter(([, x]) => (x.w + x.p) > 0);
  countUp($('lStreak'), streak(), v => v, 600);
  $('lDays').textContent = days.length;
  $('lTotal').textContent = days.reduce((s, [, x]) => s + x.w + x.p, 0);
  $('cTitle').textContent = `${cal.y}年 ${cal.m + 1}月`;
  const g = $('cal'); g.innerHTML = '';
  '日月火水木金土'.split('').forEach(h => { const e = document.createElement('div'); e.className = 'h'; e.textContent = h; g.appendChild(e); });
  const first = new Date(cal.y, cal.m, 1).getDay(), last = new Date(cal.y, cal.m + 1, 0).getDate(), td = dayStr();
  for (let i = 0; i < first; i++) g.appendChild(document.createElement('div'));
  for (let d = 1; d <= last; d++) {
    const ds = `${cal.y}-${String(cal.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const x = S.days[ds], e = document.createElement('div');
    e.className = 'd' + (x && x.w + x.p > 0 ? ' has' : '') + (x && x.goalW ? ' goal' : '') + (ds === td ? ' today' : '');
    if (x && x.goalW) e.innerHTML = ICON('fire'); else e.textContent = d;
    e.onclick = () => {
      g.querySelectorAll('.sel').forEach(s => s.classList.remove('sel')); e.classList.add('sel');
      if (!x || x.w + x.p === 0) { $('cDetail').textContent = `${ds}　記録なし`; return; }
      const r = (a, b) => a ? Math.round(b / a * 100) + '%' : '-';
      $('cDetail').textContent = `${ds}　単語 ${x.w}（正答 ${r(x.w, x.wc)}）　顔 ${x.p}（正答 ${r(x.p, x.pc)}）　${x.xp || 0}XP` + (x.old ? '　※旧版の記録' : '');
    };
    g.appendChild(e);
  }
  levels('w', $('lvW')); levels('p', $('lvP'));
}
function levels(type, el) {
  const keys = type === 'w' ? W.map(w => 'w:' + w.en) : P.map(p => 'p:' + p.id);
  const n = new Array(INT.length + 1).fill(0);
  keys.forEach(k => { const c = S.cards[k]; n[c ? c.b + 1 : 0]++; });
  const col = ['#e5e5e5', '#ff4b4b', '#ff9600', '#ffc800', '#89e219', '#58cc02', '#1cb0f6', '#ce82ff'];
  el.innerHTML = n.map((v, i) => `<i style="width:0;background:${col[i]}"></i>`).join('');
  requestAnimationFrame(() => el.querySelectorAll('i').forEach((e, i) => e.style.width = (n[i] / keys.length * 100) + '%'));
}

// =========================================================
// 設定
// =========================================================
function renderVoices() {
  const sel = $('stVoice'); if (!sel || !S) return;
  const en = Sound.voices.filter(v => /^en/i.test(v.lang));
  sel.innerHTML = '<option value="">自動</option>' + en.map(v => `<option value="${esc(v.voiceURI)}">${esc(v.name)} (${v.lang})</option>`).join('');
  sel.value = S.settings.voice || '';
}
let rerenderT = 0;
function renderSettings() {
  const s = S.settings;
  const bind = (id, key, fmt, after) => {
    const el = $('st' + id), v = $('v' + id);
    el.value = s[key]; v.textContent = fmt(s[key]);
    el.oninput = () => { s[key] = +el.value; v.textContent = fmt(s[key]); save(); after && after(); };
  };
  bind('WordGoal', 'wordGoal', x => x + '語');
  bind('FaceGoal', 'faceGoal', x => x + '人');
  bind('Ratio', 'ratio', x => x + '%');
  bind('Timer', 'timer', x => x ? x + '秒' : 'なし');
  bind('Eff', 'eff', x => x, () => { clearTimeout(rerenderT); rerenderT = setTimeout(() => SFX.render(), 300); });
  bind('Sp', 'sp', x => x);
  bind('Rate', 'rate', x => (x / 100).toFixed(2) + '×');
  const sw = (id, key, after) => { const e = $(id); e.classList.toggle('on', !!s[key]); e.onclick = () => { s[key] = !s[key]; e.classList.toggle('on', s[key]); save(); after && after(); }; };
  sw('swHap', 'hap', applyHap); sw('swAuto', 'auto'); sw('swName', 'name');
  renderVoices();
  $('stVoice').onchange = e => { s.voice = e.target.value; save(); Sound.say('available'); };
  storeInfo(); syncInfo();
}
function syncInfo() {
  const e = $('stSync'); if (!e) return;
  const t = Sync.last ? new Date(Sync.last).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '';
  e.textContent = Sync.state === 'busy' ? '同期中…'
    : Sync.state === 'offline' ? 'オフライン（記録は端末に保存中・つながったら送ります）'
    : Sync.state === 'error' ? '同期できませんでした（15分後にまた試します）'
    : (t ? '最終同期 ' + t : 'まだ同期していません') + (Sync.dirty ? '・未送信あり' : '') + '　15分ごとに自動';
}
async function storeInfo() {
  let persisted = false;
  try { persisted = navigator.storage && await navigator.storage.persisted(); } catch {}
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  $('stStore').innerHTML = `記録はこの端末に二重で保存しています（1問ごと）。永続化：${persisted ? 'ON' : 'OFF'}` +
    (standalone ? '' : '<br>iPhoneは Safari の共有→「ホーム画面に追加」から開くと、記録が自動で消されなくなります。') +
    '<br>振動は iPhone（iOS 18以降）では「設定 → サウンドと触覚 → システムの触覚」がオンのときに出ます。';
}

// =========================================================
// 起動
// =========================================================
async function boot() {
  const local = loadLocal();
  await IDB.open();
  let fromIdb = null;
  try { const v = await IDB.get(); fromIdb = v ? JSON.parse(v) : null; } catch {}
  const pick = (fromIdb && (!local || (fromIdb.updatedAt || 0) > (local.updatedAt || 0))) ? fromIdb : local;
  S = normalize(pick || {});
  if (!S.migrated) migrateV1(S);
  if (!S.v3) {
    if (S.settings.wordGoal === 200) S.settings.wordGoal = 100;
    const t = S.today && S.today.date === dayStr() && S.today.w;
    if (t && t.base > 100) {
      const done = t.q.slice(0, t.pos), rest = t.q.slice(t.pos);
      let need = Math.max(0, 100 - done.filter(k => k[0] !== '!').length); const out = [];
      for (const k of rest) { if (k[0] === '!') out.push(k); else if (need > 0) { out.push(k); need--; } }
      t.q = done.concat(out); t.base = 100; t.goal = 100; t.extra = 0;
      t.nw = Math.min(t.nw, 100); t.rev = Math.min(t.rev, 100 - t.nw);
    }
    S.xp = Object.values(S.days).reduce((a, x) => a + (x.wc + x.pc) * 10, 0);
    Object.values(S.days).forEach(x => { if (x.xp == null) x.xp = (x.wc + x.pc) * 10; });
    S.best = S.best || {}; S.v3 = true;
  }
  if (!S.v6) { // カレンダーで行く回の登壇者を、今日の顔の出題に優先して入れる（1日の人数は変えない）
    S.settings.groups.tc = true;
    const t = S.today && S.today.date === dayStr() && S.today.p;
    if (t) {
      const isTc = k => { const p = pById[k.replace(/^!/, '').slice(2)]; return p && p.g === 'tc'; };
      const done = t.q.slice(0, t.pos), rest = t.q.slice(t.pos);
      const slots = rest.filter(k => k[0] !== '!' && !S.cards[k] && !isTc(k)).length;
      const add = deckKeys('p').filter(k => isTc(k) && !S.cards[k] && !t.q.includes(k)).slice(0, slots);
      let drop = add.length; const kept = [];
      for (let i = rest.length - 1; i >= 0; i--) { const k = rest[i]; if (drop > 0 && k[0] !== '!' && !S.cards[k] && !isTc(k)) { drop--; continue; } kept.unshift(k); }
      t.q = done.concat(add, kept); t.nw = Math.min(t.base, t.nw);
    }
    S.v4 = S.v5 = S.v6 = true;
  }
  save();
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}
  applyHap();
  show(tab);
  Sync.pull().then(ok => { if (ok && !G) show(tab); Sync.push(); });
  setTimeout(() => SFX.render(), 700); // 最初の表示を優先
}

FX.setup();
document.querySelectorAll('nav label').forEach(b => onTap(b, () => { wake(); if (b.dataset.t !== tab) Sound.tap(); show(b.dataset.t); }));
onTap($('wStart'), () => start('w'));
onTap($('pStart'), () => start('p'));
onTap($('wMore'), () => { addExtra('w'); start('w'); });
onTap($('pMore'), () => { addExtra('p'); start('p'); });
onTap($('dMore'), () => { const type = $('dMore')._type || 'w'; addExtra(type); start(type); });
onTap($('dHome'), () => closePlay());
onTap($('bNext'), () => { wake(); next(); });
onTap($('bSkip'), () => choose(null, 'skip'));
// 指が触れた瞬間にめくる（離すのを待たない）。触覚はあとの click で従来どおり鳴る
$('fcard').addEventListener('pointerdown', e => { if (e.button === 0 && !e.target.closest('.spk')) flipCard(); });
onTap($('fcard'), () => { wake(); flipCard(); });
onTap($('bFlip'), () => flipCard());
onTap($('bOk'), () => cardGrade(true));
onTap($('bNg'), () => cardGrade(false));
document.querySelectorAll('.seg label').forEach(l => onTap(l, () => {
  wake(); Sound.tap();
  const type = l.closest('.seg').dataset.type;
  S.settings.mode = Object.assign({ w: 'quiz', p: 'quiz' }, S.settings.mode, { [type]: l.dataset.m }); save(); renderHome(type);
}));
$('xClose').onclick = () => closePlay();
$('cPrev').onclick = () => { cal.m--; if (cal.m < 0) { cal.m = 11; cal.y--; } renderLog(); };
$('cNext').onclick = () => { cal.m++; if (cal.m > 11) { cal.m = 0; cal.y++; } renderLog(); };
onTap($('tSync'), async () => { Sound.tap(); if (await Sync.push()) { toast('同期しました'); if (!G) show(tab); } else toast(Sync.state === 'offline' ? 'オフラインです。つながったら自動で送ります' : '同期できませんでした'); });
onTap($('tEff'), () => { wake(); Sound.ok(0); Haptic.ok(2); setTimeout(() => Sound.ok(8), 500); setTimeout(() => Sound.ng(), 1100); });
onTap($('tSp'), () => Sound.say('Thank you for your patience.'));
document.addEventListener('keydown', e => {
  if (!G || !$('play').classList.contains('on')) return;
  if (G.mode === 'card') {
    if (e.key === ' ' || e.key === 'ArrowUp') { e.preventDefault(); flipCard(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { G.flipped ? cardGrade(true) : flipCard(); }
    else if (e.key === 'ArrowLeft') cardGrade(false);
    // 」キーで✕（JISの」はe.code=Backslash）。めくる前なら、めくって✕まで一気に
    else if (e.key === ']' || e.key === '」' || e.code === 'Backslash') { e.preventDefault(); if (!G.flipped) flipCard(); cardGrade(false); }
    return;
  }
  if (!G.answered && /^[1-4]$/.test(e.key)) { const el = $('opts').children[+e.key - 1]; if (el) choose(el); }
  else if (e.key === 'Enter') { if (G.answered) next(); }
});
setInterval(() => { if (S && S.today && S.today.date !== dayStr() && !G) show(tab); }, 60000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
boot().then(() => { if ('speechSynthesis' in window) { Sound.loadVoices(); speechSynthesis.onvoiceschanged = () => Sound.loadVoices(); } });
if (/debug/.test(location.search)) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99;background:#000;color:#0f0;font:11px monospace;padding:4px;pointer-events:none;white-space:pre-wrap';
  document.body.appendChild(d); setInterval(() => { const pools = Object.values(SFX.pool); d.textContent = `iOS:${isIOS} rendered:${Object.keys(SFX.buf).length} pools:${pools.length} unlocked:${pools.filter(a => a._u).length}/${pools.length} last:${SFX.last || '-'} ctx:${SFX.ctx ? SFX.ctx.state : '-'}`; }, 300); }
window.__app = { get S() { return S; }, get G() { return G; }, SFX, start, flipCard, cardGrade, finish: () => finish(), choose, next, doneCount, dayStr, show, levelUp };
</script>
</body>
</html>

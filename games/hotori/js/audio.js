/* ター宿のほとり — 音（すべてWebAudioで合成。音声ファイルなし） */
(function (G) {
'use strict';
const TJ = G.TJ;
let ctx = null, master = null, musicBus = null, sfxBus = null;
let muted = false, track = null, timer = null, step = 0, nextT = 0;
try { muted = localStorage.getItem('tjgod-mute') === '1'; } catch (e) { /* noop */ }

function init() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(comp);
    return true;
  } catch (e) { ctx = null; return false; }
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function env(g, t, a, peak, d, sus, r, len) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d);
  g.gain.setValueAtTime(Math.max(0.0001, peak * sus), t + len);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len + r);
}
function tone(bus, t, note, len, o) {
  o = o || {};
  const osc = ctx.createOscillator(); osc.type = o.type || 'triangle';
  osc.frequency.setValueAtTime(mtof(note), t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(mtof(note + o.slide), t + len);
  if (o.detune) osc.detune.value = o.detune;
  const g = ctx.createGain();
  let out = osc;
  if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp, t); if (o.lpEnv) f.frequency.exponentialRampToValueAtTime(o.lpEnv, t + len); f.Q.value = o.q || 1; osc.connect(f); out = f; }
  out.connect(g); g.connect(bus);
  env(g, t, o.a || 0.005, o.v || 0.2, o.d || 0.08, o.s == null ? 0.5 : o.s, o.r || 0.08, len);
  osc.start(t); osc.stop(t + len + (o.r || 0.08) + 0.05);
}
let noiseBuf = null;
function noise(bus, t, len, o) {
  o = o || {};
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = o.ft || 'highpass'; f.frequency.value = o.f || 7000; f.Q.value = o.q || 0.7;
  const g = ctx.createGain(); s.connect(f); f.connect(g); g.connect(bus);
  g.gain.setValueAtTime(o.v || 0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.start(t); s.stop(t + len + 0.02);
}
function kick(t, v) {
  const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(musicBus);
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(v || 0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
  o.start(t); o.stop(t + 0.3);
}
function snare(t, v) { noise(musicBus, t, 0.16, { f: 1800, ft: 'bandpass', v: v || 0.35, q: 0.6 }); tone(musicBus, t, 50, 0.05, { type: 'triangle', v: 0.15, s: 0.1 }); }
function hat(t, v, open) { noise(musicBus, t, open ? 0.18 : 0.04, { f: 8000, v: v || 0.08 }); }
function clap(t) { [0, 0.012, 0.024].forEach(d => noise(musicBus, t + d, 0.09, { f: 1500, ft: 'bandpass', v: 0.18, q: 1.2 })); }

// ===== 曲 =====
// 1小節=16ステップ。コードは4小節ループ
const TRACKS = {
  menu: { bpm: 92, swing: 0.18, bars: 4,
    chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [55, 59, 62, 65]],
    bass: [[0, 41], [6, 41], [8, 48], [11, 46], [14, 43]],
    bassRoots: [41, 40, 38, 43],
    drums: { k: [0, 7, 10], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14] },
    keys: [0, 6], lead: null },
  game: { bpm: 112, swing: 0.12, bars: 4,
    chords: [[57, 60, 64, 67], [57, 60, 64, 67], [55, 59, 62, 65], [53, 57, 60, 64]],
    bass: [[0, 0], [3, 0], [6, 12], [7, 0], [10, 10], [12, 0], [14, 7]],
    bassRoots: [45, 45, 43, 41],
    drums: { k: [0, 6, 10], s: [4, 12], h: [0, 2, 3, 4, 6, 8, 10, 11, 12, 14], c: [12] },
    keys: [2, 5, 9, 13],
    lead: [[0, 76], [2, 79], [3, 81], [6, 79], [8, 76], [10, 74], [11, 76]] },
  tense: { bpm: 124, swing: 0.05, bars: 4,
    chords: [[57, 60, 63, 67], [57, 60, 63, 67], [56, 59, 62, 65], [56, 59, 62, 65]],
    bass: [[0, 0], [2, 0], [4, 0], [6, 12], [8, 0], [10, 0], [12, 1], [14, 0]],
    bassRoots: [45, 45, 44, 44],
    drums: { k: [0, 4, 8, 12], s: [4, 12], h: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    keys: [0, 3, 6, 10], lead: null }
};

function schedule() {
  if (!ctx || !track) return;
  const T = TRACKS[track];
  const sp = 60 / T.bpm / 4;
  while (nextT < ctx.currentTime + 0.15) {
    const s = step % 16, bar = Math.floor(step / 16) % T.bars;
    const t = nextT + (s % 2 ? T.swing * sp : 0);
    if (T.drums.k.includes(s)) kick(t, 0.75);
    if (T.drums.s.includes(s)) snare(t, 0.26);
    if (T.drums.h.includes(s)) hat(t, s % 4 === 2 ? 0.07 : 0.045, s === 14 && track === 'game');
    if (T.drums.c && T.drums.c.includes(s) && bar % 2) clap(t);
    const root = T.bassRoots[bar];
    T.bass.forEach(([st, off]) => { if (st === s) tone(musicBus, t, (T === TRACKS.menu ? off : root + off) - (T === TRACKS.menu ? 0 : 0), sp * 1.6, { type: 'sawtooth', v: 0.16, lp: 900, lpEnv: 250, s: 0.3, d: 0.06 }); });
    if (T.keys.includes(s)) T.chords[bar].forEach((n, i) => tone(musicBus, t + i * 0.006, n, sp * (track === 'menu' ? 3 : 0.7), { type: 'triangle', v: 0.05, lp: 2400, s: 0.4, d: 0.12 }));
    if (T.lead && bar === 3) T.lead.forEach(([st, n]) => { if (st === s) tone(musicBus, t, n, sp * 1.2, { type: 'square', v: 0.035, lp: 3000, s: 0.5 }); });
    nextT += sp; step++;
  }
}

const SFX = {
  click: t => tone(sfxBus, t, 84, 0.03, { type: 'square', v: 0.08, s: 0.1 }),
  pick: t => { tone(sfxBus, t, 72, 0.06, { type: 'triangle', v: 0.25 }); tone(sfxBus, t + 0.05, 79, 0.1, { type: 'triangle', v: 0.22 }); },
  cut: t => { noise(sfxBus, t, 0.25, { f: 2500, ft: 'bandpass', v: 0.3, q: 0.8 }); tone(sfxBus, t, 60, 0.15, { type: 'sawtooth', v: 0.08, slide: -12, lp: 1500 }); },
  up: t => [72, 76, 79, 84].forEach((n, i) => tone(sfxBus, t + i * 0.06, n, 0.08, { type: 'square', v: 0.08, lp: 4000 })),
  down: t => [79, 75, 72, 67].forEach((n, i) => tone(sfxBus, t + i * 0.07, n, 0.09, { type: 'square', v: 0.08, lp: 2500 })),
  banner: t => { tone(sfxBus, t, 81, 0.12, { type: 'square', v: 0.1 }); tone(sfxBus, t + 0.09, 88, 0.25, { type: 'square', v: 0.1 }); noise(sfxBus, t, 0.3, { f: 6000, v: 0.08 }); },
  reveal: t => { noise(sfxBus, t, 0.35, { f: 1200, ft: 'bandpass', v: 0.2, q: 0.4 }); tone(sfxBus, t + 0.05, 67, 0.2, { type: 'triangle', v: 0.12, slide: 5 }); },
  submit: t => { tone(sfxBus, t, 67, 0.05, { type: 'triangle', v: 0.2 }); tone(sfxBus, t + 0.06, 74, 0.12, { type: 'triangle', v: 0.2 }); },
  round: t => [67, 71, 74, 79, 83].forEach((n, i) => tone(sfxBus, t + i * 0.09, n, 0.2, { type: 'triangle', v: 0.16 })),
  rank: t => { tone(sfxBus, t, 60, 0.4, { type: 'sawtooth', v: 0.08, lp: 1200 }); kick(t, 0.6); },
  god: t => { [[72, 76, 79], [74, 77, 81], [76, 79, 84]].forEach((c, i) => c.forEach(n => tone(sfxBus, t + i * 0.22, n, i === 2 ? 1.2 : 0.18, { type: 'sawtooth', v: 0.06, lp: 3500 }))); noise(sfxBus, t + 0.44, 1.2, { f: 5000, v: 0.12 }); kick(t + 0.44, 0.9); },
  tick: t => tone(sfxBus, t, 96, 0.02, { type: 'square', v: 0.05, s: 0.1 }),
  error: t => tone(sfxBus, t, 50, 0.15, { type: 'square', v: 0.1, lp: 800 }),
  alert: t => { [0, 0.16].forEach(d => { tone(sfxBus, t + d, 76, 0.1, { type: 'square', v: 0.12, lp: 2500 }); tone(sfxBus, t + d + 0.05, 70, 0.1, { type: 'square', v: 0.12, lp: 2500 }); }); }
};

TJ.audio = {
  unlock() { if (!init()) return; if (ctx.state === 'suspended') ctx.resume().catch(() => {}); },
  play(name) { if (!ctx || muted) return; const f = SFX[name]; if (f) try { f(ctx.currentTime + 0.01); } catch (e) { /* noop */ } },
  music(name) {
    if (!init()) return;
    if (track === name) return;
    track = name; step = 0; nextT = ctx.currentTime + 0.1;
    if (!timer) timer = setInterval(schedule, 30);
    if (!name) { clearInterval(timer); timer = null; }
  },
  get muted() { return muted; },
  toggle() {
    muted = !muted;
    try { localStorage.setItem('tjgod-mute', muted ? '1' : '0'); } catch (e) { /* noop */ }
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
    return muted;
  }
};
})(window);

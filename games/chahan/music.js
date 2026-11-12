/* プロトコルチャーハン BGM: 素材を使わず、ブラウザ内で合成する(ブレードランナー風のシンセ)
   常時鳴り続けるノイズ音源は使わない。打楽器のノイズは叩いた瞬間だけ鳴る。
   曲の切り替えは、曲ごとの出力バスをクロスフェードする。 */
(function (root) {
'use strict';
let ctx = null, master = null, rev = null, dly = null, nbuf = null, B = null;
let cur = null, timer = null, step = 0, nextT = 0, vol = 0.6, enabled = true, started = false;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function init(ac) {
  if (ctx || !ac) return;
  ctx = ac;
  master = ctx.createGain(); master.gain.value = 0.0001;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
  master.connect(comp); comp.connect(ctx.destination);
  // リバーブ(生成したインパルス。減衰を速くして、ざらつきが残らないようにする)
  rev = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 3.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { lp = lp * 0.82 + (Math.random() * 2 - 1) * 0.18; d[i] = lp * 2.2 * Math.pow(1 - i / len, 4); } }
  rev.buffer = ir; const rg = ctx.createGain(); rg.gain.value = 0.42; rev.connect(rg); rg.connect(master);
  // ディレイ(高域を削ったフィードバック)
  dly = ctx.createDelay(1.5); dly.delayTime.value = 0.42; const fb = ctx.createGain(); fb.gain.value = 0.36; const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 2400; const dg = ctx.createGain(); dg.gain.value = 0.45;
  dly.connect(df); df.connect(fb); fb.connect(dly); df.connect(dg); dg.connect(rev); dg.connect(master);
  // 打楽器用の短いノイズ(叩いた瞬間だけ使う)
  nbuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
  const nd = nbuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
}

/* 曲ごとの出力バス(乾いた音・リバーブ送り・ディレイ送り) */
function mkBus(fade) {
  const now = ctx.currentTime, b = { g: ctx.createGain(), w: ctx.createGain(), d: ctx.createGain() };
  b.g.connect(master); b.w.connect(rev); b.d.connect(dly);
  [b.g, b.w, b.d].forEach(x => { x.gain.setValueAtTime(0.0001, now); x.gain.linearRampToValueAtTime(1, now + fade); });
  return b;
}
function dropBus(b, fade) {
  if (!b) return;
  const now = ctx.currentTime;
  [b.g, b.w, b.d].forEach(x => { x.gain.cancelScheduledValues(now); x.gain.setValueAtTime(Math.max(0.0001, x.gain.value), now); x.gain.setTargetAtTime(0.0001, now, fade / 4); });
  setTimeout(() => { try { b.g.disconnect(); b.w.disconnect(); b.d.disconnect(); } catch (e) {} }, fade * 1000 + 600);
}
const out = (g, wet, echo) => { g.connect(B.g); if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(B.w); } if (echo) { const e = ctx.createGain(); e.gain.value = echo; g.connect(e); e.connect(B.d); } };
const osc = (type, f, t, end) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); o.stop(end); return o; };

/* ---------- 楽器 ---------- */
// 厚いシンセパッド(CS-80風)
function pad(notes, t, dur, o) {
  o = o || {};
  const g = ctx.createGain(), f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.Q.value = o.q || 4;
  f.frequency.setValueAtTime((o.f0 || 300) * 0.8, t); f.frequency.linearRampToValueAtTime((o.f1 || 1600) * 0.6, t + dur * 0.45); f.frequency.linearRampToValueAtTime(o.f0 || 300, t + dur);
  const v = (o.v || 0.06) / Math.sqrt(notes.length), a = o.att || Math.min(1.6, dur * 0.3);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v, t + Math.max(a, dur * 0.7)); g.gain.linearRampToValueAtTime(0.0001, t + dur + (o.rel || 1.2));
  f.connect(g); out(g, o.wet == null ? 0.35 : o.wet);
  notes.forEach(n => [-7, 0, 7].forEach(dt => { const os = osc(o.wave || (dt === 0 ? 'sawtooth' : 'triangle'), mtof(n), t, t + dur + (o.rel || 1.2) + 0.1); os.detune.value = dt + (Math.random() * 4 - 2); os.connect(f); }));
}
// 合唱のような柔らかいパッド
const choir = (notes, t, dur, v) => pad(notes, t, dur, { v: v || 0.04, f0: 700, f1: 1900, q: 1, wave: 'triangle', wet: 0.5, att: dur * 0.4, rel: 2 });
function bass(n, t, dur, v, cut) {
  const f = ctx.createBiquadFilter(), g = ctx.createGain(), end = t + dur + 0.05;
  const a = osc('sawtooth', mtof(n), t, end), b = osc('square', mtof(n - 12), t, end);
  f.type = 'lowpass'; f.frequency.setValueAtTime(cut || 500, t); f.frequency.exponentialRampToValueAtTime(120, t + dur); f.Q.value = 6;
  g.gain.setValueAtTime(v || 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  a.connect(f); b.connect(f); f.connect(g); out(g, 0.1);
}
// 丸いサブベース(サイン波)
function sub(n, t, dur, v) {
  const g = ctx.createGain(), o = osc('sine', mtof(n), t, t + dur + 0.1);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v || 0.1, t + 0.02); g.gain.setValueAtTime(v || 0.1, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); out(g, 0);
}
function arp(n, t, v, wave, cut) {
  const f = ctx.createBiquadFilter(), g = ctx.createGain(), o = osc(wave || 'square', mtof(n), t, t + 0.35);
  f.type = 'lowpass'; f.frequency.setValueAtTime(cut || 3000, t); f.frequency.exponentialRampToValueAtTime(400, t + 0.25);
  g.gain.setValueAtTime(v || 0.035, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.32);
  o.connect(f); f.connect(g); out(g, 0.3, 1);
}
function bell(n, t, v, dec) {
  const d = dec || 4, c = osc('sine', mtof(n), t, t + d + 0.1), m = osc('sine', mtof(n) * 3.5, t, t + d + 0.1), mg = ctx.createGain(), g = ctx.createGain();
  mg.gain.setValueAtTime(mtof(n) * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + d * 0.6);
  m.connect(mg); mg.connect(c.frequency);
  g.gain.setValueAtTime(v || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0005, t + d);
  c.connect(g); out(g, 0.6, 1);
}
// オルゴール
function box(n, t, v) {
  const g = ctx.createGain(), a = osc('sine', mtof(n), t, t + 1.8), b = osc('sine', mtof(n) * 4, t, t + 0.5), bg = ctx.createGain();
  bg.gain.setValueAtTime(0.25, t); bg.gain.exponentialRampToValueAtTime(0.001, t + 0.4); b.connect(bg); bg.connect(g);
  g.gain.setValueAtTime(v || 0.04, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.7); a.connect(g); out(g, 0.45, 0.6);
}
// 主旋律(ゆっくり立ち上がり、遅れてビブラートがかかるシンセリード)
function lead(n, t, dur, o) {
  o = o || {};
  const rel = o.rel == null ? 0.4 : o.rel, end = t + dur + rel + 0.1, f = ctx.createBiquadFilter(), g = ctx.createGain();
  const lfo = osc('sine', o.vibHz || 5.2, t, end), lg = ctx.createGain(), fr = mtof(n);
  lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(0, t + Math.min(dur * 0.4, 0.3)); lg.gain.linearRampToValueAtTime(fr * (o.vib == null ? 0.01 : o.vib), t + Math.min(dur, 0.9)); lfo.connect(lg);
  f.type = 'lowpass'; f.Q.value = o.q || 1.5; f.frequency.setValueAtTime((o.cut || 1600) * 0.6, t); f.frequency.linearRampToValueAtTime(o.cut || 1600, t + Math.min(dur, 0.4));
  const v = o.v || 0.03, a = o.att == null ? 0.08 : o.att;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v, t + Math.max(a, dur - 0.04)); g.gain.exponentialRampToValueAtTime(0.0005, t + dur + rel);
  (o.waves || ['sawtooth', 'triangle']).forEach((w, k) => {
    const os = osc(w, fr, t, end); os.detune.value = (o.det || 0) + (k ? 7 : -5);
    if (o.from != null) { os.frequency.setValueAtTime(mtof(o.from), t); os.frequency.exponentialRampToValueAtTime(fr, t + (o.glide || 0.12)); }
    lg.connect(os.frequency); os.connect(f);
  });
  f.connect(g); out(g, o.wet == null ? 0.4 : o.wet, o.echo);
}
// エレピ(ローズ風のFM)
function ep(notes, t, dur, o) {
  o = o || {};
  const v = (o.v || 0.05) / Math.sqrt(notes.length), g = ctx.createGain(), f = ctx.createBiquadFilter(), end = t + dur + 0.8;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.008); g.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0005, t + dur + 0.6);
  f.type = 'lowpass'; f.frequency.value = o.cut || 2200; f.connect(g); out(g, o.wet == null ? 0.25 : o.wet, o.echo);
  notes.forEach(n => {
    const fr = mtof(n), c = osc('sine', fr, t, end), m = osc('sine', fr, t, end), mg = ctx.createGain(), dt = (o.det || 0) + (Math.random() * 2 - 1) * (o.wob || 3);
    c.detune.value = dt; m.detune.value = dt;
    mg.gain.setValueAtTime(fr * 1.5, t); mg.gain.exponentialRampToValueAtTime(fr * 0.12, t + 0.4); m.connect(mg); mg.connect(c.frequency); c.connect(f);
  });
}
// 琴のような撥弦
function pluck(n, t, v, o) {
  o = o || {};
  const dec = o.dec || 1.2, fr = mtof(n), f = ctx.createBiquadFilter(), g = ctx.createGain(), g2 = ctx.createGain();
  const a = osc('triangle', fr, t, t + dec + 0.05), b = osc('sine', fr * 2, t, t + dec + 0.05);
  a.frequency.setValueAtTime(fr * 1.012, t); a.frequency.exponentialRampToValueAtTime(fr, t + 0.06);
  f.type = 'lowpass'; f.frequency.setValueAtTime(o.cut || 3000, t); f.frequency.exponentialRampToValueAtTime(450, t + dec);
  g2.gain.value = 0.3; b.connect(g2); g2.connect(f); a.connect(f); f.connect(g);
  g.gain.setValueAtTime(v || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dec); out(g, o.wet == null ? 0.35 : o.wet, o.echo);
}
// 金属を叩く音(工場)
function clank(n, t, v) {
  const fr = mtof(n), c = osc('sine', fr, t, t + 0.6), m = osc('sine', fr * 2.76, t, t + 0.6), mg = ctx.createGain(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  mg.gain.setValueAtTime(fr * 3, t); mg.gain.exponentialRampToValueAtTime(fr * 0.2, t + 0.3); m.connect(mg); mg.connect(c.frequency);
  f.type = 'lowpass'; f.frequency.value = 2600; c.connect(f); f.connect(g);
  g.gain.setValueAtTime(v || 0.04, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.5); out(g, 0.45, 0.5);
}
function kick(t, v) { const o = osc('sine', 140, t, t + 0.32), g = ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); g.gain.setValueAtTime(v || 0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); out(g, 0.05); }
function tom(t, n, v) { const o = osc('sine', mtof(n + 7), t, t + 0.4), g = ctx.createGain(); o.frequency.exponentialRampToValueAtTime(mtof(n), t + 0.15); g.gain.setValueAtTime(v || 0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g); out(g, 0.25); }
function wood(t, n, v) { const o = osc('sine', mtof(n), t, t + 0.12), g = ctx.createGain(); o.frequency.exponentialRampToValueAtTime(mtof(n) * 0.8, t + 0.05); g.gain.setValueAtTime(v || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.08); o.connect(g); out(g, 0.35); }
function hat(t, v, open) {
  const s = ctx.createBufferSource(); s.buffer = nbuf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 7000; f.Q.value = 0.9; const g = ctx.createGain();
  g.gain.setValueAtTime(v || 0.04, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.22 : 0.045)); s.connect(f); f.connect(g); out(g, 0.08); s.start(t); s.stop(t + 0.3);
}
function snare(t, v, fq) {
  const s = ctx.createBufferSource(); s.buffer = nbuf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fq || 1800; f.Q.value = 0.8; const g = ctx.createGain();
  g.gain.setValueAtTime(v || 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); s.connect(f); f.connect(g); out(g, 0.45); s.start(t); s.stop(t + 0.25);
  const b = osc('triangle', 190, t, t + 0.12), bg = ctx.createGain(); bg.gain.setValueAtTime((v || 0.12) * 0.5, t); bg.gain.exponentialRampToValueAtTime(0.001, t + 0.1); b.connect(bg); out(bg, 0.2);
}

/* 旋律の表: [何ステップ目, 音, 長さ] */
const at = (tbl, p) => tbl.find(x => x[0] === p);
const play1 = (tbl, p, t, sp, o) => { const m = at(tbl, p); if (m) lead(m[1], t, m[2] * sp, o); };

/* ---------- 曲(16分音符単位のステップで鳴らす) ---------- */
const TR = {
  // タイトル: 雨のネオヨコハマを見下ろす
  title: { bpm: 60, chords: [[53, 56, 60, 63, 67], [49, 53, 56, 60, 63], [46, 49, 53, 56, 60], [48, 52, 55, 58, 65]],
    mA: [[0, 72, 8], [8, 75, 4], [12, 72, 4], [16, 73, 12], [28, 72, 4], [32, 70, 8], [40, 68, 8], [48, 67, 14]],
    mB: [[0, 72, 4], [4, 75, 4], [8, 79, 8], [16, 77, 8], [24, 75, 8], [32, 73, 6], [38, 72, 2], [40, 70, 8], [48, 72, 16]],
    step(i, t, sp) { const bar = i >> 4, c = this.chords[bar % 4], s = bar % 16, p = i % 64;
      if (i % 16 === 0) { pad(c, t, sp * 16, { v: 0.065, f0: 250, f1: 1300 }); bass(c[0] - 12, t, sp * 14, 0.08, 300); }
      if (s >= 4 && (i % 16 === 6 || i % 32 === 22)) bell(c[(i >> 2) % c.length] + 24, t, 0.03);
      if (s >= 8) play1(s < 12 ? this.mA : this.mB, p, t, sp, { v: 0.026, cut: 1500, att: 0.3, rel: 1.4, echo: 0.4 });
      if (s >= 12 && i % 4 === 2) arp(c[(i >> 2) % c.length] + 12, t, 0.012, 'triangle', 1800); } },
  // ネオヨコハマ(都市マップと埠頭など)
  city: { bpm: 84, chords: [[50, 53, 57, 60], [46, 50, 53, 57], [43, 46, 50, 53], [45, 49, 52, 55]],
    mA: [[0, 69, 6], [6, 72, 2], [8, 74, 8], [16, 74, 4], [20, 72, 4], [24, 70, 8], [32, 67, 6], [38, 69, 2], [40, 70, 8], [48, 69, 12], [60, 73, 4]],
    mB: [[0, 77, 8], [8, 76, 4], [12, 74, 4], [16, 74, 6], [22, 72, 2], [24, 70, 8], [32, 70, 4], [36, 69, 4], [40, 67, 8], [48, 69, 16]],
    step(i, t, sp) { const bar = i >> 4, c = this.chords[bar % 4], s = bar % 32, p = i % 64;
      if (i % 16 === 0) pad(c, t, sp * 16, { v: 0.05, f0: 280, f1: s >= 24 && s < 28 ? 1800 : 1200 });
      if (s >= 2 && !(s >= 24 && s < 28) && i % 4 === 0) bass(c[0] - 12, t, sp * 3.5, 0.07, 380);
      if (s >= 4 && !(s >= 24 && s < 28) && i % 2 === 0) arp(c[[0, 2, 1, 3, 2, 1, 3, 0][(i / 2) % 8]] + 12, t, 0.02, 'triangle');
      if (s >= 8 && s < 24) { if (i % 8 === 0) kick(t, 0.14); if (i % 8 === 4) snare(t, 0.035, 1400); if (i % 4 === 2) hat(t, 0.01); }
      if (s >= 16 && s < 24) play1(s < 20 ? this.mA : this.mB, p, t, sp, { v: 0.024, cut: 1700, att: 0.12, echo: 0.35 });
      if (i % 64 === 40 || (s >= 24 && s < 28 && i % 16 === 8)) bell(c[2] + 24, t, 0.028); } },
  // 旧中華街跡: 五音音階、二胡のようなリード
  chinatown: { bpm: 78, chords: [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55]],
    mA: [[0, 76, 4], [4, 74, 2], [6, 72, 2], [8, 69, 8], [16, 72, 4], [20, 74, 4], [24, 76, 6], [30, 79, 2], [32, 81, 8], [40, 79, 4], [44, 76, 4], [48, 74, 8], [56, 72, 4], [60, 76, 4]],
    mB: [[0, 81, 6], [6, 79, 2], [8, 76, 8], [16, 74, 4], [20, 76, 4], [24, 72, 8], [32, 74, 6], [38, 72, 2], [40, 69, 8], [48, 67, 4], [52, 69, 12]],
    pat: [0, 2, 3, 2, 4, 3, 2, 1],
    step(i, t, sp) { const bar = i >> 4, c = this.chords[bar % 4], s = bar % 16, p = i % 64, pent = [57, 60, 62, 64, 67, 69, 72, 74];
      if (i % 16 === 0) { pad(c, t, sp * 16, { v: 0.04, f0: 260, f1: 1100 }); sub(c[0] - 12, t, sp * 12, 0.07); }
      if (i % 64 === 0) bell(c[0] - 12, t, 0.05, 5);
      if (s >= 2 && i % 2 === 0) { const k = this.pat[(i >> 1) % 8]; if ((i >> 1) % 8 !== 7) pluck(pent[(k + (bar % 4)) % 8], t, 0.035, { dec: 0.9 }); }
      if (s >= 4) { if (i % 8 === 0) wood(t, 79, 0.03); if (i % 16 === 12) wood(t, 84, 0.022); if (i % 8 === 4) kick(t, 0.1); }
      if (s >= 8) { const m = at(s < 12 ? this.mA : this.mB, p); if (m) lead(m[1], t, m[2] * sp, { v: 0.025, cut: 1500, waves: ['sawtooth'], vib: 0.018, vibHz: 6, from: m[1] - 2, glide: 0.09, att: 0.05, echo: 0.3 }); } } },
  // ノゲ横丁: 酒場のジャズ
  noge: { bpm: 72, chords: [[53, 57, 60, 64], [53, 59, 64, 67], [52, 55, 59, 62], [55, 58, 61, 64]], roots: [38, 43, 36, 45], walk: [0, 7, 10, 12],
    mA: [[0, 69, 4], [4, 72, 2], [6, 74, 6], [16, 71, 4], [20, 74, 4], [24, 77, 8], [32, 76, 8], [40, 74, 4], [44, 71, 4], [48, 73, 8], [56, 70, 8]],
    step(i, t, sp) { const bar = i >> 4, k = bar % 4, c = this.chords[k], r = this.roots[k], s = bar % 16, p = i % 64, sw = (i % 4 === 2) ? sp * 0.33 : 0;
      if (i % 4 === 0) bass(r + 12 + this.walk[(i >> 2) % 4], t, sp * 3.4, 0.065, 650);
      if (i % 16 === 0 || i % 16 === 10) ep(c, t + sw, sp * 6, { v: 0.06, cut: 1900 });
      if (s >= 2) { if (i % 8 === 4) hat(t, 0.014, true); if (i % 4 === 2) hat(t + sw, 0.008); }
      if (s >= 8 && s < 16) play1(this.mA, p, t, sp, { v: 0.024, cut: 1200, waves: ['triangle', 'sawtooth'], att: 0.06, vib: 0.012, vibHz: 4.5, echo: 0.25 });
      if (i % 128 === 120) bell(c[3] + 12, t, 0.02); } },
  // ネオ・トーキョー: 第七到着ゲート裏、暖簾の灯り
  tokyo: { bpm: 92, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], bassPat: [0, null, 12, 0, null, 0, 12, null],
    mA: [[0, 72, 4], [4, 76, 4], [8, 79, 6], [14, 77, 2], [16, 76, 8], [24, 74, 4], [28, 71, 4], [32, 74, 4], [36, 72, 4], [40, 69, 8], [48, 71, 4], [52, 72, 4], [56, 74, 8]],
    step(i, t, sp) { const bar = i >> 4, c = this.chords[bar % 4], s = bar % 16, p = i % 64, b = this.bassPat[i % 8];
      if (i % 16 === 0) pad(c, t, sp * 16, { v: 0.03, f0: 400, f1: 1400, wave: 'triangle' });
      if (s >= 1 && b != null && i % 2 === 0) bass(c[0] - 12 + b, t, sp * 1.6, 0.06, 700);
      if ([0, 6, 10].includes(i % 16)) ep(c.map(n => n + 12), t, sp * 3, { v: 0.045, cut: 2400 });
      if (s >= 4) { if (i % 8 === 0) kick(t, 0.13); if (i % 8 === 4) snare(t, 0.04, 1600); if (i % 2 === 1) hat(t, 0.008); }
      if (s >= 8) play1(this.mA, p, t, sp, { v: 0.022, cut: 2000, att: 0.04, rel: 0.25, echo: 0.3 });
      if (s >= 12 && i % 2 === 0) arp(c[(i >> 1) % 4] + 24, t, 0.01, 'triangle', 2400); } },
  // カワサキ: 鉄を叩く街
  factory: { bpm: 104, chords: [[52, 55, 59], [48, 52, 55], [50, 54, 57], [47, 51, 54]], ost: [0, 0, 12, 0, 0, 7, 0, 12, 0, 0, 12, 0, 10, 0, 7, 0],
    mA: [[0, 76, 2], [3, 76, 2], [6, 79, 4], [16, 72, 2], [19, 72, 2], [22, 76, 4], [32, 74, 2], [35, 74, 2], [38, 78, 4], [48, 75, 6], [56, 71, 6]],
    step(i, t, sp) { const bar = i >> 4, c = this.chords[bar % 4], s = bar % 16, p = i % 64;
      if (i % 32 === 0) pad(c, t, sp * 32, { v: 0.03, f0: 220, f1: 900 });
      if (s >= 1 && i % 2 === 0) bass(c[0] - 12 + this.ost[i % 16], t, sp * 1.4, 0.06, 650);
      if (s >= 2) { if (i % 8 === 0 || i % 16 === 10) kick(t, 0.2); if (i % 8 === 4) snare(t, 0.06, 900); }
      if (s >= 4) { if (i % 16 === 6 || i % 16 === 14) clank(72 + (bar % 2) * 3, t, 0.03); if (i % 32 === 31) clank(60, t, 0.035); }
      if (s >= 8) play1(this.mA, p, t, sp, { v: 0.022, cut: 1400, att: 0.02, rel: 0.12, vib: 0.004 }); } },
  // ハコネ: 湯けむりと琴と尺八
  onsen: { bpm: 54, scale: [64, 65, 69, 71, 72, 76, 77, 81],
    kot: [[0, 0], [2, 2], [4, 3], [6, 4], [8, 5], [12, 4], [14, 3]],
    mA: [[0, 76, 12], [12, 77, 4], [16, 76, 8], [24, 72, 4], [28, 71, 4], [32, 69, 16], [48, 71, 6], [54, 72, 2], [56, 71, 8]],
    step(i, t, sp) { const bar = i >> 4, s = bar % 16, p = i % 64;
      if (i % 32 === 0) pad([40, 47, 52, 59], t, sp * 32, { v: 0.04, f0: 220, f1: 800, wave: 'triangle', rel: 2 });
      if (i % 32 === 0) sub(28, t, sp * 30, 0.06);
      if (s >= 1) { const k = at(this.kot, i % 16); if (k && !(bar % 4 === 3 && i % 16 > 8)) pluck(this.scale[(k[1] + (bar % 2)) % 8], t, 0.04, { dec: 1.8, echo: 0.4 }); }
      if (s >= 4 && s < 12) { const m = at(this.mA, p); if (m) lead(m[1], t, m[2] * sp, { v: 0.026, cut: 1300, waves: ['triangle', 'sine'], vib: 0.012, vibHz: 4.2, from: m[1] - 1, glide: 0.2, att: 0.25, rel: 0.8, wet: 0.55 }); }
      if (i % 48 === 37) box(this.scale[(i >> 3) % 8] + 12, t, 0.018); } },
  // カシワタウン: 時間がゆっくり流れる郊外
  suburb: { bpm: 72, chords: [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 52]],
    mA: [[0, 76, 4], [4, 79, 4], [8, 84, 8], [16, 83, 4], [20, 79, 4], [24, 76, 8], [32, 77, 4], [36, 76, 4], [40, 72, 8], [48, 74, 6], [54, 72, 2], [56, 71, 8]],
    step(i, t, sp) { const bar = i >> 4, c = this.chords[bar % 4], s = bar % 16, p = i % 64;
      if (i % 16 === 0) { pad(c, t, sp * 16, { v: 0.04, f0: 350, f1: 1200, wave: 'triangle' }); sub(c[0] - 12, t, sp * 14, 0.06); }
      if (s >= 2 && i % 4 === 0) pluck(c[(i >> 2) % 4] + 12, t, 0.03, { dec: 1.1, cut: 2200 });
      if (s >= 4) { const m = at(this.mA, p); if (m) box(m[1], t, 0.035); }
      if (s >= 8 && s < 12 && i % 8 === 0) kick(t, 0.08); } },
  // ネオコシガヤ: 誰もいないモールのBGM(少し音程がずれている)
  mall: { bpm: 100, chords: [[51, 55, 58, 62], [48, 51, 55, 58], [44, 48, 51, 55], [46, 50, 53, 55]],
    mA: [[0, 74, 4], [4, 75, 4], [8, 79, 8], [16, 77, 4], [20, 75, 4], [24, 72, 8], [32, 72, 4], [36, 75, 4], [40, 79, 6], [46, 77, 2], [48, 77, 8], [56, 74, 8]],
    step(i, t, sp) { const bar = i >> 4, c = this.chords[bar % 4], s = bar % 16, p = i % 64;
      if (i % 16 === 0 || i % 16 === 6 || i % 16 === 12) ep(c, t, sp * 5, { v: 0.05, cut: 1800, det: -18, wob: 14, wet: 0.45 });
      if (i % 16 === 0 || i % 16 === 6) bass(c[0] - 12, t, sp * 3, 0.06, 500);
      if (s >= 2) { if (i % 8 === 0) kick(t, 0.11); if (i % 8 === 4) snare(t, 0.03, 1500); }
      if (s >= 4 && s < 12) play1(this.mA, p, t, sp, { v: 0.02, cut: 1600, det: -25, waves: ['triangle', 'square'], att: 0.03, rel: 0.3, vib: 0.02, vibHz: 3, wet: 0.5 });
      if (s === 14 && i % 16 === 0) { bell(79, t, 0.035, 2.5); bell(75, t + sp * 3, 0.035, 3); } } },
  // PCバンと店: 低いチップチューン
  van: { bpm: 96, chords: [[45, 48, 52, 55], [50, 53, 57, 60], [41, 45, 48, 52], [40, 43, 47, 50]],
    step(i, t, sp) { const bar = i >> 4, c = this.chords[bar % 4], s = bar % 8;
      if (i % 16 === 0) pad(c, t, sp * 16, { v: 0.03, f0: 300, f1: 900, wave: 'triangle' });
      if (i % 4 === 0 || i % 16 === 14) bass(c[0] - 12 + (i % 8 === 4 ? 12 : 0), t, sp * 1.8, 0.055, 550);
      if (i % 2 === 0) arp(c[[0, 1, 2, 3, 2, 1, 3, 2][(i >> 1) % 8]] + 12, t, 0.016, 'square', 1500);
      if (s >= 2) { if (i % 8 === 0) kick(t, 0.1); if (i % 4 === 2) hat(t, 0.007); }
      if (s >= 4 && i % 32 === 20) box(c[3] + 24, t, 0.02); } },
  battle: { bpm: 124, chords: [[45, 48, 52], [41, 45, 48], [43, 47, 50], [40, 43, 47]],
    mA: [[0, 76, 6], [6, 74, 2], [8, 72, 8], [16, 69, 4], [20, 72, 4], [24, 76, 8], [32, 77, 8], [40, 76, 4], [44, 72, 4], [48, 69, 12], [60, 72, 4],
      [64, 74, 6], [70, 71, 2], [72, 74, 4], [76, 79, 4], [80, 77, 8], [88, 74, 8], [96, 76, 12], [108, 79, 4], [112, 76, 4], [116, 74, 4], [120, 71, 8]],
    step(i, t, sp) { const bar = i >> 4, c = this.chords[(bar >> 1) % 4], s = bar % 16;
      if (i % 32 === 0) pad(c.map(n => n + 12), t, sp * 32, { v: 0.04, f0: 500, f1: 2400, q: 6 });
      bass(c[0] - 12 + (i % 8 === 6 ? 12 : 0), t, sp * 0.9, 0.09, 900);
      if (s % 8 === 7 && i % 16 >= 12) tom(t, 45 - (i % 4) * 2, 0.13);
      else { if (i % 4 === 0) kick(t, 0.28); if (i % 8 === 4) snare(t, 0.1); if (i % 2 === 1) hat(t, 0.026); }
      if (s < 8 && i % 2 === 0) arp(c[(i >> 1) % 3] + 24, t, 0.018);
      if (s >= 8) play1(this.mA, i % 128, t, sp, { v: 0.022, cut: 2000, att: 0.02, rel: 0.15, echo: 0.25 }); } },
  boss: { bpm: 132, chords: [[48, 51, 55], [44, 48, 51], [41, 44, 48], [43, 47, 50]],
    mA: [[0, 72, 8], [8, 75, 4], [12, 74, 4], [16, 72, 8], [24, 67, 8], [32, 68, 8], [40, 72, 8], [48, 75, 8], [56, 77, 4], [60, 75, 4],
      [64, 77, 12], [76, 75, 4], [80, 72, 8], [88, 68, 8], [96, 74, 8], [104, 71, 8], [112, 67, 8], [120, 74, 4], [124, 79, 4]],
    step(i, t, sp) { const bar = i >> 4, c = this.chords[(bar >> 1) % 4], s = bar % 32;
      if (i % 32 === 0) pad(c.concat([c[0] + 12]), t, sp * 32, { v: 0.06, f0: 300, f1: 2800, q: 8 });
      bass(c[0] - 12 + ([0, 0, 12, 0, 0, 7, 0, 12][i % 8]), t, sp * 0.85, 0.1, 1100);
      if (s % 8 === 7 && i % 16 >= 10 && i % 2 === 0) tom(t, 48 - (i % 16 - 10), 0.15);
      else { if (i % 4 === 0) kick(t, 0.32); if (i % 8 === 4) snare(t, 0.13); hat(t, i % 4 === 2 ? 0.035 : 0.018, i % 8 === 6); }
      if ((s >= 8 && s < 16 || s >= 24) && [0, 3, 6, 10].includes(i % 16)) c.forEach(n => lead(n + 12, t, sp * 1.2, { v: 0.012, cut: 2200, att: 0.01, rel: 0.1, vib: 0 }));
      if (s >= 24 && i % 64 === 0) choir(c.map(n => n + 24), t, sp * 64, 0.03);
      if (s >= 16 && s < 24) play1(this.mA, i % 128, t, sp, { v: 0.024, cut: 2200, att: 0.03, rel: 0.2, echo: 0.25 });
      if (i % 32 === 28) bell(c[2] + 24, t, 0.025); } },
  // 最終決戦
  final: { bpm: 140, chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]],
    mA: [[0, 74, 8], [8, 77, 8], [16, 81, 12], [28, 79, 4], [32, 77, 8], [40, 74, 8], [48, 70, 12], [60, 72, 4],
      [64, 72, 8], [72, 76, 8], [80, 79, 8], [88, 76, 8], [96, 73, 16], [112, 76, 8], [120, 81, 8]],
    step(i, t, sp) { const bar = i >> 4, c = this.chords[(bar >> 1) % 4], s = bar % 24;
      if (i % 32 === 0) { pad(c.concat([c[0] + 12]), t, sp * 32, { v: 0.055, f0: 280, f1: 2600, q: 7 }); if (s >= 8) choir(c.map(n => n + 24), t, sp * 32, 0.03); }
      bass(c[0] - 12 + ([0, 12, 0, 7, 0, 12, 10, 12][i % 8]), t, sp * 0.8, 0.1, 1200);
      if (s % 8 === 7 && i % 16 >= 8 && i % 2 === 0) tom(t, 50 - (i % 16 - 8), 0.16);
      else { if (i % 4 === 0 || i % 16 === 14) kick(t, 0.32); if (i % 8 === 4) snare(t, 0.13); if (i % 2 === 1) hat(t, 0.024); }
      if (s < 8 && i % 2 === 0) arp(c[[0, 1, 2, 1][(i >> 1) % 4]] + 24, t, 0.016);
      if (s >= 8 && s < 16) play1(this.mA, i % 128, t, sp, { v: 0.026, cut: 2300, att: 0.03, rel: 0.25, echo: 0.3 });
      if (s >= 16 && [0, 3, 6, 10].includes(i % 16)) c.forEach(n => lead(n + 12, t, sp * 1.4, { v: 0.011, cut: 2200, att: 0.01, rel: 0.1, vib: 0 })); } },
  moon: { bpm: 54, chords: [[57, 61, 64, 68], [54, 57, 61, 64], [52, 56, 59, 64], [49, 52, 56, 61]],
    mA: [[0, 76, 12], [12, 80, 4], [16, 78, 16], [32, 76, 8], [40, 71, 8], [48, 73, 16]],
    step(i, t, sp) { const bar = i >> 4, c = this.chords[bar % 4], s = bar % 16, p = i % 64;
      if (i % 16 === 0) { pad(c.map(n => n + 12), t, sp * 16, { v: 0.045, f0: 600, f1: 2600, wave: 'triangle' }); sub(c[0] - 24, t, sp * 15, 0.05); }
      if (i % 8 === 4) bell(c[(i >> 3) % 4] + 12, t, 0.028);
      if (s >= 8) play1(this.mA, p, t, sp, { v: 0.022, cut: 1300, waves: ['triangle', 'sine'], att: 0.4, rel: 1.5, wet: 0.6, echo: 0.4 }); } },
  ending: { bpm: 66, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
    mA: [[0, 72, 8], [8, 76, 4], [12, 74, 4], [16, 71, 12], [28, 72, 4], [32, 69, 8], [40, 72, 8], [48, 71, 16]],
    step(i, t, sp) { const bar = i >> 4, c = this.chords[bar % 4], s = bar % 16, p = i % 64;
      if (i % 16 === 0) { pad(c, t, sp * 16, { v: 0.06, f0: 350, f1: 1800 }); bass(c[0] - 12, t, sp * 15, 0.07, 280); }
      if (i % 4 === 0) arp(c[(i >> 2) % 4] + 12, t, 0.02, 'triangle');
      if (s >= 4) play1(this.mA, p, t, sp, { v: 0.026, cut: 1600, att: 0.25, rel: 1.2, echo: 0.4 });
      if (s >= 8 && i % 64 === 0) choir(c.map(n => n + 12), t, sp * 64, 0.025);
      if (i % 16 === 10) bell(c[3] + 12, t, 0.03); } },
};
function tick() {
  if (!ctx || !cur || !B) return;
  const tr = TR[cur], sp = 60 / tr.bpm / 4;
  while (nextT < ctx.currentTime + 0.35) { try { tr.step(step, nextT, sp); } catch (e) {} step++; nextT += sp; }
}
function play(name) {
  if (!TR[name]) name = 'city';
  if (!ctx || !enabled) { cur = name; return; }
  if (name === cur && timer) return;
  const fade = !started ? 3 : (name === 'battle' || name === 'boss' || name === 'final') ? 0.5 : 1.6;
  started = true;
  master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(vol * 0.35, ctx.currentTime, 0.05);
  dropBus(B, (name === 'battle' || name === 'boss' || name === 'final') ? 0.5 : 1.4);
  B = mkBus(fade);
  cur = name; step = 0; nextT = ctx.currentTime + 0.12;
  if (!timer) timer = setInterval(tick, 90);
}
function stop() { if (timer) clearInterval(timer); timer = null; if (ctx) dropBus(B, 0.6); B = null; }
function setVol(v) { vol = v; if (master && timer) master.gain.setTargetAtTime(vol * 0.35, ctx.currentTime, 0.2); }
function setEnabled(b) { enabled = b; if (!b) stop(); else if (cur) { const c = cur; cur = null; play(c); } }
function schedule(name, secs) { const tr = TR[name], sp = 60 / tr.bpm / 4; cur = name; master.gain.value = vol * 0.35; B = mkBus(0.01); let i = 0, t = 0.05; while (t < secs) { tr.step(i, t, sp); i++; t += sp; } }
root.BGM = { init, _schedule: schedule, play, stop, setVol, setEnabled, tracks: Object.keys(TR), get cur() { return cur; } };
})(window);

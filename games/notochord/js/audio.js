// audio.js — BGM と効果音（Web Audio でその場で生成。音声ファイルは使わない）
// 最初のタップで unlock() を呼ぶ（ブラウザの自動再生制限のため）。
// BGM：心音のようなキック、残響の長い金属音、ゆっくりうねる低いドローン、フリジア旋法のサブベース、遠いデータ音。
import { makeRng } from './util.js';
const noiseRng = makeRng(0xA0D10);   // 音の素材用（ゲームの乱数とは別の系列）

export function createAudio(cfg = {}) {
  let ctx = null, comp, bgmBus, sfxBus, lp, noise, verb, verbSend, delay, delaySend;
  let timer = null, step = 0, bar = 0, nextTime = 0, bpm = cfg.bpm ?? 92, half = false, playing = false, boss = false;
  let pad = null;
  const vol = { bgm: cfg.bgm ?? 0.6, sfx: cfg.sfx ?? 0.8 };
  const LP_LOW = cfg.lpLow ?? 300, LP_HIGH = cfg.lpHigh ?? 3500;

  function ensure() {
    if (ctx) return true;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = noiseRng.next() * 2 - 1;
    // 残響（自前で作るインパルス）
    verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 3.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const x = ir.getChannelData(ch); for (let i = 0; i < len; i++) x[i] = (noiseRng.next() * 2 - 1) * (1 - i / len) ** 2.6; }
    verb.buffer = ir;
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.55; verb.connect(verbOut); verbOut.connect(comp);
    verbSend = ctx.createGain(); verbSend.gain.value = 1; verbSend.connect(verb);
    // 付点8分のディレイ
    delay = ctx.createDelay(1.5); const fb = ctx.createGain(); fb.gain.value = 0.42;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2400;
    delay.connect(dlp); dlp.connect(fb); fb.connect(delay); dlp.connect(verbSend); dlp.connect(comp);
    delaySend = ctx.createGain(); delaySend.gain.value = 1; delaySend.connect(delay);
    // BGM（発火中に開くローパスを通す）と効果音
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = LP_LOW; lp.Q.value = 2; lp.connect(comp);
    bgmBus = ctx.createGain(); bgmBus.connect(lp);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    applyVolume(); setDelayTime();
    return true;
  }
  function applyVolume() { if (!ctx) return; bgmBus.gain.value = vol.bgm * 0.6; sfxBus.gain.value = vol.sfx * 0.7; }
  function setDelayTime() { if (delay) delay.delayTime.value = Math.min(1.4, 60 / bpm * 0.75); }
  const now = () => ctx.currentTime;

  // ---- 部品 ----
  function env(g, t, a, peak, d, end = 0.0001) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + d);
  }
  function osc(type, f0, f1, t, dur, peak, bus, a = 0.002, sends = null) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, a, peak, dur); o.connect(g); g.connect(bus);
    if (sends) for (const [node, k] of sends) { const sg = ctx.createGain(); sg.gain.value = k; g.connect(sg); sg.connect(node); }
    o.start(t); o.stop(t + a + dur + 0.05);
    return o;
  }
  function burst(t, dur, peak, bus, ftype, freq, q = 1, a = 0.001, reverse = false, sends = null) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = ftype; f.frequency.value = freq; f.Q.value = q;
    if (reverse) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur); g.gain.setValueAtTime(0.0001, t + dur + 0.01); }
    else env(g, t, a, peak, dur);
    s.connect(f); f.connect(g); g.connect(bus);
    if (sends) for (const [node, k] of sends) { const sg = ctx.createGain(); sg.gain.value = k; g.connect(sg); sg.connect(node); }
    s.start(t, noiseRng.next() * 0.5); s.stop(t + dur + 0.05);
  }

  // ---- BGM ----
  // コード進行（フリジア旋法）：A → B♭ → G → F（各2小節）。ボスでは三全音を足して不穏にする
  const ROOTS = [55, 58.27, 49, 43.65];
  const KICK = [1, 0, 0, 0.55, 0, 0, 0, 0, 1, 0, 0, 0.55, 0, 0, 0, 0];      // 心音（ドクン、ドクン）
  const METAL = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0.35, 0];        // 残響の長い金属音
  const TICK = [0, 0.3, 0, 0.5, 0, 0.3, 0, 0.6, 0, 0.3, 0, 0.5, 0, 0.3, 0.4, 0.7];
  const SUB = [1, 0, 0, 0, 0, 0, 0.7, 0, 0, 0, 1, 0, 0, 0, 0, 0];
  function startPad(t) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 4);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 3;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 260; lfo.connect(lg); lg.connect(f.frequency); lfo.start(t);
    const oscs = [[1, 'sawtooth', -7], [1, 'sawtooth', 7], [1.5, 'triangle', 0], [2, 'sine', 3], [Math.SQRT2, 'sawtooth', -4]].map(([k, type, det], i) => {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.detune.value = det;
      o.frequency.value = ROOTS[0] * k; og.gain.value = i === 4 ? (boss ? 0.35 : 0) : 0.4; o.connect(og); og.connect(f); o.start(t);
      return { o, k, og };
    });
    f.connect(g); g.connect(bgmBus);
    const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s); s.connect(verbSend);
    pad = { g, oscs, lfo, f };
  }
  function padChord(t, root) { if (!pad) return; for (const x of pad.oscs) x.o.frequency.setTargetAtTime(root * x.k, t, 0.6); }
  function stopPad() {
    if (!pad || !ctx) return;
    const t = now(), p = pad; pad = null;
    p.g.gain.cancelScheduledValues(t); p.g.gain.setTargetAtTime(0.0001, t, 0.4);
    setTimeout(() => { try { p.oscs.forEach(x => x.o.stop()); p.lfo.stop(); } catch {} }, 2500);
  }
  const V = [[verbSend, 0.5]];
  function kick(t, v) {
    osc('sine', 110, 34, t, 0.42, 0.95 * v, bgmBus);
    burst(t, 0.03, 0.18 * v, bgmBus, 'lowpass', 600);
  }
  function metal(t, v) {
    burst(t, 0.22, 0.38 * v, bgmBus, 'bandpass', 900 + 300 * (bar % 2), 6, 0.001, false, [[verbSend, 1.2]]);
    osc('triangle', 1760, 1700, t, 0.25, 0.06 * v, bgmBus, 0.001, [[verbSend, 1.5]]);
    osc('square', 233, 229, t, 0.12, 0.05 * v, bgmBus, 0.001, [[verbSend, 0.8]]);
  }
  function tick(t, v) { burst(t, 0.02, 0.07 * v, bgmBus, 'highpass', 9000, 1, 0.001, false, [[delaySend, 0.2]]); }
  function sub(t, root, v) {
    osc('sine', root, root, t, 0.6, 0.42 * v, bgmBus, 0.01);
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = root; f.type = 'lowpass'; f.frequency.setValueAtTime(380, t); f.frequency.exponentialRampToValueAtTime(110, t + 0.4); f.Q.value = 8;
    env(g, t, 0.01, 0.1 * v, 0.45); o.connect(f); f.connect(g); g.connect(bgmBus); o.start(t); o.stop(t + 0.5);
  }
  function blip(t) {
    const notes = [880, 1046.5, 1174.7, 1318.5, 1396.9];
    const f = notes[Math.floor(noiseRng.next() * notes.length)] * (boss ? Math.SQRT2 / 1.4 : 1);
    osc('sine', f, f, t, 0.18, 0.05, bgmBus, 0.003, [[delaySend, 0.9], [verbSend, 0.8]]);
  }
  function schedule() {
    const spb = 60 / (bpm * (half ? 0.5 : 1)) / 4;
    while (nextTime < now() + 0.15) {
      const t = nextTime, root = ROOTS[Math.floor(bar / 2) % ROOTS.length];
      if (step === 0 && bar % 2 === 0) padChord(t, root * 2 > 100 ? root : root * 2);
      if (KICK[step]) kick(t, KICK[step]);
      if (METAL[step]) metal(t, METAL[step]);
      const tk = boss ? 0.5 + 0.5 * (step % 2) : TICK[step];
      if (tk) tick(t, tk);
      if (SUB[step]) sub(t, root, SUB[step]);
      if (step === 14 && bar % 2 === 1) blip(t);
      if (boss && step === 6 && bar % 4 === 3) osc('sawtooth', root * 4 * Math.SQRT2, root * 4, t, 1.4, 0.04, bgmBus, 0.3, V);
      nextTime += spb;
      step = (step + 1) % 16; if (step === 0) bar++;
    }
  }

  return {
    unlock() { if (!ensure()) return; if (ctx.state === 'suspended') ctx.resume(); },
    playBgm(b) {
      if (b) { bpm = b; boss = b > (cfg.bpm ?? 92); }
      if (!ensure() || playing) return;
      setDelayTime();
      playing = true; step = 0; bar = 0; nextTime = now() + 0.08;
      startPad(now());
      timer = setInterval(schedule, 25);
    },
    stopBgm() { playing = false; clearInterval(timer); timer = null; stopPad(); },
    setTempo(b) { bpm = b; boss = b > (cfg.bpm ?? 92); setDelayTime(); if (pad) pad.oscs[4].og.gain.value = boss ? 0.35 : 0; },
    setHalf(v) { half = !!v; },
    // 0〜1：そのターンに消したノード数に応じてローパスを開く
    setOpen(x) { if (!ctx) return; const f = LP_LOW * (LP_HIGH / LP_LOW) ** Math.max(0, Math.min(1, x)); lp.frequency.setTargetAtTime(f, now(), 0.12); },
    setVolume(kind, v) { vol[kind] = v; applyVolume(); },
    get volume() { return { ...vol }; },

    // ---- 効果音 ----
    trace(n) { if (!ctx) return; const t = now(), f = 220 * 2 ** (Math.min(n, 24) / 12); osc('sine', f, f * 0.96, t, 0.08, 0.3, sfxBus, 0.002, [[delaySend, 0.15]]); burst(t, 0.025, 0.1, sfxBus, 'bandpass', f * 4, 6); },
    chain(len) {
      if (!ctx) return; const t = now();
      for (const [k, f] of [[1, 1567], [0.6, 2349], [0.45, 3520], [0.3, 4699]]) osc('sine', f, f * 0.97, t + noiseRng.next() * 0.012, 0.22 + len * 0.012, 0.16 * k, sfxBus, 0.002, [[verbSend, 0.6]]);
      burst(t, 0.1, 0.32, sfxBus, 'highpass', 2600);
      osc('sine', 70, 40, t, 0.25, 0.35, sfxBus);
    },
    tick() { if (!ctx) return; osc('square', 2600, 2600, now(), 0.02, 0.07, sfxBus); },
    step(i) { if (!ctx) return; const f = 146.8 * 2 ** (Math.min(i, 20) * 2 / 12); osc('triangle', f, f, now(), 0.1, 0.25, sfxBus, 0.002, [[delaySend, 0.2]]); },
    final() { if (!ctx) return; const t = now(); osc('sine', 55, 41, t, 0.9, 0.95, sfxBus, 0.005); burst(t, 0.35, 0.45, sfxBus, 'lowpass', 300); burst(t, 0.6, 0.2, sfxBus, 'bandpass', 1200, 2, 0.001, false, [[verbSend, 1]]); },
    weak() { if (!ctx) return; const t = now(); osc('square', 1200, 1200, t, 0.05, 0.12, sfxBus); osc('square', 1800, 1800, t + 0.07, 0.08, 0.12, sfxBus, 0.002, [[delaySend, 0.3]]); },
    reflect() { if (!ctx) return; burst(now(), 0.4, 0.4, sfxBus, 'bandpass', 1100, 2, 0, true, [[verbSend, 0.8]]); },
    ampoule() { if (!ctx) return; const t = now(); burst(t, 0.14, 0.4, sfxBus, 'bandpass', 2400, 3); osc('sine', 900, 160, t, 0.16, 0.2, sfxBus); },
    hit() { if (!ctx) return; const t = now(); burst(t, 0.45, 0.7, sfxBus, 'lowpass', 500, 1, 0.001, false, [[verbSend, 0.6]]); osc('sawtooth', 80, 30, t, 0.4, 0.35, sfxBus); osc('square', 466, 440, t, 0.25, 0.08, sfxBus); },
    alarm() { if (!ctx) return; const t = now(); osc('square', 740, 523, t, 0.2, 0.08, sfxBus, 0.002, [[verbSend, 0.4]]); },
    crit() { if (!ctx) return; const t = now(); osc('sine', 62, 27, t, 1.6, 0.7, sfxBus, 0.02); burst(t, 1.0, 0.25, sfxBus, 'lowpass', 260, 1, 0.12, false, [[verbSend, 1]]); osc('sawtooth', 110, 55, t, 1.2, 0.08, sfxBus, 0.05, [[verbSend, 1]]); },
    win() { if (!ctx) return; const t = now(); [0, 3, 7, 10].forEach((n, i) => osc('triangle', 220 * 2 ** (n / 12), 0, t + i * 0.09, 0.5, 0.2, sfxBus, 0.003, [[verbSend, 0.8]])); },
    lose() { if (!ctx) return; const t = now(); osc('sawtooth', 110, 27, t, 2.2, 0.35, sfxBus, 0.01, [[verbSend, 1]]); burst(t, 1.8, 0.3, sfxBus, 'lowpass', 700, 1, 0.01, false, [[verbSend, 1]]); },
  };
}

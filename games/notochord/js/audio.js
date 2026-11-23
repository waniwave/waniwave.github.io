// audio.js — BGM と効果音（Web Audio でその場で生成。音声ファイルは使わない）
// 最初のタップで unlock() を呼ぶ（ブラウザの自動再生制限のため）。
import { makeRng } from './util.js';
const noiseRng = makeRng(0xA0D10);   // 音の素材用（ゲームの乱数とは別の系列）

export function createAudio(cfg = {}) {
  let ctx = null, comp, bgmBus, sfxBus, lp, noise;
  let timer = null, step = 0, nextTime = 0, bpm = cfg.bpm ?? 128, half = false, playing = false;
  const vol = { bgm: cfg.bgm ?? 0.6, sfx: cfg.sfx ?? 0.8 };
  const LP_LOW = cfg.lpLow ?? 400, LP_HIGH = cfg.lpHigh ?? 4500;

  function ensure() {
    if (ctx) return true;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = LP_LOW; lp.Q.value = 3; lp.connect(comp);
    bgmBus = ctx.createGain(); bgmBus.connect(lp);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    applyVolume();
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = noiseRng.next() * 2 - 1;
    return true;
  }
  function applyVolume() { if (!ctx) return; bgmBus.gain.value = vol.bgm * 0.55; sfxBus.gain.value = vol.sfx * 0.7; }
  const now = () => ctx.currentTime;

  // ---- 部品 ----
  function env(g, t, a, peak, d, end = 0.0001) {
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(end, t + a + d);
  }
  function osc(type, f0, f1, t, dur, peak, bus, a = 0.002) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, a, peak, dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + a + dur + 0.02);
    return o;
  }
  function burst(t, dur, peak, bus, ftype, freq, q = 1, a = 0.001, reverse = false) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = ftype; f.frequency.value = freq; f.Q.value = q;
    if (reverse) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + dur); g.gain.setValueAtTime(0.0001, t + dur + 0.01); }
    else env(g, t, a, peak, dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, noiseRng.next() * 0.5); s.stop(t + dur + 0.05);
  }

  // ---- BGM：ダークなブレイクビーツ（16ステップ） ----
  const KICK = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0];
  const SNARE = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.35];
  const HAT = [0.6, 0, 1, 0.4, 0.6, 0, 1, 0, 0.6, 0.3, 1, 0, 0.6, 0, 1, 0.5];
  const BASS = [0, null, 12, 0, null, -2, 0, 10, 0, null, 12, null, 3, 0, -2, null];
  const ACC = [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1];
  function kick(t) { osc('sine', 140, 38, t, 0.32, 0.95, bgmBus); burst(t, 0.02, 0.25, bgmBus, 'lowpass', 900); }
  function snare(t, v) { burst(t, 0.16, 0.55 * v, bgmBus, 'bandpass', 1700, 0.7); osc('triangle', 210, 150, t, 0.08, 0.3 * v, bgmBus); }
  function hat(t, v) { burst(t, 0.035, 0.22 * v, bgmBus, 'highpass', 8000); }
  function bass(t, n, acc) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 55 * 2 ** (n / 12);
    f.type = 'lowpass'; f.Q.value = 14;
    f.frequency.setValueAtTime(acc ? 2600 : 900, t); f.frequency.exponentialRampToValueAtTime(180, t + 0.18);
    env(g, t, 0.003, acc ? 0.32 : 0.22, 0.2);
    o.connect(f); f.connect(g); g.connect(bgmBus); o.start(t); o.stop(t + 0.25);
  }
  function schedule() {
    while (nextTime < now() + 0.12) {
      const t = nextTime;
      if (KICK[step]) kick(t);
      if (SNARE[step]) snare(t, SNARE[step]);
      if (HAT[step]) hat(t, HAT[step]);
      if (BASS[step] != null) bass(t, BASS[step], ACC[step]);
      nextTime += 60 / (bpm * (half ? 0.5 : 1)) / 4;
      step = (step + 1) % 16;
    }
  }

  return {
    unlock() { if (!ensure()) return; if (ctx.state === 'suspended') ctx.resume(); },
    playBgm(b) { if (b) bpm = b; if (!ensure() || playing) return; playing = true; step = 0; nextTime = now() + 0.05; timer = setInterval(schedule, 25); },
    stopBgm() { playing = false; clearInterval(timer); timer = null; },
    setTempo(b) { bpm = b; },
    setHalf(v) { half = !!v; },
    // 0〜1：そのターンに消したノード数に応じてローパスを開く
    setOpen(x) { if (!ctx) return; const f = LP_LOW * (LP_HIGH / LP_LOW) ** Math.max(0, Math.min(1, x)); lp.frequency.setTargetAtTime(f, now(), 0.08); },
    setVolume(kind, v) { vol[kind] = v; applyVolume(); },
    get volume() { return { ...vol }; },

    // ---- 効果音 ----
    trace(n) { if (!ctx) return; const t = now(), f = 330 * 2 ** (Math.min(n, 24) / 12); osc('sine', f, f * 0.94, t, 0.07, 0.35, sfxBus); burst(t, 0.03, 0.12, sfxBus, 'bandpass', f * 3, 4); },
    chain(len) {
      if (!ctx) return; const t = now();
      for (const [k, f] of [[1, 2100], [0.6, 3170], [0.4, 4730], [0.3, 6220]]) osc('sine', f, f * 0.98, t + noiseRng.next() * 0.01, 0.18 + len * 0.01, 0.18 * k, sfxBus);
      burst(t, 0.12, 0.35, sfxBus, 'highpass', 3000);
    },
    tick() { if (!ctx) return; osc('square', 2400, 2400, now(), 0.025, 0.08, sfxBus); },
    step(i) { if (!ctx) return; const f = 196 * 2 ** (Math.min(i, 20) * 2 / 12); osc('triangle', f, f, now(), 0.09, 0.28, sfxBus); },
    final() { if (!ctx) return; const t = now(); osc('sine', 55, 52, t, 0.7, 0.9, sfxBus, 0.005); burst(t, 0.25, 0.4, sfxBus, 'lowpass', 400); },
    weak() { if (!ctx) return; const t = now(); osc('square', 1200, 1200, t, 0.05, 0.15, sfxBus); osc('square', 1800, 1800, t + 0.07, 0.08, 0.15, sfxBus); },
    reflect() { if (!ctx) return; burst(now(), 0.35, 0.4, sfxBus, 'bandpass', 1200, 2, 0, true); },
    ampoule() { if (!ctx) return; const t = now(); burst(t, 0.12, 0.4, sfxBus, 'bandpass', 2500, 3); osc('sine', 900, 200, t, 0.12, 0.2, sfxBus); },
    hit() { if (!ctx) return; const t = now(); burst(t, 0.3, 0.6, sfxBus, 'lowpass', 600); osc('sawtooth', 90, 40, t, 0.3, 0.3, sfxBus); },
    alarm() { if (!ctx) return; const t = now(); osc('square', 880, 660, t, 0.18, 0.12, sfxBus); },
    crit() { if (!ctx) return; const t = now(); osc('sine', 80, 30, t, 1.2, 0.7, sfxBus, 0.02); burst(t, 0.8, 0.25, sfxBus, 'lowpass', 300, 1, 0.1); },
    win() { if (!ctx) return; const t = now(); [0, 4, 7, 12].forEach((n, i) => osc('triangle', 330 * 2 ** (n / 12), 0, t + i * 0.08, 0.3, 0.25, sfxBus)); },
    lose() { if (!ctx) return; const t = now(); osc('sawtooth', 220, 30, t, 1.5, 0.4, sfxBus); burst(t, 1.2, 0.3, sfxBus, 'lowpass', 800); },
  };
}

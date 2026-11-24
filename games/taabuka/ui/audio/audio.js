// 音（仕様書 第10章「音」）：素材ファイルを持たず、Web Audio でその場で合成する。
// 最初のタップで音を有効にする（ブラウザの決まり）。常時鳴るノイズは入れない（BGMも区切りのある音だけ）。
// 演出の「早送り」は音に関係しない。音は結果に触れない。

let ac = null, master = null, seBus = null, bgmBus = null, noiseBuf = null;
let vol = { se: 0.7, bgm: 0.5 };
let vib = true;

/** 最初のタップで呼ぶ（何度呼んでもよい） */
export function unlockAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.connect(ac.destination);
  seBus = ac.createGain(); seBus.connect(master);
  bgmBus = ac.createGain(); bgmBus.connect(master);
  applyVolume();
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 1, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let s = 12345;   // 見た目だけの擬似乱数（計算の乱数とは無関係）
  for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
  if (pendingBgm) { const p = pendingBgm; pendingBgm = null; playBgm(p.name, p.shift); }
}
export function audioReady() { return !!ac; }

export function setAudioOptions(o) {
  if (o.se != null) vol.se = o.se;
  if (o.bgm != null) vol.bgm = o.bgm;
  if (o.vibrate != null) vib = o.vibrate;
  applyVolume();
}
function applyVolume() { if (!ac) return; seBus.gain.value = vol.se * 0.6; bgmBus.gain.value = vol.bgm * 0.35; }

/** 振動（navigator.vibrate がある端末だけ） */
export function buzz(pattern = 40) { if (vib && navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* 無い端末 */ } } }

// ───────── 部品 ─────────
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(freq, { type = 'sine', t = 0, a = 0.005, d = 0.15, peak = 0.4, to = null, bus = seBus } = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + t;
  const o = ac.createOscillator(); const g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + a + d);
  env(g, t0, a, peak, d);
  o.connect(g); g.connect(bus);
  o.start(t0); o.stop(t0 + a + d + 0.05);
}
function noise({ t = 0, d = 0.2, peak = 0.4, type = 'lowpass', f = 1200, to = null, q = 0.7, bus = seBus } = {}) {
  if (!ac) return;
  const t0 = ac.currentTime + t;
  const src = ac.createBufferSource(); src.buffer = noiseBuf;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t0 + d);
  const g = ac.createGain(); env(g, t0, 0.004, peak, d);
  src.connect(fl); fl.connect(g); g.connect(bus);
  src.start(t0, Math.random() * 0.5); src.stop(t0 + d + 0.05);
}

// ───────── 効果音 ─────────
export const SE = {
  /** 採点ごとに音程が上がる（i 番目） */
  score: (i = 0) => { const f = 330 * Math.pow(2, Math.min(i, 24) / 12); tone(f, { type: 'triangle', d: 0.12, peak: 0.3 }); tone(f * 2, { type: 'sine', d: 0.08, peak: 0.08 }); },
  /** 倍率が足される（少し高い） */
  mult: (i = 0) => { const f = 440 * Math.pow(2, Math.min(i, 24) / 12); tone(f, { type: 'square', d: 0.08, peak: 0.12 }); },
  taiko: () => { tone(140, { to: 48, d: 0.32, peak: 0.9 }); noise({ d: 0.06, peak: 0.25, f: 900 }); },
  boom: () => { noise({ d: 1.1, peak: 0.9, f: 900, to: 60 }); tone(70, { to: 30, d: 0.9, peak: 0.8 }); },
  stamp: () => { noise({ d: 0.05, peak: 0.5, type: 'bandpass', f: 1800 }); tone(110, { to: 60, d: 0.16, peak: 0.7 }); },
  fusuma: () => noise({ d: 0.38, peak: 0.25, type: 'bandpass', f: 500, to: 1800, q: 1.5 }),
  chest: () => { tone(220, { type: 'square', d: 0.05, peak: 0.12 }); noise({ d: 0.05, peak: 0.25, type: 'bandpass', f: 700, q: 4 }); },
  open: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', t: i * 0.06, d: 0.2, peak: 0.25 })); },
  heart: () => { tone(60, { to: 40, d: 0.12, peak: 0.9 }); tone(55, { to: 38, t: 0.18, d: 0.14, peak: 0.7 }); },
  step: () => noise({ d: 0.08, peak: 0.35, f: 320 }),
  crack: () => { noise({ d: 0.25, peak: 0.7, type: 'highpass', f: 1500 }); tone(90, { to: 40, d: 0.3, peak: 0.6 }); },
  slash: () => noise({ d: 0.22, peak: 0.6, type: 'bandpass', f: 3000, to: 600, q: 2 }),
  hit: () => { tone(180, { to: 80, d: 0.12, peak: 0.5 }); noise({ d: 0.05, peak: 0.25, f: 2000 }); },
  kiran: () => [1568, 2093, 2637].forEach((f, i) => tone(f, { t: i * 0.05, d: 0.25, peak: 0.12 })),
  glitch: () => { for (let i = 0; i < 6; i++) tone(200 + i * 137, { type: 'square', t: i * 0.03, d: 0.03, peak: 0.08 }); },
  gacha: () => { for (let i = 0; i < 12; i++) tone(392 * Math.pow(2, i / 6), { type: 'triangle', t: i * 0.05, d: 0.12, peak: 0.18 }); },
  fanfare: () => { [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.56], [1047, 0.68]].forEach(([f, t]) => { tone(f, { type: 'triangle', t, d: 0.3, peak: 0.3 }); tone(f / 2, { type: 'square', t, d: 0.25, peak: 0.06 }); }); },
  shatter: () => { noise({ d: 0.3, peak: 0.4, type: 'highpass', f: 2500 }); [2093, 2349, 1760].forEach((f, i) => tone(f, { t: i * 0.03, d: 0.15, peak: 0.08 })); },
  coin: () => { tone(1319, { type: 'square', d: 0.05, peak: 0.08 }); tone(1760, { type: 'square', t: 0.05, d: 0.12, peak: 0.08 }); },
  water: () => noise({ d: 0.8, peak: 0.3, f: 400, to: 150 }),
  god: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { type: 'sine', t: i * 0.1, d: 1.2, peak: 0.2 })); },
};
/** 名前で鳴らす（演出「音」） */
export function playSE(name, ...a) { if (!ac) return; (SE[name] || SE[{ 太鼓: 'taiko', 爆発: 'boom', 判子: 'stamp', 襖: 'fusuma', 宝箱: 'chest', 心音: 'heart', 足音: 'step', 斬る: 'slash', 鈴: 'kiran', ガチャ: 'gacha' }[name]] || SE.hit)(...a); }

/** 一瞬だけ全部の音を消す（完全論破：0.3秒消えてから爆音） */
export function silence(ms = 300) {
  if (!ac) return;
  const t = ac.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(0.0001, t);
  master.gain.setValueAtTime(1, t + ms / 1000);
}

// ───────── BGM ─────────
// 区切りのある音だけで作る簡単な曲。層ごとに音階と速さを変え、深い階ほど音程を下げる（shift 半音）
const SONGS = {
  宿: { bpm: 84, wave: 'triangle', root: 220, scale: [0, 2, 4, 7, 9], mel: [0, 2, 4, 2, 3, 2, 1, -1, 0, 4, 3, 2, 1, 2, 0, -1], bass: [0, -5, -3, -5] },
  layer1: { bpm: 96, wave: 'triangle', root: 196, scale: [0, 2, 3, 7, 8], mel: [0, -1, 0, 2, 3, -1, 2, -1, 0, 1, 2, 4, 3, -1, 2, -1], bass: [0, 0, -4, -2] },
  layer2: { bpm: 88, wave: 'sine', root: 174.6, scale: [0, 1, 5, 7, 8], mel: [4, -1, 3, -1, 2, 1, 0, -1, 2, -1, 3, 4, 2, -1, 1, -1], bass: [0, -2, 1, -4] },
  層主: { bpm: 132, wave: 'square', root: 146.8, scale: [0, 1, 3, 6, 7], mel: [0, 0, 3, 0, 4, 3, 1, 0, 0, 0, 3, 0, 4, 5, 4, 3], bass: [0, 0, 1, -1] },
  '宿・三味線': { bpm: 92, wave: 'sawtooth', root: 220, scale: [0, 1, 5, 7, 8], mel: [0, 2, 3, 2, 4, 3, 2, -1, 0, 1, 2, 4, 5, 4, 2, -1], bass: [0, -3, -2, -5] },
  '宿・囃子': { bpm: 120, wave: 'square', root: 261.6, scale: [0, 2, 5, 7, 9], mel: [0, 2, 4, 2, 5, 4, 2, 0, 4, 5, 6, 5, 4, 2, 4, -1], bass: [0, 0, -3, -2] },
  脱出: { bpm: 120, wave: 'triangle', root: 261.6, scale: [0, 2, 4, 7, 9], mel: [0, 2, 4, 5, 4, 2, 4, -1], bass: [0, -3] },
};
let bgm = null, pendingBgm = null;
/** BGM を鳴らす（同じ曲なら続ける） */
// 場の状態で曲が変わる（ノリノリ＝速く高く手拍子、しんみり＝遅く短調…）。null で元に戻る
let moodB = null;
export function setBgmMood(m) {
  moodB = m || null;
  if (moodB?.mute) { if (bgm) bgm.muted = true; } else if (bgm) bgm.muted = false;
}
export function playBgm(name, shift = 0) {
  if (!ac) { pendingBgm = { name, shift }; return; }
  if (bgm && bgm.name === name && bgm.shift === shift) return;
  stopBgm();
  const S = SONGS[name] ?? SONGS.layer1;
  const stepOf = () => 60 / (S.bpm * (moodB?.tempo ?? 1)) / 2;
  const at = (deg, oct = 0) => {
    const sc = moodB?.scale ?? S.scale;
    const n = sc.length;
    const o = Math.floor(deg / n);
    const k = ((deg % n) + n) % n;
    return S.root * Math.pow(2, (sc[k] + 12 * (o + oct) + shift + (moodB?.shift ?? 0)) / 12);
  };
  bgm = { name, shift, i: 0, next: ac.currentTime + 0.1, timer: 0 };
  const me = bgm;
  const sched = () => {
    if (bgm !== me) return;
    while (me.next < ac.currentTime + 0.25) {
      const step = stepOf();
      const m = S.mel[me.i % S.mel.length];
      const mute = moodB?.mute;
      if (m >= 0 && !mute) tone(at(m, 1), { type: moodB?.wave ?? S.wave, t: me.next - ac.currentTime, a: 0.01, d: step * 1.6, peak: 0.16, bus: bgmBus });
      if (me.i % 4 === 0 && !mute) tone(at(S.bass[(me.i / 4) % S.bass.length], -1), { type: 'sine', t: me.next - ac.currentTime, a: 0.02, d: step * 3.5, peak: 0.28, bus: bgmBus });
      if (moodB?.beat && !mute && me.i % 2 === 1) tone(me.i % 4 === 3 ? 1800 : 3200, { type: 'square', t: me.next - ac.currentTime, a: 0.001, d: 0.03, peak: 0.05, bus: bgmBus });
      me.next += step;
      me.i += 1;
    }
  };
  sched();
  me.timer = setInterval(sched, 80);
}
export function stopBgm() { if (bgm) { clearInterval(bgm.timer); bgm = null; } pendingBgm = null; }
export function bgmName() { return bgm?.name ?? null; }

// ───────── 心音の繰り返し（踊り場） ─────────
let heartTimer = 0;
export function startHeart(ms = 950) { stopHeart(); SE.heart(); heartTimer = setInterval(() => SE.heart(), ms); }
export function stopHeart() { clearInterval(heartTimer); heartTimer = 0; }

/** 足音（気配の段階ごとに数が増える） */
export function footsteps(n) { for (let i = 0; i < n; i++) setTimeout(() => SE.step(), i * 260); }

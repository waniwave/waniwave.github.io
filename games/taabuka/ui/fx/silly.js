// おふざけ札の演出（show の語彙の追加分）と、場の状態の演出。見た目と音だけで計算には触れない。
import { confetti, sparkle, embers } from './particles.js';
import { SE, buzz, setBgmMood } from '../audio/audio.js';

const R = (a, b) => a + Math.random() * (b - a);
const dur = (X, ms) => X.queue.dur(ms);
function ov(X, cls, text = '') {
  const el = document.createElement('div');
  el.className = `ov silly ${cls}`;
  if (text) el.textContent = text;
  X.layer.append(el);
  return el;
}
function anim(X, el, frames, ms, keep = false) {
  const a = el.animate(frames, { duration: dur(X, ms), easing: 'ease-out', fill: 'both' });
  if (!keep) a.onfinish = () => el.remove();
  return a;
}
/** 画面の要素に一時的な class を付ける */
function flash(X, sel, cls, ms) {
  const els = [...X.root.querySelectorAll(sel)];
  els.forEach((e) => e.classList.add(cls));
  X.queue.later(() => els.forEach((e) => e.classList.remove(cls)), ms);
  return els;
}
const mid = (X) => ({ x: X.layer.clientWidth / 2, y: X.layer.clientHeight * 0.45 });

export const SILLY_SHOWS = [
  { name: 'ノリノリ', text: '画面じゅうがノリノリで跳ねる', args: null },
  { name: '演歌', text: 'こぶしの効いた波と紙吹雪（演歌調）', args: null },
  { name: '女将のツッコミ', text: '女将が画面の端から突っ込む（台詞）', args: 'string' },
  { name: '敵が照れる', text: '論客が赤くなって照れる', args: null },
  { name: '札が回転', text: '手札が全部くるっと回る', args: null },
  { name: 'スポットライト', text: '真ん中にスポットライト', args: null },
  { name: '擬音', text: '大きな擬音（ドドド等）', args: 'string' },
  { name: '拍手', text: '客席から拍手', args: null },
  { name: 'ミラーボール', text: 'ミラーボールが回る', args: null },
  { name: '花火', text: '花火が上がる', args: null },
  { name: '桜吹雪', text: '桜が舞う', args: null },
  { name: 'ため息', text: '画面がどんよりする', args: null },
  { name: '白黒', text: '画面が白黒になる', args: null },
  { name: '早送り', text: '早送りの線が走る', args: null },
  { name: 'ズーム', text: '画面がぐっと寄る', args: null },
  { name: '縦書き', text: '文字が縦書きで降りてくる', args: 'string' },
  { name: '猫', text: '猫が画面を横切る', args: null },
  { name: 'UFO', text: 'UFOが通り過ぎる', args: null },
];

/** 画面側の再生（shows.js の SHOWS に混ぜる）。返り値は時間（ミリ秒） */
export const SILLY = {
  ノリノリ: (X) => {
    const els = flash(X, 'section.hand .card, section.foes .foe, section.banzuke', 'bop', 1400);
    els.forEach((e, i) => { e.style.animationDelay = `${(i % 4) * 90}ms`; });
    const p = mid(X); sparkle(p.x, p.y, 40);
    SE.fanfare(); return 1200;
  },
  演歌: (X) => {
    const el = ov(X, 'enka');
    anim(X, el, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], 1600);
    confetti(30, ['#7a3a6a', '#d6a425', '#f4b8c0']);
    SE.taiko(); return 1500;
  },
  女将のツッコミ: (X, a) => {
    const el = ov(X, 'okami');
    const b = document.createElement('b'); b.textContent = a || 'なんでやねん';
    el.append(document.createElement('i'), b);
    anim(X, el, [{ transform: 'translateX(-110%)' }, { transform: 'translateX(0)', offset: 0.15 }, { transform: 'translateX(0)', offset: 0.85 }, { transform: 'translateX(-110%)' }], 1400);
    SE.slash(); buzz(30); return 1300;
  },
  敵が照れる: (X) => { flash(X, 'section.foes .foe', 'blush', 1400); SE.ping?.(); return 900; },
  札が回転: (X) => { flash(X, 'section.hand .card', 'spin', 900); return 800; },
  スポットライト: (X) => { const el = ov(X, 'spot'); anim(X, el, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], 1400); return 1200; },
  擬音: (X, a) => {
    const t = a || 'ドドドドド';
    for (let i = 0; i < 3; i++) {
      const el = ov(X, 'gion', t);
      el.style.left = `${R(5, 55)}%`; el.style.top = `${R(10, 70)}%`; el.style.transform = `rotate(${R(-14, 14)}deg)`;
      anim(X, el, [{ opacity: 0, scale: 2 }, { opacity: 1, scale: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], 1100 + i * 120);
    }
    SE.boom(); return 1000;
  },
  拍手: (X) => { const el = ov(X, 'clap', '👏 パチパチパチ 👏'); anim(X, el, [{ opacity: 0, transform: 'translate(-50%, 20px)' }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], 1200); for (let i = 0; i < 6; i++) X.queue.later(() => SE.tick?.(), i * 90); return 1000; },
  ミラーボール: (X) => { const el = ov(X, 'mirror'); anim(X, el, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], 1800); return 1500; },
  花火: (X) => {
    const W = X.layer.clientWidth, H = X.layer.clientHeight;
    for (let i = 0; i < 4; i++) X.queue.later(() => { sparkle(R(W * 0.2, W * 0.8), R(H * 0.15, H * 0.45), 50); SE.boom(); }, i * 260);
    return 1300;
  },
  桜吹雪: () => { confetti(80, ['#f8c8d4', '#f4b0c0', '#fff0f4']); return 900; },
  ため息: (X) => { const el = ov(X, 'gloom', 'はぁ…'); anim(X, el, [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], 1500); return 1200; },
  白黒: (X) => { X.root.classList.add('mono'); X.queue.later(() => X.root.classList.remove('mono'), 1500); return 600; },
  早送り: (X) => { const el = ov(X, 'ff', '▶▶'); anim(X, el, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], 900); return 700; },
  ズーム: (X) => { X.root.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.3 }, { transform: 'scale(1)' }], { duration: dur(X, 700) }); return 600; },
  縦書き: (X, a) => { const el = ov(X, 'tate', a || '縦書き'); anim(X, el, [{ opacity: 0, transform: 'translate(-50%, -80%)' }, { opacity: 1, transform: 'translate(-50%, -50%)', offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], 1400); return 1200; },
  猫: (X) => { const el = ov(X, 'cross', '🐈'); anim(X, el, [{ transform: 'translateX(-20vw)' }, { transform: 'translateX(120vw)' }], 1800); return 900; },
  UFO: (X) => { const el = ov(X, 'cross ufo', '🛸'); anim(X, el, [{ transform: 'translate(-20vw, 0)' }, { transform: 'translate(50vw, -30px)', offset: 0.5 }, { transform: 'translate(120vw, 10px)' }], 1600); return 900; },
};

/** 場の状態が変わった（id が null なら元に戻った） */
export function playMood(X, id, def) {
  setBgmMood(id ? def?.bgm : null);
  X.root.dataset.mood = id || '';
  if (!id) { X.queue.pop?.('場の状態が戻った', X.root.querySelector('section.calc'), null, 'note'); return 300; }
  if (X.queue.skipping) return 0;
  const el = ov(X, 'moodban');
  el.style.setProperty('--mc', def?.color || '#b8432c');
  const b = document.createElement('b'); b.textContent = id;
  const s = document.createElement('span'); s.textContent = def?.text ?? '';
  el.append(b, s);
  anim(X, el, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(1.6)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], 1300);
  if (id === 'ノリノリ' || id === 'お祭り' || id === '大団円') confetti(40);
  if (id === '修羅場') { const p = mid(X); embers(p.x, p.y, 40, 300); }
  SE.fanfare?.();
  return 1100;
}

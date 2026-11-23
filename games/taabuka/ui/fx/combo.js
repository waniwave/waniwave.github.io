// 呪文（出した札の短い名前をつないだ掛け声）と、コンボの演出。見た目と音だけで計算には触れない。
// コンボの種類ごとの演出は content/combos.yaml の fx（無ければ共通）。色は color。
import { confetti, embers, sparkle } from './particles.js';
import { SE, buzz } from '../audio/audio.js';

function ov(X, cls, style = {}) {
  const el = document.createElement('div');
  el.className = `ov ${cls}`;
  Object.assign(el.style, style);
  X.layer.append(el);
  return el;
}
function run(X, el, frames, ms) {
  if (X.queue.skipping) { el.remove(); return; }
  const a = el.animate(frames, { duration: X.queue.dur(ms), easing: 'ease-out', fill: 'both' });
  a.onfinish = () => el.remove();
}
/** 幅に収まる文字の大きさ（呪文は長くなる） */
function fitSize(text, w, max, min = 22) {
  const n = Math.max(1, [...text].length);
  return Math.max(min, Math.min(max, Math.floor((w * 0.92) / n)));
}
const center = (X) => { const r = X.layer.getBoundingClientRect(); return { x: r.width / 2, y: r.height * 0.42, w: r.width }; };

/** 呪文：画面いっぱいにデカデカと（ター宿のほとりの称号のように） */
export function playSpell(X, text, hasCombo = false) {
  if (!text) return 0;
  const c = center(X);
  const size = fitSize(text, c.w, hasCombo ? 96 : 72);
  const el = ov(X, `spell${hasCombo ? ' big' : ''}`, { fontSize: `${size}px` });
  el.textContent = text;
  const ms = hasCombo ? 1100 : 800;
  run(X, el, [
    { opacity: 0, transform: 'translate(-50%,-50%) scale(2.2) rotate(-4deg)', filter: 'blur(8px)' },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(-2deg)', filter: 'blur(0)', offset: 0.16 },
    { opacity: 1, transform: 'translate(-50%,-50%) scale(1.04) rotate(-2deg)', offset: 0.8 },
    { opacity: 0, transform: 'translate(-50%,-60%) scale(1.1) rotate(-2deg)' },
  ], ms);
  if (!X.queue.skipping) { SE.taiko(); if (hasCombo) buzz(30); }
  return ms;
}

/** 種類ごとの飾り（色・粒・文字） */
const FX = {
  curry: (X, c) => { confetti(40, ['#d9a01c', '#e8c25a', '#8a4a1a', '#f3e3b0']); return { sub: '黄金色に煮えた', deco: '🍛' }; },
  eooe: (X, c) => { const p = center(X); sparkle(p.x, p.y, 70); return { sub: 'E O O E', zoom: true }; },
  ham: () => { confetti(36, ['#e07a8a', '#f4b8c0', '#fff']); return { sub: '薄切りが重なる' }; },
  speed: () => ({ sub: '速すぎて見えない', streak: true }),
  tree: () => { confetti(40, ['#3f8a3a', '#6ab04c', '#a3d16a', '#8a6a3a']); return { sub: 'ざわ…ざわ…' }; },
  podium: () => { confetti(70); return { sub: '表彰台' }; },
  fgc: () => ({ sub: 'K.O.', streak: true }),
  meal: (X) => { const p = center(X); embers(p.x, p.y + 40, 30, 200); return { sub: 'いただきます' }; },
  ramen: (X) => { const p = center(X); embers(p.x, p.y + 40, 30, 220); return { sub: '一杯入魂' }; },
  bath: () => { confetti(30, ['#bfe0f0', '#ffffff', '#8ac0e0']); return { sub: 'いい湯だな' }; },
  inn: () => ({ sub: 'ようこそ' }),
  net: () => ({ sub: '＞＞1' }),
  movie: () => ({ sub: '― FIN ―' }),
  ikea: () => { confetti(30, ['#2a5fb0', '#ffd23f']); return { sub: '完成' }; },
  school: () => ({ sub: 'きりーつ' }),
  animal: () => { confetti(30, ['#e0a040', '#c8702a', '#fff']); return { sub: 'もふもふ' }; },
};

/** コンボのカットイン（名前と効果） */
export function playCombo(X, src, effText = '') {
  const deco = (FX[src.fx] || (() => ({})))(X, src) || {};
  const el = ov(X, `combo${deco.streak ? ' streak' : ''}`, { '--cc': src.color || '#b8432c' });
  const nm = document.createElement('b'); nm.textContent = `${src.name}！`;
  const sub = document.createElement('span'); sub.textContent = [deco.sub, effText].filter(Boolean).join('　');
  el.append(nm, sub);
  const ms = 1300;
  run(X, el, [
    { opacity: 0, transform: 'translateY(-50%) scaleY(0)' },
    { opacity: 1, transform: 'translateY(-50%) scaleY(1)', offset: 0.1 },
    { opacity: 1, transform: 'translateY(-50%) scaleY(1)', offset: 0.85 },
    { opacity: 0, transform: 'translateY(-50%) scaleY(0)' },
  ], ms);
  if (!X.queue.skipping) {
    nm.animate(deco.zoom
      ? [{ transform: 'scale(3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.2 }, { transform: 'scale(1.08)', offset: 0.6 }, { transform: 'scale(1)' }]
      : [{ transform: 'translateX(110%)' }, { transform: 'translateX(0)', offset: 0.18 }, { transform: 'translateX(-4%)', offset: 0.85 }, { transform: 'translateX(-110%)' }], { duration: X.queue.dur(ms), fill: 'both' });
    SE.fanfare(); buzz(40);
  }
  return ms;
}

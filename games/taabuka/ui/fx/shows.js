import { SILLY } from './silly.js';
import { fitText } from '../dom.js';
// 組み込みの演出部品（仕様書 第9章 語彙 show の全て）と、演出の段階・桁越え・数字の回転。
// どれも見た目と音だけで、計算には触れない。設定の「演出の強さ」「画面揺れ」「点滅の軽減」に従う。
// 部品は playShow(name, arg, X) で呼び、かかる時間（ms、速さ×1のとき）を返す。
//   X = { queue, root: 画面の要素, layer: 演出の層, cards?: 札の要素, foes?: 敵の要素 }

import { whiteOut, mayGlow, noFlash } from './flash.js';
import { confetti, embers, shards, sparkle } from './particles.js';
import { SE, playSE, stopBgm, silence, buzz } from '../audio/audio.js';
import { unitColor } from '../num.js';

let opt = { fx: '標準', shake: true };
export function setShowOptions(o) { opt = { ...opt, ...o }; }
const level = () => ({ 控えめ: 0, 標準: 1, 激しい: 2 }[opt.fx] ?? 1);
const amp = (n) => n * [0.5, 1, 1.6][level()];
const dur = (X, ms) => X.queue.dur(ms);
const R = (a, b) => a + Math.random() * (b - a);   // 見た目の揺らぎだけ

function overlay(X, cls, style = {}) {
  const el = document.createElement('div');
  el.className = `ov ${cls}`;
  Object.assign(el.style, style);
  X.layer.append(el);
  return el;
}
function fade(X, el, frames, ms, opt2 = {}) {
  if (X.queue.skipping) { el.remove(); return; }
  const a = el.animate(frames, { duration: dur(X, ms), easing: 'ease-out', fill: 'both', ...opt2 });
  a.onfinish = () => el.remove();
  return a;
}
function textOv(X, cls, text, frames, ms, style = {}) {
  const el = overlay(X, cls, style);
  el.textContent = text;
  fade(X, el, frames, ms);
  return el;
}
const leafTexts = (root) => [...root.querySelectorAll('b, span, .nm, h2, p, .v')].filter((e) => e.childElementCount === 0 && e.textContent.trim()).slice(0, 60);
const MOJI = '縺ｱ繧鐃譁蟄怜喧縺代嶌縺阪°繧ｿ繝ｼ豺ｱ';

/** 揺れ（画面揺れの設定がオフなら揺らさない） */
export function shake(X, px) { if (opt.shake) X.queue.shake(X.root, amp(px), 320); }

export const SHOWS = {
  揺れ: (X, a) => { shake(X, a === '大' ? 12 : a === '中' ? 7 : 3); if (a === '大') buzz(60); return 320; },
  白飛び: (X) => { whiteOut(X.layer, dur(X, 420)); return 420; },
  暗転: (X) => { fade(X, overlay(X, 'dark'), [{ opacity: 0 }, { opacity: 0.92, offset: 0.3 }, { opacity: 0.92, offset: 0.7 }, { opacity: 0 }], 900); return 900; },
  二重像: (X) => {
    if (X.queue.skipping) return 0;
    const k = amp(6);
    X.root.animate([{ filter: 'none' }, { filter: `drop-shadow(${k}px 0 0 rgba(200,40,40,.55)) drop-shadow(${-k}px 0 0 rgba(40,90,200,.55))` }, { filter: 'none' }], { duration: dur(X, 700) });
    return 700;
  },
  文字二回: (X) => { X.queue.double = true; return 0; },
  筆文字: (X, a) => { textOv(X, 'fude', a ?? '', [{ opacity: 0, transform: 'translate(-50%,-50%) scale(1.6) rotate(-6deg)', filter: 'blur(6px)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(-3deg)', filter: 'blur(0)', offset: 0.18 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], 1100); SE.taiko(); return 1100; },
  カットイン: (X, a) => {
    const el = overlay(X, 'cutin');
    el.append(Object.assign(document.createElement('span'), { textContent: a ?? '' }));
    fade(X, el, [{ transform: 'translateY(-50%) scaleY(0)' }, { transform: 'translateY(-50%) scaleY(1)', offset: 0.12 }, { transform: 'translateY(-50%) scaleY(1)', offset: 0.85 }, { transform: 'translateY(-50%) scaleY(0)' }], 1000);
    if (!X.queue.skipping) el.firstChild.animate([{ transform: 'translateX(120%)' }, { transform: 'translateX(0)', offset: 0.2 }, { transform: 'translateX(-6%)', offset: 0.85 }, { transform: 'translateX(-120%)' }], { duration: dur(X, 1000), fill: 'both' });
    SE.slash();
    return 1000;
  },
  吹き出し: (X, a) => { textOv(X, 'bubble', a ?? '', [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.3)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.05)', offset: 0.15 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.85 }, { opacity: 0 }], 1000); return 1000; },
  スタンプ: (X, a) => { stamp(X, a ?? '印'); return 700; },
  文字化け: (X) => swapTexts(X, (t) => [...t].map(() => MOJI[Math.floor(R(0, MOJI.length))]).join(''), 800),
  伏せ字: (X) => swapTexts(X, (t) => [...t].map((c, i) => (i % 2 ? '○' : c)).join(''), 800),
  取り消し線: (X) => {
    const el = overlay(X, 'strike');
    for (let i = 0; i < 7; i++) { const l = document.createElement('i'); l.style.top = `${8 + i * 13}%`; l.style.transform = `rotate(${R(-8, 8)}deg)`; el.append(l); }
    fade(X, el, [{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)', offset: 0.3 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], 900);
    SE.slash();
    return 900;
  },
  背景色: (X, a) => { fade(X, overlay(X, 'tintc', { background: a || '#c8302a' }), [{ opacity: 0 }, { opacity: 0.35, offset: 0.3 }, { opacity: 0.35, offset: 0.7 }, { opacity: 0 }], 900); return 900; },
  水没: (X) => { fade(X, overlay(X, 'water'), [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)', offset: 0.35 }, { transform: 'translateY(0)', offset: 0.7 }, { transform: 'translateY(100%)' }], 1300); SE.water(); return 1300; },
  紙吹雪: () => { confetti(70); SE.kiran(); return 300; },
  画面反転: (X) => {
    if (X.queue.skipping || level() === 0) return 0;
    X.root.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(180deg)', offset: 0.35 }, { transform: 'rotate(180deg)', offset: 0.65 }, { transform: 'rotate(360deg)' }], { duration: dur(X, 1100), easing: 'ease-in-out' });
    return 1100;
  },
  横切る: (X, a) => {
    const el = overlay(X, `cross cross-${a ?? '串'}`);
    if (a === '札の列') for (let i = 0; i < 7; i++) el.append(Object.assign(document.createElement('i'), { className: 'mc', textContent: '札' }));
    else el.textContent = a === '象' ? '象' : '━●●●━';
    fade(X, el, [{ transform: 'translateX(110%)' }, { transform: 'translateX(-110%)' }], 1000, { easing: 'linear' });
    SE.step();
    return 1000;
  },
  増殖: (X) => {
    const src = X.cards?.[0];
    const n = [6, 14, 24][level()];
    for (let i = 0; i < n; i++) {
      const el = overlay(X, 'mcard');
      el.textContent = src?.querySelector('.nm')?.textContent ?? '札';
      el.style.left = `${R(0, 90)}%`; el.style.top = `${R(0, 90)}%`;
      fade(X, el, [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: `scale(1) rotate(${R(-20, 20)}deg)`, offset: 0.5 }, { opacity: 0, transform: 'scale(1.3)' }], 900, { delay: dur(X, i * 25) });
    }
    return 900;
  },
  行進: (X) => {
    const el = overlay(X, 'march');
    for (let i = 0; i < 8; i++) el.append(Object.assign(document.createElement('i'), { className: 'mc', textContent: '札' }));
    fade(X, el, [{ transform: 'translateX(-100%)' }, { transform: 'translateX(100%)' }], 1400, { easing: 'linear' });
    for (const c of el.children) c.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], { duration: dur(X, 280), iterations: 5 });
    for (let i = 0; i < 5; i++) setTimeout(() => SE.step(), dur(X, i * 280));
    return 1400;
  },
  うなずき: (X) => {
    if (X.queue.skipping) return 0;
    for (const c of X.root.querySelectorAll('.card, .foe')) c.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(8deg) translateY(3px)' }, { transform: 'rotate(0)' }], { duration: dur(X, 360), iterations: 2 });
    return 720;
  },
  角以外を暗く: (X) => { fade(X, overlay(X, 'corners'), [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], 1200); return 1200; },
  斬る: (X) => {
    for (const f of (X.foes || []).slice(0, 3)) {
      if (X.queue.skipping) break;
      f.animate([{ clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)', transform: 'none' }, { clipPath: 'polygon(0 0,100% 0,100% 40%,0 60%)', transform: 'translate(-6px,-6px) rotate(-4deg)', offset: 0.5 }, { clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)', transform: 'none' }], { duration: dur(X, 700) });
      const r = f.getBoundingClientRect();
      shards(r, '#a3322a', 10);
    }
    const el = overlay(X, 'slashline');
    fade(X, el, [{ transform: 'translate(-50%,-50%) rotate(-20deg) scaleX(0)', opacity: 1 }, { transform: 'translate(-50%,-50%) rotate(-20deg) scaleX(1)', opacity: 1, offset: 0.3 }, { opacity: 0, transform: 'translate(-50%,-50%) rotate(-20deg) scaleX(1)' }], 600);
    SE.slash();
    return 700;
  },
  読み込み中: (X) => {
    const el = overlay(X, 'spin');
    const ring = document.createElement('i'); ring.className = 'ring'; el.append(ring);
    fade(X, el, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], 1200);
    if (!X.queue.skipping) ring.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: dur(X, 500), iterations: 3 });
    return 1200;
  },
  早口字幕: (X, a) => {
    const el = overlay(X, 'subs');
    const s = document.createElement('span'); s.textContent = `${a ?? ''}　${a ?? ''}　${a ?? ''}`; el.append(s);
    fade(X, el, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], 1100);
    if (!X.queue.skipping) s.animate([{ transform: 'translateX(100%)' }, { transform: 'translateX(-100%)' }], { duration: dur(X, 1100), easing: 'linear' });
    return 1100;
  },
  ガチャ: (X) => {
    const el = overlay(X, noFlash() ? 'gacha calm' : 'gacha');
    fade(X, el, [{ opacity: 0, transform: 'rotate(0)' }, { opacity: 0.85, offset: 0.2 }, { opacity: 0.85, transform: 'rotate(180deg)', offset: 0.8 }, { opacity: 0, transform: 'rotate(240deg)' }], 1300);
    SE.gacha();
    if (mayGlow()) sparkle(X.layer.clientWidth / 2, X.layer.clientHeight / 2, 50);
    return 1300;
  },
  音: (X, a) => { playSE(a || 'hit'); return 150; },
  BGMを止める: () => { stopBgm(); return 0; },
  心音: () => { SE.heart(); return 600; },
  振動: () => { buzz([60, 40, 60]); return 200; },
};

function swapTexts(X, fn, ms) {
  if (X.queue.skipping) return 0;
  const els = leafTexts(X.root);
  const keep = els.map((e) => e.textContent);
  els.forEach((e) => { e.textContent = fn(e.textContent); });
  const back = () => els.forEach((e, i) => { if (e.isConnected && e.textContent !== keep[i]) e.textContent = keep[i]; });
  X.queue.later(back, ms);
  SE.glitch();
  return ms;
}

/** 演出を名前で再生（知らない名前は何もしない）。かかる時間を返す */
export function playShow(name, arg, X) {
  const f = SHOWS[name];
  if (!f || X.queue.skipping) return 0;
  try { return f(X, arg) ?? 0; } catch (e) { console.error(e); return 0; }
}
Object.assign(SHOWS, SILLY);
export const SHOW_NAMES = Object.keys(SHOWS);

// ───────────────────────── 判子・段階・桁越え ─────────────────────────

/** 判子を押す */
export function stamp(X, text, cls = '') {
  const el = overlay(X, `stamp ${cls}`);
  el.textContent = text;
  fade(X, el, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(2.4) rotate(-14deg)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(-8deg)', offset: 0.18 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], 900);
  SE.stamp();
  return el;
}

/** 出しごとの段階：k＝log10（V ÷ 狙った敵の残り主張） */
export function stageOf(V, claim) {
  if (!claim || claim.isZero?.() || !V) return null;
  const k = V.log10() - claim.log10();
  if (k >= 3) return 'ター深';
  if (k >= 2) return '完全論破';
  if (k >= 1) return '大論破';
  if (k >= 0.3) return '論破';
  if (k >= 0) return '燃える';
  return null;
}

/** 段階の演出。かかる時間を返す（燃えるは計算窓の側でやる） */
export function playStage(stage, X) {
  if (X.queue.skipping || !stage || stage === '燃える') return 0;
  const W = X.layer.clientWidth, H = X.layer.clientHeight;
  switch (stage) {
    case '論破':
      stamp(X, '論破');
      shake(X, 3);
      return 800;
    case '大論破':
      whiteOut(X.layer, dur(X, 380));
      textOv(X, 'stagebig', '大論破', [{ opacity: 0, transform: 'translate(-50%,-50%) scale(1.8)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], 1000);
      shake(X, 7); buzz(80); SE.boom();
      if (mayGlow()) embers(W / 2, H * 0.55, 30, W * 0.8);
      return 1000;
    case '完全論破': {
      silence(300);
      const cr = overlay(X, 'crack');
      cr.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M50 0 L46 22 L58 30 L44 48 L60 62 L40 80 L52 100" /><path d="M46 22 L20 18 L4 30" /><path d="M44 48 L18 56 L0 52" /><path d="M60 62 L84 58 L100 70" /><path d="M58 30 L80 20 L100 24" /></svg><b>角</b>';
      fade(X, cr, [{ opacity: 0 }, { opacity: 0, offset: 0.2 }, { opacity: 1, offset: 0.24 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], 1500);
      X.queue.later(() => { SE.boom(); SE.crack(); shake(X, 12); buzz([80, 40, 120]); if (mayGlow()) embers(W / 2, H * 0.6, 50, W); }, 300);
      textOv(X, 'stagebig kanzen', '完全論破', [{ opacity: 0 }, { opacity: 0, offset: 0.2 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)', offset: 0.26 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.85 }, { opacity: 0 }], 1500);
      return 1500;
    }
    case 'ター深': {
      const el = overlay(X, 'taabuka');
      el.innerHTML = '<div class="band"></div><b>ター深</b>';
      fade(X, el, [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], 2000);
      if (!X.queue.skipping) el.querySelector('b').animate([{ transform: 'scale(3)', letterSpacing: '1em', opacity: 0 }, { transform: 'scale(1)', letterSpacing: '.2em', opacity: 1, offset: 0.3 }, { transform: 'scale(1.05)', offset: 1 }], { duration: dur(X, 2000), fill: 'both' });
      silence(250);
      X.queue.later(() => { SE.taiko(); SE.boom(); SE.god(); shake(X, 10); buzz([100, 50, 100, 50, 200]); if (mayGlow()) sparkle(W / 2, H / 2, 80); confetti(80, ['#d6a425', '#ffd76a', '#fff4c2', '#b8432c']); }, 250);
      [0, 380, 760].forEach((t) => X.queue.later(() => SE.taiko(), 400 + t));
      return 2000;
    }
    default: return 0;
  }
}

/** 桁越え：単位の漢字を画面いっぱいに印し、図鑑に刻む */
export function playKetagoe(X, unit, colorOf) {
  if (X.queue.skipping || !unit) return 0;
  const el = overlay(X, 'ketagoe');
  el.innerHTML = '<b></b><small>桁越え　図鑑に刻んだ</small>';
  const b = el.querySelector('b');
  b.textContent = unit.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, '');
  b.style.fontSize = b.textContent.length > 2 ? `${Math.min(46, 140 / b.textContent.length)}vmin` : '';
  b.style.color = colorOf ?? '#b8432c';
  fade(X, el, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.88 }, { opacity: 0 }], 1800);
  if (!X.queue.skipping) b.animate([{ transform: 'scale(2.2) rotate(-8deg)', opacity: 0 }, { transform: 'scale(1) rotate(-3deg)', opacity: 1, offset: 0.16 }, { transform: 'scale(1.02) rotate(-3deg)' }], { duration: dur(X, 1800), fill: 'both' });
  X.queue.later(() => { SE.stamp(); SE.taiko(); shake(X, 6); buzz(60); }, 260);
  return 1800;
}

/**
 * 数字が桁ごとに回転して止まる（文字を1つずつ縦に回してから止める）
 * @param {HTMLElement} el 入れ物（中身を置き換える） @param {string} text @param {object} queue
 */
export function rollNumber(el, text, queue, color) {
  el.replaceChildren();
  if (color) el.style.color = color;
  const chars = [...text];
  const spin = '0123456789';
  chars.forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'rd';
    s.textContent = ch;
    el.append(s);
    if (queue.skipping || level() === 0) return;
    const isDigit = /[0-9]/.test(ch);
    const frames = isDigit
      ? [{ transform: 'translateY(-60%)', opacity: 0.2 }, { transform: 'translateY(40%)', opacity: 0.6, offset: 0.5 }, { transform: 'translateY(-15%)', opacity: 1, offset: 0.85 }, { transform: 'translateY(0)', opacity: 1 }]
      : [{ transform: 'scale(1.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }];
    s.animate(frames, { duration: queue.dur(260 + i * 45), easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
    if (isDigit && i % 2 === 0) { s.dataset.spin = spin; }
  });
  fitText(el);
}

/** 宝箱が格の数だけ揺れる（並1・上2・特上3・極4・神5） */
export async function shakeChest(X, el, times) {
  for (let i = 0; i < times && !X.queue.skipping; i++) {
    SE.chest();
    el.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-9deg) translateY(-3px)' }, { transform: 'rotate(8deg)' }, { transform: 'rotate(0)' }], { duration: dur(X, 260) });
    await X.queue.wait(380);
  }
}

/** 神格：暗転→金の光→札が回転しながら降りてくる */
export function godDescent(X, name) {
  const el = overlay(X, 'god');
  el.innerHTML = '<div class="halo"></div><div class="gcard"><b></b><small>神</small></div>';
  el.querySelector('b').textContent = name;
  fade(X, el, [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], 2200);
  if (!X.queue.skipping) {
    el.querySelector('.gcard').animate([{ transform: 'translate(-50%,-260%) rotateY(0) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-150%) rotateY(540deg) scale(.8)', opacity: 1, offset: 0.45 }, { transform: 'translate(-50%,-50%) rotateY(720deg) scale(1)', opacity: 1 }], { duration: dur(X, 1500), delay: dur(X, 400), fill: 'both', easing: 'cubic-bezier(.2,.8,.3,1)' });
    if (mayGlow()) el.querySelector('.halo').animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.2)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: dur(X, 900), delay: dur(X, 300), fill: 'both' });
  }
  SE.god();
  X.queue.later(() => sparkle(X.layer.clientWidth / 2, X.layer.clientHeight / 2, 60), 1600);
  return 2200;
}

export { unitColor };

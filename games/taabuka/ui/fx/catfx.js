// カテゴリごと・効果の種類ごとの小さな演出（DOM の文字を飛ばす。見た目だけで計算には触れない）
// 量は設定の「演出」（控えめ・標準・激しい）で変わる：setCatFxScale
import { catColor } from '../labels.js';

let scale = 1;
export function setCatFxScale(s) { scale = s; }

// カテゴリ → [文字, 動き]
// 動き：rise 立ちのぼる／burst 弾ける／fall 舞い落ちる／dash 横に走る／spin 回る／pop 跳ねる／drip 垂れる／wave 波打つ
const CAT = {
  ター: ['★', 'burst'], 宿: ['🏮', 'pop'], 麺: ['〰', 'wave'], 食べ物: ['🍙', 'pop'], 湯: ['♨', 'rise'],
  動物: ['🐾', 'pop'], 校庭: ['✎', 'fall'], 老: ['🍂', 'fall'], 死: ['☠', 'drip'], 速さ: ['≫', 'dash'],
  格ゲー: ['HIT', 'burst'], ロボ: ['⚙', 'spin'], スレ: ['ｗ', 'rise'],
};
// 効果の種類 → [文字, 動き, 色]
const TYPE = {
  S: ['▲', 'rise', '#2f6fb8'], M: ['✚', 'burst', '#c8302a'], x: ['✖', 'ring', '#d6a425'],
  guard: ['◆', 'ring', '#3a6aa8'], heal: ['＋', 'rise', '#3f8a3a'], hurt: ['✕', 'drip', '#b0201a'],
  up: ['⇧', 'rise', '#d6a425'], down: ['⇩', 'fall', '#5a4a8a'], yield: ['！', 'pop', '#5a7a9a'], draw: ['▭', 'dash', '#6a6258'],
};

function at(X, el) {
  const L = X.layer.getBoundingClientRect();
  const r = (el?.getBoundingClientRect?.() ?? L);
  return { x: r.left - L.left + r.width / 2, y: r.top - L.top + r.height / 2, w: r.width, h: r.height };
}
const R = (a, b) => a + Math.random() * (b - a);

function frames(kind, i, n) {
  const a = (i / n) * Math.PI * 2 + R(-0.3, 0.3);
  switch (kind) {
    case 'rise': { const dx = R(-30, 30); return [{ transform: `translate(${dx * 0.2}px,0) scale(.6)`, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translate(${dx}px,${R(-90, -50)}px) scale(1.1)`, opacity: 0 }]; }
    case 'burst': { const d = R(40, 80); return [{ transform: 'translate(0,0) scale(.4)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) scale(1.2)`, opacity: 0 }]; }
    case 'fall': { const dx = R(-50, 50); return [{ transform: `translate(${dx}px,-40px) rotate(0)`, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translate(${dx + R(-20, 20)}px,50px) rotate(${R(-180, 180)}deg)`, opacity: 0 }]; }
    case 'dash': { const y = R(-25, 25); return [{ transform: `translate(-70px,${y}px)`, opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: `translate(80px,${y}px)`, opacity: 0 }]; }
    case 'spin': { const d = R(30, 60); return [{ transform: 'translate(0,0) rotate(0) scale(.5)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px) rotate(${R(180, 540)}deg) scale(1)`, opacity: 0 }]; }
    case 'pop': { const dx = R(-45, 45); return [{ transform: 'translate(0,0) scale(.3)', opacity: 0 }, { transform: `translate(${dx * 0.6}px,-45px) scale(1.2)`, opacity: 1, offset: 0.45 }, { transform: `translate(${dx}px,10px) scale(.9)`, opacity: 0 }]; }
    case 'drip': { const dx = R(-30, 30); return [{ transform: `translate(${dx}px,-10px) scale(1)`, opacity: 0.9 }, { transform: `translate(${dx}px,60px) scale(.7) scaleY(1.6)`, opacity: 0 }]; }
    case 'wave': { const y0 = R(-20, 20); return [{ transform: `translate(-50px,${y0}px)`, opacity: 0 }, { transform: `translate(-15px,${y0 - 12}px)`, opacity: 1, offset: 0.3 }, { transform: `translate(20px,${y0 + 12}px)`, offset: 0.65 }, { transform: `translate(55px,${y0}px)`, opacity: 0 }]; }
    default: return [{ opacity: 1 }, { opacity: 0 }];
  }
}

function spawn(X, el, glyph, kind, color, n, ms, size = 18) {
  if (X.queue?.skipping || !X.layer || scale <= 0) return;
  const p = at(X, el);
  const count = Math.max(1, Math.round(n * scale));
  if (kind === 'ring') {
    const d = document.createElement('div');
    d.className = 'ov cfx-ring';
    Object.assign(d.style, { left: `${p.x}px`, top: `${p.y}px`, borderColor: color });
    X.layer.append(d);
    const a = d.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(2.2)', opacity: 0 }], { duration: X.queue.dur(ms), easing: 'ease-out' });
    a.onfinish = () => d.remove();
    kind = 'burst';
  }
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'ov cfx';
    s.textContent = glyph;
    Object.assign(s.style, { left: `${p.x + R(-p.w / 4, p.w / 4)}px`, top: `${p.y + R(-p.h / 4, p.h / 4)}px`, color, fontSize: `${size * R(0.8, 1.25)}px` });
    X.layer.append(s);
    const a = s.animate(frames(kind, i, count), { duration: X.queue.dur(ms * R(0.8, 1.2)), easing: 'ease-out', delay: X.queue.dur(R(0, 120)), fill: 'both' });
    a.onfinish = () => s.remove();
  }
}

/** 札のカテゴリの演出（採点された札から） */
export function catBurst(X, el, cats) {
  (cats || []).slice(0, 2).forEach((c, k) => {
    const d = CAT[c]; if (!d) return;
    spawn(X, el, d[0], d[1], catColor(c), k ? 3 : 5, 700, c === '格ゲー' ? 14 : 18);
  });
}
/** 効果の種類の演出 */
export function typeFx(X, el, type, n = 4) {
  const d = TYPE[type]; if (!d) return;
  spawn(X, el, d[0], d[1], d[2], n, 650);
}

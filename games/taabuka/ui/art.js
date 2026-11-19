// 札・敵の絵：IDとカテゴリから幾何模様を自動で描くSVG（画像素材を持たない）
// 同じIDなら毎回同じ絵。乱数は使わずIDのハッシュから決める。

import { hash128 } from '../engine/rng.js';
import { catColor } from './labels.js';

const cache = new Map();

function params(id) {
  const [a, b, c, d] = hash128(String(id));
  return { a, b, c, d, f: (n, k) => ((n >>> (k * 4)) & 15) / 15 };
}

/**
 * 札の絵（背景の模様だけ。文字は HTML で上に重ねる）
 * @param {{id:string, cat:string[]}} card
 */
export function cardArt(card) {
  const key = `c|${card.id}|${card.cat.join(',')}`;
  if (cache.has(key)) return cache.get(key);
  const p = params(card.id);
  const c1 = catColor(card.cat[0]);
  const c2 = catColor(card.cat[1] ?? card.cat[0]);
  const kind = p.a % 5;
  const rot = Math.round(p.f(p.b, 0) * 180);
  const shapes = [];
  const W = 60, H = 70;
  switch (kind) {
    case 0: // 同心円
      for (let i = 4; i >= 1; i--) shapes.push(`<circle cx="${18 + p.f(p.c, 1) * 24}" cy="${24 + p.f(p.c, 2) * 20}" r="${i * 7}" fill="${i % 2 ? c1 : c2}" opacity="${0.18 + i * 0.05}"/>`);
      break;
    case 1: // 縞
      for (let i = -4; i < 8; i++) shapes.push(`<rect x="${i * 9}" y="-20" width="4" height="120" fill="${i % 2 ? c1 : c2}" opacity=".35" transform="rotate(${rot} 30 35)"/>`);
      break;
    case 2: // 三角の並び
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const cx = 6 + x * 16 + (y % 2) * 8, cy = 8 + y * 16;
        shapes.push(`<path d="M${cx} ${cy - 6}L${cx + 7} ${cy + 6}L${cx - 7} ${cy + 6}Z" fill="${(x + y) % 2 ? c1 : c2}" opacity=".32"/>`);
      }
      break;
    case 3: // 点
      for (let i = 0; i < 9; i++) {
        const cx = 6 + ((p.d >>> (i * 3)) % 48), cy = 8 + ((p.c >>> (i * 3)) % 46);
        shapes.push(`<circle cx="${cx}" cy="${cy}" r="${3 + (i % 3) * 3}" fill="${i % 2 ? c1 : c2}" opacity=".35"/>`);
      }
      break;
    default: // 放射
      for (let i = 0; i < 12; i++) shapes.push(`<path d="M30 32L${30 + 60 * Math.cos((i * 30 + rot) * Math.PI / 180)} ${32 + 60 * Math.sin((i * 30 + rot) * Math.PI / 180)}L${30 + 60 * Math.cos((i * 30 + rot + 12) * Math.PI / 180)} ${32 + 60 * Math.sin((i * 30 + rot + 12) * Math.PI / 180)}Z" fill="${i % 2 ? c1 : c2}" opacity=".28"/>`);
  }
  // 中央の紋（Tierに関係なくIDで形が決まる）
  const n = 3 + (p.b % 5);
  const R = 9 + p.f(p.d, 3) * 6;
  const pts = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2 + rot * Math.PI / 180;
    return `${(30 + R * Math.cos(t)).toFixed(1)},${(32 + R * Math.sin(t)).toFixed(1)}`;
  }).join(' ');
  shapes.push(`<polygon points="${pts}" fill="none" stroke="${c1}" stroke-width="2" opacity=".8"/>`);
  const svg = `<svg class="art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="${W}" height="${H}" fill="#fbf7ee"/>${shapes.join('')}</svg>`;
  cache.set(key, svg);
  return svg;
}

const KIND_COLOR = { 通常: '#2a2520', 精鋭: '#2f5d7c', 層主: '#b8432c', 追跡者: '#6a2a6a', 番人: '#4a4a3a', 底の主: '#000' };

/** 敵の絵（図形＋名前の紋） */
export function enemyArt(e) {
  const key = `e|${e.id}|${e.kind}`;
  if (cache.has(key)) return cache.get(key);
  const p = params(e.id);
  const col = KIND_COLOR[e.kind] ?? '#2a2520';
  const n = 3 + (p.a % 6);
  const rot = (p.b % 360) * Math.PI / 180;
  const poly = (r, k = 0) => Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2 + rot + k;
    return `${(50 + r * Math.cos(t)).toFixed(1)},${(50 + r * Math.sin(t)).toFixed(1)}`;
  }).join(' ');
  const inner = p.c % 3;
  const parts = [
    `<polygon points="${poly(44)}" fill="${col}" fill-opacity=".08" stroke="${col}" stroke-width="3"/>`,
    inner === 0 ? `<polygon points="${poly(24, Math.PI / n)}" fill="${col}" fill-opacity=".85"/>`
      : inner === 1 ? `<circle cx="50" cy="50" r="${12 + (p.d % 10)}" fill="${col}" fill-opacity=".85"/>`
        : `<polygon points="${poly(26)}" fill="none" stroke="${col}" stroke-width="6"/>`,
    // 目
    `<circle cx="${42 + (p.d % 4)}" cy="46" r="3.5" fill="#efe6d2"/><circle cx="${58 - (p.c % 4)}" cy="46" r="3.5" fill="#efe6d2"/>`,
  ];
  const svg = `<svg viewBox="0 0 100 100" aria-hidden="true">${parts.join('')}</svg>`;
  cache.set(key, svg);
  return svg;
}

/** 常連客・置物の小さな絵 */
export function smallArt(id) {
  return cardArt({ id, cat: ['宿', 'ター'] });
}

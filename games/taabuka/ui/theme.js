// 穴と深さの見た目（潜行と戦闘の画面の root に data-dg・data-depth・data-soko・data-boss を付ける。色は style.css）
// depth：0〜5（深いほど暗く、染みとひびが増え、縁に赤み）。soko：底（色が抜ける）。boss：層主の階（縁が脈打つ）
import { layerAt, isBossFloor } from '../engine/dive.js';
import { layerNoAt } from '../engine/battle.js';

export function themeOf(content, dg, floor) {
  const d = dg || 'honko';
  const L = layerAt(content, floor, d);
  const soko = !!L?.curses?.length;
  const no = layerNoAt(content, floor, d);
  const depth = soko ? 5 : d === 'honko' ? Math.min(4, no - 1) : [0, 2, 3][no - 1] ?? 3;
  return { dg: d, depth, soko, boss: !soko && isBossFloor(content, floor, d) };
}

export function applyTheme(root, content, dg, floor, extra = {}) {
  const t = themeOf(content, dg, floor);
  root.dataset.dg = t.dg;
  root.dataset.depth = String(t.depth);
  root.toggleAttribute('data-soko', t.soko);
  root.toggleAttribute('data-boss', extra.boss ?? t.boss);
  return t;
}

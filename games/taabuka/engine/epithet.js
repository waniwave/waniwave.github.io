// 二つ名（content/epithets.yaml）。潜行の戦いで論客の名前の前に付き、強さ・行動・降参の決まりを変える
import { Rng } from './rng.js';

/** 潜行の戦いの敵の列に二つ名を付ける（決まった乱数。D は変えない） */
export function withEpithets(base, D, bt) {
  const E = base.content.epithets;
  if (!E?.list?.length || bt.chase || bt.kind === '番人') return bt.enemies;
  const ch = E.chance || {};
  const p = Math.min(ch.max ?? 0.5, (ch.base ?? 0.1) + (ch.perFloor ?? 0) * (D.floor || 1) + (D.depth ? 0.1 : 0));
  return bt.enemies.map((x, i) => {
    const id = typeof x === 'string' ? x : x.id;
    const def = base.content.enemies[id];
    if (!def || !(E.kinds || ['通常']).includes(def.kind || '通常') || def.noEpithet) return x;
    const r = Rng.child(D.seed ?? 0, 'epithet', D.floor ?? 1, bt.room ?? 0, i);
    if (!r.chance(p)) return x;
    return { ...(typeof x === 'string' ? { id } : x), epithet: r.pick(E.list).id };
  });
}

/** 敵の定義に二つ名を重ねる（createBattle から） */
export function applyEpithet(content, def) {
  const ep = def.epithet ? (content.epithets?.list || []).find((e) => e.id === def.epithet) : null;
  if (!ep) return def;
  const d = { ...def, name: `${ep.name}${def.name ?? def.id}`, epithetName: ep.name };
  if (ep.hp) d.hp = (def.hp ?? 1) * ep.hp;
  if (ep.atk) d.atk = (def.atk ?? 1) * ep.atk;
  if (ep.acts) d.acts = [...(def.acts || ['攻め']), ...ep.acts];
  if (ep.cat) d.cat = ep.cat;
  if (ep.yield) d.yield = { ...ep.yield };
  if (ep.line) d.line = ep.line;
  if (ep.zeni) d.bonusZeni = ep.zeni;
  return d;
}

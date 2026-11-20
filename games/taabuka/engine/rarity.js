// レアリティと刻印（作り直し仕様 D）。数値は content/balance/rarity.yaml、刻印は content/affixes.yaml

/** レアリティの並び */
export const rarOrder = (balance) => balance.rarity.order;

/** レアリティの番号（コモン0〜ミシック5）。知らなければ0 */
export function rarIndex(balance, r) {
  const i = balance.rarity.order.indexOf(r);
  return i < 0 ? 0 : i;
}

/** 札の種類の最低レアリティ */
export function floorRarity(balance, def) {
  return balance.rarity.gradeFloor[def?.grade] ?? balance.rarity.order[0];
}

/** 個体のレアリティ（無ければ種類の最低） */
export function rarOf(balance, owned, def) {
  return owned?.rar && balance.rarity.defs[owned.rar] ? owned.rar : floorRarity(balance, def);
}

/** レアリティの数値の定義 */
export function rarDef(balance, r) {
  return balance.rarity.defs[r] || balance.rarity.defs[balance.rarity.order[0]];
}

/** 量に掛ける：mode add（足す量）・mul（掛け）・draw（引く枚数） */
export function scaleBy(balance, r, n, mode = 'add') {
  const d = rarDef(balance, r);
  if (mode === 'mul') return 1 + (n - 1) * d.mul;
  if (mode === 'draw') return n + (n > 0 ? d.drawAdd : 0);
  return n * d.mul;
}

/** 層ごとの重み（深度で上のレアリティを重く） */
export function rarityWeights(balance, layerNo, depth = 0) {
  const R = balance.rarity;
  const w = { ...(R.weights[`layer${layerNo}`] || R.weights.deep) };
  for (const r of R.order.slice(1)) w[r] = (w[r] || 0) * (1 + (R.depthUp ?? 0) * depth);
  return w;
}

/** レアリティを引く（min 以上。up 段だけ上げる） */
export function rollRarity(balance, rng, layerNo, depth = 0, o = {}) {
  const R = balance.rarity;
  const w = rarityWeights(balance, layerNo, depth);
  const min = o.min ? rarIndex(balance, o.min) : 0;
  let r = rng.weighted(R.order.map((x, i) => [x, i < min ? 0 : w[x] || 0])) ?? R.order[min];
  if (o.up) r = R.order[Math.min(R.order.length - 1, rarIndex(balance, r) + o.up)];
  return r;
}

/** 刻印を引く。返り値は ['af_sharp', 'af_cat:麺', …] */
export function rollAffixes(base, rng, r, def) {
  const { balance, content } = base;
  const d = rarDef(balance, r);
  const all = Object.values(content.affixes || {});
  const normal = all.filter((a) => a.kind !== 'ミシック');
  const mythic = all.filter((a) => a.kind === 'ミシック');
  const out = [];
  const cats = (def?.cat || []).slice();
  const pickOne = (list) => {
    const a = rng.pick(list.filter((x) => !out.some((o) => o.split(':')[0] === x.id)));
    if (!a) return;
    if (a.addCat) {
      const free = balance.tiers.categories.filter((c) => !cats.includes(c));
      if (cats.length >= 3 || !free.length) return;
      const c = rng.pick(free);
      cats.push(c);
      out.push(`${a.id}:${c}`);
    } else out.push(a.id);
  };
  for (let i = 0; i < (d.mythic || 0); i++) pickOne(mythic);
  while (out.length < d.affixes) { const n = out.length; pickOne(normal); if (out.length === n) break; }
  return out;
}

/** 刻印の定義と足すカテゴリ */
export function affixOf(content, ins) {
  const [id, cat] = String(ins).split(':');
  return { def: content.affixes?.[id] ?? null, cat: cat || null, id };
}

/** 札の種類に「量の無い効果だけ」か（レアリティで繰り返す対象）は effect.js が fx ごとに決める */
export const SCALE_VERBS = Object.freeze({
  強さ: 'add', 倍率: 'add', 受け: 'add', 体力: 'add', 宿銭: 'add', 次の出しの強さ: 'add', 育つ: 'add',
  掛け: 'mul', 論破値を掛ける: 'mul', 引く: 'draw', 主張を削る: 'add',
});

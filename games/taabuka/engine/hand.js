// 札の見え方と「重なり」の判定（作り直し仕様 B）
// 札に固有の数字は無い。札のTier＝その札のカテゴリが番付（上の表）で今いる段（複数なら一番高い段）。
// 出した札のうち、ほかの出した札とカテゴリを1つも共有しない札は「孤立」して受けに回る（1枚だけ出したときは採点）。
// 採点札のカテゴリごとの枚数（重なり）が倍率になる（score.js）。

/**
 * @typedef {{tier: string|null, cats: string[], stone: boolean, count?: number}} CardView  見え方（count は重なりで何枚分か。省略時1）
 * @typedef {{hand: string, scored: number[], kickers: number[], overlap: Object<string,number>, flushCats: string[], straight: boolean}} HandResult
 */

/** 番付の段の順位（高いほど強い） */
function slotRank(balance, slot) {
  return (balance.tiers.tiers[slot] || balance.tiers.missing?.[slot] || { rank: -Infinity }).rank;
}

/**
 * 札のTier。札の固定（効果で「Tierを〜にする」）があればそれ、なければカテゴリの番付で一番高い段
 * @param {object} card @param {object} balance @param {Object<string,string>} [banzuke]
 */
export function tierOf(card, balance, banzuke) {
  if (card.tier != null) return String(card.tier);
  const enh = (card.enh && balance.hands.enhancements[card.enh]) || {};
  if (enh.noTier) return null;
  const cats = enh.allCategories ? balance.tiers.categories : (card.cat || []);
  if (!cats.length) return null;
  const bz = banzuke || {};
  let best = null;
  for (const c of cats) {
    const slot = bz[c] ?? balance.tiers.banzukeStart;
    if (best == null || slotRank(balance, slot) > slotRank(balance, best)) best = slot;
  }
  return String(best);
}

/**
 * 札（個体）から見え方を作る。多才は全カテゴリ、石はTierもカテゴリも持たない
 * @param {{tier?: string|number|null, cat?: string[], enh?: string}} card
 * @param {object} balance
 * @param {Object<string,string>} [banzuke] あればTierを番付から決める
 */
export function cardView(card, balance, banzuke) {
  const enh = (card.enh && balance.hands.enhancements[card.enh]) || {};
  if (enh.noTier) return { tier: null, cats: [], stone: true };
  const cats = enh.allCategories ? balance.tiers.categories.slice() : (card.cat || []).slice();
  return { tier: tierOf(card, balance, banzuke), cats, stone: false };
}

/** 輪の上の位置（0〜7）。輪にないTierは -1 */
export function ringPos(tier, balance) {
  return balance.tiers.ring.indexOf(String(tier));
}

/** 5つのTierが輪の上で連続しているか（全て違うことが前提） */
export function isRingRun(tiers, balance) {
  const n = balance.tiers.ring.length;
  const pos = tiers.map((t) => ringPos(t, balance));
  if (pos.some((p) => p < 0)) return false;
  const set = new Set(pos);
  if (set.size !== tiers.length) return false;
  for (let s = 0; s < n; s++) {
    let ok = true;
    for (let k = 0; k < tiers.length; k++) if (!set.has((s + k) % n)) { ok = false; break; }
    if (ok) return true;
  }
  return false;
}

/** 全員が共通して持つカテゴリ */
export function commonCats(views) {
  if (!views.length) return [];
  let common = new Set(views[0].cats);
  for (const v of views.slice(1)) common = new Set(v.cats.filter((c) => common.has(c)));
  return [...common];
}

/**
 * 重なりを判定する
 * @param {CardView[]} views 出した札（手札の左からの並び）
 * @param {object} balance
 * @param {number[]} [strengths] 全部が孤立したときに「強さが一番高い1枚」を採点するための強さ
 * @returns {HandResult}
 */
export function evaluateHand(views, balance, strengths = []) {
  const live = [];
  const stones = [];
  views.forEach((v, i) => (v.stone ? stones : live).push(i));
  let scoredLive;
  if (live.length <= 1) scoredLive = live.slice();
  else {
    scoredLive = live.filter((i) => live.some((j) => j !== i && views[j].cats.some((c) => views[i].cats.includes(c))));
    if (!scoredLive.length) {
      let best = live[0];
      for (const i of live) if ((strengths[i] ?? 0) > (strengths[best] ?? 0)) best = i;
      scoredLive = [best];
    }
  }
  const overlap = {};
  for (const i of scoredLive) for (const c of views[i].cats) overlap[c] = (overlap[c] || 0) + (views[i].count ?? 1);
  const set = new Set([...scoredLive, ...stones]);
  const scored = views.map((_, i) => i).filter((i) => set.has(i));
  const kickers = views.map((_, i) => i).filter((i) => !set.has(i));
  const flushCats = Object.keys(overlap).filter((c) => overlap[c] >= scored.length && scored.length >= 2);
  return { hand: '重なり', scored, kickers, overlap, flushCats, straight: false };
}

/** 重なりの倍率（カテゴリごとの枚数 → 掛け算の並び）。1枚は×1 */
export function overlapMuls(overlap, balance) {
  const o = balance.hands.overlap;
  const out = [];
  for (const [cat, n] of Object.entries(overlap || {})) {
    if (n < 2) continue;
    out.push({ cat, n, x: 1 + o.step * (Math.min(n, o.cap ?? 99) - 1) });
  }
  return out;
}

/** 出しの土台（強さ0・倍率1）。組の段位は無くなった */
export function handBase(_name, _level, balance) {
  return { S: balance.hands.base?.S ?? 0, M: balance.hands.base?.M ?? 1 };
}

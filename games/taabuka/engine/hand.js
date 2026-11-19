// 組の判定（仕様書 第2章「組の判定」）
// Tierの輪（God→0→1→2→3→4→5→8→God）、13の組、複数カテゴリ、多才・石、優先順、採点札の選び方。
// 優先順と輪の並びは content/balance/ から読む。

/**
 * @typedef {{tier: string|null, cats: string[], stone: boolean, count?: number}} CardView  判定に使う札の見え方（count は揃いの判定で何枚分か。省略時1）
 * @typedef {{hand: string, scored: number[], kickers: number[], flushCats: string[], straight: boolean}} HandResult
 */

/**
 * 札（個体）から判定用の見え方を作る。多才は全カテゴリ、石はTierもカテゴリも持たない
 * @param {{tier?: string|number|null, cat?: string[], enh?: string}} card
 */
export function cardView(card, balance) {
  const enh = (card.enh && balance.hands.enhancements[card.enh]) || {};
  if (enh.noTier) return { tier: null, cats: [], stone: true };
  const cats = enh.allCategories ? balance.tiers.categories.slice() : (card.cat || []).slice();
  return { tier: card.tier == null ? null : String(card.tier), cats, stone: false };
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

const FIVE = 5;

/**
 * 組を判定する
 * @param {CardView[]} views 出した札（手札の左からの並び）
 * @param {object} balance
 * @param {number[]} [strengths] 単騎で「強さが一番高い1枚」を選ぶための強さ
 * @returns {HandResult}
 */
export function evaluateHand(views, balance, strengths = []) {
  const live = [];   // 組の判定に加わる札の番号（石以外）
  const stones = [];
  views.forEach((v, i) => ((v.stone || v.tier == null) ? stones : live).push(i));

  const byTier = new Map();
  for (const i of live) {
    const t = views[i].tier;
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t).push(i);
  }
  // 揃いの判定は枚数分（count）で数える。1つの揃いは5枚分まで
  const weight = (g) => Math.min(FIVE, g.reduce((s, i) => s + (views[i].count ?? 1), 0));
  const groups = [...byTier.values()].sort((a, b) => weight(b) - weight(a));
  const shape = groups.map(weight);
  const isFive = live.length === FIVE;
  const flushCats = isFive ? commonCats(live.map((i) => views[i])) : [];
  const flush = flushCats.length > 0;
  const straight = isFive && shape.every((n) => n === 1) && isRingRun(live.map((i) => views[i].tier), balance);
  const allGod = live.length > 0 && live.every((i) => views[i].tier === 'God') && shape[0] >= FIVE;
  const full = shape[0] >= 3 && shape[1] >= 2;

  const pick = (...gs) => gs.flat();
  const rules = {
    神組: () => (allGod ? live : null),
    五揃同類: () => (shape[0] >= 5 && flush ? live : null),
    満員同類: () => (full && flush ? live : null),
    五揃: () => (shape[0] >= 5 ? groups[0] : null),
    同類階段: () => (straight && flush ? live : null),
    四揃: () => (shape[0] >= 4 ? groups[0] : null),
    満員: () => (full ? pick(groups[0], groups[1]) : null),
    同類: () => (flush ? live : null),
    階段: () => (straight ? live : null),
    三揃: () => (shape[0] >= 3 ? groups[0] : null),
    二対: () => (shape[0] >= 2 && shape[1] >= 2 ? pick(groups[0], groups[1]) : null),
    対: () => (shape[0] >= 2 ? groups[0] : null),
    単騎: () => {
      if (!live.length) return [];
      let best = live[0];
      for (const i of live) if ((strengths[i] ?? 0) > (strengths[best] ?? 0)) best = i;
      return [best];
    },
  };

  for (const name of balance.hands.order) {
    const rule = rules[name];
    if (!rule) throw new Error(`hands.yaml の order に知らない組「${name}」`);
    const got = rule();
    if (got) {
      const scoredSet = new Set([...got, ...stones]);
      const scored = views.map((_, i) => i).filter((i) => scoredSet.has(i));
      const kickers = views.map((_, i) => i).filter((i) => !scoredSet.has(i));
      return { hand: name, scored, kickers, flushCats, straight };
    }
  }
  throw new Error('組が1つも決まらなかった（hands.yaml の order に 単騎 が要る）');
}

/** 組の強さと倍率（段位込み） */
export function handBase(name, level, balance) {
  const h = balance.hands.hands[name];
  if (!h) throw new Error(`知らない組「${name}」`);
  const up = Math.max(0, level - (balance.hands.levelStart ?? 1));
  return { S: h.S + h.perLevelS * up, M: h.M + h.perLevelM * up };
}

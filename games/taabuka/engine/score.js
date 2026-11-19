// 論破値の計算（仕様書 第2章「計算の順番」）
// 加算と掛け算を発動した順にその場で適用し、各段で「何が、SとMをどう変えたか」を手順列に積む。
// 演出はこの手順列をそのまま再生する。仕込み・版・判もここで扱う。
//
//  1. S＝組の強さ、M＝組の倍率（段位込み）
//  2. 採点札を左から（差し込み口 score.card）。1枚ごとに
//     a 札の強さ  b 番付倍率  c 仕込み  d 版  e 札の効果  f 宿泊客の仕組み（e・fは合図「採点時」）
//     g 朱判なら a〜f をもう一度
//  3. 手札に残った札を左から（score.held）：鋼、合図「手札に残る」
//  4. 常連客を左の席から（score.regulars）：版、合図「出し」
//  5. 置物を手に入れた順に（score.relics）：合図「出し」
//  6. M が下限未満なら下限に。V＝S×M（score.final）

import { Big, ZERO } from './big.js';
import { cardView } from './hand.js';

/** 札の出どころ（手順列・記録用） */
export function srcOf(kind, obj) {
  if (!obj) return { kind };
  return { kind, id: obj.id ?? null, uid: obj.uid ?? null, name: obj.name ?? null };
}

/** 札の強さ（Tierの強さ＋上乗せ）。石は0（石の S＋ は仕込みの段で入る） */
export function cardStrength(card, balance) {
  const view = cardView(card, balance);
  let s = 0;
  if (!view.stone && view.tier != null) {
    const t = balance.tiers.tiers[view.tier];
    if (!t) throw new Error(`知らないTier「${view.tier}」（${card.id}）`);
    s = t.strength;
  }
  s += card.plusS || 0;
  if (card.origin && balance.hands.origins?.[card.origin]?.sPerGrow) {
    s += (card.grow || 0) * balance.hands.origins[card.origin].sPerGrow;
  }
  return s;
}

/** 番付の段の定義（Tier か欠番） */
export function slotDef(slot, balance) {
  return balance.tiers.tiers[slot] || balance.tiers.missing?.[slot] || null;
}

/** 札のカテゴリのうち、番付で一番高いもの（同じなら categories の並びで先） */
export function bestCategory(cats, banzuke, balance) {
  let best = null, bestRank = -Infinity;
  for (const c of balance.tiers.categories) {
    if (!cats.includes(c)) continue;
    const slot = banzuke[c] ?? balance.tiers.banzukeStart;
    const def = slotDef(slot, balance);
    const rank = def ? def.rank : -Infinity;
    if (rank > bestRank) { best = c; bestRank = rank; }
  }
  return best;
}

/** 番付の段から M の足し分を出す（乱数の段は rollFor で決めた値） */
export function banzukeAdd(def, roll) {
  if (typeof def.banzuke === 'number') return def.banzuke;
  if (def.banzuke && Array.isArray(def.banzuke.random)) return typeof roll === 'function' ? roll() : roll;
  return 0;
}

/** 乱数で決まる番付倍率（T8）。出しごとに1回 */
export function rollBanzuke(balance, rng) {
  for (const def of Object.values(balance.tiers.tiers)) {
    if (def.banzuke && Array.isArray(def.banzuke.random)) {
      const [a, b] = def.banzuke.random;
      return rng.int(a, b);
    }
  }
  return 0;
}

/**
 * 採点の場（差し込み口と合図に渡す ctx）を作る
 * @param {object} o
 */
export function makeScoreCtx(o) {
  const sc = {
    battle: o.battle, env: o.env, balance: o.env.balance, rng: o.rng,
    hand: o.hand, level: o.level, played: o.played, scored: o.scored, kickers: o.kickers, held: o.held,
    target: o.target ?? null, banzukeRoll: null,
    S: ZERO, M: ZERO, V: ZERO, steps: [], zeni: 0, broken: [], card: null, regular: null, relic: null,
    phase: 'base', predict: !!o.predict, choices: o.choices || {},
    banzukeMul: 1, finalMuls: [], minM: null,
  };
  const push = (type, src, extra) => {
    sc.steps.push({ type, src, phase: sc.phase, S: sc.S, M: sc.M, ...extra });
  };
  // T8 の乱数は出しごとに1回。使うときに初めて引く（乱数を使わない出しは予測が確定する）
  sc.getRoll = () => { if (sc.banzukeRoll == null) sc.banzukeRoll = rollBanzuke(sc.balance, sc.rng); return sc.banzukeRoll; };
  sc.addS = (n, src) => { const d = Big.from(n); if (d.isZero()) return; sc.S = sc.S.add(d); push('S', src, { add: d }); };
  sc.addM = (n, src) => { const d = Big.from(n); if (d.isZero()) return; sc.M = sc.M.add(d); push('M', src, { add: d }); };
  sc.mulM = (x, src) => { const d = Big.from(x); sc.M = sc.M.mul(d); push('xM', src, { mul: d }); };
  sc.mulS = (x, src) => { const d = Big.from(x); sc.S = sc.S.mul(d); push('xS', src, { mul: d }); };
  sc.note = (what, src, extra = {}) => push('note', src, { what, ...extra });
  return sc;
}

/** 合図を出す。札ごとの合図は「その札自身」と、札以外（席・置物・宿泊客・層の癖）に届く */
export function emitFor(env, signal, ctx, card) {
  env.hooks.emit(signal, ctx, (h) =>
    h.group !== 'played' || (card && h.owner && h.owner.uid === card.uid));
}

/** 1枚の採点（a〜f）。差し込み口 score.card の芯 */
function scoreCardCore(sc) {
  const { balance } = sc;
  const card = sc.card;
  const src = srcOf('card', card);
  const view = cardView(card, balance);

  // a 札の強さ
  sc.addS(cardStrength(card, balance), src);

  // b 番付倍率（石はカテゴリを持たないので無し）
  if (!view.stone && view.cats.length) {
    const cat = bestCategory(view.cats, sc.battle.banzuke, balance);
    if (cat) {
      const slot = sc.battle.banzuke[cat] ?? balance.tiers.banzukeStart;
      const def = slotDef(slot, balance);
      if (def) {
        const bsrc = { kind: 'banzuke', id: cat, slot };
        sc.addM(banzukeAdd(def, sc.getRoll) * sc.banzukeMul, bsrc);
        if (def.perCardMul) sc.mulM(def.perCardMul, bsrc);
      }
    }
  }

  // c 仕込み
  const enh = card.enh && balance.hands.enhancements[card.enh];
  if (enh) {
    const esrc = { ...src, enh: card.enh };
    if (enh.addS) sc.addS(enh.addS, esrc);
    if (enh.mulM) sc.mulM(enh.mulM, esrc);
    if (enh.chance != null && enh.addM) {
      if (sc.rng.chance(enh.chance)) sc.addM(enh.addM, esrc);
    }
    if (enh.breakChance != null && !card.unbreakable && sc.rng.chance(enh.breakChance) && !sc.broken.includes(card.uid)) {
      sc.broken.push(card.uid);
      sc.note('割れる', esrc);
    }
  }

  // d 版
  const ed = card.ed && balance.hands.editions[card.ed];
  if (ed) {
    const dsrc = { ...src, ed: card.ed };
    if (ed.addS) sc.addS(ed.addS, dsrc);
    if (ed.addM) sc.addM(ed.addM, dsrc);
    if (ed.mulM) sc.mulM(ed.mulM, dsrc);
  }

  // 金判
  const seal = card.seal && balance.hands.seals[card.seal];
  if (seal && seal.scoredZeni) { sc.zeni += seal.scoredZeni; sc.note('宿銭', { ...src, seal: card.seal }, { zeni: seal.scoredZeni }); }

  // e・f 札の効果と宿泊客の仕組み（合図「採点時」）
  emitFor(sc.env, '採点時', sc, card);
}

/**
 * 論破値を計算する
 * @returns {{V: Big, S: Big, M: Big, steps: object[], zeni: number, broken: string[], ctx: object}}
 */
export function computeScore(o) {
  const sc = makeScoreCtx(o);
  const { env, balance } = sc;
  const hooks = env.hooks;

  // 1 組
  const base = o.handBase;
  sc.S = Big.from(base.S);
  sc.M = Big.from(base.M);
  sc.steps.push({ type: 'hand', src: { kind: 'hand', id: sc.hand, level: sc.level }, phase: 'base', S: sc.S, M: sc.M });

  // 余韻など「次の出しの最初に」足すもの
  if (sc.battle.carryS) {
    sc.addS(sc.battle.carryS, { kind: 'rule', name: '余韻' });
    if (!sc.predict) sc.battle.carryS = 0;
  }

  // 採点の順番
  hooks.run('score.order', sc, () => {});

  // 2 採点札
  sc.phase = 'card';
  for (const card of sc.scored.slice()) {
    const seal = card.seal && balance.hands.seals[card.seal];
    const times = 1 + (seal && seal.retrigger ? seal.retrigger : 0);
    for (let r = 0; r < times; r++) {
      sc.card = card;
      sc.retrigger = r;
      if (r > 0) sc.note('もう一度', { ...srcOf('card', card), seal: card.seal });
      hooks.run('score.card', sc, scoreCardCore);
    }
  }
  sc.card = null;

  // 3 手札に残った札
  sc.phase = 'held';
  for (const card of sc.held) {
    sc.card = card;
    hooks.run('score.held', sc, () => {
      const enh = card.enh && balance.hands.enhancements[card.enh];
      if (enh && enh.heldMulM) sc.mulM(enh.heldMulM, { ...srcOf('card', card), enh: card.enh });
      emitFor(env, '手札に残る', sc, card);
    });
  }
  sc.card = null;

  // 4 常連客
  sc.phase = 'regulars';
  hooks.run('score.regulars', sc, () => {
    const seats = sc.battle.seats || [];
    seats.forEach((reg) => {
      if (!reg || reg.disabled) return;
      sc.regular = reg;
      const rsrc = srcOf('regular', reg);
      const ed = reg.ed && balance.hands.editions[reg.ed];
      if (ed && ed.addS) sc.addS(ed.addS, { ...rsrc, ed: reg.ed });
      if (ed && ed.addM) sc.addM(ed.addM, { ...rsrc, ed: reg.ed });
      env.hooks.emit('出し', sc, (h) => h.group === 'seat' && h.owner && h.owner.uid === reg.uid);
      if (ed && ed.mulM) sc.mulM(ed.mulM, { ...rsrc, ed: reg.ed });
    });
    sc.regular = null;
  });

  // 5 置物
  sc.phase = 'relics';
  hooks.run('score.relics', sc, () => {
    for (const relic of sc.battle.relics || []) {
      sc.relic = relic;
      env.hooks.emit('出し', sc, (h) => h.group === 'relic' && h.owner && h.owner.uid === relic.uid);
    }
    sc.relic = null;
  });

  // 6 最後
  sc.phase = 'final';
  hooks.run('score.final', sc, () => {
    const min = sc.minM ?? balance.hands.play.minMultiplier ?? 1;
    if (sc.M.lt(min)) {
      sc.M = Big.from(min);
      sc.steps.push({ type: 'floorM', src: { kind: 'rule' }, phase: 'final', S: sc.S, M: sc.M });
    }
    sc.V = sc.S.mul(sc.M);
    for (const f of sc.finalMuls) {
      sc.V = sc.V.mul(f.x);
      sc.steps.push({ type: 'xV', src: f.src, phase: 'final', S: sc.S, M: sc.M, mul: Big.from(f.x) });
    }
    sc.V = sc.V.floor();
    sc.steps.push({ type: 'final', src: { kind: 'rule' }, phase: 'final', S: sc.S, M: sc.M, V: sc.V });
  });

  return { V: sc.V, S: sc.S, M: sc.M, steps: sc.steps, zeni: sc.zeni, broken: sc.broken, ctx: sc };
}


// 戦闘の状態と手番（仕様書 第2章「1戦闘の流れ」）
// 引く → 出す（最大2回）・流す（最大1回）→ 終了 → 敵の行動 の繰り返し。
// 全ての処理は hooks.js の差し込み口と合図を通す。敵の行動・効果・ルールは語彙（engine/vocab/）から引く。
// 札や敵の個別の処理はここに書かない（content/ の語彙と特注で書く）。
// 状態 B はJSONにできる（大きな数は Big.revive で戻す）。関数や差し込みは env が持ち、
// 読み直したときは openBattle で作り直す。

import { Big, ZERO } from './big.js';
import { Rng } from './rng.js';
import { Hooks } from './hooks.js';
import { cardView, evaluateHand, handBase } from './hand.js';
import { rarOf, rarDef } from './rarity.js';
import { computeScore, cardStrength, emitFor, slotDef } from './score.js';
import { moodDef, tickMood } from './vocab/mood.js';
import { matchCombos, spellOf } from './combo.js';
import { makeE, runDo, testCond } from './vocab/effect.js';

/**
 * @typedef {{uid:string, id:string, enh?:string, ed?:string, seal?:string, origin?:string, grow?:number}} Owned
 * @typedef {{uid:string, id:string, name:string, cat:string[], tier:string|null, grade?:string, enh?:string, ed?:string,
 *   seal?:string, origin?:string, grow?:number, plusS:number, faceDown?:boolean, vars:object, temp?:boolean}} BCard
 */

/** YAML の範囲の書き方 → 内部の名前 */
export const SCOPE_OF = { この出し: 'play', ターン: 'turn', 戦闘: 'battle', 潜行: 'dive' };

// ───────────────────────── 数値表の読み方 ─────────────────────────

/** 深度0〜d の条件を累積する（depth.yaml） */
export function depthMods(balance, depth) {
  const out = {};
  const dy = balance.depth;
  const over = new Set(dy.overrides || []);
  for (let d = 1; d <= depth; d++) {
    const lv = dy.levels?.[d];
    if (!lv) continue;
    for (const [k, v] of Object.entries(lv)) {
      if (over.has(k)) out[k] = v;
      else if (typeof v === 'boolean') out[k] = out[k] || v;
      else if (k.endsWith('Mul')) out[k] = (out[k] ?? 1) * v;
      else out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

function powBig(x, n) {
  if (n <= 0) return Big.from(1);
  const lg = Math.log10(x) * n;
  const e = Math.floor(lg);
  return new Big(10 ** (lg - e), e);
}

/** その階の標準の主張（Big）と攻撃 */
export function standardAt(balance, floor) {
  const fl = balance.curve.floors;
  const keys = Object.keys(fl).map(Number).sort((a, b) => a - b);
  const last = keys[keys.length - 1];
  if (floor <= last) {
    const f = fl[floor] ?? fl[keys.find((k) => k >= floor) ?? last];
    return { claim: Big.from(f.claim), atk: f.atk };
  }
  const b = balance.curve.beyond;
  const extra = floor - last;
  return { claim: Big.from(fl[last].claim).mul(powBig(b.claimMul, extra)), atk: fl[last].atk + b.atkAdd * extra };
}

/** 気配による主張の補正（高い段だけ効く） */
export function presenceClaim(balance, presence) {
  let add = 0;
  for (const s of balance.curve.presence.claimSteps || []) if (presence >= s.from) add = s.claim;
  return add;
}

// ───────────────────────── 敵 ─────────────────────────

/** 「出せる枚数を固定」の枚数（手札が足りなければ手札の枚数） */
export function fixedCount(B) { return B.fixedPlay == null ? null : Math.min(B.fixedPlay, B.hand.length); }

function normAct(a) {
  if (typeof a === 'string') return { name: a, arg: null };
  const [name, arg] = Object.entries(a)[0];
  return { name, arg };
}

/**
 * 敵の個体を作る
 * @param {object} def 敵の定義（content/enemies）
 * @param {object} o {floor, depth, presence, weight, share}
 */
export function makeEnemy(balance, def, o, uid) {
  const kind = def.kind || '通常';
  const km = balance.curve.kinds[kind];
  if (!km) throw new Error(`知らない敵の種類「${kind}」（${def.id}）`);
  const std = standardAt(balance, o.floor);
  const dm = depthMods(balance, o.depth || 0);
  let f = (def.hp ?? 1) * km.claim * (o.share ?? 1);
  if (km.claimPerWeight) f *= 1 + km.claimPerWeight * (o.weight || 0);
  f *= 1 + (dm.enemyClaim || 0);
  if (kind === '番人') f *= 1 + (dm.wardenClaim || 0);
  f *= 1 + presenceClaim(balance, o.presence || 0);
  const claim = std.claim.mul(f).round();
  const atk = Math.max(0, Math.round(std.atk * (def.atk ?? 1) * km.atk * (1 + (dm.enemyAtk || 0))));
  const acts = (def.acts || ['攻め']).map(normAct);
  return {
    uid, id: def.id, name: def.name ?? def.id, kind, claim, maxClaim: claim, atk, acts,
    actIndex: 0, intent: acts[0], charged: false, skip: 0, dead: false, line: def.line ?? '', vars: {},
    ...(def.hideClaim ? { hideClaim: true } : {}),
  };
}

/** 自分への攻撃。受けから先に減らし、残りを体力から引く。ignore は受けを無視する分 */
export function hitPlayer(B, env, e, dmg, ignore) {
  const guarded = Math.max(0, dmg - ignore);
  const fromGuard = Math.min(B.guard, guarded);
  B.guard -= fromGuard;
  const loss = dmg - fromGuard;
  B.hp = Math.max(0, B.hp - loss);
  log(B, { t: 'attack', enemy: e.uid, name: e.name, dmg, guarded: fromGuard, loss, hp: B.hp });
}

/** 敵を倒す（差し込み口 enemy.defeated を通す） */
export function killEnemy(B, env, e) {
  if (e.dead) return;
  const kctx = { battle: B, env, enemy: e };
  env.hooks.run('enemy.defeated', kctx, () => { e.dead = true; emitAll(env, '敵を倒した時', kctx, uidsOf(B.inPlay)); });
  if (e.dead) log(B, { t: 'defeated', enemy: e.uid, name: e.name });
}

/** 手札で一番多いカテゴリ（同数なら categories の並びで先） */
export function mostCategory(B, env) {
  const count = {};
  for (const c of B.hand) for (const cat of cardView(c, env.balance).cats) count[cat] = (count[cat] || 0) + 1;
  let best = null;
  for (const cat of env.balance.tiers.categories) if ((count[cat] || 0) > (count[best] || 0)) best = cat;
  return best;
}

/** 番付で一番高いカテゴリ（Tierの段だけ。同じなら categories の並びで先） */
export function topCategory(B, env) {
  const { balance } = env;
  let best = null, rank = -Infinity;
  for (const cat of balance.tiers.categories) {
    const def = balance.tiers.tiers[B.banzuke[cat] ?? balance.tiers.banzukeStart];
    if (def && def.rank > rank) { best = cat; rank = def.rank; }
  }
  return best;
}

/** 番付を段で動かす（Tierの段の中だけ。端で止まる） */
export function shiftBanzuke(B, env, cat, steps, src) {
  const order = env.balance.tiers.banzukeSteps;
  const from = B.banzuke[cat] ?? env.balance.tiers.banzukeStart;
  const i = order.indexOf(from);
  if (i < 0) return; // 欠番にいるものは段では動かない
  const to = order[Math.max(0, Math.min(order.length - 1, i + steps))];
  if (to !== from) setBanzuke(B, env, cat, to, src);
}

/** 番付を指定の段へ移す（差し込み口 banzuke.change を通す） */
export function setBanzuke(B, env, cat, to, src) {
  if (!slotDef(to, env.balance)) throw new Error(`番付の段「${to}」は無い`);
  const ctx = { battle: B, env, cat, from: B.banzuke[cat] ?? env.balance.tiers.banzukeStart, to, src };
  env.hooks.run('banzuke.change', ctx, (c) => {
    B.banzuke[c.cat] = c.to;
    log(B, { t: 'banzuke', cat: c.cat, from: c.from, to: c.to, src: c.src?.name ?? null });
  });
}

// ───────────────────────── 状態の作成と読み直し ─────────────────────────

export function log(B, entry) { B.log.push({ turn: B.turn, ...entry }); }

export function newUid(B, p) { B.uidSeq += 1; return `${p}${B.uidSeq}`; }

/** 個体＋定義から戦闘用の札を作る */
export function makeBattleCard(owned, def) {
  if (!def) throw new Error(`札の定義がない「${owned.id}」`);
  return {
    uid: owned.uid, id: owned.id, name: def.name ?? owned.id,
    cat: (def.cat || []).slice(), tier: def.tier != null ? String(def.tier) : null, grade: def.grade ?? null, rar: owned.rar ?? null, ins: (owned.ins || []).slice(),
    enh: owned.enh ?? null, ed: owned.ed ?? null, seal: owned.seal ?? null,
    origin: owned.origin ?? 'orig', grow: owned.grow ?? 0, plusS: owned.mod?.plusS ?? 0, faceDown: false, vars: {},
    ...(def.props?.unbreakable ? { unbreakable: true } : {}),
    ...(owned.mod?.name ? { name: owned.mod.name } : {}),
    ...(owned.mod?.cat ? { cat: owned.mod.cat.slice() } : {}),
    ...(owned.mod?.tier != null ? { tier: String(owned.mod.tier) } : {}),
  };
}

/** 刻印で足されたカテゴリを札に加える（3つまで） */
function applyAffixCats(card) {
  for (const x of card.ins || []) {
    const c = String(x).split(':')[1];
    if (c && !card.cat.includes(c) && card.cat.length < 3) card.cat.push(c);
  }
  return card;
}

/**
 * 戦闘の状態を作る（まだ始めない）
 * @param {{balance:object, content:object}} base
 * @param {object} o
 */
export function createBattle(base, o) {
  const { balance, content } = base;
  const play = balance.hands.play;
  const rng = o.rngState ? Rng.fromState(o.rngState) : Rng.child(o.seed ?? 0, 'battle', o.floor ?? 1, o.room ?? 0);
  const guestDef = o.guest ? content.guests?.[o.guest] : null;
  if (o.guest && !guestDef) throw new Error(`宿泊客の定義がない「${o.guest}」`);
  const B = {
    v: 1, floor: o.floor ?? 1, room: o.room ?? 0, depth: o.depth ?? 0, presence: o.presence ?? 0,
    turn: 0, hp: o.hp ?? guestDef?.hp, maxHp: o.maxHp ?? o.hp ?? guestDef?.hp, guard: 0,
    draw: [], hand: [], discard: [], exhaust: [], destroyed: [], inPlay: [], zones: {},
    playsLeft: 0, discardsLeft: 0, handSize: play.handSize, maxPlay: o.maxPlay ?? play.maxPlayCards, turnPlays: 0,
    enemies: [], seats: (o.seats || []).map((r) => ({ ...r, name: content.regulars?.[r.id]?.name ?? r.id, disabled: false, vars: {} })),
    relics: (o.relics || []).map((r) => ({ ...r, name: content.relics?.[r.id]?.name ?? r.id, vars: {} })),
    items: (o.items || []).slice(),
    banzuke: { ...(o.banzuke || {}) }, handLevels: { ...(o.handLevels || {}) },
    rules: (o.rules || []).map((r) => ({ ...r })), mods: [], flags: {}, guest: o.guest ?? null, guestSwap: null,
    guestState: { ...(guestDef?.state || {}), ...(o.guestState || {}) }, quirk: o.quirk ?? null, quirkParams: o.quirkParams ?? null, heldRules: o.heldRules ?? null, xmods: o.xmods ?? null, itemPool: o.itemPool ?? null,
    sealed: { cats: [], hands: [], discard: false }, pendingFaceDown: 0, fixedPlay: null,
    lastHand: null, turnLastHand: null, lastPlayedCats: [], carryS: 0, banzukeFloorStart: o.banzukeFloorStart ?? null, initialClaim: ZERO, zeni: 0, overkill: null, result: null, rewardRate: 1,
    stats: { plays: 0, maxV: ZERO, hands: {}, cats: {} },
    rngState: rng.getState(), uidSeq: 0, log: [],
  };
  for (const cat of balance.tiers.categories) if (B.banzuke[cat] == null) B.banzuke[cat] = balance.tiers.banzukeStart;
  B.draw = (o.deck || []).map((ow) => makeBattleCard(ow, content.cards?.[ow.id]));
  // 敵：通常戦で複数体なら主張の合計が標準値になるよう割り振る
  const defs = (o.enemies || []).map((x) => {
    const id = typeof x === 'string' ? x : x.id;
    const def = content.enemies?.[id];
    if (!def) throw new Error(`敵の定義がない「${id}」`);
    return typeof x === 'string' ? def : { ...def, ...x };
  });
  const normals = defs.filter((d) => (d.kind || '通常') === '通常');
  const split = balance.curve.splitGroupClaim && normals.length > 1;
  const hpSum = normals.reduce((s, d) => s + (d.hp ?? 1), 0);
  for (const d of defs) {
    const share = split && (d.kind || '通常') === '通常' ? 1 / hpSum : 1;
    B.enemies.push(makeEnemy(balance, d, { floor: B.floor, depth: B.depth, presence: B.presence, weight: o.weight, share }, newUid(B, 'e')));
  }
  return B;
}

/** 持ち主の個体を探す（札・常連客・置物・敵） */
export function findOwner(B, owner) {
  if (!owner || !B) return null;
  switch (owner.kind) {
    case 'card':
      for (const pile of [B.inPlay, B.hand, B.draw, B.discard, B.exhaust, ...Object.values(B.zones || {})]) {
        const c = pile.find((x) => x.uid === owner.uid);
        if (c) return c;
      }
      return null;
    case 'regular': return B.seats.find((r) => r.uid === owner.uid) ?? null;
    case 'relic': return B.relics.find((r) => r.uid === owner.uid) ?? null;
    case 'enemy': return B.enemies.find((e) => e.uid === owner.uid) ?? null;
    default: return null;
  }
}

/**
 * 定義（コンテンツ）の差し込みと合図を登録する。
 * 定義は hooks {差し込み口: (ctx, next, me)}、listen [{signal, fn(ctx, me)}]、on {合図: (ctx, me)} を持てる
 */
function attachDef(env, def, opt) {
  if (!def) return;
  const me = { params: opt.params || {}, owner: opt.owner, rule: opt.rule ?? null, def, affix: !!opt.affix };
  const reg = { group: opt.group, index: opt.index ?? 0, owner: opt.owner, tag: opt.tag };
  for (const [name, fn] of Object.entries(def.hooks || {})) env.hooks.add(name, (c, n) => fn(c, n, me), reg);
  for (const [sig, fn] of Object.entries(def.on || {})) env.hooks.on(sig, (c) => fn(c, me), reg);
  for (const l of def.listen || []) env.hooks.on(l.signal, (c) => l.fn(c, me), reg);
}

/** 札の効果を登録する（合図は戦闘のあいだずっと。出した札だけに届くよう絞るのは合図を出す側） */
export function attachCard(env, card) {
  const def = env.content.cards?.[card.id];
  if (!def) return;
  if (!card.rar) card.rar = rarOf(env.balance, card, def);
  applyAffixCats(card);
  const owner = { kind: 'card', id: card.id, uid: card.uid };
  attachDef(env, { on: def.on, listen: def.listen }, { group: 'played', owner, tag: 'battle' });
  // 刻印（量はレアリティで増えない）
  for (const x of card.ins || []) {
    const a = env.content.affixes?.[String(x).split(':')[0]];
    if (a?.listen?.length) attachDef(env, { listen: a.listen }, { group: 'played', owner, tag: 'battle', params: { affix: a.id }, affix: true });
  }
}

/** 敵の特注を登録する */
export function attachEnemy(env, e) {
  const def = env.content.enemies?.[e.id];
  if (!def?.custom) return;
  const cust = env.content.vocab.get('enemy', def.custom);
  if (!cust) throw new Error(`敵の特注「${def.custom}」が無い（${e.id}）`);
  attachDef(env, cust, { group: 'enemy', owner: { kind: 'enemy', id: e.id, uid: e.uid }, tag: `enemy:${e.uid}`, params: { ...(cust.params || {}), ...(def.params || {}) } });
}

function guestMechanic(env, guestId) {
  const g = env.content.guests?.[guestId];
  if (!g) throw new Error(`宿泊客の定義がない「${guestId}」`);
  const m = g.mechanic ? env.content.vocab.get('mechanic', g.mechanic) : null;
  if (g.mechanic && !m) throw new Error(`宿泊客の仕組み「${g.mechanic}」が無い（${guestId}）`);
  return { g, m };
}

function attachGuest(env, guestId) {
  const { g, m } = guestMechanic(env, guestId);
  if (m) attachDef(env, m, { group: 'guest', owner: { kind: 'guest', id: guestId, uid: guestId }, tag: 'guest', params: g.params });
}

/** 宿泊客の仕組みを別の宿泊客のものに入れ替える（ルール「宿泊客の仕組みを入れ替える」） */
export function swapGuest(B, env, id) {
  const others = Object.keys(env.content.guests || {}).filter((k) => k !== B.guest && env.content.guests[k].mechanic);
  const to = id ?? env.rng.pick(others);
  if (!to) return;
  env.hooks.removeTag('guest');
  attachGuest(env, to);
  B.guestSwap = to;
  log(B, { t: 'guestSwap', to });
}
export function restoreGuest(B, env) {
  env.hooks.removeTag('guest');
  if (B.guest) attachGuest(env, B.guest);
  B.guestSwap = null;
}

function ruleDef(env, name) {
  const def = env.content.vocab.get('rule', name);
  if (!def) throw new Error(`ルール「${name}」が無い`);
  return def;
}

function attachRule(env, r) {
  attachDef(env, ruleDef(env, r.name), { group: r.group, index: r.index, owner: r.owner, tag: `rule:${r.id}`, params: r.params, rule: r });
}

/**
 * 戦闘の環境（差し込み口・乱数）を作る。始めるときも、読み直したときも使う
 * @returns {{balance:object, content:object, hooks:Hooks, rng:Rng}}
 */
export function openBattle(base, B) {
  const env = { balance: base.balance, content: base.content, rng: Rng.fromState(B.rngState), hooks: null, api: API };
  const report = (e) => log(B, { t: 'error', hook: e.hook, owner: e.owner, message: e.message });
  env.hooks = new Hooks({ onError: report, onLimit: report });
  const C = env.content;
  B.seats.forEach((r, i) => attachDef(env, C.regulars?.[r.id], { group: 'seat', index: i, owner: { kind: 'regular', id: r.id, uid: r.uid }, tag: 'battle' }));
  B.relics.forEach((r, i) => attachDef(env, C.relics?.[r.id], { group: 'relic', index: i, owner: { kind: 'relic', id: r.id, uid: r.uid }, tag: 'battle' }));
  if (B.guestSwap || B.guest) attachGuest(env, B.guestSwap || B.guest);
  for (const c of [...B.inPlay, ...B.draw, ...B.hand, ...B.discard, ...B.exhaust, ...Object.values(B.zones || {}).flat()]) attachCard(env, c);
  for (const e of B.enemies) if (!e.dead) attachEnemy(env, e);
  for (const r of B.rules) attachRule(env, r);
  return env;
}

/** 特注から使える道具（ctx.env.api）。特注は engine/ をパスで import しない */
export const API = {};

/**
 * ルールを掛ける
 * @param {{name:string, scope:'play'|'turn'|'battle'|'dive'|'held', params?:object, owner?:object, group?:string, index?:number}} rule
 */
export function addRule(B, env, rule) {
  const def = ruleDef(env, rule.name);
  const r = {
    id: newUid(B, 'r'), name: rule.name, scope: rule.scope || 'play', params: rule.params || {},
    owner: rule.owner ?? null, group: rule.group || 'played', index: rule.index ?? 0,
  };
  B.rules.push(r);
  attachRule(env, r);
  log(B, { t: 'rule', name: r.name, scope: r.scope });
  if (def.apply) def.apply(B, env, r);
  return r;
}

function expire(B, env, scope) {
  for (const r of B.rules.filter((x) => x.scope === scope)) {
    env.hooks.removeTag(`rule:${r.id}`);
    const def = env.content.vocab.get('rule', r.name);
    if (def?.expire) {
      try { def.expire(B, env, r); } catch (err) { log(B, { t: 'error', hook: 'rule.expire', owner: r.owner, message: String(err.message ?? err) }); }
    }
  }
  B.rules = B.rules.filter((r) => r.scope !== scope);
  B.mods = B.mods.filter((m) => m.scope !== scope);
}

/** 行動回数などの一時的な増減 */
export function addMod(B, key, delta, scope) {
  B.mods.push({ key, delta, scope });
  if (key === 'plays') B.playsLeft = Math.max(0, B.playsLeft + delta);
  if (key === 'discards') B.discardsLeft = Math.max(0, B.discardsLeft + delta);
  if (key === 'handSize') B.handSize = Math.max(1, B.handSize + delta);
  log(B, { t: 'mod', key, delta, scope });
}
function modSum(B, key) { return B.mods.filter((m) => m.key === key).reduce((s, m) => s + m.delta, 0); }

/** 状態を文字列に（保存用） */
export function saveBattle(B) { return JSON.stringify(B); }
/** 文字列から状態に戻す */
export function loadBattle(s) { return JSON.parse(s, Big.revive); }
export function cloneBattle(B) { return loadBattle(saveBattle(B)); }

function sync(B, env) { B.rngState = env.rng.getState(); }

/** 合図を出す。出した札の効果は allowUids の札にだけ届く */
function emitAll(env, signal, ctx, allowUids) {
  env.hooks.emit(signal, ctx, (h) => h.group !== 'played' || (h.owner && allowUids.has(h.owner.uid)));
}
const uidsOf = (cards) => new Set(cards.map((c) => c.uid));

// ───────────────────────── 札の出し入れ ─────────────────────────

/** 札を作って置く（効果「札を生む」） */
export function spawnCard(B, env, o) {
  const def = env.content.cards?.[o.id];
  if (!def) throw new Error(`札の定義がない「${o.id}」`);
  const from = o.from || {};
  const owned = { uid: newUid(B, 'c'), id: o.id, origin: o.copy ? 'copy' : 'orig', enh: from.enh ?? null, ed: o.copy ? null : from.ed ?? null, seal: o.copy ? null : from.seal ?? null };
  const c = makeBattleCard(owned, def);
  c.temp = o.temp !== false;
  switch (o.place ?? '手札') {
    case '手札': B.hand.push(c); break;
    case '山札の上': B.draw.unshift(c); break;
    case '山札の下': B.draw.push(c); break;
    case '捨て札': B.discard.push(c); break;
    default: throw new Error(`札を置く場所「${o.place}」を知らない`);
  }
  attachCard(env, c);
  log(B, { t: 'spawn', card: c.name, place: o.place ?? '手札', copy: !!o.copy });
  return c;
}

/** 札を除く（perm なら永続で消える） */
export function removeCard(B, card, perm) {
  if (card.unbreakable) { log(B, { t: 'note', what: `${card.name}は消えない` }); return; }
  if (B.inPlay.includes(card)) { card.gone = perm ? 'destroyed' : 'exhaust'; return; }
  for (const pile of [B.hand, B.draw, B.discard]) {
    const i = pile.indexOf(card);
    if (i >= 0) { pile.splice(i, 1); (perm ? B.destroyed : B.exhaust).push(card); log(B, { t: 'remove', card: card.name, perm }); return; }
  }
}

/** 山札から引く。尽きたら捨て札を切って山札にする */
export function drawCards(B, env, n) {
  const got = [];
  for (let i = 0; i < n; i++) {
    if (!B.draw.length) {
      if (!B.discard.length) break;
      B.draw = env.rng.shuffle(B.discard);
      B.discard = [];
      log(B, { t: 'reshuffle', n: B.draw.length });
    }
    const c = B.draw.shift();
    B.hand.push(c);
    got.push(c);
  }
  if (got.length) {
    log(B, { t: 'draw', cards: got.map((c) => c.name) });
    const ctx = { battle: B, env, cards: got };
    env.hooks.run('draw.after', ctx, () => { for (const c of got) emitFor(env, '引いた時', { ...ctx, card: c }, c); });
  }
  return got;
}

/** 階が何層目か（層の並びは floors の始まり順。見つからなければ 1） */
export function layerNoAt(content, floor) {
  const list = Object.values(content.layers || {}).filter((L) => Array.isArray(L.floors)).sort((a, b) => a.floors[0] - b.floors[0]);
  const i = list.findIndex((L) => floor >= L.floors[0] && floor <= L.floors[1]);
  return i < 0 ? 1 : i + 1;
}

/** お品書きを得る（空きがあれば）。content.items から種類で乱数に選ぶ。議題は組を指定できる */
export function gainItem(B, env, kind, extra) {
  const slots = env.balance.hands.play.itemSlots;
  if (B.items.length >= slots) return null;
  const no = layerNoAt(env.content, B.floor);
  const defs = Object.values(env.content.items || {}).filter((d) => d.kind === kind && no >= (d.fromLayer ?? 1) && (!B.itemPool || B.itemPool.includes(d.id)));
  const id = defs.length ? env.rng.pick(defs).id : null;
  if (!id) return null;
  const item = { uid: newUid(B, 'i'), id, kind, ...extra };
  B.items.push(item);
  log(B, { t: 'item', kind, id, hand: extra.hand ?? null });
  return item;
}

// ───────────────────────── 手番 ─────────────────────────

/** 戦闘開始 */
export function startBattle(B, env) {
  env.hooks.beginChain();
  B.draw = env.rng.shuffle(B.draw);
  B.initialClaim = B.enemies.reduce((s, e) => s.add(e.claim), ZERO);
  log(B, { t: 'start', enemies: B.enemies.map((e) => ({ uid: e.uid, name: e.name, claim: e.claim, atk: e.atk, intent: e.intent })) });
  // 持っている間ずっと効くルール（置物・常連客・宿泊客の rule）
  const C = env.content;
  const held = [
    ...B.seats.map((r, i) => [C.regulars?.[r.id], 'seat', i, { kind: 'regular', id: r.id, uid: r.uid }]),
    ...B.relics.map((r, i) => [C.relics?.[r.id], 'relic', i, { kind: 'relic', id: r.id, uid: r.uid }]),
    ...(B.guest ? [[C.guests?.[B.guest], 'guest', 0, { kind: 'guest', id: B.guest, uid: B.guest }]] : []),
    ...(B.quirk ? [[{ rules: [{ name: B.quirk, params: B.quirkParams || {} }] }, 'quirk', 0, { kind: 'quirk', id: B.quirk }]] : []),
  ];
  for (const [def, group, index, owner] of held) {
    for (const r of def?.rules || []) addRule(B, env, { name: r.name, params: r.params, scope: 'held', group, index, owner });
  }
  // 縛り潜行のルール（その戦闘のあいだ。外れると元に戻るものは戻る）
  for (const r of B.heldRules || []) addRule(B, env, { name: r.name, params: r.params, scope: 'battle', group: 'quirk', owner: { kind: 'shibari', id: r.name } });
  // 深度の「層主の追加妨害」「層主戦の流し−1」（仕様書 第6章 深度）
  const boss = B.enemies.some((e) => e.kind === '層主' || e.kind === '底の主');
  if (boss) {
    const dm = depthMods(env.balance, B.depth || 0);
    const list = env.balance.curve.bossHindrances || [];
    const picks = env.rng.shuffle(list.map((_, i) => i)).slice(0, Math.min(list.length, dm.bossExtraHindrance || 0));
    for (const i of picks) {
      const hd = list[i];
      if (hd.rule) addRule(B, env, { name: hd.rule, params: hd.params || {}, scope: 'battle', group: 'enemy', owner: { kind: 'depth', id: 'hindrance' } });
      if (hd.mod) addMod(B, hd.mod, hd.delta, 'battle');
      log(B, { t: 'hindrance', what: hd.text });
    }
    if (dm.bossDiscards) addMod(B, 'discards', dm.bossDiscards, 'battle');
  }
  const ctx = { battle: B, env };
  env.hooks.run('battle.start', ctx, () => emitAll(env, '戦闘開始', ctx, uidsOf(B.draw)));
  startTurn(B, env);
  settle(B, env);
  sync(B, env);
  return B;
}

function startTurn(B, env) {
  const { balance } = env;
  const play = balance.hands.play;
  const dm = depthMods(balance, B.depth);
  B.turn += 1;
  B.guard = 0;
  B.turnPlays = 0;
  B.turnLastHand = null;
  B.playsLeft = Math.max(0, play.playsPerTurn + modSum(B, 'plays'));
  B.discardsLeft = Math.max(0, play.discardsPerTurn + modSum(B, 'discards'));
  B.handSize = Math.max(1, play.handSize + (dm.handSize || 0) + modSum(B, 'handSize'));
  log(B, { t: 'turn', n: B.turn });
  const pr = balance.curve.presence;
  if (B.turn >= pr.battleTurnFrom) {
    const add = Math.ceil(pr.perBattleTurn * (dm.presenceGainMul || 1) * (B.xmods?.presenceGainMul || 1));
    B.presence += add;
    log(B, { t: 'presence', add, presence: B.presence });
  }
  // 長引いた戦闘：この ターン から、敵の攻撃が毎ターン増える（受けで耐え続けて終わらないのを防ぐ。curve.yaml の enrage）
  const en = balance.curve.enrage;
  if (en && B.turn >= en.from) {
    for (const e of B.enemies) if (!e.dead) e.atk = Math.max(e.atk + 1, Math.round(e.atk * (1 + en.atkMul)));
    log(B, { t: 'note', what: '敵が苛立っている（攻撃が上がる）' });
  }
  drawCards(B, env, Math.max(0, B.handSize - B.hand.length));
  if (B.pendingFaceDown > 0) {
    const pool = env.rng.shuffle(B.hand.filter((c) => !c.faceDown));
    const n = Math.min(B.pendingFaceDown, pool.length);
    for (let i = 0; i < n; i++) pool[i].faceDown = true;
    log(B, { t: 'faceDown', n });
    B.pendingFaceDown = 0;
  }
  const ctx = { battle: B, env };
  env.hooks.run('turn.start', ctx, () => emitAll(env, 'ターン開始', ctx, uidsOf(B.hand)));
}

function check(cond, reason) { if (!cond) throw Object.assign(new Error(reason), { userError: true }); }

function aliveIndex(B, want) {
  if (want != null && B.enemies[want] && !B.enemies[want].dead) return want;
  return B.enemies.findIndex((e) => !e.dead);
}

/**
 * 札を出す
 * @param {number[]} indices 手札の番号
 * @param {number} [target] 狙う敵の番号
 * @param {{predict?: boolean, choices?: object}} [opt] choices はプレイヤーが選んだもの（宣言する組など）
 */
export function play(B, env, indices, target, opt = {}) {
  const { balance } = env;
  const P = balance.hands.play;
  check(!B.result, '戦闘は終わっている');
  check(B.playsLeft > 0, '出しが残っていない');
  const idx = [...new Set(indices)].sort((a, b) => a - b);
  const maxP = B.maxPlay ?? P.maxPlayCards;
  check(idx.length >= P.minCards && idx.length <= maxP, `出せるのは${P.minCards}〜${maxP}枚`);
  check(B.fixedPlay == null || idx.length === fixedCount(B), `いまは${fixedCount(B)}枚でしか出せない`);
  check(idx.every((i) => i >= 0 && i < B.hand.length), '手札にない札');
  const ti = aliveIndex(B, target);
  check(ti >= 0, '狙える敵がいない');

  env.hooks.beginChain();
  const handLen = B.hand.length;
  const cards = idx.map((i) => B.hand[i]);
  cards.forEach((c, k) => { c.handPos = idx[k]; c.handLen = handLen; });
  B.hand = B.hand.filter((_, i) => !idx.includes(i));
  return playCards(B, env, cards, ti, opt);
}

/**
 * 札の束を1つの出しとして処理する（手札から出す play の中身。宿泊客の仕組みが手札以外の札を出すときにも使う）
 * @param {object[]} cards 置き場から取り出した戦闘用の札
 * @param {{free?:boolean, returnTo?:object[], choices?:object, predict?:boolean, src?:string}} opt
 *   free＝出し回数を使わない／returnTo＝出し終えた札を捨て札でなくこの並びへ戻す
 */
export function playCards(B, env, cards, ti, opt = {}) {
  const { balance } = env;
  const choices = opt.choices || {};
  cards.forEach((c) => { c.faceDown = false; });
  B.inPlay = cards;
  if (!opt.free) B.turnPlays += 1;
  B.stats.plays += 1;
  cards.forEach((c, i) => {
    const def = env.content.cards?.[c.id];
    if (def?.hooks) attachDef(env, { hooks: def.hooks }, { group: 'played', index: i, owner: { kind: 'card', id: c.id, uid: c.uid }, tag: 'play' });
  });
  const played = uidsOf(cards);

  const pctx = { battle: B, env, cards, target: ti, choices };
  env.hooks.run('play.before', pctx, () => emitAll(env, '出しの前', pctx, played));

  // 組の判定
  const views = cards.map((c) => cardView(c, balance, B.banzuke));
  const strengths = cards.map((c) => cardStrength(c, balance, B.banzuke));
  const hctx = { battle: B, env, cards, views, strengths, result: null, choices };
  env.hooks.run('hand.evaluate', hctx, (c) => { c.result = evaluateHand(c.views, balance, c.strengths); });
  const res = hctx.result;
  const handSealed = B.sealed.hands.includes(res.hand);
  let scored = res.scored.map((i) => cards[i]);
  let kickers = res.kickers.map((i) => cards[i]);
  if (handSealed) { kickers = cards.slice(); scored = []; }
  else {
    const no = scored.filter((c) => cardView(c, balance).cats.some((x) => B.sealed.cats.includes(x)));
    if (no.length) { scored = scored.filter((c) => !no.includes(c)); kickers = cards.filter((c) => !scored.includes(c)); }
  }
  const level = 1;
  // 重なり：最後に採点される札の見え方（ルールで変わった見え方を含む）から数える
  const overlap = {};
  for (const c of scored) {
    const v = hctx.views[cards.indexOf(c)];
    if (!v || v.stone) continue;
    for (const cat of v.cats) overlap[cat] = (overlap[cat] || 0) + (v.count ?? 1);
  }

  // 論破値
  let score;
  if (handSealed) {
    score = { V: ZERO, S: ZERO, M: ZERO, steps: [{ type: 'note', what: '封じ', src: { kind: 'rule' }, phase: 'base', S: ZERO, M: ZERO }], zeni: 0, broken: [] };
  } else {
    score = computeScore({
      battle: B, env, rng: env.rng, hand: res.hand, level, overlap, played: cards, scored, kickers, held: B.hand.slice(),
      target: ti, handBase: handBase(res.hand, level, balance), predict: !!opt.predict, choices,
    });
  }
  B.zeni += score.zeni;
  if (score.V.gt(B.stats.maxV)) B.stats.maxV = score.V;
  // 記録は「一番重なったカテゴリの枚数」ごと（解放条件 overlap が読む）
  const top = String(Math.max(1, ...Object.values(overlap)));
  B.stats.hands[top] = (B.stats.hands[top] || 0) + 1;
  B.lastOverlap = overlap;
  B.stats.cats ||= {};
  for (const [cat, n] of Object.entries(overlap)) B.stats.cats[cat] = (B.stats.cats[cat] || 0) + n;

  // 演出の手順（札の show と、差し込み口 fx.queue で足されたもの）
  const fctx = { battle: B, env, cards, hand: res.hand, fx: [] };
  for (const c of cards) for (const s of env.content.cards?.[c.id]?.show || []) fctx.fx.push({ ...s, src: { kind: 'card', id: c.id, name: c.name } });
  env.hooks.run('fx.queue', fctx, () => {});
  log(B, {
    t: 'play', cards: cards.map((c) => c.name), hand: res.hand, level, scored: scored.map((c) => c.name),
    kickers: kickers.map((c) => c.name), steps: score.steps, V: score.V, S: score.S, M: score.M, target: ti, sealed: handSealed, ...(opt.src ? { src: opt.src } : {}),
    fx: fctx.fx, flags: { ...B.flags },
    combos: score.combos || [], spell: spellOf(env.content, cards, matchCombos(env.content, cards)),
  });

  // 狙った敵に与える（貫通）
  const dctx = { battle: B, env, V: score.V, target: ti, hits: [] };
  env.hooks.run('damage.apply', dctx, (c) => applyDamage(B, env, c));

  // 受け
  const tiers = balance.tiers;
  for (const c of kickers) {
    const view = cardView(c, balance, B.banzuke);
    if (view.cats.some((cat) => tiers.missing?.[B.banzuke[cat]]?.noGuard)) continue;
    const enh = c.enh && balance.hands.enhancements[c.enh];
    const md = moodDef(B, balance);
    const gctx = { battle: B, env, card: c, guard: cardStrength(c, balance, B.banzuke) * (enh && enh.guardMul ? enh.guardMul : 1) * (md?.guardMul ?? 1) };
    emitFor(env, '受けに回る', gctx, c);
    B.guard += gctx.guard;
    if (gctx.guard) log(B, { t: 'guard', card: c.name, add: gctx.guard, guard: B.guard });
  }

  // 捨て札へ（割れた硝子と消された札は除く）
  for (const c of cards) {
    delete c.handPos; delete c.handLen;
    if (score.broken.includes(c.uid) || c.gone === 'destroyed') { delete c.gone; B.destroyed.push(c); log(B, { t: 'broken', card: c.name }); }
    else if (c.gone === 'exhaust') { delete c.gone; B.exhaust.push(c); log(B, { t: 'remove', card: c.name, perm: false }); }
    else (opt.returnTo || B.discard).push(c);
  }
  B.inPlay = [];
  if (!opt.free) B.playsLeft = Math.max(0, B.playsLeft - 1);
  B.lastHand = res.hand;
  B.turnLastHand = res.hand;
  B.lastPlayedCats = cardView(cards[0], balance).cats;

  const actx = { battle: B, env, cards, hand: res.hand, V: score.V, choices };
  env.hooks.run('play.after', actx, () => emitAll(env, '出しの後', actx, played));
  env.hooks.removeTag('play');
  expire(B, env, 'play');

  settle(B, env, score.V);
  sync(B, env);
  return { hand: res.hand, V: score.V, steps: score.steps, scored, kickers, fx: fctx.fx };
}

/** 論破値を敵に与える。倒して余った分は右隣へ、端まで行ったら左端へ */
function applyDamage(B, env, c) {
  let rest = c.V;
  const n = B.enemies.length;
  for (let k = 0; k < n && rest.gt(0); k++) {
    const e = B.enemies[(c.target + k) % n];
    if (e.dead) continue;
    const take = Big.min(rest, e.claim);
    const before = e.claim;
    e.claim = e.claim.sub(take);
    rest = rest.sub(take);
    const killed = e.claim.lte(0);
    if (killed) e.claim = ZERO;
    c.hits.push({ enemy: e.uid, amount: take, pierce: k > 0 });
    log(B, { t: 'damage', enemy: e.uid, name: e.name, amount: take, before, after: e.claim, pierce: k > 0, killed });
    if (killed) {
      killEnemy(B, env, e);
      if (!e.dead) break; // 倒されるのを止められたら貫通しない
    }
  }
  c.rest = rest;
}

/** 過剰論破の段（economy.yaml の overkill） */
export function overkillOf(balance, r) {
  const levels = balance.economy.overkill.slice().sort((a, b) => a.from - b.from);
  const got = levels.filter((l) => r.gte(l.from));
  const rewards = { zeni: 0, extraCards: 0, gradeUp: 0, godChance: 0 };
  for (const l of got) {
    rewards.zeni += l.zeni || 0;
    rewards.extraCards += l.extraCards || 0;
    rewards.gradeUp += l.gradeUp || 0;
    rewards.godChance = Math.max(rewards.godChance, l.godChance || 0);
  }
  return { level: got.length ? got[got.length - 1].name : null, rank: got.length, rewards };
}

/** 勝ち負け・脱出・即終了を確かめる。V は直前の出しの論破値（過剰論破に使う） */
function settle(B, env, V = null) {
  if (B.result || B.shell) return;
  if (B.hp <= 0) return end(B, env, 'lose');
  if (B.pendingEscape) return end(B, env, 'escape');
  if (B.forceEnd) {
    const rest = B.enemies.filter((e) => !e.dead).reduce((s, e) => s.add(e.claim), ZERO);
    B.rewardRate = B.initialClaim.isZero() ? 1 : Math.max(0, 1 - rest.div(B.initialClaim).toNumber());
    log(B, { t: 'forceEnd', rewardRate: B.rewardRate });
    return end(B, env, 'win');
  }
  if (B.enemies.every((e) => e.dead)) {
    const r = V && !B.initialClaim.isZero() ? V.div(B.initialClaim) : ZERO;
    const ok = overkillOf(env.balance, r);
    const octx = { battle: B, env, V, r, ...ok };
    env.hooks.run('overkill', octx, (c) => {
      B.overkill = { r: c.r, level: c.level, rank: c.rank, rewards: c.rewards };
      B.zeni += c.rewards.zeni;
      if (c.level) emitAll(env, '過剰論破の時', c, new Set());
      log(B, { t: 'overkill', r: c.r, level: c.level, rewards: c.rewards });
    });
    end(B, env, 'win');
  }
}

function end(B, env, result) {
  B.result = result;
  const ctx = { battle: B, env, result };
  env.hooks.run('battle.end', ctx, () => emitAll(env, '戦闘終了', ctx, new Set()));
  for (const s of ['turn', 'battle', 'held']) expire(B, env, s);
  for (const r of B.seats) r.disabled = false;
  log(B, { t: 'end', result });
}

/**
 * 流す：1〜5枚を捨てて同じ枚数を引く
 * @param {number[]} indices
 */
export function discard(B, env, indices) {
  const { balance } = env;
  const P = balance.hands.play;
  check(!B.result, '戦闘は終わっている');
  check(!B.sealed.discard, '流しは封じられている');
  check(B.discardsLeft > 0, '流しが残っていない');
  check(!B.hand.some((c) => c.enh && balance.hands.enhancements[c.enh]?.blocksDiscard), '重しがあるので流せない');
  const idx = [...new Set(indices)].sort((a, b) => a - b);
  check(idx.length >= P.minCards && idx.length <= P.maxDiscardCards, `流せるのは${P.minCards}〜${P.maxDiscardCards}枚`);
  check(idx.every((i) => i >= 0 && i < B.hand.length), '手札にない札');
  env.hooks.beginChain();
  const cards = idx.map((i) => B.hand[i]);
  B.hand = B.hand.filter((_, i) => !idx.includes(i));
  for (const c of cards) { c.faceDown = false; B.discard.push(c); }
  B.discardsLeft -= 1;
  log(B, { t: 'discard', cards: cards.map((c) => c.name) });
  for (const c of cards) {
    const seal = c.seal && balance.hands.seals[c.seal];
    if (seal && seal.discardedItem) gainItem(B, env, seal.discardedItem, {});
    emitFor(env, '流した時', { battle: B, env, card: c }, c);
  }
  drawCards(B, env, cards.length);
  settle(B, env);
  sync(B, env);
}

/** ターン終了 → 敵の番 → 次のターン */
export function endTurn(B, env) {
  const { balance } = env;
  check(!B.result, '戦闘は終わっている');
  env.hooks.beginChain();
  const tctx = { battle: B, env };
  env.hooks.run('turn.end', tctx, () => {
    for (const c of B.hand) {
      const enh = c.enh && balance.hands.enhancements[c.enh];
      if (enh && enh.heldTurnEndZeni) { B.zeni += enh.heldTurnEndZeni; log(B, { t: 'zeni', add: enh.heldTurnEndZeni, why: c.name }); }
      const seal = c.seal && balance.hands.seals[c.seal];
      if (seal && seal.heldTurnEndItem && B.turnLastHand) gainItem(B, env, seal.heldTurnEndItem, { hand: B.turnLastHand });
    }
    emitAll(env, 'ターン終了', tctx, uidsOf(B.hand));
  });
  for (const c of B.hand) c.faceDown = false;
  expire(B, env, 'turn');
  settle(B, env);

  // 場の状態は決まったターン数で戻る
  tickMood(B, log);
  // 封じ（カテゴリ）は決まったターン数で解ける
  for (const [cat, n] of Object.entries(B.sealed.catTurns || {})) {
    if (n <= 1) { delete B.sealed.catTurns[cat]; B.sealed.cats = B.sealed.cats.filter((c) => c !== cat); log(B, { t: 'note', what: `〈${cat}〉の封じが解けた` }); }
    else B.sealed.catTurns[cat] = n - 1;
  }
  // 敵の番：左から予告どおり
  for (const e of B.enemies.slice()) {
    if (e.dead || B.result) continue;
    const ectx = { battle: B, env, enemy: e };
    env.hooks.run('enemy.before', ectx, () => emitAll(env, '敵の行動の前', ectx, new Set()));
    env.hooks.run('enemy.act', ectx, (c) => {
      const en = c.enemy;
      if (en.skip > 0) { en.skip -= 1; log(B, { t: 'act', enemy: en.uid, name: en.name, act: '行動できない' }); }
      else {
        const act = env.content.vocab.get('act', en.intent.name);
        if (!act) throw new Error(`知らない行動「${en.intent.name}」（${en.id}）`);
        act.run(B, env, en, en.intent.arg);
      }
      en.actIndex = (en.actIndex + 1) % en.acts.length;
      en.intent = en.acts[en.actIndex];
    });
    settle(B, env);
  }
  if (!B.result) startTurn(B, env);
  settle(B, env);
  sync(B, env);
}

/**
 * 宿泊客の固有行動（採配・植える・組み立てる・並べ替える）
 * @param {string} name 行動の名前 @param {object} [args]
 */
export function guestAction(B, env, name, args = {}) {
  check(!B.result, '戦闘は終わっている');
  const { g, m } = guestMechanic(env, B.guestSwap || B.guest);
  const fn = m?.actions?.[name];
  check(!!fn, `${g.name}は「${name}」ができない`);
  env.hooks.beginChain();
  const me = { params: g.params || {}, owner: { kind: 'guest', id: g.id, uid: g.id }, def: m };
  try {
    fn({ battle: B, env, args, choices: args }, me);
  } catch (err) {
    if (err.userError) throw err;
    log(B, { t: 'error', hook: `guest.${name}`, owner: me.owner, message: String(err.message ?? err) });
  }
  settle(B, env);
  sync(B, env);
}

/** 固有行動で使う「できない」の知らせ（特注から投げる） */
export function refuse(reason) { return Object.assign(new Error(reason), { userError: true }); }

/** 宿泊客の仕組みの1行（画面の計算窓の上に出す） */
export function guestStatus(B, env) {
  const id = B.guestSwap || B.guest;
  if (!id) return '';
  const { g, m } = guestMechanic(env, id);
  if (!m?.status) return g.name;
  try { return m.status(B, { params: g.params || {} }); } catch { return g.name; }
}

/**
 * お品書きを使う（戦闘中）
 * @param {number} index お品書きの番号 @param {object} [choices]
 */
export function useItem(B, env, index, choices = {}, opt = {}) {
  check(!B.result, '戦闘は終わっている');
  const item = B.items[index];
  check(!!item, 'お品書きがない');
  const def = item.id ? env.content.items?.[item.id] : null;
  const use = def?.use ?? '戦闘中';
  if (opt.outside) check(use !== '戦闘中', 'これは戦闘中にだけ使える');
  else check(use !== '戦闘外', 'これは戦闘中には使えない');
  const D = env.dive;
  check(!(def?.once === '潜行' && D?.flags?.used?.[def.id]), 'これは1回の潜行で1度しか使えない');
  if (def?.once === '潜行' && D) D.flags.used[def.id] = true;
  env.hooks.beginChain();
  B.items.splice(index, 1);
  log(B, { t: 'useItem', kind: item.kind, id: item.id, name: def?.name ?? item.kind });
  const target = choices.敵 != null ? Number(choices.敵) : null;
  const E = makeE({ battle: B, env, choices, target }, item, 'item', { id: item.id, name: def?.name ?? item.kind });
  try {
    if (def) { if (!def.if || testCond(E, def.if)) runDo(E, def.do || []); }
  } catch (err) {
    log(B, { t: 'error', hook: 'item.use', owner: { kind: 'item', id: item.id }, message: String(err.message ?? err) });
  }
  settle(B, env);
  sync(B, env);
}

/**
 * 出したらどうなるかの予測（状態は変えない）。
 * 乱数を使った出しは、別の乱数でも計算し、論破値が変わるなら uncertain（画面は「？」）にする
 * @returns {{hand:string, level:number, S:Big, M:Big, V:Big, uncertain:boolean, usedRandom:boolean, kills:number, allDead:boolean, scored:string[]}}
 */
export function predict(B, env, indices, target, choices) {
  const run = (rngState) => {
    const C = loadBattle(JSON.stringify({ ...B, log: [] }));
    if (rngState) C.rngState = rngState;
    const penv = openBattle({ balance: env.balance, content: env.content }, C);
    const before = penv.rng.calls;
    const res = play(C, penv, indices, target, { predict: true, choices });
    const entry = C.log.find((l) => l.t === 'play');
    return { res, C, entry, used: penv.rng.calls - before };
  };
  const first = run(null);
  let uncertain = false;
  if (first.used > 0) {
    for (const seed of ['予測1', '予測2', '予測3']) {
      const alt = run(Rng.fromSeed(seed).getState());
      if (!alt.res.V.eq(first.res.V)) { uncertain = true; break; }
    }
  }
  const { res, C, entry } = first;
  return {
    hand: res.hand, level: entry?.level ?? 1, S: entry?.S, M: entry?.M, V: res.V, uncertain, usedRandom: first.used > 0,
    kills: C.enemies.filter((e, i) => e.dead && !B.enemies[i]?.dead).length, allDead: C.enemies.every((e) => e.dead),
    scored: res.scored.map((c) => c.uid), kickers: res.kickers.map((c) => c.uid), steps: res.steps, overlap: entry?.overlap ?? {},
  };
}

/** 宿泊客の固有行動の一覧（画面のボタン用）。ask は画面で選ばせるもの */
export function guestActions(B, env) {
  const id = B.guestSwap || B.guest;
  if (!id) return [];
  const { m } = guestMechanic(env, id);
  return Object.keys(m?.actions || {}).map((name) => ({ name, label: m.ui?.[name]?.label ?? name, ask: m.ui?.[name]?.ask ?? [] }));
}

/** 出す札のうち、出す前に選ぶもの（宣言するカテゴリなど）。ルールの特注が choices を持っていれば */
export function choicesFor(env, cards) {
  const out = {};
  const scan = (list) => {
    for (const item of [].concat(list || [])) {
      if (!item || typeof item !== 'object') continue;
      const r = item.ルール;
      const def = r && env.content.vocab.get('rule', r.名前);
      if (def?.choices) for (const [k, type] of Object.entries(def.choices)) if (r[k.replace(/^宣言$/, 'カテゴリ')] == null) out[k] = type;
    }
  };
  for (const c of cards) for (const fx of env.content.cards?.[c.id]?.fx || []) scan(fx.do);
  return out;
}

Object.assign(API, {
  log, newUid, addMod, addRule, shiftBanzuke, setBanzuke, drawCards, gainItem, spawnCard, removeCard, killEnemy,
  hitPlayer, makeEnemy, attachEnemy, makeBattleCard, refuse, findOwner, topCategory, mostCategory, depthMods, playCards, aliveIndex, cardStrength, cardView, attachCard, emitFor,
});

// 効果を動かす場（E）と、条件・効果の実行（仕様書 第9章「合図・条件・効果」）
//
// E = { B, env, ctx（差し込み口・合図の ctx）, sc（採点中なら採点の場、そうでなければ null）,
//       self（効果の持ち主の個体）, selfKind（card／regular／relic／guest／item／quirk／enemy）,
//       subject（「この札」）, target（狙った敵の番号）, me（params など）, src（記録用の出どころ）,
//       choices（プレイヤーが選んだもの） }

import { evalExpr } from './expr.js';
import { scaleBy, rarDef, SCALE_VERBS } from '../rarity.js';
import { cardView } from '../hand.js';
import { cardStrength } from '../score.js';

/** 効果の場を作る */
export function makeE(ctx, self, selfKind, me = {}) {
  const B = ctx.battle;
  const env = ctx.env;
  const sc = ctx.addS ? ctx : null;
  let subject = ctx.card ?? null;
  if (!subject && selfKind === 'card') subject = self;
  const target = ctx.target ?? sc?.target ?? null;
  const name = self?.name ?? me.name ?? self?.id ?? null;
  // レアリティ：札と、客間で世話をした常連客の効果の量を増やす（刻印などは増えない）
  const rar = (selfKind === 'card' || selfKind === 'regular') && !me.affix ? self?.rar ?? null : null;
  return {
    B, env, ctx, sc, self, selfKind, subject, target, me, rar,
    choices: ctx.choices ?? sc?.choices ?? {},
    src: { kind: selfKind, id: self?.id ?? me.id ?? null, uid: self?.uid ?? null, name },
  };
}

/** 式の名前の値 */
export function lookup(E, name) {
  const v = E.env.content.vocab.get('var', name);
  if (v) return v.get(E);
  for (const o of [E.subject?.vars, E.self?.vars, E.B?.guestState]) {
    if (o && typeof o[name] === 'number') return o[name];
  }
  if (E.me?.params && typeof E.me.params[name] === 'number') return E.me.params[name];
  return 0;
}

/** 数か式を数に */
export function num(E, x) { return evalExpr(x, (n) => lookup(E, n)); }

/** 量の数（レアリティで増える）。mode：add・mul・draw */
export function sn(E, x, mode = 'add') {
  const n = num(E, x);
  return E.rar ? scaleBy(E.env.balance, E.rar, n, mode) : n;
}

/** do の並びに量の語彙があるか（無ければレアリティで繰り返す） */
export function hasScale(list) {
  // ルールを掛ける効果は繰り返さない（同じルールが重なって掛け算で増えてしまう）
  return (Array.isArray(list) ? list : [list]).some((item) => (typeof item === 'object' && item && Object.keys(item).some((k) => SCALE_VERBS[k] || k === 'ルール')) || item === 'ルール');
}

/** 条件（1つのオブジェクト、または並び）が全て成り立つか */
export function testCond(E, cond) {
  if (cond == null) return true;
  if (Array.isArray(cond)) return cond.every((c) => testCond(E, c));
  const vocab = E.env.content.vocab;
  for (const [k, arg] of Object.entries(cond)) {
    const def = vocab.get('if', k);
    if (!def) {
      if (vocab.list('if').some((d) => d.extra && Object.keys(d.extra).some((x) => x.replace(/\?$/, '') === k))) continue;
      throw new Error(`知らない条件「${k}」`);
    }
    if (!def.test(E, arg, cond)) return false;
  }
  return true;
}

/** 効果の並びを実行する。[{名前: 引数}, '名前', ...] */
export function runDo(E, list) {
  const vocab = E.env.content.vocab;
  for (const item of Array.isArray(list) ? list : [list]) {
    const [name, arg] = typeof item === 'string' ? [item, null] : Object.entries(item)[0];
    const def = vocab.get('do', name);
    if (!def) throw new Error(`知らない効果「${name}」`);
    if (def.score && !E.sc) throw new Error(`効果「${name}」は採点の中でだけ使える`);
    def.run(E, arg);
  }
}

/** fx の1項目 {when, if, do} を、合図の中で動かす */
export function runFx(E, fx) {
  if (fx.if && !testCond(E, fx.if)) return false;
  const times = E.rar && !hasScale(fx.do) ? rarDef(E.env.balance, E.rar).repeat : 1;
  for (let i = 0; i < times; i++) runDo(E, fx.do);
  return true;
}

// ───────────────────────── 対象を決める ─────────────────────────

const rankOf = (balance, slot) => (balance.tiers.tiers[slot] || balance.tiers.missing?.[slot] || { rank: -Infinity }).rank;

/** カテゴリの指定を実際のカテゴリに（複数を返すこともある） */
export function resolveCategory(E, word) {
  const { balance } = E.env;
  const cats = balance.tiers.categories;
  const B = E.B;
  const slot = (c) => B.banzuke[c] ?? balance.tiers.banzukeStart;
  switch (word) {
    case 'この札': {
      const c = E.subject ? cardView(E.subject, balance).cats : [];
      return c.length ? [c[0]] : [];
    }
    case '乱数': return [E.env.rng.pick(cats)];
    case '相手': return [...new Set(B.enemies.filter((e) => !e.dead && e.cat).map((e) => e.cat))];
    case '直前に出した札': return B.lastPlayedCats?.length ? [B.lastPlayedCats[0]] : [];
    case '選ぶ': return [E.choices.カテゴリ && cats.includes(E.choices.カテゴリ) ? E.choices.カテゴリ : cats[0]];
    case '手札で一番多い': {
      const n = {};
      for (const c of B.hand) for (const x of cardView(c, balance).cats) n[x] = (n[x] || 0) + 1;
      let best = cats[0];
      for (const c of cats) if ((n[c] || 0) > (n[best] || 0)) best = c;
      return [best];
    }
    case '一番高い': case '一番低い': {
      let best = cats[0];
      for (const c of cats) {
        const d = rankOf(balance, slot(c)) - rankOf(balance, slot(best));
        if (word === '一番高い' ? d > 0 : d < 0) best = c;
      }
      return [best];
    }
    default:
      if (!cats.includes(word)) throw new Error(`知らないカテゴリ「${word}」`);
      return [word];
  }
}

/** 札の指定を実際の札に */
export function resolveCards(E, word, n = 1) {
  const B = E.B;
  const { balance } = E.env;
  const strength = (c) => cardStrength(c, balance, B.banzuke);
  switch (word ?? 'この札') {
    case 'この札': return E.subject ? [E.subject] : [];
    case '手札全部': return B.hand.slice();
    case '手札の乱数': return E.env.rng.shuffle(B.hand).slice(0, n);
    case '手札の一番強い': return B.hand.slice().sort((a, b) => strength(b) - strength(a)).slice(0, n);
    case '手札の一番弱い': return B.hand.slice().sort((a, b) => strength(a) - strength(b)).slice(0, n);
    case '手札の左端': return B.hand.slice(0, n);
    case '手札の右端': return B.hand.slice(-n);
    case '出した札': return (B.inPlay || []).slice();
    case '手札から選ぶ': { const c = B.hand.find((x) => x.uid === E.choices.札) ?? B.hand[0]; return c ? [c] : []; }
    default: throw new Error(`札の指定「${word}」を知らない`);
  }
}

export const CARD_TARGETS = ['この札', '手札全部', '手札の乱数', '手札の一番強い', '手札の一番弱い', '手札の左端', '手札の右端', '出した札', '手札から選ぶ'];

/** 敵の指定を実際の敵に */
export function resolveEnemies(E, word) {
  const B = E.B;
  const alive = B.enemies.filter((e) => !e.dead);
  switch (word ?? '狙い') {
    case '狙い': {
      const t = E.target != null && B.enemies[E.target] && !B.enemies[E.target].dead ? B.enemies[E.target] : alive[0];
      return t ? [t] : [];
    }
    case '敵全員': return alive;
    case '乱数': return alive.length ? [E.env.rng.pick(alive)] : [];
    case '左端': return alive.slice(0, 1);
    case '一番強い': return alive.slice().sort((a, b) => b.claim.cmp(a.claim)).slice(0, 1);
    default: throw new Error(`敵の指定「${word}」を知らない`);
  }
}

export const ENEMY_TARGETS = ['狙い', '敵全員', '乱数', '左端', '一番強い'];

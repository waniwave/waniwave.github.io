// 語彙：ルール改変（rule）（仕様書 第9章）
// ルールは差し込み口・合図に効く形で書く。関数は (ctx, next, me) と (ctx, me) の形で、
// me = { params（YAMLで渡した値）, rule（範囲など）, owner }。
// apply / expire は掛けた瞬間と外れる瞬間に1回だけ呼ばれる。
// 画面にだけ効くもの（効果文を偽る など）は B.flags に印を立て、段階3以降の画面が読む。

import { makeE, testCond } from './effect.js';
import { setBanzuke, addRule, swapGuest, restoreGuest, log } from '../battle.js';
import { cardStrength } from '../score.js';

const flagOn = (B, k) => { B.flags[k] = (B.flags[k] || 0) + 1; };
const flagOff = (B, k) => { B.flags[k] = Math.max(0, (B.flags[k] || 0) - 1); if (!B.flags[k]) delete B.flags[k]; };
const flagRule = (name, text) => ({ name, text, args: null, apply: (B) => flagOn(B, name), expire: (B) => flagOff(B, name) });

function mostOf(values) {
  const n = new Map();
  for (const v of values) n.set(v, (n.get(v) || 0) + 1);
  let best = null;
  for (const [k, c] of n) if (best === null || c > n.get(best)) best = k;
  return best;
}

function reverseBanzuke(B, env, src) {
  const steps = env.balance.tiers.banzukeSteps;
  for (const c of env.balance.tiers.categories) {
    const i = steps.indexOf(B.banzuke[c]);
    if (i >= 0) setBanzuke(B, env, c, steps[steps.length - 1 - i], src);
  }
}

export const RULES = [
  { name: '処理回数', text: '採点と常連客の発動を N 回ずつ通す', args: { 回数: 'int' },
    hooks: {
      'score.card': (c, next, me) => { for (let i = 0; i < me.params.回数; i++) next(); },
      'score.regulars': (c, next, me) => { for (let i = 0; i < me.params.回数; i++) next(); },
    } },
  { name: '組を宣言', text: '宣言した組として採点する（成立していなくても）。出した札は全て採点', args: { '組?': 'hand' },
    hooks: {
      'hand.evaluate': (c, next, me) => {
        next();
        const order = c.env.balance.hands.order;
        const h = me.params.組 ?? c.choices?.宣言 ?? order[0];
        if (!c.env.balance.hands.hands[h]) throw new Error(`宣言した組「${h}」は無い`);
        c.result = { ...c.result, hand: h, scored: c.views.map((_, i) => i), kickers: [] };
      },
    } },
  { name: '重ね数', text: '揃いの判定で、掛けた札を N 枚分として数える（1つの揃いは5枚分まで）', args: { 枚数: 'int' },
    hooks: {
      'hand.evaluate': (c, next, me) => {
        const i = c.cards.findIndex((x) => x.uid === me.owner?.uid);
        if (i >= 0 && !c.views[i].stone) c.views = c.views.map((v, k) => (k === i ? { ...v, count: me.params.枚数 } : v));
        next();
      },
    } },
  { name: '組を1段上として扱う', text: '成立した組を、優先順で1つ上の組として扱う', args: null,
    hooks: {
      'hand.evaluate': (c, next) => {
        next();
        const order = c.env.balance.hands.order;
        const i = order.indexOf(c.result.hand);
        if (i > 0) c.result = { ...c.result, hand: order[i - 1] };
      },
    } },
  { name: '全札を同カテゴリ扱い', text: '組の判定で、出した札を全て同じカテゴリとして扱う（省略時は一番多いカテゴリ）', args: { 'カテゴリ?': 'category' },
    hooks: {
      'hand.evaluate': (c, next, me) => {
        const cat = me.params.カテゴリ ?? mostOf(c.views.flatMap((v) => v.cats));
        if (cat) c.views = c.views.map((v) => (v.stone ? v : { ...v, cats: [cat] }));
        next();
      },
    } },
  { name: '全札を同Tier扱い', text: '組の判定で、出した札を全て同じTierとして扱う（省略時は一番多いTier）', args: { 'Tier?': 'tier' },
    hooks: {
      'hand.evaluate': (c, next, me) => {
        const t = me.params.Tier != null ? String(me.params.Tier) : mostOf(c.views.filter((v) => !v.stone).map((v) => v.tier));
        if (t != null) c.views = c.views.map((v) => (v.stone ? v : { ...v, tier: t }));
        next();
      },
    } },
  { name: '採点順を逆に', text: '採点札を右から採点する', args: null,
    hooks: { 'score.order': (c, next) => { next(); c.scored.reverse(); } } },
  { name: '採点順を並べ替える', text: '採点の順番を基準で並べ替える', args: { 基準: ['強い順', '弱い順', 'Tier順'] },
    hooks: {
      'score.order': (c, next, me) => {
        next();
        const b = c.env.balance;
        const key = me.params.基準 === 'Tier順'
          ? (x) => -(b.tiers.tiers[x.tier]?.rank ?? -99)
          : (x) => (me.params.基準 === '強い順' ? -1 : 1) * cardStrength(x, b);
        c.scored.sort((x, y) => key(x) - key(y));
      },
    } },
  { name: '番付を反転', text: '掛けている間、番付が上下反転する（外れると戻る）', args: null,
    apply: (B, env, r) => reverseBanzuke(B, env, r.owner), expire: (B, env, r) => reverseBanzuke(B, env, r.owner) },
  { name: '番付を固定', text: '番付が動かなくなる', args: null,
    hooks: { 'banzuke.change': (c) => { log(c.battle, { t: 'note', what: '番付は固定されている', cat: c.cat }); } } },
  { name: '番付倍率をN倍', text: '番付倍率（足す分）を N 倍にする', args: { 倍: 'number' },
    hooks: { 'score.order': (c, next, me) => { c.banzukeMul *= me.params.倍; next(); } } },
  { name: '回数を変える', text: '戦闘のあいだ、出し・流し・手札の上限を増減する', args: { '出し?': 'int', '流し?': 'int', '手札上限?': 'int' },
    hooks: {
      'battle.start': (c, next, me) => {
        const { addMod } = c.env.api;
        if (me.params.出し) addMod(c.battle, 'plays', me.params.出し, 'battle');
        if (me.params.流し) addMod(c.battle, 'discards', me.params.流し, 'battle');
        if (me.params.手札上限) addMod(c.battle, 'handSize', me.params.手札上限, 'battle');
        next();
      },
    } },
  { name: '段位を足す', text: '掛けている間、組の段位を N 足す（外れると戻る）', args: { 組: 'hand', 段: 'int' },
    apply: (B, env, r) => { const k = r.params.組; B.handLevels[k] = (B.handLevels[k] ?? env.balance.hands.levelStart ?? 1) + r.params.段; },
    expire: (B, env, r) => { const k = r.params.組; B.handLevels[k] = Math.max(env.balance.hands.levelStart ?? 1, (B.handLevels[k] ?? 1) - r.params.段); } },
  { name: '受けを無効', text: '出した札が受けにならない', args: null,
    on: { 受けに回る: (c) => { c.guard = 0; } } },
  { name: '受けを攻撃に加える', text: '受けになる札の分を、受けでなく強さ（S）に足す', args: null,
    hooks: {
      'score.final': (c, next) => {
        const b = c.env.balance;
        let s = 0;
        for (const k of c.kickers) {
          const enh = k.enh && b.hands.enhancements[k.enh];
          s += cardStrength(k, b) * (enh?.guardMul ?? 1);
        }
        if (s) c.addS(s, { kind: 'rule', name: '受けを攻撃に加える' });
        next();
      },
    },
    on: { 受けに回る: (c) => { c.guard = 0; } } },
  { name: '採点札を限定', text: '条件に合う札だけを採点し、ほかは受けにする', args: { 条件: 'cond' },
    hooks: {
      'hand.evaluate': (c, next, me) => {
        next();
        const keep = c.result.scored.filter((i) => testCond(makeE({ battle: c.battle, env: c.env, card: c.cards[i] }, c.cards[i], 'card'), me.params.条件));
        const kick = c.views.map((_, i) => i).filter((i) => !keep.includes(i));
        c.result = { ...c.result, scored: keep, kickers: kick };
      },
    } },
  { name: '出せる枚数を固定', text: '出せる札の枚数をちょうど N 枚にする', args: { 枚数: 'int' },
    apply: (B, env, r) => { B.fixedPlay = r.params.枚数; }, expire: (B) => { B.fixedPlay = null; } },
  { name: '戦闘を即終了', text: 'その場で戦闘を終わらせる（勝ち。報酬は敵の残り主張の割合だけ減る）', args: null,
    apply: (B) => { B.forceEnd = true; } },
  { name: '敵の行動を乱数に', text: '敵の行動を、その敵の行動の並びから乱数で選ぶ', args: null,
    hooks: { 'enemy.act': (c, next) => { const e = c.enemy; e.intent = c.env.rng.pick(e.acts); next(); } } },
  { name: '手札を公開', text: '伏せを無効にする（裏向きの札が表になる）', args: null,
    apply: (B) => { B.hand.forEach((x) => { x.faceDown = false; }); },
    hooks: { 'turn.start': (c, next) => { next(); c.battle.hand.forEach((x) => { x.faceDown = false; }); } } },
  { name: '山札の上を見る・並べ替える', text: '山札の上 N 枚を見る。並びを選べば並べ替える', args: { 枚数: 'int', '並び?': 'any' },
    apply: (B, env, r) => {
      const order = r.params.並び;
      const n = r.params.枚数;
      if (Array.isArray(order) && order.length === Math.min(n, B.draw.length)) {
        const top = B.draw.slice(0, order.length);
        B.draw.splice(0, order.length, ...order.map((i) => top[i]));
      }
      B.peek = B.draw.slice(0, n).map((x) => x.uid);
      log(B, { t: 'peek', cards: B.draw.slice(0, n).map((x) => x.name) });
    } },
  { name: '倍率の下限を変える', text: '最後に倍率がこれ未満なら、これにする', args: { 下限: 'number' },
    hooks: { 'score.final': (c, next, me) => { c.minM = me.params.下限; next(); } } },
  flagRule('効果文を偽る', '効果文がでたらめに書き換わって表示される（効果は変わらない）'),
  { name: '伏せ字', text: '解放済みの目玉ルールから乱数で1つを、同じ範囲で掛ける', args: null,
    apply: (B, env, r) => {
      const pool = (env.content.keywordRules || []).filter((k) => k !== '伏せ字' && env.content.vocab.has('rule', k));
      if (!pool.length) return;
      const k = env.rng.pick(pool);
      log(B, { t: 'note', what: `伏せ字：${k}` });
      addRule(B, env, { name: k, scope: r.scope, params: {}, owner: r.owner, group: r.group });
    } },
  flagRule('演出を早送り不可に', 'その間の演出は早送りできない'),
  { name: '宿泊客の仕組みを入れ替える', text: '宿泊客の固有の仕組みを、別の宿泊客のものに変える（省略時は乱数）', args: { '宿泊客?': 'guestId' },
    apply: (B, env, r) => swapGuest(B, env, r.params.宿泊客 ?? null), expire: (B, env) => restoreGuest(B, env) },
  flagRule('襖を見せる', '襖の「？」が全て見える（段階4の階の画面が読む）'),
];


// 目玉ルール「交互」：採点の順番をカテゴリが交互になるように並べ替え、交互が続いた数だけ倍率×（掛け）

/** 左から、直前の札とカテゴリを共有しない札を優先して並べる */
function alternate(cards, catsOf) {
  const rest = cards.slice();
  const out = [rest.shift()];
  while (rest.length) {
    const last = catsOf(out[out.length - 1]);
    const i = rest.findIndex((c) => !catsOf(c).some((x) => last.includes(x)));
    out.push(rest.splice(i >= 0 ? i : 0, 1)[0]);
  }
  return out;
}

export default {
  name: '交互',
  kind: 'rule',
  text: '採点の順番をカテゴリが交互になるよう並べ替え、交互が続いた数だけ倍率×（掛け、省略時1.5）',
  args: { '掛け?': 'number' },
  hooks: {
    'score.order': (ctx, next) => {
      next();
      if (ctx.scored.length < 2) { ctx.kougo = 0; return; }
      const catsOf = (c) => c.cat || [];
      const order = alternate(ctx.scored, catsOf);
      ctx.scored.splice(0, ctx.scored.length, ...order);
      let n = 0;
      for (let i = 1; i < order.length; i++) {
        if (!catsOf(order[i]).some((x) => catsOf(order[i - 1]).includes(x))) n++;
      }
      ctx.kougo = n;
    },
    'score.final': (ctx, next, me) => {
      if (ctx.kougo > 0) ctx.mulM((me.params.掛け ?? 1.5) ** ctx.kougo, { kind: 'rule', name: `交互×${ctx.kougo}` });
      next();
    },
    'fx.queue': (ctx, next) => { ctx.fx.push({ show: '横切る', arg: '串', src: { kind: 'rule', name: '交互' } }); next(); },
  },
  tests: [
    // 三揃（食べ物・食べ物・麺）→ 食べ物・麺・食べ物 で交互2つ：(30＋18)×3×1.5²＝324
    { name: '交互に並べ替える', hand: ['rk_yakitori', { tier: 3, cat: ['食べ物'] }, { tier: 3, cat: ['麺'] }], expect: { V: 324, なしより大きい: true } },
    // 全て同じカテゴリなら交互は0
    { name: '同じカテゴリなら掛けない', hand: ['rk_yakitori', { tier: 3, cat: ['食べ物'] }], expect: { V: (10 + 12) * 2 } },
  ],
};

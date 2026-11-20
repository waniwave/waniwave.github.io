// 目玉ルール「交互」：出した札を孤立していても全て採点し、カテゴリが交互（隣の札とカテゴリを共有しない）に
// なるよう採点の順番を並べ替え、交互が続いた数だけ倍率×（掛け）。重なりとは逆の、ばらばらの出し方が得をする

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
  text: '出した札を全て採点し、カテゴリが交互になるよう並べ替え、交互が続いた数だけ倍率×（掛け、省略時1.5）',
  args: { '掛け?': 'number' },
  hooks: {
    'hand.evaluate': (ctx, next) => {
      next();
      ctx.result = { ...ctx.result, scored: ctx.views.map((_, i) => i), kickers: [] };
    },
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
    // 食べ物・食べ物・麺 → 食べ物・麺・食べ物 で交互2つ。強さ30、重なり 食べ物2（×1.5）、交互 1.5²：30×1.5×2.25＝101
    { name: '交互に並べ替える', hand: [{ tier: 3, cat: ['食べ物'], kw: ['交互'] }, { tier: 3, cat: ['食べ物'] }, { tier: 3, cat: ['麺'] }], expect: { V: 101, なしより大きい: true } },
    // 全て同じカテゴリなら交互は0：20×1.5＝30
    { name: '同じカテゴリなら掛けない', hand: [{ tier: 3, cat: ['食べ物'], kw: ['交互'] }, { tier: 3, cat: ['食べ物'] }], expect: { V: 30 } },
  ],
};

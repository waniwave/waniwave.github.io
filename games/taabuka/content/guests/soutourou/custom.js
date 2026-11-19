// 相当老の固有の仕組み「熟成」：
// ターンの終わりに、手札に残った札の熟成＋1（その戦闘のあいだ）。採点時に強さ＋熟成×S、倍率＋熟成×M。手札の上限は「手札」枚。
export default {
  name: '熟成',
  kind: 'mechanic',
  text: 'ターンの終わりに手札に残った札の熟成＋1。採点時に強さ＋熟成×3、倍率＋熟成×0.5。手札の上限7',
  params: { S: 3, M: 0.5, 手札: 7 },
  hooks: {
    'battle.start': (ctx, next, me) => {
      const { battle: B, env } = ctx;
      const d = me.params.手札 - env.balance.hands.play.handSize;
      if (d) env.api.addMod(B, 'handSize', d, 'battle');
      next();
    },
  },
  on: {
    ターン終了: (ctx) => {
      for (const c of ctx.battle.hand) c.vars.熟成 = (c.vars.熟成 ?? 0) + 1;
    },
    採点時: (ctx, me) => {
      const n = ctx.card.vars?.熟成 ?? 0;
      if (!n) return;
      const src = { kind: 'guest', id: 'soutourou', name: `熟成${n}（${ctx.card.name}）` };
      ctx.addS(n * me.params.S, src);
      ctx.addM(n * me.params.M, src);
    },
  },
  status: (B) => {
    const max = B.hand.reduce((m, c) => Math.max(m, c.vars?.熟成 ?? 0), 0);
    return `熟成：手札の札が育つ（いちばん熟れた札 ${max}）`;
  },
  tests: [
    // 熟成2の札：単騎 S＝5＋6＋6＝17、M＝1＋1＝2 → 34
    { name: '熟成で強くなる', guest: 'soutourou', hand: [{ tier: 3, cat: ['麺'] }, { tier: 5, cat: ['死'] }],
      steps: [{ end: true }, { end: true }, { play: [0] }], expect: { V以上: 34 } },
  ],
};

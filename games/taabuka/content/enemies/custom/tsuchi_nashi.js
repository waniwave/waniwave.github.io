// 層主「自己紹介をしない土」：毎ターン、番付の一番高いカテゴリを始めの段（T3）に戻す
export default {
  name: '名乗らない',
  kind: 'enemy',
  text: 'ターン開始のたびに、番付で一番高いカテゴリを始めの段に戻す',
  hooks: {
    'turn.start': (ctx, next, me) => {
      const B = ctx.battle;
      const { api, balance } = { api: ctx.env.api, balance: ctx.env.balance };
      const e = api.findOwner(B, me.owner);
      if (e && !e.dead && B.turn > 1) {
        const cat = api.topCategory(B, ctx.env);
        if (cat && B.banzuke[cat] !== balance.tiers.banzukeStart) api.setBanzuke(B, ctx.env, cat, balance.tiers.banzukeStart, { name: e.name });
      }
      next();
    },
  },
};

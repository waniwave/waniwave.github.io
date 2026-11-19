// 通常「ネタ枠」：倒されると、番付を乱数で1つ動かす
export default {
  name: 'ネタ枠',
  kind: 'enemy',
  text: '倒されると、乱数のカテゴリ1つを乱数で1段上げるか下げる',
  hooks: {
    'enemy.defeated': (ctx, next, me) => {
      next();
      if (ctx.enemy.uid !== me.owner.uid || !ctx.enemy.dead) return;
      const { env, battle: B } = ctx;
      const cat = env.rng.pick(env.balance.tiers.categories);
      env.api.shiftBanzuke(B, env, cat, env.rng.chance(0.5) ? 1 : -1, { name: ctx.enemy.name });
    },
  },
};

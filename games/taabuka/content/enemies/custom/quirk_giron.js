// 層の癖「議論の淵」（第三層）：戦闘の2ターン目から、ターンの始めに先頭の敵が番付を動かす
export default {
  name: '議論の淵',
  kind: 'rule',
  text: '戦闘の2ターン目から、ターンの始めに先頭の敵が乱数のカテゴリを1段上げるか下げる（毎ターン の回数だけ）',
  args: { '毎ターン?': 'int' },
  hooks: {
    'turn.start': (ctx, next, me) => {
      next();
      const { battle: B, env } = ctx;
      const e = B.enemies.find((x) => !x.dead);
      if (!e || B.turn < 2) return;
      for (let i = 0; i < (me.params.毎ターン ?? 1); i++) {
        const cat = env.rng.pick(env.balance.tiers.categories);
        env.api.shiftBanzuke(B, env, cat, env.rng.chance(0.5) ? 1 : -1, { name: e.name });
      }
    },
  },
};

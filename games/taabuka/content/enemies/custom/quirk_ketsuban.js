// 層の癖「欠番区画」（第四層）：欠番の枠が開く。欠番に何もいなければ、戦闘の始めに番付の一番低いカテゴリが欠番へ落ちる
export default {
  name: '欠番区画',
  kind: 'rule',
  text: '戦闘の始めに、欠番に何もいなければ、番付で一番低いカテゴリを「先」の欠番へ移す',
  args: { '先?': 'slot' },
  hooks: {
    'battle.start': (ctx, next, me) => {
      const { battle: B, env } = ctx;
      const T = env.balance.tiers;
      const missing = Object.keys(T.missing || {});
      if (missing.length && !T.categories.some((c) => missing.includes(B.banzuke[c]))) {
        let low = null, rank = Infinity;
        for (const c of T.categories) {
          const r = T.tiers[B.banzuke[c]]?.rank ?? Infinity;
          if (r < rank) { low = c; rank = r; }
        }
        if (low) env.api.setBanzuke(B, env, low, me.params.先 ?? missing[0], { name: '欠番区画' });
      }
      next();
    },
  },
};

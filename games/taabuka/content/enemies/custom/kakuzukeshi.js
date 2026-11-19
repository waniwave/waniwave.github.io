// 層主「格付け師」：毎ターンの始めに、番付の一部（乱数の「枚数」カテゴリ）の段を混ぜ直す
export default {
  name: '格付け師',
  kind: 'enemy',
  text: 'ターン開始のたびに、乱数のカテゴリ「枚数」個の段を互いに入れ替える（欠番にいるものは動かない）',
  params: { 枚数: 4 },
  hooks: {
    'turn.start': (ctx, next, me) => {
      next();
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (!e || e.dead) return;
      const steps = env.balance.tiers.banzukeSteps;
      const cats = env.rng.shuffle(env.balance.tiers.categories.filter((c) => steps.includes(B.banzuke[c]))).slice(0, me.params.枚数);
      const slots = env.rng.shuffle(cats.map((c) => B.banzuke[c]));
      cats.forEach((c, i) => { if (B.banzuke[c] !== slots[i]) env.api.setBanzuke(B, env, c, slots[i], { name: e.name }); });
    },
  },
};

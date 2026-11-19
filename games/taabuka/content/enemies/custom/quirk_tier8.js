// 層の癖「Tier8の罠」（第五層）：ターンの始めに、確率でそのターン全札がTier8扱いになる
export default {
  name: 'Tier8の罠',
  kind: 'rule',
  text: 'ターンの始めに「確率」で、そのターンだけ全札をTier8扱いにする',
  args: { '確率?': 'number' },
  hooks: {
    'turn.start': (ctx, next, me) => {
      next();
      const { battle: B, env } = ctx;
      if (!env.rng.chance(me.params.確率 ?? 0.25)) return;
      env.api.addRule(B, env, { name: '全札を同Tier扱い', params: { Tier: '8' }, scope: 'turn', group: 'quirk', owner: { kind: 'quirk', id: 'Tier8の罠' } });
      env.api.log(B, { t: 'note', what: '罠：このターン、全札がTier8扱い' });
    },
  },
};

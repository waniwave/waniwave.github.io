// 層主「Tier8」：奇数ターンは全札がTier8扱い
export default {
  name: 'Tier8',
  kind: 'enemy',
  text: '奇数ターンの始めに、そのターンだけ全札をTier8扱いにする',
  hooks: {
    'turn.start': (ctx, next, me) => {
      next();
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (!e || e.dead || B.turn % 2 === 0) return;
      env.api.addRule(B, env, { name: '全札を同Tier扱い', params: { Tier: '8' }, scope: 'turn', group: 'enemy', owner: me.owner });
      env.api.log(B, { t: 'act', enemy: e.uid, name: e.name, act: '全札がTier8扱い' });
    },
  },
};

// 層主「秒速5タームメートル」：ターンの終わりに、残った手札が全て流れ去る（持ち越せない）
export default {
  name: '秒速5タームメートル',
  kind: 'enemy',
  text: 'ターンの終わりに、手札に残った札を全て捨て札へ流す',
  hooks: {
    'turn.end': (ctx, next, me) => {
      next();
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (!e || e.dead || !B.hand.length) return;
      const n = B.hand.length;
      for (const c of B.hand) c.faceDown = false;
      B.discard.push(...B.hand.splice(0));
      env.api.log(B, { t: 'act', enemy: e.uid, name: e.name, act: `手札${n}枚が流れ去った` });
    },
  },
};

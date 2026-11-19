// 層主「スレ立て」：毎ターン、手札1枚を伏せる
export default {
  name: 'スレ立て',
  kind: 'enemy',
  text: 'ターン開始のたびに、手札の乱数1枚を裏向きにする',
  hooks: {
    'turn.start': (ctx, next, me) => {
      next();
      const B = ctx.battle;
      const e = ctx.env.api.findOwner(B, me.owner);
      if (!e || e.dead) return;
      const open = B.hand.filter((c) => !c.faceDown);
      const c = ctx.env.rng.pick(open);
      if (!c) return;
      c.faceDown = true;
      ctx.env.api.log(B, { t: 'faceDown', n: 1, by: e.name });
    },
  },
};

// 層主「襖の主」：出しはターン1回。代わりに流し＋2
export default {
  name: '襖の主',
  kind: 'enemy',
  text: 'このターンの出しを1回に減らし、流しを＋2する（毎ターン）',
  params: { 出し: 1, 流し: 2 },
  hooks: {
    'turn.start': (ctx, next, me) => {
      next();
      const B = ctx.battle;
      const { api } = ctx.env;
      const e = api.findOwner(B, me.owner);
      if (!e || e.dead) return;
      if (B.playsLeft > me.params.出し) api.addMod(B, 'plays', me.params.出し - B.playsLeft, 'turn');
      api.addMod(B, 'discards', me.params.流し, 'turn');
    },
  },
};

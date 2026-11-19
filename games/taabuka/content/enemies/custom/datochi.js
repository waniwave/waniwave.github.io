// 層主「dat落ち」：決まったターンの始めに、自分（プレイヤー）の体力が半分になる
export default {
  name: 'dat落ち',
  kind: 'enemy',
  text: 'params のターンの始めに、体力を半分にする（切り上げ）',
  params: { ターン: 7 },
  hooks: {
    'turn.start': (ctx, next, me) => {
      next();
      const B = ctx.battle;
      const e = ctx.env.api.findOwner(B, me.owner);
      if (!e || e.dead || B.turn !== me.params.ターン) return;
      const before = B.hp;
      B.hp = Math.ceil(B.hp / 2);
      ctx.env.api.log(B, { t: 'hp', add: B.hp - before, hp: B.hp, src: e.name });
    },
  },
};

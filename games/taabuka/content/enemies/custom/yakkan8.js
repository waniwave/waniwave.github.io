// 層主「宿泊約款第8条」：出す札はちょうど「枚数」枚（手札が足りなければ手札全部）
export default {
  name: '宿泊約款第8条',
  kind: 'enemy',
  text: '戦闘のあいだ、出す札の枚数をちょうど「枚数」枚にする',
  params: { 枚数: 5 },
  hooks: {
    'battle.start': (ctx, next, me) => {
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (e && !e.dead) env.api.addRule(B, env, { name: '出せる枚数を固定', params: { 枚数: me.params.枚数 }, scope: 'battle', group: 'enemy', owner: me.owner });
      next();
    },
  },
};

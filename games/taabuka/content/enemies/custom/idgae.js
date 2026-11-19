// 通常「ID変え」：一度だけ、倒されても別人として戻ってくる（最大主張の params.戻り の割合で）
export default {
  name: 'ID変え',
  kind: 'enemy',
  text: '一度だけ、倒されても最大主張の「戻り」の割合で戻ってくる',
  params: { 戻り: 0.35 },
  hooks: {
    'enemy.defeated': (ctx, next, me) => {
      const e = ctx.enemy;
      if (e.uid !== me.owner.uid || e.vars.changed) { next(); return; }
      e.vars.changed = true;
      e.claim = e.maxClaim.mul(me.params.戻り).round();
      ctx.env.api.log(ctx.battle, { t: 'form', enemy: e.uid, name: e.name, form: 2, claim: e.claim, what: 'IDを変えて戻ってきた' });
    },
  },
};

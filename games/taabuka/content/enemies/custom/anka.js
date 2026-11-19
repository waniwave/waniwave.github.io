// 精鋭「安価」：次の行動を、自分（プレイヤー）が最後に出した組で決める
export default {
  name: '安価',
  kind: 'enemy',
  text: '出しの後、次の行動が「最後に出した組」で決まる（組と行動の対応は params）',
  params: { 単騎: { 攻め: 1.5 }, 対: { 伏せ: 2 }, 二対: { 格下げ: 1 }, 三揃: '溜め', 階段: '全体攻め', 同類: { 封じ: '最多カテゴリ' }, その他: '攻め' },
  hooks: {
    'play.after': (ctx, next, me) => {
      next();
      const B = ctx.battle;
      const e = ctx.env.api.findOwner(B, me.owner);
      if (!e || e.dead || !B.lastHand) return;
      const a = me.params[B.lastHand] ?? me.params.その他;
      const [name, arg] = typeof a === 'string' ? [a, null] : Object.entries(a)[0];
      e.intent = { name, arg };
      ctx.env.api.log(B, { t: 'intent', enemy: e.uid, name: e.name, act: name, why: B.lastHand });
    },
  },
};

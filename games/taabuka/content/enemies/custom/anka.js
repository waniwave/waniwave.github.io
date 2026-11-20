// 精鋭「安価」：次の行動を、自分（プレイヤー）が最後に出した「重なり」の枚数で決める
export default {
  name: '安価',
  kind: 'enemy',
  text: '出しの後、次の行動が「最後に出した重なりの枚数」で決まる（1枚＝攻め1.5、2枚＝伏せ2、3枚＝格下げ、4枚＝溜め、5枚以上＝全体攻め）',
  params: { 1: { 攻め: 1.5 }, 2: { 伏せ: 2 }, 3: { 格下げ: 1 }, 4: '溜め', 5: '全体攻め', その他: '攻め' },
  hooks: {
    'play.after': (ctx, next, me) => {
      next();
      const B = ctx.battle;
      const e = ctx.env.api.findOwner(B, me.owner);
      if (!e || e.dead || !B.lastOverlap) return;
      const top = Math.min(5, Math.max(1, ...Object.values(B.lastOverlap)));
      const a = me.params[top] ?? me.params.その他;
      const [name, arg] = typeof a === 'string' ? [a, null] : Object.entries(a)[0];
      e.intent = { name, arg };
      ctx.env.api.log(B, { t: 'intent', enemy: e.uid, name: e.name, act: name, why: `${top}枚` });
    },
  },
};

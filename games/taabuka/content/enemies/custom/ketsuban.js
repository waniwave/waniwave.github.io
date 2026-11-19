// 層主「欠番」：ターンの始めに、その戦闘で一番多く出した組を封じる（封じる組は毎ターン付け替わる）
function mostPlayed(B) {
  let best = null, n = 0;
  for (const [hand, k] of Object.entries(B.stats.hands || {})) if (k > n) { best = hand; n = k; }
  return best;
}

export default {
  name: '欠番',
  kind: 'enemy',
  text: 'ターン開始のたびに、その戦闘で一番多く出した組を封じる（前に封じた組は外す）',
  hooks: {
    'turn.start': (ctx, next, me) => {
      next();
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (!e || e.dead) return;
      const hand = mostPlayed(B);
      if (!hand || e.vars.sealed === hand) return;
      if (e.vars.sealed) B.sealed.hands = B.sealed.hands.filter((x) => x !== e.vars.sealed);
      if (!B.sealed.hands.includes(hand)) B.sealed.hands.push(hand);
      e.vars.sealed = hand;
      env.api.log(B, { t: 'act', enemy: e.uid, name: e.name, act: '封じ', what: hand });
    },
    'battle.end': (ctx, next, me) => {
      const e = ctx.env.api.findOwner(ctx.battle, me.owner);
      if (e?.vars.sealed) ctx.battle.sealed.hands = ctx.battle.sealed.hands.filter((x) => x !== e.vars.sealed);
      next();
    },
  },
};

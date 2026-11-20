// 層主「欠番」：ターンの始めに、その戦闘で一番多く出したカテゴリを封じる（封じるカテゴリは毎ターン付け替わる）
function mostPlayed(B) {
  let best = null, n = 0;
  for (const [cat, k] of Object.entries(B.stats.cats || {})) if (k > n) { best = cat; n = k; }
  return best;
}

export default {
  name: '欠番',
  kind: 'enemy',
  text: 'ターン開始のたびに、その戦闘で一番多く出したカテゴリを封じる（そのカテゴリの札は採点されない。前に封じたものは外す）',
  hooks: {
    'turn.start': (ctx, next, me) => {
      next();
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (!e || e.dead) return;
      const cat = mostPlayed(B);
      if (!cat || e.vars.sealed === cat) return;
      if (e.vars.sealed) B.sealed.cats = B.sealed.cats.filter((x) => x !== e.vars.sealed);
      if (!B.sealed.cats.includes(cat)) B.sealed.cats.push(cat);
      e.vars.sealed = cat;
      env.api.log(B, { t: 'act', enemy: e.uid, name: e.name, act: '封じ', what: cat });
    },
    'battle.end': (ctx, next, me) => {
      const e = ctx.env.api.findOwner(ctx.battle, me.owner);
      if (e?.vars.sealed) ctx.battle.sealed.cats = ctx.battle.sealed.cats.filter((x) => x !== e.vars.sealed);
      next();
    },
  },
};

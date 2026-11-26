// 層主「欠番」：1ターンおきに、その戦闘で一番多く出したカテゴリをそのターンだけ封じる
function mostPlayed(B) {
  let best = null, n = 0;
  for (const [cat, k] of Object.entries(B.stats.cats || {})) if (k > n) { best = cat; n = k; }
  return best;
}

export default {
  name: '欠番',
  kind: 'enemy',
  text: '1ターンおきに、その戦闘で一番多く出したカテゴリをそのターンだけ封じる（そのカテゴリの札は採点されない）',
  hooks: {
    'turn.start': (ctx, next, me) => {
      next();
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (!e || e.dead) return;
      // カテゴリの封じは1ターンだけ（決まりごと）。封じたら次のターンは休む（1ターンおき）
      if (e.vars.sealRest) { e.vars.sealRest = false; return; }
      const cat = mostPlayed(B);
      if (!cat) return;
      if (!B.sealed.cats.includes(cat)) B.sealed.cats.push(cat);
      (B.sealed.catTurns ||= {})[cat] = 1;
      e.vars.sealed = cat; e.vars.sealRest = true;
      env.api.log(B, { t: 'act', enemy: e.uid, name: e.name, act: '封じ', what: `〈${cat}〉（このターンだけ）` });
    },
    'battle.end': (ctx, next, me) => {
      const e = ctx.env.api.findOwner(ctx.battle, me.owner);
      if (e?.vars.sealed) ctx.battle.sealed.cats = ctx.battle.sealed.cats.filter((x) => x !== e.vars.sealed);
      next();
    },
  },
};

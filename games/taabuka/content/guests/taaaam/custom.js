// taaaam様専用の固有の仕組み「専用」：
// 潜行の始めにカテゴリを1つ選ぶ（guestState.専用）。そのカテゴリの札は採点時に掛け×倍。持たない札は採点されず受けに回る。
// そのカテゴリは番付で「下限」の段より下がらない。
const has = (env, c, cat) => env.api.cardView(c, env.balance).cats.includes(cat);
const rank = (env, s) => (env.balance.tiers.tiers[s] || env.balance.tiers.missing?.[s])?.rank ?? -Infinity;

export default {
  name: '専用',
  kind: 'mechanic',
  text: '選んだカテゴリの札だけが採点され、掛け×2。それ以外は受けに回る。そのカテゴリは番付でT0より下がらない',
  params: { 倍: 2, 下限: '0' },
  state: { 専用: null },
  hooks: {
    'battle.start': (ctx, next, me) => {
      const { battle: B, env } = ctx;
      // 潜行の外（試し場など）で選んでいなければ、山札で一番多いカテゴリ
      if (!B.guestState.専用) {
        const n = {};
        for (const c of [...B.draw, ...B.hand]) for (const x of env.api.cardView(c, env.balance).cats) n[x] = (n[x] || 0) + 1;
        B.guestState.専用 = env.balance.tiers.categories.reduce((a, x) => ((n[x] || 0) > (n[a] || 0) ? x : a), env.balance.tiers.categories[0]);
      }
      const cat = B.guestState.専用;
      if (cat && rank(env, B.banzuke[cat]) < rank(env, me.params.下限)) env.api.setBanzuke(B, env, cat, me.params.下限, { name: '専用' });
      next();
    },
    'hand.evaluate': (ctx, next) => {
      next();
      const cat = ctx.battle.guestState.専用;
      const r = ctx.result;
      if (!cat || !r) return;
      const out = r.scored.filter((i) => !ctx.views[i].cats.includes(cat));
      if (!out.length) return;
      r.scored = r.scored.filter((i) => !out.includes(i));
      r.kickers = [...r.kickers, ...out].sort((a, b) => a - b);
    },
    'banzuke.change': (ctx, next, me) => {
      const cat = ctx.battle.guestState.専用;
      if (cat && ctx.cat === cat && ctx.env.balance.tiers.tiers[ctx.to] && rank(ctx.env, ctx.to) < rank(ctx.env, me.params.下限)) ctx.to = me.params.下限;
      next();
    },
  },
  on: {
    採点時: (ctx, me) => {
      const cat = ctx.battle.guestState.専用;
      if (cat && has(ctx.env, ctx.card, cat)) ctx.mulM(me.params.倍, { kind: 'guest', id: 'taaaam', name: `専用〈${cat}〉` });
    },
  },
  status: (B) => `専用：〈${B.guestState.専用 ?? '？'}〉だけが採点される（掛け×2）`,
  tests: [
    // 専用〈麺〉：死の札は受けに（強さ10）。番付の麺は始めにT0へ
    { name: '専用の札だけ採点', guest: 'taaaam', state: { 専用: '麺' }, hand: [{ tier: 3, cat: ['麺'] }, { tier: 3, cat: ['死'] }],
      expect: { 受け: 10, 番付: { 麺: '0' } } },
  ],
};

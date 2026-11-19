// ター角の固有の仕組み「角」：手札の左端と右端の札が「角」。角の札は採点時に掛け×角の掛け。
// 手札は自動では並ばず、引いた札は右端に入る（エンジンの決まりどおり）。並べ替えはターンに「入れ替え」回（2枚の入れ替え）。
// 置物「角」（params.置物）を持っていれば、角の札が2枚とも採点されると、さらに掛け×両角。
const corner = (c) => c.handPos != null && (c.handPos === 0 || c.handPos === c.handLen - 1);

export default {
  name: '角',
  kind: 'mechanic',
  text: '手札の左端と右端の札が「角」。角の札は採点時に掛け×3。手札は並ばない。並べ替えはターンに1回',
  params: { 角の掛け: 3, 両角: 2, 入れ替え: 1, 置物: 'tk_r_kado' },
  state: { 入れ替え: 0 },
  vars: ['入れ替え'],
  hooks: {
    'turn.start': (ctx, next, me) => { ctx.battle.guestState.入れ替え = me.params.入れ替え; next(); },
    'score.final': (ctx, next, me) => {
      const B = ctx.battle;
      if (B.relics.some((r) => r.id === me.params.置物)) {
        const n = ctx.scored.filter((c) => corner(c)).length;
        const two = ctx.scored.some((c) => c.handPos === 0) && ctx.scored.some((c) => c.handPos === c.handLen - 1 && c.handLen > 1);
        if (n >= 2 && two) ctx.mulM(me.params.両角, { kind: 'relic', id: me.params.置物, name: '両角' });
      }
      next();
    },
  },
  on: {
    採点時: (ctx, me) => {
      if (corner(ctx.card)) ctx.mulM(me.params.角の掛け, { kind: 'guest', id: 'taakaku', name: `角（${ctx.card.name}）` });
    },
  },
  actions: {
    /** args: { 札: [手札の番号2つ] } */
    入れ替える: (ctx) => {
      const B = ctx.battle;
      const { refuse, log } = ctx.env.api;
      const idx = [...new Set(ctx.args.札 || [])];
      if ((B.guestState.入れ替え ?? 0) < 1) throw refuse('このターンはもう入れ替えた');
      if (idx.length !== 2 || idx.some((i) => i < 0 || i >= B.hand.length)) throw refuse('手札の2枚を選ぶ');
      const [a, b] = idx;
      [B.hand[a], B.hand[b]] = [B.hand[b], B.hand[a]];
      B.guestState.入れ替え -= 1;
      log(B, { t: 'guest', what: '入れ替え', cards: [B.hand[a].name, B.hand[b].name] });
    },
  },
  ui: { 入れ替える: { label: '入替', ask: [{ key: '札', type: 'selected', min: 2, max: 2 }] } },
  status: (B) => {
    const L = B.hand[0]?.name ?? '―', R = B.hand.length > 1 ? B.hand[B.hand.length - 1].name : '―';
    return `角：左〈${L}〉右〈${R}〉　入れ替え ${B.guestState.入れ替え ?? 0}`;
  },
  tests: [
    // 3枚の手札の左端を単騎：(5＋6)×1×3＝33
    { name: '角の札は掛け×3', guest: 'taakaku', hand: [{ tier: 3, cat: ['麺'] }, { tier: 5, cat: ['死'] }, { tier: 5, cat: ['宿'] }],
      steps: [{ play: [0] }], expect: { V: 33 } },
    { name: '真ん中は角でない', guest: 'taakaku', hand: [{ tier: 3, cat: ['麺'] }, { tier: 3, cat: ['死'] }, { tier: 5, cat: ['宿'] }],
      steps: [{ play: [1] }], expect: { V: 11 } },
  ],
};

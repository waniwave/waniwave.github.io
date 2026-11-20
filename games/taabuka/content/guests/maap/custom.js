// 女将マープの固有の仕組み「採配」：
// ターン開始時に採配点＋1（上限3、戦闘をまたいで残る）。1点で番付の1カテゴリを±1段。
// 使った回数を「採配数」として潜行中数え、専用札が式で参照する。
// 番付の操作などは ctx.env.api の道具を使う。

export default {
  name: '採配',
  kind: 'mechanic',
  text: 'ターン開始時に採配点＋1（上限まで）。1点で番付の1カテゴリを1段上げ下げする',
  params: { 毎ターン: 1, 上限: 3 },
  state: { 採配点: 0, 採配数: 0 },
  vars: ['採配点', '採配数'],
  on: {
    ターン開始: (ctx, me) => {
      const s = ctx.battle.guestState;
      s.採配点 = Math.min(me.params.上限, (s.採配点 ?? 0) + me.params.毎ターン);
    },
  },
  actions: {
    /** args: { カテゴリ, 向き: 1（上げる）／-1（下げる） } */
    採配: (ctx) => {
      const { shiftBanzuke, refuse, log } = ctx.env.api;
      const B = ctx.battle;
      const s = B.guestState;
      const { カテゴリ, 向き } = ctx.args;
      if ((s.採配点 ?? 0) < 1) throw refuse('採配点が足りない');
      if (!ctx.env.balance.tiers.categories.includes(カテゴリ)) throw refuse(`カテゴリ「${カテゴリ}」は無い`);
      if (向き !== 1 && 向き !== -1) throw refuse('向きは 1 か -1');
      s.採配点 -= 1;
      s.採配数 = (s.採配数 ?? 0) + 1;
      shiftBanzuke(B, ctx.env, カテゴリ, 向き, { kind: 'guest', id: 'maap', name: '採配' });
      log(B, { t: 'guest', what: '採配', cat: カテゴリ, dir: 向き, left: s.採配点 });
    },
  },
  // 固有行動のボタンと、押したときに選ばせるもの（画面が読む）
  ui: {
    採配: { label: '採配', ask: [
      { key: 'カテゴリ', type: 'category' },
      { key: '向き', type: 'choice', options: [{ label: '1段上げる', value: 1 }, { label: '1段下げる', value: -1 }] },
    ] },
  },
  status: (B, me) => `採配 ${B.guestState.採配点 ?? 0}／${me.params.上限}`,
  tests: [
    { name: 'ターン開始で1点、使うと番付が動く', guest: 'maap', hand: [{ tier: 3, cat: ['麺'] }],
      steps: [{ guest: '採配', args: { カテゴリ: '麺', 向き: 1 } }],
      expect: { 番付: { 麺: '2' }, 状態: { 採配点: 0, 採配数: 1 } } },
    { name: '上限3まで貯まる', guest: 'maap', hand: [],
      steps: [{ end: true }, { end: true }, { end: true }],
      expect: { 状態: { 採配点: 3 } } },
    { name: '戦闘をまたいで残る', guest: 'maap', hand: [], state: { 採配点: 2, 採配数: 5 },
      expect: { 状態: { 採配点: 3, 採配数: 5 } } },
    // 麺をT2へ：強さ15
    { name: '上げた番付が採点に効く', guest: 'maap', hand: [{ cat: ['麺'] }],
      steps: [{ guest: '採配', args: { カテゴリ: '麺', 向き: 1 } }, { play: [0] }],
      expect: { V: 15 } },
  ],
};

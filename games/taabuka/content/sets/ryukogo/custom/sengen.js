// 目玉ルール「宣言」：出すときに好きな組を宣言し、成立していなくてもその組として採点する
// 宣言する組は出すときの choices.宣言（画面で選ぶ）。ルールに 組 を書けばそれに固定
export default {
  name: '宣言',
  kind: 'rule',
  text: '宣言した組として採点する（成立していなくても）。出した札は全て採点される',
  args: { '組?': 'hand' },
  choices: { 宣言: '組' },
  hooks: {
    'hand.evaluate': (ctx, next, me) => {
      next();
      const hands = ctx.env.balance.hands;
      const h = me.params.組 ?? ctx.choices?.宣言 ?? hands.order[0];
      if (!hands.hands[h]) throw new Error(`宣言した組「${h}」は無い`);
      ctx.result = { ...ctx.result, hand: h, scored: ctx.views.map((_, i) => i), kickers: [] };
    },
  },
  tests: [
    // 五揃を宣言：(120＋12＋6)×12＝1656
    { name: '宣言した組で採点', hand: ['rk_ganbou', { tier: 3, cat: ['麺'] }], choices: { 宣言: '五揃' }, expect: { 組: '五揃', V: 1656 } },
    // 宣言しなければ一番上の組（神組）
    { name: '宣言なしは一番上', hand: ['rk_ganbou'], expect: { 組: '神組', V: (200 + 12) * 20 } },
  ],
};

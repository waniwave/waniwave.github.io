// 目玉ルール「二倍」：この出しの処理を全部2回通す（採点も常連客の発動も）
export default {
  name: '二倍',
  kind: 'rule',
  text: 'この出しの採点と常連客の発動を全部2回ずつ通す（回数は変えられる）',
  args: { '回数?': 'int' },
  hooks: {
    'score.card': (ctx, next, me) => { for (let i = 0; i < (me.params.回数 ?? 2); i++) next(); },
    'score.regulars': (ctx, next, me) => { for (let i = 0; i < (me.params.回数 ?? 2); i++) next(); },
    'fx.queue': (ctx, next) => { ctx.fx.push({ show: '文字二回', arg: null, src: { kind: 'rule', name: '二倍' } }); next(); },
  },
  tests: [
    // 対（God・God）：二倍なら S＝10＋(15＋15)×2＝70、M＝2 → 140。二倍なしなら 80
    { name: '採点が2回ずつ', hand: ['rk_jujo_satosatoru', { tier: 'God', cat: ['ター'] }], expect: { V: 140, なしより大きい: true } },
    // 札が1枚でも2回採点：単騎 S＝5＋15×2＝35 → 35（なしは20）
    { name: '1枚でも2回', hand: ['rk_jujo_satosatoru'], expect: { V: 35, 演出: '文字二回' } },
  ],
};

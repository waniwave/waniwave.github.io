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
    // ター2枚（T3とGod）：二倍なら S＝(10＋60)×2＝140、重なり×1.5 → 210。二倍なしなら 105
    { name: '採点が2回ずつ', hand: [{ tier: 3, cat: ['ター'], kw: ['二倍'] }, { tier: 'God', cat: ['ター'] }], expect: { V: 210, なしより大きい: true } },
    // 札が1枚でも2回採点：10×2＝20（なしは10）
    { name: '1枚でも2回', hand: [{ tier: 3, cat: ['ター'], kw: ['二倍'] }], expect: { V: 20, 演出: '文字二回' } },
  ],
};

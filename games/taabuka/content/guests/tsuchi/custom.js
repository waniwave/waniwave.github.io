// 自己紹介をする土の固有の仕組み「名乗り」：採点札1枚ごとに、札の名前の文字数（上限まで）だけ強さ＋
export default {
  name: '名乗り',
  kind: 'mechanic',
  text: '採点札1枚ごとに、札の名前の文字数（上限まで）だけ強さ＋',
  params: { 上限: 12 },
  on: {
    採点時: (ctx, me) => {
      const n = Math.min([...ctx.card.name].length, me.params.上限);
      ctx.addS(n, { kind: 'guest', id: 'tsuchi', name: `名乗り（${ctx.card.name}）` });
    },
  },
  status: (B, me) => `名乗り：名前の長い札ほど強い（上限${me.params.上限}文字）`,
  tests: [
    // 11文字の札：単騎 (5＋6＋11)×1＝22
    { name: '文字数だけ強さ＋', guest: 'tsuchi', hand: [{ tier: 3, cat: ['麺'], name: 'とても長い名前の札です' }], expect: { V: 22 } },
    // 15文字でも上限12
    { name: '上限12文字', guest: 'tsuchi', hand: [{ tier: 3, cat: ['麺'], name: 'あいうえおかきくけこさしすせそ' }], expect: { V: 23 } },
    // 対なら2枚とも：(10＋6＋6＋3＋3)×2＝56
    { name: '採点札ごと', guest: 'tsuchi', hand: [{ tier: 3, cat: ['麺'], name: '土の札' }, { tier: 3, cat: ['宿'], name: '土の札' }], expect: { V: 56 } },
  ],
};

// 目玉ルール「宣言」：出すときにカテゴリを1つ宣言し、出した札を全てそのカテゴリとして重ねる（孤立も無くなる）
// 宣言するカテゴリは出すときの choices.宣言（画面で選ぶ）。ルールに カテゴリ を書けばそれに固定
export default {
  name: '宣言',
  kind: 'rule',
  text: '宣言したカテゴリを、出した札が全て持っていることにして採点する（孤立しない）',
  args: { 'カテゴリ?': 'category' },
  choices: { 宣言: 'category' },
  hooks: {
    'hand.evaluate': (ctx, next, me) => {
      const cats = ctx.env.balance.tiers.categories;
      const c = me.params.カテゴリ ?? (cats.includes(ctx.choices?.宣言) ? ctx.choices.宣言 : null) ?? cats[0];
      ctx.views = ctx.views.map((v) => (v.stone || v.cats.includes(c) ? v : { ...v, cats: [...v.cats, c] }));
      next();
    },
  },
  tests: [
    // 麺の札＋死の札を「麺」と宣言：2枚とも採点・麺が2枚重なる（10＋10）×1.5＝30
    { name: '宣言したカテゴリで重なる', hand: [{ cat: ['麺'], kw: ['宣言'] }, { cat: ['死'] }], choices: { 宣言: '麺' }, expect: { V: 30 } },
  ],
};

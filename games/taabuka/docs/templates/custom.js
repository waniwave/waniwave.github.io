// 特注の雛形。content/sets/<セット>/custom/*.js、content/guests/<ID>/custom.js、content/enemies/custom/*.js に置く。
// 語彙で書けないものだけを書く。engine/ のファイルを import しない（道具は ctx.env.api にある）。
// 乱数は ctx.env.rng だけを使う（Math.random は使わない）。数は YAML から params で受け取る。
export default {
  name: '名前',                 // 語彙として呼ぶ名前（YAML から { ルール: { 名前: 名前 } } などで呼ぶ）
  kind: 'rule',                 // rule / do / show / mechanic / enemy / if / var
  text: '説明1行（content-guide.md に出る）',
  args: { '掛け?': 'number' },  // YAML で受け取る値の形（省略可）

  // 差し込み口（docs/hooks.md）：(ctx, next, me)。me.params に YAML の値
  hooks: {
    'score.final': (ctx, next, me) => {
      ctx.mulM(me.params.掛け ?? 2, { kind: 'rule', name: '名前' });
      next();
    },
  },
  // 合図：(ctx, me)
  on: {},

  // rule だけ：掛けた瞬間・外れる瞬間（省略可）
  // apply: (B, env, r) => {},
  // expire: (B, env, r) => {},

  // mechanic（宿泊客の仕組み）だけ：
  // params: {}, state: {}, vars: ['値の名前'],
  // actions: { 行動名: (ctx, me) => { const { refuse } = ctx.env.api; throw refuse('できない理由'); } },
  // status: (B, me) => '画面に出す1行',

  // 自己テスト（docs/content-guide.md「自己テストの書き方」）
  tests: [
    // { name: '何を確かめるか', hand: ['札のID', { tier: 3, cat: ['麺'] }], expect: { V: 22 } },
  ],
};

(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'wild', name: 'ワイルドとごった煮', e: '🍲',
  desc: '〈ワイルド〉のカードは、取ったときに自分の場で一番多いカテゴリの仲間にもなる。種類が多いほど強いカードも。',
  categories: {},
  rules: {
    text: '【ごった煮】局の終わりに、自分の場のカテゴリの種類が一番多い人は+3（同数なら全員）。',
    hooks: { playerScore: (g, v, p) => { const c = [0, 1, 2, 3].map(i => g.catsCount(i)); const m = Math.max(...c); return m > 0 && c[p] === m ? v + 3 : v; } }
  },
  cards: [
    { id: 'x_surameshi', name: '実況スレの出前', e: '🍕', g: '出', cats: ['thread', 'food'], base: 2,
      text: '【得点】自分の場のカテゴリが5種類以上なら+5。', flavor: '「ピザきた」「うp」「はよ」',
      score: (g, p) => g.catsCount(p) >= 5 ? 5 : 0 },
    { id: 'x_gottani', name: 'ごった煮', e: '🍲', g: '鍋', cats: ['food'], base: 1, wild: 1,
      text: '〈ワイルド〉【得点】自分の場のカテゴリの種類数ぶん+。', flavor: '何が入っているかは、誰も知らない。',
      score: (g, p) => g.catsCount(p) },
    { id: 'x_oshi', name: '推し札', e: '💖', g: '推', cats: ['thread'], base: 3, wild: 1,
      text: '〈ワイルド〉推しは、どのジャンルにもいる。', flavor: '推しは、どのジャンルにもいる。' },
    { id: 'x_yaminabe', name: '闇鍋', e: '🌑', g: '闇', cats: ['food'], base: 2, wild: 1,
      text: '〈ワイルド〉【取ったとき】捨て札から、自分の場で一番多いカテゴリのカードを1枚戻す。', flavor: '箸でつかんだものは、必ず食べる。',
      onPick: (g, p, c) => { const top = g.topCatOf(p); const e = g.discard().find(x => top && g.hasCat(x.c, top)); if (e && g.revive(e, p)) g.log(`★ 闇鍋から「${g.cardName(e.c)}」が出てきた。`, true); } },
    { id: 'x_ishu', name: '異種格闘技戦', e: '🦁', g: '異', cats: ['fgc', 'animal'], base: 4,
      text: '【取ったとき】自分の場に他の〈動物〉と〈格ゲー〉が両方いれば、左右の場で一番素点の高いカードを捨て札へ（KO）。', flavor: 'ゴリラ対昇龍拳。',
      onPick: (g, p, c) => { if (g.cnt(p, 'animal', c) && g.cnt(p, 'fgc', c)) { const t = K.bestOf(g, g.neighbors(p)); if (t) { g.log(`★ 異種格闘技戦、決着！`, true); g.kill(t); } } } },
    { id: 'x_kanji', name: '社員旅行の幹事', e: '🚩', g: '幹', cats: ['inn'], base: 2, wild: 1,
      text: '〈ワイルド〉【得点】自分の場のカテゴリの種類数ぶん+。', flavor: '食べ物好きも、動物好きも、格ゲー勢も、全員まとめて連れてくる。',
      score: (g, p) => g.catsCount(p) },
    { id: 'x_bento', name: '動物園のお弁当', e: '🍱', g: '弁', cats: ['food', 'animal'], base: 1,
      text: '【得点】自分の場の他の〈動物〉1枚につき+1。', flavor: 'ゾウの形のおにぎりが入っている。', score: K.per('animal', 1) }
  ]
});
})();

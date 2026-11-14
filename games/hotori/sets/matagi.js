(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'matagi', name: '系統またぎ', e: '🐈',
  desc: '動物で格ゲー、食べ物で格ゲー。カテゴリを2つ持つカードがそろう。',
  categories: {},
  rules: {
    text: '【異種格闘技】この局では、カテゴリを2つ以上持つカードはそれぞれ+1。',
    hooks: { cardScore: (g, v, c) => g.catsOf(c).length >= 2 ? v + 1 : v }
  },
  cards: [
    { id: 'x_nekopunch', name: '猫パンチ', e: '🐈', g: '拳', cats: ['animal', 'fgc'], base: 2,
      text: '【取ったとき】左右の場で一番素点の高いカードの素点−2（自分の場に他の〈動物〉がいれば−4）。', flavor: 'フレーム有利がとれる猫。',
      onPick: (g, p, c) => { const t = K.bestOf(g, g.neighbors(p)); if (!t) return; const n = g.cnt(p, 'animal', c) ? 4 : 2; g.setBase(t, g.baseOf(t) - n); g.log(`★ 猫パンチが「${g.cardName(t)}」に入った！ 素点−${n}`, true); } },
    { id: 'x_karaage', name: '唐揚げコンボ', e: '🍗', g: '揚', cats: ['food', 'fgc'], base: 2,
      text: '【得点】自分の場の他の〈食べ物〉と〈格ゲー〉1枚につき+1。', flavor: 'つなぎがカリッと入る。', score: K.perAny(['food', 'fgc'], 1) },
    { id: 'x_esayari', name: '餌やり体験', e: '🥕', g: '餌', cats: ['animal', 'food'], base: 2,
      text: '【取ったとき】自分の場の〈動物〉すべて+1。', flavor: 'ふれあい広場で100円。',
      onPick: (g, p, c) => g.table(p).forEach(x => { if (x !== c && g.hasCat(x, 'animal')) K.addPts(x, 1); }) },
    { id: 'x_banken', name: 'スレの番犬', e: '🐕', g: '番', cats: ['animal', 'thread'], base: 3,
      text: '【得点】自分の場の他の〈スレ〉と〈動物〉1枚につき+1。', flavor: '荒らしにだけ吠える。', score: K.perAny(['thread', 'animal'], 1) },
    { id: 'x_yashoku', name: '格ゲー勢の夜食', e: '🍜', g: '夜', cats: ['food', 'fgc'], base: 2,
      text: '【得点】深夜。6手番目以降に取っていれば+4。', flavor: '深夜3時のカップ麺は、フレーム消費が少ない。', score: K.takenFrom(6, 4) },
    { id: 'x_onsenzaru', name: '温泉ザル', e: '🐒', g: '猿', cats: ['animal', 'yu'], base: 2,
      text: '【手番の終わり】自分の場に他の〈湯〉か〈動物〉がいれば+1（最大+4）。', flavor: '湯船の主。タオルを頭にのせている。',
      onTurnEnd: (g, o, c) => { if (g.count(o, x => x !== c && (g.hasCat(x, 'yu') || g.hasCat(x, 'animal')))) K.grow(1, 4)(g, o, c); } },
    { id: 'x_crane', name: 'クレーンゲームのぬいぐるみ', short: 'クレーンのぬいぐるみ', e: '🧸', g: '掴', cats: ['animal', 'fgc'], base: 3,
      text: '【取ったとき】アームが弱い台。捨て札から〈動物〉か〈格ゲー〉を1枚（素点の高いもの）つかんで自分の場へ。', flavor: '格ゲー台の横の、アームが弱い台。',
      onPick: (g, p) => { const e = g.discard().filter(x => g.hasCat(x.c, 'animal') || g.hasCat(x.c, 'fgc')).sort((a, b) => g.baseOf(b.c) - g.baseOf(a.c))[0]; if (e && g.revive(e, p)) g.log(`★ クレーンが「${g.cardName(e.c)}」をつかんだ。`, true); } }
  ]
});
})();

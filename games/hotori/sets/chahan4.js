(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'chahan4', name: 'ネオヨコハマの昼', e: '🎡',
  desc: '情報屋、闘技場の王者、船乗りと飛行士、給仕。仲間を多く連れていると、デートに行ける。',
  categories: { memo: { name: 'メモリ', color: '#5ce0c8' } },
  cards: [
    { id: 'lin', name: 'リン', e: '🕵️', g: '情', cats: ['memo'], base: 2,
      text: '【取ったとき】情報屋。次の手番、カードを取りつつティアも動かせる。', flavor: '売り先が決まってから、ノゲで会う。',
      onPick: (g, p) => { g.grantBonus(p); g.log(`${g.name(p)}は次の手番、取りながらティアも動かせる。`); } },
    { id: 'glassjaw', name: 'グラスジョー', e: '🥊', g: '顎', cats: ['fgc', 'memo'], base: 5,
      text: '【得点】ガラスの顎。この局で自分の場のカードが1枚でも捨て札に送られていたら−5。', flavor: '闘技場の王者。',
      score: (g, p) => g.lostCount(p) ? -5 : 0 },
    { id: 'hijiki', name: 'キャプテン・ヒジキ', e: '⚓', g: '船', cats: ['memo'], base: 3,
      text: '【得点】自分の場に「ムツコ」がいれば+4（船乗りと飛行士）。', flavor: 'ホンモクの船乗り。', score: K.with('mutsuko', 4) },
    { id: 'whiteglove', name: 'ホワイトグローブ', e: '🧤', g: '給', cats: ['inn', 'memo'], base: 3,
      text: '【取ったとき】給仕。自分の場の一番素点の高い他のカードを+2。', flavor: 'ヤマテの洋館の給仕。',
      onPick: (g, p, c) => { const t = K.bestOf(g, [p], x => x !== c); if (t) K.addPts(t, 2); } },
    { id: 'mutsuko', name: 'ムツコ', e: '👵', g: '睦', cats: ['old', 'memo'], base: 2,
      text: '【取ったとき】〈老〉のティアを1段上げる。【得点】「キャプテン・ヒジキ」がいれば+4。', flavor: 'カシワ天文台。70代の飛行士。',
      onPick: K.up('old', 1), score: K.with('hijiki', 4) },
    { id: 'pc_tenin', name: 'テンイン', e: '🛍️', g: '店', cats: ['memo'], base: 0,
      text: '【得点】メガモール地下5階。自分の場のカード1枚につき+1（最大+8）。', flavor: 'メガモール地下5階で働いている。',
      score: (g, p) => Math.min(8, g.table(p).length) },
    { id: 'satou', name: 'サトウ', e: '🍚', g: '糖', cats: ['food', 'memo'], base: 2,
      text: '【得点】自分の場に「ゼロカロリー」がいれば+5（空腹同盟の炊き出し）。', flavor: 'カンナイで会う。', score: K.with('zerocal', 5) }
  ]
});
})();

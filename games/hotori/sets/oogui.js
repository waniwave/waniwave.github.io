(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'oogui', name: '大食い', e: '🍜',
  desc: '食べ物を並べ、辛さで隣を黙らせる。デザートは別腹。',
  categories: {},
  cards: [
    { id: 'ramen', name: 'ラーメーン', e: '🍜', g: '麺', cats: ['food', 'men'], base: 3,
      text: '【得点】自分の場の他の〈食べ物〉1枚につき+1。', flavor: 'スープはター油ベース。', score: K.per('food', 1) },
    { id: 'gekikara', name: '激辛ターリー', e: '🌶️', g: '辛', cats: ['food', 'ter'], base: 4,
      text: '【取ったとき】辛すぎる。左右の人の〈食べ物〉すべて素点−1。', flavor: 'カレーの上位版。辛さはTier God。',
      onPick: (g, p) => { let n = 0; g.neighbors(p).forEach(q => g.table(q).forEach(x => { if (g.hasCat(x, 'food') && !g.protected(x)) { g.setBase(x, g.baseOf(x) - 1); n++; } })); if (n) g.log(`★ 辛すぎる！ 隣の食べ物${n}枚が素点−1`, true); } },
    { id: 'wasabi', name: 'わさび', e: '🟢', g: '山葵', cats: ['food'], base: 1,
      text: '【取ったとき】ツーンとくる。左右の場で一番素点の高いカードの素点−3。', flavor: '定食の刺身に、いつのまにか付いてくる。',
      onPick: (g, p) => { const t = K.bestOf(g, g.neighbors(p)); if (t) { g.setBase(t, g.baseOf(t) - 3); g.log(`「${g.cardName(t)}」にわさびが効いた。素点−3`); } } },
    { id: 'gohan', name: 'ごはんのおかわり', e: '🍚', g: '飯', cats: ['food'], base: 2,
      text: '【取ったとき】捨て札の〈食べ物〉を1枚（素点の高いもの）自分の場に戻す。', flavor: 'おかわりは自由です。',
      onPick: (g, p) => { const e = g.discard().filter(x => g.hasCat(x.c, 'food')).sort((a, b) => g.baseOf(b.c) - g.baseOf(a.c))[0]; if (e && g.revive(e, p)) g.log(`★ 「${g.cardName(e.c)}」をおかわりした。`, true); } },
    { id: 'makanai', name: 'まかない', e: '🍳', g: '賄', cats: ['food', 'inn'], base: 2,
      text: '【得点】自分の場の〈食べ物〉が4枚以上（これを含む）なら+5。', flavor: '宿の従業員だけが食べられる。', score: K.atLeast('food', 4, 5) },
    { id: 'dessert', name: 'デザートは別腹', e: '🍰', g: '菓', cats: ['food'], base: 1,
      text: '【得点】6手番目以降に取っていれば+6。', flavor: '定食のあとでも入る。', score: K.takenFrom(6, 6) },
    { id: 'takoyaki', name: 'ター焼き', e: '🐙', g: '蛸', cats: ['food', 'ter'], base: 1,
      text: '【取ったとき】6個入りのうちの3個。自分の場に「ター焼き」をもう2個出す。', flavor: '中に入っているのは、ターコ。', onPick: K.tokens('takoyaki_t', 2) }
  ],
  tokens: [
    { id: 'takoyaki_t', name: 'ター焼き', e: '🐙', g: '蛸', cats: ['food', 'ter'], base: 1, text: '6個入りのうちの1個。素点1。', flavor: 'あつあつ。' }
  ]
});
})();

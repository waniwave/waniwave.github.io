(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'hanyou2', name: '汎用の城塞', e: '🏰',
  desc: '歩兵、盾兵、城壁、ゴーレム、ドラゴン。重くて固い汎用札。',
  categories: { gen: { name: '汎用', color: '#9a9a9a' } },
  cards: [
    { id: 'g_soldier', name: '歩兵', e: '🗡️', g: '兵', cats: ['gen'], base: 5, text: '（能力なし）', flavor: 'どのゲームにもいる。' },
    { id: 'g_shield', name: '盾兵', e: '🛡️', g: '盾', cats: ['gen'], base: 5,
      text: '【常時】捨て札にも移動にもならない。', flavor: '盾を持っている。',
      hooks: { protect: (g, o, c, v, card) => card === c ? true : v } },
    { id: 'g_wall', name: '城壁', e: '🧱', g: '壁', cats: ['gen'], base: 2,
      text: '【得点】自分の場の他の〈汎用〉1枚につき+2。', flavor: '壁。', score: K.per('gen', 2) },
    { id: 'g_golem', name: 'ゴーレム', e: '🪨', g: '岩', cats: ['gen'], base: 7,
      text: '【取ったとき】重い。次の手番、自分はティアを動かせない。', flavor: '岩でできている。',
      onPick: (g, p) => g.blockTier(p) },
    { id: 'g_dragon', name: 'ドラゴン', e: '🐉', g: '竜', cats: ['gen'], base: 8,
      text: '【取ったとき】炎を吐く。左右の人のカードすべての素点−1。', flavor: '強い。',
      onPick: (g, p) => { g.neighbors(p).forEach(q => g.table(q).forEach(x => { if (!g.protected(x)) g.setBase(x, g.baseOf(x) - 1); })); g.log('★ ドラゴンが炎を吐いた。', true); } },
    { id: 'g_counter', name: 'カウンター', e: '🤺', g: '反', cats: ['gen'], base: 4,
      text: '【取ったとき】反撃。そのとき自分の点が一番低ければ+5。', flavor: '反撃する。',
      onPick: (g, p, c) => { const s = g.scores(); if (s[p] <= Math.min(...s)) { K.addPts(c, 5); g.log('カウンターが決まった。+5'); } } },
    { id: 'sample', name: '食品サンプル', e: '🍤', g: '模', cats: ['food'], base: 4,
      text: '【取ったとき】自分の場で一番素点の高い〈食べ物〉と同じ素点になる。', flavor: '食べられないが、強さはそっくり。',
      onPick: (g, p, c) => { const t = K.bestOf(g, [p], x => x !== c && g.hasCat(x, 'food')); if (t) { g.setBase(c, g.baseOf(t)); g.log(`食品サンプルが「${g.cardName(t)}」そっくりになった。`); } } }
  ]
});
})();

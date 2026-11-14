(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'idou', name: '移動の旅', e: '🐧',
  desc: 'カードが場から場へ渡り歩く。押しつけ、投げ飛ばし、滑り込む。',
  categories: { move: { name: '移動', color: '#4aa8a0' } },
  rules: {
    text: '【旅の宿】この局では、よその場へ移ったカードは、移った先で+2。',
    onMove: (g, c) => K.addPts(c, 2)
  },
  cards: [
    { id: 'backstep', name: 'バクステ', e: '🔙', g: '←←', cats: ['fgc', 'move'], base: 3,
      text: '【取ったとき】とりあえず下がる。自分の場の一番素点の低い他のカードを、手札をくれる人の場へ押しつける。', flavor: '←←。とりあえず下がる。',
      onPick: (g, p, c) => { const t = K.worstOf(g, [p], x => x !== c); const q = g.prev(p); if (t && g.moveTo(t, q)) g.log(`「${g.cardName(t)}」を${g.name(q)}の場へ押しつけた。`); } },
    { id: 'mekuri', name: 'めくり', e: '🤸', g: '捲', cats: ['fgc', 'move'], base: 3,
      text: '【取ったとき】どっちにガードすればいいのか分からない。手札を渡す相手の一番素点の高いカードの素点−3。', flavor: 'どっちにガードすればいいのか、わからない。',
      onPick: (g, p) => { const q = g.next(p); const t = K.bestOf(g, [q]); if (t) { g.setBase(t, g.baseOf(t) - 3); g.log(`めくりが${g.name(q)}の「${g.cardName(t)}」に当たった。素点−3`); } } },
    { id: 'komanage', name: 'コマ投げ', e: '🌪️', g: '回', cats: ['fgc', 'move'], base: 3,
      text: '【取ったとき】レバー一回転。左右で点の高いほうの人の一番素点の高いカードを、反対側の隣の人の場へ投げ飛ばす。', flavor: 'レバーを一回転。',
      onPick: (g, p) => { const q = g.richer(p); const r = g.neighbors(p).find(x => x !== q); const t = K.bestOf(g, [q]); if (t && g.moveTo(t, r)) g.log(`★ 吸い込んで、投げた！「${g.cardName(t)}」が${g.name(r)}の場へ。`, true); } },
    { id: 'zanzou', name: '秒速5タームメートルの残像', short: '秒速の残像', e: '👤', g: '影', cats: ['speed', 'move', 'ter'], base: 1,
      text: '【得点】この局で自分の場にカードが出入りした回数×2（最大+10）。', flavor: '本体はもう3部屋先にいる。',
      score: (g, p) => Math.min(10, g.moves(p) * 2) },
    { id: 'sneaker', name: '秒速のスニーカー', e: '👟', g: '靴', cats: ['speed', 'move'], base: 3,
      text: '【手番の終わり】自分の場に他の〈移動〉か〈速さ〉があれば+1（最大+4）。', flavor: '履くと秒速5タームメートル。',
      onTurnEnd: (g, o, c) => { if (g.count(o, x => x !== c && (g.hasCat(x, 'move') || g.hasCat(x, 'speed')))) K.grow(1, 4)(g, o, c); } },
    { id: 'penguin', name: 'ペンギンター', e: '🐧', g: '鳥', cats: ['animal', 'move', 'ter'], base: 2,
      text: '【捨てられたとき】お腹で滑って、捨て札にならず捨てた人の場に入る（+2）。', flavor: '廊下は、よく滑る。',
      onCut: (g, p, c, entry) => { if (g.revive(entry, p)) { K.addPts(c, 2); g.log(`★ ペンギンターが${g.name(p)}の場に滑り込んだ。`, true); } } },
    { id: 'iruka', name: 'イルカーム', e: '🐬', g: '海豚', cats: ['animal', 'move'], base: 3,
      text: '【常時】どこかでカードが移動するたびに+1（最大+6）。', flavor: 'ター湯で、ジャンプの練習をしている。',
      onAnyMove: (g, o, c, moved) => { if (moved !== c) c.x.pts = Math.min(6, (c.x.pts || 0) + 1); } }
  ]
});
})();

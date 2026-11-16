(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'mizube', name: '水辺と夜の動物', e: '🦉',
  desc: '甲羅は壊れない。針は刺し返す。夜に取れば強くなる動物たち。',
  categories: {},
  cards: [
    { id: 'kame', name: 'カメーム', e: '🐢', g: '亀', cats: ['animal'], base: 4,
      text: '【常時】甲羅があるので、捨て札にも移動にもならない。【手番の終わり】+1（最大+3）。', flavor: '万年生きる。この局も、たぶん生き残る。',
      hooks: { protect: (g, o, c, v, card) => card === c ? true : v }, onTurnEnd: K.grow(1, 3) },
    { id: 'rakko', name: 'ラッコーム', e: '🦦', g: '獺', cats: ['animal'], base: 3,
      text: '【取ったとき】貝を割る。自分の場の一番素点の低い他のカードを+3。', flavor: 'お気に入りの石を、脇の下にしまっている。',
      onPick: (g, p, c) => { const t = K.worstOf(g, [p], x => x !== c); if (t) { K.addPts(t, 3); g.log(`ラッコームが「${g.cardName(t)}」の貝を割った。+3`); } } },
    { id: 'fukurou', name: 'フクロウター', e: '🦉', g: '梟', cats: ['animal', 'ter'], base: 3,
      text: '【得点】夜行性。6手番目以降に取っていれば+4。', flavor: 'ホー。深夜の自販機の前にいる。', score: K.takenFrom(6, 4) },
    { id: 'hiyoko', name: 'ヒヨコーム', e: '🐤', g: '雛', cats: ['animal'], base: 1,
      text: '【手番の終わり】すくすく育つ。+1（最大+5）。', flavor: 'ピヨ。そのうちニワトリになる、と本人は言っている。',
      onTurnEnd: K.grow(1, 5), ai: (g) => Math.min(5, TJ.TURNS - g.turn + 1) },
    { id: 'harinezumi', name: 'ハリネズミター', e: '🦔', g: '針', cats: ['animal', 'ter'], base: 3,
      text: '【捨て札へ送られたとき】針が刺さる。送った人の場の一番素点の高いカードを素点−3。', flavor: 'さわると痛い。さわらなくても痛い。',
      onDeath: (g, o, c) => { const src = c.x.killedBy; if (!src || src.p == null || src.p === o) return; const t = K.bestOf(g, [src.p]); if (t) { g.setBase(t, g.baseOf(t) - 3); g.log(`★ 針が「${g.cardName(t)}」に刺さった。素点−3`, true); } } },
    { id: 'namakemono', name: 'ナマケモノター', e: '🦥', g: '懶', cats: ['animal', 'ter'], base: 0,
      text: '【得点】動くのは最後だけ。7手番目に取っていれば+10、それ以外は+1。', flavor: '動くのは、最終手番だけ。',
      score: (g, p, c) => c.t === TJ.TURNS ? 10 : 1 },
    { id: 'ferret', name: 'フェレッター', e: '🦡', g: '鼬', cats: ['animal', 'steal', 'ter'], base: 2,
      text: '【取ったとき】手札をくれる人の場から、一番新しいカードをくすねる（自分の場へ）。（⇄交換：かわりに自分の場の一番素点の低いカードを相手へ渡す）', flavor: '靴下が、片方ない。',
      onPick: (g, p) => { const q = g.prev(p); const t = g.newest(q); if (t && g.moveTo(t, p)) g.log(`★ フェレッターが${g.name(q)}の「${g.cardName(t)}」をくすねた。`, true); } }
  ]
});
})();

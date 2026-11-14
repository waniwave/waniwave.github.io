(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'hanyou3', name: '汎用の魔導書', e: '📖',
  desc: 'ファイアボール、ライトニングボルト、暗殺者。素直に強い除去。',
  categories: { gen: { name: '汎用', color: '#9a9a9a' } },
  rules: TJ.GEN_RULE || {
    text: '【汎用への批判】この局では、〈汎用〉は局の始めにTier4から始まる（スレの住人は汎用に厳しい）。',
    onRoundStart: (g) => { if (g.pos('gen') != null && g.pos('gen') < 5) g.setPos('gen', 5); }
  },
  cards: [
    { id: 'g_book', name: '知識の書', e: '📖', g: '書', cats: ['gen'], base: 3,
      text: '【得点】捨て札の枚数（全員ぶん）2枚につき+1（最大+5）。', flavor: 'カードを2枚引く。以上。',
      score: (g) => Math.min(5, Math.floor(g.discard().length / 2)) },
    { id: 'g_fireball', name: 'ファイアボール', e: '🔥', g: '火', cats: ['gen'], base: 4,
      text: '【取ったとき】左右の場で一番素点の高いカードの素点−4。', flavor: '火の玉を投げる。',
      onPick: (g, p) => { const t = K.bestOf(g, g.neighbors(p)); if (t) { g.setBase(t, g.baseOf(t) - 4); g.log(`ファイアボールが「${g.cardName(t)}」に命中した。素点−4`); } } },
    { id: 'g_bolt', name: 'ライトニングボルト', e: '⚡', g: '雷', cats: ['gen'], base: 5,
      text: '【ティア崩し】取ったとき、〈汎用〉以外でいま一番ティアの高いカテゴリに雷が落ちて2段下がる。そのカテゴリのカードを一番多く持つ人（自分以外）の場から、1枚を捨て札へ。', flavor: '一番高いところに落ちる。',
      onPick: (g, p) => { const k = g.topCat(['gen']); if (!k) return; g.move(k, -2, p); let best = -1, bn = 0; g.others(p).forEach(q => { const n = g.cnt(q, k); if (n > bn) { bn = n; best = q; } }); if (best >= 0) { const t = K.bestOf(g, [best], x => g.hasCat(x, k)); if (t) g.kill(t); } g.log(`★ 雷が〈${TJ.catName(k)}〉に落ちた！`, true); } },
    { id: 'g_potion', name: '回復薬', e: '🧪', g: '薬', cats: ['gen'], base: 5,
      text: '【取ったとき】自分の場の他のカードすべて+1。一番素点の低いものは、さらに+3。', flavor: '緑色の液体。',
      onPick: (g, p, c) => { g.table(p).forEach(x => { if (x !== c) K.addPts(x, 1); }); const t = K.worstOf(g, [p], x => x !== c); if (t) K.addPts(t, 3); } },
    { id: 'g_merchant', name: '行商人', e: '💰', g: '商', cats: ['gen'], base: 4,
      text: '【取ったとき】自分の場の〈汎用〉1枚につき+2。', flavor: 'いろいろ売っている。',
      onPick: (g, p, c) => K.addPts(c, g.cnt(p, 'gen', c) * 2) },
    { id: 'g_assassin', name: '暗殺者', e: '🗡️', g: '暗', cats: ['gen'], base: 5,
      text: '【取ったとき】左右で点の高いほうの人の、一番素点の高いカードを捨て札へ。', flavor: '暗殺する。',
      onPick: (g, p) => { const t = K.bestOf(g, [g.richer(p)]); if (t) g.kill(t); } },
    { id: 'm_kisei', name: '書き込み規制', e: '🔒', g: '規', cats: ['thread'], base: 5,
      text: '【常時】手札を渡す相手のティア操作は、1段しか動かない。', flavor: '「規制されてて書き込めない」「携帯から」',
      hooks: { tierPower: (g, o, c, d, p) => p === g.next(o) && Math.abs(d) > 1 ? Math.sign(d) : d } }
  ]
});
})();

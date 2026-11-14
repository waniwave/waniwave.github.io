(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'soutou', name: '相当', e: '👴',
  desc: '相当老と相当若。早く取るほど若く、時間がたつほど相当になる。台本どおりなら、死も2回起きる。',
  categories: {},
  rules: {
    text: '【相当な時間】この局では、1〜2手番目に取ったカードはそれぞれ+1（早起きは相当の得）。',
    hooks: { cardScore: (g, v, c) => c.t > 0 && c.t <= 2 ? v + 1 : v }
  },
  cards: [
    { id: 'soutourou', name: '相当老', e: '👴', g: '老', cats: ['old'], base: 3,
      text: '【取ったとき】左右で点の高いほうの人の、一番素点の高いカードを相当老けさせる（素点1にする）。【得点】「相当若」がいれば+4。', flavor: '相当、老いている。どれくらいかと聞くと「相当」と答える。',
      onPick: (g, p) => { const q = g.richer(p); const t = K.bestOf(g, [q]); if (t && g.baseOf(t) > 1) { g.setBase(t, 1); g.log(`★ ${g.name(q)}の「${g.cardName(t)}」が相当老けた（素点1）。`, true); } },
      score: K.with('soujaku', 4) },
    { id: 'soujaku', name: '相当若', e: '👶', g: '若', cats: ['old'], base: 1,
      text: '【得点】早く取るほど若い：（7−取った手番）点。「相当老」がいれば、さらに+3。', flavor: '相当、若い。相当老と並ぶと「相当」の部分だけ意気投合する。',
      score: (g, p, c) => Math.max(0, 7 - (c.t || 7)) + (g.has(p, 'soutourou') ? 3 : 0) },
    { id: 'irebasha', name: '相当老の入れ歯', e: '🦷', g: '歯', cats: ['old'], base: 1,
      text: '【取ったとき】次に渡す手札の中で一番素点の高いカードを噛み砕く。その素点ぶん自分が+、噛まれたカードは素点1になる。', flavor: '相当、噛む。',
      onPick: (g, p, c) => { const h = g.hand(p).slice().sort((a, b) => g.baseOf(b) - g.baseOf(a))[0]; if (h && g.baseOf(h) > 1) { const v = g.baseOf(h); K.addPts(c, v); g.setBase(h, 1); g.log(`入れ歯が手札の「${g.cardName(h)}」を噛み砕いた。+${v}`); } } },
    { id: 'sunplaza', name: 'サンプラザ中野くん', e: '🎤', g: '中', cats: ['old'], base: 2,
      text: '【得点】自分の場に〈老〉が3枚以上（これを含む）あれば+8。', flavor: 'スレではTier5（食べ物よりも弱い）に置かれている。',
      score: K.atLeast('old', 3, 8) },
    { id: 'sunadokei', name: 'エタームの砂時計', e: '⏳', g: '砂', cats: ['old', 'death'], base: 4,
      text: '【常時】この札が場にある間、最終手番でも全員がティアを動かせる（スレがdat落ちしない）。', flavor: '永遠に近いが、1手番だけ。',
      hooks: { datOchi: () => false } },
    { id: 'daihon', name: 'TAAMの台本', e: '📖', g: '本', cats: ['death', 'old'], base: 4,
      text: '【常時】自分の【捨てられたとき】と【捨て札へ送られたとき】の効果が2回起きる。', flavor: '「ここで、おじいさんが死ぬ（2回）」',
      hooks: { triggerTimes: (g, o, c, v, card, owner) => owner === o && card !== c ? v * 2 : v } },
    { id: 'terjrjr', name: 'ターミネータジュニアジュニア', short: 'ターミネータJr.Jr.', e: '🤖', g: '孫', cats: ['death', 'ter'], base: 2,
      text: '【得点】自分の場に「ターミネータジュニア」がいれば+6。【捨て札へ送られたとき】捨て札の「ターミネータジュニア」を1枚、自分の場に呼ぶ。', flavor: 'ジュニアの弟。兄の兄は、やはり来ていない。',
      score: K.with('terjr', 6),
      onDeath: (g, o) => { const e = g.discard().find(x => x.c.id === 'terjr'); if (e && g.revive(e, o)) g.log('★ 「にいちゃん！」ターミネータジュニアが駆けつけた。', true); } }
  ]
});
})();

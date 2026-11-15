(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'chahan1', name: 'プロトコルチャーハン', e: '🍳',
  desc: '舌部端子から「実感」を書き込む規格。メモリは挿したまま戦うほど浸透していく。',
  categories: { memo: { name: 'メモリ', color: '#5ce0c8' } },
  rules: {
    text: '【浸透】この局では、手番の終わりに、〈メモリ〉のカードはそれぞれ+1（1枚につき最大+3）。',
    onTurnEnd: (g) => [0, 1, 2, 3].forEach(i => g.table(i).forEach(x => { if (g.hasCat(x, 'memo') && (x.x.shin || 0) < 3) { x.x.shin = (x.x.shin || 0) + 1; K.addPts(x, 1); } }))
  },
  cards: [
    { id: 'chanker', name: 'チャンカー', e: '🧑‍🎤', g: '挿', cats: ['memo'], base: 3,
      text: '【取ったとき】メモリを挿す。自分の場の一番素点の高い他のカードを+2し、〈メモリ〉の仲間にする（カテゴリが3つ未満のとき）。', flavor: '名前はない。「チャンカー」と呼ばれている。',
      onPick: (g, p, c) => { const t = K.bestOf(g, [p], x => x !== c); if (!t) return; K.addPts(t, 2); const cs = g.catsOf(t).slice(); if (!cs.includes('memo') && cs.length < 3) { cs.push('memo'); t.cats = cs; } g.log(`チャンカーが「${g.cardName(t)}」にメモリを挿した。+2`); } },
    { id: 'killchooser', name: 'キルチョイサー', e: '🎯', g: '狙', cats: ['memo'], base: 2,
      text: '【取ったとき】狙撃。左右で点の高いほうの人の、一番素点の低いカードを捨て札へ。', flavor: '第一章で出会う。距離は、いつも保っている。',
      onPick: (g, p) => { const q = g.richer(p); const t = K.worstOf(g, [q]); if (t) { g.log(`★ キルチョイサーが${g.name(q)}の「${g.cardName(t)}」を狙撃した。`, true); g.kill(t); } } },
    { id: 'oroll', name: 'オロール', e: '🛡️', g: '甲', cats: ['memo'], base: 4,
      text: '【常時】甲冑のまま。捨て札にも移動にもならない（誰も甲冑には触れない）。', flavor: '温泉でも、甲冑のまま。',
      hooks: { protect: (g, o, c, v, card) => card === c ? true : v } },
    { id: 'rou', name: '料理長・朗（人格データ）', short: '料理長・朗', e: '👨‍🍳', g: '朗', cats: ['memo', 'food'], base: 2,
      text: '【得点】自分の場に「プロトコルチャーハン・クラックスピード」がいれば+8（本物の一皿）。', flavor: '最下層に眠る、朗々飯店の料理長の人格。',
      score: K.with('crackspeed', 8) },
    { id: 'crackspeed', name: 'プロトコルチャーハン・クラックスピード', short: 'クラックスピード', e: '🍳', g: '飯', cats: ['food', 'memo'], base: 4,
      text: '【取ったとき】舌部端子から「実感」を書き込む。〈食べ物〉のティアを2段上げる。', flavor: '脳に「実感」を書き込む、唯一の規格。',
      onPick: K.up('food', 2) },
    { id: 'blackhole', name: 'プロトコルチャーハン・ブラックホール', short: 'ブラックホール', e: '🕳️', g: '穴', cats: ['food', 'memo'], base: 0,
      text: '【取ったとき】特異点。手札をくれる人の場の一番素点の高いカードを、自分の場へ吸い込む。（⇄交換：かわりに自分の場の一番素点の低いカードを相手へ渡す）', flavor: '挿すんじゃない、混ぜるんだ。いちばん重い井戸の底で。',
      onPick: (g, p) => { const q = g.prev(p); const t = K.bestOf(g, [q]); if (t && g.moveTo(t, p)) g.log(`★ 特異点が${g.name(q)}の「${g.cardName(t)}」を吸い込んだ。`, true); } },
    { id: 'shumai', name: '野良犬シューマイ', short: 'シューマイ', e: '🐕', g: '犬', cats: ['animal'], base: 4,
      text: '【取ったとき】何かをくわえてくる。捨て札からランダムに1枚、自分の場へ。【得点】「料理長・朗」がいれば+4（再会）。', flavor: '肉まんを2回分けてもらった。3回目で、ついてきた。',
      onPick: (g, p) => { const d = g.discard(); if (!d.length) return; const e = d[Math.floor(Math.random() * d.length)]; if (g.revive(e, p)) g.log(`シューマイが「${g.cardName(e.c)}」をくわえてきた。`); },
      score: K.with('rou', 4) }
  ]
});
})();

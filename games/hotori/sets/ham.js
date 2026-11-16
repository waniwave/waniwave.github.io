TJ.registerSet({
  id: 'ham', name: 'ハーム', e: '🍖',
  desc: '増えるハーム。切れ端ごとティアの波に乗る。食べ物は捨て札でも意味を持つ。',
  categories: { ham: { name: 'ハーム', color: '#e07a8a' } },
  rules: null,
  cards: [
    { id: 'ham', name: 'ハーム', e: '🍖', g: 'ハ', cats: ['ham', 'food'], base: 3,
      text: '【取ったとき】自分の場に「ハームの切れ端」を1枚出す。', flavor: 'ハームです。',
      onPick: (g, p) => { g.token(p, 'ham_kire'); g.log(`${g.name(p)}のハームから切れ端が出てきた。`); } },
    { id: 'namaham', name: '生ハーム', e: '🥓', g: '生', cats: ['ham', 'food'], base: 2,
      text: '【得点】自分の場に「ハーム」があれば+6。', flavor: '生ハームは生のハームです。ハームがいないと、ただの生です。',
      score: (g, p) => g.has(p, 'ham') ? 6 : 0 },
    { id: 'namanama', name: '生生ハーム', e: '🥩', g: '生生', cats: ['ham', 'food'], base: 1,
      text: '【得点】自分の場の他の〈ハーム〉1枚につき+2。「生ハーム」がいれば、さらに+3。', flavor: '生ハームより、さらに生。',
      score: (g, p, c) => g.cnt(p, 'ham', c) * 2 + (g.has(p, 'namaham') ? 3 : 0) },
    { id: 'hamegg', name: 'ハームエッグ', e: '🍳', g: '卵', cats: ['ham', 'food'], base: 2,
      text: '【取ったとき】自分の場に「ハームの切れ端」を2枚出す。', flavor: 'ハームが先か、エッグが先か。',
      onPick: (g, p) => { g.token(p, 'ham_kire'); g.token(p, 'ham_kire'); g.log(`ハームエッグから切れ端が2枚わいた。`); } },
    { id: 'jewelham', name: '宝石をちりばめた生ハーム', short: '宝石生ハーム', e: '💎', g: '宝', cats: ['ham', 'food'], base: 3,
      text: '【取ったとき】〈ハーム〉のティアを1段上げる。', flavor: '屋上の鳥の巣にあった。卵ではなかった。',
      onPick: (g, p) => g.move('ham', 1, p) },
    { id: 'kunsei', name: 'ハームの燻製', e: '🌫️', g: '燻', cats: ['ham', 'food', 'death'], base: 2,
      text: '【捨てられたとき】煙が目にしみる。〈食べ物〉のティアを2段下げる。', flavor: '煙の中に、ハームの意地がある。',
      onCut: (g, p) => { g.log('★ 燻製の煙がしみる！〈食べ物〉が2段下がった。', true); g.move('food', -2, p); } },
    { id: 'nokori', name: '冷蔵庫の残り物', e: '🧊', g: '残', cats: ['food', 'death'], base: 1,
      text: '【得点】捨て札にある〈食べ物〉1枚につき+1（最大+6）。', flavor: '賞味期限は、聞かないでください。',
      score: (g) => Math.min(6, g.discard().filter(e => g.hasCat(e.c, 'food')).length) }
  ],
  tokens: [
    { id: 'ham_kire', name: 'ハームの切れ端', e: '🍖', g: '切', cats: ['ham', 'food'], base: 1,
      text: 'ハームから出てきた。素点1。', flavor: 'ハームです（小）。' }
  ]
});

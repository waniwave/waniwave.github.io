TJ.registerSet({
  id: 'ikea', name: 'IKEAとセレブ婚', e: '🪑',
  desc: '家具は手番の終わりに組み上がる。アイロボットは素点の低い札を掃除する。',
  categories: { ikea: { name: 'IKEA', color: '#3a6ad9' }, celeb: { name: 'セレブ', color: '#e0b84a' } },
  rules: null,
  cards: [
    { id: 'ikea', name: 'IKEA', e: '🏬', g: 'I', cats: ['ikea'], base: 2,
      text: '【取ったとき】自分の場に「家具（未組立）」を2つ出す。', flavor: '説明書には図しかない。言葉はいらない。',
      onPick: (g, p) => { g.token(p, 'kagu'); g.token(p, 'kagu'); g.log('IKEAが家具（未組立）を2つ手渡した。'); } },
    { id: 'meatball', name: 'IKEAのミートボール', e: '🧆', g: '肉', cats: ['ikea', 'food'], base: 2,
      text: '【取ったとき】自分の場に「家具（未組立）」を1つ出す。', flavor: '皿の下に、家具の部品が入っていた。',
      onPick: (g, p) => g.token(p, 'kagu') },
    { id: 'manual', name: 'IKEAの説明書', e: '📘', g: '図', cats: ['ikea'], base: 1,
      text: '【得点】自分の場の家具1つにつき+1。', flavor: '図しかない。でも伝わる。',
      score: (g, p) => g.count(p, x => x.id === 'kagu') },
    { id: 'wrench', name: 'IKEAの六角レンチ', e: '🔧', g: '六', cats: ['ikea'], base: 1,
      text: '【取ったとき】自分の場の家具をすべてすぐに組み立て、さらにそれぞれ+1。', flavor: '付属している。いつも付属している。',
      onPick: (g, p) => { let n = 0; g.table(p).forEach(x => { if (x.id === 'kagu') { if (!x.x.built) { x.x.built = 1; x.x.pts = (x.x.pts || 0) + 3; } x.x.pts += 1; n++; } }); if (n) g.log(`★ 六角レンチが唸った。家具${n}つが一気に組み上がった。`, true); } },
    { id: 'henpin', name: 'IKEAの返品カウンター', short: 'IKEAの返品', e: '🧾', g: '返', cats: ['ikea'], base: 2,
      text: '【捨てられたとき】捨てた人の場に「家具（未組立）」が2つ届く（返品のおまけ）。', flavor: 'レシートは不要です。',
      onCut: (g, p) => { g.token(p, 'kagu'); g.token(p, 'kagu'); g.log(`返品したら、${g.name(p)}に家具が2つ届いた。`); } },
    { id: 'irobot', name: 'アイロボット', e: '🤖', g: '掃', cats: ['celeb'], base: 2,
      text: '【取ったとき】左右の場にある、素点1以下のカードをすべて掃除する（捨て札へ）。', flavor: 'ターマーとセレブ婚した。家事は全部やる。',
      onPick: (g, p) => {
        let n = 0; g.neighbors(p).forEach(q => g.table(q).slice().forEach(x => { if (g.baseOf(x) <= 1 && g.kill(x)) n++; }));
        if (n) g.log(`★ アイロボットが隣の場を掃除した。${n}枚が片づいた。`, true);
      } },
    { id: 'tamar', name: 'アイロボットとセレブ婚したターマー', short: 'セレブ婚ターマー', e: '💍', g: '婚', cats: ['celeb', 'ter'], base: 3,
      text: '【得点】自分の場に「アイロボット」がいれば+6。', flavor: '挙式の翌朝から、床がずっときれいだという。',
      score: (g, p) => g.has(p, 'irobot') ? 6 : 0 }
  ],
  tokens: [
    { id: 'kagu', name: '家具（未組立）', e: '📦', g: '具', cats: ['ikea'], base: 0,
      text: '【手番の終わり】組み上がって+3（1回だけ）。', flavor: '六角レンチが付属している。',
      onTurnEnd: (g, o, c) => { if (!c.x.built) { c.x.built = 1; c.x.pts = (c.x.pts || 0) + 3; } } }
  ]
});

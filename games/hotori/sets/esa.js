(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'esa', name: '動物と餌', e: '🐹',
  desc: '動物は食べ物を食べて強くなる。自分の餌か、隣の餌か。',
  categories: {},
  rules: {
    text: '【餌の時間】局の終わりに、〈動物〉と〈食べ物〉の少ないほうの枚数×2点。',
    hooks: { playerScore: (g, v, p) => v + Math.min(g.cnt(p, 'animal'), g.cnt(p, 'food')) * 2 }
  },
  cards: [
    { id: 'hamster', name: 'ハムスター', e: '🐹', g: '鼠', cats: ['animal'], base: 2,
      text: '【取ったとき】ほお袋から、自分の場に「ひまわりの種」（素点1の〈食べ物〉）を2つ出す。', flavor: 'ほお袋に、ター宿の半分が入っている。',
      onPick: K.tokens('tane', 2) },
    { id: 'panda', name: 'パンダーム', e: '🐼', g: '熊猫', cats: ['animal'], base: 5,
      text: '【得点】自分の場の〈食べ物〉1枚につき+1（笹のかわり）。', flavor: '笹がないので、定食を食べている。',
      score: (g, p) => g.cnt(p, 'food') },
    { id: 'kuma', name: 'クマーム', e: '🐻', g: '熊', cats: ['animal'], base: 6,
      text: '【取ったとき】冬眠の前に、左右の場の〈食べ物〉を1枚ずつ食べて捨て札へ。1枚につき+2。', flavor: '冬眠の前に、宴会場を一周する。',
      onPick: (g, p, c) => { let n = 0; g.neighbors(p).forEach(q => { const f = K.bestOf(g, [q], x => g.hasCat(x, 'food')); if (f && g.kill(f)) n++; }); if (n) { K.addPts(c, n * 2); g.log(`★ クマームが${n}品たいらげた。+${n * 2}`, true); } } },
    { id: 'wanta', name: 'ワンターン', e: '🐶', g: '犬', cats: ['animal', 'ter'], base: 3,
      text: '【取ったとき】おすわり。自分の場の〈食べ物〉を1枚（素点の低いもの）食べて捨て札へ、+6。', flavor: 'おすわり、まで1手番かかる。',
      onPick: (g, p, c) => { const f = K.worstOf(g, [p], x => g.hasCat(x, 'food')); if (f && g.kill(f)) { K.addPts(c, 6); g.log('ワンターンが餌を食べた。+6'); } } },
    { id: 'risu', name: 'リスーム', e: '🐿️', g: '栗鼠', cats: ['animal'], base: 1,
      text: '【取ったとき】どんぐりを配る。自分の場の〈食べ物〉すべて+1。', flavor: '隠した場所は、たいてい忘れる。',
      onPick: (g, p) => g.table(p).forEach(x => { if (g.hasCat(x, 'food')) K.addPts(x, 1); }) },
    { id: 'alpaca', name: 'アルパカーター', e: '🦙', g: '駝', cats: ['animal', 'ter'], base: 4,
      text: '【取ったとき】ペッ。左右の人の一番新しいカードの素点−2。', flavor: '怒るとつばを吐く。怒っていなくても吐く。',
      onPick: (g, p) => g.neighbors(p).forEach(q => { const t = g.newest(q); if (t && !g.protected(t)) { g.setBase(t, g.baseOf(t) - 2); g.log(`ペッ。${g.name(q)}の「${g.cardName(t)}」素点−2`); } }) },
    { id: 'onigiri', name: 'おにぎりーム', e: '🍙', g: '握', cats: ['food'], base: 2,
      text: '【取ったとき】自分の場の〈動物〉すべて+1。', flavor: '具は、ター油。',
      onPick: (g, p) => g.table(p).forEach(x => { if (g.hasCat(x, 'animal')) K.addPts(x, 1); }) }
  ],
  tokens: [
    { id: 'tane', name: 'ひまわりの種', e: '🌻', g: '種', cats: ['food'], base: 1, text: 'カリカリ。素点1。', flavor: 'カリカリ。' }
  ]
});
})();

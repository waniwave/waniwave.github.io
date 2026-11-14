(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'hanekaesu', name: '跳ね返す食卓と獣', e: '🦔',
  desc: '菓子折りとヤマアラシは跳ね返す。群れのボスがいる間、群れには手が出せない。',
  categories: {},
  rules: null,
  cards: [
    { id: 'f_juubako', name: '重箱', e: '🍱', g: '重', cats: ['food'], base: 5,
      text: '【取ったとき】三段重ね。自分の場の〈食べ物〉すべてに「守り」をつける。', flavor: '三段重ねは、崩れない。',
      onPick: (g, p) => g.table(p).forEach(x => { if (g.hasCat(x, 'food')) x.x.shield = 1; }) },
    { id: 'f_kashiori', name: 'お返しの菓子折り', e: '🎁', g: '菓', cats: ['food'], base: 4, reflect: 1,
      text: '【常時】他の人の効果で捨て札に送られそうになると、かわりにその効果を出したカードが捨て札へ（そっくり返す）。', flavor: '「つまらないものですが」と、そっくりそのまま返す。' },
    { id: 'f_kashikiri', name: '本日貸切', e: '🪧', g: '貸', cats: ['food', 'inn'], base: 4,
      text: '【常時】手札をくれる人が取ったカードの【取ったとき】は起きない。', flavor: 'のれんの前に、札が一枚。',
      hooks: { blockPick: (g, o, c, v, card, p) => p === g.prev(o) ? true : v } },
    { id: 'a_yamaarashi', name: 'ヤマアラシター', e: '🦔', g: '針', cats: ['animal', 'ter'], base: 5, reflect: 1,
      text: '【常時】他の人の効果で捨て札に送られそうになると、かわりにその効果を出したカードが捨て札へ。', flavor: 'さわったほうが痛い。' },
    { id: 'a_boss', name: '群れのボス', e: '🐺', g: '長', cats: ['animal'], base: 5,
      text: '【常時】自分の場の〈動物〉は、捨て札にも移動にもならない。', flavor: 'ボスがいるあいだ、群れには手が出せない。',
      hooks: { protect: (g, o, c, v, card, owner) => owner === o && g.hasCat(card, 'animal') ? true : v } },
    { id: 'a_sunaba', name: '砂浴び', e: '🐦', g: '砂', cats: ['animal'], base: 5,
      text: '【取ったとき】自分の場の〈動物〉すべてに「守り」をつける。', flavor: 'ダニも除去も、はらい落とす。',
      onPick: (g, p) => g.table(p).forEach(x => { if (g.hasCat(x, 'animal')) x.x.shield = 1; }) },
    { id: 't_sakujo', name: '削除依頼', e: '🗑️', g: '削', cats: ['thread'], base: 5,
      text: '【常時】手札を渡す相手が取ったカードの【取ったとき】は起きない。', flavor: '「該当レスの削除をお願いします」',
      hooks: { blockPick: (g, o, c, v, card, p) => p === g.next(o) ? true : v } }
  ]
});
})();

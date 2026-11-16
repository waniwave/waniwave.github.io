(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'mamori', name: '守りの宿', e: '🪞',
  desc: '鏡は跳ね返し、浴衣は身代わりになり、過去ログは残る。除去への答え。',
  categories: {},
  cards: [
    { id: 'm_kagami', name: '合わせ鏡', e: '🪞', g: '鏡', cats: ['inn'], base: 5, reflect: 1,
      text: '【常時】他の人の効果で捨て札に送られそうになると、かわりにその効果を出したカードが捨て札へ（跳ね返す）。', flavor: '洗面所の鏡と、廊下の鏡が向かい合っている。' },
    { id: 'm_kekkai', name: '立入禁止テープ', e: '🚧', g: '禁', cats: ['inn'], base: 6,
      text: '【常時】手札を渡す相手が取ったカードの【取ったとき】は起きない（清掃中）。', flavor: '清掃中。',
      hooks: { blockPick: (g, o, c, v, card, p) => p === g.next(o) ? true : v } },
    { id: 'm_migawari', name: '身代わりの浴衣', e: '👘', g: '衣', cats: ['inn'], base: 4,
      text: '【常時】自分の場の他のカードが他の人の効果で捨て札に送られるとき、かわりにこれが行く（1回）。', flavor: '中身は、もういない。' },
    { id: 'k_bousai', name: '防災ずきん', e: '⛑️', g: '防', cats: ['inn'], base: 4,
      text: '【取ったとき】自分の場のカードすべてに「守り」をつける（次に受ける捨て札・移動を1回だけ防ぐ）。', flavor: '避難訓練は、毎月第2水曜日。',
      onPick: (g, p) => { g.table(p).forEach(x => { x.x.shield = 1; }); g.log(`${g.name(p)}の場のカードが防災ずきんをかぶった。`); } },
    { id: 'k_kekkai2', name: '宿の結界', e: '⛩️', g: '結', cats: ['inn'], base: 4,
      text: '【常時】6手番目以降は、自分の場のカードは捨て札にも移動にもならない。', flavor: 'チェックアウトの直前に、いちばん強く張られる。',
      hooks: { protect: (g, o, c, v, card, owner) => owner === o && g.turn >= 6 ? true : v } },
    { id: 'm_kakolog', name: '過去ログ保存', e: '💾', g: '録', cats: ['thread'], base: 5,
      text: '【常時】自分の場のカードが捨て札に送られると、その写し（素点1）が場に戻る（1局に2回まで）。', flavor: 'dat落ちしても、まとめに残る。',
      onAnyDeath: (g, o, c, dead, owner) => { if (owner !== o || dead === c || (c.x.n || 0) >= 2) return; c.x.n = (c.x.n || 0) + 1; const t = g.token(o, dead.id); if (t) { t.x.base = 1; g.log(`★ 過去ログから「${g.cardName(dead)}」が復活した（素点1）。`, true); } } },
    { id: 'm_kaeshi', name: '返し技', e: '🥋', g: '返', cats: ['fgc'], base: 5,
      text: '【取ったとき】自分の場のカードすべてに「返し」をつける：次に他の人の効果で捨て札に送られそうになると、かわりにその効果を出したカードが捨て札へ（1回）。', flavor: '昇龍を読んでいた。',
      onPick: (g, p) => { g.table(p).forEach(x => { x.x.kaeshi = 1; }); g.log(`${g.name(p)}の場のカードに「返し」がついた。`); } }
  ]
});
})();

(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'shinri', name: '守りと心理戦', e: '🧠',
  desc: 'リードしたら守る。タイムアップで議論を早めに打ち切る。屈伸で煽る。',
  categories: {},
  rules: null,
  cards: [
    { id: 'tairyoku', name: '体力リード', e: '❤️', g: '体', cats: ['fgc'], base: 2,
      text: '【手番の終わり】そのとき自分の点が一番高ければ+1（最大+4）。', flavor: 'リードしたら、守る。',
      onTurnEnd: (g, o, c) => { const s = g.scores(); if (s[o] >= Math.max(...s)) K.grow(1, 4)(g, o, c); } },
    { id: 'timeup', name: 'タイムアップ', e: '⏱️', g: '時', cats: ['fgc'], base: 3,
      text: '【取ったとき】この局のdat落ち（ティア操作の禁止）が、6手番目から始まる。', flavor: '体力リードしていれば、勝ち。',
      onPick: (g, p) => { g.datFrom(6); g.log('★ タイムアップが近い！ 6手番目からティアを動かせない。', true); } },
    { id: 'leverless', name: 'レバーレス', e: '🎛️', g: '□', cats: ['fgc'], base: 2,
      text: '【取ったとき】次の手番、カードを取りつつティアも動かせる。', flavor: 'ボタンだけで、昇龍が出る。',
      onPick: (g, p) => { g.grantBonus(p); g.log(`${g.name(p)}は次の手番、取りながらティアも動かせる。`); } },
    { id: 'kezuri', name: '削り', e: '🪚', g: '削', cats: ['fgc'], base: 2,
      text: '【手番の終わり】手札を渡す相手の一番素点の高いカードの素点−1（ガードの上からでも減る）。', flavor: 'ガードの上からでも、減る。',
      onTurnEnd: (g, o) => { const t = K.bestOf(g, [g.next(o)]); if (t && g.baseOf(t) > 0) g.setBase(t, g.baseOf(t) - 1); } },
    { id: 'kusshin', name: '屈伸煽り', e: '🙃', g: '屈', cats: ['fgc'], base: 1,
      text: '【取ったとき】左右の人の手札すべての素点−1。自分は+2。', flavor: 'マナーは悪い。効果はある。',
      onPick: (g, p, c) => { g.neighbors(p).forEach(q => g.hand(q).forEach(x => g.setBase(x, g.baseOf(x) - 1))); K.addPts(c, 2); g.log('屈伸した。左右の人の手札がすべて素点−1'); } },
    { id: 'fg_guard', name: 'しゃがみガード', e: '🛡️', g: '屈', cats: ['fgc'], base: 4,
      text: '【常時】自分の場のカードは、捨て札にも移動にもならない。', flavor: '下段も中段も、全部ガードすればいい。',
      hooks: { protect: (g, o, c, v, card, owner) => owner === o ? true : v } },
    { id: 'm_ukemi', name: '受け身', e: '🤸', g: '受', cats: ['fgc'], base: 3,
      text: '【常時】自分の〈格ゲー〉のカードは、ティアのマイナス補正を受けない。', flavor: '起き攻めは、受け身から始まる。',
      hooks: { tierMod: (g, o, c, m, card, cat, owner) => owner === o && cat === 'fgc' && m < 0 ? 0 : m } }
  ]
});
})();

(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'lso', name: 'リミナル・スペース・オペラ', e: '🚀',
  desc: '賞金稼ぎリロイと寸胴型の相棒MEN-Boiler。ラー油弾と酢弾で、失われた味覚を叩き起こす。',
  categories: { uchu: { name: '宇宙', color: '#4a5ad8' } },
  rules: {
    text: '【胃袋ゲージ】局の終わりに、〈食べ物〉と〈麺〉を合わせて7枚以上持っている人は−4（食べすぎ）。',
    hooks: { playerScore: (g, v, p) => g.count(p, x => g.hasCat(x, 'food') || g.hasCat(x, 'men')) >= 7 ? v - 4 : v }
  },
  cards: [
    { id: 'reroi', name: 'リロイ', e: '🤠', g: 'リ', cats: ['men', 'uchu'], base: 4,
      text: '【得点】相棒。自分の場に「MEN-Boiler」がいれば+5。', flavor: '「俺は行くぞ」', score: K.with('menboiler', 5) },
    { id: 'menboiler', name: 'MEN-Boiler', e: '🍲', g: '胴', cats: ['robo', 'men'], base: 3,
      text: '【常時】自分の〈麺〉のカードは、ティアのマイナス補正を受けない（寸胴が守る）。', flavor: '「……ワタシ、ハ、ズンドウ、デス」',
      hooks: { tierMod: (g, o, c, m, card, cat, owner) => owner === o && g.hasCat(card, 'men') && m < 0 ? 0 : m } },
    { id: 'rayudan', name: '特製ラー油弾', e: '🌶️', g: '赤', cats: ['food', 'uchu'], base: 2,
      text: '【取ったとき】左右の場で一番素点の高いカードの素点−2。撃たれたカードの持ち主の〈食べ物〉は、この局の終わりまで素点+1（味覚の原風景がよみがえる）。', flavor: '三種の唐辛子と花椒と焦がしニンニクを、胡麻油で抽出してある。',
      onPick: (g, p) => { const t = K.bestOf(g, g.neighbors(p)); if (!t) return; const q = g.owner(t); g.setBase(t, g.baseOf(t) - 2); g.table(q).forEach(x => { if (g.hasCat(x, 'food')) K.addPts(x, 1); }); g.log(`★ ラー油弾が${g.name(q)}の場で炸裂した。三年ぶりに、舌が何かを感じた。`, true); } },
    { id: 'sudan', name: '自家製ブレンド酢弾', e: '🍶', g: '酢', cats: ['food', 'uchu'], base: 2,
      text: '【取ったとき】後味を断ち切る。自分の場の〈食べ物〉と〈麺〉すべて+1。', flavor: '米酢と黒酢を七対三で合わせ、わずかに柑橘を効かせている。',
      onPick: (g, p, c) => g.table(p).forEach(x => { if (x !== c && (g.hasCat(x, 'food') || g.hasCat(x, 'men'))) K.addPts(x, 1); }) },
    { id: 'kelp', name: 'スペース・ケルプ（昆布）', short: 'スペース・ケルプ', e: '🌿', g: '昆', cats: ['food', 'uchu'], base: 2,
      text: '【取ったとき】〈麺〉のティアを1段上げる。【得点】自分の場に「MEN-Boiler」がいれば+4（撃たずに出汁で解決）。', flavor: '海賊が貨物船を襲っていたのは、昆布のためだった。',
      onPick: K.up('men', 1), score: K.with('menboiler', 4) },
    { id: 'umamiko', name: '旨味粉', e: '🧂', g: '旨', cats: ['food'], base: 6,
      text: '【得点】三日間だけ、世界が旨くなる。3手番目までに取っていると、局の終わりには何も感じない（−6）。', flavor: '四日目には何も感じなくなる粉が、まだ路地の奥で売られている。',
      score: (g, p, c) => c.t > 0 && c.t <= 3 ? -6 : 0 },
    { id: 'akaenpitsu', name: '赤鉛筆の男', e: '✏️', g: '筆', cats: ['men'], base: 1,
      text: '【得点】寄稿。自分の場の〈麺〉と〈食べ物〉が合わせて5枚以上なら+8。', flavor: 'ラーメンウォーカーを執筆中の男。',
      score: (g, p, c) => g.count(p, x => x !== c && (g.hasCat(x, 'food') || g.hasCat(x, 'men'))) >= 5 ? 8 : 0 }
  ]
});
})();

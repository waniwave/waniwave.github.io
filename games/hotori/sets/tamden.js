(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'tamden', name: 'タムデンとタムボイス', e: '🍵',
  desc: 'いつも少しだけ先回りする二人と、置いておくだけで積み上がる制度。',
  categories: { tam: { name: 'タムデン', color: '#6aa86a' } },
  cards: [
    { id: 'tamden', name: 'タームデン・ボーイ', e: '👦', g: 'デ', cats: ['tam', 'ter'], base: 2,
      text: '【取ったとき】〈タムデン〉のティアを1段上げる。【得点】「タームデン・ガール」がいれば+5。', flavor: 'いつも少しだけ先回りしている。',
      onPick: K.up('tam', 1), score: K.with('tamgirl', 5) },
    { id: 'tamgirl', name: 'タームデン・ガール', e: '👧', g: 'ガ', cats: ['tam', 'ter'], base: 2,
      text: '【取ったとき】先回り。次の手番、カードを取りつつティアも動かせる。【得点】「タームデン・ボーイ」がいれば+5。', flavor: 'ボーイよりさらに先回りしている。',
      onPick: (g, p) => { g.grantBonus(p); g.log(`${g.name(p)}は次の手番、取りながらティアも動かせる。`); }, score: K.with('tamden', 5) },
    { id: 'map', name: 'マープの地図', e: '🗺️', g: '図', cats: ['inn'], base: 3,
      text: '【得点】〈宿〉のティアの補正を、もう一度得る（地図は女将の頭の中にある）。', flavor: '女将の頭の中の地図を、誰かが書き写したもの。',
      score: (g) => g.mod('inn') || 0 },
    { id: 'kanae', name: '叶（にじさんじライバー）', short: '叶', e: '🎙️', g: '叶', cats: ['thread'], base: 2,
      text: '【得点】自分の場の他のカード1枚につき+1（最大+6）。', flavor: 'スレではTier2（強キャラ）として名前が挙がっている。',
      score: (g, p, c) => Math.min(6, g.table(p).filter(x => x !== c).length) },
    { id: 'kirby', name: 'たてながのカービィ', short: 'たてながのカービィ', e: '🌀', g: '縦', cats: ['thread'], base: 1,
      text: '【取ったとき】左右の場で一番素点の低いカードを縦に吸い込んで捨て札へ。その素点ぶん+。', flavor: '縦に長い。それだけで作中最強レベルに届いた。',
      onPick: (g, p, c) => { const t = K.worstOf(g, g.neighbors(p)); if (t) { const v = g.baseOf(t); const n = g.cardName(t); if (g.kill(t)) { K.addPts(c, v); g.log(`★ 「${n}」を縦に吸い込んだ。+${v}`, true); } } } },
    { id: 'rokuon', name: 'タムボイスの録音', e: '📼', g: '録', cats: ['tam', 'thread'], base: 1,
      text: '【取ったとき】自分の場の他のカード1枚（素点の高いもの）の【取ったとき】の効果を、もう一度起こす。', flavor: '「……タム」（再生）',
      onPick: (g, p, c) => {
        const t = g.table(p).filter(x => x !== c && TJ.def(x).onPick && !['rokuon', 'obaasan', 'gesoku', 'hachi'].includes(x.id)).sort((a, b) => g.baseOf(b) - g.baseOf(a))[0];
        if (t) { g.log(`★ 録音を再生した。「${g.cardName(t)}」の効果がもう一度。`, true); TJ.def(t).onPick(g, p, t); }
      } },
    { id: 'haishi', name: 'タムボイス制度廃止法案', e: '📜', g: '廃', cats: ['thread'], base: 2,
      text: '【取ったとき】全員の場の「タムボイス制度」を廃止して捨て札へ。1枚につき+8。なければ〈タムデン〉を1段下げる。', flavor: '可決されると、制度に積み上がっていたものが法案のほうに移る。',
      onPick: (g, p, c) => {
        let n = 0; [0, 1, 2, 3].forEach(q => g.table(q).slice().forEach(x => { if (x.id === 'tamvoice' && g.kill(x)) n++; }));
        if (n) { K.addPts(c, n * 8); g.log(`★ タムボイス制度が廃止された！ +${n * 8}`, true); } else g.move('tam', -1, p);
      } }
  ]
});
})();

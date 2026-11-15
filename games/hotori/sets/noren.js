(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'noren', name: '暖簾の外側', e: '🏮',
  desc: 'ネオ・トーキョー第七到着ゲートの裏。カウンター六席の店で、審査AIが一杯を判定する。',
  categories: {},
  rules: {
    text: '【開店】局の始めに、〈麺〉はTier2から始まる。',
    onRoundStart: (g) => { if (g.pos('men') != null && g.pos('men') > 3) g.setPos('men', 3); }
  },
  cards: [
    { id: 'gravity', name: '麺処グラヴィティ・ウェル', short: 'グラヴィティ・ウェル', e: '🏮', g: '店', cats: ['men', 'inn'], base: 3,
      text: '【得点】カウンター六席。自分の場の他の〈麺〉1枚につき+2（最大+12）。', flavor: '換気扇は三百年もの。',
      score: (g, p, c) => Math.min(12, g.cnt(p, 'men', c) * 2) },
    { id: 'yoru', name: '劇団員の女（ヨル）', short: 'ヨル', e: '🎭', g: '夜', cats: ['inn'], base: 3,
      text: '【得点】自分の場に「麺処グラヴィティ・ウェル」がいれば+5（女将さんになる）。', flavor: 'ここではないどこかへ、行きたがっていた。',
      score: K.with('gravity', 5) },
    { id: 'walker', name: '審査AI〈WALKER〉', short: 'WALKER', e: '🤖', g: '審', cats: ['robo'], base: 4,
      text: '【取ったとき】判定。〈麺〉のティアを、自分の場の〈麺〉の枚数ぶん上げる（最大2段）。', flavor: '同じ一杯には、いつも同じ点がつく。',
      onPick: (g, p) => { const n = Math.min(2, g.cnt(p, 'men')); if (n) { g.move('men', n, p); g.log(`WALKERの判定：〈麺〉+${n}段。`); } } },
    { id: 'yonhonude', name: '四本腕の老人', e: '👴', g: '腕', cats: ['old', 'robo'], base: 3,
      text: '【取ったとき】持ち帰りを届けてもらう。手札をくれる人の場から〈麺〉か〈食べ物〉を1枚（素点の高いもの）受け取る。（⇄交換：かわりに自分の場の一番素点の低いカードを相手へ渡す）', flavor: '十九日かけて、油そばが届いた。',
      onPick: (g, p) => { const q = g.prev(p); const t = K.bestOf(g, [q], x => g.hasCat(x, 'men') || g.hasCat(x, 'food')); if (t && g.moveTo(t, p)) g.log(`★ ${g.name(q)}の「${g.cardName(t)}」が、四本の腕で届けられた。`, true); } },
    { id: 'holochashu', name: 'ホログラムのチャーシュー', short: 'ホログラムのチャーシュー', e: '🥩', g: '幻', cats: ['food', 'robo'], base: 5, noTier: 1,
      text: '【常時】召し上がった気分だけ。ティアの補正を受けない。【得点】自分の場の本物の〈食べ物〉1枚につき−1。', flavor: '召し上がった気分だけを、確実にお届けする。',
      score: (g, p, c) => -g.cnt(p, 'food', c) },
    { id: 'grandprix', name: 'ラーメングランプリ', e: '🏆', g: '杯', cats: ['men'], base: 1,
      text: '【得点】〈麺〉を一番多く持っていれば+8（同数を含む）。', flavor: '審査員席には、なぜか寸胴が座っている。',
      score: (g, p) => { const c = [0, 1, 2, 3].map(i => g.cnt(i, 'men')); return c[p] > 0 && c[p] === Math.max(...c) ? 8 : 0; } },
    { id: 'kenbaiki', name: '券売機', e: '🎫', g: '券', cats: ['men', 'robo'], base: 2,
      text: '【取ったとき】売切。手札を渡す相手は、次の手番に取ったカードの【取ったとき】が起きない。', flavor: '選べない食券には「売切」が付く。',
      onPick: (g, p) => { const q = g.next(p); g.noPickNext(q); g.log(`券売機に「売切」が付いた。${g.name(q)}は次の手番、【取ったとき】が起きない。`); } }
  ]
});
})();

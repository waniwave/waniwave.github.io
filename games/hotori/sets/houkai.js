(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'houkai', name: 'スレ崩壊', e: '💥',
  desc: 'ティア表をめちゃくちゃにし、親の座を奪い、場の効果を増やす。スレそのものを壊すカードたち。',
  categories: { arashi: { name: '荒らし', color: '#ff4f6a' } },
  cards: [
    { id: 'h_arashi', name: 'スレ立て荒らし', e: '🌪️', g: '荒', cats: ['arashi', 'thread'], base: 2,
      text: '【取ったとき】ティア表をめちゃくちゃにする。欠番以外の全カテゴリの段を、ランダムに入れ替える。', flavor: '「このスレは俺が乗っ取った」',
      onPick: (g) => { g.shuffleTiers(); g.log('★ スレが荒らされた！ ティア表がめちゃくちゃになった。', true); } },
    { id: 'h_kagami', name: '逆さ宿の鏡', e: '🪞', g: '鏡', cats: ['arashi', 'inn'], base: 3,
      text: '【取ったとき】ティア表を上下にひっくり返す（God⇔Tier5、Tier0⇔Tier4、Tier1⇔Tier3）。', flavor: '鏡の中では、食べ物が神だった。',
      onPick: (g) => { g.flipTiers(); g.log('★ 鏡に映ったティア表が、上下さかさまになった！', true); } },
    { id: 'h_otsu', name: '>>1乙', e: '🙇', g: '乙', cats: ['arashi', 'thread'], base: 3,
      text: '【取ったとき】スレ主（親）の座を奪う。次の手番から、自分から順に解決する。', flavor: '乙と言った者が、次のスレを立てる。',
      onPick: (g, p) => g.makeOya(p) },
    { id: 'h_jisure', name: '次スレ', e: '📑', g: '次', cats: ['arashi', 'thread'], base: 1,
      text: '【取ったとき】この局に、場の効果（お題）をもう1枚追加する。', flavor: '「次スレはこちら」→ルールが増えている。',
      onPick: (g) => g.addRule() },
    { id: 'h_dat', name: 'dat落ち職人', e: '⏳', g: '落', cats: ['arashi'], base: 4,
      text: '【取ったとき】次の手番から、スレがdat落ちする（全員ティア操作禁止）。今のティア表で勝負が決まる。', flavor: '書き込まないことで、スレを殺す。',
      onPick: (g) => { if (g.turn + 1 < g.turns) { g.datFrom(g.turn + 1); g.log('★ dat落ち職人が現れた。次の手番からティアはもう動かせない。', true); } } },
    { id: 'h_jien', name: 'IDの変わる人', e: '🎭', g: '自', cats: ['arashi', 'thread'], base: 1,
      text: '【得点】この局で自分がティアを動かした回数×3。', flavor: '「自演乙」「別人だが？」',
      score: (g, p) => g.cutCount(p) * 3, ai: (g) => 3 },
    { id: 'h_matome', name: 'まとめサイト転載', e: '📰', g: '転', cats: ['arashi'], base: 0,
      text: '【取ったとき】選ばれていないカードセットから、カードを2枚、自分の場に呼び出す。', flavor: '【悲報】ター宿、まとめられる',
      onPick: (g, p) => { const cs = g.summon(p, 2); if (cs.length) g.log(`★ まとめサイトから「${cs.map(c => g.cardName(c)).join('」「')}」が転載されてきた！`, true); } }
  ]
});
})();

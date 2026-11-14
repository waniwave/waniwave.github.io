(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'chahan2', name: 'マンカン・ホールディングス', e: '🏢',
  desc: '会長は全人類にあの一皿の実感を配ろうとしている。常務と部長と歩行要塞。それに抗う空腹同盟。',
  categories: { mankan: { name: 'マンカン', color: '#c84a3a' }, memo: { name: 'メモリ', color: '#5ce0c8' } },
  rules: {
    text: '【満漢全席号】局の終わりに、〈マンカン〉を一番多く持っている人は+3（同数なら全員。0枚は対象外）。',
    hooks: { playerScore: (g, v, p) => { const c = [0, 1, 2, 3].map(i => g.cnt(i, 'mankan')); const m = Math.max(...c); return m > 0 && c[p] === m ? v + 3 : v; } }
  },
  cards: [
    { id: 'kaichou', name: 'マンカン会長', e: '👔', g: '会', cats: ['mankan', 'old'], base: 5,
      text: '【取ったとき】全人類同時配信。自分以外の全員の、一番素点の高いカードの素点−2。', flavor: '若い頃、遠くから朗々飯店へ通った客。',
      onPick: (g, p) => { g.others(p).forEach(q => { const t = K.bestOf(g, [q]); if (t) g.setBase(t, g.baseOf(t) - 2); }); g.log('★ 全人類同時配信が始まった。', true); } },
    { id: 'midou', name: 'ミドウ常務', e: '💼', g: '務', cats: ['mankan'], base: 3,
      text: '【得点】自分の場の他の〈マンカン〉1枚につき+2。', flavor: '決裁は早い。', score: K.per('mankan', 2) },
    { id: 'tsukimi', name: 'ツキミ部長', e: '🌕', g: '月', cats: ['mankan'], base: 2,
      text: '【取ったとき】書類で止める。手札を渡す相手は、次の手番ティアを動かせない。', flavor: '退職の手続きは、まだ終わっていない。',
      onPick: (g, p) => { const q = g.next(p); g.blockTier(q); g.log(`ツキミ部長が稟議を差し戻した。${g.name(q)}は次の手番ティアを動かせない。`); } },
    { id: 'titan', name: '歩行要塞タイタン', e: '🦾', g: '塞', cats: ['robo', 'mankan'], base: 7,
      text: '【得点】重い。自分の場のカードが7枚以上なら−4。', flavor: '第三章の終わりに歩いてくる。',
      score: (g, p) => g.table(p).length >= 7 ? -4 : 0 },
    { id: 'gastro', name: 'ガストロノミカ', e: '🧪', g: '合', cats: ['robo', 'food'], base: 4,
      text: '【取ったとき】合成の時代。〈食べ物〉を1段下げ、〈ロボ〉を1段上げる。', flavor: '静かの海の、第八厨房にいる。',
      onPick: (g, p) => { g.move('food', -1, p); g.move('robo', 1, p); } },
    { id: 'zerocal', name: 'ゼロカロリー', e: '🥛', g: '零', cats: ['memo'], base: 2,
      text: '【得点】空腹同盟。自分の場に〈食べ物〉が1枚もなければ+8。', flavor: '空腹同盟。集会は第三章のあと。',
      score: (g, p) => g.cnt(p, 'food') ? 0 : 8 },
    { id: 'sommelier', name: 'サイレント・ソムリエ', e: '🍷', g: '黙', cats: ['memo'], base: 3,
      text: '【捨てられたとき】説得された。捨て札にならず、捨てた人の場に入る。', flavor: '戦闘の中で、説得に応じた。',
      onCut: (g, p, c, entry) => { if (g.revive(entry, p)) g.log(`★ サイレント・ソムリエが説得され、${g.name(p)}の仲間になった。`, true); } }
  ]
});
})();

(function () {
const K = TJ.K;
// いま点が一番高い人（自分以外）
const top = (g, p) => g.leader(p);
TJ.registerSet({
  id: 'gekoku', name: '下剋上の宿', e: '🏯',
  desc: '首位を引きずり下ろすためのカード。包囲網、談合、席替え、そして「逆神の札」を2枚そろえると、点の低い人が勝つ。',
  categories: { gekoku: { name: '下剋上', color: '#c0392b' } },
  cards: [
    { id: 'k_houi', name: '包囲網', e: '🕸️', g: '包', cats: ['gekoku'], base: 3,
      text: '【取ったとき】いま点が一番高い人（自分以外）の、場で一番多いカテゴリを2段下げる。', flavor: '「あいつのハーム、下げようぜ」',
      onPick: (g, p) => { const q = top(g, p); if (q < 0) return; const k = g.topCatOf(q); if (k && g.pos(k) !== TJ.KESU) { g.move(k, -2); g.log(`★ 包囲網！ ${g.name(q)}の〈${TJ.catName(k)}〉が2段下げられた。`, true); } } },
    { id: 'k_dangou', name: '談合', e: '🤝', g: '談', cats: ['gekoku'], base: 2,
      text: '【取ったとき】いま点が一番高い人（自分以外）の場のカードを、5枚まで1枚ずつ−1。', flavor: '宿の裏の喫煙所で決まった。',
      onPick: (g, p) => { const q = top(g, p); if (q < 0) return; const cs = g.table(q).filter(x => !g.protected(x)).slice(0, 5); cs.forEach(x => K.addPts(x, -1)); if (cs.length) g.log(`★ 談合成立。${g.name(q)}のカード${cs.length}枚が−1。`, true); } },
    { id: 'k_sekigae', name: '席替え', e: '🪑', g: '席', cats: ['gekoku', 'school'], base: 1,
      text: '【取ったとき】自分がいま4位なら、1位の人と場（取ったカード）を丸ごと入れ替える。4位でなければ+4。', flavor: 'くじ引きの結果です（くじは見せない）。',
      onPick: (g, p, c) => { const sc = [0, 1, 2, 3].map(i => g.score(i)); const mine = sc[p]; const last = sc.every((v, i) => i === p || v >= mine); if (last) { const q = sc.indexOf(Math.max(...sc)); if (q !== p) { g.swapTables(p, q); return; } } K.addPts(c, 4); } },
    { id: 'k_zeimu', name: '税務調査', e: '🧾', g: '税', cats: ['gekoku'], base: 3,
      text: '【取ったとき】いま点が一番高い人（自分以外）の、一番素点の高いカードを気絶させる（効果が止まる）。', flavor: '「この〈ハーム〉の仕入れ値は？」',
      onPick: (g, p) => { const q = top(g, p); if (q < 0) return; const t = K.bestOf(g, [q]); if (t) { g.stun(t); g.log(`★ 税務調査が入った。${g.name(q)}の「${g.cardName(t)}」が止まった。`, true); } } },
    { id: 'k_enjou', name: '炎上', e: '🔥', g: '炎', cats: ['gekoku', 'thread'], base: 2,
      text: '【取ったとき】いま点が一番高い人（自分以外）は、次の手番ティアを動かせず、取ったカードの【取ったとき】も起きない。', flavor: '燃えている間は、何を言っても燃える。',
      onPick: (g, p) => { const q = top(g, p); if (q < 0) return; g.blockTier(q, g.turn + 1); g.noPickNext(q); g.log(`★ ${g.name(q)}が炎上した！ 次の手番はおとなしくするしかない。`, true); } },
    { id: 'k_gyakushin', name: '逆神の札', e: '🌀', g: '逆', cats: ['gekoku'], base: 1, copies: 2,
      text: '【常時】自分の場にこのカードが2枚そろうと、この局は点数が一番低い人が1位になる。', flavor: '1枚ではただの札。2枚で神になる。',
      hooks: { rankReverse: (g, o, c, v) => g.count(o, x => x.id === 'k_gyakushin') >= 2 ? true : v },
      ai: (g, p) => g.count(p, x => x.id === 'k_gyakushin') ? 6 : 1 }
  ]
});
})();

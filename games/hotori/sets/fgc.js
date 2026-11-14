TJ.registerSet({
  id: 'fgc', name: 'ゲーセン', e: '🕹️',
  desc: '読み合いと確定反撃。ティアを動かした瞬間を狩る。',
  categories: {},
  rules: {
    text: '【ゲーセン】この局では、〈格ゲー〉のティアの補正が2倍になる。',
    hooks: { tierMod: (g, m, c, cat) => cat === 'fgc' ? m * 2 : m }
  },
  cards: [
    { id: 'shoryu', name: '昇龍拳コマンド', e: '🐉', g: '昇', cats: ['fgc'], base: 2,
      text: '【取ったとき】無敵対空。左右の場の、素点4以上のカードのうち一番素点の高いもの1枚を捨て札へ送る。', flavor: '→↓↘＋P。出せるまで、宿に泊まり込みで練習した。',
      onPick: (g, p) => {
        const cand = []; g.neighbors(p).forEach(q => g.table(q).forEach(x => { if (g.baseOf(x) >= 4 && !g.protected(x)) cand.push(x); }));
        cand.sort((a, b) => g.baseOf(b) - g.baseOf(a));
        if (cand[0]) { const n = g.cardName(cand[0]); if (g.kill(cand[0])) g.log(`★ 昇龍！「${n}」が撃ち落とされた。`, true); }
      } },
    { id: 'kakuhan', name: '確定反撃', e: '⚡', g: '確', cats: ['fgc'], base: 2,
      text: '【取ったとき】この手番にティアを動かした他の人全員の場から、一番新しいカードを1枚ずつ捨て札へ送る。', flavor: '通称「確反」。動いたら、負け。',
      onPick: (g, p) => {
        const ts = g.tierersThisTurn().filter(q => q !== p); let n = 0;
        ts.forEach(q => { const t = g.newest(q); if (t && g.kill(t)) n++; });
        g.log(n ? `★ 確反！ ティアを動かした${n}人に刺さった。` : '確反をとれる隙がなかった。', !!n);
      } },
    { id: 'nuke', name: '投げ抜け', e: '🙅', g: '抜', cats: ['fgc'], base: 2,
      text: '【常時】自分の場のカードは、捨て札に送られず、移動もさせられない。', flavor: 'つかまれたら、すぐ押す。',
      hooks: { protect: (g, o, c, v, card, owner) => owner === o ? true : v } },
    { id: 'matsu', name: '待ち', e: '🧘', g: '待', cats: ['fgc'], base: 3,
      text: '【常時】このカードはティアのマイナス補正を受けない。', flavor: '動いたほうが負け。',
      hooks: { tierMod: (g, o, c, m, card) => card === c && m < 0 ? 0 : m } },
    { id: 'umehara', name: 'ウメハラ', e: '🔥', g: '梅', cats: ['fgc'], base: 2,
      text: '【得点】背水の逆転。この局の前までの順位点の合計が一番低い（同点を含む）なら+8。', flavor: '格ゲーの伝説として、スレでもよく名前が挙がる。',
      score: (g, p) => { const m = Math.min(...[0, 1, 2, 3].map(i => g.rp(i))); return g.rp(p) === m ? 8 : 0; } },
    { id: 'taipan', name: '台パン', e: '👊', g: '台', cats: ['fgc'], base: 4,
      text: '【取ったとき】マナーが悪い。〈格ゲー〉のティアを2段下げる。', flavor: 'マナーは悪い。筐体も悪くない。',
      onPick: (g, p) => { g.log('★ ドン！ 台パンで〈格ゲー〉が2段下がった。', true); g.move('fgc', -2, p); } },
    { id: 'tenin', name: 'ゲームセンターの店員', short: 'ゲーセンの店員', e: '🧑‍💼', g: '店', cats: ['fgc'], base: 2,
      text: '【取ったとき】〈格ゲー〉のティアを1段上げる。【得点】自分の場の他の〈格ゲー〉1枚につき+1。', flavor: '台パンには、厳しい。',
      onPick: (g, p) => g.move('fgc', 1, p),
      score: (g, p, c) => g.cnt(p, 'fgc', c) }
  ]
});

TJ.registerSet({
  id: 'taam', name: 'TAAM', e: '⚰️',
  desc: 'おばあさんは最初に死に、おじいさんは最後に死ぬ。捨て札が増えるほど強くなる一家。',
  categories: {},
  rules: {
    text: '【お通夜】この局では、捨て札にある「自分が捨てた（または自分の場から死んだ）〈死〉」1枚につき+2。',
    hooks: { playerScore: (g, v, p) => v + 2 * g.discard().filter(e => e.p === p && g.hasCat(e.c, 'death')).length }
  },
  cards: [
    { id: 'obaasan', name: 'TAAMで最初に死んだおばあさん', short: '最初に死んだおばあさん', e: '👵', g: '婆', cats: ['death', 'old'], base: 0,
      text: '【取ったとき】すぐに死ぬ（捨て札へ）。〈死〉のティアを2段上げる。', flavor: '最初に死ぬ。それが彼女の役目。',
      onPick: (g, p, c) => { g.log('おばあさんが「お先に」と言った。'); g.kill(c); g.move('death', 2, p); } },
    { id: 'ojiisan', name: 'TAAMで最後死んだおじいさん', short: '最後死んだおじいさん', e: '👴', g: '爺', cats: ['death', 'old'], base: 2,
      text: '【得点】捨て札にある〈死〉1枚につき+2（最大+8）。', flavor: '最後に死ぬ。それまでは元気だ。',
      score: (g) => Math.min(8, 2 * g.discard().filter(e => g.hasCat(e.c, 'death')).length) },
    { id: 'mago', name: 'TAAMで最後生き残った孫', short: '生き残った孫', e: '🧒', g: '孫', cats: ['death'], base: 1,
      text: '【得点】捨て札の枚数（全員ぶん）1枚につき+1（最大+8）。', flavor: 'おじいさんもおばあさんも死んだ。孫は強くなった。',
      score: (g) => Math.min(8, g.discard().length) },
    { id: 'eterm', name: 'エターム', e: '♾️', g: '永', cats: ['death'], base: 1,
      text: '【局の終わり】+3されて、次の局も自分の場に残る（永遠）。', flavor: '永遠のターム。今度こそ本当に永遠。',
      carry: (g, o, c) => { c.x.pts = (c.x.pts || 0) + 3; return true; },
      ai: (g) => g.round < 3 ? 2 : 0 },
    { id: 'before', name: 'ビフォー・エターム', e: '⏳', g: '前', cats: ['death'], base: 2,
      text: '【捨てられたとき】捨てた人の場に「エターム」が現れる。', flavor: '永遠になる前のターム。',
      onCut: (g, p) => { g.token(p, 'eterm'); g.log(`★ ビフォー・エタームが永遠になった。${g.name(p)}の場にエターム。`, true); } },
    { id: 'terjr', name: 'ターミネーターの弟、ターミネータジュニア', short: 'ターミネータジュニア', e: '🤖', g: '弟', cats: ['death', 'ter'], base: 3,
      text: '【捨てられたとき】捨て札にならず、+2されて捨てた人の場に入る（「また来る」）。', flavor: '兄は来ていない。代わりに、何度でも強くなって来る。',
      onCut: (g, p, c, entry) => { if (g.revive(entry, p)) { c.x.pts = (c.x.pts || 0) + 2; g.log(`★ ターミネータジュニアは「また来る」と言って${g.name(p)}の場に来た。`, true); } } },
    { id: 'doctor', name: 'ドクターム', e: '🩺', g: '医', cats: ['death'], base: 2,
      text: '【取ったとき】捨て札から〈死〉を1枚（素点の高いもの）自分の場に戻す。', flavor: '湯治の先生。処方はだいたい「湯」。',
      onPick: (g, p) => {
        const e = g.discard().filter(e => g.hasCat(e.c, 'death')).sort((a, b) => g.baseOf(b.c) - g.baseOf(a.c))[0];
        if (e && g.revive(e, p)) g.log(`★ ドクタームが「${g.cardName(e.c)}」を蘇生した。`, true);
      } }
  ]
});

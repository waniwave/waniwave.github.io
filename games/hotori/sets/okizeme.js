(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'okizeme', name: '起き攻めとゲージ', e: '🔋',
  desc: '〈格ゲー〉を取るたびにゲージがたまる。溜めて、吐く。中段と下段の二択。',
  categories: {},
  rules: {
    text: '【ゲージ】この局では、〈格ゲー〉のカードを取るたびに、その人のゲージが1たまる。局の終わりに、残ったゲージ1につき+1。',
    onAnyPick: (g, p, c) => { if (g.hasCat(c, 'fgc')) g.addGauge(p, 1); },
    hooks: { playerScore: (g, v, p) => v + g.gauge(p) }
  },
  cards: [
    { id: 'okizeme', name: '起き攻め', e: '🛌', g: '起', cats: ['fgc'], base: 3,
      text: '【常時】左右の人の場のカードが捨て札に送られるたびに+2（倒れた相手に重ねる）。', flavor: '倒れた相手に、重ねる。',
      onAnyDeath: (g, o, c, dead, owner) => { if (g.neighbors(o).includes(owner)) K.addPts(c, 2); } },
    { id: 'atenage', name: '当て投げ', e: '🤼', g: '投', cats: ['fgc'], base: 3,
      text: '【取ったとき】当ててから、投げる。左右の場で一番素点の低いカードを捨て札へ。', flavor: '当ててから、投げる。',
      onPick: (g, p) => { const t = K.worstOf(g, g.neighbors(p)); if (t) { g.log('つかんで、投げた。'); g.kill(t); } } },
    { id: 'chudan', name: '中段', e: '🥋', g: '中', cats: ['fgc'], base: 3,
      text: '【取ったとき】ガード崩し。左右の人の場の「箱」と「守り」をすべてはがす。【得点】「下段」がいれば+3（二択）。', flavor: 'しゃがんでいると、当たる。',
      onPick: (g, p) => { let n = 0; g.neighbors(p).forEach(q => g.table(q).forEach(x => { if (x.x.boxed || x.x.shield) { x.x.boxed = 0; x.x.shield = 0; n++; } })); if (n) g.log(`★ 中段が崩した。${n}枚のガードがはがれた。`, true); },
      score: K.with('gedan', 3) },
    { id: 'gedan', name: '下段', e: '🦵', g: '下', cats: ['fgc'], base: 2,
      text: '【取ったとき】左右の場で一番素点の低いカードの素点−2。【得点】「中段」がいれば+3（二択）。', flavor: '立っていると、当たる。',
      onPick: (g, p) => { const t = K.worstOf(g, g.neighbors(p)); if (t) g.setBase(t, g.baseOf(t) - 2); }, score: K.with('chudan', 3) },
    { id: 'gauge', name: 'ゲージ', e: '🔋', g: 'G', cats: ['fgc'], base: 1,
      text: '【取ったとき】ゲージ+2。', flavor: '溜めて、吐く。', onPick: (g, p) => { g.addGauge(p, 2); g.log(`${g.name(p)}のゲージ+2（いま${g.gauge(p)}）。`); } },
    { id: 'chouhissatsu', name: '超必殺技', e: '💥', g: '超', cats: ['fgc'], base: 3,
      text: '【取ったとき】暗転。ゲージをすべて使い、1につき、左右で点の高いほうの人のカードすべての素点−1。', flavor: '暗転。',
      onPick: (g, p) => { const n = g.gauge(p); if (!n) return; g.addGauge(p, -n); const q = g.richer(p); g.table(q).forEach(x => { if (!g.protected(x)) g.setBase(x, g.baseOf(x) - n); }); g.log(`★ 超必殺技！ ゲージ${n}本ぶん、${g.name(q)}の札すべて素点−${n}`, true); } },
    { id: 'combo', name: 'コンボ練習', e: '🎮', g: '練', cats: ['fgc'], base: 1,
      text: '【得点】自分の場の他の〈格ゲー〉1枚につき+2。', flavor: 'トレモに3時間。', score: K.per('fgc', 2) }
  ]
});
})();

TJ.registerSet({
  id: 'kin', name: '金武町タイム', e: '🚌',
  desc: 'いつ取るかで点が変わる。今向かってるタム、まだ寝てるタム。',
  categories: { kin: { name: '金武町', color: '#e08a4a' }, yoru: { name: '夜', color: '#4a4a8a' } },
  rules: null,
  cards: [
    { id: 'mukatteru', name: '金武町タームくん「今向かってるタム」のとき', short: 'タームくん（向かってる）', e: '🏃', g: '向', cats: ['kin', 'ter'], base: 1,
      text: '【得点】5手番目までに取っていれば+7（到着）。', flavor: 'Tier1なのは「今向かってるタム」のときだけ。',
      score: (g, p, c) => c.t > 0 && c.t <= 5 ? 7 : 0 },
    { id: 'tsuita', name: '金武町タームくん「着いたタム」のとき', short: 'タームくん（着いた）', e: '🏁', g: '着', cats: ['kin', 'ter'], base: 2,
      text: '【得点】自分の場に「今向かってるタム」がいれば+4。', flavor: '着いたら、Tier5だったタム。',
      score: (g, p) => g.has(p, 'mukatteru') ? 4 : 0 },
    { id: 'neteru', name: '金武町タームくん「まだ寝てるタム」のとき', short: 'タームくん（寝てる）', e: '😴', g: '寝', cats: ['kin', 'ter'], base: 0,
      text: '【得点】7手番目（最後）に取っていれば+9。それ以外なら+2。', flavor: '向かってすらいないタム。',
      score: (g, p, c) => c.t === TJ.TURNS ? 9 : 2 },
    { id: 'bus', name: '金武町行きのバス', e: '🚌', g: 'バス', cats: ['kin'], base: 2,
      text: '【取ったとき】左右の場にいる〈金武町〉を1枚、自分の場に乗せる（点の高い人から）。', flavor: '今向かってるバス。',
      onPick: (g, p) => {
        const r = g.richer(p); const order = [r, g.neighbors(p).find(x => x !== r)];
        for (const q of order) { const t = g.table(q).find(x => g.hasCat(x, 'kin')); if (t && g.moveTo(t, p)) { g.log(`★ ${g.name(q)}の「${g.cardName(t)}」がバスに乗った。`, true); return; } }
      } },
    { id: 'syrup', name: 'syrup16g', e: '🌙', g: '16', cats: ['yoru'], base: 1,
      text: '【得点】6手番目以降に取っていれば+6。', flavor: 'スレでは「敵意をもたないもの」としてTier4に分類されている。',
      score: (g, p, c) => c.t >= 6 ? 6 : 0 },
    { id: 'chiko', name: 'チコリータ', e: '🌱', g: 'チ', cats: ['animal', 'yoru'], base: 1,
      text: '【手番の終わり】育つ。追加点が+1→+2→+4→+8と2倍になっていく（+8まで）。', flavor: 'スレではTier5（食べ物よりも弱い）に置かれている。育つ。',
      onTurnEnd: (g, o, c) => { c.x.pts = Math.min(8, Math.max(1, (c.x.pts || 0) * 2)); },
      ai: (g) => Math.min(8, Math.pow(2, Math.max(0, TJ.TURNS - g.turn))) },
    { id: 'tamvoice', name: 'タムボイス制度', e: '📢', g: '制', cats: ['kin', 'thread'], base: 1,
      text: '【手番の終わり】自分の場の〈金武町〉1枚につき+1。', flavor: '制度なので、置いておくだけで毎手番何かが積み上がる。',
      onTurnEnd: (g, o, c) => { c.x.pts = (c.x.pts || 0) + g.cnt(o, 'kin'); },
      ai: (g, p) => (TJ.TURNS - g.turn + 1) * Math.max(1, g.cnt(p, 'kin')) }
  ]
});

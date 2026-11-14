TJ.registerSet({
  id: 'eo', name: 'EOと秒速', e: '💨',
  desc: 'EOとOEは揃えば10倍。秒速5タームメートルは場から場へ通り過ぎていく。',
  categories: { eo: { name: 'EO', color: '#b9bccb' } },
  rules: {
    text: '【秒速】この局では、手番が終わるたびに、手札を回す向きが入れ替わる。',
    onTurnEnd: (g) => g.reverse('秒速：手札を回す向きが入れ替わった。', true)
  },
  cards: [
    { id: 'eo', name: 'EO', e: '🔤', g: 'EO', cats: ['eo'], base: 1,
      text: '【得点】自分の場に「OE」がいれば+9（10倍）。', flavor: 'EO。',
      score: (g, p) => g.has(p, 'oe') ? 9 : 0 },
    { id: 'oe', name: 'OE', e: '🔡', g: 'OE', cats: ['eo'], base: 1,
      text: '【得点】自分の場に「EO」がいれば+9（10倍）。', flavor: 'EOを裏返したもの。',
      score: (g, p) => g.has(p, 'eo') ? 9 : 0 },
    { id: 'eoeo', name: 'EOEO', e: '🔠', g: 'EE', cats: ['eo'], base: 1,
      text: '【得点】自分の場の他の〈EO〉の数をnとして、n×n×2点。', flavor: 'EOEO。',
      score: (g, p, c) => { const n = g.cnt(p, 'eo', c); return n * n * 2; } },
    { id: 'oeo', name: 'OEO', e: '🔣', g: 'OEO', cats: ['eo'], base: 2,
      text: '【取ったとき】自分の場で一番素点の高い他のカードと同じ素点になる。', flavor: 'EOとOEの間に生まれた。',
      onPick: (g, p, c) => { let m = 2; g.table(p).forEach(x => { if (x !== c) m = Math.max(m, g.baseOf(x)); }); c.x.base = m; g.log(`OEOの素点が${m}になった。`); } },
    { id: 'byousoku', name: '秒速5タームメートル', short: '秒速5タームメートル', e: '💨', g: '5', cats: ['speed', 'ter'], base: 0,
      text: '【手番の終わり】+2されて、手札を渡す相手の場へ移動する。局が終わったときにいる場の点になる。', flavor: 'Tier8。議論の外を、秒速5タームメートルで通り過ぎていく。',
      onTurnEnd: (g, o, c) => { c.x.pts = (c.x.pts || 0) + 2; g.moveTo(c, g.next(o)); } },
    { id: 'funsoku', name: '分速300タームメートル', e: '🏃', g: '300', cats: ['speed', 'ter'], base: 0,
      text: '【取ったとき】〈速さ〉のティアを〈EO〉と同じ段にする。【得点】どこかの場にいる「秒速5タームメートル」と同じ点。', flavor: '計算すると同じ。',
      onPick: (g, p) => { const pos = g.pos('eo'); if (pos != null && pos !== TJ.KESU) { g.setPos('speed', pos, p); g.log('〈速さ〉が〈EO〉と同じ段にそろった。'); } },
      score: (g) => { let v = 0; [0, 1, 2, 3].forEach(i => g.table(i).forEach(x => { if (x.id === 'byousoku') v = Math.max(v, g.baseOf(x) + (x.x.pts || 0)); })); return v; } },
    { id: 'passing', name: '秒速5タームメートルで通り過ぎた何か', short: '通り過ぎた何か', e: '🌪️', g: '過', cats: ['speed'], base: 3,
      text: '【取ったとき】全員の場の、これ以外の〈速さ〉のカードを、それぞれ手札を渡す相手の場へ移す。', flavor: '何だったのかはわからない。速かった。',
      onPick: (g, p, c) => {
        const moves = [];
        [0, 1, 2, 3].forEach(i => g.table(i).forEach(x => { if (x !== c && g.hasCat(x, 'speed')) moves.push([x, g.next(i)]); }));
        moves.forEach(([x, to]) => g.moveTo(x, to));
        if (moves.length) g.log(`★ 何かが通り過ぎて、〈速さ〉${moves.length}枚を巻き込んだ！`, true);
      } }
  ]
});

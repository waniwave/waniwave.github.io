TJ.registerSet({
  id: 'oppen', name: 'オッペンとタタ', e: '🥇',
  desc: '金・銀・銅で表彰台。木が集まれば林、林が集まれば森。',
  categories: { oppen: { name: 'オッペン', color: '#e0c050' }, tree: { name: '木', color: '#4a9a4a' } },
  rules: {
    text: '【表彰式】局の終わりに、〈オッペン〉を一番多く持っている人は+3（同数なら全員。0枚は対象外）。',
    hooks: { playerScore: (g, v, p) => { const c = [0, 1, 2, 3].map(i => g.cnt(i, 'oppen')); const m = Math.max(...c); return m > 0 && c[p] === m ? v + 3 : v; } }
  },
  cards: [
    { id: 'golden', name: 'ゴールデン・オッペンターム', short: 'ゴールデン', e: '🥇', g: '金', cats: ['oppen', 'ter'], base: 1,
      text: '【得点】自分の場に金・銀・銅のオッペンタームがそろうと+6（表彰台）。', flavor: '金色である。強くはない。',
      score: (g, p) => ['golden', 'silver', 'bronze'].every(id => g.has(p, id)) ? 6 : 0 },
    { id: 'silver', name: 'シルバー・オッペンターム', short: 'シルバー', e: '🥈', g: '銀', cats: ['oppen', 'ter'], base: 1,
      text: '【得点】自分の場に金・銀・銅のオッペンタームがそろうと+6。', flavor: '銀色である。金より弱い。',
      score: (g, p) => ['golden', 'silver', 'bronze'].every(id => g.has(p, id)) ? 6 : 0 },
    { id: 'bronze', name: 'ブロンズ・オッペンターム', short: 'ブロンズ', e: '🥉', g: '銅', cats: ['oppen', 'ter'], base: 1,
      text: '【得点】自分の場に金・銀・銅のオッペンタームがそろうと+6。', flavor: '銅色である。表彰台にはのぼれる。',
      score: (g, p) => ['golden', 'silver', 'bronze'].every(id => g.has(p, id)) ? 6 : 0 },
    { id: 'shoujou', name: 'オッペンタームの表彰状', short: '表彰状', e: '📃', g: '賞', cats: ['oppen'], base: 2,
      text: '【取ったとき】〈オッペン〉のティアを1段上げる。', flavor: '強くはない、と書いてある。',
      onPick: (g, p) => g.move('oppen', 1, p) },
    { id: 'tatagi', name: 'タタ木', e: '🌲', g: '木', cats: ['tree'], base: 2,
      text: '【得点】自分の場の他の〈木〉1枚につき+1。', flavor: '屋上の物干し竿を支えている。',
      score: (g, p, c) => g.cnt(p, 'tree', c) },
    { id: 'tatabayashi', name: 'タタ林', e: '🌳', g: '林', cats: ['tree'], base: 2,
      text: '【得点】自分の場に「タタ木」があれば+4。', flavor: '木が2本で林。タタ木が2本でタタ林。',
      score: (g, p) => g.has(p, 'tatagi') ? 4 : 0 },
    { id: 'tatamori', name: 'タタ森', e: '🏞️', g: '森', cats: ['tree'], base: 2,
      text: '【得点】自分の場の他の〈木〉1枚につき+3。', flavor: '木が集まると林になり、林が集まると森になる。',
      score: (g, p, c) => g.cnt(p, 'tree', c) * 3 }
  ]
});

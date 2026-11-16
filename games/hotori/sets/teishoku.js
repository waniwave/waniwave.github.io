TJ.registerSet({
  id: 'teishoku', name: '定食', e: '🍱',
  desc: '小鉢・みそ汁・漬物をそろえて定食を完成させる。フードファイターは隣の食卓を狙う。',
  categories: { teishoku: { name: '定食', color: '#d9a05a' } },
  rules: null,
  cards: [
    { id: 'teishoku', name: '定食', e: '🍱', g: '定', cats: ['teishoku', 'food'], base: 3,
      text: '【得点】自分の場に「定食の小鉢」「定食のみそ汁」「定食の漬物」がそろえば+12（定食完成）。', flavor: '主菜と副菜と汁物の連合。',
      score: (g, p) => ['kobachi', 'miso', 'tsuke'].every(id => g.has(p, id)) ? 12 : 0 },
    { id: 'kobachi', name: '定食の小鉢', e: '🥗', g: '鉢', cats: ['teishoku', 'food'], base: 2,
      text: '【得点】自分の場に「定食」があれば+2。', flavor: 'ひじき。',
      score: (g, p) => g.has(p, 'teishoku') ? 2 : 0 },
    { id: 'miso', name: '定食のみそ汁', e: '🍲', g: '汁', cats: ['teishoku', 'food', 'yu'], base: 2,
      text: '【得点】自分の場に「定食」があれば+2。', flavor: 'ほぼ湯。',
      score: (g, p) => g.has(p, 'teishoku') ? 2 : 0 },
    { id: 'tsuke', name: '定食の漬物', e: '🥒', g: '漬', cats: ['teishoku', 'food'], base: 1,
      text: '【手番の終わり】+1（漬かる）。', flavor: '時間とともに強くなる、唯一の食べ物。',
      onTurnEnd: (g, o, c) => { c.x.pts = (c.x.pts || 0) + 1; },
      ai: (g) => TJ.TURNS - g.turn + 1 },
    { id: 'waribashi', name: '定食の割り箸', e: '🥢', g: '箸', cats: ['teishoku'], base: 1,
      text: '【取ったとき】きれいに割れた。〈食べ物〉のティアを1段上げる。', flavor: 'きれいに割れたら、いいことがある。',
      onPick: (g, p) => g.move('food', 1, p) },
    { id: 'oomori', name: '大盛り', e: '🍚', g: '盛', cats: ['food'], base: 1,
      text: '【得点】自分の場で一番素点の高い他の〈食べ物〉の素点と同じだけ+。', flavor: '無料です。',
      score: (g, p, c) => { let m = 0; g.table(p).forEach(x => { if (x !== c && g.hasCat(x, 'food')) m = Math.max(m, g.baseOf(x)); }); return m; } },
    { id: 'foodfighter', name: 'フードファイター', e: '🍽️', g: '食', cats: ['death'], base: 2,
      text: '【取ったとき】左右の場から〈食べ物〉を1枚ずつ（素点の高いもの）食べて捨て札へ送る。1枚につき+3。', flavor: '大食いTier God。',
      onPick: (g, p, c) => {
        let n = 0;
        g.neighbors(p).forEach(q => {
          const f = g.table(q).filter(x => g.hasCat(x, 'food')).sort((a, b) => g.baseOf(b) - g.baseOf(a))[0];
          if (f && g.kill(f)) n++;
        });
        if (n) { c.x.pts = (c.x.pts || 0) + n * 3; g.log(`★ フードファイターが隣の食卓から${n}品たいらげた！ +${n * 3}`, true); }
      } }
  ]
});

TJ.registerSet({
  id: 'kesu', name: '欠番と専用', e: '👻',
  desc: '理由は聞かない。存在しないカード、専用のカード、取り違えた下足札。',
  categories: { kesu: { name: '欠番', color: '#7a6a9a' }, senyou: { name: '専用', color: '#c05a9a' } },
  rules: {
    text: '【宿泊約款第8条】局の始めに、ランダムなカテゴリ1つが欠番になる（理由は聞かない）。',
    onRoundStart: (g) => { const ks = g.cats().filter(k => k !== 'kesu' && g.pos(k) !== TJ.KESU); if (ks.length) g.kesuban(g.rand(ks)); }
  },
  cards: [
    { id: 'kesu6', name: '欠番Tier6', e: '6️⃣', g: '6', cats: ['kesu'], base: 4, noTier: 1,
      text: '【常時】ティアの補正を受けない。', flavor: '宿泊約款第8条「Tier6とTier7は欠番とする。理由は聞かない」' },
    { id: 'kesu7', name: '欠番Tier7', e: '7️⃣', g: '7', cats: ['kesu'], base: 2,
      text: '【取ったとき】〈欠番〉以外で一番ティアの高いカテゴリを欠番にする（補正0で固定）。', flavor: '理由は聞かない。',
      onPick: (g, p) => { const k = g.topCat(['kesu']); if (k) g.kesuban(k, p); } },
    { id: 'kesu9', name: '欠番Tier9（存在しない）', short: '欠番Tier9', e: '9️⃣', g: '9', cats: ['kesu'], base: 4, hidden: 1,
      text: '【常時】存在しないので、他の人からは裏向きにしか見えない。', flavor: '有識者会議で「Tier9は？」と聞いた人が、こうなった。' },
    { id: 'senyou', name: 'taaaam様専用', e: '👑', g: '専', cats: ['senyou'], base: 2,
      text: '【得点】自分の場のカテゴリが3種類以下なら+8。', flavor: '専用とは、他の誰も使えないということだ。',
      score: (g, p) => { const s = new Set(); g.table(p).forEach(x => g.catsOf(x).forEach(k => s.add(k))); return s.size <= 3 ? 8 : 0; } },
    { id: 'slipper', name: 'taaaam様専用スリッパ', short: '専用スリッパ', e: '🩴', g: '履', cats: ['senyou', 'inn'], base: 1,
      text: '【得点】自分の場に「taaaam様専用」があれば+5。', flavor: '専用のスリッパも、専用だ。',
      score: (g, p) => g.has(p, 'senyou') ? 5 : 0 },
    { id: 'gesoku', name: '下足札', e: '🎫', g: '札', cats: ['inn'], base: 2,
      text: '【取ったとき】番号は合っている。中身が違う。手札を左隣の人と取り違える（全員が取り終えてから）。', flavor: '番号は合っている。中身が違う。',
      onPick: (g, p) => g.later(() => { const q = g.left(p); g.swapHands(p, q); g.log(`★ 下足札の取り違え！ ${g.name(p)}と${g.name(q)}の手札が入れ替わった。`, true); }) },
    { id: 'setsudan', name: '負け確切断', e: '🔌', g: '切', cats: ['fgc'], base: 1,
      text: '【常時】この局で4位になったら、回線を切って3位と同じ順位点をもらう。', flavor: 'マナーは悪い。Tier8。',
      hooks: { rankPts: (g, o, c, pts, scores, place) => {
        if (place[o] !== 4) return pts;
        const third = [0, 1, 2, 3].filter(i => i !== o).sort((a, b) => place[b] - place[a])[0];
        const out = pts.slice(); out[o] = pts[third]; return out;
      } } }
  ]
});

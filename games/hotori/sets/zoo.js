TJ.registerSet({
  id: 'zoo', name: '屋上動物園', e: '🦍',
  desc: '動物は食べ物が好き。キターツネは隣の札を化かす。',
  categories: {},
  rules: {
    text: '【餌やり】局の終わりに、〈動物〉と〈食べ物〉を同じ枚数（1枚以上）持っている人は+5。',
    hooks: { playerScore: (g, v, p) => { const a = g.cnt(p, 'animal'), f = g.cnt(p, 'food'); return a > 0 && a === f ? v + 5 : v; } }
  },
  cards: [
    { id: 'tanuki', name: 'ターヌキ', e: '🦝', g: '狸', cats: ['animal', 'ter'], base: 2,
      text: '【得点】自分の場の〈食べ物〉1枚につき+2。', flavor: '葉っぱを頭にのせると、ター宿の札に化ける。',
      score: (g, p) => g.cnt(p, 'food') * 2 },
    { id: 'kitsune', name: 'キターツネ', e: '🦊', g: '狐', cats: ['animal', 'ter'], base: 2,
      text: '【取ったとき】左右で点の高いほうの人の、一番素点の高いカードを化かす（素点と効果が0になる。ティアの補正は残る）。', flavor: 'こんこん。化かされた札は、自分が何Tierか忘れる。',
      onPick: (g, p) => {
        const q = g.richer(p);
        const t = g.table(q).filter(x => !x.x.zero && !g.protected(x)).sort((a, b) => g.baseOf(b) - g.baseOf(a))[0];
        if (t) g.zero(t, `★ ${g.name(q)}の「${g.cardName(t)}」が化かされた！`);
      } },
    { id: 'neko', name: 'ネコターン', e: '🐈', g: '猫', cats: ['animal', 'ter'], base: 2,
      text: '【取ったとき】自分の場の〈食べ物〉を1枚（素点の高いもの）食べて捨て札へ送り、その素点の2倍を得る。', flavor: 'ごはんの時間を、絶対に忘れない。',
      onPick: (g, p, c) => {
        const f = g.table(p).filter(x => g.hasCat(x, 'food')).sort((a, b) => g.baseOf(b) - g.baseOf(a))[0];
        if (f) { const v = g.baseOf(f) * 2; if (g.kill(f)) { c.x.pts = (c.x.pts || 0) + v; g.log(`ネコターンが「${g.cardName(f)}」を食べた。+${v}`); } }
      } },
    { id: 'koneko', name: '子ネコターン', e: '🐱', g: '仔', cats: ['animal', 'ter'], base: 1,
      text: '【得点】自分の場に「ネコターン」がいれば+5。', flavor: '親のまねをして、ごはんの皿をひっくり返す。',
      score: (g, p) => g.has(p, 'neko') ? 5 : 0 },
    { id: 'kapibara', name: 'カピバターラ', e: '🦫', g: '湯獣', cats: ['animal', 'yu', 'ter'], base: 2,
      text: '【得点】〈湯〉のティアがTier2以上なら+4。', flavor: 'ずっと湯に浸かっている。チルの化身。',
      score: (g) => { const pos = g.pos('yu'); return pos != null && pos !== TJ.KESU && pos <= 3 ? 4 : 0; } },
    { id: 'gorilla', name: 'ゴリラーム', e: '🦍', g: '猩', cats: ['animal'], base: 4,
      text: '【取ったとき】ドラミング。〈動物〉のティアを1段上げる。', flavor: 'ウホ。胸を叩くたびに、Tierが上がる。',
      onPick: (g, p) => { g.log('ウホウホウホ！'); g.move('animal', 1, p); } },
    { id: 'shiikuin', name: '動物園の飼育員', e: '🧑‍🌾', g: '飼', cats: ['animal'], base: 1,
      text: '【得点】自分の場の他の〈動物〉1枚につき+2。', flavor: '餌の時間を、すべての動物に知らせる係。',
      score: (g, p, c) => g.cnt(p, 'animal', c) * 2 }
  ]
});

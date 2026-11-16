(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'mure', name: '群れ', e: '🐺',
  desc: '動物は群れるほど強い。ゾウは踏み、キリンは隣を見る。',
  categories: {},
  cards: [
    { id: 'shiba', name: 'シバターヌ', e: '🐕', g: '柴', cats: ['animal', 'ter'], base: 3,
      text: '【得点】自分の場の他の〈動物〉1枚につき+1。', flavor: '柴犬とたぬきの、どちらでもある。', score: K.per('animal', 1) },
    { id: 'ookami', name: 'オオカミーム', e: '🐺', g: '狼', cats: ['animal'], base: 3,
      text: '【得点】自分の場の他の〈動物〉1枚につき+2（群れの力）。', flavor: '満月の夜は、Tierが1つ上がる。', score: K.per('animal', 2) },
    { id: 'zou', name: 'ゾウターム', e: '🐘', g: '象', cats: ['animal', 'ter'], base: 6,
      text: '【取ったとき】ドスン。左右の場で一番素点の低いカードを踏んで捨て札へ。', flavor: '宿の床が、少したわむ。',
      onPick: (g, p) => { const t = K.worstOf(g, g.neighbors(p)); if (t) { g.log('ドスン。'); g.kill(t); } } },
    { id: 'kirin', name: 'キリンター', e: '🦒', g: '麒', cats: ['animal', 'ter'], base: 4,
      text: '【得点】首が長いので隣が見える。左右の人の〈動物〉1枚につき+1。', flavor: '首が長い。隣の部屋が見える。',
      score: (g, p) => g.neighbors(p).reduce((a, q) => a + g.cnt(q, 'animal'), 0) },
    { id: 'fureai', name: 'ふれあい広場', e: '🐐', g: '広', cats: ['animal'], base: 1,
      text: '【得点】自分の場の他の〈動物〉1枚につき+1。〈食べ物〉もあれば、さらに+2。', flavor: '餌やり体験：ター油（100円）。',
      score: (g, p, c) => g.cnt(p, 'animal', c) + (g.cnt(p, 'food') ? 2 : 0) },
    { id: 'usagi', name: 'ウサギター', e: '🐰', g: '兎', cats: ['animal', 'ter'], base: 1,
      text: '【取ったとき】気がつくと増えている。自分の場に「ウサギター」をもう1匹出す。【得点】他のウサギター1匹につき+2。', flavor: '気がつくと、増えている。',
      onPick: (g, p) => g.token(p, 'usagi_t'), score: (g, p, c) => g.count(p, x => x !== c && (x.id === 'usagi' || x.id === 'usagi_t')) * 2 },
    { id: 'koala', name: 'コアラーム', e: '🐨', g: '寝', cats: ['animal'], base: 2,
      text: '【手番の終わり】自分の場に他の〈動物〉がいれば+1（寝ているだけで癒やす。最大+5）。', flavor: '1日22時間寝る。残り2時間も寝ている。',
      onTurnEnd: (g, o, c) => { if (g.cnt(o, 'animal', c)) K.grow(1, 5)(g, o, c); }, ai: (g) => Math.min(5, TJ.TURNS - g.turn) }
  ],
  tokens: [
    { id: 'usagi_t', name: 'ウサギター', e: '🐇', g: '兎', cats: ['animal', 'ter'], base: 1, text: '増えたウサギター。素点1。【得点】他のウサギター1匹につき+2。', flavor: '気がつくと、増えている。',
      score: (g, p, c) => g.count(p, x => x !== c && (x.id === 'usagi' || x.id === 'usagi_t')) * 2 }
  ]
});
})();

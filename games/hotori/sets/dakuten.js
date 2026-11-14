(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'dakuten', name: '濁点とスレ立て', e: '💧',
  desc: '手札を濁らせて次の人に渡す。スレを立てればレスがつき、土は自己紹介をする。',
  categories: { vyu: { name: '濁点', color: '#5a8aa8' } },
  rules: null,
  cards: [
    { id: 'vyu', name: 'う゛ゅ゛', e: '💧', g: 'ゅ', cats: ['vyu'], base: 4,
      text: '【取ったとき】次に渡す手札をすべて濁らせる（それぞれ素点−1）。', flavor: 'う゛ゅ゛。',
      onPick: (g, p) => { const h = g.hand(p); h.forEach(x => g.setBase(x, g.baseOf(x) - 1)); if (h.length) g.log(`う゛ゅ゛……。${g.name(p)}の次に渡す手札${h.length}枚が濁った。`); } },
    { id: 'vyu2', name: 'う゛ゅ゛゛', e: '💦', g: '゛', cats: ['vyu'], base: 3,
      text: '濁点が1つ多い。【取ったとき】次に渡す手札をすべて素点−1。【得点】「う゛ゅ゛」がいれば+6。', flavor: 'う゛ゅ゛゛。',
      onPick: (g, p) => g.hand(p).forEach(x => g.setBase(x, g.baseOf(x) - 1)), score: K.with('vyu', 6) },
    { id: 'yugyaku', name: 'ゆ虐', e: '🧸', g: '虐', cats: ['vyu'], base: 5,
      text: '【取ったとき】自分以外の場で一番素点の低いカードを2枚まで捨て札へ。', flavor: '食べ物より弱いが、もっと弱いものを見つけるのはうまい。',
      onPick: (g, p) => { for (let i = 0; i < 2; i++) { const t = K.worstOf(g, g.others(p)); if (t) g.kill(t); } } },
    { id: 'suretate', name: 'スレ立て人', e: '✍️', g: '立', cats: ['thread'], base: 3,
      text: '【取ったとき】〈スレ〉のティアを1段上げ、自分の場に「レス」（素点1の〈スレ〉）を2つ出す。', flavor: '「ター宿について語るスレ part1」',
      onPick: (g, p) => { g.move('thread', 1, p); g.token(p, 'res'); g.token(p, 'res'); g.log('レスが2つついた。'); } },
    { id: 'tamtrol', name: 'トローム', e: '🌉', g: '橋', cats: ['thread'], base: 4,
      text: '【取ったとき】通行料。手札をくれる人は、次の手番ティアを動かせない。', flavor: '2Fの廊下に立っている。通行料は一回ごと。',
      onPick: (g, p) => { const q = g.prev(p); g.blockTier(q); g.log(`トロームが通行料を取り立てた。${g.name(q)}は次の手番ティアを動かせない。`); } },
    { id: 'meishicard', name: '自己紹介カード', e: '📇', g: '名', cats: ['intro'], base: 2,
      text: '【取ったとき】自分の場の〈自己紹介〉の枚数ぶん、自己紹介をする。【得点】自分がこの局でした自己紹介1回につき+2（最大+8）。', flavor: '「土です」と印刷されている。全部。',
      onPick: (g, p) => g.intro(p, g.cnt(p, 'intro')), score: (g, p) => Math.min(8, g.introOf(p) * 2) },
    { id: 'hachi', name: '土の鉢植え', e: '🪴', g: '鉢', cats: ['intro'], base: 4,
      text: '【取ったとき】次に渡す手札で一番素点の高いカードと同じものが、自分の場に生えてくる（写しが出る）。', flavor: '土から、同じものが生えてくる。',
      onPick: (g, p) => { const h = g.hand(p).slice().sort((a, b) => g.baseOf(b) - g.baseOf(a))[0]; if (h) { const t = g.token(p, h.id); if (t) { t.x.base = g.baseOf(h); g.log(`★ 鉢植えから「${g.cardName(h)}」が生えた。`, true); } } } }
  ],
  tokens: [
    { id: 'res', name: 'レス', e: '💬', g: 'レ', cats: ['thread'], base: 1, text: 'スレについた書き込み。素点1。', flavor: '2 名無しのター：乙' }
  ]
});
})();

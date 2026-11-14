(function () {
const K = TJ.K;
const toCurry = (g, x) => { x.id = 'curry'; x.x.base = null; };
TJ.registerSet({
  id: 'tayu', name: 'ター湯とカレー', e: '♨️',
  desc: 'ター油は湯に浮く。栓を抜けば全部流れる。ターメリックとライスがそろえばカレー。',
  categories: { kare: { name: 'カレー', color: '#d8a020' } },
  rules: {
    text: '【湯けむり】局の終わりに、〈湯〉を一番多く持っている人は+3（同数なら全員。0枚は対象外）。',
    hooks: { playerScore: (g, v, p) => { const c = [0, 1, 2, 3].map(i => g.cnt(i, 'yu')); const m = Math.max(...c); return m > 0 && c[p] === m ? v + 3 : v; } }
  },
  cards: [
    { id: 'taayu', name: 'ター油', e: '🫙', g: '油', cats: ['food', 'yu', 'ter'], base: 1,
      text: '【得点】自分の場の他の〈湯〉と〈食べ物〉1枚につき+1。', flavor: '湯船に浮いている。湯には溶けない。溶けないことが強さだ。',
      score: K.perAny(['yu', 'food'], 1) },
    { id: 'yuyu', name: 'ター油の湯', e: '🛁', g: '湯', cats: ['yu', 'ter'], base: 2,
      text: '【取ったとき】〈湯〉のティアを2段上げる。', flavor: '湯にター油を浮かべたもの。浮かべただけ。',
      onPick: K.up('yu', 2) },
    { id: 'sen', name: 'ター湯の栓', e: '🌀', g: '栓', cats: ['yu'], base: 3,
      text: '【取ったとき】湯を抜く。〈湯〉をTier5まで下げ、自分以外の全員の場から〈湯〉のカードを1枚ずつ流す（捨て札へ）。', flavor: '栓を抜くと、何もかも流れていく。',
      onPick: (g, p) => { g.setPos('yu', 6, p); let n = 0; g.others(p).forEach(q => { const t = K.bestOf(g, [q], x => g.hasCat(x, 'yu')); if (t && g.kill(t)) n++; }); g.log(`★ 栓が抜かれた！ 湯がTier5まで下がり、${n}枚が流れていった。`, true); } },
    { id: 'obi', name: '浴衣の帯', e: '🎀', g: '帯', cats: ['inn', 'yu'], base: 1,
      text: '【常時】よその場から自分の場にカードが移ってくるたびに+2（ほどけて、ここに来た）。', flavor: 'ほどけると、どこかへ行く。',
      onAnyMove: (g, o, c, moved, from, to) => { if (to === o && moved !== c) K.addPts(c, 2); } },
    { id: 'turmeric', name: 'ターメリック', e: '🟡', g: 'メ', cats: ['food', 'kare', 'ter'], base: 1,
      text: '【取ったとき】自分の場に「ターメリックライス」がいれば、それを「カレー」（素点14）にする。', flavor: 'カレーになれば話は別、と本人は言っている。',
      onPick: (g, p) => { const r = g.table(p).find(x => x.id === 'rice'); if (r) { toCurry(g, r); g.log('★ カレーになった！', true); } } },
    { id: 'rice', name: 'ターメリックライス', e: '🍚', g: '飯', cats: ['food', 'kare', 'ter'], base: 2,
      text: '【取ったとき】自分の場に「ターメリック」がいれば、このカードが「カレー」（素点14）になる。', flavor: 'ターメリックで炊いたご飯。あと一歩でカレー。',
      onPick: (g, p, c) => { if (g.has(p, 'turmeric')) { toCurry(g, c); g.log('★ カレーになった！', true); } } },
    { id: 'akibin', name: 'ター油の空き瓶', e: '🍶', g: '瓶', cats: ['yu'], base: 1,
      text: '【得点】この局で自分がティアを動かすために捨てたカード1枚につき+2。', flavor: '中身は湯船に浮いている。',
      score: (g, p) => g.cutCount(p) * 2 }
  ],
  tokens: [
    { id: 'curry', name: 'カレー', e: '🍛', g: '華', cats: ['food', 'kare'], base: 14, text: 'ターメリックとターメリックライスから生まれた。素点14。', flavor: 'カレーになれば話は別。' }
  ]
});
})();

(function () {
const K = TJ.K;
const toCurry = (g, x) => { x.id = 'curry'; x.x.base = null; };
TJ.registerSet({
  id: 'tayu', name: 'ター湯とカレー', e: '♨️',
  desc: 'ター油は湯に浮く。栓を抜けば全部流れる。ターメリックとライスがそろえばカレー。',
  categories: { kare: { name: 'カレー', color: '#d8a020' } },
  cards: [
    { id: 'taayu', name: 'ター油', e: '🫙', g: '油', cats: ['food', 'yu', 'ter'], base: 3,
      text: '【得点】自分の場の他の〈湯〉と〈食べ物〉1枚につき+1。', flavor: '湯船に浮いている。湯には溶けない。溶けないことが強さだ。',
      score: K.perAny(['yu', 'food'], 1) },
    { id: 'yuyu', name: 'ター油の湯', e: '🛁', g: '湯', cats: ['yu', 'ter'], base: 4,
      text: '【取ったとき】〈湯〉のティアを2段上げる。', flavor: '湯にター油を浮かべたもの。浮かべただけ。',
      onPick: K.up('yu', 2) },
    { id: 'sen', name: 'ター湯の栓', e: '🌀', g: '栓', cats: ['yu'], base: 6,
      text: '【取ったとき】湯を抜く。〈湯〉をTier5まで下げ、自分以外の全員の場の〈湯〉のカードを1枚ずつ湯冷めさせる（気絶）。', flavor: '栓を抜くと、何もかも流れていく。',
      onPick: (g, p) => { g.setPos('yu', 6, p); let n = 0; g.others(p).forEach(q => { const t = K.bestOf(g, [q], x => g.hasCat(x, 'yu')); if (t && g.stun(t)) n++; }); g.log(`★ 栓が抜かれた！ 湯がTier5まで下がり、${n}枚が湯冷めした。`, true); } },
    { id: 'obi', name: '浴衣の帯', e: '🎀', g: '帯', cats: ['inn', 'yu'], base: 4,
      text: '【常時】よその場から自分の場にカードが移ってくるたびに+3（ほどけて、ここに来た）。', flavor: 'ほどけると、どこかへ行く。',
      onAnyMove: (g, o, c, moved, from, to) => { if (to === o && moved !== c) K.addPts(c, 3); } },
    { id: 'turmeric', name: 'ターメリック', e: '🟡', g: 'メ', cats: ['food', 'kare', 'ter'], base: 3,
      text: '【取ったとき】自分の場に「ターメリックライス」がいれば、それを「カレー」（素点16）にする。', flavor: 'カレーになれば話は別、と本人は言っている。',
      onPick: (g, p) => { const r = g.table(p).find(x => x.id === 'rice'); if (r) { toCurry(g, r); g.log('★ カレーになった！', true); } } },
    { id: 'rice', name: 'ターメリックライス', e: '🍚', g: '飯', cats: ['food', 'kare', 'ter'], base: 4,
      text: '【取ったとき】自分の場に「ターメリック」がいれば、このカードが「カレー」（素点16）になる。', flavor: 'ターメリックで炊いたご飯。あと一歩でカレー。',
      onPick: (g, p, c) => { if (g.has(p, 'turmeric')) { toCurry(g, c); g.log('★ カレーになった！', true); } } },
    { id: 'akibin', name: 'ター油の空き瓶', e: '🍶', g: '瓶', cats: ['yu'], base: 2,
      text: '【得点】この局で自分がティアを動かすために捨てたカード1枚につき+3。', flavor: '中身は湯船に浮いている。',
      score: (g, p) => g.cutCount(p) * 3 }
  ],
  tokens: [
    { id: 'curry', name: 'カレー', e: '🍛', g: '華', cats: ['food', 'kare'], base: 16, text: 'ターメリックとターメリックライスから生まれた。素点16。', flavor: 'カレーになれば話は別。' }
  ]
});
})();

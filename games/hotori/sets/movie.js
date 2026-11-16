TJ.registerSet({
  id: 'movie', name: '『ターム　』', e: '🎞️',
  desc: '全館上映中。主演を中心に組むか、ポスターで「ターム」を集めるか。',
  categories: { cast: { name: '『ターム　』', color: '#c8604a' } },
  rules: null,
  cards: [
    { id: 'shuen', name: '『ターム　』の主演ターマー', short: '主演ターマー', e: '🌟', g: '主', cats: ['cast', 'ter'], base: 3,
      text: '【得点】自分の場の他の〈『ターム　』〉1枚につき+2。', flavor: 'タイトルの後ろの空白も含めて、主演である。',
      score: (g, p, c) => g.cnt(p, 'cast', c) * 2 },
    { id: 'director', name: '『ターム　』の監督', short: '監督', e: '🎬', g: '監', cats: ['cast'], base: 1,
      text: '【得点】自分の場に「主演ターマー」がいれば+7。', flavor: '「空白、もう少し長めに」',
      score: (g, p) => g.has(p, 'shuen') ? 7 : 0 },
    { id: 'joen', name: '『ターム　』の助演ターマー', short: '助演ターマー', e: '🎭', g: '助', cats: ['cast', 'ter'], base: 2,
      text: '【得点】自分の場に「主演ターマー」がいれば+3。', flavor: '主演より目立ってはいけない。空白より目立ってもいけない。',
      score: (g, p) => g.has(p, 'shuen') ? 3 : 0 },
    { id: 'sequel', name: '『ターム　 』（続編）', short: '続編', e: '🔁', g: '続', cats: ['cast'], base: 1,
      text: '空白が1つ長い。【取ったとき】捨て札にある〈『ターム　』〉をすべて自分の場に戻す。', flavor: '前作で死んだ人も、続編では普通にいる。',
      onPick: (g, p) => { const es = g.discard().filter(e => g.hasCat(e.c, 'cast')); let n = 0; es.forEach(e => { if (g.revive(e, p)) n++; }); if (n) g.log(`★ 続編で${n}人が復活した！`, true); } },
    { id: 'poster', name: 'タームのポスター', e: '🖼️', g: '貼', cats: ['cast'], base: 0,
      text: '【得点】自分の場の、名前に「ターム」を含む他のカード1枚につき+2。', flavor: '『ターム　』全館上映中。上映時間：概念。',
      score: (g, p, c) => g.count(p, x => x !== c && TJ.def(x).name.includes('ターム')) * 2 },
    { id: 'pin', name: 'ポスターの画鋲', e: '📌', g: '鋲', cats: ['cast'], base: 1,
      text: '【取ったとき】〈『ターム　』〉のティアを1段上げる。', flavor: '4隅のうち1つだけ、なぜか金色。',
      onPick: (g, p) => g.move('cast', 1, p) },
    { id: 'crew', name: '『ターム　』の撮影クルー', short: '撮影クルー', e: '🎥', g: '撮', cats: ['cast'], base: 2,
      text: '【取ったとき】カメラ位置を変えます。このカードと、手札をくれる人の場の一番新しいカードを入れ替える。', flavor: '被写体ごと。',
      onPick: (g, p, c) => {
        const q = g.prev(p); const t = g.newest(q);
        if (t && !g.protected(t)) { g.moveTo(t, p); g.moveTo(c, q); g.log(`★ 撮影クルーが${g.name(q)}の「${g.cardName(t)}」と入れ替わった。`, true); }
      } }
  ]
});

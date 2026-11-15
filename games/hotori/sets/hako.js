(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'hako', name: '箱と角', e: '📦',
  desc: '箱に入れば壊れない。空の箱は持ち去る。角と丸、名札、白線。',
  categories: { box: { name: '箱', color: '#b08a4a' }, kaku: { name: '角', color: '#d0d0d0' } },
  rules: {
    text: '【箱詰め】この局では、場のカードを捨て札に送られた人は、かわりに「空き箱」（素点1の〈箱〉）を1つ場に得る。',
    onKill: (g, c, owner) => { if (c.id !== 'akibako') g.token(owner, 'akibako'); }
  },
  cards: [
    { id: 'johnbox', name: 'ジョン・ボックス', e: '📦', g: '箱', cats: ['box'], base: 5,
      text: '【取ったとき】自分の場のカードをすべて箱に入れる（この局のあいだ、捨て札にも移動にもならない）。', flavor: '外の様子は見ていないので知らない。',
      onPick: (g, p) => { let n = 0; g.table(p).forEach(x => { if (!x.x.boxed) { x.x.boxed = 1; n++; } }); g.log(`${g.name(p)}の場の${n}枚が箱に入った。もう壊れない。`); } },
    { id: 'karabox', name: '空のボックス', e: '📭', g: '空', cats: ['box', 'steal'], base: 4,
      text: '【取ったとき】左右で点の高いほうの人の、一番素点の高いカードを箱に入れて持ち去る（自分の場へ）。（⇄交換：かわりに自分の場の一番素点の低いカードを相手へ渡す）', flavor: 'ジョン・ボックスが出ていったあとの箱。',
      onPick: (g, p) => { const q = g.richer(p); const t = K.bestOf(g, [q]); if (t && g.moveTo(t, p)) g.log(`★ 空のボックスが${g.name(q)}の「${g.cardName(t)}」を持ち去った。`, true); } },
    { id: 'kakunokake', name: 'ター角の欠片', e: '🔺', g: '片', cats: ['kaku', 'ter'], base: 4,
      text: '【取ったとき】〈角〉のティアを2段上げる。【得点】「ター角」がいれば+4。', flavor: '角から欠けた。欠けても、角は角。',
      onPick: K.up('kaku', 2), score: K.with('tarkaku', 4) },
    { id: 'tarmaru', name: 'ター丸', e: '⭕', g: '丸', cats: ['kaku', 'ter'], base: 3,
      text: '【得点】自分の場に「ター角」がいれば+8（角の反対側にいる）。', flavor: 'ター角の反対側にいる。角ではない。',
      score: K.with('tarkaku', 8) },
    { id: 'cage', name: 'ゆ虐の檻', e: '⛓️', g: '檻', cats: ['box'], base: 4,
      text: '【常時】手札を渡す相手のカードは、ティアのプラス補正を受けない（檻の中）。', flavor: '食べ物よりも弱いが、檻は強い。',
      hooks: { tierMod: (g, o, c, m, card, cat, owner) => owner === g.next(o) && m > 0 ? 0 : m } },
    { id: 'nafuda', name: '佐々木の名札', e: '📛', g: '札', cats: ['sasaki'], base: 5,
      text: '【取ったとき】名札を付け替える。自分の場の一番素点の低いカードと、左右の場で一番素点の高いカードの素点を入れ替える。', flavor: 'どの佐々木の名札かは、わからない。',
      onPick: (g, p, c) => {
        const mine = K.worstOf(g, [p], x => x !== c); const t = K.bestOf(g, g.neighbors(p));
        if (mine && t && g.baseOf(t) > g.baseOf(mine)) { const a = g.baseOf(mine), b = g.baseOf(t); g.setBase(mine, b); g.setBase(t, a); g.log(`★ 名札を付け替えた。「${g.cardName(mine)}」と「${g.cardName(t)}」の素点が入れ替わった。`, true); }
      } },
    { id: 'hakusen', name: '校庭の白線', e: '📏', g: '線', cats: ['school'], base: 5,
      text: '【取ったとき】白線を引き直す。一番上のカテゴリと一番下のカテゴリ（〈校庭〉以外）のティアを入れ替える。', flavor: '白線を引き直すと、場所が変わる。',
      onPick: (g, p) => {
        const a = g.topCat(['school']), b = g.bottomCat(['school']);
        if (a && b && a !== b) { const pa = g.pos(a), pb = g.pos(b); g.setPos(a, pb, p); g.setPos(b, pa, p); g.log(`★ 白線が引き直された。〈${TJ.CATS[a].name}〉と〈${TJ.CATS[b].name}〉が入れ替わった。`, true); }
      } }
  ],
  tokens: [
    { id: 'akibako', name: '空き箱', e: '📦', g: '空', cats: ['box'], base: 1, text: '捨て札に送られた札の代わりに残った箱。素点1。', flavor: '中身は、もういない。' }
  ]
});
})();

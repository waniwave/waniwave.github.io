TJ.registerSet({
  id: 'yado', name: '女将の宿', e: '🏮',
  desc: '女将マープと番頭たち。手帳とそろばんで、ティア操作の権利を動かす。',
  categories: { kaku: { name: '角', color: '#d0d0d0' } },
  rules: {
    text: '【チェックイン】局の始めに、〈宿〉はTier2から始まる。',
    onRoundStart: (g) => { if (g.pos('inn') != null && g.pos('inn') > 3) g.setPos('inn', 3); }
  },
  cards: [
    { id: 'maap', name: 'マープ', e: '👘', g: 'マ', cats: ['inn'], base: 5,
      text: '【取ったとき】〈宿〉のティアを1段上げる。', flavor: 'ター宿の女将。宿の地図はすべて彼女の頭の中にある。',
      onPick: (g, p) => { g.log('★ 女将が宿の地図を広げた。', true); g.move('inn', 1, p); } },
    { id: 'tarkaku', name: 'ター角', e: '📐', g: '角', cats: ['kaku', 'ter'], base: 5,
      text: '【得点】自分の場で「最初に取ったカード」か「最後に取ったカード」なら+4（角にいる）。', flavor: '宿の、いちばん角にある。いる。ある。',
      score: (g, p, c) => { const ts = g.table(p).map(x => x.t); return (c.t === Math.min(...ts) || c.t === Math.max(...ts)) ? 4 : 0; } },
    { id: 'banto', name: '番頭', e: '🧮', g: '番', cats: ['inn'], base: 2,
      text: '【得点】自分の場の他の〈宿〉1枚につき+2。', flavor: 'そろばんの音で強さを計る。',
      score: (g, p, c) => g.cnt(p, 'inn', c) * 2 },
    { id: 'soroban', name: '番頭のそろばん', e: '🧮', g: '算', cats: ['inn'], base: 1,
      text: '【取ったとき】次の手番、カードを取りつつティアも動かせる。', flavor: 'パチパチ。権限が増えた。',
      onPick: (g, p) => { g.grantBonus(p); g.log(`${g.name(p)}は次の手番、取りながらティアも動かせる。`); } },
    { id: 'techou', name: 'マープの手帳', e: '📒', g: '帳', cats: ['inn'], base: 2,
      text: '【取ったとき】手札を渡す相手は、次の手番ティアを動かせない。', flavor: '予約は、女将の手帳にしか書かれていない。',
      onPick: (g, p) => { const q = g.next(p); g.blockTier(q); g.log(`女将の手帳に書き込まれた。${g.name(q)}は次の手番、ティアを動かせない。`); } },
    { id: 'suzu', name: '女将の鈴', e: '🔔', g: '鈴', cats: ['inn'], base: 2,
      text: '【取ったとき】欠番になっているカテゴリをすべてTier3に戻す。欠番がなければ〈宿〉のティアを1段上げる。', flavor: 'チリン。襖が一斉に開く。',
      onPick: (g, p) => {
        const ks = g.cats().filter(k => g.pos(k) === TJ.KESU);
        if (ks.length) { ks.forEach(k => g.setPos(k, TJ.START, p)); g.log(`★ チリン。欠番が${ks.length}つ戻ってきた。`, true); }
        else g.move('inn', 1, p);
      } },
    { id: 'yukata', name: '浴衣', e: '👕', g: '衣', cats: ['inn', 'yu'], base: 1, tierX: 2,
      text: '【常時】ティアの補正を2倍で受ける。', flavor: 'サイズはフリー。概念にも合う。' }
  ]
});

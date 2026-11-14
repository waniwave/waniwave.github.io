TJ.registerSet({
  id: 'sure', name: '佐々木強さ議論スレ', e: '📜',
  desc: 'ティアを動かすほど強くなるスレ住人たち。安価で議論が加速する。',
  categories: { sasaki: { name: '佐々木', color: '#5a9ad9' } },
  rules: {
    text: '【安価】この局では、同じ手番に2人以上が同じカテゴリを同じ向きに動かすと、さらに1段動く。',
    hooks: {
      tierSum: (g, s, cat, voters) => {
        if (voters.length >= 2 && (voters.every(v => v.d > 0) || voters.every(v => v.d < 0))) {
          g.log(`★ 安価が揃った！〈${TJ.CATS[cat].name}〉がさらに動く。`, true);
          return s + Math.sign(s);
        }
        return s;
      }
    }
  },
  cards: [
    { id: 'sasakisure', name: '佐々木強さ議論スレ', e: '📜', g: '佐', cats: ['thread', 'sasaki'], base: 2,
      text: '【常時】自分のティア操作は1段多く動く。', flavor: 'どの佐々木なのかは、スレの中でも結論が出ていない。',
      hooks: { tierPower: (g, o, c, d, p) => p === o ? d + Math.sign(d) : d } },
    { id: 'sasaki', name: '佐々木', e: '🧑', g: '々', cats: ['sasaki'], base: 2,
      text: '【得点】自分の場の他の〈佐々木〉1枚につき+3。', flavor: '「どの佐々木？」「この佐々木」',
      score: (g, p, c) => g.cnt(p, 'sasaki', c) * 3 },
    { id: 'sasasa', name: '佐々木の佐々木', e: '👥', g: '々々', cats: ['sasaki'], base: 1,
      text: '【取ったとき】〈佐々木〉のティアを1段上げる。【得点】自分の場の他の〈佐々木〉1枚につき+2。', flavor: '佐々木の中の佐々木。',
      onPick: (g, p) => g.move('sasaki', 1, p),
      score: (g, p, c) => g.cnt(p, 'sasaki', c) * 2 },
    { id: 'nanashi', name: '名無しのター', e: '👤', g: '名', cats: ['thread', 'ter'], base: 1, copies: 2,
      text: '【常時】どこかのティアが動くたびに+1（最大+6）。', flavor: '1 名無しのター：佐々木は強い',
      onTierChange: (g, o, c) => { c.x.pts = Math.min(6, (c.x.pts || 0) + 1); },
      ai: (g) => Math.min(4, (TJ.TURNS - g.turn)) },
    { id: 'anchor', name: '>>1', e: '☝️', g: '>>', cats: ['thread'], base: 2,
      text: '【取ったとき】次の手番、カードを取りつつティアも動かせる（スレ主の権限）。', flavor: '>>1 乙',
      onPick: (g, p) => { g.grantBonus(p); g.log(`${g.name(p)}は次の手番、スレ主の権限を得た。`); } },
    { id: 'datochi', name: 'スレのdat落ち', e: '🗑️', g: '落', cats: ['thread'], base: 3,
      text: '【取ったとき】〈スレ〉以外で一番ティアの高いカテゴリを、Tier3に戻す。', flavor: '過去ログに、さようなら。',
      onPick: (g, p) => { const k = g.topCat(['thread']); if (k && g.pos(k) < TJ.START) { g.setPos(k, TJ.START, p); g.log(`★ dat落ち！〈${TJ.CATS[k].name}〉がTier3に戻された。`, true); } } }
  ]
});

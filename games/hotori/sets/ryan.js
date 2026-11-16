TJ.registerSet({
  id: 'ryan', name: 'ライアンと最強候補', e: '🕴️',
  desc: 'スレに2回書かれたライアンは2人いる。最強候補たちは、それぞれの理屈で強い。',
  categories: { ryan: { name: 'ライアン', color: '#d98a3a' }, saikyou: { name: '最強候補', color: '#e85a7a' } },
  rules: {
    text: '【宿泊約款第9条】同じ名前のカードを2枚以上持っていると、そのカードはそれぞれ+2。',
    hooks: { cardScore: (g, v, c, p) => g.count(p, x => x.id === c.id) >= 2 ? v + 2 : v }
  },
  cards: [
    { id: 'ryan', name: 'ライアン・ゴゴゴーグ', e: '🕴️', g: 'ゴ', cats: ['ryan'], base: 2, copies: 2,
      text: '【得点】自分の場の他の〈ライアン〉1枚につき+3。', flavor: 'スレに2回書かれている。だから2人いる。',
      score: (g, p, c) => g.cnt(p, 'ryan', c) * 3 },
    { id: 'ryan5', name: 'ライアン・ゴゴゴゴーグ', e: '🕺', g: 'ゴ+', cats: ['ryan'], base: 2,
      text: '【得点】自分の場の他の〈ライアン〉1枚につき+3。〈ライアン〉が3枚以上そろっていれば、さらに+3。', flavor: '「ゴ」が1つ多い。たぶん誤字。',
      score: (g, p, c) => g.cnt(p, 'ryan', c) * 3 + (g.cnt(p, 'ryan') >= 3 ? 3 : 0) },
    { id: 'meishi', name: 'ライアン・ゴゴゴーグの名刺', short: 'ライアンの名刺', e: '📇', g: '刺', cats: ['ryan'], base: 1,
      text: '【取ったとき】名刺交換。左右の場にいる〈ライアン〉を1枚、自分の場へ連れてくる（点の高い人から）。', flavor: '名刺にもゴが3つ。',
      onPick: (g, p) => {
        const from = [g.richer(p), g.neighbors(p).find(x => x !== g.richer(p))];
        for (const q of from) { const t = g.table(q).find(x => g.hasCat(x, 'ryan')); if (t) { if (g.moveTo(t, p)) { g.log(`★ 名刺交換！ ${g.name(q)}の「${g.cardName(t)}」が${g.name(p)}についてきた。`, true); return; } } }
      } },
    { id: 'gojo', name: '五条悟', e: '🕶️', g: '五', cats: ['saikyou'], base: 2,
      text: '【得点】自分の場に他のカードが5枚以上あれば+8。', flavor: 'このスレではTier3。平均的な強さ、とされている。',
      score: (g, p, c) => g.table(p).filter(x => x !== c).length >= 5 ? 8 : 0 },
    { id: 'nishijima', name: '西島秀俊', e: '🎬', g: '西', cats: ['saikyou'], base: 4, noTier: 1,
      text: '【常時】ティアの補正を受けない。いつでも素点4。', flavor: 'スレではTier3（メイン登場人物の中では平均的な強さ）とされている。' },
    { id: 'barbie', name: 'バービー', e: '👱‍♀️', g: 'バ', cats: ['saikyou'], base: 2,
      text: '【取ったとき】〈最強候補〉のティアを1段上げる。【得点】自分の場の他の〈最強候補〉1枚につき+2。', flavor: 'スレではTier1（作中最強レベル）とされている。',
      onPick: (g, p) => g.move('saikyou', 1, p),
      score: (g, p, c) => g.cnt(p, 'saikyou', c) * 2 }
  ]
});

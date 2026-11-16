TJ.registerSet({
  id: 'school', name: '校庭と自己紹介', e: '🏫',
  desc: '床に白線が引かれたら、校庭変化の合図。手札の流れが逆になる。土は自己紹介をする。',
  categories: { intro: { name: '自己紹介', color: '#b08a5a' } },
  cards: [
    { id: 'koutei', name: '校庭変化', e: '🏫', g: '校', cats: ['school'], base: 4,
      text: '【取ったとき】手札を回す向きが逆になる。【常時】この局で回す向きが変わるたびに+1（最大+4）。', flavor: '床に白線が引かれはじめたら、それが合図だ。',
      onPick: (g) => g.reverse('★ 校庭変化！ 手札を回す向きが逆になった。'), onReverse: (g, o, c) => { if ((c.x.pts || 0) < 4) c.x.pts = (c.x.pts || 0) + 1; } },
    { id: 'seigi', name: '正義執行／校庭変化', short: '正義執行', e: '⚖️', g: '正', cats: ['school'], base: 5,
      text: '【取ったとき】〈校庭〉以外で一番ティアの高いカテゴリを1段下げ、手札を回す向きを逆にする。', flavor: '正義が執行されると、だいたい校庭になる。',
      onPick: (g, p) => { const k = g.topCat(['school']); if (k) { g.move(k, -1, p); g.log(`正義が執行された。〈${TJ.CATS[k].name}〉が1段下がった。`); } g.reverse('★ 正義執行！ そして校庭変化。'); } },
    { id: 'taiikukan', name: '体育館変化', e: '🏟️', g: '体', cats: ['school'], base: 5,
      text: '【取ったとき】全員の場の一番新しいカード（これ以外）を、それぞれ右隣の人の場へ移す。', flavor: '雨の日の校庭変化。屋根ごと落ちてくる。',
      onPick: (g, p, c) => {
        const moves = [0, 1, 2, 3].map(q => { const t = g.table(q).filter(x => x !== c).sort((a, b) => b.t - a.t)[0]; return t ? [t, g.right(q)] : null; }).filter(Boolean);
        let n = 0; moves.forEach(([t, to]) => { if (g.moveTo(t, to)) n++; });
        if (n) g.log(`★ 体育館変化！ ${n}枚のカードが右へずれた。`, true);
      } },
    { id: 'chourei', name: '朝礼台', e: '🪜', g: '台', cats: ['school', 'intro'], base: 3,
      text: '【常時】手札を回す向きが変わるたびに+3。', flavor: '校庭変化のたびに、誰かが上で自己紹介をしている。',
      onReverse: (g, o, c) => { c.x.pts = (c.x.pts || 0) + 3; } },
    { id: 'tsuchi', name: '自己紹介をする土', e: '🟫', g: '土', cats: ['intro'], base: 5,
      text: '【取ったとき】自己紹介を2回する。', flavor: 'はじめまして、土です。',
      onPick: (g, p) => { g.intro(p, 2); g.log('「はじめまして、土です」「改めまして、土です」'); } },
    { id: 'takou', name: '卒業文集', e: '📔', g: '夢', cats: ['school', 'intro'], base: 2,
      text: '【予言】取ったとき、〈校庭〉以外でいま一番ティアの低いカテゴリを「将来の夢」に書く。局の終わりにそのカテゴリがTier2以上なら+9。自己紹介を1回する。', flavor: '「しょうらいのゆめは、Godになることです」',
      onPick: (g, p, c) => { const k = g.bottomCat(['school']); g.intro(p, 1); if (k) { c.x.bet = k; g.log(`${g.name(p)}の将来の夢は〈${TJ.catName(k)}〉。`); } },
      score: (g, p, c) => c.x.bet && g.pos(c.x.bet) != null && g.pos(c.x.bet) !== TJ.KESU && g.pos(c.x.bet) <= 3 ? 9 : 0 },
    { id: 'ishi', name: '自己紹介を聞かされた石', e: '🪨', g: '石', cats: ['intro', 'old'], base: 1,
      text: '【得点】自分がこの局でした自己紹介の回数×2。', flavor: '土の自己紹介を、もう300回は聞いている。',
      score: (g, p) => g.introOf(p) * 2 }
  ]
});

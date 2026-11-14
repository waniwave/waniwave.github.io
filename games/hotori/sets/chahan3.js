(function () {
const K = TJ.K;
const PAIRS = [['wan', 'xiaolong'], ['gantetsu', 'yumori'], ['pedal', 'pc_nanashi']];
TJ.registerSet({
  id: 'chahan3', name: 'ネオヨコハマの夜', e: '🌃',
  desc: 'ノゲ横丁、中華街跡、ハコネの足湯。組になる仲間がそろうと絆が生まれる。',
  categories: { memo: { name: 'メモリ', color: '#5ce0c8' } },
  rules: {
    text: '【絆】局の終わりに、ワンと小籠、ガンテツと湯守、ペダルとナナシの組がそろっていれば、1組につき+2。',
    hooks: { playerScore: (g, v, p) => v + PAIRS.filter(([a, b]) => g.has(p, a) && g.has(p, b)).length * 2 }
  },
  cards: [
    { id: 'hongjie', name: '紅姐', e: '💃', g: '紅', cats: ['memo', 'old'], base: 3,
      text: '【得点】自分の場の他の〈メモリ〉1枚につき+1。', flavor: 'ノゲのスナック「止まり木」で、往診を受けている。', score: K.per('memo', 1) },
    { id: 'pedal', name: 'ペダル', e: '🚲', g: '漕', cats: ['speed', 'memo'], base: 2,
      text: '【取ったとき】路地裏レース。手札を回す向きが逆になる。', flavor: '観覧車に乗りたがる。',
      onPick: (g) => g.reverse('★ 路地裏レース！ 手札を回す向きが逆になった。') },
    { id: 'wan', name: 'ワン', e: '🥟', g: '王', cats: ['memo', 'food'], base: 3,
      text: '【得点】自分の場に「小籠」がいれば+4（朗々飯店の二人）。', flavor: '倒したあとで、仲間になった。', score: K.with('xiaolong', 4) },
    { id: 'xiaolong', name: '小籠', e: '🤖', g: '籠', cats: ['robo', 'food'], base: 2,
      text: '【得点】自分の場に「ワン」がいれば+4。', flavor: 'ガイノイド。中華街の屋台が好き。', score: K.with('wan', 4) },
    { id: 'gantetsu', name: 'ガンテツ', e: '🔧', g: '鉄', cats: ['old', 'yu'], base: 3,
      text: '【得点】自分の場に「湯守」がいれば+4（源泉の整備）。', flavor: 'カワサキの工場で会う。60代。', score: K.with('yumori', 4) },
    { id: 'yumori', name: '湯守', e: '♨️', g: '守', cats: ['robo', 'yu'], base: 2,
      text: '【取ったとき】〈湯〉のティアを1段上げる。', flavor: 'ハコネの源泉を守るロボット。', onPick: K.up('yu', 1) },
    { id: 'pc_nanashi', name: 'ナナシ（野良ドローン）', short: 'ナナシ', e: '🛸', g: '無', cats: ['robo', 'speed'], base: 1,
      text: '【手番の終わり】+1（最大+5）。野良ドローンに5回勝つと、ついてくる。', flavor: '埠頭の野良ドローン。',
      onTurnEnd: K.grow(1, 5), ai: (g) => Math.min(5, TJ.TURNS - g.turn + 1) }
  ]
});
})();

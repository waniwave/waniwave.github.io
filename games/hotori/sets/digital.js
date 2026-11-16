(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'digital', name: 'バグった宿', e: '👾',
  desc: 'デジタルでしかできないことをする。手札の配り直し、巻き戻し、増殖、文字化け、無限ループ。',
  categories: { bug: { name: 'バグ', color: '#38e8b0' } },
  cards: [
    { id: 'd_save', name: 'セーブデータ破損', e: '💾', g: '壊', cats: ['bug'], base: 3,
      text: '【取ったとき】全員の手札を集めてシャッフルし、配り直す。', flavor: '「冒険の書は消えてしまいました」',
      onPick: (g) => g.later(() => g.reshuffleHands()) },
    { id: 'd_lag', name: 'ラグ', e: '🐢', g: '遅', cats: ['bug'], base: 3,
      text: '【取ったとき】次は手札が回らない。全員、いまの自分の手札からもう1枚選ぶことになる。', flavor: '回線が、詰まった。',
      onPick: (g) => g.skipPass() },
    { id: 'd_rewind', name: '巻き戻し', e: '⏪', g: '戻', cats: ['bug'], base: 2,
      text: '【取ったとき】ティア表を、この局の始めの状態に巻き戻す。', flavor: '議論は、なかったことになった。',
      onPick: (g) => { g.resetTiers(); g.log('★ 巻き戻し！ ティア表が局の始めに戻った。', true); } },
    { id: 'd_zoushoku', name: 'バグ技：増殖', e: '🧬', g: '増', cats: ['bug'], base: 0,
      text: '【取ったとき】自分の場で一番点の高い他のカードを複製する（同じカードがもう1枚増える）。', flavor: 'アイテム欄の6番目で、Aボタンを押しながら……',
      onPick: (g, p, c) => { let best = null, bv = -1e9; g.table(p).forEach(x => { if (x === c) return; const v = g.cardScore(p, x).total; if (v > bv) { bv = v; best = x; } }); if (best) { g.duplicate(best); g.log(`★ バグ技！「${g.cardName(best)}」が増殖した。`, true); } } },
    { id: 'd_loop', name: '無限ループ', e: '♾️', g: '輪', cats: ['bug'], base: 2,
      text: '【取ったとき】この局の手番が1つ増える。全員の手札に、選ばれていないセットのカードが1枚ずつ乱入する。', flavor: 'このスレは、終わらない。',
      onPick: (g) => g.later(() => g.addTurn(1, '★ 無限ループ！ 選ばれていないセットのカードが乱入し、この局の手番が1つ増えた。')) },
    { id: 'd_mojibake', name: '文字化け', e: '🔣', g: '化', cats: ['bug', 'thread'], base: 3,
      text: '【取ったとき】自分以外の全員の場で、一番新しいカードのカテゴリが、ランダムな1つのカテゴリに化ける。', flavor: '縺ｿ繧薙↑縺ｮ繧ｫ繝ｼ繝',
      onPick: (g, p) => { const ks = g.cats().filter(k => g.pos(k) !== TJ.KESU); if (!ks.length) return; let n = 0; g.others(p).forEach(q => { const t = g.newest(q); if (t && !g.protected(t)) { t.cats = [g.rand(ks)]; n++; } }); if (n) g.log(`★ 文字化けした！ ${n}枚のカードのカテゴリが化けた。`, true); } },
    { id: 'd_cheat', name: 'チートコード', e: '🎮', g: '技', cats: ['bug'], base: 0,
      text: '【取ったとき】自分の場で一番多いカテゴリ（バグ以外）をGodにする。【得点】ただし、このカード自体は−8（運営にバレた）。', flavor: '↑↑↓↓←→←→BA',
      onPick: (g, p) => { const cnt = {}; g.table(p).forEach(x => g.catsOf(x).forEach(k => { if (k !== 'bug' && g.pos(k) !== TJ.KESU) cnt[k] = (cnt[k] || 0) + 1; })); const k = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0]; if (k) { g.setPos(k, 0, p); g.log(`★ チートコード入力！〈${TJ.catName(k)}〉がGodになった。`, true); } },
      score: () => -8, ai: (g, p) => 4 }
  ]
});
})();

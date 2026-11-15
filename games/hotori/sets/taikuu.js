(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'taikuu', name: '対空と読み', e: '🐉',
  desc: 'ティアを動かした瞬間、先に取った瞬間を狩る。読み勝てば一撃。',
  categories: {},
  rules: {
    text: '【確定反撃】この局では、手番の効果を解決する順番が「親から」ではなく「点の低い人から」になる（読み合いの後出しが逆転側に回る）。',
    hooks: { order: (g, v) => v.slice().sort((a, b) => g.score(a) - g.score(b)) }
  },
  cards: [
    { id: 'hadou', name: '波動拳コマンド', e: '🌊', g: '波', cats: ['fgc'], base: 4,
      text: '【取ったとき】飛び道具。向かいの人の一番素点の高いカードの素点−3。', flavor: '↓↘→＋P。遠くから撃つのが基本。',
      onPick: (g, p) => { const q = g.across(p); const t = K.bestOf(g, [q]); if (t) { g.setBase(t, g.baseOf(t) - 3); g.log(`波動が${g.name(q)}の「${g.cardName(t)}」に当たった。素点−3`); } } },
    { id: 'shimmy', name: 'シミー', e: '🕺', g: 'シ', cats: ['fgc'], base: 4,
      text: '【取ったとき】自分より先に効果が起きた人が、この手番に取ったカードの素点−3（投げ抜けを狩る）。', flavor: '一歩下がって、また前へ。',
      onPick: (g, p) => { let n = 0; g.others(p).forEach(q => g.table(q).forEach(x => { if (x.t === g.turn && !g.protected(x)) { g.setBase(x, g.baseOf(x) - 3); n++; } })); g.log(n ? `★ シミーが刺さった！ ${n}枚が素点−3` : 'シミーは空振りした。', !!n); } },
    { id: 'koashi', name: '小足見てから昇竜', e: '👀', g: '見', cats: ['fgc'], base: 4,
      text: '【取ったとき】この手番にティアを動かした人のうち、一番点の高い人の一番素点の高いカードを気絶させる。', flavor: '反応速度の伝説。',
      onPick: (g, p) => { const ts = g.tierersThisTurn().filter(q => q !== p).sort((a, b) => g.score(b) - g.score(a)); const q = ts[0]; if (q == null) { g.log('見る前に終わった。'); return; } const t = K.bestOf(g, [q]); if (t) { g.log('★ 見てから昇竜！', true); g.stun(t); } } },
    { id: 'ichifure', name: '1フレ', e: '⏱️', g: '1F', cats: ['fgc'], base: 1,
      text: '【得点】1手番目に取っていれば+8（最速）。', flavor: '1/60秒の世界。', score: (g, p, c) => c.t === 1 ? 8 : 0 },
    { id: 'gc', name: 'ガードキャンセル', e: '🛡️', g: 'GC', cats: ['fgc', 'death'], base: 3,
      text: '【捨て札へ送られたとき】相打ち。送った人の場の一番素点の高いカードを捨て札へ。', flavor: 'やられる直前に、切り返す。',
      onDeath: (g, o, c) => { const src = c.x.killedBy; if (!src || src.p == null || src.p === o) return; const t = K.bestOf(g, [src.p]); if (t) { g.log('★ ガーキャン！', true); g.kill(t); } } },
    { id: 'piyori', name: 'ピヨり', e: '😵', g: '☆', cats: ['fgc'], base: 4,
      text: '【取ったとき】左右で点の高いほうの人の、一番素点の高いカードをピヨらせる（効果が止まる。素点とティアの補正は残る）。', flavor: '頭の上を、ヒヨコームが回っている。',
      onPick: (g, p) => { const q = g.richer(p); const t = K.bestOf(g, [q], x => !x.x.stun); if (t) g.stun(t, `★ ${g.name(q)}の「${g.cardName(t)}」がピヨった！`); } },
    { id: 'abare', name: '暴れ', e: '😤', g: '暴', cats: ['fgc'], base: 2,
      text: '【取ったとき】固められたら押す。そのとき自分の点が一番低ければ+6。', flavor: '固められたら、とりあえず押す。',
      onPick: (g, p, c) => { const s = g.scores(); if (s[p] <= Math.min(...s)) { K.addPts(c, 6); g.log('暴れが通った！ +6'); } } }
  ]
});
})();

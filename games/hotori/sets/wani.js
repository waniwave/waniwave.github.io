(function () {
const K = TJ.K;
const hasTa = (g, x) => TJ.def(x).name.includes('ター');
TJ.registerSet({
  id: 'wani', name: 'ワニ騒動', e: '🐊',
  desc: 'レオンは名前に「ター」が入った札を撃つ。暗闇ではグタームが食べ、泥棒が盗む。',
  categories: { gun: { name: '銃', color: '#7a7a8a' }, yami: { name: '闇', color: '#3a3460' }, steal: { name: '盗み', color: '#9a6a3a' } },
  cards: [
    { id: 'leon', name: 'タームのことをワニだと勘違いして発砲しているレオン', short: 'ワニ誤認レオン', e: '🔫', g: '銃', cats: ['gun'], base: 3,
      text: '【取ったとき】「ワニだ！」自分以外の全員の場から、名前に「ター」を含むカードを1枚ずつ（素点の高いもの）撃って気絶させる。「ワニ（本物）」なら捨て札へ送って+8。', flavor: '「ワニだ！」――ワニではない。自分の名前にも「ター」が入っていることには、まだ気づいていない。',
      onPick: (g, p, c) => {
        g.log('「ワニだ！」レオンが乱射した！', true);
        g.others(p).forEach(q => { const w = K.bestOf(g, [q], x => x.id === 'wani'); if (w && g.kill(w)) { K.addPts(c, 8); g.log('★ 本物のワニがいた！ +8', true); } else { const t = K.bestOf(g, [q], x => hasTa(g, x)); if (t) g.stun(t); } });
      } },
    { id: 'bullet', name: 'レオンの弾丸', e: '💥', g: '弾', cats: ['gun'], base: 4,
      text: '【取ったとき】左右の場から、名前に「ター」を含むカードを1枚（素点の高いもの）撃って気絶させる。', flavor: 'ワニ用。ワニ以外にも当たる。',
      onPick: (g, p) => { const t = K.bestOf(g, g.neighbors(p), x => hasTa(g, x)); if (t) { g.log('パン！'); g.stun(t); } } },
    { id: 'wani', name: 'ワニ（本物）', e: '🐊', g: '鰐', cats: ['animal'], base: 4,
      text: '【取ったとき】左右の場の〈食べ物〉を1枚ずつ（素点の低いもの）食べて捨て札へ。1枚につき+3。', flavor: 'レオンが正しかった唯一の例。',
      onPick: (g, p, c) => { let n = 0; g.neighbors(p).forEach(q => { const f = K.worstOf(g, [q], x => g.hasCat(x, 'food')); if (f && g.kill(f)) n++; }); if (n) { K.addPts(c, n * 3); g.log(`★ ワニが食べ物を${n}つ平らげた。+${n * 3}`, true); } } },
    { id: 'guterm', name: 'グターム', e: '🌑', g: '暗', cats: ['yami'], base: 4,
      text: '【取ったとき】左右で点の高いほうの人の場から、ランダムに1枚食べて捨て札へ（〈闇〉がTier2以上なら2枚）。', flavor: '暗闇でのみ出現する。詳細はグタームに食べられた方にお尋ねください。',
      onPick: (g, p) => {
        const q = g.richer(p); const pos = g.pos('yami'); const n = pos != null && pos !== TJ.KESU && pos <= 3 ? 2 : 1;
        const pool = g.table(q).filter(x => !g.protected(x)); let k = 0;
        for (let i = 0; i < n && pool.length; i++) { const x = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; if (g.kill(x)) k++; }
        if (k) g.log(`★ 暗闇で、何かが何かを食べる音がした（${g.name(q)}の札${k}枚）。`, true);
      } },
    { id: 'thief', name: '泥棒', e: '🦹', g: '盗', cats: ['steal'], base: 3,
      text: '【取ったとき】左右の場で一番素点の高いカードを盗んで、自分の場へ。（⇄交換：かわりに自分の場の一番素点の低いカードを相手へ渡す）', flavor: '痩せた男。宿のどこかに隠れ家があるらしい。',
      onPick: (g, p) => { const t = K.bestOf(g, g.neighbors(p)); if (t) { const q = g.owner(t); if (g.moveTo(t, p)) g.log(`★ 泥棒が${g.name(q)}の「${g.cardName(t)}」を盗んだ！`, true); } } },
    { id: 'ibukuro', name: 'グタームの胃袋', e: '👄', g: '胃', cats: ['yami'], base: 1,
      text: '【得点】捨て札の枚数（全員ぶん）1枚につき+1（最大+10）。', flavor: '食べたものは、ぜんぶここにある。',
      score: (g) => Math.min(10, g.discard().length) },
    { id: 'karte', name: 'ドクタームのカルテ', e: '📋', g: '診', cats: ['death'], base: 3,
      text: '【常時】自分の場のカードが捨て札に送られるたびに+3（再診料）。', flavor: '「再診です」',
      onAnyDeath: (g, o, c, dead, owner) => { if (owner === o && dead !== c) K.addPts(c, 3); } }
  ]
});
})();

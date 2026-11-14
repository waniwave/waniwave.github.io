(function () {
const K = TJ.K;
const GEN_RULE = {
  text: '【汎用への批判】この局では、〈汎用〉は局の始めにTier4から始まる（スレの住人は汎用に厳しい）。',
  onRoundStart: (g) => { if (g.pos('gen') != null && g.pos('gen') < 5) { g.setPos('gen', 5); g.log('「うわ、汎用札……」〈汎用〉がTier4から始まる。'); } }
};
TJ.GEN_RULE = GEN_RULE;
TJ.registerSet({
  id: 'hanyou1', name: '汎用の勇者パーティ', e: '⚔️',
  desc: 'どのゲームにもいる人たち。素点は高いが、スレの住人は汎用に厳しい。',
  categories: { gen: { name: '汎用', color: '#9a9a9a' } },
  rules: GEN_RULE,
  cards: [
    { id: 'g_hero', name: '勇者', e: '🦸', g: '勇', cats: ['gen'], base: 7, text: '（能力なし）', flavor: '選ばれし者。' },
    { id: 'g_knight', name: '騎士', e: '🐴', g: '騎', cats: ['gen'], base: 6, text: '（能力なし）', flavor: '馬に乗っている。' },
    { id: 'g_cleric', name: '僧侶', e: '✝️', g: '僧', cats: ['gen'], base: 4,
      text: '【取ったとき】回復魔法。自分の場の他のカードすべて+2。', flavor: '回復魔法が使える。',
      onPick: (g, p, c) => g.table(p).forEach(x => { if (x !== c) K.addPts(x, 2); }) },
    { id: 'g_mage', name: '見習い魔法使い', e: '🪄', g: '魔', cats: ['gen'], base: 4,
      text: '【取ったとき】次の手番、カードを取りつつティアも動かせる。', flavor: 'まだ見習い。',
      onPick: (g, p) => { g.grantBonus(p); g.log(`${g.name(p)}は次の手番、取りながらティアも動かせる。`); } },
    { id: 'g_archer', name: '弓兵', e: '🏹', g: '弓', cats: ['gen'], base: 4,
      text: '【取ったとき】遠くから。向かいの人の一番素点の高いカードの素点−4。', flavor: '遠くから攻撃できる。',
      onPick: (g, p) => { const t = K.bestOf(g, [g.across(p)]); if (t) g.setBase(t, g.baseOf(t) - 4); } },
    { id: 'g_scout', name: '斥候', e: '🔭', g: '斥', cats: ['gen'], base: 2,
      text: '【得点】自分の場の他の〈汎用〉1枚につき+2。', flavor: '偵察が得意。', score: K.per('gen', 2) },
    { id: 'kyushoku', name: '給食当番', e: '🥛', g: '給', cats: ['food'], base: 4,
      text: '【取ったとき】自分の場の〈食べ物〉すべて+3、それ以外のカードすべて+1。', flavor: '白衣と帽子とマスク。',
      onPick: (g, p, c) => g.table(p).forEach(x => { if (x !== c) K.addPts(x, g.hasCat(x, 'food') ? 3 : 1); }) }
  ]
});
})();

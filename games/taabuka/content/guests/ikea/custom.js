// IKEAの固有の仕組み「組み立て」：
// 出しの代わりに「組み立てる」（出し回数を使う）。手札の2〜5枚を1枚の「家具」にする。
// 家具は強さ＝組み立てた時の合計、カテゴリ＝全部。手札に残り、戦闘の終わりに分解されて戻る。
// 家具は札の vars.部品 に部品の数を持つ（式「部品」で読める）。
function furniture(B, env, cards) {
  const bz = B.banzuke;
  const cats = [...new Set(cards.flatMap((c) => env.api.cardView(c, env.balance, bz).cats))].slice(0, 13);
  const sum = cards.reduce((s, c) => s + env.api.cardStrength(c, env.balance, bz), 0);
  const base = env.api.cardStrength({ cat: cats }, env.balance, bz);
  return {
    ...cards[0], uid: env.api.newUid(B, 'k'), name: `家具（${cards.length}点）`, cat: cats, tier: null, ins: [],
    plusS: sum - base, grow: 0, enh: null, ed: null, seal: null, faceDown: false, temp: true,
    vars: { 部品: cards.length }, parts: cards, furniture: true, origin: 'copy',
  };
}

function disassemble(list) {
  const out = [];
  for (const c of list) { if (c.furniture) out.push(...disassemble(c.parts)); else out.push(c); }
  return out;
}

export default {
  name: '組み立て',
  kind: 'mechanic',
  text: '出しの代わりに手札2〜5枚を1枚の家具に（強さは合計、カテゴリは全部）。戦闘の終わりに分解',
  params: { 最小: 2, 最大: 5 },
  state: { 組立数: 0 },
  vars: ['組立数', '部品'],
  hooks: {
    'battle.end': (ctx, next) => {
      const B = ctx.battle;
      for (const k of ['hand', 'draw', 'discard', 'exhaust']) B[k] = disassemble(B[k]);
      next();
    },
  },
  actions: {
    /** args: { 札: [手札の番号（2〜5枚）] } */
    組み立てる: (ctx, me) => {
      const B = ctx.battle;
      const { refuse, log, attachCard } = ctx.env.api;
      const idx = [...new Set(ctx.args.札 || [])].sort((a, b) => a - b);
      if (B.playsLeft < 1) throw refuse('出しが残っていない');
      if (idx.length < me.params.最小 || idx.length > me.params.最大) throw refuse(`組み立てるのは${me.params.最小}〜${me.params.最大}枚`);
      if (idx.some((i) => i < 0 || i >= B.hand.length)) throw refuse('手札にない札');
      const cards = idx.map((i) => B.hand[i]);
      const f = furniture(B, ctx.env, cards);
      const at = idx[0];
      B.hand = B.hand.filter((_, i) => !idx.includes(i));
      B.hand.splice(at, 0, f);
      attachCard(ctx.env, f);
      B.playsLeft -= 1;
      B.turnPlays += 1;
      B.guestState.組立数 = (B.guestState.組立数 ?? 0) + 1;
      log(B, { t: 'guest', what: '組み立て', cards: cards.map((c) => c.name), name: f.name });
    },
  },
  ui: { 組み立てる: { label: '組立', ask: [{ key: '札', type: 'selected', min: 2, max: 5 }] } },
  status: (B) => `組み立て：手札の家具 ${B.hand.filter((c) => c.furniture).length}点（この潜行で${B.guestState.組立数 ?? 0}回）`,
  tests: [
    // T3〈麺〉＋T5〈死〉→ 家具（強さ 10＋3＝13、カテゴリ 麺・死）。1枚で出して 13
    { name: '家具は強さが合計', guest: 'ikea', hand: [{ tier: 3, cat: ['麺'] }, { tier: 5, cat: ['死'] }],
      steps: [{ guest: '組み立てる', args: { 札: [0, 1] } }, { play: [0] }], expect: { V: 13, 状態: { 組立数: 1 } } },
  ],
};

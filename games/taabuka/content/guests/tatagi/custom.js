// タタ木の固有の仕組み「植樹」：
// 出しの代わりに「植える」（出し回数を使う）。手札の1〜2枚を植木の枠（上限5）へ。
// ターンの終わりに、植木全部を1つの出しとして採点し、先頭の敵へ（出し回数は使わない）。
// 3本以上で「タタ林」（その採点の倍率×2）、5本で「タタ森」（さらに受け＋植木の強さの合計）。植木は戦闘の終わりにデッキへ戻る。
// 置物「物干し竿」（params.竿）を持っていれば、戦闘の始めに山札の一番上を1本植える。

const zone = (B) => (B.zones.植木 ||= []);
const sync = (B) => { B.guestState.植木数 = zone(B).length; };

function plant(B, env, cards) {
  zone(B).push(...cards);
  B.guestState.植樹数 = (B.guestState.植樹数 ?? 0) + cards.length;
  sync(B);
  env.api.log(B, { t: 'guest', what: '植える', cards: cards.map((c) => c.name), n: zone(B).length });
}

export default {
  name: '植樹',
  kind: 'mechanic',
  text: '出しの代わりに手札1〜2枚を植える。ターンの終わりに植木全部を1つの出しとして採点（3本で倍率×2、5本で受け＋強さの合計）',
  params: { 上限: 5, 一度に: 2, 林: 3, 林の倍: 2, 森: 5, 竿: 'tt_r_monohoshi' },
  state: { 植木数: 0, 植樹数: 0 },
  vars: ['植木数', '植樹数'],
  hooks: {
    'battle.start': (ctx, next, me) => {
      const B = ctx.battle;
      B.zones.植木 = [];
      sync(B);
      if (B.relics.some((r) => r.id === me.params.竿) && B.draw.length) plant(B, ctx.env, [B.draw.shift()]);
      next();
    },
    'turn.end': (ctx, next, me) => {
      const { battle: B, env } = ctx;
      const trees = zone(B);
      const ti = env.api.aliveIndex(B, 0);
      if (trees.length && ti >= 0 && !B.result) {
        const n = trees.length;
        B.guestState.林 = n >= me.params.林 ? 1 : 0;
        const cards = trees.splice(0);
        const sum = cards.reduce((s, c) => s + env.api.cardStrength(c, env.balance, B.banzuke), 0);
        env.api.log(B, { t: 'note', what: n >= me.params.森 ? 'タタ森' : n >= me.params.林 ? 'タタ林' : `植木 ${n}本` });
        env.api.playCards(B, env, cards, ti, { free: true, returnTo: trees, src: '植木' });
        B.guestState.林 = 0;
        if (n >= me.params.森) {
          B.guard += sum;
          env.api.log(B, { t: 'guard', card: 'タタ森', add: sum, guard: B.guard });
        }
        sync(B);
      }
      next();
    },
    'score.final': (ctx, next, me) => {
      if (ctx.battle.guestState.林) ctx.mulM(me.params.林の倍, { kind: 'guest', id: 'tatagi', name: 'タタ林' });
      next();
    },
    'battle.end': (ctx, next) => {
      const B = ctx.battle;
      B.discard.push(...zone(B).splice(0));
      sync(B);
      next();
    },
  },
  actions: {
    /** args: { 札: [手札の番号（1〜2枚）] } */
    植える: (ctx, me) => {
      const B = ctx.battle;
      const { refuse } = ctx.env.api;
      const idx = [...new Set(ctx.args.札 || [])].sort((a, b) => a - b);
      if (B.playsLeft < 1) throw refuse('出しが残っていない');
      if (idx.length < 1 || idx.length > me.params.一度に) throw refuse(`植えるのは1〜${me.params.一度に}枚`);
      if (idx.some((i) => i < 0 || i >= B.hand.length)) throw refuse('手札にない札');
      if (zone(B).length + idx.length > me.params.上限) throw refuse(`植木は${me.params.上限}本まで`);
      const cards = idx.map((i) => B.hand[i]);
      B.hand = B.hand.filter((_, i) => !idx.includes(i));
      for (const c of cards) c.faceDown = false;
      B.playsLeft -= 1;
      B.turnPlays += 1;
      plant(B, ctx.env, cards);
    },
  },
  ui: {
    植える: { label: '植える', ask: [{ key: '札', type: 'selected', min: 1, max: 2 }] },
  },
  status: (B, me) => {
    const n = B.guestState.植木数 ?? 0;
    const names = (B.zones?.植木 || []).map((c) => c.name).join('・');
    return `植木 ${n}/${me.params.上限}${n >= me.params.森 ? '（タタ森）' : n >= me.params.林 ? '（タタ林）' : ''}${names ? `：${names}` : ''}`;
  },
  tests: [
    // 1枚植えて、ターンの終わりに単騎として採点される：(5＋6)×1＝11
    { name: '植えるとターンの終わりに採点', guest: 'tatagi', hand: [{ tier: 3, cat: ['麺'] }, { tier: 5, cat: ['死'] }],
      steps: [{ guest: '植える', args: { 札: [0] } }, { end: true }],
      expect: { 状態: { 植木数: 1, 植樹数: 1 } } },
  ],
};

// 校庭変化の固有の仕組み「変化」：場が毎ターン「校庭→体育館→朝礼台→校庭…」と移る（戦闘の始めは校庭）。
//   校庭：階段・同類の系統の倍率＋校庭のM
//   体育館：揃いの系統（対〜五揃）の強さ＋体育館のS
//   朝礼台：受け×朝礼台の受け、単騎の掛け×朝礼台の単騎
// 置物「白線引き」（params.白線）を持っていれば、戦闘中1回だけ場を飛ばせる（固有行動）。
const FIELDS = ['校庭', '体育館', '朝礼台'];
const RUN = ['階段', '同類', '同類階段', '満員同類', '五揃同類'];
const SET = ['対', '二対', '三揃', '満員', '四揃', '五揃', '満員同類', '五揃同類'];
const src = (B) => ({ kind: 'guest', id: 'koutei', name: FIELDS[B.guestState.場 ?? 0] });

export default {
  name: '変化',
  kind: 'mechanic',
  text: '場が毎ターン移る。校庭：階段・同類系の倍率＋4／体育館：揃い系の強さ＋30／朝礼台：受け×2、単騎の掛け×4',
  params: { 校庭のM: 4, 体育館のS: 30, 朝礼台の受け: 2, 朝礼台の単騎: 4, 白線: 'kt_r_hakusen' },
  state: { 場: 0, 白線済: 0 },
  vars: ['場'],
  hooks: {
    'battle.start': (ctx, next) => {
      ctx.battle.guestState.場 = 0;
      ctx.battle.guestState.白線済 = 0;
      next();
    },
    'turn.start': (ctx, next) => {
      const B = ctx.battle;
      if (B.turn > 1) {
        B.guestState.場 = ((B.guestState.場 ?? 0) + 1) % FIELDS.length;
        ctx.env.api.log(B, { t: 'note', what: `場：${FIELDS[B.guestState.場]}` });
      }
      next();
    },
    'score.final': (ctx, next, me) => {
      const B = ctx.battle;
      const f = FIELDS[B.guestState.場 ?? 0];
      if (f === '校庭' && RUN.includes(ctx.hand)) ctx.addM(me.params.校庭のM, src(B));
      if (f === '体育館' && SET.includes(ctx.hand)) ctx.addS(me.params.体育館のS, src(B));
      if (f === '朝礼台' && ctx.hand === '単騎') ctx.mulM(me.params.朝礼台の単騎, src(B));
      next();
    },
  },
  on: {
    受けに回る: (ctx, me) => {
      if (FIELDS[ctx.battle.guestState.場 ?? 0] === '朝礼台') ctx.guard *= me.params.朝礼台の受け;
    },
  },
  actions: {
    白線引き: (ctx, me) => {
      const B = ctx.battle;
      const { refuse, log } = ctx.env.api;
      if (!B.relics.some((r) => r.id === me.params.白線)) throw refuse('白線引きを持っていない');
      if (B.guestState.白線済) throw refuse('白線引きはこの戦闘でもう使った');
      B.guestState.白線済 = 1;
      B.guestState.場 = ((B.guestState.場 ?? 0) + 1) % FIELDS.length;
      log(B, { t: 'guest', what: '白線引き', field: FIELDS[B.guestState.場] });
    },
  },
  ui: { 白線引き: { label: '白線', ask: [] } },
  status: (B) => {
    const i = B.guestState.場 ?? 0;
    return `場：${FIELDS[i]}（次：${FIELDS[(i + 1) % FIELDS.length]}）${B.guestState.白線済 ? '' : '　白線1'}`;
  },
  tests: [
    // 校庭（1ターン目）は階段の倍率＋4、体育館（2ターン目）は対の強さ＋30
    { name: '体育館で揃いが強い', guest: 'koutei', hand: [{ tier: 3, cat: ['麺'] }, { tier: 3, cat: ['死'] }],
      steps: [{ end: true }, { play: [0, 1] }], expect: { V以上: 100 } },
    { name: '白線で場を飛ばす', guest: 'koutei', relics: ['kt_r_hakusen'], hand: [{ tier: 3, cat: ['麺'] }],
      steps: [{ guest: '白線引き' }], expect: { 状態: { 場: 1, 白線済: 1 } } },
  ],
};

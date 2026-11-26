// 主の「仕掛け」（params.仕掛け に並べた分だけ効く）。どれも予告が出て、どのデッキでも手の打ちようがあるものだけ（詰みにしない）
//   結界   { 割合 }        1回の出しで減らせる主張は最大の主張の「割合」まで（→ 出しを分ける・降参を狙う）
//   大技   { ごと }        「ごと」ターンおきに構える。次の攻めが×2（→ 流して受け・反撃で返す）
//   熱くなる { 率 }        ターンの終わりごとに攻めが（1＋率）倍（→ 早く倒す・受けを厚く）
//   回復   { 割合 }        そのターンに一度も削られなければ、最大の主張の「割合」だけ戻す（→ 毎ターン少しでも削る）
//   ノルマ {}             ターンの始めに、手札で一番多いカテゴリを名指し。そのカテゴリを出さないと構える（→ 出せば何もない）
//   早指し { 初手, 以後 }  そのターンの最初の出しは論破値×初手、2回目からは×以後（→ 最初に一番強い出し）
//   トゲ   { 枚数, 痛み }  「枚数」より多く出すと、超えた1枚ごとに体力−痛み（→ 少なめに出す）
//   手癖   { 上限 }       手札が4枚以上あると1枚盗む（最大「上限」枚、ふつう3）。倒すと捨て札に戻る（→ 早く倒す）
//   取り巻き { 呼ぶ, ごと, 盾 } 「ごと」ターンおきに取り巻きを呼ぶ。取り巻きがいる間、主への論破値×盾（→ 取り巻きを先に）
//   逆さ   { ごと }        「ごと」ターンおきに、そのターンだけ番付が逆さ（→ 次のターンに大きく出す）
//   一律   { ごと, Tier }  「ごと」ターンおきに、そのターンだけ全札がそのTier扱い（→ 枚数と重なりで押す）
//   居留守 { ごと }        「ごと」ターンおきに、常連客の席を1つそのターンだけ止める（→ 札で押す）
const N = (v, d) => (typeof v === 'number' ? v : d);
const every = (B, n) => n > 0 && B.turn % n === 0;

function list(me) { return (me.params?.仕掛け || []).map((x) => (typeof x === 'string' ? { k: x } : x)); }
function act(env, B, e, text) { env.api.log(B, { t: 'act', enemy: e.uid, name: e.name, act: text }); }
function isTarget(B, e, target) {
  const alive = B.enemies.map((x, i) => [x, i]).filter(([x]) => !x.dead);
  const hit = alive.find(([, i]) => i >= target) ?? alive[0];
  return hit?.[0] === e;
}

export default {
  name: '仕掛け',
  kind: 'enemy',
  text: '主の仕掛け（params.仕掛け）。結界・大技・熱くなる・回復・ノルマ・早指し・トゲ・手癖・取り巻き・逆さ・一律・居留守',
  params: { 仕掛け: [] },
  hooks: {
    'turn.start': (ctx, next, me) => {
      next();
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (!e || e.dead) return;
      e.vars.playN = 0; e.vars.quotaMet = false;
      for (const g of list(me)) {
        if (g.k === '大技' && every(B, N(g.ごと, 3))) { e.charged = true; act(env, B, e, '大技の構え（次の攻め×2）'); }
        if (g.k === 'ノルマ') {
          const c = env.api.mostCategory(B, env);
          e.vars.quota = c || null;
          if (c) act(env, B, e, `ノルマ：〈${c}〉を出せ（出さなければ構える）`);
        }
        if (g.k === '手癖' && B.hand.length >= 4 && (e.vars.pocket?.length || 0) < N(g.上限, 3)) {
          const i = env.rng.int(0, B.hand.length - 1);
          const [c] = B.hand.splice(i, 1);
          (e.vars.pocket ||= []).push(c);
          act(env, B, e, `手札の「${c.name}」を盗んだ（倒せば戻る）`);
        }
        if (g.k === '取り巻き' && g.呼ぶ && every(B, N(g.ごと, 3))) {
          env.content.vocab.get('act', '呼ぶ')?.run(B, env, e, g.呼ぶ);
        }
        if (g.k === '逆さ' && every(B, N(g.ごと, 2))) {
          env.api.addRule(B, env, { name: '番付を反転', scope: 'turn', group: 'enemy', owner: me.owner });
          act(env, B, e, 'このターンだけ番付が逆さ');
        }
        if (g.k === '一律' && every(B, N(g.ごと, 2))) {
          env.api.addRule(B, env, { name: '全札を同Tier扱い', params: { Tier: String(g.Tier ?? '5') }, scope: 'turn', group: 'enemy', owner: me.owner });
          act(env, B, e, `このターンだけ全札がTier${g.Tier ?? '5'}扱い`);
        }
        if (g.k === '居留守' && every(B, N(g.ごと, 2))) {
          const r = B.seats.find((x) => x && !x.disabled);
          if (r) { r.disabled = true; (e.vars.muted ||= []).push(r.uid); act(env, B, e, `このターンだけ「${r.name}」が居留守`); }
        }
      }
    },
    'play.before': (ctx, next, me) => {
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (e && !e.dead && e.vars.quota && ctx.cards?.some((c) => env.api.cardView(c, env.balance, B.banzuke).cats.includes(e.vars.quota))) e.vars.quotaMet = true;
      next();
    },
    'damage.apply': (ctx, next, me) => {
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (e && !e.dead && isTarget(B, e, ctx.target)) {
        for (const g of list(me)) {
          if (g.k === '早指し') {
            const first = (e.vars.playN || 0) === 0;
            ctx.V = ctx.V.mul(first ? N(g.初手, 1.5) : N(g.以後, 0.6)).floor();
          }
          if (g.k === '取り巻き' && B.enemies.some((x) => x !== e && !x.dead)) ctx.V = ctx.V.mul(N(g.盾, 0.5)).floor();
          if (g.k === '結界') {
            const cap = e.maxClaim.mul(N(g.割合, 0.35)).floor();
            if (ctx.V.gt(cap)) { ctx.V = cap; env.api.log(B, { t: 'note', what: `${e.name}の結界：1回で削れるのは最大の主張の${Math.round(N(g.割合, 0.35) * 100)}%まで` }); }
          }
        }
        e.vars.playN = (e.vars.playN || 0) + 1;
      }
      next();
      if (e && ctx.hits?.some((h) => h.enemy === e.uid)) e.vars.hitTurn = B.turn;
    },
    'play.after': (ctx, next, me) => {
      next();
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (!e || e.dead) return;
      for (const g of list(me)) {
        if (g.k === 'トゲ') {
          const over = (ctx.cards?.length || 0) - N(g.枚数, 4);
          if (over > 0) env.api.hitPlayer(B, env, e, over * N(g.痛み, 4), 0);
        }
      }
    },
    'turn.end': (ctx, next, me) => {
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (e && !e.dead) {
        for (const g of list(me)) {
          if (g.k === '熱くなる') { e.atk = Math.round(e.atk * (1 + N(g.率, 0.15))); act(env, B, e, `熱くなってきた（攻め${e.atk}）`); }
          if (g.k === '回復' && e.vars.hitTurn !== B.turn) {
            const add = e.maxClaim.mul(N(g.割合, 0.1)).floor();
            const nc = e.claim.add(add);
            e.claim = nc.gt(e.maxClaim) ? e.maxClaim : nc;
            act(env, B, e, '削られなかったので主張を立て直した');
          }
          if (g.k === 'ノルマ' && e.vars.quota && !e.vars.quotaMet) { e.charged = true; act(env, B, e, `ノルマ〈${e.vars.quota}〉未達：構えた（次の攻め×2）`); }
        }
        for (const uid of e.vars.muted || []) { const r = B.seats.find((x) => x?.uid === uid); if (r) r.disabled = false; }
        e.vars.muted = [];
      }
      next();
    },
    'enemy.defeated': (ctx, next, me) => {
      const { battle: B } = ctx;
      const e = ctx.env.api.findOwner(B, me.owner);
      if (e && ctx.enemy === e && e.vars.pocket?.length) { B.discard.push(...e.vars.pocket); e.vars.pocket = []; ctx.env.api.log(B, { t: 'note', what: '盗まれた札が捨て札に戻った' }); }
      next();
    },
    'battle.end': (ctx, next, me) => {
      const { battle: B } = ctx;
      const e = ctx.env.api.findOwner(B, me.owner);
      if (e) for (const uid of e.vars.muted || []) { const r = B.seats.find((x) => x?.uid === uid); if (r) r.disabled = false; }
      next();
    },
  },
};

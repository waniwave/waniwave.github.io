// 底の主「ター」（B16）：倒しても形態を変えて戻る。形態の数は深度の bossForms（ふだんは params.形態）
//   第1形態：ターンの始めに、常連客の席を1つずつ奪う
//   第2形態：番付を全てT8にして固定する（戦闘が終われば元の番付に戻る）。奪った席は返す
//   第3形態：ターンの始めに、その戦闘で一番多く出したカテゴリを封じる。番付は戻す
//   第4形態（深度20）：上の3つを全部
const SEAT = (f) => f === 1 || f >= 4;
const BANZUKE = (f) => f === 2 || f >= 4;
const SEAL = (f) => f >= 3;

function mostPlayed(B) {
  let best = null, n = 0;
  for (const [cat, k] of Object.entries(B.stats.cats || {})) if (k > n) { best = cat; n = k; }
  return best;
}

function fixBanzuke(B, env, e, me) {
  e.vars.saved = { ...B.banzuke };
  for (const c of env.balance.tiers.categories) B.banzuke[c] = '8';
  env.api.log(B, { t: 'note', what: '番付が全てT8になった' });
  e.vars.fixRule = env.api.addRule(B, env, { name: '番付を固定', scope: 'battle', group: 'enemy', owner: me.owner }).id;
}

function releaseBanzuke(B, e) {
  if (!e.vars.saved) return;
  B.rules = B.rules.filter((r) => r.id !== e.vars.fixRule);
  Object.assign(B.banzuke, e.vars.saved);
  e.vars.saved = null;
}

function enter(B, env, e, me, f) {
  if (!SEAT(f)) for (const r of B.seats) r.disabled = false;
  if (BANZUKE(f) && !e.vars.saved) fixBanzuke(B, env, e, me);
  if (!BANZUKE(f) && e.vars.saved) { env.hooks.removeTag(`rule:${e.vars.fixRule}`); releaseBanzuke(B, e); }
  if (!SEAL(f) && e.vars.sealed) { B.sealed.cats = B.sealed.cats.filter((x) => x !== e.vars.sealed); e.vars.sealed = null; }
}

export default {
  name: '底の主',
  kind: 'enemy',
  text: '倒すたびに形態を変えて戻る（形態の数は深度の bossForms か params.形態）。席・番付・カテゴリを順に奪う',
  params: { 形態: 3, 主張: [1, 1, 1, 1.2] },
  hooks: {
    'battle.start': (ctx, next, me) => {
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (e && !e.dead) {
        e.vars.form = 1;
        e.vars.forms = env.api.depthMods(env.balance, B.depth || 0).bossForms || me.params.形態;
        enter(B, env, e, me, 1);
      }
      next();
    },
    'turn.start': (ctx, next, me) => {
      next();
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (!e || e.dead) return;
      const f = e.vars.form || 1;
      if (SEAT(f)) {
        const reg = B.seats.find((r) => r && !r.disabled);
        if (reg) { reg.disabled = true; env.api.log(B, { t: 'act', enemy: e.uid, name: e.name, act: '席を奪う', regular: reg.name }); }
      }
      if (SEAL(f)) {
        const hand = mostPlayed(B);
        if (hand && e.vars.sealed !== hand) {
          if (e.vars.sealed) B.sealed.cats = B.sealed.cats.filter((x) => x !== e.vars.sealed);
          if (!B.sealed.cats.includes(hand)) B.sealed.cats.push(hand);
          e.vars.sealed = hand;
          env.api.log(B, { t: 'act', enemy: e.uid, name: e.name, act: '封じ', what: hand });
        }
      }
    },
    'enemy.defeated': (ctx, next, me) => {
      const { battle: B, env, enemy: e } = ctx;
      if (e.uid !== me.owner.uid || (e.vars.form || 1) >= (e.vars.forms || me.params.形態)) { next(); return; }
      const f = (e.vars.form || 1) + 1;
      e.vars.form = f;
      enter(B, env, e, me, f);
      const mul = me.params.主張[f - 1] ?? 1;
      e.claim = e.vars.base ? e.vars.base.mul(mul).round() : e.maxClaim.mul(mul).round();
      e.vars.base = e.vars.base || e.maxClaim;
      e.maxClaim = e.claim;
      e.charged = false;
      const what = ['', '席を奪う', '番付を全てT8に固定', '一番多く出したカテゴリを封じる', '席・番付・カテゴリの全てを奪う'][Math.min(4, f)];
      env.api.log(B, { t: 'form', enemy: e.uid, name: e.name, form: f, claim: e.claim, what });
    },
    'battle.end': (ctx, next, me) => {
      const { battle: B, env } = ctx;
      const e = env.api.findOwner(B, me.owner);
      if (e) { releaseBanzuke(B, e); if (e.vars.sealed) B.sealed.cats = B.sealed.cats.filter((x) => x !== e.vars.sealed); }
      next();
    },
  },
};

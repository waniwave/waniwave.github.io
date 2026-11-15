/* ター宿のほとり — ルールエンジン
 * 画面にも通信にも依存しない。Node でもブラウザでも動く。
 * カードセットは sets/*.js から TJ.registerSet() で登録する。
 */
(function (G) {
'use strict';
const TJ = G.TJ = G.TJ || {};

// ===== 定数 =====
TJ.TIERS = [
  { k: 'G', name: 'God', mod: 6,  color: '#f3c54a', desc: '絶対的な強さ、神' },
  { k: '0', name: '0',   mod: 4,  color: '#b385f2', desc: 'Tier1よりは強く、神よりは弱い' },
  { k: '1', name: '1',   mod: 2,  color: '#ea6450', desc: '作中最強レベル' },
  { k: '2', name: '2',   mod: 1,  color: '#f19a4c', desc: '強キャラ' },
  { k: '3', name: '3',   mod: 0,  color: '#8fc96c', desc: 'メイン登場人物の中では平均的な強さ' },
  { k: '4', name: '4',   mod: -1, color: '#5ec4c9', desc: '敵意をもたないもの、食べ物やそれに類するもの' },
  { k: '5', name: '5',   mod: -2, color: '#a3a8bd', desc: '食べ物よりも弱い' },
  { k: '8', name: '8',   mod: null, color: '#ff7fda', desc: '（説明なし）' }
];
TJ.KESU = -1;            // 欠番（Tier6・7）。補正0で固定、投票で動かない
TJ.START = 4;            // Tier3
TJ.TURNS = 7;
TJ.ROUNDS = 4;
TJ.PLAY_GRACE = 9000;
TJ.HAND = 7;
TJ.RANK_PTS = [4, 2, 1, 0];
TJ.T8_RANGE = [-3, 5];
TJ.ROUND_NAMES = ['東1局', '東2局', '東3局', '東4局'];
TJ.FINAL_TITLES = [
  { k: 'G', name: 'ティアGOD', desc: '絶対的な強さ、神' },
  { k: '0', name: 'Tier0', desc: 'Tier1よりは強く、神よりは弱い' },
  { k: '1', name: 'Tier1', desc: '作中最強レベル' },
  { k: '5', name: 'Tier5', desc: '食べ物よりも弱い' }
];

// ===== 登録 =====
TJ.CATS = {};
TJ.SETS = {};
TJ.SET_ORDER = [];
TJ.CARD = {};
TJ.registerCategory = function (key, o) {
  TJ.CATS[key] = Object.assign({ key, name: key, color: '#888', common: false }, TJ.CATS[key] || {}, o);
};
// 共通カテゴリ（複数セットにまたがる。ティアは局をまたいで引き継ぐ）
[
  ['food', '食べ物', '#e8645a'], ['death', '死', '#8a5aa6'], ['inn', '宿', '#c9a65a'],
  ['animal', '動物', '#6fbf5a'], ['thread', 'スレ', '#3fae7a'], ['yu', '湯', '#3fa7b3'],
  ['school', '校庭', '#a8794a'], ['speed', '速さ', '#5aa8e8'], ['fgc', '格ゲー', '#9a7cf0'],
  ['ter', 'ター', '#e0a030'], ['old', '老', '#9a9fb8'], ['men', '麺', '#e8b04a'], ['robo', 'ロボ', '#7aa8c8']
].forEach(([k, n, c]) => TJ.registerCategory(k, { name: n, color: c, common: true }));

TJ.registerSet = function (def) {
  if (!def || !def.id) throw new Error('set needs id');
  def.cards = def.cards || [];
  def.tokens = def.tokens || [];
  (def.categories ? Object.entries(def.categories) : []).forEach(([k, v]) => {
    if (!TJ.CATS[k]) TJ.registerCategory(k, Object.assign({ common: false }, typeof v === 'string' ? { name: v } : v));
  });
  const all = def.cards.concat(def.tokens.map(t => Object.assign({ token: 1 }, t)));
  all.forEach(c => {
    if (TJ.CARD[c.id] && TJ.CARD[c.id].set !== def.id) console.warn('[TJ] card id duplicated:', c.id);
    c.set = def.id;
    c.cats = c.cats || [];
    if (!c.cats.length) console.warn('[TJ] card has no category:', c.id);
    if (c.cats.length > 3) console.warn('[TJ] card has more than 3 categories:', c.id);
    c.cats.forEach(k => { if (!TJ.CATS[k]) console.warn('[TJ] unknown category', k, 'on', c.id); });
    TJ.CARD[c.id] = c;
  });
  const n = def.cards.reduce((a, c) => a + (c.copies || 1), 0);
  if (n !== TJ.HAND) console.warn(`[TJ] set ${def.id} has ${n} cards (should be ${TJ.HAND})`);
  if (!TJ.SETS[def.id]) TJ.SET_ORDER.push(def.id);
  TJ.SETS[def.id] = def;
};

// ===== 小道具 =====
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
TJ.util = { rnd, shuffle, clamp };
const DEF = c => TJ.CARD[c.id];
TJ.def = DEF;
TJ.catsOf = c => (c.cats || DEF(c).cats);
TJ.tierKey = pos => pos === TJ.KESU ? 'K' : TJ.TIERS[pos].k;
TJ.modOf = (st, pos) => {
  if (pos === TJ.KESU || pos == null) return 0;
  const t = TJ.TIERS[pos];
  return t.k === '8' ? st.t8 : t.mod;
};
TJ.seatName = (st, p) => st.seats[p].name;

// ===== 状態 =====
TJ.newGame = function (o) {
  const st = {
    v: 0, seats: o.seats.map(s => ({ name: s.name, cpu: !!s.cpu, lv: s.lv || 2 })),
    pool: (o.pool && o.pool.length ? o.pool : TJ.SET_ORDER).filter(id => TJ.SETS[id]),
    used: [], round: -1, start: o.start != null ? o.start : rnd(4), oya: 0, turn: 0,
    phase: 'pick', sets: [], tiers: {}, carry: {}, t8: 0, dir: 1,
    players: [0, 1, 2, 3].map(() => ({ hand: [], table: [], cut: [], rp: 0, raw: 0, hist: [], act: null, ok: false, intro: 0, bonus: 0, block: 0, gauge: 0, mv: 0, noPick: 0 })),
    discard: [], log: [], ev: [], evSeq: 0, uid: 1, results: [], final: null,
    timer: o.timer || 0, rounds: o.rounds || TJ.ROUNDS, tut: !!o.tut, turnTierers: [], ghosts: [], recap: null,
    stats: { moves: {}, lost: [0, 0, 0, 0], hits: [0, 0, 0, 0], tierOps: [0, 0, 0, 0], stolen: [0, 0, 0, 0] }
  };
  TJ.startRound(st);
  return st;
};

function pickSets(st) {
  const need = 4;
  let avail = st.pool.filter(id => !st.used.includes(id));
  if (avail.length < need) { st.used = []; avail = st.pool.slice(); }
  shuffle(avail);
  const sets = avail.slice(0, need);
  // プールが4つ未満でも遊べるように重複を許す
  while (sets.length < need) sets.push(st.pool[rnd(st.pool.length)]);
  sets.forEach(id => st.used.push(id));
  return sets;
}

TJ.startRound = function (st) {
  st.round++;
  st.oya = (st.start + st.round) % 4;
  st.turn = 1;
  st.phase = 'pick';
  st.sets = pickSets(st);
  st.dir = st.round % 2 === 0 ? 1 : -1;
  st.discard = [];
  const deck = [];
  st.sets.forEach(sid => TJ.SETS[sid].cards.forEach(d => {
    for (let k = 0; k < (d.copies || 1); k++) deck.push(TJ.mk(st, d.id));
  }));
  shuffle(deck);
  st.players.forEach((P, i) => {
    const keep = P.table.filter(c => c.x.keep);   // 局をまたいで残るカード（エタームなど）
    keep.forEach(c => { c.x.keep = 0; c.x.carried = 1; c.t = 0; });
    P.hand = deck.slice(i * TJ.HAND, (i + 1) * TJ.HAND);
    P.table = keep; P.cut = []; P.act = null; P.ok = false; P.intro = 0; P.bonus = 0; P.block = 0; P.gauge = 0; P.mv = 0; P.noPick = 0;
  });
  st.ghosts = []; st.recap = null; st.datFrom = 0;
  // ティア表
  const cats = new Set();
  st.sets.forEach(sid => {
    const s = TJ.SETS[sid];
    s.cards.concat(s.tokens).forEach(d => d.cats.forEach(k => cats.add(k)));
    ((s.rules && s.rules.extraCats) || []).forEach(k => cats.add(k));
  });
  st.players.forEach(P => P.table.forEach(c => TJ.catsOf(c).forEach(k => cats.add(k))));
  st.tiers = {};
  [...cats].forEach(k => {
    st.tiers[k] = (TJ.CATS[k] && TJ.CATS[k].common && st.carry[k] != null) ? st.carry[k] : TJ.START;
  });
  rollT8(st);
  st.ev = [];
  push(st, { k: 'round', round: st.round, oya: st.oya, sets: st.sets.slice() });
  log(st, `── ${TJ.ROUND_NAMES[st.round] || ('第' + (st.round + 1) + '局')}　親（スレ主）：${TJ.seatName(st, st.oya)} ──`, 0, 'sys');
  const g = TJ.api(st);
  st._resolving = 1;
  st.sets.forEach(sid => { const r = TJ.SETS[sid].rules; if (r && r.onRoundStart) runRule(st, sid, () => r.onRoundStart(g)); });
  st._resolving = 0;
  if (st.timer) st.deadline = Date.now() + st.timer * 1000;
  st.v++;
};

TJ.mk = (st, id) => ({ u: st.uid++, id, x: {}, t: 0, o: -1 });

function rollT8(st) {
  const [a, b] = TJ.T8_RANGE;
  st.t8 = a + rnd(b - a + 1);
}
function push(st, e) { e.seq = ++st.evSeq; st.ev.push(e); }
function log(st, text, big, kind) {
  st.log.push({ t: text, b: big ? 1 : 0, k: kind || '' , seq: st.evSeq });
  if (st.log.length > 120) st.log.splice(0, st.log.length - 120);
  if (big) push(st, { k: 'banner', text });
}

// ===== 原因の記録 =====
// 効果を動かしている間、st._src に「誰の何のせいか」を置いておく
function withSrc(st, src, fn) { const prev = st._src; st._src = src; try { return fn(); } finally { st._src = prev; } }
TJ.withSrc = withSrc;
const srcOf = (c, p) => ({ u: c.u, id: c.id, p });
function curSrc(st) { return st._src ? Object.assign({}, st._src) : null; }

// ===== 発動の記録 =====
// 効果が「何かを起こした」ときだけ、その前に fx 出来事を差し込む（画面のカットイン用）
function runEffect(st, c, p, kind, fn) {
  const n0 = st.ev.length, l0 = st.log.length, pts0 = c.x.pts || 0, b0 = c.x.base;
  withSrc(st, srcOf(c, p), () => { try { fn(); } catch (e) { console.error(e); } });
  const evs = st.ev.slice(n0);
  const notable = kind === 'turn' ? evs.some(e => e.k !== 'banner') : (evs.length || st.log.length > l0 || (c.x.pts || 0) !== pts0 || c.x.base !== b0);
  if (st._resolving && notable) st.ev.splice(n0, 0, { k: 'fx', u: c.u, id: c.id, p, kind, seq: ++st.evSeq });
}
function runRule(st, sid, fn) {
  const n0 = st.ev.length, l0 = st.log.length;
  withSrc(st, { rule: sid }, () => { try { fn(); } catch (e) { console.error(e); } });
  if (st.ev.length > n0 || st.log.length > l0) st.ev.splice(n0, 0, { k: 'rule', sid, seq: ++st.evSeq });
}
// ルールの書き換え（フック）が実際に値を変えたとき、画面に知らせる
const VISIBLE_HOOKS = ['protect', 'tierPower', 'tierSum', 'rankPts', 'rankReverse', 'canTier', 'triggerTimes', 'rankTable', 'order', 'blockPick', 'datOchi'];
function noteHook(st, key, e) {
  if (!st._resolving) return;
  st._hookSeen = st._hookSeen || {};
  if (st._hookSeen[key]) return;
  st._hookSeen[key] = 1; push(st, e);
}

// ===== フック =====
// セット独自ルール（rules.hooks）と、場にあるカードの hooks を順に通す
TJ.hook = function (st, name, v, ...args) {
  const g = TJ.api(st);
  for (const sid of st.sets) {
    const r = TJ.SETS[sid] && TJ.SETS[sid].rules;
    const f = r && r.hooks && r.hooks[name];
    if (f) { const v0 = v; try { v = f(g, v, ...args); } catch (e) { console.error(e); } if (VISIBLE_HOOKS.includes(name) && JSON.stringify(v) !== JSON.stringify(v0)) noteHook(st, 'r:' + sid + ':' + name, { k: 'rule', sid, hook: name }); }
  }
  st.players.forEach((P, o) => P.table.forEach(c => {
    const d = DEF(c); const f = d.hooks && d.hooks[name];
    if (f && !c.x.zero && !c.x.stun) { const v0 = v; try { v = f(g, o, c, v, ...args); } catch (e) { console.error(e); } if (VISIBLE_HOOKS.includes(name) && JSON.stringify(v) !== JSON.stringify(v0)) noteHook(st, 'c:' + c.u + ':' + name, { k: 'fx', u: c.u, id: c.id, p: o, kind: 'hook', hook: name }); }
  }));
  return v;
};

// ===== 得点 =====
TJ.cardScore = function (st, p, c) {
  const d = DEF(c); const g = TJ.api(st);
  let base = c.x.zero ? 0 : (c.x.base != null ? c.x.base : (d.base || 0));
  let eff = 0;
  if (d.score && !c.x.zero && !c.x.stun) { try { eff = d.score(g, p, c) || 0; } catch (e) { console.error(e); } }
  const acc = c.x.pts || 0;
  eff += acc;
  let tier = 0;
  const parts = [];
  if (!d.noTier) {
    TJ.catsOf(c).forEach(k => {
      let m = TJ.modOf(st, st.tiers[k] != null ? st.tiers[k] : TJ.START) * (d.tierX || 1);
      if (d.invert || c.x.invert) m = -m;   // 逆張り：補正が逆になる
      m = TJ.hook(st, 'tierMod', m, c, k, p);
      tier += m; parts.push([k, m]);
    });
  }
  const raw = base + eff + tier;
  const total = TJ.hook(st, 'cardScore', raw, c, p);
  return { base, eff, acc, tier, parts, rule: Math.round(total - raw), total: Math.round(total) };
};
TJ.playerScore = function (st, p) {
  let tot = 0; const rows = [];
  st.players[p].table.forEach(c => { const r = TJ.cardScore(st, p, c); rows.push([c.u, r]); tot += r.total; });
  tot = TJ.hook(st, 'playerScore', tot, p);
  return { tot: Math.round(tot), rows };
};
TJ.allScores = st => [0, 1, 2, 3].map(p => TJ.playerScore(st, p).tot);

TJ.rankPoints = function (st, scores) {
  const rev = TJ.hook(st, 'rankReverse', false);
  const idx = [0, 1, 2, 3].sort((a, b) => rev ? scores[a] - scores[b] : scores[b] - scores[a]);
  const table = TJ.hook(st, 'rankTable', TJ.RANK_PTS.slice());
  const pts = [0, 0, 0, 0]; const place = [0, 0, 0, 0];
  let i = 0;
  while (i < 4) {
    let j = i;
    while (j + 1 < 4 && scores[idx[j + 1]] === scores[idx[i]]) j++;
    let sum = 0; for (let k = i; k <= j; k++) sum += table[k];
    for (let k = i; k <= j; k++) { pts[idx[k]] = sum / (j - i + 1); place[idx[k]] = i + 1; }
    i = j + 1;
  }
  return { pts: TJ.hook(st, 'rankPts', pts, scores, place), place };
};

// ===== API（カード効果から使う道具） =====
const API = new WeakMap();
TJ.api = function (st) {
  if (API.has(st)) return API.get(st);
  const P = i => st.players[i];
  const g = {
    st,
    get turn() { return st.turn; }, get round() { return st.round; }, get oya() { return st.oya; },
    get dir() { return st.dir; },
    def: DEF, catsOf: TJ.catsOf,
    name: p => TJ.seatName(st, p),
    cardName: c => { const d = DEF(c); return d.short || d.name; },
    log: (t, big) => log(st, t, big),
    rand: a => a[rnd(a.length)],
    // 席
    left: p => (p + 1) % 4, right: p => (p + 3) % 4,
    next: p => (p + st.dir + 4) % 4,          // 手札を渡す相手
    prev: p => (p - st.dir + 4) % 4,          // 手札をくれる相手
    others: p => [0, 1, 2, 3].filter(i => i !== p),
    neighbors: p => [(p + 3) % 4, (p + 1) % 4],
    score: p => TJ.playerScore(st, p).tot,
    scores: () => TJ.allScores(st),
    richer: p => { const [a, b] = [(p + 3) % 4, (p + 1) % 4]; return g.score(a) >= g.score(b) ? a : b; },
    leader: (except) => { let best = -1, bv = -1e9; [0, 1, 2, 3].forEach(i => { if (i === except) return; const v = g.score(i); if (v > bv) { bv = v; best = i; } }); return best; },
    isOya: p => p === st.oya,
    // カード
    table: p => P(p).table,
    hand: p => P(p).hand,
    has: (p, id) => P(p).table.some(c => c.id === id),
    count: (p, pred) => P(p).table.filter(pred).length,
    cnt: (p, cat, except) => P(p).table.filter(c => c !== except && TJ.catsOf(c).includes(cat)).length,
    hasCat: (c, cat) => TJ.catsOf(c).includes(cat),
    baseOf: c => c.x.zero ? 0 : (c.x.base != null ? c.x.base : (DEF(c).base || 0)),
    cardScore: (p, c) => TJ.cardScore(st, p, c).total,
    discard: () => st.discard,
    newest: p => { const t = P(p).table; let best = null; t.forEach(c => { if (!best || c.t >= best.t) best = c; }); return best; },
    owner: c => { for (let i = 0; i < 4; i++) if (P(i).table.includes(c)) return i; return -1; },
    protected: (c) => { const o = g.owner(c); return o >= 0 && (!!c.x.boxed || !!TJ.hook(st, 'protect', false, c, o)); },
    cause: () => curSrc(st),
    findTable: u => { for (let i = 0; i < 4; i++) { const x = P(i).table.find(y => y.u === u); if (x) return x; } return null; },
    // 場のカードを捨て札へ
    kill: (c, why) => {
      const o = g.owner(c); if (o < 0) return false;
      if (g.protected(c)) { log(st, `「${g.cardName(c)}」は守られた。`); push(st, { k: 'guard', u: c.u, p: o }); return false; }
      if (c.x.shield) { c.x.shield = 0; log(st, `「${g.cardName(c)}」は守りで防いだ。`); push(st, { k: 'guard', u: c.u, p: o }); return false; }
      const src = curSrc(st); const atk = src && src.u ? g.findTable(src.u) : null;
      if (atk && src.p !== o && atk !== c) {
        if (c.x.kaeshi || (DEF(c).reflect && !c.x.zero)) {
          c.x.kaeshi = 0; log(st, `★ 「${g.cardName(c)}」が跳ね返した！「${g.cardName(atk)}」に返っていく。`, 1);
          push(st, { k: 'guard', u: c.u, p: o, reflect: 1 });
          return withSrc(st, srcOf(c, o), () => g.kill(atk)) && false;
        }
        if (c.id !== 'm_migawari') {
          const m = P(o).table.find(x => x.id === 'm_migawari' && !x.x.used && !x.x.zero);
          if (m) { m.x.used = 1; log(st, `★ 身代わりの浴衣が「${g.cardName(c)}」をかばった！`, 1); return g.kill(m); }
        }
      }
      P(o).table.splice(P(o).table.indexOf(c), 1);
      st.discard.push({ c, p: o, how: 'kill', src });
      c.x.killedBy = src;
      if (st.stats) { st.stats.lost[o]++; if (src && src.p >= 0 && src.p !== o) st.stats.hits[src.p]++; }
      push(st, { k: 'kill', u: c.u, id: c.id, p: o, src });
      st.ghosts.push({ c: JSON.parse(JSON.stringify(c)), p: o, src, why: 'kill', round: st.round, turn: st.turn });
      if (why) log(st, why);
      fire(st, 'onAnyDeath', c, o);
      st.sets.forEach(sid => { const R = TJ.SETS[sid].rules; if (R && R.onKill) runRule(st, sid, () => R.onKill(g, c, o)); });
      const d = DEF(c);
      if (d.onDeath) { const n = TJ.hook(st, 'triggerTimes', 1, c, o, 'death'); for (let k = 0; k < n; k++) runEffect(st, c, o, 'death', () => d.onDeath(g, o, c)); }
      return true;
    },
    // 場のカードを別の人の場へ
    moveTo: (c, to, why, opts) => {
      const o = g.owner(c); if (o < 0 || o === to) return false;
      if (g.protected(c)) { log(st, `「${g.cardName(c)}」は守られた。`); push(st, { k: 'guard', u: c.u, p: o }); return false; }
      if (c.x.shield && curSrc(st) && curSrc(st).p !== o) { c.x.shield = 0; log(st, `「${g.cardName(c)}」は守りで防いだ。`); push(st, { k: 'guard', u: c.u, p: o }); return false; }
      P(o).table.splice(P(o).table.indexOf(c), 1);
      c.t = st.turn + 0.5; c.o = to; P(to).table.push(c);
      const src = curSrc(st);
      c.x.from = { p: o, src, round: st.round, turn: st.turn };
      push(st, { k: 'move', u: c.u, id: c.id, from: o, to, src });
      st.ghosts.push({ c: JSON.parse(JSON.stringify(c)), p: o, to, src, why: 'move', round: st.round, turn: st.turn });
      if (why) log(st, why);
      P(o).mv++; P(to).mv++;
      if (st.stats && src && src.p === to && o !== to) st.stats.stolen[to]++;
      // 奪う効果はすべて「交換」：奪った人は、自分の場の一番素点の低いカードを相手に渡す
      if (src && src.p === to && o !== to && !(opts && opts.noSwap) && !st._swap) {
        const give = P(to).table.filter(x => x !== c && x.u !== src.u && !g.protected(x)).sort((a, b) => g.baseOf(a) - g.baseOf(b) || a.t - b.t)[0];
        if (give) { st._swap = 1; try { g.moveTo(give, o, null, { noSwap: 1 }); } finally { st._swap = 0; } log(st, `⇄ 交換：かわりに「${g.cardName(give)}」を${g.name(o)}へ渡した。`); }
      }
      fire(st, 'onAnyMove', c, o, to);
      st.sets.forEach(sid => { const R = TJ.SETS[sid].rules; if (R && R.onMove) runRule(st, sid, () => R.onMove(g, c, o, to)); });
      return true;
    },
    // 捨て札から場へ
    revive: (entry, to) => {
      const i = st.discard.indexOf(entry); if (i < 0) return false;
      st.discard.splice(i, 1); entry.c.t = st.turn + 0.5; entry.c.o = to; P(to).table.push(entry.c);
      entry.c.x.from = { p: -1, src: curSrc(st), round: st.round, turn: st.turn, revive: 1 };
      push(st, { k: 'revive', u: entry.c.u, to });
      return true;
    },
    // 化かす（素点と効果を0に）
    zero: (c, why) => {
      if (!c || c.x.zero || g.protected(c)) return false;
      c.x.zero = 1; c.x.zeroBy = { src: curSrc(st), round: st.round, turn: st.turn };
      push(st, { k: 'zero', u: c.u, id: c.id, p: g.owner(c), src: curSrc(st) });
      if (why) log(st, why, 1);
      return true;
    },
    // トークン（デッキ外のカード）を場に出す
    token: (p, id, x) => {
      if (!TJ.CARD[id]) return null;
      const c = TJ.mk(st, id); c.t = st.turn + 0.5; c.o = p; Object.assign(c.x, x || {});
      P(p).table.push(c); push(st, { k: 'token', u: c.u, p });
      return c;
    },
    // ティア
    pos: cat => st.tiers[cat] != null ? st.tiers[cat] : null,
    tier: cat => st.tiers[cat] == null ? null : TJ.tierKey(st.tiers[cat]),
    mod: cat => TJ.modOf(st, st.tiers[cat]),
    cats: () => Object.keys(st.tiers),
    topCat: (except) => { let best = null, bp = 99; Object.keys(st.tiers).forEach(k => { const v = st.tiers[k]; if (v === TJ.KESU || (except && except.includes(k))) return; if (v < bp) { bp = v; best = k; } }); return best; },
    bottomCat: (except) => { let best = null, bp = -1; Object.keys(st.tiers).forEach(k => { const v = st.tiers[k]; if (v === TJ.KESU || (except && except.includes(k))) return; if (v > bp) { bp = v; best = k; } }); return best; },
    move: (cat, d, by, opt) => TJ.moveTier(st, cat, d, Object.assign({ by }, opt || {})),
    setPos: (cat, pos, by) => { if (st.tiers[cat] == null) return; const from = st.tiers[cat]; if (from === pos) return; st.tiers[cat] = pos; push(st, { k: 'tier', cat, from, to: pos, by, src: curSrc(st) }); afterTier(st, cat, from, pos); },
    kesuban: (cat, by) => { if (st.tiers[cat] == null || st.tiers[cat] === TJ.KESU) return false; const from = st.tiers[cat]; st.tiers[cat] = TJ.KESU; push(st, { k: 'tier', cat, from, to: TJ.KESU, by, src: curSrc(st) }); log(st, `★ 〈${TJ.CATS[cat].name}〉が欠番になった。理由は聞かない。`, 1); afterTier(st, cat, from, TJ.KESU); return true; },
    addCat: (cat, pos) => { if (st.tiers[cat] == null) { st.tiers[cat] = pos != null ? pos : TJ.START; push(st, { k: 'tier', cat, from: null, to: st.tiers[cat] }); } },
    // 手番まわり
    reverse: (why, quiet) => { st.dir *= -1; push(st, { k: 'dir', dir: st.dir }); log(st, why || `★ 手札を回す向きが逆になった！`, quiet ? 0 : 1); fire(st, 'onReverse'); },
    later: fn => { (st._later = st._later || []).push({ fn, src: curSrc(st) }); },
    // 手札を回す向きに、余分に n 回回す（このあと通常の回しも行われる）
    passHands: (n) => { n = n || 1; for (let k = 0; k < n; k++) { const h = st.players.map(P => P.hand); st.players.forEach((P, i) => { st.players[(i + st.dir + 4) % 4].hand = h[i]; }); } push(st, { k: 'pass2', n, dir: st.dir }); },
    swapHands: (a, b) => { const t = P(a).hand; P(a).hand = P(b).hand; P(b).hand = t; push(st, { k: 'swap', a, b }); },
    grantBonus: (p, turn) => { P(p).bonus = turn != null ? turn : st.turn + 1; },
    blockTier: (p, turn) => { P(p).block = turn != null ? turn : st.turn + 1; },
    intro: (p, n) => { P(p).intro += (n == null ? 1 : n); fire(st, 'onIntro', p); },
    introOf: p => P(p).intro,
    rp: p => P(p).rp,
    tierersThisTurn: () => st.turnTierers.slice(),
    across: p => (p + 2) % 4,
    setBase: (c, n) => { c.x.base = Math.max(0, n); },
    gauge: p => P(p).gauge, addGauge: (p, n) => { P(p).gauge = Math.max(0, P(p).gauge + n); },
    moves: p => P(p).mv,
    cutCount: p => P(p).cut.length,
    lostCount: p => st.discard.filter(e => e.p === p && e.how === 'kill').length,
    noPickNext: (p, turn) => { P(p).noPick = turn != null ? turn : st.turn + 1; },
    datFrom: t => { st.datFrom = st.datFrom ? Math.min(st.datFrom, t) : t; },
    catsCount: p => { const s = new Set(); P(p).table.forEach(x => TJ.catsOf(x).forEach(k => s.add(k))); return s.size; },
    topCatOf: p => { const n = {}; P(p).table.forEach(x => TJ.catsOf(x).forEach(k => { n[k] = (n[k] || 0) + 1; })); return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || null; },
    stun: (c, why) => { if (!c || g.protected(c)) return false; c.x.stun = 1; push(st, { k: 'zero', u: c.u, id: c.id, p: g.owner(c), src: curSrc(st), stun: 1 }); if (why) log(st, why, 1); return true; }
  };
  API.set(st, g);
  return g;
};

function fire(st, name, ...args) {
  const g = TJ.api(st);
  st.players.forEach((P, o) => P.table.slice().forEach(c => {
    const d = DEF(c); if (d[name] && !c.x.zero && !c.x.stun) runEffect(st, c, o, name === 'onTurnEnd' ? 'turn' : 'other', () => d[name](g, o, c, ...args));
  }));
}
let tierDepth = 0;
function afterTier(st, cat, from, to) {
  if (st.stats) { const n = from === TJ.KESU || to === TJ.KESU ? 1 : Math.abs(to - from); st.stats.moves[cat] = (st.stats.moves[cat] || 0) + n; }
  if (tierDepth > 3) return;
  tierDepth++;
  try { fire(st, 'onTierChange', cat, from, to); } finally { tierDepth--; }
}
TJ.moveTier = function (st, cat, d, opt) {
  opt = opt || {};
  const from = st.tiers[cat];
  if (from == null || !d) return 0;
  if (from === TJ.KESU && !opt.force) return 0;
  const base = from === TJ.KESU ? TJ.START : from;
  const to = clamp(base - d, 0, TJ.TIERS.length - 1);
  if (to === from) return 0;
  st.tiers[cat] = to;
  push(st, { k: 'tier', cat, from, to, by: opt.by, vote: !!opt.vote, src: opt.vote ? null : curSrc(st) });
  afterTier(st, cat, from, to);
  return from - to;
};

// ===== 合法手 =====
TJ.datTurn = st => st.datFrom || TJ.TURNS;
TJ.canTier = (st, p) => (st.turn < TJ.datTurn(st) || !TJ.hook(st, 'datOchi', true)) && st.players[p].block !== st.turn && TJ.hook(st, 'canTier', true, p);
TJ.hasBonus = (st, p) => (st.turn === 1 && p === st.oya) || st.players[p].bonus === st.turn;
TJ.tierCats = st => Object.keys(st.tiers).filter(k => st.tiers[k] !== TJ.KESU);
function tierLegal(st, p, t) {
  if (!t || !TJ.canTier(st, p)) return 'いまはティアを動かせない';
  if (st.tiers[t.cat] == null) return 'そのカテゴリはこの局にない';
  if (st.tiers[t.cat] === TJ.KESU) return '欠番は動かせない';
  if (![1, 2, -1, -2].includes(t.d)) return '動かせるのは±2段まで';
  return null;
}
TJ.legal = function (st, p, a) {
  const P = st.players[p];
  if (!a) return '行動がない';
  if (st.phase === 'roundEnd' || st.phase === 'gameEnd') return a.type === 'ok' ? null : 'いまは行動できない';
  if (st.phase !== 'pick') return 'いまは行動できない';
  if (P.act) return 'もう決めた';
  const c = P.hand.find(x => x.u === a.u);
  if (!c) return 'そのカードは手札にない';
  if (a.type === 'take') {
    if (a.tier) { if (!TJ.hasBonus(st, p)) return 'この手番は両方はできない'; return tierLegal(st, p, a.tier); }
    return null;
  }
  if (a.type === 'tier') return tierLegal(st, p, a);
  return '不明な行動';
};

TJ.submit = function (st, p, a) {
  if (st.phase === 'roundEnd' || st.phase === 'gameEnd') {
    if (a && a.type === 'ok') { st.players[p].ok = true; st.v++; }
    return null;
  }
  const err = TJ.legal(st, p, a);
  if (err) return err;
  st.players[p].act = { type: a.type, u: a.u, cat: a.cat, d: a.d, tier: a.tier ? { cat: a.tier.cat, d: a.tier.d } : null };
  st.v++;
  if (st.players.every(P => P.act)) TJ.resolve(st);
  return null;
};
TJ.allOk = st => st.players.every((P, i) => P.ok || st.seats[i].cpu);

// ===== 手番の解決 =====
TJ.resolve = function (st) {
  const g = TJ.api(st);
  st.ev = []; st._resolving = 1; st._hookSeen = {};
  try { resolveInner(st, g); } finally { st._resolving = 0; }
};
function resolveInner(st, g) {
  const order = TJ.hook(st, 'order', [0, 1, 2, 3].map(i => (st.oya + i) % 4));
  push(st, { k: 'reveal', acts: st.players.map(P => P.act && { type: P.act.type, u: P.act.u, cat: P.act.cat || (P.act.tier && P.act.tier.cat), d: P.act.d || (P.act.tier && P.act.tier.d) }) });
  // 1) ティア操作を合算
  const sum = {}, voters = {};
  st.turnTierers = [];
  order.forEach(p => {
    const a = st.players[p].act; const t = a.type === 'tier' ? { cat: a.cat, d: a.d } : a.tier;
    if (!t) return;
    st.turnTierers.push(p);
    let d = TJ.hook(st, 'tierPower', t.d, p, t.cat);
    sum[t.cat] = (sum[t.cat] || 0) + d;
    (voters[t.cat] = voters[t.cat] || []).push({ p, d: t.d });
    log(st, `${g.name(p)}：〈${TJ.CATS[t.cat].name}〉を${t.d > 0 ? '+' : ''}${t.d}`, 0, 'vote');
  });
  const recap = { round: st.round, turn: st.turn, votes: [] };
  Object.keys(sum).forEach(cat => {
    const from = st.tiers[cat];
    const s = TJ.hook(st, 'tierSum', sum[cat], cat, voters[cat]);
    let moved = 0;
    if (s) {
      moved = TJ.moveTier(st, cat, s, { vote: true });
      if (!moved && st.tiers[cat] !== TJ.KESU) log(st, `〈${TJ.CATS[cat].name}〉はもう動けない。`);
    } else log(st, `〈${TJ.CATS[cat].name}〉は議論が平行線のまま動かなかった。`);
    recap.votes.push({ cat, voters: voters[cat].map(v => ({ p: v.p, d: v.d })), raw: sum[cat], sum: s, from, to: st.tiers[cat], moved });
  });
  st.recap = recap;
  // 2) 捨てる（カット）
  order.forEach(p => {
    const P = st.players[p]; const a = P.act;
    if (a.type !== 'tier') return;
    const i = P.hand.findIndex(c => c.u === a.u); if (i < 0) return;
    const c = P.hand.splice(i, 1)[0];
    c.o = p; P.cut.push(c);
    if (st.stats) st.stats.tierOps[p]++;
    const entry = { c, p, how: 'cut' }; st.discard.push(entry);
    push(st, { k: 'cut', u: c.u, id: c.id, p });
    const d = DEF(c);
    if (d.onCut) { const n = TJ.hook(st, 'triggerTimes', 1, c, p, 'cut'); for (let k = 0; k < n; k++) runEffect(st, c, p, 'cut', () => d.onCut(g, p, c, entry)); }
  });
  // 3) 取る（親から順に効果を解決）
  order.forEach(p => {
    const P = st.players[p]; const a = P.act;
    if (a.type !== 'take') return;
    const i = P.hand.findIndex(c => c.u === a.u); if (i < 0) return;
    const c = P.hand.splice(i, 1)[0];
    c.o = p; c.t = st.turn; P.table.push(c);
    push(st, { k: 'take', u: c.u, id: c.id, p });
    const d = DEF(c);
    // ワイルド：自分の場で一番多いカテゴリの仲間にもなる
    if (d.wild) { const top = g.topCatOf(p); const cs = d.cats.slice(); if (top && !cs.includes(top) && cs.length < 3) cs.push(top); c.cats = cs; if (st.tiers[top] == null && top) st.tiers[top] = TJ.START; }
    const sealed = P.noPick === st.turn || TJ.hook(st, 'blockPick', false, c, p);
    if (d.onPick && sealed) { log(st, `「${g.cardName(c)}」の【取ったとき】は封じられた。`); push(st, { k: 'sealed', u: c.u, id: c.id, p }); }
    else if (d.onPick) runEffect(st, c, p, 'pick', () => d.onPick(g, p, c));
    fire(st, 'onAnyPick', p, c);
    st.sets.forEach(sid => { const R = TJ.SETS[sid].rules; if (R && R.onAnyPick) runRule(st, sid, () => R.onAnyPick(g, p, c)); });
  });
  // 手札に触る効果は、全員が取り終えてから
  const later = st._later || []; delete st._later;
  later.forEach(it => withSrc(st, it.src, () => { try { it.fn(g); } catch (e) { console.error(e); } }));
  // 4) 手番の終わり
  fire(st, 'onTurnEnd');
  st.sets.forEach(sid => { const r = TJ.SETS[sid].rules; if (r && r.onTurnEnd) runRule(st, sid, () => r.onTurnEnd(g)); });
  st.players.forEach(P => { P.act = null; });
  recap.fx = st.ev.filter(e => e.k === 'tier' && !e.vote && e.from != null).map(e => ({ cat: e.cat, from: e.from, to: e.to, src: e.src }));
  // 残像は「次の手番が終わるまで」：この手番より前のものを消す
  st.ghosts = st.ghosts.filter(x => x.round === st.round && x.turn >= st.turn);
  if (st.turn >= TJ.TURNS) { TJ.endRound(st); st.v++; return; }
  // 5) 手札を回す
  const hands = st.players.map(P => P.hand);
  st.players.forEach((P, i) => { st.players[(i + st.dir + 4) % 4].hand = hands[i]; });
  st.turn++;
  rollT8(st);
  push(st, { k: 'turn', turn: st.turn, t8: st.t8 });
  if (st.timer) st.deadline = Date.now() + st.timer * 1000 + TJ.PLAY_GRACE;  // 画面で手番の再生を見る時間を足す
  st.v++;
};

TJ.endRound = function (st) {
  const g = TJ.api(st);
  fire(st, 'onRoundEnd');
  const detail = [0, 1, 2, 3].map(p => TJ.playerScore(st, p));
  const scores = detail.map(d => d.tot);
  const { pts, place } = TJ.rankPoints(st, scores);
  st.players.forEach((P, p) => {
    P.rp += pts[p]; P.raw += scores[p];
    P.hist.push({ round: st.round, score: scores[p], pts: pts[p], place: place[p] });
    P.ok = false;
  });
  const res = {
    round: st.round, sets: st.sets.slice(), oya: st.oya, scores, pts, place,
    rows: detail.map((d, p) => d.rows.map(([u, r]) => { const c = st.players[p].table.find(x => x.u === u); return { u, id: c ? c.id : '', r }; })),
    tiers: Object.assign({}, st.tiers), reversed: !!TJ.hook(st, 'rankReverse', false)
  };
  try { res.story = TJ.roundStory(st, res); } catch (e) { console.error(e); res.story = []; }
  res.lost = [0, 1, 2, 3].map(p => st.discard.filter(e => e.how === 'kill' && e.p === p).length);
  st.results.push(res);
  Object.keys(st.tiers).forEach(k => { if (TJ.CATS[k] && TJ.CATS[k].common) st.carry[k] = st.tiers[k]; });
  // 局をまたぐカード
  st.players.forEach((P, p) => P.table.forEach(c => { const d = DEF(c); if (d.carry && d.carry(g, p, c)) c.x.keep = 1; }));
  push(st, { k: 'roundEnd', res });
  log(st, `${TJ.ROUND_NAMES[st.round]}終了：` + [0, 1, 2, 3].sort((a, b) => place[a] - place[b]).map(p => `${place[p]}位 ${g.name(p)}（${scores[p]}点）`).join('　'), 0, 'sys');
  if (st.round >= (st.rounds || TJ.ROUNDS) - 1) TJ.endGame(st);
  else st.phase = 'roundEnd';
};

TJ.nextRound = function (st) {
  if (st.phase !== 'roundEnd') return;
  st.players.forEach(P => { P.table = P.table.filter(c => c.x.keep); });
  TJ.startRound(st);
};

TJ.endGame = function (st) {
  const order = [0, 1, 2, 3].sort((a, b) => {
    const A = st.players[a], B = st.players[b];
    if (B.rp !== A.rp) return B.rp - A.rp;
    if (B.raw !== A.raw) return B.raw - A.raw;
    return ((a - st.start + 4) % 4) - ((b - st.start + 4) % 4);
  });
  st.final = order;
  st.phase = 'gameEnd';
  push(st, { k: 'gameEnd', order });
};

// ===== 局の「決め手」 =====
// 局の終わりに、勝敗を分けた出来事を大きい順に3つまで選んで文章にする
function tierName(pos) { if (pos === TJ.KESU) return '欠番'; const t = TJ.TIERS[pos]; return t ? (t.k === 'G' ? 'God' : 'Tier' + t.k) : '?'; }
TJ.roundStory = function (st, res) {
  const g = TJ.api(st); const out = [];
  const fmt = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v);
  // 1) ティアの効き：カテゴリごと・人ごとのティア補正の合計
  const byCat = {};
  res.rows.forEach((rows, p) => rows.forEach(x => (x.r.parts || []).forEach(([k, m]) => { if (!m) return; const key = k + ':' + p; byCat[key] = (byCat[key] || 0) + m; })));
  Object.entries(byCat).forEach(([key, v]) => {
    const [k, p] = key.split(':'); const n = res.rows[+p].filter(x => (x.r.parts || []).some(q => q[0] === k)).length;
    if (Math.abs(v) >= 4) out.push({ type: 'tier', w: Math.abs(v), p: +p, cat: k, t: `〈${TJ.catName(k)}〉が${tierName(st.tiers[k])}で、${g.name(+p)}の${n > 1 ? n + '枚が合わせて' : 'カードが'}${fmt(v)}点` });
  });
  // 2) 一番点を取ったカード
  let best = null;
  res.rows.forEach((rows, p) => rows.forEach(x => { if (!best || x.r.total > best.v) best = { v: x.r.total, p, id: x.id }; }));
  if (best && best.v >= 8 && TJ.CARD[best.id]) out.push({ type: 'card', w: best.v, p: best.p, t: `${g.name(best.p)}の「${TJ.CARD[best.id].short || TJ.CARD[best.id].name}」が1枚で${best.v}点` });
  // 3) セットのルールの加点
  [0, 1, 2, 3].forEach(p => {
    try { TJ.explainTotal(st, p).rules.forEach(r => { if (Math.abs(r.d) >= 3) { const R = TJ.SETS[r.sid]; const m = R.rules.text.match(/^【(.+?)】/); out.push({ type: 'rule', w: Math.abs(r.d) * 1.2, p, t: `${m ? '【' + m[1] + '】' : R.name}で${g.name(p)}が${fmt(r.d)}点` }); } }); } catch (e) { /* noop */ }
  });
  // 4) 他人の効果で消されたカード
  [0, 1, 2, 3].forEach(p => {
    const ks = st.discard.filter(e => e.how === 'kill' && e.p === p && e.src && e.src.p !== p);
    if (!ks.length) return;
    const lost = ks.reduce((a, e) => a + Math.max(1, g.baseOf(e.c)), 0);
    const s0 = ks[0].src; const sd = s0 && TJ.CARD[s0.id];
    out.push({ type: 'kill', w: lost * 1.3, p, t: `${g.name(p)}は場のカードを${ks.length}枚消された${sd && s0.p >= 0 ? `（${g.name(s0.p)}の「${sd.short || sd.name}」${ks.length > 1 ? 'など' : ''}）` : ''}` });
  });
  out.sort((a, b) => b.w - a.w);
  const pick = []; const seen = {};
  out.forEach(x => { if (pick.length >= 3) return; const lim = x.type === 'tier' ? 2 : 1; if ((seen[x.type] || 0) >= lim) return; seen[x.type] = (seen[x.type] || 0) + 1; pick.push(x); });
  // 5) 僅差
  const sorted = res.scores.slice().sort((a, b) => b - a);
  if (sorted[0] - sorted[1] <= 3) pick.push({ type: 'close', w: 0, p: res.place.indexOf(1), t: sorted[0] === sorted[1] ? '1位は同点で、順位点を分け合った' : `1位と2位の差は、わずか${sorted[0] - sorted[1]}点` });
  return pick.map(x => ({ t: x.t, p: x.p, type: x.type }));
};

// ===== 影響元の説明 =====
// 場の他のカードを1枚ずつ外して計算し直し、点が変わったものを「影響元」とする
TJ.explain = function (st, p, u) {
  const P = st.players[p]; const c = P.table.find(x => x.u === u); if (!c) return null;
  const r = TJ.cardScore(st, p, c);
  const infl = [];
  st.players.forEach((Q, o) => Q.table.slice().forEach(x => {
    if (x === c) return;
    const i = Q.table.indexOf(x); Q.table.splice(i, 1);
    let r2; try { r2 = TJ.cardScore(st, p, c); } finally { Q.table.splice(i, 0, x); }
    // ルール（宿泊約款など）による増減はルールの欄に出すので、ここでは除く
    const dv = (r.total - r.rule) - (r2.total - r2.rule);
    if (dv) infl.push({ u: x.u, id: x.id, o, d: dv });
  }));
  const explained = infl.reduce((a, x) => a + x.d, 0);
  // 効果のうち、場のカードでは説明できない分（捨て札・取った手番・自己紹介の回数など）
  const other = Math.round((r.eff - r.acc) - explained);
  return { r, infl, other };
};
// 合計点の内訳（カードごと＋セットのルールの加点）
TJ.explainTotal = function (st, p) {
  const ps = TJ.playerScore(st, p);
  const sum = ps.rows.reduce((a, [, r]) => a + r.total, 0);
  const rules = [];
  st.sets.forEach(sid => {
    const R = TJ.SETS[sid].rules; const f = R && R.hooks && R.hooks.playerScore;
    if (f) { let v = sum; try { v = f(TJ.api(st), sum, p); } catch (e) { /* noop */ } if (v !== sum) rules.push({ sid, d: Math.round(v - sum) }); }
  });
  return { tot: ps.tot, rows: ps.rows, rules, rest: ps.tot - sum - rules.reduce((a, x) => a + x.d, 0) };
};

// ===== 便利：観戦用の要約 =====
TJ.catCounts = function (st, cat) {
  return st.players.map(P => P.table.filter(c => TJ.catsOf(c).includes(cat)).length);
};

// ===== カードを作る道具（セットの作り手向け） =====
// 例： score: K.per('ham', 2)  …自分の場の他の〈ハーム〉1枚につき+2
TJ.catName = k => (TJ.CATS[k] && TJ.CATS[k].name) || k;
TJ.K = {
  per: (cat, n) => (g, p, c) => g.cnt(p, cat, c) * n,                    // 他の〈cat〉1枚につき+n
  perAny: (cats, n) => (g, p, c) => g.count(p, x => x !== c && cats.some(k => g.hasCat(x, k))) * n,
  with: (id, n) => (g, p) => g.has(p, id) ? n : 0,                       // 「id」がいれば+n
  withAll: (ids, n) => (g, p) => ids.every(id => g.has(p, id)) ? n : 0,  // 全部そろえば+n
  atLeast: (cat, k, n) => (g, p) => g.cnt(p, cat) >= k ? n : 0,           // 〈cat〉がk枚以上なら+n
  tierAtLeast: (cat, pos, n) => (g) => { const v = g.pos(cat); return v != null && v !== TJ.KESU && v <= pos ? n : 0; },
  takenBy: (t, n) => (g, p, c) => c.t > 0 && c.t <= t ? n : 0,           // t手番目までに取っていれば+n
  takenFrom: (t, n) => (g, p, c) => c.t >= t ? n : 0,                    // t手番目以降に取っていれば+n
  up: (cat, d) => (g, p) => g.move(cat, d == null ? 1 : d, p),           // 取ったとき〈cat〉をd段
  tokens: (id, n) => (g, p) => { for (let i = 0; i < (n || 1); i++) g.token(p, id); },
  grow: (n, max) => (g, o, c) => { c.x.pts = Math.min(max == null ? 99 : max, (c.x.pts || 0) + n); },
  // 左右（またはq）の場から条件に合うものを素点の高い順に選ぶ
  bestOf: (g, ps, pred) => { const a = []; ps.forEach(q => g.table(q).forEach(x => { if ((!pred || pred(x)) && !g.protected(x)) a.push(x); })); a.sort((x, y) => g.baseOf(y) - g.baseOf(x)); return a[0] || null; },
  worstOf: (g, ps, pred) => { const a = []; ps.forEach(q => g.table(q).forEach(x => { if ((!pred || pred(x)) && !g.protected(x)) a.push(x); })); a.sort((x, y) => g.baseOf(x) - g.baseOf(y)); return a[0] || null; },
  addPts: (c, n) => { c.x.pts = (c.x.pts || 0) + n; }
};

if (typeof module !== 'undefined') module.exports = TJ;
})(typeof window !== 'undefined' ? window : globalThis);

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
  ['ter', 'ター', '#e0a030'], ['old', '老', '#9a9fb8']
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
    players: [0, 1, 2, 3].map(() => ({ hand: [], table: [], cut: [], rp: 0, raw: 0, hist: [], act: null, ok: false, intro: 0, bonus: 0, block: 0 })),
    discard: [], log: [], ev: [], evSeq: 0, uid: 1, results: [], final: null,
    timer: o.timer || 0, turnTierers: [], ghosts: [], recap: null
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
    P.table = keep; P.cut = []; P.act = null; P.ok = false; P.intro = 0; P.bonus = 0; P.block = 0;
  });
  st.ghosts = []; st.recap = null;
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
  st.sets.forEach(sid => { const r = TJ.SETS[sid].rules; if (r && r.onRoundStart) withSrc(st, { rule: sid }, () => { try { r.onRoundStart(g); } catch (e) { console.error(e); } }); });
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

// ===== フック =====
// セット独自ルール（rules.hooks）と、場にあるカードの hooks を順に通す
TJ.hook = function (st, name, v, ...args) {
  const g = TJ.api(st);
  for (const sid of st.sets) {
    const r = TJ.SETS[sid] && TJ.SETS[sid].rules;
    const f = r && r.hooks && r.hooks[name];
    if (f) { try { v = f(g, v, ...args); } catch (e) { console.error(e); } }
  }
  st.players.forEach((P, o) => P.table.forEach(c => {
    const d = DEF(c); const f = d.hooks && d.hooks[name];
    if (f && !c.x.zero) { try { v = f(g, o, c, v, ...args); } catch (e) { console.error(e); } }
  }));
  return v;
};

// ===== 得点 =====
TJ.cardScore = function (st, p, c) {
  const d = DEF(c); const g = TJ.api(st);
  let base = c.x.zero ? 0 : (c.x.base != null ? c.x.base : (d.base || 0));
  let eff = 0;
  if (d.score && !c.x.zero) { try { eff = d.score(g, p, c) || 0; } catch (e) { console.error(e); } }
  const acc = c.x.pts || 0;
  eff += acc;
  let tier = 0;
  const parts = [];
  if (!d.noTier) {
    TJ.catsOf(c).forEach(k => {
      let m = TJ.modOf(st, st.tiers[k] != null ? st.tiers[k] : TJ.START) * (d.tierX || 1);
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
    protected: (c) => { const o = g.owner(c); return o >= 0 && !!TJ.hook(st, 'protect', false, c, o); },
    // 場のカードを捨て札へ
    kill: (c, why) => {
      const o = g.owner(c); if (o < 0) return false;
      if (g.protected(c)) { log(st, `「${g.cardName(c)}」は守られた。`); return false; }
      P(o).table.splice(P(o).table.indexOf(c), 1);
      st.discard.push({ c, p: o, how: 'kill' });
      const src = curSrc(st);
      push(st, { k: 'kill', u: c.u, id: c.id, p: o, src });
      st.ghosts.push({ c: JSON.parse(JSON.stringify(c)), p: o, src, why: 'kill', round: st.round, turn: st.turn });
      if (why) log(st, why);
      const d = DEF(c); if (d.onDeath) try { d.onDeath(g, o, c); } catch (e) { console.error(e); }
      return true;
    },
    // 場のカードを別の人の場へ
    moveTo: (c, to, why) => {
      const o = g.owner(c); if (o < 0 || o === to) return false;
      if (g.protected(c)) { log(st, `「${g.cardName(c)}」は守られた。`); return false; }
      P(o).table.splice(P(o).table.indexOf(c), 1);
      c.t = st.turn + 0.5; c.o = to; P(to).table.push(c);
      const src = curSrc(st);
      c.x.from = { p: o, src, round: st.round, turn: st.turn };
      push(st, { k: 'move', u: c.u, id: c.id, from: o, to, src });
      st.ghosts.push({ c: JSON.parse(JSON.stringify(c)), p: o, to, src, why: 'move', round: st.round, turn: st.turn });
      if (why) log(st, why);
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
    swapHands: (a, b) => { const t = P(a).hand; P(a).hand = P(b).hand; P(b).hand = t; push(st, { k: 'swap', a, b }); },
    grantBonus: (p, turn) => { P(p).bonus = turn != null ? turn : st.turn + 1; },
    blockTier: (p, turn) => { P(p).block = turn != null ? turn : st.turn + 1; },
    intro: (p, n) => { P(p).intro += (n == null ? 1 : n); fire(st, 'onIntro', p); },
    introOf: p => P(p).intro,
    rp: p => P(p).rp,
    tierersThisTurn: () => st.turnTierers.slice()
  };
  API.set(st, g);
  return g;
};

function fire(st, name, ...args) {
  const g = TJ.api(st);
  st.players.forEach((P, o) => P.table.slice().forEach(c => {
    const d = DEF(c); if (d[name] && !c.x.zero) withSrc(st, srcOf(c, o), () => { try { d[name](g, o, c, ...args); } catch (e) { console.error(e); } });
  }));
}
let tierDepth = 0;
function afterTier(st, cat, from, to) {
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
TJ.canTier = (st, p) => st.turn < TJ.TURNS && st.players[p].block !== st.turn && TJ.hook(st, 'canTier', true, p);
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
  st.ev = [];
  const order = [0, 1, 2, 3].map(i => (st.oya + i) % 4);
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
    const entry = { c, p, how: 'cut' }; st.discard.push(entry);
    push(st, { k: 'cut', u: c.u, id: c.id, p });
    const d = DEF(c); if (d.onCut) withSrc(st, srcOf(c, p), () => { try { d.onCut(g, p, c, entry); } catch (e) { console.error(e); } });
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
    if (d.onPick) withSrc(st, srcOf(c, p), () => { try { d.onPick(g, p, c); } catch (e) { console.error(e); } });
    fire(st, 'onAnyPick', p, c);
  });
  // 手札に触る効果は、全員が取り終えてから
  const later = st._later || []; delete st._later;
  later.forEach(it => withSrc(st, it.src, () => { try { it.fn(g); } catch (e) { console.error(e); } }));
  // 4) 手番の終わり
  fire(st, 'onTurnEnd');
  st.sets.forEach(sid => { const r = TJ.SETS[sid].rules; if (r && r.onTurnEnd) withSrc(st, { rule: sid }, () => { try { r.onTurnEnd(g); } catch (e) { console.error(e); } }); });
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
  if (st.timer) st.deadline = Date.now() + st.timer * 1000;
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
  st.results.push(res);
  Object.keys(st.tiers).forEach(k => { if (TJ.CATS[k] && TJ.CATS[k].common) st.carry[k] = st.tiers[k]; });
  // 局をまたぐカード
  st.players.forEach((P, p) => P.table.forEach(c => { const d = DEF(c); if (d.carry && d.carry(g, p, c)) c.x.keep = 1; }));
  push(st, { k: 'roundEnd', res });
  log(st, `${TJ.ROUND_NAMES[st.round]}終了：` + [0, 1, 2, 3].sort((a, b) => place[a] - place[b]).map(p => `${place[p]}位 ${g.name(p)}（${scores[p]}点）`).join('　'), 0, 'sys');
  if (st.round >= TJ.ROUNDS - 1) TJ.endGame(st);
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

if (typeof module !== 'undefined') module.exports = TJ;
})(typeof window !== 'undefined' ? window : globalThis);

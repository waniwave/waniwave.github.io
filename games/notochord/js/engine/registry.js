// registry.js — コンテンツパックの読み込み・検査、効果の部品（fx）、イベントと条件判定
// DOM に触れない。Node とブラウザの両方で動く。

// 自分の URL のクエリ（?v=BUILD）をパックの読み込みにも付ける（Node では空）
const Q = (() => { try { return new URL(import.meta.url).search; } catch { return ''; } })();

const isHex = v => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

// パックが持てるキーと、各データの必須項目・追加検査
export const KINDS = {
  nodes: {
    required: ['id', 'name', 'kind'],
    check(n, err) {
      if (!['color', 'overlay', 'cmp', 'special'].includes(n.kind)) err(`kind "${n.kind}" は color / overlay / cmp / special のいずれか`);
      if (n.color !== undefined && !isHex(n.color)) err(`color "${n.color}" は #RRGGBB で書く`);
      if (n.kind === 'color' && !isHex(n.color)) err('色ノードには color が必要');
      if (n.kind === 'overlay' && typeof n.chance !== 'number') err('overlay には chance（出現率）が必要');
      if (n.kind === 'cmp' && (typeof n.tier !== 'number' || typeof n.minSize !== 'number')) err('cmp には tier と minSize が必要');
      if (n.kind === 'special' && typeof n.chainable !== 'boolean') err('special には chainable（true/false）が必要');
    },
  },
  strains: { required: ['id', 'name'] },
  rarities: { required: ['id', 'name', 'group'] },
  enemies: { required: ['id', 'name', 'atk', 'interval'], refs: { 'gimmicks.place': 'nodes' } },
  vertebrae: { required: ['id', 'name', 'region', 'strain'], fx: true, refs: { strain: 'strains', rarity: 'rarities' } },
  mutagens: { required: ['id', 'name', 'strain', 'rarity', 'effect'], fx: true, refs: { strain: 'strains', rarity: 'rarities' } },
  ampoules: {
    required: ['id', 'name', 'use', 'target'],
    check(a, err) {
      if (!['freeze', 'recolor', 'heal', 'burnRow', 'magnet', 'rewind'].includes(a.use)) err(`use "${a.use}" が不明`);
      if (!['none', 'row', 'color', 'color2'].includes(a.target)) err(`target "${a.target}" が不明`);
    },
  },
  affixes: { required: ['id'], fx: true },
  routes: { required: ['id', 'name'] },
  lineages: { required: ['id', 'name'], fx: true },
  traits: { required: ['id', 'name'], fx: true },
  modes: { required: ['id', 'name', 'hpBase', 'hpGrowth', 'pool'], refs: { pool: 'enemies', bosses: 'enemies' } },
  story: { required: ['id', 'type'] },
  tutorial: { required: ['id'] },
};

// rules（基本ルールの数値）は全パックを順に上書き合成する。以下は必須
const RULES_REQUIRED = [
  'board.cols', 'board.rows', 'board.spineCol', 'board.minChain', 'board.mergeMin',
  'board.mergeChainLimit', 'board.shockRange', 'board.spineMul', 'fire.time', 'fire.fallTime', 'theme.bg',
  'combat.startMult', 'combat.chainBonus', 'combat.longBonus', 'combat.mutagenSlots', 'combat.ampouleSlots',
  'spineBreak.max', 'spineBreak.mul', 'spineBreak.timeScale', 'backflow.perTurn', 'backflow.perHit',
];

// 参照先の id が存在するか（'a.b' は配列の各要素の b、オブジェクトは値をすべて見る）
function refValues(item, path) {
  const [head, ...rest] = path.split('.');
  let v = item[head];
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : (typeof v === 'object' ? Object.values(v) : [v]);
  return rest.length ? arr.flatMap(x => (x && typeof x === 'object' ? refValues(x, rest.join('.')) : [])) : arr;
}

function deepMerge(dst, src) {
  for (const [k, v] of Object.entries(src || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) dst[k] = deepMerge(dst[k] || {}, v);
    else dst[k] = v;
  }
  return dst;
}
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

export function createRegistry(packs) {
  const errors = [];
  const tables = Object.fromEntries(Object.keys(KINDS).map(k => [k, new Map()]));
  const rules = {};
  const seen = new Map();
  const packIds = new Set();

  packs.forEach((p, i) => {
    const where = p?.id ?? `#${i}`;
    if (!p || typeof p !== 'object') { errors.push(`パック ${where}: オブジェクトを export default していない`); return; }
    if (!p.id) errors.push(`パック ${where}: id がない`);
    else if (packIds.has(p.id)) errors.push(`パック ${where}: パックの id が重複`);
    packIds.add(p.id);
    for (const key of Object.keys(p)) {
      if (key === 'id' || key === 'name') continue;
      if (key === 'rules') { deepMerge(rules, p.rules); continue; }
      if (!(key in KINDS)) { errors.push(`パック ${where}: 不明なキー "${key}"`); continue; }
      const list = p[key];
      if (!Array.isArray(list)) { errors.push(`パック ${where}: "${key}" は配列で書く`); continue; }
      list.forEach((item, j) => {
        const label = `${where}.${key}[${j}]${item?.id ? ' ' + item.id : ''}`;
        const err = e => errors.push(`${label}: ${e}`);
        if (!item || typeof item !== 'object') { err('オブジェクトではない'); return; }
        for (const f of KINDS[key].required) if (item[f] === undefined || item[f] === '') err(`必須項目 "${f}" がない`);
        KINDS[key].check?.(item, err);
        if (KINDS[key].fx && item.effect !== undefined) checkFx(item.effect, err);
        if (!item.id) return;
        if (seen.has(item.id)) err(`id "${item.id}" が重複（${seen.get(item.id)}）`);
        else { seen.set(item.id, label); tables[key].set(item.id, { ...item, pack: where }); }
      });
    }
  });
  for (const p of RULES_REQUIRED) if (getPath(rules, p) === undefined) errors.push(`rules: "${p}" がない`);
  for (const [kind, spec] of Object.entries(KINDS)) {
    if (!spec.refs) continue;
    for (const item of tables[kind].values()) for (const [path, target] of Object.entries(spec.refs)) {
      for (const id of refValues(item, path)) if (!tables[target].has(id)) errors.push(`${item.pack}.${kind} ${item.id}: ${path} の "${id}" が ${target} に存在しない`);
    }
  }

  return {
    tables, rules, errors,
    get: (kind, id) => tables[kind]?.get(id),
    all: kind => [...(tables[kind]?.values() ?? [])],
    has: (kind, id) => !!tables[kind]?.has(id),
  };
}

// content/index.js の一覧からパックを読み込む
export async function loadPacks() {
  const errors = [];
  let list = [];
  try { list = (await import(`../../content/index.js${Q}`)).default; }
  catch (e) { errors.push(`content/index.js を読み込めない: ${e.message}`); }
  if (!Array.isArray(list)) { errors.push('content/index.js は配列を export default する'); list = []; }
  const packs = [];
  for (const name of list) {
    try { packs.push((await import(`../../content/${name}.js${Q}`)).default); }
    catch (e) { errors.push(`パック "${name}" を読み込めない: ${e.message}`); }
  }
  const reg = createRegistry(packs);
  reg.errors.unshift(...errors);
  return reg;
}

// ---- 効果の部品（fx） ----
// fx.xxx(...) は { fx: 'xxx', args: [...] } という記述を返す。数値の '$' はレアリティ倍率を掛けた値に置き換わる。
export const FX_OPS = new Set();
const STRUCT = new Set(['when', 'perChain', 'perNode', 'perColorKind']);
const COND = new Set(['chainsAtLeast', 'lenAtLeast', 'colorIs', 'onSpine', 'hasCMP', 'syncBelow', 'backflowAbove', 'colorChanged', 'critActive']);
const op = name => { FX_OPS.add(name); return (...args) => ({ fx: name, args }); };
export const fx = {
  // 組み立て
  when: op('when'),                 // when(条件, 効果...)：ターン全体の条件
  perChain: op('perChain'),         // perChain(条件, 効果...)：条件を満たす連結1つにつき
  perNode: op('perNode'),           // perNode(条件, 効果...)：条件を満たすノード1つにつき（ノードの値を変える）
  perColorKind: op('perColorKind'), // perColorKind(効果...)：そのターンに消した色の種類1つにつき
  // 条件（配列で渡すと「すべて満たす」）
  chainsAtLeast: op('chainsAtLeast'), lenAtLeast: op('lenAtLeast'), colorIs: op('colorIs'),
  onSpine: op('onSpine'), hasCMP: op('hasCMP'), syncBelow: op('syncBelow'), backflowAbove: op('backflowAbove'),
  colorChanged: op('colorChanged'), critActive: op('critActive'),
  // 値の変化
  addBase: op('addBase'), baseMul: op('baseMul'), addMult: op('addMult'), mulMult: op('mulMult'),
  metaMul: op('metaMul'), retrigger: op('retrigger'), myelinToBase: op('myelinToBase'), addMyelin: op('addMyelin'),
  // 時間・ゲージなど（ターン開始時に読む）
  addFireTime: op('addFireTime'), addPulseTime: op('addPulseTime'), addChainBonus: op('addChainBonus'),
  addGauge: op('addGauge'), spineEcho: op('spineEcho'),
  // 部品で書けない効果：fx.hook('ON_FIRE_END', (ctx, src) => {...})
  hook: op('hook'),
};

export function resolveValue(v, scale = 1) {
  if (typeof v !== 'string') return v;
  const m = v.replace(/\s/g, '').match(/^(?:(-?[\d.]+)([+\-*]))?\$(?:([+\-*/])(-?[\d.]+))?$/);
  if (!m) return NaN;
  let x = scale;
  if (m[2]) { const a = +m[1]; x = m[2] === '+' ? a + x : m[2] === '-' ? a - x : a * x; }
  if (m[4] !== undefined) { const b = +m[4]; x = m[3] === '+' ? x + b : m[3] === '-' ? x - b : m[3] === '*' ? x * b : x / b; }
  return x;
}

export function checkFx(e, err) {
  if (typeof e === 'function') return;
  if (Array.isArray(e)) { e.forEach(x => checkFx(x, err)); return; }
  if (!e || typeof e !== 'object' || typeof e.fx !== 'string') { err('effect が fx の部品で書かれていない'); return; }
  if (!FX_OPS.has(e.fx)) err(`不明な効果の部品 "${e.fx}"`);
  if (e.fx === 'hook' && !HOOKS.includes(e.args?.[0])) err(`不明なフック "${e.args?.[0]}"`);
  for (const a of e.args || []) {
    if (typeof a === 'string' && a.includes('$') && Number.isNaN(resolveValue(a, 1))) err(`数値 "${a}" が読めない`);
    if (Array.isArray(a)) a.forEach(x => x && typeof x === 'object' && checkFx(x, err));
    else if (a && typeof a === 'object' && 'fx' in a) checkFx(a, err);
  }
}

// 条件の判定。sc: { chains, chain?, node?, sync, backflow, crit }
export function testCond(c, sc) {
  if (!c) return true;
  if (Array.isArray(c)) return c.every(x => testCond(x, sc));
  const a = c.args || [], chs = sc.chains || [];
  const spineN = ch => ch.cells.filter(n => n.spine).length;
  switch (c.fx) {
    case 'chainsAtLeast': return chs.length >= a[0];
    case 'lenAtLeast': return sc.chain ? sc.chain.cells.length >= a[0] : chs.some(ch => ch.cells.length >= a[0]);
    case 'colorIs': return sc.node ? sc.node.color === a[0] : sc.chain ? sc.chain.color === a[0] : chs.some(ch => ch.color === a[0]);
    case 'onSpine': if (sc.node) return !!sc.node.spine; return sc.chain ? spineN(sc.chain) >= (a[0] ?? 1) : chs.some(ch => spineN(ch) >= (a[0] ?? 1));
    case 'hasCMP': if (sc.node) return sc.node.cmp > 0; return (sc.chain ? [sc.chain] : chs).some(ch => ch.cells.some(n => n.cmp > 0));
    case 'syncBelow': return sc.sync <= a[0];
    case 'backflowAbove': return sc.backflow >= a[0];
    case 'colorChanged': return !!sc.chain && sc.chain.prevColor != null && sc.chain.prevColor !== sc.chain.color;
    case 'critActive': return !!sc.crit;
    default: return false;
  }
}

// 効果を辿って、値の変化を列挙する。pass: 'node'（ノードの値）/ 'turn'（それ以外）
// sources: [{ id, name, effect, scale }]
export function collectEffects(sources, sc, pass) {
  const out = [];
  const walk = (e, s, src) => {
    if (Array.isArray(e)) { e.forEach(x => walk(x, s, src)); return; }
    if (!e || typeof e !== 'object' || COND.has(e.fx) || e.fx === 'hook') return;
    const a = e.args || [], rest = (s2, from = 1) => a.slice(from).forEach(x => walk(x, s2, src));
    switch (e.fx) {
      case 'when': if (testCond(a[0], { ...s, node: null })) rest(s); return;
      case 'perChain':
        if (s.chain) { if (testCond(a[0], { ...s, node: null })) rest(s); }
        else for (const ch of s.chains || []) { const s2 = { ...s, chain: ch }; if (testCond(a[0], s2)) rest(s2); }
        return;
      case 'perNode': if (pass === 'node' && s.node && testCond(a[0], s)) rest({ ...s, inNode: true }); return;
      case 'perColorKind': {
        if (pass === 'node') return;
        const k = new Set((s.chains || []).map(ch => ch.color)).size;
        for (let i = 0; i < k; i++) rest(s, 0);
        return;
      }
      default:
        if ((pass === 'node') !== !!s.inNode) return;
        out.push({ op: e.fx, v: resolveValue(a[0], src.scale ?? 1), args: a, src, chain: s.chain ?? null, node: s.node ?? null });
    }
  };
  for (const src of sources) walk(src.effect, sc, src);
  return out;
}

// fx.hook(name, fn) を持つ効果を呼ぶ
export function callHooks(sources, name, ctx) {
  const visit = (e, src) => {
    if (Array.isArray(e)) { e.forEach(x => visit(x, src)); return; }
    if (typeof e === 'function') return;
    if (e?.fx === 'hook' && e.args[0] === name && typeof e.args[1] === 'function') e.args[1](ctx, src);
  };
  for (const src of sources) visit(src.effect, src);
}

export const HOOKS = [
  'ON_RUN_START', 'ON_FIRE_START', 'ON_CHAIN_COMMIT', 'ON_NODE_EVAL', 'ON_SPINE_PASS',
  'ON_MERGE_CREATED', 'ON_WEAKPOINT_BREAK', 'ON_FIRE_END', 'ON_ENEMY_HIT', 'ON_FLOOR_CLEAR',
];

// ---- イベントと条件判定 ----
export const EVENTS = [
  'GAME_START', 'THAW', 'RUN_START', 'ROUTE_ENTER', 'FLOOR_CLEAR', 'EXTRACT',
  'LOST', 'PRESERVE', 'MODE_CLEAR', 'DEPTH_REACHED', 'RECORD',
];

export function createEvents() {
  const subs = new Map();
  return {
    on(ev, fn) { if (!subs.has(ev)) subs.set(ev, new Set()); subs.get(ev).add(fn); return () => subs.get(ev).delete(fn); },
    emit(ev, payload = {}) { for (const fn of subs.get(ev) ?? []) fn({ event: ev, ...payload }); },
  };
}

// when 条件の判定。ctx: { event, mode, floor, specimen, lineage, flags:Set, fragments:Set }
export function matchWhen(when, ctx, rng) {
  if (!when) return true;
  if (when.event && when.event !== ctx.event) return false;
  if (when.mode && when.mode !== ctx.mode) return false;
  if (when.floor != null && when.floor !== ctx.floor) return false;
  if (when.floorAtLeast != null && !(ctx.floor >= when.floorAtLeast)) return false;
  if (when.specimenAtLeast != null && !(ctx.specimen >= when.specimenAtLeast)) return false;
  if (when.lineage && when.lineage !== ctx.lineage) return false;
  if (when.flag && !ctx.flags?.has(when.flag)) return false;
  if (when.notFlag && ctx.flags?.has(when.notFlag)) return false;
  if (when.fragment && !ctx.fragments?.has(when.fragment)) return false;
  if (when.chance != null && !(rng && rng.next() < when.chance)) return false;
  return true;
}

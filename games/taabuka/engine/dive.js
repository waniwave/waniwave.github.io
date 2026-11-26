// 1回の潜行（仕様書 第4章）：階の生成、襖、部屋の中身、気配、追跡者、踊り場、帰路の番人、昇降機、報酬、商い、湯、謎
//
// 潜行の状態 D は JSON にできる（Big は Big.revive で戻す）。画面は D を読んで、ここの関数で動かすだけ。
// 乱数は潜行シードから用途ごとの子乱数（map / battle / reward / shop / event / chase）を
// 「シード＋用途＋階＋部屋」で作る。どの襖を選んでも、他の部屋や後の階の中身はずれない。
//
// 部屋の番号：列r・左からc番目＝r×10＋c、寄り道＝50＋列、層主＝90、帰路の番人＝91、
//             非常口＝60＋列、追跡者＝割り込まれた部屋＋100

import { withEpithets } from './epithet.js';
import { Big, ZERO } from './big.js';
import { Rng } from './rng.js';
import { rollRarity, rollAffixes, rarIndex, floorRarity, rarOf } from './rarity.js';
import { createBattle, openBattle, depthMods, makeEnemy, useItem as battleUseItem, saveBattle, loadBattle } from './battle.js';
import { makeE, testCond, runDo } from './vocab/effect.js';

export const ROOM = { side: 50, exit: 60, boss: 90, warden: 91, chase: 100, item: 99 };
const BATTLE_DOORS = { 戦い: '通常', 精鋭: '精鋭', 層主: '層主' };

// ───────────────────────── 層と数値表 ─────────────────────────

/** 層を浅い順に */
export function layerList(content, dg = 'honko') {
  return Object.values(content.layers || {}).filter((L) => Array.isArray(L.floors) && (L.dungeon ?? 'honko') === (dg || 'honko')).sort((a, b) => a.floors[0] - b.floors[0]);
}
/** その階の層（無ければ null） */
export function layerAt(content, floor, dg = 'honko') {
  return layerList(content, dg).find((L) => floor >= L.floors[0] && floor <= L.floors[1]) ?? null;
}
/** ワープできる階（2層め以降の各層の入口。底は除く） */
export function warpFloors(content, dg = 'honko') { return layerList(content, dg).slice(1).filter((L) => L.floors[1] > L.floors[0]).map((L) => L.floors[0]); }
/** 敵の強さに使う階（穴ごとに power 階ぶん強い） */
export function powerFloor(base, D) { return D.floor + (base.content.dungeons?.[D.dungeon]?.power ?? 0); }
/** 層の番号（1から） */
export function layerNo(content, L) { return layerList(content, L?.dungeon).indexOf(L) + 1; }
/** 層の最後の階か（層主戦がある） */
export function isBossFloor(content, floor, dg = 'honko') { const L = layerAt(content, floor, dg); return !!L && bossFloorOf(L, floor); }
/** その層でその階が層主の階か（さらに深くは bossEvery 階ごと） */
export function bossFloorOf(L, floor) { return L.bossEvery ? (floor - L.floors[0] + 1) % L.bossEvery === 0 : floor === L.floors[1]; }

/** 層の敵の組・精鋭・層主（mix の層は全ての層から混ぜる） */
export function layerPools(content, L) {
  if (!L.mix) return { groups: L.groups || [], elites: L.elites || [], bosses: L.bosses || [] };
  const others = layerList(content, L?.dungeon).filter((x) => !x.mix && !x.onlyBoss);
  return {
    groups: others.flatMap((x) => x.groups || []),
    elites: others.flatMap((x) => x.elites || []),
    // 底などの mix の層で bosses を書いてあれば、その主を多めに混ぜる
    bosses: [...(L.bosses || []), ...(L.bosses || []), ...others.flatMap((x) => x.bosses || [])],
  };
}

function econ(base) { return base.balance.economy; }
/** 深度の補正に、縛り潜行の決まり（D.xmods）を重ねる（Mul は掛け、true はどちらか） */
function dmods(base, D) {
  const m = { ...depthMods(base.balance, D.depth || 0) };
  for (const [k, v] of Object.entries(D.xmods || {})) {
    if (k.endsWith('Mul')) m[k] = (m[k] || 1) * v;
    else if (typeof v === 'boolean') m[k] = m[k] || v;
  }
  return m;
}
function nextUid(D, p) { D.uidSeq += 1; return `${p}${D.seed}_${D.uidSeq}`; }
function log(D, entry) { D.log.push({ floor: D.floor, ...entry }); if (D.log.length > 400) D.log.splice(0, D.log.length - 400); }

/** 拾える物の範囲（既定：最初から解放のセット・宿泊客の専用セット・「仮」の札） */
export function defaultPool(content, guest) {
  const g = guest ? content.guests?.[guest] : null;
  const ok = (set) => (g && set === g.set) || !!content.sets?.[set]?.unlock?.start;
  const ids = (bucket) => Object.values(content[bucket] || {}).filter((d) => ok(d.set)).map((d) => d.id);
  return { cards: ids('cards'), regulars: ids('regulars'), relics: ids('relics'), items: ids('items') };
}

// ───────────────────────── 潜行の開始 ─────────────────────────

/**
 * 潜行を作る
 * @param {{balance:object, content:object}} base
 * @param {{seed:string|number, depth?:number, guest:string, deck:object[], seats?:object[], relics?:object[],
 *          items?:object[], charm?:object[], pool?:object, hp?:number}} o
 */
export function createDive(base, o) {
  const { balance, content } = base;
  const g = content.guests?.[o.guest];
  if (!g) throw new Error(`宿泊客の定義がない「${o.guest}」`);
  const dm = depthMods(balance, o.depth || 0);
  const maxHp = Math.max(1, Math.round((o.hp ?? g.hp) * (1 + (dm.maxHp || 0))));
  const banzuke = {};
  for (const cat of balance.tiers.categories) banzuke[cat] = balance.tiers.banzukeStart;
  const E = balance.economy;
  const D = {
    v: 1, seed: String(o.seed), depth: o.depth || 0, guest: o.guest, floor: 0, layer: null, dungeon: o.dungeon || 'honko',
    hp: maxHp, maxHp,
    deck: (o.deck || []).map((x) => ({ ...x })), seats: (o.seats || []).map((x) => ({ ...x })), relics: (o.relics || []).map((x) => ({ ...x })),
    items: (o.items || []).slice(0, balance.hands.play.itemSlots).map((x) => ({ ...x })),
    pouch: [], charm: (o.charm || []).map((x) => ({ ...x })),
    carry: { pouch: o.carry?.pouch ?? E.carry.pouch, charm: Math.min(dm.charmSlotsMax ?? Infinity, Math.max(0, (o.carry?.charm ?? E.carry.charm) + (dm.charmSlots || 0))), ...(o.carry?.maxPlay ? { maxPlay: o.carry.maxPlay } : {}) },
    sudomari: !!o.sudomari, battleState: null,
    zeni: 0, banzuke, handLevels: {}, guestState: { ...(g.state || {}), ...(o.guestState || {}) }, presence: 0, rules: [],
    bosses: {}, map: null, row: 0, floorBanzuke: { ...banzuke },
    phase: 'map', here: null, battle: null, chase: null, reward: null, shop: null, bath: null, event: null, exit: null, landing: null,
    events: [], seenEv: [...(o.seenEvents || [])], flags: { used: {}, godRolled: false, ev: {} }, result: null,
    stats: { battles: 0, rooms: 0, kills: 0, maxV: ZERO, deepest: 0, chases: 0, fled: 0, bosses: [], hands: {}, overkill: {} },
    pool: o.pool ?? defaultPool(content, o.guest), log: [], uidSeq: 0, msg: null,
  };
  if (D.charm.length > D.carry.charm) D.charm.length = D.carry.charm;
  // 縛り潜行（content/shibari.yaml）：全ての戦闘に掛けるルールと、潜行の決まり
  if (o.shibari) {
    const sb = (content.shibari || []).find((x) => x.id === o.shibari);
    if (!sb) throw new Error(`縛り「${o.shibari}」が無い`);
    D.shibari = sb.id;
    D.heldRules = (sb.rule || []).map((r) => (typeof r === 'string' ? { name: r, params: {} } : (() => { const { 名前, ...params } = r; return { name: 名前, params }; })()));
    const dv = sb.dive || {};
    D.xmods = Object.fromEntries(Object.entries(dv).filter(([k]) => ['eliteDoorMul', 'presenceGainMul', 'noEmergencyExit'].includes(k)));
    D.noDoors = dv.noDoors || [];
    if (dv.hp) { D.maxHp = Math.max(1, Math.round(D.maxHp * dv.hp)); D.hp = D.maxHp; }
    if (dv.noSeats) D.seats = [];
    if (dv.noRelic) D.relics = D.relics.filter((r) => !r.guest);
  }
  if (o.maxFloor) D.maxFloor = o.maxFloor;
  // 潜行の始めに選ぶもの（guest.yaml の choose）。選んでいなければ、デッキで一番多いカテゴリ
  for (const ch of [].concat(g.choose || [])) {
    if (D.guestState[ch.key] != null) continue;
    if (ch.type === 'category') {
      const n = {};
      for (const c of D.deck) for (const cat of c.mod?.cat ?? content.cards[c.id]?.cat ?? []) n[cat] = (n[cat] || 0) + 1;
      D.guestState[ch.key] = balance.tiers.categories.reduce((best, cat) => ((n[cat] || 0) > (n[best] || 0) ? cat : best), balance.tiers.categories[0]);
    }
  }
  // ワープ：到達した層の入口から始める（content の層の最初の階だけ）
  // 穴ごとの決まりごと（床上＝番付が最初から逆さ）
  const dgDef = content.dungeons?.[D.dungeon];
  if (dgDef?.rules?.length) D.heldRules = [...(D.heldRules || []), ...dgDef.rules.map(parseRule)];
  const start = o.startFloor && warpFloors(content, D.dungeon).includes(o.startFloor) ? o.startFloor : 1;
  if (start > 1) D.warped = start;
  enterFloor(base, D, start);
  return D;
}

export function saveDive(D) { return JSON.stringify(D); }
export function loadDive(s) { return JSON.parse(s, Big.revive); }

// ───────────────────────── 階の生成 ─────────────────────────

const parseRule = (r) => (typeof r === 'string' ? { name: r, params: {} } : (() => { const { 名前, ...params } = r; return { name: 名前, params }; })());
/** 底の呪いを1つ足す（重ねられないものは1回まで）。週替わり挑戦の始めにも使う */
export function addCurse(base, D, L, floor, salt = 'curse') {
  const have = new Set((D.curses || []).map((c) => c.id));
  const cand = L.curses.filter((c) => c.stack || !have.has(c.id));
  if (!cand.length) return null;
  const c = Rng.child(D.seed, salt, floor).pick(cand);
  (D.curses ||= []).push({ id: c.id, name: c.name, text: c.text, floor });
  D.heldRules = [...(D.heldRules || []), ...(c.rule || []).map(parseRule)];
  log(D, { t: 'curse', id: c.id, name: c.name, text: c.text, floor });
  return c;
}

function enterFloor(base, D, floor) {
  const { content } = base;
  const L = layerAt(content, floor, D.dungeon);
  if (!L) throw new Error(`${floor}階の層が無い`);
  if (D.layer !== L.id) {
    D.layer = L.id;
    D.presence = 0;
    if (!D.bosses[L.id]) D.bosses[L.id] = bossOf(base, D, L, floor);
    log(D, { t: 'layer', layer: L.id, boss: D.bosses[L.id] ?? null });
  }
  D.floor = floor;
  D.row = 0;
  // 底の呪い（層の curses）：curseEvery 階ごとに1つずつ積み重なる。全ての戦闘に掛かる
  if (L.curses?.length && L.curseEvery && (floor - L.floors[0]) % L.curseEvery === 0 && !(D.curses || []).some((c) => c.floor === floor)) addCurse(base, D, L, floor);
  D.map = genFloor(base, D, floor);
  D.floorBanzuke = { ...D.banzuke };
  D.stats.deepest = Math.max(D.stats.deepest, floor);
  D.phase = 'map';
  D.here = null;
  log(D, { t: 'floor', floor });
  diveSignal(base, D, '階に入った時');
}

/**
 * 階の襖を作る（選んだ経路に左右されない。シード・階・深度・拾える範囲だけで決まる）
 * @returns {{floor:number, rows:object[][], side:object|null, exit:object|null, layer:string, revealed:boolean}}
 */
export function genFloor(base, D, floor) {
  const { balance, content } = base;
  const L = layerAt(content, floor, D.dungeon);
  if (!L) return null;
  const M = balance.curve.map;
  const dm = dmods(base, D);
  const rng = Rng.child(D.seed, 'map', floor, 0);
  const no = layerNo(content, L);
  const pools = layerPools(content, L);
  const rows = [];
  let shopUsed = false;
  (L.onlyBoss ? [] : M.rows).forEach(([lo, hi], r) => {
    const n = rng.int(lo, hi);
    const row = [];
    for (let c = 0; c < n; c++) {
      const w = {};
      for (const [k, v] of Object.entries(L.doors || {})) {
        let x = v;
        if (k === '精鋭') x *= dm.eliteDoorMul || 1;
        if ((D.noDoors || []).includes(k)) x = 0;
        if (k !== '戦い' && row.some((d) => d.kind === k)) x = 0;
        if (k === '商い' && shopUsed) x = 0;
        if (k === '精鋭' && r === 0 && (M.noEliteFirstRow || []).includes(floor)) x = 0;
        if (k === '精鋭' && !pools.elites.length) x = 0;
        if (k === '謎' && !eventsOf(content, no, L).length) x = 0;
        w[k] = x;
      }
      const kind = rng.weighted(w) ?? '戦い';
      if (kind === '商い') shopUsed = true;
      const door = { room: r * 10 + c, row: r, kind, hidden: false, glow: null };
      if (kind === '戦い') door.enemies = (rng.pick(pools.groups) || []).slice();
      if (kind === '精鋭') door.enemies = [rng.pick(pools.elites)];
      row.push(door);
    }
    if (no >= M.hiddenFromLayer && row.length) row[rng.int(0, row.length - 1)].hidden = true;
    rows.push(row);
  });
  let side = null;
  if (rows.length && rng.chance(M.sideRoom.chance)) {
    const r = rng.int(0, rows.length - 1);
    side = { room: ROOM.side + r, row: r, kind: '寄り道', side: true, hidden: false, glow: null };
  }
  let exit = null;
  if (rows.length && rng.chance(M.emergencyExit.chance) && !dm.noEmergencyExit) {
    const r = rng.int(0, rows.length - 1);
    exit = { room: ROOM.exit + r, row: r, kind: '非常口', side: true, hidden: false };
  }
  // 確定演出の光：宝・精鋭・寄り道は中身の最高格の色。紫（極）以上は一定の確率で光らない
  const grades = econ(base).grades;
  for (const d of [...rows.flat(), side].filter(Boolean)) {
    if (!['宝', '精鋭', '寄り道'].includes(d.kind)) continue;
    const loot = baseLoot(base, D, floor, d);
    const top = loot.cards.reduce((best, c) => Math.max(best, grades.indexOf(content.cards[c.id]?.grade)), -1);
    if (top < 0) continue;
    const g = grades[top];
    if (grades.indexOf(g) >= grades.indexOf(M.glowHide.fromGrade) && rng.chance(M.glowHide.chance)) continue;
    d.glow = g;
  }
  const boss = L.mix ? bossOf(base, D, L, floor) : (D.bosses[L.id] ?? bossOf(base, D, L, floor));
  if (bossFloorOf(L, floor) && boss) rows.push([{ room: ROOM.boss, row: rows.length, kind: '層主', hidden: false, glow: null, enemies: [boss] }]);
  return { floor, layer: L.id, rows, side, exit, revealed: false, visited: [] };
}

/** 層主（層の2種から潜行ごとに1種。シードで決まる） */
function bossOf(base, D, L, floor) {
  const list = layerPools(base.content, L).bosses;
  if (!list.length) return null;
  // ふつうの層は層に入った時点で予告（層の最初の階で決める）。さらに深くは主の階ごとに
  return Rng.child(D.seed, 'map', L.mix ? floor : L.floors[0], ROOM.boss).pick(list);
}

// 謎の候補。dungeon（その穴だけ）・guest（その宿泊客だけ）・after（前に見た謎の続き。宿をまたいで覚える）・
// once（一度見たら出ない）・needFlag（この潜行の前の謎で立てた旗）で絞る。特別な謎は重みを上げる
function eventsOf(content, no, L, D) {
  const seen = new Set([...(D?.seenEv || []), ...(D?.events || [])]);
  const flags = D?.flags?.ev || {};
  return Object.values(content.events || {}).filter((e) => {
    if (D?.events?.includes(e.id)) return false;
    const special = e.dungeon || e.guest || e.needFlag;
    if (e.dungeon && !e.dungeon.includes(D?.dungeon ?? 'honko')) return false;
    if (e.guest && !e.guest.includes(D?.guest)) return false;
    if (e.after && !seen.has(e.after)) return false;
    if (e.once && (D?.seenEv || []).includes(e.id)) return false;
    if (e.needFlag && !flags[e.needFlag]) return false;
    if (e.minFloor && (D?.floor ?? 0) < e.minFloor) return false;
    if (L?.mix || L?.onlyBoss) return true;
    if (special && !e.layer?.length) return true;
    return (e.layer || []).includes(no);
  });
}
function eventWeight(e) { return e.needFlag ? 6 : e.guest ? 4 : e.dungeon ? 3 : 1; }

// ───────────────────────── 拾う物 ─────────────────────────

/** 拾う札の格の重み（層ごと＋深度の補正） */
export function gradeWeights(base, D, floor = D.floor) {
  const { content } = base;
  const E = econ(base);
  const L = layerAt(content, floor, D.dungeon);
  const no = L ? layerNo(content, L) : 99;
  const w = { ...(E.gradeWeights[`layer${no}`] || E.gradeWeights.deep) };
  const d = D.depth || 0;
  for (const g of E.grades) w[g] = Math.max(0, (w[g] || 0) * (1 + (g === '並' ? E.gradeDepth.並 : E.gradeDepth.other) * d));
  return w;
}

function cardOk(base, D, def, floor) {
  if (!def || def.origin === 'pawn') return false;
  if (['expiry', 'cursed', 'bet'].includes(def.origin)) {
    const L = layerAt(base.content, floor, D.dungeon);
    if (!L || layerNo(base.content, L) < 2) return false;
    if (def.origin === 'cursed' && ['極', '神'].includes(def.grade) && !dmods(base, D).cursedHighGrades) return false;
  }
  return true;
}

/** おふざけ枠の確率：どの階でも極まれ。底（呪いの層）ほど、呪いが多いほど、週替わりで上がる（economy.joke） */
export function jokeChance(base, D, floor = D.floor) {
  const J = base.balance.economy.joke;
  if (!J) return 0;
  const L = layerAt(base.content, floor, D.dungeon);
  let p = J.base;
  if (L?.curses?.length) p = J.abyss + J.perCurse * (D.curses?.length || 0);
  if (D.weekly) p += J.weekly;
  return Math.min(J.max, p);
}

/** レアリティを決めて札を1枚引く（個体のIDはまだ付けない）。刻印もここで付く */
function rollCard(base, D, rng, floor, o = {}) {
  const { content, balance } = base;
  // おふざけ枠（ふだんの乱数とは別の流れで引くので、ほかの出方は変わらない）
  const jokes = content.jokeIds || [];
  if (jokes.length && !o.noJoke) {
    D.jokeN = (D.jokeN || 0) + 1;
    const jr = Rng.child(D.seed, 'joke', D.jokeN);
    if (jr.chance(jokeChance(base, D, floor))) {
      const id = jr.pick(jokes);
      const def = content.cards[id];
      return { id, origin: 'orig', rar: floorRarity(balance, def) };
    }
  }
  const L = layerAt(content, floor, D.dungeon);
  const no = L ? layerNo(content, L) + (content.dungeons?.[D.dungeon]?.rarityAdd ?? 0) : 99;
  const minR = o.minGrade ? balance.rarity.gradeFloor[o.minGrade] : o.minRar;
  let r = o.rar ?? rollRarity(balance, rng, no, D.depth || 0, { min: minR, up: o.gradeUp || 0 });
  if (o.maxRar && rarIndex(balance, r) > rarIndex(balance, o.maxRar)) r = o.maxRar;
  const id = pickOfRarity(base, D, rng, r, floor);
  if (!id) return null;
  const ed = rollEdition(base, D, rng);
  const def = content.cards[id];
  const ins = rollAffixes(base, rng, r, def);
  return { id, origin: def.origin ?? 'orig', rar: r, ...(ins.length ? { ins } : {}), ...(ed ? { ed } : {}) };
}

/** レアリティ r で出せる札（最低レアリティが r 以下）から1枚。最低レアリティが高い札ほど出やすい */
function pickOfRarity(base, D, rng, r, floor) {
  const { content, balance } = base;
  const ri = rarIndex(balance, r);
  const pool = D.pool.cards.map((id) => content.cards[id]).filter((d) => cardOk(base, D, d, floor) && rarIndex(balance, floorRarity(balance, d)) <= ri);
  if (!pool.length) return null;
  // テーマの穴：その穴のカテゴリの札が出やすい（economy.dungeon.catBias 倍）
  const cats = content.dungeons?.[D.dungeon]?.cats || [];
  const bias = (d) => (cats.length && (d.cat || []).some((c) => cats.includes(c)) ? (econ(base).inn?.dungeon?.catBias ?? 1) : 1);
  return rng.weighted(pool.map((d) => [d.id, (1 + rarIndex(balance, floorRarity(balance, d))) * bias(d)])) ?? pool[0].id;
}

function rollEdition(base, D, rng) {
  const E = econ(base);
  const k = 1 + E.editionDepth * (D.depth || 0);
  for (const [ed, p] of Object.entries(E.editionChance)) if (rng.chance(p * k)) return ed;
  return null;
}

function rollSouvenir(base, D, rng, floor, quality) {
  const { content } = base;
  const L = layerAt(content, floor, D.dungeon);
  const no = L ? layerNo(content, L) + (content.dungeons?.[D.dungeon]?.rarityAdd ?? 0) : 99;
  const dg = D.dungeon || 'honko';
  // 穴の専用お土産（dungeons）はその穴でだけ。それ以外のお土産は層の番号で
  let list = Object.values(content.souvenirs || {}).filter((s) => !s.event && (s.dungeons ? s.dungeons.includes(dg) && (!s.layers || (no >= s.layers[0] && no <= s.layers[1])) : no >= (s.layers?.[0] ?? 1) && no <= (s.layers?.[1] ?? 99)));
  if (!list.length) return null;
  if (quality) {
    const rate = econ(base).souvenirQuality[quality] ?? 1;
    list = list.slice().sort((a, b) => b.sell - a.sell).slice(0, Math.max(1, Math.ceil(list.length * rate)));
  }
  return rng.weighted(list.map((s) => [s.id, s.rate ?? 1])) ?? null;
}

function rollItem(base, D, rng) {
  const L = layerAt(base.content, D.floor, D.dungeon);
  const no = L ? layerNo(base.content, L) : 1;
  const inPool = (d) => !D.pool?.items || D.pool.items.includes(d.id);
  const list = Object.values(base.content.items || {}).filter((d) => !d.noDrop && no >= (d.fromLayer ?? 1) && inPool(d));
  const d = rng.pick(list);
  if (d && d.once === '潜行' && D.flags.used[d.id]) return null;
  return d ? { id: d.id, kind: d.kind, ...(d.hand ? { hand: d.hand } : {}) } : null;
}

function rollFrom(rng, ids, n, exclude = []) {
  // 先に全部を混ぜてから除く（持ち物で乱数の使い方がずれないように）
  return rng.shuffle(ids).filter((id) => !exclude.includes(id)).slice(0, n);
}

/** 部屋の基本の中身（宝・寄り道・戦闘の札の候補）。光と実際の中身はこれで一致する */
function baseLoot(base, D, floor, door) {
  const E = econ(base);
  const rng = Rng.child(D.seed, 'reward', floor, door.room);
  const out = { cards: [], souvenirs: [], items: [], regulars: [], relics: [] };
  if (door.kind === '宝' || door.kind === '寄り道') {
    const T = E.treasure;
    const gradeUp = door.kind === '寄り道' ? base.balance.curve.map.sideRoom.gradeUp : 0;
    for (let i = 0; i < T.cards; i++) { const c = rollCard(base, D, rng, floor, { gradeUp }); if (c) out.cards.push(c); }
    if (rng.chance(T.souvenir)) { const s = rollSouvenir(base, D, rng, floor); if (s) out.souvenirs.push(s); }
    if (rng.chance(T.item)) { const it = rollItem(base, D, rng); if (it) out.items.push(it); }
    return out;
  }
  const kind = BATTLE_DOORS[door.kind] ?? door.kind;
  const R = E.battleRewards[kind];
  if (!R) return out;
  for (let i = 0; i < (R.cards || 0); i++) { const c = rollCard(base, D, rng, floor, { minGrade: R.minGrade }); if (c) out.cards.push(c); }
  if (R.regulars) out.regulars = rollFrom(rng, D.pool.regulars, R.regulars, D.seats.map((r) => r.id));
  if (R.relics) out.relics = rollFrom(rng, D.pool.relics, R.relics, D.relics.map((r) => r.id));
  if (rng.chance(R.souvenir || 0)) { const s = rollSouvenir(base, D, rng, floor, R.souvenirQuality); if (s) out.souvenirs.push(s); }
  return out;
}

// ───────────────────────── 値段・売値・懐 ─────────────────────────

/** 札の個体のレアリティによる値打ちの倍率（その札の最低レアリティを1とする） */
export function rarValueMul(base, x, def) {
  const V = base.balance.rarity.value;
  const r = rarOf(base.balance, x, def);
  return (V[r] ?? 1) / (V[floorRarity(base.balance, def)] ?? 1);
}

/** 1つの売値（札・常連客・置物・お品書き・お土産） */
export function sellValue(base, x) {
  const { content } = base;
  const E = econ(base);
  if (x.type === 'souvenir') return content.souvenirs?.[x.id]?.sell ?? 0;
  if (x.type === 'item') return E.sell.item ?? 0;
  const def = content.cards?.[x.id] ?? content.regulars?.[x.id] ?? content.relics?.[x.id];
  let v = E.sell.card[def?.grade] ?? 0;
  if (x.type === 'card' || x.type == null) v *= rarValueMul(base, x, def);
  if (x.ed) v *= E.sell.edition[x.ed] ?? 1;
  if (x.type === 'regular') v *= E.sell.regularMul;
  return Math.round(v);
}

/** 懐の重さ（品数。お土産は重さ2のものがある） */
export function pouchWeight(base, D) {
  return D.pouch.reduce((s, x) => s + (x.type === 'souvenir' ? base.content.souvenirs?.[x.id]?.weight ?? 1 : 1), 0);
}
/** 懐の総額（売値の合計＋宿銭） */
export function pouchValue(base, D) {
  return D.pouch.reduce((s, x) => s + sellValue(base, x), 0) + D.zeni;
}
/** 失うかもしれない総額（お守り袋を除く持ち物全部の売値＋宿銭） */
export function atRisk(base, D) {
  const all = [...D.deck.map((c) => ({ ...c, type: 'card' })), ...D.seats.map((r) => ({ ...r, type: 'regular' })),
    ...D.relics.map((r) => ({ ...r, type: 'relic' })), ...D.items.map((i) => ({ ...i, type: 'item' })), ...D.pouch];
  return all.reduce((s, x) => s + sellValue(base, x), 0) + D.zeni;
}

function pouchRoom(base, D, x) {
  const w = x.type === 'souvenir' ? base.content.souvenirs?.[x.id]?.weight ?? 1 : 1;
  return pouchWeight(base, D) + w <= D.carry.pouch;
}

function price(base, D, x) {
  const E = econ(base);
  const k = (1 + E.price.perFloor * D.floor) * (1 + (dmods(base, D).shopPrice || 0));
  let p;
  if (x.type === 'card') p = (E.price.card[base.content.cards[x.id]?.grade] ?? 0) * rarValueMul(base, x, base.content.cards[x.id]);
  else if (x.type === 'regular') p = (E.price.card[base.content.regulars[x.id]?.grade] ?? 0) * E.price.regularMul;
  else if (x.type === 'item') p = E.price[x.kind] ?? 0;
  else if (x.type === 'remove') p = E.price.remove;
  return Math.round(p * k);
}

// ───────────────────────── 襖を開ける ─────────────────────────

/** 今押せる襖（今の列＋その列の横の寄り道・非常口） */
export function openDoors(D) {
  if (D.phase !== 'map' || !D.map) return [];
  const row = D.map.rows[D.row] || [];
  const extra = [D.map.side, D.map.exit].filter((x) => x && x.row === D.row && !D.map.visited.includes(x.room));
  return [...row, ...extra];
}

/** 襖が「？」に見えるか */
export function isHidden(D, door) { return !!door.hidden && !D.map.revealed; }

function presenceGain(base, D, n) {
  const add = Math.ceil(n * (dmods(base, D).presenceGainMul || 1));
  D.presence += add;
  return add;
}

/** 追跡者が割り込むか（気配と深度で。乱数は chase） */
export function stalkerChance(base, D) {
  const steps = base.balance.curve.presence.stalker || [];
  let p = 0;
  for (const s of steps) if (D.presence >= s.from) p = s.chance;
  const dm = dmods(base, D);
  if (p > 0 && p < 1 && dm.stalkerChance) p = Math.max(p, dm.stalkerChance);
  return p;
}

/**
 * 襖を開ける
 * @param {number} room 部屋の番号
 */
export function enterDoor(base, D, room) {
  check(D.phase === 'map', 'いまは襖を選べない');
  const door = openDoors(D).find((d) => d.room === room);
  check(!!door, 'その襖は開けられない');
  D.map.visited.push(room);
  D.stats.rooms += 1;
  D.msg = null;
  if (door.kind === '非常口') {
    D.here = door;
    D.phase = 'exit';
    return D;
  }
  const add = presenceGain(base, D, door.kind === '寄り道' ? base.balance.curve.presence.sideRoom : base.balance.curve.presence.enterRoom);
  log(D, { t: 'enter', room, kind: door.kind, presence: D.presence, add });
  D.here = door;
  diveSignal(base, D, '部屋に入った時');
  // 追跡者の割り込み（層主の部屋は除く）
  const L = layerAt(base.content, D.floor, D.dungeon);
  if (door.kind !== '層主' && L?.stalker) {
    const p = stalkerChance(base, D);
    if (p > 0 && Rng.child(D.seed, 'chase', D.floor, room).chance(p)) {
      D.phase = 'chase';
      D.chase = { room: room + ROOM.chase, enemy: L.stalker, door };
      log(D, { t: 'chase', room });
      return D;
    }
  }
  return openRoom(base, D, door);
}

function openRoom(base, D, door) {
  const { content } = base;
  const L = layerAt(content, D.floor, D.dungeon);
  switch (door.kind) {
    case '戦い': case '精鋭': case '層主':
      D.phase = 'battle';
      D.battle = { room: door.room, kind: BATTLE_DOORS[door.kind], enemies: door.enemies.slice() };
      return D;
    case '宝': case '寄り道': {
      const loot = baseLoot(base, D, D.floor, door);
      makeReward(base, D, { kind: door.kind, room: door.room, zeni: 0, loot });
      return D;
    }
    case '商い':
      D.shop = genShop(base, D, door.room);
      D.phase = 'shop';
      return D;
    case '湯':
      D.bath = { done: false, swap: true };
      D.phase = 'bath';
      return D;
    case '謎': {
      const no = layerNo(content, L);
      const list = eventsOf(content, no, L, D);
      const pickId = Rng.child(D.seed, 'event', D.floor, door.room).weighted(list.map((e) => [e.id, eventWeight(e)]));
      const ev = list.find((e) => e.id === pickId);
      if (!ev) { D.msg = '誰もいなかった'; return leaveRoom(base, D); }
      D.events.push(ev.id);
      D.event = { id: ev.id, choice: null, result: null };
      D.phase = 'event';
      return D;
    }
    default:
      throw new Error(`知らない襖「${door.kind}」`);
  }
}

/** 部屋を出る（次の列へ。寄り道なら同じ列のまま。最後の列の後は踊り場） */
export function leaveRoom(base, D) {
  const door = D.here;
  D.battle = null; D.reward = null; D.shop = null; D.bath = null; D.event = null; D.exit = null;
  D.here = null;
  if (D.result) { D.phase = 'end'; return D; }
  if (door && !door.side) D.row = door.row + 1;
  if (door?.kind === '層主') return toLanding(base, D, true);
  if (D.row >= D.map.rows.length) return toLanding(base, D, false);
  D.phase = 'map';
  return D;
}

// ───────────────────────── 追跡者 ─────────────────────────

/** 追跡者から逃げる代償（懐の品を1つ。懐が空なら宿銭の半分） */
export function fleeCost(base, D) {
  if (D.pouch.length) return { kind: 'pouch', text: '懐の品を1つ（乱数）' };
  return { kind: 'zeni', amount: Math.floor(D.zeni * econ(base).escape.zeniRate), text: `宿銭の半分（${Math.floor(D.zeni * econ(base).escape.zeniRate)}）` };
}

/** 割り込んだ追跡者（画面に出す主張と攻撃） */
export function chaseInfo(base, D) {
  check(D.phase === 'chase', '追跡者はいない');
  const def = base.content.enemies[D.chase.enemy];
  const e = makeEnemy(base.balance, def, { floor: powerFloor(base, D), depth: D.depth, presence: D.presence }, 'c');
  return { name: e.name, line: e.line, claim: e.claim, atk: e.atk };
}

/** 追跡者に答える（'fight' か 'flee'） */
export function answerChase(base, D, how) {
  check(D.phase === 'chase', '追跡者はいない');
  const ch = D.chase;
  if (how === 'fight') {
    D.phase = 'battle';
    D.battle = { room: ch.room, kind: '追跡者', enemies: [ch.enemy], chase: true };
    return D;
  }
  const cost = fleeCost(base, D);
  if (cost.kind === 'pouch') {
    const i = Rng.child(D.seed, 'chase', D.floor, ch.room).int(0, D.pouch.length - 1);
    const lost = D.pouch.splice(i, 1)[0];
    D.msg = `${nameOf(base, lost)}を置いて逃げた`;
    log(D, { t: 'flee', lost: lost.id });
  } else {
    D.zeni -= cost.amount;
    D.msg = `宿銭${cost.amount}を落として逃げた`;
    log(D, { t: 'flee', zeni: cost.amount });
  }
  D.stats.fled += 1;
  D.chase = null;
  return openRoom(base, D, ch.door);
}

// ───────────────────────── 戦闘 ─────────────────────────

/** 戦闘を作るときの材料（createBattle にそのまま渡す） */
/** いまの層の癖（{name, params} か null）。quirk は名前だけでも {name, params} でも書ける */
export function quirkOf(base, D) {
  const q = layerAt(base.content, D.floor, D.dungeon)?.quirk;
  if (!q) return null;
  return typeof q === 'string' ? { name: q, params: {} } : { name: q.name, params: q.params || {} };
}

export function battleOptions(base, D) {
  check(D.phase === 'battle' && D.battle, 'いまは戦闘ではない');
  const bt = D.battle;
  return {
    seed: D.seed, floor: D.floor, powerFloor: powerFloor(base, D), dungeon: D.dungeon, room: bt.room, depth: D.depth, presence: D.presence,
    hp: D.hp, maxHp: D.maxHp, guest: D.guest, guestState: D.guestState,
    deck: D.deck, seats: D.seats, relics: D.relics, items: D.items, rules: D.rules, ...(D.carry?.maxPlay ? { maxPlay: D.carry.maxPlay } : {}),
    banzuke: D.banzuke, handLevels: D.handLevels, banzukeFloorStart: D.floorBanzuke,
    enemies: withEpithets(base, D, bt), weight: bt.kind === '番人' ? pouchWeight(base, D) : 0,
    ...(quirkOf(base, D) ? { quirk: quirkOf(base, D).name, quirkParams: quirkOf(base, D).params } : {}),
    ...(D.heldRules?.length ? { heldRules: D.heldRules } : {}), ...(D.pool?.items ? { itemPool: D.pool.items } : {}), ...(D.xmods ? { xmods: D.xmods } : {}),
  };
}

/** 戦闘を作る（まだ始めない）。env.dive に D を入れて返す */
export function diveBattle(base, D) {
  const resumed = !!D.battleState;
  const B = resumed ? loadBattle(D.battleState) : createBattle(base, battleOptions(base, D));
  const env = openBattle(base, B);
  env.dive = D;
  return { B, env, resumed };
}

/** 戦闘の途中を潜行の状態に書き込む（自動保存の前に呼ぶ） */
export function keepBattle(D, B) { D.battleState = saveBattle(B); }

/** 戦闘でも戦闘外でも、戦闘の場 B から潜行へ書き戻す */
function copyBack(base, D, B) {
  D.hp = Math.max(0, Math.min(D.maxHp, B.hp));
  D.banzuke = { ...B.banzuke };
  D.handLevels = { ...B.handLevels };
  D.guestState = { ...B.guestState };
  D.items = B.items.map((x) => ({ ...x }));
  D.presence = B.presence;
  D.zeni += B.zeni;
  D.rules = B.rules.filter((r) => r.scope === 'dive').map((r) => ({ ...r }));
  for (const id of B.gained?.souvenirs || []) addSouvenir(base, D, id);
  // 札の行方：永続で消えた札、潜行限りの変化、潜行限りで生まれた札、育ち
  const gone = new Set(B.destroyed.map((c) => c.uid));
  D.deck = D.deck.filter((c) => !gone.has(c.uid));
  const all = [...B.inPlay, ...B.hand, ...B.draw, ...B.discard, ...B.exhaust, ...Object.values(B.zones || {}).flat(), ...B.hand.flatMap((c) => c.parts || [])];
  for (const ch of B.cardChanges || []) {
    const ow = D.deck.find((c) => c.uid === ch.uid);
    if (ow) ow.mod = { ...(ow.mod || {}), tier: ch.tier, cat: ch.cat };
  }
  for (const c of all) {
    const ow = D.deck.find((x) => x.uid === c.uid);
    if (ow) { if (c.grow) ow.grow = c.grow; continue; }
    if (c.temp === false && !gone.has(c.uid)) D.deck.push({ uid: nextUid(D, 'c'), id: c.id, origin: c.origin, ...(c.enh ? { enh: c.enh } : {}), ...(c.ed ? { ed: c.ed } : {}), ...(c.seal ? { seal: c.seal } : {}) });
  }
  for (const r of B.seats) { const ow = D.seats.find((x) => x.uid === r.uid); if (ow && r.grow != null) ow.grow = r.grow; }
  // 成長型（grow の「戦闘」「出し」）。「下りた階」は descend、「脱出」は宿（meta.js）で
  if (!B.shell) {
    const plays = B.log.filter((l) => l.t === 'play').length;
    for (const ow of D.seats) {
      const gw = base.content.regulars?.[ow.id]?.grow;
      if (gw?.増える === '戦闘') ow.grow = (ow.grow || 0) + gw.量;
      if (gw?.増える === '出し') ow.grow = (ow.grow || 0) + gw.量 * plays;
    }
  }
  if (B.stats?.maxV && B.stats.maxV.gt(D.stats.maxV)) D.stats.maxV = B.stats.maxV;
  if (!B.shell) for (const [k, n] of Object.entries(B.stats?.hands || {})) D.stats.hands[k] = (D.stats.hands[k] || 0) + n;
}

/**
 * 戦闘が終わったら呼ぶ。勝てば報酬、負ければ未帰還、番人に勝てば脱出
 * @param {object} B 終わった戦闘
 */
export function finishBattle(base, D, B) {
  check(D.phase === 'battle', 'いまは戦闘ではない');
  check(!!B.result, '戦闘がまだ終わっていない');
  copyBack(base, D, B);
  D.battleState = null;
  const bt = D.battle;
  D.stats.battles += 1;
  D.stats.kills += B.enemies.filter((e) => e.dead).length;
  log(D, { t: 'battle', kind: bt.kind, result: B.result, hp: D.hp, overkill: B.overkill?.level ?? null });
  if (B.result === 'lose' || D.hp <= 0) return endDive(base, D, 'lost', 'battle');
  if (B.result === 'escape') return endDive(base, D, 'escaped', 'item');
  if (B.overkill?.level) D.stats.overkill[B.overkill.level] = (D.stats.overkill[B.overkill.level] || 0) + 1;
  if (bt.kind === '層主' && !D.stats.bosses.includes(D.layer)) D.stats.bosses.push(D.layer);
  for (const e of B.enemies) if (e.dead && ['層主', '底の主'].includes(e.kind) && !(D.stats.bossIds ||= []).includes(e.id)) D.stats.bossIds.push(e.id);
  for (const e of B.enemies) if (!(D.stats.met ||= []).includes(e.id)) D.stats.met.push(e.id);
  if (bt.kind === '番人') return endDive(base, D, 'escaped', 'warden');
  // 報酬
  const R = econ(base).battleRewards[bt.kind];
  const k = (1 + base.balance.depth.zeniPerDepth * D.depth) * (B.rewardRate ?? 1);
  const zeni = Math.round((R.zeni.base + R.zeni.perFloor * D.floor) * k);
  const door = bt.chase ? { kind: '追跡者', room: bt.room } : D.here;
  const loot = bt.chase ? baseLoot(base, D, D.floor, { kind: '追跡者', room: bt.room }) : baseLoot(base, D, D.floor, door);
  if ((B.rewardRate ?? 1) < 1) loot.cards = loot.cards.slice(0, Math.max(0, Math.round(loot.cards.length * B.rewardRate)));
  // 過剰論破の上乗せ（別の子乱数で。元の候補はずらさない）
  const ok = B.overkill?.rewards;
  if (ok && loot.cards.length) {
    const rng = Rng.child(D.seed, 'reward', D.floor, bt.room, 'overkill');
    if (ok.gradeUp) loot.cards = loot.cards.map((c) => rollCard(base, D, rng, D.floor, { rar: base.balance.rarity.order[Math.min(base.balance.rarity.order.length - 1, rarIndex(base.balance, c.rar) + ok.gradeUp)] }) || c);
    for (let i = 0; i < (ok.extraCards || 0); i++) { const c = rollCard(base, D, rng, D.floor, { minGrade: R.minGrade }); if (c) loot.cards.push(c); }
    if (ok.godChance && !D.flags.godRolled) {
      D.flags.godRolled = true;
      if (rng.chance(ok.godChance)) { const c = rollCard(base, D, rng, D.floor, { rar: 'ユニーク' }); if (c) loot.cards.push(c); }
    }
  }
  makeReward(base, D, { kind: bt.kind, room: bt.room, zeni, loot, overkill: B.overkill?.level ?? null, chase: !!bt.chase });
  return D;
}

/** 追跡者の後は、割り込まれた部屋へ */
function afterChase(base, D) {
  const door = D.chase.door;
  D.chase = null;
  D.reward = null;
  return openRoom(base, D, door);
}

// ───────────────────────── 報酬 ─────────────────────────

function makeReward(base, D, o) {
  D.zeni += o.zeni;
  const own = (x, type) => ({ uid: nextUid(D, type[0]), type, ...x });
  const groups = [];
  if (o.loot.cards.length) groups.push({ type: 'card', pick: 1, options: o.loot.cards.map((c) => own(c, 'card')), taken: [] });
  if (o.loot.regulars.length) groups.push({ type: 'regular', pick: 1, options: o.loot.regulars.map((id) => own({ id, origin: 'orig' }, 'regular')), taken: [] });
  if (o.loot.relics.length) groups.push({ type: 'relic', pick: 1, options: o.loot.relics.map((id) => own({ id }, 'relic')), taken: [] });
  for (const id of o.loot.souvenirs) groups.push({ type: 'souvenir', pick: 1, options: [own({ id }, 'souvenir')], taken: [] });
  for (const it of o.loot.items) groups.push({ type: 'item', pick: 1, options: [own(it, 'item')], taken: [] });
  D.reward = { kind: o.kind, room: o.room, zeni: o.zeni, overkill: o.overkill ?? null, chase: !!o.chase, groups };
  D.phase = 'reward';
  log(D, { t: 'reward', kind: o.kind, zeni: o.zeni, n: groups.length });
}

/** 報酬の受け取り先として選べるもの */
export function rewardDests(base, D, x) {
  const P = base.balance.hands.play;
  const out = [];
  if (x.type === 'card') out.push({ to: 'deck', label: 'デッキへ', ok: D.deck.length < P.deckMax });
  if (x.type === 'regular') out.push({ to: 'deck', label: '席へ', ok: D.seats.length < P.seats });
  if (x.type === 'relic') out.push({ to: 'deck', label: '置く', ok: true });
  if (x.type === 'item') out.push({ to: 'deck', label: 'お品書きへ', ok: D.items.length < P.itemSlots });
  out.push({ to: 'pouch', label: '懐へ', ok: pouchRoom(base, D, x) });
  if (x.type === 'souvenir' && D.charm.length < D.carry.charm) out.push({ to: 'charm', label: 'お守り袋へ', ok: true });
  out.push({ to: 'skip', label: '見送る', ok: true });
  return out;
}

/**
 * 報酬を受け取る
 * @param {number} gi まとまりの番号 @param {number} oi 候補の番号 @param {'deck'|'pouch'|'charm'|'skip'} to
 */
export function takeReward(base, D, gi, oi, to) {
  check(D.phase === 'reward' && D.reward, '報酬はない');
  const g = D.reward.groups[gi];
  check(!!g && g.taken.length < g.pick, 'もう選んだ');
  if (to === 'skip') { g.taken.push(null); return D; }
  const x = g.options[oi];
  check(!!x, '候補がない');
  const d = rewardDests(base, D, x).find((y) => y.to === to);
  check(!!d?.ok, `${d?.label ?? 'そこ'}には入らない`);
  put(base, D, x, to);
  g.taken.push(x.uid);
  return D;
}

/** 報酬の画面を閉じる（残りは見送る） */
export function closeReward(base, D) {
  check(D.phase === 'reward', '報酬はない');
  if (D.reward.chase) return afterChase(base, D);
  return leaveRoom(base, D);
}

function strip(x) { const { type, ...rest } = x; return rest; }

/** 持ち物を置き場へ */
function put(base, D, x, to) {
  if (to === 'pouch' || to === 'charm') { D[to].push({ ...x }); log(D, { t: 'take', id: x.id, to }); return; }
  if (x.type === 'card') D.deck.push(strip(x));
  else if (x.type === 'regular') D.seats.push(strip(x));
  else if (x.type === 'relic') D.relics.push(strip(x));
  else if (x.type === 'item') D.items.push(strip(x));
  else throw new Error(`${x.type}はそこに置けない`);
  log(D, { t: 'take', id: x.id, to });
}

function addSouvenir(base, D, id) {
  const x = { uid: nextUid(D, 's'), type: 'souvenir', id };
  if (pouchRoom(base, D, x)) D.pouch.push(x);
  else if (D.charm.length < D.carry.charm) D.charm.push(x);
  else { D.msg = `懐がいっぱいで${nameOf(base, x)}を拾えなかった`; return; }
  log(D, { t: 'souvenir', id });
}

/** 表示用の名前 */
export function nameOf(base, x) {
  const C = base.content;
  if (x.type === 'remove') return '札の除去';
  const def = C.cards?.[x.id] ?? C.regulars?.[x.id] ?? C.relics?.[x.id] ?? C.items?.[x.id] ?? C.souvenirs?.[x.id];
  if (x.type === 'item' && !def && x.kind === '議題') return `議題「${x.hand}」`;
  return x.mod?.name ?? def?.name ?? x.id;
}

// ───────────────────────── 持ち物の入れ替え ─────────────────────────

const PLACES = ['deck', 'seats', 'relics', 'items', 'pouch', 'charm'];
const TYPE_OF = { deck: 'card', seats: 'regular', relics: 'relic', items: 'item' };

/**
 * 持ち物を動かす（戦闘中は不可。デッキ・席・置物と懐の間は湯でだけ）
 * @param {string} from 置き場 @param {string} uid @param {string} to 置き場
 */
export function moveThing(base, D, from, uid, to) {
  check(D.phase !== 'battle' && D.phase !== 'end', 'いまは入れ替えられない');
  check(PLACES.includes(from) && PLACES.includes(to) && from !== to, '置き場が違う');
  const list = D[from];
  const i = list.findIndex((x) => x.uid === uid);
  check(i >= 0, 'その品はない');
  const x = { ...list[i], type: list[i].type ?? TYPE_OF[from] };
  const P = base.balance.hands.play;
  const heavy = (p) => ['deck', 'seats', 'relics'].includes(p);
  check(!(heavy(from) || heavy(to)) || D.phase === 'bath', 'デッキと懐の入れ替えは湯でだけ');
  if (to === 'pouch') check(pouchRoom(base, D, x), '懐がいっぱい');
  if (to === 'charm') check(D.charm.length < D.carry.charm, 'お守り袋がいっぱい');
  if (to === 'items') check(x.type === 'item' && D.items.length < P.itemSlots, 'お品書きは2つまで');
  if (to === 'deck') check(x.type === 'card' && D.deck.length < P.deckMax, `デッキは${P.deckMax}枚まで`);
  if (to === 'seats') check(x.type === 'regular' && D.seats.length < P.seats, '席がない');
  if (to === 'relics') check(x.type === 'relic', '置物ではない');
  if (from === 'deck') check(D.deck.length > P.deckMin, `デッキは${P.deckMin}枚より減らせない`);
  list.splice(i, 1);
  if (to === 'pouch' || to === 'charm') D[to].push(x);
  else D[to].push(strip(x));
  return D;
}

/** 懐・お守り袋の品を捨てる（戦闘の外ならいつでも。捨てた品は戻らない） */
export function dropThing(base, D, from, uid) {
  check(D.phase !== 'battle' && D.phase !== 'end', 'いまは捨てられない');
  check(from === 'pouch' || from === 'charm', '懐かお守り袋の品だけ捨てられる');
  const i = D[from].findIndex((x) => x.uid === uid);
  check(i >= 0, 'その品はない');
  const [x] = D[from].splice(i, 1);
  D.log?.push?.({ t: 'drop', id: x.id, type: x.type, floor: D.floor });
  return D;
}

// ───────────────────────── 商い・湯・謎・非常口 ─────────────────────────

function genShop(base, D, room) {
  const E = econ(base);
  const S = E.shop;
  const rng = Rng.child(D.seed, 'shop', D.floor, room);
  const goods = [];
  const add = (x) => goods.push({ ...x, uid: nextUid(D, x.type[0]), price: price(base, D, x), sold: false });
  // 行商人はレアまで（ユニーク以上は拾うしかない）
  for (let i = 0; i < S.cards; i++) { const c = rollCard(base, D, rng, D.floor, { maxRar: 'レア', rar: undefined }); if (c) add({ type: 'card', ...c }); }
  for (const id of rollFrom(rng, D.pool.regulars, S.regulars, D.seats.map((r) => r.id))) add({ type: 'regular', id, origin: 'orig' });
  for (let i = 0; i < S.items; i++) { const it = rollItem(base, D, rng); if (it) add({ type: 'item', ...it }); }
  for (let i = 0; i < S.removes; i++) add({ type: 'remove' });
  return { room, goods };
}

/**
 * 商いで買う
 * @param {number} i 品の番号 @param {object} [o] {to: 'deck'|'pouch', card: 除く札のuid}
 */
export function buy(base, D, i, o = {}) {
  check(D.phase === 'shop', '商いにいない');
  const g = D.shop.goods[i];
  check(!!g && !g.sold, 'もう売れた');
  check(D.zeni >= g.price, '宿銭が足りない');
  if (g.type === 'remove') {
    const P = base.balance.hands.play;
    check(D.deck.length > P.deckMin, `デッキは${P.deckMin}枚より減らせない`);
    const at = D.deck.findIndex((c) => c.uid === o.card);
    check(at >= 0, '除く札を選ぶ');
    const [c] = D.deck.splice(at, 1);
    log(D, { t: 'remove', id: c.id });
  } else {
    const to = o.to ?? 'deck';
    const d = rewardDests(base, D, g).find((y) => y.to === to);
    check(!!d?.ok, `${d?.label ?? 'そこ'}には入らない`);
    const { price: _p, sold: _s, ...x } = g;
    put(base, D, x, to);
  }
  D.zeni -= g.price;
  g.sold = true;
  log(D, { t: 'buy', type: g.type, id: g.id ?? null, price: g.price });
  return D;
}

/** 湯の選択肢 */
export function bathOptions(base, D) {
  const dm = dmods(base, D);
  const heal = Math.round(D.maxHp * econ(base).bath.heal * (dm.bathHealMul ?? 1));
  return [
    { id: 'heal', label: `体力＋${heal}`, heal },
    { id: 'enhance', label: '札に仕込み', needCard: true },
    { id: 'calm', label: `気配${base.balance.curve.presence.bath}` },
  ];
}

/** 湯で1つ選ぶ。enhance は card（デッキの札の uid）が要る */
export function useBath(base, D, id, card) {
  check(D.phase === 'bath' && !D.bath.done, 'もう湯に入った');
  const opt = bathOptions(base, D).find((o) => o.id === id);
  check(!!opt, '選べない');
  if (id === 'heal') D.hp = Math.min(D.maxHp, D.hp + opt.heal);
  if (id === 'calm') D.presence = Math.max(0, D.presence + base.balance.curve.presence.bath);
  if (id === 'enhance') {
    const c = D.deck.find((x) => x.uid === card);
    check(!!c, '札を選ぶ');
    const rng = Rng.child(D.seed, 'event', D.floor, D.here.room);
    c.enh = rng.pick(Object.keys(base.balance.hands.enhancements));
    D.msg = `${nameOf(base, c)}に「${c.enh}」が付いた`;
  }
  D.bath.done = true;
  log(D, { t: 'bath', id });
  return D;
}

/** 謎の選択肢（条件を満たさないものは ok:false） */
export function eventChoices(base, D) {
  const ev = base.content.events[D.event.id];
  const { B, env } = shell(base, D);
  return ev.choices.map((c, i) => {
    if (!choiceShown(base, D, c)) return null;
    let ok = true;
    try { ok = !c.if || testCond(makeE({ battle: B, env }, null, 'event', { id: ev.id, name: ev.title }), c.if); } catch { ok = false; }
    return { i, label: c.label, ok, who: whoOf(base, c) };
  }).filter(Boolean);
}
/** 選択肢が出るか：guest（宿泊客）・regular（連れている常連客）・deckCat（デッキで一番多いカテゴリ）・needFlag */
function choiceShown(base, D, c) {
  if (c.guest && !c.guest.includes(D.guest)) return false;
  if (c.regular && !D.seats.some((r) => c.regular.includes(r.id))) return false;
  if (c.deckCat && !topCats(base, D).includes(c.deckCat)) return false;
  if (c.needFlag && !D.flags?.ev?.[c.needFlag]) return false;
  return true;
}
/** デッキで一番多いカテゴリ（同数なら全部） */
function topCats(base, D) {
  const n = {};
  for (const c of D.deck) for (const k of (c.mod?.cat ?? base.content.cards[c.id]?.cat ?? [])) n[k] = (n[k] || 0) + 1;
  const m = Math.max(0, ...Object.values(n));
  return Object.keys(n).filter((k) => n[k] === m && m > 0);
}
/** 誰の選択肢か（画面の札に出す名前） */
function whoOf(base, c) {
  if (c.guest) return base.content.guests[c.guest[0]]?.name ?? null;
  if (c.regular) return base.content.regulars?.[c.regular[0]]?.name ?? null;
  if (c.deckCat) return `${c.deckCat}のデッキ`;
  return null;
}

// 謎の前後で何が変わったか（画面に「起きたこと」として並べる）
function eventSnap(D) {
  return {
    hp: D.hp, maxHp: D.maxHp, zeni: D.zeni, presence: D.presence, banzuke: { ...(D.banzuke || {}) },
    items: (D.items || []).map((x) => x.id ?? x.kind), deck: new Map((D.deck || []).map((c) => [c.uid, JSON.stringify([c.id, c.enh, c.ed, c.seal, c.ins, c.rar, c.mod])])),
    seats: (D.seats || []).map((x) => x.uid), pouch: (D.pouch || []).map((x) => x.uid), charm: (D.charm || []).map((x) => x.uid), curses: (D.curses || []).length, rules: (D.rules || []).length, msg: D.msg,
  };
}
function eventDiff(base, a, D) {
  const out = [];
  const num = (k, label, good = 1) => { const d = D[k] - a[k]; if (d) out.push({ text: `${label} ${d > 0 ? '＋' : '−'}${Math.abs(d)}`, good: d * good > 0 }); };
  num('hp', '体力'); num('maxHp', '体力の上限'); num('zeni', '宿銭'); num('presence', '気配', -1);
  const ring = base.balance.tiers.ring;
  for (const [cat, t] of Object.entries(D.banzuke || {})) {
    const was = a.banzuke[cat];
    if (was != null && was !== t) out.push({ text: `番付：${cat} ${was === 'God' ? 'God' : `T${was}`} → ${t === 'God' ? 'God' : `T${t}`}`, good: ring.indexOf(String(t)) < ring.indexOf(String(was)) });
  }
  const itemName = (id) => base.content.items?.[id]?.name ?? id;
  const before = [...a.items];
  for (const id of D.items || []) { const k = before.indexOf(id.id ?? id.kind); if (k >= 0) before.splice(k, 1); else out.push({ text: `お品書き「${itemName(id.id ?? id.kind)}」を得た`, good: true }); }
  for (const id of before) out.push({ text: `お品書き「${itemName(id)}」を失った`, good: false });
  const now = new Map((D.deck || []).map((c) => [c.uid, c]));
  for (const [uid, sig] of a.deck) {
    const c = now.get(uid);
    if (!c) { const [id] = JSON.parse(sig); out.push({ text: `札「${base.content.cards[id]?.name ?? id}」がデッキから消えた`, good: false }); continue; }
    const was = JSON.parse(sig); const is = JSON.parse(now.get(uid) && JSON.stringify([c.id, c.enh, c.ed, c.seal, c.ins, c.rar, c.mod]));
    if (JSON.stringify(was) === JSON.stringify(is)) continue;
    const nm = base.content.cards[c.id]?.name ?? c.id;
    if (was[0] !== is[0]) out.push({ text: `札「${base.content.cards[was[0]]?.name ?? was[0]}」が「${nm}」に変わった`, good: true });
    if (is[1] && was[1] !== is[1]) out.push({ text: `札「${nm}」に仕込み「${is[1]}」`, good: true });
    if (is[2] && was[2] !== is[2]) out.push({ text: `札「${nm}」に版「${is[2]}」`, good: true });
    if (is[3] && was[3] !== is[3]) out.push({ text: `札「${nm}」に判「${is[3]}」`, good: true });
    if (JSON.stringify(was[4]) !== JSON.stringify(is[4])) out.push({ text: `札「${nm}」に刻印`, good: true });
    if (is[5] && was[5] !== is[5]) out.push({ text: `札「${nm}」が${is[5]}に`, good: true });
    if (JSON.stringify(was[6]) !== JSON.stringify(is[6])) out.push({ text: `札「${nm}」のTierかカテゴリが変わった（この潜行のあいだ）`, good: true });
  }
  for (const c of D.deck || []) if (!a.deck.has(c.uid)) out.push({ text: `札「${base.content.cards[c.id]?.name ?? c.id}」がデッキに入った`, good: true });
  const sin = new Set(a.seats); for (const x of D.seats || []) if (!sin.has(x.uid)) out.push({ text: `常連客「${base.content.regulars?.[x.id]?.name ?? x.id}」が席に着いた`, good: true });
  const pin = new Set(a.pouch); for (const x of D.pouch || []) if (!pin.has(x.uid)) out.push({ text: `懐に「${nameOf(base, x)}」`, good: true });
  const cin = new Set(a.charm); for (const x of D.charm || []) if (!cin.has(x.uid)) out.push({ text: `お守り袋に「${nameOf(base, x)}」`, good: true });
  if ((D.curses || []).length > a.curses) for (const c of D.curses.slice(a.curses)) out.push({ text: `呪い「${c.name}」`, good: false });
  if ((D.rules || []).length > a.rules) for (const r of D.rules.slice(a.rules)) out.push({ text: `この潜行のあいだ：${r.text ?? r.name ?? '決まりが増えた'}`, good: true });
  if (D.msg && D.msg !== a.msg) out.push({ text: D.msg, good: true });
  return out;
}

/** 謎で選ぶ */
export function chooseEvent(base, D, i) {
  check(D.phase === 'event' && D.event && D.event.choice == null, 'もう選んだ');
  const ev = base.content.events[D.event.id];
  const c = ev.choices[i];
  check(!!c && eventChoices(base, D).find((x) => x.i === i)?.ok, '選べない');
  D.event.choice = i;
  D.event.result = c.result ?? '';
  const snap = eventSnap(D);
  const Bx = c.do ? runOutside(base, D, (B, env) => runDo(makeE({ battle: B, env }, null, 'event', { id: ev.id, name: ev.title }), c.do)) : null;
  D.event.effects = eventDiff(base, snap, D);
  if (c.flag) { (D.flags.ev ||= {})[c.flag] = true; }
  // 効かなかった分も一言（満タン・もう0・もう揃っている）
  const dos = [].concat(c.do || []).map((d) => (typeof d === 'string' ? [d, null] : Object.entries(d)[0]));
  const ef = D.event.effects;
  if (dos.some(([k, v]) => k === '体力' && v > 0) && D.hp === snap.hp && !ef.some((f) => /^体力/.test(f.text))) ef.push({ text: '体力はもう満タンだった', neutral: true });
  if (dos.some(([k, v]) => k === '気配' && v < 0) && D.presence === snap.presence && !ef.some((f) => /^気配/.test(f.text))) ef.push({ text: '気配はもう0だった', neutral: true });
  if (dos.some(([k]) => /^番付を(均す|反転|入れ替える)$/.test(k)) && !ef.some((f) => /^番付/.test(f.text))) ef.push({ text: '番付はもともとその形だった', neutral: true });
  for (const l of Bx?.log || []) if (l.t === 'note' && l.what && !/^次の出し/.test(l.what)) D.event.effects.push({ text: l.what, good: false });
  log(D, { t: 'event', id: ev.id, choice: i });
  if (D.hp <= 0) return endDive(base, D, 'lost', 'event');
  return D;
}

/** 非常口の代償 */
export function exitCosts(base, D) {
  const half = Math.floor(D.zeni * econ(base).escape.zeniRate);
  return [
    ...D.pouch.map((x) => ({ id: 'pouch', uid: x.uid, label: `${nameOf(base, x)}を置いていく` })),
    { id: 'zeni', amount: half, label: `宿銭の半分（${half}）を払う` },
  ];
}

/** 非常口を使う（uid を渡せば懐のその品、渡さなければ宿銭の半分）。'back' でやめる */
export function useExit(base, D, how, uid) {
  check(D.phase === 'exit', '非常口にいない');
  if (how === 'back') { D.phase = 'map'; D.here = null; D.map.visited = D.map.visited.filter((r) => r !== D.map.exit.room); return D; }
  if (how === 'pouch') {
    const i = D.pouch.findIndex((x) => x.uid === uid);
    check(i >= 0, 'その品はない');
    D.pouch.splice(i, 1);
  } else {
    D.zeni -= Math.floor(D.zeni * econ(base).escape.zeniRate);
  }
  return endDive(base, D, 'escaped', 'exit');
}

// ───────────────────────── 踊り場 ─────────────────────────

function toLanding(base, D, afterBoss) {
  D.phase = 'landing';
  D.landing = { afterBoss };
  log(D, { t: 'landing', afterBoss });
  diveSignal(base, D, '踊り場');
  return D;
}

/** 踊り場に出す情報 */
export function landingInfo(base, D) {
  const { content, balance } = base;
  const next = D.floor + 1;
  const nextL = layerAt(content, next, D.dungeon);
  let preview = null;
  if (nextL) {
    const m = genFloor(base, D, next);
    const doors = [...m.rows.flat(), m.side].filter(Boolean);
    const hide = (d) => d.hidden;
    const count = (k) => ({ seen: doors.filter((d) => d.kind === k && !hide(d)).length, hidden: doors.filter(hide).length > 0 });
    preview = { floor: next, layer: nextL.name, newLayer: nextL.id !== D.layer, elite: count('精鋭'), treasure: count('宝'), side: !!m.side, boss: bossFloorOf(nextL, next) };
  }
  const L = layerAt(content, D.floor, D.dungeon);
  const wd = L?.warden ? content.enemies[L.warden] : null;
  const w = pouchWeight(base, D);
  const warden = wd ? makeEnemy(balance, wd, { floor: powerFloor(base, D), depth: D.depth, presence: D.presence, weight: w }, 'w') : null;
  const plain = wd ? makeEnemy(balance, wd, { floor: powerFloor(base, D), depth: D.depth, presence: D.presence, weight: 0 }, 'w0') : null;
  return {
    afterBoss: !!D.landing?.afterBoss, canDescend: !!nextL && !(D.maxFloor && next > D.maxFloor), next: preview,
    warden: warden && { name: warden.name, claim: warden.claim, atk: warden.atk, plain: plain.claim, weight: w, perWeight: balance.curve.kinds.番人.claimPerWeight },
    value: pouchValue(base, D), hp: D.hp, maxHp: D.maxHp, presence: D.presence,
  };
}

/** 下りる */
export function descend(base, D) {
  check(D.phase === 'landing', '踊り場にいない');
  check(!!layerAt(base.content, D.floor + 1, D.dungeon), 'この先は、まだ無い');
  check(!(D.maxFloor && D.floor + 1 > D.maxFloor), `この潜行はB${D.maxFloor}まで`);
  // 賭け札と「下りた階」で育つ常連客
  for (const c of D.deck) if (c.origin === 'bet') c.grow = (c.grow || 0) + 1;
  for (const r of D.seats) {
    const gw = base.content.regulars?.[r.id]?.grow;
    if (gw?.増える === '下りた階') r.grow = (r.grow || 0) + gw.量;
  }
  D.landing = null;
  enterFloor(base, D, D.floor + 1);
  return D;
}

/** 引き返す（帰路の番人と1戦）。層主の直後は昇降機で帰る */
export function goBack(base, D) {
  check(D.phase === 'landing', '踊り場にいない');
  if (D.landing.afterBoss) return endDive(base, D, 'escaped', 'lift');
  const L = layerAt(base.content, D.floor, D.dungeon);
  if (!L?.warden) return endDive(base, D, 'escaped', 'stairs');
  D.here = { room: ROOM.warden, kind: '番人', side: true };
  D.phase = 'battle';
  D.battle = { room: ROOM.warden, kind: '番人', enemies: [L.warden] };
  return D;
}

// ───────────────────────── お品書き（戦闘の外） ─────────────────────────

/** 戦闘の外の「場」（敵のいない戦闘）。お品書き・謎・合図の効果を動かすのに使う */
function shell(base, D) {
  const o = {
    seed: D.seed, floor: D.floor, dungeon: D.dungeon, room: ROOM.item, depth: D.depth, presence: D.presence, hp: D.hp, maxHp: D.maxHp,
    guest: D.guest, guestState: D.guestState, deck: D.deck, seats: D.seats, relics: D.relics, items: D.items, rules: D.rules,
    banzuke: D.banzuke, handLevels: D.handLevels, banzukeFloorStart: D.floorBanzuke, enemies: [],
  };
  const B = createBattle(base, o);
  B.shell = true;
  B.rngState = Rng.child(D.seed, 'event', D.floor, ROOM.item, D.uidSeq, D.log.length).getState();
  const env = openBattle(base, B);
  env.dive = D;
  return { B, env };
}

function runOutside(base, D, fn) {
  const { B, env } = shell(base, D);
  try { fn(B, env); } finally { copyBack(base, D, B); }
  if (B.pendingEscape) endDive(base, D, 'escaped', 'item');
  return B;
}

/** 戦闘の外でお品書きを使えるか */
export function canUseOutside(base, D, item) {
  const def = item.id ? base.content.items?.[item.id] : null;
  if (['battle', 'end'].includes(D.phase)) return false;
  if ((def?.use ?? '戦闘中') === '戦闘中') return false;
  if (def?.once === '潜行' && D.flags.used[def.id]) return false;
  return true;
}

/** お品書きを使う（戦闘の外）。choices は {カテゴリ, 札, 札2} */
export function useDiveItem(base, D, index, choices = {}) {
  check(!['battle', 'end'].includes(D.phase), 'いまは使えない');
  const item = D.items[index];
  check(!!item, 'お品書きがない');
  let err = null;
  runOutside(base, D, (B, env) => {
    try { battleUseItem(B, env, index, choices, { outside: true }); } catch (e) { err = e; }
  });
  if (err) throw err;
  return D;
}

/** 持ち物の合図（階に入った時・部屋に入った時・踊り場・脱出時）を、置物・常連客・宿泊客の fx に届ける */
function diveSignal(base, D, signal) {
  const C = base.content;
  const owners = [...D.relics.map((r) => [C.relics?.[r.id], r]), ...D.seats.map((r) => [C.regulars?.[r.id], r])];
  const fxs = owners.flatMap(([def, self]) => (def?.fx || []).filter((f) => f.when === signal).map((f) => [f, self, def]));
  if (!fxs.length) return;
  runOutside(base, D, (B, env) => {
    for (const [f, self, def] of fxs) {
      const E = makeE({ battle: B, env }, self, C.relics?.[self.id] ? 'relic' : 'regular', { id: def.id, name: def.name });
      if (!f.if || testCond(E, f.if)) runDo(E, f.do);
    }
  });
}

// ───────────────────────── 終わり ─────────────────────────

/** 脱出・未帰還。宿はまだ無いので、持ち帰る物の一覧と総額を結果に残すだけ */
function endDive(base, D, outcome, via) {
  if (D.result) return D;
  if (outcome === 'escaped') diveSignal(base, D, '脱出時');
  const kept = outcome === 'escaped'
    ? [...D.deck.map((c) => ({ ...c, type: 'card' })), ...D.seats.map((r) => ({ ...r, type: 'regular' })), ...D.relics.map((r) => ({ ...r, type: 'relic' })),
      ...D.items.map((i) => ({ ...i, type: 'item' })), ...D.pouch, ...D.charm]
    : D.charm.slice();
  const lost = outcome === 'escaped' ? [] : [...D.pouch, ...D.deck.map((c) => ({ ...c, type: 'card' }))];
  const relicCash = outcome === 'escaped' ? D.relics.filter((r) => !r.guest).reduce((s, r) => s + (econ(base).relicCash[base.content.relics?.[r.id]?.grade] ?? 0), 0) : 0;
  D.result = {
    outcome, via, floor: D.floor, deepest: D.stats.deepest, zeni: outcome === 'escaped' ? D.zeni : 0, relicCash,
    kept: kept.map((x) => ({ type: x.type, id: x.id, name: nameOf(base, x), sell: sellValue(base, x) })),
    lostValue: lost.reduce((s, x) => s + sellValue(base, x), 0) + (outcome === 'escaped' ? 0 : D.zeni),
    maxV: D.stats.maxV, battles: D.stats.battles, rooms: D.stats.rooms,
  };
  D.phase = 'end';
  D.battle = null;
  D.battleState = null;
  log(D, { t: 'end', outcome, via });
  return D;
}

function check(cond, reason) { if (!cond) throw Object.assign(new Error(reason), { userError: true }); }

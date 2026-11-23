// sim.mjs — 戦闘の自動プレイによるバランス確認
//   node tools/sim.mjs [試行数] [m=変異因子id,...] [modes=rank_d,rank_c] [board.mergeMin=5 など rules の上書き]
// ボット：その時点で最も長い連結を選ぶ貪欲法。1ターンの連結回数は、なぞる時間・反応時間・落下時間から見積もる。
import { loadPacks } from '../js/engine/registry.js';
import { Combat } from '../js/engine/combat.js';
import { makeRng, fmt, BigNum } from '../js/util.js';

const args = process.argv.slice(2);
const TRIALS = Number(args.find(a => /^\d+$/.test(a))) || 30;
const kv = Object.fromEntries(args.filter(a => a.includes('=')).map(a => a.split('=')));
const MUTAGENS = (kv.m || '').split(',').filter(Boolean);
const MODES = (kv.modes || '').split(',').filter(Boolean);
const TRACE = 0.12;    // 1ノードなぞる時間（秒）
const REACT = 0.30;    // 2本目以降の連結を探す反応時間（秒）
const MAX_TURNS = 30;
const BUDGET = 1500;   // 1本目：じっくり考える（最長ルート探索の打ち切り）
const QUICK = 120;     // 2本目以降：反射で探す範囲（近くから探して打ち切り）

const reg = await loadPacks();
if (reg.errors.length) { console.log(reg.errors.join('\n')); process.exit(1); }
for (const [k, v] of Object.entries(kv)) {
  if (k === 'm' || k === 'modes') continue;
  const path = k.split('.'); let o = reg.rules;
  for (const p of path.slice(0, -1)) o = o[p] ??= {};
  o[path.at(-1)] = isNaN(+v) ? v : +v;
}
const overrides = Object.keys(kv).filter(k => k !== 'm' && k !== 'modes').map(k => `${k}=${kv[k]}`).join(' ');
const fall = reg.rules.fire.fallTime;

function longest(b, budget = BUDGET, rng = null) {
  let best = null, steps = 0;
  const dfs = path => {
    if (++steps > budget) return;
    if (!best || path.length > best.length) best = path.slice();
    const l = path[path.length - 1];
    for (const [c, r] of b.nb(l.c, l.r)) if (b.canExtend(path, c, r) === 'add') { path.push({ c, r }); dfs(path); path.pop(); }
  };
  const starts = [...b.cells()].filter(p => b.chainable(p.c, p.r));
  if (rng) rng.shuffle(starts);
  for (const s of starts) { dfs([{ c: s.c, r: s.r }]); if (steps > budget) break; }
  return best && best.length >= b.minChain ? best : null;
}

function fight(mode, floor, seed) {
  const cb = new Combat(reg, makeRng(seed), { mode, floor, mutagens: MUTAGENS });
  const brng = makeRng(seed ^ 0x5bd1e995);
  let chains = 0, dmg = BigNum.from(0); const perTurn = [];
  while (cb.turn <= MAX_TURNS) {
    if (cb.canCrit) cb.toggleReserve();
    cb.beginFire();
    let first = true;
    for (let guard = 0; guard < 40; guard++) {
      const path = first ? longest(cb.board) : longest(cb.board, QUICK, brng);
      if (!path) break;
      const cost = (first ? 0 : REACT) + path.length * TRACE;
      if (cb.tick(cost)) break;           // なぞり終える前に時間切れ
      cb.commit(path); chains++; first = false;
      if (cb.tick(fall)) break;
    }
    const { ev, won } = cb.endFire();
    dmg = dmg.add(ev.total); perTurn.push(ev.total.toNumber());
    if (won) return { turns: cb.turn, won: true, chains, dmg, perTurn };
    cb.enemyPhase();
    if (cb.phase === 'lost') return { turns: cb.turn, won: false, chains, dmg, perTurn };
  }
  return { turns: MAX_TURNS, won: false, chains, dmg, perTurn, timeout: true };
}

console.log(`試行 ${TRIALS} 回／1本目は最長・2本目以降は近場の探索（${QUICK}手）／なぞり ${TRACE}s/個・反応 ${REACT}s・落下 ${fall}s${MUTAGENS.length ? '／変異因子 ' + MUTAGENS.join(',') : '（無強化）'}${overrides ? '／' + overrides : ''}`);
console.log('| 契約 | 層 | 敵HP | 撃破ターン平均 | 撃破率 | 1ターンのダメージ（中央値） | 1ターン平均連結 | 5ターン撃破に要るHP倍率 |');
console.log('| :-- | --: | --: | --: | --: | --: | --: | --: |');
for (const mode of reg.all('modes').filter(m => !MODES.length || MODES.includes(m.id)).sort((a, b) => a.order - b.order)) {
  for (let f = 1; f <= mode.floors; f++) {
    let turns = 0, wins = 0, ch = 0, tt = 0, d = BigNum.from(0), hp = null; const all = [];
    for (let i = 0; i < TRIALS; i++) {
      const r = fight(mode.id, f, 1000 * f + i * 7919 + mode.order);
      if (r.won) { turns += r.turns; wins++; }
      tt += r.turns; ch += r.chains; d = d.add(r.dmg); all.push(...r.perTurn);
      hp ??= new Combat(reg, makeRng(1), { mode: mode.id, floor: f }).enemy.hpMax;
    }
    const boss = mode.bossFloors.includes(f) ? '★' : '';
    all.sort((a, b) => a - b);
    const med = all[Math.floor(all.length / 2)] ?? 0;
    const scale = med * 5 / hp.toNumber();
    console.log(`| ${mode.name} | ${f}${boss} | ${fmt(hp)} | ${wins ? (turns / wins).toFixed(1) : '—'} | ${Math.round(wins / TRIALS * 100)}% | ${fmt(med)} | ${(ch / tt).toFixed(1)} | ×${scale.toFixed(1)} |`);
  }
}

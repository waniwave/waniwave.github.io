// sim.mjs — 戦闘の自動プレイによるバランス確認
//   node tools/sim.mjs [試行数] [m=変異因子id,...] [modes=rank_d,rank_c] [board.mergeMin=5 など rules の上書き]
//   node tools/sim.mjs campaign [試行数] … 契約を通しで自動プレイし、ランクごとの完遂までの潜行回数を出す
//   node tools/sim.mjs abyss [試行数] [maxFloor=80] … 典型的なビルドで深淵を1層から潜り続け、何層まで届くかを出す
// ボット：その時点で最も長い連結を選ぶ貪欲法。1ターンの連結回数は、なぞる時間・反応時間・落下時間から見積もる。
import { loadPacks } from '../js/engine/registry.js';
import { Combat, isBossFloor } from '../js/engine/combat.js';
import { Game } from '../js/engine/progress.js';
import { makeRng, fmt, BigNum } from '../js/util.js';

const args = process.argv.slice(2);
const CAMPAIGN = args.includes('campaign');
const ABYSS = args.includes('abyss');
const TRIALS = Number(args.find(a => /^\d+$/.test(a))) || (CAMPAIGN ? 6 : 30);
const kv = Object.fromEntries(args.filter(a => a.includes('=')).map(a => a.split('=')));
const MUTAGENS = (kv.m || '').split(',').filter(Boolean);
const MODES = (kv.modes || '').split(',').filter(Boolean);
const TRACE = 0.12;    // 1ノードなぞる時間（秒）
const REACT = 0.30;    // 2本目以降の連結を探す反応時間（秒）
const MAX_TURNS = 30;
const BOSS_RETREAT = 5;   // 通しプレイのボット：次がボスで、直前の戦闘がこのターン数以上かかったら抜去
const BUDGET = 1500;   // 1本目：じっくり考える（最長ルート探索の打ち切り）
const QUICK = 120;     // 2本目以降：反射で探す範囲（近くから探して打ち切り）

const reg = await loadPacks();
if (reg.errors.length) { console.log(reg.errors.join('\n')); process.exit(1); }
for (const [k, v] of Object.entries(kv)) {
  if (k === 'm' || k === 'modes' || k === 'maxFloor') continue;
  if (k.startsWith('node.') || k.startsWith('enemy.')) { const [kind, id, field] = k.split('.'); const x = reg.get(kind === 'node' ? 'nodes' : 'enemies', id); if (x) x[field] = +v; continue; }
  if (k.startsWith('mode.')) { const [, id, field] = k.split('.'); const m = reg.get('modes', id); if (m) m[field] = +v; continue; }
  const path = k.split('.'); let o = reg.rules;
  for (const p of path.slice(0, -1)) o = o[p] ??= {};
  o[path.at(-1)] = isNaN(+v) ? v : +v;
}
const overrides = Object.keys(kv).filter(k => k !== 'm' && k !== 'modes').map(k => `${k}=${kv[k]}`).join(' ');
if (CAMPAIGN && overrides) console.log('上書き：' + overrides);
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

// 1ターン分の発火（人間らしいボット）
function playTurn(cb, brng) {
  if (cb.canCrit) cb.toggleReserve();
  cb.beginFire();
  let first = true;
  for (let guard = 0; guard < 40; guard++) {
    const path = first ? longest(cb.board) : longest(cb.board, QUICK, brng);
    if (!path) break;
    const cost = (first ? 0 : REACT) + path.length * TRACE;
    if (cb.tick(cost)) break;
    cb.commit(path); first = false;
    if (cb.tick(cb.fallTime())) break;
  }
  return cb.endFire();
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

if (CAMPAIGN) { await campaign(); process.exit(0); }
if (ABYSS) { await abyss(); process.exit(0); }
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

// ---- 契約を通しで自動プレイ ----
// 方針：標準株で解凍、最も良い義体を装着、未完遂の最上位ランクへ潜行、通常経路を選ぶ、変異因子は1つ目、
//       SYNC が 45% 未満なら抜去、ブローカーで空きソケット用の義体を買う、熟練 Lv.6 で保存処置
async function campaign() {
  const modes = reg.all('modes').filter(m => m.id.startsWith('rank_')).sort((a, b) => a.order - b.order);
  const per = Object.fromEntries(modes.map(m => [m.id, { runs: [], items: [], eq: [] }]));
  const t0 = Date.now();
  for (let trial = 0; trial < TRIALS; trial++) {
    const rng = makeRng(9001 + trial * 101), brng = makeRng(77 + trial);
    const g = new Game(reg, rng);
    g.s.tutorial.done = true;
    let runs = 0, lostCount = 0;
    const clearedAt = {};
    while (runs < 200 && !g.has('cleared:rank_a')) {
      if (!g.diver) g.thaw('lin_standard');
      if (g.canPreserve() && g.careerLevel() >= 6) { g.preserve(0); g.thaw('lin_standard'); }
      // 装着：部位ごとにレアリティの高い順
      for (const r of g.regions()) for (let slot = 0; slot < g.socketCount(r.id); slot++) {
        const cur = g.item(g.s.equipped[r.id][slot]);
        const best = g.storedItems().filter(i => g.tmpl(i).region === r.id).sort((a, b) => g.rarity(b).tier - g.rarity(a).tier)[0];
        if (best && (!cur || g.rarity(best).tier > g.rarity(cur).tier)) g.equip(best.uid, r.id, slot);
      }
      // 買い物：空いているソケットの部位の義体
      const shop = g.shop();
      for (let i = shop.items.length - 1; i >= 0; i--) {
        const x = shop.items[i], reg_ = g.tmpl(x.inst).region;
        const empty = g.socketCount(reg_) > 0 && (g.s.equipped[reg_] || []).slice(0, g.socketCount(reg_)).some(u => u == null);
        if (empty && g.s.syn >= x.price) { g.buy(i); const it = g.s.vault.at(-1); g.equip(it.uid, reg_, g.s.equipped[reg_].indexOf(null)); }
      }
      // 倉庫があふれたら古い順に売る
      while (g.storedItems().length > g.vaultCap()) g.sell(g.storedItems().sort((a, b) => g.rarity(a).tier - g.rarity(b).tier)[0].uid);
      const target = modes.filter(m => g.unlocked(m) && !g.has('cleared:' + m.id)).at(-1) ?? modes.filter(m => g.unlocked(m)).at(-1);
      g.startRun(target.id); runs++;
      per[target.id].tries = (per[target.id].tries || 0) + 1;
      let cb = null, res = null, lastTurns = 0;
      for (let step = 0; step < 2000 && !res; step++) {
        const run = g.run;
        if (run.phase === 'route') { const i = Math.max(0, run.routes.findIndex(r => r.kind === 'normal')); g.chooseRoute(i); cb = g.makeCombat(); cb.protectHp = false; }
        else if (run.phase === 'battle') {
          const r = playTurn(cb, brng); g.recordTurn(cb, r.ev);
          if (!r.won) { cb.enemyPhase(); if (cb.turn > MAX_TURNS && cb.phase === 'think') { cb.sync = 0; cb.phase = 'lost'; cb.lostCause = 'sync'; } }
          if (['won', 'lost', 'closed'].includes(cb.phase)) { if (process.env.SIMLOG) process.stderr.write(`    ${run.mode} ${run.floor}F ${cb.phase} turns=${cb.turn} sync=${cb.sync} myelin=${cb.myelin.toFixed(0)}\n`); const x = g.finishBattle(cb); if (x?.type === 'lost') res = x; }
        } else if (run.phase === 'reward') {
          const id = run.reward.mutagens[0];
          g.takeReward(id ? { type: 'mutagen', id, replace: 0 } : { type: 'syn' });
        } else if (run.phase === 'final') res = g.extract();
        else if (run.phase === 'choice') {
          // 次がボスで、直前の戦闘が長引いていたら（＝まだ力不足）抜去する
          const m = g.mode(), nextBoss = isBossFloor(m, run.floor + 1);
          if (run.sync < run.syncMax * 0.45 || (nextBoss && lastTurns >= BOSS_RETREAT)) res = g.extract(); else g.dive();
        }
        if (cb && ['won', 'lost', 'closed'].includes(cb.phase)) lastTurns = cb.turn;
      }
      if (res?.type === 'lost') { lostCount++; per[target.id].lostN = (per[target.id].lostN || 0) + 1; }
      for (const m of modes) if (g.has('cleared:' + m.id) && clearedAt[m.id] == null) {
        clearedAt[m.id] = runs;
        per[m.id].items.push(g.s.vault.length);
        per[m.id].eq.push?.(0);
      }
    }
    let prev = 0;
    for (const m of modes) { if (clearedAt[m.id] != null) { per[m.id].runs.push(clearedAt[m.id] - prev); prev = clearedAt[m.id]; } }
    process.stderr.write(`  試行 ${trial + 1}: ${modes.map(m => `${m.name.replace('RANK ', '')}=${clearedAt[m.id] ?? '×'}`).join(' ')}（累計潜行・ロスト ${lostCount}）\n`);
  }
  const SPEC = { rank_d: 5, rank_c: 10, rank_b: 15, rank_a: 17 };
  const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '—';
  console.log(`契約の通しプレイ ${TRIALS} 回（${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
  console.log('| 契約 | 完遂までの潜行回数（平均） | 仕様書11の想定 | 完遂時の所持義体（平均） | 完遂した試行 | その契約でのロスト率 |');
  console.log('| :-- | --: | --: | --: | --: | --: |');
  for (const m of modes) {
    const p = per[m.id];
    console.log(`| ${m.name} | ${avg(p.runs)} | ${SPEC[m.id] ?? '—'} | ${avg(p.items)} | ${p.runs.length}/${TRIALS} | ${p.tries ? Math.round((p.lostN || 0) / p.tries * 100) + '%' : '—'} |`);
  }
}

// ---- 深淵：典型的なビルドで何層まで届くか ----
// 各ビルド：4部位に PROTOTYPE の義体を1つずつ（系統を指定）＋その系統の株。抜去せずに潜り続け、ロストした層を記録する
async function abyss() {
  const MAXF = Number(kv.maxFloor) || 80;
  const TR = Number(args.find(a => /^\d+$/.test(a))) || 3;
  const regions = ['CERVICAL', 'THORACIC', 'LUMBAR', 'SACRAL'];
  const linOf = st => reg.all('lineages').find(l => l.strain === st)?.id ?? 'lin_standard';
  const builds = [
    { name: '無強化（標準株）', lin: 'lin_standard', strains: [] },
    ...reg.all('strains').filter(s => s.resonance).map(s => ({ name: `${s.name}×4（${reg.get('lineages', linOf(s.id))?.name}）`, lin: linOf(s.id), strains: [s.id, s.id, s.id, s.id] })),
    { name: '脊髄2＋圧縮2（前衛株）', lin: 'lin_vanguard', strains: ['SPINE', 'SPINE', 'CMP', 'CMP'] },
    { name: '長連結2＋連打2（標準株）', lin: 'lin_standard', strains: ['LONG', 'LONG', 'RAPID', 'RAPID'] },
  ];
  const t0 = Date.now();
  console.log(`深淵：1層から抜去せずに潜り続ける（各ビルド ${TR} 回、上限 ${MAXF} 層）`);
  console.log('| ビルド | 到達層（平均） | 最高 | 1ターン最大ダメージ | 主な死因 |');
  console.log('| :-- | --: | --: | --: | :-- |');
  for (const b of builds) {
    const depths = [], causes = {}; let best = BigNum.from(0);
    for (let t = 0; t < TR; t++) {
      const rng = makeRng(31337 + t * 17), brng = makeRng(99 + t);
      const g = new Game(reg, rng); g.s.tutorial.done = true;
      for (const f of ['mode:abyss', 'abyss_open', 'socket:THORACIC', 'socket:LUMBAR', 'socket:SACRAL', 'cleared:rank_a', 'cleared:rank_b', 'cleared:rank_c',
        'lineage:spasm', 'lineage:architect', 'lineage:singularity', 'lineage:parasite', 'lineage:capsule']) g.mem.flags.add(f);
      g.thaw(b.lin);
      b.strains.forEach((st, i) => { const it = g.rollVertebra({ PROTOTYPE: 100 }, { strain: st, region: regions[i] }); g.s.vault.push(it); g.equip(it.uid, regions[i], 0); });
      g.startRun('abyss');
      let cb = null, res = null;
      for (let step = 0; step < 20000 && !res; step++) {
        const run = g.run;
        if (run.floor > MAXF) { res = { type: 'cap', floor: run.floor - 1 }; break; }
        if (run.phase === 'route') { const i = Math.max(0, run.routes.findIndex(r => r.kind === 'normal')); g.chooseRoute(i); cb = g.makeCombat(); }
        else if (run.phase === 'battle') {
          const r = playTurn(cb, brng); g.recordTurn(cb, r.ev);
          if (r.ev.total.gt(best)) best = r.ev.total;
          if (!r.won) { cb.enemyPhase(); if (cb.turn > MAX_TURNS && cb.phase === 'think') { cb.sync = 0; cb.phase = 'lost'; cb.lostCause = 'stall'; } }
          if (['won', 'lost', 'closed'].includes(cb.phase)) { const x = g.finishBattle(cb); if (x?.type === 'lost') res = x; }
        } else if (run.phase === 'reward') { const id = run.reward.mutagens[0]; g.takeReward(id ? { type: 'mutagen', id, replace: 0 } : { type: 'syn' }); }
        else if (run.phase === 'choice') g.dive();
      }
      const f = res?.floor ?? MAXF;
      depths.push(res?.type === 'cap' ? MAXF : f);
      const c = res?.type === 'cap' ? `${MAXF}層到達` : ({ sync: 'SYNC 0%', backflow: '逆流汚染', stall: '撃破できず' }[res?.cause] ?? '?');
      causes[c] = (causes[c] || 0) + 1;
    }
    const avg = (depths.reduce((a, x) => a + x, 0) / depths.length).toFixed(1);
    const main = Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}×${n}`).join(' ');
    console.log(`| ${b.name} | ${avg} | ${Math.max(...depths)} | ${fmt(best)} | ${main} |`);
  }
  console.log(`（${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
}

// check.mjs — コンテンツの検査とエンジンの自己テスト（node tools/check.mjs）
import { loadPacks } from '../js/engine/registry.js';
import { Board, neighbors, key } from '../js/engine/board.js';
import { Combat, enemyHp } from '../js/engine/combat.js';
import { fx, collectEffects } from '../js/engine/registry.js';
import { makeRng, BigNum, fmt } from '../js/util.js';

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('  ✗ ' + msg); } };

// ---- 1. コンテンツの検査 ----
const reg = await loadPacks();
console.log(`[content] パック読み込み：nodes ${reg.all('nodes').length} / enemies ${reg.all('enemies').length}`);
for (const e of reg.errors) console.log('  ✗ ' + e);
if (reg.errors.length) { console.log(`エラー ${reg.errors.length} 件`); process.exit(1); }

const B = reg.rules.board;
const COLORS = reg.all('nodes').filter(n => n.kind === 'color').map(n => n.id);
const [X, Y, Z] = COLORS;

// ---- 2. util ----
ok(fmt(588) === '588', 'fmt 588');
ok(fmt(588214) === '588,214', 'fmt 588,214');
ok(fmt(999999) === '999,999', 'fmt 999,999');
ok(fmt(1.42e7) === '1.42e7', 'fmt 1.42e7: ' + fmt(1.42e7));
ok(fmt(new BigNum(1.2, 1200)) === 'e1.2e3', 'fmt e1.2e3: ' + fmt(new BigNum(1.2, 1200)));
ok(BigNum.from(98).mul(5).mul(1.2).eq(588), 'BigNum 98×5×1.2=588');
ok(new BigNum(1, 400).mul(new BigNum(3, 400)).e === 800, 'BigNum 1.8e308 超え');
ok(new BigNum(5, 20).add(new BigNum(5, 20)).eq(new BigNum(1, 21)), 'BigNum add');
ok(BigNum.from(10).sub(25).lt(0), 'BigNum sub/cmp');
{ const a = makeRng(42), b = makeRng(42); ok([...Array(20)].every(() => a.next() === b.next()), '乱数の再現性'); }

// ---- 3. 隣接 ----
for (let c = 0; c < B.cols; c++) for (let r = 0; r < B.rows; r++) {
  const ns = neighbors(c, r, B.cols, B.rows);
  ok(ns.length <= 6 && ns.length >= 2, `隣接数 (${c},${r})=${ns.length}`);
  for (const [nc, nr] of ns) {
    ok(nc >= 0 && nc < B.cols && nr >= 0 && nr < B.rows, `盤面の外 (${c},${r})→(${nc},${nr})`);
    ok(!(nc === c && nr === r), `自分自身 (${c},${r})`);
    ok(neighbors(nc, nr, B.cols, B.rows).some(([a, b]) => a === c && b === r), `隣接が非対称 (${c},${r})↔(${nc},${nr})`);
  }
}
ok(neighbors(1, 3, B.cols, B.rows).length === 6, '奇数列の内側は6隣接');

// ---- 4. 盤面 ----
const fixedRng = color => ({ next: () => 0.5, int: () => 0, chance: () => false, pick: a => a[0], pickWeighted: a => a.find(n => n.id === color) ?? a[0], shuffle: a => a });
function testBoard() { const b = new Board(reg, makeRng(1)); return b; }
function setCell(b, c, r, color, extra = {}) { b.grid[c][r] = { id: b.uid++, color, cmp: 0, pulse: false, special: null, count: 0, fell: false, ...extra }; }
function necroAll(b) { for (let c = 0; c < b.cols; c++) for (let r = 0; r < b.rows; r++) setCell(b, c, r, null, { special: 'NECROSIS' }); }
function cluster(n) { const cs = []; for (let r = 0; r < b0.rows && cs.length < n; r++) cs.push([0, r]); for (let r = 0; cs.length < n; r++) cs.push([1, r]); return cs; }
const b0 = testBoard();
ok([...b0.cells()].every(x => x.cell), '初期盤面が埋まっている');

for (const [n, want, withCmp] of [[4, 1], [5, 1], [6, 2], [7, 2], [8, 3], [4, 2, 1], [6, 3, 1]]) {
  const b = testBoard(); necroAll(b);
  cluster(n).forEach(([c, r], i) => setCell(b, c, r, X, { fell: i === 0, cmp: withCmp && i === 1 ? withCmp : 0 }));
  const gs = b.findMerges();
  ok(gs.length === 1 && gs[0].length === n, `${n}個の塊が見つかる`);
  const m = gs[0] && b.applyMerge(gs[0]);
  ok(m && m.tier === want, `${n}個${withCmp ? '（CMP入り）' : ''} → 段階${want}（実際 ${m?.tier}）`);
  ok(m && m.removedIds.length === n - 1, `${n}個の合体で ${n - 1} 個が消える`);
}
{ const b = testBoard(); necroAll(b); cluster(6).forEach(([c, r]) => setCell(b, c, r, X)); ok(b.findMerges().length === 0, '落下と無関係な塊は合体しない'); }

// 落ちコンなし：落ちてきた同色3個の縦列が消えずに残る
{
  const b = testBoard(); necroAll(b); b.rng = fixedRng(X);
  setCell(b, 0, 0, Z); for (const r of [1, 2, 3]) setCell(b, 0, r, Y);
  for (const r of [4, 5, 6]) setCell(b, 0, r, X);
  const ys = [1, 2, 3].map(r => b.at(0, r).id);
  const res = b.resolve([4, 5, 6].map(r => ({ c: 0, r })));
  ok(res && res.merges.length === 0, '落ちコン検査：合体が起きない');
  ok([4, 5, 6].every((r, i) => b.at(0, r).id === ys[i] && b.at(0, r).color === Y), '落ちコンなし：落ちた同色3個が残る');
}

// 主脊髄の全色フラグ
{
  const b = testBoard(); necroAll(b);
  setCell(b, 1, 3, X); setCell(b, 2, 3, Y); setCell(b, 3, 3, X);
  const path = [{ c: 1, r: 3 }];
  ok(b.canExtend(path, 2, 3) === null, '臨界なし：主脊髄の別色は繋がらない');
  b.spineWild = true;
  ok(b.canExtend(path, 2, 3) === 'add', '臨界中：主脊髄は全色扱い');
  path.push({ c: 2, r: 3 });
  ok(b.canExtend(path, 3, 3) === 'add', '臨界中：主脊髄を橋に同色へ繋がる');
  ok(b.canExtend(path, 1, 3) === 'back', '直前へ戻ると取り消し');
}

// 特殊ノード：癒着は連結不可・隣が消えると解除、壊死は浄化
{
  const b = testBoard(); necroAll(b); b.rng = fixedRng(Y);
  setCell(b, 0, 4, X); setCell(b, 0, 5, X); setCell(b, 0, 6, X);
  setCell(b, 1, 6, X, { special: 'ADHESION' });
  ok(!b.chainable(1, 6), '癒着は連結に含められない');
  const id = b.at(1, 6).id;
  const res = b.resolve([{ c: 0, r: 4 }, { c: 0, r: 5 }, { c: 0, r: 6 }]);
  const cell = [...b.cells()].find(x => x.cell.id === id)?.cell;
  ok(cell && cell.special === null && cell.color === X, '癒着が解除されて通常ノードに戻る');
  ok(res.released.some(x => x.id === 'NECROSIS' && x.c === 1 && x.r === 4), '隣の壊死が浄化される');
}

// 無作為な連結を繰り返して、盤面の不変条件（35マス・ID重複なし・落ちコンなし）を確かめる
{
  const rng = makeRng(7); const b = new Board(reg, rng); let done = 0;
  const specials = reg.all('nodes').filter(n => n.kind === 'special').map(n => n.id);
  for (let it = 0; it < 400; it++) {
    if (it % 5 === 0) b.placeSpecial(rng.pick(specials));
    b.spineWild = it % 7 === 0;
    const starts = [...b.cells()].filter(x => b.chainable(x.c, x.r));
    const s = rng.pick(starts); if (!s) continue;
    const path = [{ c: s.c, r: s.r }];
    for (let k = 0; k < 12; k++) {
      const last = path[path.length - 1];
      const opts = b.nb(last.c, last.r).filter(([c, r]) => b.canExtend(path, c, r) === 'add');
      if (!opts.length) break; const [c, r] = rng.pick(opts); path.push({ c, r });
    }
    if (path.length < B.minChain) { b.tickSpecials(); continue; }
    const before = new Set([...b.cells()].map(x => x.cell.id));
    const res = b.resolve(path); done++;
    const gone = new Set([...res.chain.cells, ...res.chain.blasted].map(x => x.id));
    res.merges.forEach(m => m.removedIds.forEach(id => gone.add(id)));
    const after = [...b.cells()].map(x => x.cell);
    ok(after.every(Boolean), `#${it} 空きマスが残った`);
    ok(new Set(after.map(x => x.id)).size === after.length, `#${it} ID が重複`);
    const afterIds = new Set(after.map(x => x.id));
    ok([...before].every(id => gone.has(id) || afterIds.has(id)), `#${it} 連結・合体以外でノードが消えた（落ちコン）`);
    ok(after.every(x => !x.fell), `#${it} fell が残った`);
    b.tickSpecials();
  }
  ok(done > 100, `無作為テストの連結数 ${done}`);
}

// ---- 5. 戦闘 ----
{
  const cb = new Combat(reg, makeRng(3), { mode: 'rank_d', floor: 1, enemy: 'e_patrol_d' });
  const mk = (color, n, spineN = 0) => ({ color, cells: Array.from({ length: n }, (_, i) => ({ color, spine: i < spineN, cmp: 0 })), blasted: [], specials: [] });
  const ev = cb.evaluate([mk('MARROW', 5, 1), mk('VENOM', 4), mk('MARROW', 3)]);
  ok(ev.total.eq(588), `仕様書6.2の例が 588（実際 ${fmt(ev.total)}）`);
  ok(ev.base.eq(98) && ev.mult.eq(5), `基礎値98・倍率5（実際 ${fmt(ev.base)}・${fmt(ev.mult)}）`);
  // 長連結・CMP・臨界
  ok(cb.evaluate([mk('MARROW', 6)]).total.eq(75), '6個の連結は ×1.25');
  ok(cb.evaluate([mk('MARROW', 10)]).total.eq(150), '10個の連結は ×1.5');
  const c2 = mk('MARROW', 3); c2.cells[0].cmp = 2;
  ok(cb.evaluate([c2]).total.eq((100 + 20) * 2), `CMP.2 は値×10・倍率+1（実際 ${fmt(cb.evaluate([c2]).total)}）`);
  cb.crit = true; ok(cb.evaluate([mk('MARROW', 3)]).total.eq(90), '脊髄臨界 ×3'); cb.crit = false;
  // 変異因子
  cb.mutagens = ['m_bone_density', 'm_spine_resonance', 'm_alternate'].map(id => reg.get('mutagens', id));
  const ev2 = cb.evaluate([mk('MARROW', 3, 3), mk('VENOM', 3)]);
  // 白骨 (15×2)×3=90、神経毒 6・M+3、交互 M+1 → 96 × 5 × 1.1 × 1.5
  ok(Math.abs(ev2.total.toNumber() - 96 * 5 * 1.1 * 1.5) < 1e-6, `変異因子の計算（実際 ${fmt(ev2.total)}）`);
  ok(ev2.active.size === 3, '条件を満たした変異因子がすべて点灯');
  cb.mutagens = [];
  // '$' の置き換え
  const em = collectEffects([{ id: 't', name: 't', scale: 2.5, effect: fx.perChain(fx.lenAtLeast(3), fx.baseMul('1+$')) }], { chains: [mk('MARROW', 3)] }, 'turn');
  ok(em.length === 1 && em[0].v === 3.5, "'1+$' がレアリティ倍率で置き換わる");
  // 敵HP（仕様書7.2）
  const hp = (m, f) => { const mode = reg.get('modes', m); return enemyHp(mode, f, { hpMul: 1 }, mode.bossFloors.includes(f)).toNumber(); };
  ok(Math.round(hp('rank_d', 3)) === 9600, 'RANK D 第3層ボス HP 9,600');
  ok(Math.abs(hp('rank_a', 10) / 2.06e8 - 1) < 0.01, 'RANK A 中枢神経核 HP 2.1e8');
  // 露出神経で攻撃キャンセル、攻撃は髄鞘外殻が先に受ける
  const c3 = new Combat(reg, makeRng(5), { mode: 'rank_d', floor: 1, enemy: 'e_patrol_d' });
  c3.myelin = 5; c3.enemy.timer = 1; c3.beginFire(); c3.endFire(); c3.enemyPhase();
  ok(c3.sync === 100 - (c3.enemy.def.atk - 5) && c3.myelin === 0, '攻撃は髄鞘外殻が先に受ける');
  c3.enemy.timer = 1; c3.enemy.stunned = true; c3.beginFire(); c3.endFire(); const evs = c3.enemyPhase();
  ok(evs.some(e => e.type === 'stun') && !evs.some(e => e.type === 'attack'), '露出神経の破壊で次の攻撃をキャンセル');
  ok([...c3.board.cells()].some(p => p.cell.special === 'WEAKPOINT'), '予告と同時に露出神経を置く');
  // 逆流汚染
  const c4 = new Combat(reg, makeRng(6), { mode: 'rank_b', floor: 4 });
  ok(c4.backflowOn, 'ボス階層では逆流汚染が有効');
  c4.backflow = 99; c4.sync = 100; c4.beginFire(); c4.endFire(); c4.enemyPhase();
  ok(c4.phase === 'lost', '逆流汚染 100% で即ロスト');
  // アンプル
  const c5 = new Combat(reg, makeRng(8), { mode: 'rank_d', floor: 1, ampoules: ['amp_burn', 'amp_rewind'] });
  ok(c5.useAmpoule(0, { row: 6 }).ok && c5.chains.length === 1 && c5.chains[0].burn, '焼灼アンプルで1列焼却');
  ok(!c5.useAmpoule(1).ok, '逆行アンプルは前のターンがないと使えない');
  // 全アンプル・変異因子が使えること
  for (const a of reg.all('ampoules')) {
    const cc = new Combat(reg, makeRng(9), { mode: 'rank_d', floor: 1, ampoules: [a.id] });
    cc.beginFire(); cc.endFire(); cc.enemyPhase();
    const r = cc.useAmpoule(0, { row: 3, color: 'MARROW', from: 'MARROW', to: 'VENOM' });
    ok(r.ok, `アンプル ${a.name} が使える（${r.reason ?? ''}）`);
  }
  for (const m of reg.all('mutagens')) {
    const cc = new Combat(reg, makeRng(10), { mode: 'rank_d', floor: 1, mutagens: [m.id] });
    let threw = null; try { cc.evaluate([mk('MARROW', 10, 2), mk('VENOM', 8), mk('SYNAPSE', 3)]); cc.fireTime(); } catch (e) { threw = e; }
    ok(!threw, `変異因子 ${m.name} の評価でエラー ${threw?.message ?? ''}`);
  }
}

console.log(`[self-test] ${pass} 件成功 / ${fail} 件失敗`);
console.log(fail ? `エラー ${fail} 件` : 'エラー 0 件');
process.exit(fail ? 1 : 0);

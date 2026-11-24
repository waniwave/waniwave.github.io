// check.mjs — コンテンツの検査とエンジンの自己テスト（node tools/check.mjs）
import { loadPacks } from '../js/engine/registry.js';
import { Board, neighbors, key } from '../js/engine/board.js';
import { Combat, enemyHp } from '../js/engine/combat.js';
import { Game, applyTutorialStep, tutorialDone } from '../js/engine/progress.js';
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
// 1e308 を超える数（深淵）
{
  const big = new BigNum(1.5, 400), big2 = new BigNum(2, 400);
  ok(big.add(big2).eq(new BigNum(3.5, 400)), 'BigNum 1e308 超えの加算');
  ok(big.mul(big2).eq(new BigNum(3, 800)), 'BigNum 1e308 超えの乗算');
  ok(big2.gt(big) && big.lt(big2) && !big.gt(new BigNum(1, 401)), 'BigNum 1e308 超えの比較');
  ok(new BigNum(1, 309).gt(Number.MAX_VALUE) && BigNum.from(Number.MAX_VALUE).lt(new BigNum(1, 309)), 'BigNum と JavaScript の最大値の比較');
  ok(fmt(new BigNum(1.5, 400)) === '1.50e400', 'BigNum 1e308 超えの表示: ' + fmt(new BigNum(1.5, 400)));
  ok(fmt(new BigNum(9.999, 999)) === 'e1.0e3', '桁上がりで二重指数表記: ' + fmt(new BigNum(9.999, 999)));
  ok(new BigNum(1, 400).add(new BigNum(1, 380)).eq(new BigNum(1, 400)), 'BigNum 桁が離れた加算は大きい方');
  ok(BigNum.from(1.35).pow(3000).e === 391, 'BigNum のべき乗（1.35^3000）');
  ok(new BigNum(5, 500).sub(new BigNum(5, 500)).isZero(), 'BigNum 1e308 超えの引き算で0');
}
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
  const mD = reg.get('modes', 'rank_d');
  ok(Math.abs(hp('rank_d', 3) / (mD.hpBase * mD.hpGrowth ** 2 * mD.bossMul) - 1) < 1e-9, '敵HP ＝ 基準値 × 伸び^(階層−1) × ボス倍率（仕様書7.2の式）');
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

// ---- 6. 潜行・成長・保存 ----
{
  // 簡易ボット：1ターンに最長の連結を2本
  const longest = b => {
    let best = null, steps = 0;
    const dfs = p => { if (++steps > 400) return; if (!best || p.length > best.length) best = p.slice(); const l = p.at(-1);
      for (const [c, r] of b.nb(l.c, l.r)) if (b.canExtend(p, c, r) === 'add') { p.push({ c, r }); dfs(p); p.pop(); } };
    for (const x of b.cells()) { if (b.chainable(x.c, x.r)) dfs([{ c: x.c, r: x.r }]); if (steps > 400) break; }
    return best?.length >= b.minChain ? best : null;
  };
  const fightTurn = (g, cb) => {
    cb.beginFire(); g.saveBattle(cb);
    for (let k = 0; k < 2; k++) { const p = longest(cb.board); if (p) cb.commit(p); }
    const r = cb.endFire(); g.recordTurn(cb, r.ev);
    if (!r.won) { cb.enemyPhase(); if (cb.phase === 'think') g.saveBattle(cb); }
  };
  const rng = makeRng(77);
  const g = new Game(reg, rng);
  ok(g.thaw('lin_standard'), '解凍できる');
  ok(!g.thaw('lin_capsule'), '開放前の株は選べない');
  ok(g.startRun('rank_d') && g.run.phase === 'route', '潜行を開始できる');
  ok(!g.startRun('rank_c'), '開放前のモードは選べない');
  ok(g.run.tutorial && g.run.routes.length === 1 && g.run.routes[0].tutorial, '初回の第1層はチュートリアル');
  g.chooseRoute(0);
  let cb = g.makeCombat();
  fightTurn(g, cb);
  // セーブ → 読み込みで状態が同じ
  const j1 = JSON.stringify(g.toJSON());
  const g2 = new Game(reg, makeRng(1), JSON.parse(j1));
  ok(JSON.stringify(g2.toJSON()) === j1, 'セーブ→読み込みで状態が同じ');
  const cb2 = g2.makeCombat();
  ok(cb2.turn === cb.turn && cb2.enemy.hp.eq(cb.enemy.hp) && cb2.sync === cb.sync && JSON.stringify(cb2.board.toJSON()) === JSON.stringify(cb.board.toJSON()), '戦闘の途中から再開できる');
  // 見つからない id は無視
  const bad = JSON.parse(j1);
  bad.vault.push({ uid: 999, tid: 'v_no_such', rarity: 'STANDARD', affixes: [] });
  bad.run.mutagens.push('m_no_such'); bad.ampoules.push('amp_no_such'); bad.protocol.push(42);
  let g3 = null; try { g3 = new Game(reg, makeRng(1), bad); } catch (e) { ok(false, '不明な id で読み込みが失敗: ' + e.message); }
  ok(g3 && !g3.s.vault.some(i => i.uid === 999) && !g3.run.mutagens.includes('m_no_such') && !g3.s.ampoules.includes('amp_no_such'), '見つからない id は捨てる');
  // 最後まで遊ぶ（チュートリアルの HP 保護は外す）
  cb.protectHp = false;
  let guard = 0, result = null;
  while (!result && guard++ < 400) {
    const run = g.run;
    if (run.phase === 'route') { g.chooseRoute(0); cb = g.makeCombat(); if (run.tutorial) cb.protectHp = false; }
    else if (run.phase === 'battle') {
      fightTurn(g, cb);
      if (['won', 'lost', 'closed'].includes(cb.phase)) { const r = g.finishBattle(cb); if (r?.type === 'lost') result = r; }
    } else if (run.phase === 'reward') g.takeReward(run.reward.mutagens.length ? { type: 'mutagen', id: run.reward.mutagens[0], replace: 0 } : { type: 'syn' });
    else if (run.phase === 'final') result = g.extract();
    else if (run.phase === 'choice') { if (run.sync < 40) result = g.extract(); else g.dive(); }
  }
  ok(!!result, `潜行が結果まで進む（${result?.type}）`);
  if (result?.type === 'extract' && result.final) ok(g.has('mode:rank_c') && g.socketCount('THORACIC') === 1, 'RANK D 完遂で RANK C と胸椎が開く');
  // 義体：装着・系統共鳴・副次変異・売却
  const g4 = new Game(reg, makeRng(5)); g4.thaw('lin_vanguard');
  g4.mem.flags.add('socket:THORACIC'); g4.mem.flags.add('socket:LUMBAR'); g4.mem.flags.add('socket:SACRAL');
  const regs = ['CERVICAL', 'THORACIC', 'LUMBAR'];
  for (const region of regs) { const it = g4.rollVertebra({ REFINED: 100 }, { strain: 'SPINE', region }); g4.s.vault.push(it); ok(g4.equip(it.uid, region, 0), `${region} に装着`); ok(it.affixes.length === 1, 'REFINED は副次変異1つ'); }
  ok(g4.resonance().counts.SPINE === 4, '前衛株で脊髄系統が +1（3個で4）');
  ok(g4.sources().some(s => s.id === 'r:SPINE:4') && !g4.sources().some(s => s.id === 'r:SPINE:6'), '系統共鳴4が開き、6は開かない');
  const c6 = new Combat(reg, makeRng(1), { mode: 'rank_d', floor: 1, sources: g4.sources() });
  const mk = (color, n, sp = 0) => ({ color, cells: Array.from({ length: n }, (_, i) => ({ color, spine: i < sp, cmp: 0 })), blasted: [], specials: [] });
  ok(c6.evaluate([mk('SYNAPSE', 3, 3)]).base.toNumber() > 3 * 2 * 3, '共鳴4で主脊髄の倍率が上がる');
  const free = g4.rollVertebra({ STANDARD: 100 }); g4.s.vault.push(free);
  const syn0 = g4.s.syn; ok(g4.sell(free.uid) && g4.s.syn > syn0, '倉庫の義体を売れる');
  // 熟練度と保存処置
  g4.s.diver.points = 40;
  ok(g4.careerLevel() >= 4 && g4.canPreserve(), '熟練 Lv.3 以上で保存処置できる');
  const opts = g4.preserveOptions();
  ok(opts.length === 2, `Lv.4 の候補は2つ（実際 ${opts.length}）`);
  const sp = g4.preserve(0);
  ok(sp && !g4.s.diver && g4.s.specimen === 2 && g4.s.protocol.length === 1 && g4.storedItems().length === 3, '保存処置で引退し、義体は倉庫へ、形質は培養プロトコルへ');
  // 全義体・副次変異・株・形質が評価できる
  for (const t of reg.all('vertebrae')) for (const rid of ['STANDARD', 'FORBIDDEN']) {
    let err = null; try { const c = new Combat(reg, makeRng(2), { mode: 'rank_d', floor: 1, sources: [{ id: t.id, name: t.name, effect: t.effect, scale: t.base * reg.get('rarities', rid).mul }] });
      c.evaluate([mk('MARROW', 10, 2), mk('VENOM', 8), mk('SYNAPSE', 3)]); c.beginFire(); c.endFire(); c.enemyPhase(); } catch (e) { err = e; }
    ok(!err, `義体 ${t.name} の評価でエラー ${err?.message ?? ''}`);
  }
  for (const kind of ['affixes', 'lineages', 'traits']) for (const t of reg.all(kind)) {
    if (!t.effect) continue;
    let err = null; try { const c = new Combat(reg, makeRng(2), { mode: 'rank_b', floor: 4, sources: [{ id: t.id, name: t.name, effect: t.effect, scale: t.base ?? t.values?.[2] ?? 1 }] });
      c.evaluate([mk('MARROW', 10, 2), mk('VENOM', 8)]); } catch (e) { err = e; }
    ok(!err, `${kind} ${t.name} の評価でエラー ${err?.message ?? ''}`);
  }
  for (const st of reg.all('strains')) for (const tier of st.resonance || []) {
    let err = null; try { const c = new Combat(reg, makeRng(2), { mode: 'rank_b', floor: 4, sources: [{ id: 'x', name: 'x', effect: tier.effect, scale: tier.base ?? 1 }] });
      c.sync = 20; c.evaluate([mk('MARROW', 10, 2), mk('VENOM', 8)]); c.beginFire(); c.endFire(); c.enemyPhase(); } catch (e) { err = e; }
    ok(!err, `系統共鳴 ${st.name}${tier.at} でエラー ${err?.message ?? ''}`);
  }
  // チュートリアルの各手順が、検査用のルートで達成できる
  for (const tut of reg.all('tutorial')) for (const step of tut.steps) {
    const c = new Combat(reg, makeRng(3), { mode: tut.mode, floor: tut.floor, enemy: tut.enemy, protectHp: true });
    applyTutorialStep(reg, c, tut, step);
    if (step.crit) c.toggleReserve();
    c.beginFire();
    const log = { chains: [], merges: 0, pulses: 0, crit: c.crit, weakpoint: false };
    for (const p of step.demo) {
      const res = c.commit(p.map(([cc, rr]) => ({ c: cc, r: rr })));
      if (!res) break;
      log.chains.push(res.chain); log.merges += res.merges.length; log.pulses += res.pulses; log.weakpoint ||= res.weakpoint;
    }
    ok(tutorialDone(step, log), `チュートリアル ${step.id} が達成できる`);
    ok(step.title && step.text && step.hint, `チュートリアル ${step.id} に title / text / hint がある`);
  }
  // 練習中の時間停止と、敵を動かさない設定
  {
    const tut = reg.all('tutorial')[0], c = new Combat(reg, makeRng(4), { mode: tut.mode, floor: tut.floor, enemy: tut.enemy, protectHp: true });
    applyTutorialStep(reg, c, tut, tut.steps[0]);
    c.beginFire(); const t0 = c.time; c.tick(3, false);
    ok(c.timeHold && c.time === t0, '時間が止まる手順では発火時間が減らない');
    c.endFire(); const s0 = c.sync; c.enemy.timer = 1; c.enemyPhase();
    ok(c.sync === s0 && c.phase === 'think', '敵が動かない手順では攻撃されずに次のターンへ');
    const st = tut.steps.find(x => x.time); applyTutorialStep(reg, c, tut, st);
    c.beginFire(); const t1 = c.time; c.tick(1, false);
    ok(!c.timeHold && c.time < t1, '時間が動く手順では発火時間が減る');
  }
}

// ---- 7. 深淵 ----
{
  const ab = reg.get('modes', 'abyss');
  ok(ab && ab.unlock === 'mode:abyss', '深淵潜行のモードがある');
  const g = new Game(reg, makeRng(11)); g.thaw('lin_standard');
  ok(!g.startRun('abyss'), 'RANK A 完遂前は深淵に入れない');
  g.emit('MODE_CLEAR', { mode: 'rank_a' });
  ok(g.has('mode:abyss') && g.has('abyss_open') && g.protocolSlots() === 2, 'RANK A 完遂で深淵と培養プロトコル2枠目が開く');
  ok(JSON.stringify(g.startDepths('abyss')) === '[1]', '最初は1層からのみ');
  g.s.records.deepest.abyss = 47;
  ok(JSON.stringify(g.startDepths('abyss')) === '[1,10,20]', '最深47層なら 10・20層から始められる（半分まで）');
  ok(g.startRun('abyss', 20) && g.run.floor === 20, '20層から開始できる');
  ok(g.run.routes.length === 3 || g.run.routes[0].boss, '深淵の分岐は3本');
  g.chooseRoute(0);
  let cb = g.makeCombat();
  ok(cb.backflowOn, '深淵は全階層で逆流汚染');
  const m = g.mode();
  ok(g.pollutionStage(m, 20) === 1 && g.pollutionStage(m, 21) === 2 && g.pollutionStage(m, 61) === 6, '汚染段階は10層ごと');
  ok(g.pollutionSources(m, 61).length === 6 && g.pollutionSources(m, 61)[5].name.includes(m.pollution.stages[0].label), '6段目からは同じ順でもう一度重なる');
  const c41 = new Combat(reg, makeRng(1), { mode: 'abyss', floor: 41, enemy: 'e_abyss_eye', sources: g.pollutionSources(m, 41) });
  ok(Math.abs(c41.fireTime() - (reg.rules.fire.time - 0.3)) < 1e-9 && c41.enemy.interval === 1, '汚染段階：発火時間 −0.3s・攻撃予告が早まる');
  c41.beginFire(); c41.endFire(); const evs = c41.enemyPhase();
  ok(evs.some(e => e.type === 'place' && e.id === 'NECROSIS'), '汚染段階：毎ターン壊死が混ざる');
  ok([5, 10, 15].every(f => new Combat(reg, makeRng(f), { mode: 'abyss', floor: f }).isBoss) && !new Combat(reg, makeRng(2), { mode: 'abyss', floor: 7 }).isBoss, '5層ごとにボス');
  const hp = f => new Combat(reg, makeRng(1), { mode: 'abyss', floor: f, enemy: 'e_abyss_eye' }).enemy.hpMax;
  ok(Math.abs(hp(12).div(hp(11)).toNumber() - 1.35) < 1e-9 && Math.abs(hp(10).div(hp(9)).toNumber() - 1.35 * 1.5) < 1e-9, '深淵の敵HPは 1.35^(層−1)、ボスは ×1.5');
  ok(hp(3000).e > 308, '深い層の敵HPは 1e308 を超えても扱える');
  ok(g.saturation(m, 1) === 1 && g.saturation(m, 100) < 0.5, '深いほど彩度が落ちる');
  // 深度で変わる抽選
  ok(g.modeAt(m, 120).vertebraRarity.LOT_OMEGA > 0 && !g.modeAt(m, 10).vertebraRarity.LOT_OMEGA, '100層以降で LOT-Ω が出る');
  let lot = null; for (let i = 0; i < 50 && !lot; i++) { const it = g.rollVertebra({ LOT_OMEGA: 100 }); if (g.tmpl(it).rarityOnly === 'LOT_OMEGA') lot = it; }
  ok(lot && reg.get('vertebrae', lot.tid).owner, 'LOT-Ω は前世代検体の遺物から出る');
  let leak = false; for (let i = 0; i < 200; i++) if (g.tmpl(g.rollVertebra({ FORBIDDEN: 100 })).rarityOnly) leak = true;
  ok(!leak, 'LOT-Ω 専用の義体は他のレアリティで出ない');
  // LOT-Ω の固有効果
  const src = id => { const t = reg.get('vertebrae', id); return [{ id, name: t.name, effect: t.effect, scale: t.base * 6, kind: 'vertebra' }]; };
  const c2 = new Combat(reg, makeRng(3), { mode: 'abyss', floor: 1, sources: src('v_omega_0533') });
  ok(c2.board.spineCols.length === 2 && c2.board.snap(3, 0).spine, '二重脊柱：主脊髄が2列');
  const c3 = new Combat(reg, makeRng(3), { mode: 'abyss', floor: 1, sources: src('v_omega_0031') });
  ok(c3.board.minChain === 2, '短絡髄節：2個で連結');
  const c4 = new Combat(reg, makeRng(3), { mode: 'abyss', floor: 1, sources: src('v_omega_0412') });
  c4.beginFire(); c4.tick(10);
  ok(c4.phase === 'fire' && c4.time > 0 && c4.tick(1), '残響する椎骨：0秒の後に猶予');
  const c5 = new Combat(reg, makeRng(3), { mode: 'abyss', floor: 1, sources: src('v_omega_0188') });
  c5.gauge = 100; c5.toggleReserve(); c5.beginFire(); c5.endFire();
  ok(c5.gauge >= 50, '炉心の残り火：臨界後にゲージが残る');
  // 補助ソケット・培養プロトコル
  g.emit('DEPTH_REACHED', { mode: 'abyss', floor: 50 });
  ok(g.socketCount('CERVICAL') === 2 && g.protocolSlots() === 3, '50層で頸椎の補助ソケット、30層以上でプロトコル3枠');
  for (const f of [100, 150, 200]) g.emit('DEPTH_REACHED', { mode: 'abyss', floor: f });
  ok(g.mem.flags.has('socket2:SACRAL') && g.protocolSlots() === 5, '200層で補助ソケットが4つ、プロトコル5枠');
  // 深淵のセーブ→読み込み
  const j = JSON.stringify(g.toJSON());
  ok(JSON.stringify(new Game(reg, makeRng(1), JSON.parse(j)).toJSON()) === j, '深淵の潜行中もセーブ→読み込みで同じ');
}

console.log(`[self-test] ${pass} 件成功 / ${fail} 件失敗`);
console.log(fail ? `エラー ${fail} 件` : 'エラー 0 件');
process.exit(fail ? 1 : 0);

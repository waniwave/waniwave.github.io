// 段階1の完了条件を確かめるテスト。  node tools/test.mjs
// 外部のテスト用ライブラリは使わない。

import { readFile, readdir, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Big } from '../engine/big.js';
import { Rng } from '../engine/rng.js';
import { format, formatMul, unitOf } from '../engine/format.js';
import { Hooks, CHAIN_LIMIT, HOOK_NAMES } from '../engine/hooks.js';
import { evaluateHand, cardView, overlapMuls } from '../engine/hand.js';
import {
  createBattle, openBattle, startBattle, play, discard, endTurn, saveBattle, loadBattle,
  addRule, overkillOf, makeBattleCard, standardAt, attachCard, gainItem,
} from '../engine/battle.js';
import { loadNodeBalance, fixtureContent, fixtureDeck, owned } from './fixtures/index.mjs';
import { compileOne } from '../engine/content.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const balance = await loadNodeBalance();

let pass = 0, fail = 0, section = '';
const fails = [];
function group(name) { section = name; console.log(`\n■ ${name}`); }
function ok(cond, name, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; fails.push(`${section}：${name} ${detail}`); console.log(`  ✗ ${name} ${detail}`); }
}
function eq(a, b, name) { ok(a === b, name, a === b ? '' : `（期待 ${JSON.stringify(b)}、実際 ${JSON.stringify(a)}）`); }
function throws(fn, name) { let t = false; try { fn(); } catch { t = true; } ok(t, name); }

// ───────────────────────── 大きな数 ─────────────────────────
group('big.js');
{
  eq(Big.from(2).add(3).toString(), '5', '足す');
  eq(Big.from(10).sub(25).toString(), '-15', '引くと負になる');
  eq(Big.from('1e5000').mul('1e5000').e, 10000, '10の10000乗まで掛けられる');
  eq(Big.from('1e10000').mul('3e12000').toString(), '3e22000', '10の22000乗');
  eq(Big.from('1e10000').add('1e9980').eq('1e10000'), true, '桁が離れた足し算は大きい方');
  eq(Big.from('1e10000').sub('1e10000').isZero(), true, '同じものを引くと0');
  eq(Big.from('5e9999').cmp('1e10000'), -1, '比べる（指数が違う）');
  eq(Big.from('-1e50').lt(1), true, '負の数は小さい');
  ok(Math.abs(Big.from('2e10000').log10() - (10000 + Math.log10(2))) < 1e-9, 'log10');
  eq(Big.from(13750).div(1000).toNumber(), 13.75, '割る');
  const j = JSON.parse(JSON.stringify({ x: Big.from('3.25e12000') }), Big.revive);
  ok(j.x instanceof Big && j.x.eq('3.25e12000'), '保存して戻せる');
  eq(Big.from(0.1).add(0.2).toNumber(), 0.3, '小数の誤差を丸める');
}

// ───────────────────────── 乱数 ─────────────────────────
group('rng.js');
{
  const a = Rng.child('seed1', 'battle', 1, 0), b = Rng.child('seed1', 'battle', 1, 0);
  const sa = Array.from({ length: 5 }, () => a.nextU32()), sb = Array.from({ length: 5 }, () => b.nextU32());
  eq(JSON.stringify(sa), JSON.stringify(sb), '同じシード・用途・番号なら同じ列');
  const c = Rng.child('seed1', 'map', 1, 0);
  ok(c.nextU32() !== Rng.child('seed1', 'battle', 1, 0).nextU32(), '用途が違えば違う列');
  ok(Rng.child('seed1', 'battle', 2, 0).nextU32() !== Rng.child('seed1', 'battle', 1, 0).nextU32(), '階が違えば違う列');
  const r = Rng.fromSeed('x'); r.next(); r.next();
  const st = r.getState();
  const v1 = [r.next(), r.int(1, 6), r.next()];
  const r2 = Rng.fromState(st);
  const v2 = [r2.next(), r2.int(1, 6), r2.next()];
  eq(JSON.stringify(v1), JSON.stringify(v2), '状態を保存して戻すと同じ続き');
  const counts = [0, 0, 0, 0, 0, 0, 0, 0];
  const t = Rng.fromSeed('dist');
  for (let i = 0; i < 8000; i++) counts[t.int(-1, 6) + 1]++;
  ok(counts.every((n) => n > 800 && n < 1200), '整数の乱数が偏らない（−1〜＋6）');
}

// ───────────────────────── 数字の表示 ─────────────────────────
group('format.js');
{
  eq(format(1234), '1,234', '1234 → 1,234');
  eq(format(12345), '1万2345', '1万2345');
  eq(format(10000), '1万', '1万（下の単位が0なら省く）');
  eq(format('3.25e12'), '3兆2500億', '3兆2500億');
  eq(format('1e68'), '1無量大数', '無量大数');
  eq(format('1.2345e71'), '1234無量大数5000不可思議', '無量大数の下に2つ目の単位');
  eq(format('1e72'), '1万 無量大数', '10の72乗から「a 無量大数」');
  eq(format('1e140'), '1万 無量大数²', '1万 無量大数²');
  eq(format('1e680'), '1 ター', 'ター（無量大数の10乗）');
  eq(format('1e1364'), '1万 ター²', '1万 ター²');
  ok(/ター¹⁴$/.test(format('1e10000')), '10の10000乗も壊れない', format('1e10000'));
  eq(format(-12345), '−1万2345', '負の数');
  eq(format('1.23e45', { mode: 'exp' }), '1.2e45', '指数表記');
  eq(formatMul(1.5), '1.5', '倍率の小数');
  eq(unitOf('3.25e12'), '兆', '単位の名前');
  eq(unitOf('1e700'), 'ター', '単位の名前（ター）');
}

// ───────────────────────── 差し込み口 ─────────────────────────
group('hooks.js');
{
  const h = new Hooks();
  const seen = [];
  h.add('score.card', (c, n) => { seen.push('quirk'); n(); }, { group: 'quirk' });
  h.add('score.card', (c, n) => { seen.push('guest'); n(); }, { group: 'guest' });
  h.add('score.card', (c, n) => { seen.push('seat1'); n(); }, { group: 'seat', index: 1 });
  h.add('score.card', (c, n) => { seen.push('relic'); n(); }, { group: 'relic' });
  h.add('score.card', (c, n) => { seen.push('played'); n(); }, { group: 'played' });
  h.add('score.card', (c, n) => { seen.push('seat0'); n(); }, { group: 'seat', index: 0 });
  h.run('score.card', {}, () => seen.push('core'));
  eq(seen.join(','), 'seat0,seat1,played,relic,guest,quirk,core', '席→出した順→置物→宿泊客→層の癖→芯の順');

  const h2 = new Hooks(); let core = 0;
  h2.add('score.card', (c, n) => { n(); n(); });
  h2.run('score.card', {}, () => core++);
  eq(core, 2, 'next を2回呼ぶと2回通る');

  const h3 = new Hooks(); let core3 = 0;
  h3.add('score.card', () => {});
  h3.run('score.card', {}, () => core3++);
  eq(core3, 0, 'next を呼ばなければ元の処理を止める');

  const errs = [];
  const h4 = new Hooks({ onError: (e) => errs.push(e) }); let core4 = 0, after = 0;
  h4.add('score.card', () => { throw new Error('壊れた特注'); }, { group: 'seat' });
  h4.add('score.card', (c, n) => { after++; n(); }, { group: 'guest' });
  h4.on('採点時', () => { throw new Error('合図でも壊れる'); });
  h4.run('score.card', {}, () => core4++);
  h4.emit('採点時', {});
  ok(core4 === 1 && after === 1, '例外を投げた差し込みだけ無かったことにして続く');
  eq(errs.length, 2, '例外は記録に残る');

  const lim = []; const h5 = new Hooks({ onLimit: (e) => lim.push(e) }); let calls = 0;
  for (let i = 0; i < 250; i++) h5.add('score.card', (c, n) => { calls++; n(); });
  h5.beginChain();
  let core5 = 0;
  h5.run('score.card', {}, () => core5++);
  ok(calls === CHAIN_LIMIT && core5 === 1 && lim.length === 1, `連鎖は${CHAIN_LIMIT}回まで（超えた分は飛ばして記録）`, `calls=${calls}`);
  throws(() => h5.add('score.nanika', () => {}), '知らない差し込み口は登録できない');
  ok(HOOK_NAMES.includes('play.after'), '第2章の play.after を差し込み口に含む');
}

// ───────────────────────── 組の判定 ─────────────────────────
group('hand.js：重なり（作り直し仕様 B）');
{
  const V = (cats, enh) => cardView({ cat: cats, enh }, balance);
  const judge = (views, st = []) => evaluateHand(views, balance, st);
  // 1枚だけ：採点
  eq(judge([V(['麺'])]).scored.join(), '0', '1枚だけ出せば採点される');
  // 2枚で同じカテゴリ：両方採点、重なり2
  const r2 = judge([V(['麺']), V(['麺', '湯'])]);
  eq(r2.scored.join(), '0,1', '同じカテゴリの2枚は両方採点');
  eq(r2.overlap.麺, 2, '重なり：麺が2枚');
  eq(r2.overlap.湯, 1, '重なり：湯は1枚');
  // 孤立：他とカテゴリを共有しない札は受け
  const r3 = judge([V(['麺']), V(['麺']), V(['死'])]);
  eq(r3.scored.join(), '0,1', '孤立した札は採点されない');
  eq(r3.kickers.join(), '2', '孤立した札は受け');
  // 全部孤立：一番強い1枚だけ
  const r4 = judge([V(['麺']), V(['死']), V(['宿'])], [10, 35, 10]);
  eq(r4.scored.join(), '1', '全部孤立なら強さが一番高い1枚を採点');
  // つなぎ：麺・湯の札が麺と湯をつなぐ
  const r5 = judge([V(['麺']), V(['麺', '湯']), V(['湯'])]);
  eq(r5.scored.length, 3, '2カテゴリの札が橋になって3枚とも採点');
  // 多才：全カテゴリ
  const r6 = judge([V(['麺']), V(['死'], '多才')]);
  eq(r6.scored.length, 2, '多才は全カテゴリを持つので何とでも重なる');
  // 石：カテゴリを持たず必ず採点
  const r7 = judge([V(['麺'], '石'), V(['死']), V(['死'])]);
  eq(r7.scored.join(), '0,1,2', '石は必ず採点');
  eq(r7.overlap.死, 2, '石は重なりに数えない');
  // 倍率の表
  const mul = (o) => overlapMuls(o, balance).reduce((m, x) => m * x.x, 1);
  eq(mul({ 麺: 1 }), 1, '1枚は×1');
  eq(mul({ 麺: 2 }), 1.5, '2枚は×1.5');
  eq(mul({ 麺: 5 }), 3, '5枚は×3');
  eq(mul({ 麺: 5, 食べ物: 4 }), 3 * 2.5, '2つのカテゴリは掛け合わせ（5枚×3 と 4枚×2.5）');
  // Tier は番付から
  eq(cardView({ cat: ['麺', '死'] }, balance, { 死: 'God' }).tier, 'God', '札のTier＝カテゴリのうち一番高い段');
  eq(cardView({ cat: ['麺'] }, balance, {}).tier, '3', '番付に無ければ始めの段（Tier3）');
  eq(cardView({ cat: ['麺'], tier: '1' }, balance, { 麺: 'God' }).tier, '1', '札にTierの固定があればそれ');
}

// ───────────────────────── 計算の順番 ─────────────────────────
// 試し用：手札を指定して1回出す
async function oneShot({ hand, enemies = [{ claim: 1e9 }], seats = [], regulars = [], rules = [], cards = [], banzuke = {}, play: pl, target = 0, hp = 70 }) {
  const content = fixtureContent({ regulars, rules, cards, enemies: [{ id: 'en_dummy', name: '的', kind: '通常', hp: 1, atk: 0, acts: ['溜め'] }] });
  const base = { balance, content };
  const B = createBattle(base, { seed: 't', floor: 1, hp, deck: [], enemies: enemies.map(() => 'en_dummy'), seats, banzuke });
  enemies.forEach((e, i) => { B.enemies[i].claim = Big.from(e.claim); B.enemies[i].maxClaim = Big.from(e.claim); });
  const env = openBattle(base, B);
  startBattle(B, env);
  B.hand = hand.map(([id, attrs], i) => makeBattleCard(owned(id, `h${i}`, attrs || {}), content.cards[id]));
  for (const c of B.hand) attachCard(env, c);
  const res = play(B, env, pl ?? hand.map((_, i) => i), target);
  return { B, env, res };
}

group('score.js：計算の順番');
{
  // 同じ〈動物〉の2枚（Tier3＝強さ10）：ホロ（M＋10）と多色（M×1.5）の順番。最後に重なり×1.5
  const holoFirst = await oneShot({ hand: [['fx_neko', { ed: 'ホロ' }], ['fx_inu', { ed: '多色' }]] });
  eq(holoFirst.res.hand, '重なり', '組は無く、重なりだけ');
  eq(holoFirst.res.V.toNumber(), 495, '足してから掛ける：(10+10)×((1+10)×1.5×1.5)＝495');
  const polyFirst = await oneShot({ hand: [['fx_neko', { ed: '多色' }], ['fx_inu', { ed: 'ホロ' }]] });
  eq(polyFirst.res.V.toNumber(), 345, '掛けてから足す：(10+10)×((1×1.5+10)×1.5)＝345');
  const types = holoFirst.res.steps.map((s) => s.type).join(',');
  eq(types, 'hand,S,M,S,xM,xM,final', '手順列：土台→札1の強さ→ホロ→札2の強さ→多色→重なり→最後');
  ok(holoFirst.res.steps.some((s) => s.src?.kind === 'overlap' && s.src.id === '動物' && s.src.n === 2), '重なりの手順は出どころ overlap（動物2枚）');

  // 常連客：席の左から
  const regs = [
    { id: 'rg_plus4', name: '倍率＋4の客', on: { 出し: (sc) => sc.addM(4, { kind: 'regular', name: '倍率＋4の客' }) } },
    { id: 'rg_x2', name: '×2の客', on: { 出し: (sc) => sc.mulM(2, { kind: 'regular', name: '×2の客' }) } },
  ];
  const addThenMul = await oneShot({ hand: [['fx_neko']], regulars: regs, seats: [owned('rg_plus4', 1), owned('rg_x2', 2)] });
  eq(addThenMul.res.V.toNumber(), 100, '席の左から：＋4 → ×2 で 10×((1+4)×2)＝100');
  const mulThenAdd = await oneShot({ hand: [['fx_neko']], regulars: regs, seats: [owned('rg_x2', 2), owned('rg_plus4', 1)] });
  eq(mulThenAdd.res.V.toNumber(), 60, '席を入れ替える：×2 → ＋4 で 10×(1×2+4)＝60');

  // 札の強さ＝カテゴリのTier（一番高いもの）
  const bz = await oneShot({ hand: [['fx_maap']], banzuke: { 宿: '2', 老: 'God' } });
  eq(bz.res.V.toNumber(), 60, '〈宿〉T2と〈老〉Godなら強さはGodの60');
  const low = await oneShot({ hand: [['fx_hone']], banzuke: { 死: '5' } });
  eq(low.res.V.toNumber(), 3, 'Tier5の強さは3');

  // 仕込み・判
  const glass = await oneShot({ hand: [['fx_neko', { enh: '硝子' }]] });
  eq(glass.res.V.toNumber(), 20, '硝子：M×2');
  const stone = await oneShot({ hand: [['fx_neko', { enh: '石' }], ['fx_soba'], ['fx_udon']] });
  eq(stone.res.V.toNumber(), (50 + 10 + 10) * 1.5, '石：カテゴリを持たず必ず採点され S＋50。麺2枚は重なる');
  const red = await oneShot({ hand: [['fx_neko', { seal: '朱判' }]] });
  eq(red.res.V.toNumber(), 20, '朱判：採点をもう一度');
  const gold = await oneShot({ hand: [['fx_neko', { seal: '金判' }]] });
  eq(gold.B.zeni, 3, '金判：採点されると宿銭＋3');
  const steel = await oneShot({ hand: [['fx_neko'], ['fx_sure', { enh: '鋼' }]], play: [0] });
  eq(steel.res.V.toNumber(), 15, '鋼：手札に残ったまま出すと M×1.5');

  // ルール（特注の形）：処理を2回通す
  const nibai = { name: '試しの二倍', hooks: { 'score.card': (c, n) => { n(); n(); } } };
  const ruleCard = { id: 'fx_nibai', name: '仮・二倍', cat: ['動物'], hooks: {
    'play.before': (ctx, n) => { addRule(ctx.battle, ctx.env, { name: '試しの二倍', scope: 'play' }); n(); },
  } };
  const dbl = await oneShot({ hand: [['fx_nibai'], ['fx_neko']], rules: [nibai], cards: [ruleCard] });
  eq(dbl.res.V.toNumber(), (10 + 10) * 2 * 1.5, '差し込み口を通る：二倍のルールで採点が2回ずつ');
  ok(dbl.B.rules.length === 0, '「この出し」のルールは出しの後に外れる');

  // レアリティ：量の効果は mul 倍、効果の無い札はレジェンダリーから複数回
  const vanL = await oneShot({ hand: [['fx_neko', { rar: 'レジェンダリー' }]] });
  eq(vanL.res.V.toNumber(), 20, '効果の無い札：レジェンダリーは2回採点');
  const vanM = await oneShot({ hand: [['fx_neko', { rar: 'ミシック' }]] });
  eq(vanM.res.V.toNumber(), 50, '効果の無い札：ミシックは5回採点');
  const fxCard = { id: 'fx_plus', name: '仮・強さ＋10', cat: ['麺'], fx: [{ when: '採点時', do: [{ 強さ: 10 }] }] };
  const rC = await oneShot({ hand: [['fx_plus']], cards: [fxCard] });
  eq(rC.res.V.toNumber(), 20, '量の効果：コモンは＋10（10＋10）');
  const rU = await oneShot({ hand: [['fx_plus', { rar: 'ユニーク' }]], cards: [fxCard] });
  eq(rU.res.V.toNumber(), 60, '量の効果：ユニークは×5で＋50（10＋50）');
  const rAff = await oneShot({ hand: [['fx_neko', { rar: 'レア', ins: ['af_sharp'] }]] });
  ok(rAff.res.V.toNumber() >= 10, '刻印の付いた札も出せる');
}

// ───────────────────────── 貫通と過剰論破 ─────────────────────────
group('battle.js：貫通と過剰論破');
{
  // 1枚（T3）は V＝10
  const p1 = await oneShot({ hand: [['fx_neko']], enemies: [{ claim: 4 }, { claim: 5 }, { claim: 100 }], target: 1 });
  eq(p1.B.enemies.map((e) => e.claim.toNumber()).join(), '4,0,95', '貫通：狙った敵を倒した残りは右隣へ');
  const p2 = await oneShot({ hand: [['fx_neko']], enemies: [{ claim: 3 }, { claim: 5 }, { claim: 2 }], target: 1 });
  eq(p2.B.enemies.map((e) => e.claim.toNumber()).join(), '0,0,0', '貫通：右端まで行ったら左端へ');
  eq(p2.B.result, 'win', '全滅で勝ち');
  ok(p2.B.log.filter((l) => l.t === 'damage' && l.pierce).length === 2, '手順列に貫通が残る');

  // 〈ター〉God×5（ホロ付き）：S＝5×60＝300、M＝(1＋5×10)×3＝153 → V＝45900
  const god5 = Array.from({ length: 5 }, () => ['fx_god', { ed: 'ホロ' }]);
  const cases = [[100000, null], [20000, '論破'], [4000, '大論破'], [400, '完全論破'], [40, 'ター深']];
  for (const [claim, level] of cases) {
    const r = await oneShot({ hand: god5, enemies: [{ claim }], banzuke: { ター: 'God' } });
    eq(r.B.overkill?.level ?? null, level, `過剰論破：主張${claim}、r＝${45900 / claim} → ${level ?? 'なし'}`);
  }
  const tb = await oneShot({ hand: god5, enemies: [{ claim: 40 }], banzuke: { ター: 'God' } });
  eq(JSON.stringify(tb.B.overkill.rewards), JSON.stringify({ zeni: 42, extraCards: 1, gradeUp: 1, godChance: 0.5 }), 'ター深は下の段の上乗せも全て得る（宿銭 2+5+10+25）');
  eq(tb.B.zeni, 42, '過剰論破の宿銭が入る');
  const two = await oneShot({ hand: god5, enemies: [{ claim: 15000 }, { claim: 5000 }], banzuke: { ター: 'God' } });
  eq(two.B.overkill.level, '論破', '過剰論破は戦闘開始時の主張合計で割る（45900÷20000）');
  eq(overkillOf(balance, Big.from(1.99)).level, null, 'r＜2 は過剰論破なし');
}

// ───────────────────────── 敵の行動 ─────────────────────────
group('battle.js：敵の行動と手番');
{
  const content = fixtureContent({ enemies: [
    { id: 'en_t_tame', name: '溜め役', kind: '通常', hp: 1, atk: 1, acts: ['溜め', '攻め'] },
    { id: 'en_t_zen', name: '全体', kind: '通常', hp: 1, atk: 1, acts: ['全体攻め'] },
    { id: 'en_t_fu', name: '封じ役', kind: '通常', hp: 1, atk: 0, acts: [{ 封じ: '流し' }, { 格下げ: 1 }, '席を奪う', { 伏せ: 2 }, { 呼ぶ: 'en_t_tame' }] },
  ] });
  const base = { balance, content };
  const mk = (enemies, o = {}) => {
    const B = createBattle(base, { seed: 'act', floor: 1, hp: 100, deck: fixtureDeck(), enemies, ...o });
    const env = openBattle(base, B); startBattle(B, env); return { B, env };
  };
  // 溜め → 攻め×2
  { const { B, env } = mk(['en_t_tame']); const atk = B.enemies[0].atk;
    endTurn(B, env); endTurn(B, env);
    eq(100 - B.hp, atk * 2, `溜めの次の攻めは×2（攻撃${atk}）`); }
  // 全体攻め：受けを無視する分が半分
  { const { B, env } = mk(['en_t_zen']); const atk = B.enemies[0].atk;
    B.guard = 1000; endTurn(B, env);
    eq(100 - B.hp, Math.floor(atk / 2), '全体攻めは半分が受けを無視する'); }
  // 封じ・格下げ・席を奪う・伏せ・呼ぶ
  { const regs = [{ id: 'rg_a', name: '客A' }];
    const base2 = { balance, content: { ...content, regulars: { rg_a: regs[0] } } };
    const B = createBattle(base2, { seed: 'act', floor: 1, hp: 100, deck: fixtureDeck(), enemies: ['en_t_fu'], seats: [owned('rg_a', 1)], banzuke: { 麺: '1' } });
    const env = openBattle(base2, B); startBattle(B, env);
    endTurn(B, env);
    ok(B.sealed.discard, '封じ（流し）');
    throws(() => discard(B, env, [0]), '封じられた流しは使えない');
    endTurn(B, env);
    eq(B.banzuke['麺'], '2', '格下げ：番付で一番高い〈麺〉T1→T2');
    endTurn(B, env);
    ok(B.seats[0].disabled, '席を奪う：左端の常連客が無効');
    endTurn(B, env);
    eq(B.hand.filter((c) => c.faceDown).length, 2, '伏せ2：次のターン手札2枚が裏向き');
    endTurn(B, env);
    eq(B.enemies.length, 2, '呼ぶ：敵が増える');
  }
  // 体力0で未帰還
  { const { B, env } = mk(['en_t_tame'], { hp: 1 }); endTurn(B, env); endTurn(B, env);
    eq(B.result, 'lose', '体力が0になった瞬間に未帰還'); }
  // 手札は持ち越す・山札が尽きたら切り直す
  { const { B, env } = mk(['en_t_tame']);
    eq(B.hand.length, 8, '手札は上限8まで引く');
    B.enemies[0].claim = Big.from('1e30');
    play(B, env, [0], 0); endTurn(B, env);
    eq(B.hand.length, 8, '持ち越した手札に足して8まで');
    for (let i = 0; i < 8 && !B.result; i++) { if (B.playsLeft > 0) play(B, env, B.hand.slice(0, 5).map((_, k) => k), 0); else endTurn(B, env); }
    ok(!B.result && B.log.some((l) => l.t === 'reshuffle'), '山札が尽きたら捨て札を切って山札にする'); }
  // 標準値
  eq(standardAt(balance, 1).claim.toNumber(), balance.curve.floors[1].claim, `標準の主張 B1＝${balance.curve.floors[1].claim}（curve.yaml の値）`);
  eq(standardAt(balance, 18).claim.toNumber(), balance.curve.floors[16].claim * 9, 'B17以降は前の階×3');
  eq(standardAt(balance, 18).atk, balance.curve.floors[16].atk + 8, 'B17以降の攻撃は前の階＋4');
  const grp = createBattle({ balance, content: fixtureContent() }, { seed: 's', floor: 1, hp: 70, deck: [], enemies: ['en_copipe', 'en_copipe'] });
  eq(grp.enemies.reduce((s, e) => s + e.claim.toNumber(), 0), balance.curve.floors[1].claim, '複数体の通常戦は主張の合計が標準値');
}

// ───────────────────────── 保存して続ける ─────────────────────────
group('battle.js：保存と読み直し');
{
  const content = fixtureContent();
  const base = { balance, content };
  const run = (saveAt) => {
    let B = createBattle(base, { seed: 'save', floor: 1, hp: 70, deck: fixtureDeck(), enemies: ['en_niwaka', 'en_kaiko'] });
    let env = openBattle(base, B); startBattle(B, env);
    let step = 0;
    while (!B.result && B.turn < 30) {
      if (step === saveAt) { B = loadBattle(saveBattle(B)); env = openBattle(base, B); }
      if (B.playsLeft > 0) play(B, env, [0, 1], 0); else endTurn(B, env);
      step++;
    }
    return saveBattle(B);
  };
  const plain = run(-1), resumed = run(3);
  eq(resumed, plain, '途中で保存して読み直しても、同じ状態から同じ結果で続く');
}

// ───────────────────────── 同じシードなら同じ ─────────────────────────
group('sim-battle.mjs');
{
  const sim = (seed) => execFileSync(process.execPath, [path.join(ROOT, 'tools/sim-battle.mjs'), '--seed', seed], { encoding: 'utf8' });
  const a = sim('42'), b = sim('42'), c = sim('7');
  ok(a.length > 200 && a === b, '同じシードなら出力が毎回同じ');
  ok(a !== c, 'シードが違えば出力が違う');
  ok(/勝ち|未帰還/.test(a), '戦闘が最後まで進む');
}

// ───────────────────────── engine/ の決まり ─────────────────────────
group('engine/ の決まり');
{
  const files = [];
  const walk = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p); else if (p.endsWith('.js')) files.push(p);
    }
  };
  await walk(path.join(ROOT, 'engine'));
  const bad = [];
  for (const f of files) {
    const src = (await readFile(f, 'utf8')).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const w of ['document', 'window', 'localStorage', 'Math.random', 'Date.now']) {
      if (new RegExp(`\\b${w.replace('.', '\\.')}\\b`).test(src)) bad.push(`${path.relative(ROOT, f)}: ${w}`);
    }
  }
  eq(bad.join(' / '), '', 'document・window・localStorage・Math.random・Date.now を使っていない');
  const ids = [];
  for (const f of files) {
    const src = await readFile(f, 'utf8');
    for (const m of src.matchAll(/['"](fx_|en_|rk_|tj_|mp_)[a-z_]+['"]/g)) ids.push(`${path.relative(ROOT, f)}: ${m[0]}`);
  }
  eq(ids.join(' / '), '', '札や敵の個別のIDが engine/ に書かれていない');
}


// ═════════════════════════ 段階2：コンテンツの仕組み ═════════════════════════
const { runCheck, scanIndex, indexText } = await import('./check.mjs');
const { contentGuide, hooksDoc } = await import('./docs.mjs');
const { loadContent, runSelfTest } = await import('../engine/content.js');
const { createVocab } = await import('../engine/vocab/index.js');
const { parseExpr, evalExpr } = await import('../engine/vocab/expr.js');
const { guestAction, guestStatus, useItem } = await import('../engine/battle.js');
const { cp, rm, writeFile: wf, mkdtemp, appendFile } = await import('node:fs/promises');
const os = await import('node:os');

group('語彙：仕様書第9章の名前が全てある');
{
  const v = createVocab();
  const spec = {
    when: '採点時 手札に残る 受けに回る 出し 出しの前 出しの後 流した時 引いた時 ターン開始 ターン終了 戦闘開始 戦闘終了 敵を倒した時 過剰論破の時 敵の行動の前 階に入った時 部屋に入った時 踊り場 脱出時',
    if: '重なり以上 カテゴリの種類以上 効果なし 効果なしの札 レアリティ以上 カテゴリ 採点札のカテゴリ Tier Tier以上 番付 採点枚数 手札枚数以下 山札枚数以下 このターンの出し 戦闘のターン以上 体力の割合以下 階以上 気配以上 深度以上 敵の種類 敵の数 手札の位置 採点の順番 由来 確率 どれか すべて でない',
    do: '強さ 倍率 掛け 受け 体力 引く 捨てる 出し回数 流し回数 手札上限 番付を上げる 番付を下げる 番付を入れ替える 番付を移す 番付を反転 番付を均す 札を変える 札を生む 札を消す 主張を削る 行動停止 行動を消す 宿銭 お品書きを得る お土産を得る 気配 脱出 育つ ルール',
    rule: '処理回数 全札を採点 重なりを1枚多く 全札を同カテゴリ扱い 全札を同Tier扱い 採点順を逆に 採点順を並べ替える 番付を反転 番付を固定 番付倍率をN倍 受けを無効 受けを攻撃に加える 採点札を限定 出せる枚数を固定 戦闘を即終了 敵の行動を乱数に 手札を公開 山札の上を見る・並べ替える 倍率の下限を変える 効果文を偽る 伏せ字 演出を早送り不可に 宿泊客の仕組みを入れ替える',
    show: '揺れ 白飛び 暗転 二重像 文字二回 筆文字 カットイン 吹き出し スタンプ 文字化け 伏せ字 取り消し線 背景色 水没 紙吹雪 画面反転 横切る 増殖 行進 うなずき 角以外を暗く 斬る 読み込み中 早口字幕 ガチャ 音 BGMを止める 心音 振動',
    act: '攻め 全体攻め 居座り 伏せ 封じ 格下げ 席を奪う 溜め 呼ぶ',
  };
  for (const [kind, names] of Object.entries(spec)) {
    const miss = names.split(' ').filter((n) => !v.has(kind, n));
    eq(miss.join('、'), '', `${kind}：${names.split(' ').length}個`);
  }
  ok(v.list('do').every((d) => d.text && d.run) && v.list('if').every((d) => d.text && d.test), '語彙は名前・説明1行・引数の形・実装を持つ');
  throws(() => v.register('rule', { name: '二重', text: 'x' }) && v.register('rule', { name: '二重', text: 'y' }), '同じ名前は二重に登録できない');
}

group('式の評価');
{
  const look = (n) => ({ 熟成: 4, 育ち: 0.25 }[n] ?? NaN);
  eq(evalExpr('熟成*3', look), 12, '"熟成*3"');
  eq(evalExpr('1+育ち', look), 1.25, '"1+育ち"');
  eq(evalExpr('(1+熟成)×2−3÷3', look), 9, '括弧と全角の記号');
  eq(evalExpr('-熟成+10', look), 6, '負の数');
  throws(() => parseExpr('1+'), '途中で終わる式は読めない');
  throws(() => evalExpr('なにか*2', look), '値のない名前は計算できない');
  const src = await readFile(path.join(ROOT, 'engine/vocab/expr.js'), 'utf8');
  ok(!/\beval\s*\(|new Function/.test(src.replace(/\/\/.*$/gm, '')), 'eval も Function も使っていない');
}

group('content.js と check.mjs');
{
  const res = await runCheck();
  eq(res.errors, 0, 'content/ はエラー0');
  eq(res.failed, 0, `自己テストが全て通る（${res.results.length}件）`);
  const names = res.results.map((r) => r.where);
  for (const k of ['二倍#1', '交互#1', '宣言#1', '名乗り#1', '採配#1']) ok(names.includes(k) && res.results.find((r) => r.where === k).ok, `自己テスト ${k}`);
  ok(res.content.cards.rk_jujo_satosatoru && res.content.vocab.has('rule', '二倍'), '十条さとさとると二倍が content/ から読まれる');
  ok(res.lines.every((l) => !l.includes('\n')), '出力は1件1行');

  // わざと間違えた札
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'taabuka-'));
  await cp(path.join(ROOT, 'content'), tmp, { recursive: true });
  await appendFile(path.join(tmp, 'sets/ryukogo/cards.yaml'), `
- id: rk_ahe
  name: 間違えた札
  cat: [麺類]
  tier: 7
  grade: 特上
  fx:
    - when: 採点時
      do:
        - 主張を削り取る: { 対象: 狙い }
        - 倍率: 熟生*3
`);
  const bad = await runCheck({ root: tmp });
  const has = (s) => bad.lines.some((l) => l === s);
  ok(bad.lines.some((l) => l.startsWith('[語彙] rk_ahe: 知らない効果「主張を削り取る」。候補：主張を削る')), '知らない効果を1行で指摘し、候補を出す', bad.lines.join(' / '));
  ok(bad.lines.some((l) => l.startsWith('[形] rk_ahe: 知らないカテゴリ「麺類」。候補：麺')), '知らないカテゴリに候補');
  ok(bad.lines.some((l) => l.startsWith('[形] rk_ahe: tier は書かない')), '札に tier を書くと指摘（札の強さはカテゴリのTier）');
  ok(bad.lines.some((l) => l.includes('知らない名前「熟生」。候補：熟成')), '式の知らない名前に候補');
  ok(bad.errors >= 4, 'エラーとして数える');
  // 索引にないファイル
  await mkdir(path.join(tmp, 'sets/newset'), { recursive: true });
  await wf(path.join(tmp, 'sets/newset/set.yaml'), 'id: newset\nname: 新\nunlock: { start: true }\n');
  const idx = await runCheck({ root: tmp });
  ok(idx.lines.some((l) => l.startsWith('[索引] content/sets/newset/set.yaml が index.yaml に無い')), 'index.yaml に無いファイルを指摘');
  await runCheck({ root: tmp, fixIndex: true });
  const after = await runCheck({ root: tmp });
  ok(!after.lines.some((l) => l.startsWith('[索引]')), '--fix-index で直る');
  // ID の重複と参照先
  await appendFile(path.join(tmp, 'sets/newset/set.yaml'), '');
  await wf(path.join(tmp, 'sets/newset/cards.yaml'), '- { id: rk_shineei, name: 重複, cat: [死], tier: 1, grade: 並 }\n- { id: nw_a, name: 参照, cat: [死], tier: 1, grade: 並, fx: [{ when: 採点時, do: [{ 札を生む: { id: nw_nai } }] }] }\n');
  await runCheck({ root: tmp, fixIndex: true });
  const ref = await runCheck({ root: tmp });
  ok(ref.lines.some((l) => l.startsWith('[ID] rk_shineei: IDが重複している')), 'IDの重複を指摘');
  ok(ref.lines.some((l) => l.startsWith('[参照] nw_a: 札「nw_nai」が無い')), '参照先が無いことを指摘');
  await rm(tmp, { recursive: true, force: true });

  // 雛形が検査を通る
  const tmp2 = await mkdtemp(path.join(os.tmpdir(), 'taabuka-'));
  await cp(path.join(ROOT, 'content/balance'), path.join(tmp2, 'balance'), { recursive: true });
  await mkdir(path.join(tmp2, 'sets/xx/custom'), { recursive: true });
  await mkdir(path.join(tmp2, 'enemies'), { recursive: true });
  await wf(path.join(tmp2, 'sets/xx/set.yaml'), 'id: xx\nname: 雛形\nunlock: { start: true }\n');
  for (const [t, f] of [['card.yaml', 'cards.yaml'], ['regular.yaml', 'regulars.yaml'], ['relic.yaml', 'relics.yaml'], ['item.yaml', 'items.yaml']]) {
    await cp(path.join(ROOT, 'docs/templates', t), path.join(tmp2, 'sets/xx', f));
  }
  await cp(path.join(ROOT, 'docs/templates/custom.js'), path.join(tmp2, 'sets/xx/custom/hinagata.js'));
  await cp(path.join(ROOT, 'docs/templates/enemy.yaml'), path.join(tmp2, 'enemies/layer1.yaml'));
  await mkdir(path.join(tmp2, 'keywords'), { recursive: true });
  await cp(path.join(ROOT, 'docs/templates/keyword.yaml'), path.join(tmp2, 'keywords/base.yaml'));
  await mkdir(path.join(tmp2, 'events'), { recursive: true });
  await cp(path.join(ROOT, 'docs/templates/event.yaml'), path.join(tmp2, 'events/layer1.yaml'));
  await cp(path.join(ROOT, 'docs/templates/souvenir.yaml'), path.join(tmp2, 'souvenirs.yaml'));
  const tpl = await runCheck({ root: tmp2, fixIndex: true });
  eq(tpl.errors + tpl.failed, 0, '雛形（札・常連客・置物・お品書き・キーワード・敵・謎・お土産・特注）が検査を通る'); if (tpl.errors + tpl.failed) console.log(tpl.lines.join('\n'));
  if (tpl.errors + tpl.failed) console.log(tpl.lines.join('\n'));
  await rm(tmp2, { recursive: true, force: true });
}

group('docs/ の自動書き出し');
{
  const res = await runCheck();
  const guide = contentGuide(res.content);
  const hooks = hooksDoc();
  const onDisk = await readFile(path.join(ROOT, 'docs/content-guide.md'), 'utf8').catch(() => '');
  const hooksDisk = await readFile(path.join(ROOT, 'docs/hooks.md'), 'utf8').catch(() => '');
  ok(onDisk === guide, 'docs/content-guide.md が語彙の登録内容と一致（--docs で書き出したまま）');
  ok(hooksDisk === hooks, 'docs/hooks.md が差し込み口の登録内容と一致');
  const v = res.content.vocab;
  ok(['when', 'if', 'do', 'rule', 'show', 'act', 'var'].every((k) => v.names(k).every((n) => guide.includes(`\`${n}\``))), '手引きに全ての語彙が載っている');
  ok(guide.includes('二倍`（特注：sets/ryukogo/custom/nibai.js）'), '特注の語彙も手引きに載る');
  ok(HOOK_NAMES.every((h) => hooks.includes(`\`${h}\``)), 'hooks.md に全ての差し込み口が載っている');
  for (const t of ['card.yaml', 'regular.yaml', 'relic.yaml', 'item.yaml', 'enemy.yaml', 'layer.yaml', 'event.yaml', 'guest.yaml', 'souvenir.yaml', 'custom.js']) {
    ok((await readFile(path.join(ROOT, 'docs/templates', t), 'utf8').catch(() => '')).length > 50, `docs/templates/${t}`);
  }
}

group('特注が例外を投げても止まらない');
{
  const content = fixtureContent({
    rules: [{ name: '壊れたルール', hooks: { 'score.card': () => { throw new Error('ルールが壊れた'); } } }],
    mechanics: [{ name: '壊れた仕組み', on: { ターン開始: () => { throw new Error('仕組みが壊れた'); }, 採点時: () => { throw new Error('採点でも壊れた'); } } }],
    enemyCustoms: [{ name: '壊れた敵', hooks: { 'enemy.act': () => { throw new Error('敵が壊れた'); } } }],
    enemies: [{ id: 'en_broken', name: '壊れた敵', kind: '通常', hp: 1, atk: 1, acts: ['攻め'], custom: '壊れた敵' }],
    guests: [{ id: 'g_broken', name: '壊れた客', hp: 70, mechanic: '壊れた仕組み', state: {}, params: {} }],
  });
  const base = { balance, content };
  const B = createBattle(base, { seed: 'boom', floor: 1, deck: fixtureDeck(), enemies: ['en_broken', 'en_teiki'], guest: 'g_broken' });
  const env = openBattle(base, B);
  startBattle(B, env);
  addRule(B, env, { name: '壊れたルール', scope: 'battle', owner: { kind: 'card', name: '試し' } });
  let guard = 0;
  while (!B.result && guard++ < 600) { if (B.playsLeft > 0) play(B, env, B.hand.slice(0, Math.min(5, B.hand.length)).map((_, i) => i), 0); else endTurn(B, env); }
  ok(B.result === 'win' || B.result === 'lose', `戦闘が最後まで進む（${B.result}）`);
  const errs = B.log.filter((l) => l.t === 'error');
  for (const m of ['ルールが壊れた', '仕組みが壊れた', '採点でも壊れた', '敵が壊れた']) ok(errs.some((e) => e.message === m), `記録に残る：${m}`);
  ok(errs.every((e) => e.hook && e.owner), '記録には差し込み口と持ち主が入る');
}

group('content/ の札と宿泊客で戦う');
{
  const { content } = await runCheck();
  const C = { ...content, cards: { ...content.cards, ...fixtureContent().cards }, enemies: fixtureContent().enemies };
  const base = { balance, content: C };
  // 十条さとさとるの二倍：engine/ ではなく content/ の特注だけで動く
  const B = createBattle(base, { seed: 'jujo', floor: 1, deck: [], enemies: [{ id: 'en_teiki' }], guest: 'maap' });
  const env = openBattle(base, B);
  startBattle(B, env);
  B.enemies[0].claim = Big.from('1e9');
  C.cards.t_nibai = compileOne(C, { id: 't_nibai', name: '試し二倍', cat: ['ター'], grade: '並', kw: ['二倍'], fx: [{ when: '採点時', do: [{ 行動停止: { 対象: '狙い', ターン: 2 } }] }], show: [{ カットイン: '二倍' }] }, 'cards');
  B.hand = [makeBattleCard(owned('t_nibai', 1), C.cards.t_nibai), makeBattleCard(owned('fx_god', 2), C.cards.fx_god)];
  B.hand.forEach((c) => attachCard(env, c));
  const r = play(B, env, [0, 1], 0);
  eq(r.V.toNumber(), 60, '二倍：ター2枚 (10＋10)×2、重なり×1.5＝60');
  eq(B.enemies[0].skip, 4, '二倍で行動停止も2回（4ターン）');
  ok(r.fx.some((f) => f.show === '文字二回') && r.fx.some((f) => f.show === 'カットイン'), '演出の手順に札の show と特注の fx.queue が入る');
  eq(guestStatus(B, env), '採配 1／3', '宿泊客の仕組みの1行');
  guestAction(B, env, '採配', { カテゴリ: '麺', 向き: 1 });
  eq(B.banzuke['麺'], '2', '固有行動：採配で番付が動く');
  throws(() => guestAction(B, env, '採配', { カテゴリ: '麺', 向き: 1 }), '採配点が無ければ「できない」');
  throws(() => guestAction(B, env, '植える', {}), '持っていない固有行動はできない');
  // 宣言は choices で受け取る
  const B2 = createBattle(base, { seed: 'gan', floor: 1, deck: [], enemies: ['en_teiki'] });
  const env2 = openBattle(base, B2); startBattle(B2, env2);
  B2.enemies[0].claim = Big.from('1e9');
  B2.hand = [makeBattleCard(owned('rk_ganbou', 1), C.cards.rk_ganbou)]; attachCard(env2, B2.hand[0]);
  play(B2, env2, [0], 0, { choices: { 宣言: '麺' } });
  eq(B2.lastOverlap.麺, 1, '宣言：出すときに選んだカテゴリを持っていることになる');
  // 保存して読み直しても特注が付き直る
  const B3 = loadBattle(saveBattle(B));
  const env3 = openBattle(base, B3);
  endTurn(B3, env3);
  eq(B3.guestState.採配点, 1, '読み直しても宿泊客の仕組みが動く');
  // お品書き（議題）
  B3.items.push({ uid: 'i_x', id: 'tj_gi_tanki', kind: '議題' });
  useItem(B3, env3, 0);
  eq(B3.banzuke['食べ物'], '2', 'お品書き（議題「食べ物」）で食べ物が1段上がる');
}

group('組み込みの語彙を YAML から動かす');
{
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'taabuka-'));
  await cp(path.join(ROOT, 'content'), tmp, { recursive: true });
  await mkdir(path.join(tmp, 'sets/vt'), { recursive: true });
  await wf(path.join(tmp, 'sets/vt/set.yaml'), 'id: vt\nname: 語彙の試し\nunlock: { start: true }\n');
  // 基本：〈ター〉1枚（Tier3）は 10
  await wf(path.join(tmp, 'sets/vt/cards.yaml'), `
- { id: vt_mul, name: 掛け, cat: [ター], grade: 並, fx: [{ when: 採点時, do: [{ 掛け: "1+1" }] }], test: [{ hand: [vt_mul], expect: { V: 20 } }] }
- { id: vt_steps, name: 処理回数, cat: [ター], grade: 並, fx: [{ when: 出しの前, do: [{ ルール: { 名前: 処理回数, 範囲: この出し, 回数: 3 } }] }], test: [{ hand: [vt_steps], expect: { V: 30 } }] }
- { id: vt_up, name: 全部採点, cat: [ター], grade: 並, fx: [{ when: 出しの前, do: [{ ルール: { 名前: 全札を採点 } }] }], test: [{ hand: [vt_up, { tier: 3, cat: [麺] }], expect: { V: 20 } }] }
- { id: vt_rev, name: 逆, cat: [ター], grade: 並, fx: [{ when: 出しの前, do: [{ ルール: { 名前: 採点順を逆に } }] }], test: [{ hand: [{ tier: 3, ed: ホロ }, { tier: 3, ed: 多色 }, vt_rev], expect: { V: 690 } }] }
- { id: vt_ga, name: 受けで攻め, cat: [ター], grade: 並, fx: [{ when: 出しの前, do: [{ ルール: { 名前: 受けを攻撃に加える } }] }], test: [{ hand: [vt_ga, { tier: 5, cat: [死] }], expect: { V: 13 } }] }
- { id: vt_floor, name: 下限, cat: [ター], grade: 並, fx: [{ when: 出しの前, do: [{ ルール: { 名前: 倍率の下限を変える, 下限: 3 } }] }], test: [{ hand: [vt_floor], expect: { V: 30 } }] }
- { id: vt_end, name: 即終了, cat: [ター], grade: 並, fx: [{ when: 出しの前, do: [{ ルール: { 名前: 戦闘を即終了 } }] }], test: [{ hand: [vt_end], enemies: [{ claim: 1000 }], expect: { 結果: win, 記録: forceEnd } }] }
- { id: vt_banfix, name: 固定, cat: [ター], grade: 並, fx: [{ when: 出しの前, do: [{ ルール: { 名前: 番付を固定, 範囲: 戦闘 } }] }, { when: 採点時, do: [{ 番付を上げる: { カテゴリ: この札 } }] }], test: [{ hand: [vt_banfix], expect: { 番付: { ター: '3' } } }] }
- { id: vt_ketsu, name: 欠番, cat: [ター], grade: 並, fx: [{ when: 出しの前, do: [{ 番付を移す: { カテゴリ: ター, 先: 欠6 } }] }], test: [{ hand: [vt_ketsu], expect: { V: 12, 番付: { ター: 欠6 } } }] }
- { id: vt_spawn, name: 生む, cat: [ター], grade: 並, fx: [{ when: 採点時, do: [{ 札を生む: { id: この札, 場所: 手札, 写し: true } }] }], test: [{ hand: [vt_spawn], expect: { 記録: spawn } }] }
- { id: vt_hp, name: 体力, cat: [ター], grade: 並, fx: [{ when: 出しの後, do: [{ 体力: -5 }, { 宿銭: "2*3" }] }], test: [{ hand: [vt_hp], expect: { 体力: 65, 宿銭: 6 } }] }
- { id: vt_ov, name: 重なり, cat: [ター], grade: 並, fx: [{ when: 採点時, if: { 重なり以上: 2, カテゴリ: ター }, do: [{ 倍率: "重なり" }] }], test: [{ hand: [vt_ov, { tier: 3 }], expect: { V: 90 } }, { hand: [vt_ov], expect: { V: 10 } }] }
- { id: vt_cond, name: 条件, cat: [ター], grade: 並, fx: [{ when: 採点時, if: { どれか: [{ 確率: 0 }, { でない: { カテゴリ: 麺 } }] }, do: [{ 倍率: 4 }] }], test: [{ hand: [vt_cond], expect: { V: 50 } }] }
- { id: vt_pos, name: 位置, cat: [ター], grade: 並, fx: [{ when: 採点時, if: { 手札の位置: 左端 }, do: [{ 倍率: 1 }] }], test: [{ hand: [vt_pos, { tier: 3 }], expect: { V: 60 } }, { hand: [{ tier: 3 }, vt_pos, { tier: 5 }], play: [0, 1], expect: { V: 30 } }] }
- { id: vt_same, name: 同Tier, cat: [ター], grade: 並, fx: [{ when: 出しの前, do: [{ ルール: { 名前: 全札を同Tier扱い, Tier: God } }] }], test: [{ hand: [vt_same, { tier: 5, cat: [死] }], expect: { V: 60 } }] }
- { id: vt_lim, name: 限定, cat: [ター], grade: 並, fx: [{ when: 出しの前, do: [{ ルール: { 名前: 採点札を限定, 条件: { カテゴリ: ター } } }] }], test: [{ hand: [vt_lim, { tier: 3, cat: [ター] }, { tier: 3, cat: [麺] }, { tier: 3, cat: [麺] }], expect: { V: 30 } }] }
- { id: vt_swap, name: いれかえ, cat: [ター], grade: 並, fx: [{ when: 出しの前, do: [{ ルール: { 名前: 宿泊客の仕組みを入れ替える, 宿泊客: tsuchi } }] }], test: [{ guest: maap, hand: [vt_swap], expect: { V: 14 } }] }
- { id: vt_stun, name: 止める, cat: [ター], grade: 並, fx: [{ when: 採点時, do: [{ 行動停止: { 対象: 狙い, ターン: 1 } }, { 行動を消す: 狙い }] }], test: [{ hand: [vt_stun], expect: { 行動停止: { 0: 2 } } }] }
- { id: vt_cut, name: 削る, cat: [ター], grade: 並, fx: [{ when: 採点時, do: [{ 主張を削る: { 対象: 敵全員, 量: "強さ*10" } }] }], test: [{ hand: [vt_cut], enemies: [{ claim: 100 }, { claim: 500 }], expect: { enemy0: 0, enemy1: 390 } }] }
- { id: vt_k_yoin, name: 余韻, cat: [ター], grade: 並, kw: [余韻3], test: [{ hand: [vt_k_yoin, { tier: 3 }], steps: [{ play: [0] }, { play: [0] }], expect: { V: 13 } }] }
- { id: vt_k_mamori, name: 守り, cat: [ター], grade: 並, kw: [守り4], test: [{ hand: [{ tier: God, cat: [麺] }, vt_k_mamori], expect: { 受け: 14 } }] }
- { id: vt_k_tsure, name: 連れ, cat: [ター], grade: 並, kw: [連れ2], test: [{ hand: [vt_k_tsure, { tier: 3, cat: [ター] }], expect: { V: 90 } }, { hand: [vt_k_tsure, { tier: 3, cat: [麺] }], expect: { V: 10 } }] }
- { id: vt_k_yari, name: 一番槍, cat: [ター], grade: 並, kw: [一番槍], test: [{ hand: [vt_k_yari], expect: { V: 20 } }, { hand: [{ tier: 5 }, vt_k_yari], steps: [{ play: [0] }, { play: [0] }], expect: { V: 10 } }] }
- { id: vt_k_todome, name: とどめ, cat: [ター], grade: 並, kw: [とどめ], test: [{ hand: [vt_k_todome], enemies: [{ claim: 10 }], expect: { 宿銭: 2, 結果: win } }] }
- { id: vt_k_kasane, name: 重ね, cat: [ター], grade: 並, kw: [重ね数3], test: [{ hand: [vt_k_kasane, { tier: 3 }], expect: { V: 50 } }] }
- { id: vt_k_nemawashi, name: 根回し, cat: [ター], grade: 並, kw: [根回し], test: [{ hand: [vt_k_nemawashi], expect: { V: 10, 番付: { ター: '2' } } }] }
- { id: vt_k_tatari, name: 祟り, cat: [ター], grade: 並, kw: [祟り3], test: [{ hand: [vt_k_tatari, { tier: 3 }], steps: [{ play: [1] }, { end: true }], expect: { 体力: 67 } }] }
- { id: vt_k_kieru, name: 消える, cat: [ター], grade: 並, kw: [消える], test: [{ hand: [vt_k_kieru], expect: { 記録: remove } }] }
- { id: vt_mod, name: 回数, cat: [ター], grade: 並, fx: [{ when: 出しの後, do: [{ 出し回数: { 増減: 2, 期間: ターン } }] }], test: [{ hand: [vt_mod], expect: { 出し残り: 3 } }] }
`);
  await wf(path.join(tmp, 'sets/vt/regulars.yaml'), `
- { id: vt_r_each, name: 毎枚, grade: 並, fx: [{ when: 採点時, do: [{ 倍率: 1 }] }], test: [{ hand: [{ tier: 3 }, { tier: 3 }], seats: [vt_r_each], expect: { V: 90 } }] }
- { id: vt_r_grow, name: 育つ客, grade: 並, grow: { 増える: 出し, 量: 1 }, fx: [{ when: 出し, do: [{ 掛け: "1+育ち" }, { 育つ: 1 }] }], test: [{ hand: [{ tier: 3 }, { tier: 5 }], steps: [{ play: [0] }, { play: [0] }], seats: [vt_r_grow], expect: { V: 6 } }] }
`);
  await wf(path.join(tmp, 'sets/vt/items.yaml'), `
- { id: vt_i_up, name: 格上げ, kind: 番付札, use: 戦闘中, do: [{ 番付を上げる: { カテゴリ: 選ぶ, 段: 2 } }] }
`);
  await appendFile(path.join(tmp, 'sets/vt/cards.yaml'), `
- { id: vt_item, name: 品, cat: [麺], grade: 並, test: [{ hand: [vt_item], items: [vt_i_up], steps: [{ item: 0, choices: { カテゴリ: 麺 } }, { play: [0] }], expect: { 番付: { 麺: '1' }, V: 22 } }] }
`);
  const res = await runCheck({ root: tmp, fixIndex: true, sets: ['vt'] });
  const vt = res.results.filter((r) => r.where.startsWith('vt_'));
  eq(res.errors, 0, '試しの札が検査を通る');
  for (const r of vt) ok(r.ok, `${r.where}`, r.msg);
  ok(vt.length >= 32, `試しの数 ${vt.length}`);
  if (res.errors) console.log(res.lines.join('\n'));
  await rm(tmp, { recursive: true, force: true });
}

group('段階3：画面が使う予測と選択');
{
  const { content } = await runCheck();
  const C = { ...content, cards: { ...content.cards, ...fixtureContent().cards } };
  const base = { balance, content: C };
  const mk = (hand, o = {}) => {
    const B = createBattle(base, { seed: 'pred', floor: 1, deck: fixtureDeck(), enemies: ['en_teiki'], ...o });
    const env = openBattle(base, B); startBattle(B, env);
    B.enemies[0].claim = Big.from('1e9');
    if (hand) { B.hand = hand.map((id, i) => makeBattleCard(owned(id, `p${i}`), C.cards[id])); B.hand.forEach((c) => attachCard(env, c)); }
    return { B, env };
  };
  const { predict: pr, choicesFor, guestActions } = await import('../engine/battle.js');
  // 乱数を使わない出しは確定。予測と実際が一致し、状態は変わらない
  { const { B, env } = mk(['fx_neko', 'fx_sure', 'fx_soba']);
    const before = saveBattle(B);
    const p = pr(B, env, [0, 1, 2], 0);
    eq(saveBattle(B), before, '予測しても状態は変わらない');
    ok(!p.usedRandom && !p.uncertain, '乱数を使わない出しは確定');
    eq(play(B, env, [0, 1, 2], 0).V.toString(), p.V.toString(), '予測と実際の論破値が一致'); }
  // T8 の番付（乱数）は「？」
  { const { B, env } = mk(['fx_neko'], { banzuke: { 動物: '8' } });
    const p = pr(B, env, [0], 0);
    ok(p.usedRandom && p.uncertain, '番付T8の札は乱数で変わる（？）');
    eq(play(B, env, [0], 0).V.toString(), p.V.toString(), '同じ乱数の状態なら予測と実際は一致する（画面は？で隠す）'); }
  // T8 があっても、その札が採点されなければ乱数を引かない
  { const { B, env } = mk(['fx_neko', 'fx_sure', 'fx_soba'], { banzuke: { 動物: '8' } });
    ok(!pr(B, env, [1, 2], 0).usedRandom, 'T8の乱数は使うときだけ引く'); }
  // 宣言は出す前に選ぶもの
  { const { B, env } = mk(['rk_ganbou', 'fx_neko']);
    eq(JSON.stringify(choicesFor(env, [B.hand[0]])), JSON.stringify({ 宣言: 'category' }), '願望を選ぶと「宣言」（カテゴリ）を選ばせる');
    eq(JSON.stringify(choicesFor(env, [B.hand[1]])), '{}', 'ほかの札では選ばせない');
    eq(pr(B, env, [0, 1], 0, { 宣言: '動物' }).kickers.length, 0, '選んだ宣言で予測する（動物を宣言すると願望と猫が重なり、受けが無い）'); }
  // 固有行動の一覧
  { const { B, env } = mk(null, { guest: 'maap' });
    const a = guestActions(B, env);
    ok(a.length === 1 && a[0].label === '採配' && a[0].ask.length === 2, '女将マープの固有行動「採配」と選ばせるもの');
    const { B: B2, env: e2 } = mk(null, { guest: 'tsuchi' });
    eq(guestActions(B2, e2).length, 0, '自己紹介をする土には固有行動がない'); }
}

group('キーワード能力');
{
  const { content } = await runCheck();
  const { parseKw, expandKw } = await import('../engine/content.js');
  eq(JSON.stringify(parseKw('呼び水2')), JSON.stringify({ name: '呼び水', n: 2 }), '「呼び水2」は名前と数字');
  eq(JSON.stringify(parseKw('一番槍')), JSON.stringify({ name: '一番槍', n: null }), '数字の無いキーワード');
  eq(expandKw(content, '呼び水2').text, '採点されると札を2枚引く', '説明文の N も数字になる');
  ok(content.cards.rk_jujo_satosatoru.kwList.map((k) => k.label).join() === '二倍', '十条さとさとるは kw: [二倍] で二倍を持つ');
  ok(content.cards.rk_jujo_satosatoru.fx.some((f) => [].concat(f.do).some((d) => d?.ルール?.名前 === '二倍')), '読み込み時に二倍が fx に展開される');
  eq(Object.keys(content.kwByName).filter((n) => content.kwByName[n].id.startsWith('kw_') && !content.kwByName[n].set).length, 12, '共通のキーワードは12種');
  // 初手・呼び水・不壊は戦闘で確かめる
  const C = { ...content, cards: { ...content.cards, ...fixtureContent().cards,
    kt_shote: { id: 'kt_shote', name: '初手', cat: ['ター'], tier: '3', grade: '並', kw: ['初手'] },
    kt_yobi: { id: 'kt_yobi', name: '呼び水', cat: ['ター'], tier: '3', grade: '並', kw: ['呼び水2'] },
    kt_fue: { id: 'kt_fue', name: '不壊', cat: ['ター'], tier: '3', grade: '並', kw: ['不壊', '消える'] },
  } };
  const { compileContent } = await import('../engine/content.js');
  compileContent(C);
  const base = { balance, content: C };
  const deck = [...fixtureDeck().slice(0, 15), owned('kt_shote', 99)];
  const B = createBattle(base, { seed: 'kw', floor: 1, hp: 70, deck, enemies: ['en_teiki'] });
  const env = openBattle(base, B); startBattle(B, env);
  ok(B.hand.some((c) => c.id === 'kt_shote'), '初手：戦闘開始時に必ず手札に入る');
  B.enemies[0].claim = Big.from('1e9'); delete B.enemies[0].yield;
  const yb = makeBattleCard(owned('kt_yobi', 1), C.cards.kt_yobi); attachCard(env, yb); B.hand.unshift(yb);
  const before = B.hand.length;
  play(B, env, [0], 0);
  eq(B.hand.length, before - 1 + 2, '呼び水2：採点されると2枚引く');
  const fu = makeBattleCard({ ...owned('kt_fue', 2), enh: '硝子' }, C.cards.kt_fue); attachCard(env, fu);
  let gone = false;
  for (let i = 0; i < 12 && !gone; i++) {
    if (B.playsLeft <= 0) endTurn(B, env);
    B.hand.unshift(fu.inHand ? B.hand.splice(B.hand.indexOf(fu), 1)[0] : fu);
    const i0 = B.discard.indexOf(fu); if (i0 >= 0) B.discard.splice(i0, 1);
    play(B, env, [0], 0);
    gone = B.destroyed.includes(fu) || B.exhaust.includes(fu);
  }
  ok(!gone, '不壊：硝子でも割れず、消えるも受けない（12回出して残る）');
}

group('段階4.5：キーワード能力の仕組み');
{
  const { content, results: selftests } = await runCheck();
  const common = Object.values(content.kwDefs).filter((k) => !k.set);
  ok(common.length === 12 && common.every((k) => (k.test || []).length >= 1), '共通キーワード12個すべてに自己テストがある');
  const kwRes = (selftests || []).filter((r) => r.where.startsWith('キーワード「'));
  ok(kwRes.length >= 12 && kwRes.every((r) => r.ok), `キーワードの自己テストが全部通る（${kwRes.filter((r) => r.ok).length}/${kwRes.length}）`);
  // 二倍・交互・宣言はキーワード経由（自己テストは特注の側。段階2・3と同じ期待値）
  for (const [id, kw] of [['rk_jujo_satosatoru', '二倍'], ['rk_yakitori', '交互'], ['rk_ganbou', '宣言']]) {
    ok((content.cards[id].kw || []).includes(kw) && content.cards[id].kwList.some((k) => k.name === kw), `${content.cards[id].name}は kw: [${kw}]`);
  }
  const rk = (selftests || []).filter((r) => /^(二倍|交互|宣言)#/.test(r.where));
  ok(rk.length >= 3 && rk.every((r) => r.ok), `二倍・交互・宣言の自己テストが通る（${rk.length}件）`);

  // YAML を足すだけで新しいキーワードが作れる（engine/ ui/ に触れない）
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'taabuka-kw-'));
  await cp(path.join(ROOT, 'content'), tmp, { recursive: true });
  await appendFile(path.join(tmp, 'keywords/base.yaml'), `
- id: kw_tameshi
  name: 試し斬り
  arg: N
  text: 採点されると強さ＋N×10
  fx:
    - when: 採点時
      do: [ { 強さ: "N*10" } ]
  test:
    - name: 強さ＋30
      hand: [{ tier: 3, kw: [試し斬り3] }]
      expect: { V: 40 }
`);
  await appendFile(path.join(tmp, 'sets/ryukogo/cards.yaml'), `
- id: rk_tameshi
  name: 試しの札
  cat: [麺]
  grade: 並
  kw: [試し斬り2, 呼び水1]
  text: 試し
`);
  const added = await runCheck({ root: tmp });
  const t = (added.results || []).find((r) => r.where.startsWith('キーワード「試し斬り」'));
  ok(added.errors === 0 && t?.ok, 'YAML を足すだけで新しいキーワードが動く（自己テストも通る）', added.lines.filter((l) => !l.startsWith('  ')).join(' / '));
  ok(added.content.cards.rk_tameshi.kwList.map((k) => k.label).join() === '試し斬り2,呼び水1' && added.content.cards.rk_tameshi.kwList[0].text === '採点されると強さ＋2×10', '札の kw に展開され、説明の N も数字になる');
  // わざと間違えた名前
  await appendFile(path.join(tmp, 'sets/ryukogo/cards.yaml'), `
- id: rk_typo
  name: 間違えた札
  cat: [麺]
  tier: 3
  grade: 並
  kw: [呼び永2, 一番槍3, 守り]
`);
  const bad = await runCheck({ root: tmp });
  const line = bad.lines.find((l) => l.startsWith('[キーワード] rk_typo: 知らないキーワード「呼び永2」'));
  ok(!!line && line.includes('候補：呼び水') && !line.includes('\n'), 'わざと間違えた名前を1行で指摘し、候補を出す', line ?? bad.lines.join(' / '));
  ok(bad.lines.some((l) => l.startsWith('[キーワード] rk_typo: キーワード「一番槍」は数字を取らない')), '数字が多すぎる');
  ok(bad.lines.some((l) => l.startsWith('[キーワード] rk_typo: キーワード「守り」には数字が要る')), '数字が足りない');
  // 名前の重複
  await appendFile(path.join(tmp, 'keywords/base.yaml'), `
- id: kw_dup
  name: 消える
  text: 重複
  fx: [ { when: 採点時, do: [ { 引く: 1 } ] } ]
`);
  const dup = await runCheck({ root: tmp });
  ok(dup.lines.some((l) => l.includes('名前「消える」が重複している')), '名前の重複を指摘');
  // 解放順：最初から解放のセットの札が、後で解放されるセット（流行語）のキーワードを使う
  // 流行語は先行版では最初から解放なので、ここでは本編どおり「第四層の層主」に戻して試す
  const rs = path.join(tmp, 'sets/ryukogo/set.yaml');
  await wf(rs, (await readFile(rs, 'utf8')).replace(/^unlock:.*$/m, 'unlock: { boss: layer4 }'));
  await mkdir(path.join(tmp, 'sets/hayai'), { recursive: true });
  await wf(path.join(tmp, 'sets/hayai/set.yaml'), 'id: hayai\nname: 早い\nunlock: { start: true }\n');
  await wf(path.join(tmp, 'sets/hayai/cards.yaml'), '- { id: hy_a, name: 早い札, cat: [麺], tier: 3, grade: 並, kw: [二倍] }\n');
  await runCheck({ root: tmp, fixIndex: true });
  const ord = await runCheck({ root: tmp });
  ok(ord.lines.some((l) => l.startsWith('[キーワード] hy_a: 「二倍」はセット「流行語」のキーワード')), '先に解放されるセットが、後のセットのキーワードを使うと指摘');
  // 逆（後のセットが先のセットのキーワード）は通る
  const { unlockRank } = await import('../engine/content.js');
  ok(unlockRank(content, { start: true }) < unlockRank(content, { guest: 'maap' }) && unlockRank(content, { guest: 'maap' }) < unlockRank(content, { boss: 'layer4' }), '解放の順：最初から＜宿泊客＜第四層の層主');
  await rm(tmp, { recursive: true, force: true });
}

group('段階4：潜行（dive.js）');
{
  const D_ = await import('../engine/dive.js');
  const { loadRealContent, tempDeckIds } = await import('./fixtures/index.mjs');
  const { useItem: bUseItem } = await import('../engine/battle.js');
  const { base, issues } = await loadRealContent();
  eq(issues.filter((i) => i.level === 'error').length, 0, 'content/ がエラーなく読める');
  const C = base.content;
  const deck = () => tempDeckIds(C, 'maap').map((id, i) => ({ uid: `d${i}`, id, origin: 'orig' }));
  const mk = (o = {}) => D_.createDive(base, { seed: 'test1', guest: 'maap', deck: deck(), ...o });
  const winAll = (D) => { const { B, env } = D_.diveBattle(base, D); startBattle(B, env); for (const e of B.enemies) e.dead = true; B.result = 'win'; return B; };
  /** 部屋をこなして次へ（戦闘は勝ったことに、報酬は見送り） */
  const clear = (D) => {
    for (let n = 0; n < 50 && !['map', 'landing', 'end'].includes(D.phase); n++) {
      if (D.phase === 'chase') D_.answerChase(base, D, 'flee');
      else if (D.phase === 'battle') D_.finishBattle(base, D, winAll(D));
      else if (D.phase === 'reward') D_.closeReward(base, D);
      else if (D.phase === 'event') { if (D.event.choice == null) D_.chooseEvent(base, D, D_.eventChoices(base, D).findIndex((c) => c.ok)); if (D.phase === 'event') D_.leaveRoom(base, D); }
      else if (D.phase === 'exit') D_.useExit(base, D, 'back');
      else D_.leaveRoom(base, D);
    }
  };
  const walk = (D, pickIdx) => {
    while (D.phase === 'map') { const ds = D_.openDoors(D).filter((d) => d.kind !== '非常口'); D_.enterDoor(base, D, ds[Math.min(pickIdx, ds.length - 1)].room); clear(D); }
  };

  // 同じシード・違う経路で、後の階の中身が変わらない
  const A = mk(); const Bd = mk();
  const maps = { a: {}, b: {} };
  for (const [D, k, pick] of [[A, 'a', 0], [Bd, 'b', 2]]) {
    for (let f = 1; f <= 6 && D.phase !== 'end'; f++) {
      maps[k][f] = JSON.stringify(D.map.rows.map((r) => r.map((d) => [d.room, d.kind, d.hidden, d.glow, d.enemies])));
      maps[k][`s${f}`] = JSON.stringify([D.map.side, D.map.exit]);
      D.hp = D.maxHp;
      walk(D, pick);
      if (D.phase === 'landing' && f < 6) D_.descend(base, D);
    }
  }
  ok([2, 3, 4, 5, 6].every((f) => maps.a[f] && maps.a[f] === maps.b[f] && maps.a[`s${f}`] === maps.b[`s${f}`]), '違う襖を選んでも、B2〜B6の襖・敵・光・寄り道・非常口が同じ');
  eq(A.bosses.layer2, Bd.bosses.layer2, '層主の予告も同じ');
  // 部屋の中身（宝・戦闘の札の候補）も経路によらない
  const lootOf = (D, floor) => {
    const m = D_.genFloor(base, D, floor);
    return JSON.stringify(m.rows.flat().filter((d) => d.kind === '宝').map((d) => d.glow));
  };
  eq(lootOf(A, 5), lootOf(Bd, 5), '宝の光（中身の最高格）も同じ');

  // 階の生成の制約（シードを変えて200階）
  let bad = [];
  for (let s = 0; s < 40; s++) {
    const D = mk({ seed: `c${s}` });
    for (let f = 1; f <= 6; f++) {
      const m = D_.genFloor(base, D, f);
      const rows = m.rows.filter((r) => r[0].kind !== '層主');
      if (rows.length !== 3 || rows[0].length !== 3 || rows[1].length < 2 || rows[1].length > 3 || rows[2].length !== 2) bad.push(`${s}/${f}:数`);
      for (const r of rows) { const ks = r.map((d) => d.kind).filter((k) => k !== '戦い'); if (new Set(ks).size !== ks.length) bad.push(`${s}/${f}:重複`); }
      if (rows.flat().filter((d) => d.kind === '商い').length > 1) bad.push(`${s}/${f}:商い`);
      if (f === 1 && rows[0].some((d) => d.kind === '精鋭')) bad.push(`${s}/1:精鋭`);
      const hid = rows.map((r) => r.filter((d) => d.hidden).length);
      if (f <= 3 ? hid.some((n) => n) : hid.some((n) => n !== 1)) bad.push(`${s}/${f}:？`);
      if ((f === 3 || f === 6) !== (m.rows.length === 4)) bad.push(`${s}/${f}:層主`);
    }
  }
  eq(bad.slice(0, 5).join(' '), '', '襖の数・同じ列に同じ種類なし・商いは1階に1つ・B1の1列目に精鋭なし・第二層は各列1枚が「？」・層の3階目に層主');

  // 気配
  const D = mk({ seed: 'p1' });
  const L1 = C.layers.layer1;
  const { makeEnemy } = await import('../engine/battle.js');
  const claimAt = (p) => makeEnemy(balance, C.enemies.en_teiki, { floor: 1, presence: p }, 'x').claim.toNumber();
  ok(claimAt(4) === Math.round(claimAt(0) * 1.2) && claimAt(12) === Math.round(claimAt(0) * 1.5), '気配4で主張＋20%、12で＋50%');
  D.presence = 7; eq(D_.stalkerChance(base, D), 0, '気配7までは追跡者が来ない');
  D.presence = 8; eq(D_.stalkerChance(base, D), 0.2, '気配8で20%');
  D.presence = 12; eq(D_.stalkerChance(base, D), 1, '気配12で必ず');
  const D14 = mk({ seed: 'p1', depth: 14 }); D14.presence = 8; eq(D_.stalkerChance(base, D14), 0.4, '深度14以上は40%');
  D.presence = 11;
  const d0 = D_.openDoors(D)[0];
  D_.enterDoor(base, D, d0.room);
  eq(D.phase, 'chase', '気配12に達して部屋に入ると、追跡者が割り込む');
  D.pouch.push({ uid: 'pp', type: 'souvenir', id: 'sv_furuikagi' });
  ok(/懐の品/.test(D_.fleeCost(base, D).text), '逃げる代償：懐があれば懐の品');
  D_.answerChase(base, D, 'flee');
  ok(D.pouch.length === 0 && D.phase !== 'chase', '逃げると懐の品を1つ失い、部屋に入る');
  const D2 = mk({ seed: 'p2' }); D2.zeni = 41; D2.presence = 11;
  D_.enterDoor(base, D2, D_.openDoors(D2)[0].room);
  D_.answerChase(base, D2, 'flee');
  eq(D2.zeni, 21, '懐が空なら宿銭の半分（切り捨て）');
  const D3 = mk({ seed: 'p3', depth: 6 }); D3.presence = 0;
  D_.enterDoor(base, D3, D_.openDoors(D3)[0].room);
  eq(D3.presence, 2, '深度6以上は増える量×1.5（切り上げ）');

  // 懐の重さで番人が強くなる
  const W = mk({ seed: 'w1' });
  walk(W, 0);
  eq(W.phase, 'landing', '3列の後は踊り場');
  const i0 = D_.landingInfo(base, W);
  W.pouch.push({ uid: 'a', type: 'souvenir', id: 'sv_kaketahari' }, { uid: 'b', type: 'card', id: 'fx_inu' });
  const i1 = D_.landingInfo(base, W);
  eq(i1.warden.weight, 3, '懐の重さ＝品数（欠けた梁は重さ2）');
  eq(i1.warden.claim.toNumber(), Math.round(i0.warden.claim.toNumber() * 1.3), '番人の主張×（1＋0.1×懐の重さ）');
  ok(!i1.afterBoss, '層主の前の踊り場は昇降機なし');
  D_.goBack(base, W);
  eq(W.phase + W.battle?.kind, 'battle番人', '引き返すと帰路の番人と1戦');
  const WB = winAll(W);
  eq(WB.enemies[0].claim.toNumber(), i1.warden.claim.toNumber(), '戦闘の番人の主張は踊り場の表示と同じ');
  D_.finishBattle(base, W, WB);
  eq(`${W.result.outcome}/${W.result.via}`, 'escaped/warden', '番人に勝てば脱出');

  // 層主の後だけ昇降機
  const Bo = mk({ seed: 'b1' });
  for (let f = 1; f <= 3; f++) { walk(Bo, 1); if (f < 3) { eq(D_.landingInfo(base, Bo).afterBoss, false, `B${f}の踊り場は引き返す`); D_.descend(base, Bo); } }
  ok(D_.landingInfo(base, Bo).afterBoss, 'B3の層主の後の踊り場は昇降機');
  const Bo2 = D_.loadDive(D_.saveDive(Bo));
  D_.goBack(base, Bo2);
  eq(`${Bo2.result.outcome}/${Bo2.result.via}`, 'escaped/lift', '昇降機で帰る（番人なし）');
  D_.descend(base, Bo);
  eq(`${Bo.floor}/${Bo.presence}`, '4/0', '次の層に入ると気配は0');
  for (let f = 4; f <= 6; f++) { Bo.hp = Bo.maxHp; walk(Bo, 0); if (f < 6) D_.descend(base, Bo); }
  const last = D_.landingInfo(base, Bo);
  ok(last.afterBoss && last.canDescend, 'B6の層主の後：昇降機あり、さらに下りられる（本編）');
  D_.descend(base, Bo);
  eq(`${Bo.floor}/${Bo.layer}`, '7/layer3', 'B6の次は第三層B7');

  // 報酬
  const R = mk({ seed: 'r1' });
  while (R.phase === 'map') { const t = D_.openDoors(R).find((d) => d.kind === '戦い') ?? D_.openDoors(R)[0]; D_.enterDoor(base, R, t.room); if (R.phase === 'battle') break; clear(R); }
  if (R.phase === 'battle') {
    D_.finishBattle(base, R, winAll(R));
    eq(R.phase, 'reward', '勝つと報酬');
    const g = R.reward.groups.find((x) => x.type === 'card');
    eq(g.options.length, 3, '札の候補は3枚');
    eq(R.reward.zeni, 4 + R.floor, '通常戦の宿銭＝4＋階');
    const n = R.deck.length;
    D_.takeReward(base, R, R.reward.groups.indexOf(g), 1, 'pouch');
    eq(`${R.deck.length}/${R.pouch.length}`, `${n}/1`, '懐へ入れられる');
    throws(() => D_.takeReward(base, R, R.reward.groups.indexOf(g), 0, 'deck'), '札は1枚だけ');
  }
  // 格の重みと深度補正
  const gw0 = D_.gradeWeights(base, mk(), 1); const gw5 = D_.gradeWeights(base, mk({ depth: 5 }), 1);
  ok(Math.abs(gw5.並 - gw0.並 * 0.8) < 1e-9 && Math.abs(gw5.上 - gw0.上 * 1.25) < 1e-9, '深度5：並×0.8、それ以外×1.25');

  // お品書き（戦闘の外）
  const I = mk({ seed: 'i1', items: [{ uid: 'it1', id: 'tj_hn_kannaizu', kind: '品' }, { uid: 'it2', id: 'tj_hn_nawabashigo', kind: '品' }] });
  for (let f = 1; f <= 3; f++) { walk(I, 0); D_.descend(base, I); }
  ok(I.map.rows.some((r) => r.some((d) => d.hidden)) && I.map.rows.some((r) => r.some((d) => D_.isHidden(I, d))), 'B4には「？」がある');
  D_.useDiveItem(base, I, 0);
  ok(I.map.rows.flat().every((d) => !D_.isHidden(I, d)) && I.items.length === 1, '館内図の切れ端：この階の「？」が全部見える');
  D_.useDiveItem(base, I, 0);
  eq(`${I.phase}/${I.result?.via}`, 'end/item', '縄梯子：その場で脱出');
  const J = mk({ seed: 'i2', items: [{ uid: 'a', id: 'tj_hn_hasami', kind: '品' }, { uid: 'b', id: 'tj_hn_oshiki', kind: '品' }] });
  const n0 = J.deck.length;
  D_.useDiveItem(base, J, 0, { 札: J.deck[3].uid });
  eq(J.deck.length, n0 - 1, '鋏：デッキから1枚除く');
  const [a, b] = [J.deck[0], J.deck[1]];
  D_.useDiveItem(base, J, 0, { 札: a.uid, 札2: b.uid });
  ok(J.deck.length === n0 - 2 && a.mod?.name?.includes('＋') && a.mod.cat.length >= 1, '推敷：2枚が1枚に（名前・カテゴリ・強さ）');
  const K = mk({ seed: 'i3', items: [{ uid: 'a', id: 'tj_bz_kamikourin', kind: '番付札' }, { uid: 'b', id: 'tj_bz_kamikourin', kind: '番付札' }] });
  D_.useDiveItem(base, K, 0, { カテゴリ: '麺' });
  eq(K.banzuke.麺, 'God', '神降臨：選んだカテゴリをGodへ');
  throws(() => D_.useDiveItem(base, K, 0, { カテゴリ: '湯' }), '神降臨は1潜行に1回');
  const Ki = mk({ seed: 'i4', items: [{ uid: 'a', id: 'tj_hn_yobirin', kind: '品' }] });
  const before = Ki.map.rows[0].length;
  D_.useDiveItem(base, Ki, 0);
  ok(Ki.map.rows[0].length === before + 1 && Ki.map.rows[0].at(-1).kind === '商い', '呼び鈴：今の列に商いの襖が増える');
  throws(() => D_.useDiveItem(base, mk({ items: [{ uid: 'a', id: 'tj_hn_bancha', kind: '品' }] }), 0), '番茶は戦闘の外では使えない');
  // 戦闘中は入れ替え不可、懐⇔お守り袋は可、デッキ⇔懐は湯でだけ
  const M = mk({ seed: 'm1' });
  M.pouch.push({ uid: 'sv1', type: 'souvenir', id: 'sv_yunohana' });
  D_.moveThing(base, M, 'pouch', 'sv1', 'charm');
  eq(M.charm.length, 1, '懐→お守り袋');
  throws(() => D_.moveThing(base, M, 'deck', M.deck[0].uid, 'pouch'), 'デッキ→懐は湯の外では不可');
  M.phase = 'battle'; throws(() => D_.moveThing(base, M, 'charm', 'sv1', 'pouch'), '戦闘中は入れ替え不可'); M.phase = 'map';

  // 謎「暖簾」
  const N = mk({ seed: 'n1' });
  N.floor = 4; N.layer = 'layer2'; N.phase = 'event'; N.event = { id: 'ev_noren', choice: null }; N.here = { room: 0, row: 0 };
  const hp0 = N.hp;
  D_.chooseEvent(base, N, 0);
  ok(N.hp === hp0 - 10 && N.pouch.some((x) => x.id === 'sv_noren'), '暖簾をくぐる：体力−10、暖簾の切れ端');

  // 未帰還はお守り袋だけ
  const Lo = mk({ seed: 'l1', charm: [{ uid: 'c1', type: 'souvenir', id: 'sv_hakusen' }] });
  Lo.pouch.push({ uid: 'p1', type: 'souvenir', id: 'sv_furuikagi' });
  D_.enterDoor(base, Lo, D_.openDoors(Lo).find((d) => d.kind === '戦い')?.room ?? D_.openDoors(Lo)[0].room);
  if (Lo.phase === 'battle') {
    const { B, env } = D_.diveBattle(base, Lo); startBattle(B, env); B.hp = 0; B.result = 'lose';
    D_.finishBattle(base, Lo, B);
    ok(Lo.result.outcome === 'lost' && Lo.result.kept.length === 1 && Lo.result.kept[0].id === 'sv_hakusen', '未帰還：お守り袋の中身だけ残る');
  }
}

group('段階4：第一・二層の敵の特注');
{
  const { loadRealContent } = await import('./fixtures/index.mjs');
  const { base } = await loadRealContent();
  const fight = (enemies, o = {}) => {
    const B = createBattle(base, { seed: o.seed ?? 3, floor: 4, guest: 'maap', deck: fixtureDeck(), enemies, ...o });
    const env = openBattle(base, B); startBattle(B, env); return { B, env };
  };
  let { B, env } = fight(['en_fusuma_nushi']);
  eq(`${B.playsLeft}/${B.discardsLeft}`, '1/3', '襖の主：出し1回、流し＋2');
  ({ B, env } = fight(['en_suretate']));
  eq(B.hand.filter((c) => c.faceDown).length, 1, 'スレ立て：毎ターン手札1枚が伏せられる');
  ({ B, env } = fight(['en_datochi'], { hp: 60 }));
  for (let i = 0; i < 6 && !B.result; i++) { B.guard = 999; endTurn(B, env); }
  eq(`${B.turn}/${B.hp}`, '7/30', 'dat落ち：7ターン目の始めに体力が半分');
  ({ B, env } = fight(['en_tsuchi_nashi'], { banzuke: { 麺: 'God' } }));
  B.guard = 999; endTurn(B, env);
  eq(B.banzuke.麺, '3', '自己紹介をしない土：一番高いカテゴリをT3に戻す');
  ({ B, env } = fight(['en_netawaku', 'en_teiki']));
  const bz = JSON.stringify(B.banzuke);
  const { killEnemy } = await import('../engine/battle.js');
  killEnemy(B, env, B.enemies[0]);
  ok(JSON.stringify(B.banzuke) !== bz, 'ネタ枠：倒されると番付が1つ動く');
  ({ B, env } = fight(['en_anka']));
  play(B, env, [0], 0);
  ok(B.enemies[0].intent.name === '攻め' && B.enemies[0].intent.arg === 1.5, '安価：1枚だけ出すと次の行動が「攻め1.5」');
}

group('段階5：宿と永続（meta.js）');
{
  const M = await import('../engine/meta.js');
  const Dv = await import('../engine/dive.js');
  const { loadRealContent } = await import('./fixtures/index.mjs');
  const { botDive, botBattle } = await import('./sim-dive.mjs');
  const { base } = await loadRealContent();
  const C = base.content;
  const winAll = (D) => { const { B, env } = Dv.diveBattle(base, D); startBattle(B, env); for (const e of B.enemies) e.dead = true; B.result = 'win'; return B; };
  /** B3 の層主まで（戦闘は勝ったことに）。報酬の札はデッキへ */
  const toLift = (D) => {
    for (let n = 0; n < 300 && D.phase !== 'end'; n++) {
      if (D.phase === 'map') Dv.enterDoor(base, D, Dv.openDoors(D).filter((d) => d.kind !== '非常口')[0].room);
      else if (D.phase === 'chase') Dv.answerChase(base, D, 'flee');
      else if (D.phase === 'battle') Dv.finishBattle(base, D, winAll(D));
      else if (D.phase === 'reward') {
        D.reward.groups.forEach((g, gi) => { const x = g.options[0]; const to = Dv.rewardDests(base, D, x).find((d) => d.ok && d.to !== 'skip')?.to ?? 'skip'; Dv.takeReward(base, D, gi, 0, to); });
        Dv.closeReward(base, D);
      } else if (D.phase === 'event') { if (D.event.choice == null) Dv.chooseEvent(base, D, Dv.eventChoices(base, D).findIndex((c) => c.ok)); if (D.phase === 'event') Dv.leaveRoom(base, D); }
      else if (D.phase === 'exit') Dv.useExit(base, D, 'back');
      else if (D.phase === 'landing') { if (Dv.landingInfo(base, D).afterBoss) Dv.goBack(base, D); else Dv.descend(base, D); }
      else Dv.leaveRoom(base, D);
      D.hp = D.maxHp;
    }
  };
  const H = M.newInn(base, 'innA');
  eq(`${H.deck.length}/${H.stash.length}`, '20/20', '最初は素泊まりセット20枚が蔵とデッキに');
  ok(H.unlocked.guests.includes('tsuchi') && !H.unlocked.guests.includes('maap'), '最初の宿泊客は自己紹介をする土だけ（マープは初めて脱出で）');
  const before = new Set(H.stash.map((x) => x.uid));
  const D = M.beginDive(base, H, { seed: 'd1' });
  eq(H.stash.length, 0, '持ち込むと蔵から除かれる');
  toLift(D);
  eq(`${D.result.outcome}/${D.result.via}/${D.result.floor}`, 'escaped/lift/3', 'B3で昇降機');
  const rep = M.finishDive(base, H, D);
  const newCards = H.stash.filter((x) => x.type === 'card' && !before.has(x.uid));
  ok(newCards.length > 0 && H.stash.length > 20, `蔵に札が増える（${newCards.length}枚）`);
  ok(rep.unlocked.some((u) => u.id === 'maap') && H.unlocked.guests.includes('maap'), '初めて脱出で女将マープが解放');
  ok(rep.firstExtract, '初めての脱出（案内を一度だけ出す印）');
  const pickedUid = newCards[0].uid;
  if (!H.deck.includes(pickedUid)) { if (H.deck.length >= 30) M.toggleDeck(base, H, H.deck[0]); M.toggleDeck(base, H, pickedUid); }
  const D2 = M.beginDive(base, H, { seed: 'd2' });
  ok(D2.deck.some((c) => c.uid === pickedUid), '拾った札を持ち込んでまた潜れる');

  // 未帰還：持ち込みが消え、お守り袋だけ残り、保険分が次の潜行の後に戻る
  const H2 = M.newInn(base, 'innB');
  H2.zeni = 500;
  H2.stash.push({ uid: 'sv_x', type: 'souvenir', id: 'sv_yunohana' });
  H2.loadout.charm = ['sv_x'];
  H2.loadout.insured = H2.deck.slice(0, 10);
  const prem = M.prepInfo(base, H2).premium;
  ok(prem >= 10, `保険の掛け金（最低1×10枚、いま ${prem}）`);
  const L1 = M.beginDive(base, H2, { seed: 'l1' });
  eq(H2.zeni, 500 - prem, '掛け金を払う');
  L1.hp = 0;
  Dv.enterDoor(base, L1, Dv.openDoors(L1).find((d) => d.kind === '戦い')?.room ?? Dv.openDoors(L1)[0].room);
  if (L1.phase === 'battle') { const { B, env } = Dv.diveBattle(base, L1); startBattle(B, env); B.hp = 0; B.result = 'lose'; Dv.finishBattle(base, L1, B); }
  else { L1.result = null; L1.hp = 0; L1.phase = 'battle'; L1.battle = { room: 0, kind: '通常', enemies: ['en_teiki'] }; const { B, env } = Dv.diveBattle(base, L1); startBattle(B, env); B.hp = 0; B.result = 'lose'; Dv.finishBattle(base, L1, B); }
  const r2 = M.finishDive(base, H2, L1);
  ok(r2.outcome === 'lost' && r2.lost.length >= 20, '未帰還で持ち込みが消える');
  ok(H2.stash.some((x) => x.uid === 'sv_x'), 'お守り袋の中身だけ残る');
  eq(H2.insuredPending.length, 10, '保険を掛けた10枚は戻り待ち');
  ok(H2.lostLog.length === 20 && H2.kuyo > 0, '遺失物帳と供養点');
  ok(r2.starter && H2.deck.length === 20, '蔵の札が15枚未満なので素泊まりセットを受け取る');
  eq(H2.sudomari, 1, '素泊まりの回数＋1');
  // 次の潜行の後に、戻り率どおりに抽選
  const rate = H2.insuredPending[0].rate;
  eq(rate, 0.7, '戻り率は神棚Lv1の70%');
  const sdeck = H2.stash.length;
  const S = M.beginDive(base, H2, { seed: 's1', sudomari: true });
  eq(H2.stash.length, sdeck, '素泊まりは蔵から何も持ち出さない');
  ok(S.deck.length === 20 && S.deck.every((c) => c.borrowed), '借り物デッキ20枚');
  S.phase = 'battle'; S.battle = { room: 0, kind: '通常', enemies: ['en_teiki'] };
  { const { B, env } = Dv.diveBattle(base, S); startBattle(B, env); B.hp = 0; B.result = 'lose'; Dv.finishBattle(base, S, B); }
  const r3 = M.finishDive(base, H2, S);
  eq(r3.lost.length, 0, '素泊まりの未帰還は何も失わない');
  eq(H2.stash.length - sdeck, r3.returned.length, '戻った分だけ蔵に増える');
  eq(r3.returned.length + r3.notReturned.length, 10, '戻り待ちは次の潜行の後に全部抽選される');
  eq(H2.insuredPending.length, 0, '戻り待ちは空になる');
  // 稽古（最初の1回）：倒れても持ち込んだデッキは蔵に戻り、編成もそのまま。懐の拾い物は失う
  {
    const Hp = M.newInn(base, 'innP');
    const deck0 = Hp.deck.slice();
    const P1 = M.beginDive(base, Hp, { seed: 'p1', practice: true });
    ok(P1.practice === true, '最初の潜行は稽古になる');
    P1.pouch.push({ uid: 'pk1', type: 'card', id: P1.deck[0].id, origin: 'orig' });
    P1.phase = 'battle'; P1.battle = { room: 0, kind: '通常', enemies: ['en_teiki'] };
    { const { B, env } = Dv.diveBattle(base, P1); startBattle(B, env); B.hp = 0; B.result = 'lose'; Dv.finishBattle(base, P1, B); }
    const rp = M.finishDive(base, Hp, P1);
    ok(rp.outcome === 'lost' && rp.practice, '稽古の未帰還');
    ok(deck0.every((u) => Hp.stash.some((x) => x.uid === u)), '持ち込んだ札は蔵に戻る');
    eq(Hp.deck.join(), deck0.join(), 'デッキの編成もそのまま');
    ok(!Hp.stash.some((x) => x.uid === 'pk1') && rp.lost.length === 1, '懐の拾い物は失う');
    eq(Hp.kuyo, 0, '稽古では供養点も付かない');
    ok(!rp.starter, '素泊まりセットは配られない');
    const P2 = M.beginDive(base, Hp, { seed: 'p2', practice: true });
    ok(!P2.practice, '2回目からは稽古にならない');
  }
  // 戻り率どおり（多数で）
  let won = 0, all = 0;
  for (let k = 0; k < 40; k++) {
    const Hk = M.newInn(base, `ins${k}`);
    Hk.insuredPending = Array.from({ length: 25 }, (_, i) => ({ owned: { uid: `o${i}`, type: 'card', id: 'fx_inu', origin: 'orig' }, rate: 0.7, dive: 0 }));
    Hk.sudomari = 1;
    const Sk = M.beginDive(base, Hk, { seed: `x${k}`, sudomari: true });
    Sk.result = { outcome: 'lost', via: 'battle', floor: 1 }; Sk.phase = 'end';
    const rk = M.finishDive(base, Hk, Sk);
    won += rk.returned.length; all += 25;
  }
  ok(Math.abs(won / all - 0.7) < 0.05, `1000件で戻ったのは ${(won / all * 100).toFixed(1)}%（70%）`);

  // 施設の改装：宿銭とお土産が減り、効果が次の潜行に
  const F = M.newInn(base, 'innF');
  F.zeni = 10000;
  const sv = (id, n) => { for (let i = 0; i < n; i++) F.stash.push({ uid: `${id}_${i}`, type: 'souvenir', id }); };
  sv('sv_furuikagi', 1); sv('sv_hakusen', 1); sv('sv_obidome', 1); sv('sv_yunohana', 2); sv('sv_banzukekire', 4); sv('sv_waretagarasu', 1);
  throws(() => M.upgrade(base, { ...F, zeni: 0 }, 'chouba'), '宿銭が足りないと改装できない');
  const costs = { chouba: [300, {}], kura: [300, { sv_furuikagi: 1 }], monooki: [200, { sv_hakusen: 1 }], kyakuma: [500, { sv_obidome: 1 }], kamidana: [600, { sv_yunohana: 2 }], shikomi: [400, { sv_banzukekire: 3 }] };
  for (const [id, [z, svs]] of Object.entries(costs)) {
    const z0 = F.zeni; const n0 = Object.fromEntries(Object.keys(svs).map((s) => [s, F.stash.filter((x) => x.id === s).length]));
    M.upgrade(base, F, id);
    ok(F.facilities[id] === 2 && F.zeni === z0 - z && Object.entries(svs).every(([s, n]) => F.stash.filter((x) => x.id === s).length === n0[s] - n), `${M.facilityDef(base, id).name}：Lv2、宿銭−${z}${Object.keys(svs).length ? '・お土産も減る' : ''}`);
  }
  ok(!M.upgradeInfo(base, F, 'chouba').ok, 'Lv3は定義だけ（改装できない）');
  eq(M.choubaGoods(base, F).length, 7, '帳場Lv2：札7枚');
  ok(M.choubaGoods(base, F).every((g) => ['並', '上', '特上'].includes(C.cards[g.id].grade)), '帳場Lv2：特上まで');
  eq(M.stashRoom(base, F).cap, 120, '蔵Lv2：120枠（初期60の2倍）');
  const cp = M.copyCard(base, F, F.deck[0]);
  ok(cp.origin === 'copy' && F.stash.every((x) => x.id !== 'sv_waretagarasu'), '蔵Lv2：複製（割れた硝子を使う）');
  eq(M.shikomiMenu(base, F).length, 8, '仕込み場Lv2：仕込み8種');
  M.applyShikomi(base, F, F.deck[1], 'enh', '石');
  ok(F.stash.find((x) => x.uid === F.deck[1]).enh === '石' && F.stash.filter((x) => x.id === 'sv_banzukekire').length === 0, '仕込みを付ける（番付の切れ端を使う）');
  F.loadout.insured = [F.deck[2]];
  eq(M.prepInfo(base, F).premium, Math.max(1, Math.ceil(Dv.sellValue(base, { type: 'card', id: F.stash.find((x) => x.uid === F.deck[2]).id }) * 0.25)), '神棚Lv2：掛け金25%');
  eq(M.returnRate(base, F, 0), 0.75, '神棚Lv2：戻り75%');
  eq(M.prepInfo(base, F).carry.seats, 2, '客間Lv2：持ち込み席2');
  const DF = M.beginDive(base, F, { seed: 'f1' });
  eq(DF.carry.pouch, 10, '物置Lv2：次の潜行の懐が10');

  // 開き直しても同じ結果：毎手 保存→読み直し で進めた潜行と、そのまま進めた潜行が一致
  const run = (reload) => {
    const Hx = M.newInn(base, 'same');
    let Dx = M.beginDive(base, Hx, { seed: 'same1' });
    const rt = (d) => (reload ? Dv.loadDive(Dv.saveDive(d)) : d);
    for (let n = 0; n < 200 && Dx.phase !== 'end'; n++) {
      Dx = rt(Dx);
      if (Dx.phase === 'battle') {
        let { B, env, resumed } = Dv.diveBattle(base, Dx);
        if (!resumed) startBattle(B, env);
        for (let t = 0; t < 600 && !B.result; t++) {
          Dv.keepBattle(Dx, B);
          if (reload) { Dx = rt(Dx); ({ B, env } = Dv.diveBattle(base, Dx)); }
          if (B.playsLeft > 0 && B.hand.length) play(B, env, [0], B.enemies.findIndex((e) => !e.dead)); else endTurn(B, env);
        }
        Dv.finishBattle(base, Dx, B);
      } else toLiftStep(Dx);
    }
    return JSON.stringify({ r: Dx.result, deck: Dx.deck.map((c) => c.id), log: Dx.log.length });
  };
  const toLiftStep = (D) => { const p = D.phase; if (p === 'map') Dv.enterDoor(base, D, Dv.openDoors(D).filter((d) => d.kind !== '非常口')[0].room); else if (p === 'chase') Dv.answerChase(base, D, 'fight'); else if (p === 'reward') Dv.closeReward(base, D); else if (p === 'event') { if (D.event.choice == null) Dv.chooseEvent(base, D, 0); else Dv.leaveRoom(base, D); } else if (p === 'exit') Dv.useExit(base, D, 'back'); else if (p === 'landing') Dv.goBack(base, D); else Dv.leaveRoom(base, D); };
  const a = run(false), b = run(true);
  ok(a === b && a.includes('outcome'), '部屋ごと・戦闘の各行動ごとに保存→読み直ししても、同じ結果で終わる');

  // セーブの版と移行
  const s = M.saveInn(H);
  eq(M.loadInn(s).records.extracts, 1, '宿のセーブを読み直せる');
  throws(() => M.migrate({ ...H, v: 99 }), '新しい版のセーブは読めないと言う');
}

group('段階7：先行版の中身');
{
  const { loadRealContent } = await import('./fixtures/index.mjs');
  const Dv = await import('../engine/dive.js');
  const { base } = await loadRealContent();
  const C = base.content;
  const bySet = (bucket, set) => Object.values(C[bucket]).filter((d) => !set || d.set === set);
  eq(Object.keys(C.regulars).length, 62, '常連客62人（先行版40＋宿泊客6人の専用各3＋限定4）');
  eq(Object.values(C.regulars).filter((d) => d.grow).length, 5, 'うち成長型5人');
  eq(Object.keys(C.relics).length, 36, '置物36（先行版20＋宿泊客6人の最初の置物＋暖簾の外側の縁起物10）');
  eq(Object.keys(C.events).length, 119, '謎119（層の49＋穴の40＋宿泊客の連作24＋階をまたぐ6）');
  ok(!!C.events.ev_noren, '第二層の「暖簾」を含む');
  eq(Object.keys(C.guests).map((g) => bySet('cards', g).length).join('/'), Object.keys(C.guests).map(() => 25).join('/'), '宿泊客8人の専用札が各25枚');
  eq(bySet('cards', 'ryukogo').length, 30, '流行語30枚');
  eq(C.sets.ryukogo.unlock.boss, 'layer4', '流行語は第四層主を倒すと解放（本編）');
  eq(Object.keys(C.enemies).length, 230, '敵230体（通常30・精鋭14・層主10・底の主・追跡者3・番人3・ゴースト・木人・師範＋穴の専用120＋主46）');
  const items = Object.values(C.items);
  eq(`${items.filter((d) => d.kind === '議題').length}/${items.filter((d) => d.kind === '番付札').length}/${items.filter((d) => d.kind === '品').length}`, '13/12/20', 'お品書き：議題13・番付札12（欠番送りを含む）・品15＋暖簾の外側の小瓶5');
  eq(Object.keys(C.souvenirs).length, 28, 'お土産28種（本編で3種追加・底の石・穴の専用8・鍵4）');
  // 常連客と置物を1人ずつ席・棚に置いて戦闘を2ターン：例外が出ない
  const bad = [];
  for (const d of [...Object.values(C.regulars), ...Object.values(C.relics)]) {
    const isReg = !!C.regulars[d.id];
    const B = createBattle(base, { seed: `r-${d.id}`, floor: 2, guest: C.guests[d.set] ? d.set : 'tsuchi', deck: fixtureDeck(), enemies: ['en_teiki', 'en_niwaka'], ...(isReg ? { seats: [{ uid: 's', id: d.id }] } : { relics: [{ uid: 'r', id: d.id }] }) });
    const env = openBattle(base, B);
    startBattle(B, env);
    for (let t = 0; t < 2 && !B.result; t++) { if (B.hand.length) play(B, env, [0, 1].filter((i) => i < B.hand.length), 0); if (!B.result) endTurn(B, env); }
    const errs = B.log.filter((l) => l.t === 'error');
    if (errs.length) bad.push(`${d.id}:${errs[0].message}`);
  }
  eq(bad.join(' / '), '', '常連客・置物がどれも戦闘で例外を出さない');
  // 謎15の選択肢を全部試す
  const evBad = [];
  for (const ev of Object.values(C.events)) {
    ev.choices.forEach((c, i) => {
      const D = Dv.createDive(base, { seed: `e-${ev.id}-${i}`, guest: 'tsuchi', deck: fixtureDeck().map((x, k) => ({ ...x, uid: `d${k}` })) });
      D.zeni = 50;
      D.phase = 'event'; D.event = { id: ev.id, choice: null, result: null }; D.here = { room: 0, row: 0 };
      if (ev.dungeon) D.dungeon = ev.dungeon[0];
      if (ev.guest) D.guest = ev.guest[0];
      if (c.guest) D.guest = c.guest[0];
      if (c.regular) D.seats.push({ uid: 'rx', id: c.regular[0], origin: 'orig' });
      if (c.needFlag) D.flags.ev[c.needFlag] = true;
      try { const ch = Dv.eventChoices(base, D).find((x) => x.i === i); if (c.deckCat && !ch) { /* デッキ次第 */ } else if (!ch) evBad.push(`${ev.id}#${i + 1}:出ない`); else if (ch.ok) Dv.chooseEvent(base, D, i); } catch (e) { evBad.push(`${ev.id}#${i + 1}:${e.message}`); }
    });
  }
  eq(evBad.join(' / '), '', '謎30の選択肢がどれも動く');
}

group('段階7：コードに触れずに札・敵・謎を足せる');
{
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'taabuka-add-'));
  await cp(path.join(ROOT, 'content'), tmp, { recursive: true });
  await appendFile(path.join(tmp, 'sets/ryukogo/cards.yaml'), `
- id: rk_tameshi_add
  name: 足した札
  cat: [麺]
  grade: 上
  text: 採点されると倍率＋3
  fx:
    - when: 採点時
      do: [ { 倍率: 3 } ]
  test:
    - hand: [rk_tameshi_add]
      expect: { V: 55 }   # 上＝アンコモン（量×1.5）：10×(1＋4.5)
`);
  await appendFile(path.join(tmp, 'enemies/layer1.yaml'), `
- id: en_tameshi_add
  name: 足した敵
  layer: [1]
  kind: 通常
  hp: 1.0
  atk: 1.0
  acts: [攻め, { 伏せ: 1 }]
  line: 試しに来た
`);
  const L1 = path.join(tmp, 'layers/layer1.yaml');
  await wf(L1, (await readFile(L1, 'utf8')).replace('groups:\n', 'groups:\n  - [en_tameshi_add]\n'));
  await appendFile(path.join(tmp, 'events/layer1.yaml'), `
- id: ev_tameshi_add
  title: 足した謎
  text: 試しに足した。
  choices:
    - label: 進む
      do: [ { 宿銭: 1 } ]
      result: 進んだ。
`);
  const r = await runCheck({ root: tmp, fixIndex: true });
  const st = r.results.find((x) => x.where.startsWith('rk_tameshi_add'));
  ok(r.errors === 0 && st?.ok, 'YAMLを足して --fix-index だけで検査が通り、足した札の自己テストも通る', r.lines.filter((l) => !l.startsWith('  ')).slice(0, 3).join(' / '));
  ok(!!r.content.enemies.en_tameshi_add && r.content.layers.layer1.groups.some((g) => g.includes('en_tameshi_add')) && !!r.content.events.ev_tameshi_add, '敵は層の組に、謎は第一層に入る');
  // 足した敵と戦える
  const base2 = { balance: r.content.balance, content: r.content };
  const B = createBattle(base2, { seed: 'add', floor: 1, deck: Array.from({ length: 12 }, (_, i) => ({ uid: `a${i}`, id: 'rk_tameshi_add' })), enemies: ['en_tameshi_add'] });
  const env = openBattle(base2, B); startBattle(B, env);
  for (let t = 0; t < 30 && !B.result; t++) { play(B, env, [0], 0); if (!B.result) endTurn(B, env); }
  ok(!!B.result && !B.log.some((l) => l.t === 'error'), '足した敵と最後まで戦える');
  await rm(tmp, { recursive: true, force: true });
}

group('段階8a：深い層（第三〜五層・B16・さらに深く）');
{
  const { loadRealContent } = await import('./fixtures/index.mjs');
  const Dv = await import('../engine/dive.js');
  const { base } = await loadRealContent();
  const C = base.content;
  const D = Dv.createDive(base, { seed: 'deep', guest: 'tsuchi', deck: fixtureDeck().map((x, k) => ({ ...x, uid: `d${k}` })) });
  const names = [7, 10, 13, 16, 17].map((f) => Dv.layerAt(C, f).name).join('/');
  eq(names, '議論の淵/欠番区画/Tier8/ター深/さらに深く', '層の名前（B7・B10・B13・B16・B17）');
  const kinds = (f) => Dv.genFloor(base, D, f).rows.map((r) => r.map((d) => d.kind).join('+'));
  ok([9, 12, 15].every((f) => kinds(f).at(-1) === '層主'), '第三〜五層の3階目に層主');
  eq(kinds(16).join('|'), '層主', 'B16は底の主との1戦だけ');
  eq(Dv.genFloor(base, D, 16).rows[0][0].enemies[0], 'en_taa', 'B16の主は「ター」');
  eq([17, 18, 19, 20, 21, 22].map((f) => (kinds(f).at(-1) === '層主' ? 1 : 0)).join(''), '001001', 'さらに深くは3階ごとに主');
  const bossPool = new Set([...Object.values(C.layers).filter((L) => !L.mix && !L.onlyBoss).flatMap((L) => L.bosses), ...(C.layers.beyond?.bosses || [])]);
  const deepBosses = new Set([19, 22, 25, 28, 31, 34, 37, 40, 43, 46].map((f) => Dv.genFloor(base, D, f).rows.at(-1)[0].enemies[0]));
  ok([...deepBosses].every((id) => bossPool.has(id)) && deepBosses.size >= 3, 'さらに深くの主は全層の層主と深淵の主から乱数', [...deepBosses].join(','));
  const deepEnemies = new Set([17, 18, 20, 21, 23].flatMap((f) => Dv.genFloor(base, D, f).rows.flat().flatMap((d) => d.enemies || [])));
  const layersOf = new Set([...deepEnemies].map((id) => C.enemies[id].layer?.[0]));
  ok(layersOf.size >= 3, 'さらに深くは全層の敵が混ざる', [...layersOf].join(','));
  ok(standardAt(base.balance, 18).claim.gt(standardAt(base.balance, 17).claim.mul(2)), 'B17以降の主張は指数的に伸びる');
  eq(['layer3', 'layer4', 'layer5'].map((id) => `${C.layers[id].stalker}/${C.layers[id].warden}`).join(' '), 'en_kidoku/en_genkanban en_kidoku/en_genkanban en_shisen/en_kaerimichi', '追跡者と番人（既読・玄関番／視線・帰り道）');

  const fight = (enemy, o = {}) => {
    const B = createBattle(base, { seed: o.seed ?? 'f', floor: o.floor ?? 9, depth: o.depth ?? 0, guest: 'tsuchi', deck: fixtureDeck(), enemies: [enemy], quirk: o.quirk, quirkParams: o.qp, seats: o.seats, banzuke: o.banzuke });
    const env = openBattle(base, B);
    return { B, env };
  };
  // 底の主：3形態（深度20で4）。倒すたびに戻る
  for (const [depth, n] of [[0, 3], [20, 4]]) {
    const { B, env } = fight('en_taa', { floor: 16, depth, seats: [{ uid: 's1', id: Object.keys(C.regulars)[0] }] });
    startBattle(B, env);
    ok(B.enemies[0].hideClaim, '底の主の主張は「？？？」表示');
    let forms = 1;
    for (let k = 0; k < 6 && !B.result; k++) {
      if (B.playsLeft <= 0) endTurn(B, env);
      if (B.result) break;
      B.enemies[0].claim = Big.from(0);
      env.api.killEnemy(B, env, B.enemies[0]);
      if (B.enemies.every((e) => e.dead)) { endTurn(B, env); }
      if (B.log.some((l) => l.t === 'form' && l.form === forms + 1)) forms += 1;
      if (forms === 2) ok(Object.values(B.banzuke).every((x) => x === '8'), '第2形態：番付が全てT8');
    }
    eq(`${forms}/${B.enemies[0].dead}`, `${n}/true`, `深度${depth}の底の主は${n}形態`);
  }
  {
    const { B, env } = fight('en_taa', { floor: 16, seats: [{ uid: 's1', id: Object.keys(C.regulars)[0] }] });
    startBattle(B, env);
    ok(B.seats[0].disabled, '第1形態：席を奪う');
    B.enemies[0].claim = Big.from(1); play(B, env, [0], 0);
    ok(!B.seats[0].disabled && Object.values(B.banzuke).every((x) => x === '8'), '第2形態：席は返り、番付が全てT8');
    endTurn(B, env);
    B.enemies[0].claim = Big.from(1); play(B, env, [0], 0);
    eq(B.banzuke.麺, '3', '第3形態：番付は戻る');
    endTurn(B, env);
    ok(B.sealed.cats.length === 1, '第3形態：一番多く出したカテゴリを封じる');
  }
  // 層主
  {
    const { B, env } = fight('en_ketsuban', { floor: 12 });
    startBattle(B, env);
    play(B, env, [0], 0); endTurn(B, env);
    ok(B.sealed.cats.length === 1, '欠番：一番多く出したカテゴリを封じる');
  }
  {
    const { B, env } = fight('en_yakkan8', { floor: 12 });
    startBattle(B, env);
    throws(() => play(B, env, [0], 0), '宿泊約款第8条：5枚でなければ出せない');
  }
  {
    const { B, env } = fight('en_sakasayado', { floor: 9, banzuke: { 麺: 'God' } });
    startBattle(B, env);
    eq(B.banzuke.麺, '8', '逆さ宿：番付が反転');
    B.enemies[0].claim = Big.from(1); play(B, env, [0], 0);
    eq(B.banzuke.麺, 'God', '逆さ宿：戦闘が終わると戻る');
  }
  {
    const { B, env } = fight('en_tier8', { floor: 15 });
    startBattle(B, env);
    ok(B.rules.some((r) => r.name === '全札を同Tier扱い'), 'Tier8：奇数ターンは全札Tier8');
    endTurn(B, env);
    ok(!B.rules.some((r) => r.name === '全札を同Tier扱い'), 'Tier8：偶数ターンは外れる');
  }
  {
    const { B, env } = fight('en_byousoku', { floor: 15 });
    startBattle(B, env);
    endTurn(B, env);
    ok(B.log.some((l) => l.t === 'act' && /流れ去った/.test(l.act)), '秒速5タームメートル：ターンの終わりに手札が流れる');
  }
  {
    const { B, env } = fight('en_kakuzukeshi', { floor: 9, banzuke: { 食べ物: 'God', 死: '0', 宿: '1', 動物: '2', スレ: '8', 湯: '5', 校庭: '4', 速さ: 'God', 格ゲー: '0', ター: '1', 老: '2', 麺: '8', ロボ: '5' } });
    startBattle(B, env);
    for (let t = 0; t < 3 && !B.result; t++) endTurn(B, env);
    ok(B.log.some((l) => l.t === 'banzuke' && l.src === '格付け師'), '格付け師：毎ターン番付が混ざる');
  }
  // 層の癖
  {
    const { B, env } = fight('en_aboon', { floor: 10, quirk: '欠番区画', qp: { 先: '欠6' } });
    startBattle(B, env);
    ok(Object.values(B.banzuke).includes('欠6'), '欠番区画：一番低いカテゴリが欠6へ');
    const D4 = Dv.createDive(base, { seed: 'q', guest: 'tsuchi', deck: fixtureDeck().map((x, k) => ({ ...x, uid: `d${k}` })) });
    D4.floor = 10;
    eq(Dv.quirkOf(base, D4)?.name, '欠番区画', '第四層の戦闘に層の癖が掛かる');
  }
  {
    const { B, env } = fight('en_ronpa', { floor: 7, quirk: '議論の淵', qp: { 毎ターン: 1 } });
    startBattle(B, env);
    const n0 = B.log.filter((l) => l.t === 'banzuke').length;
    endTurn(B, env);
    ok(B.log.filter((l) => l.t === 'banzuke' && l.src === '論破厨').length >= 1 || B.log.filter((l) => l.t === 'banzuke').length > n0, '議論の淵：2ターン目から敵が番付を動かす');
  }
  {
    const { B, env } = fight('en_zako', { floor: 13, quirk: 'Tier8の罠', qp: { 確率: 1 } });
    startBattle(B, env);
    ok(B.rules.some((r) => r.name === '全札を同Tier扱い'), 'Tier8の罠：確率で全札Tier8');
  }
  {
    const { B, env } = fight('en_idgae', { floor: 7 });
    startBattle(B, env);
    B.enemies[0].claim = Big.from(1); play(B, env, [0], 0);
    ok(!B.enemies[0].dead && B.enemies[0].claim.gt(1), 'ID変え：一度だけ戻ってくる');
  }
  // 深度の層主の追加妨害
  {
    const { B, env } = fight('en_kakuzukeshi', { floor: 9, depth: 17 });
    startBattle(B, env);
    eq(B.log.filter((l) => l.t === 'hindrance').length, 2, '深度17：層主に妨害が2つ');
  }
  // 欠番送りは第四層から
  const ko = C.items.tj_bz_ketsubanokuri;
  ok(ko && ko.fromLayer === 4, '欠番送り（第四層以降）');
  const Dk = Dv.createDive(base, { seed: 'k', guest: 'tsuchi', deck: fixtureDeck().map((x, k) => ({ ...x, uid: `d${k}` })) });
  const got = (floor) => { const B = createBattle(base, { seed: `g${floor}`, floor, guest: 'tsuchi', deck: fixtureDeck(), enemies: ['en_teiki'] }); const env = openBattle(base, B); const ids = new Set(); for (let i = 0; i < 80; i++) { B.items = []; const it = gainItem(B, env, '番付札', {}); if (it) ids.add(it.id); } return ids.has('tj_bz_ketsubanokuri'); };
  ok(!got(3) && got(10), '欠番送りは第三層までは出ず、第四層から出る');
  void Dk;
}

group('段階8b：宿泊客（6人追加・専用セット各25枚）');
{
  const { guestAction: gAct } = await import('../engine/battle.js');
  const guestAction = gAct;
  const { loadRealContent } = await import('./fixtures/index.mjs');
  const M = await import('../engine/meta.js');
  const Dv = await import('../engine/dive.js');
  const { base } = await loadRealContent();
  const C = base.content;
  eq(Object.keys(C.guests).sort().join(','), 'ikea,koutei,maap,soutourou,taaaam,taakaku,tatagi,tsuchi', '宿泊客8人');
  eq(['tatagi', 'soutourou', 'taaaam', 'koutei', 'ikea', 'taakaku'].map((g) => C.guests[g].hp).join('/'), '70/75/60/70/70/55', '体力（仕様書 第7章）');
  eq(JSON.stringify(['tatagi', 'soutourou', 'koutei', 'taaaam', 'ikea', 'taakaku'].map((g) => C.guests[g].unlock)), JSON.stringify([{ reach: 6 }, { death: 3 }, { reach: 9 }, { overlap: { 4: 50 } }, { overkill: { 大論破: 50 } }, { extractFrom: 16 }]), '解放条件（B6・未帰還3・B9・4枚重なり50・大論破50・B16から脱出）');
  ok(Object.keys(C.guests).every((g) => M.starterIds(base, g).length === 20), '初期デッキは全員20枚');
  ok(Object.keys(C.guests).every((g) => C.relics[C.guests[g].relic]), '全員に最初の置物');
  const fight = (guest, o = {}) => {
    const B = createBattle(base, { seed: o.seed ?? `g-${guest}`, floor: 1, guest, deck: fixtureDeck(), enemies: ['en_teiki'], relics: o.relics?.map((id, i) => ({ uid: `r${i}`, id })), guestState: o.state });
    B.enemies[0].claim = B.enemies[0].maxClaim = Big.from('1e30');
    const env = openBattle(base, B); startBattle(B, env);
    return { B, env };
  };
  // タタ木
  {
    const { B, env } = fight('tatagi', { relics: ['tt_r_monohoshi'] });
    eq(B.zones.植木.length, 1, 'タタ木：物干し竿で戦闘の始めに1本植わる');
    guestAction(B, env, '植える', { 札: [0, 1] });
    eq(`${B.zones.植木.length}/${B.playsLeft}`, '3/1', 'タタ木：植えると出し回数を使う');
    const n0 = B.log.filter((l) => l.t === 'play').length;
    endTurn(B, env);
    const tp = B.log.filter((l) => l.t === 'play').slice(n0);
    ok(tp.length === 1 && tp[0].src === '植木' && tp[0].steps.some((x) => x.src?.name === 'タタ林'), 'タタ木：ターンの終わりに植木3本をまとめて採点（タタ林で倍率×2）');
    eq(B.zones.植木.length, 3, 'タタ木：採点した植木は枠に残る');
    B.enemies[0].claim = Big.from(1); play(B, env, [0], 0);
    ok(B.result === 'win' && B.zones.植木.length === 0, 'タタ木：戦闘の終わりに植木はデッキへ戻る');
  }
  // 相当老
  {
    const { B, env } = fight('soutourou');
    eq(B.hand.length, 7, '相当老：手札の上限7');
    endTurn(B, env);
    ok(B.hand.filter((c) => (c.vars.熟成 ?? 0) >= 1).length >= 6, '相当老：ターンの終わりに手札が熟成');
  }
  // taaaam様専用
  {
    const D = Dv.createDive(base, { seed: 'tm', guest: 'taaaam', deck: M.starterIds(base, 'taaaam').map((id, i) => ({ uid: `d${i}`, id })) });
    ok(!!D.guestState.専用, `taaaam様専用：選ばなければデッキで一番多いカテゴリ（${D.guestState.専用}）`);
    const D2 = Dv.createDive(base, { seed: 'tm', guest: 'taaaam', deck: [], guestState: { 専用: '麺' } });
    eq(D2.guestState.専用, '麺', 'taaaam様専用：潜行準備で選んだカテゴリ');
    const { B } = fight('taaaam', { state: { 専用: '麺' } });
    eq(B.banzuke.麺, '0', 'taaaam様専用：専用のカテゴリは番付でT0より下がらない');
  }
  // 校庭変化
  {
    const { B, env } = fight('koutei', { relics: ['kt_r_hakusen'] });
    const f = [B.guestState.場]; endTurn(B, env); f.push(B.guestState.場); endTurn(B, env); f.push(B.guestState.場); endTurn(B, env); f.push(B.guestState.場);
    eq(f.join(''), '0120', '校庭変化：場が 校庭→体育館→朝礼台→校庭');
    guestAction(B, env, '白線引き');
    eq(B.guestState.場, 1, '校庭変化：白線引きで場を飛ばす');
    throws(() => guestAction(B, env, '白線引き'), '校庭変化：白線引きは戦闘中1回');
  }
  // IKEA
  {
    const { B, env } = fight('ikea');
    const n = B.hand.length;
    guestAction(B, env, '組み立てる', { 札: [0, 1, 2] });
    const f = B.hand.find((c) => c.furniture);
    ok(f && B.hand.length === n - 2 && f.vars.部品 === 3, 'IKEA：3枚を家具1枚に（部品3）');
    B.enemies[0].claim = Big.from(1); play(B, env, [B.hand.indexOf(f)], 0);
    ok(B.result === 'win' && ![...B.hand, ...B.discard, ...B.draw].some((c) => c.furniture), 'IKEA：戦闘の終わりに家具は分解されて戻る');
  }
  // ター角
  {
    const { B, env } = fight('taakaku');
    const [a, b] = [B.hand[1].uid, B.hand[3].uid];
    guestAction(B, env, '入れ替える', { 札: [1, 3] });
    ok(B.hand[1].uid === b && B.hand[3].uid === a, 'ター角：2枚を入れ替える');
    throws(() => guestAction(B, env, '入れ替える', { 札: [0, 2] }), 'ター角：入れ替えはターンに1回');
  }
  // 8人とも潜行が最後まで動く（ボットで1回ずつ）
  const { botDive } = await import('./bot.mjs');
  const bad = [];
  for (const g of Object.keys(C.guests)) {
    try { const r = botDive(base, { seed: `g8-${g}`, guest: g, pool: Dv.defaultPool(C, g), floors: 6 }); if (!['escaped', 'lost'].includes(r.outcome)) bad.push(`${g}:${r.outcome}`); }
    catch (e) { bad.push(`${g}:${e.message}`); }
  }
  eq(bad.join(' / '), '', '8人ともボットの潜行が止まらず終わる');
}

group('段階8c：永続進行（施設・質屋・深度・解放・実績・図鑑）');
{
  const { loadRealContent } = await import('./fixtures/index.mjs');
  const M = await import('../engine/meta.js');
  const Dv = await import('../engine/dive.js');
  const { base } = await loadRealContent();
  const C = base.content;
  ok((C.facilities || []).every((f) => f.levels.every((l) => l.ready !== false)), '施設は全段階を改装できる（Lv3以降も）');
  // 質屋
  const H = M.newInn(base, 'pawn1');
  ok(!M.pawnInfo(base, H).open && M.pawnGoods(base, H).length === 0, '質屋は帳場Lv3から');
  H.facilities.chouba = 3;
  const goods = M.pawnGoods(base, H);
  ok(goods.length === 3 && goods.every((g) => ['特上', '極'].includes(C.cards[g.id].grade) && ['cursed', 'expiry', 'bet'].includes(C.cards[g.id].origin)), '品揃えは特上〜極の曰く札が3枚');
  M.toggleDeck(base, H, H.deck[0]); M.toggleDeck(base, H, H.deck[0]);
  M.borrowPawn(base, H, 0); M.borrowPawn(base, H, 1);
  throws(() => M.borrowPawn(base, H, 2), '質札は2枚まで');
  const pawned = H.stash.filter((x) => x.origin === 'pawn');
  ok(pawned.length === 2 && pawned.every((x) => H.deck.includes(x.uid)), '借りた質札はデッキに入る');
  const D = M.beginDive(base, H, { seed: 'pawnd' });
  D.hp = 0; D.result = { outcome: 'lost', via: 'battle', floor: 1 }; D.phase = 'end';
  M.finishDive(base, H, D);
  const debt = pawned.reduce((s2, x) => s2 + Dv.sellValue(base, x), 0);
  eq(H.debt, debt, '未帰還で質札の売値が借金に');
  ok(/借金/.test(M.pawnInfo(base, H).reason ?? ''), '借金がある間は質屋を使えない');
  // 深度の解放と印：深度NでB16（底の主）を倒して脱出 → N＋1
  const H2 = M.newInn(base, 'depth1');
  const D2 = M.beginDive(base, H2, { seed: 'dp' });
  D2.stats.bosses.push('core'); D2.stats.deepest = 16; D2.result = { outcome: 'escaped', via: 'lift', floor: 16 }; D2.phase = 'end';
  const r2 = M.finishDive(base, H2, D2);
  ok(r2.depthUp === 1 && H2.unlocked.depth === 1 && H2.stamps.tsuchi === 0, '深度0でB16から脱出：深度1が開き、土に深度0の印');
  ok(H2.unlocked.guests.includes('taakaku'), 'B16から脱出でター角が解放');
  ok(H2.unlocked.guests.includes('tatagi'), 'B6到達でタタ木が解放');
  // 解放条件（仕様書の表）
  const H3 = M.newInn(base, 'unlock1');
  H3.records.deaths = 3; H3.records.deepest = 9; H3.records.counts.hands['4'] = 30; H3.records.counts.hands['5'] = 20; H3.records.counts.overkill.大論破 = 50; H3.records.bosses.push('layer4');
  M.refreshUnlocks(base, H3);
  ok(['soutourou', 'koutei', 'taaaam', 'ikea'].every((g) => H3.unlocked.guests.includes(g)) && H3.unlocked.sets.includes('ryukogo'), '未帰還3・B9・4枚以上の重なり50・大論破50・第四層主で解放');
  // 実績
  const A = C.achievements;
  ok(A.length >= 95 && A.length <= 115, `実績が約100（${A.length}）`);
  ok(H3.achievements.includes('ac_reach9') && H3.achievements.includes('ac_reach3'), '実績が記録から取れる（B9到達など）');
  ok(!H3.achievements.includes('ac_reach12'), 'まだ届かない実績は取れない');
  // 図鑑：見た物・手に入れた物
  ok(H2.codex.seen.length >= H2.codex.owned.length && H2.codex.owned.length > 0, '図鑑：見た物と手に入れた物を数える');
  // 曰く札
  const iw = Object.values(C.cards).filter((d) => d.set === 'iwaku');
  ok(iw.length >= 15 && ['expiry', 'cursed', 'bet'].every((o) => iw.some((d) => d.origin === o)), `曰く札（期限・曰く付き・賭け）${iw.length}枚`);
}

group('段階8d：共有（共有コード・日替わり・縛り）');
{
  const { loadRealContent } = await import('./fixtures/index.mjs');
  const M = await import('../engine/meta.js');
  const Dv = await import('../engine/dive.js');
  const S = await import('../engine/share.js');
  const { base } = await loadRealContent();
  const C = base.content;
  const r = { seed: 'mwmul4vv', guest: 'ikea', depth: 7, deepest: 23, maxVlog: 41.4, seat: 'tt_r_risu' };
  const code = S.encodeShare(C, r);
  ok(/^TB1(-[0-9A-Z]{4}){6}$/.test(code), `共有コードの形（${code}）`);
  eq(JSON.stringify(S.decodeShare(C, code)), JSON.stringify({ v: 1, ...r }), '読むと同じ中身');
  const bad = code.slice(0, -1) + (code.at(-1) === '0' ? '1' : '0');
  eq(S.decodeShare(C, bad), null, '1文字違えば読めない（検算）');
  ok(S.decodeShare(C, code.toLowerCase().replace(/-/g, '')) != null, '小文字・区切りなしでも読める');
  // 共有コードで潜る：同じシードなら同じ階
  const H = M.newInn(base, 'share1');
  const D = M.beginShared(base, H, { code });
  eq(`${D.seed}/${D.guest}/${D.depth}`, 'mwmul4vv/ikea/7', '共有コードの潜行：同じシード・宿泊客・深度');
  const ref = Dv.createDive(base, { seed: 'mwmul4vv', guest: 'ikea', depth: 7, deck: [] });
  eq(JSON.stringify(D.map.rows.map((row) => row.map((d) => d.kind))), JSON.stringify(ref.map.rows.map((row) => row.map((d) => d.kind))), '共有コードの潜行は同じ階');
  ok(D.sudomari && !D.maxFloor, '素泊まり（持ち込みなし・喪失なし）で層の制限なし');
  D.result = { outcome: 'lost', via: 'battle', floor: 1 }; D.phase = 'end';
  const rep = M.finishDive(base, H, D);
  ok(rep.versus && rep.versus.their.deepest === 23 && /^TB1-/.test(rep.share), '結果で相手と比べ、自分の共有コードも出る');
  // 日替わり
  const Ha = M.newInn(base, 'dailyA'), Hb = M.newInn(base, 'dailyB');
  const da = M.beginDaily(base, Ha, { date: '2026-11-19' }), db = M.beginDaily(base, Hb, { date: '2026-11-19' });
  ok(da.seed === db.seed && da.guest === db.guest && da.deck.map((c) => c.id).join() === db.deck.map((c) => c.id).join(), '日替わり：別の宿でも同じシード・宿泊客・借り物デッキ');
  ok(M.beginDaily(base, Ha, { date: '2026-11-20' }).seed !== da.seed, '日付が変われば別の潜行');
  throws(() => M.beginDaily(base, Hb, { date: '2026-11-19' }), '日替わりは1日1回');
  // 縛り
  eq((C.shibari || []).length, 20, '縛り潜行20種');
  const Hs = M.newInn(base, 'shibari1');
  M.setShibari(base, Hs, 'sb_oneplay');
  const Ds = M.beginDive(base, Hs, { seed: 'sb1' });
  Dv.enterDoor(base, Ds, Dv.openDoors(Ds).find((d) => ['戦い', '精鋭'].includes(d.kind))?.room ?? Dv.openDoors(Ds)[0].room);
  if (Ds.phase === 'battle') {
    const { B, env } = Dv.diveBattle(base, Ds); startBattle(B, env);
    eq(B.playsLeft, base.balance.hands.play.playsPerTurn - 1, '縛り「出しはターンに1回」が戦闘に掛かる');
  } else ok(false, '縛りの確認用の戦闘に入れなかった');
  Ds.result = { outcome: 'escaped', via: 'lift', floor: 3 }; Ds.phase = 'end';
  const rs = M.finishDive(base, Hs, Ds);
  ok(rs.shibariReward && Hs.stash.some((x) => x.id === 'gt_ippon') && Hs.records.shibari.includes('sb_oneplay'), '縛りの初回脱出で限定の札');
  ok(Hs.loadout.shibari == null, '縛りは1回の潜行ごと');
  const Hn = M.newInn(base, 'shibari2');
  Hn.stash.push({ uid: 'reg1', type: 'regular', id: Object.keys(C.regulars)[0] }); Hn.loadout.seats = ['reg1'];
  M.setShibari(base, Hn, 'sb_hitori');
  const Dn = M.beginDive(base, Hn, { seed: 'sb2' });
  ok(Dn.seats.length === 0 && Hn.stash.some((x) => x.uid === 'reg1'), '縛り「ひとり旅」：常連客は連れていかず蔵に残る');
  const Hsd = M.newInn(base, 'sudo1'); Hsd.sudomari = 1;
  const Dsd = M.beginDive(base, Hsd, { seed: 'sd1', sudomari: true });
  eq(Dsd.maxFloor, 6, '素泊まり潜行は第二層（B6）まで');
}

group('完全版：札の中身（ター宿・ほとり・プロトコルチャーハン・暖簾の外側・流行語）');
{
  const { loadRealContent } = await import('./fixtures/index.mjs');
  const M = await import('../engine/meta.js');
  const { base } = await loadRealContent();
  const C = base.content;
  const by = (set) => Object.values(C.cards).filter((c) => c.set === set);
  eq(by('taajuku').length, 40, 'ター宿セット40枚');
  const st = M.starterIds(base, 'tsuchi');
  ok(st.length === 20 && st.every((id) => C.cards[id] && C.cards[id].set !== '仮'), '初期デッキに仮の札がない（ター宿セットの並17枚＋入門札3枚）');
  const hs = Object.values(C.sets).filter((x) => x.id.startsWith('h_'));
  eq(hs.length, 41, 'ほとりの41セット（チャーハン4セットはプロトコルチャーハンへ）');
  eq(hs.reduce((n, x) => n + by(x.id).length, 0), 284, 'ほとりの札284枚');
  eq([...new Set(hs.map((x) => x.wave))].sort((a, b) => a - b).join(''), '123456789', 'ほとりは9つの波で解放');
  eq(JSON.stringify(C.sets.h_ham.unlock), JSON.stringify({ start: true }), 'ほとり第1波は最初から');
  eq(JSON.stringify(C.sets.h_houkai.unlock), JSON.stringify({ reach: 16 }), 'ほとり第9波はB16到達');
  eq(`${by('chahan').length}/${C.sets.chahan.unlock.souvenir}`, '30/sv_kuroisara', 'プロトコルチャーハン30枚（黒い皿で解放）');
  eq(`${by('noren_soto').length}/${C.sets.noren_soto.unlock.souvenir}`, '42/sv_noren', '暖簾の外側42枚（暖簾の切れ端で解放）');
  eq(Object.values(C.relics).filter((x) => x.set === 'noren_soto').length + Object.values(C.items).filter((x) => x.set === 'noren_soto').length, 15, '暖簾の外側の縁起物10・小瓶5');
  const all = Object.values(C.cards).filter((c) => c.set !== '仮' && !c.id.startsWith('__'));
  ok(all.length >= 600, `札は全部で${all.length}枚`);
  const H = M.newInn(base, 'pool1');
  const pool = M.poolOf(base, H, 'tsuchi');
  ok(!pool.items.some((id) => C.items[id].set === 'noren_soto'), '暖簾の外側の小瓶は解放前は出ない');
  H.records.brought = ['sv_noren']; M.refreshUnlocks(base, H);
  ok(H.unlocked.sets.includes('noren_soto') && M.poolOf(base, H, 'tsuchi').items.some((id) => C.items[id].set === 'noren_soto'), '暖簾の切れ端を持ち帰ると暖簾の外側が出る');
}

group('読み込みの取り直し（GitHub Pages の 503 対策）');
{
  const { fetchIO } = await import('../engine/content.js');
  const tries = {};
  let peak = 0, now = 0;
  const fake = async (u) => {
    now += 1; peak = Math.max(peak, now);
    await new Promise((r) => setTimeout(r, 5));
    now -= 1;
    const k = u.split('?')[0];
    tries[k] = (tries[k] || 0) + 1;
    if (k.endsWith('missing.yaml')) return { ok: false, status: 404 };
    if (tries[k] <= 2) return { ok: false, status: 503 };
    return { ok: true, status: 200, text: async () => 'ok' };
  };
  const io = fetchIO('http://x/', 'b1', { fetch: fake });
  const got = await Promise.all(Array.from({ length: 20 }, (_, i) => io.readText(`f${i}.yaml`)));
  ok(got.every((x) => x === 'ok'), '503 が2回続いても取り直して読める');
  ok(peak <= 6, `同時に取りに行くのは6本まで（いちばん多いとき ${peak}）`);
  let err = '';
  try { await io.readText('missing.yaml'); } catch (e) { err = e.message; }
  ok(/404/.test(err) && tries['http://x/content/missing.yaml'] === 1, '404 は取り直さずにすぐ知らせる');
}

group('engine/ に札や敵の個別の処理がない');
{
  const files = [];
  const walk = async (d) => { for (const e of await readdir(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) await walk(p); else files.push(p); } };
  await walk(path.join(ROOT, 'engine'));
  const words = ['十条', 'さとさとる', '死ねーぃ', '願望', '焼き鳥', 'タイパ', '知らんけど', '名乗り', '採配', '二倍', '交互', 'にわか', '定期', 'コピペ', 'tsuchi', 'maap', 'ryukogo', 'スレ立て', '襖の主', 'dat落ち', '足音', '下足番', '縄梯子', '暖簾', '安価', 'taajuku', '格付け師', '逆さ宿', '宿泊約款', '秒速5', '議論の淵', '欠番区画', 'Tier8の罠', 'ID変え', '既読', '玄関番', '帰り道'];
  const hits = [];
  for (const f of files) {
    const src = (await readFile(f, 'utf8')).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const w of words) if (src.includes(w)) hits.push(`${path.relative(ROOT, f)}: ${w}`);
  }
  eq(hits.join(' / '), '', '札・宿泊客・敵・目玉ルールの名前が engine/ のコードにない');
  const battleSrc = await readFile(path.join(ROOT, 'engine/battle.js'), 'utf8');
  ok(!battleSrc.includes('ENEMY_ACTS') && createVocab().names('act').length === 9, '敵の行動の語彙は battle.js から vocab/ に移った');
}

console.log(`\n${pass} 通過 / ${fail} 失敗`);
if (fail) { console.log(fails.map((f) => `  ✗ ${f}`).join('\n')); process.exit(1); }

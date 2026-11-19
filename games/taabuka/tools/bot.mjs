// 自動対戦（仕様書 第11章）：engine/ をそのまま使い、画面なしで潜らせて分布を出す。
//   node tools/bot.mjs [--dives 1000] [--seed bot] [--guest tsuchi|maap|all] [--depth 0] [--workers 2] [--out bot-out] [--quiet]
//                      [--add id,id]   初期デッキにその札を2枚ずつ足す（check.mjs の札ごとの試し対戦が使う）
//                      [--floors 9]    この階より深くは下りない
//                      [--ease 2]      深い層の中身を試すための緩め：B4以降の敵の主張を ease^(階−3) で割る（釣り合いの確認には使わない）
//                      [--guests a,b]  宿泊客を指定（--guest all は解放条件に関係なく全員）
// ボットの考え方：
//   出し … 手札から作れる組を全て試算し、敵を倒せるなら最小の札で、倒せないなら最大の論破値
//   流し … 倒せず、流しが残っていれば、一番多いカテゴリかTierに寄らない札を流す
//   報酬 … 格の高い札（デッキが25枚を超えたら懐へ）。常連客は席へ、置物は置く、お土産とお品書きは懐へ
//   踊り場 … 体力が半分未満か、次の層主より弱い（次の階が層主の階で、最大論破値×12 が層主の主張に届かない。
//            層主戦は出しがおよそ12回）なら引き返す。層主の後は昇降機で帰るか下りるかを同じ決まりで選ぶ
// 出力：CSV（bot-out/dives.csv・hands.csv・cards.csv・floors.csv）と短い要約。
// B3脱出率は「B3の層主を倒した潜行の割合」（層主の後の踊り場で昇降機を選べば脱出できる）。B6到達率は最深がB6の割合。
// 同じ --seed なら結果は毎回同じ（ワーカーの数にもよらない）。

import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { startBattle, play, discard, endTurn, predict, makeEnemy, standardAt, guestAction } from '../engine/battle.js';
import { cardStrength } from '../engine/score.js';
import { Big } from '../engine/big.js';
import {
  createDive, diveBattle, finishBattle, enterDoor, openDoors, isHidden, answerChase, takeReward, rewardDests, closeReward,
  leaveRoom, buy, useBath, chooseEvent, eventChoices, landingInfo, descend, goBack, useExit, layerAt, defaultPool, genFloor,
} from '../engine/dive.js';
import { starterIds } from '../engine/meta.js';
import { loadRealContent } from './fixtures/index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

// ───────────────────────── 戦闘のボット ─────────────────────────

const sig = (c) => `${c.id}|${c.enh ?? ''}|${c.ed ?? ''}|${c.seal ?? ''}|${c.grow ?? 0}|${c.plusS ?? 0}|${c.faceDown ? 1 : 0}|${c.cat}|${c.tier}`;

/** 手札から作れる組を全て試算（同じ中身の札の組み合わせは1回だけ） */
function bestPlay(B, env) {
  const target = B.enemies.findIndex((e) => !e.dead);
  if (target < 0) return null;
  const claim = B.enemies[target].claim;
  const n = B.hand.length;
  const max = Math.min(env.balance.hands.play.maxPlayCards, B.playLimit ?? 99);
  const seen = new Set();
  let best = null;
  for (let m = 1; m < (1 << n); m++) {
    let k = 0; const s = [];
    for (let i = 0; i < n; i++) if (m & (1 << i)) { s.push(i); k++; }
    if (k > max) continue;
    if (B.fixedPlay != null && k !== Math.min(B.fixedPlay, n)) continue;
    const key = s.map((i) => sig(B.hand[i])).sort().join('/');
    if (seen.has(key)) continue;
    seen.add(key);
    let p;
    try { p = predict(B, env, s, target); } catch { continue; }
    const kills = p.V.gte(claim);
    const c = { s, V: p.V, kills, hand: p.hand };
    if (!best) { best = c; continue; }
    if (kills !== best.kills) { if (kills) best = c; continue; }
    if (kills) { if (s.length < best.s.length || (s.length === best.s.length && c.V.gt(best.V))) best = c; }
    else if (c.V.gt(best.V) || (c.V.eq(best.V) && s.length < best.s.length)) best = c;
  }
  return best && { ...best, target };
}

/** 流す札：一番多いカテゴリかTierに寄らない札（最大3枚） */
function discardPick(B, keep) {
  const cat = {}; const tier = {};
  B.hand.forEach((c) => { for (const x of c.cat || []) cat[x] = (cat[x] || 0) + 1; if (c.tier != null) tier[c.tier] = (tier[c.tier] || 0) + 1; });
  const topCat = Object.entries(cat).sort((a, b) => b[1] - a[1])[0];
  const topTier = Object.entries(tier).sort((a, b) => b[1] - a[1])[0];
  const byTier = topTier && topTier[1] >= (topCat?.[1] ?? 0);
  return B.hand.map((c, i) => ({ c, i })).filter(({ c, i }) => !keep.includes(i) && (byTier ? String(c.tier) !== topTier[0] : !(c.cat || []).includes(topCat?.[0])))
    .slice(0, 3).map(({ i }) => i);
}

/** 宿泊客の固有行動（倒せないときだけ）。行動したら true */
function botGuest(B, env, c) {
  const id = B.guestSwap || B.guest;
  const str = (x) => cardStrength(x, env.balance);
  const weakest = (n, keep = []) => B.hand.map((x, i) => ({ x, i })).filter(({ i }) => !keep.includes(i)).sort((a, b) => str(a.x) - str(b.x)).slice(0, n).map(({ i }) => i);
  const strongest = (n, keep = []) => B.hand.map((x, i) => ({ x, i })).filter(({ i }) => !keep.includes(i)).sort((a, b) => str(b.x) - str(a.x)).slice(0, n).map(({ i }) => i);
  try {
    if (id === 'tatagi' && (B.zones?.植木?.length ?? 0) <= 3 && B.playsLeft > 0 && B.hand.length > 2 && !c?.kills && B.turnPlays === 0) {
      guestAction(B, env, '植える', { 札: strongest(Math.min(2, 5 - (B.zones?.植木?.length ?? 0)), c?.s?.length >= 4 ? c.s : []) }); return true;
    }
    if (id === 'ikea' && B.playsLeft > 1 && B.hand.length >= 6 && !c?.kills && !B.hand.some((x) => x.furniture)) {
      guestAction(B, env, '組み立てる', { 札: weakest(3, c?.s || []) }); return true;
    }
    if (id === 'maap' && (B.guestState.採配点 ?? 0) > 0) {
      const n = {};
      for (const x of B.hand) for (const cat of x.cat || []) n[cat] = (n[cat] || 0) + 1;
      const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (top && B.banzuke[top] !== 'God' && env.balance.tiers.banzukeSteps.includes(B.banzuke[top])) { guestAction(B, env, '採配', { カテゴリ: top, 向き: 1 }); return true; }
    }
    if (id === 'taakaku' && (B.guestState.入れ替え ?? 0) > 0 && B.hand.length > 2) {
      const best = strongest(1)[0];
      if (best != null && best !== 0 && best !== B.hand.length - 1) { guestAction(B, env, '入れ替える', { 札: [best, 0] }); return true; }
    }
  } catch { /* できなかった */ }
  return false;
}

/** 戦闘を最後まで。{turns, plays:[{hand, V}]} を返す */
export function botBattle(B, env, rec) {
  let guard = 0;
  while (!B.result && guard++ < 300) {
    if (B.playsLeft > 0 && B.hand.length) {
      const c = bestPlay(B, env);
      if (botGuest(B, env, c)) continue;
      if (c && !c.kills && B.discardsLeft > 0 && !B.sealed?.discard) {
        const d = discardPick(B, c.s);
        if (d.length) { try { discard(B, env, d); continue; } catch { /* 流せない */ } }
      }
      if (c) {
        try {
          play(B, env, c.s, c.target);
          const e = [...B.log].reverse().find((l) => l.t === 'play');
          if (e) { rec.hands[e.hand] = (rec.hands[e.hand] || 0) + 1; rec.lastV.push(e.V); }
          for (const i of c.s) { /* 札の使用回数 */ }
          continue;
        } catch { /* 出せない */ }
      }
    }
    endTurn(B, env);
  }
  if (!B.result && process.env.BOTDEBUG) console.error('止まった戦闘', B.turn, B.hp, B.enemies.map((e) => `${e.name}:${e.claim}`), B.log.slice(-12).map((l) => JSON.stringify(l).slice(0, 140)));
  return B;
}

// ───────────────────────── 潜行のボット ─────────────────────────

const DOOR = { 寄り道: 6, 宝: 5, 戦い: 4, 謎: 3, 湯: 2, 商い: 2, 精鋭: 3, 層主: 9, 非常口: -9 };

function nextBossClaim(base, D) {
  const C = base.content;
  const f = D.floor + 1;
  const L = layerAt(C, f);
  if (!L) return null;
  const m = genFloor(base, D, f);
  const id = m?.rows.flat().find((d) => d.kind === '層主')?.enemies?.[0] ?? D.bosses[L.id] ?? L.bosses?.[0];
  const def = C.enemies[id];
  if (!def) return null;
  // 底の主は形態の数だけ主張がある
  const forms = def.kind === '底の主' ? (def.params?.形態 ?? 3) : 1;
  return makeEnemy(base.balance, def, { floor: f, depth: D.depth, presence: 0 }, 'b').claim.mul(forms);
}

/** 1回の潜行。記録を返す */
export function botDive(base, o) {
  const C = base.content;
  const deckIds = [...starterIds(base, o.guest), ...(o.add || []).flatMap((id) => [id, id])];
  const deck = deckIds.map((id, i) => ({ uid: `d${i}`, id, origin: C.cards[id]?.origin ?? 'orig' }));
  const g = C.guests[o.guest];
  const D = createDive(base, { seed: o.seed, guest: o.guest, depth: o.depth || 0, deck, relics: g?.relic ? [{ uid: 'g', id: g.relic, guest: true }] : [], pool: o.pool });
  const rec = { hands: {}, lastV: [], battles: { 通常: [], 精鋭: [], 層主: [], 追跡者: [], 番人: [] }, floorV: {}, bestV: Big.from(0), killedTaa: false };
  let steps = 0;
  while (D.phase !== 'end' && steps++ < 4000) {
    const hp = D.hp / D.maxHp;
    switch (D.phase) {
      case 'map': {
        const doors = openDoors(D);
        const sc = (d) => (isHidden(D, d) ? 2.5 : DOOR[d.kind] ?? 0) + (d.kind === '湯' && hp < 0.6 ? 6 : 0) - (d.kind === '精鋭' && hp < 0.6 ? 4 : 0) - (d.kind === '寄り道' && D.presence >= 6 ? 7 : 0) + (d.glow ? 1 : 0);
        const d = doors.slice().sort((a, b) => sc(b) - sc(a) || a.room - b.room)[0];
        enterDoor(base, D, d.room);
        break;
      }
      case 'chase': answerChase(base, D, hp > 0.5 ? 'fight' : 'flee'); break;
      case 'battle': {
        const kind = D.battle.kind;
        rec.lastKind = kind;
        const { B, env } = diveBattle(base, D);
        startBattle(B, env);
        rec.lastV = [];
        botBattle(B, env, rec);
        rec.battles[kind]?.push(B.turn);
        if (B.result === 'win' && B.enemies.some((e) => e.kind === '底の主')) rec.killedTaa = true;
        const top = rec.lastV.reduce((m, v) => (v.gt(m) ? v : m), Big.from(0));
        if (top.gt(rec.bestV)) rec.bestV = top;
        const r = top.isZero?.() ? 0 : top.div(standardAt(base.balance, D.floor).claim).toNumber();
        (rec.floorV[D.floor] ||= []).push(r);
        finishBattle(base, D, B);
        break;
      }
      case 'reward': {
        const grades = base.balance.economy.grades;
        D.reward.groups.forEach((gr, gi) => {
          let best = 0;
          if (gr.type === 'card') gr.options.forEach((x, i) => { if (grades.indexOf(C.cards[x.id]?.grade) > grades.indexOf(C.cards[gr.options[best].id]?.grade)) best = i; });
          const x = gr.options[best];
          const dests = rewardDests(base, D, x).filter((y) => y.ok && y.to !== 'skip');
          const pref = x.type === 'card' && D.deck.length >= 25 ? dests.filter((y) => y.to !== 'deck') : dests;
          takeReward(base, D, gi, best, pref[0]?.to ?? 'skip');
        });
        closeReward(base, D);
        break;
      }
      case 'shop': {
        const i = D.shop.goods.findIndex((gd) => gd.type === 'card' && !gd.sold && gd.price <= D.zeni && ['上', '特上', '極', '神'].includes(C.cards[gd.id]?.grade) && D.deck.length < 25);
        if (i >= 0) buy(base, D, i, { to: 'deck' });
        leaveRoom(base, D);
        break;
      }
      case 'bath': useBath(base, D, hp < 0.85 ? 'heal' : 'calm'); leaveRoom(base, D); break;
      case 'event': {
        if (D.event.choice == null) { const ch = eventChoices(base, D).filter((c) => c.ok); chooseEvent(base, D, ch[ch.length > 1 && hp < 0.4 ? ch.length - 1 : 0].i); }
        if (D.phase === 'event') leaveRoom(base, D);
        break;
      }
      case 'exit': useExit(base, D, 'back'); break;
      case 'landing': {
        const info = landingInfo(base, D);
        // 「次の層主」は、次の階が層主の階のときだけ比べる
        const boss = info.next?.boss ? nextBossClaim(base, D) : null;
        const weak = boss && rec.bestV.mul(12).lt(boss);
        const go = info.canDescend && D.floor + 1 <= (o.floors ?? 99) && hp >= 0.5 && !weak;
        if (!go) rec.why = !info.canDescend ? '最深' : hp < 0.5 ? '体力' : weak ? '層主' : '上限';
        if (go) descend(base, D); else goBack(base, D);
        break;
      }
      default: throw new Error(`知らない場面 ${D.phase}`);
    }
  }
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  return {
    seed: o.seed, guest: o.guest, outcome: D.result?.outcome ?? 'stuck', via: D.result?.via ?? '', deepest: D.stats.deepest, floor: D.floor,
    battles: D.stats.battles, turnsNormal: avg(rec.battles.通常), turnsElite: avg(rec.battles.精鋭), turnsBoss: avg(rec.battles.層主),
    bossTurns: rec.battles.層主, normalTurns: rec.battles.通常,
    maxV: String(D.stats.maxV), maxVlog: D.stats.maxV.isZero?.() ? 0 : D.stats.maxV.log10(), zeni: D.zeni, hp: D.hp,
    bosses: D.stats.bosses.slice(), b3boss: D.stats.bosses.includes('layer1') ? 1 : 0, taa: rec.killedTaa ? 1 : 0, depth: D.depth,
    why: rec.why ?? (D.result?.outcome === 'lost' ? rec.lastKind : ''), hands: rec.hands, floorV: rec.floorV, deck: D.deck.map((c) => c.id), add: o.add || [],
  };
}

/** --ease：深い層の中身を最後まで通すために、敵の主張を緩めた base を作る */
export function easeBase(base, k) {
  if (!k || k <= 1) return base;
  const curve = structuredClone(base.balance.curve);
  for (const [f, v] of Object.entries(curve.floors)) if (Number(f) > 3) v.claim = Math.max(1, Math.round(v.claim / k ** (Number(f) - 3)));
  curve.beyond = { ...curve.beyond, claimMul: Math.max(1.05, curve.beyond.claimMul / k) };
  return { ...base, balance: { ...base.balance, curve } };
}

// ───────────────────────── まとめ ─────────────────────────

const LAYER_BANDS = [['第一層', 1, 3], ['第二層', 4, 6], ['第三層', 7, 9], ['第四層', 10, 12], ['第五層', 13, 15], ['B16', 16, 16], ['B17〜', 17, 1e9]];
/** 各層に1度でも入った潜行の数 */
function layerReach(rows) { return LAYER_BANDS.map(([nm, lo]) => [nm, rows.filter((r) => r.deepest >= lo).length]); }
/** 最深がその層だった潜行の [名前, 脱出数, 数] */
function layerEscape(rows) {
  return LAYER_BANDS.map(([nm, lo, hi]) => { const in_ = rows.filter((r) => r.deepest >= lo && r.deepest <= hi); return [nm, in_.filter((r) => r.outcome === 'escaped').length, in_.length]; });
}

export function summarize(rows) {
  const n = rows.length;
  const pct = (k) => `${((k / n) * 100).toFixed(1)}%`;
  const esc = rows.filter((r) => r.outcome === 'escaped');
  // B3脱出率：B3の層主を倒した潜行の割合（そこで昇降機を選べば脱出できる。下りた後に倒れても数える）
  const b3esc = rows.filter((r) => r.b3boss).length;
  const b6 = rows.filter((r) => r.deepest >= 6).length;
  const flat = (k) => rows.flatMap((r) => r[k]);
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const hands = {};
  for (const r of rows) for (const [h, c] of Object.entries(r.hands)) hands[h] = (hands[h] || 0) + c;
  const hTotal = Object.values(hands).reduce((s, x) => s + x, 0) || 1;
  const handShare = Object.entries(hands).sort((a, b) => b[1] - a[1]).map(([h, c]) => [h, c / hTotal]);
  const floors = {};
  for (const r of rows) for (const [f, a] of Object.entries(r.floorV)) (floors[f] ||= []).push(...a);
  const deep = {};
  for (const r of rows) deep[r.deepest] = (deep[r.deepest] || 0) + 1;
  const S = {
    n, escape: esc.length / n, b3escape: b3esc / n, b6reach: b6 / n,
    turnsNormal: avg(flat('normalTurns')), turnsBoss: avg(flat('bossTurns')),
    handShare, topHand: handShare[0], floors: Object.fromEntries(Object.entries(floors).map(([f, a]) => [f, avg(a)])), deep,
  };
  const ok = (v, lo, hi) => (v >= lo && v <= hi ? '○' : '×');
  S.goals = {
    'B3脱出率 60〜75%': ok(S.b3escape, 0.6, 0.75),
    'B6到達率 20〜35%': ok(S.b6reach, 0.2, 0.35),
    '通常戦 2〜3ターン': ok(S.turnsNormal, 2, 3),
    '層主 4〜6ターン': ok(S.turnsBoss, 4, 6),
    '一つの組が50%以下': ok(S.topHand?.[1] ?? 0, 0, 0.5),
  };
  S.text = [
    `潜行 ${n}回　脱出 ${pct(esc.length)}・未帰還 ${pct(n - esc.length)}`,
    `B3脱出率 ${pct(b3esc)}（目標60〜75%）${S.goals['B3脱出率 60〜75%']}　B6到達率 ${pct(b6)}（目標20〜35%）${S.goals['B6到達率 20〜35%']}`,
    `平均ターン：通常戦 ${S.turnsNormal.toFixed(2)}（目標2〜3）${S.goals['通常戦 2〜3ターン']}　層主 ${S.turnsBoss.toFixed(2)}（目標4〜6）${S.goals['層主 4〜6ターン']}`,
    `組の使用率：${handShare.slice(0, 6).map(([h, s]) => `${h} ${(s * 100).toFixed(1)}%`).join('・')}　${S.goals['一つの組が50%以下']}`,
    `層ごとの到達：${layerReach(rows).map(([nm, k]) => `${nm} ${pct(k)}`).join('・')}　底の主撃破 ${pct(rows.filter((r) => r.taa).length)}`,
    `層ごとの脱出率（その層が最深だった潜行のうち脱出した割合）：${layerEscape(rows).map(([nm, a, b]) => `${nm} ${b ? ((a / b) * 100).toFixed(0) : '-'}%（${b}）`).join('・')}`,
    `宿泊客ごと（脱出率・平均最深）：${[...new Set(rows.map((r) => r.guest))].map((g) => { const a = rows.filter((r) => r.guest === g); return `${g} ${pct(a.filter((r) => r.outcome === 'escaped').length * n / a.length)}・B${(a.reduce((s2, r) => s2 + r.deepest, 0) / a.length).toFixed(1)}`; }).join('　')}`,
    `最深の分布：${Object.entries(deep).sort((a, b) => a[0] - b[0]).map(([f, c]) => `B${f} ${pct(c)}`).join('・')}`,
    `最大論破値÷標準主張（階ごとの平均）：${Object.entries(S.floors).sort((a, b) => a[0] - b[0]).map(([f, v]) => `B${f} ${v.toFixed(1)}`).join('・')}`,
  ].join('\n');
  return S;
}

function toCSV(rows, cols) {
  const q = (v) => { const s = v == null ? '' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => q(r[c])).join(','))].join('\n') + '\n';
}

async function writeOut(dir, rows, S, base) {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'dives.csv'), toCSV(rows.map((r, i) => ({ dive: i + 1, ...r })), ['dive', 'seed', 'guest', 'outcome', 'via', 'why', 'b3boss', 'deepest', 'floor', 'battles', 'turnsNormal', 'turnsElite', 'turnsBoss', 'maxV', 'zeni', 'hp']));
  await writeFile(path.join(dir, 'hands.csv'), toCSV(S.handShare.map(([hand, share]) => ({ hand, share })), ['hand', 'share']));
  await writeFile(path.join(dir, 'floors.csv'), toCSV(Object.entries(S.floors).map(([floor, ratio]) => ({ floor, ratio })), ['floor', 'ratio']));
  // 札ごとの採用率（潜行の終わりのデッキに入っていた割合）と勝率（その潜行が脱出だった割合）
  const cards = {};
  for (const r of rows) for (const id of new Set(r.deck)) { const c = (cards[id] ||= { id, dives: 0, wins: 0 }); c.dives += 1; if (r.outcome === 'escaped') c.wins += 1; }
  const list = Object.values(cards).map((c) => ({ id: c.id, name: base.content.cards[c.id]?.name ?? c.id, grade: base.content.cards[c.id]?.grade ?? '', adoption: c.dives / rows.length, winRate: c.wins / c.dives })).sort((a, b) => b.adoption - a.adoption);
  await writeFile(path.join(dir, 'cards.csv'), toCSV(list, ['id', 'name', 'grade', 'adoption', 'winRate']));
  await writeFile(path.join(dir, 'summary.txt'), `${S.text}\n`);
}

// ───────────────────────── 実行 ─────────────────────────

/** 潜行を n 回（ワーカーに分ける）。同じ seed なら同じ結果 */
export async function runBot(o) {
  const n = o.dives ?? 100;
  const guests = o.guests ?? (o.guest === 'all' || !o.guest ? ['tsuchi', 'maap'] : [o.guest]);
  const jobs = Array.from({ length: n }, (_, i) => ({ i, seed: `${o.seed ?? 'bot'}-${i}`, guest: guests[i % guests.length] }));
  const W = Math.max(1, Math.min(o.workers ?? os.cpus().length, n));
  const rows = new Array(n);
  let done = 0;
  const say = o.progress ? (s) => process.stderr.write(s) : () => {};
  if (W === 1) {
    const base = easeBase((await loadRealContent()).base, o.ease);
    const pool = defaultPool(base.content, null);
    for (const j of jobs) { rows[j.i] = botDive(base, { ...o, ...j, pool: poolFor(base, j.guest) }); done++; if (done % 20 === 0) say(`\r${done}/${n}`); }
    void pool;
  } else {
    await Promise.all(Array.from({ length: W }, (_, w) => new Promise((resolve, reject) => {
      const mine = jobs.filter((j) => j.i % W === w);
      const wk = new Worker(fileURLToPath(import.meta.url), { workerData: { jobs: mine, o: { depth: o.depth, add: o.add, floors: o.floors, ease: o.ease } } });
      wk.on('message', (m) => { rows[m.i] = m.row; done++; if (done % 20 === 0) say(`\r${done}/${n}`); });
      wk.on('error', reject);
      wk.on('exit', resolve);
    })));
  }
  say(`\r${n}/${n}\n`);
  return rows;
}

/** 先行版の拾える範囲：解放済み（最初から）のセット＋その宿泊客の専用セット＋仮の札 */
function poolFor(base, guest) { return defaultPool(base.content, guest); }

if (!isMainThread) {
  const base = easeBase((await loadRealContent()).base, workerData.o.ease);
  for (const j of workerData.jobs) {
    let row;
    try { row = botDive(base, { ...workerData.o, ...j, pool: poolFor(base, j.guest) }); }
    catch (e) { row = { seed: j.seed, guest: j.guest, outcome: 'error', via: String(e.message).slice(0, 80), deepest: 0, floor: 0, battles: 0, normalTurns: [], bossTurns: [], hands: {}, floorV: {}, deck: [], maxV: '0' }; }
    parentPort.postMessage({ i: j.i, row });
  }
}

async function main() {
  const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
  const t0 = Date.now();
  const o = {
    dives: Number(arg('dives', 200)), seed: arg('seed', 'bot'), guest: arg('guest', 'all'), depth: Number(arg('depth', 0)),
    workers: Number(arg('workers', os.cpus().length)), add: arg('add') ? arg('add').split(',') : [], floors: arg('floors') ? Number(arg('floors')) : undefined,
    ease: arg('ease') ? Number(arg('ease')) : undefined, guests: arg('guests') ? arg('guests').split(',') : undefined,
    progress: !process.argv.includes('--quiet'),
  };
  const rows = await runBot(o);
  const errs = rows.filter((r) => r.outcome === 'error' || r.outcome === 'stuck');
  const S = summarize(rows.filter((r) => r.outcome !== 'error'));
  const { base } = await loadRealContent();
  await writeOut(path.resolve(ROOT, arg('out', 'bot-out')), rows, S, base);
  console.log(S.text);
  if (errs.length) console.log(`止まった潜行 ${errs.length}：${errs.slice(0, 3).map((r) => `${r.seed} ${r.via}`).join(' / ')}`);
  console.log(`（${((Date.now() - t0) / 1000).toFixed(0)}秒・ワーカー${o.workers}・CSV：${arg('out', 'bot-out')}/）`);
}

if (isMainThread && process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

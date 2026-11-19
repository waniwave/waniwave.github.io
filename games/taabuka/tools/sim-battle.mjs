// 仮の札20枚とB1の敵で戦闘を1回回し、手順列を文字で表示する。
//   node tools/sim-battle.mjs [--seed 42] [--enemies en_teiki,en_jien] [--hp 70] [--guest tsuchi]
// 同じシードなら出力は毎回同じ。

import { createBattle, openBattle, startBattle, play, discard, endTurn, predict } from '../engine/battle.js';
import { format, formatMul } from '../engine/format.js';
import { cardStrength } from '../engine/score.js';
import { loadContent, nodeIO } from '../engine/content.js';
import { loadNodeBalance, fixtureContent, fixtureDeck } from './fixtures/index.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

/** 手札から作れる出し方（1〜5枚）を全部 */
function subsets(n, max) {
  const out = [];
  const rec = (start, cur) => {
    if (cur.length) out.push(cur.slice());
    if (cur.length === max) return;
    for (let i = start; i < n; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}

/** 素朴なボット：倒せるなら最小の札で、倒せないなら最大の論破値 */
function choosePlay(B, env) {
  const target = B.enemies.findIndex((e) => !e.dead);
  const claim = B.enemies[target].claim;
  let best = null;
  for (const s of subsets(B.hand.length, env.balance.hands.play.maxPlayCards)) {
    const p = predict(B, env, s, target);
    const kills = p.V.gte(claim);
    const cand = { s, p, kills };
    if (!best) { best = cand; continue; }
    if (kills !== best.kills) { if (kills) best = cand; continue; }
    if (kills) {
      if (s.length < best.s.length || (s.length === best.s.length && p.V.gt(best.p.V))) best = cand;
    } else if (p.V.gt(best.p.V) || (p.V.eq(best.p.V) && s.length < best.s.length)) best = cand;
  }
  return { ...best, target };
}

/** 流す札：選んだ出しに使わない札のうち弱いものを3枚まで */
function chooseDiscard(B, env, keep) {
  const rest = B.hand.map((c, i) => ({ c, i })).filter(({ i }) => !keep.includes(i));
  rest.sort((a, b) => cardStrength(a.c, env.balance) - cardStrength(b.c, env.balance) || a.i - b.i);
  return rest.slice(0, 3).map(({ i }) => i);
}

function srcName(src) {
  if (!src) return '';
  if (src.kind === 'banzuke') return `番付 ${src.id}（${src.slot === 'God' ? 'God' : `T${src.slot}`}）`;
  const tag = src.enh ? `［${src.enh}］` : src.ed ? `［${src.ed}］` : src.seal ? `［${src.seal}］` : '';
  return `${src.name ?? src.id ?? src.kind}${tag}`;
}

function printStep(st) {
  switch (st.type) {
    case 'hand': return `    組「${st.src.id}」段位${st.src.level}  強さ ${format(st.S)} × 倍率 ${formatMul(st.M)}`;
    case 'S': return `    ${srcName(st.src)}  強さ +${format(st.add)} → ${format(st.S)}`;
    case 'M': return `    ${srcName(st.src)}  倍率 ${st.add.isNeg() ? '' : '+'}${formatMul(st.add)} → ${formatMul(st.M)}`;
    case 'xM': return `    ${srcName(st.src)}  倍率 ×${formatMul(st.mul)} → ${formatMul(st.M)}`;
    case 'xS': return `    ${srcName(st.src)}  強さ ×${formatMul(st.mul)} → ${format(st.S)}`;
    case 'floorM': return `    倍率は1を下回らない → ${formatMul(st.M)}`;
    case 'note': return `    ${srcName(st.src)}  ${st.what}`;
    case 'xV': return `    ${srcName(st.src)}  論破値 ×${formatMul(st.mul)}`;
    case 'final': return `    ＝ 論破値 ${format(st.V)}（強さ ${format(st.S)} × 倍率 ${formatMul(st.M)}）`;
    default: return `    ${st.type}`;
  }
}

function printLog(entries) {
  const out = [];
  for (const e of entries) {
    switch (e.t) {
      case 'start': out.push(`戦闘開始：${e.enemies.map((x) => `${x.name}（主張 ${format(x.claim)}・攻撃 ${x.atk}）`).join('、')}`); break;
      case 'turn': out.push(`― ${e.n}ターン目 ―`); break;
      case 'presence': out.push(`  気配 +${e.add}（${e.presence}）`); break;
      case 'reshuffle': out.push(`  捨て札を切って山札に（${e.n}枚）`); break;
      case 'draw': out.push(`  引く：${e.cards.join('、')}`); break;
      case 'faceDown': out.push(`  手札${e.n}枚が裏向きに`); break;
      case 'discard': out.push(`  流す：${e.cards.join('、')}`); break;
      case 'play':
        out.push(`  出す：${e.cards.join('、')} → ${e.hand}${e.sealed ? '（封じ）' : ''}`);
        for (const st of e.steps) out.push(printStep(st));
        break;
      case 'damage': out.push(`  → ${e.pierce ? '貫通して ' : ''}${e.name}に ${format(e.amount)}（残り ${format(e.after)}）${e.killed ? ' 論破' : ''}`); break;
      case 'guard': out.push(`  受け +${e.add}（${e.card}）→ ${e.guard}`); break;
      case 'broken': out.push(`  ${e.card} が割れた`); break;
      case 'zeni': out.push(`  宿銭 +${e.add}（${e.why}）`); break;
      case 'item': out.push(`  お品書き：${e.kind}${e.hand ? `（${e.hand}）` : ''}`); break;
      case 'attack': out.push(`  ${e.name}の攻め ${e.dmg}：受けで ${e.guarded}、体力 −${e.loss} → ${e.hp}`); break;
      case 'heal': out.push(`  ${e.name}が居座る：主張 +${format(e.amount)}`); break;
      case 'act': out.push(`  ${e.name}：${e.act}${e.n ? ` ${e.n}` : ''}${e.what ? `（${e.what}）` : ''}`); break;
      case 'summon': out.push(`  ${e.by}が${e.name}を呼んだ（主張 ${format(e.claim)}）`); break;
      case 'banzuke': out.push(`  番付：${e.cat} ${e.from} → ${e.to}`); break;
      case 'rule': out.push(`  ルール：${e.name}（${e.scope}）`); break;
      case 'overkill': out.push(`  過剰論破 ×${formatMul(e.r)}：${e.level ?? 'なし'}${e.level ? `（宿銭 +${e.rewards.zeni}）` : ''}`); break;
      case 'end': out.push(e.result === 'win' ? '勝ち' : '未帰還'); break;
      case 'error': out.push(`  [記録] ${e.hook}：${e.message}`); break;
      case 'defeated': break; // damage の行に「論破」と出る
      case 'mod': out.push(`  ${{ plays: '出し', discards: '流し', handSize: '手札上限' }[e.key]} ${e.delta > 0 ? '+' : ''}${e.delta}（${e.scope}）`); break;
      case 'stun': out.push(`  ${e.name}は${e.turns}ターン行動できない`); break;
      case 'spawn': out.push(`  ${e.card}が生まれた（${e.place}）`); break;
      case 'remove': out.push(`  ${e.card}が消えた`); break;
      case 'level': out.push(`  ${e.hand}の段位 → ${e.level}`); break;
      case 'change': out.push(`  ${e.card}が変わった（Tier ${e.tier}・${e.cat.join('・')}）`); break;
      case 'grow': out.push(`  ${e.name}が育った（${e.grow}）`); break;
      case 'hp': out.push(`  体力 ${e.add > 0 ? '+' : ''}${e.add} → ${e.hp}`); break;
      case 'guest': out.push(`  ${e.what}：${e.cat} ${e.dir > 0 ? '上げる' : '下げる'}（残り ${e.left}）`); break;
      case 'useItem': out.push(`  お品書きを使う：${e.name}`); break;
      case 'note': out.push(`  ${e.what}`); break;
      case 'peek': out.push(`  山札の上：${e.cards.join('、')}`); break;
      case 'souvenir': out.push(`  お土産：${e.id}`); break;
      case 'forceEnd': out.push(`  戦闘を即終了（報酬 ${Math.round(e.rewardRate * 100)}%）`); break;
      case 'guestSwap': out.push(`  宿泊客の仕組みが入れ替わった（${e.to}）`); break;
      default: out.push(`  ${e.t}`);
    }
  }
  return out;
}

export async function runSim({ seed = '42', enemies = ['en_teiki', 'en_jien'], hp = 70, maxTurns = 40, guest = null } = {}) {
  const balance = await loadNodeBalance();
  let content = fixtureContent();
  let relics = [];
  if (guest) {
    // content/ の宿泊客（仕組み・最初の置物）を使う。札と敵は仮のまま
    const loaded = (await loadContent({ ...(await nodeIO(path.join(ROOT, 'content'))), balance })).content;
    content = { ...loaded, cards: { ...loaded.cards, ...content.cards }, enemies: content.enemies };
    const g = loaded.guests[guest];
    if (!g) throw new Error(`宿泊客「${guest}」が無い`);
    if (g.relic) relics = [{ uid: 'sim_relic', id: g.relic }];
  }
  const base = { balance, content };
  const B = createBattle(base, { seed, floor: 1, room: 0, hp: guest ? undefined : hp, deck: fixtureDeck(), enemies, guest, relics });
  const env = openBattle(base, B);
  startBattle(B, env);
  let shown = 0;
  const lines = [];
  const flush = () => { lines.push(...printLog(B.log.slice(shown))); shown = B.log.length; };
  while (!B.result && B.turn <= maxTurns) {
    flush();
    lines.push(`  ［体力 ${B.hp}／手札 ${B.hand.map((c) => `${c.faceDown ? '？' : c.name}`).join(' ')}］`);
    while (B.playsLeft > 0 && !B.result) {
      let ch = choosePlay(B, env);
      if (!ch.kills && B.discardsLeft > 0 && ['単騎', '対'].includes(ch.p.hand)) {
        discard(B, env, chooseDiscard(B, env, ch.s));
        flush();
        ch = choosePlay(B, env);
      }
      play(B, env, ch.s, ch.target);
      flush();
    }
    if (!B.result) endTurn(B, env);
  }
  flush();
  lines.push(`結果：${B.result === 'win' ? '勝ち' : B.result === 'lose' ? '未帰還' : '打ち切り'}　${B.turn}ターン　体力 ${B.hp}　最大論破値 ${format(B.stats.maxV)}　宿銭 ${B.zeni}`);
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const text = await runSim({
    seed: arg('seed', '42'),
    enemies: arg('enemies', 'en_teiki,en_jien').split(','),
    hp: Number(arg('hp', '70')),
    guest: arg('guest', null),
  });
  console.log(text);
}

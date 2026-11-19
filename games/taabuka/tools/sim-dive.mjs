// 仮のデッキで潜行を1回（または何回か）ボットに回させ、経過を文字で出す。
//   node tools/sim-dive.mjs [--seed 7] [--guest maap] [--depth 0] [--dives 1] [--quiet] [--deep]
//   --deep  踊り場で必ず下りる（B6の層主まで通せるか確かめる）
// 同じシードなら出力は毎回同じ。

import { startBattle, play, discard, endTurn, predict } from '../engine/battle.js';
import { format } from '../engine/format.js';
import { cardStrength } from '../engine/score.js';
import {
  createDive, diveBattle, finishBattle, enterDoor, openDoors, answerChase, takeReward, rewardDests, closeReward,
  leaveRoom, buy, useBath, chooseEvent, eventChoices, landingInfo, descend, goBack, useExit, nameOf, isHidden,
} from '../engine/dive.js';
import { loadRealContent, tempDeckIds } from './fixtures/index.mjs';

function arg(name, def) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : def; }
const flag = (name) => process.argv.includes(`--${name}`);

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

/** 倒せるなら最小の札で、倒せないなら最大の論破値 */
export function botPlay(B, env) {
  const target = B.enemies.findIndex((e) => !e.dead);
  const claim = B.enemies[target].claim;
  let best = null;
  for (const s of subsets(B.hand.length, env.balance.hands.play.maxPlayCards)) {
    let p;
    try { p = predict(B, env, s, target); } catch { continue; }
    const kills = p.V.gte(claim);
    const cand = { s, p, kills };
    if (!best) { best = cand; continue; }
    if (kills !== best.kills) { if (kills) best = cand; continue; }
    if (kills) { if (s.length < best.s.length || (s.length === best.s.length && p.V.gt(best.p.V))) best = cand; }
    else if (p.V.gt(best.p.V) || (p.V.eq(best.p.V) && s.length < best.s.length)) best = cand;
  }
  return best && { ...best, target };
}

/** 戦闘を最後まで（ボット） */
export function botBattle(B, env) {
  startBattle(B, env);
  let guard = 0;
  while (!B.result && guard++ < 400) {
    if (B.playsLeft > 0 && B.hand.length) {
      const c = botPlay(B, env);
      if (c && !c.kills && B.discardsLeft > 0 && B.hand.length > c.s.length && !B.sealed.discard) {
        const rest = B.hand.map((x, i) => ({ x, i })).filter(({ i }) => !c.s.includes(i))
          .sort((a, b) => cardStrength(a.x, env.balance) - cardStrength(b.x, env.balance)).slice(0, 3).map(({ i }) => i);
        try { discard(B, env, rest); continue; } catch { /* 流せない */ }
      }
      try { play(B, env, c.s, c.target); continue; } catch { /* 出せない */ }
    }
    endTurn(B, env);
  }
  return B;
}

const DOOR_PREF = { 宝: 6, 寄り道: 7, 湯: 3, 戦い: 4, 商い: 2, 謎: 3, 精鋭: 1, 層主: 9, 非常口: -9 };

/** 潜行を最後までボットで */
export function botDive(base, D, o = {}) {
  const say = o.say || (() => {});
  let steps = 0;
  while (D.phase !== 'end' && steps++ < 500) {
    switch (D.phase) {
      case 'map': {
        const doors = openDoors(D);
        const hpRate = D.hp / D.maxHp;
        const score = (d) => (isHidden(D, d) ? 2 : DOOR_PREF[d.kind] ?? 0) + (d.kind === '湯' && hpRate < 0.7 ? 6 : 0)
          - (['戦い', '精鋭'].includes(d.kind) && hpRate < 0.4 ? 4 : 0) - (d.kind === '寄り道' && D.presence >= 5 ? 6 : 0);
        const d = doors.slice().sort((a, b) => score(b) - score(a))[0];
        say(`  B${D.floor} 列${D.row + 1}：${doors.map((x) => (isHidden(D, x) ? '？' : x.kind) + (x.glow ? `(${x.glow})` : '')).join('・')} → ${d.kind}（気配${D.presence}）`);
        enterDoor(base, D, d.room);
        break;
      }
      case 'chase': {
        const fight = D.hp / D.maxHp > 0.5;
        say(`    追跡者「${base.content.enemies[D.chase.enemy].name}」！ → ${fight ? '戦う' : '逃げる'}`);
        answerChase(base, D, fight ? 'fight' : 'flee');
        break;
      }
      case 'battle': {
        const { B, env } = diveBattle(base, D);
        botBattle(B, env);
        say(`    戦闘（${D.battle.kind}：${B.enemies.map((e) => e.name).join('・')}）→ ${B.result}、${B.turn}ターン、体力${B.hp}/${B.maxHp}${B.overkill?.level ? `、${B.overkill.level}` : ''}`);
        finishBattle(base, D, B);
        break;
      }
      case 'reward': {
        const R = D.reward;
        const got = [];
        R.groups.forEach((g, gi) => {
          let best = -1;
          if (g.type === 'card') {
            const order = base.balance.economy.grades;
            g.options.forEach((x, i) => { if (best < 0 || order.indexOf(base.content.cards[x.id].grade) > order.indexOf(base.content.cards[g.options[best].id].grade)) best = i; });
          } else best = 0;
          const x = g.options[best];
          const weak = g.type === 'card' && base.content.cards[x.id].grade === '並' && D.deck.length >= 20;
          const to = (weak ? rewardDests(base, D, x).filter((d) => d.to !== 'deck') : rewardDests(base, D, x)).find((d) => d.ok && d.to !== 'skip')?.to ?? 'skip';
          takeReward(base, D, gi, best, to);
          if (to !== 'skip') got.push(`${nameOf(base, x)}→${to}`);
        });
        say(`    報酬：宿銭${R.zeni}${got.length ? `、${got.join('、')}` : ''}`);
        closeReward(base, D);
        break;
      }
      case 'shop': {
        const i = D.shop.goods.findIndex((g) => g.type === 'item' && !g.sold && g.price <= D.zeni);
        if (i >= 0 && D.items.length < 2) { buy(base, D, i, { to: 'deck' }); say(`    商い：${nameOf(base, D.shop.goods[i])}を買った`); }
        leaveRoom(base, D);
        break;
      }
      case 'bath':
        useBath(base, D, D.hp < D.maxHp * 0.8 ? 'heal' : 'calm');
        say(`    湯：体力${D.hp}・気配${D.presence}`);
        leaveRoom(base, D);
        break;
      case 'event': {
        const ch = eventChoices(base, D).find((c) => c.ok);
        chooseEvent(base, D, ch.i);
        say(`    謎「${base.content.events[D.event?.id]?.title ?? ''}」：${ch.label}`);
        if (D.phase === 'event') leaveRoom(base, D);
        break;
      }
      case 'exit':
        useExit(base, D, 'back');
        break;
      case 'landing': {
        const info = landingInfo(base, D);
        const go = info.canDescend && (o.deep || (D.hp / D.maxHp >= 0.6 && D.presence < 8));
        say(`  踊り場 B${D.floor}：体力${D.hp}/${D.maxHp} 気配${D.presence} 懐${info.value}${info.warden ? ` 番人${format(info.warden.claim)}` : ''}${info.afterBoss ? '（昇降機）' : ''} → ${go ? '下りる' : info.afterBoss ? '昇降機' : '引き返す'}`);
        if (go) descend(base, D); else goBack(base, D);
        break;
      }
      default:
        throw new Error(`知らない場面 ${D.phase}`);
    }
  }
  return D;
}

async function main() {
  const { base, issues } = await loadRealContent();
  const errs = issues.filter((i) => i.level === 'error');
  if (errs.length) { console.log(errs); process.exit(1); }
  const guest = arg('guest', 'maap');
  const dives = Number(arg('dives', 1));
  const seed0 = Number(arg('seed', 7));
  const quiet = flag('quiet');
  const tally = { escaped: 0, lost: 0, deepest: {} };
  for (let k = 0; k < dives; k++) {
    const seed = seed0 + k;
    const deck = tempDeckIds(base.content, guest).map((id, i) => ({ uid: `d${i}`, id, origin: 'orig' }));
    const D = createDive(base, { seed, guest, deck, depth: Number(arg('depth', 0)), hp: arg('hp') ? Number(arg('hp')) : undefined, relics: [{ uid: 'r0', id: base.content.guests[guest].relic }] });
    if (!quiet) console.log(`潜行 シード${seed}（${base.content.guests[guest].name}）`);
    botDive(base, D, { say: quiet ? null : (s) => console.log(s), deep: flag('deep') });
    const r = D.result;
    tally[r.outcome] += 1;
    tally.deepest[r.deepest] = (tally.deepest[r.deepest] || 0) + 1;
    if (!quiet) console.log(`結果：${r.outcome === 'escaped' ? '脱出' : '未帰還'}（${r.via}）B${r.floor}、宿銭${r.zeni}、持ち帰り${r.kept.length}点、最大論破値${format(r.maxV)}`);
  }
  if (dives > 1) console.log(`脱出${tally.escaped}・未帰還${tally.lost}・最深 ${Object.entries(tally.deepest).map(([f, n]) => `B${f}:${n}`).join(' ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

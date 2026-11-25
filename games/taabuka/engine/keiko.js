// 稽古場：打ち込み台（木人に決まったターン数、論破値の合計を記録）と師範（段位ごとの強敵）
// どちらも失う物は無い。数値は content/balance/economy.yaml の keiko
import { createBattle } from './battle.js';
import { Big } from './big.js';

const K = (base) => base.balance.economy.keiko;

/** 決まったターン数の勝負を作る（自分の宿のデッキで） */
function challenge(base, deck, guest, o) {
  const B = createBattle(base, { seed: o.seed, floor: 1, deck, enemies: [o.enemy], guest });
  const e = B.enemies[0];
  e.name = o.name;
  e.claim = e.maxClaim = Big.max(o.claim, 1);
  e.atk = o.atk ?? 0;
  B.turnLimit = o.turns;
  B.keiko = o.kind;
  return B;
}

/** 打ち込み台 */
export function dummyBattle(base, H, deck, guest) {
  const k = K(base);
  return challenge(base, deck, guest, { seed: `dummy:${H.records.dives}:${H.records.dummyTries ?? 0}`, enemy: k.dummy.enemy, name: '木人', claim: Big.pow10(300), turns: k.dummy.turns, kind: 'dummy' });
}
/** 打ち込み台の記録（論破値の合計） */
export function finishDummy(base, H, B) {
  H.records.dummyTries = (H.records.dummyTries ?? 0) + 1;
  const v = B.stats.totalV ?? Big.from(0);
  const best = H.records.dummyBest ? Big.from(H.records.dummyBest) : Big.from(0);
  const up = v.gt(best);
  if (up) H.records.dummyBest = v.toString();
  return { total: v, best: up ? v : best, up };
}

/** 師範：段位 dan（1から）。主張は段位で大きくなる */
export function shihanInfo(base, H) {
  const k = K(base).shihan;
  const dan = (H.records.dan ?? 0) + 1;
  const claim = Big.from(k.claim).mul(Math.pow(k.growth, Math.min(dan - 1, 120))).round();
  return { dan, claim, turns: k.turns, reward: k.zeni * dan, max: dan > k.max, name: `師範（${dan}段）` };
}
export function shihanBattle(base, H, deck, guest) {
  const s = shihanInfo(base, H);
  const B = challenge(base, deck, guest, { seed: `shihan:${s.dan}`, enemy: K(base).shihan.enemy, name: s.name, claim: s.claim, turns: s.turns, kind: 'shihan' });
  B.enemies[0].atk = Math.ceil(B.maxHp / s.turns);
  return B;
}
export function finishShihan(base, H, B) {
  const s = shihanInfo(base, H);
  if (B.result !== 'win') return { won: false, ...s };
  H.records.dan = s.dan;
  H.zeni += s.reward;
  return { won: true, ...s };
}

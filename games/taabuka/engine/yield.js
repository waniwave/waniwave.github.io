// 論客の降参（論破のほかの勝ち方）。敵ごとに「降参の決まり」が1つある（content/enemies/yields.yaml で付ける）
// 番付落ち：相手のカテゴリが番付の一番下（Tier5以下）になると降参
// 封殺　　：相手の攻めを続けて n 回、受けで0にすると降参
// 呆れ　　：呆れが n たまると降参（おふざけ札・場の状態・「呆れさせる」）
// 根負け　：n ターン耐えると降参
// 論点ずらし：1回の出しで n 種類以上のカテゴリを出すと降参
// 共感　　：相手のカテゴリの札を合わせて n 枚出すと降参（「共感させる」でも）
// 数値は content/balance/hands.yaml の yields。降参しても勝ちと同じ（報酬は論破と同じ）
import { ZERO } from './big.js';

export const YIELD_KINDS = ['番付落ち', '封殺', '呆れ', '根負け', '論点ずらし', '共感'];

const Y = (env) => env.balance.hands.yields || {};
/** その敵の降参に要る量（番付落ちは無し） */
export function yieldNeed(env, e) {
  if (!e.yield) return null;
  const d = Y(env)[e.yield.kind] || {};
  const n = e.yield.n ?? d.n ?? null;
  return n == null ? null : Math.round(n * (d.kindMul?.[e.kind] ?? 1));
}
function lowest(env, B, cat) {
  const ring = env.balance.tiers.ring;
  const t = String(B.banzuke[cat]);
  return ring.indexOf(t) >= ring.indexOf(String(Y(env).番付落ち?.at ?? '5'));
}
/** 降参させる（主張を0にして倒したことにする） */
export function concede(B, env, e, log, killEnemy) {
  if (e.dead) return;
  e.claim = ZERO;
  log(B, { t: 'yield', enemy: e.uid, name: e.name, how: e.yield.kind });
  killEnemy(B, env, e);
}
/** 量を足す（その種類の決まりの敵だけ） */
export function addYield(B, env, kind, n, log, killEnemy) {
  for (const e of B.enemies) {
    if (e.dead || e.yield?.kind !== kind) continue;
    e.yp = (e.yp || 0) + n;
    log(B, { t: 'yp', enemy: e.uid, how: kind, add: n });
    const need = yieldNeed(env, e);
    if (need != null && e.yp >= need) concede(B, env, e, log, killEnemy);
  }
}
/** 出したあと：番付落ち・論点ずらし・共感・おふざけ札の呆れ */
export function yieldAfterPlay(B, env, cards, catsOf, log, killEnemy) {
  const C = env.content;
  const kinds = new Set(cards.flatMap(catsOf));
  const jokes = cards.filter((c) => C.sets?.[C.cards[c.id]?.set]?.joke).length;
  if (jokes) addYield(B, env, '呆れ', jokes * (Y(env).呆れ?.perJoke ?? 1), log, killEnemy);
  for (const e of B.enemies) {
    if (e.dead || !e.yield) continue;
    const k = e.yield.kind;
    if (k === '論点ずらし' && kinds.size + (e.yp || 0) >= (yieldNeed(env, e) ?? 99)) concede(B, env, e, log, killEnemy);
    else if (k === '共感' && e.cat) {
      const n = cards.filter((c) => catsOf(c).includes(e.cat)).length;
      if (n) { e.yp = (e.yp || 0) + n; log(B, { t: 'yp', enemy: e.uid, how: k, add: n }); if (e.yp >= yieldNeed(env, e)) concede(B, env, e, log, killEnemy); }
    } else if (k === '番付落ち' && e.cat && lowest(env, B, e.cat)) concede(B, env, e, log, killEnemy);
  }
}
/** 敵の攻めのあと（封殺：受けで0なら1、食らったら0に戻る） */
export function yieldOnHit(B, env, e, loss) {
  if (e.yield?.kind !== '封殺') return;
  e.yp = loss > 0 ? 0 : (e.yp || 0) + 1;
}
/** ターンの終わり：根負け・封殺・番付落ち */
export function yieldEndTurn(B, env, log, killEnemy) {
  for (const e of B.enemies) {
    if (e.dead || !e.yield) continue;
    const k = e.yield.kind;
    const need = yieldNeed(env, e);
    if (k === '根負け' && B.turn >= need) concede(B, env, e, log, killEnemy);
    else if (k === '封殺' && (e.yp || 0) >= need) concede(B, env, e, log, killEnemy);
    else if (k === '番付落ち' && e.cat && lowest(env, B, e.cat)) concede(B, env, e, log, killEnemy);
  }
}
/** 説明用の短い文と進み具合 */
export function yieldText(env, e) {
  if (!e.yield) return null;
  const n = yieldNeed(env, e);
  const p = e.yp || 0;
  switch (e.yield.kind) {
    case '番付落ち': return { short: `〈${e.cat}〉落ち`, text: `〈${e.cat}〉が番付の一番下（Tier${Y(env).番付落ち?.at ?? 5}以下）になると降参` };
    case '封殺': return { short: `封殺 ${p}/${n}`, text: `攻めを続けて${n}回、受けで0にすると降参` };
    case '呆れ': return { short: `呆れ ${p}/${n}`, text: `呆れが${n}たまると降参（おふざけ札・場の状態・呆れさせる札）` };
    case '根負け': return { short: `根負け ${n}T`, text: `${n}ターン目の終わりまで耐えると降参` };
    case '論点ずらし': return { short: `ずらし ${n}種${p ? `（+${p}）` : ''}`, text: `1回の出しで${n}種類以上のカテゴリを出すと降参${p ? `（論点ずらしで+${p}種ぶん）` : ''}` };
    case '共感': return { short: `共感 ${p}/${n}`, text: `〈${e.cat}〉の札を合わせて${n}枚出すと降参` };
    default: return null;
  }
}

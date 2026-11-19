// 語彙：条件（if）と解放条件（unlock）（仕様書 第9章、第6章「解放条件」）
// 条件は { 名前: 引数 } を並べる。1つのオブジェクトに複数書けば全て成り立つとき。

import { cardView } from '../hand.js';
import { testCond, num } from './effect.js';

const tierRank = (balance, t) => balance.tiers.tiers[String(t)]?.rank ?? -Infinity;
const slotRank = (balance, s) => (balance.tiers.tiers[String(s)] || balance.tiers.missing?.[String(s)])?.rank ?? -Infinity;

/** いまの組（採点中・出しの後・最後に出した組の順で探す） */
function currentHand(E) { return E.sc?.hand ?? E.ctx.hand ?? E.B.lastHand ?? null; }
const list = (x) => (Array.isArray(x) ? x : [x]);

export const IF = [
  { name: '値', text: '式の値が 以上／以下（宿泊客の状態や札の熟成などを比べる）', args: { 式: 'expr', '以上?': 'number', '以下?': 'number' },
    test: (E, a) => { const v = num(E, a.式); return (a.以上 == null || v >= a.以上) && (a.以下 == null || v <= a.以下); } },
  { name: '組', text: 'いまの組がこれ（並びならどれか）', args: 'hands',
    test: (E, a) => list(a).includes(currentHand(E)) },
  { name: '組の段位以上', text: 'いまの組の段位がN以上', args: 'int',
    test: (E, a) => (E.sc?.level ?? E.B.handLevels[currentHand(E)] ?? 1) >= a },
  { name: 'カテゴリ', text: 'この札がこのカテゴリを持つ', args: 'category',
    test: (E, a) => !!E.subject && cardView(E.subject, E.env.balance).cats.includes(a) },
  { name: '採点札のカテゴリ', text: '採点札のうちこのカテゴリの札が「枚数以上」枚（省略時1）', args: 'category', extra: { '枚数以上?': 'int' },
    test: (E, a, all) => (E.sc?.scored || []).filter((c) => cardView(c, E.env.balance).cats.includes(a)).length >= (all.枚数以上 ?? 1) },
  { name: '同じカテゴリの札が他に', text: '同じ出しに、この札とカテゴリを共有する札が他にある', args: 'bool',
    test: (E, a) => {
      const me = E.subject; if (!me) return !a;
      const mine = cardView(me, E.env.balance).cats;
      const others = (E.sc?.played ?? E.B.inPlay ?? []).filter((c) => c !== me);
      return others.some((c) => cardView(c, E.env.balance).cats.some((x) => mine.includes(x))) === a;
    } },
  { name: 'Tier', text: 'この札のTierがこれ', args: 'tier',
    test: (E, a) => !!E.subject && String(E.subject.tier) === String(a) },
  { name: 'Tier以上', text: 'この札のTierがこれ以上（Godが一番上）', args: 'tier',
    test: (E, a) => !!E.subject && tierRank(E.env.balance, E.subject.tier) >= tierRank(E.env.balance, a) },
  { name: '番付', text: 'カテゴリの番付の段が 以上／以下／ちょうど', args: { カテゴリ: 'category', '以上?': 'slot', '以下?': 'slot', '段?': 'slot' },
    test: (E, a) => {
      const b = E.env.balance;
      const cats = a.カテゴリ === 'この札' ? (E.subject ? cardView(E.subject, b).cats : []) : [a.カテゴリ];
      return cats.some((c) => {
        const s = E.B.banzuke[c] ?? b.tiers.banzukeStart;
        if (a.段 != null && String(s) !== String(a.段)) return false;
        if (a.以上 != null && slotRank(b, s) < slotRank(b, a.以上)) return false;
        if (a.以下 != null && slotRank(b, s) > slotRank(b, a.以下)) return false;
        return true;
      });
    } },
  { name: '採点枚数', text: '採点札がちょうどN枚', args: 'int', test: (E, a) => (E.sc?.scored.length ?? 0) === a },
  { name: '手札枚数以下', text: '手札がN枚以下', args: 'int', test: (E, a) => E.B.hand.length <= a },
  { name: '山札枚数以下', text: '山札がN枚以下', args: 'int', test: (E, a) => E.B.draw.length <= a },
  { name: 'このターンの出し', text: 'このターンN回目の出し', args: 'int', test: (E, a) => E.B.turnPlays === a },
  { name: '戦闘の出し', text: 'この戦闘N回目の出し', args: 'int', test: (E, a) => E.B.stats.plays === a },
  { name: '戦闘のターン以上', text: '戦闘のNターン目以降', args: 'int', test: (E, a) => E.B.turn >= a },
  { name: '体力の割合以下', text: '体力が最大のこの割合以下', args: 'number', test: (E, a) => E.B.hp <= E.B.maxHp * a },
  { name: '階以上', text: 'B(N)以降', args: 'int', test: (E, a) => E.B.floor >= a },
  { name: '宿銭以上', text: '潜行で持っている宿銭が N 以上', args: 'int', test: (E, a) => (E.env.dive?.zeni ?? 0) + E.B.zeni >= a },
  { name: '気配以上', text: '気配がN以上', args: 'int', test: (E, a) => E.B.presence >= a },
  { name: '深度以上', text: '深度がN以上', args: 'int', test: (E, a) => E.B.depth >= a },
  { name: '敵の種類', text: '狙った敵の種類（通常／精鋭／層主／追跡者／番人／底の主）', args: ['通常', '精鋭', '層主', '追跡者', '番人', '底の主'],
    test: (E, a) => { const e = E.ctx.enemy ?? E.B.enemies[E.target ?? 0]; return !!e && e.kind === a; } },
  { name: '敵の数', text: '残っている敵がちょうどN体', args: 'int', test: (E, a) => E.B.enemies.filter((e) => !e.dead).length === a },
  { name: '手札の位置', text: 'この札が手札の 端／左端／右端（出した札は出す前の位置）', args: ['端', '左端', '右端'],
    test: (E, a) => {
      const c = E.subject; if (!c) return false;
      const pos = c.handPos ?? E.B.hand.indexOf(c);
      const len = c.handLen ?? E.B.hand.length;
      if (pos < 0) return false;
      return (a !== '右端' && pos === 0) || (a !== '左端' && pos === len - 1);
    } },
  { name: '採点の順番', text: 'この札が採点札の 最初／最後', args: ['最初', '最後'],
    test: (E, a) => {
      const s = E.sc?.scored || []; const i = s.indexOf(E.subject);
      return i >= 0 && (a === '最初' ? i === 0 : i === s.length - 1);
    } },
  { name: '由来', text: 'この札の由来（orig／copy／expiry／cursed／pawn／bet）', args: ['orig', 'copy', 'expiry', 'cursed', 'pawn', 'bet'],
    test: (E, a) => (E.subject?.origin ?? 'orig') === a },
  { name: '確率', text: 'この確率で（0〜1）', args: 'number', test: (E, a) => E.env.rng.chance(a) },
  { name: 'どれか', text: '並べた条件のどれかが成り立つ', args: 'conds', test: (E, a) => list(a).some((c) => testCond(E, c)) },
  { name: 'すべて', text: '並べた条件が全て成り立つ', args: 'conds', test: (E, a) => list(a).every((c) => testCond(E, c)) },
  { name: 'でない', text: 'その条件が成り立たない', args: 'cond', test: (E, a) => !testCond(E, a) },
];

/** 解放条件（set.yaml と guest.yaml の unlock。判定は段階5の meta.js） */
export const UNLOCK = [
  // test(R, 引数, U)：R は宿の記録（records）、U は解放済み（unlocked）
  { name: 'start', text: '最初から', args: 'bool', test: () => true },
  { name: 'never', text: '解放されない（拾えない。縛り潜行の報酬などで直接もらうだけ）', args: 'bool', test: () => false },
  { name: 'extract', text: '脱出の回数が N 以上', args: 'int', test: (R, a) => (R.extracts || 0) >= a },
  { name: 'reach', text: 'B(N) に到達', args: 'int', test: (R, a) => (R.deepest || 0) >= a },
  { name: 'boss', text: 'その層の層主を倒す', args: 'layerId', test: (R, a) => (R.bosses || []).includes(a) },
  { name: 'souvenir', text: 'そのお土産を持ち帰る', args: 'souvenirId', test: (R, a) => (R.brought || []).includes(a) },
  { name: 'death', text: '未帰還の回数が N 以上', args: 'int', test: (R, a) => (R.deaths || 0) >= a },
  { name: 'hand', text: 'その組を累計 N 回出す（{ 同類: 50 }）', args: 'any', test: (R, a) => Object.entries(a || {}).every(([k, n]) => (R.counts?.hands?.[k] || 0) >= n) },
  { name: 'overkill', text: 'その過剰論破を累計 N 回（{ 大論破: 50 }）', args: 'any', test: (R, a) => Object.entries(a || {}).every(([k, n]) => (R.counts?.overkill?.[k] || 0) >= n) },
  { name: 'extractFrom', text: 'B(N) から脱出', args: 'int', test: (R, a) => (R.deepestExtract || 0) >= a },
  { name: 'depthExtract', text: '深度 N で B16 から脱出', args: 'int', test: (R, a) => (R.depthExtract16 ?? -1) >= a },
  { name: 'guest', text: 'その宿泊客を解放したとき', args: 'guestId', test: (R, a, U) => (U?.guests || []).includes(a) },
  // 実績で使うもの（解放条件にも書ける）
  { name: 'dives', text: '潜行の回数が N 以上', args: 'int', test: (R, a) => (R.dives || 0) >= a },
  { name: 'kills', text: '倒した敵が累計 N 体以上', args: 'int', test: (R, a) => (R.kills || 0) >= a },
  { name: 'maxV', text: '最大論破値が N 以上（"1e8" のように書ける）', args: 'any', test: (R, a) => !!R.maxV?.gte?.(a) },
  { name: 'bossId', text: 'その層主・底の主を倒す', args: 'enemyId', test: (R, a) => (R.bossIds || []).includes(a) },
  { name: 'guestExtract', text: 'その宿泊客で脱出', args: 'guestId', test: (R, a) => (R.guestExtracts?.[a] || 0) >= 1 },
  { name: 'stamp', text: '宿泊客×深度の印（{ 宿泊客ID: 深度 } ／ { 誰か: 深度 }）', args: 'any',
    test: (R, a) => Object.entries(a || {}).every(([g, d]) => (g === '誰か' ? Math.max(-1, ...Object.values(R.stamps || {})) : (R.stamps?.[g] ?? -1)) >= d) },
  { name: 'depth', text: '深度 N まで解放', args: 'int', test: (R, a, U) => (U?.depth || 0) >= a },
  { name: 'guests', text: '宿泊客を N 人解放', args: 'int', test: (R, a, U) => (U?.guests || []).length >= a },
  { name: 'facility', text: '施設の段階（{ kura: 5 }）', args: 'any', test: (R, a) => Object.entries(a || {}).every(([k, lv]) => (R.facilities?.[k] ?? 1) >= lv) },
  { name: 'owned', text: '図鑑で手に入れた物が N 種以上', args: 'int', test: (R, a) => (R.owned || 0) >= a },
  { name: 'haul', text: '1回の脱出で持ち帰った総額が N 以上', args: 'int', test: (R, a) => (R.bestHaul || 0) >= a },
  { name: 'zeniTotal', text: '稼いだ宿銭が累計 N 以上', args: 'int', test: (R, a) => (R.zeniTotal || 0) >= a },
  { name: 'fled', text: '追跡者から累計 N 回逃げる', args: 'int', test: (R, a) => (R.fled || 0) >= a },
  { name: 'sudomariExtract', text: '素泊まり潜行で N 回脱出', args: 'int', test: (R, a) => (R.sudomariExtracts || 0) >= a },
  { name: 'shibari', text: '縛り潜行を N 種脱出（ID を書けばその縛り）', args: 'any', test: (R, a) => (typeof a === 'string' ? (R.shibari || []).includes(a) : (R.shibari || []).length >= a) },
  { name: 'daily', text: '日替わり潜行で N 回脱出', args: 'int', test: (R, a) => (R.daily || 0) >= a },
  { name: 'achievements', text: '実績を N 個', args: 'int', test: (R, a) => (R.achieved || 0) >= a },
  { name: 'debtFree', text: '借金を返し終えたことがある', args: 'bool', test: (R) => !!R.debtCleared },
];

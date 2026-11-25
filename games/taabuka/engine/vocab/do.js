// 語彙：効果（do）、敵の行動（act）、式の名前（var）（仕様書 第9章・第8章）

import { Big, ZERO } from '../big.js';
import { cardView } from '../hand.js';
import { cardStrength } from '../score.js';
import {
  log, addMod, shiftBanzuke, setBanzuke, drawCards, gainItem, addRule, killEnemy, spawnCard, removeCard,
  hitPlayer, makeEnemy, attachEnemy, newUid, mostCategory, topCategory, SCOPE_OF,
} from '../battle.js';
import { num, sn, resolveCategory, resolveCards, resolveEnemies, CARD_TARGETS, ENEMY_TARGETS } from './effect.js';
import { checkArg } from './index.js';
import { MOODS, setMood } from './mood.js';
import { addYield } from '../yield.js';
import { overlapOf, kindsOf, isVanilla } from './if.js';
import { tierOf } from '../hand.js';
const tierStep = (E, c) => Math.max(0, E.env.balance.tiers.banzukeSteps.indexOf(tierOf(c, E.env.balance, E.B.banzuke)));

const SCOPE_WORDS = ['ターン', '戦闘'];
const BOSS_KINDS = ['層主', '底の主'];

function stepTier(balance, tier, change) {
  const order = balance.tiers.banzukeSteps.filter((t) => balance.tiers.tiers[t]); // 弱い→強い
  if (/^[+-]\d+$/.test(String(change))) {
    const i = order.indexOf(String(tier));
    if (i < 0) return tier;
    return order[Math.max(0, Math.min(order.length - 1, i + Number(change)))];
  }
  return String(change);
}


/** 潜行の状態（戦闘の外の効果だけが使う）。潜行の外では null */
function diveOf(E) {
  const D = E.env.dive ?? null;
  if (!D) log(E.B, { t: 'note', what: '潜行の中でだけ効く' });
  return D;
}
function deckCard(E, D, how) {
  if (how === '乱数') return E.env.rng.pick(D.deck) ?? null;
  return D.deck.find((c) => c.uid === E.choices.札) ?? null;
}

function countMod(key) {
  return (E, a) => addMod(E.B, key, Math.round(num(E, a.増減)), SCOPE_OF[a.期間 ?? 'ターン']);
}

export const DO = [
  // 採点
  { name: '強さ', text: '強さ（S）に足す', args: 'expr', score: true, run: (E, a) => E.sc.addS(sn(E, a), E.src) },
  { name: '倍率', text: '倍率（M）に足す', args: 'expr', score: true, run: (E, a) => E.sc.addM(sn(E, a), E.src) },
  { name: '掛け', text: '倍率（M）に掛ける', args: 'expr', score: true, run: (E, a) => E.sc.mulM(sn(E, a, 'mul'), E.src) },
  { name: '論破値を掛ける', text: '最後の S×M にさらに掛ける', args: 'expr', score: true,
    run: (E, a) => E.sc.finalMuls.push({ x: sn(E, a, 'mul'), src: E.src }) },
  // 自分
  { name: '受け', text: '受けに足す', args: 'expr',
    run: (E, a) => { const n = sn(E, a); E.B.guard = Math.max(0, E.B.guard + n); log(E.B, { t: 'guard', card: E.src.name, add: n, guard: E.B.guard }); } },
  { name: '体力', text: '体力を増やす（負なら減らす）。最大を超えない', args: 'expr',
    run: (E, a) => { const raw = num(E, a); const n = Math.round(raw > 0 ? sn(E, a) : raw); E.B.hp = Math.max(0, Math.min(E.B.maxHp, E.B.hp + n)); log(E.B, { t: 'hp', add: n, hp: E.B.hp, src: E.src.name }); } },
  { name: '引く', text: '札をN枚引く', args: 'expr', run: (E, a) => drawCards(E.B, E.env, Math.round(sn(E, a, 'draw'))) },
  { name: '捨てる', text: '手札の札を捨て札へ', args: { '対象?': CARD_TARGETS, '枚数?': 'int' },
    run: (E, a) => {
      for (const c of resolveCards(E, a.対象 ?? '手札の乱数', a.枚数 ?? 1)) {
        const i = E.B.hand.indexOf(c);
        if (i >= 0) { E.B.hand.splice(i, 1); c.faceDown = false; E.B.discard.push(c); log(E.B, { t: 'discard', cards: [c.name], forced: true }); }
      }
    } },
  { name: '出し回数', text: '出しの回数を増減', args: { 増減: 'expr', '期間?': SCOPE_WORDS }, run: countMod('plays') },
  { name: '流し回数', text: '流しの回数を増減', args: { 増減: 'expr', '期間?': SCOPE_WORDS }, run: countMod('discards') },
  { name: '手札上限', text: '手札の上限を増減', args: { 増減: 'expr', '期間?': SCOPE_WORDS }, run: countMod('handSize') },
  // 番付
  { name: '番付を上げる', text: 'カテゴリの番付を段数だけ上げる', args: { カテゴリ: 'category', '段?': 'int' },
    run: (E, a) => { for (const c of resolveCategory(E, a.カテゴリ)) shiftBanzuke(E.B, E.env, c, a.段 ?? 1, E.src); } },
  { name: '番付を下げる', text: 'カテゴリの番付を段数だけ下げる', args: { カテゴリ: 'category', '段?': 'int' },
    run: (E, a) => { for (const c of resolveCategory(E, a.カテゴリ)) shiftBanzuke(E.B, E.env, c, -(a.段 ?? 1), E.src); } },
  { name: '番付を入れ替える', text: '2つのカテゴリの段を入れ替える', args: { カテゴリ: 'category', 相手: 'category' },
    run: (E, a) => {
      const [x] = resolveCategory(E, a.カテゴリ); const [y] = resolveCategory(E, a.相手);
      const sx = E.B.banzuke[x], sy = E.B.banzuke[y];
      setBanzuke(E.B, E.env, x, sy, E.src); setBanzuke(E.B, E.env, y, sx, E.src);
    } },
  { name: '番付を移す', text: 'カテゴリを指定の段へ（欠番を含む）', args: { カテゴリ: 'category', 先: 'slot' },
    run: (E, a) => { for (const c of resolveCategory(E, a.カテゴリ)) setBanzuke(E.B, E.env, c, String(a.先), E.src); } },
  { name: '番付を反転', text: '番付を上下反転（God⇔8、0⇔5…。欠番はそのまま）', args: 'none',
    run: (E) => {
      const steps = E.env.balance.tiers.banzukeSteps;
      for (const c of E.env.balance.tiers.categories) {
        const i = steps.indexOf(E.B.banzuke[c]);
        if (i >= 0) setBanzuke(E.B, E.env, c, steps[steps.length - 1 - i], E.src);
      }
    } },
  { name: '番付を均す', text: '全カテゴリを同じ段へ（省略時は潜行開始の段）', args: 'slot|none',
    run: (E, a) => { for (const c of E.env.balance.tiers.categories) setBanzuke(E.B, E.env, c, String(a == null || a === true ? E.env.balance.tiers.banzukeStart : a), E.src); } },
  { name: '番付を階の始めに戻す', text: '番付を、その階に入った時の形に戻す', args: 'none',
    run: (E) => {
      const snap = E.B.banzukeFloorStart; if (!snap) return;
      for (const c of E.env.balance.tiers.categories) if (snap[c] != null && snap[c] !== E.B.banzuke[c]) setBanzuke(E.B, E.env, c, snap[c], E.src);
    } },
  // 組
  { name: '札を変える', text: '札のTier・カテゴリ・強さを変える', args: { '対象?': CARD_TARGETS, 'Tier?': 'tier|string', 'カテゴリを足す?': 'category', 'カテゴリを変える?': 'category', '強さ?': 'expr', '期間?': ['戦闘', '潜行'] },
    validate: (a) => (a.Tier != null && !/^[+-]\d+$/.test(String(a.Tier)) && typeof a.Tier === 'string' && !['God'].includes(a.Tier) && Number.isNaN(Number(a.Tier)) ? `Tier「${a.Tier}」は Tier か "+1" "-1" の形` : null),
    run: (E, a) => {
      for (const c of resolveCards(E, a.対象 ?? 'この札')) {
        if (a.Tier != null && c.tier != null) c.tier = stepTier(E.env.balance, c.tier, a.Tier);
        if (a.カテゴリを足す) for (const x of resolveCategory(E, a.カテゴリを足す)) if (!c.cat.includes(x)) c.cat.push(x);
        if (a.カテゴリを変える) c.cat = resolveCategory(E, a.カテゴリを変える).slice();
        if (a.強さ != null) c.plusS = (c.plusS || 0) + num(E, a.強さ);
        if (a.期間 === '潜行') (E.B.cardChanges ||= []).push({ uid: c.uid, tier: c.tier, cat: c.cat.slice() });
        log(E.B, { t: 'change', card: c.name, tier: c.tier, cat: c.cat.slice(), plusS: c.plusS });
      }
    } },
  { name: '札を生む', text: '札を作って置く（写しなら版と判を持たない）', args: { id: 'cardId', '場所?': ['手札', '山札の上', '山札の下', '捨て札'], '写し?': 'bool', '期間?': ['戦闘', '潜行'], '枚数?': 'int' },
    run: (E, a) => {
      const id = a.id === 'この札' ? E.subject?.id : a.id;
      if (!id) return;
      for (let i = 0; i < (a.枚数 ?? 1); i++) {
        spawnCard(E.B, E.env, { id, from: a.id === 'この札' ? E.subject : null, copy: !!a.写し, place: a.場所 ?? '手札', temp: (a.期間 ?? '戦闘') === '戦闘' });
      }
    } },
  { name: '札を消す', text: '札を消す（戦闘：この戦闘だけ除く／永続：デッキから消える）', args: `${CARD_TARGETS.join('|')}|object`,
    validate: (a) => (typeof a === 'object' && a !== null ? (CARD_TARGETS.includes(a.対象 ?? 'この札') && ['戦闘', '永続'].includes(a.期間 ?? '戦闘') ? null : '{ 対象: 札の指定, 期間: 戦闘／永続 }') : null),
    run: (E, a) => {
      const o = typeof a === 'object' && a ? a : { 対象: a };
      for (const c of resolveCards(E, o.対象 ?? 'この札', 99)) removeCard(E.B, c, (o.期間 ?? '戦闘') === '永続');
    } },
  { name: '山札の上に置く', text: 'この札を山札の一番上に置く（次に引く）', args: 'none',
    run: (E) => {
      const c = E.subject; if (!c) return;
      for (const pile of [E.B.draw, E.B.discard]) {
        const i = pile.indexOf(c);
        if (i >= 0) { pile.splice(i, 1); E.B.draw.unshift(c); return; }
      }
    } },
  { name: '次の出しの強さ', text: '次の出しの最初に強さ（S）に足す', args: 'expr',
    run: (E, a) => { const n = sn(E, a); E.B.carryS = (E.B.carryS || 0) + n; log(E.B, { t: 'note', what: `次の出し 強さ+${n}` }); } },
  // 敵
  { name: '主張を削る', text: '敵の主張を割合か量で削る（層主・底の主は「層主なら」の割合）', args: { '対象?': ENEMY_TARGETS, '割合?': 'number', '量?': 'expr', '層主なら?': 'number' },
    run: (E, a) => {
      for (const e of resolveEnemies(E, a.対象)) {
        const ratio = BOSS_KINDS.includes(e.kind) && a.層主なら != null ? a.層主なら : a.割合;
        let cut = ratio != null ? e.claim.mul(ratio) : Big.from(sn(E, a.量 ?? 0));
        cut = Big.min(cut.round(), e.claim);
        e.claim = e.claim.sub(cut);
        log(E.B, { t: 'damage', enemy: e.uid, name: e.name, amount: cut, after: e.claim, pierce: false, killed: e.claim.lte(0), src: E.src.name });
        if (e.claim.lte(0)) { e.claim = ZERO; killEnemy(E.B, E.env, e); }
      }
    } },
  { name: '行動停止', text: '敵がNターン行動できない', args: { '対象?': ENEMY_TARGETS, ターン: 'int' },
    run: (E, a) => { for (const e of resolveEnemies(E, a.対象)) { e.skip += a.ターン; log(E.B, { t: 'stun', enemy: e.uid, name: e.name, turns: e.skip }); } } },
  { name: '行動を消す', text: '敵の次の行動を無効', args: ENEMY_TARGETS,
    run: (E, a) => { for (const e of resolveEnemies(E, a)) { e.skip += 1; log(E.B, { t: 'stun', enemy: e.uid, name: e.name, turns: e.skip }); } } },
  // 経済・潜行
  { name: '場の状態', text: '場の状態を変える（ノリノリ・しんみり・グダグダ・お祭り・修羅場・演歌・静寂・大団円。前の状態は上書き。続くターンと効果は数値表 moods）', args: MOODS,
    run: (E, a) => { setMood(E.B, E.env.balance, a, log); addYield(E.B, E.env, '呆れ', E.env.balance.hands.yields?.呆れ?.perMood ?? 1, log, killEnemy); } },
  { name: '呆れさせる', text: '「呆れ」で降参する論客の呆れを増やす', args: 'expr', run: (E, a) => addYield(E.B, E.env, '呆れ', Math.max(0, Math.round(sn(E, a))), log, killEnemy) },
  { name: '共感させる', text: '「共感」で降参する論客の共感を増やす', args: 'expr', run: (E, a) => addYield(E.B, E.env, '共感', Math.max(0, Math.round(sn(E, a))), log, killEnemy) },
  { name: '論点をずらす', text: '「論点ずらし」で降参する論客に、カテゴリの種類を足しておく（戦闘中ずっと）', args: 'expr', run: (E, a) => addYield(E.B, E.env, '論点ずらし', Math.max(0, Math.round(sn(E, a))), log, killEnemy) },
  { name: '封殺を進める', text: '「封殺」で降参する論客の封殺を増やす', args: 'expr', run: (E, a) => addYield(E.B, E.env, '封殺', Math.max(0, Math.round(sn(E, a))), log, killEnemy) },
  { name: '宿銭', text: '宿銭を得る', args: 'expr', run: (E, a) => { const n = Math.round(sn(E, a)); E.B.zeni += n; log(E.B, { t: 'zeni', add: n, why: E.src.name }); } },
  { name: 'お品書きを得る', text: 'お品書きを得る（空きがあれば）', args: 'itemKind',
    run: (E, a) => gainItem(E.B, E.env, a, {}) },
  { name: 'お土産を得る', text: 'お土産を得る', args: 'souvenirId',
    run: (E, a) => { (E.B.gained ||= { souvenirs: [] }).souvenirs.push(a); log(E.B, { t: 'souvenir', id: a }); } },
  { name: '気配', text: '気配を増減', args: 'int', run: (E, a) => { E.B.presence = Math.max(0, E.B.presence + a); log(E.B, { t: 'presence', add: a, presence: E.B.presence }); } },
  { name: '脱出', text: 'その場で脱出する', args: 'bool', run: (E) => { E.B.pendingEscape = true; } },
  { name: '育つ', text: 'この札・常連客の育ちを増やす', args: 'expr',
    run: (E, a) => { if (E.self) { E.self.grow = (E.self.grow || 0) + sn(E, a); log(E.B, { t: 'grow', name: E.src.name, grow: E.self.grow }); } } },
  // 潜行（戦闘の外でも使う。潜行の中でだけ効く）
  { name: 'デッキから除く', text: 'デッキの札を1枚除く（選ぶ／乱数）', args: ['選ぶ', '乱数'],
    run: (E, a) => {
      const D = diveOf(E); if (!D) return;
      const P = E.env.balance.hands.play;
      if (D.deck.length <= P.deckMin) { log(E.B, { t: 'note', what: `デッキは${P.deckMin}枚より減らせない` }); return; }
      const c = deckCard(E, D, a);
      if (!c) return;
      D.deck.splice(D.deck.indexOf(c), 1);
      log(E.B, { t: 'deckRemove', id: c.id });
    } },
  { name: '札に付ける', text: 'デッキの札1枚に仕込み・判・版を付ける（名前か「乱数」）', args: { '対象?': ['選ぶ', '乱数'], '仕込み?': 'string', '判?': 'string', '版?': 'string' },
    validate: (a, ctx) => {
      const b = ctx.balance?.hands;
      if (!b) return null;
      for (const [k, table] of [['仕込み', b.enhancements], ['判', b.seals], ['版', b.editions]]) {
        if (a[k] != null && a[k] !== '乱数' && !table[a[k]]) return `${k}「${a[k]}」は ${Object.keys(table).join(' / ')} か 乱数`;
      }
      return a.仕込み == null && a.判 == null && a.版 == null ? '仕込み・判・版のどれかを書く' : null;
    },
    run: (E, a) => {
      const D = diveOf(E); if (!D) return;
      const c = deckCard(E, D, a.対象 ?? '選ぶ');
      if (!c) return;
      const h = E.env.balance.hands;
      const pick = (v, table) => (v === '乱数' ? E.env.rng.pick(Object.keys(table)) : v);
      if (a.仕込み != null) c.enh = pick(a.仕込み, h.enhancements);
      if (a.判 != null) c.seal = pick(a.判, h.seals);
      if (a.版 != null) c.ed = pick(a.版, h.editions);
      log(E.B, { t: 'attach', id: c.id, enh: c.enh ?? null, seal: c.seal ?? null, ed: c.ed ?? null });
    } },
  { name: '札を合体', text: 'デッキの札2枚（札・札2）を永続で1枚に（強さは合計、カテゴリは両方、Tierは高い方）', args: 'none',
    run: (E) => {
      const D = diveOf(E); if (!D) return;
      const a = D.deck.find((c) => c.uid === E.choices.札);
      const b = D.deck.find((c) => c.uid === E.choices.札2);
      if (!a || !b || a === b) { log(E.B, { t: 'note', what: '合体する札を2枚選ぶ' }); return; }
      const C = E.env.content.cards;
      const bal = E.env.balance;
      const view = (o) => ({ name: o.mod?.name ?? C[o.id]?.name ?? o.id, cat: o.mod?.cat ?? C[o.id]?.cat ?? [], tier: o.mod?.tier ?? C[o.id]?.tier ?? null, plusS: o.mod?.plusS ?? 0 });
      const va = view(a); const vb = view(b);
      const rank = (t) => (t == null ? -Infinity : bal.tiers.tiers[String(t)]?.rank ?? -Infinity);
      const strength = (v) => (v.tier == null ? 0 : bal.tiers.tiers[String(v.tier)]?.strength ?? 0) + v.plusS;
      const tier = rank(va.tier) >= rank(vb.tier) ? va.tier : vb.tier;
      const cat = [...new Set([...va.cat, ...vb.cat])];
      a.mod = { name: `${va.name}＋${vb.name}`, cat, tier, plusS: strength(va) + strength(vb) - (tier == null ? 0 : bal.tiers.tiers[String(tier)]?.strength ?? 0) };
      D.deck.splice(D.deck.indexOf(b), 1);
      log(E.B, { t: 'merge', name: a.mod.name });
    } },
  { name: '襖に足す', text: '次の列に襖を1枚足す', args: { 種類: ['戦い', '精鋭', '宝', '商い', '湯', '謎'] },
    run: (E, a) => {
      const D = diveOf(E); if (!D || !D.map) return;
      const r = D.phase === 'map' ? D.row : D.row + (D.here && !D.here.side ? 1 : 0);
      const row = D.map.rows[r];
      if (!row || row.some((d) => d.kind === '層主')) return;
      row.push({ room: r * 10 + row.length + 5, row: r, kind: a.種類, hidden: false, glow: null, added: true, ...(a.種類 === '戦い' || a.種類 === '精鋭' ? { enemies: [] } : {}) });
      log(E.B, { t: 'door', kind: a.種類, row: r });
    } },
  { name: '襖を見せる', text: 'この階の「？」を全て見せる', args: 'none',
    run: (E) => { const D = diveOf(E); if (D?.map) { D.map.revealed = true; log(E.B, { t: 'reveal' }); } } },
  { name: '常連客を得る', text: '拾える常連客から乱数で1人を席に（空き席が要る）', args: ['乱数'],
    run: (E) => {
      const D = diveOf(E); if (!D) return;
      if (D.seats.length >= E.env.balance.hands.play.seats) { log(E.B, { t: 'note', what: '席が空いていない' }); return; }
      const ids = (D.pool.regulars || []).filter((id) => !D.seats.some((r) => r.id === id));
      const id = E.env.rng.pick(ids);
      if (!id) { log(E.B, { t: 'note', what: '来る常連客がいない' }); return; }
      D.uidSeq += 1;
      D.seats.push({ uid: `r${D.seed}_${D.uidSeq}`, id, origin: 'orig' });
      log(E.B, { t: 'regular', id });
    } },
  { name: '写しを手札に', text: '手札の札の写しを、この戦闘だけ手札に加える', args: CARD_TARGETS,
    run: (E, a) => {
      for (const c of resolveCards(E, a, 1)) spawnCard(E.B, E.env, { id: c.id, from: c, copy: true, place: '手札', temp: true });
    } },
  // ルール
  { name: 'ルール', text: 'ルールを掛ける。他の項目はルールに渡す', args: 'object',
    validate: (a, ctx) => {
      if (!a || typeof a !== 'object') return '{ 名前: ルール, 範囲: この出し／ターン／戦闘／潜行 } の形で書く';
      const e1 = checkArg('ruleName', a.名前, ctx); if (e1) return e1;
      if (a.範囲 != null) { const e2 = checkArg('scope', a.範囲, ctx); if (e2) return e2; }
      const { 名前, 範囲, ...params } = a;
      const def = ctx.vocab.get('rule', 名前);
      if (def.args && Object.keys(params).length) return checkArg(def.args, params, ctx);
      if (!def.args && Object.keys(params).length) return `ルール「${名前}」は引数を取らない`;
      if (def.args && typeof def.args === 'object' && Object.keys(def.args).some((k) => !k.endsWith('?')) && !Object.keys(params).length) return checkArg(def.args, params, ctx);
      return null;
    },
    run: (E, a) => {
      const { 名前, 範囲, ...params } = a;
      addRule(E.B, E.env, { name: 名前, scope: SCOPE_OF[範囲 ?? 'この出し'], params, owner: E.src, group: E.selfKind === 'card' ? 'played' : groupOf(E.selfKind) });
    } },
];

function groupOf(kind) {
  return { regular: 'seat', relic: 'relic', guest: 'guest', quirk: 'quirk', enemy: 'enemy', item: 'guest' }[kind] ?? 'played';
}

// ───────────────────────── 敵の行動（第8章、特注を除くもの） ─────────────────────────

function takeCharge(e) { if (e.charged) { e.charged = false; return 2; } return 1; }

export const ACTS = [
  { name: '攻め', text: '攻撃×倍率のダメージ', args: 'number|none',
    run(B, env, e, arg) { hitPlayer(B, env, e, Math.round(e.atk * (typeof arg === 'number' ? arg : 1) * takeCharge(e)), 0); } },
  { name: '全体攻め', text: '攻めと同じだが受けを無視する分が半分', args: 'none',
    run(B, env, e) { const dmg = Math.round(e.atk * takeCharge(e)); hitPlayer(B, env, e, dmg, Math.floor(dmg / 2)); } },
  { name: '居座り', text: '最大主張の割合を回復', args: 'number',
    run(B, env, e, arg) {
      const before = e.claim;
      e.claim = Big.min(e.maxClaim, e.claim.add(e.maxClaim.mul(arg).round()));
      log(B, { t: 'heal', enemy: e.uid, name: e.name, amount: e.claim.sub(before) });
    } },
  { name: '伏せ', text: '次のターン、手札のN枚が裏向き（出せるが中身が見えない）', args: 'int',
    run(B, env, e, arg) { B.pendingFaceDown += arg; log(B, { t: 'act', enemy: e.uid, name: e.name, act: '伏せ', n: arg }); } },
  { name: '封じ', text: '最多カテゴリ：手札で一番多いカテゴリを次のターンだけ採点しない（予告に出る）。流し：その戦闘中、流せない', args: ['最多カテゴリ', '流し'],
    run(B, env, e, arg) {
      if (arg === '流し') B.sealed.discard = true;
      else {
        const c = mostCategory(B, env);
        if (c) { if (!B.sealed.cats.includes(c)) B.sealed.cats.push(c); (B.sealed.catTurns ||= {})[c] = env.balance.hands.sealTurns ?? 2; }
        log(B, { t: 'act', enemy: e.uid, name: e.name, act: '封じ', what: c ? `〈${c}〉` : arg });
        return;
      }
      log(B, { t: 'act', enemy: e.uid, name: e.name, act: '封じ', what: arg });
    } },
  { name: '格下げ', text: '番付で一番高いカテゴリをN段下げる', args: 'int|none',
    run(B, env, e, arg) { const cat = topCategory(B, env); if (cat) shiftBanzuke(B, env, cat, -(typeof arg === 'number' ? arg : 1), { kind: 'enemy', id: e.id, name: e.name }); } },
  { name: '席を奪う', text: '左端の常連客をその戦闘中無効に', args: 'none',
    run(B, env, e) {
      const reg = (B.seats || []).find((r) => r && !r.disabled);
      if (reg) reg.disabled = true;
      log(B, { t: 'act', enemy: e.uid, name: e.name, act: '席を奪う', regular: reg ? reg.name : null });
    } },
  { name: '溜め', text: '何もしない。次の攻めが×2', args: 'none',
    run(B, env, e) { e.charged = true; log(B, { t: 'act', enemy: e.uid, name: e.name, act: '溜め' }); } },
  { name: '呼ぶ', text: '指定の敵を追加（同時に出る数と、1戦で呼べる数の上限まで）', args: 'enemyId',
    run(B, env, e, arg) {
      const max = env.balance.hands.play.maxEnemies;
      const def = env.content.enemies?.[arg];
      if (!def) throw new Error(`呼ぶ敵「${arg}」の定義がない`);
      const cap = env.balance.hands.play.maxSummons ?? Infinity;
      if (B.enemies.filter((x) => !x.dead).length >= max || (B.summoned || 0) >= cap) { log(B, { t: 'act', enemy: e.uid, name: e.name, act: '呼ぶ', failed: true }); return; }
      B.summoned = (B.summoned || 0) + 1;
      const ne = makeEnemy(env.balance, def, { floor: B.floor, depth: B.depth, presence: B.presence }, newUid(B, 'e'));
      B.enemies.push(ne);
      attachEnemy(env, ne);
      log(B, { t: 'summon', enemy: ne.uid, name: ne.name, claim: ne.claim, by: e.name });
    } },
];

// ───────────────────────── 式の名前 ─────────────────────────

const subj = (E) => E.subject;
export const VARS = [
  { name: '熟成', text: 'この札の熟成', get: (E) => subj(E)?.vars?.熟成 ?? 0 },
  { name: '育ち', text: '効果の持ち主（札・常連客）の育ち', get: (E) => E.self?.grow ?? 0 },
  { name: '文字数', text: 'この札の名前の文字数', get: (E) => (subj(E) ? [...subj(E).name].length : 0) },
  { name: '強さ', text: 'この札の強さ', get: (E) => (subj(E) ? cardStrength(subj(E), E.env.balance, E.B.banzuke) : 0) },
  { name: 'カテゴリ数', text: 'この札のカテゴリの数', get: (E) => (subj(E) ? cardView(subj(E), E.env.balance).cats.length : 0) },
  { name: '手札枚数', text: '手札の枚数', get: (E) => E.B.hand.length },
  { name: '山札枚数', text: '山札の枚数', get: (E) => E.B.draw.length },
  { name: '捨て札枚数', text: '捨て札の枚数', get: (E) => E.B.discard.length },
  { name: '体力', text: 'いまの体力', get: (E) => E.B.hp },
  { name: '最大体力', text: '体力の最大', get: (E) => E.B.maxHp },
  { name: '失った体力', text: '最大体力−いまの体力', get: (E) => E.B.maxHp - E.B.hp },
  { name: '宿銭', text: 'この戦闘で得た宿銭', get: (E) => E.B.zeni },
  { name: '階', text: 'いまの階', get: (E) => E.B.floor },
  { name: '気配', text: 'いまの気配', get: (E) => E.B.presence },
  { name: '深度', text: '深度', get: (E) => E.B.depth },
  { name: 'ターン', text: '戦闘の何ターン目か', get: (E) => E.B.turn },
  { name: '出し回数', text: 'このターン何回目の出しか', get: (E) => E.B.turnPlays },
  { name: '戦闘の出し回数', text: 'この戦闘で何回目の出しか', get: (E) => E.B.stats.plays },
  { name: '採点枚数', text: '採点札の枚数', get: (E) => E.sc?.scored.length ?? 0 },
  { name: '重なり', text: '採点札で一番重なっているカテゴリの枚数', get: (E) => overlapOf(E) },
  { name: 'この札の重なり', text: 'この札のカテゴリの重なりの枚数（一番多いもの）', get: (E) => overlapOf(E, 'この札') },
  { name: 'カテゴリの種類', text: '採点札のカテゴリの種類の数', get: (E) => kindsOf(E, false) },
  { name: '重なったカテゴリの数', text: '2枚以上重なっているカテゴリの数', get: (E) => kindsOf(E, true) },
  { name: '効果なしの札', text: '採点札のうち効果の無い札の数', get: (E) => (E.sc?.scored || []).filter((c) => isVanilla(E, c)).length },
  { name: 'Tierの段', text: 'この札のTierの段の高さ（God 7・0 6…5 1・8 0）', get: (E) => (subj(E) ? tierStep(E, subj(E)) : 0) },
  { name: '受け', text: 'いまの受け', get: (E) => E.B.guard },
  { name: '敵の数', text: '残っている敵の数', get: (E) => E.B.enemies.filter((e) => !e.dead).length },
];

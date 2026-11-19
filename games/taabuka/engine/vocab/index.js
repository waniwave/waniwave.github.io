// 語彙の登録口（仕様書 第9章）
// 語彙は1つずつ「名前・説明1行・引数の形・実装」を持つ。組み込みも特注も同じ register で足す。
//
// 種類（kind）
//   when   合図           { name, text }
//   if     条件           { name, text, args, test(E, arg) }
//   do     効果           { name, text, args, run(E, arg), score?: true（採点中だけ） }
//   act    敵の行動       { name, text, args, run(B, env, enemy, arg) }
//   rule   ルール改変     { name, text, args, hooks?, on?, apply?, expire? }
//   show   演出           { name, text, args }
//   var    式で使える名前 { name, text, get(E) }
//   unlock 解放条件       { name, text, args }
//   mechanic 宿泊客の仕組み（特注のみ） { name, text, hooks?, on?, actions?, vars?, status? }
//   enemy  敵の特注       { name, text, hooks?, on?, acts? }

import { WHEN } from './when.js';
import { IF, UNLOCK } from './if.js';
import { DO, ACTS, VARS } from './do.js';
import { RULES } from './rule.js';
import { SHOWS } from './show.js';

export const KINDS = ['when', 'if', 'do', 'act', 'rule', 'show', 'var', 'unlock', 'mechanic', 'enemy'];
export const KIND_JA = {
  when: '合図', if: '条件', do: '効果', act: '敵の行動', rule: 'ルール', show: '演出', var: '式の名前',
  unlock: '解放条件', mechanic: '宿泊客の仕組み', enemy: '敵の特注',
};

/** 語彙の一式を作る（組み込みを全部入れた状態） */
export function createVocab() {
  const v = { kinds: {}, origin: new Map() };
  for (const k of KINDS) v.kinds[k] = new Map();
  v.get = (kind, name) => v.kinds[kind].get(name);
  v.has = (kind, name) => v.kinds[kind].has(name);
  v.names = (kind) => [...v.kinds[kind].keys()];
  v.list = (kind) => [...v.kinds[kind].values()];
  /** 登録。特注も同じ口から。origin は '組み込み' か 特注のファイル名 */
  v.register = (kind, def, origin = '組み込み') => {
    if (!v.kinds[kind]) throw new Error(`知らない語彙の種類「${kind}」`);
    if (!def || typeof def.name !== 'string' || !def.name) throw new Error(`${KIND_JA[kind]}の語彙に名前がない`);
    if (typeof def.text !== 'string') throw new Error(`${KIND_JA[kind]}「${def.name}」に説明1行（text）がない`);
    if (v.kinds[kind].has(def.name)) throw new Error(`${KIND_JA[kind]}「${def.name}」が二重に登録された（${v.origin.get(`${kind}:${def.name}`)} と ${origin}）`);
    v.kinds[kind].set(def.name, { kind, ...def });
    v.origin.set(`${kind}:${def.name}`, origin);
    return def;
  };
  for (const d of WHEN) v.register('when', d);
  for (const d of IF) v.register('if', d);
  for (const d of UNLOCK) v.register('unlock', d);
  for (const d of DO) v.register('do', d);
  for (const d of ACTS) v.register('act', d);
  for (const d of VARS) v.register('var', d);
  for (const d of RULES) v.register('rule', d);
  for (const d of SHOWS) v.register('show', d);
  return v;
}

// ───────────────────────── 引数の形 ─────────────────────────
// 文字列：'number' 'int' 'expr'（数か式） 'string' 'bool' 'none'（引数なし） 'any'
//         'category' 'tier' 'slot' 'hand' 'scope' 'grade' 'itemKind' 'cond' 'conds'
//         'cardId' 'enemyId' 'souvenirId' 'ruleName' 'guestId' 'setId' 'layerId'
//         'a|b' はどれか
// 配列：その中の値のどれか（選択肢）
// オブジェクト：キーごとの形。キー名の最後が ? なら省略できる

export const CATEGORY_WORDS = ['この札', '乱数', '手札で一番多い', '一番高い', '一番低い', '直前に出した札', '選ぶ'];
export const SCOPES = { この出し: 'play', ターン: 'turn', 戦闘: 'battle', 潜行: 'dive' };
export const TIER_CHANGES = ['+1', '-1', '+2', '-2'];

const TYPE_JA = {
  number: '数', int: '整数', expr: '数か式', string: '文字', object: '{ … }', bool: 'true／false', none: '（引数なし）', any: '何でも',
  category: 'カテゴリ', tier: 'Tier', slot: '番付の段', hand: '組', hands: '組か組の並び', scope: '範囲（この出し／ターン／戦闘／潜行）',
  grade: '格', itemKind: 'お品書きの種類（議題／番付札／品）', cond: '条件', conds: '条件の並び',
  cardId: '札のID', enemyId: '敵のID', souvenirId: 'お土産のID', ruleName: 'ルールの名前', guestId: '宿泊客のID',
  setId: 'セットのID', layerId: '層のID',
};

/** 引数の形を人が読める文字に */
export function describeArgs(schema) {
  if (schema == null) return '（引数なし）';
  if (Array.isArray(schema)) return schema.map(String).join(' ／ ');
  if (typeof schema === 'string') return schema.split('|').map((t) => TYPE_JA[t] ?? t).join(' か ');
  const parts = Object.entries(schema).map(([k, s]) => {
    const opt = k.endsWith('?');
    return `${opt ? k.slice(0, -1) : k}: ${describeArgs(s)}${opt ? '（省略可）' : ''}`;
  });
  return `{ ${parts.join(', ')} }`;
}

/**
 * 引数が形に合うか。合わなければ日本語の理由、合えば null
 * @param {any} schema @param {any} value
 * @param {{balance:object, vocab:object, ref?:(type:string,id:string)=>void, condCheck?:(c:any)=>string|null, exprCheck?:(s:string)=>string|null}} ctx
 */
export function checkArg(schema, value, ctx) {
  if (schema == null || schema === 'none') {
    return value == null || value === true ? null : '引数は要らない';
  }
  if (Array.isArray(schema)) {
    return schema.map(String).includes(String(value)) ? null : `「${value}」は ${schema.join(' ／ ')} のどれか`;
  }
  if (typeof schema === 'string' && schema.includes('|')) {
    const errs = schema.split('|').map((t) => checkArg(t, value, ctx));
    return errs.some((e) => e === null) ? null : `「${fmt(value)}」は ${describeArgs(schema)}`;
  }
  if (typeof schema === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return `${describeArgs(schema)} の形で書く`;
    const keys = Object.keys(schema);
    for (const k of Object.keys(value)) {
      if (!keys.includes(k) && !keys.includes(`${k}?`)) {
        const cand = suggest(k, keys.map((x) => x.replace(/\?$/, '')));
        return `知らない項目「${k}」${cand.length ? `。候補：${cand.join(' ／ ')}` : ''}`;
      }
    }
    for (const k of keys) {
      const opt = k.endsWith('?');
      const key = opt ? k.slice(0, -1) : k;
      if (value[key] == null) { if (!opt) return `「${key}」が要る`; continue; }
      const e = checkArg(schema[k], value[key], ctx);
      if (e) return `${key}：${e}`;
    }
    return null;
  }
  const b = ctx.balance;
  switch (schema) {
    case 'any': return null;
    case 'object': return value && typeof value === 'object' && !Array.isArray(value) ? null : '{ … } の形で書く';
    case 'number': return typeof value === 'number' && Number.isFinite(value) ? null : `「${fmt(value)}」は数`;
    case 'int': return Number.isInteger(value) ? null : `「${fmt(value)}」は整数`;
    case 'bool': return typeof value === 'boolean' ? null : `「${fmt(value)}」は true か false`;
    case 'string': return typeof value === 'string' ? null : `「${fmt(value)}」は文字`;
    case 'expr':
      if (typeof value === 'number') return null;
      if (typeof value !== 'string') return `「${fmt(value)}」は数か式`;
      return ctx.exprCheck ? ctx.exprCheck(value) : null;
    case 'category':
      if (CATEGORY_WORDS.includes(value) || b.tiers.categories.includes(value)) return null;
      return `知らないカテゴリ「${value}」。${hint(value, [...b.tiers.categories, ...CATEGORY_WORDS])}`;
    case 'tier':
      return b.tiers.ring.includes(String(value)) ? null : `Tier「${value}」は ${b.tiers.ring.join(' / ')} のどれか`;
    case 'slot':
      return b.tiers.tiers[String(value)] || b.tiers.missing?.[String(value)] ? null : `番付の段「${value}」は無い`;
    case 'hand':
      if (['最後の組', 'この出しの組', '一番多く出した組', '選ぶ'].includes(value)) return null;
      return b.hands.hands[value] ? null : `知らない組「${value}」。${hint(value, b.hands.order)}`;
    case 'hands': {
      for (const h of Array.isArray(value) ? value : [value]) { const e = checkArg('hand', h, ctx); if (e) return e; }
      return null;
    }
    case 'scope': return SCOPES[value] ? null : `範囲「${value}」は ${Object.keys(SCOPES).join(' ／ ')} のどれか`;
    case 'grade': return b.economy.grades.includes(value) ? null : `格「${value}」は ${b.economy.grades.join(' / ')} のどれか`;
    case 'itemKind': return ['議題', '番付札', '品'].includes(value) ? null : `お品書きの種類「${value}」は 議題 ／ 番付札 ／ 品 のどれか`;
    case 'cond': return ctx.condCheck ? ctx.condCheck(value) : null;
    case 'conds': {
      const list = Array.isArray(value) ? value : [value];
      for (const c of list) { const e = ctx.condCheck ? ctx.condCheck(c) : null; if (e) return e; }
      return null;
    }
    case 'ruleName':
      if (typeof value !== 'string') return 'ルールの名前を書く';
      return ctx.vocab.has('rule', value) ? null : `知らないルール「${value}」。${hint(value, ctx.vocab.names('rule'))}`;
    case 'cardId': case 'enemyId': case 'souvenirId': case 'guestId': case 'setId': case 'layerId':
      if (typeof value !== 'string') return `${TYPE_JA[schema]}を書く`;
      if (ctx.ref && !(schema === 'cardId' && value === 'この札')) ctx.ref(schema, value);
      return null;
    default: return `（形「${schema}」は検査できない）`;
  }
}

function fmt(v) { return typeof v === 'object' ? JSON.stringify(v) : String(v); }

// ───────────────────────── 近い候補 ─────────────────────────

/** 編集距離 */
export function distance(a, b) {
  const A = [...a], Bc = [...b];
  const d = Array.from({ length: A.length + 1 }, (_, i) => [i, ...Array(Bc.length).fill(0)]);
  for (let j = 1; j <= Bc.length; j++) d[0][j] = j;
  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= Bc.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (A[i - 1] === Bc[j - 1] ? 0 : 1));
    }
  }
  return d[A.length][Bc.length];
}

/** 近い候補を3つまで（部分一致と編集距離） */
export function suggest(word, names, max = 3) {
  const w = String(word);
  const scored = names.map((n) => {
    let s = distance(w, n);
    if (n.includes(w) || w.includes(n)) s = Math.min(s, Math.abs([...n].length - [...w].length) * 0.5);
    // 先頭が同じなら少し近い
    let p = 0; while (p < Math.min(w.length, n.length) && w[p] === n[p]) p++;
    s -= p * 0.3;
    return { n, s };
  });
  const lim = Math.max(2, [...w].length * 0.75);
  return scored.filter((x) => x.s <= lim).sort((a, b) => a.s - b.s || a.n.localeCompare(b.n)).slice(0, max).map((x) => x.n);
}

export function hint(word, names) {
  const c = suggest(word, names);
  return c.length ? `候補：${c.join(' ／ ')}` : '近い候補はない';
}

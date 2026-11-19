// コンテンツの読み込み・検証・組み立て・自己テスト（仕様書 第9章）
// content/index.yaml に並んだファイルを全て読む。ファイルの読み方は呼び出し側から渡す
// （ブラウザは fetch と import()、Node は fs と import()）。特注（*.js）は動的 import。
//
// 読み込みは止まらない：おかしなところは issues（1件1行の日本語）に積み、使える部分だけで組み立てる。

import yaml from '../vendor/yaml.mjs';
import { createVocab, checkArg, describeArgs, hint, KIND_JA, SCOPES } from './vocab/index.js';
import { parseExpr, exprNames } from './vocab/expr.js';
import { makeE, runFx } from './vocab/effect.js';
import { HOOK_NAMES, SIGNALS } from './hooks.js';
import { Big } from './big.js';
import {
  createBattle, openBattle, startBattle, play, discard, endTurn, guestAction, useItem, makeBattleCard, attachCard, findOwner,
} from './battle.js';

export const BALANCE_FILES = ['tiers', 'hands', 'curve', 'economy', 'depth'];

const REQUIRED = {
  tiers: ['categories', 'ring', 'tiers', 'banzukeStart', 'banzukeSteps'],
  hands: ['order', 'hands', 'play', 'enhancements', 'editions', 'seals'],
  curve: ['floors', 'beyond', 'kinds', 'presence'],
  economy: ['grades', 'battleRewards', 'overkill', 'gradeWeights'],
  depth: ['levels'],
};

/**
 * content/balance/ の5つを読む
 * @param {(path: string) => Promise<string>} readText content/ からの相対パスを受け取り中身を返す
 */
export async function loadBalance(readText) {
  const out = {};
  for (const name of BALANCE_FILES) out[name] = yaml.load(await readText(`balance/${name}.yaml`));
  checkBalance(out);
  return out;
}

/** 数値表の形を確かめる。足りなければ1件1行の日本語で投げる */
export function checkBalance(b) {
  const errs = [];
  for (const [file, keys] of Object.entries(REQUIRED)) {
    if (!b[file]) { errs.push(`[数値表] ${file}.yaml がない`); continue; }
    for (const k of keys) if (b[file][k] == null) errs.push(`[数値表] ${file}.yaml に ${k} がない`);
  }
  if (!errs.length) {
    for (const t of b.tiers.ring) if (!b.tiers.tiers[t]) errs.push(`[数値表] tiers.yaml: 輪のTier「${t}」に値がない`);
    for (const h of b.hands.order) if (!b.hands.hands[h]) errs.push(`[数値表] hands.yaml: 組「${h}」に値がない`);
    if (!b.hands.order.includes('単騎')) errs.push('[数値表] hands.yaml: order に 単騎 がない');
  }
  if (errs.length) throw new Error(errs.join('\n'));
  return b;
}

// ───────────────────────── 読み込み ─────────────────────────

/**
 * ブラウザ用の読み方（fetch と import()）。base は content/ の親のURL、build は ?v= に付ける番号
 * @param {string} base @param {string} build @param {{fetch?:Function, importer?:Function}} [impl] テスト用に差し替えられる
 */
export function fetchIO(base, build, impl = {}) {
  const f = impl.fetch ?? globalThis.fetch;
  const imp = impl.importer ?? ((u) => import(u));
  const url = (p) => new URL(`content/${p}?v=${encodeURIComponent(build)}`, base).href;
  // 一度に取りに行く数を絞り、混み合い（503・429）や通信の途切れは間をおいて取り直す。
  // GitHub Pages は数百のファイルを一斉に頼むと 503 を返すことがある
  let active = 0;
  const waiting = [];
  const slot = async (fn) => {
    if (active >= FETCH_LIMIT) await new Promise((res) => waiting.push(res));
    active += 1;
    try { return await fn(); } finally { active -= 1; waiting.shift()?.(); }
  };
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const retry = async (p, fn) => {
    let last;
    for (let i = 0; i < FETCH_TRIES; i++) {
      try { return await fn(i); } catch (e) { last = e; if (e.permanent) throw e; }
      await sleep(400 * 2 ** i);
    }
    throw last;
  };
  return {
    readText: (p) => retry(p, () => slot(async () => {
      const r = await f(url(p));
      if (!r.ok) {
        const e = new Error(`content/${p} が読めない（${r.status}）`);
        e.permanent = r.status === 404;
        throw e;
      }
      return r.text();
    })),
    // import() は一度失敗した URL を覚えてしまうので、取り直すときは URL を変える
    importModule: (p) => retry(p, (i) => slot(() => imp(i ? `${url(p)}&r=${i}` : url(p)))),
  };
}

/** 同時に取りに行くファイルの数と、取り直す回数 */
const FETCH_LIMIT = 6;
const FETCH_TRIES = 5;

/**
 * Node 用の読み方（fs と import()）。dir は content/ のフォルダ
 * node: のモジュールは呼んだときだけ読むので、ブラウザでこのファイルを読んでも困らない
 */
export async function nodeIO(dir) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  return {
    readText: (p) => fs.readFile(path.join(dir, p), 'utf8'),
    importModule: (p) => import(pathToFileURL(path.join(dir, p)).href),
  };
}

/** 特注に書ける種類 */
export const CUSTOM_KINDS = ['rule', 'do', 'show', 'mechanic', 'enemy', 'if', 'var'];

/** 札・常連客などの種類ごとの決まり */
const ID_RE = /^[a-z][a-z0-9_]*$/;
const SCORE_WHEN = ['採点時', '手札に残る', '出し'];
const DOOR_KINDS = ['戦い', '精鋭', '宝', '商い', '湯', '謎'];
const ITEM_ASK = ['カテゴリ', '札', '札2', '手札', '敵'];
const GROW_ON = ['下りた階', '出し', '戦闘', '脱出'];
const ORIGINS = ['orig', 'copy', 'expiry', 'cursed', 'pawn', 'bet'];

/**
 * コンテンツを全部読む
 * @param {{readText:(p:string)=>Promise<string>, importModule:(p:string)=>Promise<any>, balance?:object}} io
 * @returns {Promise<{content:object, issues:{level:'error'|'warn', tag:string, where:string, msg:string}[]}>}
 */
export async function loadContent(io) {
  const issues = [];
  const add = (level, tag, where, msg) => issues.push({ level, tag, where, msg });
  const balance = io.balance ?? await loadBalance(io.readText);
  const vocab = createVocab();
  const content = {
    balance, vocab, sets: {}, cards: {}, regulars: {}, relics: {}, items: {}, enemies: {}, layers: {}, events: {},
    guests: {}, souvenirs: {}, facilities: [], achievements: [], shibari: [], kwDefs: {}, kwByName: {}, keywordRules: [], where: {}, customs: [],
  };

  let index;
  try { index = yaml.load(await io.readText('index.yaml')) || {}; }
  catch (e) { add('error', '形', 'content/index.yaml', `読めない：${e.message}`); index = {}; }

  const readYaml = async (p) => {
    try { return yaml.load(await io.readText(p)); }
    catch (e) { add('error', '形', `content/${p}`, `YAMLが読めない：${String(e.message).split('\n')[0]}`); return undefined; }
  };

  // 1. 特注（先に語彙へ登録する）
  const jsFiles = [];
  for (const [sid, files] of Object.entries(index.sets || {})) for (const f of files || []) if (f.endsWith('.js')) jsFiles.push(`sets/${sid}/${f}`);
  for (const [gid, files] of Object.entries(index.guests || {})) for (const f of files || []) if (f.endsWith('.js')) jsFiles.push(`guests/${gid}/${f}`);
  for (const f of index.enemies || []) if (f.endsWith('.js')) jsFiles.push(`enemies/${f}`);
  for (const p of jsFiles) {
    let mod;
    try { mod = await io.importModule(p); }
    catch (e) { add('error', '特注', `content/${p}`, `読み込めない：${e.message}`); continue; }
    const defs = Array.isArray(mod.default) ? mod.default : [mod.default];
    for (const def of defs) registerCustom(vocab, def, `content/${p}`, add, content);
  }

  // 2. セット
  for (const [sid, files] of Object.entries(index.sets || {})) {
    const base = `sets/${sid}`;
    const set = files.includes('set.yaml') ? await readYaml(`${base}/set.yaml`) : null;
    if (!set) { add('error', '形', `content/${base}`, 'set.yaml がない'); continue; }
    set._file = `content/${base}/set.yaml`;
    if (set.id !== sid) add('error', '形', set._file, `id「${set.id}」はフォルダ名「${sid}」と同じにする`);
    content.sets[sid] = set;
    for (const [file, bucket] of [['keywords.yaml', 'kwDefs'], ['cards.yaml', 'cards'], ['regulars.yaml', 'regulars'], ['relics.yaml', 'relics'], ['items.yaml', 'items']]) {
      if (!files.includes(file)) continue;
      const list = await readYaml(`${base}/${file}`);
      if (list == null) continue;
      if (!Array.isArray(list)) { add('error', '形', `content/${base}/${file}`, '並び（- で始まる項目）で書く'); continue; }
      for (const d of list) putDef(content, bucket, d, `content/${base}/${file}`, add, sid);
    }
  }
  // 共通のキーワード能力（content/keywords/）
  for (const f of index.keywords || []) {
    const list = await readYaml(`keywords/${f}`);
    if (Array.isArray(list)) for (const d of list) putDef(content, 'kwDefs', d, `content/keywords/${f}`, add);
    else if (list != null) add('error', '形', `content/keywords/${f}`, '並び（- で始まる項目）で書く');
  }
  for (const d of Object.values(content.kwDefs)) {
    if (typeof d.name !== 'string') continue;
    if (content.kwByName[d.name]) add('error', 'キーワード', d.id, `名前「${d.name}」が重複している（${content.kwByName[d.name].id} と ${d.id}）`);
    else content.kwByName[d.name] = d;
  }

  // 3. 宿泊客
  for (const [gid, files] of Object.entries(index.guests || {})) {
    if (!files.includes('guest.yaml')) { add('error', '形', `content/guests/${gid}`, 'guest.yaml がない'); continue; }
    const g = await readYaml(`guests/${gid}/guest.yaml`);
    if (!g) continue;
    putDef(content, 'guests', g, `content/guests/${gid}/guest.yaml`, add);
    if (g.id !== gid) add('error', '形', `content/guests/${gid}/guest.yaml`, `id「${g.id}」はフォルダ名「${gid}」と同じにする`);
  }
  // 4. 敵・層・謎
  for (const f of index.enemies || []) {
    if (!f.endsWith('.yaml')) continue;
    const list = await readYaml(`enemies/${f}`);
    if (Array.isArray(list)) for (const d of list) putDef(content, 'enemies', d, `content/enemies/${f}`, add);
  }
  for (const f of index.layers || []) {
    const d = await readYaml(`layers/${f}`);
    if (d) putDef(content, 'layers', d, `content/layers/${f}`, add);
  }
  for (const f of index.events || []) {
    const list = await readYaml(`events/${f}`);
    const fileLayer = /layer(\d+)/.exec(f)?.[1];
    if (Array.isArray(list)) for (const d of list) putDef(content, 'events', d && d.layer == null && fileLayer ? { ...d, layer: [Number(fileLayer)] } : d, `content/events/${f}`, add);
  }
  // 5. お土産・施設・実績
  for (const f of index.root || []) {
    const list = await readYaml(f);
    if (list == null) continue;
    if (f === 'souvenirs.yaml') for (const d of list) putDef(content, 'souvenirs', d, `content/${f}`, add);
    if (f === 'facilities.yaml') content.facilities = list;
    if (f === 'achievements.yaml') content.achievements = list;
    if (f === 'shibari.yaml') content.shibari = list;
  }

  validateContent(content, add);
  compileContent(content, add);
  return { content, issues };
}

function registerCustom(vocab, def, file, add, content) {
  if (!def || typeof def !== 'object') { add('error', '特注', file, 'export default で { name, kind, text, … } を出す'); return; }
  if (!CUSTOM_KINDS.includes(def.kind)) { add('error', '特注', file, `kind「${def.kind}」は ${CUSTOM_KINDS.join(' / ')} のどれか`); return; }
  for (const h of Object.keys(def.hooks || {})) {
    if (!HOOK_NAMES.includes(h)) { add('error', '特注', file, `知らない差し込み口「${h}」。${hint(h, HOOK_NAMES)}`); return; }
  }
  for (const s of Object.keys(def.on || {})) {
    if (!SIGNALS.includes(s)) { add('error', '特注', file, `知らない合図「${s}」。${hint(s, SIGNALS)}`); return; }
  }
  try { vocab.register(def.kind, def, file); }
  catch (e) { add('error', '特注', file, e.message); return; }
  for (const a of def.acts || []) {
    try { vocab.register('act', a, file); } catch (e) { add('error', '特注', file, e.message); }
  }
  content.customs.push({ name: def.name, kind: def.kind, file });
}

function putDef(content, bucket, d, file, add, set = null) {
  if (!d || typeof d !== 'object') { add('error', '形', file, '項目が空'); return; }
  if (typeof d.id !== 'string' || !d.id) { add('error', '形', file, `id がない項目がある（${d.name ?? '名前なし'}）`); return; }
  if (content.where[d.id]) { add('error', 'ID', d.id, `IDが重複している（${content.where[d.id]} と ${file}）`); return; }
  content.where[d.id] = file;
  content[bucket][d.id] = { ...d, _file: file, _kind: bucket, ...(set ? { set } : {}) };
}

// ───────────────────────── キーワード能力 ─────────────────────────
// 札は「呼び水2」のように名前（＋数字）を書くだけ。中身は keywords/ と sets/<セット>/keywords.yaml に一度だけ定義し、
// 読み込み時に札の fx・rule・show に展開する。戦闘中にキーワードを特別扱いする処理は無い。

/** 「呼び水2」→ { name: '呼び水', n: 2 }、「一番槍」→ { name: '一番槍', n: null } */
export function parseKw(s) {
  const m = /^(.*?)(\d+(?:\.\d+)?)$/.exec(String(s));
  if (m && m[1]) return { name: m[1], n: Number(m[2]) };
  return { name: String(s), n: null };
}

/** 定義の中の N を数に置き換える（値がちょうど N なら数、式や文の中の N は数字に） */
function subN(x, n) {
  if (typeof x === 'string') {
    if (x === 'N') return n;
    return x.replace(/(^|[^A-Za-z])N(?![A-Za-z])/g, (_, p) => `${p}${n}`);
  }
  if (Array.isArray(x)) return x.map((v) => subN(v, n));
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, subN(v, n)]));
  return x;
}

/** キーワードが指す特注のルール名（custom: nibai → sets/<セット>/custom/nibai.js の name） */
function kwCustomRule(content, kw) {
  if (!kw.custom) return null;
  const hit = content.customs.filter((c) => c.kind === 'rule' && c.file.endsWith(`/custom/${kw.custom}.js`));
  const same = hit.find((c) => kw.set && c.file.includes(`/sets/${kw.set}/`));
  return (same ?? hit[0])?.name ?? null;
}

/** キーワード1つを、fx・rule・show・props に展開する */
export function expandKw(content, word) {
  const { name, n } = parseKw(word);
  const kw = content.kwByName[name];
  if (!kw) return null;
  const v = n ?? 0;
  const fx = subN(kw.fx || [], v);
  const ruleName = kwCustomRule(content, kw);
  if (ruleName) fx.unshift({ when: '出しの前', do: [{ ルール: { 名前: ruleName, 範囲: 'この出し', ...(kw.params || {}) } }] });
  return { name, n, text: subN(kw.text ?? '', v), fx, rule: subN(kw.rule || [], v), show: subN(kw.show || [], v), props: { ...(kw.props || {}) }, kw };
}

/** 持ち主の kw を全部展開して、表示用の一覧と合わせて返す */
function expandAll(content, d) {
  const out = { fx: [], rule: [], show: [], props: {}, list: [] };
  for (const w of d.kw || []) {
    const e = expandKw(content, w);
    if (!e) continue;
    out.fx.push(...e.fx); out.rule.push(...e.rule); out.show.push(...e.show); Object.assign(out.props, e.props);
    out.list.push({ name: e.name, n: e.n, label: e.n != null ? `${e.name}${e.n}` : e.name, text: e.text });
  }
  return out;
}

const KW_PROPS = ['unbreakable'];

function checkKwDefs(content, add, withCtx) {
  for (const d of Object.values(content.kwDefs)) {
    withCtx(d, (ctx) => {
      unknownKeys(d, ['id', 'name', 'arg', 'text', 'flavor', 'fx', 'show', 'rule', 'custom', 'params', 'props', 'set', 'test'], add);
      checkTests(content, d, d.test, ctx, add);
      req(d, add, { name: 'string', text: 'string' });
      if (!ID_RE.test(d.id)) add('error', '形', d.id, 'id は英小文字・数字・_ で（例：kw_yobimizu）');
      if (typeof d.name === 'string' && /\d$/.test(d.name)) add('error', 'キーワード', d.id, `名前「${d.name}」の最後に数字を付けない（数字は札の側で付ける）`);
      if (d.arg != null && d.arg !== 'N') add('error', 'キーワード', d.id, 'arg は N だけ（数字を取らないなら省く）');
      const uses = JSON.stringify([d.fx, d.rule, d.show, d.text]).match(/(^|[^A-Za-z])N(?![A-Za-z])/);
      if (d.arg == null && uses) add('error', 'キーワード', d.id, '中身で N を使うなら arg: N を書く');
      if (d.custom != null && !kwCustomRule(content, d)) add('error', 'キーワード', d.id, `特注「${d.custom}」（custom/${d.custom}.js の rule）が無い`);
      for (const k of Object.keys(d.props || {})) if (!KW_PROPS.includes(k)) add('error', 'キーワード', d.id, `props の「${k}」は ${KW_PROPS.join(' / ')} のどれか`);
      if (d.fx == null && d.custom == null && d.rule == null && d.props == null) add('error', 'キーワード', d.id, 'fx・rule・custom・props のどれかが要る');
      const tmp = { id: d.id, ...subN({ fx: d.fx, rule: d.rule, show: d.show }, 1) };
      checkFx(content, tmp, ctx, add); checkShow(content, tmp, ctx, add); checkRules(content, tmp, ctx, add);
    });
  }
}

/** 札・常連客・置物・敵の kw を確かめる */
function checkKwUse(content, d, add) {
  if (d.kw == null) return;
  if (!Array.isArray(d.kw)) { add('error', '形', d.id, 'kw は並び（[呼び水2, 一番槍]）で書く'); return; }
  const names = Object.keys(content.kwByName);
  for (const w of d.kw) {
    const { name, n } = parseKw(w);
    const kw = content.kwByName[name];
    if (!kw) { add('error', 'キーワード', d.id, `知らないキーワード「${w}」。${hint(name, names)}`); continue; }
    if (kw.arg && n == null) add('error', 'キーワード', d.id, `キーワード「${name}」には数字が要る（例：${name}2）`);
    if (!kw.arg && n != null) add('error', 'キーワード', d.id, `キーワード「${name}」は数字を取らない（「${w}」）`);
    if (kw.set && kw.set !== d.set) {
      const mine = unlockRank(content, setUnlock(content, d.set));
      const theirs = unlockRank(content, setUnlock(content, kw.set));
      if (mine < theirs) add('error', 'キーワード', d.id, `「${name}」はセット「${content.sets[kw.set]?.name ?? kw.set}」のキーワード。この札のセットの方が先に解放されるので、まだ使えない`);
    }
  }
}

/** 持ち主のセットの解放条件（セットに属さない物は最初から） */
function setUnlock(content, setId) {
  if (!setId || setId === '仮') return { start: true };
  return content.sets[setId]?.unlock ?? { start: true };
}

/**
 * 解放条件の「だいたいの順番」（小さいほど先）。解放順で先に来るセットが、後のセットのキーワードを使っていないかに使う。
 * 最初から＜脱出・未帰還の回数＜宿泊客＜到達・層主（深い階ほど後）＜深度
 */
export function unlockRank(content, unlock, seen = new Set()) {
  let rank = Infinity;
  for (const [k, a] of Object.entries(unlock || {})) {
    let r;
    switch (k) {
      case 'start': r = 0; break;
      case 'extract': case 'death': r = 10 + Number(a || 0); break;
      case 'hand': case 'overkill': r = 50; break;
      case 'guest': {
        const g = content.guests?.[a];
        if (!g || seen.has(a)) { r = 20; break; }
        seen.add(a);
        r = Math.max(20, unlockRank(content, g.unlock ?? { start: true }, seen));
        break;
      }
      case 'reach': case 'extractFrom': r = 100 + Number(a || 0); break;
      case 'boss': {
        const L = content.layers?.[a];
        const last = L?.floors?.[1] ?? Number(/(\d+)/.exec(String(a))?.[1] ?? 9) * 3;
        r = 100 + last + 0.5;
        break;
      }
      case 'souvenir': {
        const sv = content.souvenirs?.[a];
        r = 100 + ((sv?.layers?.[0] ?? 9) - 1) * 3 + 1;
        break;
      }
      case 'depthExtract': r = 1000 + Number(a || 0); break;
      default: r = 500;
    }
    rank = Math.min(rank, r);
  }
  return rank === Infinity ? 0 : rank;
}

// ───────────────────────── 検証 ─────────────────────────

/** 式の名前として使えるもの（組み込み＋宿泊客の仕組みが持つ値） */
function exprNamesKnown(content) {
  const names = new Set(content.vocab.names('var'));
  for (const m of content.vocab.list('mechanic')) for (const n of m.vars || []) names.add(n);
  for (const g of Object.values(content.guests)) for (const n of Object.keys(g.state || {})) names.add(n);
  return [...names];
}

function argCtx(content, where, add) {
  const refs = [];
  const known = exprNamesKnown(content);
  const ctx = {
    balance: content.balance, vocab: content.vocab,
    ref: (type, id) => refs.push({ type, id, where }),
    exprCheck: (s) => {
      let tree;
      try { tree = parseExpr(s); } catch (e) { return e.message; }
      for (const n of exprNames(tree)) if (!known.includes(n)) return `式「${s}」の知らない名前「${n}」。${hint(n, known)}`;
      return null;
    },
    condCheck: (c) => checkCond(content, c, ctx),
  };
  ctx.refs = refs;
  return ctx;
}

/** 条件を確かめる。おかしければ理由 */
export function checkCond(content, cond, ctx) {
  if (cond == null) return null;
  if (Array.isArray(cond)) { for (const c of cond) { const e = checkCond(content, c, ctx); if (e) return e; } return null; }
  if (typeof cond !== 'object') return `条件は { 名前: 引数 } の形で書く（「${cond}」）`;
  const v = content.vocab;
  const extras = new Set(v.list('if').flatMap((d) => Object.keys(d.extra || {}).map((k) => k.replace(/\?$/, ''))));
  for (const [k, a] of Object.entries(cond)) {
    if (extras.has(k)) continue;
    const def = v.get('if', k);
    if (!def) return `知らない条件「${k}」。${hint(k, v.names('if'))}`;
    const e = checkArg(def.args, a, ctx);
    if (e) return `条件「${k}」：${e}`;
    for (const [xk, xs] of Object.entries(def.extra || {})) {
      const key = xk.replace(/\?$/, '');
      if (cond[key] != null) { const e2 = checkArg(xs, cond[key], ctx); if (e2) return `条件「${key}」：${e2}`; }
    }
  }
  return null;
}

function checkDo(content, list, when, ctx) {
  const v = content.vocab;
  const errs = [];
  for (const item of Array.isArray(list) ? list : [list]) {
    if (item == null) { errs.push('効果が空'); continue; }
    if (typeof item === 'object' && Object.keys(item).length !== 1) { errs.push('効果は1項目に1つずつ（- { 名前: 引数 }）'); continue; }
    const [name, arg] = typeof item === 'string' ? [item, null] : Object.entries(item)[0];
    const def = v.get('do', name);
    if (!def) { errs.push(`知らない効果「${name}」。${hint(name, v.names('do'))}`); continue; }
    const e = checkArg(def.args, arg, ctx) ?? (def.validate ? def.validate(arg, ctx) : null);
    if (e) { errs.push(`効果「${name}」：${e}`); continue; }
    if (def.score && when && !SCORE_WHEN.includes(when)) errs.push(`効果「${name}」は合図「${SCORE_WHEN.join('／')}」でだけ使える（いまは「${when}」）`);
  }
  return errs;
}

function checkFx(content, d, ctx, add) {
  const v = content.vocab;
  if (d.fx == null) return;
  if (!Array.isArray(d.fx)) { add('error', '形', d.id, 'fx は並び（- when: …）で書く'); return; }
  d.fx.forEach((fx, i) => {
    const at = `fx の${i + 1}つ目`;
    if (!fx || typeof fx !== 'object') { add('error', '形', d.id, `${at}が空`); return; }
    for (const k of Object.keys(fx)) if (!['when', 'if', 'do'].includes(k)) add('error', '形', d.id, `${at}に知らない項目「${k}」（when ／ if ／ do）`);
    const okWhen = v.has('when', fx.when);
    if (!okWhen) add('error', '語彙', d.id, `知らない合図「${fx.when}」。${hint(fx.when ?? '', v.names('when'))}`);
    const ce = checkCond(content, fx.if, ctx); if (ce) add('error', '語彙', d.id, ce);
    if (fx.do == null) { add('error', '形', d.id, `${at}に do がない`); return; }
    for (const de of checkDo(content, fx.do, okWhen ? fx.when : null, ctx)) add('error', '語彙', d.id, de);
  });
}

function checkShow(content, d, ctx, add) {
  if (d.show == null) return;
  if (!Array.isArray(d.show)) { add('error', '形', d.id, 'show は並びで書く'); return; }
  for (const s of d.show) {
    const [name, arg] = typeof s === 'string' ? [s, null] : Object.entries(s)[0] ?? [];
    const def = content.vocab.get('show', name);
    if (!def) { add('error', '語彙', d.id, `知らない演出「${name}」。${hint(name, content.vocab.names('show'))}`); continue; }
    const e = checkArg(def.args, arg, ctx); if (e) add('error', '語彙', d.id, `演出「${name}」：${e}`);
  }
}

function normRules(list) {
  return (list || []).map((r) => (typeof r === 'string' ? { name: r, params: {} } : (() => { const { 名前, ...params } = r; return { name: 名前, params }; })()));
}

function checkRules(content, d, ctx, add) {
  if (d.rule == null) return;
  if (!Array.isArray(d.rule)) { add('error', '形', d.id, 'rule は並びで書く'); return; }
  for (const r of normRules(d.rule)) {
    const def = content.vocab.get('rule', r.name);
    if (!def) { add('error', '語彙', d.id, `知らないルール「${r.name}」。${hint(r.name ?? '', content.vocab.names('rule'))}`); continue; }
    if (def.args && Object.keys(r.params).length) { const e = checkArg(def.args, r.params, ctx); if (e) add('error', '語彙', d.id, `ルール「${r.name}」：${e}`); }
  }
}

function req(d, add, fields) {
  for (const [k, t] of Object.entries(fields)) {
    const v = d[k];
    if (v == null) { add('error', '形', d.id, `${k} がない`); continue; }
    if (t === 'string' && typeof v !== 'string') add('error', '形', d.id, `${k} は文字`);
    if (t === 'number' && typeof v !== 'number') add('error', '形', d.id, `${k} は数`);
  }
}

function unknownKeys(d, allowed, add) {
  for (const k of Object.keys(d)) {
    if (k.startsWith('_') || allowed.includes(k)) continue;
    add('error', '形', d.id, `知らない項目「${k}」。${hint(k, allowed)}`);
  }
}

function checkGrade(content, d, add) {
  if (d.grade != null && !content.balance.economy.grades.includes(d.grade)) add('error', '形', d.id, `grade「${d.grade}」は ${content.balance.economy.grades.join(' / ')} のどれか`);
}

function checkTests(content, d, list, ctx, add) {
  if (list == null) return;
  if (!Array.isArray(list)) { add('error', '形', d.id, 'test は並びで書く'); return; }
  for (const t of list) {
    if (!t || typeof t !== 'object') { add('error', '形', d.id, 'test の項目が空'); continue; }
    for (const h of [...(t.hand || []), ...(t.draw || []), ...(t.deck || [])]) {
      if (typeof h === 'string') ctx.ref('cardId', h);
      else if (h?.id) ctx.ref('cardId', h.id);
      if (h?.kw) checkKwUse(content, { id: d.id, set: d.set, kw: h.kw }, add);
    }
    for (const id of t.items || []) ctx.ref('itemId', id);
    if (!t.expect) add('error', '形', d.id, 'test に expect がない');
  }
}

/** 全体を確かめて issues に積む */
export function validateContent(content, add) {
  const b = content.balance;
  const v = content.vocab;
  const allRefs = [];
  const withCtx = (d, fn) => { const ctx = argCtx(content, d.id, add); fn(ctx); allRefs.push(...ctx.refs); };

  for (const s of Object.values(content.sets)) {
    withCtx({ id: s.id ?? s._file }, (ctx) => {
      req(s, (l, t, w, m) => add(l, t, s._file, m), { id: 'string', name: 'string' });
      for (const [k, a] of Object.entries(s.unlock || {})) {
        const def = v.get('unlock', k);
        if (!def) { add('error', '語彙', s.id, `知らない解放条件「${k}」。${hint(k, v.names('unlock'))}`); continue; }
        const e = checkArg(def.args, a, ctx); if (e) add('error', '語彙', s.id, `解放条件「${k}」：${e}`);
      }
      for (const k of s.keywords || []) {
        const kw = content.kwByName[k];
        if (!kw) add('error', 'キーワード', s.id, `目玉ルール「${k}」のキーワード定義が無い（keywords.yaml）。${hint(k, Object.keys(content.kwByName))}`);
        else if (kw.set !== s.id) add('error', 'キーワード', s.id, `目玉ルール「${k}」はこのセットの keywords.yaml に定義する`);
      }
      if (s.guest) ctx.ref('guestId', s.guest);
    });
  }
  checkKwDefs(content, add, withCtx);
  for (const d of [...Object.values(content.cards), ...Object.values(content.regulars), ...Object.values(content.relics), ...Object.values(content.enemies)]) checkKwUse(content, d, add);
  for (const d of Object.values(content.cards)) {
    withCtx(d, (ctx) => {
      unknownKeys(d, ['id', 'name', 'cat', 'tier', 'grade', 'origin', 'text', 'flavor', 'kw', 'fx', 'show', 'rule', 'test', 'set'], add);
      req(d, add, { name: 'string', grade: 'string' });
      if (!ID_RE.test(d.id)) add('error', '形', d.id, 'id は英小文字・数字・_ で（例：rk_shineei）');
      if (!Array.isArray(d.cat) || d.cat.length < 1 || d.cat.length > 3) add('error', '形', d.id, 'cat は1〜3個の並び');
      else for (const c of d.cat) if (!b.tiers.categories.includes(c)) add('error', '形', d.id, `知らないカテゴリ「${c}」。${hint(c, b.tiers.categories)}`);
      if (!b.tiers.ring.includes(String(d.tier))) add('error', '形', d.id, `tier「${d.tier}」は ${b.tiers.ring.join(' / ')} のどれか`);
      checkGrade(content, d, add);
      if (d.origin != null && !ORIGINS.includes(d.origin)) add('error', '形', d.id, `origin「${d.origin}」は ${ORIGINS.join(' / ')} のどれか`);
      checkFx(content, d, ctx, add); checkShow(content, d, ctx, add); checkRules(content, d, ctx, add);
      checkTests(content, d, d.test, ctx, add);
    });
  }
  for (const d of Object.values(content.regulars)) {
    withCtx(d, (ctx) => {
      unknownKeys(d, ['id', 'name', 'grade', 'text', 'flavor', 'kw', 'fx', 'show', 'rule', 'grow', 'test', 'set'], add);
      req(d, add, { name: 'string', grade: 'string' });
      checkGrade(content, d, add);
      if (d.grow != null) {
        const e = checkArg({ 増える: GROW_ON, 量: 'number', '永続?': 'bool' }, d.grow, ctx);
        if (e) add('error', '形', d.id, `grow：${e}`);
      }
      checkFx(content, d, ctx, add); checkShow(content, d, ctx, add); checkRules(content, d, ctx, add);
      checkTests(content, d, d.test, ctx, add);
    });
  }
  for (const d of Object.values(content.relics)) {
    withCtx(d, (ctx) => {
      unknownKeys(d, ['id', 'name', 'grade', 'text', 'flavor', 'kw', 'fx', 'show', 'rule', 'test', 'set'], add);
      req(d, add, { name: 'string', grade: 'string' });
      checkGrade(content, d, add);
      checkFx(content, d, ctx, add); checkShow(content, d, ctx, add); checkRules(content, d, ctx, add);
      checkTests(content, d, d.test, ctx, add);
    });
  }
  for (const d of Object.values(content.items)) {
    withCtx(d, (ctx) => {
      unknownKeys(d, ['id', 'name', 'kind', 'use', 'hand', 'text', 'flavor', 'if', 'do', 'set', 'ask', 'once', 'noDrop', 'fromLayer'], add);
      for (const a of d.ask || []) if (!ITEM_ASK.includes(a)) add('error', '形', d.id, `ask「${a}」は ${ITEM_ASK.join(' ／ ')} のどれか`);
      if (d.once != null && d.once !== '潜行') add('error', '形', d.id, 'once は「潜行」（1回の潜行で1度）だけ');
      req(d, add, { name: 'string', kind: 'string' });
      let e = checkArg('itemKind', d.kind, ctx); if (e) add('error', '形', d.id, e);
      if (d.use != null && !['戦闘中', 'いつでも', '戦闘外'].includes(d.use)) add('error', '形', d.id, `use「${d.use}」は 戦闘中 ／ いつでも ／ 戦闘外 のどれか`);
      if (d.hand != null) { e = checkArg('hand', d.hand, ctx); if (e) add('error', '形', d.id, e); }
      e = checkCond(content, d.if, ctx); if (e) add('error', '語彙', d.id, e);
      if (d.do == null) add('error', '形', d.id, 'do がない');
      else for (const de of checkDo(content, d.do, null, ctx)) add('error', '語彙', d.id, de);
    });
  }
  for (const d of Object.values(content.enemies)) {
    withCtx(d, (ctx) => {
      unknownKeys(d, ['id', 'name', 'layer', 'kind', 'hp', 'atk', 'acts', 'line', 'custom', 'params', 'kw', 'hideClaim', 'bind'], add);
      req(d, add, { name: 'string', hp: 'number', atk: 'number' });
      if (!b.curve.kinds[d.kind ?? '通常']) add('error', '形', d.id, `kind「${d.kind}」は ${Object.keys(b.curve.kinds).join(' / ')} のどれか`);
      if (!Array.isArray(d.acts) || !d.acts.length) add('error', '形', d.id, 'acts は1つ以上の並び');
      else for (const a of d.acts) {
        const [name, arg] = typeof a === 'string' ? [a, null] : Object.entries(a)[0] ?? [];
        const def = v.get('act', name);
        if (!def) { add('error', '語彙', d.id, `知らない敵の行動「${name}」。${hint(name ?? '', v.names('act'))}`); continue; }
        const e = checkArg(def.args, arg, ctx); if (e) add('error', '語彙', d.id, `行動「${name}」：${e}`);
      }
      if (d.custom != null && !v.has('enemy', d.custom)) add('error', '語彙', d.id, `敵の特注「${d.custom}」が無い。${hint(d.custom, v.names('enemy'))}`);
    });
  }
  for (const d of Object.values(content.layers)) {
    withCtx(d, (ctx) => {
      unknownKeys(d, ['id', 'name', 'floors', 'line', 'palette', 'doors', 'groups', 'elites', 'bosses', 'warden', 'stalker', 'quirk', 'mix', 'onlyBoss', 'bossEvery', 'noName'], add);
      req(d, add, { name: 'string' });
      if (!Array.isArray(d.floors) || d.floors.length !== 2 || !d.floors.every(Number.isInteger) || d.floors[0] > d.floors[1]) add('error', '形', d.id, 'floors は [最初の階, 最後の階]');
      if (!d.mix && !d.onlyBoss && (!Array.isArray(d.groups) || !d.groups.length)) add('error', '形', d.id, 'groups（戦いの敵の組み合わせ）が1つ以上要る（mix・onlyBoss の層は不要）');
      if (d.onlyBoss && !(d.bosses || []).length) add('error', '形', d.id, 'onlyBoss の層には bosses が要る');
      if (d.bossEvery != null && (!Number.isInteger(d.bossEvery) || d.bossEvery < 1)) add('error', '形', d.id, 'bossEvery は1以上の整数（何階ごとに主が出るか）');
      const kindIs = (id, k, what) => { const e = content.enemies[id]; if (e && (e.kind ?? '通常') !== k) add('error', '形', d.id, `${what}「${id}」の kind は ${k} にする（いまは ${e.kind ?? '通常'}）`); };
      for (const id of d.elites || []) kindIs(id, '精鋭', '精鋭');
      for (const id of d.bosses || []) { const k = content.enemies[id]?.kind; if (k && k !== '層主' && k !== '底の主') add('error', '形', d.id, `層主「${id}」の kind は 層主 か 底の主 にする（いまは ${k}）`); }
      if (d.warden) kindIs(d.warden, '番人', '番人');
      if (d.stalker) kindIs(d.stalker, '追跡者', '追跡者');
      for (const k of Object.keys(d.doors || {})) if (!DOOR_KINDS.includes(k)) add('error', '形', d.id, `知らない襖「${k}」。${hint(k, DOOR_KINDS)}`);
      for (const gr of d.groups || []) for (const id of gr) ctx.ref('enemyId', id);
      for (const id of [...(d.elites || []), ...(d.bosses || []), d.warden, d.stalker].filter(Boolean)) ctx.ref('enemyId', id);
      const qn = d.quirk == null ? null : typeof d.quirk === 'string' ? d.quirk : d.quirk.name;
      if (qn != null && !v.has('rule', qn)) add('error', '語彙', d.id, `層の癖「${qn}」のルールが無い。${hint(String(qn), v.names('rule'))}`);
    });
  }
  for (const d of Object.values(content.events)) {
    withCtx(d, (ctx) => {
      unknownKeys(d, ['id', 'title', 'text', 'layer', 'choices', 'flavor'], add);
      req(d, add, { title: 'string', text: 'string' });
      if (!Array.isArray(d.layer) || d.layer.some((x) => !Number.isInteger(x))) add('error', '形', d.id, 'layer は出る層の並び（ファイル名が layerN なら省略できる）');
      if (!Array.isArray(d.choices) || d.choices.length < 1 || d.choices.length > 3) add('error', '形', d.id, '選択肢（choices）は1〜3つ');
      else for (const c of d.choices) {
        if (typeof c.label !== 'string') add('error', '形', d.id, '選択肢に label がない');
        let e = checkCond(content, c.if, ctx); if (e) add('error', '語彙', d.id, e);
        if (c.do != null) for (const de of checkDo(content, c.do, null, ctx)) add('error', '語彙', d.id, de);
      }
    });
  }
  const achIds = new Set();
  for (const d of content.achievements || []) {
    const where = `content/achievements.yaml ${d?.id ?? '?'}`;
    if (!d?.id || !d.name || !d.if) { add('error', '形', where, '実績には id・name・if が要る'); continue; }
    if (achIds.has(d.id)) add('error', 'ID', d.id, '実績のIDが重複している');
    achIds.add(d.id);
    unknownKeys(d, ['id', 'name', 'text', 'if', 'zeni', 'hidden'], add);
    for (const k of Object.keys(d.if)) if (!v.get('unlock', k)) add('error', '語彙', d.id, `知らない条件「${k}」。${hint(k, v.names('unlock'))}`);
  }
  for (const d of content.shibari || []) {
    const where = `content/shibari.yaml ${d?.id ?? '?'}`;
    if (!d?.id || !d.name) { add('error', '形', where, '縛りには id・name が要る'); continue; }
    unknownKeys(d, ['id', 'name', 'text', 'rule', 'dive', 'reward'], add);
    for (const r of normRules(d.rule || [])) if (!v.has('rule', r.name)) add('error', '語彙', d.id, `知らないルール「${r.name}」。${hint(r.name ?? '', v.names('rule'))}`);
    unknownKeys({ id: d.id, ...(d.dive || {}) }, ['id', 'hp', 'noDoors', 'noSeats', 'noRelic', 'eliteDoorMul', 'presenceGainMul', 'noEmergencyExit'], add);
    for (const k of d.dive?.noDoors || []) if (!DOOR_KINDS.includes(k)) add('error', '形', d.id, `知らない襖「${k}」`);
    const rw = d.reward || {};
    if (rw.card && !content.cards[rw.card]) add('error', '参照', d.id, `報酬の札「${rw.card}」が無い`);
    if (rw.regular && !content.regulars[rw.regular]) add('error', '参照', d.id, `報酬の常連客「${rw.regular}」が無い`);
  }
  for (const f of content.facilities || []) {
    withCtx({ id: f.id ?? 'facilities.yaml' }, (ctx) => {
      if (!f.id || !f.name || !Array.isArray(f.levels) || !f.levels.length) { add('error', '形', 'content/facilities.yaml', `施設には id・name・levels が要る（${f.id ?? f.name ?? '?'}）`); return; }
      f.levels.forEach((l, i) => {
        if (i > 0 && !l.cost) add('error', '形', f.id, `Lv${i + 1} に cost が無い`);
        for (const sid of Object.keys(l.cost?.souvenirs || {})) ctx.ref('souvenirId', sid);
      });
    });
  }
  for (const d of Object.values(content.souvenirs)) {
    withCtx(d, (ctx) => {
      unknownKeys(d, ['id', 'name', 'sell', 'weight', 'layers', 'rate', 'event', 'use', 'flavor'], add);
      req(d, add, { name: 'string', sell: 'number' });
      if (d.weight != null && ![1, 2].includes(d.weight)) add('error', '形', d.id, 'weight（重さ）は 1 か 2');
      if (d.layers != null && (!Array.isArray(d.layers) || !d.layers.length || d.layers.some((x) => !Number.isInteger(x)))) add('error', '形', d.id, 'layers は [出始める層, 最後の層] の整数');
      if (d.event != null && !content.events[d.event]) add('error', '参照', d.id, `謎「${d.event}」が無い。${hint(d.event, Object.keys(content.events))}`);
    });
  }
  for (const d of Object.values(content.guests)) {
    withCtx(d, (ctx) => {
      unknownKeys(d, ['id', 'name', 'hp', 'mechanic', 'relic', 'deck', 'set', 'unlock', 'params', 'state', 'text', 'choose', 'flavor'], add);
      req(d, add, { name: 'string', hp: 'number' });
      if (d.mechanic != null && !v.has('mechanic', d.mechanic)) add('error', '語彙', d.id, `宿泊客の仕組み「${d.mechanic}」の特注が無い。${hint(d.mechanic, v.names('mechanic'))}`);
      if (d.relic) ctx.ref('relicId', d.relic);
      if (d.set) ctx.ref('setId', d.set);
      if (d.deck) {
        const e = checkArg({ set: 'string', 'grades?': 'any', 'extra?': 'any' }, d.deck, ctx);
        if (e) add('error', '形', d.id, `deck：${e}`);
        if (d.deck.set && !content.sets[d.deck.set]) add('warn', '参照', d.id, `初期デッキのセット「${d.deck.set}」はまだ無い（移植で作る）`);
        for (const g of d.deck.grades || []) if (!b.economy.grades.includes(g)) add('error', '形', d.id, `deck.grades の「${g}」は格ではない`);
        for (const id of d.deck.extra || []) ctx.ref('cardId', id);
      }
      for (const [k, a] of Object.entries(d.unlock || {})) {
        const def = v.get('unlock', k);
        if (!def) { add('error', '語彙', d.id, `知らない解放条件「${k}」。${hint(k, v.names('unlock'))}`); continue; }
        const e = checkArg(def.args, a, ctx); if (e) add('error', '語彙', d.id, `解放条件「${k}」：${e}`);
      }
    });
  }

  // 参照先があるか
  const pools = {
    cardId: content.cards, enemyId: content.enemies, souvenirId: content.souvenirs, guestId: content.guests,
    setId: content.sets, layerId: content.layers, relicId: content.relics, itemId: content.items,
  };
  const JA = { cardId: '札', enemyId: '敵', souvenirId: 'お土産', guestId: '宿泊客', setId: 'セット', layerId: '層', relicId: '置物', itemId: 'お品書き' };
  const seen = new Set();
  for (const r of allRefs) {
    const pool = pools[r.type];
    if (!pool || pool[r.id]) continue;
    // 層主の解放条件で、層ファイルがまだ無いものは注意にとどめる（層は段階4・8で作る）
    const level = r.type === 'layerId' ? 'warn' : 'error';
    const key = `${r.where}|${r.type}|${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    add(level, '参照', r.where, level === 'warn' ? `${JA[r.type]}「${r.id}」はまだ無い（層は段階4・8で作る）` : `${JA[r.type]}「${r.id}」が無い。${hint(r.id, Object.keys(pool))}`);
  }
}

// ───────────────────────── 組み立て ─────────────────────────

function compileFx(list) {
  return (list || []).filter((fx) => fx && fx.when && fx.do).map((fx) => ({
    signal: fx.when,
    fn: (ctx, me) => {
      const self = findOwner(ctx.battle, me.owner);
      runFx(makeE(ctx, self, me.owner?.kind ?? 'card', me), fx);
    },
  }));
}

function compileShow(list) {
  return (list || []).map((s) => {
    const [show, arg] = typeof s === 'string' ? [s, null] : Object.entries(s)[0];
    return { show, arg: arg ?? null };
  });
}

/** YAMLの定義を、戦闘が使う形（listen・rules・show）にする */
/**
 * 定義1つを、戦闘で使う形（listen・rules・show）にする。kw はここで fx・rule・show に展開する
 * （試し場や自己テストで、その場で作った札にも使う）
 */
export function compileOne(content, d, bucket = 'cards') {
  const ex = expandAll(content, d);
  d.kwList = ex.list;
  if (bucket === 'enemies') return d; // 敵のキーワードは表示だけ（敵の動きは行動の語彙と特注で書く）
  d.fx = [...ex.fx, ...(d.fx || [])];
  d.rule = [...ex.rule, ...(d.rule || [])];
  d.show = [...ex.show, ...(d.show || [])];
  d.props = { ...(d.props || {}), ...ex.props };
  d.listen = compileFx(d.fx);
  d.rules = normRules(d.rule).filter((r) => content.vocab.has('rule', r.name));
  d.show = compileShow(d.show);
  if (bucket === 'cards' && d.tier != null) d.tier = String(d.tier);
  return d;
}

export function compileContent(content) {
  content.keywordRules = Object.values(content.kwDefs).filter((k) => k.set).map((k) => kwCustomRule(content, k)
    ?? (k.fx || []).flatMap((f) => [].concat(f.do || [])).map((x) => x?.ルール?.名前).find(Boolean)).filter(Boolean);
  for (const bucket of ['cards', 'regulars', 'relics', 'enemies']) {
    for (const d of Object.values(content[bucket])) compileOne(content, d, bucket);
  }
  for (const g of Object.values(content.guests)) {
    const m = g.mechanic ? content.vocab.get('mechanic', g.mechanic) : null;
    g.state = { ...(m?.state || {}), ...(g.state || {}) };
    g.params = { ...(m?.params || {}), ...(g.params || {}) };
  }
}

// ───────────────────────── 自己テスト ─────────────────────────

const TEST_ENEMY = '__test_enemy';

/**
 * 自己テストを1つ動かす
 * @param {object} content @param {object} t テスト（hand, play, enemies, seats, relics, guest, banzuke, choices, steps, expect）
 * @param {{disable?: {kind:string, name:string}|{cards:boolean}}} [opt] なしで比べるとき
 * @returns {{ok:boolean, msg:string, B:object}}
 */
export function runSelfTest(content, t, opt = {}) {
  const C = testContent(content, opt.disable, t);
  const base = { balance: C.balance, content: C };
  const B = createBattle(base, {
    seed: t.seed ?? 'selftest', floor: t.floor ?? 1, hp: t.hp,
    deck: (t.deck || []).map((h, i) => ({ uid: `t_deck${i}`, ...(typeof h === 'object' ? h : {}), id: typeof h === 'string' ? h : h.id ?? `__test_deck${i}` })),
    enemies: (t.enemies ?? [{}]).map((e) => ({ id: TEST_ENEMY, kind: e.kind ?? '通常', acts: e.acts ?? ['溜め'] })),
    seats: (t.seats || []).map((id, i) => ({ uid: `t_seat${i}`, id })), relics: (t.relics || []).map((id, i) => ({ uid: `t_relic${i}`, id })),
    guest: t.guest ?? null, banzuke: t.banzuke ?? {}, guestState: t.state ?? {},
    items: (t.items || []).map((id, i) => ({ uid: `t_item${i}`, id, kind: C.items[id]?.kind ?? null })),
  });
  if (B.hp == null) { B.hp = 70; B.maxHp = 70; }
  (t.enemies ?? [{}]).forEach((e, i) => {
    const claim = Big.from(e.claim ?? '1e30');
    B.enemies[i].claim = claim; B.enemies[i].maxClaim = claim;
    if (e.atk != null) B.enemies[i].atk = e.atk;
  });
  const env = openBattle(base, B);
  startBattle(B, env);
  const cid = (h, i) => (typeof h === 'string' ? h : h.id ?? `__test_card${i}`);
  if (t.hand) {
    B.hand = t.hand.map((h, i) => makeBattleCard({ uid: `t_card${i}`, ...(typeof h === 'object' ? h : {}), id: cid(h, i) }, C.cards[cid(h, i)]));
    for (const c of B.hand) attachCard(env, c);
    B.draw = (t.draw || []).map((h, i) => makeBattleCard({ uid: `t_draw${i}`, ...(typeof h === 'object' ? h : {}), id: typeof h === 'string' ? h : h.id ?? `__test_draw${i}` }, C.cards[typeof h === 'string' ? h : h.id ?? `__test_draw${i}`]));
    for (const c of B.draw) attachCard(env, c);
  }
  let last = null;
  const steps = t.steps ?? ((t.hand || []).length ? [{ play: t.play ?? t.hand.map((_, i) => i), target: t.target, choices: t.choices }] : []);
  for (const s of steps) {
    if (B.result) break;
    if (s.play) last = play(B, env, s.play, s.target ?? 0, { choices: s.choices ?? t.choices });
    else if (s.discard) discard(B, env, s.discard);
    else if (s.end) endTurn(B, env);
    else if (s.guest) guestAction(B, env, s.guest, s.args ?? {});
    else if (s.item != null) useItem(B, env, s.item, s.choices ?? {});
  }
  return { B, last };
}

function testContent(content, disable, t) {
  const cards = { ...content.cards };
  const temp = (h, key) => {
    const kw = disable?.cards ? [] : h.kw || [];
    cards[key] = compileOne(content, { id: key, name: h.name ?? `試し札`, cat: h.cat ?? ['ター'], tier: String(h.tier ?? 3), grade: '並', kw }, 'cards');
  };
  (t.hand || []).forEach((h, i) => { if (typeof h === 'object' && !h.id) temp(h, `__test_card${i}`); });
  for (const [pile, list] of [['draw', t.draw], ['deck', t.deck]]) (list || []).forEach((h, i) => { if (typeof h === 'object' && !h.id) temp(h, `__test_${pile}${i}`); });
  const enemies = { ...content.enemies, [TEST_ENEMY]: { id: TEST_ENEMY, name: '的', kind: '通常', hp: 1, atk: 0, acts: ['溜め'] } };
  let vocab = content.vocab;
  if (disable?.cards) {
    for (const h of t.hand || []) if (typeof h === 'string' && cards[h]) cards[h] = { ...cards[h], listen: [], rules: [], show: [], hooks: undefined };
  }
  if (disable?.name) {
    const orig = content.vocab;
    vocab = { ...orig, get: (k, n) => {
      const d = orig.get(k, n);
      if (d && k === disable.kind && n === disable.name) return { ...d, hooks: {}, on: {}, listen: [], apply: null, expire: null };
      return d;
    } };
  }
  return { ...content, cards, enemies, vocab };
}

/** expect に書ける項目 */
export const EXPECT_KEYS = ['V', 'V以上', 'V以下', '組', 'enemy0（敵の主張。番号は左から）', '受け', '体力', '宿銭', '出し残り', '結果（win／lose／escape）',
  '番付', '段位', '状態（宿泊客の値）', '行動停止', '記録（記録の種類）', 'エラー（記録された例外の数）', '演出', 'なしより大きい', 'なしの倍',
  '手札枚数', '山札枚数', '捨て札枚数', '除外枚数（その戦闘から除かれた札）', '手札に（札の名前）'];

/** expect を確かめる。合わなければ理由の並び */
export function checkExpect(content, t, res, without) {
  const errs = [];
  const B = res.B;
  const V = res.last?.V ?? null;
  for (const [k, want] of Object.entries(t.expect || {})) {
    const m = /^enemy(\d+)$/.exec(k);
    if (m) { const e = B.enemies[Number(m[1])]; if (!e || !e.claim.eq(want)) errs.push(`敵${m[1]}の主張 ${e ? e.claim : '無し'}（期待 ${want}）`); continue; }
    switch (k) {
      case 'V': if (!V || !V.eq(want)) errs.push(`論破値 ${V}（期待 ${want}）`); break;
      case 'V以上': if (!V || V.lt(want)) errs.push(`論破値 ${V}（期待 ${want} 以上）`); break;
      case 'V以下': if (!V || V.gt(want)) errs.push(`論破値 ${V}（期待 ${want} 以下）`); break;
      case '組': if (res.last?.hand !== want) errs.push(`組 ${res.last?.hand}（期待 ${want}）`); break;
      case '受け': if (B.guard !== want) errs.push(`受け ${B.guard}（期待 ${want}）`); break;
      case '体力': if (B.hp !== want) errs.push(`体力 ${B.hp}（期待 ${want}）`); break;
      case '宿銭': if (B.zeni !== want) errs.push(`宿銭 ${B.zeni}（期待 ${want}）`); break;
      case '出し残り': if (B.playsLeft !== want) errs.push(`出し残り ${B.playsLeft}（期待 ${want}）`); break;
      case '結果': if (B.result !== want) errs.push(`結果 ${B.result}（期待 ${want}）`); break;
      case '番付': for (const [c, s] of Object.entries(want)) if (String(B.banzuke[c]) !== String(s)) errs.push(`番付 ${c} ${B.banzuke[c]}（期待 ${s}）`); break;
      case '段位': for (const [h, n] of Object.entries(want)) if ((B.handLevels[h] ?? 1) !== n) errs.push(`段位 ${h} ${B.handLevels[h] ?? 1}（期待 ${n}）`); break;
      case '状態': for (const [n, x] of Object.entries(want)) if (B.guestState[n] !== x) errs.push(`${n} ${B.guestState[n]}（期待 ${x}）`); break;
      case '行動停止': for (const [i, n] of Object.entries(want)) if (B.enemies[i]?.skip !== n) errs.push(`敵${i}の行動停止 ${B.enemies[i]?.skip}（期待 ${n}）`); break;
      case '記録': if (!B.log.some((l) => l.t === want)) errs.push(`記録「${want}」が無い`); break;
      case 'エラー': { const n = B.log.filter((l) => l.t === 'error').length; if (n !== want) errs.push(`記録された例外 ${n}件（期待 ${want}件）`); break; }
      case '演出': { const got = (res.last?.fx || []).map((f) => f.show); for (const s of [].concat(want)) if (!got.includes(s)) errs.push(`演出「${s}」が無い（${got.join('、') || 'なし'}）`); break; }
      case 'なしより大きい': if (!without || !V || !V.gt(without)) errs.push(`論破値 ${V} がなしの ${without} より大きくない`); break;
      case '手札枚数': if (B.hand.length !== want) errs.push(`手札 ${B.hand.length}枚（期待 ${want}）`); break;
      case '山札枚数': if (B.draw.length !== want) errs.push(`山札 ${B.draw.length}枚（期待 ${want}）`); break;
      case '捨て札枚数': if (B.discard.length !== want) errs.push(`捨て札 ${B.discard.length}枚（期待 ${want}）`); break;
      case '除外枚数': if (B.exhaust.length !== want) errs.push(`除かれた札 ${B.exhaust.length}枚（期待 ${want}）`); break;
      case '手札に': for (const n of [].concat(want)) if (!B.hand.some((c) => c.name === n)) errs.push(`手札に「${n}」が無い`); break;
      case 'なしの倍': if (!without || !V || !V.eq(without.mul(want))) errs.push(`論破値 ${V} がなしの ${without} の${want}倍でない`); break;
      default: errs.push(`expect の知らない項目「${k}」`);
    }
  }
  return errs;
}

/** コンテンツの自己テストを全部動かす。結果を1件ずつ返す */
export function runAllSelfTests(content, filterSets = null) {
  const out = [];
  const inSet = (d) => !filterSets || filterSets.includes(d.set);
  const one = (where, t, disable) => {
    try {
      const res = runSelfTest(content, t);
      let without = null;
      if (t.expect && ('なしより大きい' in t.expect || 'なしの倍' in t.expect)) without = runSelfTest(content, t, { disable }).last?.V ?? null;
      const errs = checkExpect(content, t, res, without);
      out.push({ where, ok: !errs.length, msg: errs.join('、') || (t.name ?? 'OK') });
    } catch (e) {
      out.push({ where, ok: false, msg: `動かない：${e.message}` });
    }
  };
  for (const bucket of ['cards', 'regulars', 'relics']) {
    for (const d of Object.values(content[bucket])) {
      if (!inSet(d)) continue;
      (d.test || []).forEach((t, i) => one(`${d.id}#${i + 1}`, t, { cards: true }));
    }
  }
  for (const d of Object.values(content.kwDefs)) {
    if (filterSets && !filterSets.includes(d.set)) continue;
    (d.test || []).forEach((t, i) => one(`キーワード「${d.name}」#${i + 1}`, t, { cards: true }));
  }
  for (const k of ['rule', 'do', 'show', 'mechanic', 'enemy']) {
    for (const d of content.vocab.list(k)) {
      const file = content.vocab.origin.get(`${k}:${d.name}`);
      if (file === '組み込み' || !d.tests) continue;
      if (filterSets && !filterSets.some((s) => file.includes(`/sets/${s}/`) || file.includes('/guests/'))) continue;
      d.tests.forEach((t, i) => one(`${d.name}#${i + 1}`, t, { kind: k, name: d.name }));
    }
  }
  return out;
}

export { describeArgs, KIND_JA, SCOPES };

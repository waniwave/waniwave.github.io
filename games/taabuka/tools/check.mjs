// 検査コマンド（仕様書 第9章「検査コマンド」）
//   node tools/check.mjs [セットID…] [--fix-index] [--docs] [--ids] [--trial] [--root 別のcontent]
//  1. YAMLと形の検査（必須項目、値の範囲、知らない語彙）
//  2. IDの重複と参照先の存在
//  3. content/index.yaml の確認（--fix-index で書き直す）
//  4. 自己テストの実行
//  5. 札ごとの試し対戦（--trial）：その札を2枚入れた初期デッキで第一〜三層を潜らせ（既定300回、--trial-dives で変える）、
//     平均到達階と平均論破値を同じ格の平均と比べて「強すぎ／弱すぎ／普通」を出す。時間がかかるので頼んだときだけ
// 出力は1件1行の日本語。エラーか自己テストの失敗があれば終了コード1。

import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from '../vendor/yaml.mjs';
import { loadContent, runAllSelfTests } from '../engine/content.js';
import { writeDocs } from './docs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function exists(p) { try { await stat(p); return true; } catch { return false; } }
async function ls(dir) { try { return (await readdir(dir, { withFileTypes: true })); } catch { return []; } }

/** content/ を見て index.yaml の中身を作る */
export async function scanIndex(contentDir) {
  const idx = { sets: {}, guests: {}, keywords: [], enemies: [], layers: [], events: [], root: [] };
  const filesIn = async (dir, exts) => {
    const out = [];
    for (const e of await ls(dir)) {
      if (e.isFile() && exts.some((x) => e.name.endsWith(x))) out.push(e.name);
      if (e.isDirectory() && e.name === 'custom') for (const f of await filesIn(path.join(dir, 'custom'), ['.js'])) out.push(`custom/${f}`);
    }
    return out.sort();
  };
  for (const e of await ls(path.join(contentDir, 'sets'))) if (e.isDirectory()) idx.sets[e.name] = await filesIn(path.join(contentDir, 'sets', e.name), ['.yaml', '.js']);
  for (const e of await ls(path.join(contentDir, 'guests'))) if (e.isDirectory()) idx.guests[e.name] = await filesIn(path.join(contentDir, 'guests', e.name), ['.yaml', '.js']);
  idx.keywords = await filesIn(path.join(contentDir, 'keywords'), ['.yaml']);
  idx.enemies = await filesIn(path.join(contentDir, 'enemies'), ['.yaml']);
  idx.layers = await filesIn(path.join(contentDir, 'layers'), ['.yaml']);
  idx.events = await filesIn(path.join(contentDir, 'events'), ['.yaml']);
  for (const f of ['souvenirs.yaml', 'facilities.yaml', 'achievements.yaml', 'shibari.yaml', 'affixes.yaml', 'combos.yaml', 'decor.yaml', 'flavor.yaml', 'dungeons.yaml']) if (await exists(path.join(contentDir, f))) idx.root.push(f);
  return idx;
}

function sortKeys(o) { return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])); }

export function indexText(idx) {
  return '# 読み込むファイルの一覧。node tools/check.mjs --fix-index で自動で書き直す（手で直さない）\n'
    + yaml.dump({ ...idx, sets: sortKeys(idx.sets), guests: sortKeys(idx.guests) }, { flowLevel: 2, lineWidth: 200 });
}

function diffIndex(want, have) {
  const out = [];
  const flat = (x) => {
    const s = new Set();
    for (const [k, v] of Object.entries(x || {})) {
      if (Array.isArray(v)) v.forEach((f) => s.add(`${k}/${f}`));
      else for (const [id, fs] of Object.entries(v || {})) (fs || []).forEach((f) => s.add(`${k}/${id}/${f}`));
    }
    return s;
  };
  const w = flat(want), h = flat(have);
  for (const f of w) if (!h.has(f)) out.push(`content/${f} が index.yaml に無い`);
  for (const f of h) if (!w.has(f)) out.push(`index.yaml の content/${f} が無い`);
  return out;
}

/**
 * 検査を実行する（テストからも呼ぶ）
 * @returns {Promise<{lines:string[], errors:number, warns:number, failed:number, content:object}>}
 */
export async function runCheck(opts = {}) {
  const contentDir = opts.root ? path.resolve(opts.root) : path.join(ROOT, 'content');
  const lines = [];
  let errors = 0, warns = 0, failed = 0;

  // 3. 索引
  const scanned = await scanIndex(contentDir);
  let current = null;
  try { current = yaml.load(await readFile(path.join(contentDir, 'index.yaml'), 'utf8')); } catch { current = null; }
  const diffs = diffIndex(scanned, current);
  if (opts.fixIndex) {
    await writeFile(path.join(contentDir, 'index.yaml'), indexText(scanned));
    if (diffs.length) lines.push(`[索引] index.yaml を書き直した（${diffs.length}件）`);
  } else {
    for (const d of diffs) { lines.push(`[索引] ${d}（--fix-index で直る）`); errors++; }
  }

  // 1・2. 読み込みと検査（索引は実際のファイルから作ったものを使う）
  const { content, issues } = await loadContent({
    readText: (p) => (p === 'index.yaml' ? Promise.resolve(indexText(scanned)) : readFile(path.join(contentDir, p), 'utf8')),
    importModule: (p) => import(pathToFileURL(path.join(contentDir, p)).href),
  });
  const sets = opts.sets?.length ? opts.sets : null;
  const inScope = (iss) => {
    if (!sets) return true;
    const file = content.where[iss.where] ?? iss.where;
    return sets.some((s) => String(file).includes(`/sets/${s}/`) || iss.where === s) || !String(file).includes('/sets/');
  };
  for (const iss of issues.filter(inScope)) {
    lines.push(`[${iss.tag}] ${iss.where}: ${iss.msg}${iss.level === 'warn' ? '（注意）' : ''}`);
    if (iss.level === 'error') errors++; else warns++;
  }

  // 4. 自己テスト
  const results = runAllSelfTests(content, sets);
  for (const r of results) if (!r.ok) { lines.push(`[自己テスト] ${r.where}: ${r.msg}`); failed++; }

  // 5. 札ごとの試し対戦
  if (opts.trial) for (const l of await trialCards(content, sets, opts)) { lines.push(l.text); if (l.warn) warns++; }

  lines.push(`エラー ${errors} 件・注意 ${warns} 件・自己テスト ${results.length - failed}/${results.length} 通過`);
  return { lines, errors, warns, failed, content, results };
}

/**
 * 札ごとの試し対戦（仕様書 第9章 検査コマンドの5）。tools/bot.mjs で潜らせる
 * 強すぎ：平均到達が同格の平均の1.25倍を超えるか、平均論破値が同格の平均の10倍を超える。弱すぎはその逆（0.8倍・10分の1）
 */
export async function trialCards(content, sets, opts = {}) {
  const { runBot } = await import('./bot.mjs');
  const dives = opts.trialDives ?? 300;
  const ids = opts.trialIds?.length ? opts.trialIds : Object.values(content.cards)
    .filter((c) => c.set && c.set !== '仮' && !c.id.startsWith('__') && c.origin !== 'pawn' && (!sets || sets.includes(c.set))).map((c) => c.id);
  const res = [];
  for (const id of ids) {
    const rows = (await runBot({ dives, seed: 'trial', add: [id], floors: 9, workers: opts.workers })).filter((r) => r.outcome !== 'error');
    const avg = (f) => rows.reduce((s, r) => s + f(r), 0) / Math.max(1, rows.length);
    res.push({ id, grade: content.cards[id]?.grade, reach: avg((r) => r.deepest), vlog: avg((r) => r.maxVlog || 0) });
    if (opts.progress) process.stderr.write(`\r[試し] ${res.length}/${ids.length}`);
  }
  if (opts.progress) process.stderr.write('\n');
  const byGrade = {};
  for (const r of res) (byGrade[r.grade] ||= []).push(r);
  const out = [];
  for (const r of res) {
    const peers = byGrade[r.grade];
    const reach = peers.reduce((s, x) => s + x.reach, 0) / peers.length;
    const vlog = peers.reduce((s, x) => s + x.vlog, 0) / peers.length;
    let verdict = '普通';
    if (r.reach > reach * 1.25 || r.vlog > vlog + 1) verdict = '強すぎ';
    else if (r.reach < reach * 0.8 || r.vlog < vlog - 1) verdict = '弱すぎ';
    out.push({ warn: verdict !== '普通', text: `[試し] ${r.id}: ${verdict}（平均到達 B${r.reach.toFixed(1)}、同格（${r.grade}）の平均 B${reach.toFixed(1)}・平均論破値 10^${r.vlog.toFixed(1)}、同格 10^${vlog.toFixed(1)}）` });
  }
  return out;
}

/** 既存IDの一覧（コンテンツを足す人に渡す） */
export function idsText(content) {
  const out = ['# 既存IDの一覧（node tools/check.mjs --ids）'];
  const sec = (title, obj, fmt) => { out.push(`\n## ${title}`); for (const d of Object.values(obj)) out.push(`- ${fmt(d)}`); };
  sec('セット', content.sets, (d) => `${d.id}　${d.name}`);
  sec('札', content.cards, (d) => `${d.id}　${d.name}（${(d.cat || []).join('・')} / Tier ${d.tier} / ${d.grade}）`);
  sec('常連客', content.regulars, (d) => `${d.id}　${d.name}`);
  sec('置物', content.relics, (d) => `${d.id}　${d.name}`);
  sec('お品書き', content.items, (d) => `${d.id}　${d.name}（${d.kind}）`);
  sec('敵', content.enemies, (d) => `${d.id}　${d.name}（${d.kind ?? '通常'}）`);
  sec('層', content.layers, (d) => `${d.id}　${d.name}`);
  sec('謎', content.events, (d) => `${d.id}　${d.title}`);
  sec('お土産', content.souvenirs, (d) => `${d.id}　${d.name}`);
  sec('宿泊客', content.guests, (d) => `${d.id}　${d.name}（仕組み：${d.mechanic}）`);
  out.push('\n## 特注');
  for (const c of content.customs) out.push(`- ${c.name}（${c.kind}）　${c.file}`);
  return `${out.join('\n')}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (f) => args.includes(f);
  const rootI = args.indexOf('--root');
  const opts = {
    fixIndex: flag('--fix-index'), trial: flag('--trial'), progress: true,
    trialDives: args.includes('--trial-dives') ? Number(args[args.indexOf('--trial-dives') + 1]) : undefined,
    root: rootI >= 0 ? args[rootI + 1] : null,
    sets: args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--root' && args[i - 1] !== '--trial-dives'),
  };
  const res = await runCheck(opts);
  if (flag('--docs')) {
    const written = await writeDocs(res.content, path.join(ROOT, 'docs'));
    res.lines.splice(res.lines.length - 1, 0, ...written.map((f) => `[手引き] ${f} を書き出した`));
  }
  if (flag('--ids')) {
    await mkdir(path.join(ROOT, 'docs'), { recursive: true });
    await writeFile(path.join(ROOT, 'docs', 'ids.md'), idsText(res.content));
    res.lines.splice(res.lines.length - 1, 0, '[一覧] docs/ids.md を書き出した');
  }
  console.log(res.lines.join('\n'));
  process.exit(res.errors || res.failed ? 1 : 0);
}

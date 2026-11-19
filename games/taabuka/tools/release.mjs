// 公開の準備：BUILD を上げ、サービスワーカーの先読み一覧（sw.js）を書き直す。
//   node tools/release.mjs            … BUILD の末尾の番号を1つ上げる（0.7.0-1 → 0.7.0-2）
//   node tools/release.mjs 0.8.0-1    … BUILD を指定
// BUILD は index.html と sw.js の2か所。読み込むファイルには ?v=BUILD が付き、サービスワーカーは BUILD ごとに入れ替わる。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['engine', 'ui', 'content', 'vendor', 'icons'];
const FILES = ['index.html', 'manifest.webmanifest'];

async function walk(dir) {
  const out = [];
  for (const name of await readdir(path.join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    const s = await stat(path.join(ROOT, rel));
    if (s.isDirectory()) out.push(...(await walk(rel)));
    else if (!name.startsWith('.')) out.push(rel);
  }
  return out;
}

export async function release(next) {
  const idx = path.join(ROOT, 'index.html');
  let html = await readFile(idx, 'utf8');
  const cur = /window\.BUILD = '([^']+)'/.exec(html)[1];
  const build = next ?? cur.replace(/(\d+)$/, (n) => String(Number(n) + 1));
  html = html.replace(/window\.BUILD = '[^']+'/, `window.BUILD = '${build}'`);
  await writeFile(idx, html);
  const files = [...FILES, ...(await Promise.all(DIRS.map(walk))).flat()].sort();
  const sw = (await readFile(path.join(ROOT, 'sw.js'), 'utf8'))
    .replace(/const BUILD = '[^']*';/, `const BUILD = '${build}';`)
    .replace(/const FILES = \[[\s\S]*?\];/, `const FILES = [\n${files.map((f) => `  './${f}',`).join('\n')}\n];`);
  await writeFile(path.join(ROOT, 'sw.js'), sw);
  return { build, files: files.length };
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const r = await release(process.argv[2]);
  console.log(`BUILD ${r.build}・先読み ${r.files} ファイル`);
}

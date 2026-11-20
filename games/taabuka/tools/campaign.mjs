// 通しの宿を何回か走らせ、潜行ごとの最深・結果と、深い層に届くまでの回数を見る（釣り合いの確認）
//   node tools/campaign.mjs [--dives 40] [--seeds 3]
import { runCampaign } from './bot.mjs';
import { loadRealContent } from './fixtures/index.mjs';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const dives = Number(arg('--dives', 40));
const seeds = Number(arg('--seeds', 3));
const { base } = await loadRealContent();
for (let s = 1; s <= seeds; s++) {
  const t = Date.now();
  const out = runCampaign(base, { seed: `camp${s}`, dives, depthUp: false });
  const deep = out.map((r) => `${r.outcome === 'escaped' ? '' : r.outcome === 'lost' ? '×' : '?'}${r.deepest}`).join(' ');
  const best = Math.max(...out.map((r) => r.deepest));
  const first = (f) => out.findIndex((r) => r.deepest >= f) + 1 || '-';
  console.log(`宿${s}：最深 B${best}　B6到達 ${first(6)}回目・B9 ${first(9)}・B12 ${first(12)}・B15 ${first(15)}・B16 ${first(16)}（${Math.round((Date.now() - t) / 1000)}秒）`);
  console.log(`  ${deep}`);
  for (const r of out.filter((x) => x.outcome === 'error')) console.log('  エラー', r.dive, r.error);
}

// 光と閃光の門番（仕様書 第10章 設定「点滅の軽減」：白い閃光を禁止し、光るのは秒間3回まで）
// 光る演出はすべてここを通す。window.__fxStats に回数を残す（試験と開発者ツール用）
const stats = { white: 0, glows: [], blocked: 0 };
if (typeof window !== 'undefined') window.__fxStats = stats;

let opt = { noFlash: false };
export function setFlashOptions(o) { opt = { ...opt, ...o }; }
export function noFlash() { return !!opt.noFlash; }

/** 光ってよいか。点滅の軽減では直近1秒に3回まで */
export function mayGlow() {
  const now = performance.now();
  if (opt.noFlash) {
    const recent = stats.glows.filter((t) => now - t < 1000);
    if (recent.length >= 3) { stats.blocked += 1; return false; }
  }
  stats.glows.push(now);
  if (stats.glows.length > 200) stats.glows.splice(0, 100);
  return true;
}

/** 秒間の光の最多（試験用） */
export function maxGlowsPerSecond() {
  let best = 0;
  const g = stats.glows;
  for (let i = 0, j = 0; i < g.length; i++) { while (g[i] - g[j] >= 1000) j++; best = Math.max(best, i - j + 1); }
  return best;
}

/**
 * 白く飛ぶ。点滅の軽減では白を使わず、背景の色をゆっくり変える（これも光1回に数える）
 * @param {HTMLElement} layer @param {number} ms
 */
export function whiteOut(layer, ms = 360) {
  if (!mayGlow()) return;
  const el = document.createElement('div');
  if (opt.noFlash) {
    el.className = 'tint';
    layer.append(el);
    el.animate([{ opacity: 0 }, { opacity: 0.5, offset: 0.4 }, { opacity: 0 }], { duration: ms * 2, easing: 'ease-in-out' }).onfinish = () => el.remove();
    return;
  }
  stats.white += 1;
  el.className = 'whiteout';
  layer.append(el);
  el.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: ms, easing: 'ease-out' }).onfinish = () => el.remove();
}

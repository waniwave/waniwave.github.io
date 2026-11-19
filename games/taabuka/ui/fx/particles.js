// Canvas の粒子：紙吹雪・火の粉・砕ける片。粒子がいる間だけ requestAnimationFrame を回す
// 数は「演出の強さ」で絞る（控えめ 0.35・標準 1・激しい 1.6）。上限 220 個
const MAX = 220;
let cv = null, ctx = null, parts = [], raf = 0, scale = 1, dpr = 1, last = 0;

export function initParticles(canvas) {
  cv = canvas;
  ctx = cv.getContext('2d');
  const fit = () => {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
  };
  fit();
  window.addEventListener('resize', fit);
}
export function setParticleScale(s) { scale = s; }
export function clearParticles() { parts = []; if (ctx) ctx.clearRect(0, 0, cv.width, cv.height); }
export function particleCount() { return parts.length; }

const rnd = (a, b) => a + Math.random() * (b - a);   // 演出の見た目だけに使う（計算には使わない）

function add(p) { if (parts.length < MAX) parts.push(p); }
function start() { if (!raf && cv) { last = performance.now(); raf = requestAnimationFrame(tick); } }

/** 紙吹雪 */
export function confetti(n = 60, colors = ['#c8302a', '#d6a425', '#2f5d9c', '#3f7a3a', '#8b4fc4', '#efe6d2']) {
  if (!cv) return;
  const W = cv.width / dpr;
  for (let i = 0; i < Math.round(n * scale); i++) {
    add({ k: 'c', x: rnd(0, W), y: rnd(-80, -10), vx: rnd(-40, 40), vy: rnd(60, 160), r: rnd(0, 6.28), vr: rnd(-8, 8), w: rnd(5, 9), h: rnd(3, 6), c: colors[i % colors.length], life: rnd(2.2, 3.4) });
  }
  start();
}

/** 火の粉（x, y の辺りから上へ） */
export function embers(x, y, n = 24, w = 160) {
  if (!cv) return;
  for (let i = 0; i < Math.round(n * scale); i++) {
    add({ k: 'e', x: x + rnd(-w / 2, w / 2), y: y + rnd(-6, 6), vx: rnd(-20, 20), vy: rnd(-140, -50), s: rnd(1.5, 3.5), c: Math.random() < 0.5 ? '#ffb347' : '#e2701c', life: rnd(0.6, 1.3) });
  }
  start();
}

/** 砕ける片（四角い領域から外へ。色つき） */
export function shards(rect, color = '#8a7f6e', n = 18) {
  if (!cv || !rect) return;
  const L = cv.getBoundingClientRect();
  const cx = rect.left - L.left + rect.width / 2;
  const cy = rect.top - L.top + rect.height / 2;
  for (let i = 0; i < Math.round(n * scale); i++) {
    add({ k: 's', x: cx + rnd(-rect.width / 3, rect.width / 3), y: cy + rnd(-rect.height / 3, rect.height / 3), vx: rnd(-160, 160), vy: rnd(-220, -40), r: rnd(0, 6.28), vr: rnd(-10, 10), w: rnd(4, 11), h: rnd(3, 8), c: color, life: rnd(0.7, 1.2) });
  }
  start();
}

/** 金の光の粒（神格） */
export function sparkle(x, y, n = 40) {
  if (!cv) return;
  for (let i = 0; i < Math.round(n * scale); i++) {
    const a = rnd(0, 6.28), v = rnd(40, 200);
    add({ k: 'e', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: rnd(1.5, 3), c: Math.random() < 0.6 ? '#ffd76a' : '#fff4c2', life: rnd(0.6, 1.4) });
  }
  start();
}

function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  const H = cv.height / dpr;
  let j = 0;
  for (const p of parts) {
    p.life -= dt;
    if (p.life <= 0 || p.y > H + 40) continue;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.k === 'c') { p.vy += 30 * dt; p.vx *= 0.99; p.r += p.vr * dt; }
    else if (p.k === 's') { p.vy += 520 * dt; p.r += p.vr * dt; }
    else { p.vy += 30 * dt; }
    ctx.globalAlpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.c;
    if (p.k === 'e') { ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill(); }
    else {
      const c = Math.cos(p.r), s = Math.sin(p.r);
      ctx.setTransform(c * dpr, s * dpr, -s * dpr, c * dpr, p.x * dpr, p.y * dpr);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    parts[j++] = p;
  }
  parts.length = j;
  ctx.globalAlpha = 1;
  raf = parts.length ? requestAnimationFrame(tick) : 0;
  if (!raf) ctx.clearRect(0, 0, cv.width, cv.height);
}

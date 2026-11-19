// 画面の小さな道具：要素を作る、長押しの説明、長押しで確定するボタン、下から出る窓、短い知らせ

/** 要素を作る。h('div.a.b', {onclick}, [子…]) */
export function h(sel, attrs = {}, kids = []) {
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(kids)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ───────── 長押し0.4秒で説明（PCはマウスを乗せる） ─────────
const TIP_MS = 400;
let tipEl = null;
function tipBox() { return tipEl ||= document.getElementById('tip'); }

export function showTip(html, x, y) {
  const t = tipBox();
  t.innerHTML = html;
  t.style.display = 'block';
  const r = t.getBoundingClientRect();
  const W = window.innerWidth, H = window.innerHeight;
  let left = Math.min(Math.max(8, x - r.width / 2), W - r.width - 8);
  let top = y - r.height - 14;
  if (top < 8) top = Math.min(H - r.height - 8, y + 18);
  t.style.left = `${left}px`;
  t.style.top = `${top}px`;
}
export function hideTip() { const t = tipBox(); if (t) t.style.display = 'none'; }

/**
 * 長押しで説明を出す。説明が出たら、そのあとのクリックは無視する
 * @param {HTMLElement} el @param {() => string} html 説明（HTML）
 */
export function tip(el, html) {
  let timer = null, shown = false, sx = 0, sy = 0;
  const cancel = () => { clearTimeout(timer); timer = null; };
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    shown = false; sx = e.clientX; sy = e.clientY;
    cancel();
    timer = setTimeout(() => { shown = true; showTip(html(), sx, sy); }, TIP_MS);
  });
  el.addEventListener('pointermove', (e) => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
  el.addEventListener('pointerup', () => { cancel(); if (shown) setTimeout(hideTip, 900); });
  el.addEventListener('pointercancel', () => { cancel(); hideTip(); });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('click', (e) => { if (shown) { e.stopImmediatePropagation(); e.preventDefault(); shown = false; } }, true);
  // PC：マウスを乗せると出る
  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    el._hover = setTimeout(() => showTip(html(), r.left + r.width / 2, r.top), 250);
  });
  el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { clearTimeout(el._hover); hideTip(); } });
  return el;
}

// ───────── 長押し0.8秒で確定するボタン ─────────
export const HOLD_MS = 800;
/**
 * 取り返せない確定のボタン。押している間、進み具合の帯が伸びる
 * @param {string} label @param {() => void} onConfirm @param {string} [cls]
 */
export function holdButton(label, onConfirm, cls = '') {
  const bar = h('span.bar');
  const btn = h(`button.btn.hold${cls ? `.${cls}` : ''}`, { type: 'button' }, [bar, h('span.lbl', { text: label })]);
  let anim = null, timer = null;
  const stop = () => { clearTimeout(timer); if (anim) anim.cancel(); anim = null; };
  btn.addEventListener('pointerdown', (e) => {
    if (btn.disabled) return;
    e.preventDefault();
    stop();
    anim = bar.animate([{ width: '0%' }, { width: '100%' }], { duration: HOLD_MS, fill: 'forwards' });
    timer = setTimeout(() => { stop(); onConfirm(); }, HOLD_MS);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
  btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.repeat) onConfirm(); });
  btn.title = '長押しで確定';
  return btn;
}

// ───────── 下から出る窓 ─────────
/** @returns {{close: () => void, el: HTMLElement}} */
export function sheet(root, kids, { onClose } = {}) {
  const box = h('div.sheet', {}, kids);
  const back = h('div.sheet-back', { onclick: (e) => { if (e.target === back) close(); } }, [box]);
  function close() { back.remove(); if (onClose) onClose(); }
  root.append(back);
  return { close, el: box };
}

/** 選択肢から選ぶ窓。選ばれたら値で解決、閉じたら null */
export function pick(root, title, options) {
  return new Promise((resolve) => {
    let done = false;
    const s = sheet(root, [
      h('h2', { text: title }),
      h('div.chips', {}, options.map((o) => h('button.chip', { type: 'button', onclick: () => { done = true; s.close(); resolve(o.value); } }, [o.label]))),
      h('div.row', {}, [h('button.btn', { type: 'button', onclick: () => s.close() }, ['やめる'])]),
    ], { onClose: () => { if (!done) resolve(null); } });
  });
}

// ───────── 短い知らせ ─────────
let toastTimer = null;
export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 1600);
}

// ───────── 設定（端末に保存。engine/ は使わない） ─────────
const SKEY = 'taabuka.settings';
/** 設定の初期値（仕様書 第10章）。OSの「視差効果を減らす」がオンなら 控えめ・揺れなし・点滅軽減 */
export function defaultSettings() {
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { speed: 1, fx: calm ? '控えめ' : '標準', shake: !calm, noFlash: calm, vibrate: true, bgm: 0.5, se: 0.7, numFmt: '漢字' };
}
export function loadSettings() {
  try { return { ...defaultSettings(), ...(JSON.parse(localStorage.getItem(SKEY)) || {}) }; } catch { return defaultSettings(); }
}
export function saveSettings(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch { /* 保存できなくても続ける */ } }

/** はみ出す数字を枠に収める（文字を小さくする。最小 min px）。無量大数を超えるような長い数でも切れない */
export function fitText(el, min = 9) {
  if (!el) return;
  el.style.fontSize = '';
  const box = el.closest('.nums, .fitbox') || el.parentElement;
  if (!box) return;
  let size = parseFloat(getComputedStyle(box).fontSize) || 16;
  box.style.fontSize = '';
  size = parseFloat(getComputedStyle(box).fontSize) || 16;
  for (let i = 0; i < 12 && box.scrollWidth > box.clientWidth + 1 && size > min; i++) {
    size = Math.max(min, size * Math.max(0.6, (box.clientWidth / box.scrollWidth) * 0.98));
    box.style.fontSize = `${size}px`;
  }
}

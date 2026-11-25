// 画面の小さな道具：要素を作る、押すと出る説明、決定のボタン、確認、下から出る窓、短い知らせ

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

// ───────── 説明欄（長押しは使わない） ─────────
// 押すと説明が出る。画面に「説明欄」（.infobox）があればそこへ、無ければ画面下の説明の窓へ。
// 説明を出しても、押した物の本来の動き（札を選ぶなど）はそのまま起きる。マウスを乗せても何も出ない。
let infoEl = null;
function infoPanel() { return infoEl ||= document.getElementById('tip'); }

/** 説明を出す。screen 内に .infobox があればそこに、無ければ説明の窓に */
export function showInfo(html, from = null) {
  const scope = from?.closest?.('.sheet, .scr');
  const box = scope ? scope.querySelector('.infobox, .detail') : document.querySelector('#app > .scr .infobox, #app > .scr .detail');
  if (box) {
    box.innerHTML = html;
    box.classList.add('on');
    box.scrollTop = 0;
    return;
  }
  const t = infoPanel();
  if (!t) return;
  t.innerHTML = `<button type="button" class="tipx" aria-label="閉じる">✕</button>${html}`;
  t.classList.add('on');
  t.style.display = 'block';
  t.querySelector('.tipx').onclick = (e) => { e.stopPropagation(); hideTip(); };
}
/** 以前の呼び名（説明の窓を出す） */
export function showTip(html) { showInfo(html); }
export function hideTip() { const t = infoPanel(); if (t) { t.style.display = 'none'; t.classList.remove('on'); } }
// 説明の窓の外を押したら閉じる（押した物の動きは止めない）
document.addEventListener('pointerdown', (e) => {
  const t = infoPanel();
  if (t && t.style.display === 'block' && !t.contains(e.target) && !e.target.closest?.('[data-info]')) hideTip();
}, true);

/**
 * 押すと説明が出るようにする
 * @param {HTMLElement} el @param {() => string} html 説明（HTML）
 */
export function tip(el, html) {
  el.dataset.info = '1';
  el._info = html;
  el.addEventListener('click', () => { if (el.isConnected) showInfo(html(), el); });
  return el;
}

// ───────── 決定のボタン（長押しはやめた。名前は昔のまま） ─────────
/**
 * 押すと決まるボタン。取り返せない決定は、ボタンの文言で何が起きるか分かるようにする
 * @param {string} label @param {() => void} onConfirm @param {string} [cls]
 */
export function holdButton(label, onConfirm, cls = '') {
  const btn = h(`button.btn.hold${cls ? `.${cls}` : ''}`, { type: 'button' }, [h('span.lbl', { text: label })]);
  btn.addEventListener('click', () => { if (!btn.disabled) onConfirm(); });
  return btn;
}

/** はい／いいえの確認（取り返せない操作の前に）。はいなら true */
export function confirmSheet(root, title, body, yes = 'はい', no = 'やめる') {
  return new Promise((resolve) => {
    let done = false;
    const s = sheet(root, [
      h('h2', { text: title }),
      body ? (typeof body === 'string' ? h('p', { text: body }) : body) : null,
      h('div.row', {}, [
        h('button.btn', { type: 'button', onclick: () => s.close() }, [no]),
        h('button.btn.main', { type: 'button', onclick: () => { done = true; s.close(); resolve(true); } }, [yes]),
      ]),
    ], { onClose: () => { if (!done) resolve(false); } });
  });
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

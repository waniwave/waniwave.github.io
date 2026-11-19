// 女将の案内（チュートリアル）。画面の上に薄い幕と吹き出しを重ね、案内する場所を照らす。
// 案内の中身は ui/lessons.js。ここは「いつ・どこに出すか」と、進み具合の保存だけ。
//
// 進み具合は宿のセーブ（H.hints）に入る：
//   H.hints.coach === false … 案内を止めている
//   H.hints.tut[id] … 数字なら途中（その段から再開）、true なら済み
//
// 説明の段（do が無い）は、画面を触れないようにして「次へ」で進む。
// やってみる段（do がある）は、画面を触れるようにして、do(s) が成り立ったら進む。

import { h } from './dom.js';
import { LESSONS } from './lessons.js';

const TICK_MS = 250;

/**
 * @param {{ app: HTMLElement, getH: () => any, save: () => void, getCurrent: () => any, base: any }} o
 */
export function createCoach(o) {
  const { app } = o;
  const layer = h('div', { id: 'coach' });
  const spot = h('div.cspot');
  const catcher = h('div.ccatch');
  const name = h('div.cname', { text: '女将マープ' });
  const text = h('div.ctext');
  const nextBtn = h('button.btn.main.cnext', { type: 'button' }, ['次へ']);
  const quitBtn = h('button.btn.cquit', { type: 'button' }, ['案内をやめる']);
  const count = h('span.ccount');
  const bub = h('div.cbub', {}, [h('div.chead', {}, [name, count]), text, h('div.crow', {}, [quitBtn, nextBtn])]);
  const rings = h('div.crings');
  layer.append(catcher, spot, rings, bub);
  app.append(layer);

  let active = null;       // { L, i, memo }
  let hiddenFor = 0;       // 一時的に隠す（ミリ秒の時刻まで）

  const hints = () => { const H = o.getH(); if (!H) return null; H.hints ||= {}; H.hints.tut ||= {}; return H.hints; };
  const on = () => { const x = hints(); return !!x && x.coach !== false; };

  function snapshot() {
    const cur = o.getCurrent();
    const el = cur?.el;
    const cl = el?.classList;
    const W = window.__taabuka || {};
    const H = o.getH();
    let where = 'other';
    if (!cl) where = 'none';
    else if (cl.contains('battle')) where = cur.dive ? 'battle' : 'lab';
    else if (cl.contains('dive')) where = 'dive';
    else if (cl.contains('result')) where = 'result';
    else if (cl.contains('prep')) where = 'prep';
    else if (cl.contains('stash')) where = 'stash';
    else if (cl.contains('fac')) where = 'fac';
    else if (cl.contains('settings')) where = 'settings';
    else if (cl.contains('board')) where = 'board';
    else if (cl.contains('inn')) where = 'inn';
    else if (cl.contains('title')) where = 'title';
    const D = H?.diving ? W.D : null;
    const B = where === 'battle' ? W.battle?.B : null;
    return {
      where, H, D, B, base: o.base, root: el,
      q: (sel) => el?.querySelector(sel) ?? null,
      qa: (sel) => [...(el?.querySelectorAll(sel) ?? [])],
      sheet: !!app.querySelector('.sheet-back'),
    };
  }

  function busy() {
    return document.getElementById('blocker')?.classList.contains('on') || Date.now() < hiddenFor;
  }

  function hide() { layer.classList.remove('on', 'block'); }

  function stepOf() { return active ? active.L.steps[active.i] : null; }

  function finish(L, done = true) {
    const x = hints();
    if (x) { x.tut[L.id] = done ? true : x.tut[L.id]; o.save(); }
  }

  function advance() {
    if (!active) return;
    const { L } = active;
    let i = active.i + 1;
    const s = snapshot();
    while (i < L.steps.length && L.steps[i].if && !L.steps[i].if(s)) i++;
    if (i >= L.steps.length) { finish(L); active = null; hide(); hiddenFor = Date.now() + 400; tick(); return; }
    active.i = i;
    active.memo = L.steps[i].begin?.(s) ?? null;
    const x = hints();
    if (x) { x.tut[L.id] = i; o.save(); }
    show(s);
  }

  function rectOf(s, at) {
    if (!at) return null;
    let els = typeof at === 'function' ? at(s) : s.qa(at).slice(0, 1);
    if (!els) return null;
    if (!Array.isArray(els)) els = [els];
    els = els.filter((e) => e && e.isConnected && e.getClientRects().length);
    if (!els.length) return null;
    const a = app.getBoundingClientRect();
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const e of els) {
      const q = e.getBoundingClientRect();
      l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
    }
    const pad = 4;
    const parts = els.length > 1 ? els.map((e) => { const q = e.getBoundingClientRect(); return { left: q.left - a.left - 2, top: q.top - a.top - 2, width: q.width + 4, height: q.height + 4 }; }) : [];
    return { parts, left: Math.max(0, l - a.left - pad), top: Math.max(0, t - a.top - pad), width: Math.min(a.width, r - l + pad * 2), height: Math.min(a.height, b - t + pad * 2), appH: a.height };
  }

  function show(s) {
    const st = stepOf();
    if (!st) return hide();
    const msg = typeof st.text === 'function' ? st.text(s) : st.text;
    text.replaceChildren(...String(msg).split('\n').map((line) => h('p', { text: line })));
    const n = active.L.steps.length;
    count.textContent = n > 1 ? `${active.i + 1}/${n}` : '';
    nextBtn.style.display = st.do ? 'none' : '';
    nextBtn.textContent = active.i === n - 1 ? 'わかった' : '次へ';
    layer.classList.add('on');
    layer.classList.toggle('block', !st.do);
    layer.classList.toggle('doing', !!st.do);
    place(s);
  }

  function place(s) {
    const st = stepOf();
    if (!st) return;
    const r = rectOf(s, st.at);
    const rk = JSON.stringify((r?.parts ?? []).map((p) => [Math.round(p.left), Math.round(p.top)]));
    if (rk !== rings.dataset.k) rings.dataset.k = rk, rings.replaceChildren(...(r?.parts ?? []).map((p) => h('div.cring', { style: { left: `${p.left}px`, top: `${p.top}px`, width: `${p.width}px`, height: `${p.height}px` } })));
    if (r) {
      spot.style.display = '';
      Object.assign(spot.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      layer.classList.remove('nospot');
      // 照らす場所の反対側に吹き出し
      const mid = r.top + r.height / 2;
      const low = mid < r.appH * 0.5;
      bub.classList.toggle('low', low);
      bub.classList.toggle('high', !low);
    } else {
      spot.style.display = 'none';
      layer.classList.add('nospot');
      bub.classList.remove('high');
      bub.classList.add('low', 'mid');
      return;
    }
    bub.classList.remove('mid');
  }

  function pickLesson(s) {
    const x = hints();
    for (const L of LESSONS) {
      const p = x.tut[L.id];
      if (p === true) continue;
      if (L.need && !L.need.every((id) => x.tut[id] === true)) continue;
      if (!L.when(s)) continue;
      let i = typeof p === 'number' ? Math.min(p, L.steps.length - 1) : 0;
      while (i < L.steps.length && L.steps[i].if && !L.steps[i].if(s)) i++;
      if (i >= L.steps.length) { finish(L); continue; }
      return { L, i, memo: L.steps[i].begin?.(s) ?? null };
    }
    return null;
  }

  function tick() {
    if (!on()) { active = null; return hide(); }
    if (busy()) return hide();
    const s = snapshot();
    if (active) {
      const st = stepOf();
      if (st.do && st.do(s, active.memo)) { advance(); return; }
      const stay = active.L.stay ?? active.L.when;
      if (!stay(s)) {
        // 画面が変わった：その段から次に再開。やってみる段の途中で離れたら、その段は済んだことにする
        if (st.do) { active.i = Math.min(active.i, active.L.steps.length - 1); }
        active = null;
        hide();
      } else if (s.sheet && !st.inSheet) { hide(); return; }
      else { if (!layer.classList.contains('on')) show(s); else place(s); return; }
    }
    if (s.sheet) return hide();
    const next = pickLesson(s);
    if (!next) return hide();
    active = next;
    const x = hints();
    x.tut[next.L.id] = next.i;
    show(s);
  }

  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); advance(); });
  catcher.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); });
  quitBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const x = hints();
    if (x) { x.coach = false; o.save(); }
    active = null;
    hide();
    o.onQuit?.();
  });
  // 吹き出しの中の押下は画面に通さない
  bub.addEventListener('pointerdown', (e) => e.stopPropagation());

  setInterval(tick, TICK_MS);
  window.addEventListener('resize', () => { if (active) place(snapshot()); });

  return {
    tick,
    on,
    /** 案内を最初から（止めていたら再開） */
    reset() { const x = hints(); if (!x) return; x.tut = {}; x.coach = true; active = null; o.save(); hide(); },
    setOn(v) { const x = hints(); if (!x) return; x.coach = !!v; if (!v) { active = null; hide(); } o.save(); },
    /** 少しの間だけ隠す（画面の切り替え直後など） */
    pause(ms = 300) { hiddenFor = Date.now() + ms; hide(); },
  };
}

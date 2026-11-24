// battle.js — 盤面の描画と入力、HUD、ドック、計算演出、画面効果、アンプル、デバッグ
// 戦闘のルールは engine/combat.js。ここは表示と入力だけを受け持つ。
import { fmt, clamp } from '../util.js';
import { Combat } from '../engine/combat.js';
import { key } from '../engine/board.js';
import { applyTutorialStep, tutorialDone } from '../engine/progress.js';
import { gfx, desaturate, debugPanel } from './screens.js';

const SQ3 = Math.sqrt(3);
const fmtN = x => { const n = Number(x); return Number.isInteger(n) ? fmt(n) : (Math.abs(n) >= 1e6 ? fmt(n) : String(+n.toFixed(2))); };

// opts: { combat（作成済みの戦闘）| mode, floor, enemy, mutagens, ampoules, settings, audio, seed, optic,
//         tutorial: { tut, onDone() }, onSave(cb), onTurn(cb, ev), onEnd(result),
//         debug（デバッグパネルを出す）, saturation（0〜1。深いほど下げる）, pollution（汚染段階の表示用ラベル） }
export function createBattle(root, reg, rng, opts = {}) {
  const R = reg.rules, A = opts.audio, settings = opts.settings || {};
  const nodes = Object.fromEntries(reg.all('nodes').map(n => [n.id, n]));
  const cmpDefs = reg.all('nodes').filter(n => n.kind === 'cmp').sort((a, b) => a.tier - b.tier);
  const pulseDef = reg.all('nodes').find(n => n.kind === 'overlay');
  const specialDefs = reg.all('nodes').filter(n => n.kind === 'special');
  const strains = Object.fromEntries(reg.all('strains').map(s => [s.id, s]));
  const rarities = Object.fromEntries(reg.all('rarities').map(s => [s.id, s]));
  const noise = reg.all('story').filter(s => s.type === 'noise').map(s => s.text);

  const cb = opts.combat ?? new Combat(reg, rng, { mode: opts.mode, floor: opts.floor, enemy: opts.enemy, mutagens: opts.mutagens, ampoules: opts.ampoules });
  const optic = opts.optic ?? 1;
  const board = cb.board, E = cb.enemy, edef = E.def;
  const T = cb.isBoss ? { ...R.theme, ...R.themeBoss } : R.theme;

  const wrap = document.createElement('div');
  wrap.className = 'battle' + (cb.isBoss ? ' boss' : '');
    wrap.innerHTML = `
  <div class="bt">
    <header class="hud">
      <span class="h-sync">SYNC <span class="sbar"><i></i><em></em></span><b></b></span><span class="h-my">外殻 <b></b></span>
      <span class="h-bf">逆流 <b></b></span><span class="h-stage"></span>
    </header>
    <section class="enemy">
      <div class="bf"><div class="bf-noise"></div></div>
      <div class="en-top"><div class="en-sil"></div>
        <div class="en-info"><div class="en-name"></div><div class="en-hp"><u></u><i></i><span></span></div><div class="en-intent"></div></div></div>
      <div class="formula"><span class="f-main"></span><span class="f-memo"></span><button class="help">?</button></div>
      <div class="timer"><i></i><span></span></div>
    </section>
    <div class="tutbar"><b></b><span></span><button>スキップ</button></div>
    <section class="board"><canvas class="bgc"></canvas><canvas class="fg"></canvas><i class="scan"></i><div class="evalbox"><div class="ev-lines"></div><div class="ev-total"></div></div><div class="hint"></div>
<div class="hitnum"></div><div class="tapnext">▼ タップで次へ</div></section>
    <footer class="dock"><div class="spinebar"></div><div class="muts"></div><div class="amps"></div><div class="chipbox"></div><button class="act"></button></footer>
  </div>
  <div class="tip"></div>
  <div class="tutcard"><div class="tc-in"><small></small><em></em><h3></h3><p></p><button>OK</button></div></div>
  <div class="helpbox"><div class="hb-in">${R.help?.html ?? ''}
    <button class="hb-x">閉じる</button></div></div>
  ${opts.debug ? '<button class="dbg-toggle">DBG</button><div class="dbg"></div>' : ''}`;
  root.appendChild(wrap);
  const $ = s => wrap.querySelector(s);
  const el = {
    bt: $('.bt'), sync: $('.h-sync b'), my: $('.h-my b'), bfHud: $('.h-bf'), bfTxt: $('.h-bf b'), stage: $('.h-stage'),
    enemy: $('.enemy'), bf: $('.bf'), bfNoise: $('.bf-noise'), sil: $('.en-sil'), name: $('.en-name'),
    hpBar: $('.en-hp i'), hpTrail: $('.en-hp u'), hpTxt: $('.en-hp span'), sbar: $('.sbar i'), sbarMy: $('.sbar em'),
    hitnum: $('.hitnum'), helpbox: $('.helpbox'), helpBtn: $('.help'), tapnext: $('.tapnext'), intent: $('.en-intent'), fMain: $('.f-main'), fMemo: $('.f-memo'),
    timer: $('.timer'), timeBar: $('.timer i'), timeTxt: $('.timer span'),
    boardBox: $('.board'), canvas: $('canvas.fg'), bgc: $('canvas.bgc'), evalbox: $('.evalbox'), evLines: $('.ev-lines'), evTotal: $('.ev-total'), hint: $('.hint'),
    muts: $('.muts'), spinebar: $('.spinebar'), tutbar: $('.tutbar'), tutcard: $('.tutcard'), amps: $('.amps'), chipbox: $('.chipbox'), act: $('.act'), tip: $('.tip'), dbgBtn: $('.dbg-toggle'), dbg: $('.dbg'),
  };
  const ctx = el.canvas.getContext('2d');
  // 深淵の退色：盤面は色そのものを薄め、敵の姿だけ小さなフィルタをかける（全体フィルタは重い）
  if (opts.saturation != null && opts.saturation < 1) el.sil.style.filter = `saturate(${opts.saturation.toFixed(2)})`;
  el.helpBtn.addEventListener('click', () => el.helpbox.classList.add('show'));
  el.helpbox.addEventListener('click', e => { if (e.target === el.helpbox || e.target.classList.contains('hb-x')) el.helpbox.classList.remove('show'); });
  const st = {
    path: null, reach: null, ptr: null, lockUntil: 0, anim: null, fx: [], L: null, last: 0, raf: 0, dead: false,
    evalAnim: null, busy: false, pick: null, lit: new Set(), preview: null, shake: null, hitstopUntil: 0, removed: 0,
    suggest: null, tutStep: -1, tutLog: null, texts: [], sparks: [],
  };
  const cache = { key: '', spr: new Map() };   // 描画キャッシュ（描画の節を参照）
  const T_ = opts.tutorial;   // チュートリアル
  const vertSources = cb.extra.filter(x => x.kind === 'vertebra');

  // ---- レイアウト（仕様書 12：s = min((W-16)/8, H/13.0)） ----
  function layout() {
    const r = el.boardBox.getBoundingClientRect();
    const dpr = st.dpr = Math.min(2, window.devicePixelRatio || 1);   // 高DPRでの全面描画が重いため2倍まで
    cache.key = ''; for (const v of cache.spr.values()) v.cv.close?.(); cache.spr.clear();
    el.canvas.width = Math.round(r.width * dpr); el.canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = Math.max(4, Math.min((r.width - 16) / 8, r.height / 13.0)), h = SQ3 * s;
    st.L = { W: r.width, H: r.height, s, h, ox: (r.width - 8 * s) / 2, oy: (r.height - 7.5 * h) / 2 };
  }
  const cx = c => st.L.ox + st.L.s + 1.5 * st.L.s * c;
  const cy = (c, rr) => st.L.oy + st.L.h / 2 + st.L.h * rr + (c % 2 ? st.L.h / 2 : 0);
  const ro = new ResizeObserver(layout); ro.observe(el.boardBox); layout();

  // ---- 盤面の入力 ----
  function hit(x, y, cands) {
    let best = null, bd = Infinity;
    const list = cands || [...board.cells()].map(({ c, r }) => [c, r]);
    for (const [c, r] of list) { const d = Math.hypot(x - cx(c), y - cy(c, r)); if (d < bd) { bd = d; best = { c, r }; } }
    return best && bd < st.L.s * (cands ? 0.9 : 0.95) ? best : null;   // マグネット吸着
  }
  const ptPos = e => { const r = el.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  el.canvas.addEventListener('contextmenu', e => e.preventDefault());
  el.boardBox.addEventListener('pointerdown', e => { if (st.evalAnim && !st.evalAnim.done) { e.preventDefault(); finishEval(); } });
  // タップ待ち：計算結果や被ダメージは、タップするまで次へ進まない
  function waitTap(fn, delay = 300) { st.wait = fn; st.waitFrom = performance.now() + delay; el.tapnext.classList.add('show'); }
  wrap.addEventListener('pointerdown', e => {
    if (!st.wait || el.helpbox.classList.contains('show')) return;
    e.preventDefault(); e.stopPropagation();
    if (performance.now() < st.waitFrom) return;
    const fn = st.wait; st.wait = null; el.tapnext.classList.remove('show'); el.hitnum.classList.remove('show');
    A?.tick(); fn();
  }, true);
  el.canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    A?.unlock();
    if (st.evalAnim || st.busy) return;
    const p = ptPos(e), h = hit(p.x, p.y);
    if (st.pick) { if (h) pickTarget(h); return; }
    if (st.path || (cb.phase !== 'think' && cb.phase !== 'fire')) return;
    if (performance.now() < st.lockUntil) return;               // 落下中は触れない
    if (!h || !board.chainable(h.c, h.r)) return;
    if (st.tutCard) return;
    if (tutOn() && cb.phase === 'think' && curStep().crit && !cb.reserved) { tutNudge('先に右下の［脊髄臨界］を押せ'); return; }
    if (tutLocked() && !st.tutIds.has(board.at(h.c, h.r).id)) { tutNudge('光っているノードからなぞる'); return; }
    try { el.canvas.setPointerCapture(e.pointerId); } catch {}
    if (cb.phase === 'think') startFire();
    st.ptr = e.pointerId; st.path = [h]; st.reach = board.reachable(st.path);
    st.finger = { x: cx(h.c), y: cy(h.c, h.r) }; st.tail = { ...st.finger }; st.grow = null;
    A?.trace(0); traceFilter(); updatePreview();
  });
  el.canvas.addEventListener('pointermove', e => {
    if (!st.path || e.pointerId !== st.ptr) return;
    const p = ptPos(e), path = st.path, last = path[path.length - 1];
    st.finger = p;
    const h = hit(p.x, p.y, board.nb(last.c, last.r)); if (!h) return;
    const act = board.canExtend(path, h.c, h.r);
    if (act === 'add' && tutLocked() && !st.tutIds.has(board.at(h.c, h.r).id)) return;   // 練習中は光るノードだけ
    if (act === 'add') { path.push(h); st.grow = { t0: performance.now() }; } else if (act === 'back') { path.pop(); st.grow = null; } else return;
    st.reach = board.reachable(path);
    A?.trace(path.length - 1); traceFilter(); updatePreview();
  });
  // なぞるほど BGM のフィルターが開いていく（そのターンに消した数＋なぞっている数）
  // なぞっている間はハイパスで低音も抜いていき、指を離すと一気に戻す（drop）
  function traceFilter() {
    A?.setOpen((st.removed + (st.path?.length ?? 0) * 1.6) / (R.audio?.lpFullNodes ?? 30));
    A?.setTension((st.path?.length ?? 0) / (R.audio?.hpFullNodes ?? 10));
  }
  const up = e => { if (st.path && e.pointerId === st.ptr) { commitPath(); if (st.timeUp) { st.timeUp = false; endFire(); } } };
  el.canvas.addEventListener('pointerup', up);
  el.canvas.addEventListener('pointercancel', up);
  el.act.addEventListener('click', () => {
    A?.unlock();
    if (cb.phase === 'fire' && !st.evalAnim) endFire();
    else if (cb.phase === 'think' && !st.busy && cb.canCrit) { cb.toggleReserve(); renderAll(); }
  });

  // ---- 神経発火 ----
  function startFire() {
    cb.beginFire();
    opts.onSave?.(cb);
    if (st.tutLog) st.tutLog.crit = cb.crit;
    st.removed = 0; A?.setOpen(0);
    if (cb.crit) { A?.crit(); A?.setHalf(true); juice('mid'); }
    renderAll();
  }
  function positions() { const m = new Map(); for (const { c, r, cell } of board.cells()) m.set(cell.id, { c, r }); return m; }
  function animateFrom(old) {
    const from = new Map();
    for (let c = 0; c < board.cols; c++) {
      let fresh = 0; for (let r = 0; r < board.rows; r++) if (!old.has(board.at(c, r).id)) fresh++;
      for (let r = 0; r < board.rows; r++) {
        const x = board.at(c, r), o = old.get(x.id);
        if (!o) from.set(x.id, r - fresh); else if (o.c === c) from.set(x.id, o.r);
      }
    }
    const dur = cb.fallTime() * 1000;
    st.anim = { t0: performance.now(), dur, from };
    st.lockUntil = performance.now() + dur;
  }
  function commitPath() {
    const path = st.path; st.path = null; st.reach = null; st.ptr = null;
    if (!path || path.length < board.minChain || cb.phase !== 'fire') { traceFilter(); updatePreview(); return; }
    const old = positions();
    const res = cb.commit(path);
    if (!res) { updatePreview(); return; }
    const ch = res.chain;
    if (st.tutLog) { const l = st.tutLog; l.chains.push(ch); l.merges += res.merges.length; l.pulses += res.pulses; l.weakpoint ||= res.weakpoint; }
    if (res.wreck) popup('残骸を回収', 'big');
    for (const x of [...ch.cells, ...ch.blasted]) burst(x.c, x.r, colorOf(x.color), 1);
    chainLabel(ch, path[path.length - 1]);
    for (const m of res.merges) burst(m.c, m.r, colorOf(m.color), 1.8);
    animateFrom(old);
    A?.chain(ch.cells.length); A?.drop();
    if (res.weakpoint) A?.weak();
    if (res.reflect) A?.reflect();
    st.removed += ch.cells.length + ch.blasted.length;
    A?.setOpen(st.removed / (R.audio?.lpFullNodes ?? 30));
    const J = R.juice;
    if (ch.cells.length >= J.midChain || ch.blasted.length) juice('mid');
    else if (ch.cells.length >= J.smallChain || res.weakpoint) juice('small');
    updatePreview(); renderAll();
    tutorialCheckGoal();
  }
  function endFire() {
    if (cb.phase !== 'fire') return;
    if (st.path) commitPath();
    st.hpShown = E.hp;                       // 計算演出が終わるまで HP バーは減らさない
    const res = cb.endFire(); if (!res) return;
    opts.onTurn?.(cb, res.ev);
    tutorialAfterFire();
    st.lit.clear(); A?.setHalf(false);
    st.evalAnim = { ev: res.ev, won: res.won, i: 0, next: performance.now(), done: false };
    el.evLines.innerHTML = '<div class="ev-head">ダメージ ＝ <span class="c-m">基礎値</span> × <span class="c-v">倍率</span> × ボーナス</div>'; el.evTotal.textContent = '';
    el.evalbox.classList.add('show');
    renderAll();
  }

  // 連結ごとに、何がどれだけ増えたかを盤面に浮かべる（白＝基礎値、緑＝倍率、紫＝外殻）
  function chainLabel(ch, at) {
    const one = cb.evaluate([ch]), stp = one.steps.find(x => x.kind === 'chain');
    const lines = [];
    if (stp) lines.push([`基礎 +${fmt(stp.add)}`, colorOf('MARROW')]);
    if (stp?.multAdd) lines.push([`倍率 +${fmtN(stp.multAdd)}`, colorOf('VENOM')]);
    if (one.myelin > 0) lines.push([`外殻 +${fmtN(one.myelin)}`, colorOf('SYNAPSE')]);
    const t0 = performance.now();
    lines.forEach(([text, color], i) => st.texts.push({ c: at.c, r: at.r, text, color, t0: t0 + i * 90, dy: i }));
  }

  // ---- 計算演出（EvalStep を1つずつ積む。タップで早送り） ----
  function stepText(s) {
    switch (s.kind) {
      case 'chain': return [`${nodes[s.color]?.name ?? '?'}×${s.len}${s.blasted ? '+' + s.blasted : ''}${s.long > 1 ? '（長連結×' + s.long + '）' : ''}`,
        `基礎 +${fmt(s.add)}${s.multAdd ? '　倍率 +' + fmtN(s.multAdd) : ''}`];
      case 'burn': return [`焼灼×${s.len}`, `+${fmt(s.add)}`];
      case 'src': return [s.name, { addBase: '+', addMult: '倍率+', mulMult: '×', baseMul: '基礎×', retrigger: '再発動 +', metaMul: '×' }[s.op] + fmtN(s.v)];
      case 'chainBonus': return [`連結ボーナス（${s.n}回）`, `×${fmtN(s.k)}`];
      case 'armor': return ['外殻装甲（白骨なし）', `×${fmtN(s.k)}`];
      case 'reflect': return ['時限ウイルス反射', `×${fmtN(s.k)}`];
      case 'crit': return ['脊髄臨界', `×${fmtN(s.k)}`];
      case 'echo': return ['臨界残響', `×${fmtN(s.k)}`];
      default: return [s.kind, ''];
    }
  }
  const formulaOf = s => `<span class="c-m">${fmt(s.base)}</span> × <span class="c-v">${fmtN(s.mult.toNumber())}</span>${s.factor.eq(1) ? '' : ' × ' + fmtN(s.factor.toNumber())}`;
  function showStep(i) {
    const s = st.evalAnim.ev.steps[i]; const [a, b] = stepText(s);
    const d = document.createElement('div'); d.className = 'ev-line ' + s.kind;
    d.innerHTML = `<span></span><b></b>`; d.firstChild.textContent = a; d.lastChild.textContent = b;
    if (s.kind === 'chain') d.style.color = colorOf(s.color);
    el.evLines.appendChild(d);
    while (el.evLines.children.length > 7) el.evLines.children[1].remove();
    el.evTotal.innerHTML = `${formulaOf(s)} = ${fmt(s.total)}`;
    A?.step(i);
  }
  function finishEval() {
    const ea = st.evalAnim; if (!ea || ea.done) return;
    while (ea.i < ea.ev.steps.length) showStep(ea.i++);
    ea.done = true;
    const ev = ea.ev;
    el.evTotal.innerHTML = `<small>${ev.steps.length ? formulaOf(ev.steps[ev.steps.length - 1]) + ' =' : ''}</small><b>${fmt(ev.total)}<em>ダメージ</em></b>`;
    el.evTotal.classList.add('final');
    st.hpShown = null;
    A?.final();
    popup(ev.total.isZero() ? 'MISS' : '−' + fmt(ev.total), 'dmg' + (ev.kill ? ' big' : ''));
    if (!ev.total.isZero()) flash('enemy-hit', 300);
    if (ev.kill || ev.best) juice('big');
    renderAll();
    waitTap(afterEval, 350);
  }
  function afterEval() {
    if (st.dead) return;
    const ea = st.evalAnim; st.evalAnim = null;
    el.evalbox.classList.remove('show'); el.evTotal.classList.remove('final');
    if (ea.won) { A?.win(); popup(edef.passive ? 'DECRYPTED' : edef.boss ? 'CORE DOWN' : 'DOWN', 'big'); setTimeout(() => end({ won: true }), 900); return; }
    st.busy = true;
    const old = positions();
    const events = cb.enemyPhase();
    animateFrom(old);
    playEvents(events, 0);
  }
  function playEvents(events, i) {
    if (st.dead) return;
    if (i >= events.length) {
      st.busy = false;
      const lost = events.find(e => e.type === 'lost');
      if (lost) { A?.lose(); juice('big'); setTimeout(() => end({ won: false, cause: lost.cause }), 900); }
      else if (cb.phase === 'closed') { popup('金庫 閉鎖', 'big'); setTimeout(() => end({ won: false, closed: true }), 900); }
      else { tutorialTurnStart(); opts.onSave?.(cb); A?.setOpen(0); updatePreview(); }
      renderAll(); return;
    }
    const e = events[i]; let wait = 120;
    if (e.type === 'attack') { popup(edef.lines?.attack ?? '攻撃', 'hurt'); hitNumber(e); A?.hit(); juice('mid'); wait = 900; }
    else if (e.type === 'virus') { burst(e.c, e.r, T.alert, 2.2); popup('ウイルス破裂', 'hurt'); hitNumber(e); A?.hit(); juice('small'); wait = 800; }
    else if (e.type === 'stun') { popup(edef.lines?.stun ?? 'STUNNED', ''); A?.weak(); wait = 520; }
    else if (e.type === 'place') { burst(e.c, e.r, T.alert, 1.3); wait = 90; }
    else if (e.type === 'telegraph') { A?.alarm(); wait = 150; }
    else if (e.type === 'shuffle') { popup('盤面 再配列', ''); juice('mid'); wait = 500; }
    else if (e.type === 'lastStand') { popup('踏みとどまった', 'big'); juice('big'); wait = 600; }
    renderAll();
    // 被ダメージ・攻撃キャンセルなど、読んでほしい出来事はタップで次へ
    const important = ['attack', 'virus', 'stun', 'lastStand', 'shuffle'].includes(e.type);
    if (important) setTimeout(() => waitTap(() => playEvents(events, i + 1), 200), 250);
    else setTimeout(() => playEvents(events, i + 1), wait);
  }
  function end(result) {
    if (st.dead) return;
    opts.onEnd?.({ ...result, mode: cb.mode, floor: cb.floor, enemy: edef, turns: cb.turn, best: cb.bestDamage, maxChain: cb.maxChain, combat: cb });
  }

  // ---- アンプル ----
  const PICK_HINT = { row: '焼き消す横1列のノードをタップ', color: '集める色のノードをタップ', from: '変える色のノードをタップ', to: '変えた後の色のノードをタップ' };
  function useAmp(i) {
    if (cb.phase !== 'think' || st.busy || st.evalAnim) return;
    if (st.pick?.i === i) { st.pick = null; renderAll(); return; }
    const def = reg.get('ampoules', cb.ampoules[i]); if (!def) return;
    if (def.target === 'none') return applyAmp(i, {});
    st.pick = { i, def, stage: def.target === 'color2' ? 'from' : def.target };
    renderAll();
  }
  function pickTarget(h) {
    const p = st.pick, cell = board.at(h.c, h.r);
    if (p.stage === 'row') return applyAmp(p.i, { row: h.r });
    if (!cell?.color) return;
    if (p.stage === 'color') return applyAmp(p.i, { color: cell.color });
    if (p.stage === 'from') { p.from = cell.color; p.stage = 'to'; renderAll(); return; }
    if (p.stage === 'to') { if (cell.color === p.from) return; applyAmp(p.i, { from: p.from, to: cell.color }); }
  }
  function applyAmp(i, t) {
    const old = positions();
    const res = cb.useAmpoule(i, t);
    st.pick = null;
    if (!res.ok) { popup(res.reason === 'rewind' ? '巻き戻せる前のターンがない' : '使用できない', ''); renderAll(); return; }
    A?.ampoule();
    if (res.burn) { for (const x of res.burn.cells) burst(x.c, x.r, T.alert, 1.2); animateFrom(old); juice('small'); }
    else for (const { c, r } of board.cells()) if (!old.has(board.at(c, r).id) || old.get(board.at(c, r).id).c !== c) burst(c, r, T.pulse, 0.8);
    popup(res.def.name, '');
    updatePreview(); renderAll();
  }

  // ---- 画面効果（13.1） ----
  function juice(level) {
    const J = R.juice, soft = settings.reduceFlash;
    const px = (level === 'big' ? J.big : level === 'mid' ? J.mid : J.small) * (soft ? 0.5 : 1);
    st.shake = { px, until: performance.now() + (level === 'big' ? 380 : 240) };
    if (level === 'big') {
      st.hitstopUntil = performance.now() + J.hitstop;
      if (!soft) st.glitch = { t0: performance.now(), seed: (performance.now() | 0) % 7 };
    }
  }
  function flash(cls, ms = 220) { el.bt.classList.add(cls); setTimeout(() => el.bt.classList.remove(cls), ms); }
  // 被ダメージ：盤面の上に大きく出す。外殻で防いだ分も見せる
  function hitNumber(e) {
    el.hitnum.innerHTML = (e.rest > 0 ? `<b>SYNC −${e.rest}%</b>` : '<b class="guard">防御成功</b>') + (e.absorbed ? `<small>外殻で ${fmtN(e.absorbed)} 防いだ</small>` : '');
    el.hitnum.classList.remove('show'); void el.hitnum.offsetWidth; el.hitnum.classList.add('show');
    if (e.rest > 0) flash('hurt', 600);
  }
  function popup(text, cls) {
    const d = document.createElement('div'); d.className = 'pop ' + (cls || ''); d.textContent = text;
    d.style.top = (18 + (el.enemy.querySelectorAll('.pop').length % 3) * 22) + 'px';
    el.enemy.appendChild(d); setTimeout(() => d.remove(), 1000);
  }

  // ---- 表示（DOM） ----
  function updatePreview() {
    st.preview = (cb.phase === 'fire' || cb.chains.length) ? cb.preview(st.path) : null;
    const now = st.preview?.active ?? new Set();
    for (const id of now) if (!st.lit.has(id)) A?.tick();
    st.lit = cb.phase === 'fire' ? now : new Set();
    st.suggest = optic >= 2 && st.path ? suggestRoute(st.path) : null;
    renderFormula(); renderDock();
  }
  function renderFormula() {
    const memo = [];
    const cur = st.preview?.current;
    if (cur) {
      if (cur.specials.some(s => nodes[s.id]?.look === 'bracket')) memo.push('露出神経 破壊予定');
      if (cur.specials.some(s => nodes[s.id]?.reflect && s.count > 0)) memo.push('反射×2 予定');
      const pulses = cur.cells.filter(n => n.pulse).length;
      if (pulses) memo.push(`脈動 +${fmtN(pulses * cb.pulseTime())}s`);
      let lb = 1; for (const [len, mul] of R.combat.longBonus) if (cur.cells.length >= len) lb = mul;
      if (lb > 1) memo.push(`長連結×${lb}`);
    }
    if (cb.crit) memo.push(`臨界×${R.spineBreak.mul}`);
    else if (cb.reserved) memo.push('脊髄臨界 予約中');
    if (E.stunned) memo.push('攻撃キャンセル済');
    el.fMemo.textContent = memo.map(m => `[${m}]`).join('');
    if (st.evalAnim) return;
    if (st.preview && (cb.chains.length || cur)) {
      const p = st.preview;
      el.fMain.innerHTML = `基礎 <span class="c-m">${fmt(p.base)}</span> × 倍率 <span class="c-v">${fmtN(p.mult.toNumber())}</span>${p.factor.eq(1) ? '' : ' × ' + fmtN(p.factor.toNumber())} = <b>${fmt(p.total)}</b>`;
    } else el.fMain.innerHTML = cb.phase === 'think'
      ? '<span class="c-m">◆白骨=基礎値</span>　<span class="c-v">●神経毒=倍率</span>　<span class="c-s">⚡シナプス=外殻</span>' : '';
  }
  function renderHud() {
    el.sync.textContent = cb.sync + '%';
    el.sbar.style.width = clamp(cb.sync / cb.syncMax * 100, 0, 100) + '%';
    el.sbarMy.style.width = clamp(cb.myelin / cb.syncMax * 100, 0, 100) + '%';
    el.sync.parentElement.classList.toggle('low', cb.sync <= 30);
    el.my.textContent = fmtN(cb.myelin);
    el.bfHud.style.display = cb.backflowOn ? '' : 'none';
    el.bfTxt.textContent = Math.round(cb.backflow) + '%';
    el.stage.textContent = `${cb.mode.name} ${cb.floor}F${cb.isBoss ? ' ★' : ''}${opts.pollution?.length ? ' 汚' + opts.pollution.length : ''}`;
    el.name.textContent = edef.name;
    const hp = st.hpShown ?? E.hp;
    const ratio = clamp(hp.div(E.hpMax).toNumber(), 0, 1);
    el.hpBar.style.width = (ratio * 100).toFixed(1) + '%';
    el.hpTrail.style.width = (ratio * 100).toFixed(1) + '%';
    el.hpTxt.textContent = `${fmt(hp)} / ${fmt(E.hpMax)}`;
    el.sil.className = `en-sil shape-${edef.look?.shape ?? 'eye'}${E.stunned ? ' stunned' : ''}`;
    el.sil.style.setProperty('--ec', edef.look?.color ?? T.alert);
    el.intent.classList.toggle('stun', E.stunned);
    el.intent.classList.toggle('imminent', !cb.passive && !E.stunned && E.timer <= 1);
    el.intent.textContent = cb.passive ? `${edef.lines?.tele ?? '閉鎖まで'} 残り${Math.max(0, cb.turnLimit - cb.turn + 1)}ターン`
      : E.stunned ? `STUNNED — 次の攻撃はキャンセル`
      : E.timer <= 1 ? `⚠ このターンの後に攻撃 SYNC −${edef.atk}%` : `あと${E.timer}ターンで攻撃 SYNC −${edef.atk}%`;
    // 逆流汚染：敵エリアの上から垂れ下がり、100% で盤面の上端に達する
    el.bf.style.display = cb.backflowOn ? '' : 'none';
    el.bf.style.height = clamp(cb.backflow, 0, 100) + '%';
    el.bfNoise.textContent = cb.backflow >= 50 && noise.length ? [0, 3].map(k => noise[(cb.turn + k) % noise.length]).join('　') : '';
  }
  function slotTip(node, title, sub, desc) {
    let t = null, shown = false;
    node.addEventListener('pointerdown', () => { shown = false; t = setTimeout(() => { shown = true; showTip(title, sub, desc); }, 420); });
    const clear = () => { clearTimeout(t); if (shown) setTimeout(() => el.tip.classList.remove('show'), 1400); };
    node.addEventListener('pointerup', clear); node.addEventListener('pointerleave', clear); node.addEventListener('pointercancel', clear);
    return () => shown;
  }
  function showTip(title, sub, desc) {
    el.tip.innerHTML = '<b></b><small></small><p></p>';
    el.tip.children[0].textContent = title; el.tip.children[1].textContent = sub; el.tip.children[2].textContent = desc;
    el.tip.classList.add('show');
  }
  function renderDock() {
    // 装着中の椎骨義体（点）。条件を満たすと光る
    el.spinebar.innerHTML = '';
    for (const v of vertSources) { const d = document.createElement('i'); if (st.lit.has(v.id)) d.className = 'lit'; el.spinebar.appendChild(d); }
    // 変異因子
    el.muts.innerHTML = '';
    for (let i = 0; i < R.combat.mutagenSlots; i++) {
      const m = cb.mutagens[i], d = document.createElement('div');
      d.className = 'slot mut' + (m ? '' : ' empty') + (m && st.lit.has(m.id) ? ' lit' : '');
      if (m) {
        d.style.setProperty('--rc', rarities[m.rarity]?.color ?? '#888');
        d.innerHTML = '<i></i><span></span>';
        d.firstChild.textContent = strains[m.strain]?.icon ?? '';
        d.lastChild.textContent = m.label ?? m.name;
        slotTip(d, m.name, `${rarities[m.rarity]?.name ?? ''} / ${strains[m.strain]?.name ?? ''}`, m.desc ?? '');
      }
      el.muts.appendChild(d);
    }
    // アンプル（思考中） / 連結の一覧（発火中）
    const firing = cb.phase === 'fire' || !!st.evalAnim;
    el.amps.style.display = firing ? 'none' : '';
    el.chipbox.style.display = firing ? '' : 'none';
    if (firing) {
      const last = cb.chains.filter(c => !c.burn).at(-1);
      el.chipbox.innerHTML = `<small>連結 ${cb.chains.filter(c => !c.burn).length}</small><span></span>`;
      if (last) { const s = el.chipbox.lastChild; s.textContent = `${nodes[last.color]?.name}×${last.cells.length}`; s.style.color = colorOf(last.color); }
    } else {
      el.amps.innerHTML = '';
      cb.ampoules.forEach((id, i) => {
        const a = reg.get('ampoules', id), d = document.createElement('div');
        d.className = 'slot amp' + (a ? '' : ' empty') + (st.pick?.i === i ? ' picking' : '');
        if (a) {
          d.textContent = a.label ?? a.name;
          const tipShown = slotTip(d, a.name, '神経アンプル', a.desc ?? '');
          d.addEventListener('click', () => { if (!tipShown()) { A?.unlock(); useAmp(i); } });
        }
        el.amps.appendChild(d);
      });
    }
    // 臨界 / 停止
    const a = el.act;
    a.className = 'act';
    if (cb.phase === 'fire' && !st.evalAnim) { a.textContent = '発火停止'; a.disabled = false; }
    else if (cb.phase === 'think' && !st.busy) {
      a.disabled = !cb.canCrit; a.textContent = cb.reserved ? '臨界 予約' : cb.canCrit ? '脊髄臨界' : `臨界 ${Math.floor(cb.gauge)}%`;
      if (cb.canCrit) a.classList.add(cb.reserved ? 'reserved' : 'ready');
      if (T_ && st.tutStep >= 0 && T_.tut.steps[st.tutStep].crit && !cb.reserved) a.classList.add('tut-target');
    } else { a.disabled = true; a.textContent = '—'; }
  }
  function renderTimer() {
    const t = Math.max(0, cb.time), full = cb.fireTime();
    // 変わったときだけDOMに書く（毎フレームの書き換えは再レイアウトを招いて重い）
    const w = clamp(t / full, 0, 1).toFixed(3);
    if (w !== st.tW) { st.tW = w; el.timeBar.style.transform = `scaleX(${w})`; }
    const txt = cb.timeHold ? '時間停止中' : (cb.freeze > 0 ? `❄${cb.freeze.toFixed(1)} ` : '') + (cb.phase === 'fire' && st.path ? (st.timeUp ? '指を離すと確定 ' : 'SLOW ') : '') + t.toFixed(1) + 's';
    if (txt !== st.tT) { st.tT = txt; el.timeTxt.textContent = txt; }
    el.timer.classList.toggle('low', cb.phase === 'fire' && t <= 1);
    el.timer.classList.toggle('frozen', cb.phase === 'fire' && cb.freeze > 0);
    el.timer.classList.toggle('slow', cb.phase === 'fire' && !!st.path);
    el.boardBox.classList.toggle('slowmo', cb.phase === 'fire' && !!st.path);
  }
  function renderHint() {
    const p = st.pick;
    el.hint.textContent = p ? `${p.def.name}：${PICK_HINT[p.stage]}（スロットを再タップで取消）` : '';
    el.hint.classList.toggle('show', !!p);
  }
  function renderAll() { renderHud(); renderDock(); renderFormula(); renderTimer(); renderHint(); }

  // ---- 視神経予測網（8.4）：Lv2 は先4手、Lv3 は脈動節・露出神経を優先した最長ルート ----
  function suggestRoute(path) {
    let best = null, bestScore = -1, steps = 0;
    const score = p => p.length + (optic >= 3 ? p.reduce((t, q) => { const x = board.at(q.c, q.r); return t + (x?.pulse ? 3 : 0) + (x?.special && nodes[x.special]?.look === 'bracket' ? 4 : 0); }, 0) : 0);
    const dfs = p => {
      if (++steps > 900) return;
      const sc = score(p); if (sc > bestScore) { bestScore = sc; best = p.slice(); }
      const l = p[p.length - 1];
      for (const [c, r] of board.nb(l.c, l.r)) if (board.canExtend(p, c, r) === 'add') { p.push({ c, r }); dfs(p); p.pop(); }
    };
    dfs(path.slice());
    if (!best || best.length <= path.length) return null;
    return best.slice(path.length - 1, optic >= 3 ? undefined : path.length + 4);
  }
  function drawSuggest() {
    const s = st.suggest; if (!s || s.length < 2 || tutOn()) return;
    ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 2;
    ctx.beginPath(); for (const p of s) ctx.lineTo(cx(p.c), cy(p.c, p.r)); ctx.stroke(); ctx.restore();
  }

  // ---- チュートリアル ----
  // 手順ごとに：説明カード（OKで閉じる）→ 上の帯に短いヒント → 光るノードだけなぞれる → 目標を満たすと自動で発火終了
  const tutOn = () => !!T_ && st.tutStep >= 0;
  const curStep = () => T_.tut.steps[st.tutStep];
  const tutLocked = () => tutOn() && !!st.tutIds && (cb.phase === 'think' || cb.phase === 'fire');
  function tutorialTurnStart() {
    if (!tutOn()) return;
    const step = curStep();
    applyTutorialStep(reg, cb, T_.tut, step);
    st.tutLog = { chains: [], merges: 0, pulses: 0, crit: false, weakpoint: false };
    st.tutDemo = step.free ? null : (step.demo || []).map(ch => ch.map(([c, r]) => board.at(c, r).id));
    st.tutIds = st.tutDemo ? new Set(st.tutDemo.flat()) : null;
    showTutCard(step); renderTut(); renderAll();
  }
  function tutorialAfterFire() {
    if (!tutOn() || !st.tutLog) return;
    const step = curStep();
    if (tutorialDone(step, st.tutLog)) {
      st.tutPrev = { ok: true, text: step.done ?? '' };
      st.tutStep++;
      if (st.tutStep >= T_.tut.steps.length) finishTutorial();
    } else st.tutPrev = { ok: false, text: 'もう一度。' + (step.hint ?? '') };
    st.tutLog = null; st.tutIds = null; st.tutDemo = null; renderTut();
  }
  // 目標を満たしたら、落下を見せてから自動で発火を終える（時間が動く手順は時間切れまで続ける）
  function tutorialCheckGoal() {
    if (!tutOn() || !st.tutLog || curStep().time || !tutorialDone(curStep(), st.tutLog)) return;
    st.tutIds = null; st.tutDemo = null;
    setTimeout(() => { if (!st.dead && cb.phase === 'fire' && !st.path) endFire(); }, cb.fallTime() * 1000 + 300);
  }
  function tutNudge(msg) {
    A?.alarm(); el.tutbar.querySelector('span').textContent = msg;
    el.tutbar.classList.remove('nudge'); void el.tutbar.offsetWidth; el.tutbar.classList.add('nudge');
  }
  function finishTutorial() {
    st.tutStep = -1; st.tutIds = null; st.tutDemo = null; st.tutCard = false;
    cb.protectHp = false; cb.timeHold = false; cb.enemyHold = false;
    el.tutcard.classList.remove('show'); renderTut(); renderAll(); T_?.onDone?.();
  }
  function showTutCard(step) {
    const q = x => el.tutcard.querySelector(x), prev = st.tutPrev; st.tutPrev = null;
    q('small').textContent = `TRAINING ${st.tutStep + 1} / ${T_.tut.steps.length}`;
    q('em').textContent = prev?.text ? (prev.ok ? '✔ ' : '△ ') + prev.text : '';
    q('em').className = prev?.ok ? 'ok' : 'ng';
    q('h3').textContent = step.title ?? '';
    q('p').textContent = step.text ?? '';
    st.tutCard = true; el.tutcard.classList.add('show');
  }
  el.tutcard.querySelector('button').addEventListener('click', () => { A?.unlock(); A?.tick(); st.tutCard = false; el.tutcard.classList.remove('show'); });
  function renderTut() {
    const on = tutOn();
    el.bt.classList.toggle('tutmode', on);
    if (!on) return;
    const step = curStep();
    el.tutbar.querySelector('b').textContent = `${st.tutStep + 1}/${T_.tut.steps.length} ${step.title ?? ''}`;
    el.tutbar.querySelector('span').textContent = step.hint ?? '';
  }
  el.tutbar.querySelector('button').addEventListener('click', () => finishTutorial());
  function drawTutorial(now) {
    if (!st.tutDemo || !tutOn() || st.anim || st.path || (cb.phase !== 'think' && cb.phase !== 'fire')) return;
    const pos = new Map(); for (const { c, r, cell } of board.cells()) pos.set(cell.id, { x: cx(c), y: cy(c, r) });
    const chain = st.tutDemo.find(ch => ch.every(id => pos.has(id))); if (!chain) return;
    const pts = chain.map(id => pos.get(id)), k = st.L.s * 0.85, l = st.L.s * 0.3;
    ctx.strokeStyle = T.pulse; ctx.lineWidth = 2.5; ctx.globalAlpha = (now / 200 | 0) % 2 ? 1 : 0.55;
    for (const { x, y } of pts) gfx.bracket(ctx, x, y, k, l);
    // なぞる順を示す点線と、その上を滑る光点
    ctx.globalAlpha = 0.8; ctx.setLineDash([5, 6]); ctx.lineWidth = 2; ctx.strokeStyle = '#fff';
    ctx.beginPath(); for (const { x, y } of pts) ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
    const u = (now % 1400) / 1400 * (pts.length - 1), i = Math.min(pts.length - 2, u | 0), f = u - i;
    const gx = pts[i].x + (pts[i + 1].x - pts[i].x) * f, gy = pts[i].y + (pts[i + 1].y - pts[i].y) * f, q = st.L.s * 0.2;
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillRect(gx - q, gy - q, q * 2, q * 2);
  }

  // ---- 描画（Canvas） ----
  // 軽量化：静止部分（背景・脊髄の枠）とノードの見た目は画像に焼いて使い回す。毎フレームのぼかし・CSSフィルタは使わない
  const SAT = opts.saturation != null && opts.saturation < 1 ? opts.saturation : 1;
  const desat = hex => desaturate(hex, SAT);
  const hexPath = (x, y, rad, g = ctx) => gfx.hex(g, x, y, rad);
  const symbol = (kind, x, y, k, col, g = ctx) => gfx.symbol(g, kind, x, y, k, col);
  const colMemo = new Map();
  const colorOf = id => { let v = colMemo.get(id); if (!v) colMemo.set(id, v = desat(nodes[id]?.color ?? '#777')); return v; };
  const PULSE_COL = pulseDef ? desat(pulseDef.color) : '#fff';
  function burst(c, r, color, size) {
    const t0 = performance.now();
    st.fx.push({ c, r, color, size, t0 });
    for (let i = 0; i < 4; i++) { const a = Math.PI / 2 * i + (c * 7 + r * 3) * 0.37; st.sparks.push({ c, r, a, color, t0, len: 0.5 + (i % 2) * 0.3 }); }
  }
  // 画像キャッシュ（layout() で破棄）
  function offscreen(w, h) {
    const W = Math.ceil(w * st.dpr), H = Math.ceil(h * st.dpr);
    const cv = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H });
    const g = cv.getContext('2d'); g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0); return [cv, g];
  }
  // 描き終えた画像は変更不可の ImageBitmap にして渡す（毎フレームの複製が起きない）
  const freeze = cv => cv.transferToImageBitmap ? cv.transferToImageBitmap() : cv;
  function buildLayers() {
    const { W, H, s, h } = st.L;
    // 背景と脊髄の枠は下の別キャンバスに一度だけ描く（毎フレームは前景だけ描き直す）
    el.bgc.width = Math.round(W * st.dpr); el.bgc.height = Math.round(H * st.dpr);
    const g = el.bgc.getContext('2d'); g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    g.fillStyle = T.bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = T.line; g.globalAlpha = 0.3; g.lineWidth = 1; g.beginPath();
    for (let gx = 0; gx < W; gx += 24) { g.moveTo(gx + 0.5, 0); g.lineTo(gx + 0.5, H); }
    for (let gy = 0; gy < H; gy += 24) { g.moveTo(0, gy + 0.5); g.lineTo(W, gy + 0.5); }
    g.stroke(); g.globalAlpha = 1;
    for (const c of board.spineCols) {
      const x = cx(c), top = cy(c, 0) - h / 2, bot = cy(c, board.rows - 1) + h / 2;
      g.fillStyle = '#000'; g.fillRect(x - s * 0.18, top, s * 0.36, bot - top);
      gfx.spineCol(g, x, board.rows, r => cy(c, r), s, h, { panel: T.panel, line: T.line, glow: board.spineWild ? '#fff' : T.pulse, wild: board.spineWild });
    }
  }
  // ノード1個の見た目（色×圧縮段階×状態）を画像にする。state: n=通常 / l=届く / p=なぞり中
  function sprite(color, cmpN, state, necro) {
    const mode = toneMode(), k = (necro ? 'necro' : color + '|' + cmpN + '|' + state) + mode;
    let v = cache.spr.get(k); if (v) return v;
    const s = st.L.s, R0 = s * 0.9 + 5, [cv, g] = offscreen(R0 * 2, R0 * 2), x = R0, y = R0;
    const cmp = cmpN ? cmpDefs[cmpN - 1] : null;
    gfx.cell(g, x, y, s, { panel: T.panel, necro, state, col: color ? colorOf(color) : '#3a3f40', sym: nodes[color]?.symbol, look: cmp?.look, label: cmp?.name });
    tone(g, cv, mode);
    cache.spr.set(k, v = { cv: freeze(cv), R0 }); return v;
  }
  function drawCell(c, r, x, y, cell, now) {
    const { s } = st.L;
    const inPath = st.pathSet?.has(key(c, r));
    const dim = (st.reach && !st.reach.has(key(c, r))) || (st.tutIds && !st.tutIds.has(cell.id) && tutLocked());
    const lit = st.reach && !dim;
    const sp = cell.special ? nodes[cell.special] : null;
    const spr = sprite(cell.color, cell.cmp || 0, inPath ? 'p' : lit ? 'l' : 'n', sp?.look === 'necrosis');
    const base = dim ? 0.28 : 1;
    ctx.globalAlpha = base;
    ctx.drawImage(spr.cv, x - spr.R0, y - spr.R0, spr.R0 * 2, spr.R0 * 2);
    if (sp?.look === 'necrosis') { ctx.globalAlpha = 1; return; }
    const cmp = cell.cmp ? cmpDefs[cell.cmp - 1] : null;
    if (cmp?.look === 'poly') gfx.poly(ctx, x, y, s, colorOf(cell.color), now / 900);   // 最上位の圧縮だけ回転（線2本だけなので軽い）
    if (cell.pulse && pulseDef) {
      ctx.strokeStyle = PULSE_COL; ctx.lineWidth = 2; hexPath(x, y, s * 0.97); ctx.stroke();
      ctx.globalAlpha = base * ((now / 160 | 0) % 2 ? 0.5 : 0.15); ctx.lineWidth = 6; ctx.stroke(); ctx.globalAlpha = base;
      symbol(pulseDef.symbol, x, y - s * 0.6, s * 0.22, PULSE_COL);
    }
    if (board.isWild(c)) { hexPath(x, y, s * 0.8); ctx.setLineDash([4, 3]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]); }
    if (sp) gfx.special(ctx, sp.look, x, y, s, T.alert, cell.count);
    ctx.globalAlpha = 1;
  }
  // なぞりの線：太さの違う線を重ねて光らせる。最後の区間は約0.09秒で伸び、その先は指の位置まで滑らかについてくる
  function drawPath(now) {
    const path = st.path; if (!path?.length) return;
    const col = colorOf(board.pathColor(path) ?? board.at(path[0].c, path[0].r).color);
    const pts = path.map(p => ({ x: cx(p.c), y: cy(p.c, p.r) }));
    if (st.grow && pts.length >= 2) {
      const k = clamp((now - st.grow.t0) / 90, 0, 1), e = 1 - (1 - k) ** 3, a = pts[pts.length - 2], b = pts[pts.length - 1];
      pts[pts.length - 1] = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
      if (k >= 1) st.grow = null;
    }
    if (st.finger && !st.grow) {
      st.tail.x += (st.finger.x - st.tail.x) * 0.35; st.tail.y += (st.finger.y - st.tail.y) * 0.35;
      const l = pts[pts.length - 1], dx = st.tail.x - l.x, dy = st.tail.y - l.y, d = Math.hypot(dx, dy), m = Math.min(d, st.L.s * 0.9);
      if (d > 1) pts.push({ x: l.x + dx / d * m, y: l.y + dy / d * m, tail: true });
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.22; ctx.lineWidth = st.L.s * 0.45; ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = st.L.s * 0.13; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, st.L.s * 0.04); ctx.stroke();
    const tip = pts[pts.length - 1], q = st.L.s * 0.16;   // 先端は四角い光点（点滅2段）
    ctx.fillStyle = '#fff'; ctx.globalAlpha = (now / 70 | 0) % 2 ? 1 : 0.5; ctx.fillRect(tip.x - q, tip.y - q, q * 2, q * 2);
    ctx.globalAlpha = 1; ctx.lineCap = 'butt';
    const l = path[path.length - 1], ok = path.length >= board.minChain;
    ctx.fillStyle = ok ? '#fff' : '#ffffff88'; ctx.font = `700 ${Math.max(14, st.L.s * 0.5)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(path.length), cx(l.c), cy(l.c, l.r) - st.L.s * 1.05);
  }
  function drawPick() {
    const p = st.pick; if (!p || p.stage !== 'row') return;
    ctx.fillStyle = T.alert; ctx.globalAlpha = 0.08;
    for (let r = 0; r < board.rows; r++) ctx.fillRect(0, cy(0, r) - 2, st.L.W, 4);
    ctx.globalAlpha = 1;
  }
  function drawFx(now) {
    if (st.sparks.length) st.sparks = st.sparks.filter(f => now - f.t0 < 220);
    for (const f of st.sparks) {
      const t = (now - f.t0) / 220, x = cx(f.c), y = cy(f.c, f.r), d0 = st.L.s * (0.4 + 1.4 * t), d1 = d0 + st.L.s * f.len * (1 - t);
      ctx.globalAlpha = 1 - t; ctx.strokeStyle = f.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(f.a) * d0, y + Math.sin(f.a) * d0); ctx.lineTo(x + Math.cos(f.a) * d1, y + Math.sin(f.a) * d1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 連結ごとの数値（基礎・倍率・外殻）：ぼかしなし。黒い縁取りで読ませる
    if (st.texts.length) st.texts = st.texts.filter(f => now - f.t0 < 1100);
    if (st.texts.length) {
      ctx.font = `800 ${Math.max(14, st.L.s * 0.46)}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round';
    }
    for (const f of st.texts) {
      if (now < f.t0) continue;
      const t = (now - f.t0) / 1100, pop = t < 0.06 ? 1.35 : 1;   // 出だしだけ1段大きく（拡大アニメの代わり）
      const x = clamp(cx(f.c), 60, st.L.W - 60), y = cy(f.c, f.r) - st.L.s * (0.6 + f.dy * 0.62) - Math.min(t, 0.25) * st.L.s * 1.6;
      ctx.globalAlpha = t < 0.75 ? 1 : (1 - t) * 4;
      if (pop > 1) { ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop); ctx.translate(-x, -y); }
      ctx.strokeText(f.text, x, y); ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
      if (pop > 1) ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (st.fx.length) st.fx = st.fx.filter(f => now - f.t0 < 240);
    for (const f of st.fx) {
      const t = (now - f.t0) / 240;
      ctx.globalAlpha = 1 - t; ctx.strokeStyle = f.color; ctx.lineWidth = 3 * (1 - t) + 1;
      hexPath(cx(f.c), cy(f.c, f.r), st.L.s * (0.6 + 0.8 * t) * f.size); ctx.stroke();
      if (t < 0.25) { ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.5; hexPath(cx(f.c), cy(f.c, f.r), st.L.s * 0.85); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  // 大技の瞬間：一瞬の反転と、横に裂けるグリッチ（短時間だけ。CSSフィルタは使わない）
  function drawGlitch(real) {
    const g = st.glitch; if (!g) return;
    const t = real - g.t0, { W, H } = st.L;
    if (t > 170) { st.glitch = null; return; }
    if (t < 55) { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    const n = (t / 40 | 0) + g.seed;
    for (let i = 0; i < 3; i++) {
      const y = ((n * 97 + i * 211) % 100) / 100 * H, hh = 6 + ((n + i) % 3) * 8, off = ((n + i) % 2 ? 1 : -1) * (6 + i * 5);
      ctx.drawImage(el.canvas, 0, y * st.dpr, W * st.dpr, hh * st.dpr, off, y, W, hh);
      ctx.fillStyle = i % 2 ? '#ff004c' : '#00e5ff'; ctx.globalAlpha = 0.35; ctx.fillRect(0, y, W, 2); ctx.globalAlpha = 1;
    }
  }
  // 臨界中の色調：反転＋白黒（弱めの設定では白黒＋減光）。描いた画像の画素を一度だけ変換してキャッシュする
  const toneMode = () => cb.crit ? (settings.reduceFlash ? 's' : 'c') : '';
  const tone = (g, cv, mode) => mode && gfx.tone(g, cv.width, cv.height, mode === 'c');
  function draw(real, now) {
    const { W, H } = st.L;
    const key2 = W + 'x' + H + '|' + toneMode() + '|' + board.spineWild + '|' + board.spineCols.join(',');
    if (cache.key !== key2) { cache.key = key2; buildLayers(); tone(el.bgc.getContext('2d'), el.bgc, toneMode()); }
    ctx.clearRect(0, 0, W, H);
    st.pathSet = st.path ? new Set(st.path.map(p => key(p.c, p.r))) : null;
    const a = st.anim, t = a ? clamp((real - a.t0) / a.dur, 0, 1) : 1;
    if (a && t >= 1) st.anim = null;
    for (const { c, r, cell } of board.cells()) {
      let rr = r;
      if (a && a.from.has(cell.id)) { const f = a.from.get(cell.id); rr = f + (r - f) * t * t; }
      drawCell(c, r, cx(c), cy(c, rr), cell, now);
    }
    drawPick(); drawSuggest(); drawPath(real); drawTutorial(now); drawFx(real);
    drawGlitch(real);
  }
  // 何も動いていないときは描画を間引く（約20fps。動くのは2段点滅などで、間引いても見た目は変わらない）
  const isBusy = () => !!(st.path || st.anim || st.fx.length || st.sparks.length || st.texts.length || st.glitch || st.shake || (st.evalAnim && !st.evalAnim.done));

  // ---- ループ ----
  function frame(now) {
    if (st.dead) return;
    const dt = st.last ? Math.min(0.1, (now - st.last) / 1000) : 0; st.last = now;
    // 演出用の時計：なぞっている間は背景や脈動もゆっくりになる（意図したスローモーションに見せる）
    const slowK = cb.phase === 'fire' && st.path ? (R.fire.traceSlow ?? 1) : 1;
    st.vt = (st.vt ?? now) + dt * 1000 * slowK;
    const stopped = now < st.hitstopUntil;
    if (!stopped && cb.phase === 'fire' && !st.evalAnim && cb.tick(dt, !!st.path)) {
      // 時間切れでも、なぞっている途中の連結は指を離すまで待つ
      if (st.path && R.fire.holdTrace) st.timeUp = true; else endFire();
    }
    const ea = st.evalAnim;
    if (ea && !ea.done && !stopped) {
      while (ea.i < ea.ev.steps.length && now >= ea.next) { showStep(ea.i++); ea.next = now + R.evalAnim.stepMs; }
      if (ea.i >= ea.ev.steps.length && now >= ea.next) finishEval();
    }
    if (st.shake && now < st.shake.until) {
      const k = st.shake.px * (st.shake.until - now) / 300;
      el.bt.style.transform = `translate(${(k * Math.sin(now * 0.09)).toFixed(1)}px, ${(k * Math.cos(now * 0.13)).toFixed(1)}px)`;
    } else if (st.shake) { st.shake = null; el.bt.style.transform = ''; }
    renderTimer();
    st.fc = (st.fc ?? 0) + 1;
    if (st.L.W > 0 && (isBusy() || st.fc % 3 === 0)) draw(now, st.vt);
    st.raf = requestAnimationFrame(frame);
  }

  // ---- デバッグ（タイトルのロゴを10回で表示） ----
  if (opts.debug) {
    el.dbgBtn.addEventListener('click', () => el.dbg.classList.toggle('open'));
    debugPanel(el.dbg, { reg, cb, settings, seed: opts.seed, specials: specialDefs, onChange: () => { updatePreview(); renderAll(); }, canReset: () => !st.path });
  }

  if (T_) { st.tutStep = 0; tutorialTurnStart(); }
  if (cb.wasFired) {   // 発火中に閉じた場合：そのターンは連結なしで終わる（再読み込みでやり直せない）
    cb.wasFired = false;
    setTimeout(() => { popup('再接続：中断された発火', ''); cb.beginFire(); endFire(); }, 400);
  }
  A?.playBgm(cb.isBoss ? R.audio?.bossBpm : R.audio?.bpm);
  A?.setTempo(cb.isBoss ? R.audio?.bossBpm : R.audio?.bpm);
  updatePreview(); renderAll();
  st.raf = requestAnimationFrame(frame);
  return {
    combat: cb, state: st,
    destroy() { st.dead = true; cancelAnimationFrame(st.raf); ro.disconnect(); A?.setHalf(false); A?.setOpen(0); A?.setTension(0); wrap.remove(); },
  };
}

// 画面の入口：コンテンツを読み、画面を切り替え、キー操作を今の画面に渡す
//   index.html        … タイトル → 宿 → 潜行準備 → 潜行 → 結果 → 宿
//   index.html?dev=1  … 試し場（IDを指定して手札・席・敵・宿泊客を置き、すぐ戦闘）

import { h, toast, loadSettings, saveSettings, hideTip } from './dom.js';
import { FxQueue } from './fx/queue.js';
import { battleScreen } from './screens/battle.js';
import { titleScreen } from './screens/title.js';
import { labScreen } from './screens/lab.js';
import { diveScreen } from './screens/dive.js';
import { zukanScreen } from './screens/zukan.js';
import { fxLabScreen } from './screens/fxlab.js';
import { diveBattle, finishBattle, keepBattle, saveDive, loadDive } from '../engine/dive.js';
import { newInn, saveInn, loadInn, beginDive, beginDaily, beginShared, finishDive, starterIds } from '../engine/meta.js';
import { innScreen, facilityScreen, stashScreen, prepScreen, resultScreen, settingsScreen, boardScreen } from './screens/inn.js';
import { readAll, write, exportText, importText } from './save.js';
import { setFlashOptions } from './fx/flash.js';
import { initParticles, setParticleScale } from './fx/particles.js';
import { setShowOptions } from './fx/shows.js';
import { setNumMode } from './num.js';
import { unlockAudio, setAudioOptions, playBgm, stopBgm, startHeart, stopHeart } from './audio/audio.js';
import { layerAt, layerNo } from '../engine/dive.js';
import { loadContent, fetchIO } from '../engine/content.js';
import { createCoach } from './coach.js';
import { rules } from './lessons.js';
import { createBattle, openBattle, startBattle, makeBattleCard, attachCard } from '../engine/battle.js';

const BUILD = window.BUILD || 'dev';
const app = document.getElementById('app');
const settings = loadSettings();
document.documentElement.style.setProperty('--speed', settings.speed);
const queue = new FxQueue({ layer: document.getElementById('fx'), blocker: document.getElementById('blocker'), speed: () => settings.speed });
initParticles(document.getElementById('fxc'));

/** 設定を演出・音・数字に配る */
function applySettings() {
  document.documentElement.style.setProperty('--speed', settings.speed);
  queue.opts.shake = !!settings.shake;
  setFlashOptions({ noFlash: !!settings.noFlash });
  document.getElementById('app').classList.toggle('calm-flash', !!settings.noFlash);
  setShowOptions({ fx: settings.fx, shake: !!settings.shake });
  setParticleScale({ 控えめ: 0.35, 標準: 1, 激しい: 1.6 }[settings.fx] ?? 1);
  setAudioOptions({ se: settings.se, bgm: settings.bgm, vibrate: settings.vibrate });
  setNumMode(settings.numFmt);
}
applySettings();
// 最初のタップで音を有効にする
window.addEventListener('pointerdown', () => unlockAudio(), { capture: true });
window.addEventListener('keydown', () => unlockAudio(), { capture: true });

/** 雰囲気：BGM・気配で暗くなる端・深さで暗くなる背景・踊り場の心音 */
const vignette = document.getElementById('vignette');
function ambience(where, D = null) {
  const app2 = document.getElementById('app');
  const pst = D ? (D.presence >= 12 ? 3 : D.presence >= 8 ? 2 : D.presence >= 4 ? 1 : 0) : 0;
  vignette.className = pst ? `p${pst}` : '';
  const L = D ? layerAt(base.content, D.floor) : null;
  const no = L ? layerNo(base.content, L) : 0;
  app2.classList.toggle('deep1', no === 2);
  app2.classList.toggle('deep2', no >= 3);
  if (where === 'landing') { stopBgm(); startHeart(); return; }
  stopHeart();
  if (where === 'inn' || where === 'title') playBgm('宿', where === 'title' ? -5 : 0);
  else if (where === 'boss') playBgm('層主', -(no - 1) * 2);
  else if (where === 'dive') playBgm(L?.id ?? 'layer1', -((D?.floor ?? 1) - 1));
  else if (where === 'title') stopBgm();
}
let current = null;
function show(screen) {
  hideTip();
  if (current?.el) current.el.remove();
  current = screen;
  window.__taabuka?.coach?.pause?.(250);
  app.prepend(screen.el);
  for (const id of ['side-l', 'side-r']) if (!screen.sides) document.getElementById(id).replaceChildren();
  screen.render?.();
  if (screen.where) ambience(screen.where, screen.dive ?? null);
}

document.addEventListener('keydown', (e) => {
  if (e.target.matches?.('input, select, textarea')) return;
  if (current?.onKey && current.onKey(e)) e.preventDefault();
});

function fail(title, lines) {
  app.querySelector('.scr')?.remove();
  app.prepend(h('div.scr.fail', {}, [h('h2.ttl', { text: title }), h('pre', { text: lines.join('\n') }),
    h('button.btn', { type: 'button', onclick: () => location.reload() }, ['読み直す'])]));
  document.getElementById('boot')?.remove();
}

let base;
try {
  const { content, issues } = await loadContent(fetchIO(location.href, BUILD, { onProgress: (p) => window.bootProgress?.(p) }));
  const errs = issues.filter((i) => i.level === 'error');
  if (errs.length) { fail('読み込みに失敗しました', errs.map((i) => `[${i.tag}] ${i.where}: ${i.msg}`)); throw new Error('content'); }
  base = { balance: content.balance, content };
  window.__taabuka = { base, settings };
} catch (e) {
  if (e.message !== 'content') fail('読み込みに失敗しました', [String(e.stack || e.message || e)]);
  throw e;
}
document.getElementById('boot')?.remove();

/** 試し場の「初期デッキ」：宿泊客の入門札3枚＋ター宿セットの並17枚 */
export function tempDeck(guestId) { return starterIds(base, guestId); }

let uidN = 0;
const owned = (id) => ({ uid: `u${Date.now().toString(36)}_${(uidN++).toString(36)}`, id, origin: 'orig' });

/**
 * 試し場の戦闘を作って画面に出す
 * @param {object} o { guest, deck:[id], hand:[id]|null, seats:[id], relics:[id], enemies:[{id, claim?}], floor, hp, seed, banzuke, back }
 */
/** 試し場で見た単位（桁越えは試し場を開き直すたびにまた見られる） */
const labUnits = new Set();
export function startBattleScreen(o) {
  const g = o.guest ? base.content.guests[o.guest] : null;
  const relics = [...(o.relics ?? (g?.relic ? [g.relic] : []))];
  const B = createBattle(base, {
    seed: o.seed || String(Date.now()), floor: o.floor ?? 1, hp: o.hp || undefined, deck: o.deck.map(owned),
    enemies: o.enemies.map((e) => e.id), guest: o.guest || null, seats: (o.seats || []).map(owned), relics: relics.map(owned), banzuke: o.banzuke || {},
  });
  if (B.hp == null) { B.hp = 70; B.maxHp = 70; }
  o.enemies.forEach((e, i) => { if (e.claim) { B.enemies[i].claim = B.enemies[i].maxClaim = e.claim; } });
  const env = openBattle(base, B);
  startBattle(B, env);
  if (o.hand && o.hand.length) {
    B.draw.unshift(...B.hand);
    B.hand = o.hand.map((id) => makeBattleCard(owned(id), base.content.cards[id]));
    for (const c of B.hand) attachCard(env, c);
  }
  const scr = battleScreen({
    app, queue, settings, saveSettings, base, B, env,
    onExit: () => o.back(), onRestart: () => startBattleScreen(o),
    unitSeen: (u) => labUnits.has(u), markUnit: (u) => labUnits.add(u),
  });
  scr.sides = true;
  window.__taabuka.battle = { B, env, scr };
  show(scr);
  return scr;
}

// ───────── セーブ ─────────
let H = null;   // 宿
let D = null;   // 潜行中
async function loadSaves() {
  const s = await readAll();
  try { H = s.inn ? loadInn(s.inn) : null; } catch (e) { toast(`宿のセーブが読めない：${e.message}`); H = null; }
  try { D = s.dive ? loadDive(s.dive) : null; } catch { D = null; }
  if (D && (!H || !H.diving)) D = null;
  Object.defineProperty(window.__taabuka, 'H', { get: () => H, configurable: true });
  Object.defineProperty(window.__taabuka, 'D', { get: () => D, configurable: true });
}
let saving = Promise.resolve();
/** 書く（順番を守る）。both なら宿と潜行を1つの書き込みで */
function persist(what = 'inn') {
  const kv = {};
  if (what === 'inn' || what === 'both') kv.inn = H ? saveInn(H) : null;
  if (what === 'dive' || what === 'both') kv.dive = D ? saveDive(D) : null;
  saving = saving.then(() => write(kv)).catch((e) => toast(`保存できない：${e.message}`));
  return saving;
}
window.__taabuka.flush = () => saving;

// ───────── 潜行 ─────────
function startDive(sudomari, special) {
  try {
    if (special?.daily) D = beginDaily(base, H, { date: special.daily });
    else if (special?.code) D = beginShared(base, H, { code: special.code });
    else D = beginDive(base, H, { seed: Date.now().toString(36), sudomari, practice: !sudomari && coach.on() && H.records.dives === 0 });
  }
  catch (e) { if (e.userError) { toast(e.message); return; } throw e; }
  persist('both');   // 持ち込みの確定：蔵から除くのと潜行中セーブを1つの書き込みで
  showDive();
}

/** 潜行の状態が変わった：保存。終わっていたら宿に反映（脱出・未帰還も1つの書き込みで） */
function diveChanged() {
  if (D?.result && H.diving) {
    const rep = finishDive(base, H, D);
    D = null;
    persist('both');
    return rep;
  }
  persist('dive');
  return null;
}

function showDive() {
  if (!D) return goInn();
  if (D.phase === 'battle') return showDiveBattle();
  window.__taabuka.dive = D;
  show(diveScreen({ app, base, D, queue, onBattle: showDiveBattle, onChange: () => { pendingRep = diveChanged() ?? pendingRep; }, onEnd: () => showResult(),
    onRender: (d) => ambience(d.phase === 'landing' ? 'landing' : d.phase === 'end' ? 'none' : 'dive', d) }));
}
let pendingRep = null;
function showResult() {
  const rep = pendingRep ?? H.lastResult;
  pendingRep = null;
  if (!rep) return goInn();
  const r = resultScreen(innCtx, rep);
  r.where = rep.outcome === 'escaped' ? 'none' : 'none';
  stopBgm(); stopHeart(); vignette.className = '';
  show(r);
}

function showDiveBattle() {
  const { B, env, resumed } = diveBattle(base, D);
  if (!resumed) startBattle(B, env);
  keepBattle(D, B);
  persist('dive');
  const scr = battleScreen({
    app, queue, settings, saveSettings, base, B, env,
    onExit: () => {},
    unitSeen: (u) => H.records.unitsSeen.includes(u),
    markUnit: (u) => { H.records.unitsSeen.push(u); persist('inn'); },
    onAction: (b) => { keepBattle(D, b); persist('dive'); },
    onDone: (b) => {
      finishBattle(base, D, b);
      const rep = diveChanged();
      if (rep) { pendingRep = rep; showResult(); } else showDive();
    },
  });
  scr.sides = true;
  scr.where = D.battle?.kind === '層主' ? 'boss' : 'dive';
  scr.dive = D;
  window.__taabuka.battle = { B, env, scr };
  show(scr);
}

// ───────── 宿 ─────────
const innCtx = {
  app, base, coach: null, rules: () => rules(base), settings, saveSettings, queue, applySettings, H: () => H, save: () => persist('inn'),
  exportText: async () => { await saving; return exportText(saveInn(H), D ? saveDive(D) : null); },
  importText: async (t) => {
    const o = await importText(t);
    const h2 = loadInn(o.inn);
    const d2 = o.dive ? loadDive(o.dive) : null;
    H = h2; D = d2 && h2.diving ? d2 : null;
    await persist('both');
    home();
  },
  resetAll: async () => { H = null; D = null; await persist('both'); home(); },
  go: {
    inn: () => goInn(), stash: () => show(stashScreen(innCtx)), facility: (id) => show(facilityScreen(innCtx, id)),
    prep: () => show(prepScreen(innCtx)), settings: () => show(settingsScreen(innCtx)),
    zukan: () => show(zukanScreen({ ...ctx, back: goInn })), dive: (s) => startDive(s), sudomari: () => startDive(true),
    board: () => show(boardScreen(innCtx)), daily: (date) => startDive(false, { daily: date }), shared: (code) => startDive(false, { code }),
  },
};
function goInn() { if (!H) return home(); if (H.diving && D) return showDive(); const s2 = innScreen(innCtx); s2.where = 'inn'; show(s2); }

// ───────── 更新（サービスワーカー）。案内は宿の画面だけ ─────────
let swWaiting = null;
let swReloading = false;
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const check = () => { if (reg.waiting && navigator.serviceWorker.controller) { swWaiting = reg.waiting; if (current?.where === 'inn') current.render?.(); } };
    check();
    reg.addEventListener('updatefound', () => { const w = reg.installing; w?.addEventListener('statechange', () => { if (w.state === 'installed') check(); }); });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (swReloading) location.reload(); });
}
innCtx.updateReady = () => !!swWaiting;
innCtx.applyUpdate = async () => { await saving; swReloading = true; swWaiting?.postMessage('SKIP_WAITING'); };

// ───────── タイトル ─────────
const dev = new URLSearchParams(location.search).get('dev') === '1';
const ctx = {
  app, base, show, toast, startBattleScreen, tempDeck,
  showZukan: () => show(zukanScreen({ ...ctx, back: home })),
  showFxLab: () => show(fxLabScreen({ ...ctx, queue, back: home })),
  title: () => ({ H, D }),
  begin: () => { H = newInn(base, Date.now().toString(36)); persist('both'); goInn(); },
  resume: () => { if (H?.diving && D) showDive(); else goInn(); },
};
function home() { const s2 = dev ? labScreen({ ...ctx, back: home }) : titleScreen({ ...ctx, back: home }); s2.where = 'title'; show(s2); }
await loadSaves();
// 女将の案内：宿のセーブ（H.hints）に進み具合を持つ。宿が無い（タイトル・試し場）あいだは出ない
const coach = dev ? { on: () => false, tick() {}, reset() {}, setOn() {}, pause() {} } : createCoach({
  app, base, getH: () => H, save: () => persist('inn'), getCurrent: () => current,
  onQuit: () => toast('案内をやめた。設定の「女将の案内」でまた聞ける'),
});
innCtx.coach = coach;
window.__taabuka.coach = coach;
home();

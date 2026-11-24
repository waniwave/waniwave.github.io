// main.js — 起動、画面の切り替え、保存と読み込み
import { loadPacks } from './engine/registry.js';
import { Game, SAVE_KEY } from './engine/progress.js';
import { makeRng, hashSeed } from './util.js';
import { createBattle } from './ui/battle.js';
import { createScreens } from './ui/screens.js';
import { createAudio } from './audio.js';

const app = document.getElementById('app');
const BUILDQ = (() => { try { return new URL(import.meta.url).search; } catch { return ''; } })();

// ---- ホーム画面に追加（PWA） ----
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
window.addEventListener('appinstalled', () => { installEvt = null; });
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isMobile = () => isIOS() || /Android/i.test(navigator.userAgent) || matchMedia('(pointer: coarse)').matches;
const install = {
  // ホーム画面から起動していないスマホ（またはブラウザがインストールを提案してきたとき）だけボタンを出す
  available: () => !isStandalone() && (isMobile() || !!installEvt),
  async run() {
    if (installEvt) { installEvt.prompt(); try { await installEvt.userChoice; } catch {} installEvt = null; return; }
    const ios = isIOS();
    ui.modal(`<b>ホーム画面に追加</b>
      ${ios ? `<ol class="howto"><li>Safari でこのページを開く</li><li>画面下の <b>共有ボタン</b>（□に↑）を押す</li><li><b>「ホーム画面に追加」</b>を選び、「追加」を押す</li></ol>`
            : `<ol class="howto"><li>Chrome でこのページを開く</li><li>右上の <b>メニュー（⋮）</b>を押す</li><li><b>「ホーム画面に追加」</b>または<b>「アプリをインストール」</b>を選ぶ</li></ol>`}
      <p class="note">ホーム画面のアイコンから起動すると、アドレスバーのない全画面で遊べます。セーブはそのまま引き継がれます。</p>`);
  },
};
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js' + BUILDQ).catch(() => {}));
}
let reg, rng, seed, audio, game, ui, battle = null;
let debug = false;   // タイトルのロゴを10回叩くと有効（そのセッションだけ）

function showErrors(errors) {
  const box = document.createElement('div');
  box.className = 'errors';
  box.innerHTML = `<b>CONTENT ERROR ×${errors.length}</b>`;
  for (const e of errors) { const d = document.createElement('div'); d.textContent = e; box.appendChild(d); }
  box.addEventListener('click', () => box.remove());
  app.appendChild(box);
}

// ---- 保存 ----
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(game.toJSON())); } catch (e) { console.warn('保存できない', e); } }
function load() { try { const t = localStorage.getItem(SAVE_KEY); return t ? JSON.parse(t) : null; } catch { return null; } }
function applySettings() {
  const st = game.s.settings;
  audio.setVolume('bgm', st.bgm); audio.setVolume('sfx', st.sfx);
}
function clearBattle() { battle?.destroy(); battle = null; }
// ストーリーの通知を出してから次へ
function flush(next) { const q = game.takeQueue(); save(); if (q.length) ui.story(q, next); else next?.(); }

// ---- 画面の流れ ----
function title() {
  clearBattle(); audio.stopBgm();
  ui.title(() => {
    audio.unlock();
    if (!game.s.prologue) return prologue();
    resume();
  }, { on: debug, unlock: () => { debug = true; }, fight: testBattle, h: H });
}
function prologue() {
  const out = game.emit('GAME_START', {}); game.takeQueue();
  game.s.prologue = true; save();
  ui.textSeq(out.texts, () => resume());
}
// セーブの状態から、続きの画面へ
function resume() {
  clearBattle();
  if (!game.diver) return thaw();
  const run = game.run;
  if (!run) return hubScreen('contract');
  const next = { route: routeScreen, battle: battleScreen, reward: rewardScreen, choice: choiceScreen, final: finalScreen }[run.phase];
  if (next) next(); else hubScreen('spine');
}
function thaw() {
  clearBattle(); audio.stopBgm();
  ui.thaw(() => {
    save();
    flush(() => {
      // 初回はそのままチュートリアル付きの RANK D へ
      if (!game.s.tutorial.done && game.s.records.runs === 0) return startRun(game.tutorialData()?.mode ?? 'rank_d');
      hubScreen('spine');
    });
  });
}
const H = {
  save, applySettings,
  startRun: (id, f) => startRun(id, f),
  preserve: i => { game.preserve(i); save(); flush(() => ui.result(game.s.lastResult, () => thaw())); },
  practice: () => practice(),
  wipe: () => { localStorage.removeItem(SAVE_KEY); location.reload(); },
};
function hubScreen(tab) { clearBattle(); audio.stopBgm(); ui.hub(tab, H); }
function startRun(id, start = 1) {
  if (!game.startRun(id, start)) { ui.toast('潜行を開始できない'); return; }
  save(); flush(routeScreen);
}
function routeScreen() {
  const run = game.run;
  const go = i => { game.chooseRoute(i); save(); flush(battleScreen); };
  if (run.routes.length === 1 && (run.routes[0].boss || run.routes[0].tutorial)) {
    if (run.routes[0].boss) ui.toast('一本道：中枢監査体の反応');
    return go(0);
  }
  ui.routes(run, go);
}
function battleScreen() {
  clearBattle(); app.innerHTML = '';
  const run = game.run;
  const cb = game.makeCombat();
  const tut = run.route?.tutorial && !game.s.tutorial.done ? game.tutorialData() : null;
  const m = game.mode(), pol = game.pollutionLabels(m, run.floor);
  if (pol.length && m.pollution && (run.floor - 1) % m.pollution.every === 0 && !run.battle) ui.toast(pol.at(-1), 3600);
  battle = createBattle(app, reg, rng, {
    combat: cb, seed, audio, settings: game.s.settings, optic: game.s.optic, debug,
    saturation: game.saturation(m, run.floor), pollution: pol,
    tutorial: tut ? { tut, onDone: () => { game.completeTutorial(); save(); ui.toast('チュートリアル完了。ここから先は自分の判断で潜れ。', 3200); } } : null,
    onSave: c => { game.saveBattle(c); save(); },
    onTurn: (c, ev) => { game.recordTurn(c, ev); save(); const q = game.takeQueue(); if (q.length) ui.story(q); },
    onEnd: () => {
      const r = game.finishBattle(cb);
      save();
      setTimeout(() => {
        clearBattle();
        if (r?.type === 'lost') return lostSequence(r);
        flush(() => resume());
      }, 300);
    },
  });
  if (debug) globalThis.__notochord = battle;
}
// 試験戦闘（デバッグ）：記録に残らない
function testBattle(mode, floor) {
  clearBattle(); app.innerHTML = '';
  battle = createBattle(app, reg, rng, { mode, floor, seed, audio, settings: game.s.settings, optic: 3, debug: true,
    ampoules: ['amp_cold', 'amp_burn'], onEnd: () => setTimeout(title, 900) });
  globalThis.__notochord = battle;
}
function rewardScreen() { ui.reward(game.run, ch => { game.takeReward(ch); save(); resume(); }); }
function choiceScreen() {
  ui.choice(game.run, act => {
    if (act === 'dive') { game.dive(); save(); flush(routeScreen); }
    else { const r = game.extract(); save(); flush(() => ui.result(r, () => hubScreen('vault'))); }
  });
}
function finalScreen() { const r = game.extract(); save(); flush(() => ui.result(r, () => hubScreen('contract'))); }
function lostSequence(r) {
  audio.stopBgm();
  const q = game.takeQueue();
  const lines = q.flatMap(x => x.lines).filter(l => l.speaker === 'CEREBRUM');
  const text = [...lines, { speaker: 'CEREBRUM', text: `……新規検体 #${game.s.specimen} を培養槽から解凍。前任者の残留神経素（${Math.round(r.rate * 100)}%）と控え義体を引き継ぎ、潜行を再開せよ。` }];
  const frags = q.filter(x => x.fragments.length).map(x => ({ ...x, lines: [] }));
  ui.textSeq(text, () => ui.result(r, () => (frags.length ? ui.story(frags, thaw) : thaw())), 'lost');
}
// チュートリアル再実行：記録に残らない練習戦闘
function practice() {
  clearBattle(); app.innerHTML = '';
  const tut = game.tutorialData(); if (!tut) return;
  battle = createBattle(app, reg, rng, {
    mode: tut.mode, floor: tut.floor, enemy: tut.enemy, seed, audio, settings: game.s.settings, optic: game.s.optic, debug,
    tutorial: { tut, onDone: () => { ui.toast('チュートリアル完了', 2000); setTimeout(() => hubScreen('records'), 1800); } },
    onEnd: () => setTimeout(() => hubScreen('records'), 400),
  });
  battle.combat.protectHp = true;
}

async function boot() {
  reg = await loadPacks();
  const q = new URLSearchParams(location.search);
  seed = q.has('seed') ? hashSeed(q.get('seed')) : (Date.now() >>> 0);
  rng = makeRng(seed);
  for (const [k, v] of Object.entries(reg.rules.theme || {})) document.documentElement.style.setProperty('--' + k, v);
  game = new Game(reg, rng, q.has('fresh') ? null : load());
  audio = createAudio({ ...reg.rules.audio, bgm: game.s.settings.bgm, sfx: game.s.settings.sfx });
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  ui = createScreens(app, game, reg, { audio, install });
  app.innerHTML = '';
  if (reg.errors.length) showErrors(reg.errors);
  if (reg.all('modes').length) title();
}

boot().catch(e => { app.innerHTML = ''; showErrors([String(e?.stack || e)]); });

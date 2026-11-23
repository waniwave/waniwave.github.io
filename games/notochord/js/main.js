// main.js — 起動、画面の切り替え、保存と読み込み
// 段階2：タイトル → 試験戦闘 → 結果。本格的な画面（培養槽など）は段階3で screens.js に作る。
import { loadPacks } from './engine/registry.js';
import { makeRng, hashSeed, fmt } from './util.js';
import { createBattle } from './ui/battle.js';
import { createAudio } from './audio.js';

const app = document.getElementById('app');
const settings = { reduceFlash: false, bgm: 0.6, sfx: 0.8 };
let reg, rng, seed, audio, battle = null;

function showErrors(errors) {
  const box = document.createElement('div');
  box.className = 'errors';
  box.innerHTML = `<b>CONTENT ERROR ×${errors.length}</b>`;
  for (const e of errors) { const d = document.createElement('div'); d.textContent = e; box.appendChild(d); }
  box.addEventListener('click', () => box.remove());
  app.appendChild(box);
}

function clear() { battle?.destroy(); battle = null; app.innerHTML = ''; }

function title() {
  clear(); audio.stopBgm();
  const d = document.createElement('div');
  d.className = 'title';
  d.innerHTML = `
    <div class="t-wire"></div>
    <h1>N O T O C H O R D</h1>
    <p class="t-spec">ACTIVE SPECIMEN: DIVER #01</p>
    <button class="t-main" data-mode="rank_d" data-floor="1">[ 試験戦闘 // RANK D 1F ]</button>
    <div class="t-dbg"><small>DEBUG：</small></div>`;
  const dbg = d.querySelector('.t-dbg');
  for (const m of reg.all('modes').sort((a, b) => a.order - b.order)) for (const f of m.bossFloors ?? []) {
    const b = document.createElement('button'); b.textContent = `${m.name.replace('RANK ', '')}-${f}`;
    b.dataset.mode = m.id; b.dataset.floor = f; dbg.appendChild(b);
  }
  d.addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]'); if (!b) return;
    audio.unlock(); fight(b.dataset.mode, Number(b.dataset.floor));
  });
  app.appendChild(d);
}

function fight(mode, floor) {
  clear();
  battle = createBattle(app, reg, rng, {
    mode, floor, seed, settings, audio,
    mutagens: [], ampoules: ['amp_cold', 'amp_burn'],
    onEnd: r => result(r, mode, floor),
  });
  globalThis.__notochord = battle;   // デバッグ用（段階4で外す）
}

function result(r, mode, floor) {
  audio.stopBgm();
  const d = document.createElement('div');
  d.className = 'result ' + (r.won ? 'won' : 'lost');
  const cause = { sync: '神経定着率 0%', backflow: '逆流汚染 100%' }[r.cause] ?? '';
  d.innerHTML = `
    <h2>${r.won ? 'TARGET DOWN' : 'SPECIMEN LOST'}</h2>
    <p class="r-sub"></p>
    <dl><dt>ターン</dt><dd>${r.turns}</dd><dt>1ターン最大</dt><dd>${fmt(r.best)}</dd><dt>最大連結</dt><dd>${r.maxChain}</dd></dl>
    <div class="r-btns"><button data-a="again">もう一度</button><button data-a="title">タイトルへ</button></div>`;
  d.querySelector('.r-sub').textContent = r.won ? `${r.enemy.name} を撃破` : cause;
  d.addEventListener('click', e => {
    const a = e.target.closest('button')?.dataset.a;
    if (a === 'again') fight(mode, floor); else if (a === 'title') title();
  });
  app.appendChild(d);
}

async function boot() {
  reg = await loadPacks();
  const q = new URLSearchParams(location.search);
  seed = q.has('seed') ? hashSeed(q.get('seed')) : (Date.now() >>> 0);
  rng = makeRng(seed);
  for (const [k, v] of Object.entries(reg.rules.theme || {})) document.documentElement.style.setProperty('--' + k, v);
  audio = createAudio({ ...reg.rules.audio, bgm: settings.bgm, sfx: settings.sfx });
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  app.innerHTML = '';
  if (reg.all('modes').length) title();
  if (reg.errors.length) showErrors(reg.errors);
}

boot().catch(e => { app.innerHTML = ''; showErrors([String(e?.stack || e)]); });

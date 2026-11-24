// screens.js — タイトル、プロローグ、解凍、培養槽（背骨・倉庫・ブローカー・契約・記録）、標本棚、侵入経路、報酬、
//              抜去／深部潜行、結果、ロスト演出、ストーリーの表示
import { BigNum, fmt } from '../util.js';

const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = x => { const n = Number(x); return Number.isInteger(n) ? fmt(n) : String(+n.toFixed(2)); };

// ---- 共通の描画部品（盤面・カード画像で使う） ----
export const gfx = {
  hex(g, x, y, rad) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i; g.lineTo(x + rad * Math.cos(a), y + rad * Math.sin(a)); } g.closePath(); },
  pill(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); g.fill(); },
  symbol(g, kind, x, y, k, col) {
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = Math.max(1.5, k * 0.16); g.lineJoin = 'round';
    g.beginPath();
    if (kind === 'bone') { g.moveTo(x, y - k); g.lineTo(x + k * 0.62, y); g.lineTo(x, y + k); g.lineTo(x - k * 0.62, y); g.closePath(); g.fill(); }
    else if (kind === 'drop') {
      g.moveTo(x, y - k); g.bezierCurveTo(x + k * 0.95, y + 0.05 * k, x + k * 0.7, y + k * 0.9, x, y + k * 0.9);
      g.bezierCurveTo(x - k * 0.7, y + k * 0.9, x - k * 0.95, y + 0.05 * k, x, y - k); g.fill();
    } else if (kind === 'bolt') {
      g.moveTo(x + k * 0.3, y - k); g.lineTo(x - k * 0.5, y + k * 0.12); g.lineTo(x - k * 0.02, y + k * 0.12);
      g.lineTo(x - k * 0.3, y + k); g.lineTo(x + k * 0.5, y - k * 0.16); g.lineTo(x + k * 0.04, y - k * 0.16); g.closePath(); g.fill();
    } else if (kind === 'pulse') {
      g.moveTo(x - k, y); g.lineTo(x - k * 0.4, y); g.lineTo(x - k * 0.2, y - k * 0.6);
      g.lineTo(x + k * 0.1, y + k * 0.6); g.lineTo(x + k * 0.3, y); g.lineTo(x + k, y); g.stroke();
    }
  },
  bracket(g, x, y, k, l) {
    g.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.moveTo(x + sx * k, y + sy * k - sy * l); g.lineTo(x + sx * k, y + sy * k); g.lineTo(x + sx * k - sx * l, y + sy * k); }
    g.stroke();
  },
  // ノード1個の本体（画像キャッシュに焼く）。state: n=通常 / l=届く / p=なぞり中。look/label：圧縮段階の見た目と名前
  cell(g, x, y, s, { panel, necro, state, col, sym, look, label }) {
    gfx.hex(g, x, y, s * 0.9); g.fillStyle = panel; g.fill();
    if (necro) {
      g.fillStyle = '#16191a'; g.fill(); g.strokeStyle = '#4a4f50'; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = '#5a5f60'; g.beginPath();
      g.moveTo(x - s * 0.4, y - s * 0.3); g.lineTo(x - s * 0.05, y + s * 0.05); g.lineTo(x + s * 0.15, y - s * 0.2);
      g.moveTo(x - s * 0.05, y + s * 0.05); g.lineTo(x + s * 0.1, y + s * 0.45); g.stroke(); return;
    }
    const inPath = state === 'p', lit = state === 'l';
    g.globalAlpha = inPath ? 0.6 : lit ? 0.42 : 0.24; g.fillStyle = col; g.fill(); g.globalAlpha = 1;
    g.strokeStyle = col; g.lineWidth = inPath ? 3 : 1.5; g.stroke();
    if (inPath || lit) { g.globalAlpha = inPath ? 0.45 : 0.22; g.lineWidth = inPath ? 7 : 5; g.stroke(); g.globalAlpha = 1; }
    if (look === 'ring') { gfx.hex(g, x, y, s * 0.68); g.lineWidth = 2; g.stroke(); }
    else if (look === 'organ') {
      g.beginPath();
      for (let i = 0; i <= 24; i++) { const a = Math.PI * 2 * i / 24, w = s * 0.56 * (1 + 0.09 * Math.sin(a * 3)); g.lineTo(x + w * Math.cos(a), y + w * Math.sin(a)); }
      g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1; g.lineWidth = 2; g.stroke();
    }
    gfx.symbol(g, sym, x, y, s * (label ? 0.3 : 0.4), look === 'organ' ? '#000' : col);
    if (label) { g.fillStyle = col; g.font = `600 ${Math.max(12, s * 0.3)}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x, y + s * 0.62); }
  },
  poly(g, x, y, s, col, a0) {
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i < 6; i++) { const a = a0 + Math.PI / 3 * i; g.lineTo(x + s * 0.62 * Math.cos(a), y + s * 0.62 * Math.sin(a)); }
    g.closePath(); g.stroke(); g.beginPath();
    for (let i = 0; i < 3; i++) { const a = -a0 + Math.PI * 2 / 3 * i; g.lineTo(x + s * 0.6 * Math.cos(a), y + s * 0.6 * Math.sin(a)); }
    g.closePath(); g.stroke();
  },
  // 特殊ノードの上乗せ（露出神経の照準・時限・残骸・網）
  special(g, look, x, y, s, alert, count) {
    if (look === 'bracket') { g.strokeStyle = alert; g.lineWidth = 2.5; gfx.bracket(g, x, y, s * 0.78, s * 0.28); }
    else if (look === 'countdown') {
      const bx = x + s * 0.5, by = y - s * 0.5, br = s * 0.28;
      g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fillStyle = alert; g.fill();
      g.fillStyle = '#fff'; g.font = `700 ${Math.max(12, br * 1.3)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(count), bx, by + 1);
    } else if (look === 'wreck') {
      gfx.hex(g, x, y, s * 0.62); g.fillStyle = '#050505'; g.fill(); g.strokeStyle = '#d8d0c0'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#d8d0c0'; g.font = `700 ${Math.max(12, s * 0.28)}px monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('#', x, y);
    } else if (look === 'web') {
      gfx.hex(g, x, y, s * 0.9); g.fillStyle = '#000a'; g.fill();
      g.strokeStyle = '#9aa5a7'; g.lineWidth = 1.2; g.beginPath();
      for (let i = 0; i < 3; i++) { const a = Math.PI / 3 * i + 0.3; g.moveTo(x - s * 0.8 * Math.cos(a), y - s * 0.8 * Math.sin(a)); g.lineTo(x + s * 0.8 * Math.cos(a), y + s * 0.8 * Math.sin(a)); }
      g.stroke();
    }
  },
  // 主脊髄の枠（光彩は一度だけ焼く）。yOf(r)：行の中心の y
  spineCol(g, x, rows, yOf, s, h, { panel, line, glow, wild }) {
    g.shadowColor = glow; g.shadowBlur = wild ? 14 : 6;
    for (let r = 0; r < rows; r++) { gfx.hex(g, x, yOf(r), s * 1.06); g.fillStyle = panel; g.fill(); g.strokeStyle = wild ? '#ffffffaa' : line; g.lineWidth = 3; g.stroke(); }
    g.shadowBlur = 0; g.fillStyle = line;
    for (let r = 0; r < rows - 1; r++) {
      const y = yOf(r) + h / 2;
      gfx.pill(g, x - s * 1.25, y - s * 0.07, s * 0.35, s * 0.14, s * 0.07); gfx.pill(g, x + s * 0.9, y - s * 0.07, s * 0.35, s * 0.14, s * 0.07);
    }
  },
  // 画素を白黒に（invert:true で反転も）。描画済みの画像を一度だけ変換する用途
  tone(g, w, h, invert) {
    const im = g.getImageData(0, 0, w, h), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const y = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; d[i] = d[i + 1] = d[i + 2] = invert ? 255 - y : y * 0.75; }
    g.putImageData(im, 0, 0);
  },
};
// #rgb / #rrggbb(aa) の彩度を k 倍にする（1 でそのまま）
export function desaturate(hex, k) {
  if (k >= 1 || typeof hex !== 'string' || hex[0] !== '#') return hex;
  let h = hex.slice(1); if (h.length <= 4) h = [...h].map(x => x + x).join('');
  const n = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)), y = n[0] * 0.3 + n[1] * 0.59 + n[2] * 0.11;
  return '#' + n.map(v => Math.round(y + (v - y) * k).toString(16).padStart(2, '0')).join('') + h.slice(6);
}
// 戦闘のデバッグ欄（タイトルのロゴを10回タップで有効）
export function debugPanel(box, { reg, cb, settings, seed, specials, onChange, canReset }) {
  const R = reg.rules, board = cb.board, E = cb.enemy;
  box.innerHTML = '';
  const add = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { fn(b); onChange(); }; box.appendChild(b); return b; };
  const head = t => { const h = document.createElement('small'); h.textContent = t; box.appendChild(h); };
  head('盤面');
  for (const d of specials) add('+ ' + d.name, () => board.placeSpecial(d.id));
  add('盤面リセット', () => { if (canReset()) board.fill(); });
  head('状態');
  add('臨界ゲージ満タン', () => { cb.gauge = R.spineBreak.max; });
  add('敵HP → 1', () => { E.hp = BigNum.from(1); });
  add('SYNC 回復', () => { cb.sync = cb.syncMax; });
  add('SYNC −40', () => { cb.sync = Math.max(1, cb.sync - 40); });
  add('逆流 +30', () => { cb.backflowOn = true; cb.backflow = Math.min(99, cb.backflow + 30); });
  add('アンプル補充', () => { const all = reg.all('ampoules').map(a => a.id); cb.ampoules = cb.ampoules.map((_, i) => all[(cb.turn * 2 + i) % all.length]); });
  const fl = () => '点滅軽減 ' + (settings.reduceFlash ? 'ON' : 'OFF');
  add(fl(), b => { settings.reduceFlash = !settings.reduceFlash; b.textContent = fl(); });
  head('変異因子');
  add('すべて外す', () => { cb.mutagens = []; });
  for (const m of reg.all('mutagens')) add(`+ ${m.name}`, () => {
    if (cb.mutagens.some(x => x.id === m.id)) return;
    if (cb.mutagens.length >= R.combat.mutagenSlots) cb.mutagens.shift();
    cb.mutagens.push(m);
  });
  head('seed ' + (seed ?? '-'));
}

export function createScreens(root, game, reg, deps = {}) {
  const A = deps.audio;
  const R = reg.rules;
  const strains = Object.fromEntries(reg.all('strains').map(s => [s.id, s]));
  const rar = id => reg.get('rarities', id);
  const regionName = id => R.vertebra.regions.find(r => r.id === id)?.name ?? id;
  const modeName = id => reg.get('modes', id)?.name ?? id;

  function view(cls, html) {
    root.innerHTML = '';
    const d = document.createElement('div'); d.className = 'scr ' + cls; d.innerHTML = html;
    root.appendChild(d);
    d.addEventListener('pointerdown', () => A?.unlock(), { once: true });
    return d;
  }
  const on = (d, sel, fn) => d.querySelectorAll(sel).forEach(n => n.addEventListener('click', e => { A?.tick?.(); fn(n, e); }));

  // ---- 義体の表示 ----
  function vertDesc(it) {
    const t = game.tmpl(it), r = rar(it.rarity), v = t.base * (r?.mul ?? 1);
    const sub = s => String(s ?? '').replace(/\$/g, num(v));
    return { name: t.name, region: regionName(t.region), strain: strains[t.strain], label: sub(t.label), desc: sub(t.desc), rarity: r,
      affixes: it.affixes.map(a => reg.get('affixes', a)).filter(Boolean).map(a => a.label.replace(/\$/g, num(a.base))) };
  }
  function vertCard(it, extra = '') {
    const d = vertDesc(it);
    return `<div class="vcard" style="--rc:${d.rarity?.color}"><div class="vc-h"><b>${esc(d.name)}</b><small>${esc(d.rarity?.name)}</small></div>
      <div class="vc-t">${esc(d.region)} ／ ${esc(d.strain?.icon)} ${esc(d.strain?.name)}</div><div class="vc-d">${esc(d.desc)}</div>
      ${d.affixes.map(a => `<div class="vc-a">＋ ${esc(a)}</div>`).join('')}${extra}</div>`;
  }
  const mutCard = (id, extra = '') => {
    const m = reg.get('mutagens', id); if (!m) return '';
    return `<div class="vcard mcard" style="--rc:${rar(m.rarity)?.color}"><div class="vc-h"><b>${esc(m.name)}</b><small>${esc(rar(m.rarity)?.name)}</small></div>
      <div class="vc-t">${esc(strains[m.strain]?.icon)} ${esc(strains[m.strain]?.name)}</div><div class="vc-d">${esc(m.desc)}</div>${extra}</div>`;
  };

  // ---- タイトル ----
  // 記録（最深到達・最大ダメージ・最大連結数・累計ロスト）
  function recordsHtml() {
    const rec = game.s.records;
    const cleared = game.modes().filter(m => m.floors > 0 && rec.clears[m.id]).at(-1);
    const abyss = game.modes().filter(m => !m.floors && !m.locked);
    return `<dl class="t-rec"><dt>最深到達</dt><dd>${abyss.map(m => `${esc(m.title ?? m.name)} ${rec.deepest[m.id] ?? 0}層`).join(' ') || (cleared ? esc(cleared.name) + ' 完遂' : '—')}</dd>
      <dt>最大ダメージ</dt><dd>${fmt(BigNum.from(rec.maxDamage))}</dd><dt>最大連結数</dt><dd>${rec.maxChain}</dd>
      <dt>累計潜行</dt><dd>${rec.runs}</dd><dt>累計ロスト</dt><dd>${rec.lost}</dd></dl>`;
  }
  // タイトル。ロゴを10回叩くとデバッグ（試験戦闘・各ボス階層・戦闘中の DBG）が出る
  function title(onStart, dbg = {}) {
    const s = game.s;
    const d = view('title', `
      <div class="t-wire"></div>
      <h1 class="logo">N O T O C H O R D</h1>
      <p class="t-spec">ACTIVE SPECIMEN: DIVER #${String(s.specimen).padStart(2, '0')}${s.diver ? '' : '（解凍待ち）'}</p>
      ${recordsHtml()}
      <button class="t-main">[ 神経接続 // JACK-IN ]</button>
      <button class="t-set">設定</button>
      ${deps.install?.available() ? '<button class="t-install">⤓ ホーム画面に追加</button>' : ''}
      <div class="t-dbg" ${dbg.on ? '' : 'hidden'}><small>DEBUG：</small><button data-mode="rank_d" data-floor="1">試験戦闘</button>
        ${game.modes().flatMap(m => (m.bossFloors ?? (m.bossEvery ? [m.bossEvery, m.bossEvery * 10] : [])).map(f => `<button data-mode="${m.id}" data-floor="${f}">${esc(m.name.replace('RANK ', ''))}-${f}</button>`)).join('')}</div>`);
    on(d, '.t-main', () => onStart());
    on(d, '.t-set', () => settings(dbg.h));
    on(d, '.t-install', () => deps.install.run());
    let taps = 0;
    d.querySelector('.logo').addEventListener('click', () => { if (++taps >= 10 && !dbg.on) { dbg.unlock?.(); d.querySelector('.t-dbg').hidden = false; toast('DEBUG MODE'); } });
    on(d, '.t-dbg button[data-mode]', n => dbg.fight?.(n.dataset.mode, Number(n.dataset.floor)));
  }

  // ---- 文章を1行ずつ（プロローグ・ロスト演出） ----
  function textSeq(lines, done, cls = '') {
    const d = view('seq ' + cls, `<div class="seq-box"></div><small class="seq-tap">タップで進む</small>`);
    const box = d.querySelector('.seq-box');
    let i = 0;
    const next = () => {
      if (i >= lines.length) { done(); return; }
      const l = lines[i++], p = document.createElement('p');
      p.innerHTML = `<small>${esc(l.speaker ?? 'CEREBRUM')}</small><span></span>`;
      box.appendChild(p);
      typeText(p.lastChild, l.text);
    };
    d.addEventListener('click', next);
    next();
  }
  function typeText(node, text) {
    let k = 0; const t = String(text);
    const step = () => { node.textContent = t.slice(0, ++k); if (k < t.length) setTimeout(step, 18); };
    step();
  }

  // ---- 解凍（素質の選択） ----
  function thaw(done) {
    const lines = game.takeQueue().flatMap(q => q.lines).filter(l => l.event !== 'BROKER');
    const prot = game.protocolTraits();
    const d = view('thaw', `
      <header class="sh"><b>培養槽 // 解凍</b><small>検体 #${game.s.specimen}</small></header>
      <p class="cer">${esc(lines[0]?.text ?? `……新規検体 #${game.s.specimen} の培養株を指定せよ。`)}</p>
      ${prot.length ? `<p class="prot">転写される形質：${prot.map(p => esc(p.def.name) + ' ' + 'ⅠⅡⅢ'[p.tier - 1]).join('、')}</p>` : ''}
      <div class="lin-list">${game.lineages().map(l => `
        <button class="lin ${l.locked ? 'locked' : ''}" data-id="${l.id}" ${l.locked ? 'disabled' : ''}>
          <div class="lin-h"><b>${esc(l.name)}</b><small>${esc(l.code)}</small>${l.strain ? `<i>[${esc(strains[l.strain]?.name)} +1]</i>` : ''}</div>
          <div class="lin-p">＋ ${esc(l.pros)}</div><div class="lin-c">− ${esc(l.cons)}</div>
          <div class="lin-d">${l.locked ? '未開放' : esc(l.desc)}</div></button>`).join('')}</div>`);
    on(d, '.lin', n => { if (game.thaw(n.dataset.id)) done(); });
  }

  // ---- 培養槽 ----
  function hub(tab, h) {
    const s = game.s, dv = game.diver, lin = game.lineage();
    const lv = game.careerLevel(), L = R.career.levels;
    const next = L[lv + 1], cur = L[lv];
    const d = view('hub', `
      <header class="sh hub-h">
        <div><b>検体 #${s.specimen}</b><small>${esc(lin?.name ?? '—')} ／ 熟練 Lv.${lv}</small>
          <div class="xp"><i style="width:${next ? Math.round(((dv?.points ?? 0) - cur) / (next - cur) * 100) : 100}%"></i></div></div>
        <div class="syn">SYN <b>${fmt(s.syn)}</b><button class="gear" title="設定">⚙</button></div>
      </header>
      <div class="hub-rec">最深 ${Object.entries(s.records.deepest).filter(([id]) => !reg.get('modes', id)?.floors).map(([, f]) => f + '層').join(' ') || '—'} ／ 最大 ${fmt(BigNum.from(s.records.maxDamage))} ／ 最大連結 ${s.records.maxChain} ／ ロスト ${s.records.lost}</div>
      <section class="hub-body"></section>
      <nav class="tabs">${[['spine', '背骨'], ['vault', '倉庫'], ['broker', 'ブローカー'], ['contract', '契約'], ['records', '記録']]
        .map(([k, t]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${t}</button>`).join('')}</nav>`);
    on(d, '.tabs button', n => hub(n.dataset.tab, h));
    on(d, '.gear', () => settings(h));
    const body = d.querySelector('.hub-body');
    const again = () => { h.save(); hub(tab, h); };
    ({ spine: tabSpine, vault: tabVault, broker: tabBroker, contract: tabContract, records: tabRecords })[tab](body, h, again);
  }

  function tabSpine(body, h, again) {
    const res = game.resonance();
    const regs = R.vertebra.regions;
    body.innerHTML = `
      <div class="xray">${regs.map(r => {
        const n = game.socketCount(r.id);
        return `<div class="vrow"><span class="vreg">${esc(r.name)}</span>${[0, 1].map(slot => {
          if (slot >= n) return `<div class="sock closed">${slot === 0 ? '未開通' : '補助'}</div>`;
          const it = game.item(game.s.equipped[r.id][slot]);
          if (!it) return `<button class="sock empty" data-r="${r.id}" data-s="${slot}">＋ 装着</button>`;
          const v = vertDesc(it);
          return `<button class="sock full" data-r="${r.id}" data-s="${slot}" style="--rc:${v.rarity.color}"><b>${esc(v.name)}</b><small>${esc(v.strain?.icon)} ${esc(v.label)}</small></button>`;
        }).join('')}</div>`;
      }).join('<div class="vdisc"></div>')}</div>
      <div class="res">${reg.all('strains').filter(st => st.resonance).map(st => {
        const c = res.counts[st.id] || 0, tiers = st.resonance.filter(t => c >= t.at);
        return `<div class="res-row ${c ? '' : 'dim'}"><span>${esc(st.icon)} ${esc(st.name)} ${c}</span><small>${tiers.map(t => esc(t.label)).join(' ／ ') || '—'}</small></div>`;
      }).join('')}</div>
      <div class="pouch">首筋ポート：${game.s.ampoules.slice(0, game.ampouleSlots()).map(a => esc(reg.get('ampoules', a)?.name)).join('、') || '空'}（${game.ampouleSlots()}枠）</div>
      ${game.canPreserve() ? `<button class="wide preserve">[ 保存処置 ] 熟練 Lv.${game.careerLevel()} の検体を殿堂入りさせる</button>` : ''}`;
    on(body, '.sock.empty, .sock.full', n => pickVert(n.dataset.r, Number(n.dataset.s), h, again));
    on(body, '.preserve', () => preserve(h));
  }
  function pickVert(region, slot, h, again) {
    const items = game.storedItems().filter(i => game.tmpl(i).region === region);
    const cur = game.item(game.s.equipped[region][slot]);
    modal(`<b>${esc(regionName(region))} ソケット${slot ? '（補助）' : ''}</b>
      ${cur ? vertCard(cur, `<button class="unequip">外す</button>`) : ''}
      <div class="mlist">${items.map(it => vertCard(it, `<button class="eq" data-u="${it.uid}">装着</button>`)).join('') || '<p class="dim">倉庫にこの部位の義体がない。</p>'}</div>`,
    m => {
      on(m, '.eq', n => { game.equip(Number(n.dataset.u), region, slot); A?.ampoule?.(); closeModal(); again(); });
      on(m, '.unequip', () => { game.unequip(region, slot); closeModal(); again(); });
    });
  }
  function tabVault(body, h, again) {
    const items = game.s.vault;
    const cap = game.vaultCap(), stored = game.storedItems().length;
    body.innerHTML = `<p class="note">倉庫 ${stored}/${cap}${stored > cap ? ' <b class="warn">あふれている：売却して空けること</b>' : ''}　装着中の義体はロストすると砕ける。</p>
      <div class="mlist">${items.map(it => vertCard(it, game.isEquipped(it.uid) ? '<small class="eqd">装着中</small>' :
        `<button class="sell" data-u="${it.uid}">売却 ${fmt(game.sellPrice(it))} SYN</button>`)).join('') || '<p class="dim">空</p>'}</div>`;
    on(body, '.sell', n => { game.sell(Number(n.dataset.u)); again(); });
  }
  function tabBroker(body, h, again) {
    const out = game.emit('BROKER', {});
    game.takeQueue();
    const shop = game.shop();
    const next = game.opticNext();
    body.innerHTML = `
      <p class="broker">${esc(out.lines[0]?.text ?? '……')}</p>
      <h4>椎骨義体</h4><div class="mlist">${shop.items.map((x, i) => vertCard(x.inst, `<button class="buy" data-i="${i}" ${game.s.syn < x.price ? 'disabled' : ''}>購入 ${fmt(x.price)} SYN</button>`)).join('') || '<p class="dim">売り切れ。次の潜行後に入荷する。</p>'}</div>
      <h4>系統を指定して購入（${fmt(game.strainPrice())} SYN・STANDARD）</h4>
      <div class="row">${reg.all('strains').filter(s => s.resonance).map(s => `<button class="bs" data-s="${s.id}" ${game.s.syn < game.strainPrice() ? 'disabled' : ''}>${esc(s.icon)} ${esc(s.name)}</button>`).join('')}</div>
      <h4>神経アンプル（所持 ${game.s.ampoules.length}/${game.ampouleSlots()}）</h4>
      <div class="row">${reg.all('ampoules').filter(a => game.unlocked(a)).map(a => `<button class="ba" data-a="${a.id}" title="${esc(a.desc)}" ${game.s.syn < game.ampoulePrice(a) || game.s.ampoules.length >= game.ampouleSlots() ? 'disabled' : ''}>${esc(a.name)} ${fmt(game.ampoulePrice(a))}</button>`).join('')}</div>
      <h4>その他</h4>
      <div class="row"><button class="optic" ${!next || game.s.syn < next.price ? 'disabled' : ''}>視神経予測網 Lv.${game.s.optic}${next ? ` → ${next.lv}（${fmt(next.price)}）` : '（最大）'}</button>
        <button class="vx" ${game.s.syn < R.shop.vaultPrice ? 'disabled' : ''}>倉庫 +${R.shop.vaultStep}枠（${fmt(R.shop.vaultPrice)}）</button></div>`;
    on(body, '.buy', n => { game.buy(Number(n.dataset.i)); again(); });
    on(body, '.bs', n => { const it = game.buyStrain(n.dataset.s); if (it) toast(`購入：${game.tmpl(it).name}`); again(); });
    on(body, '.ba', n => { game.buyAmpoule(n.dataset.a); again(); });
    on(body, '.optic', () => { game.upgradeOptic(); again(); });
    on(body, '.vx', () => { game.expandVault(); again(); });
  }
  function tabContract(body, h) {
    body.innerHTML = `<div class="mlist">${game.modes().map(m => {
      const starts = m.locked ? [] : game.startDepths(m.id);
      const deep = game.s.records.deepest[m.id];
      return `<div class="mode ${m.locked ? 'locked' : ''}">
        <div class="vc-h"><b>${esc(m.name)}：${esc(m.title ?? '')}</b><small>${m.floors ? m.floors + '階層' : '∞'}</small></div>
        <div class="vc-t">${esc(m.sub ?? '')}${m.clears ? ` ／ 完遂 ${m.clears}回` : ''}${!m.floors && deep ? ` ／ 最深 ${deep}層` : ''}</div>
        ${m.locked ? '<div class="vc-d">未開放</div>' : `<div class="row">${starts.map(f => `<button class="go" data-m="${m.id}" data-f="${f}">${starts.length > 1 ? f + '層から' : '[ JACK-IN ]'}</button>`).join('')}</div>`}
      </div>`;
    }).join('')}</div>
      <p class="note">潜行中の死亡（ロスト）では、装着中の義体とその潜行で拾った義体がすべて砕ける。</p>`;
    on(body, '.go', n => h.startRun(n.dataset.m, Number(n.dataset.f)));
  }
  function tabRecords(body, h, again) {
    const s = game.s, rec = s.records;
    const frags = reg.all('story').filter(x => x.type === 'fragment');
    body.innerHTML = `
      <dl class="t-rec"><dt>累計潜行</dt><dd>${rec.runs}</dd><dt>抜去</dt><dd>${rec.extracts}</dd><dt>ロスト</dt><dd>${rec.lost}</dd>
        <dt>最大出力</dt><dd>${fmt(BigNum.from(rec.maxDamage))}</dd><dt>最大連結</dt><dd>${rec.maxChain}</dd>
        <dt>義体図鑑</dt><dd>${s.codex.length}/${reg.all('vertebrae').length}</dd></dl>
      <h4>標本棚と培養プロトコル（${game.protocolSlots()}枠）</h4>
      <div class="mlist">${s.shelf.map((x, i) => {
        const t = x.trait && reg.get('traits', x.trait.id); const inP = s.protocol.includes(i);
        return `<div class="vcard spec"><div class="vc-h"><b>#${x.specimen} ${esc(reg.get('lineages', x.lineage)?.name)}</b><small>熟練 Lv.${x.level}</small></div>
          <div class="vc-t">潜行 ${x.runs} ／ 抜去 ${x.extracts} ／ 最大 ${fmt(BigNum.from(x.maxDamage))}${x.deepest ? ' ／ ' + esc(modeName(x.deepest.mode)) + ' ' + x.deepest.floor + 'F' : ''}</div>
          ${t ? `<div class="vc-d">形質：${esc(t.name)} ${'ⅠⅡⅢ'[x.trait.tier - 1]} — ${esc(traitLabel(t, x.trait))}</div>
          <button class="proto" data-i="${i}">${inP ? 'プロトコルから外す' : 'プロトコルに組み込む'}</button>` : ''}</div>`;
      }).join('') || '<p class="dim">まだ保存標本はない。熟練 Lv.3 以上の検体を「背骨」タブで保存処置できる。</p>'}</div>
      <h4>断片ログ ${game.mem.fragments.size}/${frags.length}</h4>
      <div class="frags">${frags.map(f => game.mem.fragments.has(f.id) ? `<button class="frag" data-f="${f.id}">${esc(f.title)}</button>` : `<span class="frag dim">██████</span>`).join('')}</div>
      <h4>残留ログ</h4>
      <div class="frags">${s.residue.map(x => `<p class="residue">${esc(residueText(x))}</p>`).join('') || '<p class="dim">—</p>'}</div>
      <h4>潜行記録カード（自己ベスト）</h4>
      <div class="row"><button class="best" data-k="deepest" ${s.bestCards.deepest ? '' : 'disabled'}>最深到達</button>
        <button class="best" data-k="maxDamage" ${s.bestCards.maxDamage ? '' : 'disabled'}>最大ダメージ</button>
        <button class="codex">義体図鑑 ${s.codex.length}/${reg.all('vertebrae').length}</button><button class="set-open">設定</button></div>`;
    on(body, '.best', n => cardModal(s.bestCards[n.dataset.k]));
    on(body, '.codex', () => codex());
    on(body, '.set-open', () => settings(h));
    on(body, '.proto', n => {
      const i = Number(n.dataset.i);
      if (s.protocol.includes(i)) game.setProtocol(s.protocol.indexOf(i), null);
      else if (s.protocol.length < game.protocolSlots()) game.setProtocol(s.protocol.length, i);
      else toast('プロトコルの枠が埋まっている');
      again();
    });
    on(body, '.frag[data-f]', n => { const f = reg.get('story', n.dataset.f); modal(`<b>${esc(f.title)}</b><p class="fragtext">${esc(f.text)}</p>`); });
  }

  // ---- 設定 ----
  function settings(h) {
    const st = game.s.settings;
    modal(`<b>設定</b>
      <label class="slider">BGM <input type="range" min="0" max="1" step="0.05" value="${st.bgm}" data-k="bgm"><output>${Math.round(st.bgm * 100)}%</output></label>
      <label class="slider">効果音 <input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-k="sfx"><output>${Math.round(st.sfx * 100)}%</output></label>
      <div class="row"><button class="flash">強い点滅・ネガ反転を弱める：${st.reduceFlash ? 'ON' : 'OFF'}</button></div>
      <div class="row"><button class="s-tut">チュートリアルを再実行</button></div>
      ${deps.install?.available() ? '<div class="row"><button class="inst">ホーム画面に追加</button></div>' : ''}
      <div class="row"><button class="wipe">セーブを初期化</button></div>`, m => {
      on(m, '.inst', () => deps.install.run());
      m.querySelectorAll('input[type=range]').forEach(inp => inp.addEventListener('input', () => {
        st[inp.dataset.k] = Number(inp.value); inp.nextElementSibling.textContent = Math.round(inp.value * 100) + '%'; h?.applySettings(); h?.save();
      }));
      on(m, '.flash', n => { st.reduceFlash = !st.reduceFlash; n.textContent = `強い点滅・ネガ反転を弱める：${st.reduceFlash ? 'ON' : 'OFF'}`; h?.save(); });
      on(m, '.s-tut', () => { closeModal(); h?.practice(); });
      on(m, '.wipe', () => modal('<b>セーブを初期化</b><p>すべての検体・義体・記録・断片ログが消える。元に戻せない。</p><button class="wide yes">初期化する</button><button class="wide no">やめる</button>',
        m2 => { on(m2, '.yes', () => h?.wipe()); on(m2, '.no', () => closeModal()); }));
    });
  }

  // ---- 義体図鑑（LOT-Ω は残留ログも読める） ----
  function codex() {
    const seen = new Set(game.s.codex);
    const list = reg.all('vertebrae');
    modal(`<b>義体図鑑 ${seen.size}/${list.length}</b><div class="mlist">${list.map(t => {
      if (!seen.has(t.id)) return `<div class="vcard dim">██████ <small>${esc(regionName(t.region))}</small></div>`;
      const v = t.base * (rar(t.rarityOnly ?? 'STANDARD')?.mul ?? 1);
      return `<div class="vcard" style="--rc:${rar(t.rarityOnly ?? 'STANDARD')?.color}"><div class="vc-h"><b>${esc(t.name)}</b><small>${esc(t.rarityOnly ? rar(t.rarityOnly)?.name : regionName(t.region))}</small></div>
        <div class="vc-t">${esc(regionName(t.region))} ／ ${esc(strains[t.strain]?.icon)} ${esc(strains[t.strain]?.name)}</div><div class="vc-d">${esc(String(t.desc).replace(/\$/g, num(v)))}</div>
        ${t.owner ? `<div class="vc-a">${esc(t.owner)} の残留ログ：${esc(t.log)}</div>` : ''}</div>`;
    }).join('')}</div>`);
  }
  const traitLabel = (t, x) => String(t.label).replace(/\$/g, num(t.values[x.tier - 1])).replace('#{strain}', strains[x.strain]?.name ?? '');
  const residueText = x => `DIVER #${String(x.specimen).padStart(2, '0')} // ${modeName(x.mode)} - ${x.floor}F // 最終出力 ${x.lastDamage} // 焼損した義体: ${x.broken.join('、') || 'なし'} // ${x.word}`;

  // ---- 保存処置 ----
  function preserve(h) {
    const opts = game.preserveOptions();
    modal(`<b>保存処置 // 検体 #${game.s.specimen}</b><p>検体を引退させ、遺伝形質を1つ取り出す。装着中の義体は砕けずに倉庫へ戻る。</p>
      <div class="mlist">${opts.map((o, i) => { const t = reg.get('traits', o.id);
        return `<button class="vcard tr" data-i="${i}"><div class="vc-h"><b>${esc(t.name)}</b><small>段階 ${'ⅠⅡⅢ'[o.tier - 1]}</small></div><div class="vc-d">${esc(traitLabel(t, o))}</div>${t.desc ? `<div class="vc-t">${esc(t.desc)}</div>` : ''}</button>`; }).join('')}</div>`,
    m => on(m, '.tr', n => { closeModal(); h.preserve(Number(n.dataset.i)); }));
  }

  // ---- 侵入経路 ----
  function routes(run, pick) {
    const m = reg.get('modes', run.mode);
    const list = run.routes.map(r => game.routeInfo(r));
    const d = view('routes', `
      <header class="sh"><b>${esc(m.name)} ${run.floor}F</b><small>侵入経路の選択</small></header>
      <div class="tree"><div class="t-root">◉</div><svg class="t-lines" viewBox="0 0 100 40" preserveAspectRatio="none">${list.map((_, i) =>
        `<path d="M50 0 C50 20 ${(i + 0.5) / list.length * 100} 20 ${(i + 0.5) / list.length * 100} 40" />`).join('')}</svg></div>
      <div class="rlist" style="grid-template-columns:repeat(${list.length},1fr)">${list.map((r, i) => `
        <button class="route ${r.kind}" data-i="${i}">
          <div class="r-kind">${esc(r.routeDef.icon)} ${esc(r.boss ? 'ボス' : r.routeDef.name)}</div>
          <div class="r-sil" style="--ec:${r.enemyDef.look?.color ?? '#888'}"></div>
          <b>${esc(r.enemyDef.name)}</b>
          <small>${esc(r.enemyDef.desc ?? '')}</small>
          <div class="r-sp">${r.specials.map(n => `<span>${esc(n.name)}</span>`).join('')}${r.enemyDef.armor ? '<span>外殻装甲</span>' : ''}</div>
          <div class="r-rw">${r.kind === 'elite' ? '義体確定・SYN×1.5' : r.kind === 'vault' ? 'SYN×3・アンプル確定・3ターン' : r.boss ? '義体確定' : '変異因子'}${r.wreck ? '<br><em>残骸あり</em>' : ''}</div>
        </button>`).join('')}</div>`);
    on(d, '.route', n => pick(Number(n.dataset.i)));
  }

  // ---- 報酬 ----
  function reward(run, take) {
    const rw = run.reward;
    const d = view('reward', `
      <header class="sh"><b>${run.floor}F 突破</b><small>未精製 SYN +${fmt(rw.syn)}${rw.overkill ? '（過剰出力 +20%）' : ''}</small></header>
      ${rw.vertebra ? `<p class="note">義体を拾った（抜去すれば倉庫へ）</p>${vertCard(rw.vertebra)}` : ''}
      ${rw.ampoule ? `<p class="note">アンプル：${esc(reg.get('ampoules', rw.ampoule)?.name)}${rw.ampouleLost ? '（首筋ポートが埋まっていて持てない）' : ''}</p>` : ''}
      <h4>変異因子を1つ選ぶ（${run.mutagens.length}/${R.combat.mutagenSlots}）</h4>
      <div class="mlist">${rw.mutagens.map(id => `<button class="pick" data-id="${id}">${mutCard(id)}</button>`).join('')}
        <button class="pick syn" data-syn="1"><div class="vcard"><b>神経素を選ぶ</b><div class="vc-d">未精製 SYN +${fmt(rw.synOption)}</div></div></button></div>`);
    on(d, '.pick', n => {
      if (n.dataset.syn) return take({ type: 'syn' });
      const id = n.dataset.id;
      if (run.mutagens.length >= R.combat.mutagenSlots)
        modal(`<b>捨てる変異因子を選ぶ</b><div class="mlist">${run.mutagens.map((m, i) => `<button class="rp" data-i="${i}">${mutCard(m)}</button>`).join('')}</div>`,
          m => on(m, '.rp', x => { closeModal(); take({ type: 'mutagen', id, replace: Number(x.dataset.i) }); }));
      else take({ type: 'mutagen', id });
    });
  }

  // ---- 抜去／深部潜行 ----
  function choice(run, act) {
    const m = reg.get('modes', run.mode);
    const first = !game.has('help:extract');
    const d = view('choice', `
      <header class="sh"><b>${esc(m.name)} ${run.floor}F ${run.reward?.closed ? '金庫閉鎖' : '突破'}</b><small>次：${run.floor + 1}F ／ 全${m.floors}階層</small></header>
      ${first ? `<p class="cer">神経抜去（EXTRACT）すれば、未精製の神経素と拾った義体を持ち帰れる。深部潜行（DIVE）を続けて死亡すれば、装着中の義体と拾った義体はすべて砕け、神経素は30%しか残らない。判断は、検体に委ねる。</p>` : ''}
      <dl class="t-rec"><dt>SYNC</dt><dd>${run.sync}%</dd><dt>未精製 SYN</dt><dd>${fmt(run.syn)}</dd><dt>拾った義体</dt><dd>${run.found.length}</dd>
        <dt>変異因子</dt><dd>${run.mutagens.length}</dd></dl>
      <div class="mlist">${run.found.map(it => vertCard(it)).join('')}</div>
      <div class="ch-btns"><button class="ex">[ 神経抜去 // EXTRACT ]</button><button class="dv">[ 深部潜行 // DIVE ]<small>SYNC +${R.run.diveHeal}%</small></button></div>`);
    on(d, '.ex', () => { game.mem.flags.add('help:extract'); act('extract'); });
    on(d, '.dv', () => { game.mem.flags.add('help:extract'); act('dive'); });
  }

  // ---- 結果 ----
  function result(r, done) {
    const st = r.stats ?? {};
    const cause = { sync: '神経定着率 0%', backflow: '逆流汚染 100%' }[r.cause] ?? '';
    const head = r.type === 'extract' ? (r.final ? 'CONTRACT COMPLETE' : 'EXTRACTED') : r.type === 'lost' ? 'LOST' : 'PRESERVED';
    const d = view('result ' + r.type, `
      <h2>${head}</h2>
      <p class="r-sub">検体 #${r.specimen} ／ ${esc(reg.get('lineages', r.lineage)?.name ?? '')}${r.mode ? ' ／ ' + esc(modeName(r.mode)) + ' ' + (r.floors ?? r.floor) + 'F' : ''}</p>
      <dl class="t-rec">
        ${r.synGain != null ? `<dt>精製 SYN</dt><dd>+${fmt(r.synGain)}${r.final ? '（完遂 ×1.5）' : ''}${r.type === 'lost' ? `（${Math.round(r.rate * 100)}%）` : ''}</dd>` : ''}
        ${st.maxDamage ? `<dt>1ターン最大</dt><dd>${fmt(BigNum.from(st.maxDamage))}</dd><dt>最大連結</dt><dd>${st.maxChain}</dd>` : ''}
        ${r.type === 'extract' ? `<dt>持ち帰った義体</dt><dd>${r.found.length}</dd><dt>熟練度</dt><dd>Lv.${r.levelBefore} → Lv.${r.levelAfter}</dd>` : ''}
        ${r.type === 'lost' ? `<dt>死因</dt><dd>${esc(cause)}</dd><dt>砕けた義体</dt><dd>${r.destroyed.length + r.foundLost.length}</dd>` : ''}
        ${r.type === 'preserve' ? `<dt>熟練度</dt><dd>Lv.${r.level}</dd><dt>潜行</dt><dd>${r.runs}</dd><dt>最大出力</dt><dd>${fmt(BigNum.from(r.maxDamage))}</dd>` : ''}
      </dl>
      ${r.type === 'lost' ? `<p class="residue">${esc(residueText(r.residue))}</p>` : ''}
      <div class="card-wrap"><img class="card-img" alt="潜行記録カード"></div>
      <div class="row card-btns"><button class="c-save">画像を保存</button><button class="c-share">共有</button></div>
      ${r.type === 'extract' ? `<div class="mlist">${r.found.map(it => vertCard(it)).join('')}</div>` : ''}
      <button class="wide ok">${r.type === 'extract' ? '培養槽へ' : '次の検体を解凍'}</button>`);
    on(d, '.ok', () => done());
    bindCard(d, r);
  }

  // ---- 潜行記録カード（13.3）：1080×1350 の PNG ----
  async function bindCard(node, r) {
    const canvas = await drawCard(r);
    const img = node.querySelector('.card-img');
    if (img) img.src = canvas.toDataURL('image/png');
    const name = `notochord_${r.type}_${String(r.specimen ?? '').padStart(2, '0')}.png`;
    const save = () => canvas.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
    node.querySelectorAll('.c-save').forEach(b => b.addEventListener('click', save));
    node.querySelectorAll('.c-share').forEach(b => b.addEventListener('click', () => canvas.toBlob(async blob => {
      const file = new File([blob], name, { type: 'image/png' });
      try {
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'NOTOCHORD' });
        else save();
      } catch (e) { if (e?.name !== 'AbortError') save(); }
    })));
  }
  function cardModal(r) {
    if (!r) return;
    modal(`<b>潜行記録カード</b><div class="card-wrap"><img class="card-img" alt=""></div><div class="row card-btns"><button class="c-save">画像を保存</button><button class="c-share">共有</button></div>`, m => bindCard(m, r));
  }
  async function drawCard(r) {
    try { await document.fonts?.ready; } catch {}
    const W = 1080, Hh = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
    const c = cv.getContext('2d'), T = R.theme;
    const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace', SANS = '"Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif';
    const accent = r.type === 'lost' ? T.alert : r.type === 'preserve' ? '#FFC83D' : T.pulse;
    // 背景
    const g = c.createRadialGradient(W / 2, Hh * 0.4, 50, W / 2, Hh * 0.4, Hh * 0.8);
    g.addColorStop(0, r.type === 'lost' ? '#2a0610' : '#0f2a2e'); g.addColorStop(1, T.bg);
    c.fillStyle = g; c.fillRect(0, 0, W, Hh);
    c.strokeStyle = T.line; c.lineWidth = 2; c.strokeRect(30, 30, W - 60, Hh - 60);
    const bracket = (x, y, sx, sy) => { c.beginPath(); c.moveTo(x, y + sy * 40); c.lineTo(x, y); c.lineTo(x + sx * 40, y); c.stroke(); };
    c.strokeStyle = accent; c.lineWidth = 4; bracket(30, 30, 1, 1); bracket(W - 30, 30, -1, 1); bracket(30, Hh - 30, 1, -1); bracket(W - 30, Hh - 30, -1, -1);
    const text = (t, x, y, size, color = T.text, font = SANS, align = 'left', weight = 400) => { c.font = `${weight} ${size}px ${font}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillText(t, x, y); };
    const wrap = (t, x, y, w, size, color, lh = 1.5) => {
      c.font = `400 ${size}px ${SANS}`; c.fillStyle = color; c.textAlign = 'left';
      let line = ''; for (const ch of String(t)) { if (c.measureText(line + ch).width > w) { c.fillText(line, x, y); y += size * lh; line = ch; } else line += ch; }
      if (line) c.fillText(line, x, y); return y + size * lh;
    };
    // 上部
    text('N O T O C H O R D', W / 2, 120, 64, '#F2EFE9', MONO, 'center', 700);
    const head = r.type === 'extract' ? (r.final ? 'CONTRACT COMPLETE' : 'EXTRACTED') : r.type === 'lost' ? 'LOST' : 'PRESERVED';
    text(head, W / 2, 205, 56, accent, MONO, 'center', 700);
    text(`DIVER #${String(r.specimen ?? '').padStart(2, '0')} ／ ${reg.get('lineages', r.lineage)?.name ?? ''}`, W / 2, 260, 34, T.text, SANS, 'center');
    // 背骨のX線
    const sp = r.spine || { items: [], tiers: [], sockets: {} };
    const sx = 300, top = 330, rowH = 170;
    c.strokeStyle = '#3be8ff33'; c.lineWidth = 26; c.beginPath(); c.moveTo(sx, top - 10); c.lineTo(sx, top + rowH * 4 - 40); c.stroke();
    R.vertebra.regions.forEach((rg, i) => {
      const y = top + i * rowH;
      text(rg.name, 70, y + 70, 32, T.dim);
      const items = sp.items.filter(x => x.region === rg.id);
      for (let k = 0; k < 2; k++) {
        const x = 150 + k * 310, it = items[k], open = k < (sp.sockets?.[rg.id] ?? (k === 0 ? 1 : 0));
        c.lineWidth = 3;
        if (it) {
          const rr = rar(it.rarity), t = reg.get('vertebrae', it.tid);
          c.fillStyle = '#000a'; c.fillRect(x, y, 290, 120); c.strokeStyle = rr?.color ?? '#888'; c.strokeRect(x, y, 290, 120);
          text(t?.name ?? '?', x + 16, y + 52, 32, '#fff', SANS, 'left', 700);
          text(`${rr?.name ?? ''} ${strains[t?.strain]?.icon ?? ''}`, x + 16, y + 96, 26, rr?.color ?? '#888', MONO);
          if (r.type === 'lost') { c.strokeStyle = T.alert; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 40, y); c.lineTo(x + 120, y + 60); c.lineTo(x + 90, y + 120); c.moveTo(x + 120, y + 60); c.lineTo(x + 230, y + 40); c.stroke(); }
        } else { c.setLineDash([10, 8]); c.strokeStyle = open ? '#3be8ff66' : '#233d42'; c.strokeRect(x, y, 290, 120); c.setLineDash([]); }
      }
    });
    // 数値
    const nx = 790; let ny = 350;
    const stat = (k, v) => { text(k, nx, ny, 26, T.dim); text(v, W - 70, ny + 46, 38, '#fff', MONO, 'right', 700); ny += 104; };
    const st = r.stats ?? {};
    if (r.mode) stat(reg.get('modes', r.mode)?.floors ? '契約' : '深淵', `${reg.get('modes', r.mode)?.name.replace('RANK ', '') ?? ''} ${r.floors ?? r.floor}F`);
    if (r.pollution) stat('汚染段階', String(r.pollution));
    if (st.maxDamage || r.maxDamage) stat('1ターン最大', fmt(BigNum.from(st.maxDamage ?? r.maxDamage)));
    if (st.maxChain != null) stat('最大連結', String(st.maxChain));
    if (r.synGain != null) stat('獲得SYN', '+' + fmt(r.synGain));
    if (r.type === 'preserve') { stat('熟練度', 'Lv.' + r.level); stat('潜行回数', String(r.runs)); }
    // 系統共鳴
    let y = top + rowH * 4 + 10;
    if (sp.tiers?.length) y = wrap('系統共鳴：' + sp.tiers.join(' ／ '), 70, y, W - 140, 28, '#ffcf6b');
    // ロスト時：死因と残留ログ／殿堂入り：遺伝形質
    if (r.type === 'lost') {
      y = wrap('死因：' + ({ sync: '神経定着率 0%', backflow: '逆流汚染 100%' }[r.cause] ?? r.cause), 70, y + 10, W - 140, 32, T.alert);
      if (r.residue) y = wrap(residueText(r.residue), 70, y, W - 140, 26, '#ff9aa8');
    }
    if (r.type === 'preserve' && r.trait) { const t = reg.get('traits', r.trait.id); if (t) y = wrap(`遺伝形質：${t.name} ${'ⅠⅡⅢ'[r.trait.tier - 1]} — ${traitLabel(t, r.trait)}`, 70, y + 10, W - 140, 30, '#ffcf6b'); }
    // 下部：CEREBRUM の一言と日付
    const line = r.type === 'lost' ? '……番号の管理に、支障はない。' : r.type === 'preserve' ? '……よく戻ってきた。' : r.final ? '契約完遂。記録しておく。' : '生還を確認。未精製神経素を精製する。';
    text('CEREBRUM // ' + line, 70, Hh - 110, 30, accent);
    const dt = new Date(r.date ?? r.retiredAt ?? Date.now());
    text(`${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`, W - 70, Hh - 60, 28, T.dim, MONO, 'right');
    return cv;
  }

  // ---- ストーリーの表示（断片ログ・台詞・残留ログ・開放・残骸） ----
  const FLAG = f => f.startsWith('mode:') ? `契約 ${modeName(f.slice(5))} 開放` : f.startsWith('socket:') ? `${regionName(f.slice(7))}ソケット 開通`
    : f.startsWith('lineage:') ? `素質「${reg.all('lineages').find(l => l.unlock === f)?.name ?? f}」開放` : f.startsWith(R.protocol.flagPrefix) ? '培養プロトコルの枠 +1' : null;
  function story(queue, done) {
    const items = [];
    for (const q of queue) {
      for (const l of q.lines) if (l.speaker !== 'BROKER') items.push({ kind: 'line', l });
      for (const t of q.texts || []) items.push({ kind: 'line', l: t });
      for (const f of q.fragments) items.push({ kind: 'frag', f });
      for (const x of q.residue || []) items.push({ kind: 'residue', x });
      if (q.recovered) items.push({ kind: 'toast', t: `残骸から回収：${game.tmpl(q.recovered)?.name}` });
      for (const f of q.unlocked || []) { const t = FLAG(f); if (t) items.push({ kind: 'toast', t }); }
    }
    const next = () => {
      const it = items.shift();
      if (!it) { done?.(); return; }
      if (it.kind === 'line') logCard(it.l.speaker ?? 'CEREBRUM', it.l.text, next);
      else if (it.kind === 'toast') logCard('SYSTEM', it.t, next);
      else if (it.kind === 'frag') modal(`<small class="fr-k">断片ログを取得</small><b>${esc(it.f.title)}</b><p class="fragtext">${esc(it.f.text)}</p><button class="wide ok">閉じる</button>`, m => on(m, '.ok', () => { closeModal(); next(); }));
      else modal(`<small class="fr-k">前任者の残留ログ</small><p class="residue">${esc(residueText(it.x))}</p><button class="wide ok">閉じる</button>`, m => on(m, '.ok', () => { closeModal(); next(); }));
    };
    next();
  }

  // ---- 文章ログ：タップするまで消えない ----
  function logCard(speaker, text, next) {
    const m = document.createElement('div'); m.className = 'logcard';
    m.innerHTML = `<div class="lc-box"><small></small><p></p><em>▼ タップで次へ</em></div>`;
    m.querySelector('small').textContent = speaker; m.querySelector('p').textContent = text;
    document.getElementById('app').appendChild(m);
    const t0 = performance.now();
    m.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (performance.now() - t0 < 250) return;
      A?.tick?.(); m.remove(); next?.();
    });
  }

  // ---- 共通：モーダルとトースト ----
  function modal(html, bind) {
    closeModal();
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="m-box">${html}<button class="m-x">×</button></div>`;
    document.getElementById('app').appendChild(m);
    m.querySelector('.m-x').addEventListener('click', closeModal);
    m.addEventListener('click', e => { if (e.target === m) closeModal(); });
    bind?.(m);
  }
  function closeModal() { document.querySelectorAll('#app > .modal').forEach(m => m.remove()); }
  function toast(text, ms = 2400) {
    let box = document.querySelector('#app > .toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.getElementById('app').appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = text; box.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  return { title, textSeq, thaw, hub, routes, reward, choice, result, story, modal, closeModal, toast, settings, drawCard, logCard };
}

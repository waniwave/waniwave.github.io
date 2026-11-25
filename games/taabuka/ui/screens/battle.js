// 戦闘画面（企画書 第9章の図、仕様書 第10章）
// 上帯・番付・敵・席・宿泊客の仕組みの1行・計算窓・手札4×2・操作（流す・出す・終了・固有行動）。
// 計算は engine/ がする。画面は状態を描き、手順列（B.log）を演出キューで再生するだけ。

import { h, tip, toast, pick, sheet, holdButton, esc, fitText } from '../dom.js';
import { MS } from '../fx/queue.js';
import { cardArt, enemyArt, smallArt } from '../art.js';
import {
  catGlyph, catColor, GRADE_COLOR, ORIGIN_MARK, SEAL_COLOR, tierLabel, slotLabel, cardTip, enemyTip, intentText, fmtNum, fmtMul, kwLines,
  RAR_VAR, RAR_SHORT, rarOfCard, rarStars,
} from '../labels.js';
import { tierOf } from '../../engine/hand.js';
import { cardStrength } from '../../engine/score.js';
import { yieldText } from '../../engine/yield.js';
import { comboEffText } from '../labels.js';
import { play, discard, endTurn, predict, guestAction, guestActions, guestStatus, choicesFor, useItem, layerNoAt } from '../../engine/battle.js';
import { askItem } from '../items.js';
import { Big } from '../../engine/big.js';
import { num as format, unitColor } from '../num.js';
import { unitOf } from '../../engine/format.js';

/** 主張の表示（底の主は「？？？」） */
const claimText = (e, v) => (e?.hideClaim ? '？？？' : format(v));
import { playShow, playStage, playKetagoe, stageOf, rollNumber } from '../fx/shows.js';
import { playSpell, playCombo } from '../fx/combo.js';
import { playMood } from '../fx/silly.js';
import { catBurst, typeFx } from '../fx/catfx.js';
import { premium } from '../premium.js';
import { applyTheme } from '../theme.js';
import { setBgmMood } from '../audio/audio.js';
import { matchCombos } from '../../engine/combo.js';
import { SE, buzz } from '../audio/audio.js';
import { shards, embers } from '../fx/particles.js';

const SPEEDS = [1, 2, 4];

/**
 * @param {object} o { app, queue, settings, saveSettings, base, B, env, title, onExit, onRestart, onDone }
 *   onDone があれば潜行の中の戦闘：終わったら「進む」で onDone(B)。途中でやめられない
 *   onAction(B) は行動の直後（演出の前）に呼ぶ。自動保存に使う
 */
export function battleScreen(o) {
  const { app, queue, base } = o;
  const { B, env } = o;
  const { balance, content } = base;
  const st = { sel: [], target: B.enemies.findIndex((e) => !e.dead), choices: {} };
  const root = h('div.scr.battle');
  let refs = {};
  let guardNow = B.guard || 0, hpNow = B.hp, counterNow = B.counterS || 0;   // 演出の途中の受けと体力（画面に出ている値）

  // ───────── 描く ─────────
  function render() {
    refs = { cards: new Map(), foes: new Map(), slots: new Map(), seats: new Map() };
    guardNow = B.guard || 0; hpNow = B.hp; counterNow = B.counterS || 0;
    if (B.enemies[st.target]?.dead || st.target < 0) st.target = B.enemies.findIndex((e) => !e.dead);
    applyTheme(root, content, B.dungeon, B.floor, { boss: B.enemies.some((e) => !e.dead && (e.kind === '層主' || e.kind === '底の主')) });
    root.replaceChildren(renderTop(), renderBanzuke(), renderFoes(), renderSeats(), renderInfo(), renderCalc(), renderHand(), renderOps(), h('div.moodfx'), h('div.themefx'));
    updateCalc();
    renderSides();
  }

  function renderTop() {
    const hp = hpGauge();
    const gd = h('div.shield', {}, [h('b'), h('small')]);
    tip(gd, () => `<b>受け ${guardNow}</b><br>敵の攻めは、まず受けで止まる。足りない分だけ体力が減る。ターンの始めに0に戻る${incoming() ? `<br>予告の攻め ${incoming()}${guardNow >= incoming() ? '（全部受けきれる）' : `（あと ${incoming() - guardNow} 足りない）`}` : ''}`);
    const zn = h('span.zn', {}, ['宿銭 ', h('b', { text: B.zeni })]);
    refs.hp = hp; refs.guard = gd; refs.zeni = zn;
    const speed = h('button.btn', { type: 'button', onclick: () => {
      const i = (SPEEDS.indexOf(o.settings.speed) + 1) % SPEEDS.length;
      o.settings.speed = SPEEDS[i]; o.saveSettings(o.settings); speed.textContent = `×${o.settings.speed}`;
      document.documentElement.style.setProperty('--speed', o.settings.speed);
    } }, [`×${o.settings.speed}`]);
    tip(speed, () => '<b>速さ</b><br>演出の速さ ×1・×2・×4。再生中に画面をタップすると早送り');
    const menu = h('button.btn', { type: 'button', onclick: openMenu }, ['≡']);
    tip(menu, () => '<b>中断</b><br>速さと、戦闘をやめる');
    const pres = h('span.pres', {}, [`気配 ${B.presence}`]);
    tip(pres, () => `<b>気配 ${B.presence}</b><br>4で敵の主張＋20%、8で追跡者、12で主張＋50%`);
    const ctr = h('div.ctr'); refs.ctr = ctr;
    tip(ctr, () => `<b>反撃 ＋${counterNow}</b><br>受けで止めた攻めの分だけ、次の出しの強さ（S）に足される`);
    const out = h('header.top.hasgauge', {}, [h('div.st', {}, [h('span.fl', { text: `B${B.floor}` }), pres, zn]), speed, menu, h('div.hpw', {}, [gd, hp, ctr])]);
    guardView();
    return out;
  }

  /** 体力のゲージ（作り直し仕様 A）：減った分が白く残って遅れて縮む。予告どおり食らった後を点線で */
  function hpGauge() {
    const fill = h('i.fill'), trail = h('i.trail'), fore = h('i.fore'), gseg = h('i.gseg'), txt = h('span.txt');
    const el = h('div.hpg', {}, [trail, fill, gseg, fore, txt]);
    tip(el, () => `<b>体力 ${B.hp}/${B.maxHp}</b><br>0で倒れる（持ち込んだ物を失う）。点線は、敵が予告どおり動いたときの残り（受けを引いた後）`);
    refs.hpParts = { el, fill, trail, fore, txt, gseg };
    setHp(B.hp, true);
    return el;
  }
  /** 敵の予告の合計（受けを引く前） */
  function incoming() {
    let n = 0;
    for (const e of B.enemies) {
      if (e.dead || e.skip > 0) continue;
      const t = intentText(env, e, B);
      if (t.dmg) n += t.dmg;
    }
    return n;
  }
  /** 受けの見た目：体力ゲージの左の盾（数）と、ゲージの守られている部分（青い斜線）。予告を全部受けきれるなら金の盾 */
  function guardView() {
    const sh = refs.guard; const p = refs.hpParts;
    if (!sh || !p) return;
    const g = Math.max(0, guardNow), inc = incoming();
    sh.classList.toggle('on', g > 0);
    sh.classList.toggle('full', g > 0 && inc > 0 && g >= inc);
    sh.querySelector('b').textContent = g > 0 ? String(g) : '';
    sh.querySelector('small').textContent = g > 0 ? (inc > 0 ? (g >= inc ? '受けきる' : `−${inc - g}`) : '受け') : '';
    const cov = Math.min(g, hpNow);
    p.gseg.style.width = `${(cov / B.maxHp) * 100}%`;
    p.gseg.style.left = `${((hpNow - cov) / B.maxHp) * 100}%`;
    p.el.classList.toggle('guarded', g > 0);
    if (refs.ctr) { refs.ctr.classList.toggle('on', counterNow > 0); refs.ctr.textContent = counterNow > 0 ? `反撃+${counterNow}` : ''; }
  }
  function setHp(v, now = false) {
    const p = refs.hpParts; if (!p) return;
    const pct = Math.max(0, Math.min(100, (v / B.maxHp) * 100));
    p.fill.style.width = `${pct}%`;
    if (now) p.trail.style.width = `${pct}%`;
    else setTimeout(() => { p.trail.style.width = `${pct}%`; }, 450);
    const after = Math.max(0, v - Math.max(0, incoming() - (B.guard || 0)));
    p.fore.style.width = `${Math.max(0, pct - (after / B.maxHp) * 100)}%`;
    p.fore.style.left = `${(after / B.maxHp) * 100}%`;
    p.txt.replaceChildren('体力 ', h('b', { text: v }), `/${B.maxHp}`);
    p.el.classList.toggle('low', v <= B.maxHp * 0.3);
    hpNow = v; guardView();
    root.classList.toggle('lowhp', v > 0 && v <= B.maxHp * 0.3);
  }

  function slotsShown() {
    const ring = balance.tiers.ring.slice();
    const no = layerNoAt(content, B.floor, B.dungeon);
    for (const [k, d] of Object.entries(balance.tiers.missing || {})) if (Object.values(B.banzuke).includes(k) || no >= (d.fromLayer ?? 99)) ring.push(k);
    return ring;
  }

  function renderBanzuke() {
    const slots = slotsShown();
    const el = h('section.banzuke', { style: { '--cols': slots.length } });
    for (const s of slots) {
      const cats = balance.tiers.categories.filter((c) => B.banzuke[c] === s);
      const def = balance.tiers.tiers[s] || balance.tiers.missing[s];
      const add = typeof def.strength === 'number' ? `${def.strength}` : def.strength?.random ? `${def.strength.random[0]}〜${def.strength.random[1]}（出すたび乱数）` : '―';
      const slot = h(`div.slot${cats.length ? '' : '.empty'}`, { dataset: { slot: s } }, [
        h('div.t', {}, [s === 'God' ? 'God' : String(s).startsWith('欠') ? s : s]),
        h('div.gl', {}, cats.map((c) => h('span.glyph', { style: { background: catColor(c) }, title: c, dataset: { cat: c } }, [catGlyph(c)]))),
      ]);
      tip(slot, () => `<b>${esc(slotLabel(s))}</b>　<span class="q">ここにいるカテゴリの札は強さ ${esc(add)}${def.perCardMul ? `、採点されると倍率×${def.perCardMul}` : ''}</span><br>${cats.length ? cats.map((c) => `〈${esc(c)}〉`).join('') : '<span class="q">いない</span>'}`);
      refs.slots.set(String(s), slot);
      el.append(slot);
    }
    return el;
  }

  function renderFoes() {
    const el = h('section.foes');
    B.enemies.forEach((e, i) => {
      const it = intentText(env, e, B);
      const bar = h('div.bar', { style: { width: `${pct(e.claim, e.maxClaim)}%` } });
      const cl = h('div.cl', { text: e.dead ? '論破' : claimText(e, e.claim) });
      const foe = h(`button.foe${i === st.target ? '.tgt' : ''}${e.dead ? '.dead' : ''}`, { type: 'button', dataset: { uid: e.uid }, onclick: () => {
        if (e.dead || queue.busy) return;
        st.target = i;
        for (const [, f] of refs.foes) f.el.classList.toggle('tgt', f.el === foe);
        updateCalc();
      } }, [
        h('div.art', { html: enemyArt(e) }),
        e.baseName ? h('div.nm', {}, [h('small.ep', { text: e.name.slice(0, e.name.length - e.baseName.length) }), e.baseName]) : h('div.nm', { text: e.name }),
        ...((env.content.enemies[e.id]?.kwList || []).length ? [h('div.kw', { text: env.content.enemies[e.id].kwList.map((k) => k.label).join('・') })] : []),
        ...(e.yield && !e.dead ? [h('div.yd', {}, [h('span.ycat', { text: e.cat || '' }), h('span.ytx', { text: yieldText(env, e)?.short || '' })])] : []),
        h(`div.int${it.calm ? '.calm' : ''}${it.dmg ? '.atk' : ''}${it.warn ? '.warn' : ''}`, { text: it.text }),
        h('div.barw', {}, [bar]),
        cl,
      ]);
      tip(foe, () => enemyTip(env, e, B));
      refs.foes.set(e.uid, { el: foe, bar, cl, max: e.maxClaim, yd: foe.querySelector('.ytx') });
      el.append(foe);
    });
    return el;
  }

  function renderSeats() {
    const el = h('section.seats');
    const n = balance.hands.play.seats;
    for (let i = 0; i < n; i++) {
      const r = B.seats[i];
      if (!r) { el.append(h('div.seat', {}, [])); continue; }
      const def = content.regulars[r.id] || {};
      const s = h(`div.seat.on${r.disabled ? '.off' : ''}`, { style: { '--g': GRADE_COLOR[def.grade] }, dataset: { uid: r.uid } }, [h('span', { text: r.name })]);
      s.insertAdjacentHTML('afterbegin', smallArt(r.id));
      tip(s, () => `<b>${esc(r.name)}</b>${r.disabled ? '　<span class="q">（席を奪われている）</span>' : ''}<br>${kwLines(def).join('<br>')}${def.flavor ? `<br><span class="fl">${esc(def.flavor)}</span>` : ''}`);
      refs.seats.set(r.uid, s);
      el.append(s);
    }
    return el;
  }

  // 説明欄：押した札・敵・席・番付の説明がここに出る。何も押していないときは宿泊客の仕組み
  function guestInfo() {
    const sealed = B.sealed.cats.length ? `<span class="warnt">封じ中：${B.sealed.cats.map((c) => `〈${esc(c)}〉あと${B.sealed.catTurns?.[c] ?? '?'}ターン`).join('・')}（その札は採点されず受けになる）</span><br>` : '';
    const gh = B.ghost ? `<span class="warnt">ゴースト宿「${esc(B.ghost.name)}」との勝負：${B.ghost.turns}ターンのうちに論破（いま${B.turn}ターン目）</span><br>` : '';
    const md = B.mood ? balance.moods?.[B.mood.id] : null;
    const mood = md ? `<span class="moodt" style="color:${md.color}">場の状態「${esc(B.mood.id)}」あと${B.mood.turns}ターン：${esc(md.text ?? '')}</span><br>` : '';
    if (!B.guest) return gh + mood + sealed + '<span class="q">札・敵・席・番付を押すと、ここに説明が出ます</span>';
    const g = content.guests[B.guestSwap || B.guest];
    const m = g?.mechanic ? content.vocab.get('mechanic', g.mechanic) : null;
    const relics = B.relics.map((r) => content.relics[r.id]).filter(Boolean);
    return `${gh}${mood}${sealed}<b>${esc(g?.name ?? '')}</b>　${esc(guestStatus(B, env))}<br><span class="q">${esc(m?.text ?? '')}</span>${relics.length ? `<br><span class="q">置物：${relics.map((d) => `${esc(d.name)}（${kwLines(d).join(' ')}）`).join('、')}</span>` : ''}`;
  }
  function renderInfo() {
    const el = h('section.infobox', { html: guestInfo() });
    refs.guest = el;
    return el;
  }

  function renderCalc() {
    const hd = h('div.hd');
    const nums = h('div.nums');
    const el = h('section.calc', {}, [hd, nums]);
    tip(el, () => calcTip());
    refs.calc = el; refs.calcHd = hd; refs.calcNums = nums;
    return el;
  }

  function renderHand() {
    const n = B.hand.length;
    const cols = Math.max(4, Math.ceil(n / 2));
    const el = h('section.hand', { style: { '--cols': cols, '--rows': 2 } });
    B.hand.forEach((c, i) => {
      const card = cardEl(c);
      card.classList.toggle('sel', st.sel.includes(i));
      card.addEventListener('click', () => toggle(i));
      tip(card, () => cardTip(env, c, B));
      refs.cards.set(c.uid, card);
      el.append(card);
    });
    refs.handEl = el; el.classList.toggle('picking', st.sel.length > 0);
    return el;
  }

  function cardEl(c) {
    if (c.faceDown) return h('button.card.back', { type: 'button', dataset: { uid: c.uid } }, [h('span.q', { text: '？' })]);
    const r = rarOfCard(balance, c, content.cards[c.id]);
    const el = h(`button.card${c.ed ? '.ed' : ''}.r-${r}`, { type: 'button', dataset: { uid: c.uid }, style: { '--g': RAR_VAR[r] } });
    el.innerHTML = cardArt(c);
    if (content.sets[content.cards[c.id]?.set]?.joke) el.classList.add('joke');
    el.append(
      h('span.tier', { text: tierLabel(tierOf(c, balance, B.banzuke)) }),
      h('span.rr', { text: rarStars(r) }),
      h('span.cats', {}, c.cat.map((x) => h('span.glyph', { style: { background: catColor(x) } }, [catGlyph(x)]))),
      h('span.nm', { text: c.name }),
    );
    if (ORIGIN_MARK[c.origin]) el.append(h('span.mark', { text: ORIGIN_MARK[c.origin] }));
    if (c.enh) el.append(h('span.enh', { text: c.enh }));
    if (c.seal) el.append(h('span.seal', { style: { background: SEAL_COLOR[c.seal] } }));
    if (c.cat.some((x) => B.sealed.cats.includes(x))) { el.classList.add('sealedc'); el.append(h('span.sealmk', { text: '封' })); }
    if (comboReady(c)) el.append(h('span.cmbmk', { text: '◎' }));
    premium(el, r, c.ins, content);
    return el;
  }

  /** 手札の中にコンボの相手がそろっている札 */
  function comboReady(c) {
    const ids = content.combosOf?.[c.id];
    if (!ids) return false;
    return ids.some((id) => { const cb = content.comboList.find((x) => x.id === id); return cb && matchCombos(content, B.hand.filter((x) => !x.faceDown)).some((m) => m.combo.id === id && m.uids.includes(c.uid)); });
  }

  function renderOps() {
    const P = balance.hands.play;
    const el = h('footer.ops');
    const dis = h('button.btn', { type: 'button', onclick: doDiscard }, ['流す ', h('span.n', { text: B.discardsLeft })]);
    const ply = h('button.btn.main', { type: 'button', onclick: doPlay }, ['出す ', h('span.n', { text: B.playsLeft })]);
    const end = h('button.btn', { type: 'button', onclick: doEnd }, ['終了']);
    tip(dis, () => `<b>流す</b><br>選んだ札（${P.minCards}〜${P.maxDiscardCards}枚）を捨てて、同じ枚数を引く。残り ${B.discardsLeft}${B.sealed.discard ? '<br>封じられている' : ''}`);
    tip(ply, () => `<b>出す</b><br>選んだ札（${P.minCards}〜${B.maxPlay ?? P.maxPlayCards}枚）を狙った敵に出す。採点されない札は受けになる。残り ${B.playsLeft}`);
    tip(end, () => '<b>終了</b><br>ターンを終える。敵が予告どおりに動く');
    const itm = h('button.btn', { type: 'button', onclick: openItems }, ['品 ', h('span.n', { text: B.items.length })]);
    tip(itm, () => `<b>お品書き</b><br>${B.items.length ? B.items.map((it) => esc(itemName(it))).join('、') : '持っていない'}`);
    refs.ops = { dis, ply, end, itm };
    el.append(dis, ply, end, itm);
    for (const a of guestActions(B, env)) {
      const b = h('button.btn', { type: 'button', onclick: () => doGuest(a) }, [a.label]);
      const m = content.vocab.get('mechanic', content.guests[B.guestSwap || B.guest]?.mechanic);
      tip(b, () => `<b>${esc(a.label)}</b><br>${esc(m?.text ?? '')}`);
      el.append(b);
    }
    return el;
  }

  function renderSides() {
    const L = document.getElementById('side-l'), R = document.getElementById('side-r');
    if (!L || !R) return;
    const names = (list) => list.map((c) => h('li', {}, [h('span', { text: c.faceDown ? '？' : c.name }), h('span.q', { text: tierLabel(c.tier) })]));
    const drawSorted = B.draw.slice().sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    L.replaceChildren(
      h('h3', { text: `山札 ${B.draw.length}` }), h('ul', {}, names(drawSorted)),
      h('h3', { text: `捨て札 ${B.discard.length}` }), h('ul', {}, names(B.discard.slice().reverse())),
    );
    const o = balance.hands.overlap;
    const rows = [2, 3, 4, 5].map((n) => h('li', {}, [h('span', { text: `同じカテゴリ ${n}枚` }), h('span.q', { text: `×${1 + o.step * (n - 1)}` })]));
    const bz = balance.tiers.ring.map((t) => h('li', {}, [h('span', { text: `Tier ${tierLabel(t)}` }), h('span.q', { text: (() => { const v = balance.tiers.tiers[t].strength; return typeof v === 'number' ? `強さ ${v}` : `強さ ${v.random[0]}〜${v.random[1]}`; })() })]));
    R.replaceChildren(h('h3', { text: '重なりの倍率' }), h('ul', { id: 'handtable' }, rows), h('h3', { text: 'Tierの強さ' }), h('ul', {}, bz),
      h('p.q', { text: '1〜8 札を選ぶ ／ Enter 出す ／ D 流す ／ E 終了 ／ T 狙いを変える ／ I お品書き ／ Esc 選び直す' }));
  }

  // ───────── 計算窓（選んだだけで予測） ─────────
  let lastPred = null;
  function updateCalc() {
    const { calc, calcHd, calcNums } = refs;
    if (!calc) return;
    for (const [uid, el] of refs.cards) el.classList.toggle('sel', st.sel.includes(B.hand.findIndex((c) => c.uid === uid)));
    refs.handEl?.classList.toggle('picking', st.sel.length > 0);
    const cards = st.sel.map((i) => B.hand[i]);
    const need = choicesFor(env, cards);
    for (const k of Object.keys(st.choices)) if (!(k in need)) delete st.choices[k];
    calc.classList.remove('burn', 'empty');
    lastPred = null;
    if (!cards.length || B.result) {
      calc.classList.add('empty');
      calcHd.replaceChildren(h('b', { text: '―' }));
      calcNums.replaceChildren(B.result ? '' : '札を選ぶ');
    } else {
      try {
        const p = predict(B, env, st.sel, st.target, { ...defaults(need), ...st.choices });
        lastPred = p;
        calcHd.replaceChildren(...overlapHead(p));
        const kids = [];
        if (p.uncertain) kids.push(h('span', { text: format(p.S) }), h('span.op', { text: '×' }), h('span', { text: '？' }), h('span.op', { text: '＝' }), h('span.v', { text: '？' }));
        else kids.push(h('span', { text: format(p.S) }), h('span.op', { text: '×' }), h('span', { text: fmtMul(p.M) }), h('span.op', { text: '＝' }), h('span.v', { text: format(p.V) }));
        calcNums.replaceChildren(...kids);
        fitText(calcNums.firstChild);
        for (const [k, type] of Object.entries(need)) {
          const cur = st.choices[k] ?? defaults(need)[k];
          calcNums.append(h('button.btn.ask', { type: 'button', onclick: async (e) => {
            e.stopPropagation();
            const v = await askOne(k, type);
            if (v != null) { st.choices[k] = v; updateCalc(); }
          } }, [`${k}：${cur} ▾`]));
        }
        const t = B.enemies[st.target];
        if (!p.uncertain && t && !t.dead && !t.hideClaim && p.V.gte(t.claim)) calc.classList.add('burn');
      } catch (e) {
        calcHd.replaceChildren(h('b', { text: '―' }));
        calcNums.replaceChildren(e.userError ? e.message : '予測できない');
      }
    }
    const P = balance.hands.play;
    const n = st.sel.length;
    refs.ops.ply.disabled = !!B.result || B.playsLeft <= 0 || n < P.minCards || n > (B.maxPlay ?? P.maxPlayCards) || (B.fixedPlay != null && n !== Math.min(B.fixedPlay, B.hand.length));
    refs.ops.dis.disabled = !!B.result || B.discardsLeft <= 0 || B.sealed.discard || n < P.minCards || n > P.maxDiscardCards
      || B.hand.some((c) => c.enh && balance.hands.enhancements[c.enh]?.blocksDiscard);
    {
      // 流したときの受けの見込み（Tier8 は出しごとの乱数なので目安）
      const gk = P.guardOnDiscard ?? 0; const md = balance.moods?.[B.mood?.id];
      const g = gk && n ? Math.round(st.sel.reduce((a, i) => { const c = B.hand[i]; if (!c) return a; const enh = c.enh && balance.hands.enhancements[c.enh]; return a + cardStrength(c, balance, B.banzuke) * gk * (enh?.guardMul ?? 1) * (md?.guardMul ?? 1); }, 0)) : 0;
      refs.ops.dis.querySelector('.gq')?.remove();
      if (g > 0 && !refs.ops.dis.disabled) refs.ops.dis.append(h('span.gq', { text: `受+${g}` }));
    }
    refs.ops.end.disabled = !!B.result;
    refs.ops.itm.disabled = !!B.result || !B.items.length;
    const table = document.getElementById('handtable');
    if (table) for (const li of table.children) li.classList.toggle('on', !!lastPred && li.dataset.hand === lastPred.hand);
  }

  function defaults(need) {
    const out = {};
    for (const [k, type] of Object.entries(need)) if (type === 'category') out[k] = balance.tiers.categories[0];
    return out;
  }

  /** 計算窓の見出し：重なり（麺×3・食×2）と孤立の数 */
  function overlapHead(p) {
    const ov = (p.steps || []).filter((x) => x.type === 'xM' && x.src?.kind === 'overlap');
    const kids = [];
    if (!ov.length) kids.push(h('b', { text: '重なりなし' }));
    for (const x of ov) kids.push(h('span.ov', { style: { background: catColor(x.src.id) } }, [`${catGlyph(x.src.id)}${x.src.n}`]));
    const iso = p.kickers?.length ?? 0;
    if (iso) kids.push(h('span.q', { text: ` 受け${iso}` }));
    const cmb = [...new Set((p.steps || []).filter((x) => x.src?.kind === 'combo').map((x) => x.src.name))];
    for (const n of cmb) kids.push(h('span.cmbtag', { text: `◎${n}` }));
    return kids;
  }

  function calcTip() {
    if (!lastPred) return '<b>計算窓</b><br>札を選ぶと論破値の予測が出る。強さ（札のTier）×倍率（同じカテゴリの重なり）。敵の主張を超えると燃える';
    const p = lastPred;
    const ov = (p.steps || []).filter((x) => x.type === 'xM' && x.src?.kind === 'overlap').map((x) => `${esc(x.src.id)}${x.src.n}枚 ×${fmtMul(x.mul)}`).join('、');
    return `<b>重なり</b>　${ov || 'なし'}<br>強さ ${format(p.S)} × 倍率 ${fmtMul(p.M)}${(p.kickers?.length ?? 0) ? `<br><span class="q">ほかとカテゴリが重ならない札は受けになる（${p.kickers.length}枚）</span>` : ''}${p.uncertain ? '<br>乱数で変わる（？）' : p.usedRandom ? '<br><span class="q">乱数を使うが、論破値は変わらない</span>' : ''}`;
  }

  async function askOne(key, type) {
    if (type === 'category') return pick(app, key, balance.tiers.categories.map((c) => ({ label: `${c}（${slotLabel(B.banzuke[c])}）`, value: c })));
    if (type?.type === 'choice') return pick(app, key, type.options);
    return pick(app, key, (type?.options ?? []).map((v) => ({ label: String(v), value: v })));
  }

  // ───────── 操作 ─────────
  function toggle(i) {
    if (queue.busy || B.result) return;
    const k = st.sel.indexOf(i);
    if (k >= 0) st.sel.splice(k, 1);
    else if (st.sel.length < Math.max(B.maxPlay ?? 0, balance.hands.play.maxDiscardCards)) st.sel.push(i);
    else { toast(`選べるのは${Math.max(B.maxPlay ?? 0, balance.hands.play.maxDiscardCards)}枚まで`); return; }
    st.sel.sort((a, b) => a - b);
    updateCalc();
  }

  async function act(fn) {
    if (queue.busy || B.result) return;
    const from = B.log.length;
    const prev = { claims: new Map(B.enemies.map((e) => [e.uid, e.claim])), target: B.enemies[st.target]?.uid, guard: B.guard };
    try { fn(); } catch (e) {
      if (e.userError) { toast(e.message); return; }
      throw e;
    }
    const entries = B.log.slice(from);
    st.sel = [];
    if (o.onAction) o.onAction(B);
    await queue.play(tasksFor(entries, prev));
    render();
    if (B.result) showResult();
  }

  async function doPlay() {
    if (refs.ops.ply.disabled) return;
    const cards = st.sel.map((i) => B.hand[i]);
    const need = choicesFor(env, cards);
    const choices = { ...defaults(need), ...st.choices };
    const idx = st.sel.slice();
    const tgt = st.target;
    st.choices = {};
    await act(() => play(B, env, idx, tgt, { choices }));
  }
  async function doDiscard() {
    if (refs.ops.dis.disabled) return;
    const idx = st.sel.slice();
    await act(() => discard(B, env, idx));
  }
  async function doEnd() { if (!refs.ops.end.disabled) await act(() => endTurn(B, env)); }
  async function doGuest(a) {
    if (queue.busy || B.result) return;
    const args = {};
    for (const q of a.ask) {
      if (q.type === 'selected') {
        const n = st.sel.length;
        if (n < (q.min ?? 1) || n > (q.max ?? 5)) { toast(`先に手札を${q.min === q.max ? q.min : `${q.min ?? 1}〜${q.max ?? 5}`}枚選ぶ`); return; }
        args[q.key] = st.sel.slice();
        continue;
      }
      const v = await askOne(q.key, q.type === 'category' ? 'category' : q);
      if (v == null) return;
      args[q.key] = v;
    }
    st.sel = [];
    await act(() => guestAction(B, env, a.name, args));
  }

  // ───────── 手順列 → 演出 ─────────
  /** 演出部品に渡す場 */
  const X = () => ({ queue, root, layer: queue.layer, cards: [...refs.cards.values()], foes: [...refs.foes.values()].map((f) => f.el) });

  function tasksFor(rawEntries, prev) {
    const T = [];
    // 出しの記録は採点の後に積まれるので、その出しの中で起きたこと（行動停止・番付など）より先に再生する
    const pi = rawEntries.findIndex((x) => x.t === 'play');
    const entries = pi > 0 ? [rawEntries[pi], ...rawEntries.slice(0, pi), ...rawEntries.slice(pi + 1)] : rawEntries;
    const calcSet = (S, M, V) => {
      const kids = [h('span', { text: format(S) }), h('span.op', { text: '×' }), h('span', { text: fmtMul(M) })];
      if (V != null) kids.push(h('span.op', { text: '＝' }), h('span.v', { text: format(V) }));
      refs.calcNums.replaceChildren(...kids);
      fitText(refs.calcNums.firstChild);
      refs.calc.classList.remove('empty');
    };
    let tgtClaim = prev.target ? prev.claims.get(prev.target) : null;
    guardNow = prev.guard;
    const setGuard = (g, why) => {
      const was = guardNow; guardNow = Math.max(0, g); guardView();
      if (guardNow > was) queue.bounce(refs.guard, 300);
      else if (was > guardNow) { queue.shake(refs.guard, 6, 300); if (guardNow === 0 && why === 'turn') queue.pop('受けが消えた', refs.guard, null, 'note'); }
    };
    const burn = (S, M) => {
      if (!tgtClaim || !Big.from(S).mul(M).gte(tgtClaim)) return;
      if (!refs.calc.classList.contains('burn')) {
        refs.calc.classList.add('burn');
        const r = refs.calc.getBoundingClientRect(); const L = queue.layer.getBoundingClientRect();
        embers(r.left - L.left + r.width / 2, r.top - L.top + r.height / 2, 18, r.width * 0.8);
      }
    };
    const catsOfSrc = (src) => (src?.kind === 'card' && src.uid ? ([...B.inPlay, ...B.hand, ...B.discard, ...B.draw, ...B.exhaust].find((c) => c.uid === src.uid)?.cat || content.cards[src.id]?.cat || []) : []);
    const ringIx = (t) => balance.tiers.ring.indexOf(String(t));
    const srcEl = (src) => {
      if (!src) return refs.calc;
      if (src.kind === 'card' && src.uid) return refs.cards.get(src.uid) ?? refs.calc;
      if (src.kind === 'banzuke') return refs.slots.get(String(src.slot)) ?? refs.calc;
      if (src.kind === 'regular') return refs.seats.get(src.uid) ?? refs.calc;
      if (src.kind === 'guest' || src.kind === 'relic') return refs.guest;
      return refs.calc;
    };
    const foe = (uid) => refs.foes.get(uid);
    const foeOf = (uid) => B.enemies.find((x) => x.uid === uid);
    let pendingStage = null;
    const flushStage = () => {
      const p = pendingStage; pendingStage = null;
      if (!p) return;
      if (p.stg && p.stg !== '燃える') { let ms = 0; T.push({ get ms() { return ms; }, run: () => { ms = playStage(p.stg, X()); } }); }
      if (p.unit && o.unitSeen && !o.unitSeen(p.unit)) {
        let ms = 0;
        T.push({ get ms() { return ms; }, run: () => { if (o.unitSeen(p.unit)) return; o.markUnit?.(p.unit); ms = playKetagoe(X(), p.unit, unitColor(p.V)); } });
      }
    };

    for (const e of entries) {
      switch (e.t) {
        case 'play': {
          tgtClaim = B.enemies[e.target] ? prev.claims.get(B.enemies[e.target].uid) : tgtClaim;
          // 呪文（出した札の短い名前をつないだ掛け声）
          if (e.spell) { let ms = 0; T.push({ get ms() { return ms; }, run: () => { ms = playSpell(X(), e.spell, !!e.combos?.length); } }); }
          // 演出の語彙（仕様書 第9章 show の全て。ui/fx/shows.js）
          for (const f of e.fx || []) {
            let ms = 0;
            T.push({ get ms() { return ms; }, run: () => { ms = playShow(f.show, f.arg, X()); } });
          }
          let pitch = 0;
          const comboShown = new Set();
          for (const s of e.steps) {
            if (s.src?.kind === 'combo' && !comboShown.has(s.src.id)) {
              comboShown.add(s.src.id);
              let ms = 0;
              T.push({ get ms() { return ms; }, run: () => { ms = playCombo(X(), s.src, comboEffText(content, s.src.id)); } });
            }
            switch (s.type) {
              case 'hand': T.push({ ms: 240, run: () => {
                if (counterNow) { counterNow = 0; guardView(); }
                refs.calcHd.replaceChildren(h('b', { text: '採点' }));
                calcSet(s.S, s.M); queue.slam(refs.calc);
              } }); break;
              case 'S': T.push({ ms: s.src?.kind === 'card' ? MS.card : MS.note, run: () => {
                const from = srcEl(s.src);
                if (s.src?.kind === 'card') { queue.bounce(from); catBurst(X(), from, catsOfSrc(s.src)); }
                typeFx(X(), from, 'S', 2);
                queue.pop(`+${format(s.add)}`, from, refs.calc, 's');
                SE.score(pitch++);
                calcSet(s.S, s.M); burn(s.S, s.M);
              } }); break;
              case 'M': T.push({ ms: s.src?.kind === 'banzuke' ? MS.banzuke : s.src?.kind === 'regular' ? MS.regular : MS.card, run: () => {
                const from = srcEl(s.src);
                if (s.src?.kind === 'banzuke') queue.glow(from);
                else if (s.src?.kind === 'regular') queue.shake(from, 3, MS.regular);
                else if (s.src?.kind === 'card') { queue.bounce(from); catBurst(X(), from, catsOfSrc(s.src)); }
                typeFx(X(), from, 'M', 3);
                queue.pop(`${s.add.isNeg() ? '' : '+'}${fmtMul(s.add)}`, from, refs.calc, 'm');
                SE.mult(pitch++);
                calcSet(s.S, s.M); burn(s.S, s.M);
              } }); break;
              case 'xM': case 'xS': case 'xV': T.push({ ms: MS.slam, run: () => {
                const from = s.src?.kind === 'overlap' ? refs.calc : srcEl(s.src);
                if (s.src?.kind === 'overlap') {
                  // 重なり：そのカテゴリの紋を見出しに積み、枚数を大きく
                  refs.calcHd.append(h('span.ov', { style: { background: catColor(s.src.id) } }, [`${catGlyph(s.src.id)}${s.src.n}`]));
                  queue.pop(`${s.src.id}×${s.src.n}枚`, refs.calc, null, 'x');
                }
                if (s.src?.kind === 'regular') queue.shake(from, 4, MS.regular);
                queue.pop(`×${fmtMul(s.mul)}`, from, refs.calc, 'x');
                typeFx(X(), from, 'x', 5); if (s.src?.kind === 'card') catBurst(X(), from, catsOfSrc(s.src));
                queue.slam(refs.calc);
                SE.taiko();
                if (s.src?.kind === 'regular') buzz(20);
                calcSet(s.S, s.M); burn(s.S, s.M);
              } }); break;
              case 'floorM': T.push({ ms: MS.note, run: () => calcSet(s.S, s.M) }); break;
              case 'note': T.push({ ms: MS.note, run: () => queue.pop(s.what, srcEl(s.src), null, 'note') }); break;
              case 'final': T.push({ ms: MS.final + 260, run: () => {
                calcSet(s.S, s.M, s.V);
                const v = refs.calcNums.querySelector('.v');
                if (v) rollNumber(v, format(s.V), queue, unitColor(s.V));
                queue.slam(refs.calc); burn(s.S, s.M); SE.taiko();
              } }); break;
              default: break;
            }
          }
          // 演出の段階（k＝log10（V ÷ 狙った敵の残り主張））と桁越え。再生は与えた後
          const stg = stageOf(Big.from(e.V), tgtClaim ? Big.from(tgtClaim) : null);
          const unit = unitOf(e.V);
          pendingStage = { stg, unit, V: e.V };
          break;
        }
        case 'damage': T.push({ ms: MS.damage + 140, run: () => {
          const f = foe(e.enemy); if (!f) return;
          queue.pop(`${e.pierce ? '貫通 ' : ''}−${format(e.amount)}`, refs.calc, f.el, 'dmg', MS.damage * 1.6);
          queue.later(() => {
            f.bar.style.width = `${pct(e.after, f.max)}%`;
            f.cl.textContent = e.killed ? '論破' : claimText(foeOf(e.enemy), e.after);
            queue.shake(f.el, 4, MS.damage);
            SE.hit();
            if (e.killed) { f.el.classList.add('dead'); shards(f.el.getBoundingClientRect(), '#a3322a', 14); SE.crack(); }
          }, MS.damage * 0.9);
        } });
          if (pendingStage && !entries.slice(entries.indexOf(e) + 1).some((x) => x.t === 'damage')) flushStage();
          break;
        case 'counter': T.push({ ms: MS.note, run: () => { counterNow = e.total; guardView(); queue.pop(`反撃+${e.add}`, refs.ctr, null, 'm'); queue.bounce(refs.ctr, 300); typeFx(X(), refs.ctr, 'x', 3); } }); break;
        case 'guard': T.push({ ms: MS.note, run: () => { setGuard(e.guard); queue.pop(`受け+${e.add}`, refs.guard, null, 's'); typeFx(X(), refs.guard, 'guard', 3); } }); break;
        case 'broken': T.push({ ms: MS.note, run: () => queue.pop(`${e.card} が割れた`, refs.calc, null, 'note') }); break;
        case 'zeni': T.push({ ms: MS.note, run: () => { queue.pop(`宿銭+${e.add}`, refs.zeni, null, 'note'); } }); break;
        case 'overkill': if (e.level) T.push({ ms: MS.banner, run: () => queue.banner(e.level, 'big') }); break;
        case 'turn': T.push({ ms: e.n > 1 ? 420 : 0, run: () => { setGuard(0, 'turn'); if (e.n > 1) queue.banner(`${e.n}ターン目`, 'small', 600); } }); break;
        case 'attack': T.push({ ms: MS.enemy, run: () => {
          const f = foe(e.enemy);
          if (f) queue.bounce(f.el, MS.enemy);
          queue.shake(app, e.loss > 0 ? 5 : 2, MS.enemy);
          setHp(e.hp);
          if (e.guarded) { queue.pop(`受け −${e.guarded}`, refs.hp, null, 'guardpop'); setGuard(guardNow - e.guarded); }
          if (e.loss) {
            queue.pop(`−${e.loss}`, refs.hp, null, 'dmg big');
            root.classList.remove('hurt'); void root.offsetWidth; root.classList.add('hurt');
            try { SE.hit(); if (e.hp <= B.maxHp * 0.3) setTimeout(() => SE.heart(), 300); } catch { /* 音なし */ }
          }
        } }); break;
        case 'heal': T.push({ ms: MS.note, run: () => { const f = foe(e.enemy); if (f) queue.pop(`+${format(e.amount)}`, f.el, null, 'm'); } }); break;
        case 'act': T.push({ ms: MS.note * 1.5, run: () => { const f = foe(e.enemy); if (f) { queue.bounce(f.el); queue.pop(e.act + (e.what ? `（${e.what}）` : ''), f.el, null, 'note'); } } }); break;
        case 'summon': T.push({ ms: MS.note, run: () => queue.pop(`${e.name}が来た`, refs.calc, null, 'note') }); break;
        case 'stun': T.push({ ms: MS.note, run: () => { const f = foe(e.enemy); if (f) queue.pop(`動けない ${e.turns}`, f.el, null, 'note'); } }); break;
        case 'banzuke': T.push({ ms: MS.banzuke * 2, run: () => {
          queue.glow(refs.slots.get(String(e.to)));
          typeFx(X(), refs.slots.get(String(e.to)), ringIx(e.to) < ringIx(e.from) ? 'up' : 'down', 3);
          queue.pop(`${e.cat} ${slotLabel(e.from)}→${slotLabel(e.to)}`, refs.slots.get(String(e.from)) ?? refs.calc, refs.slots.get(String(e.to)), 'note');
        } }); break;
        case 'mod': T.push({ ms: MS.note, run: () => queue.pop(`${{ plays: '出し', discards: '流し', handSize: '手札上限' }[e.key]}${e.delta > 0 ? '+' : ''}${e.delta}`, refs.calc, null, 'note') }); break;
        case 'level': T.push({ ms: MS.note, run: () => queue.pop(`${e.hand} Lv${e.level}`, refs.calc, null, 'note') }); break;
        case 'spawn': T.push({ ms: MS.note, run: () => queue.pop(`${e.card}が手札に`, refs.calc, null, 'note') }); break;
        case 'faceDown': T.push({ ms: MS.note, run: () => queue.pop(`${e.n}枚が裏向きに`, refs.calc, null, 'note') }); break;
        case 'hp': T.push({ ms: MS.note, run: () => { setHp(e.hp); typeFx(X(), refs.hp, e.add < 0 ? 'hurt' : 'heal', 4); queue.pop(`${e.add > 0 ? '+' : ''}${e.add}`, refs.hp, null, e.add < 0 ? 'dmg big' : 'heal'); if (e.add < 0) { root.classList.remove('hurt'); void root.offsetWidth; root.classList.add('hurt'); } } }); break;
        case 'useItem': T.push({ ms: MS.note * 1.5, run: () => queue.banner(e.name, 'small', 700) }); break;
        case 'note': T.push({ ms: MS.note, run: () => queue.pop(e.what, refs.calc, null, 'note') }); break;
        case 'mood': { let ms = 0; T.push({ get ms() { return ms; }, run: () => { const ml = e.id ? (base.content.flavor?.moodTalk?.[e.id] || []) : []; ms = playMood(X(), e.id, e.id ? balance.moods?.[e.id] : null, ml.length ? ml[Math.floor(Math.random() * ml.length)] : ''); render(); } }); break; }
        case 'hindrance': T.push({ ms: MS.note * 2, run: () => queue.pop(`妨害：${e.what}`, refs.calc, null, 'note') }); break;
        case 'form': T.push({ ms: MS.banner * 1.4, run: () => {
          const f = foe(e.enemy); if (!f) return;
          f.el.classList.remove('dead');
          f.bar.style.width = '100%';
          f.max = e.claim;
          f.cl.textContent = claimText(foeOf(e.enemy), e.claim);
          queue.shake(app, 8, 700); SE.taiko();
          queue.banner(`${e.name}　第${e.form}形態`, 'big', 1400);
          if (e.what) queue.pop(e.what, f.el, null, 'note');
        } }); break;
        case 'yield': T.push({ ms: MS.banner * 1.4, run: () => {
          const f = foe(e.enemy);
          if (f) { f.cl.textContent = '降参'; f.bar.style.width = '0%'; f.el.classList.add('dead'); queue.pop(e.how, f.el, null, 'note'); }
          queue.shake(app, 6, 500); try { SE.taiko(); } catch { /* 音なし */ }
          queue.banner(`${e.name} 降参！（${e.how}）`, 'big', 1300);
        } }); break;
        case 'yp': T.push({ ms: MS.note, run: () => { const f = foe(e.enemy); const o = foeOf(e.enemy); if (f?.yd && o) { f.yd.textContent = yieldText(env, o)?.short || ''; queue.pop(`${e.how}+${e.add}`, f.el, null, 'note'); typeFx(X(), f.el, 'yield', 3); } } }); break;
        case 'intent': T.push({ ms: MS.note, run: () => { const f = foe(e.enemy); if (f) queue.pop(`次は${e.act}`, f.el, null, 'note'); } }); break;
        case 'presence': T.push({ ms: MS.note, run: () => queue.pop(`気配+${e.add}`, refs.calc, null, 'note') }); break;
        case 'error': T.push({ ms: MS.note, run: () => { console.warn('[記録]', e.hook, e.message); queue.pop('（特注の不具合）', refs.calc, null, 'note'); } }); break;
        case 'end': flushStage(); T.push({ ms: MS.banner, run: () => (setBgmMood(null), (queue.banner(e.result === 'win' ? '勝ち' : e.result === 'lose' ? '未帰還' : e.result === 'timeup' ? '時間切れ' : '脱出', e.result === 'win' ? '' : 'big') ))}); break;
        default: break;
      }
    }
    flushStage();
    return T;
  }

  // ───────── お品書き ─────────
  function itemName(it) {
    const def = it.id ? content.items[it.id] : null;
    return def?.name ?? (it.kind === '議題' ? `議題「${it.hand}」` : it.kind);
  }
  function openItems() {
    if (queue.busy || B.result || !B.items.length) return;
    const D = env.dive;
    const s = sheet(app, [
      h('h2', { text: 'お品書き' }),
      ...B.items.map((it, i) => {
        const def = it.id ? content.items[it.id] : null;
        const use = def?.use ?? '戦闘中';
        const once = def?.once === '潜行' && D?.flags?.used?.[def.id];
        const b = h('button.btn.main', { type: 'button', disabled: use === '戦闘外' || once, onclick: async () => {
          s.close();
          const choices = await askItem(app, base, it, { B });
          if (choices == null) return;
          await act(() => useItem(B, env, i, choices));
        } }, [use === '戦闘外' ? '戦闘の外で' : once ? '使った' : '使う']);
        return h('div.itemrow', {}, [h('div', {}, [h('b', { text: itemName(it) }), h('div.q', { text: def?.text ?? '' })]), b]);
      }),
      h('div.row', {}, [h('button.btn', { type: 'button', onclick: () => s.close() }, ['閉じる'])]),
    ]);
  }

  // ───────── 窓 ─────────
  /** 論客の最後のひと言（結果の窓に、1人1行） */
  function okamiLine() {
    const ls = content.flavor?.[B.result === 'win' ? 'battleWin' : 'battleLose'];
    return ls?.length ? h('p.flv', { text: ls[(B.turn * 7 + B.floor) % ls.length] }) : null;
  }
  function lastWords() {
    if (B.result !== 'win') return null;
    const seen = new Set();
    const rows = B.enemies.filter((e) => !seen.has(e.id) && seen.add(e.id)).map((e) => { const l = pickLine(e.id, 'defeat'); return l ? h('div.lw', {}, [h('b', { text: e.name }), h('span', { text: `「${l}」` })]) : null; }).filter(Boolean);
    return rows.length ? h('div.lastwords', {}, rows) : null;
  }
  function showResult() {
    if (o.onDone) {
      const ok = B.overkill;
      const s = sheet(app, [
        h('h2', { text: B.result === 'win' ? '勝ち' : B.result === 'lose' ? '倒れた' : '脱出' }),
        h('p', { text: `${B.turn}ターン　最大論破値 ${format(B.stats.maxV)}${B.zeni ? `　宿銭 ${B.zeni}` : ''}` }),
        ok?.level ? h('p', { text: `過剰論破：${ok.level}（×${fmtMul(ok.r)}）` }) : null,
        lastWords(),
        okamiLine(),
        h('div.row', {}, [h('button.btn.main', { type: 'button', onclick: () => { s.close(); o.onDone(B); } }, ['進む'])]),
      ], { sticky: true });
      return;
    }
    const ok = B.overkill;
    const s = sheet(app, [
      h('h2', { text: B.result === 'win' ? '勝ち' : B.result === 'lose' ? '未帰還' : '脱出' }),
      h('p', { text: `${B.turn}ターン　最大論破値 ${format(B.stats.maxV)}　宿銭 ${B.zeni}` }),
      ok?.level ? h('p', { text: `過剰論破：${ok.level}（×${fmtMul(ok.r)}）` }) : null,
      lastWords(),
      h('div.row', {}, [
        o.onRestart ? h('button.btn.main', { type: 'button', onclick: () => { s.close(); o.onRestart(); } }, ['もう一戦']) : null,
        h('button.btn', { type: 'button', onclick: () => { s.close(); o.onExit(); } }, ['戻る']),
      ]),
    ], { sticky: true });
  }

  function openMenu() {
    if (queue.busy) return;
    const s = sheet(app, [
      h('h2', { text: '中断' }),
      h('div.chips', {}, SPEEDS.map((v) => h(`button.chip${o.settings.speed === v ? '.on' : ''}`, { type: 'button', onclick: () => {
        o.settings.speed = v; o.saveSettings(o.settings); document.documentElement.style.setProperty('--speed', v); s.close(); render();
      } }, [`速さ ×${v}`]))),
      h('div.row', {}, [
        o.onDone ? null : holdButton('戦闘をやめる', () => { s.close(); o.onExit(); }),
        h('button.btn', { type: 'button', onclick: () => s.close() }, ['閉じる']),
      ]),
    ]);
  }

  // ───────── キー操作（PC） ─────────
  function onKey(e) {
    if (queue.busy) { queue.skip(); return true; }
    if (document.querySelector('.sheet-back')) return false;
    const k = e.key;
    if (/^[1-9]$/.test(k)) { const i = Number(k) - 1; if (i < B.hand.length) toggle(i); return true; }
    if (k === 'Enter') { doPlay(); return true; }
    if (k === 'd' || k === 'D') { doDiscard(); return true; }
    if (k === 'e' || k === 'E') { doEnd(); return true; }
    if (k === 't' || k === 'T') {
      const alive = B.enemies.map((x, i) => (x.dead ? -1 : i)).filter((i) => i >= 0);
      if (alive.length) { st.target = alive[(alive.indexOf(st.target) + 1) % alive.length]; render(); }
      return true;
    }
    if (k === 'Escape') { st.sel = []; updateCalc(); return true; }
    if (k === 'i' || k === 'I') { openItems(); return true; }
    return false;
  }

  render();
  root.dataset.mood = B.mood?.id ?? '';
  setTimeout(() => setBgmMood(B.mood && !B.result ? balance.moods?.[B.mood.id]?.bgm : null), 50);
  // 論客の口上（戦闘の始めだけ。content/flavor.yaml enemy）
  const pickLine = (id, k) => { const a = content.flavor?.enemy?.[id]?.[k]; return a?.length ? a[Math.floor(Math.random() * a.length)] : null; };
  function say(uid, text) {
    const f = refs.foes.get(uid);
    if (!f || !text) return;
    const b = h('div.say', { text });
    f.el.append(b);
    setTimeout(() => b.remove(), 2600);
  }
  if (!B.result && B.turn === 1 && !B.stats.plays) B.enemies.forEach((e, i) => setTimeout(() => say(e.uid, (e.epithet && e.line) || pickLine(e.id, 'intro')), 400 + i * 700));
  if (B.result && o.onDone) setTimeout(showResult, 0);   // 終わったところで閉じて開き直したとき
  return { el: root, onKey, render, state: st, refs: () => refs };
}

function pct(a, b) {
  const B = Big.from(b);
  if (B.isZero()) return 0;
  return Math.max(0, Math.min(100, Big.from(a).div(B).toNumber() * 100));
}

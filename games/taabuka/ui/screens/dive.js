// 潜行の画面：階（襖の列3つ）・追跡者・報酬・商い・湯・謎・非常口・踊り場・脱出／未帰還（仕様書 第4章・第10章）
// 状態 D は engine/dive.js が持つ。画面は D を描いて、dive.js の関数を呼ぶだけ。戦闘は battle 画面に任せる。

import { thingEl as sharedThing, pickThing } from '../things.js';
import { h, tip, toast, pick, sheet, holdButton, esc } from '../dom.js';
import { GRADE_COLOR, catGlyph, catColor, tierLabel, kwLines, bindText, rarOfCard, floorName } from '../labels.js';
import { askItem, ownedName } from '../items.js';
import {
  openDoors, isHidden, enterDoor, answerChase, fleeCost, chaseInfo, takeReward, rewardDests, closeReward, leaveRoom, buy,
  bathOptions, useBath, eventChoices, chooseEvent, exitCosts, useExit, landingInfo, descend, goBack,
  moveThing, useDiveItem, canUseOutside, pouchWeight, pouchValue, nameOf, sellValue, layerAt,
} from '../../engine/dive.js';
import { num as format } from '../num.js';
import { SE, footsteps } from '../audio/audio.js';
import { shakeChest, godDescent } from '../fx/shows.js';
import { shards } from '../fx/particles.js';

const presenceStage = (p) => (p >= 12 ? 3 : p >= 8 ? 2 : p >= 4 ? 1 : 0);
const revealed = new WeakSet();   // 宝箱の揺れを見せた報酬

const DOOR = {
  戦い: ['戦', '敵がいる'], 精鋭: ['精', '強い敵が1体（付き人がいることも）'], 宝: ['宝', '札が1枚。お土産・お品書きがあることも'],
  商い: ['商', '行商人。宿銭で買う'], 湯: ['湯', '体力・仕込み・気配のどれか1つ。デッキと懐を入れ替えられる'], 謎: ['謎', '何かある'],
  層主: ['主', 'この層の主'], 寄り道: ['寄', '列の外の宝部屋。入ると気配＋2'], 非常口: ['非', 'その場で脱出できる。通行料がいる'],
};
const PRESENCE_MARKS = [[4, '足音', '敵の主張＋20%'], [8, '見回り', '部屋に入るたび、追跡者が割り込むことがある'], [12, '凝視', '敵の主張＋50%。追跡者が必ず割り込む']];

/**
 * @param {object} o { app, base, D, onBattle(D), onEnd(), onChange(D) }  onChange は状態が変わるたび（自動保存）
 */
export function diveScreen(o) {
  const { app, base, D } = o;
  const { balance, content } = base;
  const root = h('div.scr.dive');

  function render() {
    const L = layerAt(content, D.floor, D.dungeon);
    root.style.setProperty('--lbg', L?.palette?.bg ?? 'var(--paper)');
    root.replaceChildren(...[renderTop(), renderPresence(), renderCurses(), h('main.dv', {}, [renderBody()]), renderFoot()].filter(Boolean));
    o.onRender?.(D);
    if (D.phase === 'reward' && !revealed.has(D.reward)) reveal();
  }

  // 拾う瞬間：宝箱が格の数だけ揺れてから開く。神格は暗転→金の光→回転して降りる
  async function reveal() {
    const R = D.reward;
    revealed.add(R);
    const q = o.queue;
    if (!q) return;
    // 宝箱の揺れはレアリティの高さだけ。ユニーク以上の札が出たら神降臨の演出
    const RO = base.balance.rarity.order;
    const rarI = (x) => (x.type === 'card' ? RO.indexOf(rarOfCard(base.balance, x, content.cards[x.id])) : 0);
    const top = R.groups.flatMap((g) => g.options).reduce((m, x) => Math.max(m, rarI(x)), 0);
    const god = R.groups.flatMap((g) => g.options).filter((x) => x.type === 'card' && rarI(x) >= RO.indexOf('ユニーク')).sort((a, b) => rarI(b) - rarI(a))[0];
    const panel = root.querySelector('.reward');
    const isChest = ['宝', '寄り道'].includes(R.kind);
    if (!isChest && !god) return;
    const X = { queue: q, root, layer: q.layer };
    await q.play([{ ms: 0, run: async () => {} }].concat(isChest ? [{ ms: 0, run: () => {
      const chest = h('div.chestfx', { text: '宝' });
      const cover = h('div.chestcover', {}, [chest]);
      panel?.append(cover);
      X.chest = chest; X.cover = cover;
    } }] : []).concat(isChest ? Array.from({ length: top + 1 }, (_, i) => ({ ms: 380, run: () => { SE.chest(); X.chest?.animate([{ transform: 'rotate(0)' }, { transform: `rotate(${i % 2 ? 9 : -9}deg) translateY(-${3 + i * 2}px)` }, { transform: 'rotate(0)' }], { duration: q.dur(260) }); } }))
      .concat([{ ms: 300, run: () => { SE.open(); if (X.chest) shards(X.chest.getBoundingClientRect(), '#c89a5a', 12); X.cover?.remove(); } }]) : [])
      .concat(god ? [{ ms: 2200, run: () => godDescent(X, `${rarOfCard(base.balance, god, content.cards[god.id])}　${content.cards[god.id].name}`) }] : []));
    root.querySelector('.chestcover')?.remove();
  }

  function redo(fn) {
    try { fn(); } catch (e) { if (e.userError) { toast(e.message); return; } throw e; }
    o.onChange?.(D);
    if (D.phase === 'battle') { o.onBattle(D); return; }
    render();
    if (D.msg) { toast(D.msg); D.msg = null; }
  }

  // ───────── 上帯・気配・下帯 ─────────
  function renderTop() {
    const L = layerAt(content, D.floor, D.dungeon);
    const hp = h('span.hp', {}, ['体力 ', h('b', { text: D.hp }), `/${D.maxHp}`]);
    const zn = h('span.zn', {}, ['宿銭 ', h('b', { text: D.zeni })]);
    const fl = h('span.fl', { text: floorName(content, D.dungeon, D.floor) });
    const bossHere = D.map?.rows?.flat().find((d) => d.kind === '層主')?.enemies?.[0];
    const bossId = L?.mix ? bossHere : D.bosses[L?.id];
    const nm = L?.noName ? '' : (L?.name ?? '');
    tip(fl, () => `<b>${esc(nm || floorName(content, D.dungeon, D.floor))}</b><br>${esc(L?.line ?? '')}${bossId ? `<br><span class="q">${content.enemies[bossId]?.kind === '底の主' ? '底の主' : '層主'}：${esc(content.enemies[bossId]?.name)}</span><br><span class="q">縛り：${esc(bindText({ content }, bossId))}</span>` : ''}${L?.mix ? `<br><span class="q">${L.bossEvery}階ごとに、どこかの層主が待つ</span>` : ''}`);
    return h('header.top', {}, [h('div.st', {}, [fl, h('span.ln', { text: nm }), hp, zn])]);
  }

  function renderPresence() {
    const max = 14;
    const v = D.presence;
    const fill = h('div.pfill', { style: { width: `${Math.min(100, (v / max) * 100)}%` } });
    const marks = PRESENCE_MARKS.map(([n, name]) => h(`div.pmark${v >= n ? '.on' : ''}`, { style: { left: `${(n / max) * 100}%` } }, [h('span', { text: name })]));
    const now = [...PRESENCE_MARKS].reverse().find(([n]) => v >= n);
    const el = h('section.presence', {}, [h('span.pl', {}, ['気配 ', h('b', { text: v })]), h('div.pbar', {}, [fill, ...marks]), h('span.pn', { text: now ? now[1] : '' })]);
    tip(el, () => `<b>気配 ${v}</b>${now ? `　<span class="q">${esc(now[1])}</span>` : ''}<br>${PRESENCE_MARKS.map(([n, name, t]) => `${n}「${name}」：${t}`).join('<br>')}<br><span class="q">部屋に入る＋1、寄り道＋2、戦闘の7ターン目から毎ターン＋1、湯で−3。層が変わると0</span>`);
    return el;
  }

  // 底の呪い（積み重なる。全ての戦闘に掛かる）・週替わり挑戦の印
  function renderCurses() {
    if (!D.curses?.length && !D.weekly) return null;
    const el = h('section.curses', {}, [h('b', { text: D.weekly ? `週替わり ${D.weekly}　` : '底の呪い ' }), (D.curses || []).map((c) => c.name).join('・')]);
    tip(el, () => `<b>${D.weekly ? '週替わりの挑戦' : '底の呪い'}</b><br>${(D.curses || []).map((c) => `${esc(c.name)}：${esc(c.text ?? '')}`).join('<br>')}<br><span class="q">底（B17〜）では3階ごとに呪いが1つ積み重なる。全ての戦闘に掛かる。生きて帰ると底の石</span>`);
    return el;
  }

  function renderFoot() {
    const w = pouchWeight(base, D);
    const bag = h('button.btn', { type: 'button', onclick: openBag }, ['懐 ', h('span.n', { text: w }), `/${D.carry.pouch}`]);
    tip(bag, () => `<b>懐</b>　<span class="q">重さ ${w}/${D.carry.pouch}・総額 ${pouchValue(base, D)}</span><br>持ち帰れば自分の物。重いほど帰路の番人が強い<br><span class="q">お守り袋 ${D.charm.length}/${D.carry.charm}：未帰還でも残る</span>`);
    const items = h('button.btn', { type: 'button', onclick: openItems }, ['品 ', h('span.n', { text: D.items.length })]);
    tip(items, () => `<b>お品書き</b><br>${D.items.length ? D.items.map((it) => esc(nameOf(base, { ...it, type: 'item' }))).join('、') : '持っていない'}`);
    const deck = h('button.btn', { type: 'button', onclick: openDeck }, ['札 ', h('span.n', { text: D.deck.length })]);
    tip(deck, () => `<b>デッキ ${D.deck.length}枚</b>`);
    return h('footer.ops', {}, [deck, bag, items]);
  }

  // ───────── 場面 ─────────
  function renderBody() {
    switch (D.phase) {
      case 'map': return renderMap();
      case 'chase': return renderChase();
      case 'reward': return renderReward();
      case 'shop': return renderShop();
      case 'bath': return renderBath();
      case 'event': return renderEvent();
      case 'exit': return renderExit();
      case 'landing': return renderLanding();
      case 'end': return renderEnd();
      default: return h('div', { text: D.phase });
    }
  }

  function doorEl(d, { active, visited }) {
    const hidden = isHidden(D, d);
    const [g, t] = hidden ? ['？', '開けるまで分からない'] : DOOR[d.kind] ?? [d.kind[0], ''];
    const el = h(`button.door${d.side ? '.side' : ''}${active ? '.act' : ''}${visited ? '.vis' : ''}${d.kind === '層主' ? '.boss' : ''}`, {
      type: 'button', disabled: !active, dataset: { room: d.room, kind: hidden ? '？' : d.kind },
      style: d.glow ? { '--glow': GRADE_COLOR[d.glow] } : {},
      onclick: () => { SE.fusuma(); const n = presenceStage(D.presence + 1); if (n) setTimeout(() => footsteps(n), 300); const ls = content.flavor?.doors?.[d.kind]; if (ls?.length) toast(ls[Math.floor(Math.random() * ls.length)]); redo(() => enterDoor(base, D, d.room)); },
    }, [h('span.g', { text: g }), h('span.k', { text: hidden ? '？' : d.kind })]);
    if (d.glow) el.classList.add('glow');
    tip(el, () => `<b>${hidden ? '？' : esc(d.kind)}</b><br>${esc(d.kind === '層主' && !hidden ? `${content.enemies[d.enemies?.[0]]?.name ?? ''}` : t)}${d.kind === '層主' && !hidden && bindText({ content }, d.enemies?.[0]) ? `<br><span class="q">縛り：${esc(bindText({ content }, d.enemies[0]))}</span>` : ''}${d.glow ? '<br><span class="q">うっすら光っている</span>' : ''}`);
    return el;
  }

  function renderMap() {
    const doors = openDoors(D).map((d) => d.room);
    const rows = D.map.rows.map((row, r) => {
      const side = [D.map.side, D.map.exit].filter((x) => x && x.row === r);
      const state = r < D.row ? 'past' : r === D.row ? 'now' : 'next';
      return h(`div.drow.${state}`, {}, [
        h('div.dn', { text: row[0]?.kind === '層主' ? '主' : `${r + 1}` }),
        h('div.ds', {}, row.map((d) => doorEl(d, { active: doors.includes(d.room), visited: D.map.visited.includes(d.room) }))),
        h('div.dx', {}, side.map((d) => doorEl(d, { active: doors.includes(d.room), visited: D.map.visited.includes(d.room) }))),
      ]);
    });
    const L = layerAt(content, D.floor, D.dungeon);
    const boss = D.bosses[L.id] ? content.enemies[D.bosses[L.id]] : null;
    return h('div.map', {}, [
      h('p.hint', { text: boss ? `この層の主：${boss.name}` : '' }),
      ...rows,
    ]);
  }

  function renderChase() {
    const e = chaseInfo(base, D);
    const cost = fleeCost(base, D);
    return h('div.panel.chase', {}, [
      h('p.q', { text: '何かが、すぐ後ろにいる。' }),
      h('h2', { text: e.name }),
      h('p', { text: `「${e.line}」` }),
      h('p', {}, ['主張 ', h('b', { text: format(e.claim) }), `　攻撃 ${e.atk}`]),
      h('div.row', {}, [
        h('button.btn.main', { type: 'button', onclick: () => redo(() => answerChase(base, D, 'fight')) }, ['戦う']),
        holdButton(`逃げる：${cost.text}`, () => redo(() => answerChase(base, D, 'flee'))),
      ]),
      h('p.q', { text: '勝てば宿銭と上等なお土産。逃げれば代償を払って部屋に入る' }),
    ]);
  }

  function thingEl(x) {
    return sharedThing(base, x);
  }

  // その部屋の一行（content/flavor.yaml の shop／bath／landing／reward）。同じ部屋では同じ行
  function flLine(key) {
    const ls = content.flavor?.[key]; if (!ls?.length) return null;
    const k = (D.floor * 31 + (D.here?.room ?? 0) * 7 + (D.here?.row ?? 0) * 3 + key.length) % ls.length;
    return h('p.flv', { text: ls[k] });
  }
  function renderReward() {
    const R = D.reward;
    const title = { 宝: '宝', 寄り道: '寄り道', 通常: '勝ち', 精鋭: '精鋭に勝った', 層主: '層主を倒した', 追跡者: '追跡者を退けた' }[R.kind] ?? '報酬';
    const groups = R.groups.map((g, gi) => {
      const done = g.taken.length >= g.pick;
      const label = { card: '札を1枚', regular: '常連客を1人', relic: '置物を1つ', souvenir: 'お土産', item: 'お品書き' }[g.type];
      return h(`section.grp${done ? '.done' : ''}`, {}, [
        h('h3', { text: done ? `${label}（${g.taken[0] ? '受け取った' : '見送った'}）` : label }),
        h('div.things', {}, g.options.map((x, oi) => {
          const el = thingEl(x);
          if (g.taken.includes(x.uid)) el.classList.add('took');
          if (!done) {
            el.classList.add('tap');
            el.addEventListener('click', () => chooseDest(x, (to) => redo(() => takeReward(base, D, gi, oi, to))));
          }
          return el;
        })),
        done ? null : h('button.btn.skip', { type: 'button', onclick: () => redo(() => takeReward(base, D, gi, 0, 'skip')) }, ['見送る']),
      ]);
    });
    return h('div.panel.reward', {}, [
      h('h2', { text: title }),
      flLine('reward'),
      R.overkill ? h('p.ok', { text: R.overkill }) : null,
      R.zeni ? h('p', { text: `宿銭 ＋${R.zeni}` }) : null,
      ...groups,
      h('div.row', {}, [h('button.btn.main', { type: 'button', onclick: () => redo(() => closeReward(base, D)) }, ['進む'])]),
    ]);
  }

  function chooseDest(x, done, note) {
    const opts = rewardDests(base, D, x);
    const s = sheet(app, [
      h('h2', { text: nameOf(base, x) }),
      note ? h('p.q', { text: note }) : null,
      thingEl(x),
      h('div.row', {}, opts.map((d) => h(`button.btn${d.to === 'deck' ? '.main' : ''}`, { type: 'button', disabled: !d.ok, onclick: () => { s.close(); done(d.to); } }, [d.label]))),
    ]);
  }

  function renderShop() {
    const cells = D.shop.goods.map((g, i) => {
      const can = !g.sold && D.zeni >= g.price;
      const el = g.type === 'remove' ? h('div.thing', {}, [h('b', { text: '札の除去' }), h('span.sub', { text: 'デッキから1枚除く' })]) : thingEl(g);
      el.classList.add('shopcell');
      if (g.sold) el.classList.add('sold');
      el.append(h('span.price', { text: g.sold ? '売れた' : `${g.price}` }));
      if (!can) el.classList.add('cant');
      el.addEventListener('click', async () => {
        if (!can) { toast(g.sold ? 'もう売れた' : '宿銭が足りない'); return; }
        if (g.type === 'remove') {
          const uid = await pickThing(base, app, '除く札を選ぶ', D.deck.map((c) => ({ ...c, type: 'card' })), { yes: '除く' });
          if (uid != null) redo(() => buy(base, D, i, { card: uid }));
          return;
        }
        chooseDest(g, (to) => { if (to !== 'skip') redo(() => buy(base, D, i, { to })); }, `${g.price}で買う`);
      });
      return el;
    });
    return h('div.panel.shop', {}, [
      h('h2', { text: '商い' }),
      flLine('shop'),
      h('p.q', { text: `宿銭 ${D.zeni}` }),
      h('div.shopgrid', {}, cells),
      h('div.row', {}, [h('button.btn.main', { type: 'button', onclick: () => redo(() => leaveRoom(base, D)) }, ['出る'])]),
    ]);
  }

  function renderBath() {
    const opts = bathOptions(base, D);
    return h('div.panel.bath', {}, [
      h('h2', { text: '湯' }),
      flLine('bath'),
      h('p.q', { text: D.bath.done ? '湯気が、ゆっくり上がっていく。' : 'ひとつだけ。' }),
      h('div.col', {}, opts.map((op) => h('button.btn', { type: 'button', disabled: D.bath.done, onclick: async () => {
        if (op.needCard) {
          const uid = await pickThing(base, app, '仕込む札を選ぶ', D.deck.map((c) => ({ ...c, type: 'card' })), { yes: '仕込む' });
          if (uid != null) redo(() => useBath(base, D, op.id, uid));
        } else redo(() => useBath(base, D, op.id));
      } }, [op.label]))),
      h('button.btn', { type: 'button', onclick: () => openBag(true) }, ['デッキと懐を入れ替える']),
      h('div.row', {}, [h('button.btn.main', { type: 'button', onclick: () => redo(() => leaveRoom(base, D)) }, ['出る'])]),
    ]);
  }

  // 選ぶ前の目安（do から作る。hide: true の選択肢は「？？？」）
  function doHint(c) {
    if (c.hide) return '？？？';
    const sg = (n) => (n > 0 ? `＋${n}` : `−${Math.abs(n)}`);
    const cat = (a) => (a && typeof a === 'object' && a.カテゴリ && !['乱数', '一番低い', '一番高い', '相手'].includes(a.カテゴリ) ? a.カテゴリ : '？');
    const out = [];
    for (const d of [].concat(c.do || [])) {
      const [k, v] = typeof d === 'string' ? [d, null] : Object.entries(d)[0];
      switch (k) {
        case '宿銭': out.push(`宿銭${sg(v)}`); break;
        case '体力': out.push(`体力${sg(v)}`); break;
        case '気配': out.push(`気配${sg(v)}`); break;
        case '番付を上げる': out.push(`番付↑ ${cat(v)}${v?.段 ? `${v.段}段` : ''}`); break;
        case '番付を下げる': out.push(`番付↓ ${cat(v)}${v?.段 ? `${v.段}段` : ''}`); break;
        case '番付を移す': out.push(`番付 ${cat(v)}→${v?.先 === 'God' ? 'God' : `T${v?.先 ?? '？'}`}`); break;
        case '番付を入れ替える': out.push('番付が入れ替わる'); break;
        case '番付を反転': out.push('番付が逆さに'); break;
        case '番付を均す': out.push('番付が揃う'); break;
        case 'お品書きを得る': out.push(`お品書き（${v}）`); break;
        case 'お土産を得る': out.push(`お土産「${content.souvenirs[v]?.name ?? '？'}」`); break;
        case '札に付ける': out.push(`札に${v?.仕込み ? '仕込み' : v?.判 ? '判' : v?.版 ? '版' : '何か'}`); break;
        case '常連客を得る': out.push('常連客が来る'); break;
        case 'デッキから除く': out.push('札が1枚減る'); break;
        case '襖を見せる': out.push('襖の中が見える'); break;
        default: out.push('？');
      }
    }
    return out.join('・');
  }

  function renderEvent() {
    const ev = content.events[D.event.id];
    const kids = [h('h2', { text: ev.title }), h('p.ev', { text: ev.text })];
    if (D.event.choice == null) {
      const ch = eventChoices(base, D);
      kids.push(h('div.col', {}, ch.map((c) => { const hint = doHint(ev.choices[c.i]); return h('button.btn.evc', { type: 'button', disabled: !c.ok, onclick: () => redo(() => chooseEvent(base, D, c.i)) }, [h('span', { text: c.label }), hint ? h('small.evh', { text: hint }) : null]); })));
    } else {
      const fx = D.event.effects || [];
      kids.push(
        h('p.ev.res', { text: D.event.result }),
        h('div.evfx', {}, fx.length ? fx.map((f) => h(`div.evf.${f.good ? 'good' : 'bad'}`, { text: f.text })) : [h('div.evf.none', { text: '何も起きなかった（たぶん）' })]),
        h('div.row', {}, [h('button.btn.main', { type: 'button', onclick: () => redo(() => leaveRoom(base, D)) }, ['進む'])]),
      );
    }
    return h('div.panel.event', {}, kids);
  }

  function renderExit() {
    const costs = exitCosts(base, D);
    return h('div.panel.exit', {}, [
      h('h2', { text: '非常口' }),
      h('p.q', { text: '外の匂いがする。通るには、何か置いていく。' }),
      h('div.col', {}, costs.map((c) => holdButton(c.label, () => redo(() => useExit(base, D, c.id, c.uid))))),
      h('div.row', {}, [h('button.btn', { type: 'button', onclick: () => redo(() => useExit(base, D, 'back')) }, ['戻る'])]),
    ]);
  }

  function renderLanding() {
    const info = landingInfo(base, D);
    const n = info.next;
    const cnt = (c) => `${c.seen}${c.hidden ? '？' : ''}`;
    const next = n ? h('div.lnext', {}, [
      h('div', { text: `次：${floorName(content, D.dungeon, n.floor)}${n.newLayer ? `「${n.layer}」` : ''}${n.boss ? '（層主の階）' : ''}` }),
      h('div', {}, [`精鋭 ${cnt(n.elite)}　宝 ${cnt(n.treasure)}`, n.side ? '　寄り道あり' : '']),
    ]) : h('div.lnext', { text: 'この先は、まだ無い。' });
    const wd = info.warden;
    const warden = info.afterBoss ? h('div.lwarden', { text: '昇降機が動いている。番人はいない。' }) : wd ? h('div.lwarden', {}, [
      h('div', {}, [`帰路の番人「${wd.name}」　主張 `, h('b', { text: format(wd.claim) }), `　攻撃 ${wd.atk}`]),
      h('div.q', { text: wd.weight ? `懐の重さ ${wd.weight} → ×${(1 + wd.perWeight * wd.weight).toFixed(1)}（身軽なら ${format(wd.plain)}）` : '懐は空。番人はいちばん弱い' }),
    ]) : null;
    const back = holdButton(info.afterBoss ? '昇降機で帰る' : '引き返す', () => redo(() => goBack(base, D)), 'back');
    const down = holdButton('下りる', () => redo(() => descend(base, D)), 'down');
    down.disabled = !info.canDescend;
    return h('div.panel.landing', {}, [
      h('h2', { text: `${floorName(content, D.dungeon, D.floor)} 踊り場` }),
      flLine('landing'),
      h('div.lstat', {}, [
        h('div', {}, ['体力 ', h('b', { text: info.hp }), `/${info.maxHp}`]),
        h('div', {}, ['気配 ', h('b', { text: info.presence })]),
        h('div', {}, ['懐の総額 ', h('b', { text: info.value })]),
      ]),
      next, warden,
      h('div.lchoice', {}, [back, down]),
    ]);
  }

  function renderEnd() {
    const r = D.result;
    const ok = r.outcome === 'escaped';
    const via = { warden: '番人を退けて', lift: '昇降機で', exit: '非常口から', item: '縄梯子で', stairs: '階段で', battle: '', event: '' }[r.via] ?? '';
    return h('div.panel.end', {}, [
      h('h2.big', { text: ok ? '脱出' : '未帰還' }),
      h('p', { text: ok ? `${via}帰った。${floorName(content, D.dungeon, r.floor)}まで。` : `${floorName(content, D.dungeon, r.floor)}で倒れた。` }),
      h('p.q', { text: `部屋 ${r.rooms}・戦闘 ${r.battles}・最大論破値 ${format(r.maxV)}` }),
      ok ? h('p', { text: `宿銭 ${r.zeni}${r.relicCash ? `＋置物の換金 ${r.relicCash}` : ''}` }) : h('p', { text: `失ったもの：総額 ${r.lostValue}` }),
      h('div.keptlist', {}, [h('h3', { text: ok ? '持ち帰ったもの' : 'お守り袋に残ったもの' }),
        h('ul', {}, r.kept.filter((x) => x.type !== 'card').slice(0, 20).map((x) => h('li', { text: `${x.name}（${x.sell}）` }))),
        ok ? h('p.q', { text: `札 ${r.kept.filter((x) => x.type === 'card').length}枚` }) : null]),
      D.sudomari ? h('p.q', { text: '素泊まり：借り物は返し、拾った物だけが自分の物になる。' }) : null,
      h('div.row', {}, [h('button.btn.main', { type: 'button', onclick: () => o.onEnd() }, ['宿へ'])]),
    ]);
  }

  // ───────── 持ち物 ─────────
  function openBag(bath = false) {
    const inBath = D.phase === 'bath';
    const s = sheet(app, []);
    const draw = () => {
      const mv = (from, x, to, label) => h('button.chip', { type: 'button', onclick: () => {
        try { moveThing(base, D, from, x.uid, to); } catch (e) { if (e.userError) { toast(e.message); return; } throw e; }
        o.onChange?.(D); draw(); render();
      } }, [label]);
      const line = (from, x, moves) => h('div.itemrow', {}, [h('div', {}, [h('b', { text: nameOf(base, { ...x, type: x.type ?? { deck: 'card', seats: 'regular', relics: 'relic', items: 'item' }[from] }) }),
        h('span.q', { text: `　売値 ${sellValue(base, { ...x, type: x.type ?? { deck: 'card', seats: 'regular', relics: 'relic', items: 'item' }[from] })}` })]), h('div.chips', {}, moves)]);
      const kids = [h('h2', { text: '持ち物' }), h('p.q', { text: inBath ? '湯では、デッキと懐を入れ替えられる。' : '懐とお守り袋は、戦闘の外ならいつでも入れ替えられる。' })];
      kids.push(h('h3', { text: `懐　重さ ${pouchWeight(base, D)}/${D.carry.pouch}・総額 ${pouchValue(base, D)}` }));
      if (!D.pouch.length) kids.push(h('p.q', { text: '空' }));
      for (const x of D.pouch) {
        const moves = [mv('pouch', x, 'charm', 'お守り袋へ')];
        if (x.type === 'item') moves.push(mv('pouch', x, 'items', 'お品書きへ'));
        if (inBath && x.type === 'card') moves.push(mv('pouch', x, 'deck', 'デッキへ'));
        if (inBath && x.type === 'regular') moves.push(mv('pouch', x, 'seats', '席へ'));
        if (inBath && x.type === 'relic') moves.push(mv('pouch', x, 'relics', '置く'));
        kids.push(line('pouch', x, moves));
      }
      kids.push(h('h3', { text: `お守り袋　${D.charm.length}/${D.carry.charm}（未帰還でも残る）` }));
      for (const x of D.charm) kids.push(line('charm', x, [mv('charm', x, 'pouch', '懐へ')]));
      if (inBath || bath) {
        kids.push(h('h3', { text: `デッキ ${D.deck.length}枚` }));
        for (const x of D.deck) kids.push(line('deck', x, inBath ? [mv('deck', x, 'pouch', '懐へ')] : []));
      }
      kids.push(h('div.row', {}, [h('button.btn', { type: 'button', onclick: () => s.close() }, ['閉じる'])]));
      s.el.replaceChildren(...kids);
    };
    draw();
  }

  function openItems() {
    const s = sheet(app, []);
    const draw = () => {
      const kids = [h('h2', { text: 'お品書き' }), h('p.q', { text: `${D.items.length}/${balance.hands.play.itemSlots}　懐に入れたものは戦闘で使えない` })];
      D.items.forEach((it, i) => {
        const def = it.id ? content.items[it.id] : null;
        const can = canUseOutside(base, D, it);
        kids.push(h('div.itemrow', {}, [
          h('div', {}, [h('b', { text: nameOf(base, { ...it, type: 'item' }) }), h('div.q', { text: `${def?.text ?? ''}${(def?.use ?? '戦闘中') === '戦闘中' ? '（戦闘中）' : ''}` })]),
          h('div.chips', {}, [
            h('button.chip', { type: 'button', disabled: !can, onclick: async () => {
              s.close();
              const choices = await askItem(app, base, it, { D });
              if (choices == null) return;
              redo(() => useDiveItem(base, D, i, choices));
            } }, ['使う']),
            h('button.chip', { type: 'button', disabled: ['battle', 'end'].includes(D.phase), onclick: () => {
              try { moveThing(base, D, 'items', it.uid, 'pouch'); } catch (e) { if (e.userError) { toast(e.message); return; } throw e; }
              o.onChange?.(D); draw(); render();
            } }, ['懐へ']),
          ]),
        ]));
      });
      if (!D.items.length) kids.push(h('p.q', { text: '持っていない' }));
      kids.push(h('div.row', {}, [h('button.btn', { type: 'button', onclick: () => s.close() }, ['閉じる'])]));
      s.el.replaceChildren(...kids);
    };
    draw();
  }

  function openDeck() {
    const list = D.deck.map((c) => ({ c, def: content.cards[c.id] })).sort((a, b) => String(a.def?.cat?.[0]).localeCompare(String(b.def?.cat?.[0]), 'ja'));
    const s = sheet(app, [
      h('h2', { text: `デッキ ${D.deck.length}枚` }),
      h('div.things.deck', {}, list.map(({ c }) => thingEl({ ...c, type: 'card' }))),
      h('div.row', {}, [h('button.btn', { type: 'button', onclick: () => s.close() }, ['閉じる'])]),
    ]);
  }

  function onKey(e) {
    if (document.querySelector('.sheet-back')) return false;
    if (D.phase === 'map' && /^[1-9]$/.test(e.key)) {
      const d = openDoors(D)[Number(e.key) - 1];
      if (d) redo(() => enterDoor(base, D, d.room));
      return true;
    }
    return false;
  }

  render();
  return { el: root, render, onKey };
}


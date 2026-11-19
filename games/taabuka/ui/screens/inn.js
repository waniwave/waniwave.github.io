// 宿の画面：宿（施設の縦一覧）・各施設・蔵と編成・潜行準備・結果・設定（仕様書 第6章・第10章）
// 状態 H は engine/meta.js が持つ。画面は H を描き、meta.js の関数を呼んで ctx.save() するだけ。

import { h, tip, toast, pick, sheet, holdButton, esc } from '../dom.js';
import { thingEl } from '../things.js';
import { slotLabel } from '../labels.js';
import { num as format } from '../num.js';
import { SE } from '../audio/audio.js';
import { confetti, shards } from '../fx/particles.js';
import { nameOf, sellValue } from '../../engine/dive.js';
import {
  facility, facilityDef, upgradeInfo, upgrade, stashRoom, toggleDeck, sell, choubaGoods, buyChouba, canTakeStarter, takeStarter, pawnGoods, pawnInfo, borrowPawn, returnPawn, setShibari, shibariList, dailyInfo, readShare,
  shikomiMenu, applyShikomi, copyInfo, copyCard, kuyoPrice, kuyo, prepInfo, insurable, charmable, premium, returnRate, carryOf,
} from '../../engine/meta.js';

const FAC_TEXT = {
  chouba: (f) => `札${f.shopCards}枚（${f.shopGrades.join('・')}）${f.pawnshop ? '・質屋' : ''}`,
  kura: (f) => `${f.capacity}枠${f.copyUpTo ? `・複製（${f.copyUpTo}まで）` : ''}`,
  monooki: (f) => `懐${f.pouch}・お守り袋${f.charm}`,
  kyakuma: (f) => `持ち込み席${f.seats}`,
  kamidana: (f) => `戻り${Math.round(f.returnRate * 100)}%・掛け金${Math.round(f.premium * 100)}%`,
  shikomi: (f) => `仕込み${f.enh.length}種${f.ed?.length ? `・版${f.ed.length}` : ''}${f.seal?.length ? '・判' : ''}`,
};
const effText = (base, H, id, lv) => {
  const def = facilityDef(base, id);
  const e = {};
  def.levels.slice(0, lv).forEach((l) => Object.assign(e, l.effect || {}));
  return FAC_TEXT[id] ? FAC_TEXT[id](e) : '';
};
const costText = (base, cost = {}) => [cost.zeni ? `宿銭${cost.zeni}` : '', ...Object.entries(cost.souvenirs || {}).map(([s, n]) => `${base.content.souvenirs?.[s]?.name ?? s}×${n}`)].filter(Boolean).join('＋');

/** null を除いて差し替える */
const put = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));

function guard(fn) { try { fn(); return true; } catch (e) { if (e.userError) { toast(e.message); return false; } throw e; } }

function top(title, H, back, left = null) {
  return h('header.itop', {}, [
    back ? h('button.btn', { type: 'button', onclick: back }, ['戻る']) : left ?? h('span'),
    h('h2', { text: title }),
    h('div.wallet', {}, [h('span', {}, ['宿銭 ', h('b', { text: H.zeni })]), H.kuyo ? h('span', {}, ['供養 ', h('b', { text: H.kuyo })]) : null, H.debt ? h('span.debt', {}, ['借金 ', h('b', { text: H.debt })]) : null]),
  ]);
}

/** 深度の説明（その深度で新しく加わる条件） */
const DEPTH_TEXT = {
  enemyClaim: (v) => `敵の主張＋${Math.round(v * 100)}%`, eliteDoorMul: (v) => `精鋭の襖×${v}`, wardenClaim: (v) => `番人＋${Math.round(v * 100)}%`,
  insuranceReturn: (v) => `保険の戻り${Math.round(v * 100)}pt`, bossExtraHindrance: () => '層主に妨害＋1', presenceGainMul: (v) => `気配×${v}`,
  charmSlots: (v) => `お守り袋${v}`, bathHealMul: () => '湯の回復半減', noEmergencyExit: () => '非常口なし', cursedHighGrades: () => '曰く付きの極・神',
  handSize: (v) => `手札${v}`, shopPrice: (v) => `値段＋${Math.round(v * 100)}%`, stalkerChance: (v) => `追跡者${Math.round(v * 100)}%`,
  enemyAtk: (v) => `敵の攻撃＋${Math.round(v * 100)}%`, bossDiscards: (v) => `層主戦の流し${v}`, maxHp: (v) => `体力${Math.round(v * 100)}%`,
  bossForms: (v) => `底の主${v}形態`, charmSlotsMax: () => 'お守り袋0',
};
function depthText(base, d) {
  if (!d) return '条件なし';
  const lv = base.balance.depth.levels[d] || {};
  return Object.entries(lv).map(([k, v]) => DEPTH_TEXT[k]?.(v) ?? k).join('・') + (d > 1 ? '（これまでの分も）' : '');
}

/** 遊び方（決まりごとの一覧。中身は ui/lessons.js） */
export function rulesSheet(ctx) {
  const s = sheet(ctx.app, [
    h('h2', { text: '遊び方' }),
    h('div.rules', {}, ctx.rules().flatMap(([title, lines]) => [h('h3', { text: title }), h('ul', {}, lines.map((t) => h('li', { text: t })))])),
    h('div.row', {}, [h('button.btn.main', { type: 'button', onclick: () => s.close() }, ['閉じる'])]),
  ]);
  return s;
}

// ───────────────────────── 宿 ─────────────────────────
export function innScreen(ctx) {
  const { base } = ctx;
  const H = ctx.H();
  const root = h('div.scr.inn');
  function render() {
    const rows = (base.content.facilities || []).map((f) => {
      const lv = H.facilities[f.id] ?? 1;
      const up = upgradeInfo(base, H, f.id);
      const row = h('button.facrow', { type: 'button', onclick: () => ctx.go.facility(f.id) }, [
        h('div.fn', {}, [h('b', { text: f.name }), h('span.lv', { text: `Lv${lv}` })]),
        h('div.fe', { text: effText(base, H, f.id, lv) }),
        h(`div.fu${up.ok ? '.ok' : ''}`, { text: up.max ? '―' : up.next?.ready === false ? '―' : up.ok ? '改装できる' : `次 ${costText(base, up.cost)}` }),
      ]);
      tip(row, () => `<b>${esc(f.name)} Lv${lv}</b><br>${esc(f.text ?? '')}<br>${esc(effText(base, H, f.id, lv))}${up.next ? `<br><span class="q">Lv${up.lv}：${esc(effText(base, H, f.id, up.lv))}（${esc(costText(base, up.cost))}）${up.next.ready === false ? '・まだ' : ''}</span>` : ''}`);
      return row;
    });
    const room = stashRoom(base, H);
    put(root, 
      top('宿', H, null, h('button.btn', { type: 'button', onclick: () => rulesSheet(ctx) }, ['遊び方'])),
      ctx.updateReady?.() ? h('button.btn.update', { type: 'button', onclick: () => ctx.applyUpdate() }, ['新しい版があります。更新する']) : null,
      h('div.recs', { text: `最深 B${H.records.deepest}・最大論破値 ${format(H.records.maxV)}・脱出 ${H.records.extracts}・未帰還 ${H.records.deaths}` }),
      h('div.facs', {}, rows),
      H.overflow ? h('p.warn', { text: `蔵があふれている（${room.used}/${room.cap}）。売ってから潜る` }) : null,
      h('div.irow', {}, [
        h('button.btn', { type: 'button', onclick: () => ctx.go.stash() }, [`蔵・編成 ${room.used}/${room.cap}`]),
        h('button.btn', { type: 'button', onclick: () => ctx.go.board() }, ['掲示板']),
        h('button.btn', { type: 'button', onclick: () => ctx.go.zukan() }, ['図鑑']),
        h('button.btn', { type: 'button', onclick: () => ctx.go.settings() }, ['設定']),
      ]),
      h('footer.ops', {}, [
        h('button.btn', { type: 'button', disabled: H.sudomari <= 0 || H.overflow, onclick: () => ctx.go.sudomari() }, [`素泊まり ${H.sudomari}`]),
        h('button.btn.main', { type: 'button', disabled: H.overflow, onclick: () => ctx.go.prep() }, ['潜る']),
      ]),
    );
  }
  render();
  return { el: root, render };
}

// ───────────────────────── 施設 ─────────────────────────
export function facilityScreen(ctx, id) {
  const { base, app } = ctx;
  const H = ctx.H();
  const def = facilityDef(base, id);
  const root = h('div.scr.inn.fac');
  const act = (fn) => { if (guard(fn)) { ctx.save(); render(); } };

  // 質屋（帳場Lv3）：質札を2枚まで借りる。脱出で返して謝礼（売値の半分）、未帰還で売値が借金
  function pawnPart() {
    const info = pawnInfo(base, H);
    if (!info.open) return [h('p.q', { text: '帳場Lv3で質屋が開く（質札：強い曰く札を借りる）。' })];
    const goods = pawnGoods(base, H);
    const held = H.stash.filter((x) => x.origin === 'pawn');
    return [
      h('h3', { text: `質屋　質札 ${info.held}/${info.max}${info.debt ? `・借金 ${info.debt}` : ''}` }),
      info.reason && !held.length ? h('p.warn', { text: info.reason }) : null,
      h('div.shopgrid', {}, goods.map((g) => {
        const el = thingEl(base, { type: 'card', id: g.id, origin: 'pawn', uid: `p${g.i}` }, { onclick: () => act(() => { borrowPawn(base, H, g.i); toast('質札を借りた（デッキに入れた）'); }) });
        el.classList.add('shopcell');
        if (g.taken) el.classList.add('sold');
        else if (info.reason) el.classList.add('cant');
        el.append(h('span.price', { text: g.taken ? '借りた' : `質 ${g.sell}` }));
        return el;
      })),
      held.length ? h('button.btn', { type: 'button', onclick: async () => {
        const u = await pick(app, '返す質札', held.map((x) => ({ label: nameOf(base, x), value: x.uid })));
        if (u) act(() => returnPawn(base, H, u));
      } }, ['借りた質札を返す']) : null,
      h('p.q', { text: '脱出で返すと売値の半分の謝礼。未帰還で失うと売値が借金になる。' }),
    ];
  }

  function bodyOf() {
    const f = facility(base, H, id);
    switch (id) {
      case 'chouba': {
        const goods = choubaGoods(base, H);
        return [
          h('p.q', { text: '品揃えは潜るたびに替わる。' }),
          h('div.shopgrid', {}, goods.map((g) => {
            const el = thingEl(base, { type: 'card', id: g.id, origin: 'orig', uid: `g${g.i}` }, { onclick: () => act(() => buyChouba(base, H, g.i)) });
            el.classList.add('shopcell');
            if (g.sold) el.classList.add('sold');
            if (!g.sold && H.zeni < g.price) el.classList.add('cant');
            el.append(h('span.price', { text: g.sold ? '売れた' : g.price }));
            return el;
          })),
          ...pawnPart(),
          canTakeStarter(base, H) ? h('button.btn', { type: 'button', onclick: () => act(() => { takeStarter(base, H); toast('素泊まりセットを受け取った'); }) }, ['素泊まりセットを受け取る（20枚）']) : h('p.q', { text: `蔵の札が${base.balance.economy.inn.starterBelow}枚未満になると、素泊まりセット（初期デッキ）を渡す。` }),
        ];
      }
      case 'kura': {
        const room = stashRoom(base, H);
        return [
          h('p', { text: `${room.used}/${room.cap} 枠` }),
          h('button.btn', { type: 'button', onclick: () => ctx.go.stash() }, ['蔵・編成を開く']),
          f.copyUpTo ? h('button.btn', { type: 'button', onclick: async () => {
            const cards = H.stash.filter((x) => copyInfo(base, H, x.uid).ok);
            if (!cards.length) { toast('複製できる札が無い'); return; }
            const u = await pick(app, `複製（売値×${base.balance.economy.inn.copy.sellMul}＋${base.content.souvenirs[base.balance.economy.inn.copy.souvenir]?.name}）`, cards.map((x) => ({ label: `${nameOf(base, x)}（${copyInfo(base, H, x.uid).zeni}）`, value: x.uid })));
            if (u) act(() => { copyCard(base, H, u); toast('写しを作った'); });
          } }, ['複製する']) : h('p.q', { text: 'Lv2で複製（写し：版と判を持たず、仕込みは写る）。' }),
        ];
      }
      case 'monooki': {
        const c = carryOf(base, H, 0);
        return [h('p', { text: `懐 ${c.pouch}・お守り袋 ${c.charm}` }), h('p.q', { text: '懐が重いほど帰路の番人が強い。お守り袋の中身は未帰還でも残る。' })];
      }
      case 'kyakuma':
        return [h('p', { text: `潜行に連れていける常連客 ${f.seats}人` }), h('p.q', { text: '常連客は潜行準備で選ぶ。' })];
      case 'kamidana':
        return [
          h('p', { text: `戻り ${Math.round(f.returnRate * 100)}%・掛け金 売値の${Math.round(f.premium * 100)}%` }),
          h('h3', { text: `戻り待ち ${H.insuredPending.length}` }),
          h('div.mlist', {}, H.insuredPending.map((p) => h('div.itemrow', {}, [h('span', { text: nameOf(base, p.owned) }), h('span.q', { text: `${Math.round(p.rate * 100)}%` })]))),
          h('h3', { text: `遺失物帳（供養点 ${H.kuyo}）` }),
          h('div.mlist', {}, H.lostLog.map((x, i) => h('div.itemrow', {}, [
            h('span', { text: nameOf(base, x) }),
            h('button.chip', { type: 'button', disabled: H.kuyo < kuyoPrice(base, x), onclick: () => act(() => { kuyo(base, H, i); toast('供養して戻した'); }) }, [`供養 ${kuyoPrice(base, x)}`]),
          ]))),
        ];
      case 'shikomi': {
        const menu = shikomiMenu(base, H);
        const sv = base.content.souvenirs[base.balance.economy.inn.shikomiCost.souvenir]?.name;
        return [
          h('p.q', { text: `付けるたびに宿銭＋${sv}1つ。付け直すと前のものは消える。` }),
          h('div.chips', {}, menu.map((m) => h('button.chip', { type: 'button', onclick: async () => {
            const cards = H.stash.filter((x) => x.type === 'card' && (m.kind === 'enh' || x.origin !== 'copy'));
            const u = await pick(app, `${m.name}（${m.zeni}）を付ける札`, cards.map((x) => ({ label: `${nameOf(base, x)}${x[m.kind] ? `［${x[m.kind]}］` : ''}`, value: x.uid })));
            if (u) act(() => { applyShikomi(base, H, u, m.kind, m.name); toast(`${m.name}を付けた`); });
          } }, [`${m.name} ${m.zeni}`]))),
        ];
      }
      default: return [];
    }
  }

  function render() {
    const lv = H.facilities[id] ?? 1;
    const up = upgradeInfo(base, H, id);
    put(root, 
      top(`${def.name} Lv${lv}`, H, () => ctx.go.inn()),
      h('p.q', { text: def.text ?? '' }),
      h('main.ibody', {}, bodyOf()),
      up.max ? null : h('div.upg', {}, [
        h('div', {}, [`Lv${up.lv}：${effText(base, H, id, up.lv)}`, h('div.q', { text: up.next.ready === false ? 'まだ改装できない' : `${costText(base, up.cost)}${up.ok ? '' : `　${up.reason}`}` })]),
        (() => { const b = holdButton('改装', () => act(() => { upgrade(base, H, id); toast(`${def.name}を改装した`); })); b.disabled = !up.ok; return b; })(),
      ]),
    );
  }
  render();
  return { el: root, render };
}

// ───────────────────────── 蔵・編成 ─────────────────────────
export function stashScreen(ctx) {
  const { base, app } = ctx;
  const H = ctx.H();
  const C = base.content;
  const root = h('div.scr.inn.stash');
  const flt = { cat: '', tier: '', grade: '', origin: '', set: '', type: '' };
  let selling = false;
  const sel = (key, label, opts) => {
    const s = h('select', { onchange: () => { flt[key] = s.value; render(); } }, [h('option', { value: '' }, [label]), ...opts.map(([v, t]) => h('option', { value: v }, [t]))]);
    s.value = flt[key];
    return s;
  };
  const match = (x) => {
    const d = x.type === 'card' ? C.cards[x.id] : null;
    if (flt.type && x.type !== flt.type) return false;
    if (flt.cat && !(x.mod?.cat ?? d?.cat ?? []).includes(flt.cat)) return false;
    if (flt.tier && String(x.mod?.tier ?? d?.tier) !== flt.tier) return false;
    if (flt.grade && d?.grade !== flt.grade && C[x.type === 'regular' ? 'regulars' : 'items']?.[x.id]?.grade !== flt.grade) return false;
    if (flt.origin && (x.origin ?? 'orig') !== flt.origin) return false;
    if (flt.set && (d?.set ?? '') !== flt.set) return false;
    return true;
  };
  function tap(x) {
    if (selling) {
      const s = sheet(app, [h('h2', { text: nameOf(base, x) }), h('p', { text: `売値 ${sellValue(base, x)}` }),
        h('div.row', {}, [holdButton('売る', () => { s.close(); if (guard(() => sell(base, H, x.uid))) { ctx.save(); render(); } }), h('button.btn', { type: 'button', onclick: () => s.close() }, ['やめる'])])]);
      return;
    }
    if (x.type !== 'card') { toast('札だけがデッキに入る（売るは「売る」に切り替えて）'); return; }
    if (guard(() => toggleDeck(base, H, x.uid))) { ctx.save(); render(); }
  }
  function render() {
    const P = base.balance.hands.play;
    const deck = H.deck.map((u) => H.stash.find((x) => x.uid === u)).filter(Boolean);
    const rest = H.stash.filter((x) => !H.deck.includes(x.uid) && match(x));
    const room = stashRoom(base, H);
    put(root, 
      top('蔵・編成', H, () => (H.overflow ? toast('先に売って蔵に収める') : ctx.go.inn())),
      H.overflow ? h('p.warn', { text: `蔵があふれている：${room.used}/${room.cap}。「売る」で減らす` }) : null,
      h('h3', { text: `デッキ ${deck.length}枚（${P.deckMin}〜${P.deckMax}）` }),
      h('div.things.half', {}, deck.map((x) => thingEl(base, x, { on: true, onclick: () => tap(x) }))),
      h('div.filters', {}, [
        sel('type', '種類', [['card', '札'], ['regular', '常連客'], ['item', 'お品書き'], ['souvenir', 'お土産']]),
        sel('cat', 'カテゴリ', base.balance.tiers.categories.map((c) => [c, c])),
        sel('tier', 'Tier', base.balance.tiers.ring.map((t) => [t, slotLabel(t)])),
        sel('grade', '格', base.balance.economy.grades.map((g) => [g, g])),
        sel('origin', '由来', [['orig', '原本'], ['copy', '写し'], ['expiry', '期限'], ['cursed', '曰く付き'], ['bet', '賭け']]),
        sel('set', 'セット', Object.values(C.sets).map((s) => [s.id, s.name])),
      ]),
      h('h3', { text: `蔵 ${room.used}/${room.cap}（表示 ${rest.length}）` }),
      h('div.things.half', {}, rest.map((x) => thingEl(base, x, { onclick: () => tap(x) }))),
      h('footer.ops', {}, [
        h(`button.btn${selling ? '.main' : ''}`, { type: 'button', onclick: () => { selling = !selling; render(); } }, [selling ? '売る：オン' : '売る']),
        h('button.btn', { type: 'button', onclick: () => (H.overflow ? toast('先に売って蔵に収める') : ctx.go.inn()) }, ['宿へ']),
      ]),
    );
  }
  render();
  return { el: root, render };
}

// ───────────────────────── 潜行準備 ─────────────────────────
export function prepScreen(ctx) {
  const { base, app } = ctx;
  const H = ctx.H();
  const C = base.content;
  const L = H.loadout;
  const root = h('div.scr.inn.prep');
  if (!L.guest || !H.unlocked.guests.includes(L.guest)) L.guest = H.unlocked.guests[0];
  async function multi(title, key, list, max) {
    const chosen = new Set(L[key]);
    return new Promise((resolve) => {
      const s = sheet(app, [], { onClose: () => { L[key] = [...chosen]; ctx.save(); resolve(); render(); } });
      const draw = () => s.el.replaceChildren(
        h('h2', { text: `${title}（${chosen.size}/${max}）` }),
        list.length ? h('div.things.half', {}, list.map((x) => thingEl(base, x, { on: chosen.has(x.uid), onclick: () => {
          if (chosen.has(x.uid)) chosen.delete(x.uid);
          else if (chosen.size < max) chosen.add(x.uid);
          else { toast(`${max}つまで`); return; }
          draw();
        } }))) : h('p.q', { text: '選べるものが無い' }),
        h('div.row', {}, [h('button.btn.main', { type: 'button', onclick: () => s.close() }, ['決める'])]),
      );
      draw();
    });
  }
  function render() {
    const info = prepInfo(base, H);
    const g = C.guests[L.guest];
    const notDeck = H.stash.filter((x) => !H.deck.includes(x.uid));
    put(root, 
      top('潜行準備', H, () => ctx.go.inn()),
      h('h3', { text: '宿泊客' }),
      h('div.chips.guests', {}, H.unlocked.guests.map((id) => h(`button.chip${id === L.guest ? '.on' : ''}`, { type: 'button', onclick: () => { L.guest = id; ctx.save(); render(); } }, [C.guests[id].name, (H.stamps[id] ?? -1) >= 0 ? h('span.stampmini', { text: `◉${H.stamps[id]}` }) : null]))),
      ...[].concat(g?.choose || []).map((ch) => {
        const cur = (L.choose ||= {})[L.guest]?.[ch.key];
        return h('div.prow', {}, [h('span', { text: ch.text ?? ch.key }),
          h('button.btn', { type: 'button', onclick: async () => {
            const v = await pick(app, ch.text ?? ch.key, (ch.type === 'category' ? base.balance.tiers.categories : ch.options ?? []).map((x) => ({ label: String(x), value: x })));
            if (v == null) return;
            ((L.choose ||= {})[L.guest] ||= {})[ch.key] = v; ctx.save(); render();
          } }, [cur ?? 'おまかせ（デッキで一番多い）'])]);
      }),
      h('div.prow', {}, [h('span', { text: '深度' }),
        h('div.stepper', {}, [
          h('button.btn.small', { type: 'button', disabled: L.depth <= 0, onclick: () => { L.depth = Math.max(0, L.depth - 1); ctx.save(); render(); } }, ['−']),
          h('b.dnum', { text: String(L.depth) }),
          h('button.btn.small', { type: 'button', disabled: L.depth >= H.unlocked.depth, onclick: () => { L.depth = Math.min(H.unlocked.depth, L.depth + 1); ctx.save(); render(); } }, ['＋']),
        ]),
        (() => { const t = h('span.q.dtext', { text: depthText(base, L.depth) }); return t; })()]),
      h('div.pgrid', {}, [
        h('button.btn', { type: 'button', onclick: () => ctx.go.stash() }, [`デッキ ${info.deck.length}枚`]),
        h('button.btn', { type: 'button', onclick: () => multi('連れていく常連客', 'seats', notDeck.filter((x) => x.type === 'regular'), info.carry.seats) }, [`常連客 ${info.seats.length}/${info.carry.seats}`]),
        h('button.btn', { type: 'button', onclick: () => multi('お守り袋（未帰還でも残る）', 'charm', notDeck.filter((x) => charmable(x) && !L.seats.includes(x.uid) && !L.items.includes(x.uid)), info.carry.charm) }, [`お守り袋 ${info.charm.length}/${info.carry.charm}`]),
        h('button.btn', { type: 'button', onclick: () => multi('お品書き', 'items', notDeck.filter((x) => x.type === 'item' && !L.charm.includes(x.uid)), base.balance.hands.play.itemSlots) }, [`お品書き ${info.items.length}/${base.balance.hands.play.itemSlots}`]),
        h('button.btn', { type: 'button', onclick: () => multi(`保険（掛け金 売値×${Math.round(facility(base, H, 'kamidana').premium * 100)}%・戻り ${Math.round(returnRate(base, H, L.depth) * 100)}%）`, 'insured', [...info.deck, ...info.seats].filter(insurable), 99) }, [`保険 ${info.insured.length}・${info.premium}`]),
      ]),
      L.shibari ? h('div.prow', {}, [h('span', { text: `縛り：${C.shibari.find((x) => x.id === L.shibari)?.name ?? ''}` }),
        h('button.btn.small', { type: 'button', onclick: () => { setShibari(base, H, null); ctx.save(); render(); } }, ['外す'])]) : null,
      h('div.risk', {}, [h('span', { text: '失うかもしれない総額' }), h('b', { text: info.risk })]),
      h('p.q', { text: `${g?.name ?? ''}・体力 ${g?.hp ?? ''}${info.premium ? `・掛け金 ${info.premium}` : ''}` }),
      info.errors.length ? h('p.warn', { text: info.errors[0] }) : null,
      h('footer.ops.big', {}, [(() => { const b = holdButton('潜る', () => ctx.go.dive(false), 'main'); b.disabled = !!info.errors.length; return b; })()]),
    );
  }
  render();
  return { el: root, render };
}

// ───────────────────────── 結果 ─────────────────────────
export function resultScreen(ctx, rep) {
  const H = ctx.H();
  const ok = rep.outcome === 'escaped';
  const q = ctx.queue;
  const list = (title, items) => (items.length ? [h('h3', { text: title }), h('p.lst', { text: items.join('、') })] : []);
  const chips = (items, cls) => items.map((t) => h(`span.lostitem${cls}`, { text: t }));
  const total = h('div.total', { text: '0' });
  const gotBox = h('div.lst', {}, chips(ok ? rep.got : rep.lost, ok ? '.pend' : '.gray'));
  const charmBox = h('div.lst', {}, chips(rep.charm || [], '.keepcolor'));
  const recordEl = h('p.ok', { text: '' });
  const el = h(`div.scr.inn.result${ok ? '' : '.mono'}`, {}, [
    h('h2.big', { text: ok ? '脱出' : '未帰還' }),
    h('p', { text: `${rep.sudomari ? '素泊まり・' : ''}B${rep.floor}${ok ? 'から帰った' : 'で倒れた'}` }),
    ok ? total : null,
    ok ? h('p.q', { text: `宿銭 ＋${rep.zeni}${rep.relicCash ? `（置物の換金 ${rep.relicCash}）` : ''}${rep.thanks ? `・謝礼 ${rep.thanks}` : ''}${rep.betZeni ? `・賭け ${rep.betZeni}` : ''}${rep.debtPaid ? `・借金の返済 ${rep.debtPaid}` : ''}` }) : null,
    recordEl,
    h('main.ibody', {}, [
      rep.practice ? h('p.ok', { text: '稽古だったので、持ち込んだデッキは蔵に戻った。' }) : null,
      h('h3', { text: ok ? '持ち帰った' : '失った' }), gotBox,
      ...((rep.charm || []).length ? [h('h3', { text: 'お守り袋' }), charmBox] : []),
      ...list('期限で消えた', rep.expired),
      ...list('保険で戻った', rep.returned),
      ...list('戻らなかった', rep.notReturned),
      ...list('解放', rep.unlocked.filter((u) => u.type !== 'achievement').map((u) => `${u.type === 'guest' ? '宿泊客' : 'セット'}「${u.name}」`)),
      ...list('実績', rep.unlocked.filter((u) => u.type === 'achievement').map((u) => `「${u.name}」${u.zeni ? `（宿銭＋${u.zeni}）` : ''}`)),
      rep.depthUp ? h('p.ok', { text: `深度${rep.depthUp}が開いた` }) : null,
      rep.shibariReward ? h('p.ok', { text: `縛り「${rep.shibariReward.name}」初の脱出：${rep.shibariReward.what}` }) : null,
      rep.versus ? h('p', { text: `相手：B${rep.versus.their.deepest}・最大 1e${rep.versus.their.maxVlog.toFixed(1)}　自分：B${rep.versus.mine.deepest}・最大 1e${rep.versus.mine.maxVlog.toFixed(1)}　${rep.versus.mine.deepest > rep.versus.their.deepest || (rep.versus.mine.deepest === rep.versus.their.deepest && rep.versus.mine.maxVlog > rep.versus.their.maxVlog) ? '勝ち' : rep.versus.mine.deepest === rep.versus.their.deepest && rep.versus.mine.maxVlog === rep.versus.their.maxVlog ? '引き分け' : '負け'}` }) : null,
      rep.share ? h('div.share', {}, [h('span.q', { text: '共有コード' }), h('code', { text: rep.share }),
        h('button.btn.small', { type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(rep.share); toast('写した'); } catch { toast('写せなかった'); } } }, ['写す'])]) : null,
      rep.starter ? h('p', { text: '帳場から素泊まりセット（20枚）を受け取った。' }) : null,
      rep.overflow ? h('p.warn', { text: '蔵があふれている。売って収める。' }) : null,
    ]),
    h('footer.ops', {}, [h('button.btn.main', { type: 'button', onclick: () => (rep.overflow ? ctx.go.stash() : ctx.go.inn()) }, [rep.overflow ? '蔵へ' : '宿へ'])]),
  ]);
  // 脱出：物が一つずつ落ち、総額が数え上がる。最高額なら記録更新のファンファーレ
  // 未帰還：白黒、失った物が一つずつ砕けて消え、お守り袋だけ色が残る
  const items = [...gotBox.children];
  const T = [{ ms: 500, run: () => {} }];
  if (ok) {
    const sum = rep.gotValue ?? rep.zeni;
    items.forEach((it, i) => T.push({ ms: 120, run: () => { it.classList.remove('pend'); it.classList.add('drop'); if (i < 12 && !q?.skipping) SE.coin(); total.textContent = String(Math.round(sum * (i + 1) / items.length)); } }));
    T.push({ ms: rep.record ? 900 : 200, run: () => {
      total.textContent = String(sum);
      if (rep.record && sum > 0) { recordEl.textContent = '記録更新'; SE.fanfare(); confetti(80); }
    } });
  } else {
    items.forEach((it, i) => T.push({ ms: 140, run: () => { shards(it.getBoundingClientRect(), '#8a8784', 8); if (i < 10 && !q?.skipping) SE.shatter(); it.style.visibility = 'hidden'; } }));
    T.push({ ms: 300, run: () => { if (charmBox.children.length) SE.kiran(); } });
  }
  // 新しいセットが解放された：「新スレが立ちました」と、そのセットのひとこと（企画書 第5章）
  for (const u of rep.unlocked.filter((x) => x.type === 'set')) {
    const def = ctx.base.content.sets[u.id];
    T.push({ ms: 1800, run: () => {
      q?.banner?.(`新スレが立ちました\n「${u.name}」`, 'big', 1600);
      SE.fanfare?.();
      if (def?.intro) toast(`「${u.name}」${def.intro}`);
    } });
  }
  setTimeout(() => {
    if (!q) { for (const t of T) t.run(); return; }
    q.play(T).then(() => {
      // 早送りしても最後の形は同じ
      if (ok) { items.forEach((it) => it.classList.remove('pend')); total.textContent = String(rep.gotValue ?? rep.zeni); if (rep.record && (rep.gotValue ?? 0) > 0) recordEl.textContent = '記録更新'; }
      else items.forEach((it) => { it.style.visibility = 'hidden'; });
    });
  }, 50);
  // 初めて脱出したとき：ホーム画面に追加と書き出しの案内（一度だけ）
  if (rep.firstExtract && !H.hints.firstExtract) {
    H.hints.firstExtract = true;
    ctx.save();
    setTimeout(() => {
      const s = sheet(ctx.app, [
        h('h2', { text: '宿を守る' }),
        h('p', { text: 'ブラウザの共有メニューから「ホーム画面に追加」すると、アプリのように開ける。' }),
        h('p', { text: 'セーブはこの端末の中だけにある。設定の「書き出し」で文字列にして残せる。' }),
        h('div.row', {}, [h('button.btn', { type: 'button', onclick: () => { s.close(); ctx.go.settings(); } }, ['書き出す']), h('button.btn.main', { type: 'button', onclick: () => s.close() }, ['わかった'])]),
      ]);
    }, 300);
  }
  return { el };
}

// ───────────────────────── 設定 ─────────────────────────
export function settingsScreen(ctx) {
  const { app } = ctx;
  const H = ctx.H();
  const root = h('div.scr.inn.settings');
  const out = h('textarea', { readonly: true, rows: 4, placeholder: '「書き出す」でここに出る' });
  const inp = h('textarea', { rows: 4, placeholder: '書き出した文字列を貼る' });
  function render() {
    const S = ctx.settings;
    const set = (k, v) => { S[k] = v; ctx.saveSettings(S); ctx.applySettings?.(); render(); };
    const chipsOf = (k, list) => h('div.chips', {}, list.map(([v, t]) => h(`button.chip${S[k] === v ? '.on' : ''}`, { type: 'button', onclick: () => set(k, v) }, [t])));
    const onoff = (k) => chipsOf(k, [[true, 'オン'], [false, 'オフ']]);
    const range = (k) => h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: S[k], oninput: (e) => { S[k] = Number(e.target.value); ctx.saveSettings(S); ctx.applySettings?.(); } });
    const row = (label, ctl) => h('div.srow', {}, [h('span', { text: label }), ctl]);
    put(root, 
      top('設定', H, () => ctx.go.inn()),
      h('main.ibody', {}, [
        row('演出の強さ', chipsOf('fx', [['控えめ', '控えめ'], ['標準', '標準'], ['激しい', '激しい']])),
        row('画面揺れ', onoff('shake')),
        row('点滅の軽減', onoff('noFlash')),
        row('振動', onoff('vibrate')),
        row('BGM', range('bgm')),
        row('効果音', range('se')),
        row('戦闘の速さ', chipsOf('speed', [[1, '×1'], [2, '×2'], [4, '×4']])),
        row('数字の表記', chipsOf('numFmt', [['漢字', '3兆2500億'], ['指数', '3.25e12']])),
      h('h3', { text: '女将の案内' }),
        row('案内', h('div.chips', {}, [[true, 'オン'], [false, 'オフ']].map(([v, t]) => h(`button.chip${(ctx.coach?.on() ?? false) === v ? '.on' : ''}`, { type: 'button', onclick: () => { ctx.coach?.setOn(v); render(); } }, [t])))),
        h('div.row', {}, [
          h('button.btn', { type: 'button', onclick: () => { ctx.coach?.reset(); toast('案内を最初から聞ける。宿に戻ると始まる'); render(); } }, ['案内を最初から']),
          h('button.btn', { type: 'button', onclick: () => rulesSheet(ctx) }, ['遊び方']),
        ]),
      h('h3', { text: '書き出し' }),
      out,
      h('div.row', {}, [
        h('button.btn', { type: 'button', onclick: async () => { out.value = await ctx.exportText(); out.select(); } }, ['書き出す']),
        h('button.btn', { type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(out.value); toast('写した'); } catch { out.select(); toast('選んで写す'); } } }, ['写す']),
      ]),
      h('h3', { text: '読み込み（いまの宿は置き換わる）' }),
      inp,
      h('div.row', {}, [holdButton('読み込む', async () => { try { await ctx.importText(inp.value); toast('読み込んだ'); } catch (e) { toast(e.message); } })]),
      h('h3', { text: '最初から' }),
      h('div.row', {}, [holdButton('宿を消す（取り消せない）', async () => { await ctx.resetAll(); })]),
      h('p.q', { text: `版 ${window.BUILD ?? ''}` }),
      ]),
    );
  }
  render();
  return { el: root, render };
}

// ───────────────────────── 掲示板（日替わり・共有コード・縛り） ─────────────────────────
/** 日本時間の今日（YYYY-MM-DD）。日付は画面側で決める（engine は時計を見ない） */
export function todayJST() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }

export function boardScreen(ctx) {
  const { base, app } = ctx;
  const H = ctx.H();
  const C = base.content;
  const root = h('div.scr.inn.board');
  let tab = '日替わり';
  let code = '';
  let read = null;
  function body() {
    if (tab === '日替わり') {
      const d = dailyInfo(base, H, todayJST());
      return [
        h('p', { text: `${d.date} の日替わり潜行` }),
        h('p.q', { text: `宿泊客：${d.guestName}・借り物デッキ20枚。全員が同じ階・同じ札で潜る。失うものはなく、拾った物は持ち帰れる。1日1回。` }),
        d.done ? h('p.warn', { text: '今日はもう潜った。結果の共有コードで見せ合おう。' })
          : holdButton('今日の潜行へ', () => ctx.go.daily(d.date), 'main'),
      ];
    }
    if (tab === '共有コード') {
      const input = h('input.code', { type: 'text', value: code, placeholder: 'TB1-XXXX-XXXX-…', autocapitalize: 'characters', spellcheck: 'false' });
      input.addEventListener('input', () => { code = input.value; });
      return [
        h('p.q', { text: '誰かの共有コードを読むと、同じシード・宿泊客・深度で素泊まり（持ち込みなし・喪失なし）で挑める。結果を比べられる。' }),
        input,
        h('button.btn', { type: 'button', onclick: () => { read = readShare(base, code); if (!read) toast('読めないコード'); render(); } }, ['読む']),
        read ? h('div.shareinfo', {}, [
          h('p', { text: `${C.guests[read.guest]?.name}・深度${read.depth}・到達 B${read.deepest}・最大論破値 1e${read.maxVlog.toFixed(1)}${read.seat ? `・最後の席「${C.regulars[read.seat]?.name ?? '？'}」` : ''}` }),
          holdButton('この潜行に挑む', () => ctx.go.shared(code), 'main'),
        ]) : null,
      ];
    }
    const list = shibariList(base, H);
    return [
      h('p.q', { text: `縛りを付けて、自分の持ち物で潜る（未帰還なら失う）。初めて脱出すると限定の札や常連客。${list.filter((x) => x.done).length}／${list.length}` }),
      h('div.sblist', {}, list.map((x) => {
        const b = h(`button.sbrow${x.on ? '.on' : ''}${x.done ? '.done' : ''}`, { type: 'button', onclick: () => { setShibari(base, H, x.on ? null : x.id); ctx.save(); if (!x.on) ctx.go.prep(); else render(); } }, [
          h('b', { text: `${x.done ? '◆' : '◇'} ${x.name}` }), h('span.q', { text: x.text ?? '' }),
        ]);
        const rw = x.reward || {};
        tip(b, () => `<b>${esc(x.name)}</b><br>${esc(x.text ?? '')}<br><span class="q">初回脱出：${esc(rw.card ? C.cards[rw.card]?.name ?? '' : rw.regular ? `常連客「${C.regulars[rw.regular]?.name ?? ''}」` : `宿銭${rw.zeni ?? 0}`)}${x.done ? '（もらった）' : ''}</span>`);
        return b;
      })),
    ];
  }
  function render() {
    put(root,
      top('掲示板', H, () => ctx.go.inn()),
      h('div.chips.btabs', {}, ['日替わり', '共有コード', '縛り潜行'].map((k) => h(`button.chip${k === tab ? '.on' : ''}`, { type: 'button', onclick: () => { tab = k; render(); } }, [k]))),
      h('main.ibody', {}, body()),
    );
  }
  render();
  return { el: root, render };
}

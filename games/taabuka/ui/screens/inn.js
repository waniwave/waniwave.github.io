// 宿の画面：宿（施設の縦一覧）・各施設・蔵と編成・潜行準備・結果・設定（仕様書 第6章・第10章）
// 状態 H は engine/meta.js が持つ。画面は H を描き、meta.js の関数を呼んで ctx.save() するだけ。

import { encodeGhost, decodeGhost } from '../../engine/ghost.js';
import { installButton, canOfferInstall } from '../install.js';
import { shihanInfo } from '../../engine/keiko.js';
import { innArt } from '../innart.js';
import { h, tip, toast, pick, sheet, holdButton, esc, confirmSheet } from '../dom.js';
import { thingEl, pickThing, thingTip } from '../things.js';
import { catColor, catGlyph, slotLabel, rarOfCard, ATTR_KIND, attrExplain, comboEffText, floorName } from '../labels.js';
import { num as format } from '../num.js';
import { SE } from '../audio/audio.js';
import { confetti, shards } from '../fx/particles.js';
import { nameOf, sellValue } from '../../engine/dive.js';
import {
  facility, facilityDef, upgradeInfo, upgrade, stashRoom, overflowNow, toggleDeck, sell, choubaGoods, buyChouba, canTakeStarter, takeStarter, pawnGoods, pawnInfo, borrowPawn, returnPawn, setShibari, shibariList, dailyInfo, readShare,
  shikomiMenu, applyShikomi, basicGoods, buyBasic, decorState, buyDecor, weeklyInfo, exchangeSouvenir, careInfo, careRegular, dungeonList, souvenirsOf, deckGoods, buyDeck, comboGoods, buyCombo, copyInfo, copyCard, fuseInfo, fuseCards, kuyoPrice, kuyo, prepInfo, insurable, charmable, premium, returnRate, carryOf, warpChoices,
} from '../../engine/meta.js';

const FAC_TEXT = {
  chouba: (f) => `札${f.shopCards}枚（${f.shopGrades.join('・')}）${f.pawnshop ? '・質屋' : ''}`,
  kura: (f) => `札${f.caps?.card}・常連客${f.caps?.regular}・品${f.caps?.item}・お土産${f.caps?.souvenir}種${f.copyUpTo ? `・複製（${f.copyUpTo}まで）` : ''}`,
  monooki: (f) => `懐${f.pouch}・お守り袋${f.charm}`,
  kyakuma: (f) => `持ち込み席${f.seats}`,
  keiko: (f) => `一度に出せる札 ${f.maxPlay}枚`,
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
      return row;
    });
    const room = stashRoom(base, H);
    put(root, 
      top('宿', H, null),
      ctx.updateReady?.() ? h('button.btn.update', { type: 'button', onclick: () => ctx.applyUpdate() }, ['新しい版があります。更新する']) : null,
      (() => { const ds = decorState(base, H); const ok = base.content.flavor?.okami || []; const day = Math.floor((Date.now() + 9 * 3600e3) / 86400e3); return h('button.innart', { type: 'button', onclick: () => ctx.go.decor() }, [h('div.art', { html: innArt(ds) }), ok.length ? h('div.okamisay', { text: `女将「${ok[day % ok.length]}」` }) : null, h('div.rank', {}, [h('b', { text: ds.rank }), h('span', { text: ds.nextRank ? `格 ${ds.pts}／次「${ds.nextRank.name}」${ds.nextRank.pts}` : `格 ${ds.pts}` }), h('span.go', { text: '内装 ›' })])]); })(),
      h('div.recs', { text: `最深 B${H.records.deepest}・最大論破値 ${format(H.records.maxV)}・脱出 ${H.records.extracts}・未帰還 ${H.records.deaths}` }),
      h('div.facs', {}, rows),
      room.over ? h('p.warn', { text: `蔵があふれている（${roomText(room)}）。売ってから潜る` }) : null,
      h('footer.innbar', {}, [
        h('nav.innnav', {}, [
          navBtn('蔵', `${room.used}/${room.cap}`, () => ctx.go.stash(), room.over),
          navBtn('掲示板', '', () => ctx.go.board()),
          navBtn('図鑑', '', () => ctx.go.zukan()),
          navBtn('設定', '遊び方', () => ctx.go.settings()),
        ]),
        h('button.btn.main.dive', { type: 'button', disabled: room.over, onclick: () => ctx.go.prep() }, [h('b', { text: '潜る' }), H.sudomari > 0 ? h('small', { text: `素泊まり ${H.sudomari}回` }) : null]),
      ]),
    );
  }
  render();
  return { el: root, render };
}

/** 宿の下の帯のボタン（名前と小さな添え字） */
function navBtn(label, sub, onclick, warn = false) {
  return h(`button.nb${warn ? '.warn' : ''}`, { type: 'button', onclick }, [h('b', { text: label }), sub ? h('small', { text: sub }) : null]);
}

// ───────────────────────── 施設 ─────────────────────────
export function facilityScreen(ctx, id) {
  const { base, app } = ctx;
  const H = ctx.H();
  const def = facilityDef(base, id);
  const root = h('div.scr.inn.fac');
  const act = (fn) => { if (guard(fn)) { ctx.save(); render(); } };
  const ui = {};

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
        const u = await pickThing(base, app, '返す質札', held, { yes: '返す' });
        if (u) act(() => returnPawn(base, H, u));
      } }, ['借りた質札を返す']) : null,
    ];
  }

  // コンボ帳（帳場Lv2〜）：知っているコンボの札をひとそろい買う
  function comboPart() {
    const list = comboGoods(base, H);
    const CB = base.balance.economy.inn.combos;
    if ((H.facilities.chouba ?? 1) < CB.fromLevel) return [h('p.q', { text: `コンボ帳は帳場Lv${CB.fromLevel}から` })];
    return [
      h('h3', { text: `コンボ帳 ${list.length}` }),
      list.length ? h('div.mlist', {}, list.map((g) => h('div.attrrow', {}, [
        h('div', {}, [h('b', { text: g.name }), h('div.ax', { text: `${g.ids.map((id) => (id ? base.content.cards[id].name : '？')).join('＋')}　${comboEffText(base.content, g.id)}` }), g.ok ? null : h('div.q', { text: g.reason })]),
        h('button.btn', { type: 'button', disabled: !g.ok || H.zeni < g.price, onclick: () => act(() => { buyCombo(base, H, g.id); toast(`${g.name}の札を買った（蔵に入れた）`); }) }, [g.ok ? `買う ${g.price}` : '―']),
      ]))) : h('p.q', { text: 'まだ載っていない（札を拾うと載る）' }),
    ];
  }

  function talkSheet(t) {
    const s = sheet(app, [
      h('div.talk', {}, t.lines.map(([who, line]) => h(`div.tl${who === '女将' ? '.okami' : ''}`, {}, [h('b', { text: who }), h('span', { text: line })]))),
      h('div.row', {}, [h('button.btn.main', { type: 'button', onclick: () => s.close() }, ['閉じる'])]),
    ]);
  }

  function bodyOf() {
    const f = facility(base, H, id);
    switch (id) {
      case 'chouba': {
        const goods = choubaGoods(base, H);
        const cats = base.balance.tiers.categories;
        ui.cat ||= cats[0];
        const basics = basicGoods(base, H, ui.cat);
        const dk = deckGoods(base, H, ui.cat);
        const D = base.balance.economy.inn.decks;
        return [
          h('h3', { text: '今日の品（潜るたびに替わる）' }),
          h('div.things.list', {}, goods.map((g) => {
            const el = thingEl(base, { type: 'card', id: g.id, origin: 'orig', uid: `g${g.i}` }, { price: g.sold ? '売れた' : `宿銭 ${g.price}`, onclick: () => { if (!g.sold) act(() => { buyChouba(base, H, g.i); toast('買った（蔵に入れた）'); }); } });
            if (g.sold) el.classList.add('sold');
            if (!g.sold && H.zeni < g.price) el.classList.add('cant');
            return el;
          })),
          h('h3', { text: '基礎札と構築済みデッキ（いつでも買える）' }),
          h('div.chips.cats', {}, cats.map((c) => h(`button.chip${c === ui.cat ? '.on' : ''}`, { type: 'button', onclick: () => { ui.cat = c; render(); } }, [c]))),
          h('div.things.list', {}, basics.map((g) => {
            const el = thingEl(base, { type: 'card', id: g.id, origin: 'orig', uid: `b${g.id}` }, { price: `宿銭 ${g.price}`, onclick: () => act(() => { buyBasic(base, H, ui.cat, g.id); toast('買った（蔵に入れた）'); }) });
            if (H.zeni < g.price) el.classList.add('cant');
            return el;
          })),
          dk ? h('div.deckgood', {}, [
            h('div', {}, [h('b', { text: `〈${ui.cat}〉の構築済みデッキ ${dk.ids.length}枚` }), h('div.q', { text: [...new Set(dk.ids)].map((id) => base.content.cards[id].name).join('、') })]),
            h('button.btn.main', { type: 'button', disabled: H.zeni < dk.price, onclick: async () => {
              if (await confirmSheet(app, `〈${ui.cat}〉のデッキを買う（宿銭${dk.price}）`, '買うとそのままデッキになる。今のデッキの札は蔵に戻る。', '買ってデッキにする')) act(() => { buyDeck(base, H, ui.cat, true); toast('デッキを入れ替えた'); });
            } }, [`買う ${dk.price}`]),
          ]) : h('p.q', { text: `構築済みデッキは帳場Lv${D.fromLevel}から` }),
          ...comboPart(),
          ...pawnPart(),
          canTakeStarter(base, H) ? h('button.btn', { type: 'button', onclick: () => act(() => { takeStarter(base, H); toast('素泊まりセットを受け取った'); }) }, ['素泊まりセットを受け取る（20枚）']) : h('p.q', { text: `蔵の札が${base.balance.economy.inn.starterBelow}枚未満になると、素泊まりセット（初期デッキ）を渡す。` }),
        ];
      }
      case 'kura': {
        const room = stashRoom(base, H);
        return [
          h('p', { text: roomText(room) }),
          h('button.btn', { type: 'button', onclick: () => ctx.go.stash() }, ['蔵・編成を開く']),
          f.copyUpTo ? h('button.btn', { type: 'button', onclick: async () => {
            const cards = H.stash.filter((x) => copyInfo(base, H, x.uid).ok);
            if (!cards.length) { toast('複製できる札が無い'); return; }
            const cp = base.balance.economy.inn.copy;
            const u = await pickThing(base, app, '複製する札を選ぶ', cards, { note: `写しを1枚作る。代金は売値×${cp.sellMul}と${base.content.souvenirs[cp.souvenir]?.name}1つ。写しは版と判を持たず、仕込みは写る`, yes: '複製する', price: (x) => `代金 ${copyInfo(base, H, x.uid).zeni}` });
            if (u) act(() => { copyCard(base, H, u); toast('写しを作った'); });
          } }, ['札を複製する（写しを作る）']) : h('p.q', { text: '複製はLv2から' }),
        ];
      }
      case 'monooki': {
        const c = carryOf(base, H, 0);
        const E = base.balance.economy.inn.exchange;
        ui.give ||= new Set();
        const sv = H.stash.filter((x) => x.type === 'souvenir' && !E.never.includes(x.id));
        for (const u of [...ui.give]) if (!sv.some((x) => x.uid === u)) ui.give.delete(u);
        const targets = Object.values(base.content.souvenirs).filter((d) => !E.never.includes(d.id) && (H.codex.seen.includes(d.id) || H.stash.some((x) => x.id === d.id) || d.layers?.[0] === 1));
        return [
          h('p', { text: `懐 ${c.pouch}・お守り袋 ${c.charm}` }),
          h('h3', { text: `両替：お土産${E.give}つ → 好きなお土産1つ（${ui.give.size}/${E.give}）` }),
          ui.give.size === E.give ? h('div.chips.wrap', {}, [h('span.q', { text: '何に替える？' }), ...targets.map((d) => h('button.chip', { type: 'button', onclick: () => act(() => { exchangeSouvenir(base, H, [...ui.give], d.id); ui.give.clear(); toast(`${d.name}に替えた`); }) }, [d.name]))]) : null,
          sv.length ? h('div.things.list', {}, sv.map((x) => thingEl(base, x, { on: ui.give.has(x.uid), onclick: () => { if (ui.give.has(x.uid)) ui.give.delete(x.uid); else if (ui.give.size < E.give) ui.give.add(x.uid); render(); } }))) : h('p.q', { text: 'お土産が無い' }),
        ];
      }
      case 'kyakuma': {
        const regs = H.stash.filter((x) => x.type === 'regular');
        const own = new Set([...H.codex.owned, ...regs.map((x) => x.id)]);
        const talks = (base.content.flavor?.talk || []);
        const open = talks.filter((t) => (t.with || []).some((r) => own.has(r)));
        const read = new Set(H.talkRead || []);
        return [
          h('p', { text: `潜行に連れていける常連客 ${f.seats}人` }),
          h('h3', { text: `雑談 ${open.length}／${talks.length}` }),
          open.length ? h('div.mlist', {}, open.map((t) => h('button.talkrow', { type: 'button', onclick: () => { (H.talkRead ||= []).includes(t.id) || H.talkRead.push(t.id); ctx.save(); talkSheet(t); render(); } }, [
            h('b', { text: [...new Set(t.lines.map((l) => l[0]))].join('・') }), h('span.q', { text: `「${t.lines[0][1]}」` }), read.has(t.id) ? null : h('span.new', { text: '新' }),
          ]))) : h('p.q', { text: '常連客がいない' }),
          h('h3', { text: '世話' }),
          regs.length ? h('div.things.list', {}, regs.map((x) => {
            const c = careInfo(base, H, x.uid);
            return thingEl(base, x, { price: x.rar ? `世話 ${x.rar}` : null, action: c.max ? null : { label: `世話 ${c.cost.zeni}`, cls: c.ok ? 'in' : 'off', onclick: () => { if (!c.ok) { toast(`宿銭${c.cost.zeni}とお土産${c.cost.souvenirs}つが要る`); return; } act(() => { careRegular(base, H, x.uid); toast(`${nameOf(base, x)}の世話をした（効果の量が${c.next}相当に）`); }); } } });
          })) : null,
        ];
      }
      case 'keiko': {
        const best = H.records.dummyBest;
        const s = shihanInfo(base, H);
        return [
          h('h3', { text: '打ち込み台' }),
          h('p', { text: best ? `自己ベスト ${format(best)}` : 'まだ打ち込んでいない' }),
          h('button.btn', { type: 'button', onclick: () => ctx.go.keiko('dummy') }, [`木人に${base.balance.economy.keiko.dummy.turns}ターン打ち込む`]),
          h('h3', { text: `師範　いま ${H.records.dan ?? 0}段` }),
          s.max ? h('p.ok', { text: '免許皆伝' }) : h('p', { text: `${s.name}：主張 ${format(s.claim)}・${s.turns}ターン・勝つと宿銭＋${s.reward}` }),
          s.max ? null : h('button.btn.main', { type: 'button', onclick: () => ctx.go.keiko('shihan') }, [`${s.dan}段に挑む`]),
        ];
      }
      case 'kamidana':
        return [
          h('p', { text: `戻り ${Math.round(f.returnRate * 100)}%・掛け金 売値の${Math.round(f.premium * 100)}%` }),
          h('h3', { text: `戻り待ち ${H.insuredPending.length}` }),
          h('div.things.list', {}, H.insuredPending.map((p) => thingEl(base, p.owned, { price: `戻り ${Math.round(p.rate * 100)}%` }))),
          h('h3', { text: `遺失物帳（供養点 ${H.kuyo}）` }),
          h('div.things.list', {}, H.lostLog.map((x, i) => thingEl(base, x, {
            action: { label: `供養 ${kuyoPrice(base, x)}`, cls: H.kuyo < kuyoPrice(base, x) ? 'off' : 'in', onclick: () => { if (H.kuyo < kuyoPrice(base, x)) { toast('供養点が足りない'); return; } act(() => { kuyo(base, H, i); toast('供養して戻した'); }); } },
          }))),
        ];
      case 'shikomi': {
        const menu = shikomiMenu(base, H);
        const sv = base.content.souvenirs[base.balance.economy.inn.shikomiCost.souvenir]?.name;
        const kinds = ['enh', 'ed', 'seal'];
        return [
          h('p.q', { text: `代金：宿銭＋${sv}1つ` }),
          ...kinds.flatMap((k) => {
            const ms = menu.filter((m) => m.kind === k);
            return [
              h('h3', { text: ATTR_KIND[k].ja }),
              ms.length ? h('div.mlist', {}, ms.map((m) => h('div.attrrow', {}, [
                h('div', {}, [h('b', { text: m.name }), h('div.ax', { text: attrExplain(base.balance, k, m.name) })]),
                h('button.btn', { type: 'button', onclick: async () => {
                  const cards = H.stash.filter((x) => x.type === 'card' && (m.kind === 'enh' || x.origin !== 'copy'));
                  const u = await pickThing(base, app, `「${m.name}」を付ける札`, cards, { note: `${attrExplain(base.balance, k, m.name)}（宿銭${m.zeni}＋${sv}1つ）`, yes: '付ける' });
                  if (u) act(() => { applyShikomi(base, H, u, m.kind, m.name); toast(`${m.name}を付けた`); });
                } }, [`付ける ${m.zeni}`]),
              ]))) : h('p.q', { text: '改装すると使える' }),
            ];
          }),
          ...fuseBlock(),
        ];
      }
      default: return [];
    }
  }

  /** 合わせ：同じ札・同じレアリティ3枚 → 1段上（レジェンダリーまで） */
  function fuseBlock() {
    const R = base.balance.rarity;
    const groups = new Map();
    for (const x of H.stash) {
      if (x.type !== 'card' || (x.origin && !['orig', 'copy'].includes(x.origin))) continue;
      const r = rarOfCard(base.balance, x, base.content.cards[x.id]);
      const k = `${x.id}|${r}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(x);
    }
    const ready = [...groups.values()].filter((g) => g.length >= R.fuse.count).map((g) => ({ g, info: fuseInfo(base, H, g.slice(0, R.fuse.count).map((x) => x.uid)) })).filter((o) => o.info.ok);
    return [
      h('h3', { text: '合わせ' }),
      h('p.q', { text: `同じ札・同じレアリティ${R.fuse.count}枚 → 1段上（${R.fuse.max}まで）` }),
      ready.length
        ? h('div.mlist', {}, ready.map(({ g, info }) => h('div.itemrow', {}, [
          thingEl(base, g[0], { price: `×${g.length}` }),
          h('button.chip', { type: 'button', disabled: H.zeni < info.zeni, onclick: () => act(() => { const c = fuseCards(base, H, g.slice(0, R.fuse.count).map((x) => x.uid)); toast(`${info.to}の${nameOf(base, c)}ができた`); }) }, [`${info.to}へ ${info.zeni}`]),
        ])))
        : h('p.q', { text: '合わせられる札は、まだ無い' }),
    ];
  }

  function render() {
    const lv = H.facilities[id] ?? 1;
    const up = upgradeInfo(base, H, id);
    put(root, 
      top(`${def.name} Lv${lv}`, H, () => ctx.go.inn()),
      h('main.ibody', {}, bodyOf()),
      h('div.detail.fdetail', { html: '<span class="q">押した物の説明がここに出る</span>' }),
      up.max ? null : h('div.upg', {}, [
        h('div', {}, [`Lv${up.lv}：${effText(base, H, id, up.lv)}`, h('div.q', { text: up.next.ready === false ? 'まだ改装できない' : `${costText(base, up.cost)}${up.ok ? '' : `　${up.reason}`}` })]),
        (() => { const b = holdButton('改装', () => act(() => { upgrade(base, H, id); toast(`${def.name}を改装した`); })); b.disabled = !up.ok; return b; })(),
      ]),
    );
  }
  render();
  return { el: root, render };
}

/** 蔵の棚ごとの使い方の短い文 */
function roomText(r) {
  const b = r.by;
  return `札 ${b.card.used}/${b.card.cap}・常連客 ${b.regular.used}/${b.card ? b.regular.cap : ''}・品 ${b.item.used}/${b.item.cap}・お土産 ${b.souvenir.used}/${b.souvenir.cap}種（1種${r.stack}個まで）${r.stackOver?.length ? '・重ねすぎ' : ''}`;
}

// ───────────────────────── 蔵・編成 ─────────────────────────
// 札・常連客・品・お土産をタブで分ける。並べ替えと絞り込み。売るときはまとめて選んで売る
const STASH_TABS = [
  { id: 'card', label: '札', has: (x) => x.type === 'card' },
  { id: 'regular', label: '常連客', has: (x) => x.type === 'regular' },
  { id: 'item', label: '品', has: (x) => x.type === 'item' || x.type === 'relic' },
  { id: 'souvenir', label: 'お土産', has: (x) => x.type === 'souvenir' },
];
const SORTS = [['new', '新しい順'], ['old', '古い順'], ['name', '名前'], ['rar', 'レアリティ'], ['cat', 'カテゴリ'], ['price', '売値']];
const stashUi = { tab: 'card', sort: 'new', cat: '', rar: '', origin: '' };
export function stashScreen(ctx) {
  const { base, app } = ctx;
  const H = ctx.H();
  const C = base.content;
  const root = h('div.scr.inn.stash');
  const U = stashUi;
  let selling = false;
  const chosen = new Set();
  const sel = (key, label, opts) => {
    const s = h('select', { onchange: () => { U[key] = s.value; render(); } }, [h('option', { value: '' }, [label]), ...opts.map(([v, t]) => h('option', { value: v }, [t]))]);
    s.value = U[key];
    return s;
  };
  const rarIx = (x) => (x.type === 'card' ? base.balance.rarity.order.indexOf(rarOfCard(base.balance, x, C.cards[x.id])) : -1);
  const catOf = (x) => (x.type === 'card' ? (x.mod?.cat ?? C.cards[x.id]?.cat ?? []) : []);
  const match = (x) => {
    if (U.tab !== 'card') return true;
    if (U.cat && !catOf(x).includes(U.cat)) return false;
    if (U.rar && rarOfCard(base.balance, x, C.cards[x.id]) !== U.rar) return false;
    if (U.origin && (x.origin ?? 'orig') !== U.origin) return false;
    return true;
  };
  const sorted = (list) => {
    const ix = new Map(H.stash.map((x, i) => [x.uid, i]));
    const cats = base.balance.tiers.categories;
    const f = {
      new: (a, b) => ix.get(b.uid) - ix.get(a.uid),
      old: (a, b) => ix.get(a.uid) - ix.get(b.uid),
      name: (a, b) => nameOf(base, a).localeCompare(nameOf(base, b), 'ja'),
      rar: (a, b) => rarIx(b) - rarIx(a) || nameOf(base, a).localeCompare(nameOf(base, b), 'ja'),
      cat: (a, b) => (cats.indexOf(catOf(a)[0]) - cats.indexOf(catOf(b)[0])) || nameOf(base, a).localeCompare(nameOf(base, b), 'ja'),
      price: (a, b) => sellValue(base, b) - sellValue(base, a),
    }[U.sort];
    return list.slice().sort(f);
  };
  const canSell = (x) => x.origin !== 'pawn';
  function sellMany(uids, label) {
    const xs = uids.map((u) => H.stash.find((x) => x.uid === u)).filter(Boolean);
    if (!xs.length) { toast('売る物を選んで'); return; }
    const sum = xs.reduce((a, x) => a + sellValue(base, x), 0);
    confirmSheet(app, `${label ?? `${xs.length}点を売る`}（宿銭＋${sum}）`, xs.map((x) => nameOf(base, x)).join('、'), '売る').then((ok) => {
      if (!ok) return;
      for (const x of xs) guard(() => sell(base, H, x.uid));
      chosen.clear(); SE.coin?.(); ctx.save(); render(); toast(`宿銭＋${sum}`);
    });
  }
  let focus = null;   // 説明欄に出している物
  function tap(x) {
    focus = x.uid;
    if (selling) {
      if (!canSell(x)) { toast('質札は売れない（質屋で返す）'); render(); return; }
      if (chosen.has(x.uid)) chosen.delete(x.uid); else chosen.add(x.uid);
    }
    render();
  }
  function toggle(x) {
    focus = x.uid;
    if (guard(() => toggleDeck(base, H, x.uid))) ctx.save();
    render();
  }
  const el = (x, inDeck) => {
    const e = thingEl(base, x, {
      on: selling ? chosen.has(x.uid) : false, tip: false, price: selling ? `売値 ${sellValue(base, x)}` : null, onclick: () => tap(x),
      action: !selling && x.type === 'card' ? { label: inDeck ? '外す' : '入れる', cls: inDeck ? 'out' : 'in', onclick: () => toggle(x) } : null,
    });
    if (focus === x.uid) e.classList.add('focus');
    return e;
  };
  // お土産は種類ごとに1つにまとめて「×数」（売るときは押した種類を全部選ぶ／外す）
  function groupSv(list) {
    const g = new Map();
    for (const x of list) { if (!g.has(x.id)) g.set(x.id, []); g.get(x.id).push(x); }
    return [...g.values()].map((xs) => {
      const x = xs[0];
      const all = xs.every((y) => chosen.has(y.uid));
      const e = thingEl(base, x, { on: selling && all, tip: false, price: selling ? `×${xs.length}・売値 ${xs.reduce((a, y) => a + sellValue(base, y), 0)}` : `×${xs.length}`,
        onclick: () => { focus = x.uid; if (selling) { for (const y of xs) { if (all) chosen.delete(y.uid); else chosen.add(y.uid); } } render(); } });
      if (focus && xs.some((y) => y.uid === focus)) e.classList.add('focus');
      return e;
    });
  }
  let bodyEl = null;
  function render() {
    const keep = bodyEl?.scrollTop ?? 0;
    const P = base.balance.hands.play;
    const T = STASH_TABS.find((t) => t.id === U.tab);
    const room = stashRoom(base, H);
    const deck = H.deck.map((u) => H.stash.find((x) => x.uid === u)).filter(Boolean);
    const rest = sorted(H.stash.filter((x) => T.has(x) && !(U.tab === 'card' && H.deck.includes(x.uid)) && match(x)));
    const sum = [...chosen].reduce((a, u) => a + sellValue(base, H.stash.find((x) => x.uid === u) ?? {}), 0);
    const souv = H.stash.filter((x) => x.type === 'souvenir');
    const fx = focus ? H.stash.find((x) => x.uid === focus) : null;
    bodyEl = h('main.stbody', {}, [
      U.tab === 'card' ? h('h3', { text: `デッキ ${deck.length}枚（${P.deckMin}〜${P.deckMax}）` }) : null,
      U.tab === 'card' ? h('div.things.deck', {}, sorted(deck).map((x) => el(x, true))) : null,
      h('div.filters', {}, [
        (() => { const x = h('select', { onchange: () => { U.sort = x.value; render(); } }, SORTS.map(([v, t]) => h('option', { value: v }, [`並び：${t}`]))); x.value = U.sort; return x; })(),
        ...(U.tab === 'card' ? [
          sel('cat', 'カテゴリ：全部', base.balance.tiers.categories.map((c) => [c, c])),
          sel('rar', 'レアリティ：全部', base.balance.rarity.order.map((r, i) => [r, `${'★'.repeat(i + 1)} ${r}`])),
          sel('origin', '由来：全部', [['orig', '原本'], ['copy', '写し'], ['expiry', '期限'], ['cursed', '曰く付き'], ['bet', '賭け'], ['pawn', '質']]),
        ] : []),
      ]),
      h('h3', { text: `${U.tab === 'card' ? '蔵の札' : T.label} ${rest.length}` }),
      h('div.things.list2', {}, rest.length ? (U.tab === 'souvenir' ? groupSv(rest) : rest.map((x) => el(x, false))) : [h('p.q', { text: '無い' })]),
    ]);
    put(root,
      top('蔵', H, () => (overflowNow(base, H) ? toast('先に売って蔵に収める') : ctx.go.inn())),
      room.over ? h('p.warn', { text: `蔵があふれている（${roomText(room)}）` }) : null,
      h('div.tabs', {}, STASH_TABS.map((t) => h(`button.tab${t.id === U.tab ? '.on' : ''}`, { type: 'button', onclick: () => { U.tab = t.id; chosen.clear(); focus = null; render(); } }, [t.label, h('small', { text: ` ${H.stash.filter(t.has).length}` })]))),
      bodyEl,
      h('div.detail', { html: fx ? thingTip(base, fx) : `<span class="q">${roomText(room)}</span>` }),
      h('footer.ops', {}, selling ? [
        h('button.btn', { type: 'button', onclick: () => { selling = false; chosen.clear(); render(); } }, ['やめる']),
        h('button.btn', { type: 'button', onclick: () => { rest.filter(canSell).forEach((x) => chosen.add(x.uid)); render(); } }, ['全部選ぶ']),
        h('button.btn.main', { type: 'button', disabled: !chosen.size, onclick: () => sellMany([...chosen]) }, [`売る ${chosen.size}点 ＋${sum}`]),
      ] : [
        h('button.btn', { type: 'button', onclick: () => { selling = true; render(); } }, ['売る']),
        U.tab === 'souvenir' && souv.length ? h('button.btn', { type: 'button', onclick: () => sellMany(souv.map((x) => x.uid), 'お土産を全部売る') }, ['お土産を全部売る']) : null,
        h('button.btn.main', { type: 'button', onclick: () => (overflowNow(base, H) ? toast('先に売って蔵に収める') : ctx.go.inn()) }, ['宿へ']),
      ]),
    );
    bodyEl.scrollTop = keep;
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
  let mode = 'full';   // full＝持ち込み／light＝素泊まり（借り物の札・失う物なし）
  if (!L.guest || !H.unlocked.guests.includes(L.guest)) L.guest = H.unlocked.guests[0];
  async function multi(title, key, list, max) {
    const chosen = new Set(L[key]);
    return new Promise((resolve) => {
      const s = sheet(app, [], { onClose: () => { L[key] = [...chosen]; ctx.save(); resolve(); render(); } });
      const draw = () => s.el.replaceChildren(
        h('h2', { text: `${title}（${chosen.size}/${max}）` }),
        list.length > 1 ? h('div.row', {}, [
          h('button.btn', { type: 'button', onclick: () => { for (const x of list) if (chosen.size < max) chosen.add(x.uid); draw(); } }, ['全部選ぶ']),
          h('button.btn', { type: 'button', onclick: () => { chosen.clear(); draw(); } }, ['全部外す']),
        ]) : null,
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
  function dungeonSheet(ds) {
    const s2 = sheet(app, [
      h('h2', { text: '穴' }),
      h('div.mlist', {}, ds.map((d) => h(`div.dgrow${d.open ? '' : '.locked'}`, {}, [
        h('b', { text: d.open ? d.name : '？？？' }),
        h('span.q', { text: d.open ? [d.line, d.cats?.length ? `よく出る札：${d.cats.join('・')}` : '', `素材：${souvenirsOf(base, d.id).map((x) => x.own ? `★${x.name}` : x.name).join('・')}`, d.id !== 'honko' ? `最深 ${floorName(base.content, d.id, d.deepest)}${d.cleared ? '・層主撃破' : ''}` : ''].filter(Boolean).join('　') : `開け方：${d.how}` }),
      ]))),
      h('div.row', {}, [h('button.btn.main', { type: 'button', onclick: () => s2.close() }, ['閉じる'])]),
    ]);
  }
  function render() {
    put(root, 
      top('潜行準備', H, () => ctx.go.inn()),
      h('div.seg', {}, [
        h(`button.segb${mode === 'full' ? '.on' : ''}`, { type: 'button', onclick: () => { mode = 'full'; render(); } }, [h('b', { text: '持ち込み' }), h('small', { text: 'デッキと持ち物で' })]),
        h(`button.segb${mode === 'light' ? '.on' : ''}`, { type: 'button', disabled: H.sudomari <= 0, onclick: () => { mode = 'light'; render(); } }, [h('b', { text: '素泊まり' }), h('small', { text: `残り ${H.sudomari}回` })]),
      ]),
      ...(mode === 'light' ? lightBody() : fullBody()),
    );
  }
  function lightBody() {
    const P = base.balance;
    return [
      h('div.lightinfo', {}, [
        ['宿泊客', 'おまかせ'], ['札', `借り物 ${P.economy?.inn?.sudomariSize ?? 20}枚`], ['行き先', '本坑'], ['深さ', `B${P.economy?.inn?.sudomariFloors ?? '？'}まで`], ['倒れても', '失う物なし'],
      ].map(([k, v]) => h('div.li', {}, [h('span', { text: k }), h('b', { text: v })]))),
      h('div.grow'),
      h('footer.ops.big', {}, [holdButton('素泊まりで潜る', () => ctx.go.dive(true), 'main')]),
    ];
  }
  function fullBody() {
    const info = prepInfo(base, H);
    const g = C.guests[L.guest];
    const notDeck = H.stash.filter((x) => !H.deck.includes(x.uid));
    return [
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
      (() => {
        const ds = dungeonList(base, H);
        const open = ds.filter((d) => d.open);
        const cur = ds.find((d) => d.id === (L.dungeon || 'honko')) ?? ds[0];
        return h('div.prow', {}, [h('span', { text: '行き先' }), h('div.chips', {}, [
          ...open.map((d) => h(`button.chip${cur.id === d.id ? '.on' : ''}`, { type: 'button', onclick: () => { L.dungeon = d.id === 'honko' ? null : d.id; L.warp = null; ctx.save(); render(); } }, [d.name])),
          h('button.chip', { type: 'button', onclick: () => dungeonSheet(ds) }, [`穴 ${open.length}／${ds.length}`]),
        ])]);
      })(),
      (() => {
        const cur = dungeonList(base, H).find((d) => d.id === (L.dungeon || 'honko'));
        const sv = souvenirsOf(base, cur?.id ?? 'honko');
        const have = (id) => H.stash.filter((x) => x.type === 'souvenir' && x.id === id).length;
        return h('div.dginfo', {}, [
          cur?.cats?.length ? h('div.dgcats', {}, [h('span.lbl', { text: 'よく出る札' }), ...cur.cats.map((c) => h('span.glyph', { style: { background: catColor(c) }, title: c }, [catGlyph(c)]))]) : null,
          h('div.svchips', {}, [h('span.lbl', { text: '素材' }), ...sv.map((x) => {
            const el = h(`span.svc${x.own ? '.own' : ''}`, {}, [x.own ? h('b', { text: '★' }) : null, x.name, have(x.id) ? h('i', { text: `×${have(x.id)}` }) : null]);
            tip(el, () => `<b>${esc(x.name)}</b>${x.own ? '<br><span class="q">この穴でしか出ない</span>' : ''}<br><span class="q">蔵に ${have(x.id)}</span>`);
            return el;
          })]),
        ]);
      })(),
      warpChoices(base, H).length > 1 ? h('div.prow', {}, [h('span', { text: '入口（ワープ）' }),
        h('div.chips', {}, warpChoices(base, H).map((f) => h(`button.chip${(L.warp || 1) === f ? '.on' : ''}`, { type: 'button', onclick: () => { L.warp = f === 1 ? null : f; ctx.save(); render(); } }, [floorName(base.content, L.dungeon || 'honko', f)])))]) : null,
      L.warp ? h('p.q', { text: `${floorName(base.content, L.dungeon || 'honko', L.warp)}から（上の階の拾い物と宿銭は無し）` }) : null,
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
    ];
  }
  render();
  return { el: root, render };
}

// ───────────────────────── 結果 ─────────────────────────
export function resultScreen(ctx, rep) {
  const H = ctx.H();
  const { base } = ctx;
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
      rep.weekly ? h('p.ok', { text: `週替わり ${rep.weekly.key}：B${rep.weekly.deepest}${rep.weeklyBest ? '（今週の最高を更新）' : `（今週の最高 B${rep.weekly.best}）`}` }) : null,
      ...(rep.dgUnlocked || []).map((n) => h('p.ok', { text: `鍵が合った。「${n}」へ行けるようになった` })),
      rep.stones ? h('p.ok', { text: `底の石を${rep.stones}つ持ち帰った（内装の最高の段に使う）` }) : null,
      rep.rumor ? h('p.ok', { text: `噂を聞いた：「${base.content.cards[rep.rumor.card]?.name ?? '？'}」には相方がいるらしい（掲示板の「噂」）` }) : null,
      rep.shibariReward ? h('p.ok', { text: `縛り「${rep.shibariReward.name}」初の脱出：${rep.shibariReward.what}` }) : null,
      rep.versus ? h('p', { text: `相手：B${rep.versus.their.deepest}・最大 1e${rep.versus.their.maxVlog.toFixed(1)}　自分：B${rep.versus.mine.deepest}・最大 1e${rep.versus.mine.maxVlog.toFixed(1)}　${rep.versus.mine.deepest > rep.versus.their.deepest || (rep.versus.mine.deepest === rep.versus.their.deepest && rep.versus.mine.maxVlog > rep.versus.their.maxVlog) ? '勝ち' : rep.versus.mine.deepest === rep.versus.their.deepest && rep.versus.mine.maxVlog === rep.versus.their.maxVlog ? '引き分け' : '負け'}` }) : null,
      rep.share ? h('div.share', {}, [h('span.q', { text: '共有コード' }), h('code', { text: rep.share }),
        h('button.btn.small', { type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(rep.share); toast('写した'); } catch { toast('写せなかった'); } } }, ['写す'])]) : null,
      rep.starter ? h('p', { text: '帳場から素泊まりセット（20枚）を受け取った。' }) : null,
      overflowNow(base, H) ? h('p.warn', { text: '蔵があふれている。売って収める。' }) : null,
    ]),
    h('footer.ops', {}, [h('button.btn.main', { type: 'button', onclick: () => (overflowNow(base, H) ? ctx.go.stash() : ctx.go.inn()) }, [overflowNow(base, H) ? '蔵へ' : '宿へ'])]),
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
        canOfferInstall() ? h('p', { text: '「ホーム画面に追加」すると、アプリのようにアイコンから全画面で開ける。' }) : null,
        canOfferInstall() ? installButton(ctx.app) : null,
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
  const out = h('textarea', { rows: 4, placeholder: '「書き出す」でここに出る', spellcheck: false, autocomplete: 'off' });
  const inp = h('textarea', { rows: 4, placeholder: '書き出した文字列を貼る（またはファイルから読む）', spellcheck: false, autocomplete: 'off' });
  const fileIn = h('input', { type: 'file', accept: '.txt,text/plain', style: { display: 'none' } });
  fileIn.addEventListener('change', async () => { const f = fileIn.files?.[0]; if (!f) return; inp.value = (await f.text()).trim(); fileIn.value = ''; toast('ファイルを読んだ。「読み込む」で置き換わる'); });
  const selectAll = (ta) => { ta.focus(); ta.select(); try { ta.setSelectionRange(0, ta.value.length); } catch { /* 古い端末 */ } };
  /** 写す：使えるものから順に（ClipboardItem は押した瞬間の扱いが保たれるので iPhone でも通る） */
  async function copyText(textOrPromise) {
    try {
      if (window.ClipboardItem && navigator.clipboard?.write) {
        const blob = Promise.resolve(textOrPromise).then((t) => new Blob([t], { type: 'text/plain' }));
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
        return true;
      }
    } catch { /* 次へ */ }
    const t = await textOrPromise;
    try { await navigator.clipboard.writeText(t); return true; } catch { /* 次へ */ }
    try { out.value = t; selectAll(out); if (document.execCommand('copy')) return true; } catch { /* 次へ */ }
    return false;
  }
  async function doExport(copy) {
    const p = ctx.exportText();
    const ok = copy ? copyText(p) : Promise.resolve(false);
    try { out.value = await p; } catch (e) { toast(`書き出せない：${e.message}`); return; }
    selectAll(out);
    if (copy) toast((await ok) ? '書き出して写した。メモなどに貼って残して' : '写せなかった。上の文字を選んで写して');
  }
  function saveFile() {
    ctx.exportText().then((t) => {
      out.value = t;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain' }));
      a.download = `taabuka-save-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('ファイルに保存した');
    }).catch((e) => toast(`書き出せない：${e.message}`));
  }
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
        row('演出の量', chipsOf('fx', [['控えめ', '控えめ'], ['標準', '標準'], ['激しい', '激しい']])),
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
      ...(canOfferInstall() ? [h('h3', { text: 'ホーム画面に追加' }), h('p.q', { text: 'アイコンからアプリのように全画面で遊べる。' }), installButton(ctx.app)] : []),
      h('h3', { text: '書き出し' }),
      out,
      h('div.row', {}, [
        h('button.btn.main', { type: 'button', onclick: () => doExport(true) }, ['書き出して写す']),
        h('button.btn', { type: 'button', onclick: saveFile }, ['ファイルに保存']),
      ]),
      h('h3', { text: '読み込み（いまの宿は置き換わる）' }),
      inp, fileIn,
      h('div.row', {}, [
        h('button.btn', { type: 'button', onclick: async () => { try { const t = await navigator.clipboard.readText(); if (t) inp.value = t.trim(); } catch { toast('貼り付けは、欄を押して「ペースト」で'); } } }, ['貼る']),
        h('button.btn', { type: 'button', onclick: () => fileIn.click() }, ['ファイルから読む']),
        holdButton('読み込む', async () => { if (!inp.value.trim()) { toast('先に貼るか、ファイルから読む'); return; } try { await ctx.importText(inp.value); toast('読み込んだ'); } catch (e) { toast(`読み込めない：${e.message}`); } }),
      ]),
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

/** 日本時間の週（YYYY-Www、月曜はじまりのISO週） */
export function weekJST() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

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
        h('p.q', { text: `宿泊客：${d.guestName}・借り物デッキ・1日1回` }),
        d.done ? h('p.warn', { text: '今日はもう潜った。結果の共有コードで見せ合おう。' })
          : holdButton('今日の潜行へ', () => ctx.go.daily(d.date), 'main'),
      ];
    }
    if (tab === '共有コード') {
      const input = h('input.code', { type: 'text', value: code, placeholder: 'TB1-XXXX-XXXX-…', autocapitalize: 'characters', spellcheck: 'false' });
      input.addEventListener('input', () => { code = input.value; });
      return [
        input,
        h('button.btn', { type: 'button', onclick: () => { read = readShare(base, code); if (!read) toast('読めないコード'); render(); } }, ['読む']),
        read ? h('div.shareinfo', {}, [
          h('p', { text: `${C.guests[read.guest]?.name}・深度${read.depth}・到達 B${read.deepest}・最大論破値 1e${read.maxVlog.toFixed(1)}${read.seat ? `・最後の席「${C.regulars[read.seat]?.name ?? '？'}」` : ''}` }),
          holdButton('この潜行に挑む', () => ctx.go.shared(code), 'main'),
        ]) : null,
      ];
    }
    if (tab === '週替わり') {
      const w = weeklyInfo(base, H, weekJST());
      return [
        h('p', { text: `${w.week} の週替わり挑戦` }),
        h('p.q', { text: `宿泊客：${w.guestName}・借り物デッキ・底の呪い${w.curses}つ` }),
        h('p.ok', { text: w.best ? `今週の最高：B${w.best}` : 'まだ挑んでいない' }),
        holdButton('今週の挑戦へ', () => ctx.go.weekly(w.week), 'main'),
      ];
    }
    if (tab === 'ゴースト宿') {
      const deck = H.deck.map((u) => H.stash.find((x) => x.uid === u)).filter(Boolean);
      const nameIn = h('input.code', { type: 'text', value: H.ghostName ?? '', placeholder: '宿の名前（12文字まで）', maxlength: '12' });
      nameIn.addEventListener('input', () => { H.ghostName = nameIn.value; });
      const out = h('textarea.code', { readonly: true, rows: 3, placeholder: '「コードを作る」を押すとここに出る' });
      const gin = h('input.code', { type: 'text', value: code, placeholder: 'TG1-…', spellcheck: 'false' });
      gin.addEventListener('input', () => { code = gin.value; });
      const g = code ? decodeGhost(base, code) : null;
      const rec = g ? H.ghosts?.[g.key] : null;
      return [
        h('h3', { text: '自分のゴーストを書き出す' }),
        h('p.q', { text: `いまのデッキ ${deck.length}枚・宿泊客「${C.guests[H.loadout.guest]?.name ?? '？'}」で書き出す。` }),
        nameIn,
        h('div.row', {}, [
          h('button.btn', { type: 'button', onclick: () => { if (deck.length < 5) { toast('デッキが少なすぎる'); return; } out.value = encodeGhost(base, { name: nameIn.value || '名無しの宿', guest: H.loadout.guest, deck, rank: decorState(base, H).rank, deepest: H.records.deepest }); ctx.save(); } }, ['コードを作る']),
          h('button.btn', { type: 'button', onclick: async () => { if (!out.value) return; try { await navigator.clipboard.writeText(out.value); toast('写した'); } catch { out.select(); toast('選んだので写してください'); } } }, ['写す']),
        ]),
        out,
        h('h3', { text: '友だちのゴーストと勝負する' }),
        gin,
        h('button.btn', { type: 'button', onclick: () => { if (!decodeGhost(base, code)) toast('読めないコード'); render(); } }, ['読む']),
        g ? h('div.shareinfo', {}, [
          h('p', {}, [h('b', { text: `${g.name}` }), ` ${g.rank ? `（${g.rank}）` : ''}・宿泊客「${C.guests[g.guest]?.name ?? '？'}」・デッキ${g.deck.length}枚・最深 B${g.deepest}`]),
          h('p.q', { text: [...new Set(g.deck.map((x) => C.cards[x.id]?.name))].slice(0, 12).join('、') + (g.deck.length > 12 ? '…' : '') }),
          rec ? h('p.ok', { text: `これまで ${rec.tries}戦${rec.wins}勝` }) : null,
          h('button.btn.main', { type: 'button', onclick: () => ctx.go.ghost(code) }, ['この宿と勝負する']),
        ]) : null,
      ];
    }
    if (tab === 'スレ') {
      const ts = H.thread || [];
      return [ts.length ? h('div.thread', {}, ts.map((t) => h('div.post', {}, [h('div.ph', { text: `${t.no}：${t.who}` }), h('div.pb', { text: t.text })]))) : h('p.q', { text: 'まだ誰も書き込んでいない' })];
    }
    if (tab === '噂') {
      const rs = H.rumors || [];
      return [
        rs.length ? h('div.mlist', {}, rs.map((r) => h('div.attrrow', {}, [h('div', {}, [h('b', { text: `「${C.cards[r.card]?.name ?? '？'}」` }), h('div.ax', { text: `には相方がいるらしい（札${r.n}枚のコンボ）` })])]))) : h('p.q', { text: 'まだ噂は無い' }),
      ];
    }
    const list = shibariList(base, H);
    return [
      h('p.q', { text: `達成 ${list.filter((x) => x.done).length}／${list.length}` }),
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
      h('div.chips.btabs', {}, ['スレ', '日替わり', '週替わり', 'ゴースト宿', '共有コード', '縛り潜行', '噂'].map((k) => h(`button.chip${k === tab ? '.on' : ''}`, { type: 'button', onclick: () => { tab = k; render(); } }, [k]))),
      h('main.ibody', {}, body()),
    );
  }
  render();
  return { el: root, render };
}

// ───────────────────────── 内装（宿の格） ─────────────────────────
export function decorScreen(ctx) {
  const { base, app } = ctx;
  const H = ctx.H();
  const root = h('div.scr.inn.decor');
  const perkText = (p = {}) => [p.startZeni && `潜行の始めに宿銭＋${p.startZeni}`, p.maxHp && `体力の上限＋${p.maxHp}`, p.rumor && `帰るたびの噂＋${p.rumor}`, p.song && `宿の曲「${p.song}」`].filter(Boolean).join('・');
  function render() {
    const ds = decorState(base, H);
    put(root,
      top('内装', H, () => ctx.go.inn()),
      h('div.innart.big', {}, [h('div.art', { html: innArt(ds) }), h('div.rank', {}, [h('b', { text: ds.rank }), h('span', { text: ds.nextRank ? `格 ${ds.pts}／次「${ds.nextRank.name}」まで ${ds.nextRank.pts - ds.pts}` : `格 ${ds.pts}（最高）` })])]),
      h('main.ibody', {}, ds.slots.map((s) => h('div.attrrow', {}, [
        h('div', {}, [
          h('b', { text: `${s.name}：${s.cur.name}` }),
          s.next ? h('div.ax', { text: `次「${s.next.name}」格＋${s.next.pts}${perkText(s.next.perk) ? `・${perkText(s.next.perk)}` : ''}` }) : h('div.q', { text: '最高の段' }),
          perkText(s.cur.perk) ? h('div.q', { text: `いま：${perkText(s.cur.perk)}` }) : null,
        ]),
        s.next ? h('button.btn', { type: 'button', disabled: H.zeni < s.next.cost || H.stash.filter((x) => x.id === 'sv_sokonoishi').length < (s.next.stones || 0), onclick: () => { if (guard(() => buyDecor(base, H, s.id))) { ctx.save(); ctx.refreshBgm?.(); SE.fanfare?.(); render(); toast(`${s.next.name}にした`); } } }, [`${s.next.cost}${s.next.stones ? `＋底の石${s.next.stones}` : ''}`]) : null,
      ]))),
    );
  }
  render();
  return { el: root, render };
}

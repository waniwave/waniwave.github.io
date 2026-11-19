// 宿と永続進行（仕様書 第4章「脱出・未帰還・素泊まり」、第6章、第11章「セーブの形」）
//
// 宿のセーブ H は JSON にできる。画面は H を読んで、ここの関数で動かすだけ。乱数は H.seed と回数から子乱数で作る。
// 持ち物の個体：{ uid, type: card|regular|relic|item|souvenir, id, enh?, ed?, seal?, origin, grow?, insured?, mod? }

import { Rng } from './rng.js';
import { Big, ZERO } from './big.js';
import { depthMods } from './battle.js';
import { createDive, sellValue, nameOf, defaultPool } from './dive.js';
import { encodeShare, decodeShare, dailySeed, shareableSeed } from './share.js';

export const SAVE_VERSION = 1;
const FAC_KEYS = ['chouba', 'kura', 'monooki', 'kyakuma', 'kamidana', 'shikomi'];

/** セーブの版を上げたら、ここに「前の版 → 次の版」を足す */
const MIGRATIONS = {
  // 0: (H) => { …; H.v = 1; return H; },
};

/** 古いセーブを今の版に */
export function migrate(H) {
  if (!H || typeof H !== 'object') throw new Error('宿のセーブではない');
  let v = H.v ?? 0;
  while (v < SAVE_VERSION) {
    const fn = MIGRATIONS[v];
    if (!fn) throw new Error(`セーブの版 ${v} から移せない`);
    H = fn(H);
    v = H.v;
  }
  if (v > SAVE_VERSION) throw new Error(`新しい版（${v}）のセーブは読めない`);
  return H;
}

export function saveInn(H) { return JSON.stringify(H); }
export function loadInn(s) { return migrate(JSON.parse(s, Big.revive)); }

function check(cond, reason) { if (!cond) throw Object.assign(new Error(reason), { userError: true }); }
const econ = (base) => base.balance.economy;
const inn = (base) => base.balance.economy.inn;
function uid(H, p) { H.uidSeq += 1; return `${p}i${H.seed}_${H.uidSeq}`; }

// ───────────────────────── はじめる ─────────────────────────

/**
 * 新しい宿を作る
 * @param {object} base @param {string} seed 画面が作る（日時など）
 */
export function newInn(base, seed) {
  const H = {
    v: SAVE_VERSION, seed: String(seed), uidSeq: 0, zeni: 0, kuyo: 0, debt: 0,
    stash: [], deck: [], facilities: Object.fromEntries(FAC_KEYS.map((k) => [k, 1])),
    unlocked: { sets: [], guests: [], depth: 0 }, insuredPending: [], lostLog: [], sudomari: 0,
    records: { deepest: 0, maxV: ZERO, dives: 0, extracts: 0, deaths: 0, bosses: [], brought: [], deepestExtract: 0, counts: { hands: {}, overkill: {} }, unitsSeen: [] },
    stamps: {}, codex: { seen: [], owned: [] }, settings: {}, buildSeen: null, hints: {},
    loadout: { guest: null, seats: [], charm: [], items: [], insured: [], depth: 0 },
    lastResult: null, overflow: false,
  };
  refreshUnlocks(base, H);
  H.loadout.guest = H.unlocked.guests[0] ?? null;
  giveStarter(base, H, H.loadout.guest);
  return H;
}

// ───────────────────────── 解放 ─────────────────────────

/** 解放条件を判定し、新しく解放されたものを返す（仕様書 第6章の表。条件は set.yaml・guest.yaml の unlock） */
/** 解放条件・実績が読む記録（records に宿の状態を足したもの） */
export function recordView(H) {
  return { ...H.records, stamps: H.stamps, facilities: H.facilities, owned: H.codex.owned.length, achieved: (H.achievements || []).length };
}

/** 実績の判定（条件は全て成り立つとき）。新しく取れたものを返す */
export function refreshAchievements(base, H) {
  const vocab = base.content.vocab;
  const got = [];
  H.achievements ||= [];
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    const R = recordView(H);
    for (const a of base.content.achievements || []) {
      if (H.achievements.includes(a.id)) continue;
      if (!Object.entries(a.if || {}).every(([k, v]) => vocab.get('unlock', k)?.test?.(R, v, H.unlocked))) continue;
      H.achievements.push(a.id);
      if (a.zeni) H.zeni += a.zeni;
      got.push({ type: 'achievement', id: a.id, name: a.name, zeni: a.zeni || 0 });
      changed = true;
    }
    if (!changed) break;
  }
  return got;
}

export function refreshUnlocks(base, H) {
  const C = base.content;
  const vocab = C.vocab;
  const got = refreshAchievements(base, H);
  const ok = (u) => Object.entries(u || {}).some(([k, a]) => vocab.get('unlock', k)?.test?.(recordView(H), a, H.unlocked));
  // 宿泊客の解放がセットの解放条件になるので、変わらなくなるまで回す
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const g of Object.values(C.guests)) if (!H.unlocked.guests.includes(g.id) && ok(g.unlock ?? { start: true })) { H.unlocked.guests.push(g.id); got.push({ type: 'guest', id: g.id, name: g.name }); changed = true; }
    for (const s of Object.values(C.sets)) if (!H.unlocked.sets.includes(s.id) && ok(s.unlock ?? { start: true })) { H.unlocked.sets.push(s.id); got.push({ type: 'set', id: s.id, name: s.name }); changed = true; }
    if (!changed) break;
  }
  return got;
}

/** 潜行で拾える範囲（解放済みのセット＋宿泊客の専用セット＋仮の札） */
export function poolOf(base, H, guest) {
  const C = base.content;
  const g = C.guests[guest];
  const ok = (set) => H.unlocked.sets.includes(set) || (g && set === g.set);
  const ids = (bucket) => Object.values(C[bucket] || {}).filter((d) => ok(d.set) && !d.id.startsWith('__')).map((d) => d.id);
  return { cards: ids('cards'), regulars: ids('regulars'), relics: ids('relics'), items: ids('items') };
}

// ───────────────────────── 施設 ─────────────────────────

export function facilityDef(base, id) { return (base.content.facilities || []).find((f) => f.id === id); }

/** 施設の今の効果（Lv1 から今の段階まで上書きで重ねる） */
export function facility(base, H, id) {
  const def = facilityDef(base, id);
  const lv = H.facilities[id] ?? 1;
  const out = {};
  (def?.levels || []).slice(0, lv).forEach((l) => Object.assign(out, l.effect || {}));
  return out;
}

/** 改装できるか（理由つき） */
export function upgradeInfo(base, H, id) {
  const def = facilityDef(base, id);
  const lv = H.facilities[id] ?? 1;
  const next = def?.levels?.[lv];
  if (!next) return { ok: false, max: true, reason: 'これ以上は無い' };
  if (next.ready === false) return { ok: false, next, lv: lv + 1, reason: 'まだ改装できない（先行版の外）' };
  const cost = next.cost || {};
  const lack = [];
  if ((cost.zeni || 0) > H.zeni) lack.push(`宿銭 ${cost.zeni}`);
  for (const [sid, n] of Object.entries(cost.souvenirs || {})) {
    const have = H.stash.filter((x) => x.type === 'souvenir' && x.id === sid).length;
    if (have < n) lack.push(`${base.content.souvenirs?.[sid]?.name ?? sid}×${n}（${have}）`);
  }
  return { ok: !lack.length, next, lv: lv + 1, cost, reason: lack.length ? `足りない：${lack.join('、')}` : '' };
}

/** 改装する（宿銭とお土産を払う） */
export function upgrade(base, H, id) {
  const info = upgradeInfo(base, H, id);
  check(info.ok, info.reason);
  H.zeni -= info.cost.zeni || 0;
  for (const [sid, n] of Object.entries(info.cost.souvenirs || {})) paySouvenir(H, sid, n);
  H.facilities[id] = info.lv;
  return H;
}

function paySouvenir(H, sid, n) {
  for (let i = 0; i < n; i++) {
    const k = H.stash.findIndex((x) => x.type === 'souvenir' && x.id === sid);
    check(k >= 0, 'お土産が足りない');
    H.stash.splice(k, 1);
  }
}

/** 持ち物の枠（物置・客間）。深度でお守り袋が減る */
export function carryOf(base, H, depth = 0) {
  const m = facility(base, H, 'monooki');
  const dm = depthMods(base.balance, depth);
  return { pouch: m.pouch, charm: Math.max(0, m.charm + (dm.charmSlots || 0)), seats: facility(base, H, 'kyakuma').seats };
}

/** 蔵の大きさと使っている数（デッキも蔵の中） */
export function stashRoom(base, H) {
  return { used: H.stash.length, cap: facility(base, H, 'kura').capacity };
}

// ───────────────────────── 蔵・編成 ─────────────────────────

const find = (H, u) => H.stash.find((x) => x.uid === u);

/** デッキに入れる／外す */
export function toggleDeck(base, H, u) {
  const x = find(H, u);
  check(x && x.type === 'card', '札ではない');
  const P = base.balance.hands.play;
  const i = H.deck.indexOf(u);
  if (i >= 0) { H.deck.splice(i, 1); if (x.origin === 'pawn') returnPawn(base, H, u); }
  else { check(H.deck.length < P.deckMax, `デッキは${P.deckMax}枚まで`); check(x.origin !== 'pawn', '質札は質屋で'); H.deck.push(u); }
  return H;
}

/** 売る */
export function sell(base, H, u) {
  const i = H.stash.findIndex((x) => x.uid === u);
  check(i >= 0, 'その品はない');
  const [x] = H.stash.splice(i, 1);
  H.deck = H.deck.filter((d) => d !== u);
  for (const k of ['seats', 'charm', 'items', 'insured']) H.loadout[k] = H.loadout[k].filter((d) => d !== u);
  H.zeni += sellValue(base, x);
  if (H.overflow) H.overflow = stashRoom(base, H).used > stashRoom(base, H).cap;
  return H;
}

/** 帳場の品揃え（潜行の回数ごとに入れ替わる） */
export function choubaGoods(base, H) {
  const f = facility(base, H, 'chouba');
  const rng = Rng.child(H.seed, 'chouba', H.records.dives);
  const pool = poolOf(base, H, null).cards.map((id) => base.content.cards[id]).filter((d) => f.shopGrades.includes(d.grade) && !['pawn', 'cursed', 'expiry', 'bet'].includes(d.origin));
  const goods = [];
  for (let i = 0; i < f.shopCards && pool.length; i++) {
    const d = rng.pick(pool);
    goods.push({ i, id: d.id, price: econ(base).price.card[d.grade] ?? 0, sold: (H.choubaSold?.[H.records.dives] || []).includes(i) });
  }
  return goods;
}

/** 質屋の品揃え（質札にできる曰く札。潜行の回数ごとに入れ替わる）。質屋が開いていなければ空 */
export function pawnGoods(base, H) {
  if (!facility(base, H, 'chouba').pawnshop) return [];
  const P = inn(base).pawn;
  const rng = Rng.child(H.seed, 'pawn', H.records.dives);
  const pool = poolOf(base, H, null).cards.map((id) => base.content.cards[id]).filter((d) => P.grades.includes(d.grade) && ['cursed', 'expiry', 'bet'].includes(d.origin));
  const ids = rng.shuffle(pool.map((d) => d.id)).slice(0, P.goods);
  const taken = H.pawnTaken?.[H.records.dives] || [];
  return ids.map((id, i) => ({ i, id, sell: sellValue(base, { type: 'card', id, origin: 'pawn' }), taken: taken.includes(i) }));
}

/** 質屋の今の状態 { open, reason, held（いま借りている質札の数）, max } */
export function pawnInfo(base, H) {
  const P = inn(base).pawn;
  const held = H.stash.filter((x) => x.origin === 'pawn').length;
  const open = !!facility(base, H, 'chouba').pawnshop;
  const reason = !open ? '帳場Lv3で質屋が開く' : H.debt > 0 ? `借金（${H.debt}）を返すまで使えない` : held >= P.max ? `質札は${P.max}枚まで` : null;
  return { open, reason, held, max: P.max, debt: H.debt };
}

/** 質札を借りる（デッキに直接入る。脱出で返して謝礼、未帰還で借金） */
export function borrowPawn(base, H, i) {
  const info = pawnInfo(base, H);
  check(!info.reason, info.reason);
  const g = pawnGoods(base, H)[i];
  check(g && !g.taken, 'もう借りた');
  check(H.deck.length < base.balance.hands.play.deckMax, `デッキは${base.balance.hands.play.deckMax}枚まで`);
  const x = { uid: uid(H, 'c'), type: 'card', id: g.id, origin: 'pawn' };
  H.stash.push(x);
  H.deck.push(x.uid);
  (H.pawnTaken ||= {})[H.records.dives] = [...(H.pawnTaken[H.records.dives] || []), i];
  seen(H, g.id, true);
  return x;
}

/** 借りた質札を潜る前に返す */
export function returnPawn(base, H, u) {
  const i = H.stash.findIndex((x) => x.uid === u && x.origin === 'pawn');
  check(i >= 0, 'その質札はない');
  H.stash.splice(i, 1);
  H.deck = H.deck.filter((d) => d !== u);
  return H;
}

export function buyChouba(base, H, i) {
  const g = choubaGoods(base, H)[i];
  check(g && !g.sold, 'もう売れた');
  check(H.zeni >= g.price, '宿銭が足りない');
  const r = stashRoom(base, H); check(r.used < r.cap, '蔵がいっぱい');
  H.zeni -= g.price;
  H.stash.push({ uid: uid(H, 'c'), type: 'card', id: g.id, origin: 'orig' });
  (H.choubaSold ||= {})[H.records.dives] = [...(H.choubaSold[H.records.dives] || []), i];
  seen(H, g.id, true);
  return H;
}

/** 素泊まりセット（初期デッキ）：入門札＋ター宿の並（ター宿セットの札が無ければ仮の札） */
export function starterIds(base, guestId) {
  const C = base.content;
  const g = guestId ? C.guests[guestId] : null;
  const fromSet = Object.values(C.cards).filter((c) => c.set === g?.deck?.set && (g.deck.grades || []).includes(c.grade)).map((c) => c.id);
  const temp = Object.values(C.cards).filter((c) => c.set === '仮').map((c) => c.id);
  const body = (fromSet.length >= 17 ? fromSet : temp).slice(0, 17);
  return [...(g?.deck?.extra || []), ...body];
}

/** 素泊まりセットを受け取れるか（蔵の札が15枚未満） */
export function canTakeStarter(base, H) {
  return H.stash.filter((x) => x.type === 'card').length < inn(base).starterBelow;
}

function giveStarter(base, H, guestId) {
  const ids = starterIds(base, guestId);
  const got = ids.map((id) => ({ uid: uid(H, 'c'), type: 'card', id, origin: 'orig' }));
  H.stash.push(...got);
  H.deck = got.map((x) => x.uid);
  for (const x of got) seen(H, x.id, true);
  return got;
}

export function takeStarter(base, H, guestId = H.loadout.guest) {
  check(canTakeStarter(base, H), `蔵の札が${inn(base).starterBelow}枚未満のときだけ`);
  return giveStarter(base, H, guestId);
}

// ───────────────────────── 仕込み場・複製・供養 ─────────────────────────

/** 仕込み場で付けられるもの [{kind:'enh'|'ed'|'seal', name, zeni}] */
export function shikomiMenu(base, H) {
  const f = facility(base, H, 'shikomi');
  const c = inn(base).shikomiCost;
  return [
    ...(f.enh || []).map((name) => ({ kind: 'enh', name, zeni: c.仕込み })),
    ...(f.ed || []).map((name) => ({ kind: 'ed', name, zeni: c[name] })),
    ...(f.seal || []).map((name) => ({ kind: 'seal', name, zeni: c.判 })),
  ];
}

/** 札に付ける（付け直すと前のものは消える）。宿銭＋番付の切れ端1 */
export function applyShikomi(base, H, u, kind, name) {
  const x = find(H, u);
  check(x && x.type === 'card', '札を選ぶ');
  const m = shikomiMenu(base, H).find((o) => o.kind === kind && o.name === name);
  check(!!m, 'まだ付けられない');
  if (kind !== 'enh') check(x.origin !== 'copy', '写しは版と判を持たない');
  check(H.zeni >= m.zeni, '宿銭が足りない');
  const sv = inn(base).shikomiCost.souvenir;
  check(H.stash.some((s) => s.type === 'souvenir' && s.id === sv), `${base.content.souvenirs?.[sv]?.name ?? sv}が要る`);
  H.zeni -= m.zeni;
  paySouvenir(H, sv, 1);
  x[kind] = name;
  return H;
}

/** 複製できるか */
export function copyInfo(base, H, u) {
  const x = find(H, u);
  const up = facility(base, H, 'kura').copyUpTo;
  if (!up) return { ok: false, reason: '蔵の改装（Lv2）で複製できる' };
  if (!x || x.type !== 'card') return { ok: false, reason: '札を選ぶ' };
  if (x.origin && x.origin !== 'orig') return { ok: false, reason: '原本だけ複製できる' };
  const grades = econ(base).grades;
  const g = base.content.cards[x.id]?.grade;
  if (grades.indexOf(g) > grades.indexOf(up)) return { ok: false, reason: `${up}までしか複製できない` };
  const zeni = sellValue(base, x) * inn(base).copy.sellMul;
  return { ok: true, zeni, souvenir: inn(base).copy.souvenir };
}

/** 複製（写し：版と判を持たず、仕込みは写る） */
export function copyCard(base, H, u) {
  const info = copyInfo(base, H, u);
  check(info.ok, info.reason);
  check(H.zeni >= info.zeni, '宿銭が足りない');
  check(H.stash.some((s) => s.type === 'souvenir' && s.id === info.souvenir), `${base.content.souvenirs?.[info.souvenir]?.name}が要る`);
  const r = stashRoom(base, H); check(r.used < r.cap, '蔵がいっぱい');
  H.zeni -= info.zeni;
  paySouvenir(H, info.souvenir, 1);
  const x = find(H, u);
  const c = { uid: uid(H, 'c'), type: 'card', id: x.id, origin: 'copy', ...(x.enh ? { enh: x.enh } : {}), ...(x.mod ? { mod: { ...x.mod } } : {}) };
  H.stash.push(c);
  return c;
}

/** 供養：遺失物帳から売値×2の供養点で買い戻す（育ちは半分） */
export function kuyoPrice(base, x) { return sellValue(base, x) * inn(base).kuyoMul; }
export function kuyo(base, H, i) {
  const x = H.lostLog[i];
  check(!!x, 'その品は無い');
  const p = kuyoPrice(base, x);
  check(H.kuyo >= p, '供養点が足りない');
  const r = stashRoom(base, H); check(r.used < r.cap, '蔵がいっぱい');
  H.kuyo -= p;
  H.lostLog.splice(i, 1);
  const back = { ...x, uid: uid(H, x.type === 'regular' ? 'r' : 'c'), insured: false };
  if (back.grow) back.grow = Math.floor(back.grow / 2);
  H.stash.push(back);
  return back;
}

// ───────────────────────── 潜行の準備 ─────────────────────────

/** 保険を掛けられるか（原本・写しの札と常連客） */
export function insurable(x) { return ['card', 'regular'].includes(x.type) && ['orig', 'copy', undefined].includes(x.origin); }
/** お守り袋に入れられるか（原本・写し・賭けとお土産・お品書き） */
export function charmable(x) { return x.type === 'souvenir' || x.type === 'item' || ['orig', 'copy', 'bet', undefined].includes(x.origin); }

/** 保険の掛け金（売値×掛け金率、切り上げ、最低1） */
export function premium(base, H, x) { return Math.max(1, Math.ceil(sellValue(base, x) * facility(base, H, 'kamidana').premium)); }

/** 保険の戻り率（深度で減る） */
export function returnRate(base, H, depth) {
  return Math.max(0, facility(base, H, 'kamidana').returnRate + (depthMods(base.balance, depth).insuranceReturn || 0));
}

/** 持ち込みの見積もり：{deck, seats, charm, items, insured, premium, risk, errors} */
export function prepInfo(base, H, L = H.loadout) {
  const P = base.balance.hands.play;
  const carry = carryOf(base, H, L.depth);
  const pick = (list) => list.map((u) => find(H, u)).filter(Boolean);
  const deck = pick(H.deck); const seats = pick(L.seats); const charm = pick(L.charm); const items = pick(L.items);
  const insured = pick(L.insured).filter((x) => insurable(x) && (H.deck.includes(x.uid) || L.seats.includes(x.uid)));
  const errors = [];
  if (!L.guest || !H.unlocked.guests.includes(L.guest)) errors.push('宿泊客を選ぶ');
  if (deck.length < P.deckMin || deck.length > P.deckMax) errors.push(`デッキは${P.deckMin}〜${P.deckMax}枚（いま${deck.length}）`);
  if (seats.length > carry.seats) errors.push(`連れていける常連客は${carry.seats}人まで`);
  if (charm.length > carry.charm) errors.push(`お守り袋は${carry.charm}つまで`);
  if (items.length > P.itemSlots) errors.push(`お品書きは${P.itemSlots}つまで`);
  if (L.depth > H.unlocked.depth) errors.push('その深度はまだ');
  if (deck.some((x) => L.charm.includes(x.uid))) errors.push('デッキの札はお守り袋に入れられない');
  const prem = insured.reduce((s, x) => s + premium(base, H, x), 0);
  if (prem > H.zeni) errors.push(`掛け金が足りない（${prem}）`);
  const risk = [...deck, ...seats, ...items].filter((x) => !insured.includes(x) && x.origin !== 'expiry').reduce((s, x) => s + sellValue(base, x), 0);
  return { deck, seats, charm, items, insured, premium: prem, risk, carry, errors };
}

/**
 * 持ち込みを確定して潜行を作る。蔵から持ち込み分を除き、潜行の状態を返す（画面は H と D を1つの書き込みで保存する）
 * @param {{seed:string, sudomari?:boolean}} o
 */
export function beginDive(base, H, o) {
  check(!H.overflow, '蔵があふれている。先に売る');
  const C = base.content;
  if (o.sudomari) return beginSudomari(base, H, o);
  const L = H.loadout;
  const info = prepInfo(base, H);
  check(!info.errors.length, info.errors[0]);
  // 縛り「ひとり旅」などは常連客を連れていかない（蔵に残す）
  const sb = L.shibari ? (C.shibari || []).find((x) => x.id === L.shibari) : null;
  if (sb?.dive?.noSeats) info.seats = [];
  H.zeni -= info.premium;
  const ins = new Set(info.insured.map((x) => x.uid));
  const take = (x) => ({ ...x, brought: true, ...(ins.has(x.uid) ? { insured: true } : {}) });
  const strip = ({ type, ...rest }) => rest;
  const deck = info.deck.map(take).map(strip);
  const seats = info.seats.map(take).map(strip);
  const items = info.items.map(take).map(strip);
  const charm = info.charm.map(take);
  const gone = new Set([...info.deck, ...info.seats, ...info.items, ...info.charm].map((x) => x.uid));
  H.stash = H.stash.filter((x) => !gone.has(x.uid));
  H.deck = [];
  H.loadout = { ...L, seats: [], charm: [], items: [], insured: [] };
  const g = C.guests[L.guest];
  const D = createDive(base, {
    seed: o.seed, guest: L.guest, depth: L.depth, deck, seats, items, charm,
    relics: g?.relic ? [{ uid: `g_${g.relic}`, id: g.relic, guest: true }] : [],
    pool: poolOf(base, H, L.guest), carry: carryOf(base, H, 0), guestState: { ...(L.choose?.[L.guest] || {}) },
    ...(L.shibari ? { shibari: L.shibari } : {}),
  });
  D.innDive = H.records.dives + 1;
  H.records.dives += 1;
  H.diving = true;
  return D;
}

/** 素泊まり潜行：解放済みセットの並・上から20枚の借り物デッキと、乱数の宿泊客。持ち込み無し・喪失無し */
/** 縛り潜行を選ぶ（次の潜行準備に付く。null で外す） */
export function setShibari(base, H, id) {
  check(id == null || (base.content.shibari || []).some((x) => x.id === id), 'その縛りは無い');
  H.loadout.shibari = id ?? null;
  return H;
}

/** 縛りの一覧（初回脱出済みかと報酬） */
export function shibariList(base, H) {
  const done = H.records.shibari || [];
  return (base.content.shibari || []).map((x) => ({ ...x, done: done.includes(x.id), on: H.loadout.shibari === x.id }));
}

/** 借り物デッキ（素泊まり・日替わり・共有コード） */
function borrowedDeck(base, pool, rng, tag) {
  const C = base.content;
  const list = pool.cards.map((id) => C.cards[id]).filter((d) => ['並', '上'].includes(d.grade) && !['pawn', 'cursed', 'expiry', 'bet'].includes(d.origin)).sort((a, b) => (a.id < b.id ? -1 : 1));
  return Array.from({ length: inn(base).sudomariSize }, (_, i) => ({ uid: `b${tag}_${i}`, id: rng.pick(list).id, origin: 'orig', borrowed: true }));
}

/** 日替わり潜行（日付がシード。全員同じ宿泊客・借り物デッキ・階。喪失なし。1日1回）。date は日本時間の YYYY-MM-DD */
export function dailyInfo(base, H, date) {
  const C = base.content;
  const seed = dailySeed(date);
  const guest = Rng.child(seed, 'daily', 0).pick(Object.keys(C.guests).sort());
  return { date, seed, guest, guestName: C.guests[guest]?.name, done: H.dailyDone === date };
}

export function beginDaily(base, H, o) {
  check(!H.overflow, '蔵があふれている。先に売る');
  const info = dailyInfo(base, H, o.date);
  check(!info.done, '今日の日替わり潜行は済んだ');
  const C = base.content;
  const pool = defaultPool(C, info.guest);
  const deck = borrowedDeck(base, pool, Rng.child(info.seed, 'daily', 1), info.seed);
  const g = C.guests[info.guest];
  const D = createDive(base, {
    seed: info.seed, guest: info.guest, depth: 0, deck, relics: g?.relic ? [{ uid: `g_${g.relic}`, id: g.relic, guest: true }] : [],
    pool, carry: carryOf(base, H, 0), sudomari: true,
  });
  D.daily = o.date;
  H.dailyDone = o.date;
  D.innDive = H.records.dives + 1;
  H.records.dives += 1;
  H.diving = true;
  return D;
}

/** 共有コードを読む（読めなければ null） */
export function readShare(base, code) { return decodeShare(base.content, code); }

/** 共有コードの潜行：同じシード・宿泊客・深度で素泊まり（持ち込みなし・喪失なし・層の制限なし） */
export function beginShared(base, H, o) {
  check(!H.overflow, '蔵があふれている。先に売る');
  const r = decodeShare(base.content, o.code);
  check(!!r, '共有コードが読めない');
  const C = base.content;
  const pool = poolOf(base, H, r.guest);
  const deck = borrowedDeck(base, pool, Rng.child(r.seed, 'shared', 0), r.seed);
  const g = C.guests[r.guest];
  const D = createDive(base, {
    seed: r.seed, guest: r.guest, depth: Math.min(r.depth, inn(base).depthMax), deck, relics: g?.relic ? [{ uid: `g_${g.relic}`, id: g.relic, guest: true }] : [],
    pool, carry: carryOf(base, H, 0), sudomari: true,
  });
  D.shared = r;
  D.innDive = H.records.dives + 1;
  H.records.dives += 1;
  H.diving = true;
  return D;
}

function beginSudomari(base, H, o) {
  check(H.sudomari > 0, '素泊まりの回数が無い');
  const C = base.content;
  const rng = Rng.child(o.seed, 'sudomari', 0);
  const guest = rng.pick(H.unlocked.guests);
  const pool = poolOf(base, H, guest).cards.map((id) => C.cards[id]).filter((d) => ['並', '上'].includes(d.grade) && !['pawn', 'cursed', 'expiry', 'bet'].includes(d.origin));
  const deck = Array.from({ length: inn(base).sudomariSize }, (_, i) => ({ uid: `b${o.seed}_${i}`, id: rng.pick(pool).id, origin: 'orig', borrowed: true }));
  const g = C.guests[guest];
  H.sudomari -= 1;
  const D = createDive(base, {
    seed: o.seed, guest, depth: 0, deck, relics: g?.relic ? [{ uid: `g_${g.relic}`, id: g.relic, guest: true }] : [],
    pool: poolOf(base, H, guest), carry: carryOf(base, H, 0), sudomari: true, maxFloor: inn(base).sudomariFloors,
  });
  D.innDive = H.records.dives + 1;
  H.records.dives += 1;
  H.diving = true;
  return D;
}

// ───────────────────────── 脱出・未帰還 ─────────────────────────

function seen(H, id, owned) {
  if (!H.codex.seen.includes(id)) H.codex.seen.push(id);
  if (owned && !H.codex.owned.includes(id)) H.codex.owned.push(id);
}

const asStash = (x, type) => ({ ...x, type: x.type ?? type });

/**
 * 潜行の終わりを宿に反映する（仕様書 第4章の順番）。D.result が要る。
 * @returns {object} 結果の報告（画面に出す）
 */
export function finishDive(base, H, D) {
  check(!!D.result, '潜行が終わっていない');
  const C = base.content;
  const E = inn(base);
  const rep = { outcome: D.result.outcome, via: D.result.via, floor: D.result.floor, sudomari: !!D.sudomari, got: [], lost: [], zeni: 0, debtPaid: 0,
    relicCash: 0, thanks: 0, betZeni: 0, expired: [], returned: [], notReturned: [], unlocked: [], depthUp: null, starter: false };
  const R = H.records;
  const clean = (x) => { const { brought, insured, ...rest } = x; return rest; };

  if (D.result.outcome === 'escaped') {
    // 1. デッキ・席・懐・お守り袋・お品書きを全て蔵へ。宿銭は財布へ（借金を先に引く）
    const things = [
      ...D.deck.map((x) => asStash(x, 'card')), ...D.seats.map((x) => asStash(x, 'regular')),
      ...D.items.map((x) => asStash(x, 'item')), ...D.pouch, ...D.charm,
    ].filter((x) => !x.borrowed);
    let zeni = D.zeni;
    // 2. 置物を換金（宿泊客の最初の置物は除く）
    rep.relicCash = D.relics.filter((r) => !r.guest).reduce((s, r) => s + (econ(base).relicCash[C.relics?.[r.id]?.grade] ?? 0), 0);
    zeni += rep.relicCash;
    // 3. 由来：期限札は持ち込んだものだけ消える。質札は返して謝礼。賭け札は育ち×5の宿銭に換えて0に
    const keep = [];
    for (const x of things) {
      if (x.origin === 'expiry' && x.brought) { rep.expired.push(nameOf(base, x)); continue; }
      if (x.origin === 'pawn') { const t = Math.floor(sellValue(base, x) * E.pawnThanks); rep.thanks += t; zeni += t; continue; }
      if (x.origin === 'bet' && x.grow) { const b = x.grow * E.betZeniPerGrow; rep.betZeni += b; zeni += b; x.grow = 0; }
      keep.push(clean(x));
    }
    // 4. 成長型：「脱出」で育つものを育て、永続でない育ちはここで0に戻す（3. で写した keep の側を直す）
    for (const x of keep) {
      const gw = x.type === 'regular' ? C.regulars?.[x.id]?.grow : null;
      if (!gw) continue;
      if (gw.増える === '脱出') x.grow = (x.grow || 0) + gw.量;
      if (!gw.永続) x.grow = 0;
    }
    const pay = Math.min(H.debt, zeni);
    H.debt -= pay; rep.debtPaid = pay; zeni -= pay;
    H.zeni += zeni; rep.zeni = zeni;
    const broughtUids = new Set(things.filter((x) => x.brought).map((x) => x.uid));
    for (const x of keep) {
      if (!x.uid) x.uid = uid(H, 'x');
      H.stash.push(x);
      seen(H, x.id, true);
      if (!broughtUids.has(x.uid)) rep.got.push(nameOf(base, x));
      if (x.type === 'souvenir' && !R.brought.includes(x.id)) R.brought.push(x.id);
    }
    // 持ち込んだデッキ（＋潜行中にデッキへ入れた札）は次もそのまま編成に。素泊まりは元の編成のまま
    if (!D.sudomari) H.deck = D.deck.filter((x) => !x.borrowed && H.stash.some((s) => s.uid === x.uid)).map((x) => x.uid).slice(0, base.balance.hands.play.deckMax);
    // 記録
    R.extracts += 1;
    R.deepestExtract = Math.max(R.deepestExtract, D.result.floor);
    for (const b of D.stats.bosses) if (!R.bosses.includes(b)) R.bosses.push(b);
    // 深度：深度Nで B16（底の主）を倒して脱出すれば N＋1（仕様書 第6章）。宿泊客×深度の印も付く
    const core = Object.values(C.layers).find((L) => L.onlyBoss);
    if (core && D.stats.bosses.includes(core.id) && !D.sudomari && !D.daily && !D.shared) {
      const next = Math.min(E.depthMax, D.depth + 1);
      if (next > H.unlocked.depth) { H.unlocked.depth = next; rep.depthUp = next; }
      R.depthExtract16 = Math.max(R.depthExtract16 ?? -1, D.depth);
      H.stamps[D.guest] = Math.max(H.stamps[D.guest] ?? -1, D.depth);
    }
  } else {
    // 未帰還：お守り袋の中身だけ蔵へ。それ以外は全て失う
    for (const x of D.charm) { const c = clean(x); H.stash.push(c); }
    const lostThings = D.sudomari ? [] : [
      ...D.deck.map((x) => asStash(x, 'card')), ...D.seats.map((x) => asStash(x, 'regular')), ...D.items.map((x) => asStash(x, 'item')), ...D.pouch,
    ].filter((x) => !x.borrowed);
    let kuyoSum = 0;
    for (const x of lostThings) {
      rep.lost.push(nameOf(base, x));
      // 保険を掛けていた物は戻り待ちへ（次の潜行が終わったときに抽選）
      if (x.insured && x.brought) H.insuredPending.push({ owned: clean(x), rate: returnRate(base, H, D.depth), dive: D.innDive });
      // 遺失物帳（札と常連客）と供養点
      if (['card', 'regular'].includes(x.type) && x.origin !== 'pawn') {
        H.lostLog.unshift(clean(x));
        kuyoSum += sellValue(base, x);
      }
      if (x.origin === 'pawn') H.debt += sellValue(base, x);
    }
    H.kuyo += Math.round(kuyoSum * E.kuyoRate);
    rep.kuyo = Math.round(kuyoSum * E.kuyoRate);
    H.lostLog.length = Math.min(H.lostLog.length, E.lostLogSize);
    R.deaths += 1;
    H.deck = H.deck.filter((u) => H.stash.some((s) => s.uid === u));
  }
  // 両方：記録・素泊まり・戻り待ちの抽選
  for (const id of D.stats.met || []) seen(H, id, false);
  for (const x of [...D.deck, ...D.seats, ...D.relics]) seen(H, x.id, false);
  R.kills = (R.kills || 0) + (D.stats.kills || 0);
  R.fled = (R.fled || 0) + (D.stats.fled || 0);
  R.bossIds ||= [];
  for (const b of D.stats.bossIds || []) if (!R.bossIds.includes(b)) R.bossIds.push(b);
  if (D.result.outcome === 'escaped') {
    (R.guestExtracts ||= {})[D.guest] = (R.guestExtracts[D.guest] || 0) + 1;
    R.zeniTotal = (R.zeniTotal || 0) + Math.max(0, rep.zeni);
    if (D.sudomari && !D.daily && !D.shared) R.sudomariExtracts = (R.sudomariExtracts || 0) + 1;
    if (D.daily) R.daily = (R.daily || 0) + 1;
    // 縛り潜行の初回脱出：限定の札・常連客か宿銭
    if (D.shibari && !(R.shibari ||= []).includes(D.shibari)) {
      R.shibari.push(D.shibari);
      const rw = (C.shibari || []).find((x) => x.id === D.shibari)?.reward || {};
      if (rw.card) { H.stash.push({ uid: uid(H, 'c'), type: 'card', id: rw.card, origin: 'orig' }); seen(H, rw.card, true); }
      if (rw.regular) { H.stash.push({ uid: uid(H, 'r'), type: 'regular', id: rw.regular, origin: 'orig' }); seen(H, rw.regular, true); }
      if (rw.zeni) H.zeni += rw.zeni;
      rep.shibariReward = { id: D.shibari, name: (C.shibari || []).find((x) => x.id === D.shibari)?.name, what: rw.card ? nameOf(base, { type: 'card', id: rw.card }) : rw.regular ? nameOf(base, { type: 'regular', id: rw.regular }) : `宿銭${rw.zeni ?? 0}` };
    }
    if (H.debt === 0 && rep.debtPaid > 0) R.debtCleared = true;
  }
  R.deepest = Math.max(R.deepest, D.stats.deepest);
  if (D.stats.maxV.gt(R.maxV)) R.maxV = D.stats.maxV;
  for (const [k, n] of Object.entries(D.stats.hands)) R.counts.hands[k] = (R.counts.hands[k] || 0) + n;
  for (const [k, n] of Object.entries(D.stats.overkill)) R.counts.overkill[k] = (R.counts.overkill[k] || 0) + n;
  H.sudomari = Math.min(E.sudomariMax, H.sudomari + 1);
  const keepPending = [];
  H.insuredPending.forEach((p, i) => {
    if (p.dive >= D.innDive) { keepPending.push(p); return; }
    const won = Rng.child(H.seed, 'insurance', D.innDive, i, p.owned.uid).chance(p.rate);
    if (won) { H.stash.push({ ...p.owned, uid: uid(H, 'c') }); rep.returned.push(nameOf(base, p.owned)); }
    else rep.notReturned.push(nameOf(base, p.owned));
  });
  H.insuredPending = keepPending;
  rep.unlocked = refreshUnlocks(base, H);
  if (canTakeStarter(base, H)) { giveStarter(base, H, H.loadout.guest ?? D.guest); rep.starter = true; }
  const room = stashRoom(base, H);
  H.overflow = room.used > room.cap;
  rep.overflow = H.overflow;
  rep.firstExtract = D.result.outcome === 'escaped' && R.extracts === 1;
  rep.charm = D.charm.map((x) => nameOf(base, x));
  // 共有コード（この潜行のシード・結果）と、読み込んだコードの相手との比べ
  const mine = { seed: D.seed, guest: D.guest, depth: D.depth, deepest: D.stats.deepest, maxVlog: D.stats.maxV.isZero() ? 0 : D.stats.maxV.log10(), seat: D.seats.at(-1)?.id ?? null };
  rep.share = shareableSeed(D.seed) ? encodeShare(C, mine) : null;
  if (D.shared) rep.versus = { their: D.shared, mine };
  if (D.daily) rep.daily = D.daily;
  if (D.shibari) rep.shibari = D.shibari;
  H.loadout.shibari = null;
  rep.gotValue = D.result.outcome === 'escaped' ? rep.zeni + [...D.pouch, ...D.charm].reduce((s, x) => s + sellValue(base, x), 0) : 0;
  rep.record = rep.gotValue > (R.bestHaul || 0);
  if (rep.record) R.bestHaul = rep.gotValue;
  H.diving = false;
  H.lastResult = rep;
  return rep;
}

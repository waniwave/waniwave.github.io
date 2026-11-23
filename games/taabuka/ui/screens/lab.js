// 試し場（index.html?dev=1）：IDを指定して手札・席・敵・宿泊客を置き、すぐ戦闘する。開発用
import { h, toast } from '../dom.js';
import { Big } from '../../engine/big.js';
import { compileOne, parseKw } from '../../engine/content.js';
import { hint } from '../../engine/vocab/index.js';

const KEY = 'taabuka.lab';
const DEFAULT = { kw: '', guest: '', hand: '', deck: '初期デッキ', seats: '', relics: '', enemies: 'en_teiki', floor: '1', hp: '', seed: '', banzuke: '' };

const PRESETS = {
  十条さとさとる: { hand: 'rk_jujo_satosatoru fx_god fx_kaku fx_udon fx_neko fx_sure fx_hone fx_inu', enemies: 'en_teiki en_jien', guest: '' },
  願望: { hand: 'rk_ganbou fx_neko fx_sure fx_hone fx_inu fx_kaeru fx_ramen fx_robo', enemies: 'en_teiki:3000' },
  交互: { hand: 'rk_yakitori fx_tare fx_soba fx_neko fx_sure fx_kotei fx_hone fx_inu', enemies: 'en_kaiko' },
  死ねーぃ: { hand: 'rk_shineei fx_neko fx_sure fx_kotei fx_hone fx_inu fx_kaeru fx_ramen', enemies: 'en_tsuri en_niwaka' },
  土: { guest: 'tsuchi', hand: '', deck: '初期デッキ', enemies: 'en_teiki en_jien' },
  マープ: { guest: 'maap', hand: '', deck: '初期デッキ', enemies: 'en_kaiko en_niwaka' },
};

const ids = (s) => String(s || '').split(/[\s,、]+/).filter(Boolean);

export function labScreen(ctx) {
  const C = ctx.base.content;
  let v = { ...DEFAULT };
  try { v = { ...v, ...JSON.parse(sessionStorage.getItem(KEY) || '{}') }; } catch { /* 初回 */ }
  const inputs = {};
  const field = (key, label, attrs = {}) => {
    const i = h('input', { value: v[key], ...attrs, oninput: () => { v[key] = i.value; save(); } });
    inputs[key] = i;
    return h('label', {}, [label, i]);
  };
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 無視 */ } };
  const set = (o) => { v = { ...DEFAULT, ...o }; for (const [k, i] of Object.entries(inputs)) i.value = v[k] ?? ''; save(); };

  const guestSel = h('select', { onchange: () => { v.guest = guestSel.value; save(); } }, [
    h('option', { value: '' }, ['なし']),
    ...Object.values(C.guests).map((g) => h('option', { value: g.id }, [g.name])),
  ]);
  guestSel.value = v.guest;
  inputs.guest = guestSel;

  const cardChips = h('div.chips', {}, Object.values(C.cards).map((c) => h('button.chip', { type: 'button', onclick: () => {
    inputs.hand.value = `${inputs.hand.value} ${c.id}`.trim(); v.hand = inputs.hand.value; save();
  } }, [`${c.name}（${c.id}）`])));

  function start() {
    const missing = [];
    const need = (list, pool) => list.filter((x) => !pool[x]).forEach((x) => missing.push(x));
    let hand = ids(v.hand);
    const deck = ['初期デッキ', '仮デッキ'].includes(v.deck.trim()) ? ctx.tempDeck(v.guest || null) : ids(v.deck);
    // キーワードを付けた試しの札（Tier3・ター）を手札の先頭に
    const kws = ids(v.kw);
    if (kws.length) {
      const bad = kws.filter((w) => !C.kwByName[parseKw(w).name]);
      if (bad.length) { toast(`知らないキーワード「${bad[0]}」。${hint(parseKw(bad[0]).name, Object.keys(C.kwByName))}`); return; }
      C.cards.__lab_kw = compileOne(C, { id: '__lab_kw', name: `試し（${kws.join('・')}）`, cat: ['ター'], tier: '3', grade: '並', set: '試し', kw: kws, text: '' }, 'cards');
      hand = ['__lab_kw', ...(hand.length ? hand : deck.filter((id) => C.cards[id]).slice(0, 7))];
    }
    const enemies = ids(v.enemies).map((s) => { const [id, claim] = s.split(':'); return { id, claim: claim ? Big.from(claim) : null }; });
    need(hand, C.cards); need(deck, C.cards); need(ids(v.seats), C.regulars); need(ids(v.relics), C.relics); need(enemies.map((e) => e.id), C.enemies);
    if (missing.length) { toast(`知らないID：${missing.join('、')}`); return; }
    if (!enemies.length) { toast('敵を1体以上'); return; }
    if (enemies.length > ctx.base.balance.hands.play.maxEnemies) { toast(`敵は${ctx.base.balance.hands.play.maxEnemies}体まで`); return; }
    const banzuke = {};
    for (const s of ids(v.banzuke)) { const [c, t] = s.split('='); if (c && t) banzuke[c] = t; }
    ctx.startBattleScreen({
      guest: v.guest || null, deck, hand, seats: ids(v.seats), relics: v.relics.trim() ? ids(v.relics) : null, enemies,
      floor: Number(v.floor) || 1, hp: Number(v.hp) || null, seed: v.seed || null, banzuke, back: ctx.back,
    });
  }

  const el = h('div.scr.lab', {}, [
    h('div.ztop', {}, [h('h2', { text: '試し場' }), h('button.btn', { type: 'button', onclick: () => ctx.showFxLab() }, ['演出の一覧'])]),
    h('div.chips', {}, Object.keys(PRESETS).map((k) => h('button.chip', { type: 'button', onclick: () => { set(PRESETS[k]); guestSel.value = v.guest; } }, [k]))),
    h('label', {}, ['宿泊客', guestSel]),
    field('kw', 'キーワード（付けた試しの札を手札の先頭に。例：呼び水2 消える）'),
    h('div.chips', {}, Object.values(C.kwByName).map((k) => h('button.chip', { type: 'button', onclick: () => {
      inputs.kw.value = `${inputs.kw.value} ${k.name}${k.arg ? '2' : ''}`.trim(); v.kw = inputs.kw.value; save();
    } }, [`${k.name}${k.arg ? 'N' : ''}`]))),
    field('hand', '手札（IDを空白で区切る。空なら山札から引く）'),
    h('div.cardlist', {}, [cardChips]),
    field('deck', '山札（ID。「初期デッキ」で入門札＋ター宿の並17枚）'),
    h('div.grid2', {}, [field('seats', '席（常連客ID）'), field('relics', '置物（空なら宿泊客の最初の置物）')]),
    field('enemies', `敵（ID:主張 も可）：${Object.keys(C.enemies).join(' ')}`),
    h('div.grid2', {}, [field('floor', '階', { inputmode: 'numeric' }), field('hp', '体力（空なら宿泊客の値）', { inputmode: 'numeric' })]),
    h('div.grid2', {}, [field('seed', 'シード（空なら毎回違う）'), field('banzuke', '番付（例：麺=God ター=1）')]),
    h('button.btn.main', { type: 'button', onclick: start }, ['すぐ戦う']),
    h('p.note', { text: '戦闘の画面で札や敵を押すと、説明欄に説明が出る。' }),
  ]);
  return { el };
}

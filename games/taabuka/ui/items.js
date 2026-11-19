// お品書きを使う前に選ばせるもの（ask）を、画面で順に聞く。戦闘中・潜行中の両方で使う
import { pick } from './dom.js';
import { slotLabel } from './labels.js';

/** 札の個体の表示名（潜行の個体：合体などの変化を含む） */
export function ownedName(content, x) {
  return x.mod?.name ?? content.cards?.[x.id]?.name ?? content.regulars?.[x.id]?.name ?? content.relics?.[x.id]?.name ?? content.items?.[x.id]?.name ?? content.souvenirs?.[x.id]?.name ?? x.id;
}

/**
 * @param {HTMLElement} app @param {object} base @param {object} item お品書きの個体
 * @param {{B?:object, D?:object}} where 戦闘中なら B、潜行中（戦闘外）なら D
 * @returns {Promise<object|null>} choices（やめたら null）
 */
export async function askItem(app, base, item, where) {
  const def = item.id ? base.content.items?.[item.id] : null;
  const out = {};
  const banzuke = where.B?.banzuke ?? where.D?.banzuke ?? {};
  for (const a of def?.ask || []) {
    let v = null;
    if (a === 'カテゴリ') v = await pick(app, 'カテゴリを選ぶ', base.balance.tiers.categories.map((c) => ({ label: `${c}（${slotLabel(banzuke[c] ?? base.balance.tiers.banzukeStart)}）`, value: c })));
    else if (a === '手札') v = await pick(app, '手札の札を選ぶ', (where.B?.hand || []).map((c) => ({ label: c.faceDown ? '？' : c.name, value: c.uid })));
    else if (a === '敵') v = await pick(app, '敵を選ぶ', (where.B?.enemies || []).map((e, i) => ({ e, i })).filter(({ e }) => !e.dead).map(({ e, i }) => ({ label: e.name, value: String(i) })));
    else if (a === '札' || a === '札2') {
      const deck = (where.D?.deck || []).filter((c) => c.uid !== out.札);
      v = await pick(app, a === '札' ? 'デッキの札を選ぶ' : 'もう1枚選ぶ', deck.map((c) => ({ label: ownedName(base.content, c), value: c.uid })));
    }
    if (v == null) return null;
    out[a === '手札' ? '札' : a] = v;
  }
  return out;
}

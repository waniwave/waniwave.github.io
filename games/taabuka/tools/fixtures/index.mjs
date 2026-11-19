// 試し用の仮のコンテンツ（content/ には入れない）。
// 段階2で content.js が YAML から作る形と同じ「定義」の形で書く：
//   札 {id, name, cat, tier, grade, on?: {合図: (ctx, me)}, hooks?: {差し込み口: (ctx, next, me)}}
//   常連客・置物 {id, name, on?, hooks?}
//   敵 {id, name, kind, hp, atk, acts, line}

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadBalance } from '../../engine/content.js';
import { createVocab } from '../../engine/vocab/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** content/ から数値表を読む */
export function loadNodeBalance() {
  return loadBalance((p) => readFile(path.join(ROOT, 'content', p), 'utf8'));
}

import { CARDS, ENEMIES } from './cards.mjs';
export { CARDS, ENEMIES };

export const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));

/** 仮のコンテンツ一式。extra.rules などは語彙に登録する（特注と同じ口） */
export function fixtureContent(extra = {}) {
  const vocab = createVocab();
  for (const r of extra.rules || []) vocab.register('rule', { text: '試し', ...r }, 'tools/fixtures');
  for (const m of extra.mechanics || []) vocab.register('mechanic', { text: '試し', ...m }, 'tools/fixtures');
  for (const e of extra.enemyCustoms || []) vocab.register('enemy', { text: '試し', ...e }, 'tools/fixtures');
  return {
    vocab, keywords: [],
    cards: byId([...CARDS, ...(extra.cards || [])]),
    enemies: byId([...ENEMIES, ...(extra.enemies || [])]),
    regulars: byId(extra.regulars || []),
    relics: byId(extra.relics || []),
    guests: byId(extra.guests || []),
    items: byId(extra.items || []),
  };
}

/** 個体（セーブの形）を作る */
export function owned(id, n, attrs = {}) { return { uid: `u_${id}_${n}`, id, origin: 'orig', ...attrs }; }

/** 仮のデッキ20枚 */
export function fixtureDeck() { return CARDS.map((c, i) => owned(c.id, i)); }

/** content/ を読み、仮の札（ター宿セットの移植まで）を「仮」として足す。画面の ui/main.js と同じ */
export async function loadRealContent() {
  const { loadContent, nodeIO } = await import('../../engine/content.js');
  const { content, issues } = await loadContent(await nodeIO(path.join(ROOT, 'content')));
  for (const c of CARDS) if (!content.cards[c.id]) content.cards[c.id] = { ...c, tier: String(c.tier), set: '仮', listen: [], rules: [], show: [], text: '仮の札（ター宿セットの移植まで）' };
  return { base: { balance: content.balance, content }, issues };
}

/** 仮の初期デッキ：宿泊客の入門札＋仮の札17枚（ui/main.js の tempDeck と同じ） */
export function tempDeckIds(content, guestId) {
  const g = guestId ? content.guests[guestId] : null;
  return [...(g?.deck?.extra || []), ...CARDS.slice(0, 17).map((c) => c.id)];
}

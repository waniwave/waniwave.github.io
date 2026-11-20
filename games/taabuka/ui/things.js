// 持ち物（札・常連客・置物・お品書き・お土産）の小さな札と説明。宿の画面で使う
import { h, tip, esc } from './dom.js';
import { GRADE_COLOR, catGlyph, catColor, kwLines, ORIGIN_MARK, ORIGIN_JA, RAR_VAR, RAR_SHORT, rarOfCard, fxText, rarNote, affixLines } from './labels.js';
import { nameOf, sellValue } from '../engine/dive.js';

export function defOf(content, x) {
  return x.type === 'card' ? content.cards[x.id] : x.type === 'regular' ? content.regulars[x.id] : x.type === 'relic' ? content.relics[x.id]
    : x.type === 'item' ? content.items[x.id] : content.souvenirs[x.id];
}

/** 説明（長押し） */
export function thingTip(base, x) {
  const def = defOf(base.content, x);
  const isCard = x.type === 'card';
  const r = isCard ? rarOfCard(base.balance, x, def) : null;
  const lines = [`<b>${esc(nameOf(base, x))}</b>${isCard ? `　<span class="rar" style="color:${RAR_VAR[r]}">${esc(r)}</span>` : def?.grade ? `　<span class="q">${esc(def.grade)}</span>` : ''}`];
  if (isCard) {
    const cats = [...(x.mod?.cat ?? def?.cat ?? []), ...(x.ins || []).map((i) => String(i).split(':')[1]).filter(Boolean)];
    lines.push(`<span class="q">${[...new Set(cats)].map(esc).join('・')}</span>`);
    lines.push(...kwLines(def, def?.text ? fxText(def.text, base.balance, r) : '効果なし').filter(Boolean));
    const note = rarNote({ balance: base.balance }, x, def);
    if (note) lines.push(`<span class="q">${esc(note)}</span>`);
    for (const a of affixLines(base.content, x.ins)) lines.push(`<span class="ins${a.mythic ? ' m' : ''}">◆${esc(a.name)}：${esc(a.text)}</span>`);
  } else lines.push(...(def?.kwList?.length ? kwLines(def) : [esc(def?.text ?? (def?.use ? `使い道：${def.use}` : ''))]).filter(Boolean));
  const attrs = [x.enh && `仕込み「${x.enh}」`, x.ed && `版「${x.ed}」`, x.seal && `判「${x.seal}」`, x.origin && x.origin !== 'orig' && `由来：${ORIGIN_JA[x.origin]}`, x.grow && `育ち ${x.grow}`].filter(Boolean);
  if (attrs.length) lines.push(attrs.map(esc).join('・'));
  lines.push(`<span class="q">売値 ${sellValue(base, x)}${x.type === 'souvenir' ? `・重さ ${def?.weight ?? 1}` : ''}</span>`);
  if (def?.flavor) lines.push(`<span class="fl">${esc(def.flavor)}</span>`);
  return lines.join('<br>');
}

/** 小さな札 */
export function thingEl(base, x, opt = {}) {
  const def = defOf(base.content, x);
  const kids = [h('b', { text: nameOf(base, x) })];
  if (x.type === 'card') {
    const cats = [...new Set([...(x.mod?.cat ?? def?.cat ?? []), ...(x.ins || []).map((i) => String(i).split(':')[1]).filter(Boolean)])];
    kids.push(h('span.sub', {}, [...cats.map((c) => h('span.glyph', { style: { background: catColor(c) } }, [catGlyph(c)])),
      h('span.rr', { text: RAR_SHORT[rarOfCard(base.balance, x, def)] }),
      ...(x.ins?.length ? [h('span.ed', { text: ` ◆${x.ins.length}` })] : []),
      ...[x.enh, x.ed, x.seal].filter(Boolean).map((t) => h('span.ed', { text: ` ${t}` }))]));
  } else kids.push(h('span.sub', { text: { regular: '常連客', relic: '置物', item: 'お品書き', souvenir: `お土産・重さ${def?.weight ?? 1}` }[x.type] ?? '' }));
  if (ORIGIN_MARK[x.origin]) kids.push(h('span.mark', { text: ORIGIN_MARK[x.origin] }));
  const color = x.type === 'card' ? RAR_VAR[rarOfCard(base.balance, x, def)] : GRADE_COLOR[def?.grade] ?? 'var(--line)';
  const el = h(`div.thing${opt.on ? '.took' : ''}${x.type === 'card' ? `.r-${rarOfCard(base.balance, x, def)}` : ''}`, { style: { '--g': color }, dataset: { uid: x.uid } }, kids);
  if (opt.onclick) { el.classList.add('tap'); el.addEventListener('click', opt.onclick); }
  tip(el, () => thingTip(base, x));
  return el;
}

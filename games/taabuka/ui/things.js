// 持ち物（札・常連客・置物・お品書き・お土産）の小さな札と説明。宿の画面で使う
import { h, tip, esc } from './dom.js';
import { GRADE_COLOR, catGlyph, catColor, tierLabel, kwLines, ORIGIN_MARK, ORIGIN_JA } from './labels.js';
import { nameOf, sellValue } from '../engine/dive.js';

export function defOf(content, x) {
  return x.type === 'card' ? content.cards[x.id] : x.type === 'regular' ? content.regulars[x.id] : x.type === 'relic' ? content.relics[x.id]
    : x.type === 'item' ? content.items[x.id] : content.souvenirs[x.id];
}

/** 説明（長押し） */
export function thingTip(base, x) {
  const def = defOf(base.content, x);
  const lines = [`<b>${esc(nameOf(base, x))}</b>${def?.grade ? `　<span class="q">${esc(def.grade)}</span>` : ''}`];
  if (x.type === 'card') lines.push(`<span class="q">Tier ${tierLabel(x.mod?.tier ?? def?.tier)}・${(x.mod?.cat ?? def?.cat ?? []).map(esc).join('・')}</span>`);
  lines.push(...(def?.kwList?.length ? kwLines(def) : [esc(def?.text ?? (def?.use ? `使い道：${def.use}` : ''))]).filter(Boolean));
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
    kids.push(h('span.sub', {}, [`${tierLabel(x.mod?.tier ?? def?.tier)} `, ...(x.mod?.cat ?? def?.cat ?? []).map((c) => h('span.glyph', { style: { background: catColor(c) } }, [catGlyph(c)])),
      ...[x.enh, x.ed, x.seal].filter(Boolean).map((t) => h('span.ed', { text: ` ${t}` }))]));
  } else kids.push(h('span.sub', { text: { regular: '常連客', relic: '置物', item: 'お品書き', souvenir: `お土産・重さ${def?.weight ?? 1}` }[x.type] ?? '' }));
  if (ORIGIN_MARK[x.origin]) kids.push(h('span.mark', { text: ORIGIN_MARK[x.origin] }));
  const el = h(`div.thing${opt.on ? '.took' : ''}`, { style: { '--g': GRADE_COLOR[def?.grade] ?? 'var(--line)' }, dataset: { uid: x.uid } }, kids);
  if (opt.onclick) { el.classList.add('tap'); el.addEventListener('click', opt.onclick); }
  tip(el, () => thingTip(base, x));
  return el;
}

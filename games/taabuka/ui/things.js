// 持ち物（札・常連客・置物・お品書き・お土産）の小さな札と説明。宿の画面で使う
import { h, tip, esc, sheet, toast } from './dom.js';
import { GRADE_COLOR, catGlyph, catColor, kwLines, ORIGIN_MARK, ORIGIN_JA, RAR_VAR, RAR_SHORT, rarOfCard, fxText, rarNote, affixLines, attrText, comboLines } from './labels.js';
import { nameOf, sellValue } from '../engine/dive.js';

export function defOf(content, x) {
  return x.type === 'card' ? content.cards[x.id] : x.type === 'regular' ? content.regulars[x.id] : x.type === 'relic' ? content.relics[x.id]
    : x.type === 'item' ? content.items[x.id] : content.souvenirs[x.id];
}

/** 説明（押すと出る） */
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
    lines.push(...comboLines(base.content, x.id));
    for (const a of affixLines(base.content, x.ins)) lines.push(`<span class="ins${a.mythic ? ' m' : ''}">◆${esc(a.name)}：${esc(a.text)}</span>`);
  } else lines.push(...(def?.kwList?.length ? kwLines(def) : [esc(def?.text ?? (def?.use ? `使い道：${def.use}` : ''))]).filter(Boolean));
  const attrs = [...attrText(base.balance, x), x.grow && `育ち ${x.grow}`].filter(Boolean);
  for (const a of attrs) lines.push(`<span class="attr">${esc(a)}</span>`);
  lines.push(`<span class="q">売値 ${sellValue(base, x)}${x.type === 'souvenir' ? `・重さ ${def?.weight ?? 1}` : ''}</span>`);
  if (def?.flavor) lines.push(`<span class="fl">${esc(def.flavor)}</span>`);
  return lines.join('<br>');
}

const strip = (t) => String(t ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** 効果の短い文（一覧にそのまま出す） */
export function thingFx(base, x) {
  const def = defOf(base.content, x);
  if (!def) return '';
  if (x.type === 'card') {
    const r = rarOfCard(base.balance, x, def);
    const kw = (def.kwList || []).map((k) => k.label).join('・');
    const body = def.text ? fxText(def.text, base.balance, r) : (kw ? '' : '効果なし');
    return [kw && `【${kw}】`, body].filter(Boolean).join(' ');
  }
  if (def.kwList?.length) return strip(kwLines(def)[0] ?? '');
  return def.text ?? (def.use ? `使い道：${def.use}` : '');
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
  if (opt.fx !== false) { const t = thingFx(base, x); if (t) kids.push(h('span.fx', { text: t })); }
  if (opt.price != null) kids.push(h('span.pr', { text: opt.price }));
  if (ORIGIN_MARK[x.origin]) kids.push(h('span.mark', { text: ORIGIN_MARK[x.origin] }));
  const color = x.type === 'card' ? RAR_VAR[rarOfCard(base.balance, x, def)] : GRADE_COLOR[def?.grade] ?? 'var(--line)';
  const el = h(`div.thing${opt.on ? '.took' : ''}${x.type === 'card' ? `.r-${rarOfCard(base.balance, x, def)}` : ''}`, { style: { '--g': color }, dataset: { uid: x.uid } }, kids);
  if (x.type === 'card' && base.content.sets[def?.set]?.joke) { el.classList.add('joke'); el.append(h('span.jokemk', { text: 'おふざけ' })); }
  if (opt.onclick) { el.classList.add('tap'); el.addEventListener('click', opt.onclick); }
  tip(el, () => thingTip(base, x));
  return el;
}

/**
 * 持ち物から1つ選ぶ窓（一覧に効果も出る）。押すと選んで説明、「決める」で確定。閉じたら null
 * @param {HTMLElement} root @param {string} title @param {object[]} list @param {{note?: string, yes?: string, price?: (x) => string}} [o]
 */
export function pickThing(base, root, title, list, o = {}) {
  return new Promise((resolve) => {
    let cur = null; let done = false;
    const s = sheet(root, [], { onClose: () => { if (!done) resolve(null); } });
    const info = h('div.infobox', { html: '<span class="q">押すと詳しい説明がここに出ます</span>' });
    const draw = () => s.el.replaceChildren(
      h('h2', { text: title }),
      o.note ? h('p.q', { text: o.note }) : null,
      info,
      list.length ? h('div.things.half.list', {}, list.map((x) => thingEl(base, x, { on: cur === x.uid, price: o.price?.(x), onclick: () => { cur = x.uid; draw(); info.innerHTML = thingTip(base, x); } }))) : h('p.q', { text: '選べるものが無い' }),
      h('div.row', {}, [
        h('button.btn', { type: 'button', onclick: () => s.close() }, ['やめる']),
        h('button.btn.main', { type: 'button', disabled: !cur, onclick: () => { done = true; s.close(); resolve(cur); } }, [o.yes ?? '決める']),
      ]),
    );
    draw();
  });
}

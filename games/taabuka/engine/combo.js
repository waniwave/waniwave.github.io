// 札同士のコンボ（content/combos.yaml）と、出した札の「呪文」（名前を短くつないだ掛け声）
// コンボはカテゴリに関係なく、決まった札の組み合わせを同じ出しに入れると発動する。
// 個別の札の特別扱いは書かない：組み合わせと効果は全部 content/combos.yaml にある。

/**
 * combos.yaml を札IDの組に直す（content 読み込みの最後に1回）。見つからない札名は add で知らせる
 * cards の各要素：札の名前かID。配列なら「そのどれか」
 */
export function compileCombos(content, add = () => {}) {
  const byName = new Map();
  for (const d of Object.values(content.cards || {})) {
    if (!byName.has(d.name)) byName.set(d.name, []);
    byName.get(d.name).push(d.id);
  }
  const ids = (x) => (content.cards?.[x] ? [x] : byName.get(x) || []);
  const out = [];
  for (const c of content.combos || []) {
    if (!c || !c.id || !c.name || !Array.isArray(c.cards) || c.cards.length < 2) { add('error', '形', 'content/combos.yaml', `コンボには id・name・cards（2つ以上）が要る（${c?.id ?? '?'}）`); continue; }
    const need = c.cards.map((x) => [...new Set([].concat(x).flatMap(ids))]);
    const bad = c.cards.filter((x, i) => !need[i].length);
    if (bad.length) { add('error', '参照', c.id, `コンボ「${c.name}」の札が無い：${bad.map((b) => [].concat(b).join('/')).join('、')}`); continue; }
    out.push({ ...c, need });
  }
  content.comboList = out;
  content.comboShorts = { ...(content.comboShortsRaw || {}) };
  // 札ID → その札が入るコンボ（図鑑・説明用）
  const of = {};
  for (const c of out) for (const set of c.need) for (const id of set) (of[id] ||= []).includes(c.id) || of[id].push(c.id);
  content.combosOf = of;
}

/**
 * 出した札で成り立つコンボ。1枚の札は1つのコンボにしか使わない（長いコンボを先に）
 * @param {object} content @param {{uid:string, id:string}[]} cards
 * @returns {{combo:object, uids:string[]}[]}
 */
export function matchCombos(content, cards) {
  const list = (content.comboList || []).slice().sort((a, b) => b.need.length - a.need.length);
  const used = new Set();
  const out = [];
  for (const c of list) {
    const pick = [];
    const ok = c.need.every((set) => {
      const card = cards.find((x) => !used.has(x.uid) && !pick.includes(x.uid) && set.includes(x.id));
      if (!card) return false;
      pick.push(card.uid);
      return true;
    });
    if (!ok) continue;
    for (const u of pick) used.add(u);
    out.push({ combo: c, uids: pick });
  }
  return out;
}

/** 札の短い名前（呪文に使う）。combos.yaml の shorts が先、無ければ名前から */
export function shortOf(content, card) {
  const def = content.cards?.[card.id];
  const name = def?.name ?? card.name ?? '';
  const s = content.comboShorts?.[name] ?? def?.short;
  if (s) return s;
  let t = String(name).replace(/[『』「」【】〈〉]/g, '').replace(/[（(][^）)]*[）)]/g, '').replace(/\s+/g, '');
  if ([...t].length <= 5) return t;
  const no = t.split('の');
  const last = no[no.length - 1];
  if (no.length > 1 && [...last].length >= 2 && [...last].length <= 5) return last;
  return [...t].slice(0, 4).join('');
}

/**
 * 呪文：出した順に短い名前をつなぐ。コンボになった札はコンボの名前1つにまとめる。
 * 最後がコンボなら「の」でつなぐ（例：EOOEハラのカレー！）
 */
export function spellOf(content, cards, matched = []) {
  const toks = [];
  const done = new Set();
  for (const c of cards) {
    if (c.faceDown) { toks.push({ t: '？' }); continue; }
    const m = matched.find((x) => x.uids.includes(c.uid));
    if (m) { if (!done.has(m.combo.id)) { done.add(m.combo.id); toks.push({ t: m.combo.spell ?? m.combo.name, combo: true }); } continue; }
    toks.push({ t: shortOf(content, c) });
  }
  if (!toks.length) return '';
  let s = '';
  toks.forEach((k, i) => { s += (i > 0 && i === toks.length - 1 && k.combo ? 'の' : '') + k.t; });
  return `${s}！`;
}

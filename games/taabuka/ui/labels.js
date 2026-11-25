import { yieldText } from '../engine/yield.js';
// 画面に出す短い文字と色（カテゴリの紋、格の色、由来の印、行動予告）

import { esc } from './dom.js';
import { formatMul } from '../engine/format.js';
import { num, num as format } from './num.js';
import { cardStrength } from '../engine/score.js';
import { tierOf } from '../engine/hand.js';
import { mostCategory } from '../engine/battle.js';

/** カテゴリの紋（1文字）と色 */
export const CAT = {
  食べ物: ['食', '#c9682a'], 死: ['死', '#3a3a3a'], 宿: ['宿', '#8a5a3c'], 動物: ['動', '#6f8f2f'], スレ: ['ス', '#4a6fa5'],
  湯: ['湯', '#2f8fa0'], 校庭: ['校', '#7aa04a'], 速さ: ['速', '#d0a020'], 格ゲー: ['格', '#b03a5a'], ター: ['タ', '#b8432c'],
  老: ['老', '#8a7a6a'], 麺: ['麺', '#d8a040'], ロボ: ['ロ', '#5a6a7a'],
};
export const catGlyph = (c) => CAT[c]?.[0] ?? c?.[0] ?? '？';
export const catColor = (c) => CAT[c]?.[1] ?? '#777';

export const GRADE_COLOR = { 並: 'var(--g-並)', 上: 'var(--g-上)', 特上: 'var(--g-特上)', 極: 'var(--g-極)', 神: 'var(--g-神)' };

/** レアリティの枠の色（CSS の値）。ミシックは虹 */
export const RAR_VAR = { コモン: 'var(--r0)', アンコモン: 'var(--r1)', レア: 'var(--r2)', レジェンダリー: 'var(--r3)', ユニーク: 'var(--r4)', ミシック: 'var(--r5)' };
export const RAR_SHORT = { コモン: 'C', アンコモン: 'UC', レア: 'R', レジェンダリー: 'L', ユニーク: 'U', ミシック: 'M' };
/** レアリティの段（1〜6）と星。上下が一目でわかるように星の数で出す */
export const RAR_RANK = { コモン: 1, アンコモン: 2, レア: 3, レジェンダリー: 4, ユニーク: 5, ミシック: 6 };
export const rarStars = (r) => '★'.repeat(RAR_RANK[r] ?? 1);
/** 説明窓の見出しに付けるレアリティ（星＋名前＋6段中の何段目） */
export const rarHead = (r) => `<span class="rar" style="color:${RAR_VAR[r]}">${'★'.repeat(RAR_RANK[r] ?? 1)}<span class="rar0">${'☆'.repeat(6 - (RAR_RANK[r] ?? 1))}</span> ${r}</span>`;
/** 札の個体のレアリティ（無ければ種類の最低） */
export function rarOfCard(balance, x, def) {
  if (x?.rar && balance.rarity.defs[x.rar]) return x.rar;
  return balance.rarity.gradeFloor[def?.grade] ?? 'コモン';
}
/** 札の個体の枠の色 */
export const rarColor = (balance, x, def) => RAR_VAR[rarOfCard(balance, x, def)] ?? 'var(--r0)';

/** 効果文の印 {+N}{xN}{dN} をレアリティの数に直す */
export function fxText(text, balance, r) {
  const d = balance.rarity.defs[r] || balance.rarity.defs.コモン;
  const fmt = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : String(Math.round(v * 100) / 100));
  return String(text || '')
    .replace(/×\{\+(-?[\d.]+)\}/g, (_, n) => `×${fmt(Number(n) * d.mul)}`)
    .replace(/\{\+(-?[\d.]+)\}/g, (_, n) => `＋${fmt(Number(n) * d.mul)}`)
    .replace(/\{x([\d.]+)\}/g, (_, n) => `×${fmt(1 + (Number(n) - 1) * d.mul)}`)
    .replace(/\{d([\d.]+)\}/g, (_, n) => fmt(Number(n) + d.drawAdd));
}

/** 印をそのまま（コモンの数で）読む */
export const plainFx = (t) => String(t || '').replace(/×\{\+(-?[\d.]+)\}/g, '×$1').replace(/\{\+(-?[\d.]+)\}/g, '＋$1').replace(/\{x([\d.]+)\}/g, '×$1').replace(/\{d([\d.]+)\}/g, '$1');

/** 量の無い効果の繰り返し・効果の無い札の採点回数（レアリティの一言） */
export function rarNote(env, x, def) {
  const r = rarOfCard(env.balance, x, def);
  const d = env.balance.rarity.defs[r];
  const vanilla = def && !(def.listen?.length) && !(def.rules?.length) && !def.hooks;
  if (vanilla) return d.vanilla > 1 ? `${r}：${d.vanilla}回採点される` : '';
  const noScale = (def?.fx || []).some((f) => ![].concat(f.do || []).some((it) => it && typeof it === 'object' && Object.keys(it).some((k) => ['強さ', '倍率', '受け', '体力', '宿銭', '次の出しの強さ', '育つ', '掛け', '論破値を掛ける', '引く', '主張を削る'].includes(k))));
  return noScale && d.repeat > 1 ? `${r}：量の無い効果は${d.repeat}回起きる` : '';
}

/** 刻印の行 */
export function affixLines(content, ins) {
  return (ins || []).map((x) => {
    const [id, cat] = String(x).split(':');
    const a = content.affixes?.[id];
    if (!a) return null;
    return { name: a.name, text: cat ? `${a.text}（${cat}）` : a.text, mythic: a.kind === 'ミシック' };
  }).filter(Boolean);
}
export const ORIGIN_MARK = { copy: '写', expiry: '期', cursed: '曰', pawn: '質', bet: '賭' };
export const ORIGIN_JA = { orig: '原本', copy: '写し', expiry: '期限', cursed: '曰く付き', pawn: '質', bet: '賭け' };
export const SEAL_COLOR = { 朱判: '#c8302a', 金判: '#d6a425', 青判: '#2f5d9c', 紫判: '#7a3fa5' };

export const tierLabel = (t) => (t == null ? '―' : t === 'God' ? 'God' : String(t));
export const slotLabel = (s) => (s === 'God' ? 'God' : String(s).startsWith('欠') ? String(s) : `T${s}`);

/** 仕込み・版・判とは何か（施設や説明で使う） */
export const ATTR_KIND = {
  enh: { ja: '仕込み', what: '札の性質を変える下ごしらえ。1枚に1つ（付け直すと前のは消える）。写しにも付けられる' },
  ed: { ja: '版', what: '札の刷り直し。出したときの点に上乗せ。1枚に1つ。写しには付かない' },
  seal: { ja: '判', what: '札に押す印。採点や手札の扱いでおまけが付く。1枚に1つ。写しには付かない' },
};

/** 仕込み・版・判ひとつの効果（数値は数値表から） */
export function attrExplain(balance, kind, name) {
  if (kind === 'enh') {
    const E = balance.hands.enhancements[name];
    if (!E) return '';
    return {
      金箔: `ターン終了時に手札にあれば宿銭＋${E.heldTurnEndZeni}`, 鋼: `出さずに手札に残しておくと、出した札の倍率×${E.heldMulM}`,
      硝子: `採点されると倍率×${E.mulM}。ただし${Math.round(E.breakChance * 100)}%で割れて無くなる`, 多才: '全部のカテゴリを持つ（どの重なりにも入る）', 石: `強さ＋${E.addS}。カテゴリを持たないが、必ず採点される`,
      祝: `採点されると${Math.round(E.chance * 100)}%で倍率＋${E.addM}`, 守: `採点されず受けに回ると、受けが強さの${E.guardMul}倍`, 重し: `強さ＋${E.addS}。ただし手札にある間は流せない`,
    }[name] ?? '';
  }
  if (kind === 'ed') {
    const D = balance.hands.editions[name];
    if (!D) return '';
    return D.addS ? `採点されると強さ＋${D.addS}` : D.addM ? `採点されると倍率＋${D.addM}` : D.mulM ? `採点されると倍率×${D.mulM}` : `常連客の席が＋${D.seats}（常連客だけ）`;
  }
  if (kind === 'seal') {
    const S = balance.hands.seals?.[name];
    if (!S) return '';
    return S.retrigger ? `採点されるとき、もう${S.retrigger}回採点する` : S.scoredZeni ? `採点されると宿銭＋${S.scoredZeni}` : S.heldTurnEndItem ? `ターン終了時に手札にあると、お品書き「${S.heldTurnEndItem}」をもらう` : S.discardedItem ? `流すと、お品書き「${S.discardedItem}」をもらう` : '';
  }
  return '';
}

/** 仕込み・版・判の説明（札に付いているもの） */
export function attrText(balance, c) {
  const out = [];
  for (const k of ['enh', 'ed', 'seal']) if (c[k]) { const t = attrExplain(balance, k, c[k]); out.push(`${ATTR_KIND[k].ja}「${c[k]}」${t ? `：${t}` : ''}`); }
  if (c.origin && c.origin !== 'orig') out.push(`由来：${ORIGIN_JA[c.origin]}`);
  return out;
}

/** キーワード能力の行：先頭に太字の名前、続けて説明文。下に各キーワードの説明（小さく） */
export function kwLines(def, body = def?.text ?? '') {
  body = plainFx(body);
  const kw = def?.kwList || [];
  const lines = [];
  const head = [kw.length ? `<b>${kw.map((k) => esc(k.label)).join('・')}</b>` : '', body ? esc(body) : ''].filter(Boolean).join('　');
  if (head) lines.push(head);
  for (const k of kw) lines.push(`<span class="q">${esc(k.label)}：${esc(k.text)}</span>`);
  return lines;
}

/** 札の説明（押すと出る） */
export function cardTip(env, c, B = null) {
  if (c.faceDown) return '<b>？</b><br><span class="q">裏向き。出せるが中身が見えない</span>';
  const def = env.content.cards[c.id] || {};
  const r = rarOfCard(env.balance, c, def);
  const lines = [
    `<b>${esc(c.name)}</b>　${rarHead(r)}`,
    `<span class="q">${c.cat.map(esc).join('・')}　Tier ${tierLabel(tierOf(c, env.balance, B?.banzuke))}・強さ ${cardStrength(c, env.balance, B?.banzuke)}</span>`,
  ];
  const fake = (def.rules || []).some((x) => x.name === '効果文を偽る');
  const body = def.text ? fxText(def.text, env.balance, r) : '';
  lines.push(...kwLines(def, body ? (fake ? scramble(body, c.uid) : body) : '効果なし'));
  const note = rarNote(env, c, def);
  if (note) lines.push(`<span class="q">${esc(note)}</span>`);
  lines.push(...comboLines(env.content, c.id));
  for (const a of affixLines(env.content, c.ins)) lines.push(`<span class="ins${a.mythic ? ' m' : ''}">◆${esc(a.name)}：${esc(a.text)}</span>`);
  for (const a of attrText(env.balance, c)) lines.push(esc(a));
  if (def.flavor) lines.push(`<span class="fl">${esc(def.flavor)}</span>`);
  return lines.join('<br>');
}

/** 効果文を偽る：毎回でたらめに（見た目だけ） */
const FAKE = ['倍率×100', '敵が全員帰る', '強さが半分になる', '宿銭を全部失う', '次の札がGodになる', '何も起きない', '番付が逆さになる', '全部2回ずつ'];
let fakeN = 0;
function scramble(text, uid) { fakeN += 1; return FAKE[(fakeN + uid.length) % FAKE.length]; }

/** 敵の行動予告（短い文字） */
export function intentText(env, e, B = null) {
  if (e.dead) return { text: '', calm: true };
  if (e.skip > 0) return { text: `動けない（${e.skip}）`, calm: true };
  const { name, arg } = e.intent;
  const mul = (e.charged ? 2 : 1) * (B?.mood ? (env.balance.moods?.[B.mood.id]?.atkMul ?? 1) : 1);
  switch (name) {
    case '攻め': { const d = Math.round(e.atk * (typeof arg === 'number' ? arg : 1) * mul); return { text: `攻め ${d}`, dmg: d }; }
    case '全体攻め': { const d = Math.round(e.atk * mul); return { text: `全体 ${d}`, dmg: d }; }
    case '居座り': return { text: `居座り ${Math.round((arg ?? 0) * 100)}%`, calm: true };
    case '伏せ': return { text: `伏せ ${arg}`, calm: true };
    case '封じ': {
      if (arg !== '最多カテゴリ') return { text: `封じ（${arg}）` };
      const c = B ? mostCategory(B, env) : null;
      const n = env.balance.hands.sealTurns ?? 1;
      return { text: c ? `封じ〈${c}〉${n > 1 ? `${n}T` : ''}` : '封じ（一番多いカテゴリ）', warn: true };
    }
    case '格下げ': return { text: `格下げ ${arg ?? 1}`, calm: true };
    case '呼ぶ': return { text: '呼ぶ', calm: true };
    case '溜め': return { text: '溜め', calm: true };
    default: return { text: name, calm: true };
  }
}

/** 敵の縛り（bind か、特注の説明） */
export function bindText(env, id) {
  const def = env.content.enemies?.[id];
  if (!def) return '';
  return def.bind ?? (def.custom ? env.content.vocab.get('enemy', def.custom)?.text ?? '' : '');
}

export function enemyTip(env, e, B = null) {
  const acts = e.acts.map((a) => (a.arg == null ? a.name : `${a.name} ${a.arg}`)).join(' → ');
  const def = env.content.vocab.get('act', e.intent.name);
  return [
    `<b>${esc(e.name)}</b>　<span class="q">${esc(e.kind)}・攻撃 ${e.atk}</span>`,
    e.hideClaim ? '主張 ？？？' : `主張 ${format(e.claim)}／${format(e.maxClaim)}`,
    e.line ? `<span class="fl">「${esc(e.line)}」</span>` : '',
    bindText(env, e.id) ? `<b>縛り</b>：${esc(bindText(env, e.id))}` : '',
    `次：${esc(intentText(env, e, B).text)}${def ? `<span class="q">（${esc(def.text)}）</span>` : ''}`,
    e.yield ? `<b>降参</b>：〈${esc(e.cat || '')}〉${esc(yieldText(env, e)?.text || '')}` : '',
    e.charged ? '溜めている（次の攻めが×2）' : '',
    `<span class="q">行動：${esc(acts)}</span>`,
    ...(env.content.enemies[e.id]?.kwList || []).map((k) => `<span class="q"><b>${esc(k.label)}</b>：${esc(k.text)}</span>`),
  ].filter(Boolean).join('<br>');
}

export const fmtNum = (x) => num(x);
export const fmtMul = (x) => formatMul(x);

/** コンボの効果の短い文 */
export function comboEffText(content, id) {
  const c = (content.comboList || []).find((x) => x.id === id);
  const e = c?.effect || {};
  return [e.S && `強さ＋${e.S}`, e.M && `倍率＋${e.M}`, e.xM && `倍率×${e.xM}`, e.xV && `論破値×${e.xV}`, e.zeni && `宿銭＋${e.zeni}`].filter(Boolean).join('・');
}
/** コンボが分かっているか（画面側で差し替える：宿の持ったことのある札＋いまの潜行の札） */
export const comboView = { known: () => true, rumor: () => false };
/** 札が入るコンボの説明行（相手の札の名前つき）。分かっていないコンボは出さない（噂なら「相方がいるらしい」） */
export function comboLines(content, cardId) {
  const ids = content.combosOf?.[cardId] || [];
  const out = [];
  if (ids.some((id) => !comboView.known(id) && comboView.rumor(id, cardId))) out.push('<span class="cmb">◎噂：この札には相方がいるらしい</span>');
  return out.concat(ids.filter((id) => comboView.known(id)).map((id) => {
    const c = content.comboList.find((x) => x.id === id);
    const others = c.need.filter((set) => !set.includes(cardId)).map((set) => [...new Set(set.map((i) => content.cards[i]?.name))].join('か'));
    return `<span class="cmb">◎コンボ「${esc(c.name)}」：＋${others.map(esc).join('＋')}　${esc(comboEffText(content, id))}</span>`;
  }));
}

/** 階の呼び方（本坑・テーマの穴＝B、床上＝F） */
export function floorName(content, dg, floor) { return `${content.dungeons?.[dg]?.prefix ?? 'B'}${floor}`; }

/* プロトコルチャーハン 戦闘エンジン (DOM非依存) */
(function (root) {
'use strict';

const G = { log: [], rand: Math.random, wanted: 0, bag: [], seep: {}, items: {}, credits: 0, loot: [] };
const rnd = () => G.rand();
const pct = p => rnd() * 100 < p;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function snapshot() {
  if (!G.units) return null;
  const us = {};
  G.units.forEach(u => { us[u.id] = { hp: u.hp, maxhp: u.maxhp, heat: u.heat, alive: u.alive, stun: u.stun, side: u.side, auto: !!u.auto, fw: u.fw, seen: u.seen || 0, st: Object.assign({}, u.st), ports: u.ports.map(p => ({ mem: p.mem, dur: p.dur, broken: p.broken })), intent: u.intent ? { label: u.intent.label, danger: !!u.intent.danger, tip: u.intent.tip || '' } : null }; });
  return { units: us, objs: (G.objs || []).map(o => !!o.used), credits: G.credits, turn: G.turn, seep: Object.assign({}, G.seep) };
}
function log(t, c, fx) { G.log.push({ t, c: c || '', turn: G.turn, aid: G.cur || null, fx: fx || null, snap: snapshot() }); }

/* ---------- メモリの種類 ---------- */
const MEM = {
  junk:    { name: 'ジャンクコード v0.9', skills: [['spike', 0], ['fork', 30]] },
  chahan:  { name: 'プロトコルチャーハン・クラックスピード', skills: [['bite', 0], ['parapara', 30]] },
  snipe:   { name: '静音射撃プロトコル', skills: [['portbreak', 0], ['headshot', 0], ['fatal', 30]] },
  cloak:   { name: '光学迷彩 Lite', skills: [['hide', 0]] },
  knight:  { name: '騎士道.exe', skills: [['cover', 0], ['lance', 0], ['nanori', 30]] },
  wok:     { name: '鉄鍋返し.wok', skills: [['wok', 0]] },
  adrenal: { name: '安物アドレナリン', skills: [['boost', 0]] },
  shock:   { name: '放電モジュール', skills: [['spark', 0], ['overvolt', 30]] },
  barrier: { name: '味覚遮断フィールド', skills: [['barrier', 0]] },
  laser:   { name: 'ミシュラン・レーザー', skills: [['laser', 0]] },
  eye:     { name: 'ソムリエの鑑定眼', skills: [['observe', 0], ['autoobs', 40]] },
  medic:   { name: '応急処置.med', skills: [['patch', 0], ['triage', 30]] },
  netrun:  { name: '侵入ツールキット', skills: [['breach', 0], ['worm', 30]] },
  armor:   { name: '装甲展開.arm', skills: [['plate', 0], ['bash', 30]] },
  dash:    { name: 'ニトロ・ペダル', skills: [['dash', 0], ['drift', 30]] },
  cleaver: { name: '中華包丁術', skills: [['chop', 0], ['mince', 30]] },
  serve:   { name: '配膳プロトコル', skills: [['serve', 0], ['turntable', 30]] },
  qa:      { name: '品質保証プロトコル', skills: [['recall', 0]] },
  knuckle: { name: '鉄拳ナックル', skills: [['jab', 0], ['uppercut', 30]] },
  smoke:   { name: '煙幕弾.pkg', skills: [['smoke', 0], ['vanish', 30]] },
  leech:   { name: '吸血コード', skills: [['drain', 0], ['feast', 30]] },
  baton:   { name: 'スタン警棒', skills: [['zap', 0]] },
  mirror:  { name: '鏡面装甲', skills: [['mirror', 0]] },
  hungry:  { name: '空腹ドライブ', skills: [['starve', 0]], peaky: '減っているHPが多いほど威力が上がる' },
  glass:   { name: 'ガラスの大砲', skills: [['cannon', 0]], peaky: '一撃で戦況を変えるが、撃つたびに自分も砕ける' },
  poem:    { name: '酔いどれ詩人.txt', skills: [['verse', 0]] },
  missile: { name: '多弾頭ミサイル.pod', skills: [['barrage', 0]] },
  saw:     { name: '回転ノコギリ.mod', skills: [['buzz', 0], ['grind', 30]] },
  steam:   { name: '蒸気噴射弁', skills: [['scald', 0], ['mist', 30]] },
  coupon:  { name: '割引クーポン.exe', skills: [['discount', 0], ['bogo', 30]] },
  weld:    { name: '溶接アーク', skills: [['arc', 0], ['rivet', 30]] },
  wokfire: { name: '朗々の火', skills: [['flamewok', 0], ['manhan', 30]] },
  /* ター宿でしか手に入らない特典メモリ */
  chiko:   { name: 'チコ◯ータ', skills: [['sodatsu', 0]] },
  namanama:{ name: '生生ハーム', skills: [['namaham', 0], ['namanama', 30]] },
  umehara: { name: 'ウメ◯ラ', skills: [['haisui', 0], ['yomi', 30]] },
  eoeo:    { name: 'EOとOE', skills: [['eoeo', 0]] },
  teishoku:{ name: '定食', skills: [['teishoku', 0]] },
  soutou:  { name: '相当老', skills: [['soutou', 0]] },
  /* 寄り道でしか行けない場所の一点物 */
  hoof:    { name: '蹄鉄ギャロップ', skills: [['gallop', 0]] },
  deepsea: { name: '深海圧', skills: [['pressure', 0]] },
  miren:   { name: '誰かの未練', skills: [['miren', 0]] },
  bank:    { name: 'バンク角45度', skills: [['sprint', 0]] },
  tastelab:{ name: '味覚再生試験体', skills: [['retaste', 0]] },
  kappa:   { name: '河童の皿', skills: [['sara', 0]] },
  drift:   { name: 'ドリフト走行', skills: [['drift', 0]] },
  mochi:   { name: '月の餅つき', skills: [['mochi', 0]] },
  hotaru:  { name: '閉店の音楽', skills: [['heiten', 0]] },
  ryusei:  { name: '屋台「流星」の暖簾', skills: [['ryusei', 0]] },
  tarkaku: { name: 'ター角コード', skills: [['kado', 0], ['kadokado', 30]] },
  innmap:  { name: '女将の館内図', skills: [['okami', 0]] },
  magnet:  { name: '磁力グローブ', skills: [['strip', 0], ['yank', 30]] },
  frost:   { name: '氷結スプレー.cool', skills: [['freeze', 0], ['blizzard', 30]] },
  decoy:   { name: 'ホロデコイ', skills: [['decoy', 0]] },
  charm:   { name: '誘惑香.prf', skills: [['charm', 0]] },
  anthem:  { name: '海賊放送.fm', skills: [['anthem', 0]] },
  hashi:   { name: '八卦箸術', skills: [['hashi', 0]] },
  lowg:    { name: '月面重力.low', skills: [['float', 0], ['moonwalk', 30]] },
  steep:   { name: '三分間待機.cup', skills: [['steep', 0]] },
  keyring: { name: 'ジローの鍵束', skills: [['pick', 0]] },
  blackfriday: { name: 'ブラックフライデー', skills: [['bfsale', 0]] },
  escalator: { name: '下りエスカレーター', skills: [['descend', 0]] },
  markdown: { name: '値札貼り替え', skills: [['markdown', 0]] },
  clearance: { name: '在庫一掃セール', skills: [['clearance', 0]] },
  giftwrap: { name: 'ギフトラッピング', skills: [['wrap', 0]] },
  pointcard: { name: 'ポイント十倍カード', skills: [['points', 0]], peaky: 'パッシブ。挿しているあいだ、パーティー全員の経験値が1.5倍' },
  lostfound: { name: '落とし物センター', skills: [['lostfound', 0]], peaky: 'パッシブ。挿しているあいだ、★レア個体が出やすくなる' },
  restock: { name: '無限在庫', skills: [['restock', 0]] },
  gastro:  { name: '美食演算コア', skills: [['tasting', 0], ['garnish', 0]] },
  banquet: { name: '満漢全席.sys', skills: [['feast108', 0]] },
  tongue:  { name: '舌部最適化プロトコル', skills: [['optimize', 0]] },
  thunder: { name: '雷公.ko', skills: [['thunder', 0], ['storm', 30]], made: true },
  ocsys:   { name: 'オーバークロック.sys', skills: [['oc', 0], ['meltdown', 30]], made: true },
  brawl:   { name: '喧嘩殺法.bat', skills: [['rush', 0], ['kidney', 30]], made: true },
  reaper:  { name: '死神の囁き', skills: [['execute', 0], ['hide', 30]], made: true, hidden: true },
  medarmor: { name: '野戦病院.arm', skills: [['patch', 0], ['plate', 0], ['triage', 30]], made: true },
  vampdoc: { name: '闇医者.med', skills: [['drain', 0], ['patch', 0], ['feast', 30]], made: true },
  lastsupper: { name: '最後の晩餐', skills: [['starve', 0], ['cannon', 0]], made: true, hidden: true },
  fortress: { name: '城塞騎士.exe', skills: [['cover', 0], ['plate', 0], ['nanori', 30]], made: true, hidden: true },
};
/* 合成で追加効果の枠が余ったとき、種類ごとに決まった効果で埋める(乱数なし) */
const AFF = {
  junk: [['tec', 3], ['cool', -10], ['seep', 20]], chahan: [['spd', 2], ['atk', 3]], snipe: [['atk', 3], ['spd', 1], ['pow', 8]], cloak: [['spd', 2], ['def', 2], ['cool', -10]],
  knight: [['def', 3], ['hp', 15], ['atk', 2]], wok: [['atk', 3], ['hp', 15]], adrenal: [['atk', 3], ['spd', 1], ['hp', 10]], shock: [['tec', 4], ['pow', 8], ['cool', -10]],
  barrier: [['def', 3], ['hp', 15]], laser: [['pow', 12], ['tec', 4]], eye: [['tec', 4], ['seep', 35]],
  medic: [['tec', 4], ['hp', 15], ['cool', -10]], netrun: [['tec', 6], ['cool', -15]], armor: [['def', 4], ['hp', 25]], dash: [['spd', 3], ['atk', 3]],
  saw: [['atk', 3], ['pow', 8]], steam: [['tec', 4], ['cool', -15]], coupon: [['tec', 3], ['spd', 2]], weld: [['atk', 3], ['def', 3], ['hp', 15]], wokfire: [['tec', 6], ['pow', 12], ['hp', 15]],
  magnet: [['tec', 4], ['spd', 2]], frost: [['tec', 4], ['cool', -15]], decoy: [['def', 3], ['spd', 2]], charm: [['tec', 4], ['seep', 20]], anthem: [['hp', 15], ['cool', -10]],
  hashi: [['atk', 3], ['spd', 2], ['pow', 8]], lowg: [['spd', 3], ['def', 2]], steep: [['hp', 15], ['tec', 3]], keyring: [['tec', 6], ['spd', 3], ['seep', 35]],
  blackfriday: [['tec', 6], ['pow', 12]], escalator: [['spd', 3], ['tec', 4]], markdown: [['tec', 6], ['atk', 3]], clearance: [['atk', 4], ['pow', 12]], giftwrap: [['def', 4], ['hp', 25]], pointcard: [['seep', 50], ['tec', 4]], lostfound: [['tec', 6], ['spd', 2]], restock: [['hp', 25], ['tec', 4]],
  gastro: [['tec', 6], ['pow', 18]], banquet: [['atk', 4], ['pow', 18], ['hp', 25]], tongue: [['tec', 6], ['seep', 50]],
  cleaver: [['atk', 4], ['pow', 8]], knuckle: [['atk', 3], ['spd', 1]], smoke: [['spd', 2], ['cool', -10]], leech: [['tec', 4], ['hp', 15]], baton: [['tec', 3], ['atk', 2]],
  mirror: [['def', 4], ['hp', 15]], hungry: [['atk', 4], ['spd', 2]], glass: [['pow', 18], ['atk', 4]], poem: [['tec', 4], ['seep', 35]], missile: [['pow', 12], ['tec', 4]], serve: [['def', 2], ['tec', 4], ['hp', 15]], qa: [['tec', 6], ['def', 4]],
  vampdoc: [['tec', 4], ['hp', 15]], lastsupper: [['atk', 4], ['pow', 18], ['wild', 1]],
  medarmor: [['def', 3], ['hp', 25], ['tec', 4]], fortress: [['def', 4], ['hp', 25], ['atk', 3]],
  thunder: [['tec', 4], ['pow', 12], ['cool', -15]], ocsys: [['spd', 2], ['cool', -15], ['atk', 3]], brawl: [['atk', 3], ['hp', 15], ['def', 2]], reaper: [['atk', 4], ['spd', 2], ['pow', 12]],
};
/* 合成レシピ(順不同)。同じ種類どうしはレアリティが1段上がる */
const RECIPE = { 'junk+shock': 'thunder', 'adrenal+shock': 'ocsys', 'adrenal+junk': 'brawl', 'cloak+snipe': 'reaper', 'armor+medic': 'medarmor', 'netrun+shock': 'thunder', 'armor+knight': 'fortress', 'knuckle+adrenal': 'brawl', 'leech+medic': 'vampdoc', 'mirror+armor': 'fortress', 'glass+hungry': 'lastsupper', 'saw+weld': 'brawl', 'steam+shock': 'thunder', 'coupon+netrun': 'ocsys', 'frost+shock': 'thunder', 'decoy+smoke': 'reaper', 'hashi+cleaver': 'brawl', 'anthem+steep': 'vampdoc', 'charm+tongue': 'lastsupper' };
const recipeOf = (a, b) => a === b ? a : RECIPE[[a, b].sort().join('+')] || null;
function synthPreview(A, B) {
  if (isEvent(A) || isEvent(B)) return null;
  if (!A || !B || A.rar >= 4 || B.rar >= 4) return null;
  const type = recipeOf(A.type, B.type);
  if (!type) return null;
  const rar = A.type === B.type ? Math.min(3, Math.max(A.rar, B.rar) + 1) : Math.max(A.rar, B.rar);
  const pool = {};
  A.afx.concat(B.afx).forEach(a => { if (!pool[a.k] || Math.abs(a.v) > Math.abs(pool[a.k].v)) pool[a.k] = a; });
  return { type, rar, slots: RAR[rar].afx, pool: Object.values(pool), cost: 3 + 3 * rar };
}
function synthFill(type, chosen, slots) {
  const out = chosen.slice(0, slots);
  (AFF[type] || []).forEach(([k, v]) => { if (out.length < slots && !out.some(a => a.k === k)) out.push({ k, v }); });
  return out;
}

/* ---------- ブランドとセット効果(同じブランドを2本以上挿すと発動、3本で倍) ---------- */
const BRAND = {};
const BRANDS = {
  mankan: { n: 'マンカン社製', bonus: { def: 5, hp: 30 }, types: ['armor', 'medic', 'qa', 'netrun', 'baton', 'mirror', 'barrier', 'laser', 'tongue', 'banquet', 'gastro', 'missile'] },
  roro: { n: '朗々', bonus: { tec: 5, cool: -10 }, types: ['chahan', 'wok', 'wokfire', 'serve', 'cleaver', 'hashi', 'eye'] },
  yami: { n: '闇市', bonus: { atk: 4, spd: 2 }, types: ['junk', 'adrenal', 'knuckle', 'smoke', 'leech', 'glass', 'hungry', 'charm', 'magnet', 'keyring'] },
  mil: { n: '軍用', bonus: { pow: 10, atk: 2 }, types: ['snipe', 'cloak', 'shock', 'frost', 'decoy', 'dash'] },
  craft: { n: '職人', bonus: { def: 3, atk: 3 }, types: ['weld', 'saw', 'steam', 'knight', 'anthem', 'poem'] },
  luna: { n: '月面', bonus: { spd: 3, seep: 30 }, types: ['lowg', 'steep'] },
  taa: { n: 'ター宿', bonus: { tec: 4, atk: 3, hp: 20 }, types: ['chiko', 'namanama', 'umehara', 'eoeo', 'teishoku', 'soutou', 'tarkaku', 'innmap'] },
  yorimichi: { n: '寄り道', bonus: { spd: 2, hp: 25, def: 2 }, types: ['hoof', 'deepsea', 'miren', 'bank', 'tastelab', 'kappa', 'drift', 'mochi', 'hotaru', 'ryusei'] },
  mall: { n: 'メガモール', bonus: { tec: 4, spd: 2, hp: 20 }, types: ['coupon', 'blackfriday', 'escalator', 'markdown', 'clearance', 'giftwrap', 'pointcard', 'lostfound', 'restock'] },
};
Object.entries(BRANDS).forEach(([b, d]) => d.types.forEach(t => { BRAND[t] = b; }));
function setBonus(u) {
  const cnt = {}, out = {};
  u.ports.forEach(p => { if (p.inst && BRAND[p.inst.type]) cnt[BRAND[p.inst.type]] = (cnt[BRAND[p.inst.type]] || 0) + 1; });
  (u.fixed || []).forEach(i => { if (BRAND[i.type]) cnt[BRAND[i.type]] = (cnt[BRAND[i.type]] || 0) + 1; });
  Object.entries(cnt).forEach(([b, n]) => { if (n >= 2) Object.entries(BRANDS[b].bonus).forEach(([k, v]) => { out[k] = (out[k] || 0) + v * (n >= 3 ? 2 : 1); }); });
  u.sets = Object.entries(cnt).filter(([b, n]) => n >= 2).map(([b, n]) => ({ b, n }));
  return out;
}
const setText = b => Object.entries(BRANDS[b].bonus).map(([k, v]) => afxText({ k, v })).join('、');

/* ---------- レアリティと追加効果 ---------- */
const RAR = [{ n: '量産品', afx: 0, sell: 15, parts: 1 }, { n: '改造品', afx: 1, sell: 40, parts: 2 }, { n: '特注品', afx: 2, sell: 100, parts: 4 }, { n: '禁制品', afx: 3, sell: 250, parts: 8 }, { n: '一点物', afx: 4, sell: 0, parts: 0 }];
const AFX = {
  atk: { n: '攻撃', vals: [2, 3, 4] }, def: { n: '防御', vals: [2, 3, 4] }, tec: { n: '技術', vals: [3, 4, 6] }, spd: { n: '速度', vals: [1, 2, 3] }, hp: { n: '最大HP', vals: [10, 15, 25] },
  cool: { n: '技の熱', vals: [-10, -15, -20], pct: true }, seep: { n: '浸透速度', vals: [20, 35, 50], pct: true }, pow: { n: '技の威力', vals: [8, 12, 18], pct: true },
  wild: { n: '暴走', peaky: '攻撃+8、毎ターン熱+5', vals: [1] },
};
const afxText = a => AFX[a.k].peaky ? `${AFX[a.k].n}(${AFX[a.k].peaky})` : `${AFX[a.k].n}${a.v > 0 ? '+' : ''}${a.v}${AFX[a.k].pct ? '%' : ''}`;
function rollRar() {
  const w = G.wanted || 0, r = rnd() * 100;
  if (r < 4 + 1.5 * w) return 3;
  if (r < 14 + 3.5 * w) return 2;
  if (r < 40 + 3.5 * w) return 1;
  return 0;
}
function rollAfx(rar) {
  const keys = Object.keys(AFX), out = [];
  while (out.length < RAR[rar].afx) {
    const k = keys[Math.floor(rnd() * keys.length)];
    if (out.some(a => a.k === k)) continue;
    const vs = AFX[k].vals; out.push({ k, v: vs[Math.floor(rnd() * vs.length)] });
  }
  return out;
}
function mkInst(type, rar, afx, known) {
  if (rar == null) rar = rollRar();
  return { uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), type, rar, afx: afx || rollAfx(rar), known: !!known };
}
const instName = i => MEM[i.type].name;

const SK = {
  spike: { name: 'スパイクパケット', heat: 20, tgt: 'enemy', desc: '電撃・単体。技術依存。濡れた相手に2倍+スタン',
    fn(a, t) { strike(a, t, 18 + a.tec * 1.6, { type: 'elec' }); } },
  fork: { name: 'フォークボム', heat: 35, tgt: 'all', desc: '電撃・敵全体',
    fn(a) { foes(a).forEach(t => damage(a, t, 10 + a.tec * 1.1, { type: 'elec', noCombo: true })); } },
  bite: { name: '一口キメる', heat: 40, tgt: 'self', desc: 'チャーハンの実感。3ターン速度2倍・攻撃1.5倍、HP小回復。熱い',
    fn(a) { a.st.high = 4; heal(a, 25); log(`　${a.name}は「ぶっ飛び」状態になった`, 'buff'); } },
  parapara: { name: 'パラパラ乱舞', heat: 30, tgt: 'all', desc: '物理・ランダムな敵に3連撃',
    fn(a) { for (let i = 0; i < 3; i++) { const f = foes(a); if (!f.length) break; damage(a, f[Math.floor(rnd() * f.length)], effAtk(a) * 1.4, { noCombo: i > 0 }); } } },
  portbreak: { name: 'ポートブレイカー', heat: 20, tgt: 'port', desc: 'ポートを必中で撃ち抜く。耐久に大ダメージ',
    fn(a, t, pi) { hitPort(a, t, pi, effAtk(a) * 3, true); } },
  headshot: { name: 'ヘッドショット', heat: 30, tgt: 'enemy', desc: '物理・単体・高威力。命中70%(潜伏後は必中)',
    fn(a, t) { strike(a, t, effAtk(a) * 3.2, { hit: a.st.ambush ? 100 : 70 }); } },
  fatal: { name: '致命の一刺し', heat: 25, tgt: 'enemy', desc: '物理・単体。HP半分以下の相手に2倍',
    fn(a, t) { strike(a, t, effAtk(a) * 2.2 * (t.hp <= t.maxhp / 2 ? 2 : 1), {}); } },
  hide: { name: '潜伏', heat: 10, tgt: 'self', prio: 2, desc: 'このターン狙われない。次の攻撃が1.5倍',
    fn(a) { a.st.hidden = 1; a.st.ambush = 2; log(`　${a.name}の姿が消えた`, 'buff'); } },
  cover: { name: 'かばう', heat: 10, tgt: 'self', prio: 2, desc: 'このターン、味方への単体攻撃を引き受ける(被ダメ-30%)',
    fn(a) { a.st.kcover = 1; log(`　${a.name}は盾を構えて前に出た`, 'buff'); } },
  lance: { name: 'ランスチャージ', heat: 25, tgt: 'enemy', desc: '物理・単体・大威力',
    fn(a, t) { strike(a, t, effAtk(a) * 2.8, {}); } },
  nanori: { name: '名乗り', heat: 20, tgt: 'self', prio: 2, desc: '敵全員を2ターン自分に引きつけ、被ダメ-30%',
    fn(a) { foes(a).forEach(e => { e.st.taunt = 2; e.tauntBy = a.id; }); a.st.fort = 2; log(`　「我こそは!」敵の視線が${a.name}に集まる`, 'buff'); } },
  wok: { name: '鉄鍋返し', heat: 50, tgt: 'all', desc: '物理・敵全体・大威力。かなり熱い',
    fn(a) { foes(a).forEach(t => damage(a, t, effAtk(a) * 2.6, { noCombo: true, fx: 'blunt' })); } },
  boost: { name: 'ブースト', heat: 15, tgt: 'self', desc: '3ターン攻撃1.5倍',
    fn(a) { a.st.boost = 3; log(`　${a.name}の攻撃力が上がった`, 'buff'); } },
  spark: { name: 'スパーク', heat: 15, tgt: 'enemy', desc: '電撃・単体。濡れた相手に2倍+スタン',
    fn(a, t) { strike(a, t, 14 + a.tec * 1.2 + (a.side === 'enemy' ? a.atk : 0), { type: 'elec' }); } },
  overvolt: { name: 'オーバーボルト', heat: 30, tgt: 'all', desc: '電撃・敵全体・小威力',
    fn(a) { foes(a).forEach(t => damage(a, t, 8 + a.tec * 0.8, { type: 'elec', noCombo: true })); } },
  barrier: { name: '味覚遮断', heat: 20, tgt: 'self', desc: '3ターン被ダメージ半減',
    fn(a) { a.st.barrier = 3; log(`　${a.name}は味覚遮断フィールドを展開した`, 'buff'); } },
  observe: { name: '観察', heat: 0, tgt: 'enemy', prio: 1, desc: '敵1体の弱点・有効な戦術・能力値を見抜く。他の行動より先に動く',
    fn(a, t) { doObserve(a, t, obsLevel(a)); } },
  /* 野良犬シューマイだけの行動(レベルで覚える) */
  howl: { name: '遠吠え', heat: 15, tgt: 'all', dog: 1, desc: '敵全体を怯ませる。生き物は55%で1回休み(ボスは20%)、機械は1ターン照準撹乱',
    fn(a) { foes(a).forEach(t => { if (MECH.includes(t.kind)) { t.st.jam = Math.max(t.st.jam || 0, 1); log(`　${t.name}のセンサーが吠え声に乱れた`, 'buff', { tid: t.id, note: '撹乱' }); } else if (pct(t.boss ? 20 : 55)) { t.stun = Math.max(t.stun, 1); log(`　${t.name}は怯んで足が止まった`, 'crash', { tid: t.id, note: '怯み' }); } else log(`　${t.name}は怯まなかった`, 'miss'); }); } },
  fetch: { name: 'くわえて奪う', heat: 10, tgt: 'port', dog: 1, desc: 'メモリを牙でくわえて奪う。成功率は引っこ抜きより高く(速度依存)、失敗しても反撃されない',
    fn(a, t, pi) { const p = t.ports[pi]; if (!p || !p.mem) { log('　くわえるメモリが無い', 'miss'); return; } if (pct(fetchChance(a, t, pi))) takeMem(a, t, pi); else log('　くわえ損ねた。シューマイは素早く飛び退いた', 'miss'); } },
  sniff: { name: '嗅ぎ回る', heat: 0, tgt: 'self', prio: 1, dog: 1, desc: '敵全員をにおいで調べる(解析Lv1)。戦闘ごとに一度、物陰から道具を嗅ぎ当てる。先に動く',
    fn(a) { foes(a).forEach(t => doObserve(a, t, 1, true)); if (!G.sniffed) { G.sniffed = 1; const r = rnd(), k = r < 0.5 ? 'gel' : r < 0.8 ? 'coolant' : 'emp'; G.items[k] = (G.items[k] || 0) + 1; log(`　物陰から${ITEM[k]}を嗅ぎ当てて、くわえてきた!`, 'seep'); } else log('　もう、めぼしいにおいは無い', 'miss'); } },
  guard: { name: '番犬', heat: 5, tgt: 'ally', prio: 2, dog: 1, desc: 'このターン、選んだ味方への単体攻撃を代わりに受け(被ダメ-20%)、攻撃してきた相手に噛みつき返す。最優先',
    fn(a, t) { if (!t || !t.alive || t === a) { log('　守る相手がいない', 'miss'); return; } a.st.dogguard = 1; a.dogFor = t.id; log(`　${a.name}は${t.name}の前で低く唸った`, 'buff'); } },
  pack: { name: '野良の群れ', heat: 35, tgt: 'all', dog: 1, desc: '街じゅうの野良犬を呼ぶ。ランダムな敵に5回噛みつく(物理)',
    fn(a) { log('　路地という路地から、犬たちが駆けてきた', 'buff'); for (let i = 0; i < 5; i++) { const f = foes(a); if (!f.length) break; damage(a, f[Math.floor(rnd() * f.length)], effAtk(a) * 0.9, { noCombo: i > 0, fx: 'slash' }); } } },
  lastbone: { name: '最後の骨', heat: 0, tgt: 'self', passive: true, dog: 1, desc: 'パッシブ。戦闘ごとに一度、倒れるはずの攻撃をHP1で踏みとどまる', fn() {} },
  autoobs: { name: '自動観察', heat: 0, tgt: 'self', passive: true, desc: 'パッシブ。戦闘開始時に、ターンを使わず敵全員を観察する。深さは浸透度40%でLv1、70%でLv2、100%でLv3', fn() {} },
  patch: { name: '応急処置', heat: 25, tgt: 'ally', desc: '味方1人のHPを回復(技術依存)',
    fn(a, t) { if (t && t.alive) heal(t, Math.round(24 + a.tec * 1.2)); } },
  triage: { name: 'トリアージ', heat: 30, tgt: 'self', desc: '味方全員のHPを回復(技術依存)',
    fn(a) { all().filter(u => u.side === a.side).forEach(u => heal(u, Math.round(16 + a.tec * 0.6))); } },
  breach: { name: 'ブリーチ', heat: 15, tgt: 'enemy', desc: '敵1体の防壁-25、2ターン照準撹乱(必中)',
    fn(a, t) { t.fw = Math.max(0, t.fw - 25); t.st.jam = 2; log(`　${t.name}の防壁を破り、照準を狂わせた`, 'buff', { tid: t.id, note: '侵入' }); } },
  worm: { name: 'ワーム散布', heat: 30, tgt: 'all', desc: '敵全体の防壁-10、1ターン照準撹乱',
    fn(a) { foes(a).forEach(t => { t.fw = Math.max(0, t.fw - 10); t.st.jam = Math.max(t.st.jam || 0, 1); }); log('　ワームが敵のオーグメントに広がった', 'buff'); } },
  plate: { name: '装甲展開', heat: 15, tgt: 'self', prio: 2, desc: '3ターン被ダメージ-40%。最優先で発動',
    fn(a) { a.st.plate = 3; log(`　${a.name}の装甲板が展開した`, 'buff'); } },
  bash: { name: 'シールドバッシュ', heat: 20, tgt: 'enemy', desc: '物理・単体。相手を2ターン自分に引きつける',
    fn(a, t) { if (strike(a, t, effAtk(a) * 1.4, {}) && t.alive) { t.st.taunt = 2; t.tauntBy = a.id; } } },
  dash: { name: '先回り', heat: 15, tgt: 'enemy', prio: 2, desc: '物理・単体。最優先で発動する',
    fn(a, t) { strike(a, t, effAtk(a) * 1.6, {}); } },
  drift: { name: 'ドリフト', heat: 30, tgt: 'all', desc: '物理・敵全体。50%で照準撹乱',
    fn(a) { foes(a).forEach(t => { damage(a, t, effAtk(a) * 1.0, { noCombo: true }); if (t.alive && pct(50)) t.st.jam = Math.max(t.st.jam || 0, 1); }); } },
  chop: { name: '叩き切り', heat: 20, tgt: 'enemy', desc: '物理・単体・高威力',
    fn(a, t) { strike(a, t, effAtk(a) * 2.2, { fx: 'slash' }); } },
  mince: { name: 'みじん切り', heat: 35, tgt: 'enemy', desc: '物理・単体に3連撃',
    fn(a, t) { for (let i = 0; i < 3 && t.alive; i++) strike(a, t, effAtk(a) * 1.0, { fx: 'slash' }); } },
  serve: { name: 'お冷やをどうぞ', heat: 5, tgt: 'ally', prio: 1, desc: '味方1人のHPを少し回復し、熱-30。先に動く',
    fn(a, t) { if (!t || !t.alive) return; t.heat = Math.max(0, t.heat - 30); log(`　${t.name}の熱が下がった`, 'buff'); heal(t, Math.round(14 + a.tec * 0.6)); } },
  turntable: { name: '回転テーブル', heat: 25, tgt: 'self', desc: '味方全員の熱-25、HPを少し回復',
    fn(a) { all().filter(u => u.side === a.side).forEach(u => { u.heat = Math.max(0, u.heat - 25); heal(u, 12); }); log('　卓がくるりと回った', 'buff'); } },
  recall: { name: 'リコール', heat: 25, tgt: 'port', desc: 'メモリを「製品回収」する。75%で相手のメモリを奪う(露出していれば必ず)',
    fn(a, t, pi) {
      if (a.side === 'enemy') {
        const ps = t.ports.map((p, i) => [p, i]).filter(([p]) => p.inst);
        if (!ps.length) { log('　回収できるメモリが無かった', 'miss'); return; }
        const [p] = ps.find(([p]) => p.mem === 'chahan') || ps[Math.floor(rnd() * ps.length)];
        if (!pct(hitChance(a, 80))) { log(`　${t.name}は回収の手をかわした`, 'miss', { tid: t.id, miss: true }); return; }
        a.taken = a.taken || []; p.inst._from = { uid: t.id, pi: t.ports.indexOf(p) }; a.taken.push(p.inst);
        log(`　${t.name}の「${MEM[p.mem].name}」が回収された! (${a.name}を倒せば取り戻せる)`, 'crash', { tid: t.id, note: '回収された' });
        p.mem = null; p.inst = null; recompute(t);
      } else {
        const p = t.ports[pi];
        if (!p || !p.mem) { log('　回収できるメモリが無かった', 'miss'); return; }
        if (p.broken || pct(75)) {
          const inst = p.inst; p.mem = null; p.inst = null; if (inst.type === 'barrier') delete t.st.barrier;
          inst.known = true; G.bag.push(inst); G.loot.push(inst);
          log(`　「${MEM[inst.type].name}」を回収した!`, 'seep', { tid: t.id, note: '回収' });
          log(`　鑑定: ${RAR[inst.rar].n}${inst.afx.length ? ' / ' + inst.afx.map(afxText).join('、') : ' / 追加効果なし'}`, 'rar' + inst.rar);
        } else log('　回収に失敗した', 'miss');
      }
    } },
  jab: { name: 'ジャブ', heat: 10, tgt: 'enemy', prio: 1, desc: '物理・単体・小威力。先に動く',
    fn(a, t) { strike(a, t, effAtk(a) * 1.2, { fx: 'blunt' }); } },
  uppercut: { name: 'アッパーカット', heat: 30, tgt: 'enemy', desc: '物理・単体・大威力。30%でスタン(ボスは10%)',
    fn(a, t) { if (strike(a, t, effAtk(a) * 2.4, { fx: 'blunt' }) && t.alive && pct(t.boss ? 10 : 30)) { t.stun = Math.max(t.stun, 1); log(`　${t.name}はのけぞった`, 'crash'); } } },
  smoke: { name: '煙幕', heat: 15, tgt: 'all', prio: 2, desc: '敵全体を1ターン照準撹乱(命中-50%)。最優先で発動',
    fn(a) { foes(a).forEach(t => { t.st.jam = Math.max(t.st.jam || 0, 1); }); log('　煙が視界を塞いだ', 'buff'); } },
  vanish: { name: '雲隠れ', heat: 15, tgt: 'self', prio: 2, desc: 'このターン狙われず、次の攻撃が1.5倍',
    fn(a) { a.st.hidden = 1; a.st.ambush = 2; log(`　${a.name}は煙に紛れた`, 'buff'); } },
  drain: { name: 'ドレイン', heat: 20, tgt: 'enemy', desc: '電撃・単体。与えたダメージの半分を回復',
    fn(a, t) { const b = t.hp; strike(a, t, 12 + a.tec * 1.4, { type: 'elec' }); const d = b - Math.max(0, t.hp); if (d > 0) heal(a, Math.round(d / 2)); } },
  feast: { name: '宴', heat: 35, tgt: 'all', desc: '電撃・敵全体。与えたダメージの3分の1を回復',
    fn(a) { let sum = 0; foes(a).forEach(t => { const b = t.hp; damage(a, t, 8 + a.tec * 0.8, { type: 'elec', noCombo: true }); sum += b - Math.max(0, t.hp); }); if (sum > 0) heal(a, Math.round(sum / 3)); } },
  zap: { name: '電撃殴打', heat: 20, tgt: 'enemy', desc: '電撃・単体。35%でスタン(ボスは10%)',
    fn(a, t) { if (strike(a, t, effAtk(a) * 1.5 + (a.side === 'ally' ? a.tec * 0.5 : 0), { type: 'elec' }) && t.alive && pct(t.boss ? 10 : 35)) { t.stun = Math.max(t.stun, 1); log(`　${t.name}は痺れて動けない`, 'crash'); } } },
  mirror: { name: '鏡面反射', heat: 20, tgt: 'self', prio: 2, desc: 'このターン、自分への単体攻撃を1回だけ相手に跳ね返す。最優先で発動',
    fn(a) { a.st.mirror = 1; log(`　${a.name}の装甲が鏡のように光った`, 'buff'); } },
  starve: { name: '飢餓衝動', heat: 25, tgt: 'enemy', desc: '物理・単体。減っているHPが多いほど威力が上がる(最大3倍)',
    fn(a, t) { strike(a, t, effAtk(a) * 1.4 * (1 + 2 * (1 - a.hp / a.maxhp)), {}); } },
  cannon: { name: '砲撃', heat: 60, tgt: 'enemy', desc: '単体・防御無視の超威力。撃つと自分の最大HPの25%を失う',
    fn(a, t) { strike(a, t, effAtk(a) * 5, { pierce: true, fx: 'beam' }); const d = Math.round(a.maxhp * 0.25); a.hp = Math.max(1, a.hp - d); log(`　反動で${a.name}の体が軋んだ(${d}ダメージ)`, a.side === 'ally' ? 'hurt' : 'hit', { tid: a.id, dmg: d, k: 'blunt' }); } },
  verse: { name: '即興詩', heat: 20, tgt: 'all', desc: '敵全体を2ターン自分に引きつけて熱+20。味方全員のHPを少し回復',
    fn(a) { foes(a).forEach(t => { t.st.taunt = 2; t.tauntBy = a.id; addHeat(t, 20); }); log(`　「月は、冷めたチャーハンの皿である」`, 'buff'); all().filter(u => u.side === a.side).forEach(u => heal(u, 10)); } },
  barrage: { name: '多弾頭ミサイル', heat: 40, tgt: 'all', desc: '敵全体に炎の大ダメージ',
    fn(a) { foes(a).forEach(t => damage(a, t, effAtk(a) * 1.7, { type: 'fire', noCombo: true })); } },
  buzz: { name: '回転斬り', heat: 20, tgt: 'enemy', desc: '物理・単体に2連撃(斬撃)',
    fn(a, t) { for (let i = 0; i < 2 && t.alive; i++) strike(a, t, effAtk(a) * 1.25, { fx: 'slash' }); } },
  grind: { name: '研削', heat: 35, tgt: 'all', desc: '物理・敵全体(斬撃)',
    fn(a) { foes(a).forEach(t => damage(a, t, effAtk(a) * 1.3, { fx: 'slash', noCombo: true })); } },
  scald: { name: '熱湯噴射', heat: 25, tgt: 'all', desc: '敵全体に炎のダメージ+熱+20',
    fn(a) { foes(a).forEach(t => { damage(a, t, 10 + (a.side === 'ally' ? a.tec : a.atk) * 0.9, { type: 'fire', noCombo: true }); addHeat(t, 20); }); } },
  mist: { name: '湯けむり', heat: 20, tgt: 'all', prio: 2, desc: '敵全体を2ターン照準撹乱。最優先で発動',
    fn(a) { foes(a).forEach(t => { t.st.jam = Math.max(t.st.jam || 0, 2); }); log('　湯けむりが視界を覆った', 'buff'); } },
  discount: { name: '値引き交渉', heat: 15, tgt: 'enemy', desc: '敵1体を3ターン「脆化」させる(防御低下・被ダメージ1.2倍)',
    fn(a, t) { t.st.brittle = 3; log(`　${t.name}の装甲が「半額」になった`, 'buff', { tid: t.id, note: '脆化' }); } },
  bogo: { name: 'ひとつ買えばもうひとつ', heat: 25, tgt: 'enemy', desc: '物理・単体。同じ攻撃をもう一度、無料で',
    fn(a, t) { strike(a, t, effAtk(a) * 1.5, {}); if (t.alive) { log('　もうひとつ、無料!', 'combo'); strike(a, t, effAtk(a) * 1.5, {}); } } },
  arc: { name: 'アーク溶接', heat: 20, tgt: 'enemy', desc: '炎・単体の大ダメージ+熱+25',
    fn(a, t) { if (strike(a, t, effAtk(a) * 1.9, { type: 'fire' }) && t.alive) addHeat(t, 25); } },
  rivet: { name: 'リベット打ち', heat: 20, tgt: 'ally', desc: '味方1人に3ターン装甲を打ち付ける(被ダメージ-40%)',
    fn(a, t) { if (t && t.alive) { t.st.plate = 3; log(`　${t.name}に装甲板がリベット留めされた`, 'buff'); } } },
  flamewok: { name: '火柱鍋返し', heat: 30, tgt: 'all', desc: '炎・敵全体。技術依存の大ダメージ',
    fn(a) { foes(a).forEach(t => damage(a, t, 14 + a.tec * 1.5, { type: 'fire', noCombo: true })); } },
  sodatsu: { name: '育つ', heat: 15, tgt: 'enemy', desc: '物理。使うたびに威力が倍になる(0.5倍→1→2→4→8倍。戦闘ごとに最初から)',
    fn(a, t) { const n = Math.min(4, a._chiko || 0); a._chiko = (a._chiko || 0) + 1; if (n >= 3) log('　チコ◯ータが、相当育っている', 'crash'); strike(a, t, effAtk(a) * 0.5 * Math.pow(2, n), { fx: 'slash' }); } },
  namaham: { name: '生ハームを配る', heat: 10, tgt: 'ally', desc: '味方1人のHPを回復し、熱を15下げる',
    fn(a, t) { if (!t || !t.alive) return; heal(t, Math.round(25 + a.tec * 1.2)); t.heat = Math.max(0, t.heat - 15); } },
  namanama: { name: 'さらに生', heat: 35, tgt: 'self', desc: '味方全員のHPを大きく回復し、2ターン被ダメージ半減',
    fn(a) { log('　生ハームより、さらに生', 'buff'); all().filter(u => u.side === a.side && u.alive).forEach(u => { heal(u, Math.round(30 + a.tec * 1.2)); u.st.barrier = Math.max(u.st.barrier || 0, 2); }); } },
  haisui: { name: '背水の逆転', heat: 30, tgt: 'enemy', desc: '物理。自分のHPが減っているほど強い(2倍〜最大7倍)',
    fn(a, t) { const lost = 1 - a.hp / a.maxhp; if (lost > 0.6) log('　ここから、逆転する', 'crash'); strike(a, t, effAtk(a) * (2 + lost * 5.5), { fx: 'blunt' }); } },
  yomi: { name: '読み', heat: 10, tgt: 'self', prio: 2, desc: 'このターン被ダメージ半減。次の攻撃が1.5倍。最優先',
    fn(a) { a.st.barrier = Math.max(a.st.barrier || 0, 1); a.st.ambush = 2; log(`　${a.name}は、相手の次の一手を読んだ`, 'buff'); } },
  eoeo: { name: 'EOEO', heat: 25, tgt: 'enemy', desc: '物理の2連撃。10%の確率で、なぜか10倍になる',
    fn(a, t) { const x = pct(10) ? 10 : 1; if (x > 1) log('　「EO」「OE」。並んだ。10倍になった。理由は聞かないでほしい', 'crash'); for (let i = 0; i < 2 && t.alive; i++) damage(a, t, effAtk(a) * 1.2 * x, { noCombo: i > 0, fx: 'blunt' }); } },
  teishoku: { name: '定食が揃う', heat: 40, tgt: 'self', desc: '主菜・小鉢・汁物・漬物。味方全員のHPを回復し、3ターン攻撃1.5倍',
    fn(a) { log('　定食として、完成した', 'buff'); all().filter(u => u.side === a.side && u.alive).forEach(u => { heal(u, Math.round(20 + a.tec)); u.st.boost = 3; }); } },
  soutou: { name: '相当老けさせる', heat: 30, tgt: 'enemy', desc: '敵1体を3ターン脆化・照準撹乱。ボス以外は50%で1回休み',
    fn(a, t) { t.st.brittle = 3; t.st.jam = 3; log(`　${t.name}は、相当老けた`, 'buff', { tid: t.id, note: '相当' }); if (!t.boss && pct(50)) { t.stun = Math.max(t.stun, 1); log(`　${t.name}は腰をさすっている`, 'crash'); } } },
  gallop: { name: 'ギャロップ', heat: 30, tgt: 'all', desc: 'ランダムな敵に3回蹴りを入れる(物理、速度が高いほど強い)',
    fn(a) { for (let i = 0; i < 3; i++) { const f = foes(a); if (!f.length) break; damage(a, f[Math.floor(rnd() * f.length)], effAtk(a) * 0.8 + a.spd * 1.5, { noCombo: i > 0, fx: 'blunt' }); } } },
  pressure: { name: '水圧', heat: 35, tgt: 'all', desc: '敵全体に技術依存のダメージ。2ターン脆化',
    fn(a) { foes(a).forEach(t => { damage(a, t, 10 + a.tec * 1.4, { noCombo: true, pierce: true, fx: 'beam' }); if (t.alive) t.st.brittle = Math.max(t.st.brittle || 0, 2); }); } },
  miren: { name: '未練', heat: 25, tgt: 'enemy', desc: '敵1体の現在HPを20%削り(ボスは6%)、40%で魅了する',
    fn(a, t) { const d = Math.max(1, Math.round(t.hp * (t.boss ? 0.06 : 0.2))); t.hp = Math.max(1, t.hp - d); log(`　${t.name}は、誰かの未練に袖を引かれた(${d}ダメージ)`, 'hit', { tid: t.id, dmg: d, k: 'beam' }); if (pct(t.boss ? 10 : 40)) { t.st.charmed = 2; log(`　${t.name}は手を止めた`, 'buff'); } } },
  sprint: { name: 'まくり', heat: 20, tgt: 'self', prio: 1, desc: '2ターン速度2倍・攻撃1.5倍。先に動く',
    fn(a) { a.st.high = 3; log(`　${a.name}は外からまくった`, 'buff'); } },
  retaste: { name: '味覚再生', heat: 30, tgt: 'ally', desc: '味方1人のHPを全回復する。ただし相手の熱が30上がる',
    fn(a, t) { if (!t || !t.alive) return; heal(t, t.maxhp); addHeat(t, 30); } },
  sara: { name: '皿の水', heat: 20, tgt: 'all', desc: '敵全体を3ターン濡らし、小ダメージ(濡れた敵は電撃に弱い)',
    fn(a) { foes(a).forEach(t => { t.st.wet = 3; damage(a, t, 6 + a.tec * 0.6, { noCombo: true, fx: 'beam' }); }); log('　皿の水が、あふれた', 'buff'); } },
  drift: { name: 'ドリフト', heat: 30, tgt: 'all', desc: '敵全体に物理ダメージ。このターン自分は狙われにくい',
    fn(a) { foes(a).forEach(t => damage(a, t, effAtk(a) * 1.5, { noCombo: true, fx: 'slash' })); a.st.hidden = 1; } },
  mochi: { name: '餅つき', heat: 40, tgt: 'enemy', desc: '物理。威力4倍。ボス以外は1回休み',
    fn(a, t) { if (strike(a, t, effAtk(a) * 4, { fx: 'blunt' }) && t.alive && !t.boss) { t.stun = Math.max(t.stun, 1); log(`　${t.name}は餅のように伸びた`, 'crash'); } } },
  heiten: { name: '蛍の光', heat: 45, tgt: 'all', desc: '閉店の音楽が流れる。敵全体を60%(ボスは20%)で1回休みにし、熱を30下げる',
    fn(a) { log('　「本日の営業は、終了いたしました」', 'buff'); foes(a).forEach(t => { t.heat = Math.max(0, t.heat - 30); if (pct(t.boss ? 20 : 60)) { t.stun = Math.max(t.stun, 1); log(`　${t.name}は帰り支度を始めた`, 'crash', { tid: t.id, note: '閉店' }); } }); } },
  ryusei: { name: '替え玉', heat: 15, tgt: 'self', desc: '自分のHPを回復し、熱を20下げる。何度でも',
    fn(a) { heal(a, Math.round(a.maxhp * 0.25)); a.heat = Math.max(0, a.heat - 20); } },
  kado: { name: '角に追い込む', heat: 30, tgt: 'enemy', desc: '物理。威力3倍。敵の並びの端(いちばん左か右)にいる相手には6倍',
    fn(a, t) { const es = foes(a), edge = es.length <= 1 || t === es[0] || t === es[es.length - 1]; if (edge) log('　相手は、もう角にいる', 'crash'); strike(a, t, effAtk(a) * (edge ? 6 : 3), { fx: 'slash' }); } },
  kadokado: { name: '宿のいちばん角', heat: 60, tgt: 'all', desc: '敵全体を角にする。最大HPの20%(ボスは8%)を、防御も反射も無視して削る',
    fn(a) { log('　どこかで、角が、すべてを角にした', 'crash'); foes(a).forEach(t => { const d = Math.max(1, Math.round(t.maxhp * (t.boss ? 0.08 : 0.2))); t.hp = Math.max(0, t.hp - d); log(`　${t.name}に${d}ダメージ`, 'hit', { tid: t.id, dmg: d, k: 'blunt' }); if (t.hp <= 0) kill(t); }); } },
  okami: { name: '女将の采配', heat: 0, tgt: 'self', prio: 1, desc: '味方全員の熱-25、HPを少し回復。先に動く',
    fn(a) { log('　女将が、宿の地図を広げた', 'buff'); all().filter(u => u.side === a.side && u.alive).forEach(u => { u.heat = Math.max(0, u.heat - 25); heal(u, 12); }); } },
  manhan: { name: '満漢全席', heat: 45, tgt: 'self', desc: '味方全員のHPを大きく回復し、3ターン攻撃1.5倍',
    fn(a) { all().filter(u => u.side === a.side).forEach(u => { heal(u, Math.round(20 + a.tec * 1.2)); u.st.boost = 3; }); log('　卓に、百八の皿が並んだ', 'buff'); } },
  strip: { name: '武装解除', heat: 15, tgt: 'enemy', desc: '敵1体の強化(装甲・遮断・鏡面・攻撃↑・過給)をすべて剥がす',
    fn(a, t) { ['plate', 'barrier', 'mirror', 'boost', 'oc', 'high', 'fort'].forEach(k => delete t.st[k]); log(`　${t.name}の強化が剥がれ落ちた`, 'buff', { tid: t.id, note: '解除' }); } },
  yank: { name: '磁力奪取', heat: 25, tgt: 'port', desc: '敵のメモリを磁力で引き寄せる。引っこ抜きより30%成功しやすい',
    fn(a, t, pi) { const p = t.ports[pi]; if (!p || !p.mem) { log('　奪えるメモリが無い', 'miss'); return; } if (pct(Math.min(100, ripChance(a, t, pi) + 30))) takeMem(a, t, pi); else log('　磁力が届かなかった', 'miss'); } },
  pick: { name: '鍵開け', heat: 15, tgt: 'port', desc: '敵のメモリを鍵開けの要領で外す。引っこ抜きより40%成功しやすく、失敗しても反撃されない',
    fn(a, t, pi) { const p = t.ports[pi]; if (!p || !p.mem) { log('　外せるメモリが無い', 'miss'); return; } if (pct(Math.min(100, ripChance(a, t, pi) + 40))) takeMem(a, t, pi); else log('　鍵が合わなかった', 'miss'); } },
  freeze: { name: '瞬間冷却', heat: 10, tgt: 'enemy', desc: '単体に冷気のダメージ。2ターン「脆化」させ、熱-40',
    fn(a, t) { if (strike(a, t, 10 + a.tec * 1.2, { fx: 'elec' }) && t.alive) { t.st.brittle = 2; t.heat = Math.max(0, t.heat - 40); log(`　${t.name}が凍りつき、脆くなった`, 'buff'); } } },
  blizzard: { name: '吹雪', heat: 30, tgt: 'all', desc: '敵全体に冷気のダメージ。1ターン「脆化」',
    fn(a) { foes(a).forEach(t => { damage(a, t, 8 + a.tec * 0.8, { noCombo: true, fx: 'elec' }); if (t.alive) t.st.brittle = Math.max(t.st.brittle || 0, 1); }); } },
  decoy: { name: 'デコイ展開', heat: 15, tgt: 'self', prio: 2, desc: '味方全体への単体攻撃を、1回だけ身代わりが受ける。最優先で発動',
    fn(a) { a.st.decoy = 2; log(`　${a.name}の隣に、そっくりなホログラムが立った`, 'buff'); } },
  charm: { name: '誘惑', heat: 20, tgt: 'enemy', desc: '敵1体を50%(ボスは15%)で魅了し、次の行動を休ませる',
    fn(a, t) { if (pct(t.boss ? 15 : 50)) { t.st.charmed = 2; log(`　${t.name}は、うっとりして手を止めた`, 'buff', { tid: t.id, note: '魅了' }); } else log(`　${t.name}には効かなかった`, 'miss'); } },
  anthem: { name: '海賊放送', heat: 20, tgt: 'self', desc: '味方全員の熱-15、2ターン攻撃1.5倍',
    fn(a) { all().filter(u => u.side === a.side).forEach(u => { u.heat = Math.max(0, u.heat - 15); u.st.boost = Math.max(u.st.boost || 0, 2); }); log('　電波に乗って、景気のいい歌が流れた', 'buff'); } },
  hashi: { name: '八卦箸', heat: 20, tgt: 'enemy', desc: '物理・単体に必中の4連撃(小威力)',
    fn(a, t) { for (let i = 0; i < 4 && t.alive; i++) strike(a, t, effAtk(a) * 0.75, { hit: 200 }); } },
  float: { name: '月面浮遊', heat: 10, tgt: 'self', prio: 2, desc: 'このターン狙われず、次の攻撃が1.5倍',
    fn(a) { a.st.hidden = 1; a.st.ambush = 2; log(`　${a.name}はふわりと浮き上がった`, 'buff'); } },
  moonwalk: { name: 'ムーンウォーク', heat: 25, tgt: 'self', prio: 2, desc: '味方全員を2ターン速度1.6倍',
    fn(a) { all().filter(u => u.side === a.side).forEach(u => { u.st.oc = Math.max(u.st.oc || 0, 2); }); log('　全員が、重さを忘れたように動き出した', 'buff'); } },
  steep: { name: '三分間待つ', heat: 10, tgt: 'self', desc: '味方全員のHPを少し回復する',
    fn(a) { all().filter(u => u.side === a.side).forEach(u => heal(u, Math.round(15 + a.tec * 0.5))); } },
  tasting: { name: 'テイスティング', heat: 30, tgt: 'all', desc: '敵全体に炎のダメージ+熱+25',
    fn(a) { foes(a).forEach(t => { damage(a, t, effAtk(a) * 1.5, { type: 'fire', noCombo: true }); addHeat(t, 25); }); } },
  garnish: { name: '盛り付け直し', heat: 10, tgt: 'self', desc: '自分のHPを回復し、装甲を張る',
    fn(a) { heal(a, Math.round(a.maxhp * 0.08)); a.st.plate = 2; } },
  feast108: { name: '百八品の饗宴', heat: 40, tgt: 'all', desc: '敵全体に大ダメージ',
    fn(a) { foes(a).forEach(t => damage(a, t, effAtk(a) * 2.0, { noCombo: true, fx: 'beam' })); } },
  optimize: { name: '舌部最適化', heat: 20, tgt: 'enemy', desc: '相手の舌の端子を書き換え、次の行動を奪う',
    fn(a, t) { if (pct(hitChance(a, 75))) { t.st.charmed = 2; log(`　${t.name}の舌が「最適化」された。次の行動ができない`, 'crash', { tid: t.id, note: '最適化' }); } else log(`　${t.name}は書き換えを弾いた`, 'miss'); } },
  bfsale: { name: '全品半額', heat: 35, tgt: 'all', desc: '敵全体を2ターン「脆化」+照準撹乱',
    fn(a) { foes(a).forEach(t => { t.st.brittle = Math.max(t.st.brittle || 0, 2); t.st.jam = Math.max(t.st.jam || 0, 2); }); log('　店内に「全品半額」のアナウンスが響いた', 'buff'); } },
  descend: { name: '下りエスカレーター', heat: 20, tgt: 'self', prio: 2, desc: '自分を3ターン速度1.6倍にし、敵全体の熱を+20',
    fn(a) { a.st.oc = 3; foes(a).forEach(t => addHeat(t, 20)); log(`　${a.name}だけが、下りのエスカレーターを駆け上がった`, 'buff'); } },
  markdown: { name: '値札貼り替え', heat: 30, tgt: 'enemy', desc: '敵1体の現在HPを25%削る(ボスは8%)。防御無視',
    fn(a, t) { const d = Math.round(t.hp * (t.boss ? 0.08 : 0.25)); t.hp = Math.max(1, t.hp - d); log(`　${t.name}の値札が貼り替えられた(${d}ダメージ)`, 'hit', { tid: t.id, dmg: d, k: 'beam' }); } },
  clearance: { name: '在庫一掃', heat: 40, tgt: 'all', desc: '敵全体に物理ダメージ。敵が多いほど威力が上がる',
    fn(a) { const n = foes(a).length; foes(a).forEach(t => damage(a, t, effAtk(a) * (0.6 + 0.35 * n), { noCombo: true, fx: 'blunt' })); } },
  wrap: { name: 'ギフトラッピング', heat: 20, tgt: 'ally', desc: '味方1人を2ターン包装する(被ダメージ半減)',
    fn(a, t) { if (t && t.alive) { t.st.barrier = 2; log(`　${t.name}は丁寧に包装された`, 'buff'); } } },
  points: { name: 'ポイント十倍', heat: 0, tgt: 'self', passive: true, desc: 'パッシブ。挿しているあいだ、パーティー全員の経験値が1.5倍', fn() {} },
  lostfound: { name: '落とし物センター', heat: 0, tgt: 'self', passive: true, desc: 'パッシブ。挿しているあいだ、稼ぎ場で★レア個体が出やすくなる(+12%)', fn() {} },
  restock: { name: '在庫補充', heat: 30, tgt: 'self', desc: '修復ジェルを1本補充し、自分のHPを少し回復する',
    fn(a) { G.items.gel = (G.items.gel || 0) + 1; heal(a, Math.round(a.maxhp * 0.1)); log('　バックヤードから修復ジェルが1本出てきた', 'buff'); } },
  thunder: { name: '雷撃', heat: 30, tgt: 'enemy', desc: '電撃・単体・大威力。技術依存。濡れた相手に2倍+スタン',
    fn(a, t) { strike(a, t, 18 + a.tec * 2.4, { type: 'elec' }); } },
  storm: { name: '雷雨', heat: 40, tgt: 'all', desc: '敵全体を2ターン「濡れ」にしてから電撃を浴びせる',
    fn(a) { foes(a).forEach(t => { t.st.wet = 2; }); log('　敵全体が「濡れ」た', 'buff'); foes(a).forEach(t => damage(a, t, 8 + a.tec * 0.8, { type: 'elec', noCombo: true })); } },
  oc: { name: '過給', heat: 20, tgt: 'self', prio: 2, desc: '3ターン速度1.6倍。最優先で発動',
    fn(a) { a.st.oc = 3; log(`　${a.name}の駆動系が唸りを上げた`, 'buff'); } },
  meltdown: { name: 'メルトダウン', heat: 0, tgt: 'all', desc: '自分の熱をすべて放出し、熱に比例した防御無視の全体ダメージ。熱は0になる',
    fn(a) { const h = a.heat; foes(a).forEach(t => damage(a, t, 10 + h * 1.3, { pierce: true, noCombo: true, fx: 'fire' })); a.heat = 0; log(`　${a.name}の熱が0になった`, 'buff'); } },
  rush: { name: 'ラッシュ', heat: 20, tgt: 'enemy', desc: '物理・単体に2連撃',
    fn(a, t) { strike(a, t, effAtk(a) * 1.3, {}); if (t.alive) strike(a, t, effAtk(a) * 1.3, {}); } },
  kidney: { name: '肝臓打ち', heat: 25, tgt: 'enemy', desc: '物理・単体。50%でスタン(ボスは20%)',
    fn(a, t) { if (strike(a, t, effAtk(a) * 1.6, {}) && t.alive && pct(t.boss ? 20 : 50)) { t.stun = Math.max(t.stun, 1); log(`　${t.name}はうずくまった`, 'crash'); } } },
  execute: { name: '処刑宣告', heat: 30, tgt: 'enemy', desc: 'HP25%以下の相手を即座に倒す(ボスには3倍ダメージ)。それ以外には小ダメージ',
    fn(a, t) { if (t.hp <= t.maxhp * 0.25) { if (t.boss) strike(a, t, effAtk(a) * 4.5, {}); else kill(t, 'は静かに崩れ落ちた'); } else strike(a, t, effAtk(a) * 1.5, {}); } },
  laser: { name: 'ミシュラン・レーザー', heat: 40, tgt: 'enemy', desc: '単体・防御無視の大威力。熱い',
    fn(a, t) { strike(a, t, effAtk(a) * 3, { pierce: true, fx: 'beam' }); } },
};

/* ---------- レベルと武器の習熟 ---------- */
const LVMAX = 50;
const xpNeed = l => 20 + 15 * (l - 1);
const ocNeed = o => 600 + 40 * o;
const lvText = u => u.lv >= LVMAX && u.oc ? `${LVMAX}+${u.oc}` : String(u.lv);
function gainXp(u, n) {
  if (!u.lv) return 0;
  if (u.lv >= LVMAX) { u.ocx = (u.ocx || 0) + n; let up = 0; u.oc = u.oc || 0; while (u.ocx >= ocNeed(u.oc)) { u.ocx -= ocNeed(u.oc); u.oc++; up++; } if (up) recompute(u); return up; }
  u.xp = (u.xp || 0) + n; let up = 0;
  while (u.lv < LVMAX && u.xp >= xpNeed(u.lv)) { u.xp -= xpNeed(u.lv); u.lv++; up++; }
  if (u.lv >= LVMAX) u.xp = 0;
  if (up) recompute(u);
  return up;
}
const WEAPON = { slash: '斬撃', shot: '射撃', blunt: '打撃' };
const profPts = u => (u.prof && u.prof[u.fxk]) || 0;
const profRank = u => Math.min(10, Math.floor(Math.sqrt(profPts(u) / 4)));
const profNext = u => profRank(u) >= 10 ? 0 : 4 * (profRank(u) + 1) ** 2 - profPts(u);
function addProf(u) {
  if (!u.prof || u.auto) return;
  const b = profRank(u);
  u.prof[u.fxk] = profPts(u) + 1;
  if (profRank(u) > b) log(`　${u.name}の${WEAPON[u.fxk]}の習熟が${profRank(u)}になった(命中+${profRank(u) * 2}%、通常攻撃の威力+${profRank(u) * 3}%)`, 'seep');
}

/* ---------- ユニット ---------- */
function recompute(u) {
  if (!u.base) return;
  const m = { atk: 0, def: 0, tec: 0, spd: 0, hp: 0, cool: 0, seep: 0, pow: 0, wild: 0 };
  u.ports.forEach(p => { if (p.inst) p.inst.afx.forEach(a => { m[a.k] += a.v; }); });
  (u.fixed || []).forEach(i => i.afx.forEach(a => { m[a.k] += a.v; }));
  const L = (u.lv || 1) - 1, g = u.grow || {}, b = {};
  const O = u.oc || 0, OC = { hp: 12, atk: 1, def: 0.6, tec: 1, spd: 0.15 };
  ['hp', 'atk', 'def', 'tec', 'spd'].forEach(k => { b[k] = Math.round(u.base[k] + (g[k] || 0) * L + OC[k] * O); });
  const sb = setBonus(u); Object.keys(sb).forEach(k => { m[k] = (m[k] || 0) + sb[k]; });
  u.atk = b.atk + m.atk + 8 * m.wild; u.def = b.def + m.def; u.tec = b.tec + m.tec; u.spd = b.spd + m.spd;
  u.maxhp = b.hp + m.hp; u.hp = Math.min(u.hp, u.maxhp);
  u.heatMul = Math.max(0.3, 1 + m.cool / 100); u.seepMul = 1 + m.seep / 100; u.powMul = 1 + m.pow / 100; u.idleHeat = 5 * m.wild;
}
function mkUnit(o) {
  const u = Object.assign({ heat: 0, fw: 0, tec: 0, st: {}, stun: 0, alive: true, pdur: 0 }, o);
  u.maxhp = u.hp;
  u.ports = [];
  const n = o.nports || (o.mems || []).length;
  for (let i = 0; i < n; i++) {
    const m = (o.mems || [])[i] || null;
    let inst = null;
    if (m) { const fix = (o.insts || {})[m]; inst = fix ? mkInst(m, fix.rar, fix.afx, o.side === 'ally') : mkInst(m, o.side === 'ally' ? 0 : null, null, o.side === 'ally'); }
    u.ports.push({ mem: m, inst, dur: u.pdur, maxdur: u.pdur, broken: false });
  }
  delete u.mems; delete u.insts;
  if (o.side === 'ally') { u.lv = o.lv || 1; u.xp = 0; u.prof = {}; u.fixed = []; u.base = { hp: o.hp, atk: o.atk, def: o.def, tec: o.tec, spd: o.spd }; recompute(u); }
  return u;
}

/* ---------- 観察で判明する情報(観察力の段階ごと) ---------- */
const INTEL = {
  thug: [['防壁が低く、ハックが通りやすい', '弱らせるか仲間を倒すと脅迫が効く。買収にも応じる'], ['挿しているメモリのポートは耐久が低い。撃てばすぐ露出する'], ['頭に血が上りやすい。挑発で熱を上げられる']],
  bouncer: [['3ターンごとに全体攻撃「鉄鍋返し」。鈍足なので、こちらが先に動ける'], ['鉄鍋返しはメモリ頼み。ポートを壊すか引っこ抜けば撃てなくなる', '鉄鍋返しを撃つと熱+50。過熱誘導を重ねればクラッシュする'], ['濡らしてから電撃を当てると2倍+スタン。動けない相手からは引っこ抜きやすい']],
  drone: [['防壁が極端に低い。ハックで乗っ取れる'], ['技はメモリ頼み。抜けば体当たりしかできない', '電撃は濡れた相手に2倍。こちらが濡れると危険'], ['EMPグレネードで機能停止する']],
  agent: [['装甲や警棒、鏡面など、企業支給のメモリを挿している。装甲展開中は被ダメージ-40%'], ['技はすべてメモリ頼み。ポートを壊すか引っこ抜けば使えない'], ['企業の正規兵。脅しにも買収にも応じにくい']],
  runner: [['奇数ターンにハックしてくる。技術の高い仲間には通りにくい'], ['ハックは「侵入ツールキット」頼み。抜けばスタンガンしか撃てない', '体が弱い。先に倒せば、味方の照準が守られる'], ['防壁が低い。こちらからのハックがよく通る']],
  exec: [['1・4・7…ターン目に、メモリを「リコール」して奪っていく。倒せば取り戻せる'], ['リコールは照準撹乱で外しやすい。プロトコルチャーハンを最優先で狙う', 'HPが半分を切ると一度だけ自分を治療する'], ['「品質保証プロトコル」を奪えば、こちらもリコールが使える']],
  turret: [['2ターンに1回、充填してからレールガンを撃つ。充填中は無防備'], ['レールガンは防御無視。撃たれる側は「防御」か、照準撹乱で外させる', '動かないので、戦場のモノが当てやすい'], ['電撃に弱い構造。濡らせばよく通る']],
  champ: [['ときどき「鏡面反射」を張る。光っている間は単体攻撃を控える'], ['3ターンごとに「ガラスの大砲」を撃つ。撃ったあとは自分も傷つく', '鏡も大砲もメモリ頼み。ポートを壊せば封じられる'], ['挑発に乗りやすい。熱を上げてクラッシュを狙える']],
  titan: [['3ターンごとに全体への多弾頭ミサイル。その前のターンに防御を固めたい'], ['4ターン目ごとにガラスの大砲。HPが減ると鏡面反射も使う', '巨体ゆえに防壁は低い。ハックがよく通る'], ['ミサイルポッドのポートを壊せば、全体攻撃が止まる']],
  smith: [['3ターンごとに全体攻撃の「研削」。その前に防御を固めたい'], ['アーク溶接は熱も上げてくる。熱の高い仲間は冷やしておく', '回転ノコギリのポートを壊せば、全体攻撃が止まる'], ['装甲の展開は4ターンに1回。展開の直前に大技を当てたい']],
  golem: [['偶数ターンに熱湯を全体に浴びせる。熱が溜まりやすい'], ['濡れていると炎は半減する。先に全員を濡らしておく手がある', '鏡面反射を使う。光っている間は単体攻撃を控える'], ['蒸気噴射弁を抜けば、ただの岩になる']],
  captain: [['3ターンごとに多弾頭ミサイル。煙幕で照準を狂わせてくる'], ['ドレインで体力を吸う。長引くほど不利', 'ミサイルポッドを壊せば全体攻撃が止まる'], ['船乗りは話の分かる相手でもある']],
  bodyguard: [['ときどき鏡面反射を張り、偶数ターンにアッパーカットを撃つ'], ['電撃殴打でスタンさせてくる。技術の高い仲間で守りたい', '鏡が光っている間は、全体攻撃か戦場のモノで攻める'], ['雇い主への忠誠は、金で買われたものだ']],
  gastro: [['3ターンごとに全体へのテイスティング(炎+熱)。熱の管理が鍵'], ['4ターン目ごとに盛り付け直しで回復と装甲。直後は装甲剥がしが効く', '美食演算コアのポートを壊せば、どちらも止まる'], ['ナイフワークは3連撃。デコイや鏡面で受け流せる']],
  chair: [['3ターンごとに「百八品の饗宴」で全体に大ダメージ。直前に防御を固めたい'], ['舌部最適化で味方の行動を奪う。照準撹乱で外させやすい', '饗宴も最適化もメモリ頼み。ポートを壊せば止まる'], ['装甲は4ターン目ごと。装甲剥がしが通る']],
  final: [['HPが半分を切ると本気を出し、饗宴が2ターンごとになる'], ['舌部最適化で味方の行動を奪う。後半は鏡面反射も使う', '半分を切る直前に、回復と防御を整えておきたい'], ['会長は、本当は一皿の味を思い出したいだけだ']],
  hitman: [['「味覚遮断」で被ダメージを半減している。これもメモリ頼み'], ['レーザーは偶数ターンに撃つが、熱60以上では撃てない', '熱が溜まりやすい。過熱誘導でクラッシュを狙える'], ['HPが3割を切ると、言葉が届くかもしれない']],
};

/* ---------- 参照ヘルパ ---------- */
const all = () => G.units.filter(u => u.alive);
const foes = a => all().filter(u => u.side !== a.side);
const enemies = () => all().filter(u => u.side === 'enemy');
const players = () => G.party.filter(u => u.alive);
const unit = id => G.units.find(u => u.id === id);
const effAtk = u => u.atk * (u.st.boost ? 1.5 : 1) * (u.st.high ? 1.5 : 1);
const effSpd = u => u.spd * (u.st.high ? 2 : 1) * (u.st.oc ? 1.6 : 1);
const hasMem = (u, m) => u.ports.some(p => p.mem === m && !p.broken) || (u.fixed || []).some(i => i.type === m);
const memTypes = u => u.ports.filter(p => p.mem && !p.broken).map(p => p.mem).concat((u.fixed || []).map(i => i.type));
const seepKey = (u, m) => u.id + ':' + m;
const seep = (u, m) => G.seep[seepKey(u, m)] || 0;
/* 熟練: 技の効き目は、挿しているメモリのレアリティと浸透度で伸びる(育てないと勝てない) */
const RARMUL = [0.8, 0.9, 1.0, 1.15, 1.3];
function mastery(u, m) {
  if (!u || u.side !== 'ally' || m == null || !u.base) return 1;
  let r = -1; u.ports.forEach(p => { if (p.mem === m && p.inst && !p.broken) r = Math.max(r, p.inst.rar); }); (u.fixed || []).forEach(i => { if (i.type === m) r = Math.max(r, i.rar); });
  const rm = RARMUL[Math.max(0, Math.min(4, r < 0 ? 1 : r))];
  return rm * (1 + 0.6 * seep(u, m) / 100);
}
const MECH = ['drone', 'turret', 'titan', 'smith', 'golem'];
/* レベルで覚える固有技(メモリを挿せない仲間用) */
const innateOf = u => (u.innate || []).filter(id => id !== 'observe').concat((u.lvsk || []).filter(x => (u.lv || 1) >= x[1]).map(x => x[0]));
const hasInnate = (u, id) => innateOf(u).includes(id);
function fetchChance(a, t, pi) { const p = t.ports[pi]; if (!p || !p.mem) return 0; if (p.broken) return 100; return clamp(ripChance(a, t, pi) + 30 + Math.round(a.spd * 0.5), 5, 98); }
function skillsOf(u) {
  const out = [];
  memTypes(u).forEach(m => { MEM[m].skills.forEach(([id, need]) => { if (u.side !== 'ally' || seep(u, m) >= need) out.push({ id, mem: m }); }); });
  return out;
}
function gainSeep(u, m, base) {
  if (u.side !== 'ally' || u.auto) return;
  const before = seep(u, m), after = Math.min(100, before + Math.max(1, Math.round(base * (u.seepMul || 1))));
  if (after === before) return;
  G.seep[seepKey(u, m)] = after;
  MEM[m].skills.forEach(([id, need]) => { if (before < need && after >= need) log(`　浸透度${after}%: 「${MEM[m].name}」が身体に馴染み、${u.name}は「${SK[id].name}」を覚えた!`, 'seep'); });
  if (before < 100 && after >= 100) log(`　浸透度100%: 「${MEM[m].name}」が${u.name}の身体に浸透しきった。PCバンかメニューで固着できる`, 'seep');
  if (m === 'eye') [70, 100].forEach(th => { if (before < th && after >= th) log(`　浸透度${after}%: ${u.name}の自動観察が深くなった`, 'seep'); });
}

/* ---------- 固着 ---------- */
const FIXMAX = 2;
/* 物語で使うメモリ(消えない、固着・分解・売却・合成・廃棄できない) */
const EVENTMEM = ['chahan'];
const isEvent = i => !!(i && EVENTMEM.includes(i.type));
const canFix = (u, pi) => { const p = u.ports[pi]; return !!(p && p.inst && !isEvent(p.inst) && p.inst.rar >= 0 && seep(u, p.mem) >= 100 && (u.fixed || []).length < FIXMAX && !(u.fixed || []).some(i => i.type === p.mem)); };
function fixMem(u, pi) {
  if (!canFix(u, pi)) return false;
  const p = u.ports[pi];
  u.fixed = u.fixed || []; u.fixed.push(p.inst);
  p.mem = null; p.inst = null;
  recompute(u);
  return true;
}

/* ---------- 観察 ---------- */
const autoObsLevel = u => { const s = seep(u, 'eye'); return !hasMem(u, 'eye') || s < 40 ? 0 : s >= 100 ? 3 : s >= 70 ? 2 : 1; };
const obsLevel = a => Math.max(a.obs || 0, hasMem(a, 'eye') ? (seep(a, 'eye') >= 100 ? 3 : 2) : 0);
function doObserve(a, t, lv, quiet) {
  const from = t.seen || 0;
  if (from >= lv) { if (!quiet) log('　これ以上のことは分からない', 'miss'); return; }
  t.seen = lv;
  const hints = INTEL[t.kind] || [];
  for (let i = from; i < lv; i++) (hints[i] || []).forEach(h => log('　◆ ' + (quiet ? t.name + ': ' : '') + h, 'intel', { tid: t.id, note: '解析' }));
  if (!quiet) log(`　${t.name}は「解析済」: 以後ハックと引っこ抜きの成功率+10%`, 'buff');
}

/* ---------- 基本処理 ---------- */
function addHeat(u, n) {
  if (!u.alive) return;
  u.heat = clamp(u.heat + n, 0, 100);
  if (u.heat >= 100) { u.heat = 40; u.stun = Math.max(u.stun, 1); log(`　⚠ ${u.name}は過熱でクラッシュ! 次の行動ができない`, 'crash'); }
}
function heal(u, n) { n = Math.round(n * (G.healMul || 1)); const b = u.hp; u.hp = Math.min(u.maxhp, u.hp + n); log(`　${u.name}のHPが${u.hp - b}回復`, 'heal', { tid: u.id, heal: u.hp - b }); }
function kill(t, how) { t.alive = false; t.hp = 0; log(`　${t.name}${how || 'は倒れた'}`, 'down', { tid: t.id, down: true }); giveBack(t); }
function giveBack(t) { (t.taken || []).forEach(i => { G.bag.push(i); log(`　回収されていた「${MEM[i.type].name}」を取り戻した。戦闘が終われば元のポートに戻る(すぐ使うなら「メモリ」→「挿す」)`, 'seep'); }); t.taken = []; }
function damage(a, t, raw, o) {
  o = o || {};
  if (!t.alive) return 0;
  let d = raw;
  if (a && a._pow) d *= a._pow;
  if (a && a.heat >= 70) d *= 1.3;
  if (a && a.st.ambush && !o.noAmbush) { d *= 1.5; delete a.st.ambush; log('　死角からの一撃!', 'buff'); }
  const wet = !!t.st.wet;
  if (o.type === 'elec' && wet) d *= 2;
  if (o.type === 'fire' && wet) d *= 0.5;
  if (!o.pierce) d -= t.def * (t.st.brittle ? 0.4 : 1);
  if (t.st.brittle) d *= 1.2;
  if (t.st.guard) d *= 0.5;
  if (t.st.barrier) d *= 0.5;
  if (t.st.carcover) d *= 0.5;
  if (t.st.kcover) d *= 0.7;
  if (t.st.fort) d *= 0.7;
  if (t.st.plate) d *= 0.6;
  if (a && a.side === 'ally' && !o.noCombo) {
    if (G.combo.tid === t.id && G.combo.aid !== a.id) {
      G.combo.count++; let m = 1 + 0.2 * G.combo.count;
      const pair = [a.id, G.combo.aid], o = pair.includes('hero') ? pair.find(x => x !== 'hero') : null, b = o && (G.bonds || {})[o];
      if (b) { m += 0.15 * b; log(`　絆の連携×${G.combo.count + 1}!(${b === 2 ? '恋人' : '相棒'})`, 'combo'); } else log(`　連携×${G.combo.count + 1}!`, 'combo');
      d *= m;
    }
    else if (G.combo.tid !== t.id) G.combo = { tid: t.id, aid: a.id, count: 0 };
    G.combo.aid = a.id;
  }
  d = Math.max(1, Math.round(d * (0.9 + rnd() * 0.2)));
  t.hp = Math.max(0, t.hp - d);
  log(`　${t.name}に${d}ダメージ${o.type === 'elec' && wet ? '(感電)' : ''}`, t.side === 'ally' ? 'hurt' : 'hit', { tid: t.id, dmg: d, k: o.fx || (o.type === 'elec' ? 'elec' : o.type === 'fire' ? 'fire' : (a && a.fxk) || 'blunt') });
  if (t.hp <= 0 && t.side === 'ally' && !t._bone && hasInnate(t, 'lastbone')) { t._bone = 1; t.hp = 1; log(`　${t.name}は歯を食いしばって踏みとどまった!(最後の骨)`, 'combo', { tid: t.id, note: '踏みとどまった' }); return d; }
  if (t.hp <= 0) { kill(t); return d; }
  if (o.type === 'elec' && wet && pct(t.boss ? 35 : 65)) { t.stun = Math.max(t.stun, 1); log(`　${t.name}は痺れて動けない`, 'crash'); }
  return d;
}
function hitChance(a, base) { return clamp((base == null ? 95 : base) + (a.side === 'ally' ? profRank(a) * 2 : 0) - (a.st.jam ? 50 : 0), 5, 100); }
function strike(a, t, raw, o) {
  o = o || {};
  if (a.side === 'enemy' || a.auto) {
    const dc = all().find(u => u.side === t.side && u.st.decoy);
    if (dc) { delete dc.st.decoy; log(`　攻撃は${dc.name}のデコイをすり抜けた!`, 'buff', { tid: t.id, miss: true }); return false; }
    const dg = all().find(u => u.side === t.side && u.st.dogguard && u.dogFor === t.id && u.id !== t.id);
    const c = dg || all().find(u => u.side === t.side && u.st.kcover && u.id !== t.id);
    if (c) { log(dg ? `　${c.name}が飛びかかって割って入った!` : `　${c.name}が割って入った!`, 'buff'); t = c; }
    if (dg) { if (!pct(hitChance(a, o.hit))) { log(`　${a.name}の攻撃は外れた`, 'miss', { tid: t.id, miss: true }); return false; } damage(a, t, raw * 0.8, o); if (dg.alive && a.alive) { log(`　${dg.name}が${a.name}に噛みつき返した!`, 'act'); damage(dg, a, effAtk(dg) * 1.3, { noCombo: true, fx: 'slash' }); } return true; }
  }
  if (!pct(hitChance(a, o.hit))) { log(`　${a.name}の攻撃は外れた`, 'miss', { tid: t.id, miss: true }); return false; }
  if (t.st.mirror && t.side !== a.side) { delete t.st.mirror; log(`　${t.name}が攻撃を跳ね返した!`, 'combo', { tid: t.id, note: '反射' }); damage(null, a, raw * 0.8, o); return false; }
  damage(a, t, raw, o);
  if (a.side === 'ally' && !o.type && !o.fx) addProf(a);
  return true;
}
function hitPort(a, t, pi, dmg, sure) {
  const p = t.ports[pi];
  if (!p || !p.mem || p.broken) { log('　狙うポートがもう無い。本体を撃った'); strike(a, t, effAtk(a) * 2, {}); return; }
  if (!sure && !pct(hitChance(a, 60))) { log(`　${a.name}の狙いは逸れた`, 'miss', { tid: t.id, miss: true }); return; }
  p.dur = Math.max(0, p.dur - Math.round(dmg));
  log(`　${t.name}のポート[${MEM[p.mem].name}]に命中(耐久${p.dur}/${p.maxdur})`, 'hit', { tid: t.id, note: 'ポート命中' });
  if (p.dur <= 0) { p.broken = true; if (p.mem === 'barrier') delete t.st.barrier; log(`　ポートが露出・機能停止! 「${MEM[p.mem].name}」の技は封じられた。確実に引っこ抜ける`, 'crash'); }
  damage(a, t, effAtk(a) * 0.6, {});
}

function takeMem(a, t, pi) {
  const p = t.ports[pi], inst = p.inst, m = p.mem; p.mem = null; p.inst = null;
  if (m === 'barrier') delete t.st.barrier; if (m === 'adrenal') delete t.st.boost;
  inst.known = true; G.bag.push(inst); G.loot.push(inst);
  log(`　「${MEM[m].name}」を手に入れた!`, 'seep', { tid: t.id, note: '奪取!' });
  log(`　鑑定: ${RAR[inst.rar].n}${inst.afx.length ? ' / ' + inst.afx.map(afxText).join('、') : ' / 追加効果なし'}`, 'rar' + inst.rar, { tid: a.id, note: RAR[inst.rar].n });
}

/* ---------- 成功率 ---------- */
function ripChance(a, t, pi) {
  const p = t.ports[pi];
  if (!p || !p.mem) return 0;
  if (p.broken) return 100;
  return clamp(Math.round(10 + a.tec + (t.seen ? 10 : 0) + (t.stun > 0 ? 40 : 0) + (1 - t.hp / t.maxhp) * 30 - (t.boss ? 10 : 0)), 5, 95);
}
function hackChance(a, t, kind) {
  const pen = { jam: 0, heat: 0, rewrite: 15, hijack: 10 }[kind];
  return clamp(Math.round(40 + a.tec * 2 - t.fw - pen + (t.seen ? 10 : 0) + (t.stun > 0 ? 20 : 0)), 0, 95);
}
function threatChance(t) {
  const dead = G.units.filter(u => u.side0 === 'enemy' && !u.alive).length;
  return clamp(Math.round((1 - t.hp / t.maxhp) * 70 + dead * 15 + 5), 5, 95);
}
const BRIBE = 120;
const ITEM = { gel: '修復ジェル', coolant: '冷却スプレー', emp: 'EMPグレネード' };

/* ---------- プレイヤー行動 ---------- */
function retarget(a, t) { if (t && t.alive && t.side !== a.side) return t; const f = foes(a); return f.length ? f[Math.floor(rnd() * f.length)] : null; }
const A = {
  attack(a, t, pi) {
    return { actor: a, label: pi == null ? `攻撃 → ${t.name}` : `ポート狙い → ${t.name}[${MEM[t.ports[pi].mem].name}]`, run() {
      t = retarget(a, t); if (!t) return;
      log(`${a.name}の攻撃`, 'act');
      if (pi != null && t.ports[pi] && t.ports[pi].mem) hitPort(a, t, pi, effAtk(a) * 1.2, false); else strike(a, t, effAtk(a) * 2 * (1 + 0.03 * profRank(a)), {});
      addHeat(a, 5);
    } };
  },
  skill(a, sid, mem, t, pi) {
    const s = SK[sid];
    return { actor: a, prio: s.prio || 0, label: `${s.name}${t ? ' → ' + t.name : ''}`, run() {
      const inn = mem == null;
      if (!inn && !hasMem(a, mem)) { log(`${a.name}は「${s.name}」を使おうとしたが、メモリが無い`, 'miss'); return; }
      if (s.tgt === 'enemy' || s.tgt === 'port') { t = retarget(a, t); if (!t) return; }
      if (s.tgt === 'ally' && (!t || !t.alive)) { t = all().filter(u => u.side === a.side).sort((x, y) => x.hp / x.maxhp - y.hp / y.maxhp)[0]; }
      log(`${a.name}の「${s.name}」`, 'act');
      const mst = inn ? 1 + Math.min(0.9, (a.lv || 1) * 0.02) : mastery(a, mem);
      a._pow = (a.powMul || 1) * mst; G.healMul = mst;
      s.fn(a, t, pi);
      a._pow = 0; G.healMul = 1;
      if (!inn) gainSeep(a, mem, 2);
      addHeat(a, Math.round(s.heat * (a.heatMul || 1)));
    } };
  },
  observe(a, t) {
    return { actor: a, prio: 1, label: `観察 → ${t.name}`, run() {
      if (!t.alive) { log(`${a.name}は観察する相手を失った`, 'miss'); return; }
      log(`${a.name}は${t.name}を観察した(観察力${obsLevel(a)})`, 'act');
      doObserve(a, t, obsLevel(a));
    } };
  },
  guard(a) { return { actor: a, prio: 3, label: '防御', run() { a.st.guard = 1; log(`${a.name}は身を守っている(被ダメ半減・冷却)`, 'act'); } }; },
  item(a, id, t) {
    return { actor: a, label: `${ITEM[id]}${t ? ' → ' + t.name : ''}`, run() {
      if (!G.items[id]) { log(`${a.name}は${ITEM[id]}を探したが、もう無い`, 'miss'); return; }
      G.items[id]--;
      log(`${a.name}は${ITEM[id]}を使った`, 'act');
      if (id === 'gel') { if (t.alive) heal(t, 70); }
      else if (id === 'coolant') {
        if (!t.alive) return;
        const hot = t.heat >= 70; t.heat = Math.max(0, t.heat - 50);
        log(`　${t.name}の熱が下がった`, 'buff');
        if (hot) { t.st.brittle = 3; log(`　急冷で${t.name}の装甲が「脆化」した!`, 'crash'); }
      } else if (id === 'emp') {
        enemies().forEach(e => {
          e.fw = Math.max(0, e.fw - 20);
          e.ports.forEach(p => { if (p.mem && !p.broken) { p.dur = Math.max(0, p.dur - 25); if (p.dur <= 0) { p.broken = true; if (p.mem === 'barrier') delete e.st.barrier; log(`　${e.name}のポート[${MEM[p.mem].name}]が焼き切れた`, 'crash'); } } });
          if (e.kind === 'drone') { e.stun = Math.max(e.stun, 1); log(`　${e.name}は機能停止した`, 'crash'); }
        });
        log('　敵全体の防壁とポート耐久が低下', 'buff');
      }
    } };
  },
  rip(a, t, pi) {
    return { actor: a, label: `引っこ抜く → ${t.name}[${MEM[t.ports[pi].mem].name}]`, run() {
      if (!t.alive) { log(`${a.name}は引っこ抜く相手を見失った`, 'miss'); return; }
      const p = t.ports[pi];
      if (!p.mem) return;
      log(`${a.name}は${t.name}のポートに手を伸ばした`, 'act');
      if (pct(ripChance(a, t, pi))) {
        const m = p.mem, inst = p.inst; p.mem = null; p.inst = null;
        if (m === 'barrier') delete t.st.barrier; if (m === 'adrenal') delete t.st.boost;
        inst.known = true; G.bag.push(inst); G.loot.push(inst);
        log(`　「${MEM[m].name}」を引っこ抜いた! (「メモリ」→「挿す」で自分のものにできる)`, 'seep', { tid: t.id, note: '奪取!' });
        log(`　鑑定: ${RAR[inst.rar].n}${inst.afx.length ? ' / ' + inst.afx.map(afxText).join('、') : ' / 追加効果なし'}`, 'rar' + inst.rar, { tid: a.id, note: RAR[inst.rar].n });
      } else { log('　振り払われた', 'miss'); damage(null, a, 14, {}); }
      addHeat(a, 10);
    } };
  },
  hack(a, t, kind) {
    const nm = { jam: '照準撹乱', heat: '過熱誘導', rewrite: '予告書き換え', hijack: '乗っ取り' }[kind];
    return { actor: a, label: `ハック:${nm} → ${t.name}`, run() {
      if (!t.alive || t.side !== 'enemy') { log(`${a.name}のハックは対象を失った`, 'miss'); return; }
      log(`${a.name}は${t.name}に侵入を試みる(${nm})`, 'act');
      addHeat(a, 15);
      if (!pct(hackChance(a, t, kind))) { log('　防壁に弾かれた', 'miss'); return; }
      t.fw += 10;
      if (kind === 'jam') { t.st.jam = 2; log(`　${t.name}の照準が狂った(命中-50%)`, 'buff'); }
      else if (kind === 'heat') { log(`　${t.name}の冷却系を止めた`, 'buff'); addHeat(t, 40); }
      else if (kind === 'rewrite') { t.intent = { tip: 'ハックで行動を書き換えられている。このターンは何もしない', label: 'フリーズ(書き換え済)', run() { log(`${t.name}は虚空を見つめている`, 'act'); } }; log(`　${t.name}の行動を書き換えた`, 'buff'); }
      else if (kind === 'hijack') { t.side = 'ally'; t.auto = true; t.st = {}; t.intent = null; log(`　${t.name}を乗っ取った! 以後は味方として戦う`, 'seep'); }
    } };
  },
  obj(a, oid, t) {
    const o = G.objs.find(x => x.id === oid);
    return { actor: a, label: `${o.name}を${o.act}${t ? ' → ' + t.name : ''}`, run() {
      if (o.used) { log(`${a.name}は${o.name}を使おうとしたが、もう使えない`, 'miss'); return; }
      if (o.tgt === 'enemy') { t = retarget(a, t); if (!t) return; }
      o.used = true;
      log(`${a.name}は${o.name}を${o.act}!`, 'act');
      if (oid === 'panel') enemies().forEach(e => damage(a, e, 34, { type: 'elec', noCombo: true, pierce: true }));
      else if (oid === 'gas') { damage(a, t, 30 + a.atk * 1.8, { type: 'fire' }); addHeat(t, 30); }
      else if (oid === 'sprinkler') { all().forEach(u => { u.st.wet = 3; u.heat = Math.max(0, u.heat - 30); }); log('　全員ずぶ濡れになった', 'buff'); }
      else if (oid === 'car') { a.st.carcover = 3; log(`　${a.name}は廃車の陰に入った`, 'buff'); }
      else if (oid === 'hydrant') { enemies().forEach(e => { e.st.wet = 3; }); log('　水柱が敵をなぎ払った。敵全体が「濡れ」', 'buff'); }
      else if (oid === 'cable') damage(a, t, 55, { type: 'elec', pierce: true });
      else if (oid === 'crane') damage(a, t, 70, { fx: 'blunt' });
      else if (oid === 'lantern') enemies().forEach(e => { damage(a, e, 24, { type: 'fire', noCombo: true }); addHeat(e, 20); });
      else if (oid === 'neon') damage(a, t, 60, { type: 'elec', pierce: true });
      else if (oid === 'keg') enemies().forEach(e => damage(a, e, 30 + a.atk * 0.6, { noCombo: true, fx: 'blunt' }));
    } };
  },
  talk(a, t, kind) {
    const nm = { taunt: '挑発', threat: '脅迫', bribe: '買収', persuade: '説得' }[kind];
    return { actor: a, label: `${nm} → ${t.name}`, run() {
      if (!t.alive || t.side !== 'enemy') { log(`${a.name}は話す相手を失った`, 'miss'); return; }
      log(`${a.name}は${t.name}を${nm}した`, 'act');
      if (kind === 'taunt') {
        if (t.boss && !pct(60)) { log('　相手にされなかった', 'miss'); return; }
        t.st.taunt = 2; t.tauntBy = a.id; addHeat(t, 15); log(`　${t.name}は頭に血が上った(${a.name}を狙う・熱+15)`, 'buff');
      } else if (kind === 'threat') {
        if (pct(threatChance(t))) kill(t, 'は武器を捨てて逃げ出した'); else log('　「ナメんじゃねえ!」効かなかった', 'miss');
      } else if (kind === 'bribe') {
        if (G.credits < BRIBE) { log('　クレジットが足りない', 'miss'); return; }
        G.credits -= BRIBE; kill(t, `は${BRIBE}crを受け取って帰っていった`);
      } else if (kind === 'persuade') {
        if (t.hp > t.maxhp * 0.3) { log('　「……仕事中だ」聞く耳を持たない(追い詰めれば変わるかもしれない)', 'miss'); return; }
        log('　「……朗々飯店の炒飯。子供の頃、一度だけ食べた」', 'seep');
        log(`　${t.name}は銃を下ろした。`, 'seep');
        G.special = true; t.alive = false; giveBack(t);
        enemies().forEach(e => { e.alive = false; giveBack(e); });
      }
    } };
  },
  swap(a, bi, pi) {
    const inst = G.bag[bi];
    return { actor: a, label: `挿す:${instName(inst)}`, run() {
      const idx = G.bag.indexOf(inst);
      if (idx < 0) { log(`${a.name}は挿すメモリを見失った`, 'miss'); return; }
      G.bag.splice(idx, 1);
      const p = a.ports[pi], old = p.inst;
      if (old) G.bag.push(old);
      p.mem = inst.type; p.inst = inst;
      recompute(a);
      log(`${a.name}は「${instName(inst)}」を自分のポートに挿した${old ? `(「${instName(old)}」は抜いた)` : ''}`, 'seep');
      addHeat(a, 10);
    } };
  },
};

/* ---------- 敵AI ---------- */
function pickTarget(e) {
  if (e.st.taunt && e.tauntBy) { const t = unit(e.tauntBy); if (t && t.alive && t.side !== e.side) return t; }
  let c = foes(e).filter(u => !u.st.hidden);
  if (!c.length) c = foes(e);
  return c.length ? c[Math.floor(rnd() * c.length)] : null;
}
function enemySkill(e, sid, t) {
  const s = SK[sid];
  return { tip: s.desc, label: s.name + (t ? ` → ${t.name}` : s.tgt === 'all' ? ' → 全体' : ''), tid: t && t.id, danger: s.tgt === 'all' && !['smoke', 'verse', 'mist', 'blizzard'].includes(sid) || ['laser', 'recall', 'cannon', 'uppercut', 'optimize', 'charm'].includes(sid), run() {
    const mem = Object.keys(MEM).find(m => MEM[m].skills.some(x => x[0] === sid));
    if (!hasMem(e, mem)) { log(`${e.name}は「${s.name}」を使おうとしたが、メモリが無い!`, 'miss'); return; }
    if (t && s.tgt !== 'ally') { if (!t.alive || t.st.hidden || t.side === e.side || e.st.taunt) t = pickTarget(e); if (!t) return; }
    log(`${e.name}の「${s.name}」`, 'eact');
    s.fn(e, t);
    addHeat(e, s.heat);
  } };
}
function enemyAttack(e, t, name, mult, n, type) {
  return { tip: `${type === 'elec' ? '電撃' : '物理'}の通常攻撃${n > 1 ? '。ランダムな相手に' + n + '回' : ''}`, label: `${name} → ${n > 1 ? 'ランダム' + n + '回' : t ? t.name : '-'}`, tid: n > 1 ? null : t && t.id, run() {
    log(`${e.name}の${name}`, 'eact');
    for (let i = 0; i < (n || 1); i++) {
      let x = n > 1 ? pickTarget(e) : t;
      if (!x || !x.alive || x.st.hidden || x.side === e.side || e.st.taunt) x = pickTarget(e);
      if (!x) return;
      strike(e, x, effAtk(e) * mult, { type });
    }
    addHeat(e, 5);
  } };
}
function enemyHack(e, t, kind) {
  const nm = kind === 'jam' ? '照準撹乱' : '過熱注入';
  return { tip: kind === 'jam' ? '成功すると2ターン命中-50%。技術の高い相手には通りにくい' : '成功すると熱+35。100を超えるとクラッシュする', label: `ハック:${nm} → ${t.name}`, tid: t.id, danger: kind === 'heat' && t.heat >= 60, run() {
    if (!hasMem(e, 'netrun')) { log(`${e.name}はハックしようとしたが、メモリが無い!`, 'miss'); return; }
    if (!t.alive || t.side === e.side) t = pickTarget(e); if (!t) return;
    log(`${e.name}が${t.name}のオーグメントに侵入してきた`, 'eact');
    if (!pct(clamp(85 - t.tec, 25, 85))) { log(`　${t.name}は侵入を弾いた`, 'miss', { tid: t.id, miss: true }); return; }
    if (kind === 'jam') { t.st.jam = 2; log(`　${t.name}の照準が狂った(命中-50%)`, 'hurt', { tid: t.id, note: '照準撹乱' }); }
    else { log(`　${t.name}の冷却系が止められた`, 'hurt', { tid: t.id, note: '過熱' }); addHeat(t, 35); }
    addHeat(e, 10);
  } };
}
const EXTRA = ['jab', 'uppercut', 'smoke', 'drain', 'zap', 'mirror', 'starve', 'freeze', 'charm', 'decoy', 'hashi', 'float', 'strip', 'buzz', 'scald', 'discount'];
function chooseIntent(e) {
  const t = pickTarget(e);
  if (!t) return { label: '様子を見ている', run() {} };
  if (!e.boss) { const ex = skillsOf(e).filter(s => EXTRA.includes(s.id)); if (ex.length && pct(40)) { const s = ex[Math.floor(rnd() * ex.length)]; return enemySkill(e, s.id, SK[s.id].tgt === 'enemy' ? t : null); } }
  switch (e.kind) {
    case 'thug':
      if (hasMem(e, 'adrenal') && !e.st.boost && pct(35)) return enemySkill(e, 'boost');
      return enemyAttack(e, t, '殴りかかり', 2);
    case 'bouncer':
      if (G.turn % 3 === 0 && hasMem(e, 'wok')) return enemySkill(e, 'wok');
      return enemyAttack(e, t, '中華包丁', 2);
    case 'hitman':
      if (hasMem(e, 'barrier') && !e.st.barrier && e.heat < 75) return enemySkill(e, 'barrier');
      if (hasMem(e, 'laser') && G.turn % 2 === 0 && e.heat < 60) return enemySkill(e, 'laser', t);
      return enemyAttack(e, t, '二丁撃ち', 1.6, 2);
    case 'agent':
      if (hasMem(e, 'armor') && !e.st.plate && pct(40)) return enemySkill(e, 'plate');
      return enemyAttack(e, t, '電磁警棒', 2);
    case 'runner':
      if (hasMem(e, 'netrun') && G.turn % 2 === 1) return enemyHack(e, t, pct(50) ? 'jam' : 'heat');
      return enemyAttack(e, t, 'スタンガン', 1.6, 1, 'elec');
    case 'exec':
      if (hasMem(e, 'qa') && G.turn % 3 === 1) { const v = foes(e).filter(u => u.ports.some(p => p.inst)); if (v.length) { const h = v.find(u => u.ports.some(p => p.mem === 'chahan')) || v[0]; return enemySkill(e, 'recall', h); } }
      if (hasMem(e, 'medic') && e.hp < e.maxhp * 0.45 && !e.healed) { e.healed = 1; return enemySkill(e, 'patch', e); }
      if (hasMem(e, 'armor') && !e.st.plate && G.turn % 4 === 2) return enemySkill(e, 'plate');
      return enemyAttack(e, t, '査定', 1.4, 2);
    case 'turret':
      if (e.charged) { e.charged = 0; return { tip: '充填した一撃。防御するか、照準撹乱で外させたい', label: `レールガン → ${t.name}`, tid: t.id, danger: true, run() { log(`${e.name}のレールガン`, 'eact'); let x = t; if (!x.alive || x.st.hidden) x = pickTarget(e); if (x) strike(e, x, effAtk(e) * 3.6, { pierce: true, fx: 'beam' }); addHeat(e, 20); } }; }
      e.charged = 1; return { tip: '次のターンに強烈な一撃を撃つ', label: '充填中…', run() { log(`${e.name}は砲身に電力を充填している`, 'eact'); } };
    case 'champ':
      if (hasMem(e, 'mirror') && !e.st.mirror && pct(45)) return enemySkill(e, 'mirror');
      if (hasMem(e, 'glass') && G.turn % 3 === 0) return enemySkill(e, 'cannon', t);
      return enemyAttack(e, t, 'コンビネーション', 1.7, 3, null);
    case 'titan':
      if (hasMem(e, 'missile') && G.turn % 3 === 0) return enemySkill(e, 'barrage');
      if (hasMem(e, 'glass') && G.turn % 4 === 2) return enemySkill(e, 'cannon', t);
      if (hasMem(e, 'mirror') && !e.st.mirror && e.hp < e.maxhp * 0.6 && pct(50)) return enemySkill(e, 'mirror');
      return enemyAttack(e, t, '踏みつけ', 1.8);
    case 'smith':
      if (hasMem(e, 'saw') && G.turn % 3 === 0) return enemySkill(e, 'grind');
      if (hasMem(e, 'armor') && !e.st.plate && G.turn % 4 === 1) return enemySkill(e, 'plate');
      if (hasMem(e, 'weld') && pct(50)) return enemySkill(e, 'arc', t);
      return enemyAttack(e, t, '鍛造ハンマー', 2);
    case 'golem':
      if (hasMem(e, 'steam') && G.turn % 2 === 0) return enemySkill(e, 'scald');
      if (hasMem(e, 'mirror') && !e.st.mirror && pct(30)) return enemySkill(e, 'mirror');
      return enemyAttack(e, t, '岩の拳', 2.1);
    case 'captain':
      if (hasMem(e, 'missile') && G.turn % 3 === 2) return enemySkill(e, 'barrage');
      if (hasMem(e, 'smoke') && G.turn % 4 === 0) return enemySkill(e, 'smoke');
      if (hasMem(e, 'leech') && pct(50)) return enemySkill(e, 'drain', t);
      return enemyAttack(e, t, '舶刀', 1.6, 2);
    case 'bodyguard':
      if (hasMem(e, 'mirror') && !e.st.mirror && pct(35)) return enemySkill(e, 'mirror');
      if (hasMem(e, 'knuckle') && G.turn % 2 === 0) return enemySkill(e, 'uppercut', t);
      if (hasMem(e, 'baton')) return enemySkill(e, 'zap', t);
      return enemyAttack(e, t, '護身術', 2);
    case 'gastro':
      if (hasMem(e, 'gastro') && G.turn % 3 === 0) return enemySkill(e, 'tasting');
      if (hasMem(e, 'gastro') && G.turn % 4 === 2) return enemySkill(e, 'garnish');
      return enemyAttack(e, t, 'ナイフワーク', 1.4, 3);
    case 'chair':
      if (hasMem(e, 'banquet') && G.turn % 3 === 0) return enemySkill(e, 'feast108');
      if (hasMem(e, 'tongue') && G.turn % 3 === 1) return enemySkill(e, 'optimize', t);
      if (hasMem(e, 'armor') && !e.st.plate && G.turn % 4 === 2) return enemySkill(e, 'plate');
      return enemyAttack(e, t, '回転卓', 2.1);
    case 'final': {
      const half = e.hp < e.maxhp * 0.5;
      if (half && !e.phase2) { e.phase2 = 1; return { tip: '会長が本気を出す。このあと攻撃が激しくなる', label: '実感の解放', danger: true, run() { log(`${e.name}の体に、百八の皿の実感が流れ込んだ`, 'eact'); e.st.boost = 3; heal(e, Math.round(e.maxhp * 0.08)); } }; }
      if (hasMem(e, 'banquet') && G.turn % (half ? 2 : 3) === 0) return enemySkill(e, 'feast108');
      if (hasMem(e, 'tongue') && G.turn % 3 === 1) return enemySkill(e, 'optimize', t);
      if (half && hasMem(e, 'mirror') && !e.st.mirror && pct(30)) return enemySkill(e, 'mirror');
      return enemyAttack(e, t, '会長の一喝', 1.6, 2);
    }
    case 'drone':
      if (hasMem(e, 'shock')) return enemySkill(e, 'spark', t);
      return enemyAttack(e, t, '体当たり', 1.4);
  }
  return enemyAttack(e, t, '攻撃', 2);
}

/* ---------- 進行 ---------- */
function startBattle(def, party) {
  G.battle = def; G.party = party;
  party.forEach(u => { recompute(u); u.hp = u.maxhp; u.alive = true; u.heat = 0; u.st = {}; u.stun = 0; u.side = 'ally'; u._bone = 0; u.dogFor = null; u._chiko = 0; });
  G.sniffed = 0; G.autoOnce = {};
  const es = def.enemies(); es.forEach(e => { e.side0 = 'enemy'; });
  const tk = G.tuneOverride != null ? G.tuneOverride : def.tune;
  if (tk && tk !== 1) es.forEach(e => { e.maxhp = e.hp = Math.round(e.hp * tk); e.atk = Math.round(e.atk * (1 + (tk - 1) * 0.6)); e.def = Math.round(e.def * (1 + (tk - 1) * 0.3)); });
  G.units = party.concat(es);
  G.objs = def.objs();
  G.turn = 0; G.outcome = null; G.special = false; G.log = []; G.cur = null; G.loot = [];
  G.combo = { tid: null, aid: null, count: 0 };
  log(`■ ${def.name}`, 'head'); log(def.intro, 'head');
  if (def.onStart) def.onStart(G);
  if (def.farm) { const cand = es.filter(e => !e.boss && e.ports.length); if (cand.length && pct((def.rareRate || 8) + (party.some(u => hasMem(u, 'lostfound')) ? 12 : 0))) { const e = cand[Math.floor(rnd() * cand.length)], p = e.ports[0];
    e.rare = true; e.name = '★' + e.name; e.maxhp = e.hp = Math.round(e.hp * 1.6); e.atk = Math.round(e.atk * 1.2); e.xp = (e.xp || 10) * 3;
    const r = pct(20) ? 4 : 3; p.inst = mkInst(p.mem, r, null, false); if (r === 4) p.inst.named = true; p.dur = p.maxdur = Math.round((p.maxdur || 30) * 1.5);
    log(`★ ${e.name}がいる。金色のポートが光っている`, 'seep'); } }
  party.forEach(u => {
    const lv = autoObsLevel(u);
    if (lv > 0) { log(`${u.name}の鑑定眼が、戦闘開始と同時に敵全員を解析した(自動観察 Lv${lv})`, 'seep'); es.forEach(e => doObserve(u, e, lv, true)); }
  });
  startTurn();
}
function startTurn() {
  G.turn++;
  log(`── ターン ${G.turn} ──`, 'turn');
  all().forEach(u => { if (u.side === 'enemy' || u.auto) u.intent = u.stun > 0 ? null : chooseIntent(u); });
}
function order() { return all().slice().sort((a, b) => effSpd(b) - effSpd(a) || (a.side === 'ally' ? -1 : 1)); }
function checkEnd() {
  if (!enemies().length) G.outcome = 'win';
  else if (!players().length) G.outcome = 'lose';
  return G.outcome;
}
function resolve(cmds) {
  const acts = [];
  cmds.forEach(c => acts.push({ u: c.actor, prio: c.prio || 0, run: c.run }));
  all().forEach(u => { if (u.side === 'enemy' || u.auto) acts.push({ u, prio: 0, npc: true }); });
  acts.sort((x, y) => y.prio - x.prio || effSpd(y.u) - effSpd(x.u) || (x.npc ? 1 : -1));
  for (const ac of acts) {
    const u = ac.u;
    if (!u.alive) continue;
    G.cur = u.id;
    if (u.stun > 0) { u.stun--; log(`${u.name}は動けない`, 'crash'); continue; }
    if (u.st.charmed) { delete u.st.charmed; log(`${u.name}は、ぼんやりして何もしなかった`, 'crash'); continue; }
    if (ac.npc) {
      if (u.side === 'enemy') G.combo = { tid: null, aid: null, count: 0 };
      if (!u.intent) u.intent = chooseIntent(u);
      u.intent.run();
    } else ac.run();
    if (checkEnd()) break;
  }
  G.cur = null;
  if (!G.outcome) {
    G.units.forEach(u => {
      if (!u.alive) return;
      u.heat = Math.max(0, u.heat - 10 - (u.st.guard ? 15 : 0));
      Object.keys(u.st).forEach(k => { if (typeof u.st[k] === 'number' && --u.st[k] <= 0) delete u.st[k]; });
      if (u.idleHeat) addHeat(u, u.idleHeat);
    });
    G.party.forEach(u => { if (u.alive && u.stun > 0 && !cmds.some(c => c.actor === u)) { u.stun--; log(`${u.name}は再起動中…`, 'crash'); } });
  }
  if (!checkEnd()) startTurn();
  else if (G.outcome === 'win') {
    log(G.special ? '■ 戦闘終了: 刺客は敵ではなくなった' : '■ 勝利', 'head');
    G.party.forEach(u => u.ports.forEach(p => { if (p.mem) gainSeep(u, p.mem, 3); }));
    const xp = Math.round(G.units.filter(u => u.side0 === 'enemy').reduce((s, u) => s + (u.xp || 0), 0) * (G.party.some(u => hasMem(u, 'pointcard')) ? 1.5 : 1) * (G.battle.xpMul || 1) * 1.1);
    G.xpGain = xp; G.lvups = [];
    if (xp) { log(`　経験値 ${xp} を得た`, 'buff'); G.party.forEach(u => { const had = innateOf(u); if (gainXp(u, xp)) { const learn = innateOf(u).filter(x => !had.includes(x)).map(x => SK[x].name); G.lvups.push({ name: u.name, lv: lvText(u), learn }); log(`　${u.name}はレベル${lvText(u)}になった!`, 'seep'); learn.forEach(n => log(`　${u.name}は「${n}」を覚えた!`, 'seep')); } }); }
    if (G.battle.reward) { G.credits += G.battle.reward; log(`　${G.battle.reward}crを手に入れた`, 'buff'); }
  } else log('■ 全滅…', 'head');
}


/* ---------- AUTO戦闘 ----------
   mode: win(勝率重視) / mem(メモリ入手重視) / seep(浸透度上げ) */
const DMGRE = /ダメージ|物理|電撃|炎|冷気|威力|連撃|削る|倒す/;
function skillKind(id) {
  const s = SK[id];
  if (s.passive || id === 'observe') return 'none';
  if (s.tgt === 'port') return id === 'portbreak' ? 'pbreak' : 'steal';
  if (s.tgt === 'ally') return /回復/.test(s.desc) ? 'heal1' : id === 'guard' ? 'none' : 'buff';
  if ((s.tgt === 'self' || s.tgt === 'all') && /味方全員/.test(s.desc) && /回復/.test(s.desc)) return 'healall';
  if (id === 'restock') return 'buff';
  if ((s.tgt === 'enemy' || s.tgt === 'all') && DMGRE.test(s.desc)) return 'dmg';
  return 'buff';
}
function usableSkills(u) {
  return skillsOf(u).map(x => ({ id: x.id, mem: x.mem })).concat(innateOf(u).map(id => ({ id, mem: null })))
    .filter(x => !SK[x.id].passive && x.id !== 'observe');
}
const heatAfter = (u, id) => u.heat + Math.round(SK[id].heat * (u.heatMul || 1));
function autoPlan(mode) {
  const used = { gel: 0, rip: {}, heal: {} }; G.autoOnce = G.autoOnce || {};
  return players().filter(u => u.stun <= 0).map(u => autoAct(u, mode, used)).filter(Boolean);
}
function autoTarget(mode) {
  const es = enemies(), boss = es.find(e => e.boss);
  const fin = es.filter(e => !e.boss && e.hp <= e.maxhp * 0.3).sort((a, b) => a.hp - b.hp)[0];
  if (fin) return fin;
  const minions = es.filter(e => !e.boss).sort((a, b) => a.hp - b.hp);
  return minions[0] || boss;
}
function autoAct(u, mode, used) {
  const es = enemies(); if (!es.length) return null;
  const pl = players(), sk = usableSkills(u);
  const ok = x => heatAfter(u, x.id) < 95;
  // 1. 回復
  const low = pl.filter(x => x.hp < x.maxhp * 0.4 && !used.heal[x.id]).sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp)[0];
  if (low) {
    const hurt = pl.filter(x => x.hp < x.maxhp * 0.6).length;
    const ha = hurt >= 2 && sk.find(x => skillKind(x.id) === 'healall' && ok(x));
    if (ha) { pl.forEach(x => { used.heal[x.id] = 1; }); return A.skill(u, ha.id, ha.mem, null); }
    const h1 = sk.find(x => skillKind(x.id) === 'heal1' && ok(x));
    if (h1) { used.heal[low.id] = 1; return A.skill(u, h1.id, h1.mem, low); }
    if ((G.items.gel || 0) - used.gel > 0 && low.hp < low.maxhp * 0.3) { used.gel++; used.heal[low.id] = 1; return A.item(u, 'gel', low); }
  }
  // 2. 熱
  if (u.heat >= 75) return A.guard(u);
  // 3. メモリ入手重視: ポートを壊してから確実に抜く
  if (mode === 'mem') {
    const ports = [];
    es.forEach(e => e.ports.forEach((p, i) => { if (p.mem && !used.rip[e.id + ':' + i]) ports.push({ e, i, p }); }));
    if (ports.length) {
      const steal = sk.find(x => skillKind(x.id) === 'steal' && ok(x));
      const chance = (x, c) => steal ? (steal.id === 'fetch' ? fetchChance(u, c.e, c.i) : Math.min(100, ripChance(u, c.e, c.i) + (steal.id === 'pick' ? 40 : 30))) : x;
      const best = ports.map(c => ({ c, r: chance(ripChance(u, c.e, c.i), c) })).sort((a, b) => b.r - a.r)[0];
      if (best.r >= (steal && (steal.id === 'fetch' || steal.id === 'pick') ? 40 : 60) || best.c.p.broken) {
        used.rip[best.c.e.id + ':' + best.c.i] = 1;
        return steal ? A.skill(u, steal.id, steal.mem, best.c.e, best.c.i) : u.ports.length || !hasInnate(u, 'fetch') ? A.rip(u, best.c.e, best.c.i) : A.skill(u, 'fetch', null, best.c.e, best.c.i);
      }
      const tgt = ports.filter(c => !c.p.broken).sort((a, b) => a.p.dur - b.p.dur)[0];
      if (tgt) {
        const pb = sk.find(x => x.id === 'portbreak' && ok(x));
        if (pb) return A.skill(u, pb.id, pb.mem, tgt.e, tgt.i);
        return A.attack(u, tgt.e, tgt.i);
      }
    }
  }
  const t = autoTarget(mode);
  // 4. 一度だけ使う補助(強化・撹乱)
  const once = k => G.autoOnce[u.id + ':' + k];
  const buffs = sk.filter(x => skillKind(x.id) === 'buff' && ok(x) && !once(x.id));
  if (mode !== 'seep' && !G.noBuff && buffs.length && (es.some(e => e.boss) || es.length >= 3 || G.turn <= 1)) {
    const b = buffs[0]; G.autoOnce[u.id + ':' + b.id] = 1;
    const s = SK[b.id];
    return A.skill(u, b.id, b.mem, s.tgt === 'enemy' ? (es.find(e => e.boss) || t) : s.tgt === 'ally' ? pl.sort((a, c) => c.atk - a.atk)[0] : null);
  }
  // 5. 浸透度上げ: 浸透の低いメモリの技から順に使う
  if (mode === 'seep') {
    const cand = sk.filter(x => x.mem && seep(u, x.mem) < 100 && ok(x) && skillKind(x.id) !== 'steal' && skillKind(x.id) !== 'pbreak')
      .sort((a, b) => seep(u, a.mem) - seep(u, b.mem) || (skillKind(b.id) === 'dmg') - (skillKind(a.id) === 'dmg'));
    const c = cand.find(x => skillKind(x.id) !== 'heal1' || pl.some(p => p.hp < p.maxhp)) || null;
    if (c) { const s = SK[c.id]; return A.skill(u, c.id, c.mem, s.tgt === 'enemy' ? t : s.tgt === 'ally' ? pl.slice().sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp)[0] : null); }
  }
  // 6. 攻撃技(威力の目安は熱。敵が多いなら全体技)
  const dmg = sk.filter(x => skillKind(x.id) === 'dmg' && ok(x) && !(x.id === 'cannon' && u.hp < u.maxhp * 0.5) && !(x.id === 'meltdown' && u.heat < 60))
    .map(x => ({ x, v: (SK[x.id].heat || 20) * (SK[x.id].tgt === 'all' ? Math.max(0.6, es.length * 0.6) : 1) }))
    .sort((a, b) => b.v - a.v);
  if (dmg.length && !(mode === 'mem' && dmg[0].x && SK[dmg[0].x.id].tgt === 'all' && es.some(e => e.ports.some(p => p.mem)))) {
    const d = dmg[0].x; return A.skill(u, d.id, d.mem, SK[d.id].tgt === 'enemy' ? t : null);
  }
  return A.attack(u, t);
}
const API = { isEvent, EVENTMEM, mastery, RARMUL, autoPlan, skillKind, innateOf, hasInnate, fetchChance, MECH, BRAND, BRANDS, setBonus, setText, lvText, ocNeed, takeMem, giveBack, RECIPE, recipeOf, synthPreview, synthFill, FIXMAX, canFix, fixMem, memTypes, LVMAX, xpNeed, gainXp, WEAPON, profRank, profNext, snapshot, INTEL, RAR, AFX, ITEM, afxText, mkInst, instName, mkUnit, recompute, obsLevel, autoObsLevel, G, MEM, SK, A, BRIBE, startBattle, resolve, order, all, foes, enemies, players, unit, effAtk, effSpd, hasMem, seep, skillsOf, gainSeep, ripChance, hackChance, threatChance, hitChance };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.CH = API;
})(typeof window !== 'undefined' ? window : globalThis);

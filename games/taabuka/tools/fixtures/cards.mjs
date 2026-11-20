// 試し用の仮の札と敵（データだけ。ブラウザの試し場からも読む）。content/ には入れない

// 仮の札20枚（初期デッキと同じTierの内訳17枚＋3枚）
const C = (id, name, _tier, cat, grade = '並') => ({ id, name, cat, grade });   // Tier は番付で決まる（3つ目の値は昔の名残）
export const CARDS = [
  C('fx_teishoku', '仮・定食', 0, ['食べ物']),
  C('fx_kaku', '仮・角', 1, ['ター']),
  C('fx_maap', '仮・女将', 1, ['宿', '老']),
  C('fx_ramen', '仮・ラーメン', 2, ['麺', '食べ物']),
  C('fx_onsen', '仮・源泉', 2, ['湯']),
  C('fx_robo', '仮・掃除ロボ', 2, ['ロボ']),
  C('fx_neko', '仮・猫', 3, ['動物']),
  C('fx_sure', '仮・スレ主', 3, ['スレ']),
  C('fx_kotei', '仮・白線', 3, ['校庭']),
  C('fx_soba', '仮・かけそば', 3, ['麺']),
  C('fx_hayai', '仮・秒速', 4, ['速さ']),
  C('fx_kakuge', '仮・波動', 4, ['格ゲー']),
  C('fx_rou', '仮・相当老', 4, ['老']),
  C('fx_hone', '仮・骨', 5, ['死']),
  C('fx_inu', '仮・犬', 5, ['動物']),
  C('fx_yu', '仮・湯桶', 5, ['湯', '宿']),
  C('fx_kaeru', '仮・蛙', 8, ['動物', '湯']),
  C('fx_god', '仮・ター', 'God', ['ター']),
  C('fx_udon', '仮・うどん', 1, ['麺']),
  C('fx_tare', '仮・タレ', 3, ['食べ物']),
];

// B1の敵（仕様書 第8章 第一層）
export const ENEMIES = [
  { id: 'en_niwaka', name: 'にわか', kind: '通常', hp: 0.9, atk: 1.0, acts: ['攻め', '攻め', { 伏せ: 1 }], line: 'それって強いんですか' },
  { id: 'en_teiki', name: '定期', kind: '通常', hp: 1.0, atk: 0.8, acts: ['攻め'], line: '定期' },
  { id: 'en_copipe', name: 'コピペ', kind: '通常', hp: 0.6, atk: 0.9, acts: ['攻め', { 呼ぶ: 'en_copipe' }], line: '（以下略）' },
  { id: 'en_jien', name: '自演', kind: '通常', hp: 1.1, atk: 1.0, acts: [{ 居座り: 0.15 }, '攻め'], line: 'ですよね（ですよね）' },
  { id: 'en_tsuri', name: '釣り', kind: '通常', hp: 0.8, atk: 1.3, acts: ['溜め', '攻め'], line: '釣れた' },
  { id: 'en_kaiko', name: '懐古', kind: '通常', hp: 1.2, atk: 0.9, acts: ['攻め', { 封じ: '最多カテゴリ' }], line: '昔のター宿はよかった' },
];


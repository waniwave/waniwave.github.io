// base.js — 基本の仕組みのデータ
import { fx } from '../js/engine/registry.js';

export default {
  id: 'base', name: '基本',

  // 基本ルールの数値（後のパックで上書きできる）
  rules: {
    board: {
      cols: 5, rows: 7, spineCol: 2,  // 5×7、主脊髄は中央列
      minChain: 3,                     // 連結の成立に必要な個数
      mergeMin: 4,                     // 圧縮進化の最小の塊
      mergeChainLimit: 2,              // 1回の落下での連鎖合体の上限
      mergeTrigger: 'moved',           // 合体のきっかけ：'moved'＝落ちてきた既存ノード / 'any'＝補充ノードも含む
      mergePerPass: 1,                 // 1回の判定で合体する塊の数（大きい順。0 で無制限）
      mergeKeepPulse: false,           // 合体で消えたノードの脈動節を残ったノードへ移すか
      shockRange: 2,                   // 主脊髄の衝撃波が癒着・壊死を解除する距離（通常は1）
      spineMul: 2,                     // 主脊髄の出力倍率
    },
    fire: { time: 5.0, fallTime: 0.2 },
    combat: {
      startMult: 1,                         // 初期倍率
      chainBonus: 0.1,                      // 連結数ボーナス ×(1 + 0.1 × (n−1))
      longBonus: [[6, 1.25], [10, 1.5]],    // 長連結ボーナス [個数, 倍率]
      bigChain: 10, bigChainGauge: 10,      // 10個以上の連結で脊髄臨界ゲージ +10%
      mutagenSlots: 5, ampouleSlots: 2,
    },
    spineBreak: { max: 100, mul: 3, timeScale: 0.5 },
    backflow: { perTurn: 8, perHit: 10, reliefCount: 8, relief: 15, max: 100 },
    // 演出の段階（13.1）。shake は px、hitstop は ms
    juice: { smallChain: 6, midChain: 10, small: 3, mid: 5, big: 10, hitstop: 50 },
    evalAnim: { stepMs: 170, holdMs: 650 },
    audio: { bpm: 128, bossBpm: 138, lpLow: 400, lpHigh: 4500, lpFullNodes: 30 },
    themeBoss: { bg: '#0B0204', panel: '#1A0609', line: '#5C1522', pulse: '#FF2A4B', text: '#F2D5D9', dim: '#9A5A64' },
    theme: {
      bg: '#060C0E', panel: '#0E1A1D', line: '#233D42',
      alert: '#FF2A4B', pulse: '#3BE8FF', text: '#CFE3E6', dim: '#6F8A8F',
    },
  },

  nodes: [
    // 色ノード（出現率 weight の比で抽選）
    { id: 'MARROW', name: '白骨', code: 'MARROW', kind: 'color', color: '#F2EFE9', symbol: 'bone', weight: 1, base: 10, mult: 0 },
    { id: 'VENOM', name: '神経毒', code: 'VENOM', kind: 'color', color: '#B8F227', symbol: 'drop', weight: 1, base: 2, mult: 1 },
    { id: 'SYNAPSE', name: 'シナプス', code: 'SYNAPSE', kind: 'color', color: '#C63BFF', symbol: 'bolt', weight: 1, base: 2, mult: 0, myelin: 5, gauge: 4 },
    // 重なる印
    { id: 'PULSE', name: '脈動節', code: 'PULSE NODE', kind: 'overlay', color: '#3BE8FF', symbol: 'pulse', chance: 0.06, time: 1.5 },
    // 圧縮進化（tier 順。minSize は塊の大きさの下限）
    { id: 'CMP1', name: 'CMP.1', kind: 'cmp', tier: 1, minSize: 4, valueMul: 4, mult: 0, look: 'ring' },
    { id: 'CMP2', name: 'CMP.2', kind: 'cmp', tier: 2, minSize: 6, valueMul: 10, mult: 1, look: 'poly' },
    { id: 'BOMB', name: 'BOMB', kind: 'cmp', tier: 3, minSize: 8, valueMul: 10, mult: 2, blast: 1, look: 'organ' },
    // 特殊ノード
    { id: 'WEAKPOINT', name: '露出神経', kind: 'special', chainable: true, look: 'bracket' },
    { id: 'VIRUS', name: '時限ウイルス', kind: 'special', chainable: true, count: 3, syncDamage: 20, reflect: 2, look: 'countdown' },
    { id: 'ADHESION', name: '癒着', kind: 'special', chainable: false, onAdjacentClear: 'release', look: 'web' },
    { id: 'NECROSIS', name: '壊死', kind: 'special', chainable: false, colorless: true, onAdjacentClear: 'purify', look: 'necrosis' },
  ],

  // 系統（STRAIN）
  strains: [
    { id: 'NONE', name: 'なし', icon: '○' },
    { id: 'LONG', name: '長連結', icon: '━' },
    { id: 'RAPID', name: '連打', icon: '≡' },
    { id: 'CMP', name: '圧縮', icon: '◆' },
    { id: 'SPINE', name: '脊髄', icon: '┃' },
    { id: 'DESPERATE', name: '背水', icon: '▼' },
    { id: 'SHELL', name: '外殻', icon: '⬡' },
  ],

  // レアリティ（変異因子は group: 'mutagen'）
  rarities: [
    { id: 'COMMON', name: 'COMMON', group: 'mutagen', tier: 1, color: '#7E9294' },
    { id: 'UNCOMMON', name: 'UNCOMMON', group: 'mutagen', tier: 2, color: '#4F9BFF' },
    { id: 'RARE', name: 'RARE', group: 'mutagen', tier: 3, color: '#FF9F43' },
    { id: 'ANOMALY', name: 'ANOMALY', group: 'mutagen', tier: 4, color: '#FFE066' },
    { id: 'SINGULARITY', name: 'SINGULARITY', group: 'mutagen', tier: 5, color: '#FFFFFF' },
  ],

  // 変異因子（潜行中のみ）。label はドックに出す短い表示
  mutagens: [
    { id: 'm_bone_density', name: '骨密度ブースター', label: '白骨+5', strain: 'NONE', rarity: 'COMMON',
      desc: 'MARROW の基礎値 +5', effect: fx.perNode(fx.colorIs('MARROW'), fx.addBase(5)) },
    { id: 'm_corrosion', name: '腐食促進剤', label: '8毒 M+3', strain: 'LONG', rarity: 'COMMON',
      desc: '8個以上の神経毒の連結1つにつき +Mult 3', effect: fx.perChain([fx.lenAtLeast(8), fx.colorIs('VENOM')], fx.addMult(3)) },
    { id: 'm_reflex_arc', name: '反射弓', label: '時間+1s', strain: 'RAPID', rarity: 'UNCOMMON',
      desc: '発火時間 +1.0s', effect: fx.addFireTime(1.0) },
    { id: 'm_alternate', name: '交互発火', label: '交互 M+1', strain: 'RAPID', rarity: 'UNCOMMON',
      desc: '直前と違う色の連結を成立させるたびに +Mult 1', effect: fx.perChain(fx.colorChanged(), fx.addMult(1)) },
    { id: 'm_spine_resonance', name: '背骨共鳴', label: '脊髄 ×1.5', strain: 'SPINE', rarity: 'RARE',
      desc: '主脊髄を3個以上通る連結1つにつき ×Mult 1.5', effect: fx.perChain(fx.onSpine(3), fx.mulMult(1.5)) },
    { id: 'm_compress_catalyst', name: '圧縮触媒', label: '圧縮 ×2', strain: 'CMP', rarity: 'RARE',
      desc: 'CMP を含む連結があるターンは ×Mult 2', effect: fx.when(fx.hasCMP(), fx.mulMult(2)) },
    { id: 'm_crit_echo', name: '臨界残響', label: '臨界残響', strain: 'SPINE', rarity: 'ANOMALY',
      desc: '脊髄臨界の次のターンにも、半分の効果（×1.5・減速1/4）が残る', effect: fx.spineEcho(1.5, 0.75) },
    { id: 'm_net_identity', name: '神経網同一化', label: '色数 ×3', strain: 'NONE', rarity: 'SINGULARITY',
      desc: 'そのターンに消した色の種類1つにつき ×Mult 3', effect: fx.perColorKind(fx.mulMult(3)) },
    { id: 'm_synapse_hyper', name: 'シナプス過敏', label: '外殻+3', strain: 'SHELL', rarity: 'COMMON',
      desc: 'SYNAPSE の髄鞘外殻 +3', effect: fx.perNode(fx.colorIs('SYNAPSE'), fx.addMyelin(3)) },
    { id: 'm_myelin_convert', name: '髄鞘転化', label: '外殻→基礎', strain: 'SHELL', rarity: 'UNCOMMON',
      desc: '発火開始時の髄鞘外殻の量を基礎値に加算', effect: fx.myelinToBase(1) },
    { id: 'm_gangrene', name: '壊疽', label: '瀕死 ×1.5', strain: 'DESPERATE', rarity: 'COMMON',
      desc: 'SYNC 50%以下のとき ×Mult 1.5', effect: fx.when(fx.syncBelow(50), fx.mulMult(1.5)) },
    { id: 'm_backflow_sync', name: '汚染同調', label: '汚染 ×2', strain: 'DESPERATE', rarity: 'UNCOMMON',
      desc: '逆流汚染 50%以上のとき ×Mult 2', effect: fx.when(fx.backflowAbove(50), fx.mulMult(2)) },
    { id: 'm_long_axon', name: '長索伸張', label: '6連 基礎×1.5', strain: 'LONG', rarity: 'UNCOMMON',
      desc: '6個以上の連結の基礎値 ×1.5', effect: fx.perChain(fx.lenAtLeast(6), fx.baseMul(1.5)) },
    { id: 'm_pulse_amp', name: '脈動増幅', label: '脈動+1s', strain: 'LONG', rarity: 'ANOMALY',
      desc: '脈動節の延長 +1.0s', effect: fx.addPulseTime(1.0) },
    { id: 'm_spasm_chain', name: '連鎖痙攣', label: '連結+0.1', strain: 'RAPID', rarity: 'RARE',
      desc: '連結数ボーナス +0.1/連結', effect: fx.addChainBonus(0.1) },
    { id: 'm_trabecula', name: '骨梁結晶', label: 'CMP+20', strain: 'CMP', rarity: 'COMMON',
      desc: 'CMP ノードの基礎値 +20（CMP の倍率がかかる前）', effect: fx.perNode(fx.hasCMP(), fx.addBase(20)) },
    { id: 'm_polymer_core', name: '重合核', label: '圧縮連 M+2', strain: 'CMP', rarity: 'UNCOMMON',
      desc: 'CMP を含む連結1つにつき +Mult 2', effect: fx.perChain(fx.hasCMP(), fx.addMult(2)) },
    { id: 'm_spine_focus', name: '脊柱集束', label: '脊髄+6', strain: 'SPINE', rarity: 'COMMON',
      desc: '主脊髄で消えたノードの基礎値 +6（2倍の前）', effect: fx.perNode(fx.onSpine(), fx.addBase(6)) },
    { id: 'm_last_scream', name: '前任者の断末魔', label: '瀕死 再発動', strain: 'DESPERATE', rarity: 'RARE',
      desc: 'SYNC 30%以下のとき、最も長い連結の基礎値をもう1回加算', effect: fx.when(fx.syncBelow(30), fx.retrigger(1)) },
    { id: 'm_omega_echo', name: 'Ω残響', label: '10連 再発動', strain: 'LONG', rarity: 'SINGULARITY',
      desc: '10個以上の連結の基礎値を、もう1回加算', effect: fx.perChain(fx.lenAtLeast(10), fx.retrigger(1)) },
  ],

  // 神経アンプル（思考フェーズ中のみ）。target: none / row / color / color2
  ampoules: [
    { id: 'amp_cold', name: '冷結アンプル', label: '冷結', use: 'freeze', value: 5, target: 'none',
      desc: 'そのターンの発火時間が、最初の5秒間減らない' },
    { id: 'amp_sync', name: '同調アンプル', label: '同調', use: 'recolor', target: 'color2',
      desc: '盤面の色を1つ選び、その色のノードをすべて別の指定した色に変える' },
    { id: 'amp_regen', name: '再生アンプル', label: '再生', use: 'heal', value: 30, target: 'none',
      desc: 'SYNC +30%' },
    { id: 'amp_burn', name: '焼灼アンプル', label: '焼灼', use: 'burnRow', target: 'row',
      desc: '指定した横1列のノードをすべて焼き消す（基礎値は加算される。特殊ノードも消える）' },
    { id: 'amp_magnet', name: '磁化アンプル', label: '磁化', use: 'magnet', range: 1, target: 'color',
      desc: '指定した1色のノードを、主脊髄とその両隣の列に集める' },
    { id: 'amp_rewind', name: '逆行アンプル', label: '逆行', use: 'rewind', target: 'none', rare: true,
      desc: '直前のターンの開始時点（盤面・SYNC・髄鞘外殻・逆流汚染）まで巻き戻す。1階層に1回まで' },
  ],
};

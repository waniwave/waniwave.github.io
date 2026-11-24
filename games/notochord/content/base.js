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
      mergeChainLimit: 0,              // 1回の落下での連鎖合体の上限（仕様書は2。段階3の調整で0）
      mergeTrigger: 'moved',           // 合体のきっかけ：'moved'＝落ちてきた既存ノード / 'any'＝補充ノードも含む
      mergePerPass: 1,                 // 1回の判定で合体する塊の数（大きい順。0 で無制限）
      mergeKeepPulse: false,           // 合体で消えたノードの脈動節を残ったノードへ移すか
      shockRange: 2,                   // 主脊髄の衝撃波が癒着・壊死を解除する距離（通常は1）
      spineMul: 2,                     // 主脊髄の出力倍率
    },
    // traceSlow：なぞっている間の時間の進み（0.3 なら 0.3 倍の速さ）。holdTrace：時間切れでもなぞり中の連結は指を離すまで切らない
    fire: { time: 5.0, fallTime: 0.2, traceSlow: 0.3, holdTrace: true },
    combat: {
      startMult: 1,                         // 初期倍率
      chainBonus: 0.1,                      // 連結数ボーナス ×(1 + 0.1 × (n−1))
      longBonus: [[6, 1.25], [10, 1.5]],    // 長連結ボーナス [個数, 倍率]
      bigChain: 10, bigChainGauge: 10,      // 10個以上の連結で脊髄臨界ゲージ +10%
      mutagenSlots: 5, ampouleSlots: 2,
    },
    spineBreak: { max: 100, mul: 3, timeScale: 0.5, gainDuringCrit: false },   // 臨界中のターンはゲージが溜まらない（臨界が毎ターン続くのを防ぐ）
    backflow: { perTurn: 8, perHit: 10, reliefCount: 8, relief: 15, max: 100 },
    // 演出の段階（13.1）。shake は px、hitstop は ms
    juice: { smallChain: 6, midChain: 10, small: 3, mid: 5, big: 10, hitstop: 50 },
    evalAnim: { stepMs: 170, holdMs: 650 },
    audio: { bpm: 92, bossBpm: 100, lpLow: 300, lpHigh: 3500, lpFullNodes: 30 },   // ダークで重い BGM（段階4の調整）
    // 潜行の進行（4章・8.5・10章）
    run: { diveHeal: 15, residue: 0.3, finalBonus: 1.5, overkill: 2, overkillBonus: 0.2, rewardSyn: 0.5, ampouleDrop: 0.2,
           mutagenChoices: 3, strainWeight: 3 },
    vertebra: {
      regions: [
        { id: 'CERVICAL', name: '頸椎', short: '頸', unlock: null },
        { id: 'THORACIC', name: '胸椎', short: '胸', unlock: 'socket:THORACIC' },
        { id: 'LUMBAR', name: '腰椎', short: '腰', unlock: 'socket:LUMBAR' },
        { id: 'SACRAL', name: '仙椎', short: '仙', unlock: 'socket:SACRAL' },
      ],
      auxFlag: 'socket2:',        // 補助ソケット（深淵で開く）。フラグ 'socket2:CERVICAL' など
      resonance: [2, 4, 6, 8],    // 系統共鳴の段階
    },
    shop: {
      stock: 4, price: { STANDARD: 150, REFINED: 600, PROTOTYPE: 2500 }, affixPrice: 0.3, strainMul: 1.8, sellRate: 0.3,
      vaultBase: 20, vaultStep: 5, vaultPrice: 400, ampoulePrice: 120, ampouleRarePrice: 900,
      optic: [{ lv: 1, price: 0 }, { lv: 2, price: 300 }, { lv: 3, price: 1200 }],
    },
    // 熟練度（8.7.1）：経歴点の Lv 境目。Lv ごとに発火時間 +0.1s・SYNC 最大 +1
    career: { levels: [0, 4, 10, 20, 35, 55, 80, 110, 150, 200, 260], fireTime: 0.1, syncMax: 1, finalMul: 2,
              preserveMin: 3, choices: [[3, 2], [6, 3], [9, 4]], tierByLevel: [[3, 1], [6, 2], [9, 3]], tierUpChance: 0.3 },
    protocol: { base: 1, max: 5, flagPrefix: 'protocol_' },
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
    { id: 'SYNAPSE', name: 'シナプス', code: 'SYNAPSE', kind: 'color', color: '#C63BFF', symbol: 'bolt', weight: 1, base: 5, mult: 0, myelin: 0.5, gauge: 1.5 },   // 段階3の調整：myelin は仕様書の5→0.5、gauge は4%→1.5%
    // 重なる印
    { id: 'PULSE', name: '脈動節', code: 'PULSE NODE', kind: 'overlay', color: '#3BE8FF', symbol: 'pulse', chance: 0.03, time: 1.5 },   // chance：仕様書は6%。段階3の調整で3%
    // 圧縮進化（tier 順。minSize は塊の大きさの下限）
    { id: 'CMP1', name: 'CMP.1', kind: 'cmp', tier: 1, minSize: 4, valueMul: 4, mult: 0, look: 'ring' },
    { id: 'CMP2', name: 'CMP.2', kind: 'cmp', tier: 2, minSize: 6, valueMul: 10, mult: 1, look: 'poly' },
    { id: 'BOMB', name: 'BOMB', kind: 'cmp', tier: 3, minSize: 8, valueMul: 10, mult: 2, blast: 1, look: 'organ' },
    // 特殊ノード
    { id: 'WEAKPOINT', name: '露出神経', kind: 'special', chainable: true, look: 'bracket' },
    { id: 'VIRUS', name: '時限ウイルス', kind: 'special', chainable: true, count: 3, syncDamage: 20, reflect: 2, look: 'countdown' },
    { id: 'ADHESION', name: '癒着', kind: 'special', chainable: false, onAdjacentClear: 'release', look: 'web' },
    { id: 'NECROSIS', name: '壊死', kind: 'special', chainable: false, colorless: true, onAdjacentClear: 'purify', look: 'necrosis' },
    { id: 'WRECK', name: '残骸', kind: 'special', chainable: true, look: 'wreck' },
  ],

  // 系統（STRAIN）と系統共鳴（8.2.3）。resonance の effect の '$' は base（寄生株などで増える）に置き換わる
  strains: [
    { id: 'NONE', name: 'なし', icon: '○' },
    { id: 'LONG', name: '長連結', icon: '━', resonance: [
      { at: 2, label: '長連結 5個から', effect: fx.longBonusShift(-1) },
      { at: 4, label: '10連 値×3', base: 3, effect: fx.perChain(fx.lenAtLeast(10), fx.baseMul('$')) },
      { at: 6, label: '脈動節 2倍', base: 1, effect: fx.pulseChanceMul('$') },
      { at: 8, label: '最長 再発動', effect: fx.retrigger(1) } ] },
    { id: 'RAPID', name: '連打', icon: '≡', resonance: [
      { at: 2, label: '連結数 +0.05', base: 0.05, effect: fx.addChainBonus('$') },
      { at: 4, label: '落下 0.1s', effect: fx.fallTime(-0.1) },
      { at: 6, label: '連結ごと +0.2s', base: 0.2, effect: fx.timePerChain('$') },
      { at: 8, label: '連結数 ×1.15^n', base: 1.15, effect: fx.chainBonusPow('$') } ] },
    { id: 'CMP', name: '圧縮', icon: '◆', resonance: [
      { at: 2, label: '連鎖合体 +1', effect: fx.mergeLimit(1) },
      { at: 4, label: 'CMP 値×1.5', base: 1.5, effect: fx.perNode(fx.hasCMP(), fx.baseMul('$')) },
      { at: 6, label: 'BOMB 範囲2', effect: fx.bombRange(1) },
      { at: 8, label: '合体ごと 倍率+2', base: 2, effect: fx.multPerMerge('$') } ] },
    { id: 'SPINE', name: '脊髄', icon: '┃', resonance: [
      { at: 2, label: '臨界ゲージ +25%', base: 25, effect: fx.addGauge('$') },
      { at: 4, label: '主脊髄 3倍', base: 1, effect: fx.spineMulAdd('$') },
      { at: 6, label: '臨界 ×5', base: 2, effect: fx.critMulAdd('$') },
      { at: 8, label: '主脊髄 常に全色', effect: fx.alwaysWild() } ] },
    { id: 'DESPERATE', name: '背水', icon: '▼', resonance: [
      { at: 2, label: 'SYNC50%↓ ×1.5', base: 0.5, effect: fx.when(fx.syncBelow(50), fx.metaMul('1+$')) },
      { at: 4, label: '逆流50%↑ ×2', base: 1, effect: fx.when(fx.backflowAbove(50), fx.metaMul('1+$')) },
      { at: 6, label: '被弾の次 ×2', base: 1, effect: fx.when(fx.hitLastTurn(), fx.metaMul('1+$')) },
      { at: 8, label: '踏みとどまる・最大×10', base: 10, effect: [fx.lastStand(), fx.syncScale('$')] } ] },
    { id: 'SHELL', name: '外殻', icon: '⬡', resonance: [
      { at: 2, label: '外殻獲得 +50%', base: 0.5, effect: fx.myelinGainMul('$') },
      { at: 4, label: '外殻 半分持ち越し', base: 0.5, effect: fx.myelinCarry('$') },
      { at: 6, label: '外殻→基礎値', base: 1, effect: fx.myelinToBase('$') },
      { at: 8, label: '外殻/10→倍率', base: 0.1, effect: fx.myelinToMult('$') } ] },
  ],

  // レアリティ（変異因子は group: 'mutagen'）
  rarities: [
    { id: 'COMMON', name: 'COMMON', group: 'mutagen', tier: 1, color: '#7E9294' },
    { id: 'UNCOMMON', name: 'UNCOMMON', group: 'mutagen', tier: 2, color: '#4F9BFF' },
    { id: 'RARE', name: 'RARE', group: 'mutagen', tier: 3, color: '#FF9F43' },
    { id: 'ANOMALY', name: 'ANOMALY', group: 'mutagen', tier: 4, color: '#FFE066' },
    { id: 'SINGULARITY', name: 'SINGULARITY', group: 'mutagen', tier: 5, color: '#FFFFFF' },
    // 椎骨義体（8.2.2）：mul は基本効果の倍率、affixes は副次変異の数 [最小, 最大]
    { id: 'STANDARD', name: 'STANDARD', group: 'vertebra', tier: 1, color: '#8A9496', mul: 1.0, affixes: [0, 0] },
    { id: 'REFINED', name: 'REFINED', group: 'vertebra', tier: 2, color: '#F2EFE9', mul: 1.5, affixes: [1, 1] },
    { id: 'PROTOTYPE', name: 'PROTOTYPE', group: 'vertebra', tier: 3, color: '#3BE8FF', mul: 2.5, affixes: [1, 2] },
    { id: 'FORBIDDEN', name: 'FORBIDDEN', group: 'vertebra', tier: 4, color: '#FFC83D', mul: 4.0, affixes: [2, 2] },
    { id: 'LOT_OMEGA', name: 'LOT-Ω', group: 'vertebra', tier: 5, color: '#B8A8FF', mul: 6.0, affixes: [3, 3], exclusive: true },   // exclusive：昇格では出ない
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

  // 椎骨義体（8.2.4）。base は STANDARD 時の数値。'$' は base × レアリティ倍率に置き換わる
  vertebrae: [
    // ---- 頸椎：知覚・時間 ----
    { id: 'v_optic_ext', name: '拡張視索', region: 'CERVICAL', strain: 'LONG', base: 1.0, label: '脈動 +$s',
      desc: '脈動節の延長 +$s', effect: fx.addPulseTime('$') },
    { id: 'v_reflex_bundle', name: '反射神経束', region: 'CERVICAL', strain: 'RAPID', base: 0.5, label: '時間 +$s',
      desc: '発火時間 +$s、落下時間 −0.05s', effect: [fx.addFireTime('$'), fx.fallTime(-0.05)] },
    { id: 'v_compress_view', name: '圧縮視野', region: 'CERVICAL', strain: 'CMP', base: 0.3, label: 'CMP連 +$s',
      desc: 'CMP を含む連結が成立するたびに発火時間 +$s', effect: fx.perChain(fx.hasCMP(), fx.timePerChain('$')) },
    { id: 'v_medulla_bypass', name: '延髄バイパス', region: 'CERVICAL', strain: 'SPINE', base: 1, label: '臨界中 減速',
      desc: '脊髄臨界中、発火時間の減りがさらに半分', effect: fx.critSlow(0.5) },
    { id: 'v_crisis_sense', name: '危機知覚', region: 'CERVICAL', strain: 'DESPERATE', base: 1.0, label: '瀕死 +$s',
      desc: 'SYNC 50%以下のとき発火時間 +$s', effect: fx.when(fx.syncBelow(50), fx.addFireTime('$')) },
    { id: 'v_membrane_sense', name: '被膜感覚', region: 'CERVICAL', strain: 'SHELL', base: 0.6, label: '外殻 +$s',
      desc: '髄鞘外殻 20 以上のとき発火時間 +$s', effect: fx.when(fx.myelinAbove(20), fx.addFireTime('$')) },
    { id: 'v_retina_ext', name: '網膜延長', region: 'CERVICAL', strain: 'LONG', base: 0.3, label: '時間 +$s',
      desc: '発火時間 +$s、脈動節の出現率 +2%', effect: [fx.addFireTime('$'), fx.pulseChance(0.02)] },
    { id: 'v_blink_reflex', name: '瞬目反射', region: 'CERVICAL', strain: 'RAPID', base: 0.1, label: '連結 +$s',
      desc: '連結が成立するたびに発火時間 +$s', effect: fx.timePerChain('$') },
    { id: 'v_vagal_relay', name: '迷走中継', region: 'CERVICAL', strain: 'SPINE', base: 10, label: '臨界 +$%',
      desc: '脊髄臨界ゲージの溜まり +$%', effect: fx.addGauge('$'), unlock: 'cleared:rank_c' },
    // ---- 胸椎：質量 ----
    { id: 'v_trabecular', name: '骨梁圧縮器', region: 'THORACIC', strain: 'CMP', base: 0.3, label: 'CMP 値+$',
      desc: 'CMP の値 ×(1+$)', effect: fx.perNode(fx.hasCMP(), fx.baseMul('1+$')) },
    { id: 'v_thoracic_amp', name: '胸髄増幅板', region: 'THORACIC', strain: 'SPINE', base: 10, label: '脊白骨 +$',
      desc: '主脊髄で消えた MARROW の基礎値 +$', effect: fx.perNode([fx.onSpine(), fx.colorIs('MARROW')], fx.addBase('$')) },
    { id: 'v_long_frame', name: '長骨フレーム', region: 'THORACIC', strain: 'LONG', base: 0.2, label: '8連 基礎+$',
      desc: '8個以上の連結の基礎値 ×(1+$)', effect: fx.perChain(fx.lenAtLeast(8), fx.baseMul('1+$')) },
    { id: 'v_short_bones', name: '短骨連鎖', region: 'THORACIC', strain: 'RAPID', base: 8, label: '3連結 +$',
      desc: '連結が3つ以上のターン、連結1つにつき基礎値 +$', effect: fx.when(fx.chainsAtLeast(3), fx.perChain(null, fx.addBase('$'))) },
    { id: 'v_fracture_harden', name: '骨折硬化', region: 'THORACIC', strain: 'DESPERATE', base: 8, label: '瀕死 白骨+$',
      desc: 'SYNC 50%以下のとき MARROW の基礎値 +$', effect: fx.when(fx.syncBelow(50), fx.perNode(fx.colorIs('MARROW'), fx.addBase('$'))) },
    { id: 'v_bone_shell', name: '骨殻', region: 'THORACIC', strain: 'SHELL', base: 6, label: 'シナプス +$',
      desc: 'SYNAPSE の基礎値 +$', effect: fx.perNode(fx.colorIs('SYNAPSE'), fx.addBase('$')) },
    { id: 'v_fused_plate', name: '融合骨板', region: 'THORACIC', strain: 'CMP', base: 15, label: 'CMP 基礎+$',
      desc: 'CMP ノードの基礎値 +$（CMP の倍率の前）', effect: fx.perNode(fx.hasCMP(), fx.addBase('$')) },
    { id: 'v_vertebral_brace', name: '椎体補強', region: 'THORACIC', strain: 'SPINE', base: 4, label: '主脊髄 +$',
      desc: '主脊髄で消えたノードの基礎値 +$', effect: fx.perNode(fx.onSpine(), fx.addBase('$')) },
    { id: 'v_shell_mass', name: '外殻質量', region: 'THORACIC', strain: 'SHELL', base: 0.5, label: '外殻→基礎',
      desc: '髄鞘外殻 × $ を基礎値に加算', effect: fx.myelinToBase('$'), unlock: 'cleared:rank_c' },
    // ---- 腰椎：毒性 ----
    { id: 'v_toxin_pump', name: '毒腺ポンプ', region: 'LUMBAR', strain: 'RAPID', base: 2, label: '4連結 倍率+$',
      desc: '連結が4つ以上のターン、+Mult $', effect: fx.when(fx.chainsAtLeast(4), fx.addMult('$')) },
    { id: 'v_gangrene_cat', name: '壊疽触媒', region: 'LUMBAR', strain: 'DESPERATE', base: 0.5, label: '瀕死 ×1+$',
      desc: 'SYNC 30%以下のとき ×Mult (1+$)', effect: fx.when(fx.syncBelow(30), fx.mulMult('1+$')) },
    { id: 'v_venom_sac', name: '持続毒嚢', region: 'LUMBAR', strain: 'LONG', base: 0.5, label: '10毒 ×1+$',
      desc: '10個以上の神経毒の連結で ×Mult (1+$)', effect: fx.perChain([fx.lenAtLeast(10), fx.colorIs('VENOM')], fx.mulMult('1+$')) },
    { id: 'v_concentrate', name: '濃縮毒腺', region: 'LUMBAR', strain: 'CMP', base: 1.5, label: 'CMP連 倍率+$',
      desc: 'CMP を含む連結1つにつき +Mult $', effect: fx.perChain(fx.hasCMP(), fx.addMult('$')) },
    { id: 'v_spinal_venom', name: '脊髄毒線', region: 'LUMBAR', strain: 'SPINE', base: 1, label: '脊髄連 倍率+$',
      desc: '主脊髄を2個以上通る連結1つにつき +Mult $', effect: fx.perChain(fx.onSpine(2), fx.addMult('$')) },
    { id: 'v_membrane_toxin', name: '膜毒', region: 'LUMBAR', strain: 'SHELL', base: 0.3, label: '外殻 ×1+$',
      desc: '髄鞘外殻 15 以上のとき ×Mult (1+$)', effect: fx.when(fx.myelinAbove(15), fx.mulMult('1+$')) },
    { id: 'v_axon_toxin', name: '長索毒', region: 'LUMBAR', strain: 'LONG', base: 1, label: '6連 倍率+$',
      desc: '6個以上の連結1つにつき +Mult $', effect: fx.perChain(fx.lenAtLeast(6), fx.addMult('$')) },
    { id: 'v_barrage_toxin', name: '連打毒', region: 'LUMBAR', strain: 'RAPID', base: 0.5, label: '交互 倍率+$',
      desc: '直前と違う色の連結1つにつき +Mult $', effect: fx.perChain(fx.colorChanged(), fx.addMult('$')) },
    { id: 'v_backflow_toxin', name: '汚染毒', region: 'LUMBAR', strain: 'DESPERATE', base: 0.4, label: '逆流 ×1+$',
      desc: '逆流汚染 30%以上のとき ×Mult (1+$)', effect: fx.when(fx.backflowAbove(30), fx.mulMult('1+$')), unlock: 'cleared:rank_b' },
    // ---- 仙椎：代謝・経済・生存 ----
    { id: 'v_myelin_loom', name: '髄鞘織機', region: 'SACRAL', strain: 'SHELL', base: 3, label: '外殻 +$',
      desc: 'SYNAPSE の髄鞘外殻 +$', effect: fx.perNode(fx.colorIs('SYNAPSE'), fx.addMyelin('$')) },
    { id: 'v_sacral_fuse', name: '仙骨ヒューズ', region: 'SACRAL', strain: 'DESPERATE', base: 20, label: '残留 +$%',
      desc: 'ロスト時の残留SYN +$%（基本 30%）', effect: fx.residueRate('$') },
    { id: 'v_culture_medium', name: '代謝培地', region: 'SACRAL', strain: 'CMP', base: 5, label: 'ポート+1',
      desc: '首筋ポート +1枠、BOMB 発生時に SYN +$', effect: [fx.ampouleSlots(1), fx.synPerBomb('$')] },
    { id: 'v_nutrient_cord', name: '栄養索', region: 'SACRAL', strain: 'LONG', base: 10, label: 'SYN +$%',
      desc: '階層撃破の SYN +$%', effect: fx.synGain('$') },
    { id: 'v_metabolic_accel', name: '代謝加速', region: 'SACRAL', strain: 'RAPID', base: 5, label: '撃破 SYNC+$',
      desc: '階層撃破時に SYNC +$%', effect: fx.floorHeal('$') },
    { id: 'v_sacral_tuning', name: '仙髄調律', region: 'SACRAL', strain: 'SPINE', base: 15, label: '初期臨界 +$%',
      desc: '潜行開始時の脊髄臨界ゲージ +$%', effect: fx.startGauge('$') },
    { id: 'v_shell_store', name: '外殻貯留', region: 'SACRAL', strain: 'SHELL', base: 10, label: '開始外殻 +$',
      desc: '階層開始時に髄鞘外殻 +$', effect: fx.floorMyelin('$') },
    { id: 'v_pain_block', name: '痛覚遮断', region: 'SACRAL', strain: 'DESPERATE', base: 10, label: 'SYNC最大 +$',
      desc: 'SYNC の最大値 +$%', effect: fx.syncMax('$') },
    { id: 'v_crystal_meta', name: '結晶代謝', region: 'SACRAL', strain: 'CMP', base: 2, label: '合体 臨界+$',
      desc: '合体が起きるたびに脊髄臨界ゲージ +$%', effect: fx.gaugePerMerge('$'), unlock: 'cleared:rank_b' },
  ],

  // 副次変異（8.2.2）。'$' は base（レアリティでは増えない）
  affixes: [
    { id: 'af_syn_film', name: 'シナプス厚膜', label: 'シナプス外殻 +$', base: 2, effect: fx.perNode(fx.colorIs('SYNAPSE'), fx.addMyelin('$')) },
    { id: 'af_chain_aid', name: '連鎖補助', label: '連結数ボーナス +$', base: 0.03, effect: fx.addChainBonus('$') },
    { id: 'af_pulse', name: '脈動誘発', label: '脈動節の出現率 +2%', base: 0.02, effect: fx.pulseChance('$') },
    { id: 'af_bone', name: '骨片添加', label: '白骨の基礎値 +$', base: 2, effect: fx.perNode(fx.colorIs('MARROW'), fx.addBase('$')) },
    { id: 'af_venom', name: '毒素添加', label: '神経毒の倍率 +$', base: 0.2, effect: fx.perNode(fx.colorIs('VENOM'), fx.addMult('$')) },
    { id: 'af_quick', name: '反射短縮', label: '発火時間 +$s', base: 0.2, effect: fx.addFireTime('$') },
    { id: 'af_gauge', name: '臨界充填', label: '臨界ゲージの溜まり +$%', base: 10, effect: fx.addGauge('$') },
    { id: 'af_syn', name: '代謝回収', label: '階層撃破の SYN +$%', base: 5, effect: fx.synGain('$') },
    { id: 'af_sync', name: '生存余力', label: 'SYNC の最大値 +$', base: 3, effect: fx.syncMax('$') },
    { id: 'af_myelin', name: '外殻温存', label: '階層開始時の髄鞘外殻 +$', base: 4, effect: fx.floorMyelin('$') },
    { id: 'af_backflow', name: '汚染抵抗', label: '逆流汚染の上昇 −10%', base: -10, effect: fx.backflowRate('$') },
    { id: 'af_long', name: '長索補助', label: '8連結1つにつき 倍率 +$', base: 1, effect: fx.perChain(fx.lenAtLeast(8), fx.addMult('$')) },
    { id: 'af_spine', name: '脊髄補助', label: '主脊髄の基礎値 +$', base: 2, effect: fx.perNode(fx.onSpine(), fx.addBase('$')) },
    { id: 'af_cmp', name: '圧縮補助', label: 'CMP の基礎値 +$', base: 5, effect: fx.perNode(fx.hasCMP(), fx.addBase('$')) },
    { id: 'af_residue', name: '残留強化', label: 'ロスト時の残留SYN +$%', base: 5, effect: fx.residueRate('$') },
  ],

  // 素質（株、8.6）。strain の義体は系統共鳴の数に +1。strainBoost はその系統の共鳴の効果を強める
  lineages: [
    { id: 'lin_standard', name: '標準株', code: 'STANDARD', strain: null, pros: '短所なし・熟練×1.25', cons: '系統+1なし',
      desc: '癖のない標準培養株。生き延びるほど早く熟練する。', effect: fx.careerMul(0.25) },
    { id: 'lin_vanguard', name: '前衛株', code: 'VANGUARD', strain: 'SPINE', pros: '主脊髄 +0.5倍', cons: '主脊髄外の白骨 −20%',
      desc: '背骨の中心に神経が集中した株。', effect: [fx.spineMulAdd(0.5), fx.perNode([fx.colorIs('MARROW'), fx.not(fx.onSpine())], fx.baseMul(0.8))] },
    { id: 'lin_spasm', name: '痙攣株', code: 'SPASM', strain: 'RAPID', pros: '落下 −0.05s', cons: '長連結ボーナスなし',
      desc: '絶えず痙攣する反射過剰の株。', effect: [fx.fallTime(-0.05), fx.noLongBonus()], unlock: 'lineage:spasm' },
    { id: 'lin_architect', name: '設計株', code: 'ARCHITECT', strain: 'CMP', pros: '同調・磁化を携行／連鎖合体 +1', cons: '首筋ポート −1',
      desc: '盤面の構造を先読みする株。', effect: [fx.mergeLimit(1), fx.ampouleSlots(-1)], startAmpoules: ['amp_sync', 'amp_magnet'], unlock: 'lineage:architect' },
    { id: 'lin_singularity', name: '特異株', code: 'SINGULARITY', strain: 'LONG', pros: '再発動 +1回', cons: '発火時間 −0.5s',
      desc: '同じ信号を何度も反響させる株。', effect: [fx.retriggerPlus(1), fx.addFireTime(-0.5)], unlock: 'lineage:singularity' },
    { id: 'lin_parasite', name: '寄生株', code: 'PARASITE', strain: 'DESPERATE', strainBoost: 1.5, pros: '背水の効果 ×1.5', cons: 'SYNC最大 70%',
      desc: '宿主の死に近づくほど活性化する株。', effect: fx.syncMax(-30), unlock: 'lineage:parasite' },
    { id: 'lin_capsule', name: '被膜株', code: 'CAPSULE', strain: 'SHELL', pros: '階層開始 外殻 +20', cons: '最終ダメージ ×0.85',
      desc: '全身を髄鞘で包んだ防御特化の株。', effect: [fx.floorMyelin(20), fx.metaMul(0.85)], unlock: 'lineage:capsule' },
  ],

  // 遺伝形質（8.7.2）。values は段階 I/II/III の数値で、effect の '$' に入る。minTier より低い段階では出ない
  traits: [
    { id: 't_conduction', name: '神経伝導の速さ', values: [0.2, 0.4, 0.7], label: '発火時間 +$s', strains: ['RAPID'], effect: fx.addFireTime('$') },
    { id: 't_crit_precursor', name: '臨界前駆', values: [15, 30, 50], label: '開始時の臨界ゲージ +$%', strains: ['SPINE'], effect: fx.startGauge('$') },
    { id: 't_metabolism', name: '代謝効率', values: [5, 10, 15], label: 'ロスト時の残留SYN +$%', strains: ['DESPERATE'], effect: fx.residueRate('$') },
    { id: 't_adaptive', name: '適応的変異', values: [1, 2, 3], label: '変異因子の選択肢 +1（段階$）', strains: [], effect: fx.rewardChoices('$'),
      desc: 'I：最初の階層のみ／II：すべての階層／III：すべての階層＋RARE 以上が1つ確定' },
    { id: 't_strain_memory', name: '系統の記憶', values: [1, 1, 1], minTier: 3, strainMemory: true, label: '#{strain} が系統共鳴に +1', strains: [] },
    { id: 't_marrow_memory', name: '骨髄の記憶', values: [3, 6, 10], label: '白骨の基礎値 +$', strains: ['SPINE', 'LONG'], effect: fx.perNode(fx.colorIs('MARROW'), fx.addBase('$')) },
    { id: 't_myelin_memory', name: '髄鞘の記憶', values: [5, 10, 20], label: '階層開始時の外殻 +$', strains: ['SHELL'], effect: fx.floorMyelin('$') },
    { id: 't_survival', name: '生存本能', values: [5, 10, 20], label: 'SYNC の最大値 +$', strains: ['DESPERATE', 'SHELL'], effect: fx.syncMax('$') },
    { id: 't_extract_nose', name: '抜去の嗅覚', values: [5, 10, 20], label: '階層撃破の SYN +$%', strains: ['LONG', 'CMP'], effect: fx.synGain('$') },
    { id: 't_deep_tolerance', name: '深部耐性', values: [10, 20, 30], label: '逆流汚染の上昇 −$%', strains: ['CMP', 'DESPERATE'], effect: fx.backflowRate('-1*$') },
  ],

  // 侵入経路の種類（4.1）
  routes: [
    { id: 'route_normal', name: '通常経路', kind: 'normal', icon: '─' },
    { id: 'route_elite', name: '精鋭経路', kind: 'elite', icon: '◆', hpMul: 1.8, backflow: true, dropGuaranteed: true, rarityUp: 0.3, mutagenTierUp: 1, synMul: 1.5,
      extraGimmicks: [{ on: 'telegraph', place: 'ADHESION', n: 1 }, { on: 'attack', place: 'VIRUS', n: 1 }, { on: 'attack', place: 'NECROSIS', n: 1, col: 'spine' }] },
    { id: 'route_vault', name: 'データ金庫', kind: 'vault', icon: '▣', enemy: 'e_vault', hpMul: 2.5, turnLimit: 3, synMul: 3, ampoule: true },
  ],

  enemies: [
    { id: 'e_vault', name: '暗号化データ金庫', passive: true, atk: 0, interval: 99, hpMul: 1,
      desc: '攻撃してこない暗号化金庫。3ターンで閉じる。', look: { shape: 'lattice', color: '#FFC83D' },
      lines: { tele: '暗号化 — 閉鎖まで', attack: '', stun: '' } },
  ],
};

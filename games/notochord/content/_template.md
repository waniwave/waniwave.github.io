# NOTOCHORD — 更新のしかたとコンテンツパックの書き方

新しいパックを足すときは、このファイルを AI に渡してください。

## 更新するとき（必ず）

1. `index.html` の **BUILD 番号**を上げる。`index.html` の中の `?v=6` を、すべて新しい番号（例：`?v=7`）に置き換える（import map の各行・`style.css`・`main.js` の行。冒頭のコメントの番号も）。
   - ブラウザやスマホのキャッシュで古いファイルが混ざるのを防ぐため。パック（`content/*.js`）は `registry.js` が同じ番号を付けて読み込むので、`index.html` に書き足す必要はない。
2. `node tools/check.mjs` を実行し、エラーが 0 件であることを確かめる。
3. GitHub Pages にはフォルダごと置く（空の `.nojekyll` も一緒に）。

## パックの足し方（3行で）

1. `content/` に新しいファイルを置く（例：`content/pack_ward.js`）。中身は下の「パックの形」。
2. `content/index.js` の一覧に1行足す（例：`'pack_ward',`）。
3. `node tools/check.mjs` でエラー 0 件を確認し、BUILD 番号を上げる。

## 調整用の道具

- `node tools/sim.mjs [試行数] modes=rank_d` … 無強化で各階層を何ターンで倒せるか
- `node tools/sim.mjs campaign [試行数]` … 契約を通しで遊んだときの、ランクごとの完遂までの潜行回数
- `node tools/sim.mjs abyss [試行数] maxFloor=80` … 典型的なビルドで深淵を何層まで潜れるか
- 数値はその場で上書きして試せる：`board.mergeMin=5`、`mode.rank_d.hpBase=100000`、`node.SYNAPSE.gauge=2`、`enemy.e_patrol_d.atk=30`
- ブラウザでは、タイトルのロゴを10回叩くとデバッグ（試験戦闘・各ボス階層・戦闘中の DBG パネル）が出る。URL に `?seed=文字列` で乱数を固定、`?fresh=1` でセーブを読まずに始める。

## 追加の手順

1. `content/` に新しいファイルを置く（例：`content/pack_ward.js`）。
2. `content/index.js` の一覧に1行足す（例：`'pack_ward',`）。
3. `node tools/check.mjs` を実行し、エラーが 0 件であることを確かめる。

既存のファイルは書き換えません。エンジン（`js/`）にも手を入れません。

## パックの形

1つのファイルが、次のキーを持つオブジェクトを `export default` します。使わないキーは省略できます。

| キー | 中身 | 必須項目 |
| :-- | :-- | :-- |
| `id` / `name` | パックの識別子と表示名 | `id` |
| `rules` | 基本ルールの数値（盤面の大きさ、発火時間、配色など）。後に読み込んだパックが上書きする | — |
| `nodes` | ノード（色・脈動節・CMP・特殊ノード） | `id` `name` `kind` |
| `strains` | 系統 | `id` `name` |
| `rarities` | レアリティ（`group` で変異因子用・義体用を分ける） | `id` `name` `group` |
| `vertebrae` | 椎骨義体 | `id` `name` `region` `strain` |
| `mutagens` | 変異因子 | `id` `name` `strain` `rarity` `effect` |
| `ampoules` | 神経アンプル | `id` `name` `use` `target` |
| `affixes` | 副次変異 | `id` |
| `enemies` | 監査官・ボス | `id` `name` `atk` `interval` |
| `routes` | 侵入経路の種類 | `id` `name` |
| `lineages` / `traits` | 素質（株）／遺伝形質 | `id` `name` |
| `modes` | 潜行モード（契約・深淵・新しいエンドコンテンツ） | `id` `name` `hpBase` `hpGrowth` `pool` |
| `story` | 断片ログ・台詞・条件付きイベント | `id` `type` |
| `tutorial` | チュートリアルの手順と固定盤面 | `id` |

- `id` は全パックを通して一意にします（種類が違っても重複は不可）。
- 他のデータを指す項目（変異因子の `strain`・`rarity`、敵の `gimmicks[].place`、モードの `pool`・`bosses`）は、存在しない id だと検査でエラーになります。
- セーブデータには `id` だけを保存します。パックを外してもセーブは壊れません。

## rules（基本ルール）

```js
rules: {
  board: { cols: 5, rows: 7, spineCol: 2, minChain: 3, mergeMin: 4,
           mergeChainLimit: 2, shockRange: 2, spineMul: 2,
           mergeTrigger: 'moved', mergePerPass: 1, mergeKeepPulse: false, spawnSpread: 0 },
  fire:  { time: 5.0, fallTime: 0.2 },
  combat: { startMult: 1, chainBonus: 0.1, longBonus: [[6, 1.25], [10, 1.5]],
            bigChain: 10, bigChainGauge: 10, mutagenSlots: 5, ampouleSlots: 2 },
  spineBreak: { max: 100, mul: 3, timeScale: 0.5 },
  backflow: { perTurn: 8, perHit: 10, reliefCount: 8, relief: 15, max: 100 },
  juice: { smallChain: 6, midChain: 10, small: 3, mid: 5, big: 10, hitstop: 50 },
  evalAnim: { stepMs: 170, holdMs: 650 },
  audio: { bpm: 128, bossBpm: 138, lpLow: 400, lpHigh: 4500, lpFullNodes: 30 },
  themeBoss: { bg: '#0B0204', panel: '#1A0609', line: '#5C1522', pulse: '#FF2A4B', ... },
  theme: { bg: '#060C0E', panel: '#0E1A1D', line: '#233D42', alert: '#FF2A4B',
           pulse: '#3BE8FF', text: '#CFE3E6', dim: '#6F8A8F' },
},
```

一部だけ書けば、その値だけが上書きされます（例：`rules: { fire: { time: 4.5 } }`）。

## nodes（ノード）

`kind` で種類を決めます。

```js
nodes: [
  // 色ノード：weight は出現率の比。symbol は 'bone' / 'drop' / 'bolt'
  { id: 'MARROW', name: '白骨', kind: 'color', color: '#F2EFE9', symbol: 'bone',
    weight: 1, base: 10, mult: 0 },

  // 重なる印（脈動節）：chance は通常ノード生成時に重なる確率、time は延長秒数
  { id: 'PULSE', name: '脈動節', kind: 'overlay', color: '#3BE8FF', symbol: 'pulse',
    chance: 0.06, time: 1.5 },

  // 圧縮進化：tier の順に並ぶ。minSize は塊の大きさの下限、blast は巻き込み範囲
  // look は 'ring' / 'poly' / 'organ'
  { id: 'BOMB', name: 'BOMB', kind: 'cmp', tier: 3, minSize: 8, valueMul: 10, mult: 2,
    blast: 1, look: 'organ' },

  // 特殊ノード
  //   chainable       連結に含められるか（必須）
  //   colorless       true なら色を失う（壊死）
  //   onAdjacentClear 隣が消えたとき 'release'（印が外れる）/ 'purify'（ランダムな色になる）
  //   count           カウントダウン（ターン数）。0 になると消える
  //   look            'bracket' / 'countdown' / 'web' / 'necrosis'
  { id: 'VIRUS', name: '時限ウイルス', kind: 'special', chainable: true, count: 3,
    syncDamage: 20, reflect: 2, look: 'countdown' },
],
```

## vertebrae（椎骨義体）

```js
vertebrae: [
  { id: 'v_toxin_pump', name: '毒腺ポンプ', region: 'LUMBAR', strain: 'RAPID', base: 2,
    label: '4連結 倍率+$',            // 背骨の画面の短い表示（$ は base × レアリティ倍率）
    desc: '連結が4つ以上のターン、+Mult $',
    effect: fx.when(fx.chainsAtLeast(4), fx.addMult('$')),
    unlock: 'cleared:rank_c' },        // 省略可。フラグが立つまで抽選・ショップに出ない
],
```

- `region`：`CERVICAL`（頸椎）/ `THORACIC`（胸椎）/ `LUMBAR`（腰椎）/ `SACRAL`（仙椎）
- レアリティ（`rarities` の `group: 'vertebra'`）は `mul`（基本効果の倍率）と `affixes: [最小, 最大]`（副次変異の数）を持つ。

## affixes（副次変異）

`'$'` は `base`（レアリティでは増えない）。

```js
affixes: [{ id: 'af_quick', name: '反射短縮', label: '発火時間 +$s', base: 0.2, effect: fx.addFireTime('$') }],
```

## strains（系統）と系統共鳴

```js
strains: [
  { id: 'SPINE', name: '脊髄', icon: '┃', resonance: [
    { at: 2, label: '臨界ゲージ +25%', base: 25, effect: fx.addGauge('$') },   // '$' は base（寄生株などの strainBoost で増える）
    { at: 4, label: '主脊髄 3倍', base: 1, effect: fx.spineMulAdd('$') },
  ] },
],
```

## lineages（素質・株）

```js
lineages: [
  { id: 'lin_vanguard', name: '前衛株', code: 'VANGUARD', strain: 'SPINE',   // strain の系統共鳴の数に +1
    pros: '主脊髄 +0.5倍', cons: '主脊髄外の白骨 −20%', desc: '…',
    effect: [fx.spineMulAdd(0.5), fx.perNode([fx.colorIs('MARROW'), fx.not(fx.onSpine())], fx.baseMul(0.8))],
    startAmpoules: [],          // 潜行開始時に持たせるアンプル（省略可）
    strainBoost: 1.5,           // その系統の共鳴の '$' を ×1.5（省略可）
    unlock: 'lineage:xxx' },
],
```

## traits（遺伝形質）

```js
traits: [
  { id: 't_conduction', name: '神経伝導の速さ', values: [0.2, 0.4, 0.7],   // 段階 I/II/III。effect の '$' に入る
    label: '発火時間 +$s', strains: ['RAPID'],   // strains：その系統に縁のある検体から出やすい
    effect: fx.addFireTime('$') },
  { id: 't_strain_memory', name: '系統の記憶', values: [1, 1, 1], minTier: 3, strainMemory: true, label: '#{strain} が系統共鳴に +1' },
],
```

## routes（侵入経路の種類）

```js
routes: [
  { id: 'route_elite', name: '精鋭経路', kind: 'elite', icon: '◆', hpMul: 1.8, backflow: true, dropGuaranteed: true,
    rarityUp: 0.3, mutagenTierUp: 1, synMul: 1.5, extraGimmicks: [{ on: 'attack', place: 'VIRUS', n: 1 }] },
  { id: 'route_vault', name: 'データ金庫', kind: 'vault', enemy: 'e_vault', hpMul: 2.5, turnLimit: 3, synMul: 3, ampoule: true },
],
```

## enemies（敵）

```js
enemies: [
  { id: 'e_heavy_c', name: '重装監査官',
    hpMul: 1.2,          // モードの敵HPに掛ける倍率
    atk: 12,             // 攻撃1回の SYNC ダメージ（%）。髄鞘外殻が先に受ける
    interval: 3,         // 「あと N ターンで攻撃」の N。予告と同時に露出神経を1つ置く
    armor: { color: 'MARROW', mul: 0.5 },   // そのターンに白骨の連結がないと ×0.5
    gimmicks: [{ on: 'attack', place: 'ADHESION', n: 2 }],
    //   on: 'start' / 'telegraph' / 'attack' / 'turn'、col: 'spine' で主脊髄の列に置く
    // cycle: true … gimmicks を攻撃のたびに順番に1つずつ使う
    // shuffleAt: 0.5 … HP がこの割合を下回ったとき盤面を一度シャッフル
    // boss: true … ボス（計算演出の文言が変わる）
    desc: '見た目の説明', look: { shape: 'shell', color: '#B8B0A0' },
    //   shape: eye / shell / spore / flame / crawler / lattice / core
    lines: { tele: '外殻圧縮 — 圧殺準備', attack: '圧殺', stun: '外殻破損：停止' } },
],
```

## modes（潜行モード）

敵HP ＝ `hpBase` × `hpGrowth`^(階層−1)（ボス階層は ×`bossMul`）× 敵の `hpMul`

```js
modes: [
  { id: 'rank_d', name: 'RANK D', title: '末梢神経網', sub: '物流下請け層', order: 1, floors: 3,
    hpBase: 2500, hpGrowth: 1.6, bossMul: 1.5, bossFloors: [3],
    backflowMul: 1.0,          // 逆流汚染の上昇倍率。backflowAll: true で全階層に逆流汚染
    synPerFloor: 30,
    pool: ['e_patrol_d', 'e_sorter_d'],   // 通常階層に出る敵
    bosses: { 3: 'b_d' },                 // ボス階層の敵
    careerCoef: 1,                        // 熟練度の係数（抜去した階層 × 係数）
    routeChoices: 2, eliteChance: 0, vaultChance: 0,   // 侵入経路の選択肢の数と、精鋭・金庫の出現率
    vertebraDrop: 0.1,                    // 通常階層の義体ドロップ率（ボス・精鋭は確定）
    vertebraRarity: { STANDARD: 90, REFINED: 10 }, bossRarity: { REFINED: 100 },
    shopRarity: { STANDARD: 100 },        // 開放済みで最も上のモードの値がブローカーの品揃えになる
    mutagenRarity: { COMMON: 65, UNCOMMON: 30, RARE: 5 },
    unlock: 'mode:rank_c' },              // 開放フラグ（最初のモードは省略）
],
```

新しいエンドコンテンツは `modes` に1つ足すだけで、契約と同じ仕組み（経路・報酬・抜去・ロスト）で動きます。

### 終わりのないモード・深度で変わる値（content/abyss.js が見本）

```js
{ id: 'abyss', name: 'ABYSS', title: '深淵潜行', order: 5, unlock: 'mode:abyss',
  floors: 0,                          // 0 は終わりなし（完遂がない）
  hpBase: 9.6e9, hpGrowth: 1.35, bossMul: 1.5,
  bossEvery: 5, bossPool: ['b_abyss_warden'],   // 5の倍数の層がボス。ボスは bossPool から選ぶ（bossFloors / bosses と併用可）
  backflowAll: true,                  // 全階層で逆流汚染
  startStep: 10,                      // 10層刻みで「最深到達の半分」まで選んで開始できる
  depthTable: [                       // from 層以上で、その行の値を上書き（下の行ほど優先）
    { from: 1, vertebraRarity: { REFINED: 50, PROTOTYPE: 50 }, mutagenRarity: { RARE: 50, ANOMALY: 50 } },
    { from: 100, vertebraRarity: { FORBIDDEN: 85, LOT_OMEGA: 15 } },
  ],
  pollution: { every: 10, stages: [   // 汚染段階：every 層ごとに1段。段階 n では stages を先頭から n 個積む（足りなければ繰り返す）
    { label: '発火時間 −0.3s', effect: fx.addFireTime(-0.3) },
    { label: '毎ターン壊死ノードが1つ混ざる', effect: fx.necrosisPerTurn(1) },
  ] },
  desaturate: { perFloor: 0.006, min: 0.15 },   // 深いほど戦闘画面の彩度を落とす
}
```

- 深淵の層の到達は `DEPTH_REACHED`（`floor`・`pollution` が使える）で拾う。補助ソケットや培養プロトコルの枠は、`floorAtLeast` の trigger で `socket2:<部位>` / `protocol_<n>` を立てる。
- 汚染段階の効果は、義体と同じ fx の部品で書く（`telegraphShift(n)`・`necrosisPerTurn(n)`・`gimmickBoost('VIRUS', n)` など）。

### 特定のレアリティでだけ出る義体（LOT-Ω の遺物）

```js
{ id: 'v_omega_0533', name: '二重脊柱', region: 'THORACIC', strain: 'SPINE', base: 0.1,
  rarityOnly: 'LOT_OMEGA',             // このレアリティを引いたときだけ出る（他のレアリティでは出ない）
  owner: 'LOT-Ω #0533', log: '…',      // 義体図鑑で読める前世代検体の名前と残留ログ
  effect: [fx.spineExtra(1), fx.spineMulAdd('$')] },
```

レアリティに `exclusive: true` を付けると、精鋭経路の「1段上がる」では出ず、抽選の重みに書いたときだけ出る。

## mutagens（変異因子）

```js
import { fx } from '../js/engine/registry.js';
mutagens: [
  { id: 'm_spine_resonance', name: '背骨共鳴', label: '脊髄 ×1.5',   // label はドックの短い表示
    strain: 'SPINE', rarity: 'RARE', desc: '主脊髄を3個以上通る連結1つにつき ×Mult 1.5',
    effect: fx.perChain(fx.onSpine(3), fx.mulMult(1.5)) },
],
```

## ampoules（神経アンプル）

```js
ampoules: [
  { id: 'amp_burn', name: '焼灼アンプル', label: '焼灼', use: 'burnRow', target: 'row', desc: '…' },
],
```

- `use`：`freeze`（`value` 秒、時間が減らない）/ `heal`（SYNC +`value`）/ `recolor`（色→色）/ `burnRow`（横1列を焼却）/ `magnet`（主脊髄と両隣 `range` 列に集める）/ `rewind`（直前のターン開始時へ）
- `target`：`none` / `row`（列をタップ）/ `color`（色をタップ）/ `color2`（変える色→変えた後の色）

## 効果（fx）

義体・変異因子・形質・株の `effect` は、`fx` の部品を組み合わせて1〜3行で書きます。
数値に `'$'` と書くと、その義体の `base` × レアリティ倍率に置き換わります（`'$'`、`'1+$'`、`'2*$'` などが使えます）。

### 組み立て

| 部品 | 意味 |
| :-- | :-- |
| `when(条件, 効果...)` | ターン全体の条件を満たすとき |
| `perChain(条件, 効果...)` | 条件を満たす連結1つにつき |
| `perNode(条件, 効果...)` | 条件を満たすノード1つにつき（ノードの値を、主脊髄・CMP の倍率がかかる前に変える） |
| `perColorKind(効果...)` | そのターンに消した色の種類1つにつき |

条件は配列で渡すと「すべて満たす」になります（例：`[fx.lenAtLeast(8), fx.colorIs('VENOM')]`）。

### 条件

| 部品 | 意味 |
| :-- | :-- |
| `chainsAtLeast(n)` | そのターンの連結が n 個以上 |
| `lenAtLeast(n)` | 連結の長さが n 個以上 |
| `colorIs(id)` | 色（ノードの中なら そのノード、連結の中なら その連結の色） |
| `onSpine(n)` | 連結が主脊髄を n 個以上通る（`perNode` の中では「そのノードが主脊髄上」） |
| `hasCMP()` | CMP を含む |
| `syncBelow(p)` / `backflowAbove(p)` | SYNC が p% 以下 / 逆流汚染が p% 以上 |
| `colorChanged()` | 直前の連結と色が違う |
| `critActive()` | 脊髄臨界中 |

### 効果

| 部品 | 計算順（6.2） | 意味 |
| :-- | :-- | :-- |
| `addBase(v)` | 1 | 基礎値 +v |
| `baseMul(v)` | 1 | 基礎値 ×v（`perChain` の中ならその連結だけ） |
| `myelinToBase(k)` | 1 | 髄鞘外殻 × k を基礎値に加算 |
| `addMult(v)` | 2 | 倍率 +v |
| `addChainBonus(v)` | 3 | 連結数ボーナスの係数 +v |
| `mulMult(v)` | 4 | ×v |
| `retrigger(n)` | 5 | 再発動：連結の基礎値をもう n 回加算（`perChain` の外では最も長い連結） |
| `metaMul(v)` | 6 | 系統共鳴・義体の増幅 ×v |
| `addMyelin(v)` | — | 髄鞘外殻 +v |
| `addFireTime(s)` / `addPulseTime(s)` | — | 発火時間 / 脈動節の延長 +s 秒 |
| `addGauge(p)` | — | 脊髄臨界ゲージの溜まり +p% |
| `spineEcho(k, 減速)` | 7 | 脊髄臨界の次のターンに ×k・時間の減りを ×減速 |
| `syncScale(k)` | 6 | SYNC が低いほど増える（SYNC 1% で ×k） |
| `fallTime(s)` / `timePerChain(s)` | — | 落下中に触れない時間 +s ／ 連結が成立するたびに発火時間 +s |
| `critSlow(k)` / `critMulAdd(v)` | 7 | 脊髄臨界中の時間の減り ×k ／ 臨界の倍率 +v |
| `spineMulAdd(v)` / `alwaysWild()` | — | 主脊髄の倍率 +v ／ 主脊髄が常に全色扱い |
| `longBonusShift(n)` / `noLongBonus()` | 1 | 長連結ボーナスの条件の個数 +n ／ 長連結ボーナスなし |
| `chainBonusPow(k)` | 3 | 連結数ボーナスを ×k^n にする |
| `multPerMerge(v)` / `myelinToMult(k)` | 2 | 合体1回につき倍率 +v ／ 髄鞘外殻 × k を倍率に加算 |
| `myelinGainMul(k)` | — | 髄鞘外殻の獲得 ×(1+k) |
| `retriggerPlus(n)` / `lastStand()` | — | 再発動の回数 +n ／ 1潜行に1回 SYNC 1% で踏みとどまる |
| `gaugePerMerge(p)` / `pulseChance(p)` / `pulseChanceMul(k)` | — | 合体ごとに臨界 +p% ／ 脈動節の出現率 +p ／ ×(1+k) |
| `mergeLimit(n)` / `bombRange(n)` | — | 連鎖合体の上限 +n ／ BOMB の巻き込み範囲 +n |
| `ampouleSlots(n)` / `syncMax(v)` | — | 首筋ポート +n ／ SYNC の最大値 +v（潜行） |
| `residueRate(p)` / `synGain(p)` / `synPerBomb(v)` | — | ロスト時の残留 +p% ／ 階層の SYN +p% ／ BOMB ごとに SYN +v（潜行） |
| `floorHeal(v)` / `floorMyelin(v)` / `myelinCarry(k)` | — | 撃破時 SYNC +v ／ 階層開始時の外殻 +v ／ 外殻の k を次の階層へ（潜行） |
| `startGauge(p)` / `rewardChoices(段階)` / `careerMul(k)` / `backflowRate(p)` | — | 開始時の臨界 +p% ／ 変異因子の選択肢 ／ 熟練の上がり方 ×(1+k) ／ 逆流汚染の上昇 +p%（潜行） |
| `graceTime(s)` / `spineExtra(n)` / `minChainAdd(n)` | — | 発火時間が0になった後 s 秒続けられる ／ 主脊髄の列 +n ／ 連結の最小個数 +n（最小2） |
| `mergeTierAdd(n)` / `critRefund(p)` / `weakpointCut(k)` | — | 合体の段階 +n ／ 臨界の後ゲージを p% 残す ／ 露出神経を壊すと敵の最大HP × k を削る |
| `telegraphShift(n)` / `necrosisPerTurn(n)` / `gimmickBoost(id, n)` | — | 攻撃予告を n ターン早める ／ 毎ターン壊死を n 個 ／ 敵が置く特殊ノード id を +n 個（悪条件） |

条件の追加：`not(条件)`、`myelinAbove(v)`（髄鞘外殻 v 以上）、`hitLastTurn()`（前のターンに攻撃を受けた）
| `hook(名前, 関数)` | — | 部品で書けない効果。名前は下記のフック |

フック：`ON_RUN_START` `ON_FIRE_START` `ON_CHAIN_COMMIT` `ON_NODE_EVAL` `ON_SPINE_PASS` `ON_MERGE_CREATED` `ON_WEAKPOINT_BREAK` `ON_FIRE_END` `ON_ENEMY_HIT` `ON_FLOOR_CLEAR`

```js
effect: fx.hook('ON_WEAKPOINT_BREAK', (ctx, src) => { ctx.combat.gauge += 20; }),
```

## story（ストーリーとイベント）

```js
story: [
  { id: 'frag_omega_0412', type: 'fragment', title: 'LOT-Ω #0412 // 最終通信',
    when: { event: 'FLOOR_CLEAR', mode: 'rank_b', floor: 7 },
    text: '……逆流が、止まらない。████' },
],
```

- `type`：`fragment`（断片ログ。一度きり）/ `line`（台詞。同じイベントで話者ごとに1つ選ばれる。`speaker` が必要、`once: true` で一度きり）/ `trigger`（`then` だけを実行。一度きり）/ `text`（プロローグなど、順番に読む文章）/ `noise` / `lastword`（ロスト時の残留ログの最後の言葉。`when` なし）
- イベント：`GAME_START` `THAW` `RUN_START` `ROUTE_ENTER` `FLOOR_CLEAR` `EXTRACT` `LOST` `PRESERVE` `MODE_CLEAR` `DEPTH_REACHED` `RECORD` `BROKER`（ブローカー画面を開いたとき）
- 条件：`event` `mode` `floor` `floorAtLeast` `specimenAtLeast` `lineage` `flag` `notFlag` `fragment` `chance`、数値の比較 `min: { chains: 10 }` `max: { lastTime: 0.5 }`、一致 `is: { kill: true }`
- イベントごとに使える値：`FLOOR_CLEAR` は `boss` `kind`、`LOST` は `cause`（`sync` / `backflow`）、`RECORD`（1ターンごと）は `chains` `overkill` `lastTime` `kill` `crit` `reflect` `sync` `damage` `resonanceMax`
- 本文の `#{specimen}` `#{floor}` などは、その時の値に置き換わる
- 結果（`then`）：`{ setFlag: [...], unlock: [...] }`。よく使うフラグ：`mode:<id>`（モード開放）、`socket:<部位>`（ソケット開通）、`socket2:<部位>`（補助ソケット）、`lineage:<名前>`（株の開放）、`protocol_<n>`（培養プロトコルの枠 +1）、`cleared:<id>`

## tutorial（チュートリアル）

```js
tutorial: [{ id: 'tut_main', mode: 'rank_d', floor: 1, enemy: 'e_patrol_d',
  legend: { M: 'MARROW', V: 'VENOM', S: 'SYNAPSE' },   // board の文字とノードの対応
  steps: [
    { id: 'tut_1',
      board: ['.....', '.....', '.....', '.M.M.', '.....', '.....', '.....'],   // 上の行から 5文字×7行。小文字は脈動節付き、. は自動
      specials: [[2, 3, 'WEAKPOINT']],   // [列, 行, 特殊ノード]（省略可）
      gauge: 100, crit: true,             // 臨界ゲージを満たす／臨界ボタンを強調（省略可）
      path: [[1, 3], [2, 3], [3, 3]],     // 照準ブラケットで囲むノード
      demo: [[[1, 3], [2, 3], [3, 3]]],   // 検査用：この順に連結すると until を満たすこと（check.mjs が確かめる）
      until: ['spineChain'],              // chain / spineChain / multi / merge / pulse / crit / weakpoint
      text: '…' },
  ] }],
```
- `type: 'noise'` … 逆流汚染 50% 以上のとき、侵食ラインににじむ「他人の記憶」の文字（`text` のみ）

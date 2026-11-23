# コンテンツパックの書き方（見本）

新しいパックを足すときは、このファイルを AI に渡してください。

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
    bosses: { 3: 'b_d' } },               // ボス階層の敵
],
```

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

- イベント：`GAME_START` `THAW` `RUN_START` `ROUTE_ENTER` `FLOOR_CLEAR` `EXTRACT` `LOST` `PRESERVE` `MODE_CLEAR` `DEPTH_REACHED` `RECORD`
- 条件：`event` `mode` `floor` `floorAtLeast` `specimenAtLeast` `lineage` `flag` `notFlag` `fragment` `chance`
- `type: 'noise'` … 逆流汚染 50% 以上のとき、侵食ラインににじむ「他人の記憶」の文字（`text` のみ）

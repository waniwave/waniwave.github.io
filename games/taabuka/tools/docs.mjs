// docs/content-guide.md と docs/hooks.md を、語彙の登録内容から書き出す（node tools/check.mjs --docs）
// 手で書いた説明は形と例だけ。語彙の一覧と意味は全て engine/vocab/ と特注の登録から作る。

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { describeArgs, KIND_JA } from '../engine/vocab/index.js';
import { CATEGORY_WORDS, SCOPES } from '../engine/vocab/index.js';
import { CARD_TARGETS, ENEMY_TARGETS } from '../engine/vocab/effect.js';
import { HOOK_NAMES, HOOK_INFO, SIGNALS, GROUPS, CHAIN_LIMIT, SCORE_CTX } from '../engine/hooks.js';
import { EXPECT_KEYS } from '../engine/content.js';

const esc = (s) => String(s ?? '').replace(/\|/g, '｜').replace(/\n/g, ' ');

function table(rows, head) {
  return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`)].join('\n');
}

function vocabTable(content, kind, withArgs = true) {
  const v = content.vocab;
  return table(v.list(kind).map((d) => {
    const from = v.origin.get(`${kind}:${d.name}`);
    const name = from === '組み込み' ? `\`${d.name}\`` : `\`${d.name}\`（特注：${from.replace(/^content\//, '')}）`;
    return withArgs ? [name, describeArgs(d.args), d.text] : [name, d.text];
  }), withArgs ? ['名前', '引数', '意味'] : ['名前', '意味']);
}

export function contentGuide(content) {
  const b = content.balance;
  const v = content.vocab;
  const n = (k) => v.names(k).length;
  return `# ター深 コンテンツの書き方

> このファイルは \`node tools/check.mjs --docs\` が語彙の登録内容から自動で書き出す。手で直さない。

札・常連客・置物・お品書き・敵・層・謎・宿泊客は全てYAMLで書き、効果は「合図（when）・条件（if）・効果（do）」と
「ルール改変（rule）」「演出（show）」の決まった語彙だけで書く。語彙で書けないものだけ特注（*.js）を書き、名前を付けて語彙に加える。

書いたら \`node tools/check.mjs\` を実行する。おかしなところが1件1行で出る（知らない語彙には近い候補も出る）。
ファイルを足したら \`node tools/check.mjs --fix-index\` で content/index.yaml を書き直す。

## ファイルの置き場所

| 何を | どこに |
|---|---|
| セット | \`content/sets/<セットID>/set.yaml\` |
| 札・常連客・置物・お品書き | 同じフォルダの \`cards.yaml\` \`regulars.yaml\` \`relics.yaml\` \`items.yaml\` |
| キーワード能力 | 共通は \`content/keywords/*.yaml\`、セット固有は同じフォルダの \`keywords.yaml\` |
| 語彙で書けないものの特注 | 同じフォルダの \`custom/*.js\` |
| 宿泊客 | \`content/guests/<ID>/guest.yaml\` と固有の仕組みの \`custom.js\`（専用札は sets/ に置く） |
| 敵 | \`content/enemies/<層>.yaml\`（特注は \`content/enemies/custom/*.js\`） |
| 層 | \`content/layers/<層>.yaml\` |
| 謎 | \`content/events/<層>.yaml\`（ファイル名の layerN が出る層） |
| お土産 | \`content/souvenirs.yaml\` |
| 宿の施設と段階 | \`content/facilities.yaml\` |
| 札同士のコンボ・呪文の短い名前 | \`content/combos.yaml\` |

書き方の雛形は \`docs/templates/\` にある。差し込み口の一覧は \`docs/hooks.md\`。

## 決まった値

- カテゴリ（${b.tiers.categories.length}）：${b.tiers.categories.join('・')}。札1枚に1〜3個
- Tier：${b.tiers.ring.join(' / ')}（輪：${b.tiers.ring.join('→')}→${b.tiers.ring[0]}）
- 番付の段：${[...b.tiers.ring, ...Object.keys(b.tiers.missing || {})].join(' / ')}
- 格：${b.economy.grades.join(' / ')}
- 組（優先順）：${b.hands.order.join(' ＞ ')}
- 由来（origin）：orig（原本・省略時） / expiry（期限） / cursed（曰く付き） / bet（賭け）。copy と pawn は宿が付ける
- ID：英小文字・数字・_。セットの頭文字＋名前（例：rk_shineei）。一度決めたら変えない

## 札（cards.yaml）

\`\`\`yaml
- id: rk_shineei            # セットの頭文字＋名前
  name: 死ねーぃ
  cat: [死]                  # 1〜3個
  tier: 1                    # ${b.tiers.ring.join(' / ')}
  grade: 特上                # ${b.economy.grades.join(' / ')}
  kw: [一番槍]               # キーワード能力（省略可）。数字を取るものは 呼び水2 のように
  text: 狙った敵の主張を0にする（層主・底の主は半分）。その戦闘の残りは出し−1
  flavor: 一言で終わる。      # 笑いの一行。効果文とは別
  fx:                        # 効果。when・if・do を並べる
    - when: 採点時
      if: { 確率: 0.5 }      # 省略可
      do:
        - 主張を削る: { 対象: 狙い, 割合: 1.0, 層主なら: 0.5 }
        - 出し回数: { 増減: -1, 期間: 戦闘 }
  rule: [効果文を偽る]        # 持っている間ずっと効くルール（省略可）
  show:                      # 演出（省略可）
    - 筆文字: 死ねーぃ
    - 斬る
  test:                      # 自己テスト（省略可。検査コマンドが実行する）
    - hand: [rk_shineei, { tier: 3, cat: [麺] }]
      play: [0]
      enemies: [{ claim: 1000 }]
      expect: { enemy0: 0 }
\`\`\`

常連客（regulars.yaml）は cat・tier の代わりに grow（成長型）を持てる：\`grow: { 増える: ${'下りた階'}, 量: 0.05, 永続: true }\`（増える：下りた階／出し／戦闘／脱出）。
置物（relics.yaml）は札と同じく fx・rule・show を持つ。お品書き（items.yaml）は \`kind: 議題|番付札|品\`、\`use: 戦闘中|いつでも|戦闘外\`、\`do:\`（議題は \`hand:\` に組）。

### 「この札」は誰か

- 札の効果：その札自身。
- 常連客・置物・宿泊客の効果で合図が「採点時」「手札に残る」：そのとき採点された（残った）札。

## キーワード能力（${Object.keys(content.kwByName).length}）

札に「短い名前（＋数字）」で付ける能力。札の側は \`kw: [二倍, 呼び水2]\` と名前を並べるだけで、読み込み時に中身（fx・rule・show）が札に展開される。
中身は \`content/keywords/*.yaml\`（共通）か \`content/sets/<セット>/keywords.yaml\`（セット固有）に一度だけ書く（雛形 docs/templates/keyword.yaml）。
数字を取るものは定義に \`arg: N\` を書き、中身の N が札の数字になる。語彙で書けないものは \`custom:\` で特注（custom/*.js の rule）を指す。
セット固有のキーワードは、そのセットが解放された後なら他のセットの札からも使える。常連客・置物にも付けられ、敵に付けたものは表示だけ。
札の説明文には、キーワード名が太字で自動で先頭に並ぶ（text にはキーワード以外の効果だけ書く）。
定義には \`test:\` で自己テストを書く。手札は \`{ tier: 3, kw: [呼び水2] }\` のようにその場の札で書ける（\`draw:\` は山札、\`deck:\` は戦闘の前のデッキ）。

${table(Object.values(content.kwByName).map((k) => [`\`${k.name}${k.arg ? 'N' : ''}\``, k.text, k.set ? `セット ${k.set}` : '共通', k.custom ? `特注 ${k.custom}` : '']), ['名前', '効果', 'どこの', '中身'])}

## 語彙：合図（when、${n('when')}）

${vocabTable(content, 'when', false)}

## 語彙：条件（if、${n('if')}）

1つのオブジェクトに複数書けば全て成り立つとき。並べても全て成り立つとき。\`{ 採点札のカテゴリ: 食べ物, 枚数以上: 3 }\` のように補う項目を持つものがある。

${vocabTable(content, 'if')}

## 語彙：効果（do、${n('do')}）

\`do:\` には \`- 名前: 引数\` を並べる。数のところには式も書ける（下の「式」）。
「強さ」「倍率」「掛け」「論破値を掛ける」は合図「採点時」「手札に残る」「出し」でだけ使える。

${vocabTable(content, 'do')}

## 語彙：ルール改変（rule、${n('rule')}）

効果 \`- ルール: { 名前: 二倍, 範囲: この出し }\` で掛けるか、\`rule: [名前]\` で持っている間ずっと掛ける。
範囲は ${Object.keys(SCOPES).join('／')}。ルールに渡す値は同じ { } に書く（\`{ 名前: 交互, 範囲: この出し, 掛け: 1.5 }\`）。

${vocabTable(content, 'rule')}

## 語彙：演出（show、${n('show')}）

計算には触れない。どれも設定の「演出の強さ」「画面揺れ」「点滅の軽減」に従う。

${vocabTable(content, 'show')}

## 語彙：敵の行動（acts、${n('act')}）

敵は \`acts: [攻め, 攻め, { 伏せ: 1 }]\` のように上から繰り返す。

${vocabTable(content, 'act')}

## 式

数のところには式を書ける：\`"熟成*3"\` \`"1+育ち"\` \`"(失った体力)/10"\`。使えるのは 数・名前・＋−×÷（+ - * /）・括弧。

${vocabTable(content, 'var', false)}

宿泊客の仕組みが持つ値も名前として使える：${v.list('mechanic').flatMap((m) => (m.vars || []).map((x) => `${x}（${m.name}）`)).join('、') || 'なし'}。

## 指定のしかた

- カテゴリ：カテゴリ名、または ${CATEGORY_WORDS.join('／')}
- 札の対象：${CARD_TARGETS.join('／')}
- 敵の対象：${ENEMY_TARGETS.join('／')}
- 組：組の名前、または 最後の組／この出しの組／一番多く出した組／選ぶ

## 解放条件（unlock、${n('unlock')}）

${vocabTable(content, 'unlock')}

## 敵（enemies/<層>.yaml）

\`\`\`yaml
- id: en_niwaka
  name: にわか
  layer: [1]
  kind: 通常            # ${Object.keys(b.curve.kinds).join(' / ')}
  hp: 0.9               # その階の標準値に掛ける倍率（主張）
  atk: 1.0              # その階の標準値に掛ける倍率（攻撃）
  acts: [攻め, 攻め, { 伏せ: 1 }]
  line: それって強いんですか
  custom: null          # 敵の特注の名前（enemies/custom/*.js）
\`\`\`

## 層・謎・宿泊客

雛形（docs/templates/ の layer.yaml event.yaml guest.yaml）のとおり。謎の選択肢は最大3つ、\`do:\` は効果の語彙で書く。
層の \`elites\` は kind: 精鋭、\`bosses\` は 層主、\`warden\` は 番人、\`stalker\` は 追跡者 の敵にする（検査が確かめる）。

## お品書き・お土産

お品書きは雛形 item.yaml のとおり。\`use\` は いつでも ／ 戦闘中 ／ 戦闘外（潜行中、戦闘の外だけ）。
使う前に画面で選ばせるものは \`ask\`（カテゴリ ／ 札＝デッキの札 ／ 札2 ／ 手札 ／ 敵）に並べ、効果の側は「選ぶ」「手札から選ぶ」「狙い」で受ける。
\`once: 潜行\` は1回の潜行で1度だけ使える。お土産は雛形 souvenir.yaml のとおり（重さは1か2）。

## 特注（custom/*.js）

\`\`\`js
export default {
  name: '二倍',                       // 語彙として呼ぶ名前
  kind: 'rule',                       // ${['rule', 'do', 'show', 'mechanic', 'enemy', 'if', 'var'].join(' / ')}
  text: 'この出しの処理を全部2回通す', // 説明1行（この手引きに出る）
  args: { '回数?': 'int' },           // 受け取る値の形（省略可）
  hooks: {                            // 差し込み口：(ctx, next, me)。me.params に YAML で渡した値
    'score.card': (ctx, next, me) => { next(); next(); },
  },
  on: { 採点時: (ctx, me) => {} },     // 合図：(ctx, me)
  tests: [                            // 自己テスト（下）
    { hand: ['rk_jujo_satosatoru'], expect: { V: 35 } },
  ],
};
\`\`\`

- kind が rule のものは apply(B, env, r) と expire(B, env, r) で掛けた瞬間・外れる瞬間の処理も書ける。
- kind が do のものは run(E, 引数)、if は test(E, 引数)、var は get(E) を書く。
- kind が mechanic（宿泊客の仕組み）は state（戦闘をまたいで残る値の初期値）・vars（式で使える名前）・
  actions（固有行動）・status(B, me)（画面に出す1行）を持てる。
- kind が enemy（敵の特注）は hooks・on と、acts（その敵だけの行動の語彙）を持てる。
- 特注が例外を投げたら、その効果だけを無かったことにして続け、戦闘の記録に残る。

## 自己テストの書き方

\`\`\`yaml
test:
  - hand: [rk_shineei, { tier: 3, cat: [麺], name: 長い名前, kw: [呼び水2] }]   # IDか、その場で作る札
    draw: [{ tier: 1 }]  deck: [{ tier: 1 }]   # 山札（手札を書いたとき）／戦闘前のデッキ（手札を書かないとき）
    play: [0]                       # 出す札（省略時は全部）
    enemies: [{ claim: 1000, kind: 層主 }]   # 省略時は主張 1e30 の的が1体
    seats: [常連客ID]  relics: [置物ID]  guest: 宿泊客ID  banzuke: { 麺: God }
    state: { 採配数: 3 }             # 宿泊客の値
    choices: { 宣言: 神組 }          # プレイヤーが選ぶもの
    steps: [{ play: [0] }, { discard: [0] }, { end: true }, { guest: 採配, args: {…} }, { item: 0 }]   # 順に（省略可）
    expect: { … }
\`\`\`

expect に書けるもの：${EXPECT_KEYS.join('、')}。
「なしより大きい」「なしの倍」は、その札の効果（特注のテストではその特注）を外して同じことをした結果と比べる。

## 検査コマンド

\`node tools/check.mjs [セットID…]\`

1. YAMLと形の検査（必須項目、値の範囲、知らない語彙）
2. IDの重複と参照先の存在
3. content/index.yaml の確認（\`--fix-index\` で書き直す）
4. 自己テストの実行
5. 札ごとの試し対戦（\`--trial\`。その札を2枚入れた初期デッキで潜らせ、同じ格の平均と比べて「強すぎ／弱すぎ／普通」。時間がかかる）

キーワード能力は、未定義の名前（近い候補つき）、名前の重複、数字の過不足、解放順で先に来るセットの札が後で解放されるセットのキーワードを使っていることを指摘する。

ほかに \`--docs\`（この手引きと hooks.md を書き出す）、\`--ids\`（docs/ids.md に既存IDの一覧）。
`;
}

export function hooksDoc() {
  const order = Object.keys(GROUPS).map((g) => ({ seat: '席の並び', played: '出した順', relic: '置物', guest: '宿泊客', quirk: '層の癖', enemy: '敵の特注' }[g])).join(' → ');
  return `# ター深 差し込み口の一覧

> このファイルは \`node tools/check.mjs --docs\` が engine/hooks.js の登録内容から自動で書き出す。手で直さない。

各差し込み口は \`(ctx, next, me) => {}\` の形で、ctx の値を読み書きして \`next()\` を呼ぶ。
呼ばなければ元の処理を止められ、2回呼べば2回通る。me.params は YAML で渡した値。

- 並び順：同じ差し込み口では ${order}。
- 連鎖：1つの行動（出す・流す・終了・固有行動・お品書き）につき ${CHAIN_LIMIT} 回まで。超えた分は飛ばして記録に残る。
- 例外：差し込みが例外を投げたら、その差し込みだけを無かったことにして続け、記録に残る。
- ctx に共通：battle（戦闘の状態）、env（balance・content・hooks・rng）。乱数は必ず env.rng から。

## 差し込み口（${HOOK_NAMES.length}）

${table(HOOK_NAMES.map((h) => [`\`${h}\``, HOOK_INFO[h]?.when ?? '', HOOK_INFO[h]?.ctx ?? '']), ['名前', 'いつ呼ばれるか', 'ctx の中身'])}

### 採点の場 sc

score.* の差し込み口と、合図「採点時」「手札に残る」「出し」の ctx：

${SCORE_CTX}

## 合図（${SIGNALS.length}）

合図は \`on: { 合図: (ctx, me) => {} }\` で受ける。YAML の when と同じ名前。一覧と意味は content-guide.md の「合図」。

${SIGNALS.map((s) => `\`${s}\``).join(' ・ ')}

## ${KIND_JA.rule}・${KIND_JA.mechanic}・${KIND_JA.enemy}の登録

特注（content/**/custom/*.js）の hooks と on は、その持ち主の並びに登録される：
ルールは掛けた持ち主の並び（札なら出した順）、宿泊客の仕組みは宿泊客、層の癖は層の癖、敵の特注は敵の特注。
`;
}

export async function writeDocs(content, docsDir) {
  await mkdir(docsDir, { recursive: true });
  await writeFile(path.join(docsDir, 'content-guide.md'), contentGuide(content));
  await writeFile(path.join(docsDir, 'hooks.md'), hooksDoc());
  return ['docs/content-guide.md', 'docs/hooks.md'];
}

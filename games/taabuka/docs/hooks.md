# ター深 差し込み口の一覧

> このファイルは `node tools/check.mjs --docs` が engine/hooks.js の登録内容から自動で書き出す。手で直さない。

各差し込み口は `(ctx, next, me) => {}` の形で、ctx の値を読み書きして `next()` を呼ぶ。
呼ばなければ元の処理を止められ、2回呼べば2回通る。me.params は YAML で渡した値。

- 並び順：同じ差し込み口では 席の並び → 出した順 → 置物 → 宿泊客 → 層の癖 → 敵の特注。
- 連鎖：1つの行動（出す・流す・終了・固有行動・お品書き）につき 200 回まで。超えた分は飛ばして記録に残る。
- 例外：差し込みが例外を投げたら、その差し込みだけを無かったことにして続け、記録に残る。
- ctx に共通：battle（戦闘の状態）、env（balance・content・hooks・rng）。乱数は必ず env.rng から。

## 差し込み口（30）

| 名前 | いつ呼ばれるか | ctx の中身 |
|---|---|---|
| `dive.start` | 潜行の始め（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く） | dive |
| `floor.enter` | 階に入ったとき（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く） | dive, floor |
| `room.enter` | 部屋に入ったとき（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く） | dive, room |
| `landing` | 踊り場に着いたとき（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く） | dive |
| `dive.extract` | 脱出したとき（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く） | dive |
| `dive.death` | 未帰還になったとき（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く） | dive |
| `reward.roll` | 報酬を決めるとき（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く） | dive, reward |
| `shop.roll` | 商いの品揃えを決めるとき（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く） | dive, shop |
| `battle.start` | 戦闘の始め（山札を切った後、最初のターンの前） | battle, env |
| `turn.start` | ターンの始め（引いて、伏せを決めた後） | battle, env |
| `draw.after` | 札を引いた後（1回の引きごと） | battle, env, cards（引いた札） |
| `play.before` | 出す直前（手札から出した後、組の判定の前） | battle, env, cards（出した札）, target（狙った敵の番号）, choices |
| `play.after` | 出し終えた後（与えて、受けを足し、捨て札にした後） | battle, env, cards, hand（組）, V（論破値）, choices |
| `hand.evaluate` | 組の判定。next() の後で ctx.result を書き換えれば判定を差し替えられる。next() の前に views を書き換えれば見え方を変えられる | battle, env, cards, views（{tier, cats, stone}）, strengths, result（{hand, scored, kickers, flushCats}）, choices |
| `score.order` | 採点の順番を決めるとき（採点札の前） | 採点の場 sc（下）。sc.scored を並べ替えてよい |
| `score.card` | 採点札1枚ごと（a 強さ〜f 宿泊客）。next() を2回呼べば2回採点 | 採点の場 sc、sc.card（いまの札） |
| `score.held` | 手札に残った札1枚ごと（鋼、合図「手札に残る」） | 採点の場 sc、sc.card |
| `score.regulars` | 常連客の段（左の席から全員） | 採点の場 sc、sc.regular（いまの常連客） |
| `score.relics` | 置物の段（手に入れた順に全部） | 採点の場 sc、sc.relic |
| `score.final` | 最後の S×M の直前 | 採点の場 sc。sc.minM（倍率の下限）を変えられる |
| `damage.apply` | 論破値を敵に与えるとき（貫通を含む） | battle, env, V, target, hits |
| `enemy.defeated` | 敵を1体倒すとき。next() を呼ばなければ倒されない | battle, env, enemy |
| `overkill` | 全滅させたとき（過剰論破の判定） | battle, env, V, r（倍数）, level, rank, rewards |
| `turn.end` | ターンの終わり（敵の番の前） | battle, env |
| `enemy.before` | 敵が1体行動する直前 | battle, env, enemy |
| `enemy.act` | 敵の行動。next() を呼ばなければ行動しない | battle, env, enemy（enemy.intent が行動） |
| `battle.end` | 戦闘の終わり（勝ち・未帰還・脱出） | battle, env, result |
| `banzuke.change` | 番付が動くとき。next() を呼ばなければ動かない | battle, env, cat, from, to, src |
| `number.format` | 数を画面に出すとき | value, text |
| `fx.queue` | 出しの演出の手順を積むとき | battle, env, cards, hand, fx（[{show, arg, src}] に足す） |

### 採点の場 sc

score.* の差し込み口と、合図「採点時」「手札に残る」「出し」の ctx：

battle, env, hand（組）, level（段位）, played, scored（採点札）, kickers（受け札）, held（手札に残った札）, target, choices, S, M, steps, banzukeMul, finalMuls, minM、addS(数, 出どころ) addM() mulM() mulS() note()

## 合図（19）

合図は `on: { 合図: (ctx, me) => {} }` で受ける。YAML の when と同じ名前。一覧と意味は content-guide.md の「合図」。

`採点時` ・ `手札に残る` ・ `受けに回る` ・ `出し` ・ `出しの前` ・ `出しの後` ・ `流した時` ・ `引いた時` ・ `ターン開始` ・ `ターン終了` ・ `戦闘開始` ・ `戦闘終了` ・ `敵を倒した時` ・ `過剰論破の時` ・ `敵の行動の前` ・ `階に入った時` ・ `部屋に入った時` ・ `踊り場` ・ `脱出時`

## ルール・宿泊客の仕組み・敵の特注の登録

特注（content/**/custom/*.js）の hooks と on は、その持ち主の並びに登録される：
ルールは掛けた持ち主の並び（札なら出した順）、宿泊客の仕組みは宿泊客、層の癖は層の癖、敵の特注は敵の特注。

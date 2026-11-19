# ター深（ぶか）

宿の床下に、ター深がある。潜って、拾って、帰ってくるデッキ構築ローグライト（スマホ縦画面・ブラウザ）。
この版は先行版：第一層「地下帳場」・第二層「襖の迷い」（B1〜B6）と宿。

## 置き方（GitHub Pages）

ビルドはありません。このフォルダをそのまま置けば動きます。

1. GitHub にリポジトリを作り、このフォルダの中身を全部入れる（`.nojekyll` も入れる）
2. リポジトリの Settings → Pages で、Branch を `main`、フォルダを `/ (root)` にする
3. `https://<名前>.github.io/<リポジトリ>/` を開く。スマホでは共有メニューの「ホーム画面に追加」でアプリのように開け、一度開けばオフラインでも起動する

手元で試すときは、このフォルダで `python3 -m http.server 8000` を動かし `http://localhost:8000/` を開く（ファイルを直接開くと読み込めない）。

### 更新するとき

```
node tools/check.mjs --fix-index     # 検査（エラー0なら次へ）
node tools/release.mjs               # BUILD を上げ、オフライン用の一覧（sw.js）を書き直す
```

BUILD は `index.html` と `sw.js` にあり、読み込むファイルには `?v=BUILD` が付きます。
遊んでいる人には、宿の画面にだけ「新しい版があります。更新する」が出ます（潜行中や戦闘中には出ません）。

## 札の足し方（入口）

コードは触りません。YAML を書いて置くだけです。

1. `docs/content-guide.md` を読む（置き場所・書き方・使える語彙の一覧。`node tools/check.mjs --docs` で最新になる）
2. `docs/templates/` の雛形（card.yaml など）を写して、`content/sets/<セット>/cards.yaml` に足す
3. `node tools/check.mjs --fix-index` を動かす。間違いは1件1行で、近い候補つきで出る
4. 効果に自己テスト（`test:`）を書くと、検査のたびに確かめられる
5. 強さの見当：`node tools/check.mjs <セット> --trial` で、その札を2枚入れた初期デッキを潜らせ「強すぎ／弱すぎ／普通」を出す（時間がかかる）

既存のIDは `docs/ids.md`（`node tools/check.mjs --ids`）。敵は `content/enemies/`、謎は `content/events/`、キーワード能力は `content/keywords/` に同じように足せます。

## 女将の案内（チュートリアル）

- 中身は `ui/lessons.js`（案内の文と照らす場所、遊び方の一覧）。出し方は `ui/coach.js`
- 案内は「いまの画面と状態」に合った最初の未読のものが出る。案内を1つ足すときは `LESSONS` に1項目足すだけ
- 進み具合は宿のセーブ（`H.hints.tut`）。設定の「女将の案内」でオン・オフと「案内を最初から」
- 最初の1回の潜行は稽古（倒れても持ち込んだデッキが蔵に戻る）

## 道具

| コマンド | すること |
|---|---|
| `node tools/check.mjs` | 検査（形・参照・索引・自己テスト）。`--trial` で札ごとの試し対戦 |
| `node tools/test.mjs` | 計算と仕組みのテスト |
| `node tools/bot.mjs --dives 1000` | 自動対戦。脱出率・到達階・ターン数・組の使用率の要約と CSV（`bot-out/`） |
| `node tools/sim-dive.mjs` / `sim-battle.mjs` | 1回の潜行・戦闘を文字で追う |
| `node tools/release.mjs` | 公開の準備（BUILD とオフライン用の一覧） |
| `index.html?dev=1` | 試し場（好きな札と敵ですぐ戦う・演出の一覧） |

## フォルダ

- `engine/` 計算（画面に触れない。Node でもそのまま動く）
- `ui/` 画面と演出と音
- `content/` 札・敵・層・謎・宿の定義（YAML）と数値（`content/balance/`）
- `vendor/yaml.mjs` 外部ライブラリ（js-yaml）はこれだけ
- `tools/` 検査・テスト・自動対戦
- `docs/` 手引きと雛形

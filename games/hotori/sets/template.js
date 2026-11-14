/* ===== カードセットの書き方（このファイル自体は読み込まれません） =====
 *
 * 1. このファイルをコピーして sets/なまえ.js を作る
 * 2. sets/list.js に 'なまえ.js' を1行足す
 *    （ファイル名は「_」で始めないこと。GitHub Pages で公開されなくなります）
 * 以上。本体のコードは触らなくていい。
 *
 * ルール
 * - 1セット = ちょうど7枚（copies:2 なら2枚と数える）
 * - 1枚のカテゴリは1〜3個
 * - カテゴリは共通カテゴリ（food 食べ物 / death 死 / inn 宿 / animal 動物 / thread スレ / yu 湯 /
 *   school 校庭 / speed 速さ / fgc 格ゲー / ter ター / old 老 / men 麺 / robo ロボ）か、このセットの categories で作ったもの
 *   共通カテゴリのティアは次の局に引き継がれる。セット固有のカテゴリは毎局Tier3から。
 * - 迷ったら「得点・シナジー3枚、ティア関連1〜2枚、他人への干渉1枚、異常かルール崩壊1枚」
 *
 * カードに書ける効果（すべて省略可）
 *   score(g, p, c)          → 【得点】局の終わりの追加点を数で返す
 *   onPick(g, p, c)         → 【取ったとき】
 *   onCut(g, p, c, entry)   → 【捨てられたとき】p は捨てた人（ティア操作のために捨てた）
 *   onDeath(g, p, c)        → 場から捨て札へ送られたとき
 *   onTurnEnd(g, owner, c)  → 【手番の終わり】
 *   onTierChange(g, owner, c, cat, from, to) → どこかのティアが動いたとき
 *   onReverse(g, owner, c)  → 回す向きが変わったとき
 *   onIntro(g, owner, c, who) → 誰かが自己紹介したとき
 *   onAnyPick(g, owner, c, p, picked)          → 誰かがカードを取ったとき
 *   onAnyDeath(g, owner, c, dead, deadOwner)   → 誰かの場のカードが捨て札へ行ったとき
 *   onAnyMove(g, owner, c, moved, from, to)    → 誰かの場のカードが別の場へ移ったとき
 *   carry(g, owner, c)      → true を返すと次の局も場に残る
 *   hooks: { 名前: (g, owner, c, 値, ...) => 新しい値 }  ← 場にある間、ルールを書き換える
 *   noTier: true            → ティアの補正を受けない
 *   tierX: 2                → ティアの補正を2倍で受ける
 *   hidden: true            → 他の人には裏向きに見える
 *   invert: true            → 逆張り：ティアの補正がプラスとマイナス逆になる
 *   reflect: true           → 相手の効果で捨てられそうになると跳ね返す（↩）
 *   wild: true              → 取ったとき、自分の場で一番多いカテゴリが仲間に加わる
 *   copies: 2               → 同じカードを2枚入れる
 *   c.x.boxed / c.x.shield / c.x.kaeshi = 1 → 箱（📦）／守り（🛡）／返し（↩）を付ける
 *   ai(g, p, c)             → CPU向け：取った後に増えそうな点の見込み
 *   c.x                     → このカード1枚ぶんのメモ。c.x.pts に足した点は得点になる
 *
 * セット独自ルール（rules。省略可。ドミニオンの追加ルールのようなもの）
 *   text: 'ルールの説明'
 *   onRoundStart(g) / onTurnEnd(g)
 *   onAnyPick(g, p, c) / onKill(g, c, owner) / onMove(g, c, from, to)
 *   hooks: { 名前: (g, 値, ...) => 新しい値 }
 *
 * フックの名前
 *   tierMod(m, card, cat, owner)   1枚・1カテゴリぶんのティア補正
 *   cardScore(v, card, owner)      1枚の点
 *   playerScore(v, p)              その人の合計点
 *   tierPower(d, p, cat)           p のティア操作の段数
 *   tierSum(sum, cat, voters)      同じ手番の操作を合算した段数
 *   canTier(ok, p)                 p がティアを動かせるか
 *   protect(ok, card, owner)       捨て札・移動から守るか
 *   rankReverse(bool)              true で「点が低いほうが上位」
 *   rankTable(arr) / rankPts(pts, scores, place)  順位点
 *   triggerTimes(n, card, owner, kind)  効果が何回起きるか（kind: death / cut）
 *   datOchi(bool)                  false で最終手番もティアを動かせる
 *   blockPick(bool, card, p)       true でそのカードの【取ったとき】を封じる
 *   order(arr)                     効果が起きる席の順番
 *
 * g（効果から使える道具）の主なもの
 *   g.name(p) g.left(p) g.right(p) g.next(p) 渡す相手 g.prev(p) くれる相手 g.others(p) g.neighbors(p)
 *   g.score(p) g.richer(p) 左右で点の高いほう g.leader()
 *   g.table(p) g.has(p,'id') g.cnt(p,'cat',除外カード) g.hasCat(c,'cat') g.baseOf(c) g.newest(p)
 *   g.kill(c) 捨て札へ g.moveTo(c, p) g.token(p,'id') g.revive(entry, p) g.discard()
 *   g.move('cat', 段, p) g.setPos('cat', 位置) g.kesuban('cat') g.tier('cat') g.topCat() g.bottomCat()
 *   g.reverse() g.later(fn) 手札に触るときはこれで包む g.swapHands(a,b)
 *   g.grantBonus(p) 次の手番に取る＋ティア g.blockTier(p) g.intro(p,n) g.introOf(p)
 *   g.zero(c) 点も効果も0に g.stun(c) 気絶 g.token(p,'id') g.setBase(c,n) g.addGauge(p,n)
 *   g.noPickNext(p) 次の【取ったとき】を封じる g.cutCount(p) g.lostCount(p) g.catsCount(p) g.topCatOf(p)
 *   g.log('文', true) true でバナー演出
 *
 * よく使う形は TJ.K にまとめてある（const K = TJ.K;）
 *   K.per('cat', n)          自分の他の〈cat〉1枚につき+n
 *   K.perAny(['a','b'], n)   どちらかのカテゴリ1枚につき+n
 *   K.with('id', n)          自分の場に id があれば+n
 *   K.withAll(['a','b'], n)  全部そろえば+n
 *   K.atLeast('cat', k, n)   〈cat〉が k枚以上なら+n
 *   K.tierAtLeast('cat', 位置, n)  〈cat〉がその位置より上なら+n
 *   K.takenBy(手番, n) / K.takenFrom(手番, n)  何手番目までに／以降に取ったら+n
 *   K.up('cat', 段)          【取ったとき】〈cat〉を動かす
 *   K.tokens('id', n)        【取ったとき】トークンを n枚
 *   K.grow(n, max)           手番の終わりごとに+n（最大 max）
 *   K.addPts(c, n)           このカードに点を貯める
 *   K.bestOf(g, [席], 条件) / K.worstOf(...)  場から素点の高い／低いカードを1枚選ぶ（守られているものは除く）
 *
 * 他のファイルと名前がぶつからないよう、セット全体を (function(){ ... })(); で包む。
 */
(function () {
const K = TJ.K;
TJ.registerSet({
  id: 'example',
  name: 'セットの名前',
  e: '🏨',
  desc: 'セットの一言説明',
  categories: { example: { name: 'れい', color: '#888888' } },
  rules: null,
  cards: [
    { id: 'ex1', name: 'カード名', e: '🍖', g: '例', cats: ['example', 'food'], base: 3,
      text: '【得点】自分の他の〈れい〉1枚につき+2。', flavor: 'フレーバー',
      score: (g, p, c) => g.cnt(p, 'example', c) * 2 },
    { id: 'ex2', name: 'カード名2', e: '🍜', g: '例', cats: ['example'], base: 2,
      text: '【取ったとき】〈れい〉を1段上げる。', score: K.per('food', 1), onPick: K.up('example', 1) }
  ],
  tokens: []
});
})();

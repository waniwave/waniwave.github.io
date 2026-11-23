// 女将の案内の中身（ui/coach.js が出す）。上から順に、条件が合った最初の未読の案内が出る。
//
// 案内：{ id, when(s), stay?(s), need?: [先に済んでいる案内], steps: [段] }
// 段：  { text: 文字列 | (s) => 文字列, at?: セレクタ | (s) => 要素 | 要素[], do?(s, memo), begin?(s), if?(s), inSheet? }
//   at  … 照らす場所。無ければ照らさない
//   do  … あれば「やってみる」段。成り立ったら次へ（次へボタンは出ない。画面を触れる）
//   if  … 成り立たない段は飛ばす
// s：{ where, H, D, B, base, q(sel), qa(sel), sheet }
//   where：inn・prep・stash・fac・settings・board・result・dive・battle・lab・title


/** 手札で、同じカテゴリを持つ札（一番多いカテゴリ。2枚以上なければ null） */
function pairIn(s) {
  const hand = s.B?.hand || [];
  const by = new Map();
  for (const c of hand) {
    if (c.faceDown) continue;
    for (const cat of c.cat || []) { if (!by.has(cat)) by.set(cat, []); by.get(cat).push(c); }
  }
  const g = [...by.entries()].filter(([, x]) => x.length >= 2).sort((a, b) => b[1].length - a[1].length)[0];
  return g ? { cat: g[0], cards: g[1].slice(0, Math.min(g[1].length, 3)) } : null;
}
const cardEls = (s, cards) => cards.map((c) => s.q(`section.hand .card[data-uid="${c.uid}"]`)).filter(Boolean);
const opsBtn = (s, n) => s.q(`footer.ops > .btn:nth-child(${n})`);
const doorToTry = (s) => {
  const act = s.qa('button.door.act');
  return act.find((b) => b.dataset.kind === '戦い') ?? act[0] ?? null;
};
const battleKind = (s) => s.D?.battle?.kind ?? null;
const start = (s) => s.base.balance.tiers.banzukeStart;
const strengthOf = (s, slot) => { const v = s.base.balance.tiers.tiers[slot]?.strength; return typeof v === 'number' ? v : v?.random ? `${v.random[0]}〜${v.random[1]}` : '?'; };
const ovx = (s, n) => 1 + s.base.balance.hands.overlap.step * (n - 1);
/** 番付で、始めの段から動いたカテゴリ */
const moved = (s) => Object.entries(s.B?.banzuke || {}).filter(([, t]) => t !== start(s));
/** 計算窓の数（強さ×倍率＝論破値）を読む */
function calcNums(s) {
  const t = (s.q('section.calc')?.lastElementChild?.textContent || '').replace(/\s+/g, '');
  const m = t.match(/([\d.,万億兆京e+]+)×([\d.,万億兆京e+]+)[=＝]([\d.,万億兆京e+]+)/);
  return m ? { S: m[1], M: m[2], V: m[3] } : null;
}
const rarIdx = (s, x) => s.base.balance.rarity.order.indexOf(x.rar || s.base.balance.rarity.gradeFloor[s.base.content.cards[x.id]?.grade] || 'コモン');
/** 報酬に出ている札のうち、一番高いレアリティ */
function bestRewardCard(s) {
  const opts = (s.D?.reward?.groups || []).flatMap((g) => g.options || []).filter((x) => x.type === 'card');
  return opts.sort((a, b) => rarIdx(s, b) - rarIdx(s, a))[0] ?? null;
}

export const LESSONS = [
  // ───────── 宿：はじめまして ─────────
  {
    id: 'welcome',
    when: (s) => s.where === 'inn',
    steps: [
      { text: 'いらっしゃい。ター宿の女将、マープです。\nこの宿の床下には「ター深（ぶか）」っていう、底の知れない議論スレが埋まってるの。' },
      { text: 'あなたは札（カード）の束を持ってター深に潜り、出てくる論客を札で論破しながら下りていく。\n深いほど、良い札が拾える。' },
      { text: '生きて帰ってくれば、拾った物はぜんぶあなたの物。\nでも途中で倒れたら、持ち込んだデッキも拾った物も、底に置いてくることになる。' },
      { text: 'だから大事なのは「もう少し下りるか、ここで戻るか」。\n欲張るほど稼げて、欲張るほど危ない。それがター深よ。' },
      { at: '.itop .btn', text: '決まりごとは、左上の「遊び方」でいつでも読める。\n分からない物は押してみて。説明が画面の「説明欄」か、下の説明の窓に出るわ。\n札の一覧には、名前の下に効果も書いてある。' },
      { at: 'footer.ops .btn.main', text: '習うより慣れろ。\n下の「潜る」を押して。', do: (s) => s.where === 'prep' || s.where === 'dive' || s.where === 'battle' },
    ],
  },

  // ───────── 潜行準備 ─────────
  {
    id: 'prep',
    when: (s) => s.where === 'prep',
    steps: [
      { at: '.chips.guests', text: '一緒に潜る「宿泊客」を選ぶの。\n宿泊客ごとに得意な戦い方が違う。最初は一人だけ。脱出したり深く潜ったりすると、顔ぶれが増える。' },
      { at: '.pgrid', text: 'デッキは最初から入門の札が揃ってるから、そのままで大丈夫。\n常連客・お守り袋・お品書き・保険は、持ち物が増えてから使うもの。今は空でいいわ。' },
      { at: '.risk', text: '「失うかもしれない総額」。倒れたら、これだけの値打ちの物がなくなるっていう目安。\n良い札を持ち込むほど、ここが大きくなる。' },
      { if: (s) => (s.H?.records?.dives ?? 0) === 0, text: '初めてだから、今回は稽古にしてあげる。\n倒れても、持ち込んだデッキは蔵に戻しておくわ。怖がらずに、行けるところまで行ってらっしゃい。' },
      { at: 'footer.ops .hold', text: '準備ができたら「潜る」を押して。\n一度潜ったら、帰ってくるか倒れるまで宿には戻れないわよ。', do: (s) => s.where === 'dive' || s.where === 'battle' },
    ],
  },

  // ───────── 潜行：襖の列 ─────────
  {
    id: 'map',
    when: (s) => s.where === 'dive' && s.D?.phase === 'map',
    steps: [
      { at: 'header.top', text: 'B1は地下1階。\n「体力」が0になったら倒れる。「宿銭」は潜っている間に稼ぐお金で、行商人で使えて、帰れば宿の財布に入る。' },
      { at: '.map', text: 'これが襖（ふすま）の列。上の列から1段ずつ、どれか1つを開けて進むの。\n戦は論客、精は手強い論客、宝は札、商は行商人、湯はひと休み、謎は開けてのお楽しみ。' },
      { at: '.map', text: '3列進むと、その階の「踊り場」。\nそこで、さらに下りるか、宿に引き返すかを選ぶ。' },
      { at: 'section.presence', text: '「気配」。部屋に入るたびに溜まって、溜まるほど論客が強く、しつこくなる。\n層（3階ごと）が変われば0に戻るわ。' },
      { at: 'footer.ops', text: '下の「札」は持ち込んだデッキ、「懐」は拾った物を入れる袋、「品」は戦いで使う道具。\n押すと中身が見られる。' },
      { at: doorToTry, text: (s) => (doorToTry(s)?.dataset.kind === '戦い' ? 'まずは「戦」の襖を開けて、論客と一戦交えてみましょう。' : '光っている襖のどれかを開けて、進んでみて。'), do: (s) => s.where === 'battle' || (s.D && s.D.phase !== 'map') || (s.D?.map?.visited?.length ?? 0) > 0 },
    ],
  },

  // ───────── 最初の戦い：勝ち方の基本 ─────────
  {
    id: 'battle',
    when: (s) => s.where === 'battle' && !!s.B && !s.B.result,
    steps: [
      { at: 'section.foes', text: '相手の論客よ。\n下の大きな数字が「主張」。これを0にすれば論破、あなたの勝ち。' },
      { at: 'section.foes .int', text: (s) => { const t = s.q('section.foes .int')?.textContent || ''; return `上の赤い字は、相手が次にすることの予告。\n「${t || '攻め'}」なら、あなたがターンを終えたときに体力を削ってくる。上の体力のゲージの点線は、予告どおり食らったときの残りよ。`; } },
      { at: 'section.hand', text: '下があなたの手札、8枚。\n札の右上の色つきの字が「カテゴリ」。麺、湯、宿…ぜんぶで13種類あって、1枚に1〜3個付いてる。' },
      { at: 'section.hand', text: (s) => `札の左上の数字は、その札の「Tier」。札の強さはTierで決まるの。\n今はどの札もTier${start(s)}で、強さ${strengthOf(s, start(s))}。Tierの話は、また次の戦いでね。` },
      { at: 'section.hand', text: (s) => `大事なのはここから。同じカテゴリの札を一緒に出すと、倍率が上がる。これを「重なり」っていうの。\n2枚で×${ovx(s, 2)}、3枚で×${ovx(s, 3)}、4枚で×${ovx(s, 4)}、5枚で×${ovx(s, 5)}。` },
      {
        at: (s) => { const p = pairIn(s); return p ? cardEls(s, p.cards) : s.q('section.hand'); },
        text: (s) => { const p = pairIn(s); return p ? `照らした札は、どれも〈${p.cat}〉を持ってる。\n${p.cards.length}枚とも押して選んでみて。もう一度押せば外れるわ。` : '今は同じカテゴリの札が無いみたい。\n札を1枚押して選んでみて。もう一度押せば外れるわ。'; },
        begin: (s) => { const p = pairIn(s); return { plays: s.B?.playsLeft ?? 0, turn: s.B?.turn ?? 0, need: p ? p.cards.length : 1 }; },
        do: (s, m) => !s.B || !!s.B.result || s.qa('section.hand .card.sel').length >= m.need || s.B.turn !== m.turn || s.B.playsLeft < m.plays,
      },
      { at: 'section.calc', if: (s) => s.qa('section.hand .card.sel').length > 0, text: (s) => { const n = calcNums(s); return `ここが計算窓。選ぶだけで、出したときの見込みが出る。\n${n ? `いまは 強さ${n.S} × 倍率${n.M} ＝ 論破値${n.V}。` : '強さ × 倍率 ＝ 論破値。'}論破値のぶん、相手の主張が減るの。`; } },
      { at: 'section.calc', if: (s) => s.qa('section.hand .card.sel').length > 0, text: '左の色の札は、重なったカテゴリと枚数。\n重なりが多いほど倍率が大きい。出す前に、ここで一番大きくなる組み合わせを探すのがコツよ。' },
      {
        at: 'footer.ops .btn.main', text: 'じゃあ「出す」。狙っている相手に論破値をぶつけるわ。\n相手が何人もいるときは、相手を押して狙いを変えられる。',
        begin: (s) => ({ plays: s.B?.playsLeft ?? 0, turn: s.B?.turn ?? 0 }),
        do: (s, m) => !s.B || !!s.B.result || s.B.turn !== m.turn || s.B.playsLeft < m.plays,
      },
      { at: 'section.hand', text: '気をつけて。一緒に出したほかの札とカテゴリが1つも重ならない札は、採点されないの。\nその札は「受け」になって、このターンに食らう攻撃を減らしてくれる。' },
      { at: (s) => [opsBtn(s, 1), opsBtn(s, 2)], text: (s) => `「出す」は1ターンに${s.base.balance.hands.play.playsPerTurn}回まで。出した札は手札から減って、次のターンの始めに8枚まで引き直す。\n「流す」は1ターンに${s.base.balance.hands.play.discardsPerTurn}回、要らない札を捨てて同じ枚数引き直せる。重なりが作れないときに。` },
      { at: (s) => opsBtn(s, 3), text: 'やれることをやったら「終了」。相手が予告どおりに動いて、次のターン。\n札や相手を押すと、真ん中の「説明欄」に効果や詳しいことが出る。さあ、論破してらっしゃい。' },
    ],
  },

  // ───────── 二度目の戦い：Tierと重ね方 ─────────
  {
    id: 'battle2',
    need: ['battle'],
    // 最初の戦いの案内が済んだあと、次の戦いの始め（まだ1回も出していない）
    when: (s) => s.where === 'battle' && !!s.B && !s.B.result && s.B.turn === 1 && (s.B.stats?.plays ?? 0) === 0,
    stay: (s) => s.where === 'battle' && !!s.B && !s.B.result,
    steps: [
      { at: 'section.banzuke', text: 'もう一歩、踏み込みましょう。\n上の表が「番付」。13のカテゴリが、それぞれどのTierにいるかが書いてある。最初はみんなTier3。' },
      { at: 'section.banzuke', text: (s) => `札の強さは、その札のカテゴリが番付でいるTierで決まるの。\n${s.base.balance.tiers.ring.map((t) => `${t === 'God' ? 'God' : `Tier${t}`}＝${strengthOf(s, t)}`).join('、')}。` },
      { at: 'section.banzuke', text: '札の効果や論客の行動で、番付は上がったり下がったりする。\n自分のデッキのカテゴリをGodまで押し上げられたら、強さは6倍。ここを動かすのがター深の醍醐味よ。' },
      { at: 'section.hand', text: (s) => `カテゴリを2つ持つ札は、どっちのカテゴリにも1枚ずつ数える。\nたとえば〈麺〉が3枚、〈食べ物〉が2枚重なれば、×${ovx(s, 3)}と×${ovx(s, 2)}を掛けて ×${ovx(s, 3) * ovx(s, 2)}。2つ、3つのカテゴリを同時に重ねると桁が変わるわ。` },
      { at: 'section.hand', text: '札の効果は、押せば説明欄に出る。カテゴリごとに得意なことがあるの。\nスレは札を引く、ターは番付を動かす、宿は受け、麺や食べ物は上乗せ、動物は群れるほど強い…。' },
      { at: 'section.hand', text: '札の右下の C・UC・R・L・U・M は「レアリティ」。コモンからミシックまで6段。\n高いほど効果の数字が大きくなる。深く潜るほど、高いレアリティが拾えるわ。' },
    ],
  },

  // ───────── 番付が動いた ─────────
  {
    id: 'banzukeMoved',
    need: ['battle'],
    when: (s) => s.where === 'battle' && !!s.B && !s.B.result && moved(s).length > 0,
    steps: [
      { at: 'section.banzuke', text: (s) => { const [cat, t] = moved(s)[0]; return `番付が動いたわね。〈${cat}〉が${t === 'God' ? 'God' : `Tier${t}`}になった。\nいまの〈${cat}〉の札は、強さ${strengthOf(s, t)}。札の左上の数字も変わってるでしょう？`; } },
      { text: '上がったカテゴリの札は狙い目。下げられたカテゴリは、しばらく控えるのも手よ。\n番付は、その潜行のあいだ持ち越す。宿に帰ると元に戻るわ。' },
    ],
  },

  // ───────── 報酬 ─────────
  {
    id: 'reward',
    when: (s) => s.where === 'dive' && s.D?.phase === 'reward',
    steps: [
      { at: '.panel.reward', text: 'お見事。勝ったら報酬よ。\n欲しい物を押すと、どこに入れるか選べる。いらなければ「見送る」。' },
      { text: '「デッキへ」入れれば、次の戦いからすぐ使える。\n「懐へ」入れれば、持ち帰るだけの売り物。どっちも、生きて帰れば宿の蔵に入るわ。' },
      { text: '選ぶときは、デッキに多いカテゴリの札を取ると重なりやすい。\n違うカテゴリの札でも、2つのカテゴリを持っていて橋渡しになるなら、むしろお宝よ。' },
      { at: 'footer.ops', text: 'ただし、懐が重いほど、帰り道の番人が強くなる。\n欲張りすぎは禁物。' },
      { at: '.panel.reward .btn.main', text: '選び終わったら「進む」。' },
    ],
  },

  // ───────── レア以上の札を拾ったとき ─────────
  {
    id: 'rareDrop',
    need: ['reward'],
    when: (s) => s.where === 'dive' && s.D?.phase === 'reward' && !!bestRewardCard(s) && rarIdx(s, bestRewardCard(s)) >= 2,
    steps: [
      { at: (s) => s.q('.panel.reward .thing.r-レア, .panel.reward .thing.r-レジェンダリー, .panel.reward .thing.r-ユニーク, .panel.reward .thing.r-ミシック'), text: (s) => `${bestRewardCard(s).rar ?? 'レア'}の札が出たわね。枠の色がレアリティ。\n灰がコモン、緑がアンコモン、青がレア、金がレジェンダリー、朱がユニーク、虹がミシック。` },
      { text: 'レアリティが上がるほど効果の数字が大きくなる（コモンの1.5倍〜8倍）。\nレア以上には「◆刻印」っていう小さなおまけも付く。押して中身を見て。' },
      { text: '同じ札でも、レアリティと刻印で値打ちが違う。\n深い層は、レアリティの高い札で押し切るのよ。だからこそ、失うのが怖いの。' },
    ],
  },

  // ───────── 踊り場：行くか戻るか ─────────
  {
    id: 'landing',
    when: (s) => s.where === 'dive' && s.D?.phase === 'landing',
    steps: [
      { at: '.lstat', text: 'ここが踊り場。この遊びでいちばん大事な場所よ。\n体力と、懐の総額を見て。' },
      { at: '.lnext', text: '「下りる」と次の階。深いほど論客は手強くなるけど、拾える札のレアリティも上がる。\n層の最後の階（3の倍数）には「層主」が待ってるわ。' },
      { at: '.lwarden', text: '「引き返す」なら、帰り道の番人と一戦。勝てば脱出。拾った物はぜんぶあなたの物。\n懐が重いほど番人は強い。' },
      { at: '.lchoice', text: (s) => `どっちも押すとすぐ決まるから、よく考えて。\n体力が心もとないなら、帰るのも立派な判断よ。${s.D?.practice ? '\n今回は稽古だから、試しに下りてみるのもいいわね。' : ''}` },
    ],
  },

  // ───────── 結果 ─────────
  {
    id: 'result',
    when: (s) => s.where === 'result',
    steps: [
      { text: (s) => (s.root?.classList.contains('mono')
        ? (s.H?.lastResult?.practice ? 'おかえり…って言いたいところだけど、倒れちゃったわね。\n本当なら、持ち込んだ物はぜんぶ失う。今回は稽古だから、デッキは蔵に戻しておいたわ。' : '倒れたら、持ち込んだ物はなくなる。お守り袋の中身だけは残るわ。\n保険を掛けていた物は、運が良ければそのうち戻ってくる。')
        : 'おかえりなさい。よく帰ってきたわね。\n持ち帰った物は、ぜんぶ宿の蔵に入ってる。') },
      { if: (s) => !!s.H?.lastResult?.practice, text: '次からは本番。倒れたら本当になくなるからね。\n「どこで引き返すか」を、よく考えて。' },
    ],
  },

  // ───────── 宿：二度目からの話 ─────────
  {
    id: 'inn2',
    need: ['welcome'],
    when: (s) => s.where === 'inn' && (s.H?.records?.dives ?? 0) >= 1,
    steps: [
      { at: '.irow .btn:first-child', text: '持ち帰った物は「蔵」に入る。札・常連客・品・お土産で棚が分かれてる。\n札はデッキに入れて使う。要らない物は、まとめて選んで売れるわ。' },
      { at: '.facs', text: '宿銭が貯まったら、施設を改装しましょう。それぞれ何をする所かは、名前の横に書いてある。\n押すと中に入れて、改装もそこでできるわ。' },
      { at: '.facs', text: '帳場では札が買える。カテゴリごとの基礎札、改装すれば構築済みのデッキやコンボの札ひとそろいも。高いレアリティは売ってない。\n仕込み場では札に仕込み・版・判を付けられる。\n同じ札・同じレアリティ3枚を「合わせ」て1段上にもできる（レジェンダリーまで）。ユニーク以上は、潜って拾うしかないわ。' },
      { text: 'お守り袋に入れた物は、倒れても戻ってくる。\n保険を掛けた物は、倒れても運が良ければ戻ってくる。大事な札は守ってあげて。' },
      { at: 'footer.ops .btn:first-child', text: '「素泊まり」は、借り物のデッキで潜るおまけ。\n失う物が無いから気楽にどうぞ。脱出すると回数が戻るわ。' },
      { text: 'あとは潜って、稼いで、改装して、もっと深く。\nいちばん底の主を倒して帰れば、もっと厳しい「深度」が開く。いってらっしゃい。' },
    ],
  },

  // ───────── 初めて出会ったとき ─────────
  { id: 'shop', when: (s) => s.where === 'dive' && s.D?.phase === 'shop', steps: [
    { at: '.panel.shop', text: '行商人。宿銭で札・常連客・お品書きが買える。\n売っている札はレアまで。デッキに足りないカテゴリを買い足すのもいいわね。' },
    { text: '買った物は、報酬と同じようにデッキか懐か、入れる先を選べる。\n宿銭は持ち帰れば宿の財布に入るから、使うか貯めるかはお好みで。' },
  ] },
  { id: 'bath', when: (s) => s.where === 'dive' && s.D?.phase === 'bath', steps: [
    { at: '.panel.bath', text: 'お湯でひと休み。体力を戻すか、札に仕込みを付けるか、気配を下げるか、どれか1つ。\nここではデッキと懐の中身も入れ替えられるわ。' },
  ] },
  { id: 'event', when: (s) => s.where === 'dive' && s.D?.phase === 'event', steps: [
    { at: '.panel.event', text: '謎の部屋。何が起きるかは文をよく読んで決めて。\nいいことばかりじゃないわよ。' },
  ] },
  { id: 'chase', when: (s) => s.where === 'dive' && s.D?.phase === 'chase', steps: [
    { at: '.panel.chase', text: '追跡者に見つかった！ 気配が溜まると割り込んでくるの。\n戦うか、何かを払って逃げるか。' },
  ] },
  { id: 'exit', when: (s) => s.where === 'dive' && s.D?.phase === 'exit', steps: [
    { at: '.panel.exit', text: '非常口。何かを置いていけば、その場で外に出られる。\n番人と戦う余力が無いときの命綱よ。' },
  ] },
  { id: 'elite', need: ['battle'], when: (s) => s.where === 'battle' && battleKind(s) === '精鋭' && !s.B?.result, steps: [
    { at: 'section.foes', text: '精鋭。並の論客よりずっと手強いけど、報酬のレアリティも一段良い。\n予告をよく見て、無理なら受けで耐えて。' },
  ] },
  { id: 'boss', need: ['battle'], when: (s) => s.where === 'battle' && battleKind(s) === '層主' && !s.B?.result, steps: [
    { at: 'section.foes', text: 'この層の主よ。主には「縛り」っていう特別な決まりがある。\n番付を動かしてくる主もいるわ。相手を押して、説明欄で縛りを確かめて。' },
    { text: '主を倒せば昇降機が動いて、番人と戦わずに帰れる。\nもちろん、そのまま次の層に下りてもいい。' },
  ] },
  { id: 'warden', need: ['battle'], when: (s) => s.where === 'battle' && battleKind(s) === '番人' && !s.B?.result, steps: [
    { at: 'section.foes', text: '帰り道の番人。こいつを退ければ脱出よ。\n負けたら…分かってるわね。' },
  ] },
  { id: 'seats', need: ['battle'], when: (s) => s.where === 'battle' && (s.B?.seats?.length ?? 0) > 0 && !s.B?.result, steps: [
    { at: 'section.seats', text: '常連客は席に座って、戦いを手伝ってくれる。\n押すと、何をしてくれるか説明欄に出るわ。' },
  ] },
  { id: 'items', need: ['battle'], when: (s) => s.where === 'battle' && (s.B?.items?.length ?? 0) > 0 && !s.B?.result, steps: [
    { at: (s) => opsBtn(s, 4), text: 'お品書き（品）を持ってるわね。\n「品」から使える。たいてい1回きりの道具。議題は、そのカテゴリを番付で1段上げるのよ。' },
  ] },
  { id: 'guestAct', need: ['battle'], when: (s) => s.where === 'battle' && !!s.q('footer.ops > .btn:nth-child(5)') && !s.B?.result, steps: [
    { at: (s) => s.q('footer.ops > .btn:nth-child(5)'), text: 'これは、いまの宿泊客だけができること。\n押すと使える。何が起きるかは、手札を選ぶ前に説明欄で確かめて。' },
  ] },
  { id: 'stash', need: ['welcome'], when: (s) => s.where === 'stash', steps: [
    { at: '.tabs', text: '蔵よ。上のタブで、札・常連客・品・お土産の棚を切り替えるの。' },
    { at: '.things.deck', if: (s) => !!s.q('.things.deck'), text: '札の棚では、上の段がいまのデッキ。下の段の札を押せばデッキに入る。デッキの札を押せば外れる。\n同じカテゴリの札を多めに入れると、重なりが作りやすいわ。' },
    { at: '.filters', text: '「並び」で、新しい順・名前・レアリティ・カテゴリ・売値に並べ替えられる。\nカテゴリやレアリティで絞り込むこともできるわ。' },
    { at: 'footer.ops', text: '「売る」を押すと、売りたい物を押して何点でも選べる。最後に「売る」でまとめて売るの。\nお土産の棚には「お土産を全部売る」もあるわよ。改装に使う分は残してね。' },
  ] },
  { id: 'combo', need: ['battle'], when: (s) => s.where === 'battle' && !!s.q('section.hand .card .cmbmk') && !s.B?.result, steps: [
    { at: (s) => s.qa('section.hand .card').filter((c) => c.querySelector('.cmbmk')), text: '札に「◎」が付いたわね。手札に「コンボ」の相手がそろってる印よ。\nコンボは、決まった札どうしを同じ出しに入れると起きる。カテゴリは関係ないの。' },
    { text: 'ターメリックとターメリックライスでカレー、EOとOEで論破値10倍…。\n札を押すと、説明欄にその札のコンボの相手と効果が出る。コンボを軸にデッキを組むのも手よ。' },
    { text: '出した札の名前は短くつながって「呪文」になって響くわ。\nコンボは帳場（改装すると）の「コンボ帳」で、札をひとそろい買えることもある。' },
  ] },
  { id: 'seal', need: ['battle'], when: (s) => s.where === 'battle' && !!s.q('section.foes .int.warn') && !s.B?.result, steps: [
    { at: 'section.foes .int.warn', text: '赤い帯の予告は「封じ」。ターンを終えたとき、あなたの手札で一番多いカテゴリを封じるの。\n封じられたカテゴリの札は、次の1ターンだけ採点されずに受けになる。' },
    { text: '予告に出ているのが、今の手札で封じられそうなカテゴリ。\nそのカテゴリを先に出し切るか、流して別のカテゴリを多くしておけば、かわせるわ。' },
  ] },
  { id: 'warp', need: ['prep'], when: (s) => s.where === 'prep' && !!s.q('.prow .chips'), steps: [
    { at: (s) => s.qa('.prow').find((x) => x.textContent.includes('入口')), text: '一度たどり着いた層なら、その入口から潜れる（ワープ）。\n浅い階を飛ばせるけど、そのぶん浅い階で拾える物と宿銭は無いわ。' },
  ] },
  { id: 'chouba', need: ['welcome'], when: (s) => s.where === 'fac' && !!s.q('.chips.cats'), steps: [
    { at: '.chips.cats', text: '帳場では、カテゴリを選ぶと、その基礎札が何枚でも買える。\n改装すると、そのカテゴリだけで組んだ構築済みデッキも並ぶわ。' },
  ] },
  { id: 'fuse', need: ['welcome'], when: (s) => s.where === 'fac' && s.qa('h3').some((x) => x.textContent === '合わせ'), steps: [
    { at: (s) => s.qa('h3').find((x) => x.textContent === '合わせ'), text: '仕込み場の「合わせ」。同じ札・同じレアリティを3枚で、1段上のレアリティの1枚にできる。\nコモン3枚でアンコモン、アンコモン3枚でレア…レジェンダリーまでね。' },
  ] },
];

/** 遊び方（設定と宿から開く。案内を見逃しても、ここを読めば分かる） */
export function rules(base) {
  const P = base.balance.hands.play;
  const T = base.balance.tiers;
  const O = base.balance.hands.overlap;
  const bz = T.ring.map((t) => { const v = T.tiers[t].strength; return `${t} ${typeof v === 'number' ? v : `${v.random[0]}〜${v.random[1]}`}`; }).join('、');
  return [
  ['ター深とは', [
    '宿の床下に埋まった議論スレ「ター深」に潜り、札で論客を論破しながら下りていくゲーム。',
    '拾った札やお宝は、生きて帰れば（脱出すれば）自分の物。倒れると、持ち込んだデッキと拾った物を失う。',
    '「もう少し下りるか、ここで引き返すか」を決めるのがいちばんの勘所。',
  ]],
  ['一回の潜行', [
    '宿で「潜る」→ 宿泊客と持ち物を決めて「潜る」。行ったことのある層の入口からも潜れる（ワープ）。',
    '各階は襖の列が3つ。上から1列ずつ、襖を1つ開けて進む。',
    '3列進むと踊り場。「下りる」で次の階、「引き返す」で帰路の番人と戦い、勝てば脱出。',
    '層の最後の階には層主。倒すと昇降機が動き、番人なしで帰れる。',
  ]],
  ['襖の種類', [
    '戦：敵。精：強い敵（報酬が良い）。宝：札など。商：行商人で買い物。',
    '湯：体力・仕込み・気配のどれか1つ。謎：出来事。寄：列の外の宝部屋（気配＋2）。非：通行料を払って脱出。主：層主。',
  ]],
  ['気配', [
    '部屋に入るたび＋1。溜まると敵の主張が上がり、8からは追跡者が割り込む。',
    '層が変わると0に戻る。湯で下げられる。',
  ]],
  ['戦い', [
    '敵の「主張」を0にすれば論破。敵の上の小さな字は次の行動の予告。',
    `手札${P.handSize}枚から${P.minCards}〜${P.maxPlayCards}枚（稽古場の改装で6枚）を選んで「出す」（1ターン${P.playsPerTurn}回）。「流す」（${P.discardsPerTurn}回）で要らない札を引き直す。「終了」で敵が動く。`,
    '論破値＝強さ（S）×倍率（M）。札を選ぶと計算窓に見込みが出る。',
    '出した札のうち、ほかの札とカテゴリが1つも重ならない札は採点されず「受け」になり、そのターンに受ける攻撃を減らす。',
    `出した札は次のターンの始めに${P.handSize}枚まで補充。`,
  ]],
  ['強さと重なり', [
    '札に固有の数字は無い。札の強さは、その札のカテゴリが番付でいるTierで決まる（複数あれば一番高いもの）。',
    `Tierごとの強さ：${bz}。`,
    `倍率は「重なり」で決まる。採点される札のうち同じカテゴリが2枚で×${1 + O.step}、3枚で×${1 + O.step * 2}、4枚で×${1 + O.step * 3}、5枚で×${1 + O.step * 4}。カテゴリごとの倍率を全部掛け合わせる。`,
    'カテゴリを2つ以上持つ札は、それぞれのカテゴリに1枚ずつ数える。2つ・3つのカテゴリを同時に重ねると、掛け算で桁が変わる。',
    'カテゴリには役割がある：速さ（先手）・格ゲー（連打）・麺／食べ物（上乗せ）・スレ（引く）・ター（Tierを動かす）・宿（受け）・湯（回復）・校庭（止める）・老（育つ）・死（体力を払う）・動物（群れ）・ロボ（効果の無い札を強く）。',
  ]],
  ['コンボと呪文', [
    '決まった札どうしを同じ出しに入れると「コンボ」。カテゴリは関係ない（例：ターメリック＋ターメリックライス＝カレー、EO＋OE＝論破値×10）。',
    '採点されない札もコンボには数える。1枚の札は1つのコンボにしか使わない。',
    '手札にコンボの相手がそろうと札に◎が付く。札を押すと、説明欄にコンボの相手と効果が出る。',
    '出した札の名前は短くつながって「呪文」になる。コンボはその名前でまとまる。',
    '帳場を改装すると「コンボ帳」で、知っているコンボの札をひとそろい買える（帳場で売る段の札だけ）。',
  ]],
  ['敵の封じ', [
    '「封じ〈カテゴリ〉」の予告は、ターンを終えたときの手札で一番多いカテゴリを封じる。予告には今の手札で封じられそうなカテゴリが出る。',
    '封じられたカテゴリの札は、次の1ターンだけ採点されず受けになる（札に「封」の印）。',
  ]],
  ['番付', [
    `カテゴリごとに、どのTierにいるか。最初はみんなTier${T.banzukeStart}。`,
    '札の効果や敵の行動で上げ下げされる。好きなカテゴリをGodへ押し上げるのが強さの近道。',
  ]],
  ['レアリティ', [
    '札は1枚ごとにレアリティを持つ：コモン・アンコモン・レア・レジェンダリー・ユニーク・ミシック。',
    '上がるほど効果の数字が大きくなる（×1・×1.5・×2・×3・×5・×8）。数字の無い効果は、レジェンダリーから2回以上起きる。効果の無い札も、レジェンダリーから2回以上採点される。',
    'レア以上には「刻印」（小さなおまけ）が付く。同じ札でも当たり外れがある。',
    '深く潜るほど高いレアリティが出る。仕込み場の「合わせ」で同じ札・同じレアリティ3枚を1段上にできる（レジェンダリーまで。ユニーク・ミシックは拾うしかない）。',
  ]],
  ['持ち物', [
    `デッキ：戦いで使う札（${P.deckMin}〜${P.deckMax}枚）。懐：拾った物を持ち帰る袋。重いほど帰路の番人が強い。`,
    'お守り袋：倒れても残る。お品書き：戦いで使う道具。常連客：席に座って手伝う（持ち帰れる）。',
    '保険：神棚で掛け金を払うと、失った物が運が良ければ戻る。',
  ]],
  ['宿', [
    '宿銭で施設を改装。帳場（札・基礎札・構築済みデッキ・コンボ帳）・蔵（入る数・複製）・物置（懐とお守り袋）・客間（常連客の席）・神棚（保険・供養）・仕込み場（仕込み・版・判、合わせ）・稽古場（一度に出せる札を6枚に）。',
    '仕込み：札の性質を変える（金箔・鋼・硝子など）。版：出したときの点に上乗せ。判：採点や手札の扱いでおまけ。どれも1枚に1つ。中身は仕込み場に書いてある。',
    '蔵は札・常連客・品・お土産の棚に分かれる。並べ替え・絞り込み・まとめて売るができる。',
    '素泊まり：借り物のデッキで潜る。失う物なし。',
    '掲示板：日替わりの潜行、共有コード、縛り潜行。',
    '最深部の主を倒して脱出すると、次の深度（より厳しい条件）が開く。',
  ]],
  ['操作', [
    '押すと説明が出る：戦いでは真ん中の「説明欄」、ほかの画面では下の説明の窓（✕か外を押すと閉じる）。長押しは使わない。',
    '札の一覧には、名前の下に効果の短い文がいつも出ている。',
    '画面が低い端末では、画面ごと上下にスクロールできる。',
    '演出中に画面をタップすると早送り。PCでは数字キーで札を選び、Enterで出す。',
  ]],
];
}

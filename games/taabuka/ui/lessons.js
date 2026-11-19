// 女将の案内の中身（ui/coach.js が出す）。上から順に、条件が合った最初の未読の案内が出る。
//
// 案内：{ id, when(s), stay?(s), need?: [先に済んでいる案内], steps: [段] }
// 段：  { text: 文字列 | (s) => 文字列, at?: セレクタ | (s) => 要素 | 要素[], do?(s, memo), begin?(s), if?(s), inSheet? }
//   at  … 照らす場所。無ければ照らさない
//   do  … あれば「やってみる」段。成り立ったら次へ（次へボタンは出ない。画面を触れる）
//   if  … 成り立たない段は飛ばす
// s：{ where, H, D, B, base, q(sel), qa(sel), sheet }
//   where：inn・prep・stash・fac・settings・board・result・dive・battle・lab・title


/** 手札で、同じTierの2枚（無ければ null） */
function pairIn(s) {
  const hand = s.B?.hand || [];
  const by = new Map();
  for (const c of hand) {
    if (c.faceDown || c.tier == null) continue;
    const k = String(c.tier);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(c);
  }
  const g = [...by.values()].filter((x) => x.length >= 2).sort((a, b) => b.length - a.length)[0];
  return g ? g.slice(0, Math.min(g.length, 3)) : null;
}
const cardEls = (s, cards) => cards.map((c) => s.q(`section.hand .card[data-uid="${c.uid}"]`)).filter(Boolean);
const opsBtn = (s, n) => s.q(`footer.ops > .btn:nth-child(${n})`);
const doorToTry = (s) => {
  const act = s.qa('button.door.act');
  return act.find((b) => b.dataset.kind === '戦い') ?? act[0] ?? null;
};
const battleKind = (s) => s.D?.battle?.kind ?? null;

export const LESSONS = [
  // ───────── 宿：はじめまして ─────────
  {
    id: 'welcome',
    when: (s) => s.where === 'inn',
    steps: [
      { text: 'いらっしゃい。ター宿の女将、マープです。\nこの宿の床下には「ター深（ぶか）」っていう、底の知れない議論スレが埋まってるの。' },
      { text: 'あなたは札（カード）の束を持ってター深に潜って、出てくる論客を札で論破しながら下りていく。\n拾った札やお宝は、生きて帰ってくれば全部あなたの物。' },
      { text: 'でも、途中で倒れたら、持ち込んだデッキも拾った物も、ぜんぶ底に置いてくることになる。\n「もう少し下りるか、ここで戻るか」。それを決めるのが、この遊びのいちばんの勘所よ。' },
      { at: '.facs', text: 'ここが宿。潜って稼いだ宿銭で、施設を改装できる。\n最初のうちは気にしなくていいわ。帰ってきたら、またゆっくり説明する。' },
      { at: '.irow', text: '蔵にはあなたの持ち物とデッキ。図鑑には見つけた札。\n分からなくなったら「設定」から、この案内を最初から聞き直せるし、宿の左上の「遊び方」でいつでも決まりごとを読める。' },
      { text: 'それと、大事なこと。\n分からない物は「長押し」してみて（パソコンならマウスを乗せるだけ）。たいていの物は説明が出るわ。' },
      { at: 'footer.ops .btn.main', text: 'さ、習うより慣れろ。\n下の「潜る」を押して。', do: (s) => s.where === 'prep' || s.where === 'dive' || s.where === 'battle' },
    ],
  },

  // ───────── 潜行準備 ─────────
  {
    id: 'prep',
    when: (s) => s.where === 'prep',
    steps: [
      { at: '.chips.guests', text: 'まずは一緒に潜る「宿泊客」を選ぶ。\n宿泊客ごとに戦い方の癖が違うの。最初は一人だけ。脱出したり深く潜ったりすると、顔ぶれが増えていく。' },
      { at: '.pgrid', text: 'デッキは最初から入門の札が揃ってるから、そのままで大丈夫。\n常連客・お守り袋・お品書き・保険は、持ち物が増えてから使うもの。今は空でいいわ。' },
      { at: '.risk', text: '「失うかもしれない総額」。\n倒れたら、これだけの値打ちの物がなくなる、っていう目安よ。' },
      { if: (s) => (s.H?.records?.dives ?? 0) === 0, text: '今回は初めてだから、稽古ってことにしてあげる。\n倒れても、持ち込んだデッキは蔵に戻しておくわ。安心して、行けるところまで行ってらっしゃい。' },
      { at: 'footer.ops .hold', text: '「潜る」は長押しで決まる。\n指を離さず、ゲージがいっぱいになるまで押し続けて。', do: (s) => s.where === 'dive' || s.where === 'battle' },
    ],
  },

  // ───────── 潜行：襖の列 ─────────
  {
    id: 'map',
    when: (s) => s.where === 'dive' && s.D?.phase === 'map',
    steps: [
      { at: 'header.top', text: 'ここはB1、地下1階。\n「体力」が0になったら倒れる。「宿銭」は潜っている間に稼ぐお金で、行商人で使えるし、帰れば宿の財布に入る。' },
      { at: '.map', text: 'これが襖（ふすま）の列。上の列から1段ずつ、どれか1つを開けて進むの。\n戦は敵、精は強い敵、宝は札、商は行商人、湯はひと休み、謎は開けてのお楽しみ。' },
      { at: '.map', text: '3列進むと、その階の「踊り場」に出る。\nそこで、さらに下りるか、宿に引き返すかを選ぶのよ。' },
      { at: 'section.presence', text: '「気配」。部屋に入るたびに溜まって、溜まるほど敵が強く、しつこくなる。\n寄り道や長い戦いでも増える。層が変われば0に戻るわ。' },
      { at: 'footer.ops', text: '下の「札」はいまのデッキ、「懐」は拾った物を入れる袋、「品」は戦いで使う道具。\n押すと中身が見られる。' },
      { at: doorToTry, text: (s) => (doorToTry(s)?.dataset.kind === '戦い' ? 'まずは「戦」の襖を開けて、論客と一戦交えてみましょう。' : '光っている襖のどれかを開けて、進んでみて。'), do: (s) => s.where === 'battle' || (s.D && s.D.phase !== 'map') || (s.D?.map?.visited?.length ?? 0) > 0 },
    ],
  },

  // ───────── 最初の戦い ─────────
  {
    id: 'battle',
    when: (s) => s.where === 'battle' && !!s.B && !s.B.result,
    steps: [
      { at: 'section.foes', text: '相手の論客よ。\n下の数字が「主張」。これを0にすれば論破、つまりあなたの勝ち。' },
      { at: 'section.foes .int', text: '小さい字は、相手が次にすることの予告。\n「攻め 3」なら、あなたがターンを終えたときに体力を3削ってくる。予告を見て、受けるか先に倒すか決めるの。' },
      { at: 'section.hand', text: '下があなたの手札。\n札の左上の数字が「Tier（格付け）」、右上の色つきの字が「カテゴリ」。トランプの数字とマークみたいなものね。' },
      { at: 'section.hand', text: '札を何枚か組にして出すと、組の強さで論破値が決まる。\n同じTier2枚で「対」、3枚で「三揃」。5枚で同じカテゴリなら「同類」、Tierが順に続けば「階段」。ほとんどポーカーよ。' },
      { at: '.guestline', if: (s) => !!s.q('.guestline')?.textContent, text: 'この一行は、一緒に潜っている宿泊客の持ち味。\n宿泊客ごとに、強くなる札や使える技が違うの。長押しで詳しく見られる。' },
      { at: 'section.banzuke', text: '上の段は「番付」。どのカテゴリが、どのTierの段にいるか。\n上の段（God・0・1…）にいるカテゴリの札で組を作ると、倍率が上がる。最初はみんなTier3。札の効果で上げ下げできるわ。' },
      {
        at: (s) => { const p = pairIn(s); return p ? cardEls(s, p) : s.q('section.hand'); },
        text: (s) => (pairIn(s) ? '照らした札はTierが同じ。\nこれを押して選んでみて。もう一度押せば外れる。' : '札を押して選んでみて。1枚からでも出せる。\nもう一度押せば外れる。'),
        begin: (s) => ({ plays: s.B?.playsLeft ?? 0, turn: s.B?.turn ?? 0, need: pairIn(s) ? 2 : 1 }),
        do: (s, m) => !s.B || !!s.B.result || s.qa('section.hand .card.sel').length >= m.need || s.B.turn !== m.turn || s.B.playsLeft < m.plays,
      },
      { at: 'section.calc', if: (s) => s.qa('section.hand .card.sel').length > 0, text: '選ぶだけで、ここに出したときの見込みが出る。\n「強さ（S）×倍率（M）＝論破値」。論破値が相手の主張より大きければ、一発で論破よ。' },
      {
        at: 'footer.ops .btn.main', text: '「出す」で、狙っている相手にぶつける。\n相手が何人もいるときは、相手を押して狙いを変えられる。',
        begin: (s) => ({ plays: s.B?.playsLeft ?? 0, turn: s.B?.turn ?? 0 }),
        do: (s, m) => !s.B || !!s.B.result || s.B.turn !== m.turn || s.B.playsLeft < m.plays,
      },
      { at: 'section.hand', text: '組に入らなかった札は「受け」になって、このターンに受ける攻撃を減らしてくれる。\n出した札は手札から減って、次のターンの始めに8枚まで引き直すわ。' },
      { at: (s) => opsBtn(s, 1), text: '「出す」は1ターンに2回まで。\n「流す」は1回だけ、要らない札を捨てて同じ枚数を引き直せる。欲しい組が見えないときに使って。' },
      { at: (s) => opsBtn(s, 3), text: 'やれることをやったら「終了」。相手が予告どおりに動いて、次のターン。\n札を長押しすると効果、相手を長押しすると詳しい情報が見られる。さあ、論破してらっしゃい。' },
    ],
  },

  // ───────── 報酬 ─────────
  {
    id: 'reward',
    when: (s) => s.where === 'dive' && s.D?.phase === 'reward',
    steps: [
      { at: '.panel.reward', text: 'お見事。勝ったら報酬よ。\n欲しい物を押すと、どこに入れるか選べる。いらなければ「見送る」。' },
      { text: '「デッキへ」入れれば、次の戦いからすぐ使える。\n「懐へ」入れれば、売り物として持ち歩くだけ。どっちも、生きて帰れば宿の蔵に入るわ。' },
      { at: 'footer.ops', text: 'ただし、懐が重いほど、帰り道の番人が強くなる。\n欲張りすぎは禁物よ。' },
      { at: '.panel.reward .btn.main', text: '選び終わったら「進む」。' },
    ],
  },

  // ───────── 踊り場：行くか戻るか ─────────
  {
    id: 'landing',
    when: (s) => s.where === 'dive' && s.D?.phase === 'landing',
    steps: [
      { at: '.lstat', text: 'ここが踊り場。この遊びでいちばん大事な場所よ。\n体力と、懐の総額を見て。' },
      { at: '.lnext', text: '「下りる」と次の階。深いほど相手は手強くなるけど、拾える物も良くなる。\n層の最後の階には「層主」が待ってるわ。' },
      { at: '.lwarden', text: '「引き返す」なら、帰り道の番人と一戦。勝てば脱出。拾った物はぜんぶあなたの物になる。\n懐が重いほど番人は強い。' },
      { at: '.lchoice', text: (s) => `どっちも長押しで決まる。\n体力が心もとないなら、帰るのも立派な判断よ。${s.D?.practice ? '\n今回は稽古だから、試しに下りてみるのもいいわね。' : ''}` },
    ],
  },

  // ───────── 結果 ─────────
  {
    id: 'result',
    when: (s) => s.where === 'result',
    steps: [
      { text: (s) => (s.root?.classList.contains('mono')
        ? (s.H?.lastResult?.practice ? 'おかえり…って言いたいところだけど、倒れちゃったわね。\n本当は、持ち込んだ物はぜんぶ失う。今回は稽古だから、デッキは蔵に戻しておいたわ。' : '倒れたら、持ち込んだ物はなくなる。お守り袋の中身だけは残るわ。\n保険を掛けていた物は、運が良ければそのうち戻ってくる。')
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
      { at: '.facs', text: '宿銭が貯まったら、施設を改装しましょう。\n押すと中身が見られる。蔵は入る数、物置は懐とお守り袋、客間は常連客の席、神棚は保険、帳場は札の買い物、仕込み場は札の強化。' },
      { at: '.irow .btn:first-child', text: '「蔵・編成」で、持ち帰った札をデッキに入れ替えられる。\nデッキの枚数には上限と下限がある。弱い札は売ってしまうのも手よ。' },
      { text: 'お守り袋に入れた物は、倒れても戻ってくる。\n保険を掛けた物は、倒れても運が良ければ戻ってくる。大事な札は守ってあげて。' },
      { at: 'footer.ops .btn:first-child', text: '「素泊まり」は、借り物のデッキで潜るおまけ。\n失う物が無いから気楽にどうぞ。脱出すると回数が戻るわ。' },
      { text: 'あとは潜って、稼いで、改装して、もっと深く。\nいちばん底の主を倒して帰れば、もっと厳しい「深度」が開く。いってらっしゃい。' },
    ],
  },

  // ───────── 初めて出会ったとき ─────────
  { id: 'shop', when: (s) => s.where === 'dive' && s.D?.phase === 'shop', steps: [
    { at: '.panel.shop', text: '行商人。宿銭で札や品が買える。\n「札の除去」で弱い札をデッキから抜くのも、地味だけど強いわ。' },
  ] },
  { id: 'bath', when: (s) => s.where === 'dive' && s.D?.phase === 'bath', steps: [
    { at: '.panel.bath', text: 'お湯でひと休み。体力を戻すか、札を仕込むか、気配を下げるか、どれか1つ。\nここではデッキと懐の中身も入れ替えられるわ。' },
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
    { at: 'section.foes', text: '精鋭。並の相手よりずっと手強いけど、報酬も良い。\n予告をよく見て、無理なら受けで耐えて。' },
  ] },
  { id: 'boss', need: ['battle'], when: (s) => s.where === 'battle' && battleKind(s) === '層主' && !s.B?.result, steps: [
    { at: 'section.foes', text: 'この層の主よ。主には「縛り」っていう特別な決まりがある。\n相手を長押しして、縛りを確かめて。' },
    { text: '主を倒せば昇降機が動いて、番人と戦わずに帰れる。\nもちろん、そのまま次の層に下りてもいい。' },
  ] },
  { id: 'warden', need: ['battle'], when: (s) => s.where === 'battle' && battleKind(s) === '番人' && !s.B?.result, steps: [
    { at: 'section.foes', text: '帰り道の番人。こいつを退ければ脱出よ。\n負けたら…分かってるわね。' },
  ] },
  { id: 'seats', need: ['battle'], when: (s) => s.where === 'battle' && (s.B?.seats?.length ?? 0) > 0 && !s.B?.result, steps: [
    { at: 'section.seats', text: '常連客は席に座って、戦いを手伝ってくれる。\n長押しで、何をしてくれるか見られるわ。' },
  ] },
  { id: 'items', need: ['battle'], when: (s) => s.where === 'battle' && (s.B?.items?.length ?? 0) > 0 && !s.B?.result, steps: [
    { at: (s) => opsBtn(s, 4), text: 'お品書き（品）を持ってるわね。\n「品」から使える。たいてい1回きりの道具よ。' },
  ] },
  { id: 'guestAct', need: ['battle'], when: (s) => s.where === 'battle' && !!s.q('footer.ops > .btn:nth-child(5)') && !s.B?.result, steps: [
    { at: (s) => s.q('footer.ops > .btn:nth-child(5)'), text: 'これは、いまの宿泊客だけができること。\n長押しで説明が出るわ。使いどころを考えて。' },
  ] },
  { id: 'stash', need: ['welcome'], when: (s) => s.where === 'stash', steps: [
    { at: 'h3', text: '蔵よ。上の段がいまのデッキ。枚数の決まりは見出しのかっこの中。' },
    { text: '下の段の札を押せばデッキに入る。デッキの札を押せば外れる。\n下の「売る」を押してから選ぶと、売って宿銭にできるわ。' },
  ] },
];

/** 遊び方（設定と宿から開く。案内を見逃しても、ここを読めば分かる） */
export function rules(base) {
  const P = base.balance.hands.play;
  const T = base.balance.tiers;
  const sign = (v) => (typeof v === 'number' ? (v > 0 ? `＋${v}` : v === 0 ? '±0' : `−${-v}`) : 'ばらつく');
  const bz = T.ring.map((t) => `${t}${t === 'God' ? '' : ''} ${sign(T.tiers[t].banzuke)}`).join('、');
  return [
  ['ター深とは', [
    '宿の床下に埋まった議論スレ「ター深」に潜り、札で論客を論破しながら下りていくゲーム。',
    '拾った札やお宝は、生きて帰れば（脱出すれば）自分の物。倒れると、持ち込んだデッキと拾った物を失う。',
    '「もう少し下りるか、ここで引き返すか」を決めるのがいちばんの勘所。',
  ]],
  ['一回の潜行', [
    '宿で「潜る」→ 宿泊客と持ち物を決めて「潜る」を長押し。',
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
    `手札${P.handSize}枚から${P.minCards}〜${P.maxPlayCards}枚を選んで「出す」（1ターン${P.playsPerTurn}回）。「流す」（${P.discardsPerTurn}回）で要らない札を引き直す。「終了」で敵が動く。`,
    '論破値＝強さ（S）×倍率（M）。札を選ぶと計算窓に見込みが出る。',
    '組に入らなかった札は「受け」になり、そのターンに受ける攻撃を減らす。',
    `出した札は次のターンの始めに${P.handSize}枚まで補充。`,
  ]],
  ['組（強い順）', [
    '神組：Godが5枚。五揃同類：同じTier5枚で同じカテゴリ。満員同類：満員で同じカテゴリ。',
    '五揃：同じTier5枚。同類階段：階段で同じカテゴリ。四揃：同じTier4枚。',
    '満員：同じTier3枚＋2枚。同類：5枚が同じカテゴリ。階段：Tierが5つ続く（God→0→1→2→3→4→5→8→Godの輪）。',
    '三揃：同じTier3枚。二対：対が2組。対：同じTier2枚。単騎：それ以外（一番強い1枚）。',
  ]],
  ['番付', [
    `カテゴリごとに、どのTierの段にいるか。最初はみんなTier${T.banzukeStart}。`,
    `採点された札1枚ごとに、そのカテゴリの段の倍率が足される（${bz}）。`,
    '札の効果で上げ下げできる。好きなカテゴリを上に押し上げるのが強さの近道。',
  ]],
  ['持ち物', [
    `デッキ：戦いで使う札（${P.deckMin}〜${P.deckMax}枚）。懐：拾った物を持ち帰る袋。重いほど帰路の番人が強い。`,
    'お守り袋：倒れても残る。お品書き：戦いで使う道具。常連客：席に座って手伝う（持ち帰れる）。',
    '保険：神棚で掛け金を払うと、失った物が運が良ければ戻る。',
  ]],
  ['宿', [
    '宿銭で施設を改装。帳場（買い物）・蔵（入る数・複製）・物置（懐とお守り袋）・客間（席）・神棚（保険）・仕込み場（札の強化）。',
    '素泊まり：借り物のデッキで潜る。失う物なし。',
    '掲示板：日替わりの潜行、共有コード、縛り潜行。',
    '最深部の主を倒して脱出すると、次の深度（より厳しい条件）が開く。',
  ]],
  ['操作', [
    '長押し（PCはマウスを乗せる）で、たいていの物の説明が出る。',
    '「潜る」「下りる」「引き返す」など取り返しのつかない決定は長押し。',
    '演出中に画面をタップすると早送り。PCでは数字キーで札を選び、Enterで出す。',
  ]],
];
}

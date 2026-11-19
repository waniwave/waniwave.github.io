// 語彙：演出（show）（仕様書 第9章）
// 計算には一切触れない。出しの手順列に { show, arg } を積むだけで、再生は画面（段階3・6）が行う。
// どれも設定の「演出の強さ」「画面揺れ」「点滅の軽減」に従う。

const TEXT_ARG = 'string';

export const SHOWS = [
  { name: '揺れ', text: '画面が揺れる（強さ：小／中／大）', args: ['小', '中', '大'] },
  { name: '白飛び', text: '画面が白く飛ぶ（点滅の軽減では背景色の変化）', args: null },
  { name: '暗転', text: '画面が暗くなる', args: null },
  { name: '二重像', text: '画面が二重にぶれる', args: null },
  { name: '文字二回', text: '全ての文字が2回ずつ出る', args: null },
  { name: '筆文字', text: '画面いっぱいの筆文字', args: TEXT_ARG },
  { name: 'カットイン', text: '横長の帯で文字が差し込まれる', args: TEXT_ARG },
  { name: '吹き出し', text: '雲の吹き出しに文字', args: TEXT_ARG },
  { name: 'スタンプ', text: '判子のように文字を押す', args: TEXT_ARG },
  { name: '文字化け', text: '文字が化ける', args: null },
  { name: '伏せ字', text: '文字が伏せ字になる', args: null },
  { name: '取り消し線', text: '画面じゅうに取り消し線', args: null },
  { name: '背景色', text: '背景の色が変わる（色）', args: TEXT_ARG },
  { name: '水没', text: '画面が水に沈む', args: null },
  { name: '紙吹雪', text: '紙吹雪が舞う', args: null },
  { name: '画面反転', text: '画面が上下に反転する', args: null },
  { name: '横切る', text: '何かが画面を横切る（串／象／札の列）', args: ['串', '象', '札の列'] },
  { name: '増殖', text: '札が増えて画面からあふれる', args: null },
  { name: '行進', text: '札が一列になって行進する', args: null },
  { name: 'うなずき', text: '画面の札が全員うなずく', args: null },
  { name: '角以外を暗く', text: '画面の角以外が暗くなる', args: null },
  { name: '斬る', text: '敵が真っ二つになる', args: null },
  { name: '読み込み中', text: '読み込み中のくるくるが回り続ける', args: null },
  { name: '早口字幕', text: '字幕だけが早口で流れる', args: TEXT_ARG },
  { name: 'ガチャ', text: '虹色のガチャ演出', args: null },
  { name: '音', text: '効果音を鳴らす（名前）', args: TEXT_ARG },
  { name: 'BGMを止める', text: 'BGMが止まる', args: null },
  { name: '心音', text: '心音が鳴る', args: null },
  { name: '振動', text: '端末が振動する（対応していれば）', args: null },
];

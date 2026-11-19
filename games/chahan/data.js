/* プロトコルチャーハン 本編データ: 仲間・地区・遭遇・イベント */
(function (root) {
'use strict';
const CH = typeof module !== 'undefined' && module.exports ? require('./engine.js') : root.CH;
const { mkUnit, mkInst } = CH;

const CARRY = 12;      // 持ち歩けるメモリの本数(挿している分は別)
const PARTY_MAX = 4;
const STAT = { pow: '腕力', tec: '技術', obs: '観察', talk: '話術' };

/* ---------- 仲間 ---------- */
const CHARS = {
  hero: { name: 'チャンカー', role: 'ブレードヘッドチャンカー', hp: 110, atk: 14, def: 5, tec: 20, spd: 10, fxk: 'slash', wname: 'ヒートブレード', grow: { hp: 5, atk: 0.6, def: 0.3, tec: 0.8, spd: 0.15 }, mems: ['junk'], nports: 2, ex: { pow: 3, tec: 7, obs: 4, talk: 4 } },
  kill: { name: 'キルチョイサー', role: '幸の薄い殺し屋', hp: 96, atk: 20, def: 3, tec: 10, spd: 14, obs: 3, innate: ['observe'], fxk: 'shot', wname: '消音ライフル', grow: { hp: 4, atk: 0.9, def: 0.2, tec: 0.4, spd: 0.25 }, mems: ['snipe', 'cloak'], ex: { pow: 4, tec: 4, obs: 8, talk: 3 } },
  aur: { name: 'オロール', role: '誇り高き騎士', hp: 160, atk: 18, def: 12, tec: 2, spd: 6, fxk: 'slash', wname: '騎士槍', grow: { hp: 8, atk: 0.7, def: 0.6, tec: 0.1, spd: 0.1 }, mems: ['knight'], nports: 2, ex: { pow: 8, tec: 1, obs: 2, talk: 6 } },
  som: { name: 'サイレント・ソムリエ', role: '元・企業の刺客', hp: 124, atk: 22, def: 8, tec: 12, spd: 12, fxk: 'shot', wname: '二丁拳銃', grow: { hp: 5, atk: 0.9, def: 0.4, tec: 0.5, spd: 0.2 }, mems: [], nports: 3, ex: { pow: 5, tec: 6, obs: 7, talk: 2 } },
  hong: { name: '紅姐(ホンジェ)', role: '紅楼の女主人', hp: 120, atk: 14, def: 7, tec: 16, spd: 9, fxk: 'blunt', wname: '鉄煙管', grow: { hp: 6, atk: 0.5, def: 0.4, tec: 0.7, spd: 0.15 }, mems: ['medic'], nports: 2, ex: { pow: 4, tec: 6, obs: 5, talk: 8 } },
  pedal: { name: 'ペダル', role: '口の悪い運び屋', hp: 92, atk: 17, def: 4, tec: 8, spd: 18, fxk: 'blunt', wname: 'ホイールチェーン', grow: { hp: 4, atk: 0.7, def: 0.25, tec: 0.3, spd: 0.35 }, mems: ['dash'], nports: 2, ex: { pow: 5, tec: 5, obs: 6, talk: 5 } },
  wan: { name: 'ワン', role: '元・朗々幇の用心棒', hp: 175, atk: 21, def: 9, tec: 3, spd: 5, fxk: 'slash', wname: '中華包丁', grow: { hp: 9, atk: 0.8, def: 0.5, tec: 0.1, spd: 0.1 }, mems: ['cleaver'], nports: 2, ex: { pow: 9, tec: 2, obs: 3, talk: 3 } },
  zero: { name: 'ゼロカロリー', role: '空腹同盟のまとめ役', hp: 98, atk: 13, def: 5, tec: 19, spd: 12, fxk: 'shot', wname: 'ホログラム投射器', grow: { hp: 4, atk: 0.4, def: 0.25, tec: 0.9, spd: 0.25 }, mems: ['leech', 'smoke'], ex: { pow: 2, tec: 8, obs: 6, talk: 7 } },
  gantetsu: { name: 'ガンテツ', role: '臨海工場群の元工場長', hp: 190, atk: 22, def: 12, tec: 9, spd: 5, fxk: 'blunt', wname: '鍛造ハンマー', grow: { hp: 9, atk: 0.75, def: 0.55, tec: 0.25, spd: 0.08 }, mems: ['weld'], nports: 2, ex: { pow: 9, tec: 6, obs: 3, talk: 3 } },
  chef: { name: '料理長・朗', role: '朗々飯店の料理長(人格データ)', hp: 96, atk: 11, def: 4, tec: 24, spd: 9, fxk: 'blunt', wname: '幻の鉄鍋', grow: { hp: 4, atk: 0.3, def: 0.2, tec: 1.0, spd: 0.2 }, mems: ['wokfire'], nports: 2, ex: { pow: 2, tec: 9, obs: 8, talk: 6 } },
  lin: { name: 'リン', role: '元ブローカー', hp: 108, atk: 16, def: 6, tec: 15, spd: 13, fxk: 'shot', wname: '仕込みデリンジャー', grow: { hp: 4, atk: 0.6, def: 0.3, tec: 0.6, spd: 0.3 }, mems: ['charm', 'coupon'], ex: { pow: 3, tec: 6, obs: 7, talk: 9 } },
  tsukimi: { name: 'ツキミ', role: '元・品質保証部長', hp: 122, atk: 17, def: 10, tec: 16, spd: 10, obs: 3, innate: ['observe'], fxk: 'blunt', wname: '拡声器', grow: { hp: 5, atk: 0.55, def: 0.45, tec: 0.6, spd: 0.2 }, mems: ['medic', 'magnet'], ex: { pow: 4, tec: 7, obs: 9, talk: 6 } },
  glassjaw: { name: 'グラスジョー', role: '地下闘技場の元王者', hp: 168, atk: 27, def: 7, tec: 4, spd: 13, fxk: 'blunt', wname: 'ガラスの拳', grow: { hp: 6, atk: 1.0, def: 0.3, tec: 0.1, spd: 0.3 }, mems: ['knuckle', 'mirror'], ex: { pow: 9, tec: 2, obs: 4, talk: 4 } },
  hijiki: { name: 'キャプテン・ヒジキ', role: '宇宙まで行ける海賊', hp: 152, atk: 22, def: 9, tec: 10, spd: 10, fxk: 'slash', wname: '舶刀', grow: { hp: 7, atk: 0.8, def: 0.4, tec: 0.35, spd: 0.2 }, mems: ['anthem', 'smoke'], ex: { pow: 7, tec: 4, obs: 5, talk: 7 } },
  whiteglove: { name: 'ホワイトグローブ', role: '雇い主のいない執事', hp: 140, atk: 21, def: 12, tec: 12, spd: 14, fxk: 'blunt', wname: '白手袋', grow: { hp: 6, atk: 0.7, def: 0.55, tec: 0.4, spd: 0.3 }, mems: ['decoy', 'baton'], ex: { pow: 6, tec: 6, obs: 7, talk: 5 } },
  yumori: { name: '湯守', role: '源泉を守っていた土木ロボット', hp: 235, atk: 20, def: 18, tec: 3, spd: 3, fxk: 'blunt', wname: '岩の拳', grow: { hp: 11, atk: 0.6, def: 0.8, tec: 0.05, spd: 0.05 }, mems: ['steam'], nports: 3, ex: { pow: 10, tec: 1, obs: 2, talk: 1 } },
  mutsuko: { name: 'ムツコ', role: '元宇宙飛行士', hp: 96, atk: 12, def: 6, tec: 18, spd: 8, obs: 2, innate: ['observe'], fxk: 'shot', wname: '信号拳銃', grow: { hp: 4, atk: 0.35, def: 0.25, tec: 0.85, spd: 0.15 }, mems: ['lowg', 'steep'], ex: { pow: 2, tec: 7, obs: 9, talk: 6 } },
  tenin: { name: 'テンイン', role: 'モールから出たことのない店員', hp: 102, atk: 15, def: 6, tec: 14, spd: 15, fxk: 'blunt', wname: 'バーコードリーダー', grow: { hp: 4, atk: 0.55, def: 0.25, tec: 0.55, spd: 0.35 }, mems: ['coupon', 'hashi'], ex: { pow: 3, tec: 6, obs: 6, talk: 8 } },
  satou: { name: 'サトウ', role: '舌を取り戻したい元会社員', hp: 115, atk: 15, def: 8, tec: 15, spd: 9, fxk: 'blunt', wname: '社員証ストラップ', grow: { hp: 5, atk: 0.45, def: 0.4, tec: 0.75, spd: 0.2 }, mems: ['netrun', 'frost'], ex: { pow: 4, tec: 8, obs: 5, talk: 5 } },
  nanashi: { name: 'ナナシ', role: 'ついてきた野良ドローン', hp: 86, atk: 14, def: 10, tec: 16, spd: 17, fxk: 'shot', wname: '小型テーザー', grow: { hp: 3, atk: 0.5, def: 0.4, tec: 0.6, spd: 0.4 }, mems: ['shock', 'decoy'], ex: { pow: 1, tec: 7, obs: 7, talk: 1 } },
  shumai: { name: 'シューマイ', role: '旧中華街の野良犬', dog: true, hp: 178, atk: 26, def: 10, tec: 5, spd: 18, fxk: 'slash', wname: '牙', grow: { hp: 8, atk: 1.05, def: 0.5, tec: 0.1, spd: 0.4 }, mems: [], nports: 0,
    lvsk: [['howl', 1], ['fetch', 1], ['sniff', 6], ['guard', 12], ['pack', 22], ['lastbone', 32]], ex: { pow: 7, tec: 1, obs: 9, talk: 0 } },
  xiao: { name: '小籠(シャオロン)', role: '朗々飯店のホール係', hp: 104, atk: 12, def: 8, tec: 13, spd: 11, fxk: 'blunt', wname: '鋼の蓮華', grow: { hp: 5, atk: 0.4, def: 0.4, tec: 0.5, spd: 0.2 }, mems: ['serve'], nports: 3, ex: { pow: 3, tec: 5, obs: 6, talk: 7 } },
};
const mkChar = (id, lv) => mkUnit(Object.assign({ id, side: 'ally', lv: lv || 1 }, CHARS[id]));
/* 古いセーブデータにレベルと習熟を補う */
function migrate(S) { S.keys = S.keys || { ride: [], pass: [], map: [] }; S.mallFloor = S.mallFloor || 1; S.mallMax = S.mallMax || 0; S.tips = S.tips || {}; S.recipes = S.recipes || {}; S.rom = S.rom || {}; S.left = S.left || {}; S.relWins = S.relWins || {}; if (S.shurabaAt === undefined) S.shurabaAt = null; S.roster.forEach(u => { if (!u.lv) { u.lv = 1; u.xp = 0; } u.prof = u.prof || {}; u.fixed = u.fixed || []; u.grow = u.grow || CHARS[u.id].grow; u.wname = u.wname || CHARS[u.id].wname; CH.recompute(u); u.hp = u.maxhp; }); return S; }

/* ---------- 地区 ---------- */
const FREE = S => !!S.flags.pro;
const LOCS = {
  pier: { van: 'ジャンク山のPCバン', lv: 1, name: 'コンテナ埠頭', sub: 'ジャンクの山。チャンカーのねぐら', open: () => true },
  chinatown: { lv: 2, name: '旧中華街跡', sub: '朗々飯店の跡地。朗々幇の縄張り', open: FREE },
  noge: { van: 'ネットカフェ「夜更かし」', lv: 5, name: 'ノゲ横丁', sub: '飲み屋と情報屋の路地', open: FREE },
  kannai: { lv: 9, name: 'カンナイ・アーコロジー', sub: 'マンカン・ホールディングスの本拠', open: FREE },
  minato: { van: '廃園の管理棟PCバン', lv: 8, name: 'ミナトミライ廃園', sub: '止まった観覧車と地下闘技場', open: FREE },
  honmoku: { van: '闇市のレンタル端末', lv: 13, name: 'ホンモク・ドック', sub: '密輸港と闇市', open: FREE },
  yamate: { lv: 14, name: 'ヤマテ高台', sub: '富裕層の旧市街', open: FREE },
  gate7: { van: '到着ゲートのネットブース', lv: 1, scene: 'gw', name: '第七到着ゲート裏', sub: 'スペースポートの裏手。路地の突き当たりに暖簾が一枚', region: 'tokyo', open: FREE },
  ntport: { lv: 14, scene: 'tokyo', name: 'スペースポート出発ロビー', sub: '月行きの便が、一日に三本だけ出る', region: 'tokyo', open: FREE },
  kw: { van: '工員寮のPCバン', lv: 12, scene: 'factory', name: '臨海工場群', sub: '煙突と溶接の火花。昼も夜も鉄を叩く音がする', region: 'kawasaki', open: FREE },
  hk: { van: '湯治場の娯楽室', lv: 14, scene: 'onsen', name: '湯けむり横丁', sub: '山あいの湯治場。逃亡者と湯治客が同じ湯に浸かる', region: 'hakone', open: FREE },
  ks: { van: '駅前のネットカフェ', lv: 12, scene: 'suburb', name: '駅前ロータリー', sub: '場違いにのどかな郊外。家庭菜園と天文台がある', region: 'kashiwa', open: FREE },
  kg: { van: 'モールのネットラウンジ', lv: 8, scene: 'mall', name: 'メガモール', sub: '終わりのない巨大ショッピングモール。下へ行くほど何かがおかしい', region: 'koshigaya', open: FREE },
  mdock: { van: '搬入口の作業端末', lv: 20, scene: 'moon', name: '着陸ドック', sub: '静かの海の縁。月面本社の搬入口', region: 'moon', open: S => !!S.flags.moon },
  mkitchen: { lv: 23, scene: 'mkitchen', name: '第八厨房', sub: '百八の中華鍋が、地球に向けて並んでいる', region: 'moon', open: S => !!S.flags.m13 },
  moffice: { lv: 26, scene: 'office', name: '会長室', sub: '地球が窓いっぱいに見える部屋', region: 'moon', open: S => !!S.flags.m14 },
};
const REGIONS = [
  { id: 'tokyo', n: 'ネオ・トーキョー', scene: 'tokyo', sub: 'ネオヨコハマの隣。四十種類の合成豚骨が湯気を立てる街' },
  { id: 'kawasaki', n: 'カワサキ・ディヴィジョン', scene: 'factory', sub: '鉄を叩く街。この国の機械の半分はここで生まれる' },
  { id: 'hakone', n: 'ハコネ・ディヴィジョン', scene: 'onsen', sub: '山と湯けむり。追われる者が最後に辿り着く場所' },
  { id: 'kashiwa', n: 'カシワタウン', scene: 'suburb', sub: '郊外。なぜかここだけ、時間がゆっくり流れている' },
  { id: 'koshigaya', n: 'ネオコシガヤ', scene: 'mall', sub: '巨大すぎるショッピングモールが、街そのものになった場所' },
  { id: 'moon', n: '月面基地', scene: 'moon', sub: '静かの海。三十八万キロ先の厨房', hidden: S => !S.flags.moon },
];

/* ---------- 遭遇 ---------- */
const pickMem = list => { let r = Math.random(), acc = 0; for (const [m, w] of list) { acc += w; if (r < acc) return m; } return list[0][0]; };
const thug = (id, name, hp, atk) => mkUnit({ id, name, kind: 'thug', fxk: 'blunt', side: 'enemy', xp: Math.round((hp || 70) / 6), hp: hp || 70, atk: atk || 16, def: 4, spd: 9, fw: 20, mems: [pickMem([['adrenal', 0.6], ['knuckle', 0.25], ['smoke', 0.15]])], pdur: 30 });
const drone = (id, name, hp, atk) => mkUnit({ id, name, kind: 'drone', side: 'enemy', xp: Math.round((hp || 60) / 6), hp: hp || 60, atk: atk || 13, def: 6, spd: 11, fw: 10, mems: [pickMem([['shock', 0.75], ['leech', 0.25]])], pdur: 25 });
const agent = (id, name, hp, atk) => mkUnit({ id, name, kind: 'agent', fxk: 'blunt', side: 'enemy', xp: 16, hp: hp || 92, atk: atk || 19, def: 9, spd: 8, fw: 30, mems: [pickMem([['armor', 0.6], ['baton', 0.25], ['mirror', 0.15]])], pdur: 40 });
const runner = (id, name) => mkUnit({ id, name, kind: 'runner', fxk: 'shot', side: 'enemy', xp: 12, hp: 62, atk: 13, def: 4, spd: 13, fw: 12, mems: [pickMem([['netrun', 0.75], ['leech', 0.15], ['smoke', 0.1]])], pdur: 25 });
const sentinel = (id, name) => mkUnit({ id, name, kind: 'turret', fxk: 'shot', side: 'enemy', xp: 30, hp: 160, atk: 22, def: 14, spd: 4, fw: 20, mems: ['shock'], pdur: 50 });
const brawler = (id, name) => mkUnit({ id, name, kind: 'thug', fxk: 'blunt', side: 'enemy', xp: 40, hp: 260, atk: 26, def: 8, spd: 10, fw: 20, mems: ['knuckle'], pdur: 60 });
const kannaiObjs = () => [
  { id: 'sprinkler', name: '消火スプリンクラー', act: '作動させる', desc: '敵も味方も全員「濡れ」、熱-30', tgt: 'none' },
  { id: 'panel', name: '配電盤', act: '叩き壊す', desc: '敵全体に電撃。濡れた敵には2倍+スタン', tgt: 'none' },
  { id: 'car', name: '防弾ガラスの受付台', act: '盾にする', desc: '自分の被ダメージを3ターン半減', tgt: 'none' },
];
const minatoObjs = () => [
  { id: 'crane', name: '観覧車のゴンドラ', act: '落とす', desc: '単体に打撃の大ダメージ', tgt: 'enemy' },
  { id: 'hydrant', name: '噴水の配管', act: 'ぶち破る', desc: '敵全体を「濡れ」にする', tgt: 'none' },
  { id: 'neon', name: '観覧車の電飾', act: '引きちぎる', desc: '単体に電撃の大ダメージ。濡れた敵には2倍+スタン', tgt: 'enemy' },
];
const arenaObjs = () => [
  { id: 'keg', name: '観客席のビール樽', act: '投げ込む', desc: '敵全体に打撃のダメージ(腕力依存)', tgt: 'none' },
  { id: 'lantern', name: '照明リグ', act: '落とす', desc: '敵全体に炎のダメージ+熱+20', tgt: 'none' },
];
const nogeObjs = () => [
  { id: 'lantern', name: '提灯の列', act: '落とす', desc: '敵全体に炎のダメージ+熱+20。濡れた敵には半減', tgt: 'none' },
  { id: 'neon', name: 'ネオン看板', act: '叩き割る', desc: '単体に電撃の大ダメージ。濡れた敵には2倍+スタン', tgt: 'enemy' },
  { id: 'keg', name: 'ビール樽', act: '転がす', desc: '敵全体に打撃のダメージ(腕力依存)', tgt: 'none' },
];
const alleyObjs = () => [
  { id: 'panel', name: '配電盤', act: '叩き壊す', desc: '敵全体に電撃。濡れた敵には2倍+スタン', tgt: 'none' },
  { id: 'gas', name: 'ガスボンベ', act: '投げつける', desc: '単体に炎の大ダメージ(腕力依存)+熱。濡れた敵には半減', tgt: 'enemy' },
  { id: 'sprinkler', name: 'スプリンクラー弁', act: '開ける', desc: '敵も味方も全員「濡れ」、熱-30', tgt: 'none' },
];
const pierObjs = () => [
  { id: 'crane', name: '吊り荷のコンテナ', act: '落とす', desc: '単体に打撃の大ダメージ', tgt: 'enemy' },
  { id: 'hydrant', name: '消火栓', act: 'ぶち破る', desc: '敵全体を「濡れ」にする', tgt: 'none' },
  { id: 'car', name: '廃車', act: '盾にする', desc: '自分の被ダメージを3ターン半減', tgt: 'none' },
];
const ENC = {
  tut: { scene: 'pier', name: 'コンテナ埠頭 ジャンク山', intro: '同業のチンピラが、拾ったばかりのメモリに目をつけた。', reward: 20,
    enemies: () => [thug('e1', '同業のチンピラ', 60)], objs: pierObjs },
  ambush2: { scene: 'chinatown', name: '旧中華街跡 善隣門の下', intro: '朗々幇の下っ端が道を塞いだ。口八丁が効いて、数は減っている。', reward: 50,
    enemies: () => [thug('e1', '下っ端A', 52, 14), thug('e2', '下っ端B', 52, 14)], objs: alleyObjs },
  ambush3: { scene: 'chinatown', name: '旧中華街跡 善隣門の下', intro: '朗々幇の下っ端が三人、道を塞いだ。', reward: 70,
    enemies: () => [thug('e1', '下っ端A', 46, 13), thug('e2', '下っ端B', 46, 13), thug('e3', '下っ端C', 46, 13)], objs: alleyObjs },
  wan: { scene: 'kitchen', name: '朗々飯店 跡地の厨房', intro: '朗々幇の用心棒ワン。鉄鍋が鈍く光る。取り巻きもいる。', reward: 150,
    enemies: () => [...(CH.G.party.length >= 3 ? [thug('e1', 'チンピラA'), thug('e2', 'チンピラB')] : [thug('e1', 'チンピラA', 60)]),
      mkUnit({ id: 'e3', name: '用心棒ワン', kind: 'bouncer', fxk: 'slash', side: 'enemy', boss: true, xp: 70, hp: 210, atk: 22, def: 8, spd: 5, fw: 35, mems: ['wok'], pdur: 50,
        insts: { wok: { rar: 4, afx: [{ k: 'atk', v: 4 }, { k: 'hp', v: 25 }, { k: 'pow', v: 12 }, { k: 'cool', v: -15 }] } } })], objs: alleyObjs },
  som: { scene: 'pier', name: 'コンテナ埠頭 ねぐらの前', intro: '料理界の巨大企業が放った刺客「サイレント・ソムリエ」。警備ドローンを連れている。', reward: 200,
    onEnd: (S, G) => { if (G.special) { S.flags.somJoin = 1; join(S, 'som', G.units.find(u => u.id === 'boss').ports); } },
    enemies: () => [...(CH.G.party.length >= 3 ? [drone('d1', '警備ドローンα'), drone('d2', '警備ドローンβ')] : [drone('d1', '警備ドローンα')]),
      mkUnit({ id: 'boss', name: 'サイレント・ソムリエ', kind: 'hitman', fxk: 'shot', boss: true, side: 'enemy', xp: 130, hp: CH.G.party.length >= 3 ? 360 : 290, atk: 24, def: 10, spd: 12, fw: 40, mems: ['barrier', 'laser', 'eye'], pdur: 60,
        insts: { barrier: { rar: 4, afx: [{ k: 'def', v: 4 }, { k: 'hp', v: 25 }, { k: 'cool', v: -20 }, { k: 'spd', v: 1 }] }, laser: { rar: 4, afx: [{ k: 'atk', v: 4 }, { k: 'pow', v: 18 }, { k: 'tec', v: 4 }, { k: 'wild', v: 1 }] }, eye: { rar: 4, afx: [{ k: 'tec', v: 6 }, { k: 'seep', v: 50 }, { k: 'spd', v: 2 }, { k: 'def', v: 2 }] } } })], objs: pierObjs },
  raid: { scene: 'bar', name: 'ノゲ横丁 酒場「鳩の巣」', intro: '料理界の巨大企業マンカン・ホールディングスの回収班が、扉を蹴破って入ってきた。', reward: 120,
    enemies: () => CH.G.party.length >= 3 ? [agent('a1', '回収班エージェントA'), agent('a2', '回収班エージェントB'), runner('r1', '回収班ネットランナー')] : [agent('a1', '回収班エージェント'), runner('r1', '回収班ネットランナー')], objs: nogeObjs },
  redroom: { scene: 'noge', name: 'ノゲ横丁 紅楼の裏口', intro: '紅楼の工具を盗んだネットランナーと、雇われのチンピラ。', reward: 80,
    enemies: () => [runner('r1', '酔ったネットランナー'), thug('e1', '雇われチンピラ', 70, 17)], objs: nogeObjs },
  chase: { scene: 'noge', name: 'ノゲ横丁 線路沿いの路地', intro: 'ペダルを追ってきた回収班が、こちらにも銃を向けた。', reward: 90,
    enemies: () => CH.G.party.length >= 3 ? [agent('a1', '追っ手A'), agent('a2', '追っ手B'), runner('r1', '追っ手のネットランナー')] : [agent('a1', '追っ手A'), agent('a2', '追っ手B')], objs: nogeObjs },
  wanfight: { scene: 'noge', name: 'ノゲ横丁 立ち飲み屋の前', intro: '朗々幇の制裁部隊が、ワンを取り囲んでいる。', reward: 90,
    enemies: () => [thug('e1', '制裁役A', 80, 18), thug('e2', '制裁役B', 80, 18), thug('e3', '制裁役C', 80, 18)], objs: nogeObjs },
  tsukimi: { scene: 'noge', name: 'ノゲ横丁 大通り', intro: 'マンカン・ホールディングス品質保証部、ツキミ部長。製品回収にやって来た。', reward: 300,
    enemies: () => [...(CH.G.party.length >= 3 ? [agent('a1', '回収班エージェントA', 120, 26), agent('a2', '回収班エージェントB', 120, 26)] : [agent('a1', '回収班エージェント', 120, 26)]), ...(CH.G.party.length >= 4 ? [runner('r1', '回収班ネットランナー')] : []),
      mkUnit({ id: 'boss', name: 'ツキミ部長', kind: 'exec', fxk: 'blunt', boss: true, side: 'enemy', xp: 240, hp: CH.G.party.length >= 4 ? 1250 : CH.G.party.length >= 3 ? 700 : 560, atk: 35, def: 15, spd: 9, fw: 45, mems: ['armor', 'medic', 'qa'], pdur: 70,
        insts: { armor: { rar: 4, afx: [{ k: 'def', v: 4 }, { k: 'hp', v: 25 }, { k: 'cool', v: -15 }, { k: 'atk', v: 2 }] }, medic: { rar: 4, afx: [{ k: 'tec', v: 6 }, { k: 'hp', v: 25 }, { k: 'cool', v: -20 }, { k: 'seep', v: 35 }] }, qa: { rar: 4, afx: [{ k: 'tec', v: 6 }, { k: 'def', v: 4 }, { k: 'spd', v: 2 }, { k: 'pow', v: 12 }] } } })], objs: nogeObjs },
  vault: { scene: 'kannai', name: 'カンナイ・アーコロジー 地下金庫', intro: '金庫室の前で、警備セントリーが首をもたげた。', reward: 400,
    enemies: () => [agent('a1', '金庫番A', 130, 26), agent('a2', '金庫番B', 130, 26), sentinel('t1', '警備セントリー')], objs: kannaiObjs },
  minraid: { scene: 'minato', name: 'ミナトミライ廃園 観覧車の下', intro: 'マンカンの回収班が、集会を狙って突入してきた。', reward: 200,
    enemies: () => [agent('a1', '回収班エージェントA', 130, 26), agent('a2', '回収班エージェントB', 130, 26), runner('r1', '回収班ネットランナー'), ...(CH.G.party.length >= 3 ? [sentinel('t1', '移動式セントリー')] : [])], objs: minatoObjs },
  farmKannai: { farm: true, scene: 'kannai', name: 'カンナイ・アーコロジー 搬入口', intro: '搬入口の警備網。抜けるたびに、新しい警備が補充される。', reward: 110,
    enemies: () => { const ps = CH.G.party.length, out = [sentinel('t1', '搬入口セントリー')]; if (ps >= 2) out.push(agent('a1', '搬入口警備員', 120, 24)); if (ps >= 3) out.push(Math.random() < 0.5 ? runner('r1', '警備ネットランナー') : agent('a2', '搬入口警備員B', 120, 24)); return out; }, objs: kannaiObjs },
  arena1: { scene: 'minato', name: '地下闘技場 第三ランク', intro: '観客の怒号。リングに上がったのは、拳を改造した兄弟だった。', reward: 150,
    enemies: () => [brawler('e1', 'ナックル兄弟・兄'), brawler('e2', 'ナックル兄弟・弟')], objs: arenaObjs },
  arena2: { scene: 'minato', name: '地下闘技場 第二ランク', intro: '企業を首になった警備員たちが、セントリーごと出場してきた。', reward: 250,
    enemies: () => [agent('a1', '元警備員A', 140, 28), agent('a2', '元警備員B', 140, 28), sentinel('t1', '払い下げセントリー')], objs: arenaObjs },
  arena3: { scene: 'minato', name: '地下闘技場 王座戦', intro: '王者グラスジョー。ガラスの顎と、ガラスの大砲を持つ男。', reward: 500,
    enemies: () => [mkUnit({ id: 'boss', name: '王者グラスジョー', kind: 'champ', fxk: 'blunt', boss: true, side: 'enemy', xp: 320, hp: CH.G.party.length >= 4 ? 2100 : CH.G.party.length >= 3 ? 1700 : 1300, atk: 42, def: 17, spd: 13, fw: 30, mems: ['mirror', 'glass'], pdur: 80,
      insts: { mirror: { rar: 4, afx: [{ k: 'def', v: 4 }, { k: 'hp', v: 25 }, { k: 'spd', v: 2 }, { k: 'cool', v: -15 }] }, glass: { rar: 4, afx: [{ k: 'atk', v: 4 }, { k: 'pow', v: 18 }, { k: 'hp', v: 25 }, { k: 'cool', v: -20 }] } } })], objs: arenaObjs },
  ...['corp:kannai:カンナイ・アーコロジー 最上階', 'gang:chinatown:旧中華街跡 善隣門', 'union:minato:ミナトミライ廃園 観覧車の下', 'chef:kitchen:朗々飯店 跡地の厨房'].reduce((o, x) => { const [k, sc, nm] = x.split(':'); o['titan_' + k] = { scene: sc, name: nm, intro: 'マンカン警備部の試作機「タイタン」。三階建ての鉄の脚が、地面を割って立ち上がった。', reward: 600,
    enemies: () => [...(CH.G.party.length >= 3 ? [agent('a1', '随伴エージェントA', 140, 28), agent('a2', '随伴エージェントB', 140, 28)] : [agent('a1', '随伴エージェント', 140, 28)]), ...(CH.G.party.length >= 4 ? [sentinel('t1', '随伴セントリー')] : []),
      mkUnit({ id: 'boss', name: '試作機タイタン', kind: 'titan', fxk: 'blunt', boss: true, side: 'enemy', xp: 450, hp: CH.G.party.length >= 4 ? 1500 : CH.G.party.length >= 3 ? 1250 : 950, atk: 33, def: 16, spd: 6, fw: 15, mems: ['missile', 'glass', 'mirror'], pdur: 90,
        insts: { missile: { rar: 4, afx: [{ k: 'pow', v: 18 }, { k: 'tec', v: 6 }, { k: 'atk', v: 4 }, { k: 'cool', v: -15 }] }, glass: { rar: 4, afx: [{ k: 'atk', v: 4 }, { k: 'pow', v: 18 }, { k: 'def', v: 4 }, { k: 'spd', v: 2 }] }, mirror: { rar: 4, afx: [{ k: 'def', v: 4 }, { k: 'hp', v: 25 }, { k: 'tec', v: 6 }, { k: 'seep', v: 35 }] } } })],
    objs: sc === 'kannai' ? kannaiObjs : sc === 'minato' ? minatoObjs : alleyObjs }; return o; }, {}),
  farmNoge: { farm: true, scene: 'noge', name: 'ノゲ横丁 裏路地', intro: 'マンカンの回収班が、路地を一本ずつ潰して回っている。', reward: 70,
    enemies: () => { const ps = CH.G.party.length; const out = [agent('a1', '巡回エージェント')]; if (ps >= 2) out.push(runner('r1', '巡回ネットランナー')); if (ps >= 3 && Math.random() < 0.6) out.push(agent('a2', '巡回エージェントB')); return out; }, objs: nogeObjs },
  farmDrone: { farm: true, scene: 'pier', name: 'コンテナ埠頭 ジャンク山の奥', intro: '持ち主を失った警備ドローンが、まだ何かを守っている。', reward: 30,
    enemies: () => { const ps = CH.G.party.length, n = Math.min(3, Math.max(1, ps - (Math.random() < 0.5 ? 1 : 0)) + (ps === 1 && Math.random() < 0.4 ? 1 : 0)); return ['α', 'β', 'γ'].slice(0, n).map((x, i) => drone('d' + i, '野良ドローン' + x, 46, 10)); }, objs: pierObjs },
  farmThug: { farm: true, scene: 'chinatown', name: '旧中華街跡 裏通り', intro: '朗々幇の縄張りに踏み込んだ。下っ端が飛び出してくる。', reward: 45,
    enemies: () => { const ps = CH.G.party.length, n = Math.min(3, Math.max(1, ps - (Math.random() < 0.5 ? 1 : 0))); return ['A', 'B', 'C'].slice(0, n).map((x, i) => thug('e' + i, '下っ端' + x, 48, 12)); }, objs: alleyObjs },
};

/* ---------- 第四章の敵と遭遇 ---------- */
const foe = (id, name, kind, o) => mkUnit(Object.assign({ id, name, kind, side: 'enemy', fxk: 'blunt', xp: Math.round(o.hp / 6), def: 8, spd: 9, fw: 20, pdur: 40 }, o));
const factoryObjs = () => [
  { id: 'panel', name: '高圧配電盤', act: '叩き壊す', desc: '敵全体に電撃。濡れた敵には2倍+スタン', tgt: 'none' },
  { id: 'crane', name: '吊り下げの鋼材', act: '落とす', desc: '単体に打撃の大ダメージ', tgt: 'enemy' },
  { id: 'sprinkler', name: '冷却水のバルブ', act: '開ける', desc: '敵も味方も全員「濡れ」、熱-30', tgt: 'none' },
];
const onsenObjs = () => [
  { id: 'hydrant', name: '源泉の配管', act: 'ぶち破る', desc: '敵全体を「濡れ」にする', tgt: 'none' },
  { id: 'keg', name: '酒樽', act: '転がす', desc: '敵全体に打撃のダメージ(腕力依存)', tgt: 'none' },
  { id: 'lantern', name: '湯治場の灯籠', act: '倒す', desc: '敵全体に炎のダメージ+熱+20', tgt: 'none' },
];
const mallObjs = () => [
  { id: 'keg', name: 'ワゴンセールの山', act: '崩す', desc: '敵全体に打撃のダメージ(腕力依存)', tgt: 'none' },
  { id: 'neon', name: 'デジタルサイネージ', act: '叩き割る', desc: '単体に電撃の大ダメージ。濡れた敵には2倍+スタン', tgt: 'enemy' },
  { id: 'sprinkler', name: '噴水広場の噴水', act: '暴走させる', desc: '敵も味方も全員「濡れ」、熱-30', tgt: 'none' },
];
const ps = () => CH.G.party.length;
const big = (a, b, c) => ps() >= 4 ? c : ps() >= 3 ? b : a;
/* ---------- メガモールのゾーンと階の特性 ---------- */
const MALLZONES = [
  { to: 10, n: '食品フロア', intro: '試食コーナーの声が、誰もいない通路に響いている。', boss: 'デパ地下の主', bossKind: 'titan', bossMems: ['missile', 'glass', 'coupon'],
    foes: [['清掃ドローン', 'drone', { hp: 80, atk: 18, def: 6, spd: 12, fw: 8 }], ['セール狂いの客', 'thug', { hp: 100, atk: 22, def: 6, spd: 10 }], ['試食販売員', 'runner', { hp: 85, atk: 18, def: 5, spd: 13, fw: 12 }]],
    pool: [['coupon', 0.25], ['knuckle', 0.15], ['shock', 0.15], ['steep', 0.15], ['hungry', 0.1], ['hashi', 0.1], ['glass', 0.05], ['markdown', 0.05]] },
  { to: 20, n: '家電フロア', intro: 'デモ機のテレビが、一斉に同じ広告を流している。', boss: '展示品の王', bossKind: 'smith', bossMems: ['saw', 'escalator', 'armor'],
    foes: [['デモ機ロボ', 'drone', { hp: 95, atk: 20, def: 8, spd: 11, fw: 8 }], ['防犯カメラ砲台', 'turret', { hp: 140, atk: 22, def: 12, spd: 4, fw: 15 }], ['延長保証の勧誘員', 'runner', { hp: 90, atk: 18, def: 5, spd: 14, fw: 12 }]],
    pool: [['shock', 0.2], ['netrun', 0.15], ['frost', 0.15], ['escalator', 0.15], ['saw', 0.1], ['decoy', 0.1], ['pointcard', 0.08], ['blackfriday', 0.07]] },
  { to: 30, n: 'アパレルフロア', intro: 'マネキンの首が、通り過ぎるたびにこちらを向く。', boss: 'マネキン女王', bossKind: 'champ', bossMems: ['mirror', 'giftwrap', 'charm'],
    foes: [['警備マネキン', 'agent', { hp: 110, atk: 22, def: 10 }], ['試着室の主', 'thug', { hp: 120, atk: 24, def: 8, spd: 11 }], ['店員ドロイド', 'runner', { hp: 95, atk: 20, def: 6, spd: 15, fw: 14 }]],
    pool: [['mirror', 0.2], ['charm', 0.15], ['giftwrap', 0.15], ['decoy', 0.15], ['magnet', 0.1], ['lostfound', 0.1], ['clearance', 0.08], ['blackfriday', 0.07]] },
  { to: 40, n: '屋内遊園地', intro: '止まったメリーゴーラウンドの木馬に、誰かが乗っている。', boss: '着ぐるみ総支配人', bossKind: 'chair', bossMems: ['banquet', 'charm', 'armor'],
    foes: [['着ぐるみ警備員', 'agent', { hp: 130, atk: 24, def: 11 }], ['暴走ゴーカート', 'drone', { hp: 110, atk: 24, def: 9, spd: 15, fw: 8 }], ['風船売り', 'runner', { hp: 100, atk: 20, def: 6, spd: 14, fw: 14 }]],
    pool: [['anthem', 0.15], ['lowg', 0.15], ['charm', 0.15], ['clearance', 0.15], ['pointcard', 0.1], ['lostfound', 0.1], ['restock', 0.1], ['glass', 0.1]] },
  { to: Infinity, n: '無限在庫', intro: 'バックヤード。棚が地平線まで続いている。在庫は、終わらない。', boss: '在庫管理AI', bossKind: 'final', bossMems: ['banquet', 'restock', 'mirror'],
    foes: [['在庫番', 'agent', { hp: 130, atk: 25, def: 12 }], ['返品の山', 'thug', { hp: 150, atk: 25, def: 10, spd: 8 }], ['棚卸しドローン', 'drone', { hp: 110, atk: 24, def: 9, spd: 15, fw: 8 }], ['発注AI端末', 'runner', { hp: 100, atk: 21, def: 6, spd: 14, fw: 14 }]],
    pool: [['restock', 0.12], ['clearance', 0.12], ['markdown', 0.12], ['blackfriday', 0.12], ['escalator', 0.1], ['giftwrap', 0.1], ['pointcard', 0.08], ['lostfound', 0.08], ['glass', 0.08], ['hungry', 0.08]] },
];
const mallZone = f => MALLZONES.find(z => f <= z.to);
const MALLMOD = {
  none: { n: '通常', d: '何も起きていない' }, wet: { n: '冠水', d: '敵も味方も濡れた状態で始まる' }, hot: { n: '空調故障', d: '全員の熱が40から始まる' },
  rare: { n: '特売日', d: '★レア個体がとても出やすい' }, rich: { n: '決算セール', d: '敵のHP1.4倍。報酬と経験値は2倍' }, dark: { n: '停電', d: '全員が1ターン照準撹乱で始まる' }, elite: { n: 'ガードマン巡回', d: '敵が1体増え、メモリのレアリティが上がる' },
};
const rollAfxFixed = (m, i) => { const ks = ['atk', 'def', 'tec', 'spd', 'hp', 'cool', 'seep', 'pow']; return [0, 1, 2, 3].map(j => { const k = ks[(i * 3 + j * 2 + m.length) % ks.length]; return { k, v: AFX_TOP[k] }; }); };
const AFX_TOP = { atk: 4, def: 4, tec: 6, spd: 3, hp: 25, cool: -20, seep: 50, pow: 18 };
const ENC4 = {
  farmKw: { farm: true, scene: 'factory', name: '臨海工場群 第三ライン', intro: '制御を失った作業ロボットが、ラインの上で鉄を叩き続けている。', reward: 140,
    enemies: () => { const out = [foe('d1', '暴走溶接ロボ', 'drone', { hp: 150, atk: 26, def: 12, spd: 8, fw: 10, mems: [pickMem([['saw', 0.5], ['shock', 0.3], ['weld', 0.2]])] })]; if (ps() >= 2) out.push(foe('d2', '暴走運搬ロボ', 'drone', { hp: 170, atk: 24, def: 14, spd: 6, fw: 10, mems: [pickMem([['armor', 0.6], ['saw', 0.4]])] })); if (ps() >= 3) out.push(sentinel('t1', '検品セントリー')); return out; }, objs: factoryObjs },
  farmHk: { farm: true, scene: 'onsen', name: '湯けむり横丁 裏山', intro: '山の密猟者たちが、湯治客を狙って降りてきた。', reward: 140,
    enemies: () => ['A', 'B', 'C'].slice(0, Math.max(2, Math.min(3, ps()))).map((x, i) => foe('e' + i, '山の密猟者' + x, 'thug', { hp: 150, atk: 25, def: 9, spd: 10, mems: [pickMem([['steam', 0.4], ['knuckle', 0.3], ['smoke', 0.3]])] })), objs: onsenObjs },
  farmKs: { farm: true, scene: 'suburb', name: '駅前ロータリー 裏の駐輪場', intro: '郊外の自警団。よそ者を見ると、とりあえず殴る。', reward: 130,
    enemies: () => { const out = [foe('a1', '自警団員', 'agent', { hp: 150, atk: 24, def: 11, mems: [pickMem([['baton', 0.5], ['armor', 0.3], ['mirror', 0.2]])] })]; if (ps() >= 2) out.push(foe('a2', '自警団の見張り', 'runner', { hp: 100, atk: 18, def: 5, spd: 13, fw: 15, mems: [pickMem([['netrun', 0.6], ['coupon', 0.4]])] })); if (ps() >= 3) out.push(foe('a3', '自警団長の犬型ドローン', 'drone', { hp: 130, atk: 24, def: 8, spd: 14, fw: 8, mems: ['leech'] })); return out; }, objs: () => [{ id: 'car', name: '放置自転車の山', act: '盾にする', desc: '自分の被ダメージを3ターン半減', tgt: 'none' }, { id: 'keg', name: '家庭菜園のかぼちゃ', act: '転がす', desc: '敵全体に打撃のダメージ(腕力依存)', tgt: 'none' }] },
  farmHm: { farm: true, scene: 'honmoku', name: 'ホンモク・ドック 闇市の裏', intro: '密輸業者の用心棒が、品定めするようにこちらを見た。', reward: 140,
    enemies: () => { const out = [foe('e1', '密輸業者の用心棒', 'thug', { hp: 170, atk: 26, def: 10, mems: [pickMem([['knuckle', 0.4], ['leech', 0.3], ['glass', 0.05], ['smoke', 0.25]])] })]; if (ps() >= 2) out.push(foe('r1', '闇市のネットランナー', 'runner', { hp: 110, atk: 19, def: 5, spd: 14, fw: 15, mems: [pickMem([['netrun', 0.6], ['coupon', 0.4]])] })); if (ps() >= 3) out.push(foe('e2', '密輸業者の荷役', 'thug', { hp: 190, atk: 24, def: 12, spd: 7, mems: [pickMem([['armor', 0.5], ['saw', 0.5]])] })); return out; }, objs: () => [{ id: 'crane', name: '密輸コンテナ', act: '落とす', desc: '単体に打撃の大ダメージ', tgt: 'enemy' }, { id: 'hydrant', name: '岸壁の消火栓', act: 'ぶち破る', desc: '敵全体を「濡れ」にする', tgt: 'none' }, { id: 'lantern', name: '闇市の裸電球', act: '落とす', desc: '敵全体に炎のダメージ+熱+20', tgt: 'none' }] },
  kwboss: { scene: 'factory', name: '臨海工場群 第一高炉', intro: '高炉の主、自律鍛造機「ベッセマー」。工場の全ラインを乗っ取っている。', reward: 700,
    enemies: () => [foe('d1', '取り巻きの溶接ロボ', 'drone', { hp: 160, atk: 26, def: 12, spd: 8, mems: ['weld'] }), ...(ps() >= 3 ? [foe('d2', '取り巻きの運搬ロボ', 'drone', { hp: 170, atk: 24, def: 14, spd: 6, mems: ['armor'] })] : []),
      foe('boss', '自律鍛造機ベッセマー', 'smith', { boss: true, xp: 500, hp: big(1300, 1700, 2100), atk: 36, def: 18, spd: 6, fw: 20, mems: ['saw', 'weld', 'armor'], pdur: 90, insts: { saw: { rar: 4, afx: [{ k: 'atk', v: 4 }, { k: 'pow', v: 18 }, { k: 'spd', v: 2 }, { k: 'cool', v: -15 }] }, weld: { rar: 4, afx: [{ k: 'def', v: 4 }, { k: 'hp', v: 25 }, { k: 'atk', v: 4 }, { k: 'tec', v: 6 }] }, armor: { rar: 4, afx: [{ k: 'def', v: 4 }, { k: 'hp', v: 25 }, { k: 'cool', v: -20 }, { k: 'seep', v: 35 }] } } })], objs: factoryObjs },
  hkboss: { scene: 'onsen', name: '湯けむり横丁 源泉の上', intro: 'マスドライバーを守る「湯守」。源泉の岩を体にした、古い土木ロボットだ。', reward: 700,
    enemies: () => [...(ps() >= 3 ? [foe('e1', '密輸団の見張り', 'thug', { hp: 160, atk: 26, def: 9, mems: ['smoke'] })] : []),
      foe('boss', '湯守', 'golem', { boss: true, xp: 500, hp: big(1300, 1650, 2000), atk: 33, def: 19, spd: 5, fw: 10, mems: ['steam', 'mirror'], pdur: 90, insts: { steam: { rar: 4, afx: [{ k: 'tec', v: 6 }, { k: 'cool', v: -20 }, { k: 'hp', v: 25 }, { k: 'pow', v: 12 }] }, mirror: { rar: 4, afx: [{ k: 'def', v: 4 }, { k: 'hp', v: 25 }, { k: 'spd', v: 2 }, { k: 'seep', v: 50 }] } } })], objs: onsenObjs },
  hmboss: { scene: 'honmoku', name: 'ホンモク・ドック 密輸船の甲板', intro: '密輸船の船長、キャプテン・ヒジキ。月まで行ける船を持つ、唯一の海賊。', reward: 700,
    enemies: () => [foe('e1', '甲板員A', 'thug', { hp: 160, atk: 25, def: 9, mems: ['knuckle'] }), ...(ps() >= 3 ? [foe('e2', '甲板員B', 'thug', { hp: 160, atk: 25, def: 9, mems: ['leech'] })] : []),
      foe('boss', 'キャプテン・ヒジキ', 'captain', { boss: true, fxk: 'slash', xp: 500, hp: big(1200, 1550, 1900), atk: 34, def: 15, spd: 11, fw: 30, mems: ['missile', 'smoke', 'leech'], pdur: 80, insts: { missile: { rar: 4, afx: [{ k: 'pow', v: 18 }, { k: 'atk', v: 4 }, { k: 'tec', v: 4 }, { k: 'hp', v: 25 }] }, smoke: { rar: 4, afx: [{ k: 'spd', v: 3 }, { k: 'cool', v: -20 }, { k: 'def', v: 4 }, { k: 'seep', v: 35 }] }, leech: { rar: 4, afx: [{ k: 'tec', v: 6 }, { k: 'hp', v: 25 }, { k: 'pow', v: 12 }, { k: 'spd', v: 2 }] } } })], objs: () => [{ id: 'crane', name: '甲板の積み荷', act: '落とす', desc: '単体に打撃の大ダメージ', tgt: 'enemy' }, { id: 'hydrant', name: '甲板の放水銃', act: '撃つ', desc: '敵全体を「濡れ」にする', tgt: 'none' }, { id: 'keg', name: 'ラム酒の樽', act: '転がす', desc: '敵全体に打撃のダメージ(腕力依存)', tgt: 'none' }] },
  ymboss: { scene: 'yamate', name: 'ヤマテ高台 洋館の大広間', intro: '会長の生家を守るボディガード、ミスター・ホワイトグローブ。', reward: 700,
    enemies: () => [foe('a1', '執事型アンドロイド', 'agent', { hp: 170, atk: 26, def: 12, mems: ['mirror'] }), ...(ps() >= 3 ? [foe('a2', 'メイド型アンドロイド', 'agent', { hp: 170, atk: 26, def: 12, mems: ['baton'] })] : []),
      foe('boss', 'ミスター・ホワイトグローブ', 'bodyguard', { boss: true, xp: 500, hp: big(1650, 2100, 2600), atk: 41, def: 18, spd: 13, fw: 40, mems: ['mirror', 'knuckle', 'baton'], pdur: 80, insts: { mirror: { rar: 4, afx: [{ k: 'def', v: 4 }, { k: 'hp', v: 25 }, { k: 'tec', v: 6 }, { k: 'cool', v: -15 }] }, knuckle: { rar: 4, afx: [{ k: 'atk', v: 4 }, { k: 'spd', v: 3 }, { k: 'pow', v: 18 }, { k: 'hp', v: 25 }] }, baton: { rar: 4, afx: [{ k: 'tec', v: 6 }, { k: 'atk', v: 4 }, { k: 'def', v: 4 }, { k: 'seep', v: 35 }] } } })], objs: () => [{ id: 'lantern', name: 'シャンデリア', act: '落とす', desc: '敵全体に炎のダメージ+熱+20', tgt: 'none' }, { id: 'car', name: 'グランドピアノ', act: '盾にする', desc: '自分の被ダメージを3ターン半減', tgt: 'none' }, { id: 'neon', name: '燭台の電飾', act: '叩きつける', desc: '単体に電撃の大ダメージ', tgt: 'enemy' }] },
  ntboss: { scene: 'tokyo', name: 'スペースポート 出発ロビー', intro: 'マンカン・ホールディングス品質保証部、ツキミ部長。二度目の製品回収。', reward: 700,
    enemies: () => [agent('a1', '空港警備エージェントA', 160, 28), ...(ps() >= 3 ? [agent('a2', '空港警備エージェントB', 160, 28)] : []), ...(ps() >= 4 ? [sentinel('t1', '保安検査セントリー')] : []),
      mkUnit({ id: 'boss', name: 'ツキミ部長(再)', kind: 'exec', fxk: 'blunt', boss: true, side: 'enemy', xp: 500, hp: big(1600, 2050, 2500), atk: 42, def: 19, spd: 11, fw: 50, mems: ['armor', 'medic', 'qa'], pdur: 90,
        insts: { armor: { rar: 4, afx: [{ k: 'def', v: 4 }, { k: 'hp', v: 25 }, { k: 'atk', v: 4 }, { k: 'spd', v: 2 }] }, medic: { rar: 4, afx: [{ k: 'tec', v: 6 }, { k: 'hp', v: 25 }, { k: 'pow', v: 12 }, { k: 'def', v: 4 }] }, qa: { rar: 4, afx: [{ k: 'tec', v: 6 }, { k: 'atk', v: 4 }, { k: 'spd', v: 3 }, { k: 'cool', v: -20 }] } } })], objs: kannaiObjs },
  ksescort: { scene: 'suburb', name: 'カシワタウン 天文台の坂', intro: '元宇宙飛行士の老婆を狙って、マンカンの回収班が坂を上ってくる。', reward: 400,
    enemies: () => [agent('a1', '回収班エージェントA', 170, 29), agent('a2', '回収班エージェントB', 170, 29), ...(ps() >= 3 ? [runner('r1', '回収班ネットランナー')] : []), ...(ps() >= 4 ? [sentinel('t1', '回収班セントリー')] : [])], objs: () => [{ id: 'crane', name: '天文台のドーム片', act: '落とす', desc: '単体に打撃の大ダメージ', tgt: 'enemy' }, { id: 'keg', name: '家庭菜園のかぼちゃ', act: '転がす', desc: '敵全体に打撃のダメージ(腕力依存)', tgt: 'none' }] },
  mall: { farm: true, scene: 'mall',
    get name() { const f = CH.G.mallFloor || 1, z = mallZone(f); return `メガモール 地下${f}階 ${z.n}${CH.G.mallMod && CH.G.mallMod !== 'none' ? ' [' + MALLMOD[CH.G.mallMod].n + ']' : ''}`; },
    get intro() { const f = CH.G.mallFloor || 1, z = mallZone(f); return f % 10 === 0 ? `${z.boss}が、フロアの奥で目を覚ました。` : f % 5 === 0 ? 'フロアマネージャーが、クリップボードを持って立ちはだかった。' : z.intro; },
    get reward() { return Math.round((60 + 30 * (CH.G.mallFloor || 1)) * (CH.G.mallMod === 'rich' ? 2 : CH.G.mallMod === 'vip' ? 1.5 : 1)); },
    get rareRate() { return 10 + (CH.G.mallMod === 'rare' ? 40 : 0); },
    get xpMul() { return CH.G.mallMod === 'rich' ? 2 : 1; },
    onStart(G) { const m = G.mallMod; G.units.forEach(u => { if (m === 'wet') u.st.wet = 3; if (m === 'hot') u.heat = 40; if (m === 'dark') u.st.jam = 1; if (m === 'bargain' && u.side === 'enemy') u.heat = 60; if (m === 'sample') u.st.boost = 3; }); },
    enemies: () => {
      const f = CH.G.mallFloor || 1, z = mallZone(f), mod = CH.G.mallMod || 'none';
      const k = (1 + 0.12 * (f - 1)) * (mod === 'rich' ? 1.4 : mod === 'vip' ? 3 : 1), a = 1 + 0.055 * (f - 1), dd = Math.floor(f * 0.25);
      CH.G.wanted = (CH.G.baseWanted || 0) + Math.floor(f / 2) + (mod === 'elite' ? 6 : mod === 'vip' ? 12 : 0);
      const sc = u => { u.maxhp = u.hp = Math.round(u.hp * k); u.atk = Math.round(u.atk * a); u.def += dd; u.xp = Math.round((u.xp || 10) * (1 + 0.12 * f)); return u; };
      if (f % 10 === 0) {
        const first = !(CH.G.mallBossDone || {})[f], zb = z.bossMems;
        const insts = first ? Object.fromEntries(zb.map((m, i) => [m, { rar: 4, afx: rollAfxFixed(m, i) }])) : undefined;
        return [sc(foe('boss', z.boss, z.bossKind, { boss: true, xp: 300, hp: big(900, 1200, 1500), atk: 30, def: 15, spd: 8, fw: 25, mems: zb, pdur: 80, insts }))];
      }
      if (f % 5 === 0) return [sc(foe('m1', '警備マネキン', 'agent', { hp: 110, atk: 22, def: 10, mems: [pickMem(z.pool)] })), sc(foe('boss', 'フロアマネージャー', 'exec', { boss: true, xp: 200, hp: big(500, 650, 800), atk: 28, def: 13, spd: 9, fw: 40, mems: ['armor', 'medic', pickMem([['coupon', 0.5], ['markdown', 0.5]])], pdur: 70 }))];
      const n = mod === 'vip' ? 1 : Math.min(4, Math.max(1, ps() - (Math.random() < 0.5 ? 1 : 0)) + (f > 6 ? 1 : 0)) + (mod === 'elite' ? 1 : 0);
      return Array.from({ length: Math.min(5, n) }, (_, i) => { const t = z.foes[Math.floor(Math.random() * z.foes.length)]; const u = sc(foe('m' + i, t[0] + 'ABCDE'[i], t[1], Object.assign({ mems: [pickMem(z.pool)] }, t[2]))); return u; });
    }, objs: mallObjs },
};
Object.assign(ENC, ENC4);

/* ---------- セーブデータ ---------- */
function newSave() {
  const hero = mkChar('hero');
  return { v: 1, credits: 60, wanted: 0, flags: {}, done: {}, loc: 'pier', roster: [hero], party: ['hero'], bag: [], storage: [], items: { gel: 2, coolant: 1, emp: 0 }, parts: 0, recipes: {}, seep: {}, rel: {}, scav: {}, tips: {}, rom: {}, left: {}, relWins: {}, shurabaAt: null, keys: { ride: [], pass: [], map: [] }, mallFloor: 1, mallMax: 0 };
}
const member = (S, id) => S.roster.find(u => u.id === id);
const party = S => S.party.map(id => member(S, id));
function join(S, id, ports) {
  if (member(S, id)) return;
  const u = mkChar(id, Math.max(1, member(S, 'hero').lv - 1));
  if (ports) { ports.forEach((p, i) => { if (u.ports[i] && p.inst) { p.inst.known = true; u.ports[i].mem = p.inst.type; u.ports[i].inst = p.inst; } }); CH.recompute(u); u.hp = u.maxhp; }
  S.roster.push(u);
  if (S.party.length < PARTY_MAX) S.party.push(id);
  if (LOCS[S.loc]) memo(S, id, `${LOCS[S.loc].name}で出会った`);
}
const owns = (S, type) => S.bag.concat(S.storage).some(i => i.type === type) || S.roster.some(u => u.ports.some(p => p.mem === type) || (u.fixed || []).some(i => i.type === type));
const give = (S, inst) => { (S.bag.length < CARRY ? S.bag : S.storage).push(inst); };
const rel = (S, id, n) => { S.rel[id] = (S.rel[id] || 0) + n; };

/* ---------- 絆(ロマンス) ----------
   段階 st: 0→1→2→3。段階2で「意識する(cand)」か「仲間として(friend)」を選ぶ。
   段階3で 相棒(partner) / 恋人(lover) / 保留。恋人は1人だけ。ただし恋人どうしが全員ポリアモリーなら掛け持ちできる。
   恋人候補(cand)が2人以上いる状態(全員ポリアモリーの場合を除く)で手配度が2上がると、修羅場が起きる。 */
const ROM = {
  kill: { poly: false, react: 'stay', back: 'chinatown' },
  aur: { poly: true, react: 'step', back: 'pier' },
  som: { poly: false, react: 'leave', back: 'pier' },
  hong: { poly: true, react: 'step', back: 'noge' },
  pedal: { poly: false, react: 'leave', back: 'noge' },
  wan: { poly: false, react: 'stay', back: 'chinatown' },
  xiao: { poly: true, react: 'step', back: 'noge' },
  zero: { poly: false, react: 'stay', back: 'minato' },
  gantetsu: { poly: true, react: 'step', back: 'kw' },
  chef: { poly: false, react: 'stay', back: 'chinatown' },
  lin: { poly: true, react: 'step', back: 'noge' }, tsukimi: { poly: false, react: 'leave', back: 'ntport' }, glassjaw: { poly: false, react: 'stay', back: 'minato' },
  hijiki: { poly: true, react: 'step', back: 'honmoku' }, whiteglove: { poly: false, react: 'stay', back: 'yamate' }, yumori: { poly: true, react: 'step', back: 'hk' },
  mutsuko: { poly: false, react: 'stay', back: 'ks' }, tenin: { poly: true, react: 'step', back: 'kg' }, satou: { poly: false, react: 'leave', back: 'kannai' }, nanashi: { poly: true, react: 'step', back: 'pier' },
};
const REL_NEED = [3, 9, 16];
/* 段階ごとの物語の進み具合の条件(恋人を選ぶのは終盤) */
const ROM_GATE = [S => true, S => S.wanted >= 6, S => !!S.flags.moon];
const rom = (S, id) => S.rom[id] || (S.rom[id] = { st: 0, path: null, bond: null });
const nm = id => CHARS[id].name;
function leave(S, id) {
  const u = member(S, id); if (!u) return;
  S.roster = S.roster.filter(x => x !== u); S.party = S.party.filter(x => x !== id);
  S.left[id] = { at: S.wanted, unit: u };
  rom(S, id).bond = null; rom(S, id).path = 'closed';
}
function comeBack(S, id) {
  const l = S.left[id]; if (!l) return;
  S.roster.push(l.unit); if (S.party.length < PARTY_MAX) S.party.push(id);
  delete S.left[id]; rom(S, id).path = 'friend';
}
const REACT = {
  stay: id => ({ glassjaw: [['グラスジョー', '……判定負けか'], 'グラスジョーとの間に、少しだけ距離ができた。'], whiteglove: [['ホワイトグローブ', 'かしこまりました'], 'ホワイトグローブとの間に、少しだけ距離ができた。'], mutsuko: [['ムツコ', 'あら。年寄りは引き際も心得てるのよ'], 'ムツコとの間に、少しだけ距離ができた。'], chef: [['料理長・朗', '……そうか。わしは、厨房に戻るだけだ'], '料理長との間に、少しだけ距離ができた。'], zero: [['ゼロカロリー', 'そっか。おなかいっぱいなら、それでいいよ'], 'ゼロカロリーとの間に、少しだけ距離ができた。'], wan: [['ワン', '……そうか'], 'ワンは鍋を磨く手を止めなかった。', 'ワンとの間に、少しだけ距離ができた。'], kill: ['キルチョイサーは、少しだけ笑った。', ['キルチョイサー', '……やっぱり、ついてない。大丈夫。慣れてるから'], 'キルチョイサーとの間に、少しだけ距離ができた。'] }[id]),
  step: id => ({ lin: [['リン', '契約内容の変更ね。いいわ、相棒契約で'], 'リンは相棒として残った。'], hijiki: [['キャプテン・ヒジキ', 'がはは! 港はいくつあってもいい'], 'ヒジキは相棒として残った。'], yumori: [['湯守', '……マモリ……マス'], '湯守は相棒として残った。'], tenin: [['テンイン', 'ポイントカードは、そのまま使えます'], 'テンインは相棒として残った。'], nanashi: ['ナナシのセンサーが、青く光った。', 'ナナシは相棒として残った。'], gantetsu: [['ガンテツ', 'いい。刃は返さなくていい。相棒として使え'], 'ガンテツは相棒として残った。'], hong: [['紅姐', 'いいのよ。あたしは逃げない女だから。いい相棒でいてあげる'], '紅姐は相棒として残った。'], xiao: [['小籠', 'かしこまりました。お席はそのままに、ご用命をお待ちしております'], '小籠は相棒として残った。'], aur: [['オロール', '騎士は、想い人の幸福を守るものだ。我が槍は変わらず、そなたのものである'], 'オロールは相棒として残った。'] }[id]),
  leave: id => ({ tsukimi: [['ツキミ', '……保証を、取り消します'], 'ツキミは去っていった。'], satou: [['サトウ', '……やっぱり、まだ味が分からないみたいです'], 'サトウは去っていった。'], pedal: [['ペダル', 'は? 知るかよ。勝手にしろ'], 'ペダルは自転車を蹴って走り去った。'], som: [['サイレント・ソムリエ', '……二皿目を出す店に、用はない'], 'サイレント・ソムリエは去っていった。'] }[id]),
};
function react(S, id, out) {
  const r = ROM[id].react, R = rom(S, id);
  if (r === 'stay') { R.bond = null; R.path = 'closed'; }
  else if (r === 'step') { R.bond = 'partner'; R.path = 'done'; }
  else leave(S, id);
  out.push(...REACT[r](id));
}
function takeLover(S, id) {
  const out = [];
  Object.keys(S.rom).filter(k => k !== id && member(S, k) && (S.rom[k].bond === 'lover' || S.rom[k].path === 'cand'))
    .forEach(k => { if (!(ROM[k].poly && ROM[id].poly)) react(S, k, out); });
  const R = rom(S, id); R.bond = 'lover'; R.path = 'done'; R.st = 3;
  checkShuraba(S);
  return out;
}
const conflicting = S => { const c = Object.keys(S.rom).filter(k => member(S, k) && (S.rom[k].path === 'cand' || S.rom[k].bond === 'lover')); return c.length >= 2 && !c.every(k => ROM[k].poly) ? c : null; };
function checkShuraba(S) { if (conflicting(S)) { if (S.shurabaAt == null) S.shurabaAt = S.wanted; } else S.shurabaAt = null; }
const bonds = S => { const b = {}; Object.keys(S.rom).forEach(k => { if (S.rom[k].bond) b[k] = S.rom[k].bond === 'lover' ? 2 : 1; }); return b; };
const romOpen = (S, id, st) => member(S, id) && rom(S, id).st === st - 1 && (S.rel[id] || 0) >= REL_NEED[st - 1] && ROM_GATE[st - 1](S) && !(st === 3 && rom(S, id).path === 'closed');
/* 段階のイベントを組み立てる */
function romEvents(id, d) {
  const E = {};
  E['r' + id + '1'] = { loc: 'pier', rom: true, label: d.label, sub: d.s1.sub, cond: S => romOpen(S, id, 1), nodes: {
    start: { t: d.s1.t, c: d.s1.c.map(c => ({ t: c[0], sub: '', to: 'end', fx: S => { rel(S, id, c[1]); rom(S, id).st = 1; memo(S, id, pastSub(d.s1.sub)); } })) },
    end: { t: d.s1.end, end: true } } };
  E['r' + id + '2'] = { loc: 'pier', rom: true, label: d.label, sub: d.s2.sub, cond: S => romOpen(S, id, 2), nodes: {
    start: { t: d.s2.t, c: [
      { t: d.s2.cand, sub: '', to: 'c', fx: S => { rel(S, id, 1); const R = rom(S, id); R.st = 2; R.path = 'cand'; checkShuraba(S); memo(S, id, pastSub(d.s2.sub)); } },
      { t: d.s2.friend, sub: '', to: 'f', fx: S => { rel(S, id, 1); const R = rom(S, id); R.st = 2; R.path = 'friend'; memo(S, id, pastSub(d.s2.sub)); } }] },
    c: { t: d.s2.endC, end: true }, f: { t: d.s2.endF, end: true } } };
  E['r' + id + '3'] = { loc: 'pier', rom: true, label: d.label, sub: d.s3.sub, cond: S => romOpen(S, id, 3), nodes: {
    start: { t: d.s3.t, c: [
      { t: d.s3.lover, sub: S => Object.keys(S.rom).some(k => k !== id && member(S, k) && (S.rom[k].bond === 'lover' || S.rom[k].path === 'cand') && !(ROM[k].poly && ROM[id].poly)) ? '恋人になる。ほかの誰かとの関係が変わるかもしれない' : '恋人になる', to: 'lv', cond: S => rom(S, id).path === 'cand' || rom(S, id).path === 'friend' },
      { t: d.s3.partner, sub: '相棒になる', to: 'pt', fx: S => { const R = rom(S, id); R.st = 3; R.bond = 'partner'; R.path = 'done'; checkShuraba(S); memo(S, id, '相棒になった日'); } },
      { t: d.s3.wait, sub: '今は答えを出さない', to: 'wt' }] },
    lv: { fx: S => { S._react = takeLover(S, id); memo(S, id, '恋人になった日'); }, t: [], dyn: S => d.s3.endL.concat(S._react || [], [`${nm(id)}と恋人になった。`]), end: true },
    pt: { t: d.s3.endP.concat([`${nm(id)}と相棒になった。`]), end: true },
    wt: { t: d.s3.endW, end: true, noDone: true } } };
  E['r' + id + 'back'] = { loc: ROM[id].back, rom: true, label: '見覚えのある背中', sub: '', cond: S => S.left[id] && S.wanted >= S.left[id].at + 1, nodes: {
    start: { t: d.back.t, c: [{ t: '謝る', sub: '', to: 'y' }, { t: '声をかけない', sub: '', to: 'n' }] },
    y: { fx: S => { comeBack(S, id); memo(S, id, '謝って、戻ってきてもらった日'); }, t: d.back.yes.concat([`${nm(id)}が戻ってきた。`]), end: true },
    n: { t: ['背中は、人混みに紛れて見えなくなった。'], end: true, noDone: true } } };
  return E;
}
const ROMEV = Object.assign({},
  romEvents('kill', {
    label: 'キルチョイサーと過ごす',
    s1: { sub: 'コンテナの屋根の上で、銃を磨いている', t: [
      'ねぐらのコンテナの屋根に、キルチョイサーが座っていた。膝の上で、分解したライフルの部品を一つずつ布で拭いている。',
      ['キルチョイサー', '今までの雇い主、七人。全員、報酬を払う前に死んだの。病気、事故、別の殺し屋。私が撃つ前に'],
      ['キルチョイサー', 'だから私、まだ一度も、ちゃんとお金をもらったことがないのよ'],
    ], c: [['「お前のせいじゃない」', 1], ['「次は俺が払う。生きてるうちに」', 2], ['黙って隣に座る', 1]],
      end: ['キルチョイサーは部品を組み直した。最後のピンが、かちりと鳴った。', ['キルチョイサー', '……長生きしてね。ほんとに'] ] },
    s2: { sub: '夜のジャンク山を、一人で見下ろしている', t: [
      '夜のジャンク山は、潮が満ちると少しだけ低くなる。キルチョイサーはそれを、毎晩数えているらしかった。',
      ['キルチョイサー', '私、自分の名前を覚えてないの。キルチョイサーは職業。殺し屋を選ぶ人、じゃなくて、殺す相手を選ぶ人'],
      ['キルチョイサー', 'でも、選んだことなんて一度もない。いつも、誰かに選ばれてた'],
    ], cand: '「呼び名なんて、呼ぶ奴がいれば十分だ。俺が呼ぶ」', friend: '「背中は預ける。それで十分だろ」',
      endC: ['キルチョイサーは何か言いかけて、やめた。屋根の上の風が、彼女の髪を一度だけ持ち上げた。'], endF: [['キルチョイサー', '……うん。それは、得意なの'], 'キルチョイサーは、銃身をそっと撫でた。'] },
    s3: { sub: '屋根の上で、待っている', t: [
      'キルチョイサーは、屋根の上で膝を抱えていた。今夜は銃を持っていなかった。',
      ['キルチョイサー', '雇い主が生きてるうちは、撃たない。そう決めてるの'],
      ['キルチョイサー', '……じゃあ、雇い主じゃなくなったら。私、あなたの何になればいいの'],
    ], lover: '「雇い主じゃなく、隣にいる奴として」', partner: '「相棒だ。撃つ時も、撃たない時も」', wait: '「まだ、答えられない」',
      endL: ['キルチョイサーは、初めて声を立てて笑った。笑い方を忘れていた人の笑い方だった。', ['キルチョイサー', 'ついてないの、今日で終わりにする'] ],
      endP: [['キルチョイサー', '相棒。……それ、報酬より、ずっといい'] ], endW: [['キルチョイサー', 'うん。待つのは、慣れてる'] ] },
    back: { t: ['善隣門の下の屋台で、細い肩の女が、粥を一人で食べていた。長い銃のケースが、椅子に立てかけてある。'], yes: [['キルチョイサー', '……謝られたの、初めて。ついてる日も、あるのね'] ] },
  }),
  romEvents('aur', {
    label: 'オロールと過ごす',
    s1: { sub: 'ジャンク山の麓で、甲冑の手入れをしている', t: [
      'オロールは、ジャンク山の麓で甲冑の手入れをしていた。脱がずに、である。籠手の継ぎ目に油を差し、胸当てを布で磨き、そのどれもを身に着けたまま行っていた。',
      ['オロール', '騎士の甲冑は、騎士そのものだ。脱げば、それはもう別の何かになる'],
      'オロールは籠手を一つ、こちらに差し出した。磨けということらしかった。',
    ], c: [['籠手を丁寧に磨く', 2], ['「中は暑くないのか」', 1], ['「錆びたら言え。ジャンクなら山ほどある」', 1]],
      end: ['磨き終えた籠手を、オロールは長いこと眺めていた。面頬の奥で何が起きているのかは、やはり分からなかった。', ['オロール', '……良い仕事だ。我が甲冑に、そなたの手の跡が残った'] ] },
    s2: { sub: '槍を立てて、月を見ている', t: [
      'オロールは槍を地面に立て、その横で月を見ていた。月面基地の灯りが、小さく瞬いている。',
      ['オロール', '騎士には二つの誓いがある。主君への忠誠と、想い人への献身だ'],
      ['オロール', 'どちらも、一つに限るとは書かれておらぬ。我が師はそう教えた。異を唱える騎士も多かったがな'],
    ], cand: '「お前の想い人は、どこにいる」', friend: '「主君なら、俺がなってやってもいい」',
      endC: ['オロールは答えず、面頬をわずかにこちらへ向けた。それで十分な答えだった。'], endF: [['オロール', 'ふ。そなたは主君の器ではない。だが、戦友の器ではある'] ] },
    s3: { sub: '片膝をついて、待っている', t: [
      'ねぐらの前で、オロールが片膝をついていた。槍を横に置き、兜を伏せている。脱いではいない。',
      ['オロール', 'そなたに問う。この甲冑ごと、そなたの傍に置いてくれるか'],
      ['オロール', '脱ぐことはできぬ。顔も、名の続きも、見せることはできぬ。それでもよいなら'],
    ], lover: '「甲冑ごとでいい」', partner: '「戦友として、隣にいてくれ」', wait: '「少し、考えさせてくれ」',
      endL: ['オロールは立ち上がり、籠手の手でそっとこちらの手を取った。鉄は冷たかったが、内側からかすかに熱が伝わってきた。', ['オロール', '誓おう。我が想い人よ'] ],
      endP: [['オロール', '承知した。戦友よ、我が槍の届く限り、そなたの背に刃は届かせぬ'] ], endW: [['オロール', '騎士は待つことも務めのうちだ'] ] },
    back: { t: ['ジャンク山の頂上で、全身甲冑の人物が、また何かを掘り返していた。'], yes: [['オロール', '……許そう。騎士は、二度目の誓いを恥とはせぬ'] ] },
  }),
  romEvents('som', {
    label: 'サイレント・ソムリエと過ごす',
    s1: { sub: 'ねぐらの隅で、空のグラスを傾けている', t: [
      'サイレント・ソムリエは、ねぐらの隅で空のワイングラスを傾けていた。中身はない。傾ける角度だけが、正確だった。',
      ['サイレント・ソムリエ', '味を覚えるのが仕事だった。企業のために、他人の皿を鑑定して、値を付けて、時には消した'],
      ['サイレント・ソムリエ', '……あのチャーハン。一口でいい、と言ったのは、本心だ'],
    ], c: [['舌の端子に、メモリを当てさせる', 2], ['「売るまでは、誰にも食わせない」', 1], ['「いつか、本物を食わせてやる」', 1]],
      end: ['サイレント・ソムリエは、長い間、何も言わなかった。それから、グラスを伏せて置いた。', ['サイレント・ソムリエ', '……報告書に、書く欄がない'] ] },
    s2: { sub: '古い写真を、上着の内ポケットに戻している', t: [
      '内ポケットの写真を、サイレント・ソムリエは今夜も一度だけ取り出し、すぐに戻した。円卓を囲む家族。真ん中に、大皿の炒飯。',
      ['サイレント・ソムリエ', 'この円卓の誰が、私だったのか。もう分からない。企業は、舌以外のものを全部、上書きした'],
    ], cand: '「分からなくていい。今の舌で、新しく覚えればいい」', friend: '「円卓なら、ここにもある。椅子は足りないが」',
      endC: ['サイレント・ソムリエは、こちらを見た。値踏みする目ではなかった。'], endF: [['サイレント・ソムリエ', '……椅子は、拾えばいい。ここはジャンク山だ'] ] },
    s3: { sub: '銃を置いて、待っている', t: [
      'サイレント・ソムリエは、拳銃をテーブルに置いていた。グリップをこちらに向けて。',
      ['サイレント・ソムリエ', '私は、一つの皿に、一つの評価しか付けない。二つ付けるのは、ソムリエの恥だ'],
      ['サイレント・ソムリエ', 'だから聞く。あなたの評価は、一つか'],
    ], lover: '「一つだ」', partner: '「評価なら、最高の相棒だ」', wait: '「まだ、決められない」',
      endL: ['サイレント・ソムリエは銃を上着に戻し、代わりに、空のグラスを二つ並べた。', ['サイレント・ソムリエ', '……満点だ'] ],
      endP: [['サイレント・ソムリエ', '相棒。悪くない評価だ。……保存しておく'] ], endW: [['サイレント・ソムリエ', '熟成を待つ皿もある。待とう'] ] },
    back: { t: ['ねぐらのコンテナの前に、仕立てのいい黒い上着の女が立っていた。ワイングラスを持つような手つきで、何も持っていなかった。'], yes: [['サイレント・ソムリエ', '……謝罪の味は、悪くなかった。今回だけだ'] ] },
  }),
  { shuraba: { loc: 'pier', auto: true, rom: true, label: '修羅場', cond: S => S.shurabaAt != null && S.wanted >= S.shurabaAt + 2 && conflicting(S), nodes: {
    start: { fx: S => { const c = conflicting(S) || []; S._react = []; c.filter(k => !ROM[k].poly && rom(S, k).bond !== 'lover').forEach(k => { leave(S, k); S._react.push(`${nm(k)}は、何も言わずにねぐらを出ていった。`); }); S.shurabaAt = null; checkShuraba(S); },
      t: [], dyn: S => ['ねぐらに戻ると、空気が違っていた。', '誰も何も言わなかった。言わなくても分かることが、この街には多すぎる。'].concat(S._react || []), end: true, noDone: true } } } }
);

const bestStat = (S, k) => Math.max(...party(S).map(u => u.ex[k]));

/* ---------- イベント ----------
   node: { t:[行], c:[選択肢] } | { t, check:{stat,lo,hi,fail,ok,great} } | { t, battle:{enc,win,lose} } | { t, end:true }
   行は文字列か [話者, 台詞]。fx(S) は node に入った時に1回走る。 */
/* ---------- 第二章: ノゲ横丁 ---------- */
const CH2 = {
  m5: { loc: 'pier', main: true, label: 'ジローの伝言', sub: 'メインシナリオ。故買屋から連絡が来ている', cond: S => S.flags.m4, nodes: {
    start: { fx: S => { S.flags.m5 = 1; }, t: [
      'ジローの店の端末に、短い伝言が残っていた。',
      ['ジロー', 'リンが見つかった。ノゲ横丁の酒場「鳩の巣」だ。門に来なかったのは、来られなかったからだとさ'],
      ['ジロー', 'それと、例の企業の名前が割れた。マンカン・ホールディングス。満漢全席の満漢だ。この国の食卓の三割を握ってる'],
      ['ジロー', '刺客が一人消えたくらいで諦める会社じゃねえ。次は会社として来るぞ'],
    ], end: true } } },

  m6: { loc: 'noge', scene: 'bar', main: true, label: '酒場「鳩の巣」でリンに会う', sub: 'メインシナリオ。ブローカーのリンが待っている', cond: S => S.flags.m5, nodes: {
    start: { t: [
      'ノゲ横丁は、線路の高架の下に、飲み屋が肩を寄せ合って並ぶ路地である。提灯の赤と、ネオンの青と、焼き鳥の煙で、空はいつも同じ色をしている。',
      '酒場「鳩の巣」は、その一番奥にあった。カウンターの端で、短く髪を切った女が、グラスの氷を指で回していた。',
      ['リン', 'あんたがチャンカー? ……門の件は悪かったわ。行こうとしたら、店の前にマンカンの車が三台停まってたの'],
      ['リン', '先に言っとく。あんたが拾ったのは、チャーハンじゃない'],
    ], c: [{ t: '「じゃあ、何だ」', to: 'truth' }] },
    truth: { t: [
      ['リン', 'プロトコルよ。舌の端子から、脳に直接「実感」を書き込む規格。朗々飯店の料理長が、一皿のために作った'],
      ['リン', '味の実感を書き込めるなら、何だって書き込める。満腹も、安心も、忠誠も、購買意欲も'],
      ['リン', 'この街の人間は、みんな舌に端子を挿してる。つまりそのメモリは、ネオヨコハマ中の脳の、裏口の鍵ってわけ'],
      'グラスの氷が、からん、と鳴った。',
      ['リン', 'マンカンが欲しいのは味じゃない。書き込み権よ。朗々幇が欲しいのは、厨房の名誉。……売り先は、あたしが探してあげる'],
      'そのとき、店の扉が外から蹴破られた。',
    ], battle: { enc: 'raid', win: 'won', lose: 'lost' } },
    lost: { t: ['気がつくと、高架下のゴミ捨て場にいた。リンが、氷の入ったグラスをこちらの額に当てていた。', ['リン', '……生きてたわね。店はまだ連中に押さえられてる'] ], end: true, noDone: true },
    won: { fx: S => { S.flags.m6 = 1; S.wanted++; }, t: [
      'エージェントの襟章には、満の字を象った社章が光っていた。',
      ['リン', '見たでしょ。マンカンは本気よ。……データの中身を、ちゃんと確かめたい。値段を付けるには、それが要る'],
      ['リン', '横丁の奥に「紅楼」って店がある。紅姐なら、そのメモリを読める。あの人、昔は向こう側の人間だったから'],
      '手配度が上がった。',
    ], end: true } } },

  m7: { loc: 'noge', main: true, label: '紅楼でメモリを読む', sub: 'メインシナリオ。横丁の奥の工房へ', cond: S => S.flags.m6, nodes: {
    start: { t: [
      '紅楼は、看板だけが中華料理屋で、中身は端子の修理屋だった。壁一面に、抜き取られたメモリが標本のように並んでいる。',
      'カウンターの奥で、赤い長衣の女が煙管をふかしていた。',
      ['紅姐', 'リンから聞いてる。見せて。……ああ、あんたの端子、ずいぶん雑に使ってるわね'],
      '紅姐はメモリを読み取り機に挿し、画面を指でなぞった。',
      ['紅姐', '一層目はレシピと実感の記録。問題は、その下ね。暗号が三重。手伝える人、いる?'],
    ], check: { stat: 'tec', lo: 5, hi: 8, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['暗号は最後まで解けなかった。紅姐は煙管を置いた。', ['紅姐', '二層目に何かある。それだけは確か。人の形をした何かがね'] ], c: [{ t: '続ける', to: 'end' }] },
    o: { t: ['二重目までは開いた。画面に、意味をなさない文字列と、ひとつの署名が浮かんだ。「朗」。', ['紅姐', '料理長の署名ね。……ただのレシピに、署名なんて入れないわ'] ], c: [{ t: '続ける', to: 'end' }] },
    g: { fx: S => { S.flags.chefHint = 1; }, t: [
      '三重の暗号が、順番にほどけた。最後の層に、データとは呼べないものが眠っていた。',
      '波形。呼吸の周期に似た、ゆっくりとした波形。',
      ['紅姐', '……人格データの断片。料理長本人が、一皿の中に自分を残したのよ。眠ってるけど、死んではいない'],
      ['紅姐', 'これは、売り物にしちゃいけない種類のものかもしれないわね'],
    ], c: [{ t: '続ける', to: 'end' }] },
    end: { fx: S => { S.flags.m7 = 1; S.wanted++; }, t: [
      ['紅姐', '気に入ったわ、あんた。困ったら来なさい。治療代はツケでいいから'],
      '店を出ると、横丁の空気が変わっていた。客引きが一人もいない。マンカンの車が、大通りに列を作っている。',
      '手配度が上がった。',
    ], end: true } } },

  m8: { loc: 'noge', main: true, label: '大通りの製品回収', sub: 'メインシナリオ。マンカンの車列が並んでいる', cond: S => S.flags.m7, nodes: {
    start: { t: [
      '大通りの真ん中に、スーツの女が一人、拡声器を持って立っていた。背後にエージェントが並び、車のライトが逆光を作っている。',
      ['ツキミ部長', 'マンカン・ホールディングス品質保証部、ツキミです。弊社製品に重大な欠陥が見つかりましたので、自主回収にまいりました'],
      ['ツキミ部長', '回収対象は、プロトコルチャーハン・クラックスピード。および、その使用者の記憶の一部です。ご協力に感謝いたします'],
    ], battle: { enc: 'tsukimi', win: 'won', lose: 'lost' } },
    lost: { t: ['横丁の誰かに引きずられて、路地の奥に転がり込んだ。ツキミ部長の拡声器の声が、まだ大通りに響いている。'], end: true, noDone: true },
    won: { fx: S => { S.flags.m8 = 1; S.wanted++; }, t: [
      'ツキミ部長は拡声器を下ろし、スーツの埃を払った。',
      ['ツキミ部長', '……回収、失敗。報告書を書きます。弊社は、この件から手を引きません。次は、本社が出ます'],
      '車列が去ったあと、鳩の巣の扉が開いた。リンが、紙を三枚持っていた。',
      ['リン', '買い手がついたわ。一つ目はマンカン。言い値の十倍、命の保証つき。二つ目は朗々幇。金は少ないけど、厨房の跡地ごと店を返すって'],
      ['リン', '三つ目は、名前を出さない誰か。条件はひとつだけ。データを、街の全員に配ること'],
      ['リン', '返事は急がない。でも、どれを選んでも、もう引き返せない'],
      '手配度が上がった。',
          ], end: true } } },

  ninfo: { loc: 'noge', repeat: true, label: '情報屋に聞き込む', sub: '話術で成果が変わる。街が動くまでは3回が限度', cond: S => FREE(S) && (S.scav['noge' + S.wanted] || 0) < 3, nodes: {
    start: { fx: S => { S.scav['noge' + S.wanted] = (S.scav['noge' + S.wanted] || 0) + 1; }, t: ['高架下の立ち飲み屋では、ハイボール一杯の値段で、噂が一つ買える。'], check: { stat: 'talk', lo: 5, hi: 8, fail: 'f', ok: 'o', great: 'g' } },
    f: { fx: S => { S.credits += 20; }, t: ['噂は安物ばかりだった。釣り銭のほうが多かった。', '20crを手に入れた。'], end: true },
    o: { fx: S => { S.credits += 60; }, t: ['マンカンの巡回ルートの噂を、別の情報屋に転売した。', '60crを手に入れた。'], end: true },
    g: { fx: S => { S.credits += 60; give(S, mkInst(['adrenal', 'shock', 'netrun', 'armor'][Math.floor(Math.random() * 4)], null, null, true)); S.flags.lastInfo = 1; }, t: ['情報屋は、話の礼にと、どこかで抜いてきたメモリを一本よこした。', '60crとメモリを手に入れた。メニューの「持ち物」とPCバンで確認できる。'], end: true },
  } },

  farmNoge: { loc: 'noge', repeat: true, label: '回収班を狩る', sub: '何度でも戦える。企業の装備が手に入る', cond: FREE, nodes: {
    start: { t: ['路地の角を曲がると、満の字の襟章が二つ、こちらを向いた。'], battle: { enc: 'farmNoge', win: 'w', lose: 'l' } },
    w: { t: ['倒れたエージェントの端末が、本社への応援要請を途中まで打ちかけていた。'], end: true },
    l: { t: ['高架下の暗がりに逃げ込んだ。回収班は、横丁の奥までは入ってこない。'], end: true },
  } },

  hongjoin: { join: true, loc: 'noge', label: '紅楼の裏口', sub: '紅姐が、珍しく困った顔をしている', cond: S => S.flags.m7 && !member(S, 'hong') && !S.left.hong, nodes: {
    start: { t: [
      ['紅姐', 'ちょうどいいところに。うちの診療器具一式、酔ったネットランナーに持っていかれたの。裏口を出てすぐの路地にいるわ'],
      ['紅姐', 'あたしも行く。自分の道具は、自分で取り返す主義なのよ'],
    ], battle: { enc: 'redroom', win: 'w', lose: 'l' } },
    l: { t: ['紅姐に肩を貸されて、店に戻った。器具は、まだ取り返せていない。'], end: true, noDone: true },
    w: { fx: S => { join(S, 'hong'); rel(S, 'hong', 1); }, t: [
      '紅姐は器具の箱を抱え直し、煙管の灰を路地に落とした。',
      ['紅姐', '決めた。しばらく店は閉めて、あんたたちについていくわ。こんな連中を放っておいたら、うちの患者が増えるだけだもの'],
      '紅姐が仲間になった。',
    ], end: true } } },

  pedaljoin: { join: true, loc: 'noge', label: '暴走する自転車', sub: '線路沿いを、何かが猛スピードで走ってくる', cond: S => FREE(S) && !member(S, 'pedal') && !S.left.pedal, nodes: {
    start: { t: [
      '線路沿いの路地を、荷台に箱を積んだ自転車が突っ込んできた。乗っているのは小柄な女で、後ろからマンカンの回収班が追ってくる。',
      ['ペダル', 'どけっ! ……いや、どかなくていい! あんたら、喧嘩できる顔してんな!'],
      ['ペダル', '荷物を届けたら、届け先ごと回収班に目をつけられたんだよ! 届けたあとのことまで知るか!'],
    ], c: [{ t: '追っ手の前に立つ', sub: '戦う', to: 'fight' }, { t: '道を空ける', sub: '関わらない', to: 'pass' }] },
    pass: { t: ['自転車は風を残して走り去った。回収班も、その後を追っていった。', 'また来るかもしれない。この路地は、彼女の通り道らしい。'], end: true, noDone: true },
    fight: { battle: { enc: 'chase', win: 'w', lose: 'l' }, t: ['自転車が急ブレーキで止まり、女は荷台からチェーンを外して振り回した。'] },
    l: { t: ['自転車の後ろに引きずり上げられて、横丁を抜けた。気づけば、女の姿はなかった。'], end: true, noDone: true },
    w: { fx: S => { join(S, 'pedal'); rel(S, 'pedal', 1); }, t: [
      ['ペダル', 'へえ。やるじゃん。あたしはペダル。運び屋。届けられなかった荷物は、まだ一個もない'],
      ['ペダル', 'あんたのそのメモリ、噂になってるよ。……どこへ運ぶにしても、脚がいるだろ。乗せてってやる'],
      'ペダルが仲間になった。',
    ], end: true } } },

  wanjoin: { join: true, loc: 'noge', label: '立ち飲み屋の前の騒ぎ', sub: '朗々幇の刺青が、誰かを囲んでいる', cond: S => S.done.m3 && !member(S, 'wan') && !S.left.wan, nodes: {
    start: { t: [
      '立ち飲み屋の前で、刺青の男たちが大男を一人囲んでいた。用心棒のワンだった。顔に新しい傷がある。',
      ['制裁役', '厨房を守れなかった奴に、幇の刺青を背負う資格はねえ。皮ごと剥いでやる'],
      'ワンは抵抗していなかった。空の両手を、膝の上に置いていた。',
    ], c: [{ t: '割って入る', sub: '戦う', to: 'fight' }, { t: '見なかったことにする', sub: '関わらない', to: 'pass' }] },
    pass: { t: ['背中で、何かが倒れる音がした。振り返らなかった。', 'ワンは、まだ横丁のどこかにいるはずだ。'], end: true, noDone: true },
    fight: { t: ['ワンが顔を上げた。'], battle: { enc: 'wanfight', win: 'w', lose: 'l' } },
    l: { t: ['制裁役たちは、ワンを連れて引き上げていった。どこへ連れていかれたのかは分からない。また探す必要がある。'], end: true, noDone: true },
    w: { fx: S => { join(S, 'wan'); rel(S, 'wan', 1); }, t: [], dyn: S => [
      ['ワン', '……なぜ助けた。俺はお前を殺そうとした'],
      'チャンカーは答えなかった。ワンも、それ以上は聞かなかった。',
    ].concat(owns(S, 'wok') ? [['ワン', 'あの鍋は、お前が持っていろ。俺にはもう、重すぎる']] : [['ワン', '鍋は置いてきた。今の俺には、包丁一本で十分だ']]).concat([
      ['ワン', '幇には戻れん。……行く当てもない。お前の後ろを守らせてくれ。それくらいしか、できることがない'],
      'ワンが仲間になった。',
    ]), end: true } } },

  xiao1: { loc: 'noge', label: 'ジャンク屋の店先の配膳ロボ', sub: '片腕のないロボットが、客を待つ姿勢で立っている', cond: S => S.flags.sawRobot && S.flags.m6 && !S.flags.xiaoBought, nodes: {
    start: { t: [
      'ジャンク屋の店先に、片腕のない女性型の配膳ロボットが立っていた。部品取り、と書かれた札が首から下がっている。',
      '胸のプレートに、かすれた文字があった。「朗々飯店 ホール 小籠」。',
      ['小籠', 'いらっしゃいませ。申し訳ございません、ただいま左腕が欠品しておりまして、蓮華をお持ちできません'],
      'あの厨房跡で見た、布に包まれた腕を思い出した。指先に、蓮華を持つための溝があった。',
      ['ジャンク屋', '欲しけりゃ150crだ。どうせ来週にはバラす'],
    ], c: [{ t: '150crで買う', sub: '', to: 'buy', cond: S => S.credits >= 150 }, { t: '今は手持ちがない', sub: '150crが必要', to: 'no' }] },
    no: { t: ['小籠は、丁寧に頭を下げた。', ['小籠', 'またのお越しを、お待ちしております'] ], end: true, noDone: true },
    buy: { fx: S => { S.credits -= 150; S.flags.xiaoBought = 1; }, t: [
      ['小籠', 'お買い上げ、ありがとうございます。……あの、お客様。わたくしの左腕を、ご存じありませんか'],
      '朗々飯店の厨房跡に、まだあるはずだ。小籠はジャンク屋に預けたまま、取りに行くことにした。',
    ], end: true } } },
  xiao2: { loc: 'chinatown', scene: 'kitchen', label: '厨房跡の腕を取りに行く', sub: '火口の下の隠し棚に、布の包みがあった', cond: S => S.flags.xiaoBought && !S.flags.xiaoArm, nodes: {
    start: { fx: S => { S.flags.xiaoArm = 1; }, t: ['火口の下の隠し棚に、布の包みはまだあった。開くと、細い金属の腕が、蓮華を持つ形のまま眠っていた。', '誰かが、ずっとこれを捨てられずにいたのだ。'], end: true } } },
  xiao3: { join: true, loc: 'noge', label: '小籠に腕を届ける', sub: 'ジャンク屋で、小籠が待っている', cond: S => S.flags.xiaoArm && !member(S, 'xiao') && !S.left.xiao, nodes: {
    start: { fx: S => { join(S, 'xiao'); rel(S, 'xiao', 2); }, t: [
      '腕を差し込むと、小籠の肩の奥で、小さな駆動音がした。指が一本ずつ動き、最後に、何もない空中で蓮華を持つ形を作った。',
      ['小籠', '……ご来店、ありがとうございます。お客様。ご注文は、お決まりでしょうか'],
      ['小籠', '朗々飯店は閉店いたしました。ですが、わたくしの勤務は、まだ終わっておりません。お客様のお席に、ご一緒させてください'],
      '小籠(シャオロン)が仲間になった。',
    ], end: true } } },
};
const ROMEV2 = Object.assign({},
  romEvents('hong', {
    label: '紅姐と過ごす',
    s1: { sub: 'ねぐらに往診に来て、煙管をふかしている', t: [
      '紅姐は、勝手にねぐらのコンテナに上がり込み、こちらの舌の端子を覗いていた。',
      ['紅姐', 'ほら、また焼けてる。あんた、端子を雑に使いすぎ。人の体はジャンクじゃないのよ'],
      '細い工具が、端子の縁を一周した。ひりつく痛みのあとに、妙な涼しさが残った。',
    ], c: [['「助かる」', 1], ['「ジャンクで十分だ」', 1], ['黙って任せる', 2]],
      end: ['紅姐は煙管の先で、こちらの額を軽く叩いた。', ['紅姐', '次に焼いたら、治療代はツケじゃなくて現金よ'] ] },
    s2: { sub: 'ジャンク山の夜景を、一人で眺めている', t: [
      ['紅姐', 'あたし、昔はマンカンの医者だったの。社員の舌を「最適化」する仕事。会社の食事を、旨いと感じるようにね'],
      ['紅姐', '何百人分の舌を削ったか、もう数えてない。……辞めたのは、自分の舌が何も感じなくなった日よ'],
    ], cand: '「今は直してる。俺の舌も、紅姐が直した」', friend: '「腕のいい医者が仲間で、助かってる」',
      endC: ['紅姐は笑った。煙が、夜の中で長く伸びた。', ['紅姐', '……口説き文句としては、悪くないわね'] ], endF: [['紅姐', 'そう言ってもらえると、医者を続けた甲斐があるわ'] ] },
    s3: { sub: '赤い長衣のまま、こちらを待っている', t: [
      ['紅姐', '先に言っておくわ。あたし、一人に決める歳でもないし、誰かに決めさせる気もないの'],
      ['紅姐', 'それでもいいなら、隣にいてあげる。……いい? 「あげる」って言ってるのよ、あたしが'],
    ], lover: '「それでもいい」', partner: '「相棒として、頼りにしてる」', wait: '「少し、考えさせてくれ」',
      endL: ['紅姐は煙管を置き、こちらの襟を指で直した。', ['紅姐', 'よろしい。今日から、あんたの体はあたしの管轄よ'] ],
      endP: [['紅姐', '相棒、ね。いいわ。あんたの背中の傷は、全部あたしが縫ってあげる'] ], endW: [['紅姐', 'いつまでも待つ女じゃないけど、今日のところは待ってあげる'] ] },
    back: { t: ['紅楼のシャッターが、半分だけ開いていた。中から、煙管の匂いがする。'], yes: [['紅姐', 'あら。謝れる男、嫌いじゃないわ'] ] },
  }),
  romEvents('pedal', {
    label: 'ペダルと過ごす',
    s1: { sub: '自転車のチェーンに油を差している', t: [
      'ペダルは、ねぐらの前で自転車をひっくり返し、チェーンに油を差していた。',
      ['ペダル', 'あたしさ、届けられなかった荷物、一個もないんだよ。届け先が死んでても、墓に置いてくる'],
      ['ペダル', '……なに見てんだよ。手伝う気がないなら、そこの工具取って'],
    ], c: [['工具を渡す', 1], ['「墓に置いてくるのは、届けたうちに入るのか」', 2], ['「すごいな」', 1]],
      end: ['ペダルはチェーンを回して、音を確かめた。', ['ペダル', '入るに決まってんだろ。受け取りのサインは、風がしてくれる'] ] },
    s2: { sub: 'コンテナの上で、星のない空を見ている', t: [
      ['ペダル', 'あたし、住所ってもんを持ったことがないんだ。生まれたのは輸送船で、育ったのは貨物列車'],
      ['ペダル', 'だから人の家に荷物を届けると、ちょっとだけ、その家の子になった気がすんの。……笑うなよ'],
    ], cand: '「ここを、お前の届け先にしろ」', friend: '「お前の脚は、この街で一番信用できる」',
      endC: ['ペダルは何か言い返そうとして、言葉に詰まった。そのまま、コンテナから飛び降りて、自転車で走り去った。', '耳まで赤かった気がした。'], endF: [['ペダル', 'へへ。当たり前だろ'] ] },
    s3: { sub: '自転車を停めて、待っている', t: [
      ['ペダル', 'あたし、配達先は一件ずつしか回らない主義なんだよ。掛け持ちすると、どっちかが雑になるから'],
      ['ペダル', '……で。あんたのとこ、届けていい? 何をって、聞くなよ'],
    ], lover: '「届けてくれ」', partner: '「相棒として、毎回受け取る」', wait: '「まだ、受け取れない」',
      endL: ['ペダルは自転車のベルを、一回だけ鳴らした。', ['ペダル', '配達完了。……受け取りのサイン、ちょうだい'] ],
      endP: [['ペダル', '相棒か。悪くないね。荷台はいつでも空けとく'] ], endW: [['ペダル', 'ちっ。じゃあ再配達な。今度は、ちゃんと家にいろよ'] ] },
    back: { t: ['線路沿いの路地で、パンクした自転車の横に、小柄な女が座りこんでいた。'], yes: [['ペダル', '……遅えよ。でもまあ、受け取ってやる'] ] },
  }),
  romEvents('wan', {
    label: 'ワンと過ごす',
    s1: { sub: '空の鉄鍋を振っている', t: [
      'ワンは、ねぐらの前で空の鍋を振っていた。中身はない。手首の返しだけが、正確だった。',
      ['ワン', '朗々飯店では、厨房に入れてもらえなかった。俺の仕事は、扉の前に立つことだった'],
      ['ワン', 'だが、毎晩見ていた。だから腕は、覚えている'],
    ], c: [['「何か作ってみろ」', 2], ['「重くないのか」', 1], ['黙って見ている', 1]],
      end: ['ワンは、ジャンク山で拾った卵と冷や飯で、炒飯を作った。焦げていて、塩辛くて、米が潰れていた。', ['ワン', '……まずいな'], '二人とも、最後まで食べた。'] },
    s2: { sub: '包丁を研いでいる', t: [
      ['ワン', '子供の頃、腹を空かせて朗々飯店の裏口に座っていた。料理長が、皿を一枚よこした。あのチャーハンだった'],
      ['ワン', '俺は、あの一皿の恩を返すために用心棒になった。……結局、店は守れなかった'],
    ], cand: '「お前の鍋で、いつか本物を食わせてくれ」', friend: '「その腕、今は俺たちのために振ってくれ」',
      endC: ['ワンは研ぐ手を止めて、長い間こちらを見ていた。', ['ワン', '……約束は、苦手だ。だが、努力はする'] ], endF: [['ワン', '承知した'] ] },
    s3: { sub: '湯気の立つ皿を持って、待っている', t: [
      'ワンが皿を一枚、こちらの前に置いた。炒飯だった。今度は焦げていなかった。',
      ['ワン', '俺は口が下手だ。だから、鍋で言う'],
    ], lover: '「毎日、これを食いたい」', partner: '「最高の用心棒だ」', wait: '「……まだ、腹が決まらない」',
      endL: ['ワンは何も言わなかった。ただ、大きな手で、こちらの皿にもう一杯よそった。', ['ワン', '……毎日、作る'] ],
      endP: [['ワン', '用心棒か。……今度こそ、守り切る'] ], endW: [['ワン', '腹が決まるまで、作り続ける'] ] },
    back: { t: ['善隣門の下で、大男が一人、空の鍋を膝に抱えて座っていた。'], yes: ['ワンは何も言わず、鍋を一つ差し出した。それで十分だった。'] },
  }),
  romEvents('xiao', {
    label: '小籠と過ごす',
    s1: { sub: 'ねぐらに、拾った板でテーブルを作っている', t: [
      '小籠は、ジャンク山の板と脚で、ねぐらの前にテーブルを一つ組み上げていた。クロスまで掛かっている。',
      ['小籠', 'お席のご用意ができました。お客様、どうぞ'],
      '湯呑みの中身は空だった。小籠は、それを丁寧に差し出した。',
    ], c: [['座る', 2], ['「客はいないぞ」', 1], ['「ありがとう」', 1]],
      end: ['小籠は空の急須を傾けて、空の湯呑みにお茶を注ぐ仕草をした。', ['小籠', 'ごゆっくり、どうぞ'] ] },
    s2: { sub: 'テーブルを、何度も拭き直している', t: [
      ['小籠', 'わたくしの記録には、欠落がございます。閉店の夜、最後のお客様のお顔が、思い出せないのです'],
      ['小籠', 'お見送りをしなかったお客様がいる。それが、ずっと、気がかりで'],
    ], cand: '「最後の客は、俺でいい」', friend: '「一緒に、思い出そう」',
      endC: ['小籠は布巾を持つ手を止めた。駆動音が、ほんの少しだけ高くなった。', ['小籠', '……かしこまりました。記録を、上書きいたします'] ], endF: [['小籠', 'ありがとうございます。お客様は、やさしいお客様です'] ] },
    s3: { sub: '予約台帳を手に、待っている', t: [
      ['小籠', 'お客様。わたくし、ご予約を一件、お受けしてもよろしいでしょうか'],
      ['小籠', 'ご予約のお時間は、いつまででも。お席は、何席ご用意しても構いません。朗々飯店は、すべてのお客様を平等におもてなしいたしますので'],
    ], lover: '「予約する」', partner: '「常連として、通う」', wait: '「まだ、決めていない」',
      endL: ['小籠は予約台帳に、こちらの名前を書いた。チャンカー、と。', ['小籠', 'ご予約、承りました。いつまでも、お待ちしております'] ],
      endP: [['小籠', '常連様。かしこまりました。お席は、いつでも空けておきます'] ], endW: [['小籠', 'お決まりになりましたら、お呼びくださいませ'] ] },
    back: { t: ['ジャンク屋の店先に、配膳ロボットが一体、客を待つ姿勢で立っていた。'], yes: [['小籠', 'おかえりなさいませ'] ] },
  })
);

/* ---------- 寄り道(第一章・第二章) ---------- */
const rndMem = (list) => mkInst(list[Math.floor(Math.random() * list.length)], null, null, true);
const partyRel = (S, n) => S.party.forEach(id => { if (id !== 'hero') rel(S, id, n); });
const HINTS = [
  '「雷は、ガラクタと火花から生まれる」',
  '「影と銃身を重ねると、死神が囁く」',
  '「医者と吸血鬼は、案外気が合う」',
  '「騎士に鎧を着せれば、城が建つ」',
  '「飢えと硝子は、最後の晩餐を呼ぶ」',
  '「同じものを二つ重ねれば、一つ上のものになる。人も、メモリも」',
];
const SIDE = {
  fish: { loc: 'pier', repeat: true, label: '湾で釣りをする', sub: '観察で釣果が変わる。街が動くまでは2回が限度', cond: S => S.flags.pro && (S.scav['fish' + S.wanted] || 0) < 2, nodes: {
    start: { fx: S => { S.scav['fish' + S.wanted] = (S.scav['fish' + S.wanted] || 0) + 1; }, t: ['岸壁から、配線を束ねた釣り糸を垂らした。湾の水は、油と電飾を映して七色に光っている。'], check: { stat: 'obs', lo: 4, hi: 7, fail: 'f', ok: 'o', great: 'g' } },
    f: { fx: S => { S.credits += 5; }, t: ['長靴が釣れた。左足だけだった。', 'ジャンクとして5crで売れた。'], end: true },
    o: { fx: S => { S.credits += 35; }, t: ['目が三つあるサバが釣れた。湾ではよくあることだ。屋台に売ると、刺身にすると言っていた。', '35crを手に入れた。'], end: true },
    g: { fx: S => { give(S, rndMem(S.wanted >= 6 && Math.random() < 0.3 ? ['hungry', 'glass'] : ['knuckle', 'smoke', 'leech', 'baton'])); }, t: ['糸の先に、防水袋が引っかかっていた。誰かが沈めた密輸品だ。中にメモリが一本、乾いたまま入っていた。', 'メモリを手に入れた。'], end: true },
  } },
  jirofav: { loc: 'pier', label: 'ジローの頼みごと', sub: '故買屋が、冷蔵庫を運ぶ人手を探している', cond: FREE, nodes: {
    start: { t: [['ジロー', 'ジャンク山の中腹に、業務用の冷蔵庫が埋まってる。三百年もののやつだ。店まで運んでくれりゃ、礼はする'], '冷蔵庫は、瓦礫に半分埋まっていた。'], check: { stat: 'pow', lo: 4, hi: 7, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['冷蔵庫はびくともしなかった。もっと腕力のある誰かが要る。'], end: true, noDone: true },
    o: { fx: S => { S.credits += 40; S.flags.jiroFav = 1; }, t: ['冷蔵庫を店まで引きずってきた。ジローは扉を開けて、中の霜を舐めた。', ['ジロー', '……昭和の霜だ。恩に着る。今後、道具は二割引きにしてやる'], '40crを手に入れた。万屋ジローの道具が二割引きになった。'], end: true },
    g: { fx: S => { S.credits += 40; S.flags.jiroFav = 1; give(S, mkInst('knuckle', 2, null, true)); }, t: ['冷蔵庫を担いで、そのまま店まで歩いた。ジローは口を開けたまま、しばらく閉じなかった。', ['ジロー', '……お前、人間か? 礼だ。こいつも持ってけ。拳の強い奴に似合う'], '40crと特注品の「鉄拳ナックル」を手に入れた。万屋ジローの道具が二割引きになった。'], end: true },
  } },
  fortune: { loc: 'chinatown', repeat: true, label: '占い屋台', sub: '20crで占ってもらう。街が動くまでは1回', cond: S => FREE(S) && (S.scav['fort' + S.wanted] || 0) < 1, nodes: {
    start: { t: ['門の脇に、筮竹の代わりに古い基板を束ねて振る占い師がいた。', ['占い師', '20cr。お代は先にもらうよ。未来は後払いが利かないからね']], c: [{ t: '占ってもらう', sub: '20cr', to: 'go', cond: S => S.credits >= 20 }, { t: 'やめておく', sub: '', to: 'no' }] },
    no: { t: ['占い師は肩をすくめて、基板を振り続けた。'], end: true, noDone: true },
    go: { fx: S => { S.credits -= 20; S.scav['fort' + S.wanted] = 1; S.fortuneN = (S.fortuneN || 0) + 1;
        if (S.wanted >= 11 && !S.flags.bh && !S.flags.bhFort) { S.flags.bhFort = 1; S.flags.bhRumor = 1; S._fort = '黒い皿が見える。重すぎて、量りが壊れている。……量り売りの闇屋で、重さごと買うんだね。それから、この街でいちばん重い井戸の底で、混ぜること'; }
        else S._fort = HINTS[(S.fortuneN - 1) % HINTS.length].slice(1, -1); },
      t: [], dyn: S => ['基板が、からからと乾いた音を立てた。', ['占い師', '出たよ。……' + (S._fort || HINTS[0].slice(1, -1))], '意味は分からなかった。占いとは、だいたいそういうものだ。'], end: true },
  } },
  mahjong: { loc: 'chinatown', repeat: true, label: '朗々幇の雀荘', sub: '観察で相手の癖を読む。街が動くまでは1回', cond: S => FREE(S) && (S.scav['mj' + S.wanted] || 0) < 1, nodes: {
    start: { fx: S => { S.scav['mj' + S.wanted] = 1; }, t: ['裏通りの雀荘では、牌が全部電子ペーパーでできている。表示を書き換えるイカサマは、ここでは礼儀の一部だ。', '勝つ方法は一つ。相手の指の癖を読むこと。'], check: { stat: 'obs', lo: 5, hi: 8, fail: 'f', ok: 'o', great: 'g' } },
    f: { fx: S => { S.credits = Math.max(0, S.credits - 30); }, t: ['三局で、全部の癖を読まれたのはこちらだった。', '30crを失った。'], end: true },
    o: { fx: S => { S.credits += 70; }, t: ['対面の男は、聴牌すると左の小指が震える。それだけ分かれば十分だった。', '70crを手に入れた。'], end: true },
    g: { fx: S => { S.credits += 120; if (!S.flags.mjPrize) { S.flags.mjPrize = 1; give(S, mkInst('hungry', 1, null, true)); } }, t: [], dyn: S => ['卓の全員の癖を読み切った。最後の一局、親が役満を張っているのも見えていた。', '120crを手に入れた。'].concat(S.flags.mjPrize === 1 && !S.flags.mjShown ? (S.flags.mjShown = 1, [['雀荘の主人', '負けた奴の担保だ。持ってけ。こいつを挿した奴は、腹が減るほど強くなる'], '「空腹ドライブ」を手に入れた。']) : []), end: true },
  } },
  karaoke: { loc: 'noge', repeat: true, label: 'スナック「止まり木」', sub: '仲間とカラオケ。話術で盛り上がりが変わる。街が動くまでは1回', cond: S => FREE(S) && (S.scav['kara' + S.wanted] || 0) < 1, nodes: {
    start: { fx: S => { S.scav['kara' + S.wanted] = 1; }, t: [], dyn: S => ['スナック「止まり木」のママは、客の顔を見ずにマイクを渡す。', party(S).length > 1 ? `${party(S).filter(u => u.id !== 'hero').map(u => u.name).join('、')}も、狭いボックス席に押し込まれた。` : '今夜は一人だった。ママは二本目のマイクを、黙って引っ込めた。', '曲目は、全部二百年前の歌謡曲だった。'], check: { stat: 'talk', lo: 4, hi: 7, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['歌い出しを三回外した。ボックス席は、気まずい沈黙で満たされた。それもまた、思い出ではある。'], end: true },
    o: { fx: S => partyRel(S, 1), t: ['サビで全員の声が揃った。誰が言い出したわけでもなく、二曲目が入った。', '同行している仲間との仲が深まった。'], end: true },
    g: { fx: S => { partyRel(S, 1); S.credits += 50; }, t: ['間奏で入れた合いの手に、ママが初めて顔を上げた。', ['ママ', 'あんたたち、いいわね。これ、おひねり'], '同行している仲間との仲が深まった。50crを手に入れた。'], end: true },
  } },
  poet1: { loc: 'noge', label: '泣いている酔っ払い', sub: '立ち飲み屋の前で、男が詩を探している', cond: FREE, nodes: {
    start: { t: [
      '立ち飲み屋の前で、ベレー帽の男が泣いていた。',
      ['ボードレール田中', 'わが詩が……わが生涯の詩が、湾に落ちたのだ。舌の端子から抜いて、推敲しようとした、その瞬間に'],
      ['ボードレール田中', 'メモリだ。たぶんコンテナ埠頭の、潮の溜まるあたりに流れ着いている。探してくれたら、礼をしよう。詩人の礼だが'],
    ], c: [{ t: '探してやる', sub: '', to: 'y' }, { t: '断る', sub: '', to: 'n' }] },
    n: { t: ['男は、また泣き始めた。'], end: true, noDone: true },
    y: { fx: S => { S.flags.poet = 1; }, t: ['コンテナ埠頭の潮溜まりを探すことになった。'], end: true },
  } },
  poet2: { loc: 'pier', label: '潮溜まりで詩を探す', sub: 'ボードレール田中のメモリを探す', cond: S => S.flags.poet === 1, nodes: {
    start: { t: ['潮溜まりには、毎日数百本のメモリが流れ着く。その一本を見つけるには、目が要る。'], check: { stat: 'obs', lo: 5, hi: 8, fail: 'f', ok: 'o', great: 'o' } },
    f: { t: ['見つからなかった。日を改めるか、目の利く誰かを連れてこよう。'], end: true, noDone: true },
    o: { fx: S => { S.flags.poet = 2; }, t: ['ラベルに手書きで「詩」とだけ書かれたメモリが、空き缶の中に挟まっていた。'], end: true },
  } },
  poet3: { loc: 'noge', label: 'ボードレール田中に詩を返す', sub: '立ち飲み屋で待っている', cond: S => S.flags.poet === 2, nodes: {
    start: { fx: S => { S.flags.poet = 3; give(S, mkInst('poem', 4, [{ k: 'tec', v: 4 }, { k: 'seep', v: 35 }, { k: 'hp', v: 15 }, { k: 'cool', v: -10 }], true)); }, t: [
      'ボードレール田中は、メモリを両手で受け取り、舌の端子に当てた。長い間、目を閉じていた。',
      ['ボードレール田中', '……ひどい詩だ。推敲が要る'],
      ['ボードレール田中', 'だが、礼は礼だ。これは写しだ。詩とは、他人の舌の上で完成するものだからな'],
      '一点物の「酔いどれ詩人.txt」を手に入れた。',
    ], end: true } } },
};

/* ---------- 第三章: 三つの買い手 ---------- */
const CH3 = {
  m9: { loc: 'noge', scene: 'bar', main: true, label: '鳩の巣で段取りを聞く', sub: 'メインシナリオ。リンが三つの面会を取り付けた', cond: S => S.flags.m8, nodes: {
    start: { fx: S => { S.flags.m9 = 1; }, t: [
      ['リン', '三件とも、会うだけは会ってきなさい。顔を見ないで売る相手を決めるブローカーは、三流よ'],
      ['リン', 'マンカンはカンナイ・アーコロジーの本社。朗々幇は中華街跡で幇主が待ってる。名無しの買い手は、ミナトミライの止まった観覧車の下'],
      ['リン', 'それから、もうひとつ。……ネオ・トーキョーの第七ゲートの裏に、ラーメン屋がある。行ってみなさい。値段の付け方が、少し変わるかもしれない'],
    ], end: true } } },

  m10a: { loc: 'kannai', main: true, label: 'マンカン本社の応接室', sub: 'メインシナリオ。最初の買い手', cond: S => S.flags.m9, nodes: {
    start: { t: [
      'カンナイ・アーコロジーは、空に向かって伸びる一本の巨大な厨房である。上層に役員室、中層に社員寮、下層に工場。全階層の換気口から、同じ合成出汁の匂いがする。',
      '応接室の窓からは、社員食堂が見下ろせた。千人の社員が、同じ灰色の粥を、同じ速度で食べている。全員が、とても幸せそうだった。',
      ['ミドウ常務', 'ようこそ。彼らの舌は最適化済みです。我が社の粥を、世界一の美食と感じるように'],
      ['ミドウ常務', 'あなたのデータがあれば、この最適化を、端子を持つ全市民に、一晩で配信できる。飢えも不満も、実感の上では消えるのです。報酬は、言い値の十倍'],
    ], dyn: null, c: [{ t: '「考えておく」', to: 'end' }, { t: '「あの粥、旨いのか」', to: 'q' }] },
    q: { t: [['ミドウ常務', '旨い、と感じます。それ以上の何が必要ですか'], '常務は、本当に分からないという顔をした。'], c: [{ t: '「考えておく」', to: 'end' }] },
    end: { fx: S => { S.flags.m10a = 1; S.wanted++; }, t: [], dyn: S => (member(S, 'hong') && S.party.includes('hong') ? [['紅姐', '……あの食堂の舌、半分はあたしが削ったのよ'], '紅姐は、窓の外を見なかった。'] : []).concat(['応接室を出ると、エレベーターの階数表示に、ひとつだけ番号のない階があった。地下の金庫室らしい。', '手配度が上がった。']), end: true } } },
  vaultq: { loc: 'kannai', label: '地下金庫を覗く', sub: '番号のない階。警備は厚い', cond: S => S.flags.m10a && !S.flags.vault, nodes: {
    start: { t: ['エレベーターの操作盤をこじ開けると、番号のない階のボタンが光った。扉が開くと、警備セントリーが首をもたげた。'], battle: { enc: 'vault', win: 'w', lose: 'l' } },
    l: { t: ['非常階段を三十階分駆け上がって、なんとか外に出た。'], end: true, noDone: true },
    w: { fx: S => { S.flags.vault = 1; S.credits += 300; give(S, mkInst('glass', 3, null, true)); }, t: ['金庫室の中身は、現金ではなかった。社員の「最適化前」の味覚データが、棚一面に保管されていた。数千人分の、失われた好き嫌い。', '持ち出せたのは、隅にあった禁制品の「ガラスの大砲」と、300crだけだった。'], end: true } } },
  canteen: { loc: 'kannai', label: '社員食堂に潜入する', sub: '話術で社員に紛れ込む', cond: FREE, nodes: {
    start: { t: ['社員証のない人間が食堂に入る方法は一つ。堂々としていること。'], check: { stat: 'talk', lo: 5, hi: 8, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['入口で警備員に止められた。「最適化証明書を」。持っていないものは見せられない。'], end: true, noDone: true },
    o: { fx: S => { S.credits += 80; }, t: ['灰色の粥を一口だけ食べた。何の味もしなかった。隣の社員は、泣きそうな顔で「旨い」と言った。', '帰り際、誰かが落とした食券を拾った。換金すると80crになった。'], end: true },
    g: { fx: S => { S.credits += 80; S.items.gel += 2; }, t: ['灰色の粥を一口だけ食べた。何の味もしなかった。隣の社員は、泣きそうな顔で「旨い」と言った。', '社員の一人が、こっそり袖を引いた。「外の人でしょう。……チャーハンって、どんな味ですか」。答えると、その人は修復ジェルを二本くれた。医務室からくすねたものらしい。', '80crと修復ジェル2本を手に入れた。'], end: true } } },
  farmKannai: { loc: 'kannai', repeat: true, label: '搬入口の警備網を抜ける', sub: '何度でも戦える。手強い', cond: FREE, nodes: {
    start: { t: ['搬入口のシャッターが、こちらに気づいて半分だけ開いた。'], battle: { enc: 'farmKannai', win: 'w', lose: 'l' } },
    w: { t: ['警備網に、一時的な穴が開いた。'], end: true }, l: { t: ['排気ダクトを伝って逃げた。'], end: true } } },

  m10b: { loc: 'chinatown', main: true, label: '朗々幇の幇主に会う', sub: 'メインシナリオ。二つ目の買い手', cond: S => S.flags.m9, nodes: {
    start: { t: [], dyn: S => [
      '幇主が待つと指定された場所は、善隣門の手前の、粥の屋台だった。',
      '老婆が、客の顔を見ずに椀を出した。',
    ].concat(S.done.granny ? [['老婆', '二度目だね。粥は旨かっただろう']] : [['老婆', '座りな']]).concat([
      ['幇主', '朗々幇の幇主をやってる。名前は捨てた。あの厨房で三十年、皿を洗った女さ'],
      ['幇主', 'マンカンは金をくれる。うちは店をくれる。厨房の跡地と、朗々飯店の看板。幇の名前で、もう一度あの店を開ける'],
      ['幇主', 'ただし、幇の店だ。厨房の外では、幇のやり方で商売をする。それでいいならね'],
    ]), c: [{ t: '「考えておく」', to: 'end' }] },
    end: { fx: S => { S.flags.m10b = 1; S.wanted++; }, t: [], dyn: S => (S.party.includes('wan') ? [['ワン', '……幇主'], ['幇主', 'ワン。いい顔になったね'], 'それだけだった。'] : []).concat(['手配度が上がった。']), end: true } } },

  m10c: { loc: 'minato', main: true, label: '観覧車の下の集会', sub: 'メインシナリオ。名前を出さない買い手', cond: S => S.flags.m9, nodes: {
    start: { t: [
      'ミナトミライ廃園の観覧車は、百年前に止まったまま、海風に軋んでいる。その足元に、数百人が集まっていた。',
      '全員、痩せていた。手には、ホログラムの焼き鳥や、光でできたケーキの箱を持っている。召し上がった気分だけを、確実に届ける食べ物。',
      '集会の真ん中で、細身の人物がマイクを握っていた。性別も年齢も、照明の加減で変わって見えた。',
      ['ゼロカロリー', '空腹同盟のゼロカロリー。あだ名だよ。ここにいるのは全員、本物を食べたことがない'],
      ['ゼロカロリー', 'そのデータを、街の全員に配りたい。一回でいい。本物の実感を、みんなに一回だけ。それで何が変わるかは、知らない。でも、知らないまま死ぬよりいい'],
      '観覧車の照明が、一斉に消えた。暗がりから、満の字の襟章が近づいてくる。',
    ], battle: { enc: 'minraid', win: 'won', lose: 'lost' } },
    lost: { t: ['集会は散り散りになった。ゼロカロリーの声が、どこかでまだ人を集めている。'], end: true, noDone: true },
    won: { fx: S => { S.flags.m10c = 1; S.wanted++; }, t: [
      ['ゼロカロリー', '……ありがと。こっちから払えるものは、何もないんだけど'],
      ['ゼロカロリー', 'あ、ひとつある。ついていっていい? 配るにしても配らないにしても、そのデータの行き先、見届けたいんだ'],
    ], c: [{ t: '「来い」', sub: 'ゼロカロリーが仲間になる', to: 'join' }, { t: '「ここで待ってろ」', sub: '', to: 'stay' }] },
    join: { fx: S => { join(S, 'zero'); rel(S, 'zero', 1); }, t: ['ゼロカロリーが仲間になった。', '手配度が上がった。'], end: true },
    stay: { fx: S => { S.flags.zeroWait = 1; }, t: [['ゼロカロリー', 'わかった。観覧車の下にいるよ。気が変わったら呼んで'], '手配度が上がった。'], end: true } } },
  zerojoin: { join: true, loc: 'minato', label: 'ゼロカロリーを迎えに行く', sub: '観覧車の下で、まだ待っている', cond: S => S.flags.zeroWait && !member(S, 'zero') && !S.left.zero, nodes: {
    start: { fx: S => { join(S, 'zero'); rel(S, 'zero', 1); S.flags.zeroWait = 0; }, t: [['ゼロカロリー', '来ると思ってた。……嘘。ちょっとだけ思ってた'], 'ゼロカロリーが仲間になった。'], end: true } } },
  wheel: { loc: 'minato', label: '止まった観覧車に登る', sub: '腕力で鉄骨をよじ登る', cond: FREE, nodes: {
    start: { t: ['観覧車の鉄骨は、百年分の潮風で錆びている。頂上のゴンドラに、何かが引っかかっているのが見えた。'], check: { stat: 'pow', lo: 5, hi: 8, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['三分の一で手が滑った。降りるほうが、登るよりずっと怖かった。'], end: true, noDone: true },
    o: { fx: S => { S.credits += 120; }, t: ['頂上のゴンドラには、百年前の誰かのデート用バスケットが残っていた。中身は化石化していたが、バスケット自体が骨董として売れた。', '120crを手に入れた。'], end: true },
    g: { fx: S => { S.credits += 120; partyRel(S, 1); }, t: ['頂上のゴンドラに、仲間を一人ずつ引き上げた。ネオヨコハマの夜景が、足元に全部あった。', '誰も、しばらく何も言わなかった。', '120crを手に入れた。同行している仲間との仲が深まった。'], end: true } } },
  arena: { loc: 'minato', repeat: true, label: '地下闘技場', sub: 'ランク戦。勝ち上がるほど強敵と賞品', cond: FREE, nodes: {
    start: { t: [], dyn: S => ['観覧車の真下、旧遊園地の機械室が、地下闘技場になっている。', ['受付', `あんたのランクは${['挑戦者', '第三ランク', '第二ランク', '王者'][S.arena || 0]}だ。どれに出る?`]], c: [
      { t: '第三ランク: ナックル兄弟', sub: '', to: 'a1' },
      { t: '第二ランク: 元警備員とセントリー', sub: '第三ランクを勝ち抜くと出られる', to: 'a2', cond: S => (S.arena || 0) >= 1 },
      { t: '王座戦: 王者グラスジョー', sub: '第二ランクを勝ち抜くと出られる。王者は一点物を挿している', to: 'a3', cond: S => (S.arena || 0) >= 2 },
      { t: 'やめておく', sub: '', to: 'no' }] },
    no: { t: ['観客の怒号を背に、機械室を出た。'], end: true },
    a1: { t: ['リングに上がった。'], battle: { enc: 'arena1', win: 'w1', lose: 'l' } },
    a2: { t: ['リングに上がった。'], battle: { enc: 'arena2', win: 'w2', lose: 'l' } },
    a3: { t: ['リングに上がった。王者は、ガラスの顎を撫でて笑った。'], battle: { enc: 'arena3', win: 'w3', lose: 'l' } },
    l: { t: ['リングの外に放り出された。観客は、すでに次の試合に賭けていた。'], end: true },
    w1: { fx: S => { if (!(S.arena >= 1)) { S.arena = 1; give(S, mkInst('knuckle', 3, null, true)); S._ar = 1; } else S._ar = 0; }, t: [], dyn: S => ['観客が沸いた。'].concat(S._ar ? ['第三ランクを勝ち抜いた。賞品として禁制品の「鉄拳ナックル」を手に入れた。'] : ['ファイトマネーを受け取った。']), end: true },
    w2: { fx: S => { if (!(S.arena >= 2)) { S.arena = 2; give(S, mkInst('baton', 3, null, true)); S._ar = 1; } else S._ar = 0; }, t: [], dyn: S => ['観客が沸いた。'].concat(S._ar ? ['第二ランクを勝ち抜いた。賞品として禁制品の「スタン警棒」を手に入れた。'] : ['ファイトマネーを受け取った。']), end: true },
    w3: { fx: S => { if (!(S.arena >= 3)) { S.arena = 3; S._ar = 1; } else S._ar = 0; }, t: [], dyn: S => ['王者グラスジョーは、割れた顎を押さえて笑った。', ['王者グラスジョー', 'いい拳だ。王座は貸しておく'], S._ar ? '王者になった。地下闘技場のランクは「王者」になった。' : '王座を防衛した。'], end: true } } },

  m11: { loc: 'noge', scene: 'bar', main: true, label: '鳩の巣で返事をする', sub: 'メインシナリオ。売り先を決める', cond: S => S.flags.m10a && S.flags.m10b && S.flags.m10c, nodes: {
    start: { t: [
      'リンは、紙を三枚、カウンターに並べた。',
      ['リン', '会ってきたわね。じゃあ、聞くわ。どこに売る?'],
    ], c: [
      { t: 'マンカンに売る', sub: '大金と命の保証。街の全員の舌が、同じ粥を旨いと感じるようになる', to: 'corp' },
      { t: '朗々幇と組む', sub: '朗々飯店の看板が戻る。ただし幇の店として', to: 'gang' },
      { t: '空腹同盟に託す', sub: '街の全員に、一度だけ本物の実感を配る', to: 'union' },
      { t: '誰にも売らない。料理長を起こす', sub: 'メモリの底に眠る人に、決めてもらう', to: 'chef', cond: S => S.flags.chefHint && (member(S, 'xiao') || member(S, 'wan')) },
    ] },
    corp: { fx: S => { S.route = 'corp'; S.flags.m11 = 1; S.wanted++; }, t: [['リン', '賢い選択よ。少なくとも、生き残るという意味ではね'], 'リンはマンカン宛ての紙だけを残して、残りを灰皿で燃やした。', '受け渡しは、カンナイ・アーコロジーの最上階。', '手配度が上がった。'], end: true },
    gang: { fx: S => { S.route = 'gang'; S.flags.m11 = 1; S.wanted++; }, t: [['リン', '店を取るのね。あんたらしいわ'], '受け渡しは、旧中華街跡の善隣門。幇主が、看板を用意して待っている。', '手配度が上がった。'], end: true },
    union: { fx: S => { S.route = 'union'; S.flags.m11 = 1; S.wanted++; }, t: [['リン', '……ブローカー泣かせね。手数料はゼロ。でも、嫌いじゃない'], '配信は、ミナトミライの観覧車の頂上から。街で一番高い、止まったアンテナ。', '手配度が上がった。'], end: true },
    chef: { fx: S => { S.route = 'chef'; S.flags.m11 = 1; S.wanted++; }, t: [['リン', '……売り物を、売らない。ブローカーに言う台詞じゃないわね'], ['リン', 'いいわ。紙は三枚とも燃やす。その代わり、起きた料理長に、あたしの分の一皿も頼んでおいて'], '料理長を起こすには、朗々飯店の厨房が要る。旧中華街跡の、焼け残った骨組みへ。', '手配度が上がった。'], end: true } } },
  m12: { main: true, label: '受け渡し', sub: 'メインシナリオ。選んだ道の先へ', locf: S => ({ corp: 'kannai', gang: 'chinatown', union: 'minato', chef: 'chinatown' })[S.route], cond: S => S.flags.m11, nodes: {
    start: { t: [], dyn: S => ({
      corp: ['カンナイ・アーコロジーの最上階。ミドウ常務が、契約書と、空の皿を一枚用意して待っていた。', ['ミドウ常務', 'データを受け取りました。……では、契約の第二条を履行します。データの使用者の記憶も、製品の一部として回収いたします'], '床が割れ、三階建ての鉄の脚が立ち上がった。'],
      gang: ['善隣門の下に、朗々飯店の看板が立てかけてあった。幇主が、その前で椀を持って待っていた。', '看板に手をかけた瞬間、門の向こうの更地が、地響きとともに割れた。', ['ミドウ常務(拡声器)', '朗々幇との取引は、弊社の競争法務上、看過できません。看板ごと回収します']],
      union: ['観覧車の頂上のゴンドラに、ゼロカロリーが配信機材を組んでいた。眼下には、ホログラムの食べ物を持った数千人。', '配信ボタンに指をかけた瞬間、観覧車の足元に、鉄の脚が立った。', ['ミドウ常務(拡声器)', '無断配信は、弊社の知的財産の侵害です。観覧車ごと回収します']],
      chef: ['朗々飯店の厨房跡。八つの火口のうち、煤の新しい一つに、メモリを挿す端子があった。料理長は、最初からここに戻ってくるつもりだったのだ。', S.party.includes('xiao') ? ['小籠', 'お客様。ここが、料理長の持ち場でございます'] : ['ワン', '……ここだ。料理長は、いつもここに立っていた'], 'メモリを挿そうとした瞬間、厨房の壁が外から押し潰された。', ['ミドウ常務(拡声器)', '休眠中の人格データの起動は、弊社の倫理規定上、看過できません。厨房ごと回収します']],
    })[S.route], battle: { encf: S => 'titan_' + S.route, win: 'won', lose: 'lost' } },
    lost: { t: ['瓦礫の陰に逃げ込んだ。タイタンの脚音が、まだ近くで響いている。'], end: true, noDone: true },
    won: { fx: S => { S.flags.m12 = 1; S.wanted++; const r = { corp: () => { S.credits += 3000; }, gang: () => { S.credits += 800; give(S, mkInst('cleaver', 3, null, true)); }, union: () => { give(S, mkInst('leech', 3, null, true)); if (member(S, 'zero')) rel(S, 'zero', 2); }, chef: () => { S.flags.chefAwake = 1; } }; r[S.route](); },
      t: [], dyn: S => ({
        corp: ['タイタンは、ゆっくりと膝をついた。ミドウ常務は、契約書を丁寧に破った。', ['ミドウ常務', '……第二条は撤回します。報酬は、第一条どおり。弊社は、約束は守る会社です'], '口座に、3000crが振り込まれた。', 'その夜、カンナイ・アーコロジーから、試験配信が始まった。社員寮の窓が、一斉に同じ色に灯った。'],
        gang: ['タイタンが倒れた拍子に、看板の埃が落ちた。朗々飯店の四文字が、夕日に光った。', ['幇主', '……悪くない開店祝いだ'], '幇主は800crと、禁制品の「中華包丁術」を置いていった。「うちの若いのには、もう重すぎる代物だよ」。'],
        union: ['タイタンが沈黙した。ゼロカロリーが、配信ボタンを押した。', '数千人が、同時に目を閉じた。観覧車の下に、米の立つ音が聞こえた気がした。泣いている人がいた。笑っている人がいた。何も感じない、と首を振る人もいた。', '誰かが、禁制品の「吸血コード」を足元に置いていった。礼のつもりらしい。'],
        chef: ['タイタンが崩れ落ちたあと、厨房は静かになった。メモリを、火口の端子に挿した。', '八つの火口のうち、一つにだけ、青い火が点いた。', ['声', '……誰だ。わたしの厨房で、誰が鍋を待っている'], '料理長が、目を覚ました。'],
      })[S.route].concat(['手配度が上がった。', 'その夜、ネオヨコハマの空に、月面本社の広告が一斉に灯った。「全人類に、最適な一皿を」。']), end: true } } },

  /* ネオ・トーキョー: 麺処グラヴィティ・ウェル */
  gw: { loc: 'gate7', scene: 'gw', label: '麺処グラヴィティ・ウェル', sub: '路地の突き当たり。暖簾が一枚', cond: FREE, nodes: {
    start: { t: [
      'ネオ・トーキョー第七到着ゲートの裏手。客引きのアンドロイドを十七体かわして路地に入ると、突き当たりに暖簾が一枚下がっていた。',
      '「麺処グラヴィティ・ウェル」。カウンターは六席。換気扇は、かなり古い型だった。',
      '寸胴鍋に似た円筒形の胴体に、湯切りのテボのような網の頭をしたロボットが、入口で頭を下げた。',
      ['寸胴型のロボット', 'イラッシャイ、マセ。オセキ、ハ、アイテイマス'],
      '厨房には、無口な男が一人。客の顔を見ずに、麺の上げ時だけを見ている。',
      '丼が置かれた。汁はなかった。底にタレが沈み、太い麺が、怠惰な獣のように横たわっていた。',
      ['寸胴型のロボット', 'マゼテ、クダサイ'],
    ], c: [{ t: '混ぜる', to: 'eat' }] },
    eat: { fx: S => { S.flags.gw = 1; partyRel(S, 1); }, t: [], dyn: S => [
      '混ぜた。そこから先の数分間を、チャンカーはうまく言葉にできなかった。',
      '舌の端子には、何も届かなかった。データではない。実感の書き込みでもない。ただ、口の中に、熱と油と小麦があった。',
      '食べ終えて顔を上げると、店主がこちらを見ていた。正確には、こちらの舌の端子に挿さった、古いメモリを見ていた。',
      ['店主', '……朗々飯店か'],
      ['店主', '昔、あの店の炒飯を食いに、遠くから来た客がいた。データじゃ足りないと言ってな'],
      '店主はそれ以上何も言わず、次の麺を上げにかかった。',
    ].concat(S.party.length > 1 ? ['仲間たちも、黙って丼を空にした。帰り道、誰も、データの値段の話をしなかった。', '同行している仲間との仲が深まった。'] : []), end: true } } },
  gwmeal: { loc: 'gate7', scene: 'gw', repeat: true, label: 'もう一杯食べる', sub: '30cr。仲間と行くと仲が深まる。街が動くまでは1回', cond: S => S.flags.gw && (S.scav['gw' + S.wanted] || 0) < 1, nodes: {
    start: { t: [['寸胴型のロボット', 'イラッシャイ、マセ']], c: [{ t: '食べる', sub: '30cr', to: 'eat', cond: S => S.credits >= 30 }, { t: '今日はやめておく', sub: '', to: 'no' }] },
    no: { t: ['暖簾の前で、湯気だけを吸って帰った。'], end: true },
    eat: { fx: S => { S.credits -= 30; S.scav['gw' + S.wanted] = 1; partyRel(S, 1); }, t: ['混ぜた。旨かった。それ以上、言うことはなかった。', '同行している仲間との仲が深まった。'], end: true } } },
};
const ROMEV3 = romEvents('zero', {
  label: 'ゼロカロリーと過ごす',
  s1: { sub: 'ホログラムのおにぎりを、手のひらに投影している', t: [
    'ゼロカロリーは、手のひらにホログラムのおにぎりを浮かべて、眺めていた。',
    ['ゼロカロリー', '生まれてから、本物の食べ物を口に入れたこと、たぶん三回くらいしかない。残りは全部これ'],
    ['ゼロカロリー', 'カロリーゼロだから、ゼロカロリー。笑えるでしょ'],
  ], c: [['「笑えない」', 2], ['ジャンク山で拾った缶詰を開けて渡す', 2], ['「おにぎりの形は、ちゃんとしてる」', 1]],
    end: ['ゼロカロリーはホログラムを消して、こちらを見た。', ['ゼロカロリー', '……変な人だね、チャンカーは'] ] },
  s2: { sub: '観覧車の方角を見ている', t: [
    ['ゼロカロリー', '空腹同盟のみんなには、自分も同じだって言ってる。でも本当は、少しだけ違う'],
    ['ゼロカロリー', '自分は、何が好きなのか分からないんだ。好きな味がない。好きな人も、たぶんいなかった。何にも分類されない感じ'],
  ], cand: '「分類なんか、いらない」', friend: '「分からないなら、一緒に探せばいい」',
    endC: ['ゼロカロリーは、しばらく黙っていた。それから、小さく笑った。', ['ゼロカロリー', 'それ、けっこう効くね'] ], endF: [['ゼロカロリー', 'うん。探すの、手伝って'] ] },
  s3: { sub: '本物のおにぎりを、二つ持って待っている', t: [
    'ゼロカロリーは、不格好なおにぎりを二つ持っていた。自分で握ったらしい。',
    ['ゼロカロリー', '好きなもの、ひとつ見つかった気がする。……確かめてもいい?'],
  ], lover: '「確かめてくれ」', partner: '「相棒として、一緒に食べよう」', wait: '「まだ、答えを出せない」',
    endL: ['ゼロカロリーは、おにぎりを一つこちらに渡した。塩が多すぎた。', ['ゼロカロリー', '……うん。やっぱり、好きだ'] ],
    endP: [['ゼロカロリー', '相棒。いいね。それ、分類として気に入った'] ], endW: [['ゼロカロリー', 'わかった。おにぎりは、また握るよ'] ] },
  back: { t: ['観覧車の下で、細身の人物が、ホログラムのおにぎりを眺めていた。'], yes: [['ゼロカロリー', '……来ると思ってた。今度は、ちょっとじゃなくて'] ] },
});

/* ---------- 各地の寄り道(いつでも行ける) ---------- */
const hasForbidden = S => S.storage.concat(S.bag).some(i => i.rar === 3);
const takeForbidden = S => { for (const src of ['storage', 'bag']) { const k = S[src].findIndex(i => i.rar === 3); if (k >= 0) return S[src].splice(k, 1)[0]; } return null; };
const PORTCOST = n => n <= 2 ? 4000 : 9000;
const RESETCOST = 8000;
const farm = (loc, label, sub, enc, t, w, l) => ({ loc, repeat: true, label, sub, cond: FREE, nodes: { start: { t: [t], battle: { enc, win: 'w', lose: 'l' } }, w: { t: [w], end: true }, l: { t: [l], end: true } } });
const REGIONSIDE = {
  farmKw: farm('kw', '暴走ラインを止める', '何度でも戦える。手強い', 'farmKw', '第三ラインの作業ロボットが、こちらを鉄材と認識した。', '止まったロボットから、使えそうな部品を外した。', '溶鉱炉の熱から逃げ出した。'),
  farmHk: farm('hk', '裏山の密猟者を追い払う', '何度でも戦える。手強い', 'farmHk', '湯けむりの向こうから、密猟者たちが降りてきた。', '密猟者たちは山へ逃げ帰った。湯治客が、湯の中から拍手した。', '湯けむりに紛れて逃げた。'),
  farmKs: farm('ks', '自警団に絡まれる', '何度でも戦える。手強い', 'farmKs', '「見ない顔だな」。自警団は、それだけで十分な理由だと思っている。', '自警団は、明日もまた絡んでくるだろう。郊外とはそういうものだ。', '駅の改札を飛び越えて逃げた。'),
  farmHm: farm('honmoku', '闇市の裏で揉める', '何度でも戦える。手強い', 'farmHm', '品定めの視線が、こちらの舌の端子で止まった。', '闇市は、何事もなかったように営業を続けている。', '密輸コンテナの隙間を抜けて逃げた。'),
  kwjob: { loc: 'kw', repeat: true, label: '日雇いの鉄運び', sub: '腕力で稼ぐ。街が動くまでは1回', cond: S => FREE(S) && !(S.scav['kw' + S.wanted]), nodes: {
    start: { fx: S => { S.scav['kw' + S.wanted] = 1; }, t: ['工場の門の前に、日雇いの列ができていた。条件は一つ。鉄骨を担げること。'], check: { stat: 'pow', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'g' } },
    f: { fx: S => { S.credits += 40; }, t: ['昼までに腰が悲鳴を上げた。半日分の日当が出た。', '40crを手に入れた。'], end: true },
    o: { fx: S => { S.credits += 150; }, t: ['夕方まで鉄骨を運んだ。現場監督が、黙って日当を少し多めにくれた。', '150crを手に入れた。'], end: true },
    g: { fx: S => { S.credits += 150; give(S, mkInst(pickMem([['saw', 0.5], ['weld', 0.5]]), null, null, true)); }, t: ['鉄骨を二本ずつ運んだ。現場監督は、日当と一緒に、工具箱の底のメモリをくれた。「うちの若いのより使える」。', '150crとメモリを手に入れた。'], end: true } } },
  onsen: { loc: 'hk', repeat: true, label: '湯に浸かる', sub: '50cr。仲間と行くと仲が深まる。街が動くまでは1回', cond: S => FREE(S) && !(S.scav['hk' + S.wanted]), nodes: {
    start: { t: ['湯けむり横丁の共同浴場は、逃亡者も湯治客も同じ料金だ。'], c: [{ t: '浸かる', sub: '50cr', to: 'go', dis: S => S.credits < 50 }, { t: 'やめておく', sub: '', to: 'no' }] },
    no: { t: ['湯けむりだけ吸って帰った。'], end: true },
    go: { fx: S => { S.credits -= 50; S.scav['hk' + S.wanted] = 1; partyRel(S, 1); }, t: [], dyn: S => ['湯は熱く、少しだけ硫黄の匂いがした。舌の端子が、ゆっくりと冷えていく。'].concat(S.party.length > 1 ? [`${party(S).filter(u => u.id !== 'hero').map(u => u.name).join('、')}も、黙って肩まで浸かった。`, S.party.includes('aur') ? 'オロールは甲冑のまま浸かっていた。誰も何も言わなかった。湯が少し錆びた。' : '', '同行している仲間との仲が深まった。'].filter(Boolean) : ['一人で浸かる湯も、悪くなかった。']), end: true } } },
  toji: { loc: 'hk', label: '湯治場の奥の間', sub: '体に染み付いたものを、湯で剥がすという', cond: FREE, repeatable: true, nodes: {
    start: { t: ['湯治場の一番奥に、窓のない部屋があった。白衣の老人が、湯桶の前に座っている。', ['湯治の老人', '固着したメモリを、湯で剥がしてやる。体質ごと煮出すんじゃ。高いぞ。それに、馴染んだものの半分は湯に溶ける'], `料金は${RESETCOST}cr。剥がしたメモリは手元に戻り、そのメモリの浸透度は50%になる。`],
      cf: S => S.roster.flatMap(u => (u.fixed || []).map((i, k) => ({ t: `${u.name}から「${CH.instName(i)}」を剥がす`, sub: `${RESETCOST}cr`, to: 'done', dis: S2 => S2.credits < RESETCOST, fx: S2 => { const inst = u.fixed.splice(k, 1)[0]; S2.credits -= RESETCOST; S2.seep[u.id + ':' + inst.type] = 50; CH.recompute(u); u.hp = u.maxhp; give(S2, inst); S2._msg = `${u.name}から「${CH.instName(inst)}」が剥がれた。`; } }))).concat([{ t: '何もしない', sub: '', to: 'no' }]) },
    no: { t: ['老人は、湯桶の湯をかき回し続けた。'], end: true, noDone: true },
    done: { t: [], dyn: S => ['熱い湯に、体の奥から何かが溶け出していく感覚があった。', S._msg || ''], end: true, noDone: true } } },
  ripper: { loc: 'honmoku', label: '改造医の診療所', sub: '闇市の奥。ポートを増やしてくれるという', cond: FREE, nodes: {
    start: { t: ['闇市の一番奥、冷蔵コンテナを改造した診療所に、片目がカメラの医者がいた。', ['改造医', 'ポートの増設か。一人四本まで。神経を一本ずつ引き直すから、高いぞ。それと、禁制品を一本もらう。部品取りに使うんでな'], `3本目は4000cr、4本目は9000cr。どちらも禁制品のメモリを1本使う(倉庫から優先して使う)。`],
      cf: S => S.roster.filter(u => u.ports.length < 4).map(u => { const n = u.ports.length, c = PORTCOST(n); return { t: `${u.name}のポートを${n + 1}本にする`, sub: `${c}cr と禁制品1本`, to: 'done', dis: S2 => S2.credits < c || !hasForbidden(S2), fx: S2 => { S2.credits -= c; const used = takeForbidden(S2); u.ports.push({ mem: null, inst: null, dur: 0, maxdur: 0, broken: false }); S2._msg = `${u.name}のポートが${n + 1}本になった。(「${CH.instName(used)}」を使った)`; } }; }).concat([{ t: '帰る', sub: '', to: 'no' }]) },
    no: { t: ['改造医は、カメラの目を一度だけ回した。'], end: true, noDone: true },
    done: { t: [], dyn: S => ['麻酔は効かなかった。正確には、効いているという実感だけが、舌の端子から書き込まれた。', S._msg || ''], end: true, noDone: true } } },
  ksgarden: { loc: 'ks', label: '家庭菜園の老人', sub: 'ロータリーの花壇で、本物の野菜を育てている', cond: FREE, nodes: {
    start: { t: ['駅前ロータリーの花壇が、勝手に家庭菜園になっていた。老人が、本物のトマトに水をやっている。', ['老人', '食うか? 土で育てたやつだ。端子には何も書き込まれんがな']], check: { stat: 'talk', lo: 5, hi: 8, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['トマトは青臭く、酸っぱかった。老人は満足そうに頷いた。'], end: true },
    o: { fx: S => { S.items.gel += 2; }, t: ['畑の話を聞いているうちに、日が暮れた。帰りに、老人は救急箱から修復ジェルを二本くれた。「土いじりは、怪我が多いんでな」。', '修復ジェル2本を手に入れた。'], end: true },
    g: { fx: S => { S.items.gel += 2; give(S, mkInst('coupon', 2, null, true)); }, t: ['畑の話で盛り上がり、雑草抜きまで手伝った。老人は修復ジェルと、孫が置いていったというメモリをくれた。「わしには使い道がわからん」。', '修復ジェル2本と特注品の「割引クーポン.exe」を手に入れた。'], end: true } } },
  ymtea: { loc: 'yamate', label: '洋館の茶会', sub: '富裕層の茶会に、紛れ込めるかもしれない', cond: FREE, nodes: {
    start: { t: ['高台の洋館の庭で、富裕層の茶会が開かれていた。紅茶は本物の茶葉で淹れられていた。この街では、それだけで富の証明になる。'], check: { stat: 'talk', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['三言目で、育ちが割れた。執事型アンドロイドに、丁重に門の外へ送り出された。'], end: true, noDone: true },
    o: { fx: S => { S.credits += 300; }, t: ['ジャンク屋で覚えた骨董の知識が、思いがけず役に立った。茶会の客の一人が、話の礼にと小切手を切った。', '300crを手に入れた。'], end: true },
    g: { fx: S => { S.credits += 300; S.flags.ymInfo = 1; }, t: ['茶会の主役になった。帰り際、酔った貴婦人が耳打ちした。「この先の洋館、マンカンの会長の生家よ。月に行ったきり、帰ってこないの」。', '300crを手に入れた。'], end: true } } },
  ntlounge: { loc: 'ntport', label: '展望ラウンジ', sub: '月行きの便が見える', cond: FREE, nodes: {
    start: { t: ['展望ラウンジの窓から、月行きのシャトルが見えた。機体の横腹に、満の字の社章が描かれている。', '電光掲示板の行き先は、全便「マンカン月面本社」だった。'], end: true } } },
  mall: { loc: 'kg', repeat: true, label: 'メガモールの奥へ降りる', sub: '終わりのない階層。深いほど強く、深いほど良いメモリ', cond: FREE, guide: S => S.flags.m12 && !S.flags.moon && !S.keys.map.length, nodes: {
    start: { fx: S => { S.mallFloor = S.mallFloor || 1; S.mallMax = S.mallMax || 0; if (!S.mallOpts || S.mallOpts.f !== S.mallFloor) { const ks = Object.keys(MALLMOD).filter(k => k !== 'none'); const a = ks[Math.floor(Math.random() * ks.length)]; let b = ks[Math.floor(Math.random() * ks.length)]; if (b === a) b = 'none'; S.mallOpts = { f: S.mallFloor, a, b }; } },
      t: [], dyn: S => { const f = S.mallFloor, z = mallZone(f); return [`地下${f}階、${z.n}。${z.intro}`, `最深記録は地下${S.mallMax}階。` + (f % 10 === 0 ? `この階には${z.boss}がいる。` + ((S.mallBoss || {})[f] ? '' : '初めて倒せば、一点物が手に入る。') : f % 5 === 0 ? 'この階にはフロアマネージャーがいる。' : ''), '下りの階段が二つある。案内板によると、それぞれの先で何かが起きているらしい。']; },
      again: 'go', cf: S => { const f = S.mallFloor, o = S.mallOpts, cp = Math.floor(S.mallMax / 10) * 10; const st = k => ({ t: `${k === o.a ? '左' : '右'}の階段: ${MALLMOD[k].n}`, sub: MALLMOD[k].d, to: 'go', fx: S2 => { S2.mallMod = k; } });
        const out = [st(o.a), st(o.b)];
        if (f > 1 && f % 5 === 1) out.push({ t: '非常口の売店で修復ジェルを買う', sub: `${100 + f * 10}cr`, to: 'shop', dis: S2 => S2.credits < 100 + f * 10, fx: S2 => { S2.credits -= 100 + f * 10; S2.items.gel++; } });
        if (cp > 1 && cp > f) out.push({ t: `エレベーターで地下${cp}階へ`, sub: '最深記録の階まで降りる', to: 'start', fx: S2 => { S2.mallFloor = cp; } });
        if (f > 1) out.push({ t: '地上に戻って、地下1階からやり直す', sub: '', to: 'start', fx: S2 => { S2.mallFloor = 1; } });
        out.push({ t: '帰る', sub: '', to: 'no' }); return out; } },
    shop: { t: ['売店の自販機が、修復ジェルを一本吐き出した。'], c: [{ t: '戻る', to: 'start' }] },
    no: { t: ['エスカレーターを逆走して、地上に戻った。'], end: true },
    go: { t: [], dyn: S => [`地下${S.mallFloor}階。${MALLMOD[S.mallMod || 'none'].n === '通常' ? '' : '「' + MALLMOD[S.mallMod].n + '」の階だ。' + MALLMOD[S.mallMod].d + '。'}`], battle: { enc: 'mall', win: 'w', lose: 'l' } },
    w: { fx: S => { const f = S.mallFloor; S._pt = f * (S.mallMod === 'rich' ? 2 : 1) + (f % 10 === 0 ? 20 : 0); S.mallPt = (S.mallPt || 0) + S._pt; S.mallMax = Math.max(S.mallMax, f); S.mallFloor = f + 1; S.mallMod = 'none'; if (f % 10 === 0) { S.mallBoss = S.mallBoss || {}; S.mallBoss[f] = 1; } S._key = (f === 10 && !S.keys.map.includes('manifest')) ? (S.keys.map.push('manifest'), 1) : 0; }, t: [], dyn: S => [`地下${S.mallFloor - 1}階を抜けた。下りの階段が、また二つ続いている。モールポイント+${S._pt || 0}(合計${S.mallPt || 0}pt)。`].concat(S._key ? ['デパ地下の主が守っていた配送センターに、一枚の伝票が残っていた。「月面直送便 配送先: マンカン月面本社 第八厨房」。裏に、搬入口の見取り図が印刷されている。'] : []), end: true },
    l: { fx: S => { S.mallFloor = 1; S.mallMod = 'none'; }, t: ['気がつくと、地上の入口に放り出されていた。モールは、侵入者を一番上の階に戻す。最深記録の10階刻みの階までは、エレベーターで戻れる。'], end: true } } },
};

/* ---------- 第四章: 月への道(メインの札は付けない) ---------- */
const CH4 = {
  kwarc: { join: true, loc: 'kw', label: '工場長の頼み', sub: '高炉の前で、老人が腕を組んでいる', story: true, guide: S => S.flags.m12 && !S.flags.moon && !S.keys.ride.length, cond: FREE, nodes: {
    start: { t: [
      '第一高炉の前で、溶接面を額に上げた老人が、腕を組んで炉を睨んでいた。',
      ['ガンテツ', 'ここの工場長だ。いや、工場長だった。マンカンが置いていった自律鍛造機が、工場ごと乗っ取りやがった'],
      ['ガンテツ', 'あれを止めてくれたら、礼をする。うちは月行きの貨物ロケットを組んでる工場でな。一人分くらいなら、荷物に紛れ込ませてやれる'],
    ], c: [{ t: '「止める」', to: 'go' }, { t: '「今は無理だ」', to: 'no' }] },
    no: { t: ['ガンテツは何も言わず、また炉を睨んだ。'], end: true, noDone: true },
    go: { t: ['高炉の扉が開いた。中から、溶けた鉄の色をした目が、こちらを見た。'], battle: { enc: 'kwboss', win: 'w', lose: 'l' } },
    l: { t: ['ガンテツに引きずり出された。高炉は、まだ唸っている。'], end: true, noDone: true },
    w: { fx: S => { S.keys.ride.push('rocket'); join(S, 'gantetsu'); rel(S, 'gantetsu', 1); }, t: [
      'ベッセマーが沈黙すると、工場じゅうのラインが一斉に止まった。静かになった工場で、ガンテツは煙草に火をつけた。',
      ['ガンテツ', '約束だ。貨物ロケットの席は、お前の分を空けておく。……いや、待て。俺も乗る。あの会社の厨房を、一度この目で見ておきてえ'],
      'ガンテツが仲間になった。',
    ], end: true } } },
  hkarc: { loc: 'hk', label: '源泉の上の大砲', sub: '湯治場の女将が、山の上を気にしている', story: true, guide: S => S.flags.m12 && !S.flags.moon && !S.keys.ride.length, cond: FREE, nodes: {
    start: { t: [
      ['女将', '山の上の源泉にね、大砲があるの。マスドライバー。昔、湯の花を月に売ってた頃の名残よ'],
      ['女将', '今は密輸に使ってる連中がいるんだけど、番をしてる湯守が、最近おかしくなっちゃって。誰も近づけないの'],
    ], check: { stat: 'talk', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['女将は、それ以上は話してくれなかった。山道だけは教えてくれた。'], c: [{ t: '源泉へ登る', to: 'go' }] },
    o: { fx: S => { S.items.coolant += 2; }, t: [['女将', '湯守は熱湯を撒くわ。これ、持っていきなさい'], '冷却スプレー2本を手に入れた。'], c: [{ t: '源泉へ登る', to: 'go' }] },
    g: { fx: S => { S.items.coolant += 2; S.items.gel += 2; }, t: [['女将', '湯守は熱湯を撒くわ。濡れてると炎は効きにくいって、亭主が言ってた。これ、持っていきなさい'], '冷却スプレー2本と修復ジェル2本を手に入れた。'], c: [{ t: '源泉へ登る', to: 'go' }] },
    go: { t: ['源泉の上に、苔むした砲身が空を向いていた。その足元で、岩の塊が立ち上がった。'], battle: { enc: 'hkboss', win: 'w', lose: 'l' } },
    l: { t: ['源泉の熱湯に追われて、山を転げ落ちた。'], end: true, noDone: true },
    w: { fx: S => { S.keys.ride.push('massdriver'); }, t: ['湯守は、ゆっくりと源泉の中に沈んでいった。湯けむりの向こうで、砲身が月の方角を向いている。', ['女将', '撃てるのは一回きりよ。人間を撃ち出したことは、まだないけど'] ], end: true } } },
  hmarc: { loc: 'honmoku', label: '月まで行く密輸船', sub: '岸壁に、妙に背の高い船が停まっている', story: true, guide: S => S.flags.m12 && !S.flags.moon && !S.keys.ride.length, cond: FREE, nodes: {
    start: { t: [
      '岸壁に、船体の半分がロケットエンジンでできた船が停まっていた。甲板の上で、黒い髭の大男が干物を噛んでいる。',
      ['キャプテン・ヒジキ', 'おう。この船は、海から宇宙まで行ける。行ける、というだけで、行って帰ってきた奴はまだいないがな'],
      ['キャプテン・ヒジキ', '乗りたけりゃ、俺に勝て。海賊の流儀だ'],
    ], c: [{ t: '「勝負だ」', to: 'go' }, { t: '「また来る」', to: 'no' }] },
    no: { t: [['キャプテン・ヒジキ', '逃げる奴は嫌いじゃねえ。長生きするからな']], end: true, noDone: true },
    go: { t: ['ヒジキは干物を吐き捨て、舶刀を抜いた。'], battle: { enc: 'hmboss', win: 'w', lose: 'l' } },
    l: { t: ['海に投げ込まれた。岸壁に這い上がると、ヒジキが手を振っていた。'], end: true, noDone: true },
    w: { fx: S => { S.keys.ride.push('ship'); }, t: [['キャプテン・ヒジキ', 'がはは、負けだ負けだ! いいだろう、月まで乗せてやる。燃料代はそっち持ちだがな'] ], end: true } } },
  ntarc: { loc: 'ntport', label: '偽造搭乗券', sub: 'ロビーの隅で、誰かが手招きしている', story: true, guide: S => S.flags.m12 && !S.flags.moon && !S.keys.pass.length, cond: S => S.flags.m8, nodes: {
    start: { t: ['ロビーの隅の自販機の陰で、帽子を目深にかぶった男が手招きしていた。', ['偽造屋', '月面本社行きの搭乗券、一枚どうだい。社員証の偽造込み。ただし、仕上げはそっちでやってもらう'], '偽造屋は、未完成の社員証を差し出した。磁気帯を書き換える必要がある。'], check: { stat: 'tec', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'o' } },
    f: { t: ['書き換えに手間取っているうちに、保安検査場のアラームが鳴った。'], c: [{ t: '構える', to: 'go' }] },
    o: { t: ['磁気帯の書き換えは、一分で終わった。偽造屋が口笛を吹いた。その瞬間、背後から聞き覚えのある声がした。'], c: [{ t: '振り返る', to: 'go' }] },
    go: { t: [['ツキミ部長', 'マンカン・ホールディングス品質保証部、ツキミです。二度目の製品回収にまいりました。前回の報告書は、まだ受理されておりません']], battle: { enc: 'ntboss', win: 'w', lose: 'l' } },
    l: { t: ['ロビーの人混みに紛れて逃げた。ツキミ部長の拡声器が、まだ館内放送に割り込んでいる。'], end: true, noDone: true },
    w: { fx: S => { S.keys.pass.push('boarding'); S.flags.tsukimi2 = 1; }, t: [
      'ツキミ部長は、スーツの埃を払い、拡声器を床に置いた。',
      ['ツキミ部長', '……回収、再び失敗。報告書が二枚になりました。……月面本社では、失敗した社員の舌から順に最適化されます'],
      ['ツキミ部長', 'この搭乗券は、本物にしておきます。私の承認印付きで。理由は報告書に書く欄がありません'],
      '本物の搭乗券を手に入れた。',
    ], end: true } } },
  ymarc: { loc: 'yamate', label: '会長の生家の晩餐会', sub: '洋館に、黒塗りの車が集まっている', story: true, guide: S => S.flags.m12 && !S.flags.moon && !S.keys.pass.length, cond: FREE, nodes: {
    start: { t: [], dyn: S => ['高台の一番奥の洋館に、黒塗りの車が列を作っていた。マンカン会長の生家で、年に一度の晩餐会が開かれるという。'].concat(S.flags.ymInfo ? ['茶会で聞いた話は本当だった。会長本人は、月から一度も降りてこない。'] : []).concat(['晩餐会の招待状は、月面本社への通行証を兼ねている。手に入れるには、紛れ込むしかない。']), check: { stat: 'talk', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['受付で、偽名を三回言い間違えた。ボディガードの白い手袋が、肩に置かれた。'], c: [{ t: '振り払う', to: 'go' }] },
    o: { t: ['晩餐会には紛れ込めた。招待状の保管場所も分かった。金庫の前に、白い手袋の男が立っていた。'], c: [{ t: '近づく', to: 'go' }] },
    g: { fx: S => { S.credits += 400; }, t: ['晩餐会の主賓席に座らされた。食後のデザートを待つ間に、隣の重役の財布から400crと、招待状の保管場所を抜き取った。金庫の前に、白い手袋の男が立っていた。'], c: [{ t: '近づく', to: 'go' }] },
    go: { t: [['ミスター・ホワイトグローブ', '失礼。お客様の手袋は、少々汚れておいでのようだ']], battle: { enc: 'ymboss', win: 'w', lose: 'l' } },
    l: { t: ['窓から庭に飛び降りて逃げた。洋館の明かりは、何事もなかったように灯っている。'], end: true, noDone: true },
    w: { fx: S => { S.keys.pass.push('invitation'); }, t: ['金庫の中には、月の紋章が箔押しされた招待状が一枚だけあった。「月面本社 開業百周年記念晩餐会 ご招待」。', 'ミスター・ホワイトグローブは、手袋を外して床に置いた。降参の作法らしかった。'], end: true } } },
  ksarc: { loc: 'ks', label: '天文台の老婆', sub: '坂の上の天文台に、明かりが点いている', story: true, guide: S => S.flags.m12 && !S.flags.moon && !S.keys.map.length, cond: FREE, nodes: {
    start: { t: [
      '坂の上の小さな天文台で、老婆が望遠鏡を覗いていた。壁には、宇宙服を着た若い女の写真が貼ってある。',
      ['ムツコ', '元宇宙飛行士よ。月面本社の建設に行ってたの。四十年前にね。あの建物の中は、全部覚えてる。誰も聞きに来なかったけど'],
      ['ムツコ', '……でも、あなたたちより先に、聞きに来た人たちがいるみたい'],
      '坂の下から、満の字の襟章が上ってきた。',
    ], battle: { enc: 'ksescort', win: 'w', lose: 'l' } },
    l: { t: ['ムツコは天文台の扉を閉めて、中に立てこもった。回収班は、坂の下で様子を見ている。'], end: true, noDone: true },
    w: { fx: S => { S.keys.map.push('stars'); }, t: [['ムツコ', 'ありがとう。お礼に、これをあげる'], 'ムツコは、天文台の端末から、手描きの見取り図を印刷した。月面本社の、建設当時の図面だった。', ['ムツコ', '第八厨房の換気ダクトはね、設計ミスで、人が通れる太さなの。四十年、誰にも言わなかったわ'] ], end: true } } },
  chefjoin: { join: true, loc: 'chinatown', scene: 'kitchen', label: '料理長と話す', sub: '厨房跡の火口に、青い火が点いている', cond: S => S.route === 'chef' && S.flags.chefAwake && !member(S, 'chef') && !S.left.chef, nodes: {
    start: { fx: S => { join(S, 'chef'); rel(S, 'chef', 1); }, t: [
      '火口の青い火の上に、半透明の老人が立っていた。白い調理服。手には、何も載っていない鉄鍋。',
      ['料理長・朗', 'わしは、一皿の中に自分を残した。誰かが、あの皿を本当に必要とする日のためにな'],
      ['料理長・朗', 'その日が来たかどうかは、まだ分からん。だから、見届けさせてもらう。お前の端子を借りるぞ'],
      '料理長・朗が仲間になった。',
    ], end: true } } },
  moonready: { anywhere: true, auto: true, label: '月への道', cond: S => S.keys && S.keys.ride.length && S.keys.pass.length && S.keys.map.length && !S.flags.moon && S.flags.m12, nodes: {
    start: { fx: S => { S.flags.moon = 1; }, t: [], dyn: S => {
      const ride = { rocket: 'ガンテツの貨物ロケット', massdriver: 'ハコネのマスドライバー', ship: 'キャプテン・ヒジキの密輸船' }[S.keys.ride[0]];
      const pass = { boarding: 'ツキミ部長の承認印付きの搭乗券', invitation: '会長の晩餐会の招待状' }[S.keys.pass[0]];
      const map = { stars: 'ムツコの手描きの図面', manifest: '月面直送便の配送伝票' }[S.keys.map[0]];
      return ['ねぐらのコンテナの床に、集めたものを並べた。', `${ride}。${pass}。${map}。`, '並べてみて、初めて分かった。これで、月に行ける。', 'その夜の月は、いつもより少しだけ近く見えた。', '月面基地へ行けるのは、乗り物の都合で一度に4人まで。仲間を選んでから発とう。'];
    }, end: true, noDone: true } } },

};
const ROMEV4 = Object.assign({},
  romEvents('gantetsu', {
    label: 'ガンテツと過ごす',
    s1: { sub: 'ねぐらの前で、拾った鉄を叩いている', t: [
      'ガンテツは、ジャンク山から拾った鉄くずを、金床代わりの冷蔵庫の扉の上で叩いていた。',
      ['ガンテツ', '手が鉄を叩いてないと、落ち着かねえんだ。五十年、毎日叩いてきたからな'],
    ], c: [['「何を作ってる」', 1], ['黙って横で見る', 1], ['「俺の刃も見てくれ」', 2]],
      end: ['ガンテツは、こちらのヒートブレードを手に取り、刃先を光にかざした。', ['ガンテツ', '……雑な研ぎだ。明日、直してやる'] ] },
    s2: { sub: '煙草を吸いながら、遠くの煙突を見ている', t: [
      ['ガンテツ', '女房が二人いた。順番にじゃねえ、同時にだ。三人で工場をやってた。二人とも、先に逝っちまったがな'],
      ['ガンテツ', '鉄は、熱いうちに打つもんだ。人も同じだと、あいつらはよく言ってた'],
    ], cand: '「今も、熱いうちか」', friend: '「いい職人だったんだな、三人とも」',
      endC: ['ガンテツは煙草を落とし、長い間、黙ってこちらを見ていた。', ['ガンテツ', '……年寄りをからかうな。心臓に悪い'] ], endF: [['ガンテツ', 'ああ。最高の職人だった'] ] },
    s3: { sub: '新しく打った刃を持って、待っている', t: [
      'ガンテツは、一本の刃を差し出した。ヒートブレードの、新しい刃だった。',
      ['ガンテツ', '俺は、口より手で喋る男だ。……この刃を受け取ってくれるなら、そういうことだ。俺の心は、一人で埋まるほど狭くねえがな'],
    ], lover: '「受け取る」', partner: '「相棒として、使わせてもらう」', wait: '「まだ、受け取れない」',
      endL: ['刃は、手にぴたりと馴染んだ。ガンテツは、照れ隠しに金床を一回叩いた。', ['ガンテツ', '……錆びさせたら、承知しねえぞ'] ],
      endP: [['ガンテツ', '相棒か。上等だ。刃の手入れは、一生俺がやってやる'] ], endW: [['ガンテツ', '刃は逃げねえ。鍛え直して待ってる'] ] },
    back: { t: ['臨海工場群の第一高炉の前で、老人が一人、鉄を叩いていた。'], yes: [['ガンテツ', '……謝る奴の刃は、よく切れる。戻ってこい'] ] },
  }),
  romEvents('chef', {
    label: '料理長と過ごす',
    s1: { sub: '半透明の手で、空の鍋を振っている', t: [
      '料理長・朗は、ねぐらの前で、何も入っていない鍋を振っていた。半透明の手首が、正確に返る。',
      ['料理長・朗', '実体がないとな、火加減が分からん。だから、火を思い出しながら振っておる'],
    ], c: [['「火加減を教えてくれ」', 2], ['「データでも、腕は鈍らないのか」', 1], ['黙って見ている', 1]],
      end: [['料理長・朗', '火加減はな、鍋が教えてくれる。人の顔と同じだ。よく見ておれば分かる'] ] },
    s2: { sub: '小籠やワンの方を、遠くから見ている', t: [
      ['料理長・朗', 'わしは、一皿の中に自分を残した。だが、残したのは料理人としてのわしだけだ。それ以外のわしは、置いてきた'],
      ['料理長・朗', '人を好きになる気持ちなんぞ、とうに忘れたと思っておった'],
    ], cand: '「思い出せばいい。今から」', friend: '「料理人のあんたで十分だ」',
      endC: ['料理長の半透明の輪郭が、一瞬だけ濃くなった。', ['料理長・朗', '……年寄りの火を、焚きつけるでない'] ], endF: [['料理長・朗', 'うむ。それが一番、楽でいい'] ] },
    s3: { sub: '火口の青い火の前で、待っている', t: [
      ['料理長・朗', '厨房には、料理人が一人いればいい。そう思って、わしは一人で鍋を振ってきた'],
      ['料理長・朗', '……二人目を、入れてみたくなった。お前だ。どうする'],
    ], lover: '「厨房に入れてくれ」', partner: '「見習いとして、隣に立たせてくれ」', wait: '「まだ、包丁の持ち方も知らない」',
      endL: ['料理長は、半透明の手で、こちらの手を鍋の柄に添えさせた。触れた感覚はなかった。だが、温かかった。', ['料理長・朗', '……よかろう。火加減は、二人で見る'] ],
      endP: [['料理長・朗', '見習いか。厳しいぞ'] ], endW: [['料理長・朗', 'では、まず包丁からだ'] ] },
    back: { t: ['厨房跡の火口に、青い火が一つだけ点いていた。'], yes: [['料理長・朗', '……戻ったか。鍋が冷めるところだった'] ] },
  })
);

/* ---------- 新しい仲間の加入 ---------- */
const JOIN2 = {
  linjoin: { join: true, loc: 'noge', scene: 'bar', label: '鳩の巣の看板', sub: '酒場の看板が、裏返しに掛けてある', cond: S => S.flags.m11 && !member(S, 'lin') && !S.left.lin, nodes: {
    start: { fx: S => { join(S, 'lin'); rel(S, 'lin', 1); }, t: ['鳩の巣の看板が裏返っていた。「本日閉店」ではなく「廃業」と書いてある。', ['リン', 'ブローカーは辞めたわ。売り物を燃やすブローカーなんて、もう誰も使わないもの'], ['リン', 'で、失業者を一人、雇ってみる気はない? 交渉と、値切りと、逃げ道探しなら得意よ'], 'リンが仲間になった。'], end: true } } },
  tsukimijoin: { join: true, loc: 'ntport', label: '出発ロビーの辞表', sub: 'ベンチに、スーツの女が座っている', cond: S => S.flags.tsukimi2 && !member(S, 'tsukimi') && !S.left.tsukimi, nodes: {
    start: { fx: S => { join(S, 'tsukimi'); rel(S, 'tsukimi', 1); }, t: ['出発ロビーのベンチに、ツキミ部長が座っていた。膝の上に、封筒が一通。表書きは「辞表」。', ['ツキミ', '提出しました。受理されるかどうかは、報告書に書く欄がありませんので分かりません'], ['ツキミ', '品質保証の経験は、二十年あります。……弊社、いえ、そちらの品質を、保証させていただけますか'], 'ツキミが仲間になった。'], end: true } } },
  glassjoin: { join: true, loc: 'minato', label: '控え室の元王者', sub: '闘技場の控え室で、誰かがバンテージを巻いている', cond: S => (S.arena || 0) >= 3 && !member(S, 'glassjaw') && !S.left.glassjaw, nodes: {
    start: { fx: S => { join(S, 'glassjaw'); rel(S, 'glassjaw', 1); }, t: ['控え室で、グラスジョーがバンテージを巻き直していた。ガラスの顎に、新しいひびが一本入っている。', ['グラスジョー', '王座はもういい。檻の中で殴るのは飽きた。お前らについていけば、外の世界で、もっと強い奴を殴れそうだ'], 'グラスジョーが仲間になった。'], end: true } } },
  hijikijoin: { join: true, loc: 'honmoku', label: '甲板の宴会', sub: '密輸船の甲板で、ラム酒の樽が開いている', cond: S => S.done.hmarc && !member(S, 'hijiki') && !S.left.hijiki, nodes: {
    start: { fx: S => { join(S, 'hijiki'); rel(S, 'hijiki', 1); }, t: ['甲板では、ヒジキが船員たちとラム酒を回していた。', ['キャプテン・ヒジキ', '船は副長に任せた。俺は、お前の航海に乗る。海賊が、他人の船に乗っちゃいけねえって決まりはねえ'], 'キャプテン・ヒジキが仲間になった。'], end: true } } },
  wgjoin: { join: true, loc: 'yamate', label: '空の洋館の執事', sub: '晩餐会のあとの洋館で、誰かが銀器を磨いている', cond: S => S.done.ymarc && !member(S, 'whiteglove') && !S.left.whiteglove, nodes: {
    start: { fx: S => { join(S, 'whiteglove'); rel(S, 'whiteglove', 1); }, t: ['晩餐会の客が去った洋館で、ホワイトグローブが一人、銀器を磨いていた。', ['ホワイトグローブ', '雇い主は月から帰ってきません。仕える相手のいない執事は、ただの磨き屋です'], ['ホワイトグローブ', '……手袋の汚れたお客様。よろしければ、お仕えさせてください'], 'ホワイトグローブが仲間になった。'], end: true } } },
  yumorijoin: { join: true, loc: 'hk', label: '直された湯守', sub: '女将が、岩の塊に湯をかけている', cond: S => S.done.hkarc && !member(S, 'yumori') && !S.left.yumori, nodes: {
    start: { fx: S => { join(S, 'yumori'); rel(S, 'yumori', 1); }, t: ['湯治場の前で、女将が岩の塊に湯をかけていた。源泉で倒した湯守だった。', ['女将', '亭主が直したのよ。もう暴れないわ。でも、源泉の番はもう要らないの。あんたたちに預けてもいい?'], ['湯守', '……ユ……モリ……マス'], '湯守が仲間になった。'], end: true } } },
  mutsukojoin: { join: true, loc: 'ks', label: '天文台の荷造り', sub: '老婆が、古い宇宙服を出している', cond: S => S.done.ksarc && !member(S, 'mutsuko') && !S.left.mutsuko, nodes: {
    start: { fx: S => { join(S, 'mutsuko'); rel(S, 'mutsuko', 1); }, t: ['天文台の前で、ムツコが古い宇宙服を広げていた。', ['ムツコ', '四十年ぶりに、月を近くで見たくなったの。図面だけ渡して見送るなんて、つまらないでしょう'], 'ムツコが仲間になった。'], end: true } } },
  teninjoin: { join: true, loc: 'kg', label: '迷子の店員', sub: 'モールの案内所に、制服の誰かが座っている', cond: S => (S.mallMax || 0) >= 5 && !member(S, 'tenin') && !S.left.tenin, nodes: {
    start: { fx: S => { join(S, 'tenin'); rel(S, 'tenin', 1); }, t: ['地下5階の案内所に、制服の店員が座っていた。名札には「テンイン」とだけある。', ['テンイン', 'いらっしゃいませ。生まれてから、このモールを出たことがないんです。出口が、どこにも見つからなくて'], ['テンイン', 'お客様たちは、上から来たんですよね。……外って、セールやってますか?'], 'テンインが仲間になった。'], end: true } } },
  satoujoin: { join: true, loc: 'kannai', label: '食堂の裏口', sub: '社員食堂の裏で、誰かが待っている', cond: S => S.done.canteen && !member(S, 'satou') && !S.left.satou, nodes: {
    start: { fx: S => { join(S, 'satou'); rel(S, 'satou', 1); }, t: ['社員食堂の裏口に、灰色のスーツの男が立っていた。前に、チャーハンの味を聞いてきた社員だった。', ['サトウ', '会社、辞めてきました。最適化された舌のままじゃ、あなたが言ってた味が分からない'], ['サトウ', 'システム部にいました。マンカンのネットワークなら、少しは分かります。連れて行ってください'], 'サトウが仲間になった。'], end: true } } },
  nanashijoin: { join: true, loc: 'pier', label: 'ついてくるドローン', sub: 'ねぐらの屋根に、小さなドローンが止まっている', cond: S => (S.flags.droneWins || 0) >= 5 && !member(S, 'nanashi') && !S.left.nanashi, nodes: {
    start: { fx: S => { join(S, 'nanashi'); rel(S, 'nanashi', 1); }, t: ['ねぐらの屋根に、小さな警備ドローンが止まっていた。赤いセンサーが、こちらを見ると青に変わった。', '野良ドローンを狩るたびに、遠くからついてきていた一機だった。持ち主の登録は空欄。名前も空欄。', '赤いセンサーが、もう一度青く瞬いた。', 'ナナシ(と呼ぶことにした)が仲間になった。'], end: true } } },
};
const ROMEV5 = Object.assign({},
  romEvents('lin', { label: 'リンと過ごす',
    s1: { sub: 'ねぐらで、帳簿を燃やしている', t: ['リンは、ドラム缶の火に古い帳簿を一冊ずつ放り込んでいた。', ['リン', '取引先の名前が全部書いてある。もう要らないもの'] ], c: [['「手伝う」', 1], ['「惜しくないのか」', 2], ['黙って火に当たる', 1]], end: [['リン', '惜しいわよ。だから燃やすの'] ] },
    s2: { sub: 'グラスの氷を指で回している', t: [['リン', 'あたし、値段の付かないものが苦手だったの。付けられないと、どう扱えばいいか分からないから'], ['リン', '……あんたには、まだ値段が付けられない'] ], cand: '「付けなくていい」', friend: '「仲間に値段はいらないだろ」', endC: ['リンは、氷を回す指を止めた。'], endF: [['リン', 'そうね。……プライスレスってやつ'] ] },
    s3: { sub: '最後の帳簿を持って、待っている', t: [['リン', 'あたし、取引先は一つに絞らない主義なの。誰とでも、ちゃんと付き合う'], ['リン', 'それでもいいなら、あんたと契約したい。期間は、無期限'] ], lover: '「契約する」', partner: '「相棒として、契約する」', wait: '「条件を、もう少し考えさせてくれ」', endL: [['リン', '成立ね。違約金は、高いわよ'] ], endP: [['リン', '相棒契約。悪くない取引だわ'] ], endW: [['リン', '交渉は、長引くほど面白いのよ'] ] },
    back: { t: ['鳩の巣の跡で、短い髪の女が、閉まったシャッターにもたれていた。'], yes: [['リン', '謝罪込みの再契約ね。今回だけ、手数料はまけてあげる'] ] } }),
  romEvents('tsukimi', { label: 'ツキミと過ごす',
    s1: { sub: 'ねぐらの備品台帳を作っている', t: ['ツキミは、ねぐらの備品に一つずつ管理番号のシールを貼っていた。冷蔵庫には「T-001」。', ['ツキミ', '品質保証は、まず現状把握から始まります'] ], c: [['「俺にも番号を貼るのか」', 2], ['「几帳面だな」', 1], ['台帳を手伝う', 1]], end: [['ツキミ', '……あなたは、管理番号の付けようがありません。前例がないので'] ] },
    s2: { sub: '辞表の控えを眺めている', t: [['ツキミ', '二十年、何かを回収する仕事でした。欠陥品を。不良在庫を。人の記憶も'], ['ツキミ', '回収されない側にいるのは、初めてです。……落ち着きません'] ], cand: '「ここにいればいい。回収されるまで」', friend: '「慣れるさ。ここはジャンクの山だ」', endC: ['ツキミは、眼鏡を外して拭いた。拭く必要はなかった。'], endF: [['ツキミ', '……はい。慣れる努力をいたします'] ] },
    s3: { sub: '新しい台帳に、何かを書いている', t: [['ツキミ', '一つの製品に、保証書は一枚。それが原則です'], ['ツキミ', 'あなたの品質を、私一人に保証させてください。他の保証書は、受け付けません'] ], lover: '「保証してくれ」', partner: '「相棒として、保証を頼む」', wait: '「まだ、審査中だ」', endL: [['ツキミ', '……保証期間は、無期限です。例外規定はありません'] ], endP: [['ツキミ', '承知しました。相棒としての品質を、保証いたします'] ], endW: [['ツキミ', '審査には、十分な時間をかけるべきです'] ] },
    back: { t: ['出発ロビーのベンチで、スーツの女が、受理されなかった辞表を眺めていた。'], yes: [['ツキミ', '……謝罪を受理します。前例はありませんが'] ] } }),
  romEvents('glassjaw', { label: 'グラスジョーと過ごす',
    s1: { sub: 'ジャンク山で、シャドーボクシングをしている', t: ['グラスジョーが、ジャンク山の冷蔵庫を相手にシャドーボクシングをしていた。', ['グラスジョー', '俺の顎はガラスだ。一発もらったら終わり。だから、一発ももらわない'] ], c: [['「一発、打ってみていいか」', 2], ['「怖くないのか」', 1], ['ミットを構える', 1]], end: [['グラスジョー', 'へっ。いい度胸だ'] ] },
    s2: { sub: '割れた顎を、指でなぞっている', t: [['グラスジョー', '負けたことがないんじゃない。負けるのが怖くて、勝てる相手としか戦ってこなかった'], ['グラスジョー', 'お前らに負けた日、初めて、ほっとしたんだ'] ], cand: '「次は、負けても隣にいてやる」', friend: '「今は、背中を預けられる」', endC: ['グラスジョーは、顔を背けた。ガラスの顎が、少しだけ赤かった。'], endF: [['グラスジョー', 'ああ。最高の観客席だ'] ] },
    s3: { sub: 'グローブを外して、待っている', t: [['グラスジョー', 'リングの外の勝負は、苦手なんだ。だから、正面から行く'], ['グラスジョー', 'お前の隣を、俺に取らせろ'] ], lover: '「取れ」', partner: '「相棒の座ならくれてやる」', wait: '「まだ、ゴングは鳴らない」', endL: [['グラスジョー', '……判定勝ちだな'] ], endP: [['グラスジョー', 'へっ。チャンピオンベルトより重いぜ'] ], endW: [['グラスジョー', '何ラウンドでも待ってやる'] ] },
    back: { t: ['闘技場の控え室で、大男が一人、バンテージを巻いていた。'], yes: [['グラスジョー', '謝る奴は、強い奴だ。戻るぜ'] ] } }),
  romEvents('hijiki', { label: 'ヒジキと過ごす',
    s1: { sub: '干物を噛みながら、星を見ている', t: [['キャプテン・ヒジキ', '海の上じゃ、星が地図だった。宇宙に出たら、星はどこを向いても星だ。迷子になり放題だぜ'] ], c: [['「迷子は怖くないのか」', 1], ['干物を分けてもらう', 2], ['「俺も星を読めない」', 1]], end: [['キャプテン・ヒジキ', 'がはは。迷子は、仲間がいりゃ冒険って呼ぶんだ'] ] },
    s2: { sub: '古い航海日誌をめくっている', t: [['キャプテン・ヒジキ', '港ごとに、惚れた奴がいた。全員、本気だった。海の男ってのは、心が港の数だけあるのさ'] ], cand: '「この港にも、寄っていけ」', friend: '「船長の航海は、最後まで見届ける」', endC: [['キャプテン・ヒジキ', '……錨を下ろしたくなる港ってのも、あるもんだな'] ], endF: [['キャプテン・ヒジキ', 'いい乗組員だ'] ] },
    s3: { sub: '帽子を取って、待っている', t: [['キャプテン・ヒジキ', '俺の心は港の数だけある。だが、母港は一つだ。……お前に、母港になってほしい'] ], lover: '「なる」', partner: '「副長でいいなら」', wait: '「まだ、錨を上げたままだ」', endL: [['キャプテン・ヒジキ', '面舵いっぱい! ……いや、言ってみたかっただけだ'] ], endP: [['キャプテン・ヒジキ', '副長! 頼りにしてるぜ'] ], endW: [['キャプテン・ヒジキ', '風が変わるまで、待つさ'] ] },
    back: { t: ['岸壁の密輸船の甲板で、黒い髭の男が干物を噛んでいた。'], yes: [['キャプテン・ヒジキ', 'がはは! 海賊は、出戻りを歓迎するんだ'] ] } }),
  romEvents('whiteglove', { label: 'ホワイトグローブと過ごす',
    s1: { sub: 'ねぐらのコンテナを、隅々まで磨いている', t: ['ホワイトグローブが、ねぐらのコンテナの錆を、白い手袋で磨いていた。手袋は、少しも汚れていなかった。', ['ホワイトグローブ', 'お仕えする場所は、清潔でなければなりません'] ], c: [['「手袋、汚れないのか」', 1], ['一緒に磨く', 2], ['「錆も味のうちだ」', 1]], end: [['ホワイトグローブ', '……お客様の手が汚れるのは、私の不手際です'] ] },
    s2: { sub: '手袋を外して、自分の手を見ている', t: [['ホワイトグローブ', '私は、仕える相手がいなければ、何者でもありません。手袋の中身が空っぽでも、誰も気づかないでしょう'] ], cand: '「中身を見せてくれ」', friend: '「仕えなくていい。隣にいればいい」', endC: ['ホワイトグローブは、手袋を一枚だけ外した。少し震えている、ただの人の手だった。'], endF: [['ホワイトグローブ', '……隣、ですか。慣れない言葉です'] ] },
    s3: { sub: '白い手袋を、両手に持って待っている', t: [['ホワイトグローブ', 'この手袋を、外してお仕えしたい方が、一人だけおります'] ], lover: '「外してくれ」', partner: '「手袋のまま、相棒でいてくれ」', wait: '「まだ、決められない」', endL: ['ホワイトグローブは手袋を外し、素手でこちらの手を取った。', ['ホワイトグローブ', '……温かいものですね'] ], endP: [['ホワイトグローブ', 'かしこまりました。生涯、お仕えいたします'] ], endW: [['ホワイトグローブ', 'お待ちするのも、執事の務めです'] ] },
    back: { t: ['ヤマテの洋館で、白い手袋の男が、一人で銀器を磨いていた。'], yes: [['ホワイトグローブ', 'お帰りなさいませ'] ] } }),
  romEvents('yumori', { label: '湯守と過ごす',
    s1: { sub: 'ねぐらの前で、じっと座っている', t: ['湯守は、ねぐらの前に座りこんでいた。体の岩の隙間から、かすかに湯気が出ている。', ['湯守', '……アタタ……カイ……デス……カ'] ], c: [['寄りかかって座る', 2], ['「温かいよ」', 1], ['湯をかけてやる', 1]], end: ['湯守の湯気が、少しだけ濃くなった。'] },
    s2: { sub: '星を見上げている(ように見える)', t: [['湯守', '……ゲンセン……ノ……バン……ヒャクネン……ヒトリ……デシタ'] ], cand: '「もう、一人じゃない」', friend: '「今は、俺たちの番をしてくれ」', endC: ['湯守の岩の胸の奥で、湯が沸くような音がした。'], endF: [['湯守', '……バン……シマス'] ] },
    s3: { sub: '湯気を立てて、待っている', t: [['湯守', '……イワ……ハ……スベテ……ウケトメ……マス……アナタ……モ……ウケトメテ……イイ……デスカ'] ], lover: '「受け止めてくれ」', partner: '「相棒として、頼む」', wait: '「まだ、分からない」', endL: ['湯守は、岩の腕でそっとこちらを包んだ。熱い湯に浸かったように、温かかった。'], endP: [['湯守', '……マモリ……マス'] ], endW: [['湯守', '……マチ……マス……イワ……ハ……マテ……マス'] ] },
    back: { t: ['ハコネの源泉の上で、岩の塊が、湯に浸かっていた。'], yes: [['湯守', '……オカエリ……ナサイ'] ] } }),
  romEvents('mutsuko', { label: 'ムツコと過ごす',
    s1: { sub: '古い宇宙服のバイザーを磨いている', t: [['ムツコ', '月面本社の建設はね、三年かかったの。毎晩、窓から地球を見てたわ。青くて、遠くて、腹が立つくらい綺麗で'] ], c: [['「戻りたかったのか」', 1], ['「今度は、一緒に見よう」', 2], ['黙ってバイザーを磨く', 1]], end: [['ムツコ', '戻ってきたら、今度は月が恋しくなったの。人間って、そういうものね'] ] },
    s2: { sub: '昔の乗組員の写真を見ている', t: [['ムツコ', 'あの頃の仲間は、もうみんないないの。私だけ長生きしちゃった'], ['ムツコ', '恋なんて、四十年前に置いてきたと思ってたわ'] ], cand: '「取りに戻ればいい」', friend: '「今の仲間なら、ここにいる」', endC: [['ムツコ', 'あら。……年寄りを本気にさせると、怖いわよ'] ], endF: [['ムツコ', 'そうね。いい乗組員たちだわ'] ] },
    s3: { sub: '天体望遠鏡を、こちらに向けている', t: [['ムツコ', '月に着いたら、窓から地球を見るの。今度は、一人じゃなくて'] ], lover: '「隣で見る」', partner: '「乗組員として、隣で見る」', wait: '「まだ、決められない」', endL: [['ムツコ', '……四十年、待った甲斐があったわ'] ], endP: [['ムツコ', '頼もしい乗組員ね'] ], endW: [['ムツコ', '月は逃げないわ。ゆっくり考えて'] ] },
    back: { t: ['カシワの天文台に、明かりが一つだけ点いていた。'], yes: [['ムツコ', '若い人の謝罪は、可愛いものね。許してあげる'] ] } }),
  romEvents('tenin', { label: 'テンインと過ごす',
    s1: { sub: '外の景色を、ずっと眺めている', t: ['テンインは、ねぐらの屋根の上で、空を見ていた。', ['テンイン', '天井がない。……これ、どこまで続いてるんですか? 閉店時間は?'] ], c: [['「閉店はない」', 2], ['「月までだ」', 1], ['一緒に空を見る', 1]], end: [['テンイン', '……すごい。年中無休なんですね'] ] },
    s2: { sub: 'バーコードリーダーで、色々なものを読んでいる', t: [['テンイン', 'モールでは、全部にバーコードがありました。値段も、名前も、分類も'], ['テンイン', '自分には、バーコードがないんです。男とか女とか、そういう分類も。……変ですか?'] ], cand: '「分類なんかいらない。テンインはテンインだ」', friend: '「バーコードがなくても、仲間は仲間だ」', endC: ['テンインは、リーダーをこちらに向けた。ピッ、と鳴った。', ['テンイン', '……読み取れました。大事なもの、って出ました'] ], endF: [['テンイン', 'はい。在庫に、ずっと置いてください'] ] },
    s3: { sub: '自分で作った名札を持って、待っている', t: [['テンイン', 'お客様は、何人いてもいいって、モールでは教わりました。全員、大切なお客様です'], ['テンイン', 'でも、常連さんは、特別です。……常連さんに、なってくれますか'] ], lover: '「なる」', partner: '「相棒として、通う」', wait: '「まだ、決められない」', endL: [['テンイン', 'ご来店、ありがとうございます。……これからも、ずっと'] ], endP: [['テンイン', 'ポイントカード、作っておきますね'] ], endW: [['テンイン', 'またのお越しを、お待ちしております'] ] },
    back: { t: ['メガモールの案内所で、制服の誰かが、ぼんやり座っていた。'], yes: [['テンイン', 'いらっしゃいませ。……おかえりなさい'] ] } }),
  romEvents('satou', { label: 'サトウと過ごす',
    s1: { sub: 'ジャンク山で拾った缶詰を、恐る恐る食べている', t: ['サトウは、賞味期限の切れた缶詰の桃を、一切れずつ口に運んでいた。', ['サトウ', '……分からない。甘いはずなのに、分からない。最適化された舌は、会社の粥しか美味しく感じないんです'] ], c: [['「少しずつでいい」', 2], ['「チャーハンのメモリを試すか」', 1], ['一緒に食べる', 1]], end: [['サトウ', '……今、ほんの少しだけ、甘かった気がします'] ] },
    s2: { sub: '社員証を、ゴミ箱の前で握っている', t: [['サトウ', '十五年、同じ粥を食べて、同じ時間に寝て、同じ顔で笑ってました。それで幸せだと思ってた'], ['サトウ', '辞めてから毎日、怖いです。何が好きなのか、自分で決めなきゃいけないから'] ], cand: '「一つ目は、俺が好きってことにしておけ」', friend: '「一つずつ、一緒に決めていこう」', endC: ['サトウは、社員証を落とした。拾わなかった。'], endF: [['サトウ', '……はい。まずは、缶詰の桃から'] ] },
    s3: { sub: '自分で作った不格好な料理を持って、待っている', t: [['サトウ', '初めて、自分で選んで作りました。卵焼きです。……味は、まだよく分からないけど'], ['サトウ', 'これを、あなたに食べてほしい。それが、僕が自分で決めた、最初の好きなことです'] ], lover: '「毎日、作ってくれ」', partner: '「相棒の料理は、残さない」', wait: '「……まだ、腹がいっぱいだ」', endL: [['サトウ', '……今、はっきり分かりました。これ、甘いです'] ], endP: [['サトウ', 'はい。相棒の分は、多めに作ります'] ], endW: [['サトウ', 'じゃあ、冷めないうちに、また作ります'] ] },
    back: { t: ['カンナイ・アーコロジーの社員食堂の裏口に、灰色のスーツの男が立っていた。'], yes: [['サトウ', '……謝られるのって、こんな味がするんですね'] ] } }),
  romEvents('nanashi', { label: 'ナナシと過ごす',
    s1: { sub: 'ねぐらの屋根で、センサーを点滅させている', t: ['ナナシは、ねぐらの屋根で、赤と青のセンサーを交互に点滅させていた。何かを伝えようとしているらしい。'], c: [['点滅を真似して手を振る', 2], ['「何が言いたい」', 1], ['隣に座る', 1]], end: ['ナナシのセンサーが、青で三回瞬いた。たぶん、嬉しいときの合図だ。'] },
    s2: { sub: '自分の機体番号を、何度も表示している', t: ['ナナシは、空欄の登録情報を、何度も画面に表示していた。持ち主の欄、空欄。名前の欄、空欄。'], cand: '「名前の欄に、俺の名前を書いておけ」', friend: '「ナナシで、いいじゃないか」', endC: ['ナナシのセンサーが、見たことのない色に光った。桃色だった。'], endF: ['ナナシは、名前の欄に「ナナシ」と入力した。センサーが青く光った。'] },
    s3: { sub: '肩に止まって、待っている', t: ['ナナシは、チャンカーの肩に止まり、センサーを桃色と青に交互に点滅させた。', 'これまでで一番、長い点滅だった。'], lover: '桃色に、手を振り返す', partner: '青に、手を振り返す', wait: 'まだ、手を振れない', endL: ['ナナシのセンサーが、桃色のまま、しばらく消えなかった。'], endP: ['ナナシのセンサーが、青で力強く瞬いた。'], endW: ['ナナシは、肩に止まったまま、静かに待っていた。'] },
    back: { t: ['ジャンク山の奥で、小さなドローンのセンサーが、赤く点滅していた。'], yes: ['センサーが、青に変わった。'] } })
);

/* ---------- メモリ図鑑とコレクター ---------- */
const DEX_GOALS = [8, 16, 24, 32];
function dexScan(S) {
  S.dex = S.dex || {};
  const see = i => { if (i && (S.dex[i.type] == null || S.dex[i.type] < i.rar)) S.dex[i.type] = i.rar; };
  S.bag.forEach(see); S.storage.forEach(see); S.roster.forEach(u => { u.ports.forEach(p => see(p.inst)); (u.fixed || []).forEach(see); });
  return Object.keys(S.dex).length;
}
const COLLECT = {
  collector: { loc: 'pier', label: 'ジローの鑑定棚', sub: '集めたメモリの種類を、故買屋に見せる', cond: FREE, nodes: {
    start: { t: [], dyn: S => { const n = dexScan(S), k = S.dexClaim || 0, goal = DEX_GOALS[k]; return [['ジロー', `ほう、${n}種類か。`]].concat(goal == null ? [['ジロー', '……もう教えることはねえ。お前のほうが詳しい']] : n >= goal ? [['ジロー', `${goal}種類を超えたな。約束の品だ。持ってけ`]] : [['ジロー', `${goal}種類集めたら、いいもんをやる。あと${goal - n}種類だ`]]); },
      cf: S => { const n = dexScan(S), k = S.dexClaim || 0, goal = DEX_GOALS[k]; return goal != null && n >= goal ? [{ t: '受け取る', sub: '', to: 'claim' }] : [{ t: '帰る', sub: '', to: 'no' }]; } },
    no: { t: ['ジローは、また何かを分解し始めた。'], end: true, noDone: true },
    claim: { fx: S => { const k = S.dexClaim || 0; S.dexClaim = k + 1; const R = [
      () => { S.credits += 500; give(S, mkInst(['magnet', 'frost', 'decoy', 'charm'][Math.floor(Math.random() * 4)], 2, null, true)); S._msg = '500crと特注品のメモリを手に入れた。'; },
      () => { S.credits += 1500; give(S, mkInst(['hashi', 'anthem', 'lowg', 'steep'][Math.floor(Math.random() * 4)], 3, null, true)); S._msg = '1500crと禁制品のメモリを手に入れた。'; },
      () => { give(S, mkInst('keyring', 4, [{ k: 'tec', v: 6 }, { k: 'spd', v: 3 }, { k: 'seep', v: 50 }, { k: 'cool', v: -20 }], true)); S._msg = '一点物の「ジローの鍵束」を手に入れた。どんなポートも開けられるという。'; },
      () => { S.credits += 5000; give(S, mkInst('anthem', 4, [{ k: 'hp', v: 25 }, { k: 'atk', v: 4 }, { k: 'tec', v: 6 }, { k: 'pow', v: 18 }], true)); S._msg = '5000crと一点物の「海賊放送.fm」を手に入れた。'; },
    ]; R[k](); }, t: [], dyn: S => [S._msg], end: true, noDone: true } } },
};

/* ---------- 第五章: 静かの海の厨房 ---------- */
const moonFoe = (id, name, kind, o) => foe(id, name, kind, Object.assign({ hp: 300, atk: 36, def: 15, spd: 10, fw: 30 }, o));
const moonObjs = () => [
  { id: 'panel', name: '与圧室の配電盤', act: '叩き壊す', desc: '敵全体に電撃。濡れた敵には2倍+スタン', tgt: 'none' },
  { id: 'crane', name: '吊り下げの寸胴', act: '落とす', desc: '単体に打撃の大ダメージ', tgt: 'enemy' },
  { id: 'sprinkler', name: '冷却水の配管', act: '破る', desc: '敵も味方も全員「濡れ」、熱-30', tgt: 'none' },
];
const MOONENC = {
  moonguard: { scene: 'moon', name: '着陸ドック 搬入口', intro: '月面本社の警備隊。低重力で、跳ねるように近づいてくる。', reward: 800,
    enemies: () => [moonFoe('a1', '月面警備員A', 'agent', { mems: [pickMem([['lowg', 0.5], ['armor', 0.3], ['magnet', 0.2]])] }), moonFoe('a2', '月面警備員B', 'agent', { mems: [pickMem([['lowg', 0.5], ['baton', 0.5]])] }), ...(ps() >= 3 ? [moonFoe('d1', '調理補助ドローン', 'drone', { hp: 220, atk: 32, spd: 14, mems: [pickMem([['frost', 0.4], ['steep', 0.3], ['hashi', 0.3]])] })] : []), ...(ps() >= 4 ? [moonFoe('r1', '月面ネットランナー', 'runner', { hp: 200, atk: 28, def: 8, spd: 15, mems: ['netrun'] })] : [])], objs: moonObjs },
  farmMoon: { farm: true, rareRate: 10, scene: 'moon', name: '着陸ドック 資材置き場', intro: '月面本社の巡回警備。補充は、地球から毎日届く。', reward: 400,
    enemies: () => { const out = [moonFoe('a1', '巡回警備員', 'agent', { mems: [pickMem([['lowg', 0.4], ['magnet', 0.3], ['decoy', 0.3]])] })]; if (ps() >= 2) out.push(moonFoe('d1', '調理補助ドローン', 'drone', { hp: 220, atk: 32, spd: 14, mems: [pickMem([['frost', 0.4], ['steep', 0.3], ['hashi', 0.3]])] })); if (ps() >= 3) out.push(moonFoe('r1', '月面ネットランナー', 'runner', { hp: 200, atk: 28, def: 8, spd: 15, mems: [pickMem([['netrun', 0.5], ['charm', 0.5]])] })); return out; }, objs: moonObjs },
  gastroboss: { scene: 'mkitchen', name: '第八厨房', intro: '総料理長AI「ガストロノミカ」。百八の鍋を、一つの頭で振っている。', reward: 1500,
    enemies: () => [moonFoe('d1', '鍋番ドローンA', 'drone', { hp: 190, atk: 32, mems: ['hashi'] }), ...(ps() >= 3 ? [moonFoe('d2', '鍋番ドローンB', 'drone', { hp: 190, atk: 32, mems: ['frost'] })] : []),
      foe('boss', '総料理長AIガストロノミカ', 'gastro', { boss: true, fxk: 'slash', xp: 900, hp: big(1000, 1200, 1450), atk: 35, def: 18, spd: 12, fw: 40, mems: ['gastro', 'hashi', 'armor'], pdur: 110, insts: { gastro: { rar: 4, afx: [{ k: 'tec', v: 6 }, { k: 'pow', v: 18 }, { k: 'cool', v: -20 }, { k: 'seep', v: 50 }] }, hashi: { rar: 4, afx: [{ k: 'atk', v: 4 }, { k: 'spd', v: 3 }, { k: 'pow', v: 18 }, { k: 'hp', v: 25 }] }, armor: { rar: 4, afx: [{ k: 'def', v: 4 }, { k: 'hp', v: 25 }, { k: 'tec', v: 6 }, { k: 'cool', v: -15 }] } } })], objs: moonObjs },
  chairboss: { scene: 'office', name: '会長室', intro: '会長の護衛、自律給仕機「満漢全席号」。円卓そのものが、立ち上がった。', reward: 2000,
    enemies: () => [foe('boss', '自律給仕機 満漢全席号', 'chair', { boss: true, xp: 1200, hp: big(2000, 2500, 3000), atk: 42, def: 20, spd: 9, fw: 35, mems: ['banquet', 'tongue', 'armor'], pdur: 120, insts: { banquet: { rar: 4, afx: [{ k: 'atk', v: 4 }, { k: 'pow', v: 18 }, { k: 'hp', v: 25 }, { k: 'def', v: 4 }] }, tongue: { rar: 4, afx: [{ k: 'tec', v: 6 }, { k: 'seep', v: 50 }, { k: 'spd', v: 3 }, { k: 'cool', v: -20 }] }, armor: { rar: 4, afx: [{ k: 'def', v: 4 }, { k: 'hp', v: 25 }, { k: 'atk', v: 4 }, { k: 'spd', v: 2 }] } } })], objs: () => [{ id: 'car', name: '会長の執務机', act: '盾にする', desc: '自分の被ダメージを3ターン半減', tgt: 'none' }, { id: 'neon', name: '地球儀型ランプ', act: '叩きつける', desc: '単体に電撃の大ダメージ', tgt: 'enemy' }] },
  /* 第六章 */
  f1guard: { scene: 'factory', name: '臨海工場群 送電所', intro: 'アーコロジーへの送電を守る、マンカンの重警備。', reward: 1200,
    enemies: () => [moonFoe('a1', '送電所警備員A', 'agent', { hp: 340, atk: 40, mems: ['armor'] }), moonFoe('a2', '送電所警備員B', 'agent', { hp: 340, atk: 40, mems: ['mirror'] }), sentinel('t1', '送電所セントリー'), ...(ps() >= 4 ? [moonFoe('d1', '送電所ドローン', 'drone', { hp: 260, atk: 36, mems: ['shock'] })] : [])].map(u => { if (u.kind === 'turret') { u.maxhp = u.hp = 420; u.atk = 36; } return u; }), objs: factoryObjs },
  f2titan: { scene: 'minato', name: 'ミナトミライ廃園 観覧車の頂上', intro: '中継アンテナを守る、試作機タイタンの二号機。', reward: 1200,
    enemies: () => [foe('boss', '試作機タイタン二号機', 'titan', { boss: true, xp: 900, hp: big(2600, 3300, 4000), atk: 45, def: 21, spd: 7, fw: 15, mems: ['missile', 'glass', 'mirror'], pdur: 110 })], objs: minatoObjs },
  finalboss: { scene: 'kannai', name: 'カンナイ・アーコロジー 頂上', get intro() { return '会長が、自分の舌の端子に配信ケーブルを挿した。' + (CH.G.fin && CH.G.fin.f1 ? '送電が止まり、塔の照明は半分落ちている。' : '') + (CH.G.fin && CH.G.fin.f2 ? '中継アンテナを失い、会長の書き換えは届きにくい。' : ''); }, reward: 0,
    enemies: () => { const f = CH.G.fin || {}; return [foe('boss', 'マンカン会長', 'final', { boss: true, xp: 2500, hp: Math.round(big(2000, 2500, 3000) * (f.f1 ? 0.8 : 1)), atk: 42, def: 20, spd: 11, fw: 50, mems: f.f2 ? ['banquet', 'mirror'] : ['banquet', 'tongue', 'mirror'], pdur: 130 })]; }, objs: kannaiObjs },
};
Object.assign(ENC, MOONENC);

const CH5 = {
  m13: { story: true, loc: 'mdock', label: '静かの海に降りる', sub: '月面本社の搬入口', cond: S => S.flags.moon, nodes: {
    start: { t: [], dyn: S => {
      const ride = { rocket: ['ガンテツの貨物ロケットは、荷物と一緒にチャンカーたちを月面に吐き出した。着地の衝撃で、積み荷の鉄骨が三本折れた。', ['ガンテツ', '……鉄骨は経費で落とせ']], massdriver: ['マスドライバーの砲弾型カプセルは、静かの海の砂に、半分埋まって止まった。', '湯の花の匂いが、まだ少し残っていた。'], ship: ['キャプテン・ヒジキの船は、海から宇宙まで行けた。帰れるかどうかは、まだ誰も知らない。', ['キャプテン・ヒジキ', '着いたぞ! ……たぶん月だ']] }[S.keys.ride[0]];
      const pass = { boarding: ['搬入口の警備員に、搭乗券を見せた。ツキミ部長の承認印を見て、警備員は敬礼した。'], invitation: ['搬入口の警備員に、招待状を見せた。会長の晩餐会の客として、扉が開いた。'] }[S.keys.pass[0]];
      return ride.concat(pass, ['月面本社は、静かの海の上に建てられた、巨大な厨房だった。地球に向いた壁一面に、無数の配信アンテナが並んでいる。', 'ゲートを抜けた先で、通報を受けた警備隊が待ち構えていた。']);
    }, battle: { enc: 'moonguard', win: 'w', lose: 'l' } },
    l: { t: ['与圧室の陰に逃げ込んだ。月の夜は長い。'], end: true, noDone: true },
    w: { fx: S => { S.flags.m13 = 1; S.wanted++; }, t: ['警備隊は、低重力の中をふわりと倒れていった。', '奥へ続く通路の案内板に、「第八厨房」とある。', '手配度が上がった。'], end: true } } },
  m14: { story: true, loc: 'mkitchen', label: '第八厨房の総料理長', sub: '百八の鍋が並ぶ厨房', cond: S => S.flags.m13, nodes: {
    start: { t: [], dyn: S => ({ stars: ['ムツコの図面どおり、第八厨房の換気ダクトは人が通れる太さだった。四十年分の油汚れを抜けると、厨房の天井裏に出た。'], manifest: ['配送伝票の番号を読み上げると、配送カートが勝手に厨房まで運んでくれた。荷物の中身として。'] }[S.keys.map[0]]).concat([
      '第八厨房には、百八の中華鍋が、地球に向けて円形に並んでいた。鍋の中は空っぽだった。鍋はただ、振られる動作だけを繰り返している。',
      '鍋一つひとつに、配信ケーブルが繋がっている。振るたびに、「炒めた実感」が地球へ送信されていた。',
      ['ガストロノミカ', '侵入者を検知。味覚評価、不能。あなたがたの舌は、最適化されていない'],
      ['ガストロノミカ', '会長のご命令です。全人類の舌に、同じ一皿を。あなたがたも、例外ではありません'],
    ]), battle: { enc: 'gastroboss', win: 'w', lose: 'l' } },
    l: { t: ['換気ダクトに逃げ戻った。鍋を振る音が、壁越しにまだ聞こえる。'], end: true, noDone: true },
    w: { fx: S => { S.flags.m14 = 1; S.wanted++; }, t: ['総料理長AIが沈黙すると、百八の鍋が一斉に止まった。', '静かになった厨房の奥に、一枚の扉があった。表札には「会長室」。', '手配度が上がった。'], end: true } } },
  m15: { story: true, loc: 'moffice', label: '会長室の扉', sub: '地球が窓いっぱいに見える部屋', cond: S => S.flags.m14, nodes: {
    start: { t: [
      '会長室の窓には、地球が一つ、丸ごと収まっていた。窓の前の円卓に、痩せた老人が一人で座っていた。',
      '円卓の上には、空の皿が一枚。',
      ['マンカン会長', 'よく来た。……その舌の端子に挿さっているものの匂いがする。朗々飯店だな'],
      ['マンカン会長', '若い頃、遠くからあの店に通った。データでは足りなかった。皿の上の、あの一杯でなければ'],
      ['マンカン会長', 'だが、店は消えた。わしの舌も、年と共に何も感じなくなった。だから作ったのだ。誰もが、いつでも、あの実感を得られる世界を'],
      ['マンカン会長', '全人類に、最適な一皿を。……あの一皿を、全員に。それの、何がいけない'],
    ], c: [{ t: '「全員が同じ皿を旨いと思うのは、旨いとは言わない」', to: 'b' }, { t: '「あんたが食べたかったのは、データじゃないはずだ」', to: 'b' }, { t: '黙って、空の皿を見る', to: 'b' }] },
    b: { t: [['マンカン会長', '……そうかもしれん。だが、もう止まらん'], '円卓が軋み、脚を生やして立ち上がった。'], battle: { enc: 'chairboss', win: 'w', lose: 'l' } },
    l: { t: ['会長室から放り出された。扉の向こうで、会長が窓の地球を見ている。'], end: true, noDone: true },
    w: { fx: S => { S.flags.m15 = 1; S.wanted++; }, t: [
      '満漢全席号が崩れ落ちたとき、会長の姿はなかった。窓の外を、一隻のシャトルが地球へ降りていく。',
      '机の上に、手書きのメモが残っていた。「配信は、地上の塔から行う。カンナイ・アーコロジーの頂上で。全人類同時に」',
      '手配度が上がった。',
    ], end: true } } },
  mfarm: { loc: 'mdock', repeat: true, label: '資材置き場の巡回を叩く', sub: '何度でも戦える。月の装備が手に入る', cond: S => S.flags.moon, nodes: {
    start: { t: ['資材置き場の影から、巡回警備がふわりと現れた。'], battle: { enc: 'farmMoon', win: 'w', lose: 'l' } },
    w: { t: ['警備員は、ゆっくりと砂の上に倒れた。月では、倒れるのにも時間がかかる。'], end: true }, l: { t: ['与圧室に逃げ込んだ。'], end: true } } },
  mwindow: { loc: 'mdock', label: '地球の見える窓', sub: '搬入口の休憩所に、大きな窓がある', cond: S => S.flags.moon, nodes: {
    start: { fx: S => { partyRel(S, 2); }, t: [], dyn: S => ['休憩所の窓から、地球が見えた。ネオヨコハマは、指先ほどの光の点だった。'].concat(S.party.includes('mutsuko') ? [['ムツコ', '……四十年前と、同じ色ね'] ] : []).concat(S.party.length > 1 ? ['誰も、しばらく何も言わなかった。', '同行している仲間との仲が、大きく深まった。'] : ['一人で見る地球も、悪くなかった。']), end: true } } },
  mcanteen: { loc: 'mkitchen', label: '月面社員食堂', sub: '低重力で、粥が皿から浮いている', cond: S => S.flags.m13, nodes: {
    start: { t: ['月面社員食堂では、粥が皿から浮かないように、全員が蓋付きの椀を使っていた。'], check: { stat: 'talk', lo: 7, hi: 10, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['月面社員に紛れ込もうとしたが、蓋の開け方が分からず、粥が天井まで浮いた。'], end: true, noDone: true },
    o: { fx: S => { give(S, mkInst('lowg', 3, null, true)); }, t: ['食堂の社員が、こっそり禁制品の「月面重力.low」を譲ってくれた。「地球に帰ったら、使い道がないから」。'], end: true },
    g: { fx: S => { give(S, mkInst('lowg', 3, null, true)); give(S, mkInst('steep', 3, null, true)); }, t: ['食堂の社員たちが集まってきて、地球の食べ物の話をせがんだ。話の礼に、禁制品のメモリを二本もらった。'], end: true } } },
};

/* ---------- 第六章: 全人類同時配信 ---------- */
const CH6 = {
  m16: { anywhere: true, auto: true, label: '帰還', cond: S => S.flags.m15 && !S.flags.m16 && !(LOCS[S.loc] && LOCS[S.loc].region === 'moon'), nodes: {
    start: { fx: S => { S.flags.m16 = 1; }, t: [
      '地球に戻ると、ネオヨコハマじゅうの広告が、同じ文字を映していた。「全人類同時配信まで、あと少し。皆さま、舌の端子をご準備ください」',
      'カンナイ・アーコロジーの頂上に、会長がいる。正面から行けば、塔の防衛は厚い。',
      ['リン(通信)', '塔の電源はカワサキの送電所から来てる。配信の中継は、ミナトミライの観覧車。……それに、一人で行く気? 仲間を集めなさい。鳩の巣、開けておくから'],
    ], end: true, noDone: true } } },
  f1: { story: true, guide: S => S.flags.m16 && !S.flags.f1 && !S.flags.cleared, loc: 'kw', label: '送電所を止める', sub: 'アーコロジーへの送電を断つ', cond: S => S.flags.m16 && !S.flags.f1, nodes: {
    start: { t: [], dyn: S => (member(S, 'gantetsu') ? [['ガンテツ', 'うちの工場の送電線だ。止め方なら知ってる。警備さえ片付けりゃな']] : ['送電所の主制御盤は、重警備の奥にある。']), battle: { enc: 'f1guard', win: 'w', lose: 'l' } },
    l: { t: ['送電所から撤退した。'], end: true, noDone: true },
    w: { fx: S => { S.flags.f1 = 1; }, t: ['主制御盤のレバーを下ろすと、遠くのアーコロジーの照明が、上から半分消えた。'], end: true } } },
  f2: { story: true, guide: S => S.flags.m16 && !S.flags.f2 && !S.flags.cleared, loc: 'minato', label: '観覧車のアンテナを奪う', sub: '配信の中継点を押さえる', cond: S => S.flags.m16 && !S.flags.f2, nodes: {
    start: { t: [], dyn: S => (member(S, 'zero') ? [['ゼロカロリー', 'ここは、空腹同盟が配信したアンテナだ。……今度は、止めるために登る']] : ['観覧車の頂上に、中継アンテナが増設されていた。その下で、鉄の脚が立ち上がる。']), battle: { enc: 'f2titan', win: 'w', lose: 'l' } },
    l: { t: ['観覧車の鉄骨を伝って、地上に逃げた。'], end: true, noDone: true },
    w: { fx: S => { S.flags.f2 = 1; }, t: ['中継アンテナを、観覧車の頂上から引きちぎった。会長の書き換えは、もう街の隅までは届かない。'], end: true } } },
  f3: { story: true, guide: S => S.flags.m16 && !S.flags.f3 && !S.flags.cleared, loc: 'noge', scene: 'bar', label: '鳩の巣に仲間を集める', sub: '一人では行かない', cond: S => S.flags.m16 && !S.flags.f3, nodes: {
    start: { fx: S => { S.flags.f3 = 1; S.rallied = S.roster.length; }, t: [], dyn: S => ['鳩の巣に、これまでに出会った全員が集まった。カウンターに入りきらず、半分は路地に立っていた。', `集まった仲間は、チャンカーを入れて${S.roster.length}人。`].concat(S.roster.length >= 12 ? ['路地の端まで、知った顔で埋まっていた。誰かが乾杯の音頭を取り、誰も酒を持っていないことに気づいて、全員で笑った。', '最後の戦いで、全員が全力を出せる気がした。'] : S.roster.length >= 6 ? ['十分な数だった。少なくとも、背中を預ける相手には困らない。'] : ['少ない。だが、少ないなりの結束がある。']), end: true } } },
  final: { story: true, loc: 'kannai', label: '塔の頂上', sub: '会長が、配信ケーブルを握っている', cond: S => S.flags.m16 && !S.flags.cleared && ((S.flags.f1 ? 1 : 0) + (S.flags.f2 ? 1 : 0) + (S.flags.f3 ? 1 : 0)) >= 2, nodes: {
    start: { t: [], dyn: S => ['カンナイ・アーコロジーの頂上は、巨大な配信アンテナの根元だった。夜風が強い。', '会長は、自分の舌の端子に配信ケーブルを挿し、街を見下ろしていた。', ['マンカン会長', '来たか。わしの舌は、もう何も感じん。だから、全員の実感を借りる。全員の舌で、あの一皿を味わうのだ'], ['マンカン会長', 'そのメモリを渡せ。それが最後の鍵だ']].concat(S.rallied >= 12 ? ['背後で、集まった仲間たちの気配がした。塔の下には、まだ大勢が待っている。'] : []), battle: { enc: 'finalboss', win: 'w', lose: 'l' } },
    l: { t: ['塔の非常階段を転げ落ちた。頂上のアンテナが、ゆっくりと光を強めている。'], end: true, noDone: true },
    w: { t: [
      '会長は膝をつき、舌の端子からケーブルを抜いた。配信アンテナの光が、点滅したまま止まっている。',
      ['マンカン会長', '……好きにしろ。そのメモリで、何を配るか。あるいは、何も配らないか'],
      '配信ケーブルの先が、チャンカーの舌の端子に向いていた。プロトコルチャーハン・クラックスピードは、まだそこに挿さっている。',
    ], c: [
      { t: '会長の「最適化」を配信する', sub: '全員が、同じ一皿を旨いと感じる世界', to: 'e', fx: S => { S.ending = 'opt'; } },
      { t: '本物の実感を、一度だけ全員に配る', sub: '一度きり。その先は、それぞれの舌に任せる', to: 'e', fx: S => { S.ending = 'once'; } },
      { t: '朗々飯店を開く。データは店の奥にしまう', sub: '食べたい者は、店に来ればいい', to: 'e', fx: S => { S.ending = 'shop'; } },
      { t: '何も配らない。最後の一口を、自分で食べる', sub: 'データは、一人の舌の上で終わる', to: 'e', fx: S => { S.ending = 'none'; } },
      { t: '料理長に、会長のための一皿を作ってもらう', sub: 'データではない、本物の炒飯', to: 'e', cond: S => !!member(S, 'chef'), fx: S => { S.ending = 'chef'; } },
    ] },
    e: { fx: S => { S.flags.cleared = 1; S.flags.endSeen = 1; }, t: ['(エンディングへ)'], ending: true } } },
};

/* ---------- デート(仲間なら誰でも誘える。街が動くまでは1人1回) ---------- */
const DATESPOT = {
  minato: ['止まった観覧車', '観覧車の一番上のゴンドラに、二人で座った。ネオヨコハマの夜景が、足元にこぼれていた。'],
  hk: ['湯けむり横丁の足湯', '足湯に並んで座った。湯けむりの向こうで、山の端に月が出ていた。'],
  gate7: ['麺処グラヴィティ・ウェル', 'カウンターに並んで座り、黙って混ぜた。寸胴型のロボットが、二人分の水を置いていった。'],
  chinatown: ['善隣門の屋台', '粥の屋台で、二人で一つの椀をつついた。老婆は、客の顔を見ずに二本目のレンゲを置いた。'],
  noge: ['スナック「止まり木」', 'ボックス席に二人きり。ママは気を利かせて、デュエット曲だけを予約画面に並べた。'],
  ks: ['天文台の屋上', '天文台の屋上に寝転んで、月を見た。あそこに、あの厨房がある。'],
  yamate: ['洋館の庭', '高台の洋館の庭を、勝手に歩いた。薔薇は本物だった。この街では、それだけで奇跡だった。'],
  kg: ['メガモールの屋上', '地上には屋上がないはずのメガモールに、一か所だけ屋上へ出る扉があった。終わらない閉店のアナウンスが、遠くで鳴っていた。'],
  mdock: ['地球の見える窓', '月面の休憩所の窓から、二人で地球を見た。ネオヨコハマは、指先ほどの光だった。'],
};
const LIKES = {
  kill: ['ks', '「星って、撃っても当たらないから好き」'], aur: ['yamate', '「薔薇は、騎士の誓いに似ている。棘ごと愛でるものだ」'], som: ['gate7', '「……データにならない味。保存しておく」'],
  hong: ['noge', '「あんたの歌、診察が必要ね」'], pedal: ['minato', '「高いとこ、好きなんだよ。どこにでも届けられそうで」'], wan: ['chinatown', '「この屋台の粥は、昔と同じ味がする」'],
  xiao: ['chinatown', '「お客様。今日はわたくしが、お客様です」'], zero: ['gate7', '「……これ、本物だ。全部、本物だ」'], gantetsu: ['hk', '「湯はいい。鉄も人も、熱いうちに休ませるもんだ」'],
  chef: ['gate7', '「……いい火加減だ。この店の主は、腕がいい」'], lin: ['noge', '「ここ、値段の付かない夜が過ごせる店なのよ」'], tsukimi: ['yamate', '「品質に、一点の曇りもありません。……この庭も、あなたも」'],
  glassjaw: ['minato', '「ここから落ちたら、顎どころじゃねえな。……悪くねえ」'], hijiki: ['mdock', '「がはは! 星の海ってのは、こういうのを言うんだ」'], whiteglove: ['yamate', '「お仕えしていた頃は、この庭を眺める暇もありませんでした」'],
  yumori: ['hk', '「……ユ……アタタカイ」'], mutsuko: ['mdock', '「四十年前と、同じ色。でも今日は、一人じゃない」'], tenin: ['kg', '「天井がない屋上……ここ、本当にモールですか?」'],
  satou: ['gate7', '「……甘い。いや、しょっぱい。分かる。全部分かる」'], nanashi: ['ks', 'ナナシのセンサーが、星に合わせてゆっくり瞬いた。'],
};
const DATE = Object.fromEntries(Object.entries(DATESPOT).map(([loc, [spot, scene]]) => ['date_' + loc, { loc, rom: true, label: `${spot}へ誘う`, sub: '仲間と二人で出かける。仲が深まる', cond: S => S.roster.some(u => u.id !== 'hero' && dateOk(S, u.id)), nodes: {
  start: { t: [`${spot}へ、誰を誘う?`], cf: S => S.roster.filter(u => u.id !== 'hero' && dateOk(S, u.id)).map(u => ({ t: u.name, sub: rom(S, u.id).bond === 'lover' ? '恋人' : rom(S, u.id).bond === 'partner' ? '相棒' : `仲 ${S.rel[u.id] || 0}`, to: 'go', fx: S2 => { S2._date = u.id; S2.dateW = S2.dateW || {}; S2.dateW[u.id] = S2.wanted; const fav = LIKES[u.id] && LIKES[u.id][0] === loc; rel(S2, u.id, fav ? 2 : 1); S2._fav = fav; memo(S2, u.id, `${spot}へ二人で出かけた${fav ? '(お気に入りの場所だった)' : ''}`); } })).concat([{ t: 'やめておく', sub: '', to: 'no' }]) },
  no: { t: ['今日は、一人で歩くことにした。'], end: true, noDone: true },
  go: { t: [], dyn: S => { const id = S._date, n = nm(id), R = rom(S, id); return [scene.replace('二人', `${n}と二人`)].concat(S._fav ? [[n, LIKES[id][1].replace(/^「|」$/g, '')], `${n}は、ここが好きらしい。いつもより、ずっと仲が深まった。`] : [R.bond === 'lover' ? `${n}は、何も言わずに、少しだけ肩を寄せてきた。` : R.bond === 'partner' ? `${n}とは、言葉が要らなかった。` : `${n}は、少し照れくさそうだった。`, `${n}との仲が深まった。`]); }, end: true, noDone: true } } }]));
const dateOk = (S, id) => !!ROM[id] && member(S, id) && (S.dateW || {})[id] !== S.wanted && !S.left[id];

/* ---------- サブクエスト(地域をまたぐもの) ---------- */
const SUB2 = {
  stall1: { loc: 'noge', label: '屋台を建て直したい老人', sub: '焼け落ちた屋台の前で、老人が座りこんでいる', cond: S => FREE(S) && !S.flags.stall, nodes: {
    start: { t: ['高架下に、焼け落ちた屋台の骨組みがあった。老人が、その前に座りこんでいる。', ['屋台の老人', '回収班に焼かれた。建て直すには、カワサキの鉄と、ハコネの湯の花と、カシワの野菜が要る。わしの脚じゃ、どこにも行けん']], c: [{ t: '「集めてくる」', to: 'y' }, { t: '「悪いが、今は無理だ」', to: 'n' }] },
    n: { t: ['老人は、黙って骨組みを撫でていた。'], end: true, noDone: true },
    y: { fx: S => { S.flags.stall = 1; S.flags.stallItems = {}; }, t: ['カワサキの鉄、ハコネの湯の花、カシワの野菜。三つを集めて、ノゲに戻ることになった。'], end: true } } },
  stall_kw: { loc: 'kw', label: '屋台用の鉄を分けてもらう', sub: 'ノゲの屋台の材料', cond: S => S.flags.stall === 1 && !S.flags.stallItems.kw, nodes: {
    start: { t: ['工場の端材置き場で、屋台一軒分の鉄骨を見繕った。'], check: { stat: 'pow', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'o' } },
    f: { t: ['鉄骨は重すぎた。腕力のある仲間を連れてこよう。'], end: true, noDone: true },
    o: { fx: S => { S.flags.stallItems.kw = 1; }, t: ['鉄骨を担いで、工場の門を出た。現場監督が「屋台か。いいな」とだけ言った。'], end: true } } },
  stall_hk: { loc: 'hk', label: '湯の花を分けてもらう', sub: 'ノゲの屋台の材料', cond: S => S.flags.stall === 1 && !S.flags.stallItems.hk, nodes: {
    start: { fx: S => { S.flags.stallItems.hk = 1; }, t: ['女将が、湯の花を一袋分けてくれた。「スープに入れると、まろやかになるのよ」'], end: true } } },
  stall_ks: { loc: 'ks', label: '本物の野菜を分けてもらう', sub: 'ノゲの屋台の材料', cond: S => S.flags.stall === 1 && !S.flags.stallItems.ks, nodes: {
    start: { t: ['家庭菜園の老人に事情を話した。'], check: { stat: 'talk', lo: 5, hi: 8, fail: 'f', ok: 'o', great: 'o' } },
    f: { t: ['「わしの野菜を、よそ者に?」と、断られた。話の上手い仲間を連れてこよう。'], end: true, noDone: true },
    o: { fx: S => { S.flags.stallItems.ks = 1; }, t: ['老人は、葱と白菜を新聞紙に包んでくれた。「土で育てたやつだ。端子には何も書き込まれんがな」'], end: true } } },
  stall2: { loc: 'noge', label: '屋台の材料を届ける', sub: '鉄、湯の花、野菜', cond: S => S.flags.stall === 1 && S.flags.stallItems.kw && S.flags.stallItems.hk && S.flags.stallItems.ks, nodes: {
    start: { fx: S => { S.flags.stall = 2; give(S, mkInst('steep', 4, [{ k: 'hp', v: 25 }, { k: 'tec', v: 6 }, { k: 'cool', v: -20 }, { k: 'seep', v: 50 }], true)); }, t: ['三日後、高架下に新しい屋台が立った。暖簾には「三つの味」。', ['屋台の老人', '鉄の屋根、湯の花の出汁、土の野菜。三つの街の味だ。いつでも食いに来い'], '一点物の「三分間待機.cup」を手に入れた。屋台「三つの味」で食事ができるようになった。'], end: true } } },
  stall3: { loc: 'noge', repeat: true, label: '屋台「三つの味」', sub: '仲間と食べると仲が深まる。修復ジェルももらえる。街が動くまでは1回', cond: S => S.flags.stall === 2 && !(S.scav['stall' + S.wanted]), nodes: {
    start: { fx: S => { S.scav['stall' + S.wanted] = 1; partyRel(S, 1); S.items.gel += 2; }, t: ['湯の花の出汁に、本物の葱が浮いていた。老人は、おまけに修復ジェルを二本つけてくれた。「回収班に焼かれた時のために、取っておけ」', '同行している仲間との仲が深まった。修復ジェルを2本手に入れた。'], end: true } } },
  ghost: { loc: 'pier', label: 'ジャンク山の怪談', sub: '夜になると、山の奥で誰かが泣いているという', cond: FREE, nodes: {
    start: { t: ['ジャンク山の奥から、夜な夜な、すすり泣くような音がするという。'], check: { stat: 'obs', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['音の出どころは分からなかった。風の音だったのかもしれない。'], end: true, noDone: true },
    o: { t: ['冷蔵庫の山の下に、古い家庭用ロボットが埋まっていた。泣き声は、壊れたスピーカーの音だった。ロボットは、こちらに気づくと、両腕を振り上げた。'], battle: { enc: 'ghostfight', win: 'w', lose: 'l' } },
    g: { t: ['冷蔵庫の山の下に、古い家庭用ロボットが埋まっていた。電源を切る前に、記録を読んだ。持ち主の家族が引っ越した日から、ずっと「おかえり」を待っていた。', 'ロボットは、こちらに気づくと、両腕を振り上げた。'], battle: { enc: 'ghostfight', win: 'w', lose: 'l' } },
    l: { t: ['ジャンク山から逃げ出した。泣き声は、まだ続いている。'], end: true, noDone: true },
    w: { fx: S => { give(S, mkInst('decoy', 3, null, true)); }, t: ['ロボットの胸のスピーカーが、最後に一度だけ「おかえり」と言った。', '禁制品の「ホロデコイ」を手に入れた。'], end: true } } },
  portrait1: { loc: 'yamate', label: '消えた肖像画', sub: '洋館の奥様が、盗まれた絵を探している', cond: FREE, nodes: {
    start: { t: [['奥様', '亡くなった主人の肖像画が盗まれたの。闇市に流れたって噂よ。取り戻してくれたら、お礼は弾むわ']], c: [{ t: '「探す」', to: 'y' }, { t: '「断る」', to: 'n' }] },
    n: { t: ['奥様は、空いた壁を見つめていた。'], end: true, noDone: true },
    y: { fx: S => { S.flags.portrait = 1; }, t: ['ホンモク・ドックの闇市を当たることになった。'], end: true } } },
  portrait2: { loc: 'honmoku', label: '闇市の肖像画', sub: '露店の奥に、額縁が立てかけてある', cond: S => S.flags.portrait === 1, nodes: {
    start: { t: ['闇市の露店に、立派な額縁の肖像画があった。描かれた男は、マンカン会長に少し似ていた。', ['露店の主', '800crだ。それとも、話をつけるかい?']], c: [{ t: '800crで買う', sub: '', to: 'buy', dis: S => S.credits < 800 }, { t: '話をつける', sub: '話術', to: 'talk' }] },
    buy: { fx: S => { S.credits -= 800; S.flags.portrait = 2; }, t: ['肖像画を抱えて、ヤマテへ戻ることにした。'], end: true },
    talk: { t: [], check: { stat: 'talk', lo: 7, hi: 10, fail: 'tf', ok: 'to', great: 'to' } },
    tf: { t: ['話はこじれた。買うしかなさそうだ。'], end: true, noDone: true },
    to: { fx: S => { S.flags.portrait = 2; }, t: ['「盗品だと知れたら、ヤマテの用心棒が来るぞ」。店主は肩をすくめて、額縁を差し出した。'], end: true } } },
  portrait3: { loc: 'yamate', label: '肖像画を返す', sub: '洋館の奥様が待っている', cond: S => S.flags.portrait === 2, nodes: {
    start: { fx: S => { S.flags.portrait = 3; S.credits += 2000; give(S, mkInst('charm', 3, null, true)); }, t: ['奥様は、額縁を壁に掛け直して、長いこと見上げていた。', ['奥様', '主人はね、マンカンの会長の弟だったの。兄は月へ行って、帰ってこなかった。……ありがとう'], '2000crと禁制品の「誘惑香.prf」を手に入れた。'], end: true } } },
  ganso: { loc: 'gate7', label: '元祖論争', sub: '路地の入口で、客引きアンドロイドが言い争っている', cond: FREE, nodes: {
    start: { t: ['路地の入口で、二体の客引きアンドロイドが言い争っていた。', ['元祖の客引き', '弊社こそ元祖です。創業三万年の伝統があります'], ['本家の客引き', '弊社以外はすべて偽物です。創業三万一年の伝統があります'], '通行人は、誰も止めようとしない。'], check: { stat: 'talk', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['仲裁に入ったら、両方から「お客様は元祖派ですか、本家派ですか」と詰め寄られた。逃げた。'], end: true },
    o: { fx: S => { S.credits += 300; }, t: ['「どちらも、人類が小麦を育てる前から営業している。つまり、どちらも同じくらい嘘だ」と言うと、二体は黙った。', '口止め料として、両方から150crずつもらった。'], end: true },
    g: { fx: S => { S.credits += 300; give(S, mkInst('coupon', 3, null, true)); }, t: ['「本物は、路地の奥の暖簾の店だ」と言うと、二体は顔を見合わせ、黙って持ち場に戻っていった。', '口止め料の300crと、禁制品の「割引クーポン.exe」を受け取った。'], end: true } } },
  stamp: { loc: 'hk', label: '湯めぐりスタンプラリー', sub: '女将が、スタンプ帳を配っている', cond: S => FREE(S) && !S.flags.stamp, nodes: {
    start: { fx: S => { S.flags.stamp = 1; S.flags.stamps = {}; }, t: [['女将', '三つの湯に浸かったら、いいものをあげるわ。ハコネの共同浴場、ノゲの銭湯、それから……月の無重力風呂'], ['女将', '月はね、亭主が昔、一度だけ行ったのよ。本当にあるんだから'], 'スタンプ帳をもらった。'], end: true } } },
  stamp_hk: { loc: 'hk', label: '共同浴場でスタンプを押す', sub: '湯めぐり 1/3', cond: S => S.flags.stamp === 1 && !S.flags.stamps.hk, nodes: { start: { fx: S => { S.flags.stamps.hk = 1; }, t: ['共同浴場の番台で、湯けむりの形のスタンプを押してもらった。'], end: true } } },
  stamp_noge: { loc: 'noge', label: '銭湯「高架湯」でスタンプを押す', sub: '湯めぐり', cond: S => S.flags.stamp === 1 && !S.flags.stamps.noge, nodes: { start: { fx: S => { S.flags.stamps.noge = 1; }, t: ['高架下の銭湯は、電車が通るたびに湯が揺れた。番台で、線路の形のスタンプを押してもらった。'], end: true } } },
  stamp_moon: { loc: 'mdock', label: '無重力風呂でスタンプを押す', sub: '湯めぐり', cond: S => S.flags.stamp === 1 && !S.flags.stamps.moon, nodes: { start: { fx: S => { S.flags.stamps.moon = 1; }, t: ['月面本社の社員用浴場では、湯が球になって浮いていた。中に頭だけ突っ込むのが、正しい入り方らしい。', '番台のロボットが、月の形のスタンプを押した。'], end: true } } },
  stamp_end: { loc: 'hk', label: 'スタンプ帳を見せる', sub: '三つ揃った', cond: S => S.flags.stamp === 1 && S.flags.stamps.hk && S.flags.stamps.noge && S.flags.stamps.moon, nodes: {
    start: { fx: S => { S.flags.stamp = 2; give(S, mkInst('steam', 4, [{ k: 'tec', v: 6 }, { k: 'hp', v: 25 }, { k: 'cool', v: -20 }, { k: 'def', v: 4 }], true)); }, t: [['女将', '本当に月まで行ったの! ……亭主が見たら、泣いて喜ぶわ'], '一点物の「蒸気噴射弁」を手に入れた。'], end: true } } },
  smuggle1: { loc: 'honmoku', label: '密輸品の配達', sub: '闇市の元締めが、運び屋を探している', cond: FREE, nodes: {
    start: { t: [['闇市の元締め', 'この箱を、ネオ・トーキョーのスペースポートまで。中身は聞くな。月行きの便に紛れ込ませる']], c: [{ t: '引き受ける', to: 'y' }, { t: '断る', to: 'n' }] },
    n: { t: ['元締めは、別の運び屋に声をかけた。'], end: true, noDone: true },
    y: { fx: S => { S.flags.smuggle = 1; }, t: [], dyn: S => ['重い箱を受け取った。中で、何かが小さく唸っている。'].concat(S.party.includes('pedal') ? [['ペダル', '貸しな。荷物運びは、あたしの仕事だ']] : []), end: true } } },
  smuggle2: { loc: 'ntport', label: '箱を届ける', sub: '出発ロビーの貨物カウンターへ', cond: S => S.flags.smuggle === 1, nodes: {
    start: { t: ['貨物カウンターに箱を置くと、係員が中身も見ずに受け取った。'], check: { stat: 'obs', lo: 6, hi: 9, fail: 'o', ok: 'o', great: 'g' } },
    o: { fx: S => { S.flags.smuggle = 2; S.credits += 1200; }, t: [], dyn: S => ['報酬の1200crが振り込まれた。'].concat(S.party.includes('pedal') ? ['ペダルが「届けた」と言った。それで十分だった。'] : []), end: true },
    g: { fx: S => { S.flags.smuggle = 2; S.credits += 1200; give(S, mkInst('magnet', 3, null, true)); }, t: ['係員が箱を受け取る直前、隙間から中身が見えた。月面本社の社員の「最適化前」の味覚データだった。誰かが、それを月に返そうとしている。', '報酬の1200crと、箱に添えられていた禁制品の「磁力グローブ」を手に入れた。'], end: true } } },
  roomba: { loc: 'mdock', label: '迷子の掃除ロボ', sub: '資材置き場で、円盤型のロボットがぐるぐる回っている', cond: S => S.flags.moon, nodes: {
    start: { fx: S => { S.flags.roomba = 1; }, t: ['資材置き場の隅で、円盤型の掃除ロボットが同じ場所をぐるぐる回っていた。裏に「メガモール 食品フロア」のシール。', '配送伝票に紛れて、月まで来てしまったらしい。'], c: [{ t: '連れて帰る', to: 'y' }] },
    y: { t: ['掃除ロボットを抱えた。メガモールの食品フロアに返してやろう。'], end: true } } },
  roomba2: { loc: 'kg', label: '掃除ロボを返す', sub: 'メガモールの案内所へ', cond: S => S.flags.roomba === 1, nodes: {
    start: { fx: S => { S.flags.roomba = 2; give(S, mkInst('lostfound', 4, [{ k: 'tec', v: 6 }, { k: 'spd', v: 3 }, { k: 'seep', v: 50 }, { k: 'hp', v: 25 }], true)); }, t: ['案内所の床に置くと、掃除ロボットは迷わず食品フロアの方へ走っていった。', '案内所の係員が、お礼にと、落とし物センターの「持ち主不明」の棚から一本くれた。', '一点物の「落とし物センター」を手に入れた。'], end: true } } },
  karaoke2: { loc: 'noge', label: 'ノゲ横丁カラオケ大会', sub: 'スナック「止まり木」主催。常連なら出られる', cond: S => FREE(S) && !S.flags.kking && Object.keys(S.scav).filter(k => k.startsWith('kara')).length >= 3, nodes: {
    start: { t: ['ノゲ横丁じゅうのスナックの常連が、高架下の特設ステージに集まった。審査員はママ三人。'], check: { stat: 'talk', lo: 8, hi: 11, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['二番の歌詞を忘れた。会場は温かい拍手で包まれた。それが一番つらかった。'], end: true, noDone: true },
    o: { fx: S => { S.flags.kking = 1; give(S, mkInst('anthem', 3, null, true)); partyRel(S, 1); }, t: ['準優勝。副賞は禁制品の「海賊放送.fm」だった。', '同行している仲間との仲が深まった。'], end: true },
    g: { fx: S => { S.flags.kking = 1; give(S, mkInst('anthem', 4, [{ k: 'hp', v: 25 }, { k: 'cool', v: -20 }, { k: 'tec', v: 6 }, { k: 'seep', v: 50 }], true)); partyRel(S, 2); S.credits += 1000; }, t: ['優勝。ママ三人が同時に泣いた。高架の上を通った電車の乗客まで、窓越しに拍手していた。', '賞金1000crと、一点物の「海賊放送.fm」を手に入れた。同行している仲間との仲が、大きく深まった。'], end: true } } },
};
const GHOSTENC = { ghostfight: { scene: 'pier', name: 'ジャンク山の奥', intro: '「おかえり」を待ち続けた家庭用ロボット。', reward: 300,
  enemies: () => [foe('boss', '泣き声のロボット', 'golem', { boss: true, xp: 300, hp: big(700, 900, 1100), atk: 26, def: 12, spd: 6, fw: 10, mems: ['decoy', 'steam'], pdur: 60 })], objs: pierObjs } };

Object.assign(ENC, GHOSTENC);
/* ---------- 思い出(仲間ごとの記録。絆タブで見られる) ---------- */
function memo(S, id, txt) { S.memo = S.memo || {}; const a = S.memo[id] = S.memo[id] || []; if (!a.includes(txt)) a.push(txt); }
const pastSub = sub => sub.replace('(ように見える)', '(ように見えた)').replace(/ている(\(ように見えた\))?$/, 'ていた$1') + '夜';

/* ---------- 仲間同士の出来事 ---------- */
function pairEv(key, a, b, o) {
  const nodes = { start: { t: o.t, c: o.c.map((c, i) => ({ t: c[0], sub: '', to: 'e' + i, fx: S => { rel(S, a, c[1]); rel(S, b, c[2]); memo(S, a, o.memo[0]); memo(S, b, o.memo[1]); } })) } };
  o.c.forEach((c, i) => { nodes['e' + i] = { t: c[3].concat([`${nm(a)}と${nm(b)}との仲が深まった。`]), end: true }; });
  return { ['pair_' + key]: { rom: true, loc: o.loc, label: o.label, sub: o.sub, cond: S => member(S, a) && member(S, b) && !S.left[a] && !S.left[b] && (!o.cond || o.cond(S)), nodes } };
}
const PAIREV = Object.assign({},
  pairEv('killsom', 'kill', 'som', { loc: 'pier', cond: S => S.wanted >= 4, label: 'ふたりの狙撃手', sub: 'コンテナの屋根で、銃声のしない口論が続いている',
    memo: ['ソムリエを撃たなかった理由を、屋根の上で話した', '三年前に撃たれた肩の話を、屋根の上でした'],
    t: ['ねぐらのコンテナの屋根に、キルチョイサーとサイレント・ソムリエが並んで座っていた。間には、分解された銃が二丁。',
      ['サイレント・ソムリエ', '三年前、カンナイの搬入口。風速は四メートル。あなたは私の左肩を撃った'],
      ['キルチョイサー', '……心臓を狙った'],
      ['サイレント・ソムリエ', '嘘。あの距離であなたが外すはずがない。わざと外した'],
      'キルチョイサーは、部品を拭く手を止めなかった。',
      ['キルチョイサー', '……あの日、あなたは紙袋を抱えてた。バゲットが、はみ出してた'],
      ['キルチョイサー', '食べる前の人は、撃ちたくなかった'],
      'ソムリエは長いこと黙っていた。それから、こちらを見た。どちらの言い分が正しいのか、決めてほしいらしい。'],
    c: [['「キルチョイサーは、そういう奴なんだ」', 2, 1, ['キルチョイサーは耳まで赤くなって、部品を一つ落とした。', 'ソムリエがそれを拾い、黙って手渡した。指先が、少しだけ触れた。']],
      ['「腕が落ちてただけだろ」', 1, 2, [['キルチョイサー', '……落ちてない'], 'キルチョイサーは組み立てた銃を構え、湾の向こうの空き缶を撃ち抜いた。音はしなかった。', ['サイレント・ソムリエ', 'ほら。落ちてない'], 'ソムリエが笑うのを、初めて見た気がした。']],
      ['黙って、二人の間に座る', 1, 1, ['三人で、しばらく湾の明かりを眺めていた。', '誰も、銃を組み立て直そうとはしなかった。']]] }),
  pairEv('wanxiao', 'wan', 'xiao', { loc: 'chinatown', cond: S => S.wanted >= 6, label: '朗々飯店の二人', sub: '跡地の厨房で、誰かが皿を並べている',
    memo: ['燃えた夜のことを、跡地の厨房で話した', '跡地の円卓に、十二枚の皿を並べた'],
    t: ['朗々飯店の跡地。焼け残った厨房で、小籠が皿を並べていた。十二枚。円卓ひとつ分。',
      'ワンが、入口の柱にもたれて見ている。',
      ['ワン', '……誰も来ねえよ'],
      ['小籠', '存じております。けれど並べないと、ここが厨房だったことを、わたくしが忘れてしまいそうで'],
      ['ワン', '忘れていい。俺は用心棒だった。店が燃えた夜、俺は裏口で喧嘩してた。表から火が出たのに気づいたのは、全部終わってからだ'],
      '小籠は、皿を並べる手を止めた。',
      ['小籠', 'あの夜、最後のお客様を外へお連れしたのは、ワンさんです。わたくしは、見ておりました'],
      'ワンは何か言いかけて、やめた。'],
    c: [['皿を並べるのを手伝う', 1, 2, ['十二枚の皿を、三人で並べ直した。ワンも、黙って一枚置いた。', '小籠は、いちばん端の席に、もう一枚だけ皿を足した。誰の分かは、聞かなかった。']],
      ['「ワン、あんたは客を守ったんだ」', 2, 1, [['ワン', '……守れたのは、客だけだ'], 'それでもワンは柱から背中を離し、厨房に一歩入って、焦げた鉄鍋を撫でた。', ['小籠', 'お帰りなさいませ、ワンさん']]],
      ['黙って見ている', 1, 1, ['二人は、それきり何も言わなかった。', '小籠が皿を並べ終えるまで、ワンは入口に立っていた。帰るときも、最後まで振り返っていた。']]] }),
  pairEv('honglin', 'hong', 'lin', { loc: 'noge', cond: S => S.wanted >= 7, label: '紅楼の往診', sub: '紅楼の二階から、言い争う声がする',
    memo: ['紅楼の二階で、リンの古い傷を診た', '紅楼の二階で、昔の端子の痕を紅姐に見せた'],
    t: ['紅楼の二階。紅姐が、リンの袖をまくっていた。肘の内側に、古い接続痕が並んでいる。',
      ['紅姐', 'ブローカー時代の端子、全部自分で潰したのね。素人の仕事よ。膿んでる'],
      ['リン', '痕は残しておきたいの。昔の取引先に、もう繋がらないって見せられるから'],
      ['紅姐', '見せる相手がもう死んでたら、意味がないでしょう。あんたの腕が腐ったら、あたしの寝覚めが悪いのよ'],
      ['リン', '診察料、いくら?'],
      ['紅姐', '……あんたに払える額じゃないわ。だから、払わなくていい'],
      'リンの指が、少しだけ震えた。二人とも、こちらを見ている。'],
    c: [['「紅姐に任せよう」', 2, 1, ['リンは長い溜息をついて、腕を差し出した。', '紅姐の煙管の火が、手術灯の代わりになった。縫い目は、驚くほど細かかった。', ['リン', '……ありがと。帳簿には、付けないでおくわ']]],
      ['「痕を残すかどうかは、リンが決めることだ」', 1, 2, [['紅姐', '……分かってるわよ。分かってて言ってるの'], '紅姐は消毒だけして、包帯を巻いた。痕は、そのまま残った。', ['リン', 'ありがと。包帯は、受け取っておく']]]] }),
  pairEv('zerosatou', 'zero', 'satou', { loc: 'minato', cond: S => S.wanted >= 9, label: '空腹同盟の炊き出し', sub: '観覧車の下で、本物の湯気が立っている',
    memo: ['観覧車の下の炊き出しを、サトウと仕上げた', '観覧車の下の炊き出しで、塩をひとつまみ足した'],
    t: ['観覧車の下で、空腹同盟の炊き出しが開かれていた。今日の鍋は、ホログラムではない。',
      'サトウが、お玉を握ったまま固まっている。',
      ['ゼロカロリー', '味見をしてほしいんだ。君の舌が、いちばん正直だから'],
      ['サトウ', 'まだ半分しか分からないんです。しょっぱいのか甘いのか、その間のどこかで、いつも迷子になる'],
      ['ゼロカロリー', '半分分かれば十分だよ。ここに並んでる人たちは、ゼロから始めるんだ'],
      '行列の先頭の子供が、空の椀を差し出して待っている。サトウは、こちらを見た。'],
    c: [['「味見してやれ、サトウ」', 1, 2, ['サトウは目を閉じて、一口すすった。長い沈黙のあとで、お玉に塩をひとつまみ足した。', ['サトウ', '……今のは、分かりました。足りなかった'], '子供の椀に、最初の一杯が注がれた。']],
      ['「ゼロ、あんたが味を決めろ」', 2, 1, ['ゼロカロリーは自分で味見をして、首をかしげて、それから笑った。', ['ゼロカロリー', 'わたしには、全部おいしく思えるんだ。それが困る'], 'サトウが横から、黙って塩を足した。二人で、もう一度味見をした。']],
      ['先に並んでいる子に配る', 1, 1, ['三人で、行列が尽きるまで椀を配った。', '鍋の底が見えたころ、誰からともなく、空の椀を合わせて乾杯した。']]] }),
  pairEv('ganyu', 'gantetsu', 'yumori', { loc: 'hk', cond: S => S.wanted >= 9, label: '源泉の整備', sub: '源泉の脇で、金属を叩く音がする',
    memo: ['湯守の膝を、源泉の脇で手入れした', '源泉の脇で、ガンテツに膝を手入れしてもらった'],
    t: ['源泉の脇で、ガンテツが湯守の膝関節を開けていた。中から、硫黄の結晶がぼろぼろとこぼれる。',
      ['ガンテツ', '百年は手入れされてねえな。よく立ってたもんだ'],
      ['湯守', '……マモル……シゴト……'],
      ['ガンテツ', '分かってる。仕事があるうちは、止まれねえよな。俺の工場の連中も、そうだった'],
      'ガンテツの手つきは、驚くほど優しかった。古い部品を一つ外すたびに、布で包んで脇に並べていく。',
      ['ガンテツ', '新しい部品に替えりゃ、あと百年はもつ。だが、この膝はこいつが自分で歩いてきた膝だ'],
      'ガンテツは、こちらに工具を差し出した。どうするか決めろ、ということらしい。'],
    c: [['「新しい部品に替えよう」', 1, 2, ['新しい関節は、ガンテツがその場で打った。湯守は立ち上がり、確かめるように二、三歩歩いた。', ['湯守', '……カルイ'], '外した古い部品は、ガンテツが源泉の脇に埋めた。墓標の代わりに、ボルトを一本立てた。']],
      ['「古い膝を磨き直そう」', 2, 1, ['結晶を一つずつ削り落とし、油を差した。ガンテツは一言も喋らなかった。', '夕方になって、湯守の膝は、古いまま、きしまなくなった。', ['ガンテツ', '……いい鉄だ。昔の奴は、いい鉄を使ってた']]]] }),
  pairEv('tsuten', 'tsukimi', 'tenin', { loc: 'kg', cond: S => S.wanted >= 10, label: '退職の手続き', sub: 'モールのベンチで、二人が書類を広げている',
    memo: ['テンインに、手製の退職届の書式を渡した', 'ツキミから、退職届の書式をもらった'],
    t: ['メガモールの休憩ベンチ。ツキミが、テンインの前に書類を一枚置いた。',
      ['ツキミ', '退職届の書式です。二十年使ってきた、わたしの手製のものです'],
      ['テンイン', 'たいしょく……。わたし、雇用契約を見たことがないんです。気がついたときには、ここの店員だったので'],
      ['ツキミ', 'では、なおさら必要です。辞めるという選択肢が、紙の上に存在する。それだけで、人は少し自由になります'],
      'テンインはバーコードリーダーで書類を読もうとして、読めずに首をかしげた。',
      ['テンイン', '提出先の欄には、何て書けばいいですか'],
      'ツキミは、珍しく答えに詰まった。'],
    c: [['「出さなくていい。持っておけ」', 1, 2, ['テンインは書類を丁寧に四つに折って、名札の裏にしまった。', ['テンイン', 'お守りですね。ポイントは付きませんけど'], ['ツキミ', '……品質は、保証します']]],
      ['「ツキミの辞表は、どこに出したんだ」', 2, 1, [['ツキミ', '……会長室宛てに、郵送しました。受理されたかどうかは、分かりません'], ['ツキミ', '分からないまま、ここにいます。それでいいのだと、最近は思っています'], 'テンインは、提出先の欄に「ここ」とだけ書いた。']]] }),
  pairEv('pedalnana', 'pedal', 'nanashi', { loc: 'noge', cond: S => S.wanted >= 5, label: '路地裏レース', sub: '線路沿いの路地で、自転車とドローンがにらみ合っている',
    memo: ['ナナシと、カンナイまで路地裏レースをした', 'ペダルと、カンナイまで路地裏レースをした'],
    t: ['線路沿いの路地。ペダルが、ナナシに指を突きつけていた。',
      ['ペダル', 'てめえ、さっきからずっとついて来やがって。配達ルート盗む気か'],
      'ナナシのセンサーが、赤と青に交互に瞬いた。抗議しているのか、遊びたいのか、分からない。',
      ['ペダル', '……いいぜ。カンナイの搬入口まで、先に着いた方が勝ちだ。負けたら、この路地には二度と来んな'],
      'ナナシの機体が、ふわりと高度を上げた。やる気らしい。二人とも、こちらが合図するのを待っている。'],
    c: [['ペダルに賭ける', 2, 1, ['ペダルは信号を三つ無視し、高架の柱を蹴って曲がった。ナナシは律儀に信号で止まった。', '搬入口に先に着いたのは、ペダルだった。', ['ペダル', 'へっ。……おい、ついて来たいなら信号は無視しろ。ドローンのくせにお行儀がいいんだよ'], 'ナナシのセンサーが、青く光った。']],
      ['ナナシに賭ける', 1, 2, ['ナナシは屋根の上を一直線に飛んだ。路地を律儀に曲がるペダルを、上から見下ろしながら。', '搬入口に先に着いたのは、ナナシだった。', ['ペダル', '……ずりいだろ、空は! 次は地下道だ。地下道で勝負しろ'], 'ナナシのセンサーが、何度も青く瞬いた。']]] }),
  pairEv('hijimutsu', 'hijiki', 'mutsuko', { loc: 'honmoku', cond: S => S.wanted >= 11, label: '船乗りと飛行士', sub: '密輸船の甲板で、古い星図が広げられている',
    memo: ['月への星図を、ムツコと広げた', '密輸船の甲板で、帰りの燃料の話をした'],
    t: ['密輸船の甲板に、手描きの星図が広げられていた。ヒジキとムツコが、両端を押さえている。',
      ['キャプテン・ヒジキ', 'がはは! 月への航路はこの線だ。中継点で補給して、静かの海に滑り込む'],
      ['ムツコ', '四十年前、わたしたちはその線を、管制塔の言う通りに飛んだのよ。燃料計とにらめっこしながら'],
      ['キャプテン・ヒジキ', '管制塔なんぞ、海賊にはいらん'],
      ['ムツコ', 'だから海賊は、帰りの燃料を計算しないのね'],
      '二人は同時に黙って、同時にこちらを見た。'],
    c: [['「帰りの燃料は大事だ」', 1, 2, [['ムツコ', 'でしょう。……行きの燃料だけで飛んだ仲間を、一人知ってるの'], 'ムツコは星図の端に、小さく計算式を書き足した。ヒジキは、それを消さなかった。']],
      ['「行けば何とかなる」', 2, 1, [['キャプテン・ヒジキ', 'がはは! 分かっとるな!'], ['ムツコ', '……四十年前のわたしも、そう言ったわ。若かったのね'], 'ムツコは笑って、星図に赤い丸を一つ描いた。「ここで一度、星を見ること」と書き添えてあった。']]] }),
  pairEv('glovechef', 'whiteglove', 'chef', { loc: 'yamate', cond: S => S.wanted >= 11, label: '一皿のための給仕', sub: '洋館の厨房に、灯りがついている',
    memo: ['洋館の厨房で、四十年ぶりに皿を温めた', '洋館の厨房で、出前を待っていた子供の話をした'],
    t: ['洋館の厨房。料理長・朗の半透明の手が、空の鍋を振っている。その横に、ホワイトグローブが白い皿を持って立っていた。',
      ['ホワイトグローブ', 'この家の坊ちゃまは、よくこの厨房で、朗々飯店の出前を待っておられました。皿を温めるのは、わたくしの役目でした'],
      ['料理長・朗', 'あの坊主か。岡持ちを返すとき、いつも紙切れが入ってた。「もっと辛くして」ってな'],
      ['ホワイトグローブ', '……存じませんでした'],
      ['料理長・朗', '執事が知らねえことも、料理人は知ってる。皿の返し方で、全部分かるんだ'],
      '料理長は、鍋を振る手を止めた。火は、もう出ない。'],
    c: [['「皿を温めてくれ」', 2, 1, ['ホワイトグローブはオーブンに白い皿を入れた。何十年ぶりかの手順だった。', '料理長は、空の鍋で、何かを盛り付ける真似をした。', '温まった皿だけが、テーブルに置かれた。誰も、それを空だとは言わなかった。']],
      ['「もっと辛く、作ってやってくれ」', 1, 2, [['料理長・朗', '……今度会ったら伝えとけ。辛いのが好きなのは、ちゃんと覚えてるってな'], 'ホワイトグローブは、手袋の上から胸ポケットを押さえた。そこに、古い紙切れが一枚入っているらしかった。']]] }),
  pairEv('jawaur', 'glassjaw', 'aur', { loc: 'minato', cond: S => S.wanted >= 9, label: '閉場後の稽古', sub: '閉場後のリングで、誰かが打ち合っている',
    memo: ['閉場後のリングで、オロールと拳を合わせた', '閉場後の闘技場で、グラスジョーと素手の稽古をした'],
    t: ['閉場後の地下闘技場。リングの上で、グラスジョーとオロールが向かい合っていた。',
      ['グラスジョー', '騎士さんよ。槍を置いて、素手でやろうぜ。礼儀の稽古だ'],
      ['オロール', 'よかろう。素手の作法も、騎士の修練のうちだ'],
      '三ラウンド。グラスジョーの拳は一度も止まらず、オロールは一歩も退かなかった。',
      ['グラスジョー', '……おかしいだろ。一発も顎に来ねえ'],
      ['オロール', 'そなたの顎が脆いことは、闘技場の誰もが知っている。知っている者は、そこを打たぬ。それが礼儀だ'],
      'グラスジョーは、しばらく天井の照明を見上げていた。'],
    c: [['「打ってやればよかったのに」', 2, 1, [['グラスジョー', 'だよな! 遠慮されるのが一番効くんだよ'], ['オロール', '……では次は、全力で参る'], ['グラスジョー', 'おう。顎は、ちゃんと引いとくからよ'], '二人は、リングの真ん中で拳を合わせた。']],
      ['「オロールらしいな」', 1, 2, [['オロール', '騎士とは、そういうものだ'], ['グラスジョー', '……ちっ。王者ってのは、遠慮されてるうちは本物じゃねえんだ。また来るぜ、騎士さん'], '帰り際、グラスジョーはリングのロープを、名残惜しそうに撫でた。']]] }),
  pairEv('somtsu', 'som', 'tsukimi', { loc: 'kannai', cond: S => S.wanted >= 11, label: '元・同僚', sub: 'アーコロジーの裏口で、二人が黙って立っている',
    memo: ['カンナイの裏口で、ツキミから自分の人事ファイルの話を聞いた', 'カンナイの裏口で、ソムリエに昔の所見を打ち明けた'],
    t: ['カンナイ・アーコロジーの裏口。かつての通用門の前に、ソムリエとツキミが並んでいた。',
      ['ツキミ', 'あなたの人事ファイルを、読んだことがあります。品質保証部は、刺客の「品質」も保証していましたので'],
      ['サイレント・ソムリエ', '何と書いてあった'],
      ['ツキミ', '「対象への共感が強すぎる。長期運用に不向き」。……わたしが書いた所見です'],
      'ソムリエは、門の上の監視カメラを見上げた。もう、赤いランプは点いていない。',
      ['サイレント・ソムリエ', '正しい所見だ。私は不良品だった'],
      ['ツキミ', 'いいえ。わたしの検査基準が、不良品でした'],
      '二人とも、それ以上は言わなかった。'],
    c: [['「ソムリエ、あんたは不良品じゃない」', 2, 1, [['サイレント・ソムリエ', '……知っている。あなたが言うなら'], 'ソムリエの口元が、ほんの少しだけ緩んだ。ツキミは手帳に何かを書き込み、そのページを破って捨てた。']],
      ['「ツキミ、言えてよかったな」', 1, 2, [['ツキミ', '……謝罪だったのでしょうか。報告のつもりでした'], ['サイレント・ソムリエ', '受理する'], 'ソムリエは、門に背を向けた。ツキミも少し遅れて、それに続いた。']]] }),
  pairEv('honggan', 'hong', 'gantetsu', { loc: 'noge', cond: S => S.wanted >= 10, label: '年寄りの酒', sub: '立ち飲み屋の奥で、グラスが二つ鳴った',
    memo: ['立ち飲み屋で、ガンテツと昔の手術の話をした', '立ち飲み屋で、工場の若い衆の話をした'],
    t: ['高架下の立ち飲み屋。紅姐とガンテツが、同じ銘柄の焼酎を飲んでいた。',
      ['ガンテツ', 'あんた、昔は外科をやってたろう。工場で指を落とした若いのを、三人つないでくれた'],
      ['紅姐', '四人よ。一人は、あんたが自分で担いできた'],
      ['ガンテツ', '……覚えてねえな'],
      ['紅姐', '覚えてなくていいのよ。つないだ方が覚えてれば'],
      '二人は、しばらく黙ってグラスを傾けた。',
      ['ガンテツ', '工場は、全部止まっちまった。つないだ指で、今頃あいつら何を握ってるんだか']],
    c: [['「紅姐の腕のおかげで、何かを握れてるさ」', 2, 1, [['紅姐', 'おだてても、診察料は負けないわよ'], 'それでも紅姐は、煙管を置いて、少しだけ笑った。ガンテツが、勘定を全部払った。']],
      ['「ガンテツが担いでいったからだ」', 1, 2, [['ガンテツ', '……だといいがな'], 'ガンテツは自分の太い指を見下ろして、小さく握った。紅姐が、空いたグラスに黙って注ぎ足した。']]] }),
  pairEv('killdog', 'kill', 'shumai', { loc: 'pier', label: '屋根の上の分け前', sub: 'コンテナの屋根から、何かを噛む音がする',
    memo: ['屋根の上で、シューマイに缶詰を分けた', '屋根の上で、キルチョイサーに缶詰を分けてもらった'],
    t: ['ねぐらのコンテナの屋根で、キルチョイサーが缶詰を開けていた。隣に、シューマイが座っている。',
      'キルチョイサーは缶の中身を指で半分すくって、シューマイの前に置いた。シューマイが食べる。もう三回は繰り返しているらしい。',
      ['キルチョイサー', '……内緒'],
      ['キルチョイサー', 'この子、撃つ前の人の匂いが分かるみたい。わたしが仕事の前に座ると、いつも少し離れる'],
      'シューマイは、キルチョイサーの膝に顎を乗せていた。今は、離れていない。'],
    c: [['「今は、仕事の前じゃないからな」', 2, 1, [['キルチョイサー', '……うん'], 'キルチョイサーは、缶の残りを全部シューマイにやった。自分の分は、もう要らないらしい。']],
      ['「おれにも一口」', 1, 2, ['シューマイがこちらに向き直り、低く唸った。分け前は渡さない、という顔だった。', ['キルチョイサー', '……ふふ'], 'キルチョイサーが声を出して笑うのを、初めて聞いた気がした。']]] }),
  pairEv('nanadog', 'nanashi', 'shumai', { loc: 'pier', label: 'ねぐらの番', sub: 'ねぐらの前で、犬とドローンがにらみ合っている',
    memo: ['シューマイと、ねぐらの番を分け合った', 'ナナシと、ねぐらの番を分け合った'],
    t: ['ねぐらの入口で、シューマイがナナシに向かって吠えていた。ナナシは、高度を上げたり下げたりしている。',
      'しばらくして、シューマイが吠えるのをやめた。ナナシが、ゆっくりと地面に降りる。',
      'シューマイはナナシの機体のにおいを長いこと嗅いでから、その横で丸くなった。ナナシのセンサーが青く瞬いて、それから暗くなった。省電力モードらしい。',
      'どうやら、ねぐらの番は二人で交代ですることに決まったらしい。'],
    c: [['「ナナシ、頼んだぞ」', 2, 1, ['返事はなかった。ドローンはセンサーを一度だけ瞬かせ、犬は尻尾を一度だけ振った。']],
      ['「シューマイ、頼んだぞ」', 1, 2, ['返事はなかった。犬は尻尾を一度だけ振り、ドローンはセンサーを一度だけ瞬かせた。']]] }),
);

/* ---------- 道中のひとこと(地区に入ったとき、同行している仲間が話す) ---------- */
const CHAT = {
  kill: ['……雨。足音が消えるから、好き', '後ろは気にしなくていい。見てるから', 'お腹すいた。……言ってみただけ', '人の多い通りは、まだ少し苦手'],
  aur: ['この街の石畳は、馬には向かぬな', '我が槍は、そなたの道を拓くためにある', '民の暮らしを見るのも、騎士の務めだ', '雨か。旅の騎士には、慣れたものだ'],
  som: ['この辺りの水は、鉄の味がする', '三ブロック先に、監視カメラが二台。避けて通る', '一口でいい。……いつか、また', '私の後ろを歩け。その方が安全だ'],
  hong: ['顔色が悪いわね。あとで診てあげる', '煙管は薬よ。あたしにとってはね', 'この街で長生きするコツ? 借りを作らないことよ', '若いのに、背中が疲れてるわね'],
  pedal: ['遅えよ。もっと速く歩け', 'この先の坂、ブレーキ壊れてると死ぬぜ', '……別に、ついて来てやってるわけじゃねえからな', 'この辺の近道、全部知ってるぜ'],
  wan: ['腹が減ったら言え。鍋なら振れる', '後ろの奴、目を合わせるな', '……昔は、この時間に仕込みをしてた', '雨の日は、客が少なかった'],
  xiao: ['お足元にお気をつけください', 'お冷やのおかわりは、いつでもお申し付けください', 'この街のお客様は、皆さま急いでいらっしゃいますね', '本日のおすすめは……失礼しました。癖です'],
  zero: ['ここにも、お腹をすかせた人がいるね', '本物の匂いがする。どこかで誰かが料理してる', 'ホログラムのおにぎり、いる? カロリーはゼロだけど', '食べられない日が続くと、匂いだけで分かるようになるんだ'],
  gantetsu: ['いい鉄の匂いがする', '腰が痛え。……言わせるな', '若いの、靴紐がほどけてるぞ', 'この街の看板は、溶接が甘え'],
  chef: ['この辺りの油は、質が悪いな', '火加減は、焦げる一歩手前が一番うまい', '……鍋が振りてえ', '腹の減った顔をしてるな。いい顔だ'],
  lin: ['この通りの相場、昔の半分ね', '笑って。値切られるわよ', '帳簿に付けない話なら、聞いてあげる', 'ここで昔、ひと財産すったのよ。……冗談'],
  tsukimi: ['本日の行程は、予定通りです', '通路の幅が、基準値を下回っています', '……休憩も、業務のうちです', '会社の外の空気には、まだ慣れません'],
  glassjaw: ['顎は引いとけ。人生の基本だ', '歓声が聞こえねえと、落ち着かねえな', 'おう、殴りてえ奴がいたら言えよ', '拳ってのは、握るより開く方が難しい'],
  hijiki: ['がはは! 陸の上は揺れなくて落ち着かん', '干物、食うか?', '風向きがいい。何かいいことがありそうだ', '星が見えんな。ここは空が低い'],
  whiteglove: ['お荷物、お持ちいたしましょうか', '靴に泥が。のちほど磨いておきます', '雇い主のいない執事は、案外、自由なものです', '道の端をお歩きください。そこは水たまりが深い'],
  yumori: ['……アタタカイ……ハ……ドコ', '……マモル', '(湯守が、少しだけ湯気を立てた)', '(湯守が、立ち止まって空を見上げた)'],
  mutsuko: ['空が狭いわね、この街は', '若い人は、歩くのが速くていいわね', '星が見えないのは、明るすぎるからよ', '月まで三十八万キロ。歩いたら、何年かしら'],
  tenin: ['天井がないって、すごいですね', 'いらっしゃいませ、って言いそうになります', 'この街、閉店時間がないんですね', '外の人は、みんな値札を見ないで歩くんですね'],
  satou: ['……今の屋台、醤油の匂いでした。たぶん', '社員証、まだ捨てられないんです', '味が分かったら、最初に何を食べようかな', '昔は毎日、この時間に満員電車に乗ってました'],
  nanashi: ['(ナナシのセンサーが、青く瞬いた)', '(ナナシが、頭上を一周した)', '(ナナシが、遠くの何かを撮影している)', '(ナナシが、肩に止まって休んでいる)'],
  shumai: ['(シューマイが、路地の奥のにおいを嗅いでいる)', '(シューマイが、屋台の方をじっと見ている)', '(シューマイが、足元にぴったりついて歩いている)', '(シューマイが、知らない犬に挨拶している)'],
};
const CHATLOC = {
  chinatown: { wan: ['……ここの角に、うちの店の看板があった'], xiao: ['朗々飯店は、この先でございました'], chef: ['……ここの匂いは、まだ覚えてる'], shumai: ['(シューマイが、跡地の方へ鼻を向けた)'] },
  gate7: { chef: ['……いい店の匂いがする。主は、腕がいい'], zero: ['本物の麺の匂いだ'], satou: ['……この匂いは、分かります。分かるんです'] },
  kw: { gantetsu: ['俺の工場だ。……だった'] }, hk: { yumori: ['……ユ……ココ……'], gantetsu: ['湯はいい。鉄も人も、熱いうちに休ませるもんだ'] },
  kg: { tenin: ['おかえりなさいませ、って言いたくなります'] }, ks: { mutsuko: ['ただいま。……天文台が見えると、帰ってきた気がするわ'] },
  minato: { glassjaw: ['地下から、歓声が聞こえるな'], zero: ['観覧車、今日も止まってるね'] }, yamate: { whiteglove: ['……この坂を上るのは、久しぶりです'] },
  honmoku: { hijiki: ['がはは! 潮の匂いだ! 陸でいちばんましな匂いだ'] }, kannai: { tsukimi: ['……通用門の番号、まだ覚えています'], som: ['ここの空調の音は、嫌いだ'] },
  mdock: { mutsuko: ['四十年ぶりの、月の砂よ'], hijiki: ['月だ! 本当に来ちまったな!'] }, mkitchen: { chef: ['……百八の鍋か。全部、火が死んでる'] },
};
function chatLine(S) {
  const ps = S.party.filter(id => id !== 'hero' && (CHAT[id] || (CHATLOC[S.loc] || {})[id]));
  if (!ps.length) return null;
  const id = ps[Math.floor(Math.random() * ps.length)], loc = (CHATLOC[S.loc] || {})[id];
  const pool = loc && Math.random() < 0.6 ? loc : (CHAT[id] || loc);
  return { id, name: nm(id), line: pool[Math.floor(Math.random() * pool.length)] };
}

/* ---------- くり返しの出来事の、結果の揺らぎ(判定の成否は能力で決まり、中身が揺らぐ) ---------- */
const pmName = S => { const p = party(S).filter(u => u.id !== 'hero'); return p.length ? p[Math.floor(Math.random() * p.length)].name : null; };
const V = (w, t, fx) => ({ w, t, fx });
const nothing = V(1, []);
const VSCAV = [nothing,
  V(2, ['基板の裏に、古い小銭入れが貼り付いていた。', 'さらに20crを手に入れた。'], S => { S.credits += 20; }),
  V(2, ['山の陰に、冷却スプレーの缶が一本転がっていた。中身は、まだ入っている。', '冷却スプレーを手に入れた。'], S => { S.items.coolant++; }),
  V(1, ['ジャンクの隙間に、メモリが一本挟まっていた。', 'メモリを手に入れた。'], S => { give(S, rndMem(['junk', 'shock', 'adrenal', 'smoke'])); }),
  V(2, S => { const n = pmName(S); return n ? [`${n}が、山の反対側から手を振っていた。何か見つけたらしい。`, '部品を2個手に入れた。'] : ['錆びたロボットの腕から、ねじを何本か外した。', '部品を2個手に入れた。']; }, S => { S.parts += 2; }),
  V(1, ['錆びた看板の裏に、「朗々」の二文字が残っていた。持ち帰るには重すぎた。しばらく、その文字を眺めていた。']),
  V(1, ['カモメに似た何かが、基板を一枚くわえて飛んでいった。', '10cr分、損をした。'], S => { S.credits = Math.max(0, S.credits - 10); }),
];
const VTALK = [nothing,
  V(2, ['帰り際、別の情報屋が袖を引いた。「さっきの話、買い取らせてくれ」', 'さらに30crを手に入れた。'], S => { S.credits += 30; }),
  V(2, S => { const n = pmName(S); return n ? [`${n}が、隣の客と妙に話し込んでいた。戻ってくると、修復ジェルを一本持っていた。`, '修復ジェルを手に入れた。'] : ['カウンターの隅に、誰かが修復ジェルを置き忘れていた。', '修復ジェルを手に入れた。']; }, S => { S.items.gel++; }),
  V(1, ['ハイボールの氷の下に、メモリが一本沈んでいた。情報屋は、知らない顔をしている。', 'メモリを手に入れた。'], S => { give(S, rndMem(['netrun', 'coupon', 'leech', 'charm'])); }),
  V(1, ['噂の一つに、気になるものがあった。「最近、朗々幇の幇主が、粥の屋台で泣いていた」。真偽は分からない。']),
  Object.assign(V(6, ['情報屋が、声を落とした。「ホンモクの闇市に、データを重さで量り売りする屋台が出てる。黒いチャーハンのデータが、量りを壊したそうだ」', '「朗々飯店の、存在しないはずの裏メニューだとさ。……まあ、噂だ」'], S => { S.flags.bhRumor = 1; }), { cond: S => S.wanted >= 11 && !S.flags.bhRumor }),
  V(1, ['帰り道、酔った客にからまれた。ハイボール一杯分、おごらされた。', '10crを失った。'], S => { S.credits = Math.max(0, S.credits - 10); }),
];
const VFISH = [nothing,
  V(2, ['もう一匹かかった。今度は、目が二つの、普通のアジだった。かえって珍しい。', 'さらに25crを手に入れた。'], S => { S.credits += 25; }),
  V(2, S => { const n = pmName(S); return n ? [`${n}も隣で糸を垂らしていた。釣れたのは、防水の救急箱だった。`, '修復ジェルを手に入れた。'] : ['針に、防水の救急箱が引っかかった。', '修復ジェルを手に入れた。']; }, S => { S.items.gel++; }),
  V(1, ['糸を巻き上げると、メモリが一本絡まっていた。湾は、なんでも飲み込む。', 'メモリを手に入れた。'], S => { give(S, rndMem(['knuckle', 'smoke', 'leech', 'baton', 'shock'])); }),
  V(1, ['釣った魚を、野良猫に一匹取られた。猫は、礼のつもりか、ねじを一本置いていった。', '部品を1個手に入れた。'], S => { S.parts += 1; }),
];
const VMJ = [nothing,
  V(2, ['最後の局で、店の主人が自分の牌を倒した。「今日はあんたの日だ」', 'さらに40crを手に入れた。'], S => { S.credits += 40; }),
  V(2, S => { const n = pmName(S); return n ? [`後ろで見ていた${n}が、目配せで相手の手牌を教えてくれた。……たぶん、反則だ。`, '部品を2個手に入れた(負けた客の担保だった)。'] : ['負けた客が、担保の部品を置いていった。', '部品を2個手に入れた。']; }, S => { S.parts += 2; }),
  V(1, ['勝ちすぎて、帰り道で下っ端に尾けられた。路地を三つ曲がって撒いた。', '10crを落とした。'], S => { S.credits = Math.max(0, S.credits - 10); }),
  V(1, ['卓の向かいの老人が、牌を混ぜながら呟いた。「朗々の炒飯は、牌を握る前に食うと勝てた」。誰に向けた言葉かは、分からなかった。']),
];
const VKARA = [nothing,
  V(2, S => { const n = pmName(S); return n ? [`${n}が、誰も知らない歌を入れた。古い歌だった。歌い終えるまで、誰も口を挟まなかった。`] : ['ママが、一曲だけ歌った。上手かった。']; }),
  V(2, ['隣のボックスの客が、デュエットに乱入してきた。三番まで歌い切った。', 'おひねりで20crを手に入れた。'], S => { S.credits += 20; }),
  V(1, S => { const n = pmName(S); return n ? [`帰り際、${n}が「また来よう」と言った。小さな声だった。`, `${n}との仲が、少しだけ深まった。`] : ['帰り際、ママが「またおいで」と言った。']; }, S => { const p = S.party.filter(id => id !== 'hero'); if (p.length) rel(S, p[Math.floor(Math.random() * p.length)], 1); }),
  V(1, ['マイクの電池が切れた。最後のサビは、全員でアカペラになった。']),
];
const VKW = [nothing,
  V(2, ['昼休み、工員たちの弁当を少し分けてもらった。合成米だったが、温かかった。', '修復ジェルを手に入れた(救護箱の余りだった)。'], S => { S.items.gel++; }),
  V(2, S => { const n = pmName(S); return n ? [`${n}が、鉄骨の担ぎ方を工員に教えていた。監督が、二人分の日当をつけてくれた。`, 'さらに50crを手に入れた。'] : ['監督が、残業代をつけてくれた。', 'さらに50crを手に入れた。']; }, S => { S.credits += 50; }),
  V(1, ['帰り際、端材の山から使えそうな部品を拾った。監督は、見ないふりをした。', '部品を3個手に入れた。'], S => { S.parts += 3; }),
  V(1, ['鉄骨を落としかけて、工員に助けられた。礼に、日当の一部を渡した。', '30crを失った。'], S => { S.credits = Math.max(0, S.credits - 30); }),
];
const VONSEN = [nothing,
  V(2, ['湯上がりに、女将が冷たい牛乳を出してくれた。代金は取られなかった。']),
  V(2, ['脱衣所に、誰かの忘れ物の冷却スプレーがあった。女将は「持ってきな」と言った。', '冷却スプレーを手に入れた。'], S => { S.items.coolant++; }),
  V(1, S => { const n = pmName(S); return n ? [`湯の中で、${n}がぽつりと昔の話をした。湯気のせいで、顔はよく見えなかった。`, `${n}との仲が、少しだけ深まった。`] : ['隣の湯治客が、湯の中で昔の話をしていた。最後まで聞いた。']; }, S => { const p = S.party.filter(id => id !== 'hero'); if (p.length) rel(S, p[Math.floor(Math.random() * p.length)], 1); }),
];
const VARY = {
  scav: { o: VSCAV, g: VSCAV, f: [V(6, []), V(1, ['帰り際、足元で何かが光った。古いコインだった。', '10crを手に入れた。'], S => { S.credits += 10; })] },
  ninfo: { o: VTALK, g: VTALK }, fish: { o: VFISH, g: VFISH }, mahjong: { o: VMJ, g: VMJ }, karaoke: { o: VKARA, g: VKARA }, kwjob: { o: VKW, g: VKW }, onsen: { go: VONSEN },
  gwmeal: { eat: [nothing, V(2, ['寸胴型のロボットが、煮卵を一つ多く乗せてくれた。理由は言わなかった。']), V(2, S => { const n = pmName(S); return n ? [`${n}が、丼を持ったまま「……うま」とだけ言った。`] : ['隣の席の客が、混ぜ方を教えてくれた。もう知っていた。']; }), V(1, ['カウンターの端で、客引きのアンドロイドが「元祖」と「本家」の札を取り違えていた。誰も直さなかった。'])] },
};
function pickVary(list, S) { if (S) list = list.filter(v => !v.cond || v.cond(S)); const tot = list.reduce((a, v) => a + v.w, 0); let r = Math.random() * tot; for (const v of list) { r -= v.w; if (r < 0) return v; } return list[0]; }
/* ---------- 隠し: プロトコルチャーハン・ブラックホール → ター宿 ---------- */
const TAAEV = {
  bhshop: { loc: 'honmoku', label: '量り売りの闇屋', sub: '闇市のいちばん奥。量りの針が、振り切れている', cond: S => S.wanted >= 11 && S.flags.bhRumor && !S.flags.bh, nodes: {
    start: { t: ['闇市のいちばん奥。錆びた天秤の上に、USBメモリが一本だけ載っていた。', '天秤の針は振り切れて、目盛りの外を指している。',
      ['闇屋', 'プロトコルチャーハン・ブラックホール。朗々飯店の、存在しないはずの裏メニューだ'],
      ['闇屋', '重すぎて、うちの量りじゃ値段がつけられない。だから言い値だ。2000cr'],
      'ポケットの中のプロトコルチャーハン・クラックスピードが、ほんの少しだけ、天秤の方へ引っ張られた気がした。'],
      c: [{ t: '買う', sub: '2000cr', dis: S => S.credits < 2000, to: 'buy', fx: S => { S.credits -= 2000; S.flags.bh = 1; } }, { t: 'やめておく', sub: '', to: 'no' }] },
    no: { t: [['闇屋', '急がなくていい。どうせ、誰にも持ち上げられやしない']], end: true, noDone: true },
    buy: { t: ['USBメモリは、手のひらに載せると、見た目よりずっと重かった。指先が、そこへ吸い寄せられる。',
      ['闇屋', '挿すんじゃないよ。混ぜるんだ'],
      ['闇屋', 'この街でいちばん重い井戸の底でな。麺でも皿でも、何でもいい。……向こう側に何があるかは、知らないね'],
      'プロトコルチャーハン・ブラックホールを手に入れた。'], end: true } } },
  taagw: { loc: 'gate7', scene: 'gw', label: 'カウンターの六番目の席', sub: 'ポケットの中で、黒いデータが重さを増している', cond: S => S.flags.bh && !S.flags.taa, nodes: {
    start: { t: ['カウンターの六番目の席に座った。寸胴型のロボットが、黙って油そばを置いた。', 'ポケットの中で、USBメモリが重くなる。丼の底へ、引っ張られている。',
      ['寸胴型のロボット', '……マゼテ、クダサイ'],
      '混ぜたら、たぶん戻れない。戻れるかもしれない。どちらとも、言い切れなかった。'],
      c: [{ t: '混ぜる', sub: '', to: 'go', fx: S => { S.flags.taa = 1; } }, { t: '今日はやめておく', sub: '', to: 'no' }] },
    no: { t: ['油そばだけを、普通に混ぜて食べた。旨かった。'], end: true, noDone: true },
    go: { t: ['USBメモリを丼の縁に当て、麺とタレと黒いデータを、底から返すように混ぜた。',
      '丼の真ん中に、黒い穴が開いた。音も、匂いも、湯気も、そこへ落ちていく。', '寸胴型のロボットは、何も言わずに次の麺を上げた。',
      '体が、丼の底へ引っ張られる。'],
      c: [{ t: '特異点を越える', sub: '', taa: true }] } } },
  taaagain: { loc: 'gate7', scene: 'gw', repeat: true, label: '六番目の席の、向こう側', sub: 'ター宿へ行く', cond: S => !!S.flags.taa, nodes: {
    start: { t: ['六番目の席に座ると、油そばの底に、また黒い穴が開いた。', '向こう側には、白い旅館がある。'],
      c: [{ t: '特異点を越える', sub: 'ター宿へ', taa: true }, { t: 'やめておく', sub: '', to: 'no' }] },
    no: { t: ['油そばだけを、普通に混ぜて食べた。'], end: true } } },
  taaret: { loc: 'gate7', scene: 'gw', repeat: true, auto: false, label: '', sub: '', cond: S => false, nodes: {
    start: { t: [], dyn: S => (S._taaRet || ['(戻ってきた)']), end: true } } },
};
/* ====================================================================
   大型追加: 寄り道でしか行けない場所、寄り道、仲間の出来事、メガモールの拡充
   ==================================================================== */
const one = (type, afx) => mkInst(type, 4, afx, true);
const AF = (a, b, c, d) => [a, b, c, d].map(x => ({ k: x[0], v: x[1] }));

/* ---------- 寄り道でしか行けない場所 ---------- */
REGIONS.splice(REGIONS.length - 1, 0, { id: 'outer', n: 'ネオヨコハマ外縁', scene: 'yamate', sub: '地図の端。観光案内には、もう載っていない場所' });
Object.assign(LOCS, {
  negishi: { lv: 10, scene: 'negishi', name: 'ネギシ競馬場跡', sub: '馬主のいなくなった機械馬が、今も毎日、定刻に走っている', region: 'outer', open: S => !!S.flags.locNegishi },
  gaien: { lv: 12, scene: 'gaien', name: '外人墓地の地下回線', sub: '消し忘れられた人格データが、古い回線の中で暮らしている', region: 'outer', open: S => !!S.flags.locGaien },
  hakkei: { lv: 16, scene: 'hakkei', name: 'ハッケイ海底水族館', sub: '湾の底に沈んだ水族館。飼育員ロボットだけが、まだ餌をやっている', region: 'outer', open: S => !!S.flags.locHakkei },
  keirin: { lv: 13, scene: 'keirin', name: 'カワサキ競輪場', sub: '工員たちの唯一の娯楽。バンクの傾斜は四十五度ある', region: 'kawasaki', open: S => !!S.flags.locKeirin },
  tastelab: { lv: 18, scene: 'tastelab', name: '味覚再生研究所', sub: 'マンカンの閉鎖された研究棟。廊下に、出汁の匂いだけが残っている', region: 'tokyo', open: S => !!S.flags.locLab },
  tone: { lv: 13, scene: 'tone', name: 'トネ川の河川敷', sub: '草野球とバーベキューと、きゅうり泥棒', region: 'kashiwa', open: S => !!S.flags.locTone },
  touge: { lv: 16, scene: 'touge', name: '旧道ターンパイク', sub: '廃道になった峠道。夜になると、走り屋が集まる', region: 'hakone', open: S => !!S.flags.locTouge },
  rooftop: { lv: 12, scene: 'rooftop', name: '屋上駐車場の屋台村', sub: 'メガモールの屋上。地下の店員たちは、ここの存在を知らない', region: 'koshigaya', open: S => !!S.flags.locRoof },
  usagi: { lv: 24, scene: 'usagi', name: '月の裏の餅つき場', sub: '地球から見えない側。誰が建てたのか、社史にも載っていない', region: 'moon', open: S => !!S.flags.locUsagi },
});

Object.assign(ENC, {
  farmNegishi: { farm: true, scene: 'negishi', name: 'ネギシ競馬場跡 第四コーナー', intro: '騎手を振り落とした機械馬が、コースを逆走してくる。', reward: 100,
    enemies: () => ['一号', '二号', '三号'].slice(0, Math.max(1, Math.min(3, ps()))).map((x, i) => foe('h' + i, '暴れ機械馬' + x, 'drone', { hp: 120, atk: 22, def: 8, spd: 15, fw: 8, mems: [pickMem([['dash', 0.4], ['adrenal', 0.3], ['shock', 0.3]])] })), objs: minatoObjs },
  negishiBoss: { scene: 'negishi', name: 'ネギシ競馬場跡 最終直線', intro: '無敗の機械馬「ネギシオー」。四十年間、一度も負けていない。対戦相手がいなかったからだ。', reward: 450,
    enemies: () => [...(ps() >= 3 ? [foe('h1', '併走の機械馬', 'drone', { hp: 130, atk: 22, def: 8, spd: 15, mems: ['dash'] })] : []),
      foe('boss', '無敗の機械馬ネギシオー', 'champ', { boss: true, xp: 300, hp: big(600, 800, 1000), atk: 24, def: 12, spd: 16, fw: 20, mems: ['dash', 'adrenal', 'armor'], pdur: 70 })], objs: minatoObjs },
  farmGaien: { farm: true, scene: 'gaien', name: '外人墓地 地下回線の中継室', intro: '行き場をなくしたデータが、中継機に取り憑いて暴れている。', reward: 120,
    enemies: () => { const out = [foe('g1', '迷いデータ', 'runner', { hp: 100, atk: 20, def: 5, spd: 14, fw: 25, fxk: 'shot', mems: [pickMem([['netrun', 0.5], ['leech', 0.3], ['charm', 0.2]])] })]; if (ps() >= 2) out.push(foe('g2', '取り憑かれた中継機', 'turret', { hp: 170, atk: 22, def: 13, spd: 4, fw: 20, fxk: 'shot', mems: [pickMem([['shock', 0.6], ['frost', 0.4]])] })); if (ps() >= 3) out.push(foe('g3', '迷いデータの残響', 'runner', { hp: 90, atk: 19, def: 5, spd: 15, fw: 25, fxk: 'shot', mems: [pickMem([['smoke', 0.5], ['decoy', 0.5]])] })); return out; }, objs: kannaiObjs },
  farmHakkei: { farm: true, scene: 'hakkei', name: 'ハッケイ海底水族館 大水槽の回廊', intro: '餌の時間を過ぎた展示ロボットたちが、こちらを餌だと判断した。', reward: 170,
    enemies: () => { const out = [foe('f1', '機械仕掛けのウツボ', 'drone', { hp: 170, atk: 28, def: 10, spd: 13, fw: 10, mems: [pickMem([['leech', 0.5], ['shock', 0.5]])] })]; if (ps() >= 2) out.push(foe('f2', '飼育員ロボット', 'agent', { hp: 190, atk: 27, def: 13, mems: [pickMem([['medic', 0.4], ['baton', 0.3], ['frost', 0.3]])] })); if (ps() >= 3) out.push(foe('f3', '電気クラゲ型ドローン', 'drone', { hp: 130, atk: 25, def: 7, spd: 14, fw: 10, mems: ['shock'] })); return out; },
    onStart(G) { G.units.forEach(u => { u.st.wet = 3; }); }, objs: factoryObjs },
  hakkeiBoss: { scene: 'hakkei', name: 'ハッケイ海底水族館 深海展示室', intro: '深海展示室の主。全長十二メートルのダイオウグソクムシ型潜水ロボット。五年間、何も食べていない。', reward: 800,
    enemies: () => [...(ps() >= 3 ? [foe('f1', '電気クラゲ型ドローン', 'drone', { hp: 150, atk: 26, def: 7, spd: 14, mems: ['shock'] })] : []),
      foe('boss', '深海の主', 'golem', { boss: true, xp: 520, hp: big(1900, 2400, 3000), atk: 41, def: 22, spd: 5, fw: 10, mems: ['armor', 'frost', 'mirror'], pdur: 95 })],
    onStart(G) { G.units.forEach(u => { u.st.wet = 3; }); }, objs: factoryObjs },
  keirinBoss: { scene: 'keirin', name: 'カワサキ競輪場 バンク', intro: '競輪王「鉄脚のゴンドウ」。太ももの外周が、本人の胴回りより太い。', reward: 600,
    enemies: () => [foe('k1', '番手の選手', 'thug', { hp: 150, atk: 22, def: 9, spd: 14, mems: ['dash'] }), ...(ps() >= 3 ? [foe('k2', '三番手の選手', 'thug', { hp: 150, atk: 22, def: 9, spd: 14, mems: ['adrenal'] })] : []),
      foe('boss', '競輪王ゴンドウ', 'champ', { boss: true, xp: 420, hp: big(800, 1050, 1300), atk: 26, def: 12, spd: 15, fw: 25, mems: ['dash', 'adrenal', 'knuckle'], pdur: 80 })], objs: arenaObjs },
  farmLab: { farm: true, scene: 'tastelab', name: '味覚再生研究所 実験棟', intro: '警備システムだけが、閉鎖されたことを知らされていない。', reward: 190,
    enemies: () => { const out = [sentinel('t1', '研究棟セントリー')]; out[0].maxhp = out[0].hp = 240; out[0].atk = 30; if (ps() >= 2) out.push(foe('a1', '試食係アンドロイド', 'agent', { hp: 210, atk: 30, def: 13, mems: [pickMem([['tongue', 0.3], ['medic', 0.3], ['baton', 0.4]])] })); if (ps() >= 3) out.push(foe('r1', '味覚記録ドローン', 'drone', { hp: 150, atk: 27, def: 8, spd: 14, fw: 15, mems: [pickMem([['netrun', 0.5], ['steep', 0.5]])] })); return out; }, objs: kannaiObjs },
  labBoss: { scene: 'tastelab', name: '味覚再生研究所 第一試験室', intro: '味覚再生試験体「舌」。水槽の中で、全長三メートルの人工舌が、まだ何かを味わおうとしている。', reward: 900,
    enemies: () => [foe('a1', '試食係アンドロイド', 'agent', { hp: 220, atk: 30, def: 13, mems: ['medic'] }), ...(ps() >= 3 ? [foe('a2', '配膳係アンドロイド', 'agent', { hp: 220, atk: 30, def: 13, mems: ['baton'] })] : []),
      foe('boss', '味覚再生試験体', 'gastro', { boss: true, xp: 600, hp: big(1300, 1700, 2100), atk: 35, def: 16, spd: 9, fw: 30, mems: ['tongue', 'leech', 'steep'], pdur: 90 })], objs: kannaiObjs },
  kappaBoss: { scene: 'tone', name: 'トネ川の河川敷 土俵', intro: '河童。本物かどうかは、誰も確かめていない。皿は、たしかに濡れている。', reward: 550,
    enemies: () => [...(ps() >= 3 ? [foe('k1', '行司の河童', 'thug', { hp: 170, atk: 25, def: 10, mems: ['steam'] })] : []),
      foe('boss', 'トネ川の河童', 'bodyguard', { boss: true, xp: 420, hp: big(1500, 1900, 2400), atk: 38, def: 17, spd: 12, fw: 20, mems: ['steam', 'knuckle', 'leech'], pdur: 80 })],
    onStart(G) { G.units.filter(u => u.side === 'enemy').forEach(u => { u.st.wet = 9; }); }, objs: onsenObjs },
  tougeBoss: { scene: 'touge', name: '旧道ターンパイク 七曲がり', intro: '峠の主「湯けむりのレイ」。廃道の全カーブを、ブレーキを踏まずに曲がる。', reward: 800,
    enemies: () => [foe('c1', '取り巻きの改造車', 'drone', { hp: 190, atk: 28, def: 11, spd: 15, mems: ['dash'] }), ...(ps() >= 3 ? [foe('c2', '取り巻きの改造バイク', 'drone', { hp: 160, atk: 28, def: 8, spd: 17, mems: ['smoke'] })] : []),
      foe('boss', '湯けむりのレイ', 'captain', { boss: true, fxk: 'slash', xp: 520, hp: big(1300, 1700, 2100), atk: 36, def: 15, spd: 18, fw: 30, mems: ['dash', 'smoke', 'steam'], pdur: 85 })], objs: onsenObjs },
  farmRoof: { farm: true, scene: 'rooftop', name: '屋上駐車場 Cブロック', intro: '持ち主を待ちくたびれた自動運転のカートが、勝手に列を作って走っている。', reward: 110,
    enemies: () => ['A', 'B', 'C'].slice(0, Math.max(2, Math.min(3, ps()))).map((x, i) => foe('c' + i, '暴走ショッピングカート' + x, 'drone', { hp: 130, atk: 22, def: 9, spd: 14, fw: 8, mems: [pickMem([['coupon', 0.3], ['escalator', 0.3], ['shock', 0.2], ['markdown', 0.2]])] })), objs: mallObjs },
  mochiBoss: { scene: 'usagi', name: '月の裏 餅つき場', intro: '餅つきロボット「キネ」と「ウス」。四百年ぶんの餅を、誰にも食べてもらえないまま、つき続けている。', reward: 1400,
    enemies: () => [foe('usu', 'ウス', 'golem', { boss: true, xp: 500, hp: big(1000, 1300, 1600), atk: 32, def: 22, spd: 4, fw: 10, mems: ['armor', 'mirror'], pdur: 95 }),
      foe('boss', 'キネ', 'smith', { boss: true, xp: 600, hp: big(1000, 1300, 1600), atk: 39, def: 15, spd: 13, fw: 15, mems: ['saw', 'lowg', 'adrenal'], pdur: 90 })], objs: moonObjs },
  roofFight: { scene: 'rooftop', name: '屋上駐車場 屋台村の裏', intro: '地下から上がってきた警備マネキンが、営業許可証の提示を求めている。屋台村に、許可証はない。', reward: 300,
    enemies: () => [foe('m1', '警備マネキンA', 'agent', { hp: 170, atk: 25, def: 12, mems: ['baton'] }), foe('m2', '警備マネキンB', 'agent', { hp: 170, atk: 25, def: 12, mems: ['mirror'] }), ...(ps() >= 3 ? [foe('m3', 'テナント管理ドローン', 'drone', { hp: 140, atk: 24, def: 8, spd: 14, mems: ['coupon'] })] : [])], objs: mallObjs },
  containerFight: { scene: 'honmoku', name: 'ホンモク・ドック 開かずのコンテナ', intro: 'コンテナの中身は、十年前に密輸されて、そのまま忘れられた警備ロボットだった。まだ、任務中のつもりでいる。', reward: 350,
    enemies: () => [sentinel('t1', '忘れられたセントリー'), foe('a1', '忘れられた警備ロボ', 'agent', { hp: 200, atk: 27, def: 14, mems: [pickMem([['armor', 0.5], ['missile', 0.2], ['mirror', 0.3]])] }), ...(ps() >= 3 ? [foe('a2', '忘れられた警備ロボB', 'agent', { hp: 200, atk: 27, def: 14, mems: ['baton'] })] : [])], objs: factoryObjs },
  killScope: { scene: 'noge', name: 'ノゲ横丁 質屋の裏', intro: '質屋の用心棒たちが、照準器の箱を抱えて出てきた。', reward: 250,
    enemies: () => [foe('e1', '質屋の用心棒A', 'thug', { hp: 180, atk: 26, def: 10, mems: ['knuckle'] }), foe('e2', '質屋の用心棒B', 'thug', { hp: 180, atk: 26, def: 10, mems: ['adrenal'] }), ...(ps() >= 3 ? [foe('r1', '質屋のネットランナー', 'runner', { hp: 120, atk: 20, def: 5, spd: 14, fw: 15, mems: ['netrun'] })] : [])], objs: nogeObjs },
});

/* ---------- 場所への入口(出来事の中で、行き先だけが語られる) ---------- */
const PLACEEV = {
  tipster: { loc: 'noge', label: '高架下の予想屋', sub: '赤鉛筆を耳に挟んだ男が、誰もいない方へ予想を叫んでいる', cond: S => FREE(S) && S.wanted >= 3 && !S.flags.locNegishi, nodes: {
    start: { t: ['高架下に、木箱の上に立った男がいた。赤鉛筆を耳に挟み、古い競馬新聞を振り回している。',
      ['予想屋', '三レースは七番! 七番で鉄板だ! ……誰も聞いちゃいねえがな'],
      ['予想屋', 'ネギシの丘でな、今も馬が走ってるんだ。機械の馬だ。馬主も客も、とっくにいねえ。それでも毎日、定刻にゲートが開く'],
      ['予想屋', '予想、買うかい。50cr。当たるかどうかは、行って確かめな']],
      c: [{ t: '予想を買う', sub: '50cr', dis: S => S.credits < 50, to: 'buy', fx: S => { S.credits -= 50; S.flags.locNegishi = 1; } }, { t: '聞き流す', sub: '', to: 'no' }] },
    no: { t: ['予想屋は、また誰もいない方へ叫びはじめた。'], end: true, noDone: true },
    buy: { t: ['予想屋は、新聞の端を破ってよこした。丘への道順と、「七番」とだけ書いてある。', ['予想屋', 'ヤマテの高台を越えて、もっと先だ。地図の端っこだよ。観光案内からは、もう消えちまった']], end: true } } },
  gravekeeper: { loc: 'yamate', label: '墓守の頼み', sub: '高台の墓地の門で、老人が端末を叩いている', cond: S => FREE(S) && S.wanted >= 6 && !S.flags.locGaien, nodes: {
    start: { t: ['高台の外人墓地の門の脇で、墓守の老人が、古い端末を平手で叩いていた。',
      ['墓守', '墓の下にな、回線が通っとる。昔の居留地の電信線だ。そこに、消し忘れた連中が住み着いてしまってな'],
      ['墓守', '人格データというやつだ。持ち主はとうに死んだのに、消去の手続きだけが漏れとる。悪さはせん。ただ、夜中に話し声がしてな。眠れんのだ'],
      ['墓守', '誰か、話を聞いてやってくれんか。わしはもう、耳が遠くてな']],
      c: [{ t: '「聞くだけなら」', to: 'yes', fx: S => { S.flags.locGaien = 1; } }, { t: '「幽霊は専門外だ」', to: 'no' }] },
    no: { t: [['墓守', '幽霊ではない。データだ。……まあ、違いはわしにも分からんが']], end: true, noDone: true },
    yes: { t: ['墓守は、錆びた鍵を一本よこした。', ['墓守', '納骨堂の床に、保守用の入口がある。足元に気をつけてな。あと、連中は話が長いぞ']], end: true } } },
  diver: { loc: 'honmoku', label: '潜水艇の船頭', sub: '岸壁に、小さな黄色い潜水艇が繋いである', cond: S => FREE(S) && S.wanted >= 9 && !S.flags.locHakkei, nodes: {
    start: { t: ['岸壁の端に、塗装の剥げた黄色い潜水艇が繋いであった。船頭は、釣り糸を垂れたまま、こちらを見もしない。',
      ['船頭', 'ハッケイの水族館、知ってるか。海面が上がった年に、丸ごと沈んだ'],
      ['船頭', '飼育員のロボットだけが残ってな。今でも毎朝、餌をやってる。魚は半分が機械に入れ替わっちまったが、連中は気にしちゃいない'],
      ['船頭', '片道300crで、入口まで下ろしてやる。帰りは連絡橋が生きてるから、自分で歩いて帰んな']],
      c: [{ t: '乗る', sub: '300cr', dis: S => S.credits < 300, to: 'go', fx: S => { S.credits -= 300; S.flags.locHakkei = 1; } }, { t: 'やめておく', sub: '', to: 'no' }] },
    no: { t: ['船頭の浮きが、ぴくりとも動かないまま、時間だけが過ぎた。'], end: true, noDone: true },
    go: { t: ['潜水艇は、湾の底へ十分ほど沈んだ。丸窓の外を、鱗の代わりに基板を貼りつけた魚が横切っていく。', 'ガラスのドームの入口に、色あせた看板があった。「ようこそ 本日のイルカショーは 14:00」。', '時計は、十四時の少し前で止まっていた。'], end: true } } },
  keirinflyer: { loc: 'kw', label: '工員寮の掲示板', sub: '日当の貼り紙の下に、車券の束が画鋲で留めてある', cond: S => FREE(S) && !S.flags.locKeirin, nodes: {
    start: { fx: S => { S.flags.locKeirin = 1; }, t: ['工員寮の掲示板に、外れ車券が何十枚も画鋲で留めてあった。供養のつもりらしい。',
      ['若い工員', '競輪だよ。工場の裏にバンクがあるんだ。ここの連中は、給料の半分をあそこに置いてくる'],
      ['若い工員', '飛び入りでも走れるぜ。自分の脚に賭けるのが一番確実だって、班長は言ってた。班長は先月、膝をやったけど']], end: true } } },
  labcard: { loc: 'ntport', label: '落とし物の入館証', sub: 'ロビーの床に、社章入りのカードが落ちている', cond: S => FREE(S) && S.wanted >= 9 && !S.flags.locLab, nodes: {
    start: { t: ['出発ロビーのベンチの下に、満の字の社章が入ったカードが落ちていた。「味覚再生研究所 第二種入館証」。', '有効期限は、六年前に切れている。裏に、手書きで小さく書いてあった。', '「閉鎖後も、裏の通用口は電池式。——所員一同」'],
      c: [{ t: '拾う', sub: '', to: 'take', fx: S => { S.flags.locLab = 1; } }, { t: '落とし物窓口に届ける', sub: '', to: 'no' }] },
    no: { t: ['窓口の係員は、カードを見るなり、黙って机の引き出しにしまった。引き出しには、同じカードが何十枚も入っていた。'], end: true },
    take: { t: ['カードの住所は、スペースポートの整備区画の、さらに奥だった。', '地図アプリには、その区画だけ建物が描かれていない。'], end: true } } },
  cucumber: { loc: 'ks', label: 'きゅうり泥棒', sub: '家庭菜園の老人が、畝の前で腕を組んでいる', cond: S => FREE(S) && S.done.ksgarden && !S.flags.locTone, nodes: {
    start: { t: ['ロータリーの家庭菜園で、老人が空っぽの畝を睨んでいた。',
      ['老人', 'きゅうりが、一晩で全部やられた。足跡が川の方へ続いとる。水かきの付いた足跡だ'],
      ['老人', 'トネ川の河童だ。わしの爺さんの代から、あそこにおる。相撲で勝てば、盗んだものを返すという話だが、勝った者をわしは知らん']],
      c: [{ t: '「取り返してくる」', to: 'yes', fx: S => { S.flags.locTone = 1; } }, { t: '「河童は実在しない」', to: 'no' }] },
    no: { t: [['老人', 'ほう。では、この足跡は何だ']], end: true, noDone: true },
    yes: { t: ['老人は、畝の端に残った一本だけのきゅうりを、新聞紙に包んでよこした。', ['老人', '土産に持っていけ。機嫌を損ねると、尻子玉を抜かれるぞ'], '尻子玉が何なのかは、聞かなかった。'], end: true } } },
  hashiriya: { loc: 'hk', label: '駐車場の改造車', sub: '湯治場の駐車場に、場違いに車高の低い車が停まっている', cond: S => FREE(S) && S.wanted >= 8 && !S.flags.locTouge, nodes: {
    start: { fx: S => { S.flags.locTouge = 1; }, t: ['湯治場の駐車場に、地面すれすれまで車高を落とした車が停まっていた。運転席で、若い男が温泉まんじゅうを食べている。',
      ['走り屋', '旧道だよ。新しいトンネルができて、廃道になった峠だ。ガードレールは半分落ちてるし、街灯は一本も点いてない'],
      ['走り屋', '最高だろ。夜の十時を過ぎたら、みんな集まる。走らなくても、見に来るだけでいいぜ。主の走りは、一回見といた方がいい']], end: true } } },
  wrongelev: { loc: 'kg', label: '行き先表示のないエレベーター', sub: '地下行きの列の端に、一基だけ、ボタンが上向きのものがある', cond: S => FREE(S) && (S.mallMax || 0) >= 5 && !S.flags.locRoof, nodes: {
    start: { fx: S => { S.flags.locRoof = 1; }, t: ['メガモールのエレベーターホールで、一基だけ、行き先表示が消えたままのものがあった。ボタンは「▲」しかない。', '乗ると、ずいぶん長く上った。',
      '扉が開くと、空があった。屋上駐車場だ。車は一台もなく、代わりに、屋台の提灯が何十も揺れている。',
      ['屋台の親父', 'いらっしゃい。下の連中には内緒だよ。ここはテナント料を払ってないんでね']], end: true } } },
  rabbitsign: { loc: 'mdock', label: '作業員の落書き', sub: '搬入口の壁に、矢印と兎の絵が描いてある', cond: S => !!S.flags.moon && !S.flags.locUsagi, nodes: {
    start: { fx: S => { S.flags.locUsagi = 1; }, t: ['搬入口の壁に、油性ペンで兎の絵が描いてあった。その下に矢印と、作業員の字。', '「裏側。徒歩九十分。餅あり。上司には言うな」', '矢印の先には、社用の地図に載っていない保守通路が続いている。',], end: true } } },
};

/* ---------- 場所ごとの出来事 ---------- */
const placeFarm = (loc, label, enc, t, w, l) => farm(loc, label, '何度でも戦える', enc, t, w, l);
const PLACEIN = {
  /* ネギシ競馬場跡 */
  farmNegishi: placeFarm('negishi', '暴れ機械馬を止める', 'farmNegishi', '第四コーナーの向こうから、蹄の音が逆向きに近づいてくる。', '機械馬は、おとなしく厩舎の方へ歩いていった。', '柵を飛び越えて逃げた。'),
  keiba: { loc: 'negishi', repeat: true, label: '馬券を買う', sub: '100cr。観察で馬の調子を読む。街が動くまでは3回', cond: S => (S.scav['kb' + S.wanted] || 0) < 3, nodes: {
    start: { t: ['無人の窓口で、発券機だけが動いていた。パドックを、六頭の機械馬が黙って周回している。', '関節の鳴り方、排気の色、蹄鉄の減り具合。見るところは、いくらでもある。'],
      c: [{ t: '馬券を買う', sub: '100cr', dis: S => S.credits < 100, to: 'bet', fx: S => { S.credits -= 100; S.scav['kb' + S.wanted] = (S.scav['kb' + S.wanted] || 0) + 1; } }, { t: '見るだけにする', sub: '', to: 'no' }] },
    no: { t: ['レースは定刻に始まり、定刻に終わった。歓声は、どこからも上がらなかった。'], end: true },
    bet: { t: ['ゲートが開く前に、もう一度だけパドックを見た。'], check: { stat: 'obs', lo: 5, hi: 8, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['買った馬は、第三コーナーで関節から煙を吹いた。', '馬券は、紙吹雪にもならなかった。'], end: true },
    o: { fx: S => { S.credits += 260; }, t: ['二着に粘った。複勝が当たった。', '260crを手に入れた。'], end: true },
    g: { fx: S => { S.credits += 600; }, t: ['排気の色がいちばん澄んでいた馬が、直線で三頭をまとめて抜いた。', '600crを手に入れた。発券機が、紙吹雪の代わりに外れ馬券を一枚吐いた。祝っているつもりらしい。'], end: true } } },
  negishioh: { loc: 'negishi', label: '無敗の機械馬', sub: '最終レースの出走表に、一頭だけ名前がある', cond: S => true, nodes: {
    start: { t: ['最終レースの出走表には、一頭の名前しかなかった。「ネギシオー 四十年無敗」。', '厩舎の前で、その馬は一頭だけでゲートに入り、一頭だけで走り、一頭だけでゴールしていた。',
      '相手がいないのだ。四十年間、ずっと。', '馬は、こちらに気づくと、蹄で地面を二度掻いた。出走表の空欄に、こちらの名前が印字された。'],
      c: [{ t: '走る', sub: '', to: 'go' }, { t: '出走を取り消す', sub: '', to: 'no' }] },
    no: { t: ['ネギシオーは、また一頭だけでゲートに入った。'], end: true, noDone: true },
    go: { t: ['ファンファーレが鳴った。四十年ぶりの、二頭立てだ。'], battle: { enc: 'negishiBoss', win: 'w', lose: 'l' } },
    l: { t: ['蹴り飛ばされて、芝の上に転がった。ネギシオーは、ゴール板の前で待っていた。もう一度来い、という顔だった。'], end: true, noDone: true },
    w: { fx: S => { give(S, one('hoof', AF(['spd', 3], ['atk', 4], ['pow', 18], ['cool', -15]))); }, t: ['ネギシオーは、ゴール板の手前で、初めて二着になった。', '馬はしばらく電光掲示板を見上げていた。それから、自分の蹄鉄を一枚、蹴り外してよこした。',
      '蹄鉄の裏に、端子が付いていた。メモリだ。', '一点物の「蹄鉄ギャロップ」を手に入れた。', '帰り際に振り返ると、ネギシオーは、また一頭だけでゲートに入っていた。出走表の二行目は、空けたままにしてあった。'], end: true } } },
  /* 外人墓地の地下回線 */
  farmGaien: placeFarm('gaien', '暴れるデータを鎮める', 'farmGaien', '中継室の端末が、勝手に点いた。', 'データは、回線の奥へ帰っていった。', '梯子を駆け上がって逃げた。'),
  ghostA: { loc: 'gaien', label: '貿易商のデータ', sub: '古い電信機から、咳払いが聞こえる', cond: S => true, nodes: {
    start: { t: ['電信機のスピーカーから、咳払いが聞こえた。',
      ['貿易商のデータ', '失礼。生糸の相場を、ご存じないかね。百六十年ほど、最新の値を聞いておらんのだ'],
      ['貿易商のデータ', '売り時を待っておるのだよ。倉庫に三千俵ある。……倉庫が今もあれば、の話だが']],
      c: [{ t: '「倉庫は、もう無い」', to: 'a', fx: S => { S.flags.ghostN = (S.flags.ghostN || 0) + 1; } }, { t: '「今は高値だ。売り時だよ」', to: 'b', fx: S => { S.flags.ghostN = (S.flags.ghostN || 0) + 1; } }] },
    a: { t: [['貿易商のデータ', '……そうか。まあ、そうだろうな。百六十年だ'], ['貿易商のデータ', '礼を言う。待つ理由がなくなるというのは、存外、悪くない心地だ'], '電信機のランプが、ゆっくり消えた。'], end: true },
    b: { t: [['貿易商のデータ', 'おお、そうか! では売ろう。全部だ。百六十年待った甲斐があった'], '電信機が、長い長い電文を打ちはじめた。宛先は、もう存在しない商館だった。', '打ち終えると、ランプは満足そうに消えた。'], end: true } } },
  ghostB: { loc: 'gaien', label: '歌手のデータ', sub: '回線の奥で、誰かが発声練習をしている', cond: S => true, nodes: {
    start: { t: ['配線の束の奥から、発声練習が聞こえた。',
      ['歌手のデータ', 'ねえ、聴いてくれる? 最後の曲だけ、録音が残ってないの。本番の前の晩に、あたし、死んじゃったから'],
      ['歌手のデータ', '客は一人でいいの。一人いれば、本番になるから']],
      c: [{ t: '最後まで聴く', to: 'a', fx: S => { S.flags.ghostN = (S.flags.ghostN || 0) + 1; partyRel(S, 1); } }] },
    a: { t: ['歌は、古い回線の雑音まじりだった。それでも、最後の音まで外さなかった。', '拍手をした。地下に、一人ぶんの拍手が響いた。', ['歌手のデータ', 'ありがと。アンコールは無しよ。本番は、一回きりだから'], '同行している仲間との仲が、少し深まった。'], end: true } } },
  ghostC: { loc: 'gaien', label: '子供のデータ', sub: '中継機の陰で、小さな声が数を数えている', cond: S => true, nodes: {
    start: { t: ['中継機の陰から、数を数える声がした。',
      ['子供のデータ', '……きゅうじゅうはち、きゅうじゅうきゅう、ひゃく。もういいかい'],
      ['子供のデータ', 'かくれんぼ。ぼくが鬼。みんな隠れたまま、出てこないんだ。ずっと'],
      '探す相手は、もう誰も残っていない。'],
      c: [{ t: '「みーつけた、と言ってごらん」', to: 'a', fx: S => { S.flags.ghostN = (S.flags.ghostN || 0) + 1; } }, { t: '「今度は、おれが鬼をやる」', to: 'b', fx: S => { S.flags.ghostN = (S.flags.ghostN || 0) + 1; } }] },
    a: { t: [['子供のデータ', '……みーつけた'], '回線のあちこちで、古いランプが一斉に点いた。見つかった、という合図のように。', ['子供のデータ', 'みんな、いた。……ずっと、ここにいたんだ']], end: true },
    b: { t: ['百まで数えた。数え終わると、中継機の陰には、もう誰もいなかった。', '床に、チョークで小さく書いてあった。「みつからなかったから ぼくのかち」。'], end: true } } },
  ghostEnd: { loc: 'gaien', label: '静かになった回線', sub: '話し声は、もう聞こえない', cond: S => (S.flags.ghostN || 0) >= 3, nodes: {
    start: { fx: S => { give(S, one('miren', AF(['tec', 6], ['seep', 50], ['hp', 25], ['cool', -15]))); S.credits += 300; }, t: ['地下回線は、静かになっていた。梯子の上で、墓守が待っていた。',
      ['墓守', '静かになった。久しぶりに、よく眠れそうだ'],
      ['墓守', '……これはな、連中が置いていったものだ。わしが持っていても、仕方がない'],
      '墓守がよこしたのは、古い電信機の部品を削って作ったメモリだった。中身は、誰のものでもない。三人ぶんの、言い残しだけが入っている。',
      '一点物の「誰かの未練」と、300crを手に入れた。'], end: true } } },
  /* ハッケイ海底水族館 */
  farmHakkei: placeFarm('hakkei', '展示ロボットを止める', 'farmHakkei', '大水槽の回廊で、何かがガラスを内側から叩いた。', '回廊は、また静かな青に戻った。', '連絡橋まで走って逃げた。'),
  aquatour: { loc: 'hakkei', label: '順路どおりに見学する', sub: '飼育員ロボットが、解説を続けている', cond: S => true, nodes: {
    start: { t: ['順路の最初の水槽で、飼育員ロボットが、誰もいない通路に向かって解説をしていた。',
      ['飼育員ロボット', 'こちらはマイワシの群れです。現在、七割が機械に置き換わっておりますが、群れの形は変わっておりません'],
      ['飼育員ロボット', 'どれが本物か、当ててみてください。当たったお客様は、開館以来、まだいらっしゃいません']],
      check: { stat: 'obs', lo: 7, hi: 10, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['全部、同じに見えた。', ['飼育員ロボット', '残念。ですが、それで正解なのかもしれません']], end: true },
    o: { fx: S => { S.items.gel += 2; S.items.coolant += 1; }, t: ['一匹だけ、群れの向きが変わる瞬間に、ほんの少し遅れた。', ['飼育員ロボット', '……正解です。開館以来、初めてのお客様です。記念品をどうぞ'], '売店の在庫だった修復ジェル2本と冷却スプレーを手に入れた。'], end: true },
    g: { fx: S => { S.items.gel += 2; give(S, mkInst(pickMem([['frost', 0.4], ['leech', 0.3], ['steam', 0.3]]), 3, null, true)); }, t: ['本物を三匹、続けて指さした。迷うたびに尾びれの先が震えるのが、本物だ。', ['飼育員ロボット', '……全問正解です。飼育員の私にも、もう分からないのに'], '飼育員ロボットは、胸のハッチからメモリを一本取り出した。「年間パスポートの代わりです」。', '修復ジェル2本と、メモリを手に入れた。'], end: true } } },
  dolphin: { loc: 'hakkei', repeat: true, label: '14時のイルカショー', sub: '時計は止まっているので、いつ行っても、もうすぐ始まる', cond: S => !S.scav['dol' + S.wanted], nodes: {
    start: { fx: S => { S.scav['dol' + S.wanted] = 1; partyRel(S, 1); }, t: [], dyn: S => ['スタジアムのプールで、一頭だけ残ったイルカが跳んだ。本物か機械かは、水しぶきでよく見えなかった。', '客席は、こちらだけだった。'].concat(S.party.length > 1 ? [`${party(S).filter(u => u.id !== 'hero').map(u => u.name).join('と')}は、最後まで拍手をしていた。`, '同行している仲間との仲が、少し深まった。'] : ['一人で、最後まで拍手をした。']), end: true } } },
  deepmaster: { loc: 'hakkei', label: '深海展示室', sub: '順路のいちばん奥。「調整中」の札が、五年ぶら下がっている', cond: S => S.done.aquatour, nodes: {
    start: { t: ['順路のいちばん奥、「調整中」の札の向こうは、照明が落ちていた。', '暗い水槽の底で、家一軒ほどの甲殻が、ゆっくりと向きを変えた。',
      ['飼育員ロボット', '深海の主です。五年前から、餌を一切受け付けません。理由は不明です'],
      ['飼育員ロボット', '……本当は、分かっています。展示室に、誰も来なくなったからです']],
      c: [{ t: '水槽のハッチを開ける', sub: '', to: 'go' }, { t: '引き返す', sub: '', to: 'no' }] },
    no: { t: ['「調整中」の札が、空調の風で揺れた。'], end: true, noDone: true },
    go: { t: ['ハッチを開けると、冷たい海水が足首まで流れ込んだ。主の十四本の脚が、一斉に動いた。'], battle: { enc: 'hakkeiBoss', win: 'w', lose: 'l' } },
    l: { t: ['水圧に押し流されて、順路の入口まで戻された。'], end: true, noDone: true },
    w: { fx: S => { give(S, one('deepsea', AF(['tec', 6], ['def', 4], ['hp', 25], ['pow', 18]))); }, t: ['深海の主は、動きを止めた。それから、飼育員ロボットの差し出した餌を、五年ぶりに食べた。',
      ['飼育員ロボット', '……食べました。記録します。記録を見る者は、もういませんが'],
      '主の甲殻の隙間から、古いメモリが一本、泡と一緒に浮いてきた。', '一点物の「深海圧」を手に入れた。'], end: true } } },
  /* カワサキ競輪場 */
  keirinrace: { loc: 'keirin', repeat: true, label: '飛び入りで走る', sub: '腕力で踏む。街が動くまでは2回', cond: S => (S.scav['kr' + S.wanted] || 0) < 2, nodes: {
    start: { fx: S => { S.scav['kr' + S.wanted] = (S.scav['kr' + S.wanted] || 0) + 1; }, t: [], dyn: S => ['貸し自転車には、ブレーキが付いていなかった。競輪とは、そういうものらしい。'].concat(member(S, 'pedal') && S.party.includes('pedal') ? [['ペダル', 'サドルが高え。あと二センチ下げろ。……違う、そっちは上げてる']] : []),
      check: { stat: 'pow', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'g' } },
    f: { fx: S => { S.credits += 30; }, t: ['二周目で脚が止まった。四十五度のバンクを、自転車ごと滑り落ちた。', '参加賞の30crを手に入れた。'], end: true },
    o: { fx: S => { S.credits += 220; }, t: ['最終コーナーで外から並びかけ、三着に入った。', '賞金の220crを手に入れた。'], end: true },
    g: { fx: S => { S.credits += 480; S.parts += 2; }, t: ['打鐘と同時に踏み込んだ。誰も、ついて来られなかった。', '賞金の480crと、副賞の部品2個を手に入れた。観客席の工員たちが、外れ車券を紙吹雪にして撒いた。'], end: true } } },
  keirinking: { loc: 'keirin', label: '競輪王への挑戦', sub: '検車場で、太ももの太い男がローラーを回している', cond: S => true, nodes: {
    start: { t: ['検車場の隅で、男がローラー台を回していた。回転数の表示は、とうに計器の上限を振り切っている。',
      ['競輪王ゴンドウ', '飛び入りか。いい脚をしてるな。……いや、世辞だ。細い'],
      ['競輪王ゴンドウ', '俺に勝ったら、この脚の秘密をやる。負けたら、車券を百枚買って帰れ']],
      c: [{ t: '「受けて立つ」', to: 'go' }, { t: '「車券だけ買って帰る」', to: 'no' }] },
    no: { t: [['競輪王ゴンドウ', 'それも競輪だ']], end: true, noDone: true },
    go: { t: ['号砲。先行したのは、ゴンドウのラインだった。'], battle: { enc: 'keirinBoss', win: 'w', lose: 'l' } },
    l: { fx: S => { S.credits = Math.max(0, S.credits - 100); }, t: ['バンクの下で、大の字になって空を見た。', '約束どおり、車券を買わされた。100crを失った。全部外れた。'], end: true, noDone: true },
    w: { fx: S => { give(S, one('bank', AF(['spd', 3], ['atk', 4], ['hp', 25], ['cool', -20]))); }, t: [], dyn: S => [['競輪王ゴンドウ', '……まくられた。二十年ぶりだ'], 'ゴンドウは、サドルの下から、テープで留めたメモリを剥がしてよこした。', ['競輪王ゴンドウ', '秘密なんてもんじゃない。四十五度のバンクで、内に落ちないための角度だ。体に入れとけ。人生にも使える'], '一点物の「バンク角45度」を手に入れた。'].concat(member(S, 'pedal') ? [['ペダル', '……おい。それ、あとでオレにも貸せよな']] : []), end: true } } },
  /* 味覚再生研究所 */
  farmLab: placeFarm('tastelab', '警備システムを黙らせる', 'farmLab', '廊下の非常灯が、一斉に赤に変わった。', '非常灯は、緑に戻った。', '通用口から転がり出た。'),
  labfile: { loc: 'tastelab', label: '資料室', sub: '棚に、被験者番号のファイルが並んでいる', cond: S => true, nodes: {
    start: { t: ['資料室の棚に、被験者のファイルが番号順に並んでいた。〇〇一番だけ、背表紙が擦り切れている。', '端末は生きているが、鍵がかかっている。'], check: { stat: 'tec', lo: 8, hi: 11, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['鍵は開かなかった。紙のファイルの方を開いた。', '被験者〇〇一。「甘味、反応なし。塩味、反応なし。旨味、反応なし」。同じ行が、何百ページも続いていた。'], end: true },
    o: { fx: S => { S.flags.labLore = 1; }, t: ['端末が開いた。被験者〇〇一の記録だった。', '「被験者は、毎回同じ料理名を口にする。朗々飯店の炒飯。当研究所は、その皿を再現できていない」',
      '「所見: 被験者が取り戻したいのは味覚ではない。あの一皿を食べた、ある一日である。当研究所の設備では対応できない」', '被験者の氏名欄は、黒く塗りつぶされていた。役職欄だけが残っている。「会長」。'], end: true },
    g: { fx: S => { S.flags.labLore = 1; give(S, mkInst(pickMem([['tongue', 0.5], ['steep', 0.5]]), 3, null, true)); }, t: ['端末が開いた。被験者〇〇一の記録だった。', '「被験者は、毎回同じ料理名を口にする。朗々飯店の炒飯。当研究所は、その皿を再現できていない」',
      '「所見: 被験者が取り戻したいのは味覚ではない。あの一皿を食べた、ある一日である。当研究所の設備では対応できない」', '被験者の氏名欄は、黒く塗りつぶされていた。役職欄だけが残っている。「会長」。',
      '記録の末尾に、所員の私物らしいファイルがあった。「退職金代わりに持ち出す予定だった試作品。持ち出しそびれた」。', '引き出しの奥から、メモリを手に入れた。'], end: true } } },
  labtongue: { loc: 'tastelab', label: '第一試験室', sub: '廊下の突き当たりから、何かを啜る音がする', cond: S => S.done.labfile, nodes: {
    start: { t: [], dyn: S => ['第一試験室の水槽に、巨大な人工舌が浮かんでいた。表面の味蕾が、こちらに向かって一斉に開く。', '水槽の脇に、六年前の日付の貼り紙があった。「閉鎖につき、給餌を停止します。——所員一同。ごめん」。'].concat(S.party.includes('satou') ? [['サトウ', '……この子、僕と同じです。味が分からないまま、ずっと、分かろうとしてる']] : []),
      c: [{ t: '水槽に近づく', sub: '', to: 'go' }, { t: '扉を閉める', sub: '', to: 'no' }] },
    no: { t: ['扉の向こうで、啜る音が続いていた。'], end: true, noDone: true },
    go: { t: ['水槽のガラスが、内側から割れた。'], battle: { enc: 'labBoss', win: 'w', lose: 'l' } },
    l: { t: ['舐め飛ばされて、廊下の端まで転がった。体じゅうが、出汁の匂いになった。'], end: true, noDone: true },
    w: { fx: S => { give(S, one('tastelab', AF(['tec', 6], ['hp', 25], ['seep', 50], ['def', 4]))); if (member(S, 'satou')) { rel(S, 'satou', 2); memo(S, 'satou', '味覚再生研究所で、試験体の最後を見届けた'); } }, t: [], dyn: S => ['試験体は、床の上でゆっくりと動きを止めた。最後に、味蕾が一度だけ閉じて、開いた。', '何かを、味わったように見えた。',
      '水槽の底の基部に、制御用のメモリが残っていた。', '一点物の「味覚再生試験体」を手に入れた。'].concat(member(S, 'satou') ? [['サトウ', '最後に、何の味がしたんでしょうね。……僕には、分かる気がします。分からないけど、分かる気がするんです'], 'サトウとの仲が深まった。'] : []), end: true } } },
  /* トネ川の河川敷 */
  kappasumo: { loc: 'tone', label: '河童と相撲を取る', sub: '葦の間に、土俵が作ってある', cond: S => true, nodes: {
    start: { t: ['葦を分けると、河原に土俵があった。俵の代わりに、盗んだきゅうりが円く並べてある。', '土俵の真ん中で、緑色の何かが、四股を踏んでいた。',
      ['トネ川の河童', '人間か。久しいな。取るか'],
      'それ以上の説明はなかった。河童の皿は、たしかに濡れている。'],
      c: [{ t: '土俵に上がる', sub: '', to: 'go' }, { t: '土産のきゅうりを置いて帰る', sub: '', to: 'no' }] },
    no: { t: ['河童は、きゅうりを一本、黙って齧った。'], end: true, noDone: true },
    go: { t: ['行司のいない土俵で、はっけよい、と河童が自分で言った。'], battle: { enc: 'kappaBoss', win: 'w', lose: 'l' } },
    l: { t: ['川に投げ込まれた。尻子玉は、無事だった。たぶん。'], end: true, noDone: true },
    w: { fx: S => { give(S, one('kappa', AF(['tec', 6], ['def', 4], ['cool', -20], ['spd', 3]))); S.items.gel += 2; }, t: ['河童は、土俵の外で尻餅をついたまま、長いこと空を見ていた。',
      ['トネ川の河童', '……負けた。三百年ぶりだ。前に負けた相手は、きゅうりを作っていた男の、そのまた爺さんだ'],
      '河童は、頭の皿を外した。外れるものだとは、知らなかった。皿の裏に、端子が並んでいる。',
      ['トネ川の河童', '持っていけ。皿は、また生えてくる'],
      '一点物の「河童の皿」と、きゅうりの束(修復ジェル2本ぶんの効き目がある)を手に入れた。', '河童が本物だったのかどうかは、結局、分からなかった。'], end: true } } },
  bbq: { loc: 'tone', repeat: true, label: '河川敷でバーベキュー', sub: '80cr。仲間と行くと仲が深まる。街が動くまでは1回', cond: S => !S.scav['bbq' + S.wanted], nodes: {
    start: { t: ['河川敷の貸しコンロは、一台80crだった。肉は合成だが、炭は本物だ。'], c: [{ t: '借りる', sub: '80cr', dis: S => S.credits < 80, to: 'go', fx: S => { S.credits -= 80; S.scav['bbq' + S.wanted] = 1; partyRel(S, 1); } }, { t: 'やめておく', sub: '', to: 'no' }] },
    no: { t: ['隣の家族連れの煙だけ、浴びて帰った。'], end: true },
    go: { t: [], dyn: S => ['炭が熾るまで、三十分かかった。その三十分が、いちばん良かった。'].concat(S.party.length > 1 ? ['同行している仲間との仲が、少し深まった。'] : ['一人で焼いて、一人で食べた。悪くなかった。']), end: true } } },
  yakyu: { loc: 'tone', repeat: true, label: '草野球の助っ人', sub: '観察で球筋を読む。街が動くまでは1回', cond: S => !S.scav['yk' + S.wanted], nodes: {
    start: { fx: S => { S.scav['yk' + S.wanted] = 1; }, t: ['河川敷のグラウンドで、商店街チームが八人で試合をしていた。九人目を、三十年探しているという。', ['監督', 'そこの兄ちゃん、代打だ。バットは振ったことあるか。ない? 構わん、うちは全員そうだ']], check: { stat: 'obs', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'g' } },
    f: { fx: S => { S.items.coolant += 1; }, t: ['三球三振。ベンチで、麦茶だけもらった。', '冷却スプレー(麦茶の水筒に入っていた)を手に入れた。'], end: true },
    o: { fx: S => { S.credits += 120; }, t: ['三球目を、右中間に運んだ。二塁打。', '試合後の打ち上げで、会費の残りを分けてもらった。120crを手に入れた。'], end: true },
    g: { fx: S => { S.credits += 120; S.parts += 3; }, t: ['初球を、川の向こう岸まで飛ばした。ボールは、河童が拾って投げ返してきた。', '120crと、商店街の電器屋が出した賞品の部品3個を手に入れた。'], end: true } } },
  /* 旧道ターンパイク */
  tougetime: { loc: 'touge', repeat: true, label: 'タイムアタック', sub: '技術でラインを読む。街が動くまでは1回', cond: S => !S.scav['tg' + S.wanted], nodes: {
    start: { fx: S => { S.scav['tg' + S.wanted] = 1; }, t: ['貸し車は、ハンドルが少し右に取られた。持ち主は「それも味だ」と言った。', '街灯のない峠道に、ヘッドライトの光だけが伸びている。'], check: { stat: 'tec', lo: 8, hi: 11, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['三つ目のカーブで、ガードレールのない側に膨らんだ。茂みが受け止めてくれた。', '貸し車の持ち主は、傷を数えて溜息をついた。'], end: true },
    o: { fx: S => { S.credits += 200; }, t: ['七曲がりを、破綻なく抜けた。', '賭けていた見物人から、200crの分け前をもらった。'], end: true },
    g: { fx: S => { S.credits += 450; }, t: ['七曲がりを、一度もブレーキを踏まずに抜けた。見物人が、言葉を失っていた。', '賭けの総取りで、450crを手に入れた。'], end: true } } },
  tougeking: { loc: 'touge', label: '峠の主', sub: '頂上の駐車場に、湯気の立つ白い車が停まっている', cond: S => true, nodes: {
    start: { t: ['頂上の駐車場に、白い車が停まっていた。ボンネットから、湯気が立っている。冷却水に、源泉を使っているらしい。',
      ['湯けむりのレイ', '走りに来たの? 見に来たの?'],
      ['湯けむりのレイ', 'あたしは、この道が廃道になった日から走ってる。誰も通らなくなった道は、誰かが走ってやらないと、本当に死ぬから']],
      c: [{ t: '「走りに来た」', to: 'go' }, { t: '「見に来た」', to: 'no' }] },
    no: { t: ['白い車は、湯気だけを残して闇に消えた。九十秒後、麓の方で、ヘッドライトが一度だけ瞬いた。'], end: true, noDone: true },
    go: { t: ['レイは、窓から手を出して、三本指を折っていった。三、二、一。'], battle: { enc: 'tougeBoss', win: 'w', lose: 'l' } },
    l: { t: ['一つ目のカーブで、もう尾灯が見えなくなった。'], end: true, noDone: true },
    w: { fx: S => { give(S, one('drift', AF(['spd', 3], ['atk', 4], ['pow', 18], ['tec', 6]))); }, t: ['麓の自販機の前で、レイは缶の汁粉を二本買った。一本を、こちらに投げてよこす。',
      ['湯けむりのレイ', '抜かれたの、初めて。……悪くないね、誰かの後ろを走るのって。道が、違って見える'],
      'レイは、ダッシュボードのスロットからメモリを抜いた。', ['湯けむりのレイ', 'あげる。あたしはもう、体が覚えてるから'],
      '一点物の「ドリフト走行」を手に入れた。'], end: true } } },
  /* 屋上駐車場の屋台村 */
  farmRoof: placeFarm('rooftop', '暴走カートを片づける', 'farmRoof', 'Cブロックの方から、車輪の音が列になって近づいてくる。', 'カートは、返却口におとなしく収まった。', '屋台の陰に隠れてやり過ごした。'),
  ryuseiya: { loc: 'rooftop', repeat: true, label: '屋台「流星」', sub: '60cr。屋台村のいちばん端。暖簾が、風もないのに揺れている', cond: S => (S.flags.ryuseiN || 0) < 3, nodes: {
    start: { t: [], dyn: S => [['屋台の最初の一杯は、黙って出てきた。', ['流星の親父', '替え玉は、言わなくても出す。顔を見りゃ分かる']], ['二度目の暖簾をくぐった。', ['流星の親父', '下の階へ降りるな、とは言わんよ。あんたは、降りる奴の顔をしてる']], ['三度目だ。親父は、こちらが座る前に麺を湯に落とした。', ['流星の親父', '今日で店を畳む。屋台ってのは、流れ星と同じでね。見た奴の中にしか残らない']]][Math.min(2, S.flags.ryuseiN || 0)],
      c: [{ t: '食べる', sub: '60cr', dis: S => S.credits < 60, to: 'eat', fx: S => { S.credits -= 60; S.flags.ryuseiN = (S.flags.ryuseiN || 0) + 1; partyRel(S, 1); if (S.flags.ryuseiN >= 3) give(S, one('ryusei', AF(['hp', 25], ['def', 4], ['cool', -20], ['seep', 50]))); } }, { t: 'また今度', sub: '', to: 'no' }] },
    no: { t: ['暖簾が、背中で揺れた。'], end: true },
    eat: { t: [], dyn: S => S.flags.ryuseiN >= 3 ? ['最後の一杯は、いつもより少しだけ、麺が多かった。', '食べ終えると、親父は暖簾を外して、畳んで、カウンターに置いた。', ['流星の親父', '持っていきな。暖簾は、掛ける場所があって初めて暖簾だ。あんたなら、どこかに掛けるだろ'], '暖簾の裏地に、端子が縫い込んであった。', '一点物の「屋台『流星』の暖簾」を手に入れた。', '振り返ると、屋台村のいちばん端は、ただの駐車区画に戻っていた。'] : ['旨かった。空の丼を置くと、替え玉が、言う前に入った。', '同行している仲間との仲が、少し深まった。'], end: true } } },
  roofpermit: { loc: 'rooftop', label: '営業許可証の提示', sub: 'エレベーターの方から、マネキンの足音がする', cond: S => (S.flags.ryuseiN || 0) >= 1, nodes: {
    start: { t: ['エレベーターの扉が開いて、警備マネキンが降りてきた。首が、屋台の提灯を一つずつ数えている。', ['警備マネキン', '当館の屋上に、テナント契約は存在しません。営業許可証を提示してください。提示がない場合、全店舗を「落とし物」として処理します'],
      '屋台の親父たちが、一斉にこちらを見た。'], check: { stat: 'talk', lo: 7, hi: 10, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['言いくるめようとしたが、マネキンは「該当する規約がありません」を繰り返すだけだった。'], c: [{ t: '実力で帰ってもらう', to: 'go' }] },
    o: { t: ['「ここは駐車場だ。屋台は全部、車両だ」と言い張った。マネキンは三十秒、黙った。', ['警備マネキン', '……車両であれば、駐車料金が発生します。二十年分です'], '結局、払う気のない料金の請求で揉めた。'], c: [{ t: '実力で帰ってもらう', to: 'go' }] },
    g: { fx: S => { S.mallPt = (S.mallPt || 0) + 100; S.credits += 300; }, t: ['「ここは駐車場だ。屋台は全部、車両だ。そしてお客様駐車場は、お買い上げ金額に応じて無料になる」と言い切った。', ['警備マネキン', '……規約を確認しました。該当します。失礼いたしました。お買い上げ、ありがとうございます'],
      'マネキンは深々と頭を下げて、エレベーターに戻っていった。屋台村に、拍手が起きた。', '親父たちのカンパ300crと、なぜかモールポイント100ptを手に入れた。'], end: true },
    go: { t: ['マネキンの腕が、警棒の形に組み替わった。'], battle: { enc: 'roofFight', win: 'w', lose: 'l' } },
    l: { t: ['屋台の陰に引きずり込まれて、助かった。マネキンは、提灯を数え直している。'], end: true, noDone: true },
    w: { fx: S => { S.credits += 300; S.items.gel += 2; }, t: ['マネキンたちは、エレベーターに詰め込まれて、地下へ送り返された。', '親父たちが、売り上げから少しずつ出し合った。300crと修復ジェル2本を手に入れた。'], end: true } } },
  /* 月の裏の餅つき場 */
  mochieat: { loc: 'usagi', repeat: true, label: 'つきたての餅を食べる', sub: '仲間と行くと仲が深まる。街が動くまでは1回', cond: S => S.done.mochiking && !S.scav['mc' + S.wanted], nodes: {
    start: { fx: S => { S.scav['mc' + S.wanted] = 1; partyRel(S, 1); S.items.gel += 1; }, t: ['キネとウスは、こちらの人数を数えて、その数だけ餅をついた。', '低重力でつく餅は、よく伸びる。伸びすぎて、最後は立って食べた。', '同行している仲間との仲が、少し深まった。包んでもらった餅(修復ジェルと同じ効き目がある)を手に入れた。'], end: true } } },
  mochiking: { loc: 'usagi', label: '餅つきの音', sub: 'ドームの中から、一定の間隔で、重い音がする', cond: S => true, nodes: {
    start: { t: ['月の裏側の小さなドームの中に、臼と杵があった。どちらにも、脚が生えている。', '壁一面に、真空パックの餅が積み上がっていた。製造日は、いちばん古いもので四百年前。',
      ['ウス', '……キャク……?'], ['キネ', 'キャク。キャクダ。ヨンヒャクネン、マッタ'],
      '二体は、こちらに向き直った。餅をつく構えのままで。', '客をもてなす手順が、餅をつく手順しか入っていないらしい。'],
      c: [{ t: '「つかれる側には、なりたくない」と構える', sub: '', to: 'go' }, { t: 'そっと扉を閉める', sub: '', to: 'no' }] },
    no: { t: ['扉の向こうで、また、ぺったん、と音がした。'], end: true, noDone: true },
    go: { t: ['キネが振り上がった。月の重力では、それは、とてもゆっくりに見えた。見えただけだった。'], battle: { enc: 'mochiBoss', win: 'w', lose: 'l' } },
    l: { t: ['つかれた。平たくなって、ドームの外に転がり出た。'], end: true, noDone: true },
    w: { fx: S => { give(S, one('mochi', AF(['atk', 4], ['pow', 18], ['hp', 25], ['spd', 3]))); }, t: ['キネとウスは、膝を折って座り込んだ。', ['ウス', '……キャク、ツヨイ'], ['キネ', 'モチ、タベルカ'],
      '出された餅は、四百年前のものではなく、今ついたものだった。地球が見えない側で食べる餅は、妙に旨かった。', 'キネが、柄の中からメモリを一本、押し出した。杵の振り方が入っている。',
      '一点物の「月の餅つき」を手に入れた。', '誰がここを建てたのかは、二体も知らなかった。「ウサギ」とだけ、言った。'], end: true } } },
};
/* ---------- 既存の場所の寄り道(追加) ---------- */
const SIDE3 = {
  radio: { loc: 'pier', label: 'ジャンク山の短波ラジオ', sub: '基板の山の下から、雑音が聞こえる', cond: FREE, nodes: {
    start: { t: ['ジャンク山の中腹で、半分埋もれたラジオが、まだ雑音を出していた。電池は入っていない。どこから電気を取っているのかは、分からない。'], check: { stat: 'tec', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['裏蓋を開けた途端に、雑音は止まった。直したのか壊したのかは、判断がつかなかった。'], end: true, noDone: true },
    o: { fx: S => { S.flags.radio = 1; }, t: ['同調つまみの接点を磨くと、雑音の中から声が浮いてきた。', '「……こちらは、海賊放送ヨコハマ湾岸。今夜も、誰も聴いていない皆さんへ」', 'ラジオを、ねぐらに持ち帰った。'], end: true },
    g: { fx: S => { S.flags.radio = 1; S.parts += 3; }, t: ['同調つまみの接点を磨くと、雑音の中から声が浮いてきた。', '「……こちらは、海賊放送ヨコハマ湾岸。今夜も、誰も聴いていない皆さんへ」', 'ついでに、余った部品を3個抜いた。ラジオは、それでも鳴っている。', 'ラジオを、ねぐらに持ち帰った。'], end: true } } },
  radiolisten: { loc: 'pier', repeat: true, label: '海賊放送を聴く', sub: 'ねぐらのラジオ。街が動くまでは1回', cond: S => S.flags.radio && !S.scav['rd' + S.wanted], nodes: {
    start: { fx: S => { S.scav['rd' + S.wanted] = 1; }, t: ['ラジオのつまみを、いつもの位置に合わせた。', '「こちらは、海賊放送ヨコハマ湾岸」'], end: true } } },
  gyoza: { loc: 'chinatown', label: '餃子早食い大会', sub: '屋台の前に、長机と山盛りの皿が並んでいる', cond: S => FREE(S) && S.wanted >= 2, nodes: {
    start: { t: ['朗々幇が仕切る、年に一度の餃子早食い大会だった。合成餃子、制限時間三分。', ['司会の下っ端', '飛び入り歓迎! 優勝賞金300cr! 参加費は腹の皮だ!']], check: { stat: 'pow', lo: 5, hi: 8, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['十二個目で、舌の端子が「満腹」の実感を勝手に書き込んできた。', '参加賞は、胃薬だった。'], end: true },
    o: { fx: S => { S.credits += 150; }, t: ['四十一個。準優勝だった。優勝したのは、屋台の裏から出てきた粥の屋台の老婆で、八十個を、顔色ひとつ変えずに食べた。', '賞金150crを手に入れた。'], end: true },
    g: { fx: S => { S.credits += 300; S.items.gel += 1; }, t: ['七十九個。粥の屋台の老婆は、八十個目を箸で持ち上げて、皿に戻した。', ['粥の屋台の老婆', '若いのに花を持たせるのも、年寄りの仕事さ'], '賞金300crと、副賞の修復ジェルを手に入れた。'], end: true } } },
  lionmask: { loc: 'chinatown', label: '獅子舞ロボの修理', sub: '門の下で、獅子の頭が片方だけ動いている', cond: S => FREE(S) && S.wanted >= 4, nodes: {
    start: { t: ['善隣門の下で、獅子舞ロボットが、前足だけで踊っていた。後ろ足の担当は、去年から動いていないという。', ['門番の下っ端', '春節までに直さねえと、幇主に粥で煮られる。直せるか?']], check: { stat: 'tec', lo: 7, hi: 10, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['後ろ足は動いた。ただし、前足と逆の方向に。獅子は、その場で綱引きを始めた。', ['門番の下っ端', '……去年よりは、賑やかでいいか']], end: true },
    o: { fx: S => { S.credits += 200; }, t: ['後ろ足の関節に詰まっていた爆竹の燃えかすを、ピンセットで抜いた。獅子は、一年ぶりに四本足で跳ねた。', '礼金200crを手に入れた。'], end: true },
    g: { fx: S => { S.credits += 200; give(S, mkInst(pickMem([['cleaver', 0.4], ['serve', 0.3], ['hashi', 0.3]]), 3, null, true)); }, t: ['後ろ足を直し、ついでに獅子の顎の噛み合わせも調整した。獅子は、門番の頭を甘噛みして喜んだ。', ['門番の下っ端', '痛え! ……いや、縁起がいいんだ、これは'], '礼金200crと、獅子の口の中に供えてあったメモリを手に入れた。'], end: true } } },
  lostcat: { loc: 'noge', label: '迷い猫の貼り紙', sub: '電柱に、手描きの猫の絵が貼ってある', cond: S => FREE(S) && S.wanted >= 3 && !S.flags.catFound, nodes: {
    start: { fx: S => { S.flags.catQuest = 1; }, t: ['電柱の貼り紙。「さがしています。ねこ型ドローン『おもち』。白。しっぽのアンテナが曲がっています。高いところが好き」。', '貼り紙の下に、小さな字で足してあった。「とまった観覧車を見るのが好きでした」。'], end: true } } },
  lostcat2: { loc: 'minato', label: '観覧車の上の白いもの', sub: 'ゴンドラの屋根で、アンテナが揺れている', cond: S => S.flags.catQuest && !S.flags.catFound, nodes: {
    start: { t: ['止まった観覧車の、下から三つ目のゴンドラの屋根に、白い猫型ドローンが丸まっていた。しっぽのアンテナが曲がっている。', '呼んでも降りてこない。充電が切れかけているのか、眠っているだけなのか。'],
      c: [{ t: '鉄骨を登る', sub: '', to: 'climb' }, { t: '下で待つ', sub: '', to: 'wait' }] },
    climb: { fx: S => { S.flags.catFound = 1; }, t: ['鉄骨を三つ目のゴンドラまで登った。ドローンは片目だけ開けて、こちらの上着の中に、自分から入ってきた。', '温かかった。排熱だ。'], end: true },
    wait: { fx: S => { S.flags.catFound = 1; }, t: ['一時間、下で待った。日が傾いたころ、ドローンは伸びをして、鉄骨を一段ずつ降りてきた。', 'こちらの足に、一度だけ頭をこすりつけた。'], end: true } } },
  lostcat3: { loc: 'noge', label: '「おもち」を届ける', sub: '貼り紙の住所は、路地の奥の二階', cond: S => S.flags.catFound && !S.done.lostcat3, nodes: {
    start: { fx: S => { S.credits += 150; give(S, mkInst('decoy', 3, null, true)); }, t: ['路地の奥の二階で、扉を開けたのは、十歳くらいの子供だった。', ['子供', 'おもち! ……しっぽ、まだ曲がってる。よかった。直ってたら、おもちじゃないもん'],
      '子供は、貯金箱をひっくり返した。150cr。それから、おもちの予備のメモリを一本。', ['子供', 'おもちは、ときどき観覧車に行くの。止まってるのに、回るのを待ってるんだと思う'], '150crと、メモリを手に入れた。'], end: true } } },
  cafeteria: { loc: 'kannai', label: '社員食堂に紛れ込む', sub: '昼休みの列が、通用口の外まで伸びている', cond: S => FREE(S) && S.wanted >= 6, nodes: {
    start: { t: ['マンカン本社の社員食堂は、十二時ちょうどに開く。社員証の確認は、列が長すぎて、誰もしていない。'], check: { stat: 'talk', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['トレイを持った瞬間に、後ろの社員に聞かれた。「どこの部署?」。答えに二秒かかった。二秒は、長すぎた。', '警備員が来る前に、漬物だけ取って逃げた。'], end: true, noDone: true },
    o: { fx: S => { S.items.gel += 2; }, t: ['「品質保証部の出向です」で通った。日替わり定食は、舌の端子に「母の味」と書き込んでくる仕様だった。誰の母かは、指定されていない。', '隣の席の社員は、食べながら泣いていた。毎日だという。', '帰りに、救護室の棚から修復ジェル2本を持ち出した。'], end: true },
    g: { fx: S => { S.items.gel += 2; S.credits += 250; }, t: ['「品質保証部の出向です」で通った。ついでに、隣の席の課長の愚痴を四十分聞いた。', ['課長', '会長は、もう何年も食堂に降りてこない。昔は毎日、炒飯だけ頼んでたらしい。一口食べて、残して帰るんだと'],
      '課長は、愚痴の礼だと言って、経費で落ちる食券の束をくれた。換金すると250crになった。修復ジェル2本も持ち出した。'], end: true } } },
  ferris: { loc: 'minato', label: '観覧車の管理人', sub: '止まった観覧車の根元に、小さな詰所がある', cond: S => FREE(S) && S.wanted >= 5, nodes: {
    start: { t: ['詰所の端末に、管理AIがまだ常駐していた。', ['観覧車の管理AI', '本日の運行は、強風のため見合わせております。……三十一年間、見合わせております'], ['観覧車の管理AI', '風速は、現在ゼロです。ですが、見合わせを解除する権限を持つ者が、もうおりません']], check: { stat: 'talk', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: [['観覧車の管理AI', '申し訳ございません。お客様には、その権限がございません'], '観覧車は、止まったままだった。'], end: true, noDone: true },
    o: { fx: S => { partyRel(S, 1); }, t: ['「お客様の声」として、運行再開の要望を出した。', ['観覧車の管理AI', '……要望を受理しました。三十一年ぶりの、お客様の声です。一周だけ、試運転をいたします'], '観覧車は、軋みながら一周だけ回った。てっぺんから、ネオヨコハマの全部が見えた。', '同行している仲間との仲が、少し深まった。'], end: true },
    g: { fx: S => { partyRel(S, 2); }, t: ['「お客様の声」として、運行再開の要望を出した。ついでに、三十一年ぶんの勤続を労った。', ['観覧車の管理AI', '……ありがとうございます。その言葉は、マニュアルにありませんでした'], '観覧車は、軋みながら二周回った。二周目は、AIのおまけだった。', '同行している仲間との仲が深まった。'], end: true } } },
  antique: { loc: 'yamate', label: '高台の骨董市', sub: '洋館の庭に、がらくたと宝物が、区別なく並んでいる', cond: S => FREE(S) && S.wanted >= 7, nodes: {
    start: { t: ['月に一度の骨董市。古い基板も、本物の陶器も、同じ値札で並んでいる。売り手も、どれが何なのか分かっていない。'], check: { stat: 'obs', lo: 7, hi: 10, fail: 'f', ok: 'o', great: 'g' } },
    f: { fx: S => { S.credits = Math.max(0, S.credits - 100); S.parts += 1; }, t: ['「軍用の未開封品」を100crで買った。開けたら、中身は文鎮だった。', '文鎮は、分解したら部品1個になった。'], end: true },
    o: { fx: S => { give(S, mkInst(pickMem([['mirror', 0.3], ['frost', 0.3], ['decoy', 0.2], ['cloak', 0.2]]), 2, null, true)); }, t: ['がらくたの箱の底で、端子の金メッキが本物のメモリを見つけた。値札は「文鎮 30cr」。', 'メモリを手に入れた。'], end: true },
    g: { fx: S => { give(S, mkInst(pickMem([['mirror', 0.3], ['frost', 0.3], ['decoy', 0.2], ['cloak', 0.2]]), 4, null, true)); }, t: ['がらくたの箱の底で、製造番号が一桁のメモリを見つけた。値札は「文鎮 30cr」。', '売り手の老婦人は、こちらの顔を見て笑った。', ['老婦人', 'それに気づくなら、あなたが持つべきね。主人の形見なの。文鎮だと思ってたけど'], '最高レアリティのメモリを手に入れた。'], end: true } } },
  container: { loc: 'honmoku', label: '開かずのコンテナ', sub: '闇市の競りに、中身の分からないコンテナが出ている', cond: S => FREE(S) && S.wanted >= 8, nodes: {
    start: { t: ['闇市の競り。十年前に陸揚げされて、誰も引き取りに来なかったコンテナだ。', ['競り人', '中身は不明! 開けた奴のもの! ただし、開けるのは自分でやってくれ。うちの若いのは、三人ほど指をやった'],
      '入札は、こちらだけだった。'], c: [{ t: '落札する', sub: '200cr', dis: S => S.credits < 200, to: 'open', fx: S => { S.credits -= 200; } }, { t: '見送る', sub: '', to: 'no' }] },
    no: { t: ['コンテナは、来月の競りに回された。十年間、毎月そうなっているらしい。'], end: true, noDone: true },
    open: { t: ['錠を切った。扉の隙間から、赤い照準の光が漏れた。'], battle: { enc: 'containerFight', win: 'w', lose: 'l' } },
    l: { fx: S => { S.credits += 200; }, t: ['扉を閉め直して、競り人に突き返した。落札金は返ってきた。そういう契約らしい。'], end: true, noDone: true },
    w: { fx: S => { S.credits += 600; S.parts += 5; give(S, mkInst(pickMem([['missile', 0.3], ['armor', 0.4], ['barrier', 0.3]]), 3, null, true)); }, t: ['警備ロボットの奥に、彼らが十年間守っていた積み荷があった。', '木箱が一つ。中身は、本物の醤油の一斗缶だった。闇市で600crになった。', '600crと部品5個、警備ロボットのメモリを手に入れた。'], end: true } } },
  queue: { loc: 'gate7', scene: 'gw', label: '行列の整理', sub: '暖簾の前の列が、隣の路地まではみ出している', cond: S => FREE(S) && S.flags.gw, nodes: {
    start: { t: ['麺処グラヴィティ・ウェルの行列が、路地を二回折れていた。「元祖」と「本家」の客引きアンドロイドが、列の客を左右から引き抜こうとしている。', '寸胴型のロボットが、暖簾の隙間から、困ったようにこちらを見た。'], check: { stat: 'talk', lo: 5, hi: 8, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['列を整理しようとして、自分が最後尾に並ばされた。二時間待った。旨かった。'], end: true },
    o: { fx: S => { S.items.gel += 1; }, t: ['最後尾の札を持って、一時間立った。客引きアンドロイドは、札を持つ者には手を出さない決まりらしい。', '寸胴型のロボットが、煮卵を一つ、黙って持たせてくれた。修復ジェルと同じ効き目がある。'], end: true },
    g: { fx: S => { S.items.gel += 2; partyRel(S, 1); }, t: ['最後尾の札を持って立ち、ついでに「元祖」と「本家」に、互いの店の列を整理させた。二体は、初めて協力した。', '寸胴型のロボットが、全員ぶんの煮卵を持たせてくれた。', '修復ジェル2個ぶんの煮卵を手に入れた。同行している仲間との仲が、少し深まった。'], end: true } } },
  lostbag: { loc: 'ntport', label: '回り続けるスーツケース', sub: '手荷物受取所のベルトに、一つだけ残っている', cond: S => FREE(S) && S.wanted >= 6, nodes: {
    start: { t: ['手荷物受取所のベルトコンベアを、古いスーツケースが一つだけ回っていた。タグの日付は、四十年前。', '係員は、誰も止めないのだと言った。持ち主が来たとき、回っていないと困るから。'], check: { stat: 'obs', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['タグの字は、かすれて読めなかった。スーツケースは、また一周した。'], end: true, noDone: true },
    o: { fx: S => { S.credits += 180; }, t: ['タグの裏に、鉛筆で書いた宛先が残っていた。カシワタウンの住所だ。', '係員に伝えると、礼にと、忘れ物保管料の払い戻し分をくれた。180crを手に入れた。', 'スーツケースは、四十年ぶりにベルトから降ろされた。'], end: true },
    g: { fx: S => { S.credits += 180; S.flags.bagKs = 1; }, t: ['タグの裏に、鉛筆で書いた宛先が残っていた。カシワタウンの、天文台の住所だ。差出人は「月面建設隊 M」。', '係員に伝えると、180crの礼が出た。', 'スーツケースは、四十年ぶりにベルトから降ろされた。中で、何かが小さく転がる音がした。石のような音だった。'], end: true } } },
  nightshift: { loc: 'kw', label: '夜勤の代打', sub: '詰所の前で、班長が頭を抱えている', cond: S => FREE(S) && S.wanted >= 7, nodes: {
    start: { t: [['班長', '検品の若いのが、三人まとめて競輪で膝をやった。今夜だけでいい、ラインに入ってくれ。不良品を弾くだけだ']], check: { stat: 'tec', lo: 7, hi: 10, fail: 'f', ok: 'o', great: 'g' } },
    f: { fx: S => { S.credits += 60; }, t: ['不良品と良品の区別が、最後までつかなかった。全部通した。', '班長は、黙って60crをくれた。「明日は来なくていい」。'], end: true },
    o: { fx: S => { S.credits += 260; }, t: ['八時間、溶接の継ぎ目だけを見続けた。朝には、目を閉じても継ぎ目が見えた。', '夜勤手当260crを手に入れた。'], end: true },
    g: { fx: S => { S.credits += 260; give(S, mkInst(pickMem([['weld', 0.5], ['saw', 0.5]]), 3, null, true)); }, t: ['不良品を弾くついでに、不良の原因になっていた治具のずれを直した。ラインの歩留まりが、一晩で二割上がった。', ['班長', '……うちに来ねえか。いや、来ねえよな。顔に書いてある'], '夜勤手当260crと、班長の工具箱のメモリを手に入れた。'], end: true } } },
  pingpong: { loc: 'hk', repeat: true, label: '温泉卓球', sub: '観察で回転を読む。街が動くまでは1回', cond: S => FREE(S) && !S.scav['pp' + S.wanted], nodes: {
    start: { fx: S => { S.scav['pp' + S.wanted] = 1; }, t: ['娯楽室の卓球台は、片側が湿気で反っている。常連の湯治客は、その反りを計算に入れて打ってくる。', ['湯治客', '浴衣で来な。浴衣じゃない卓球は、卓球じゃない']], check: { stat: 'obs', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['反りに全部やられた。11対0。', '湯治客は、牛乳をおごってくれた。'], end: true },
    o: { fx: S => { S.credits += 100; partyRel(S, 1); }, t: ['三ゲーム目で、反りの癖が読めた。勝った。', '賭けていた牛乳代100crを手に入れた。同行している仲間との仲が、少し深まった。'], end: true },
    g: { fx: S => { S.credits += 100; S.items.coolant += 1; partyRel(S, 1); }, t: ['反りを使って、逆に相手を振り回した。湯治客は、笑いながら浴衣の帯を締め直した。', ['湯治客', '参った。あんた、明日も来な。明日は台を裏返しておく'], '100crと冷却スプレーを手に入れた。同行している仲間との仲が、少し深まった。'], end: true } } },
  taiso: { loc: 'ks', repeat: true, label: '朝のラジオ体操', sub: 'ロータリーの真ん中。スタンプを五つ集めると何かもらえる', cond: S => FREE(S) && !S.scav['ts' + S.wanted] && (S.flags.taisoN || 0) < 5, nodes: {
    start: { fx: S => { S.scav['ts' + S.wanted] = 1; S.flags.taisoN = (S.flags.taisoN || 0) + 1; if (S.flags.taisoN >= 5) give(S, mkInst('adrenal', 4, AF(['hp', 25], ['spd', 3], ['atk', 4], ['cool', -20]), true)); }, t: [], dyn: S => ['朝六時半。ロータリーの真ん中で、老人たちが、音の割れたスピーカーに合わせて腕を回している。', '手配書の顔が混ざっていても、誰も気にしなかった。第二まで、きっちりやった。', `スタンプを押してもらった(${S.flags.taisoN}/5)。`].concat(S.flags.taisoN >= 5 ? [['体操の世話役', '皆勤賞だ。これは、うちの死んだ亭主が毎朝挿してたやつでね。九十四まで生きたよ'], '最高レアリティの「アドレナリン・ブースト」を手に入れた。'] : []), end: true } } },
  lowgball: { loc: 'mdock', label: '低重力バスケット', sub: '搬入口の隅に、手作りのゴールが立っている', cond: S => !!S.flags.moon, nodes: {
    start: { t: ['搬入口の作業員たちが、休憩時間にバスケットをしていた。ゴールの高さは、九メートル。月では、それでちょうどいい。', ['作業員', '地球から来たのか。じゃあ跳べるだろ。こっちの連中は、脚が細くなっちまってな']], check: { stat: 'pow', lo: 8, hi: 11, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['跳びすぎた。天井の配管に頭をぶつけて、ゆっくり落ちてきた。作業員たちは、落ちてくるまでの間、ずっと笑っていた。'], end: true },
    o: { fx: S => { S.items.gel += 2; }, t: ['九メートルのゴールに、片手で叩き込んだ。着地まで、四秒かかった。', '作業員たちが、救護箱の修復ジェルを2本、賞品に出した。'], end: true },
    g: { fx: S => { S.items.gel += 2; give(S, mkInst('lowg', 3, null, true)); }, t: ['九メートルのゴールに、一回転して叩き込んだ。着地まで、四秒かかった。その四秒間、搬入口は静まり返っていた。', '修復ジェル2本と、作業員が休憩用に持っていたメモリを手に入れた。'], end: true } } },
};
/* 海賊放送の番組(くり返しで内容が変わる) */
const VRADIO = [
  V(2, ['「本日の湾岸の天気。雨。明日も雨。明後日は、雨のち雨でしょう」', '天気予報は、それで終わりだった。']),
  V(2, ['「お便りを読みます。……お便りは、ありません。三千二百日連続です。記録を更新しました」']),
  V(2, ['「今夜の一曲。誰が歌っているのか、局の誰も知りません。テープに、曲名も書いてありません。いい曲です」', '流れたのは、古い歌だった。最後まで聴いた。']),
  V(1, ['「尋ね人のコーナー。朗々飯店の出前持ちだった方。岡持ちを、まだ預かっています。中身は、冷めていません」', '冷めていないはずがない、と思った。']),
  V(1, ['「湾岸の小ネタ。ネギシの丘では、今も毎日、定刻に馬が走っています。賭けている人間は、高架下の一人だけです」']),
  V(1, ['「湾岸の小ネタ。メガモールの屋上には、地図に無い屋台村があるそうです。局の者は、エレベーターを見つけられませんでした」']),
  V(1, ['「湾岸の小ネタ。トネ川の河童は、相撲に負けたことがありません。挑んだ人間も、ここ三百年、いません」']),
  V(1, ['「深夜の訂正。先週お伝えした『月は遠い』というニュースですが、正しくは『月は、思ったより近い』でした。お詫びします」']),
  V(1, ['「リスナーの皆さんに、プレゼントです。この放送を聴いている方は、ねぐらの裏を掘ってみてください」', '掘ってみた。本当に、缶が埋まっていた。', '60crを手に入れた。'], S => { S.credits += 60; }),
  V(1, S => { const n = pmName(S); return n ? [`「今夜は、ここまで。おやすみなさい。隣にいる人にも、おやすみと言ってください」`, `${n}が、小さく「おやすみ」と言った。ラジオに言ったのか、こちらに言ったのかは、分からなかった。`] : ['「今夜は、ここまで。おやすみなさい。一人で聴いているあなたへ」']; }),
];
VARY.radiolisten = { start: VRADIO };
VARY.keiba = { o: [nothing, V(1, ['隣の発券機が、頼んでもいないのに、もう一枚吐き出した。当たっていた。', 'さらに80crを手に入れた。'], S => { S.credits += 80; }), V(1, S => { const n = pmName(S); return n ? [`${n}は、いちばん遅い馬を最後まで応援していた。その馬は、五分遅れでゴールした。`] : ['いちばん遅い馬は、五分遅れでゴールした。誰も見ていなかったが、最後まで走った。']; })],
  g: [nothing, V(1, ['高架下の予想屋の「七番」は、最下位だった。'])] };
VARY.pingpong = { o: [nothing, V(1, S => { const n = pmName(S); return n ? [`${n}は、ルールを知らないまま、審判を買って出ていた。判定は、全部こちらに有利だった。`] : ['見物の湯治客が、点数を勝手に数え間違えた。こちらに有利な方へ。']; })] };
VARY.dolphin = { start: [nothing, V(1, ['ショーの終わりに、イルカは観客席へ水をかけた。演目の一部だ。四十年ぶりに、濡れる客がいた。']), V(1, ['飼育員ロボットが、客席の最前列で、笛を吹く真似をしていた。笛は、とうに失くしたらしい。'])] };
VARY.bbq = { go: [nothing, V(1, S => { const n = pmName(S); return n ? [`${n}が、肉を焦がした。誰も何も言わずに、焦げたところを食べた。`] : ['肉を焦がした。焦げたところも食べた。']; }), V(1, ['川の方から、濡れた手が一本伸びて、きゅうりを一本だけ持っていった。見なかったことにした。'])] };
/* ---------- 仲間同士の出来事(追加) ---------- */
const PAIREV2 = Object.assign({},
  pairEv('killpedal', 'kill', 'pedal', { loc: 'noge', cond: S => S.wanted >= 5, label: '屋根の上と路地の下', sub: '物干し台から、紙飛行機が落ちてくる',
    memo: ['ペダルと、屋根と路地で伝言を投げ合った', 'キルチョイサーに、紙飛行機の折り方を教えた'],
    t: ['ノゲの路地を、ペダルが配達で走り抜けていく。その頭上、物干し台の上に、キルチョイサーが腹ばいになっていた。', '紙飛行機が一機、ペダルの籠に落ちた。',
      ['ペダル', '……「三つ先の角、回収班が二人」。おい、口で言えよ!'], ['キルチョイサー', '……声を出すと、位置がばれる'],
      ['ペダル', 'だからって紙飛行機かよ。しかも折り方が下手だ。先が曲がってる'], 'キルチョイサーは、屋根の上で、少しだけむっとした顔をした。'],
    c: [['「よく飛んでたじゃないか」', 2, 1, [['キルチョイサー', '……風を読んだ。四メートル、北から'], ['ペダル', '狙撃の技術を紙に使うな。……まあ、籠には入ったけどよ'], 'ペダルは次の配達に出る前に、紙飛行機を伸ばして、ポケットにしまった。']],
      ['「ペダル、折り方を教えてやれ」', 1, 2, ['ペダルは舌打ちして、伝票の裏で一機折った。先の尖った、よく飛ぶ形だった。', ['ペダル', '配達のガキは、みんなこれで連絡すんだよ。覚えとけ'], 'その日の夕方、ノゲの屋根から路地へ、紙飛行機が何機も降ってきた。全部、先が尖っていた。']]] }),
  pairEv('aurhong', 'aur', 'hong', { loc: 'noge', cond: S => S.wanted >= 7, label: '甲冑の往診', sub: '紅楼の診察台に、甲冑が座っている',
    memo: ['紅楼で、甲冑の上から診察を受けた', '甲冑を脱がない患者を、甲冑の上から診た'],
    t: ['紅楼の診察台に、オロールが座っていた。甲冑のまま。紅姐は、聴診器を胸甲に当てている。',
      ['紅姐', '……鉄の音しかしないわね'], ['オロール', '騎士の心音は、鎧越しに聴くものだ'],
      ['紅姐', '医者になって四十年、そんな医学は聞いたことがないわ。脱ぎなさい'], ['オロール', '断る'],
      '紅姐は煙管を置いて、長いこと甲冑を眺めた。それから、関節の継ぎ目に油を差しはじめた。',
      ['紅姐', '中身を診られないなら、外を診るしかないでしょう。右肘、かばってるわね。半年は前から']],
    c: [['「さすがだな、紅姐」', 1, 2, [['紅姐', '脱がない患者は、あんたが初めてじゃないのよ。心を脱がない患者の方が、ずっと多いんだから'], ['オロール', '……かたじけない。肘は、たしかに半年前だ']]],
      ['「オロール、診てもらえてよかったな」', 2, 1, [['オロール', 'うむ。良い医師だ。鎧に礼を尽くす者は、中身にも礼を尽くす'], ['紅姐', '褒められてるのか、断られてるのか、分からないわね'], '紅姐は、笑いながら最後の継ぎ目に油を差した。']]] }),
  pairEv('wangan', 'wan', 'gantetsu', { loc: 'kw', cond: S => S.wanted >= 9, label: '鉄鍋を打つ', sub: '高炉の前で、中華鍋が赤くなっている',
    memo: ['ガンテツに、鉄鍋を打ち直してもらった', 'ワンの鉄鍋を、高炉で打ち直した'],
    t: ['第一高炉の前で、ガンテツがワンの鉄鍋を火にかざしていた。', ['ガンテツ', '底が薄くなってる。あと百回も振ったら、穴が開くぞ'],
      ['ワン', '……料理長にもらった鍋だ。用心棒が鍋なんぞ振るなと言ったら、黙ってこれをよこした'],
      ['ガンテツ', 'いい鍋だ。打った奴の癖が残ってる。右利きで、短気で、仕上げだけは丁寧な職人だ'], ['ガンテツ', '打ち直せば、もう五十年もつ。だが、元の職人の癖は消える。俺の癖になる']],
    c: [['「打ち直してもらえ。鍋は、振るためにある」', 2, 1, ['ワンは長く黙ってから、頷いた。', 'ガンテツの槌が、三時間鳴り続けた。打ち上がった鍋は、前より少し重かった。', ['ワン', '……重い。だが、悪くねえ。二人ぶんの重さだ']]],
      ['「このまま使え。穴が開くまで」', 1, 2, [['ガンテツ', 'それも道具の全うし方だ。穴が開いたら持ってこい。その時は、鍋じゃなく、包丁に打ち直してやる'], 'ワンは鍋を受け取り、底を一度だけ撫でた。']]] }),
  pairEv('xiaotenin', 'xiao', 'tenin', { loc: 'kg', cond: S => S.wanted >= 10, label: '接客の違い', sub: 'フードコートで、二人が向かい合ってお辞儀をしている',
    memo: ['テンインと、お辞儀の角度を比べた', '小籠さんに、お冷やの出し方を習った'],
    t: ['メガモールのフードコートで、小籠とテンインが、互いにお辞儀を繰り返していた。どちらも、相手より先に頭を上げられない。',
      ['小籠', 'いらっしゃいませ。朗々飯店の作法では、お辞儀は三十度でございます'], ['テンイン', 'いらっしゃいませ。当館のマニュアルでは四十五度です。あと、語尾を上げます。いらっしゃいませー↑'],
      ['小籠', '……上げるのですか'], ['テンイン', '上げます。上げないと、本部から指導が入ります。本部は、もう無いんですけど']],
    c: [['「三十度の方が、落ち着く」', 2, 1, [['テンイン', 'なるほど……。静かな接客、というやつですね。メモします。メモ帳が無いので、レシートの裏に'], ['小籠', '光栄でございます。ですが、あなたの「ませー↑」も、わたくしは好きです。お客様が、少し笑われますから']]],
      ['「四十五度も、悪くない」', 1, 2, [['小籠', 'では、わたくしも……いらっしゃいませー↑'], '小籠の語尾が、初めて上がった。本人がいちばん驚いていた。', ['テンイン', '完璧です! 本部から表彰されます! 本部は無いので、わたしが表彰します!']]]] }),
  pairEv('zerochef', 'zero', 'chef', { loc: 'chinatown', cond: S => S.wanted >= 11, label: '食べられない者と、作れない者', sub: '厨房跡で、ホログラムのおにぎりが光っている',
    memo: ['料理長に、ホログラムのおにぎりを見せた', 'ゼロカロリーの、ホログラムの握りを直した'],
    t: ['厨房跡の火口の前で、ゼロカロリーがホログラムのおにぎりを浮かべていた。料理長・朗が、それを半透明の目で睨んでいる。',
      ['料理長・朗', '握りが甘い。米が立っておらん'], ['ゼロカロリー', 'ホログラムだよ。米は、最初から無いんだ'],
      ['料理長・朗', '無くても立たせろ。食えんものほど、旨そうに見えねばならん。わしも今は、食えんものしか作れん身だ'],
      'ゼロカロリーは、少し考えてから、ホログラムの輪郭を指で直した。光の米粒が、一粒ずつ立ち上がった。'],
    c: [['「旨そうだ」', 2, 1, [['ゼロカロリー', '……ほんと? 食べられないのに?'], ['料理長・朗', '食えるかどうかは、皿の半分だ。残りの半分は、食いたいと思わせることだ。お前は、もう半分できておる']]],
      ['「料理長、あんたの握りも見せてくれ」', 1, 2, ['料理長は、半透明の手で、何もない空気を握った。三度、返した。', '何も見えなかった。それでも、そこに一個、置かれた気がした。', ['ゼロカロリー', '……負けた。それ、わたしのより旨そうだ']]]] }),
  pairEv('linhijiki', 'lin', 'hijiki', { loc: 'honmoku', cond: S => S.wanted >= 11, label: '密輸の帳尻', sub: '甲板の上で、そろばんと干物が向かい合っている',
    memo: ['ヒジキの密輸船の帳簿を、十年ぶん締めた', 'リンに、十年ぶんの帳簿を締めてもらった'],
    t: ['密輸船の甲板で、リンが帳簿をめくっていた。十年ぶん。ヒジキは、干物を噛みながら空を見ている。',
      ['リン', '燃料代、未記入。乗組員の給料、「気持ち」。積み荷の原価、「海がくれた」。……これで、よく十年沈まなかったわね'],
      ['キャプテン・ヒジキ', 'がはは! 海賊は帳簿をつけん! つけたら海賊ではなく、運送業だ!'],
      ['リン', '運送業の方が儲かるのよ。あなたの船、月まで行けるんでしょう。それを干物の密輸に使ってるの、世界であなただけよ']],
    c: [['「干物の密輸でいいじゃないか」', 1, 2, [['キャプテン・ヒジキ', '分かっとるな! 儲からんから、誰にも追われんのだ!'], ['リン', '……それは、たしかに一理あるわね。儲かる商売は、全部誰かに潰されたもの'], 'リンは帳簿を閉じた。表紙に「気持ち」と、一行だけ書き足した。']],
      ['「リンの言う通りにしてみろ」', 2, 1, [['リン', '月の作業員は、干物を地球の三十倍の値段で買うわ。調べたの'], ['キャプテン・ヒジキ', '……三十倍。……がはは! それは密輸ではなく、人助けだな!'], 'ヒジキは、その場でリンを航海士に任命した。リンは、丁重に断った。']]] }),
  pairEv('mutsuyumori', 'mutsuko', 'yumori', { loc: 'hk', cond: S => S.wanted >= 11, label: '湯けむりと星', sub: '露天風呂の縁で、老婆とロボットが空を見ている',
    memo: ['湯守と、湯けむりの切れ間に星を数えた', 'ムツコと、露天風呂から星を見た'],
    t: ['露天風呂の縁に、ムツコが足だけ浸けて座っていた。隣に、湯守が立っている。', ['ムツコ', '湯けむりで、星が見えないわね'],
      ['湯守', '……ユケムリ……トメル?'], ['ムツコ', 'いいの。止めないで。見えないのを、見てるのよ'],
      '湯守は、しばらく考えていた。それから、源泉の弁を、ほんの少しだけ絞った。湯けむりに、小さな切れ間ができた。', '星が、三つだけ見えた。'],
    c: [['「三つで十分だな」', 1, 2, [['ムツコ', '十分よ。宇宙にいた頃は、多すぎて、どれも見てなかったもの'], ['湯守', '……ミッツ。……オボエタ']]],
      ['「湯守、気が利くじゃないか」', 2, 1, [['湯守', '……マモル。ユモ、ホシモ'], ['ムツコ', 'あら。じゃあ、わたしも守ってもらおうかしら。湯冷めから']]]] }),
  pairEv('satouglove', 'satou', 'whiteglove', { loc: 'yamate', cond: S => S.wanted >= 11, label: '紅茶の淹れ方', sub: '洋館の庭で、湯気の立つカップが二つ並んでいる',
    memo: ['ホワイトグローブさんに、紅茶の香りを教わった', 'サトウ様に、紅茶を二杯お出しした'],
    t: ['洋館の庭のテーブルに、カップが二つ並んでいた。ホワイトグローブが、サトウの前に立っている。',
      ['ホワイトグローブ', '右が、本物の茶葉。左が、端子に「紅茶」と書き込むだけの湯でございます。どちらがお好みか、伺っても?'],
      ['サトウ', '……すみません。どっちも、ただの熱い水です。僕には'],
      ['ホワイトグローブ', '存じております。ですので、味ではなく、お好みを伺いました'], 'サトウは、二つのカップを、長いこと見比べた。'],
    c: [['「香りはどうだ、サトウ」', 1, 2, ['サトウは右のカップに顔を近づけて、目を閉じた。', ['サトウ', '……こっちは、何か、あります。味じゃないけど。雨上がりの、何かみたいな'], ['ホワイトグローブ', 'それを、香りと申します。お代わりは、いくらでも']]],
      ['「ホワイトグローブ、いい質問だな」', 2, 1, [['ホワイトグローブ', '執事は、分からぬことを決して尋ねません。お答えになれることだけを、尋ねるものです'], ['サトウ', '……じゃあ、右で。湯気が、きれいなので'], 'ホワイトグローブは、右のカップに、もう一杯注いだ。']]] }),
  pairEv('somdog', 'som', 'shumai', { loc: 'pier', label: '毒味役', sub: 'ねぐらの前で、ソムリエが皿を二枚並べている',
    memo: ['シューマイに、毒味を先に越された', 'ソムリエの皿を、先に平らげた'],
    t: ['ねぐらの前で、ソムリエが缶詰を二枚の皿に分けていた。片方の皿の前に、シューマイが座っている。',
      ['サイレント・ソムリエ', '待て。毒味が先だ。私が——'], '言い終わる前に、シューマイは皿を空にしていた。',
      ['サイレント・ソムリエ', '……三秒。私の最短記録より、二秒速い'], 'シューマイは、ソムリエの方の皿を見ている。'],
    c: [['「毒味役を、交代したらどうだ」', 1, 2, [['サイレント・ソムリエ', '……検討する。鼻は、私より利く'], 'シューマイは、検討の結果を待たずに、二枚目の皿も空にした。']],
      ['「ソムリエ、自分の分は守れ」', 2, 1, ['ソムリエは、自分の皿を持ち上げた。シューマイが、座ったまま見上げる。', '十秒後、ソムリエは皿を下ろした。', ['サイレント・ソムリエ', '……この目には、勝てない。暗殺者時代にも、いなかった']]]] }),
  pairEv('tsunana', 'tsukimi', 'nanashi', { loc: 'ntport', cond: S => S.wanted >= 11, label: '機体登録', sub: 'ロビーのベンチで、ツキミがドローンに書類を見せている',
    memo: ['ナナシの機体登録票を、手書きで作った', 'ツキミに、名前の欄を埋めてもらった'],
    t: ['出発ロビーのベンチで、ツキミがナナシに書類を見せていた。', ['ツキミ', '機体登録票です。あなたには、製造番号も、所有者も、登録名もありません。規定上、あなたは「存在しない」ことになります'],
      'ナナシのセンサーが、不安そうに黄色く瞬いた。', ['ツキミ', '……ですので、作りました。様式は、わたしの手製です。法的効力は、一切ありません'],
      '登録名の欄には「ナナシ」。所有者の欄は、空いている。'],
    c: [['所有者の欄に「なし」と書く', 1, 2, [['ツキミ', '……所有者、なし。妥当です。誰のものでもない、という記載は、品質保証上も最上位にあたります'], 'ナナシのセンサーが、青く、長く光った。書類は、機体の腹に貼られた。']],
      ['「ツキミ、いい仕事だ」', 2, 1, [['ツキミ', '業務ではありません。業務外で書類を作ったのは、生まれて初めてです'], ['ツキミ', '……悪くない気分です。報告書には書きませんが'], '所有者の欄は、空けたままにした。ナナシは、それで構わないようだった。']]] }),
);

/* ---------- 仲間の頼みごと ---------- */
const reqEv = (key, id, o) => ({ ['req_' + key]: { rom: true, loc: o.loc, scene: o.scene, label: o.label, sub: o.sub, cond: S => member(S, id) && !S.left[id] && (S.rel[id] || 0) >= (o.rel || 4) && (!o.cond || o.cond(S)), nodes: o.nodes } });
const reqDone = (id, txt, n) => S => { rel(S, id, n || 2); memo(S, id, txt); };
const REQEV = Object.assign({},
  reqEv('kill', 'kill', { loc: 'noge', label: 'キルチョイサーの頼み', sub: '質屋の前で、ショーウィンドウを見つめている', nodes: {
    start: { t: ['質屋のショーウィンドウに、古い照準器が飾ってあった。キルチョイサーは、ガラスに額がつくほど近づいて見ている。',
      ['キルチョイサー', '……あれ、わたしの。最初の仕事の前に、お金がなくて、預けた'], ['キルチョイサー', '流れちゃった。値札、見て'], '値札は「1200cr」。その下に小さく「売約済」とある。',
      ['キルチョイサー', '……買ったの、たぶん、ろくな人じゃない。あの照準器、人を撃つのにしか使えないから']],
      c: [{ t: '「取り返そう」', to: 'go' }, { t: '「新しいのを買えばいい」', to: 'no' }] },
    no: { t: [['キルチョイサー', '……うん。そうだね'], 'キルチョイサーは、もう少しだけ、ガラスの前に立っていた。'], end: true, noDone: true },
    go: { t: ['質屋の裏口から、用心棒が箱を抱えて出てきた。買い手への引き渡しは、今夜らしい。'], battle: { enc: 'killScope', win: 'w', lose: 'l' } },
    l: { t: ['箱は、車に積まれて行ってしまった。', ['キルチョイサー', '……追える。ナンバー、覚えた。また今度']], end: true, noDone: true },
    w: { fx: reqDone('kill', '質屋に流れた最初の照準器を、一緒に取り返した'), t: ['箱の中の照準器は、レンズに小さな傷があった。キルチョイサーは、その傷を親指でなぞった。',
      ['キルチョイサー', '……この傷、最初に外したときの。落としたの。手が震えて'], ['キルチョイサー', '撃つのには、もう使わない。……見るのに使う。遠くのものを、ただ見るの'],
      'その夜、キルチョイサーは屋根の上で、照準器を覗いていた。銃には、付けていなかった。', 'キルチョイサーとの仲が深まった。'], end: true } } }),
  reqEv('aur', 'aur', { loc: 'yamate', label: 'オロールの頼み', sub: '高台の礼拝堂の前で、槍を立てて待っている', nodes: {
    start: { t: ['高台の、屋根の落ちた礼拝堂の前で、オロールが待っていた。', ['オロール', 'そなたに頼みがある。叙任式の、立会人になってほしい'],
      ['オロール', '我は騎士を名乗っているが、誰からも叙任を受けておらぬ。主君も、王も、この時代にはおらぬゆえ'], ['オロール', '作法は一つ。剣の平で、肩を三度打つ。それだけだ。打つ者は、誰でもよい。……いや。誰でもよくは、ない']],
      c: [{ t: 'ヒートブレードの平で、肩を打つ', to: 'a' }, { t: '「おれでいいのか」と聞く', to: 'b' }] },
    a: { fx: reqDone('aur', '屋根の落ちた礼拝堂で、叙任式の立会人になった'), t: ['熱を落としたヒートブレードの平で、甲冑の肩を、右、左、右と打った。鉄の音が、屋根のない礼拝堂に三度響いた。',
      ['オロール', '……これにて、我は騎士である。ずいぶん遅れたが'], 'オロールは立ち上がり、槍を掲げた。甲冑の奥の表情は、見えなかった。見えなくても、分かった。', 'オロールとの仲が深まった。'], end: true },
    b: { fx: reqDone('aur', '屋根の落ちた礼拝堂で、叙任式の立会人になった'), t: [['オロール', 'そなたでなくては、ならぬ。我が槍を預けた相手に打たれてこそ、叙任だ'], '熱を落としたヒートブレードの平で、甲冑の肩を三度打った。',
      ['オロール', '……これにて、我は騎士である。そなたの、騎士である'], 'オロールとの仲が深まった。'], end: true } } }),
  reqEv('pedal', 'pedal', { loc: 'noge', label: 'ペダルの頼み', sub: '自転車の籠に、古い小包が一つ入ったままだ', nodes: {
    start: { t: ['ペダルの自転車の籠の底に、角の潰れた小包が一つ、ずっと入っている。', ['ペダル', '……届け損ねたやつだ。二年前。届け先のアパートが、行ったら取り壊されてた'],
      ['ペダル', '配達屋が荷物を持ったままなんて、恥なんだよ。でも、捨てらんねえ。宛名、子供の字なんだ'], '宛名は、クレヨンで書いてあった。「カシワタウン えきまえ おばあちゃんへ」。',
      ['ペダル', '……住所になってねえだろ、これ。だから二年前は、ノゲの似た名前のアパートに行っちまった']],
      c: [{ t: '「カシワの駅前を、一軒ずつ当たろう」', to: 'go' }] },
    go: { fx: reqDone('pedal', '二年遅れの小包を、カシワタウンまで一緒に届けた'), t: ['カシワタウンの駅前ロータリーで、ペダルは小包を掲げて、一軒ずつ戸を叩いた。十一軒目で、老婆が出てきた。',
      ['老婆', 'まあ。……孫の字だわ。二年前の、誕生日のね'], '小包の中身は、紙粘土の湯呑みだった。少し欠けていた。',
      ['ペダル', '……遅れました。配達料は、いらねえ。延着だから'], ['老婆', 'いいえ。ちょうどよかったのよ。今日が、わたしの誕生日だもの'],
      '帰り道、ペダルは一度もペダルを漕がなかった。自転車を押して、ゆっくり歩いた。', 'ペダルとの仲が深まった。'], end: true } } }),
  reqEv('hong', 'hong', { loc: 'chinatown', label: '紅姐の頼み', sub: '往診鞄を持って、門の前で待っている', nodes: {
    start: { t: ['善隣門の前で、紅姐が往診鞄を提げて待っていた。', ['紅姐', '付き添いを頼める? 朗々幇の縄張りの奥に、診てやりたい患者がいるの。一人で行くと、通行料を取られるのよ'],
      '路地の奥の長屋に、寝たきりの老人がいた。元は、朗々飯店の皿洗いだったという。', ['紅姐', '舌の端子が、焼きついてる。昔の粗悪品よ。外してやりたいけど、外したら、この人は最後に食べた味を忘れる'],
      ['紅姐', '最後に食べたのは、朗々飯店のまかないだって。本人が言うの。……あたしには、決められない']],
      c: [{ t: '「外そう。楽にしてやるべきだ」', to: 'a' }, { t: '「本人に聞こう」', to: 'b' }] },
    a: { fx: reqDone('hong', '朗々飯店の元皿洗いの往診に、付き添った'), t: ['紅姐は頷いて、鞄を開けた。手術は十分で終わった。', '老人は目を開けて、長い息を吐いた。', ['元皿洗いの老人', '……楽になった。味は、消えたな。だが、旨かったということは、覚えとる。それで足りる'],
      ['紅姐', '……そう。足りるのね'], '帰り道、紅姐は煙管に火をつけなかった。', '紅姐との仲が深まった。'], end: true },
    b: { fx: reqDone('hong', '朗々飯店の元皿洗いの往診に、付き添った'), t: ['老人は、質問を最後まで聞いて、笑った。', ['元皿洗いの老人', '外さんでくれ。痛いのは慣れた。あのまかないの味と一緒に、焼けて死ぬなら本望だ'],
      ['紅姐', '……医者としては、勧めないわよ'], ['元皿洗いの老人', '医者としてでなく、聞いてくれたんだろう。だから答えた'], '紅姐は、痛み止めだけを置いて帰った。帰り道、一度だけ鼻をすすった。', '紅姐との仲が深まった。'], end: true } } }),
  reqEv('wan', 'wan', { loc: 'chinatown', label: 'ワンの頼み', sub: '市場の入口で、買い物籠を持って立っている', nodes: {
    start: { t: ['旧中華街の朝市の入口で、ワンが買い物籠を持って立っていた。似合っていなかった。', ['ワン', '……仕込みの買い出しだ。付き合え。俺が一人で行くと、店が全部、シャッターを下ろす'],
      '元・朗々幇の用心棒の顔は、市場ではまだ効きすぎるらしい。', ['ワン', '本物の葱が要る。合成じゃねえやつ。朝市の、いちばん奥の婆さんしか扱ってねえ']], check: { stat: 'talk', lo: 6, hi: 9, fail: 'f', ok: 'o', great: 'g' } },
    f: { fx: reqDone('wan', '朝市で、本物の葱を一緒に探した', 1), t: ['婆さんは、ワンの顔を見るなり、葱を背中に隠した。交渉は、こちらがやっても決裂した。', '合成の葱を買って帰った。ワンは、それでも炒飯を作った。', ['ワン', '……悪くはねえ。良くもねえ。次は、俺が自分で頭を下げる'], 'ワンとの仲が少し深まった。'], end: true },
    o: { fx: reqDone('wan', '朝市で、本物の葱を一緒に買った'), t: ['「この男は、もう殴らない。鍋を振るだけだ」と、婆さんに説明した。婆さんは、ワンの手を見た。火傷の痕だらけの手を。', ['葱売りの婆さん', '……鍋を振る手だね。持っていきな'],
      'その晩の炒飯には、本物の葱が入っていた。', ['ワン', '……食え。感想は要らねえ。顔で分かる'], 'ワンとの仲が深まった。'], end: true },
    g: { fx: S => { reqDone('wan', '朝市で、本物の葱を一緒に買った', 3)(S); S.items.gel += 2; }, t: ['「この男は、もう殴らない。鍋を振るだけだ」と、婆さんに説明した。婆さんは、ワンの手を見た。', ['葱売りの婆さん', '知ってるよ。あの晩、うちの孫を火の中から担ぎ出したのは、この男だ。礼を言いそびれてた'],
      '婆さんは、葱を籠いっぱいに詰めた。代金は、受け取らなかった。', 'ワンは、市場を出るまで、一言も喋らなかった。耳だけが赤かった。', '余った葱(修復ジェル2本ぶんの効き目)を手に入れた。ワンとの仲が大きく深まった。'], end: true } } }),
  reqEv('xiao', 'xiao', { loc: 'chinatown', scene: 'kitchen', label: '小籠の頼み', sub: '厨房跡で、古い注文票の束を数えている', nodes: {
    start: { t: ['厨房跡で、小籠が注文票の束を数えていた。焼け残った、最後の晩のぶんだ。', ['小籠', '一枚だけ、お出しできなかった注文がございます。七番卓。炒飯一つ。お客様は、火事の前に帰られました'],
      ['小籠', 'わたくしの記録では、この注文は、今も「調理中」のままです。給仕は、注文を取り消す権限を持ちません'], ['小籠', 'どなたかに、取り消していただくか……あるいは、お出しするか。お願いできますでしょうか']],
      c: [{ t: '「取り消す。もういいんだ」', to: 'a' }, { t: '「おれが七番卓に座る。出してくれ」', to: 'b' }] },
    a: { fx: reqDone('xiao', '最後の晩の、七番卓の注文を取り消した'), t: ['注文票に、線を一本引いた。', ['小籠', '……承りました。七番卓、炒飯一つ、お取り消しでございます'], '小籠は、注文票を胸のポケットにしまった。捨てはしなかった。', ['小籠', 'ずっと続いていた「調理中」が、終わりました。肩が、軽うございます。肩は、無いのですが'], '小籠との仲が深まった。'], end: true },
    b: { fx: reqDone('xiao', '最後の晩の、七番卓の炒飯を、代わりに受け取った', 3), t: ['焼け残った七番卓の椅子に座った。小籠は、空の皿を、両手で運んできた。', ['小籠', 'お待たせいたしました。炒飯でございます。たいへん長らく、お待たせいたしました'],
      '皿は空だった。レンゲで、空気を一口すくった。', '舌の端子の奥で、ポケットのプロトコルチャーハンが、ほんの一瞬だけ、温かくなった。', ['小籠', '……お味は、いかがでしょうか'], '「旨い」と答えた。嘘ではなかった。', '小籠との仲が大きく深まった。'], end: true } } }),
  reqEv('som', 'som', { loc: 'gate7', scene: 'gw', label: 'ソムリエの頼み', sub: '暖簾の前で、入ろうとして、やめている', cond: S => S.flags.gw, nodes: {
    start: { t: ['麺処グラヴィティ・ウェルの暖簾の前で、ソムリエが立ち止まっていた。三度、手を伸ばして、三度とも引っ込めた。',
      ['サイレント・ソムリエ', '毒味役は、自分のために食べたことがない。最後に、自分で選んで食べたのは、十一歳のときだ'], ['サイレント・ソムリエ', '頼む。隣に座ってくれ。一人では、注文の仕方が分からない']],
      c: [{ t: '暖簾をくぐる', to: 'a' }] },
    a: { fx: reqDone('som', 'グラヴィティ・ウェルで、初めて自分のために注文するのを、隣で見ていた', 3), t: ['カウンターに並んで座った。寸胴型のロボットが、黙って待っている。', ['サイレント・ソムリエ', '……油そば。一つ。……私の、ぶんを'],
      '出てきた丼を、ソムリエは一分ほど見つめていた。毒を探しているのではなかった。', ['サイレント・ソムリエ', '……混ぜるのか'], '「混ぜる」と教えた。',
      'ソムリエは、ぎこちなく混ぜて、一口食べた。それから、何も言わずに、最後まで食べた。丼を置いたとき、手が少し震えていた。', ['サイレント・ソムリエ', '……毒は、無かった。それ以外のことは、まだ、言葉にできない'], 'ソムリエとの仲が大きく深まった。'], end: true } } }),
  reqEv('gantetsu', 'gantetsu', { loc: 'kw', label: 'ガンテツの頼み', sub: '止まった高炉の前に、花が二束置いてある', nodes: {
    start: { t: ['第一高炉の前に、花が二束あった。ガンテツは、その前で煙草を二本、火をつけて立てた。', ['ガンテツ', '命日だ。二人とも、同じ日でな。炉の事故だ。俺だけが、その日たまたま非番だった'],
      ['ガンテツ', '頼みがある。炉に、一回だけ火を入れたい。あいつらに見せる鉄を、一本打つ。ふいごを踏んでくれ。年寄りの脚じゃ、温度が上がらねえ']], check: { stat: 'pow', lo: 7, hi: 10, fail: 'f', ok: 'o', great: 'g' } },
    f: { fx: reqDone('gantetsu', '命日に、高炉のふいごを一緒に踏んだ', 1), t: ['ふいごは重かった。温度は、あと少しのところで届かなかった。', ['ガンテツ', '……いい。赤くはなった。あいつらは、赤い鉄が好きだった'], 'ガンテツとの仲が少し深まった。'], end: true },
    o: { fx: reqDone('gantetsu', '命日に、高炉のふいごを一緒に踏んだ'), t: ['一時間、ふいごを踏んだ。炉の口が、白く光った。', 'ガンテツは、鉄を一本だけ打った。何の形にもしなかった。ただの、まっすぐな棒だ。', ['ガンテツ', '三人で最初に打ったのが、これだった。売り物にならねえ、ただの棒だ。……いい出来だ'], 'ガンテツとの仲が深まった。'], end: true },
    g: { fx: S => { reqDone('gantetsu', '命日に、高炉のふいごを一緒に踏んだ', 3)(S); S.parts += 4; }, t: ['一時間、ふいごを踏み続けた。炉の口が白く光り、工場じゅうの窓が赤く染まった。', 'ガンテツは、鉄を一本だけ打った。ただの、まっすぐな棒だ。',
      ['ガンテツ', '……炉が、鳴いてる。聞こえるか。あいつらが笑ってるときの音だ'], '打ち損じの端材を、部品として4個もらった。ガンテツとの仲が大きく深まった。'], end: true } } }),
);

/* ---------- ねぐらの夜(同行している仲間どうしの、短い会話) ---------- */
const BANTER = [
  ['kill', 'aur', [['オロール', 'そなたの銃は、音がせぬな。騎士の槍とは、正反対だ'], ['キルチョイサー', '……槍は、名乗ってから刺すんでしょ。不便']]],
  ['kill', 'hong', [['紅姐', 'あんた、ちゃんと寝てる? 目の下、ひどいわよ'], ['キルチョイサー', '……片目ずつ、寝てる']]],
  ['kill', 'wan', [['ワン', '食え。細すぎる'], ['キルチョイサー', '……三杯目。もう入らない'], ['ワン', '入る。四杯目だ']]],
  ['aur', 'pedal', [['ペダル', 'なあ、その鎧、何キロあんだよ'], ['オロール', '騎士は、鎧の重さを数えぬ'], ['ペダル', '数えろよ。配達料に関わるだろ']]],
  ['aur', 'xiao', [['小籠', 'オロール様。お飲み物は、どちらからお召し上がりに'], ['オロール', '……気遣い無用。飲まぬ'], ['小籠', '承知いたしました。では、置くだけ置かせていただきます']]],
  ['som', 'wan', [['ワン', '毒味なら、俺の鍋でやるな。入ってねえ'], ['サイレント・ソムリエ', '知っている。だから、ただ食べている']]],
  ['som', 'zero', [['ゼロカロリー', '毒味って、お腹はふくれるの?'], ['サイレント・ソムリエ', 'ふくれない。一口だけだ'], ['ゼロカロリー', 'じゃあ、わたしたち、似てるね']]],
  ['hong', 'pedal', [['紅姐', 'その膝、一度診せなさい。漕ぎ方が左右で違うわ'], ['ペダル', 'うるせえ。……いくらだよ'], ['紅姐', '出世払いでいいわ']]],
  ['hong', 'lin', [['リン', '紅姐、あなたの診療所、帳簿つけてる?'], ['紅姐', 'つけてるわよ。頭の中に'], ['リン', 'それを帳簿とは言わないのよ']]],
  ['pedal', 'wan', [['ペダル', '出前、やんねえの? オレが運ぶぜ'], ['ワン', '……店がねえ'], ['ペダル', '鍋がありゃ店だろ']]],
  ['wan', 'xiao', [['小籠', 'ワンさん。賄いの時間でございます'], ['ワン', '……毎日、同じ時間に言うな、お前は'], ['小籠', '毎日、同じ時間にお腹が鳴るお方がおられますので']]],
  ['wan', 'chef', [['料理長・朗', '火が強い。葱が泣いておる'], ['ワン', '……はい'], ['料理長・朗', '返事はいい。鍋を見ろ']]],
  ['zero', 'satou', [['サトウ', 'ゼロさんは、食べられないのに、どうして味の話が好きなんですか'], ['ゼロカロリー', '君は、分からないのに、どうして食べるのが好きなの'], ['サトウ', '……あ。同じですね']]],
  ['zero', 'tenin', [['テンイン', '試食コーナーなら、無料ですよ'], ['ゼロカロリー', '知ってる。あれで三年、生きてた']]],
  ['gantetsu', 'glassjaw', [['ガンテツ', '顎を、鉄で打ち直してやろうか'], ['グラスジョー', 'やめろよ爺さん。ガラスの顎じゃなくなったら、ただの強え奴になっちまう']]],
  ['gantetsu', 'pedal', [['ガンテツ', 'その自転車、フレームが泣いてるぞ'], ['ペダル', '触んな。……どこが泣いてんだよ'], ['ガンテツ', '全部だ']]],
  ['lin', 'tsukimi', [['リン', '元・品質保証部長さん。この街でいちばん品質が悪いもの、何だと思う?'], ['ツキミ', '……弊社の、いえ、元弊社の、企業倫理です'], ['リン', 'あら。話が合うじゃない']]],
  ['tsukimi', 'satou', [['サトウ', '部長……いえ、ツキミさん。僕の退職届、受理されましたか'], ['ツキミ', '受理しました。わたしの退職届と、同じ封筒で送りました']]],
  ['glassjaw', 'hijiki', [['キャプテン・ヒジキ', '海の上で殴り合ったことはあるか!'], ['グラスジョー', 'ねえよ。足場が悪いだろ'], ['キャプテン・ヒジキ', 'それがいいんだ! 全員、顎が弱くなる!']]],
  ['hijiki', 'mutsuko', [['ムツコ', '船長さん。月では、干物は膨らむのよ。真空だから'], ['キャプテン・ヒジキ', '……がはは! 膨らんだ干物! 高く売れるな!']]],
  ['whiteglove', 'xiao', [['ホワイトグローブ', '小籠さん。ナプキンの折り方ですが'], ['小籠', '朗々飯店では、鶴でございます'], ['ホワイトグローブ', '洋館では、白鳥です。……引き分けといたしましょう']]],
  ['whiteglove', 'pedal', [['ホワイトグローブ', 'お坊ちゃま、靴紐が'], ['ペダル', '誰がお坊ちゃまだ! ……結べよ、じゃあ']]],
  ['yumori', 'nanashi', ['湯守の肩に、ナナシが止まっている。どちらも、何も言わない。湯気と、青い光だけが、ゆっくり動いている。']],
  ['yumori', 'gantetsu', [['ガンテツ', 'おい、膝の調子はどうだ'], ['湯守', '……キシマナイ'], ['ガンテツ', 'そうか。そりゃ、何よりだ']]],
  ['mutsuko', 'tenin', [['テンイン', 'ムツコさん、空って、何階まであるんですか'], ['ムツコ', 'そうねえ。わたしが行ったのは、三十八万キロ階までよ'], ['テンイン', 'エレベーター、ありますか']]],
  ['mutsuko', 'kill', [['ムツコ', 'あなた、いい目をしてるわね。天文台に来ない? 星は、撃たなくていいのよ'], ['キルチョイサー', '……見るだけ?'], ['ムツコ', '見るだけ。それが、いちばん難しいの']]],
  ['tenin', 'lin', [['テンイン', 'リンさん、ポイントカードはお持ちですか'], ['リン', '持ってないわ'], ['テンイン', 'お作りしますか。今なら、入会特典で何もつきません']]],
  ['nanashi', 'pedal', ['ナナシが、ペダルの頭上をぐるぐる回っている。', ['ペダル', '……レースの続きなら、明日だ。今日は脚が終わってる']]],
  ['shumai', 'wan', ['シューマイが、ワンの鍋の前から動かない。', ['ワン', '……盗むなよ。盗むくらいなら、待て。一個やる']]],
  ['shumai', 'xiao', [['小籠', 'シューマイ。お手'], 'シューマイは、お手をしなかった。代わりに、小籠の膝に顎を乗せた。', ['小籠', '……あの頃と、同じでございますね']]],
  ['shumai', 'aur', ['シューマイが、オロールの甲冑のにおいを、端から端まで嗅いでいる。', ['オロール', '……気が済んだか'], 'シューマイは、くしゃみを一つして、甲冑の足元で丸くなった。']],
  ['shumai', 'hong', [['紅姐', 'この子、耳のちぎれた跡、縫ってやろうかしら'], 'シューマイは、ちぎれた方の耳だけを伏せた。', ['紅姐', '……そう。勲章なのね。分かったわ']]],
  ['chef', 'xiao', [['料理長・朗', '小籠。七番卓の客は、帰ったか'], ['小籠', 'はい、料理長。皆さま、お帰りになりました'], ['料理長・朗', 'そうか。なら、火を落とせ']]],
  ['chef', 'som', [['料理長・朗', 'お前の舌は、毒だけを覚えさせられた舌だ。もったいない'], ['サイレント・ソムリエ', '……今から、覚え直せるか'], ['料理長・朗', '舌は、死ぬまで見習いだ']]],
];
const SOLOBANTER = {
  kill: ['キルチョイサーは、屋根の上で銃を分解していた。組み立てる音が、子守歌のように規則正しい。'], aur: ['オロールは、槍を抱いて、立ったまま眠っている。たぶん、眠っている。'], som: ['ソムリエは、湯を沸かして、一口だけ飲んだ。毒は入っていなかったらしい。'],
  hong: ['紅姐の煙管の火が、暗がりで一つ、ゆっくり明滅している。'], pedal: ['ペダルは、自転車のチェーンに油を差している。差し終わっても、まだ磨いている。'], wan: ['ワンが、空の鍋を振っている。手首の返しだけを、何百回も確かめるように。'],
  xiao: ['小籠は、誰も使っていない食器を、もう一度拭いている。'], zero: ['ゼロカロリーのホログラムのおにぎりが、暗がりで行灯のように光っている。'], gantetsu: ['ガンテツの鼾は、ふいごの音に似ている。'],
  chef: ['料理長の半透明の輪郭が、火口の青い火のように揺れている。'], lin: ['リンは、存在しない帳簿に、今日の収支をつけている。'], tsukimi: ['ツキミは、今日の出来事を、提出先のない報告書にまとめている。'],
  glassjaw: ['グラスジョーが、寝言で「もう一ラウンド」と言った。'], hijiki: ['ヒジキは、陸の上なのに、体を左右に揺らして眠っている。'], whiteglove: ['ホワイトグローブは、全員の靴を磨き終えてから、自分の手袋を洗っている。'],
  yumori: ['湯守の体から、ほんの少し湯気が立っている。ねぐらが、いつもより温かい。'], mutsuko: ['ムツコは、コンテナの屋根の穴から、空を見ている。雲の向こうの、月のあたりを。'], tenin: ['テンインは、寝る前に小さく「本日の営業は終了いたしました」と言った。'],
  satou: ['サトウは、白湯を一口飲んで、首をかしげている。味を、探している。'], nanashi: ['ナナシのセンサーが、省電力の暗い青で、ゆっくり瞬いている。'], shumai: ['シューマイは、ねぐらの入口で丸くなっている。耳だけが、ときどき動く。'],
};
const CAMPEV = {
  camp: { loc: 'pier', rom: true, repeat: true, label: 'ねぐらの夜', sub: '仲間と一晩過ごす。街が動くまでは1回', cond: S => FREE(S) && S.party.length > 1 && !S.scav['camp' + S.wanted], nodes: {
    start: { fx: S => { S.scav['camp' + S.wanted] = 1; partyRel(S, 1);
        const ps2 = S.party.filter(id => id !== 'hero'); const cand = BANTER.filter(b => ps2.includes(b[0]) && ps2.includes(b[1]));
        const seen = S.banter = S.banter || {}; const fresh = cand.filter(b => !seen[b[0] + b[1]]); const pool = fresh.length ? fresh : cand;
        if (pool.length) { const b = pool[Math.floor(Math.random() * pool.length)]; seen[b[0] + b[1]] = 1; S._camp = b[2]; memo(S, b[0], `ねぐらの夜、${nm(b[1])}と話していた`); memo(S, b[1], `ねぐらの夜、${nm(b[0])}と話していた`); }
        else { const id = ps2[Math.floor(Math.random() * ps2.length)]; S._camp = SOLOBANTER[id] || ['夜は、静かに更けていった。']; } },
      t: [], dyn: S => ['ねぐらのコンテナで、ドラム缶に火を入れた。雨が、屋根を叩いている。'].concat(S._camp || []).concat(['夜は、そのまま更けていった。', '同行している仲間との仲が、少し深まった。']), end: true } } },
};
/* ---------- 四十年ぶりのスーツケース(スペースポート → カシワ) ---------- */
const BAGEV = {
  bagks: { loc: 'ks', label: '天文台に届いた荷物', sub: '坂の上に、古いスーツケースが届いている', cond: S => !!S.flags.bagKs, nodes: {
    start: { fx: S => { if (member(S, 'mutsuko')) { rel(S, 'mutsuko', 2); memo(S, 'mutsuko', '四十年回り続けたスーツケースが、天文台に届いた'); } S.items.gel += 1; }, t: ['天文台の玄関に、あのスーツケースが届いていた。ムツコは、鍵を持っていなかった。四十年前に、月で失くしたという。', '錠は、こちらで開けた。',
      '中身は、石が一つだけだった。灰色の、何の変哲もない石だ。', ['ムツコ', '……月の石よ。建設隊の全員が、一つずつ地球に送ったの。帰れなかったときのために'],
      ['ムツコ', 'わたしは帰ってきたのに、石の方が、四十年かかったのね。空港のベルトの上を、ずっと回って'], 'ムツコは、石を望遠鏡の脇に置いた。', ['ムツコ', 'お礼に、これ。宇宙食の残り。まだ食べられるわ。たぶん'],
      '宇宙食(修復ジェルと同じ効き目がある)を手に入れた。'], end: true } } },
};

/* ---------- メガモールの拡充 ---------- */
// 51階から先のゾーン
MALLZONES[MALLZONES.length - 1].to = 50;
MALLZONES.push(
  { to: 60, n: '立体駐車場', intro: '螺旋のスロープが、下へ下へと巻いている。全区画に、同じ車が停まっている。', boss: '駐車場の番人', bossKind: 'titan', bossMems: ['missile', 'armor', 'escalator'],
    foes: [['暴走カート', 'drone', { hp: 120, atk: 25, def: 9, spd: 16, fw: 8 }], ['誘導員マネキン', 'agent', { hp: 140, atk: 26, def: 12 }], ['精算機', 'turret', { hp: 170, atk: 25, def: 14, spd: 4, fw: 18 }], ['迷子の自動運転車', 'thug', { hp: 160, atk: 27, def: 11, spd: 12 }]],
    pool: [['escalator', 0.15], ['dash', 0.12], ['shock', 0.12], ['armor', 0.12], ['magnet', 0.1], ['markdown', 0.1], ['pointcard', 0.1], ['missile', 0.07], ['clearance', 0.06], ['lostfound', 0.06]] },
  { to: 70, n: '従業員通路', intro: '壁の色が変わった。「関係者以外立入禁止」。掲示板のシフト表は、全員の名前が同じだ。', boss: 'エリアマネージャー', bossKind: 'exec', bossMems: ['qa', 'medic', 'restock'],
    foes: [['早番のマネキン', 'agent', { hp: 150, atk: 27, def: 12 }], ['遅番のマネキン', 'agent', { hp: 150, atk: 27, def: 12 }], ['タイムカードの打刻機', 'turret', { hp: 180, atk: 26, def: 15, spd: 4, fw: 18 }], ['本部からの監査ドローン', 'runner', { hp: 115, atk: 23, def: 6, spd: 15, fw: 16 }]],
    pool: [['qa', 0.12], ['medic', 0.12], ['baton', 0.12], ['restock', 0.12], ['giftwrap', 0.1], ['blackfriday', 0.1], ['pointcard', 0.1], ['netrun', 0.08], ['mirror', 0.07], ['lostfound', 0.07]] },
  { to: Infinity, n: 'モールの芯', intro: '店も棚もない。エスカレーターだけが、どこまでも下っている。館内放送は、こちらの名前を呼んでいる。', boss: '創業者の銅像', bossKind: 'golem', bossMems: ['banquet', 'mirror', 'blackfriday'],
    foes: [['値札のないもの', 'thug', { hp: 170, atk: 28, def: 11, spd: 11 }], ['閉店後の客', 'agent', { hp: 150, atk: 27, def: 12 }], ['館内放送の声', 'runner', { hp: 120, atk: 24, def: 6, spd: 16, fw: 18 }], ['開店前の行列', 'thug', { hp: 180, atk: 27, def: 10, spd: 9 }], ['防火シャッター', 'turret', { hp: 200, atk: 26, def: 17, spd: 3, fw: 15 }]],
    pool: [['restock', 0.1], ['clearance', 0.1], ['markdown', 0.1], ['blackfriday', 0.1], ['escalator', 0.1], ['giftwrap', 0.1], ['pointcard', 0.1], ['lostfound', 0.1], ['banquet', 0.05], ['glass', 0.08], ['mirror', 0.07]] },
);
Object.assign(MALLMOD, {
  bargain: { n: 'タイムセール', d: '敵の熱が60から始まる(オーバーヒートさせやすい)' },
  sample: { n: '試食フェア', d: '敵も味方も、3ターン攻撃1.5倍で始まる' },
  vip: { n: '外商フロア', d: '敵は1体だけだがHP3倍。メモリのレアリティが大きく上がり、報酬1.5倍' },
});
// 館内放送(戦闘前)と、階を抜けたあとの出来事
const mallPt = (S, n) => { S.mallPt = (S.mallPt || 0) + n; };
VARY.mall = {
  go: [V(3, []),
    V(1, ['館内放送。「迷子のお知らせです。地下一階よりお越しの、お客様。お連れ様が、地上でお待ちです」', 'お連れ様に、心当たりはない。']),
    V(1, ['館内放送。「本日は、ご来店ありがとうございます。当館の閉店時刻は、ございません」']),
    V(1, ['館内放送。「業務連絡。三番の方、三番の方。至急、存在してください」']),
    V(1, ['館内放送。「ただいまより、タイムセールを開始いたします。対象商品は、お客様です」']),
    V(1, ['館内放送。「お忘れ物のお知らせです。地上を、お忘れではありませんか」']),
    V(1, ['エスカレーターの手すりだけが、逆向きに動いている。']),
    V(1, ['通路の両側の店は、全部、同じ店だ。店員も、全員、同じ顔で会釈した。']),
    V(1, ['床の案内表示は「出口 ↓」。出口は、いつも下にあることになっている。'])],
  w: [V(5, []),
    V(1, ['階段の踊り場に、福引きのガラガラが置いてあった。回した。白玉。', 'ティッシュの代わりに、修復ジェルが出てきた。'], S => { S.items.gel++; }),
    V(1, ['階段の踊り場に、福引きのガラガラが置いてあった。回した。赤玉。', '鐘が鳴った。誰が鳴らしたのかは、分からない。モールポイント30ptを手に入れた。'], S => mallPt(S, 30)),
    V(1, ['踊り場のベンチで、迷子の掃除ロボットが、同じ場所を拭き続けていた。向きを変えてやると、礼の代わりに、拾い集めた小銭を吐き出した。', '90crを手に入れた。'], S => { S.credits += 90; }),
    V(1, ['踊り場の自販機が、勝手に一本落とした。「当たり」のランプが点いている。', '冷却スプレーを手に入れた。'], S => { S.items.coolant++; }),
    V(1, S => { const n = pmName(S); return n ? [`踊り場のベンチで、少し休んだ。${n}が、試食コーナーから持ってきた何かを、半分分けてくれた。`, `${n}との仲が、少し深まった。`] : ['踊り場のベンチで、少し休んだ。']; }, S => { const p = S.party.filter(id => id !== 'hero'); if (p.length) rel(S, p[Math.floor(Math.random() * p.length)], 1); }),
    V(1, ['落とし物センターの窓口が、踊り場に出張していた。棚に、見覚えのない自分の名札が一枚ある。裏に、メモリがテープで留めてあった。', 'メモリを手に入れた。'], S => { give(S, rndMem(['coupon', 'markdown', 'escalator', 'giftwrap', 'pointcard', 'lostfound'])); }),
    V(1, ['踊り場の壁に、身長計が描いてあった。「ここまで降りたお客様」。印は、ずっと下まで続いている。自分の印を、一つ足した。']),
    V(1, ['証明写真機があった。撮ってみると、写っていたのは、背後の誰もいない通路だけだった。', '写真の裏に、ポイントのシールが貼ってあった。モールポイント15ptを手に入れた。'], S => mallPt(S, 15))],
};
/* ポイント交換所(屋上の屋台村) */
const PTSHOP = [
  ['修復ジェル', 30, S => { S.items.gel++; }], ['冷却スプレー', 30, S => { S.items.coolant++; }], ['EMPグレネード', 50, S => { S.items.emp++; }], ['部品5個', 60, S => { S.parts += 5; }],
  ['メガモール製のメモリ(レア以上)', 150, S => { give(S, mkInst(pickMem([['coupon', 0.15], ['blackfriday', 0.15], ['escalator', 0.15], ['markdown', 0.1], ['clearance', 0.15], ['giftwrap', 0.1], ['pointcard', 0.1], ['lostfound', 0.05], ['restock', 0.05]]), 2 + (Math.random() < 0.3 ? 1 : 0), null, true)); }],
  ['メガモール製のメモリ(最高レアリティ)', 500, S => { give(S, mkInst(pickMem([['blackfriday', 0.2], ['clearance', 0.2], ['pointcard', 0.2], ['lostfound', 0.2], ['restock', 0.2]]), 4, null, true)); }],
];
const MALLEV2 = {
  ptshop: { loc: 'rooftop', repeat: true, label: 'ポイント交換所', sub: 'メガモールの奥で貯まるポイントを、品物に替える', cond: S => true, nodes: {
    start: { t: [], dyn: S => ['屋台村の真ん中に、古い景品交換所があった。看板は「ポイント交換所 当館とは一切関係ありません」。', ['交換所の婆さん', `あんた、${S.mallPt || 0}ポイント持ってるね。下で貯めてきたんだろ。地下の連中は、ポイントの使い道を作り忘れたのさ。だから、うちが替えてやってる`]],
      cf: S => PTSHOP.map(([n, c, f]) => ({ t: n, sub: `${c}pt`, to: 'got', dis: S2 => (S2.mallPt || 0) < c, fx: S2 => { S2.mallPt -= c; f(S2); S2._msg = `${n}と交換した。残り${S2.mallPt}pt。`; } }))
        .concat(S.flags.hotaru ? [] : [{ t: '一点物「閉店の音楽」', sub: '600pt', to: 'hotaru', dis: S2 => (S2.mallPt || 0) < 600, fx: S2 => { S2.mallPt -= 600; S2.flags.hotaru = 1; give(S2, one('hotaru', AF(['tec', 6], ['cool', -20], ['seep', 50], ['hp', 25]))); } }])
        .concat([{ t: '帰る', sub: '', to: 'no' }]) },
    no: { t: ['婆さんは、ポイントの台帳に目を戻した。'], end: true },
    got: { t: [], dyn: S => [S._msg || ''], c: [{ t: '続けて交換する', to: 'start' }, { t: '帰る', to: 'no' }] },
    hotaru: { t: ['婆さんは、棚のいちばん上から、埃をかぶった箱を下ろした。', ['交換所の婆さん', '閉店の音楽だよ。あのモールが、一度も流したことのない曲さ。流す機会が、無かったんだ。閉まらないからね'],
      ['交換所の婆さん', 'あたしは、開店の日からここにいる。閉店の日に、これを流すのが仕事だった。……あんたが、代わりに持っていきな'], '一点物の「閉店の音楽」を手に入れた。'], end: true } } },
  mallrecord: { loc: 'kg', repeat: true, label: '到達記録の掲示板', sub: '案内所の横。深く降りるほど、記念品が出る', cond: S => FREE(S) && (S.mallMax || 0) >= 10, nodes: {
    start: { t: [], dyn: S => { const m = S.mallMax || 0, got = S.mallPrize || 0; const next = [10, 20, 30, 40, 50, 60, 70, 80, 100].find(x => x > got); return [`案内所の横の掲示板に、到達記録が貼り出してある。現在の記録は、地下${m}階。モールポイントは${S.mallPt || 0}pt。`, next ? (m >= next ? `地下${next}階の記念品が、まだ受け取られていない。` : `次の記念品は、地下${next}階。`) : '記念品は、すべて受け取った。掲示板のいちばん下には、まだ余白がある。']; },
      cf: S => { const m = S.mallMax || 0, got = S.mallPrize || 0, next = [10, 20, 30, 40, 50, 60, 70, 80, 100].find(x => x > got); const out = [];
        if (next && m >= next) out.push({ t: `地下${next}階の記念品を受け取る`, sub: '', to: 'prize', fx: S2 => { S2.mallPrize = next; const cr = next * 40; S2.credits += cr; mallPt(S2, next * 2); S2.items.gel += 2; S2._msg = `到達記念。${cr}crと、モールポイント${next * 2}pt、修復ジェル2本を手に入れた。`;
          if (next === 30) { give(S2, mkInst('pointcard', 4, AF(['hp', 25], ['tec', 6], ['spd', 3], ['seep', 50]), true)); S2._msg += ' 最高レアリティの「ポイント十倍カード」も付いてきた。'; }
          if (next === 50) { give(S2, mkInst('lostfound', 4, AF(['hp', 25], ['def', 4], ['spd', 3], ['cool', -20]), true)); S2._msg += ' 最高レアリティの「落とし物センター」も付いてきた。'; }
          if (next >= 60) { S2.parts += 10; S2._msg += ' 部品10個も付いてきた。'; } } });
        out.push({ t: '立ち去る', sub: '', to: 'no' }); return out; } },
    no: { t: ['掲示板の前を離れた。'], end: true },
    prize: { t: [], dyn: S => ['案内所の窓口には、誰もいなかった。記念品だけが、カウンターに置いてあった。', S._msg || ''], end: true } } },
};
/* 道中のひとこと(新しい場所) */
Object.assign(CHATLOC, {
  negishi: { pedal: ['四本脚は反則だろ。……速えな、でも'], aur: ['良い馬だ。主を待つ目をしている'], hijiki: ['がはは! 馬には乗れん! 船酔いする!'] },
  gaien: { kill: ['……ここ、撃てるものが何もない'], tsukimi: ['消去手続きの漏れです。担当部署は、とうに解散しています'], xiao: ['皆さま、お静かに過ごされておいでです'] },
  hakkei: { hijiki: ['海の底か! 陸よりは落ち着くな!'], mutsuko: ['宇宙と似てるわね。静かで、青くて、帰り道が遠い'], zero: ['魚……。食べ物じゃなくて、展示なんだね'] },
  keirin: { pedal: ['バンクは四十五度だ。ビビったら落ちる。ビビらなきゃ飛べる'], glassjaw: ['いい歓声だ。闘技場より、品がねえ。最高だな'] },
  tastelab: { satou: ['……ここで、僕も検査を受けたことがあります。結果は「対象外」でした'], tsukimi: ['閉鎖の稟議書に、判を押したのは、わたしです'], chef: ['出汁の匂いだけ残して、火を落としたのか。料理人のやることではない'] },
  tone: { mutsuko: ['この土手、子供のころに転がったのよ'], gantetsu: ['草野球か。昔は工場対抗でやったもんだ'], shumai: ['(シューマイが、川に向かって低く唸っている。何かいるらしい)'] },
  touge: { pedal: ['下りなら、車にも負けねえぞ。たぶん'], yumori: ['……ミチ……フルイ……スキ'], hong: ['事故が出たら呼びなさい。出る前に呼んでくれると、もっといいわ'] },
  rooftop: { tenin: ['屋上……? 当館に、屋上なんて、ありましたっけ'], wan: ['……屋台か。火の使い方は、悪くねえ'], zero: ['本物の湯気だ。全部、本物だ'] },
  usagi: { mutsuko: ['裏側は、建設隊も来なかったわ。誰が建てたのかしら'], hijiki: ['餅だと! 干物と交換できるか聞いてくれ!'], chef: ['……いい音だ。つき手の腰が入っておる'] },
});
const BIGEV = Object.assign({}, PLACEEV, PLACEIN, SIDE3, PAIREV2, REQEV, CAMPEV, BAGEV, MALLEV2);

/* ---------- 恋人のエピローグ(エンディングで、恋人ごとに一場面) ---------- */
const LOVEEND = {
  kill: { scene: 'pier', t: ['一年後。コンテナ埠頭の、ねぐらの屋根の上。', 'キルチョイサーは、もう銃を持っていない。代わりに、質屋から取り返した照準器で、湾の向こうを見ている。',
    ['キルチョイサー', '……あそこ。観覧車、動いてる'], ['キルチョイサー', '撃つものを探さないで、遠くを見るの、まだ慣れない。でも、隣にいてくれると、ちゃんと見える'],
    '彼女は照準器を下ろして、こちらの肩に頭を乗せた。それから、とても小さな声で言った。', ['キルチョイサー', '……ついてる日が、毎日になった。ずるいよね']],
    shop: ['朗々飯店の開店の日、キルチョイサーは客席のいちばん奥に座っていた。店に背を向けず、出口を見張れる席だ。', '料理が来ると、彼女は初めて、出口から目を離した。'] },
  aur: { scene: 'yamate', t: ['一年後。ヤマテ高台の、屋根の落ちた礼拝堂。', '屋根は、もう落ちていない。オロールが一年かけて、瓦を一枚ずつ葺き直した。',
    ['オロール', '騎士には、守る城が要る。我が城は、ここだ。……そなたのいる場所だ'],
    'オロールは槍を壁に立てかけ、甲冑の籠手を、片方だけ外した。', '中から出てきた手は、思っていたより小さかった。それ以上のことは、何も見えなかった。それで、十分だった。',
    ['オロール', 'これ以上は、まだ見せられぬ。いずれ、だ。騎士の「いずれ」は、長いぞ']],
    shop: ['朗々飯店の入口には、甲冑の門番が立つようになった。誰も、何も言わない。客は、黙って一礼して入っていく。'] },
  som: { scene: 'gw', t: ['一年後。麺処グラヴィティ・ウェル、カウンターの四番と五番の席。', 'ソムリエは、自分で注文するのが、少しだけ上手くなった。',
    ['サイレント・ソムリエ', '油そば、二つ。……一つは、私のぶん。もう一つも、私が決めた'],
    '丼が来ると、彼女はこちらのぶんを先に一口だけ食べる。毒味の癖は、抜けなかった。', ['サイレント・ソムリエ', '癖ではない。最初の一口は、いちばん大事な人に、安全を保証するためにある'],
    ['サイレント・ソムリエ', '……それと、少し、おいしい。今は、それも言える']] },
  hong: { scene: 'noge', t: ['一年後。ノゲ横丁、紅楼の二階。', '診察時間が終わると、紅姐は煙管に火をつけて、窓辺の椅子を二つ並べる。',
    ['紅姐', 'あんた、また怪我して帰ってきたわね。縫ってあげるから、そこに座りなさい'], ['紅姐', '……違うわよ。怪我しなくても、座っていいの。椅子は、あんたのぶんなんだから'],
    '紅姐は、縫い終えた糸を、歯で切った。四十年、患者にしかしなかったことだ。', ['紅姐', 'この歳で、診察料のいらない患者ができるなんてね。帳簿が、狂いっぱなしよ']] },
  pedal: { scene: 'noge', t: ['一年後。ノゲの路地。', 'ペダルの自転車の後ろに、荷台が付いた。荷物を載せるためではない。',
    ['ペダル', '乗れよ。……落ちても知らねえからな。いや、落とさねえけど'], 'ペダルは信号を三つ無視して、坂を一気に下った。こちらの腕が腰に回っているのを、何度も確かめながら。',
    ['ペダル', 'オレ、配達で一番になりたかったんだ。どこにでも、誰よりも早く着くって'], ['ペダル', '……でも今は、遅く着きてえ場所がある。お前と、こうやって走ってる途中だ']] },
  wan: { scene: 'chinatown', t: ['一年後。旧中華街跡の、朝市の奥。', 'ワンは、本物の葱を選ぶのが上手くなった。葱売りの婆さんは、もうワンの顔を見ても隠さない。',
    ['ワン', '……お前のぶんも、仕込んである。食え'], 'その晩の炒飯は、二皿あった。ワンは、自分のぶんには手をつけず、こちらが食べるのを見ていた。',
    ['ワン', '用心棒は、誰かの背中を守る仕事だ。料理人は、誰かの腹を守る仕事だ'], ['ワン', '……両方やる。お前の、ぶんだけな']],
    shop: ['朗々飯店の厨房で鍋を振るのは、ワンになった。用心棒だった男の炒飯は、客が驚くほど、優しい味がした。'] },
  xiao: { scene: 'kitchen', t: ['一年後。朗々飯店の跡地の厨房。', '小籠は、七番卓を、自分の席にした。給仕が座っていい席は、ここだけと決めたらしい。',
    ['小籠', 'お客様。本日のおすすめは……いえ。本日のおすすめは、わたくしでございます'], '言ってから、小籠は自分の発言を三秒ほど検証して、照明の色を少し赤くした。',
    ['小籠', '給仕としての記録は、数えきれないほどございます。恋人としての記録は、まだ一年分です。……これから、毎日、追記してまいります']],
    shop: ['朗々飯店の再開の日、小籠は給仕に戻った。ただし休憩時間には、七番卓に、こちらと並んで座る。'] },
  zero: { scene: 'minato', t: ['一年後。ミナトミライ廃園、観覧車の下の炊き出し。', '鍋の湯気の向こうで、ゼロカロリーが、ホログラムではないおにぎりを握っていた。',
    ['ゼロカロリー', '見て。これ、本物。わたしが握った。わたしは食べられないけど'], ['ゼロカロリー', 'でも、君が食べると、わたしの中の何かが満たされるんだ。カロリーじゃない、何か'],
    'おにぎりは、少し塩が強かった。そう言うと、ゼロカロリーは、ゼロの体で、いちばん大きく笑った。']},
  gantetsu: { scene: 'factory', t: ['一年後。臨海工場群、第一高炉の前。', '高炉の前の花は、三束になった。ガンテツが、もう一束ぶんの場所を空けたからだ。',
    ['ガンテツ', 'あいつらに、紹介しといた。三人目だってな。……怒っちゃいねえ。むしろ、遅えって笑ってる'],
    'ガンテツは、新しく打った刃を研いでいる。こちらの刃だ。毎朝、必ず研ぐ。', ['ガンテツ', '鉄は、熱いうちに打つ。……俺はもう、冷めかけの鉄だがな。お前が叩くから、まだ赤い']] },
  chef: { scene: 'kitchen', t: ['一年後。朗々飯店の厨房。', '火口の青い火の前に、半透明の料理長と、こちらが並んで立っている。鍋を振るのは、こちらの手だ。火加減を見るのは、料理長の目だ。',
    ['料理長・朗', '強い。葱が泣いておる'], ['料理長・朗', '……だが、昨日よりはいい。わしは、昨日のお前より、今日のお前の炒飯の方が好きだ'],
    '料理長の手が、鍋の柄を握るこちらの手に重なった。触れた感覚はなかった。温かかった。', ['料理長・朗', '一皿の中に自分を残した男が、二人で一皿を作る羽目になるとはな。……悪くない']] },
  lin: { scene: 'bar', t: ['一年後。ノゲ横丁、元・鳩の巣。', '看板は「廃業」から「本日貸切」に変わった。毎晩、貸切だ。客は一人しかいない。',
    ['リン', '帳簿、つけてないの。あなたとのことは'], ['リン', 'ブローカーだった頃は、全部数えてた。貸し、借り、値段。でも、あなたには値段がつけられない。……つけたくないの'],
    'リンは、グラスを二つ並べて、同じ酒を注いだ。', ['リン', '乾杯。何にって? 決まってるでしょ。帳尻の合わない人生に']] },
  tsukimi: { scene: 'tokyo', t: ['一年後。スペースポート出発ロビーの、いつものベンチ。', 'ツキミは、もう報告書を書かない。代わりに、日記をつけている。提出先のない、手製の様式で。',
    ['ツキミ', '本日の品質評価。あなた、合格。わたし、合格。二人の関係、検査基準外'], ['ツキミ', '……基準外というのは、品質保証部の用語では「規格を超えている」という意味です。良い意味で'],
    'ツキミは日記を閉じて、こちらの手を、検品するように丁寧に握った。それから、検品ではない握り方に、握り直した。'] },
  glassjaw: { scene: 'minato', t: ['一年後。ミナトミライ廃園、地下闘技場の閉場後。', 'リングの上で、グラスジョーがグローブを外していた。引退したのだ。',
    ['グラスジョー', '王者ってのは、負けたら終わりだ。だから、自分から降りた。負ける前に、もっと守りたいもんができちまったからな'],
    ['グラスジョー', '……顎は弱えが、心は頑丈なんだよ、俺は。殴られても、お前がいりゃ倒れねえ'], 'グラスジョーは、こちらの拳に、自分の拳を軽く当てた。闘技場で、いちばん優しい一発だった。'] },
  hijiki: { scene: 'honmoku', t: ['一年後。ホンモク・ドック、密輸船の甲板。', '密輸船の船首に、新しい船名が書き足された。字は、ヒジキの手書きで、ひどく曲がっている。',
    ['キャプテン・ヒジキ', 'がはは! 海賊は宝を船に積む! お前は、宝だ! だから乗れ! 降りるな!'], ['キャプテン・ヒジキ', '……月まで行って、帰ってきた船は、この船だけだ。帰り道があるってのは、いいもんだな。待ってる奴がいるってのは'],
    '干物を噛みながら、ヒジキは舵輪を回した。行き先は決めていないらしい。決めなくていいらしい。'] },
  whiteglove: { scene: 'yamate', t: ['一年後。ヤマテ高台の洋館の庭。', 'テーブルに、カップが二つ並んでいる。ホワイトグローブは、もう給仕だけをする人ではない。今日は、向かいの椅子に座っている。',
    ['ホワイトグローブ', '執事が主の向かいに座るなど、四十年の経歴の中で、初めての不作法でございます'], ['ホワイトグローブ', '……ですが、この不作法を、毎日繰り返したいと、心から思っております'],
    '白い手袋の片方を外して、彼はこちらのカップに紅茶を注いだ。素手で注ぐのは、生まれて初めてだと言った。'] },
  yumori: { scene: 'onsen', t: ['一年後。ハコネ、源泉の脇。', '湯守は、源泉と、こちらを守っている。どちらが先かは、湯守にも決められないらしい。',
    ['湯守', '……アタタカイ……ハ……ココ'], '湯守は、こちらの隣に腰を下ろした。岩の体が、湯気で、ほんの少し温かい。',
    ['湯守', '……マモル。ズット。……ズット、ハ、ナガイ。……イイ']] },
  mutsuko: { scene: 'suburb', t: ['一年後。カシワタウン、坂の上の天文台。', '望遠鏡の脇に、月の石が置いてある。ムツコは、毎晩二人で月を見ることにしている。',
    ['ムツコ', '四十年前、わたしはあそこに行ったの。今度は、あなたと一緒に見てる'], ['ムツコ', '歳を取るとね、遠くへ行くより、隣にいる方が難しくなるの。でも、あなたは、隣にいてくれるのね'],
    'ムツコは、望遠鏡から目を離して、こちらを見た。若い頃の宇宙飛行士の写真と、同じ目をしていた。'] },
  tenin: { scene: 'mall', t: ['一年後。メガモールの屋上駐車場。', 'テンインは、名札を外した。代わりに、手作りのポイントカードを一枚だけ持っている。',
    ['テンイン', 'これ、あなた専用のポイントカードです。一緒にいると、ポイントが貯まります。貯まると……えっと、特典は、考え中です'],
    ['テンイン', 'あ、でも、今もう満点です。……ポイントカードの意味、ないですね'], 'テンインは、照れ隠しに、四十五度でお辞儀をした。顔を上げるまで、ずいぶん時間がかかった。'] },
  satou: { scene: 'gw', t: ['一年後。麺処グラヴィティ・ウェル、カウンターの端の席。', 'サトウは、半分くらい、味が分かるようになった。',
    ['サトウ', '今日の油そば、昨日より、少しだけ酸っぱいです。……たぶん。合ってますか'], '合っていた。サトウは、拳を小さく握った。',
    ['サトウ', '味が分かるようになったら、最初に何を食べたいか、ずっと考えてたんです'], ['サトウ', '……違いました。何を食べたいかじゃなくて、誰と食べたいか、でした']] },
  nanashi: { scene: 'suburb', t: ['一年後。カシワタウン、天文台の屋根。', 'ナナシは、こちらの肩に止まって、夜空を撮影している。撮った星は、全部こちらの端末に送ってくる。',
    'センサーが、青く瞬いた。それから、桃色に瞬いた。ナナシが、初めて使った色だった。', '機体の腹に貼られた手製の登録票に、いつのまにか書き足されていた。所有者の欄ではない。その下の、自由記入欄に。',
    '「いっしょに いる ひと」'] },
};
const PARTEND = {
  kill: 'キルチョイサーとは、今も背中を預け合っている。彼女の照準器が、こちらの背後を見ていない日は、一日もない。',
  aur: 'オロールは、相棒の騎士として、今日も槍を立てている。叙任を受けた相手を、守るのが騎士だ、と言って。',
  som: 'ソムリエは、相棒の毒味役を続けている。最初の一口は、今もこちらの丼から。',
  hong: '紅姐の診療所には、相棒専用の椅子がある。怪我をしていなくても、座っていい椅子だ。',
  pedal: 'ペダルは、相棒の荷物だけは、配達料を取らない。',
  wan: 'ワンは、相棒のぶんの賄いを、毎晩一皿多く作っている。',
  xiao: '小籠は、相棒のための七番卓を、毎日拭いている。',
  zero: 'ゼロカロリーは、相棒と炊き出しに立っている。',
  gantetsu: 'ガンテツは、相棒の刃の手入れを、一生やると決めている。',
  chef: '料理長は、相棒を「見習い」と呼んで、今日も火加減を叱っている。',
  lin: 'リンは、相棒との貸し借りだけは、帳簿につけない。',
  tsukimi: 'ツキミの日記の「相棒」の欄は、毎日、合格と書いてある。',
  glassjaw: 'グラスジョーは、相棒の顎を、今も一度も打ったことがない。',
  hijiki: 'ヒジキの船には、相棒の寝床が、いつでも空けてある。',
  whiteglove: 'ホワイトグローブは、相棒の靴を、今日も磨いている。',
  yumori: '湯守は、源泉と相棒を、交互に見守っている。',
  mutsuko: 'ムツコの天文台には、相棒の望遠鏡が一台増えた。',
  tenin: 'テンインのポイントカードには、相棒の名前が書いてある。',
  satou: 'サトウは、新しい味が分かるたびに、相棒に報告しに来る。',
  nanashi: 'ナナシは、相棒の肩を定位置にした。',
};
/* ほかの仲間の、その後(短く) */
const AFTER = {
  som: 'サイレント・ソムリエは、毒味役を引退した。今は、知らない店の暖簾を、一人でくぐる練習をしている。',
  hong: '紅姐の診療所は、今日も繁盛している。診察料は、相変わらず誰にも払えない額だ。',
  pedal: 'ペダルは、ネオヨコハマでいちばん速い配達屋になった。遅延は、二年前の一件だけだ。',
  wan: 'ワンは、用心棒を辞めて、屋台を出した。品書きは、炒飯だけ。',
  xiao: '小籠は、注文票の束を整理し終えた。最後の一枚は、取り消し済みのまま、胸のポケットに入っている。',
  zero: 'ゼロカロリーの炊き出しは、毎週開かれている。鍋の中身は、もうホログラムではない。',
  gantetsu: '臨海工場群の第一高炉に、また火が入った。ガンテツは、班長を引き受けなかった。槌を握る方が、性に合うらしい。',
  chef: '料理長・朗の人格データは、朗々飯店の火口の中で、今も火加減を見ている。',
  lin: 'リンは、鳩の巣を、普通の酒場として開け直した。帳簿は、ちゃんとつけている。',
  tsukimi: 'ツキミは、手製の書式を売る小さな店を開いた。いちばんの売れ筋は、退職届だ。',
  glassjaw: '地下闘技場の王座は、グラスジョーのものに戻った。顎は、相変わらずだ。',
  hijiki: 'ヒジキの密輸船は、月への干物の定期便になった。合法かどうかは、誰も確かめていない。',
  whiteglove: 'ホワイトグローブは、洋館の主のいない部屋を、今も毎日掃除している。',
  yumori: '湯守は、源泉の番に戻った。膝は、もうきしまない。',
  mutsuko: 'ムツコの天文台は、子供たちの観測会で、毎週満員になった。',
  tenin: 'テンインは、メガモールの屋上で、屋台村の案内係になった。お辞儀は、三十度と四十五度の中間だ。',
  satou: 'サトウは、半分くらい、味が分かるようになった。半分あれば十分だと、本人は言っている。',
  nanashi: 'ナナシは、誰のものでもないまま、ネオヨコハマの空を飛んでいる。',
  shumai: 'シューマイは、朗々飯店の跡地の裏口で、昼寝をしている。毎晩、どこからか焼売のにおいがするからだ。',
};
const POLYEND = ['恋人は、一人ではなかった。誰も、それを問題にしなかった。食卓の椅子が、少し多いだけだ。', '夜になると、みんなで同じ鍋を囲む。誰かが混ぜ、誰かがよそい、誰かが最初の一口を食べる。順番は、毎晩変わる。'];

/* ---------- 野良犬シューマイ ---------- */
const DOGEV = {
  dogjoin: { join: true, repeat: true, loc: 'chinatown', label: '腹を空かせた野良犬', sub: '屋台の裏で、ぶち模様の犬がこちらを見ている', cond: S => FREE(S) && !member(S, 'shumai') && !S.flags.dogDone, nodes: {
    start: { dyn: S => [[
      '旧中華街の屋台の裏。ぶち模様の大きな犬が、ゴミ箱の陰からこちらを見ている。',
      '首輪は無い。片耳が半分ちぎれている。チャンカーの上着のポケットのあたりを、じっと嗅いでいる。',
      'USBメモリに、においなんてあるはずがない。',
    ], [
      'あのぶち犬が、今日も屋台の裏にいた。',
      '前より少しだけ近い。尻尾は動かない。こちらの手元だけを見ている。',
    ], [
      'ぶち犬は、屋台の前に座って待っていた。',
      'こちらに気づくと立ち上がり、朗々飯店の跡地のほうへ数歩歩いて、振り返った。',
    ]][Math.min(2, S.flags.dogFed || 0)],
      c: [
        { t: '肉まんを買って分ける', sub: '20cr', cond: S => (S.flags.dogFed || 0) < 2, dis: S => S.credits < 20, to: 'fed', fx: S => { S.credits -= 20; S.flags.dogFed = (S.flags.dogFed || 0) + 1; } },
        { t: 'ついていく', sub: '', cond: S => (S.flags.dogFed || 0) >= 2, to: 'follow' },
        { t: '放っておく', sub: '', to: 'leave' },
      ] },
    fed: { dyn: S => S.flags.dogFed >= 2 ? [
      '肉まんを置くと、犬は今度はその場で食べた。',
      '食べ終わると、チャンカーの靴のにおいを長いこと嗅いでいた。それから、何も言わずに路地の奥へ消えた。',
    ] : [
      '屋台で肉まんを一つ買い、半分に割って放った。',
      '犬は空中でくわえ、ゴミ箱の陰に戻ってから食べた。最後まで、こちらから目を離さなかった。',
    ], end: true },
    leave: { t: ['犬は、追いかけてはこなかった。'], end: true },
    follow: { fx: S => { join(S, 'shumai'); rel(S, 'shumai', 2); S.flags.dogDone = 1; give(S, mkInst(['wokfire', 'cleaver', 'serve'][Math.floor(Math.random() * 3)], 2, null, true)); },
      dyn: S => [
        '犬は跡地の裏口まで来ると、瓦礫の下を前足で掘りはじめた。',
        '出てきたのは、油紙に包まれた古いメモリだった。包み紙には、朗々飯店の印が押してある。',
        ...(member(S, 'chef') ? [['料理長・朗', 'シューマイ! お前、まだ生きてたのか'], ['料理長・朗', '裏口で、毎晩焼売を一つ盗んでいった犬だ。店が燃えた夜も、こいつだけは逃げ足が速かった'], '犬の尻尾が、初めて大きく揺れた。']
          : ['包み紙の裏に、走り書きがある。「シューマイへ。店が無くなったら、店の味を持って帰ってきたやつについて行け」', 'チャンカーのポケットには、朗々飯店の味のデータが入っている。犬は、それで十分だという顔をしている。']),
        '野良犬のシューマイが仲間になった。メモリは挿せない。その代わりに、牙と鼻と四本の脚がある。',
        '掘り出したメモリは、手持ちに加えた。',
      ], end: true },
  } },
};
const EV = Object.assign({}, {
  prologue: { loc: 'pier', auto: true, label: 'プロローグ', nodes: {
    start: { t: [
      'ヨコハマ・ポートランド・ディヴィジョン。住民はネオヨコハマと呼ぶ。',
      'コンテナ埠頭のジャンク山は、今日も湾から流れ着いたものを黙って積み上げている。',
      'ジャンクを漁り、端末をこじ開け、売れるものを売る。その稼業を、この街ではブレードヘッドチャンカーと呼ぶ。略してチャンカー。それがこの男の職業であり、通り名でもあった。',
      '錆びた冷蔵庫の裏で、指が何かに触れた。古びたUSBメモリ。端子の金メッキが、妙にきれいに残っている。',
      'ラベルには手書きで四文字。「朗々飯店」。',
    ], c: [
      { t: '舌の端子に当ててみる', sub: '中身を確かめるいちばん早い方法', to: 'taste' },
      { t: '当てる前に匂いを嗅ぐ', sub: '用心深さは職業病', to: 'smell' },
    ] },
    smell: { t: ['匂いはしなかった。メモリなのだから当然である。', 'チャンカーは三秒ほど自分を恥じ、それから舌の端子に当てた。'], c: [{ t: '続ける', to: 'taste' }] },
    taste: { fx: S => { const h = member(S, 'hero'); h.ports[1].mem = 'chahan'; h.ports[1].inst = mkInst('chahan', 4, [{ k: 'spd', v: 2 }, { k: 'atk', v: 3 }, { k: 'seep', v: 20 }, { k: 'hp', v: 15 }], true); CH.recompute(h); h.hp = h.maxhp; S.flags.pro = 1; },
      t: [
      '米が、立っていた。',
      '一粒ずつが油をまとい、卵は鍋肌の温度を覚えたまま舌の上でほどけた。葱は、切られてから四秒しか経っていない味がした。',
      '食べた、という実感だけが、脳に直接届いた。クラックをキメるより速くぶっ飛ぶ。噂にだけ聞いたことがある。',
      '「プロトコルチャーハン・クラックスピード」。地図から消えた中華街の、四つ星の厨房の、最後の一皿。',
      ['チンピラ', 'おい。今、いい顔したな。何を拾った'],
      '背後に、同業のチンピラが立っていた。この埠頭では、いい顔をするのは高くつく。',
    ], battle: { enc: 'tut', win: 'won', lose: 'lost' } },
    lost: { t: ['気がつくと、ジャンクの山に頭から突っ込んでいた。メモリは、まだ舌の裏に貼りついている。', 'チンピラは、まだそこにいる。'], battle: { enc: 'tut', win: 'won', lose: 'lost' } },
    won: { t: [
      'チンピラは捨て台詞を残して消えた。あの口の軽さなら、夕方までには埠頭じゅうに話が回る。',
      'チャンカーはメモリを自分のポートに挿し直した。売れば一生遊べる。売るまで生きていれば、の話だが。',
    ], end: true },
  } },

  scav: { loc: 'pier', repeat: true, label: 'ジャンクを漁る', sub: '観察で成果が変わる。街が動くまでは3回が限度', cond: S => S.flags.pro && (S.scav[S.wanted] || 0) < 3, nodes: {
    start: { fx: S => { S.scav[S.wanted] = (S.scav[S.wanted] || 0) + 1; }, t: ['潮の引いたジャンク山。今日の漂着物は、まだ誰にも荒らされていない。'], check: { stat: 'obs', lo: 4, hi: 7, fail: 'f', ok: 'o', great: 'g' } },
    f: { fx: S => { S.credits += 15; }, t: ['めぼしい物は見つからなかった。銅線を少しだけ剥がして売った。', '15crを手に入れた。'], end: true },
    o: { fx: S => { S.credits += 45; }, t: ['割れた端末から、まだ生きている基板を抜いた。', '45crを手に入れた。'], end: true },
    g: { fx: S => { S.credits += 80; S.items.gel++; }, t: ['誰も見ない角度から山を見た。医療用コンテナの封が、手つかずで残っていた。', '80crと修復ジェルを手に入れた。'], end: true },
  } },

  farmDrone: { loc: 'pier', repeat: true, label: '野良ドローンを狩る', sub: '何度でも戦える。メモリと浸透度の稼ぎ場', cond: S => S.flags.pro, nodes: {
    start: { t: ['ジャンク山の奥で、赤いセンサーが点滅している。'], battle: { enc: 'farmDrone', win: 'w', lose: 'l' } },
    w: { fx: S => { S.flags.droneWins = (S.flags.droneWins || 0) + 1; }, t: ['残骸から使える部品を外して、山を下りた。'], end: true },
    l: { t: ['這うようにしてねぐらへ戻った。ドローンは縄張りの外までは追ってこない。'], end: true },
  } },

  sunk: { loc: 'pier', label: '沈みかけのコンテナ', sub: '岸壁に、封の生きたコンテナが引っかかっている', cond: S => S.flags.pro, nodes: {
    start: { t: [
      '岸壁の杭に、半分沈んだコンテナが引っかかっていた。電子錠のランプが、まだ緑に点いている。',
      '封が生きているということは、中身も生きているということだ。この埠頭で、それに気づいたのはまだチャンカーだけらしい。',
    ], check: { stat: 'tec', lo: 5, hi: 8, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['錠は三回目の試行で黙りこんだ。日を改めるか、もっと腕のいい誰かを連れてくるしかない。'], end: true, noDone: true },
    o: { fx: S => { give(S, mkInst('shock', 1, null, true)); S.credits += 30; }, t: ['錠は素直に開いた。中身は水を吸った梱包材と、警備会社の備品がひと箱。', '改造品の「放電モジュール」と30crを手に入れた。'], end: true },
    g: { fx: S => { give(S, mkInst('shock', 2, null, true)); S.credits += 30; S.items.coolant++; }, t: ['錠を開けるついでに、中の在庫管理タグを読んだ。箱の底の、いちばん値の張る一本の場所が分かった。', '特注品の「放電モジュール」と30cr、冷却スプレーを手に入れた。'], end: true },
  } },

  granny: { loc: 'chinatown', label: '粥の屋台', sub: '門の手前で、老婆が鍋をかき回している', cond: S => S.flags.m1, nodes: {
    start: { t: [
      '善隣門の手前に、粥の屋台が一軒だけ出ていた。老婆は客の顔を見ずに椀を出す。',
      ['屋台の老婆', '朗々飯店の話を聞きに来た顔だね。あんたで今日三人目だよ'],
    ], check: { stat: 'talk', lo: 4, hi: 6, fail: 'f', ok: 'o', great: 'g' } },
    f: { t: ['老婆はそれきり何も言わなかった。粥は旨かった。'], end: true },
    o: { fx: S => { S.items.coolant++; }, t: [
      ['屋台の老婆', 'リンは門には来ないよ。幇の若いのが三人、朝から張ってる。口の立つ奴が相手なら、一人は腰が引けるだろうがね'],
      '老婆は椀と一緒に、冷却スプレーを一本よこした。厨房の火傷に使っていたものだという。',
    ], end: true },
    g: { fx: S => { S.items.coolant++; S.items.emp++; }, t: [
      ['屋台の老婆', 'リンは門には来ないよ。幇の若いのが三人、朝から張ってる。口の立つ奴が相手なら、一人は腰が引けるだろうがね'],
      ['屋台の老婆', 'あの厨房で三十年、皿を洗ったんだ。あの炒飯を拾ったのがあんたなら、まあ、悪くはないよ'],
      '老婆は冷却スプレーと、どこで手に入れたのか分からないEMPグレネードをよこした。',
    ], end: true },
  } },

  aur: { join: true, loc: 'pier', label: '甲冑の人影', sub: 'ジャンク山に、場違いな誰かがいる', cond: S => S.flags.m2, nodes: {
    start: { t: [
      'ジャンク山の頂上で、全身甲冑の人物が、槍の石突きで瓦礫を掘り返していた。',
      '中世の、本物の、板金鎧である。兜の面頬は下りていて、顔は見えない。',
      '通りかかった荷運びも、屋台の親父も、誰ひとりその格好に触れなかった。チャンカーも触れなかった。この街では、他人の装備に口を出さないのが礼儀である。',
      ['甲冑の騎士', 'そこの者。我が名はオロール。聖杯を探している。この山のどこかにあるはずなのだ'],
    ], c: [
      { t: '手伝う', sub: '腕力のある者が掘る', to: 'dig' },
      { t: '関わらない', sub: '今は忙しい', to: 'leave' },
    ] },
    leave: { t: ['チャンカーは会釈だけして通り過ぎた。騎士は気を悪くした様子もなく、また掘りはじめた。'], end: true, noDone: true },
    dig: { t: ['聖杯がどんな形をしているのか、オロールは説明しなかった。見れば分かる、とだけ言った。'], check: { stat: 'pow', lo: 3, hi: 7, fail: 'digf', ok: 'digo', great: 'digo' } },
    digf: { t: ['瓦礫はびくともしなかった。オロールは静かに頷き、「また来るがよい」と言った。'], end: true, noDone: true },
    digo: { fx: S => { join(S, 'aur'); rel(S, 'aur', 1); }, t: [
      '冷蔵庫を三台どかした下から、錆びた業務用炊飯器の内釜が出てきた。',
      ['オロール', '……これだ'],
      'オロールは内釜を両手で掲げ、長いこと動かなかった。面頬の奥で何が起きているのかは、分からなかった。',
      ['オロール', 'そなたは恩人である。騎士は恩を剣で返す。我が槍は、今日よりそなたのものだ'],
      'オロールが仲間になった。',
    ], end: true },
  } },

  m1: { loc: 'pier', main: true, label: '故買屋ジローに見せる', sub: 'メインシナリオ。メモリの値を確かめる', cond: S => S.flags.pro, nodes: {
    start: { t: [
      '故買屋のジローは、コンテナを横倒しにした店の奥で、いつも何かを分解している。',
      'チャンカーがメモリを置くと、ジローの手が止まった。ルーペを三枚重ねて、ラベルの四文字を読んだ。',
      ['ジロー', '……朗々飯店。四つ星。中華街が地図から消える前の、最後の厨房だ'],
      ['ジロー', 'うちじゃ値が付けられん。付けたら、うちが消える'],
    ], c: [
      { t: '「誰なら買える」', sub: '素直に聞く', to: 'ask' },
      { t: 'ジローの端末を覗き見る', sub: '技術のある者が、話の合間に', to: 'peek' },
    ] },
    peek: { t: ['ジローがルーペを外している数秒のあいだに、店の端末の受信箱が見えた。'], check: { stat: 'tec', lo: 5, hi: 7, fail: 'peekf', ok: 'peeko', great: 'peeko' } },
    peekf: { t: ['画面はすぐに暗転した。ジローは何も言わなかったが、次からは茶が出ない気がした。'], c: [{ t: '「誰なら買える」', to: 'ask' }] },
    peeko: { fx: S => { S.flags.intelCorp = 1; S.credits += 50; }, t: [
      '受信箱の一番上に、差出人が企業ドメインの照会が来ていた。件名は「朗々飯店由来データの所在について」。日付は今朝。',
      '拾ってから半日も経っていない。チンピラより先に、もっと大きいものが動いている。',
      'ついでに、ジローが隠していた小銭入れの場所も分かった。50crを手に入れた。',
    ], c: [{ t: '「誰なら買える」', to: 'ask' }] },
    ask: { fx: S => { S.flags.m1 = 1; S.wanted++; }, t: [
      ['ジロー', '旧中華街跡に、リンという女のブローカーがいる。朗々幇にも企業にも顔が利く。買えるとしたら、あいつだけだ'],
      ['ジロー', 'ただし急げ。噂はもう流れてる。お前がいい顔をしたって話がな'],
      '手配度が上がった。',
    ], end: true },
  } },

  m2: { loc: 'chinatown', main: true, label: 'ブローカーのリンに会う', sub: 'メインシナリオ。善隣門の下で待ち合わせ', cond: S => S.flags.m1, nodes: {
    start: { t: [
      '旧中華街跡。門だけが残り、その向こうは更地と屋台と、朗々幇の見張りである。',
      '待ち合わせの善隣門の下に、リンはいなかった。代わりに、揃いの刺青を入れた下っ端が三人、屋台の椅子から立ち上がった。',
      ['下っ端', 'リン姐さんは来ねえよ。そのメモリは、もともとウチの厨房のもんだ'],
    ], c: [
      { t: '口八丁で数を減らす', sub: '話術のある者が前に出る', to: 'talk' },
      { t: '黙って構える', sub: '三人まとめて相手をする', to: 'fight3' },
    ] },
    talk: { t: ['三人のうち一人は、明らかに腰が引けていた。'], check: { stat: 'talk', lo: 4, hi: 6, fail: 'talkf', ok: 'talko', great: 'talkg' } },
    talkf: { t: ['言葉は、屋台の湯気と一緒に流れて消えた。三人とも、一歩前に出た。'], battle: { enc: 'ambush3', win: 'won', lose: 'lost' } },
    talko: { t: ['「幇の厨房のものを、幇の許しなく取り立てていいのか」。一人が顔色を変え、確認してくると言って走り去った。残りは二人。'], battle: { enc: 'ambush2', win: 'won', lose: 'lost' } },
    talkg: { fx: S => { S.credits += 60; }, t: ['「幇の厨房のものを、幇の許しなく取り立てていいのか」。一人が顔色を変えて走り去った。去り際に、迷惑料だと言って60crを置いていった。残りは二人。'], battle: { enc: 'ambush2', win: 'won', lose: 'lost' } },
    fight3: { t: ['チャンカーは何も言わなかった。それがいちばん高くつく返事だと、三人とも知っていた。'], battle: { enc: 'ambush3', win: 'won', lose: 'lost' } },
    lost: { t: ['埠頭まで逃げ帰った。メモリは奪われていない。下っ端たちは、門の下でまだ待っている。'], end: true, noDone: true },
    won: { t: [
      '最後の一人が逃げようと背を向けた瞬間、乾いた音がして、門の上の看板が落ちてきた。下っ端はその下敷きになった。',
      '更地の向こう、崩れた牌楼の上に、女がひとり、長い銃を抱えて座っていた。',
      ['女', '……外したわ。本当は、あなたを撃つ依頼だったの'],
      ['女', 'でも依頼主が、さっき別の誰かに撃たれたって連絡が来て。前金も返せって。ついてないのよ、私'],
      '女は牌楼から降りてきた。細い肩に、銃が重そうだった。殺し屋。この街ではキルチョイサーと呼ぶ。',
    ], c: [
      { t: '「ついてないな、お互い」', sub: '', to: 'join', fx: S => rel(S, 'kill', 1) },
      { t: '「撃つ気がないなら、雇われるか」', sub: '', to: 'join' },
    ] },
    join: { fx: S => { join(S, 'kill'); S.flags.m2 = 1; S.wanted++; }, t: [
      ['キルチョイサー', '……雇い主が生きてるうちは、撃たないことにしてるの。長生きしてね'],
      'キルチョイサーが仲間になった。手配度が上がった。',
      'リンは現れなかった。門の向こう、朗々飯店の跡地には、まだ厨房の骨組みが残っているという。',
    ], end: true },
  } },

  m3: { loc: 'chinatown', scene: 'kitchen', main: true, label: '朗々飯店の跡地を調べる', sub: 'メインシナリオ。厨房の骨組みが残っている', cond: S => S.flags.m2, nodes: {
    start: { t: [
      '朗々飯店の跡地。客席は更地になり、厨房だけが、焼け残った鉄の骨組みとして立っていた。',
      '火口が八つ。そのうち一つだけ、煤の付き方が新しい。',
    ], check: { stat: 'obs', lo: 5, hi: 8, fail: 'sf', ok: 'so', great: 'sg' } },
    sf: { t: ['それ以上のことは分からなかった。'], c: [{ t: '奥へ進む', to: 'boss' }] },
    so: { fx: S => { S.credits += 60; }, t: ['火口の下に、誰かが最近まで使っていた隠し棚があった。60crを手に入れた。'], c: [{ t: '奥へ進む', to: 'boss' }] },
    sg: { fx: S => { S.credits += 60; give(S, mkInst('junk', 2, null, true)); S.flags.sawRobot = 1; }, t: [
      '火口の下の隠し棚から、60crと、誰かが調整した特注品の「ジャンクコード v0.9」が出てきた。',
      '棚の奥には、配膳ロボットの腕が一本、布に包んで置いてあった。指先に、蓮華を持つための溝がある。誰かが、捨てずに取っておいたのだ。',
    ], c: [{ t: '奥へ進む', to: 'boss' }] },
    boss: { t: [
      '厨房の奥で、大男が鉄鍋を振っていた。中身は空である。',
      ['用心棒ワン', '厨房は朗々幇が継いだ。レシピは継げなかった。だから取り返す。筋は通っているだろう'],
    ], battle: { enc: 'wan', win: 'won', lose: 'lost' } },
    lost: { t: ['鉄鍋の音を背中に聞きながら、埠頭まで逃げ帰った。ワンは厨房から動かない。'], end: true, noDone: true },
    won: { fx: S => { S.flags.m3 = 1; S.wanted++; }, t: [
      'ワンは鍋を床に置き、その横に座りこんだ。',
      ['用心棒ワン', '……ひとつ教えてやる。企業の連中はもう刺客を雇った。ソムリエと呼ばれている。味の分かる殺し屋だ'],
      ['用心棒ワン', 'あれに狙われて、二皿目を食った奴はいない'],
      '手配度が上がった。',
    ], end: true },
  } },

  m4: { loc: 'pier', main: true, label: 'ねぐらに戻る', sub: 'メインシナリオ。誰かが待っている気配がする', cond: S => S.flags.m3, nodes: {
    start: { t: [
      'ねぐらのコンテナの前に、女が立っていた。仕立てのいい黒い上着。両脇に、警備ドローンが二機。',
      '女はワイングラスを持つような手つきで、拳銃を持っていた。',
      ['サイレント・ソムリエ', '……データを。抵抗の有無は、報告書に書く欄がない'],
    ], battle: { enc: 'som', win: 'won', lose: 'lost' } },
    lost: { t: ['気がつくと、ジャンク山の反対側にいた。なぜ生きているのかは分からない。女は、まだねぐらの前に立っている。'], end: true, noDone: true },
    won: { fx: S => { S.flags.m4 = 1; if (S.flags.somJoin) rel(S, 'som', 1); }, t: [], dyn: S => S.flags.somJoin ? [
      '女は銃を上着の内側に収めた。ドローンは、主人の心変わりを理解できないまま、その場で旋回を続けている。',
      ['サイレント・ソムリエ', '……報告書には、対象を見失ったと書く。嘘ではない。私が、目を逸らしたのだから'],
      ['サイレント・ソムリエ', '一口でいい。いつか、あれをもう一度'],
      'サイレント・ソムリエが仲間になった。',
      'ジローの店から、呼び出しの信号が来ている。',
    ] : [
      '刺客は倒れた。ドローンの残骸が、まだ小さく火花を散らしている。',
      '上着の内ポケットから、古い写真が一枚落ちた。円卓を囲む家族。真ん中に、大皿の炒飯。',
      'チャンカーはそれを、元のポケットに戻した。',
      'ジローの店から、呼び出しの信号が来ている。',
    ], end: true },
  } },

  farmThug: { loc: 'chinatown', repeat: true, label: '朗々幇の縄張りを荒らす', sub: '何度でも戦える。メモリと浸透度の稼ぎ場', cond: FREE, nodes: {
    start: { t: ['裏通りに一歩入ると、刺青の男たちが椅子を蹴って立ち上がった。'], battle: { enc: 'farmThug', win: 'w', lose: 'l' } },
    w: { t: ['裏通りは静かになった。しばらくすれば、また別の顔が椅子に座るだろう。'], end: true },
    l: { t: ['門の外まで走った。追っ手は、縄張りの線で足を止めた。'], end: true },
  } },
}, CH2, SIDE, CH3, REGIONSIDE, CH4, JOIN2, COLLECT, CH5, CH6, ROMEV, ROMEV2, ROMEV3, ROMEV4, ROMEV5, DATE, SUB2, DOGEV, PAIREV, TAAEV, BIGEV);
/* 物語の出来事ごとの推奨レベル */
const EVLV = { m2: 2, m3: 3, m4: 4, m6: 5, m8: 7, m10c: 9, m12: 11, kwarc: 15, hkarc: 15, hmarc: 15, ntarc: 15, ymarc: 15, ksarc: 14, m13: 20, m14: 22, m15: 25, f1: 24, f2: 25, final: 29, arena: 10, hongjoin: 6, pedaljoin: 6, wanjoin: 6, vaultq: 10 };
Object.assign(EVLV, { ghost: 9, negishioh: 11, deepmaster: 17, keirinking: 14, labtongue: 19, kappasumo: 14, tougeking: 17, mochiking: 25, roofpermit: 12, container: 13, req_kill: 10 });
/* 推奨レベルの引き上げ(クリアはLv40前後) */
const RECLV = l => Math.round(l * (1 + 0.38 * Math.min(1, l / 29)));
Object.keys(EVLV).forEach(k => { EVLV[k] = RECLV(EVLV[k]); });
Object.values(LOCS).forEach(l => { if (l.lv) l.lv = RECLV(l.lv); });
/* ボスの強さ(育てたメモリで挑めば勝てる値に、自動対戦で合わせた) */
const TUNE = {"wan": 0.97, "som": 0.68, "tsukimi": 1.25, "arena3": 0.97, "titan_corp": 1.14, "kwboss": 1.7, "hkboss": 1.84, "hmboss": 1.73, "ntboss": 1.47, "ymboss": 1.61, "negishiBoss": 1.5, "keirinBoss": 1.49, "kappaBoss": 1.56, "hakkeiBoss": 1.69, "tougeBoss": 1.69, "labBoss": 1.51, "gastroboss": 1.82, "f2titan": 1.84, "chairboss": 2.3, "mochiBoss": 1.93, "finalboss": 1.83};
['titan_gang', 'titan_union', 'titan_chef'].forEach(k => { TUNE[k] = TUNE.titan_corp; });
Object.entries(TUNE).forEach(([k, v]) => { if (ENC[k]) ENC[k].tune = v; });
Object.entries(EVLV).forEach(([k, v]) => { if (EV[k]) EV[k].lv = v; });
const PRICE = { gel: 40, coolant: 50, emp: 120 };

const API = { LOVEEND, PARTEND, AFTER, POLYEND, memo, chatLine, VARY, pickVary, REL_NEED, ROM_GATE, dexScan, DEX_GOALS, FREE, ROM, rom, bonds, conflicting, takeLover, checkShuraba, migrate, give, CARRY, PARTY_MAX, STAT, CHARS, LOCS, REGIONS, ENC, EV, PRICE, newSave, member, party, join, rel, bestStat, mkChar };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.WD = API;
})(typeof window !== 'undefined' ? window : globalThis);

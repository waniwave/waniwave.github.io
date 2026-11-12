/* プロトコルチャーハン 線画ビジュアル(SVG)。色はCSS変数、線は class で指定 */
(function (root) {
'use strict';
const P = (d, c) => `<path class="ln ${c || ''}" pathLength="1" d="${d}"/>`;
const L = (x1, y1, x2, y2, c) => `<line class="ln ${c || ''}" pathLength="1" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const R = (x, y, w, h, c) => `<rect class="ln ${c || ''}" pathLength="1" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const C = (x, y, r, c) => `<circle class="ln ${c || ''}" pathLength="1" cx="${x}" cy="${y}" r="${r}"/>`;
const T = (x, y, s, c, a) => `<text class="tx ${c || ''}" x="${x}" y="${y}"${a ? ` text-anchor="${a}"` : ''}>${s}</text>`;
const rep = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');

/* 共通の地平線と水面 */
const water = (y, n) => rep(n, i => L(20 + (i * 97) % 760, y + 8 + i * 9, 80 + (i * 97) % 760, y + 8 + i * 9, 'dim'));
const ground = y => L(0, y, 800, y, 'mid');

const SCENE_ALIAS = {};
const SCENES = {
  pier: { coord: '35.462N 139.672E', draw: () =>
    ground(170) + water(170, 5) +
    // コンテナの積層
    R(40, 130, 90, 40) + R(40, 90, 90, 40) + R(130, 110, 90, 60) + R(150, 70, 70, 40, 'acc') + R(220, 140, 70, 30) +
    rep(8, i => L(48 + i * 10, 132, 48 + i * 10, 168, 'dim')) + rep(8, i => L(138 + i * 10, 112, 138 + i * 10, 168, 'dim')) +
    // ガントリークレーン
    P('M470 170 L470 40 L620 40 L620 170 M440 40 L700 40 M470 80 L620 80 M470 40 L520 80 M620 40 L570 80') + L(560, 40, 560, 110, 'acc') + R(545, 110, 30, 18, 'acc') +
    // ジャンク山
    P('M300 170 L330 140 L345 150 L370 115 L390 135 L410 120 L440 170', 'mid') +
    C(720, 60, 16, 'dim') },
  chinatown: { coord: '35.443N 139.646E', draw: () =>
    ground(178) +
    // 牌楼
    P('M300 178 L300 80 M500 178 L500 80 M330 178 L330 100 M470 178 L470 100') +
    P('M260 82 Q280 70 300 72 L500 72 Q520 70 540 82', 'acc') + P('M280 60 Q300 50 320 52 L480 52 Q500 50 520 60', 'acc') + P('M330 40 L400 26 L470 40', 'acc') +
    R(370, 82, 60, 16, 'acc') + L(300, 100, 500, 100) +
    // 提灯
    rep(5, i => L(80 + i * 40, 60, 80 + i * 40, 76, 'dim') + `<ellipse class="ln mag" pathLength="1" cx="${80 + i * 40}" cy="${84}" rx="7" ry="9"/>`) + L(60, 58, 260, 64, 'dim') +
    // 更地と屋台
    P('M560 178 L560 140 L640 140 L640 178 M550 140 L600 118 L650 140', 'mid') + rep(4, i => L(580 + i * 60, 190 - (i % 2) * 4, 610 + i * 60, 190 - (i % 2) * 4, 'dim')) +
    P('M680 178 L700 160 L720 178', 'dim') },
  kitchen: { coord: '35.442N 139.647E', draw: () =>
    ground(180) +
    // 焼け残った鉄の骨組み
    P('M120 180 L120 50 L680 50 L680 180 M120 50 L200 20 L600 20 L680 50 M400 20 L400 50') + rep(6, i => L(200 + i * 80, 50, 200 + i * 80, 180, 'dim')) +
    // 火口が八つ
    R(170, 130, 460, 24, 'mid') + rep(8, i => `<ellipse class="ln ${i === 5 ? 'acc' : 'dim'}" pathLength="1" cx="${200 + i * 57}" cy="142" rx="18" ry="5"/>`) +
    // 鉄鍋
    P('M520 112 Q545 132 570 112', 'acc') + L(570, 112, 600, 104, 'acc') },
  noge: { coord: '35.448N 139.628E', draw: () =>
    // 路地の透視
    P('M0 40 L330 110 L330 190 L0 220 M800 40 L470 110 L470 190 L800 220') + L(330, 110, 470, 110, 'dim') + L(330, 190, 470, 190, 'mid') +
    rep(5, i => L(60 + i * 60, 50 + i * 13, 60 + i * 60, 210 - i * 4, 'dim') + L(740 - i * 60, 50 + i * 13, 740 - i * 60, 210 - i * 4, 'dim')) +
    rep(6, i => `<ellipse class="ln ${i % 2 ? 'mag' : 'acc'}" pathLength="1" cx="${100 + i * 120}" cy="${70 + (i % 3) * 8}" rx="6" ry="8"/>`) + R(360, 130, 80, 30, 'acc') },
  bar: { coord: '35.449N 139.629E', draw: () =>
    // カウンターと酒棚、吊り下げ照明
    L(0, 150, 800, 150) + L(0, 168, 800, 168, 'mid') + rep(6, i => L(60 + i * 130, 168, 60 + i * 130, 210, 'dim')) +
    rep(3, i => L(80, 40 + i * 30, 720, 40 + i * 30, 'dim')) + rep(14, i => R(100 + i * 44 + (i % 3) * 3, 40 + (i % 3) * 30 - 18 - (i % 2) * 6, 10, 18 + (i % 2) * 6, i % 5 === 0 ? 'acc' : 'mid')) +
    rep(3, i => L(200 + i * 200, 0, 200 + i * 200, 100, 'dim') + P(`M${180 + i * 200} 112 L${200 + i * 200} 100 L${220 + i * 200} 112 Z`, 'acc')) +
    P('M560 150 L566 128 L576 128 L582 150', 'mag') + C(420, 140, 7, 'dim') },
  gw: { coord: '35.629N 139.794E', draw: () =>
    // 暖簾、六席のカウンター、寸胴型のロボット、湯気
    L(0, 175, 800, 175, 'mid') + R(170, 30, 360, 60, 'dim') + rep(5, i => R(180 + i * 70, 40, 60, 46, i === 2 ? 'acc' : '')) +
    L(160, 120, 640, 120) + rep(6, i => C(205 + i * 78, 150, 12, 'dim') + L(205 + i * 78, 162, 205 + i * 78, 175, 'dim')) +
    P('M600 120 Q610 100 600 80 M620 120 Q630 96 620 72', 'dim') + P('M330 118 Q360 132 390 118', 'acc') +
    R(660, 100, 54, 75) + P('M660 100 Q687 70 714 100', 'mid') + rep(4, i => L(668 + i * 12, 82 + (i % 2) * 4, 668 + i * 12, 100, 'dim')) + C(687, 130, 5, 'acc') + L(714, 130, 740, 112) },
  tokyo: { coord: '35.630N 139.790E', draw: () =>
    ground(190) + rep(9, i => R(20 + i * 88, 190 - (60 + (i * 37) % 120), 70, 60 + (i * 37) % 120, i % 3 ? 'dim' : 'mid')) +
    R(120, 20, 150, 70, 'mag') + R(470, 10, 190, 90, 'acc') + L(195, 90, 195, 130, 'dim') + L(565, 100, 565, 140, 'dim') +
    P('M300 190 L300 140 L380 120 L460 140 L460 190', 'mid') + T(400, 112, 'GATE 7', 'hud', 'middle') },
  factory: { coord: '35.507N 139.744E', draw: () =>
    ground(185) + rep(4, i => R(80 + i * 170, 70 + (i % 2) * 20, 110, 115 - (i % 2) * 20, i === 1 ? 'mid' : '')) + rep(4, i => R(110 + i * 170, 20 + (i % 2) * 15, 16, 50 - (i % 2) * 15, 'dim')) +
    rep(4, i => P(`M${80 + i * 170} ${70 + (i % 2) * 20} L${108 + i * 170} ${52 + (i % 2) * 20} L${135 + i * 170} ${70 + (i % 2) * 20} L${163 + i * 170} ${52 + (i % 2) * 20} L${190 + i * 170} ${70 + (i % 2) * 20}`)) +
    C(560, 150, 22, 'acc') + rep(6, i => L(560, 150, 560 + 40 * Math.cos(i), 150 + 40 * Math.sin(i), 'acc')) + water(185, 2) },
  onsen: { coord: '35.233N 139.106E', draw: () =>
    P('M0 120 Q160 30 330 110 Q480 40 640 100 Q720 70 800 90', 'mid') + ground(175) +
    P('M120 175 L120 130 L260 130 L260 175 M100 132 L190 100 L280 132', '') + P('M420 175 L420 140 L560 140 L560 175 M400 142 L490 112 L580 142', '') +
    rep(5, i => P(`M${300 + i * 22} 165 Q${290 + i * 22} 140 ${300 + i * 22} 118 Q${310 + i * 22} 96 ${300 + i * 22} 76`, 'dim')) + `<ellipse class="ln acc" pathLength="1" cx="340" cy="178" rx="70" ry="8"/>` + L(660, 60, 690, 20, 'acc') + R(645, 60, 30, 115, 'dim') },
  suburb: { coord: '35.862N 139.971E', draw: () =>
    ground(180) + rep(5, i => P(`M${60 + i * 130} 180 L${60 + i * 130} 130 L${100 + i * 130} 105 L${140 + i * 130} 130 L${140 + i * 130} 180`, i === 2 ? 'mid' : 'dim')) +
    P('M640 180 L640 90 Q680 50 720 90 L720 180', '') + L(680, 60, 700, 30, 'acc') + rep(6, i => C(150 + i * 60, 196, 4, 'mag')) + C(80, 40, 14, 'dim') },
  mall: { coord: '35.876N 139.833E', draw: () =>
    L(0, 30, 800, 30, 'dim') + rep(5, i => L(0, 60 + i * 30, 800, 60 + i * 30, i % 2 ? 'dim' : 'mid')) +
    rep(4, i => P(`M${120 + i * 180} 210 L${200 + i * 180} 60`, 'acc') + P(`M${140 + i * 180} 210 L${220 + i * 180} 60`, 'dim')) +
    rep(8, i => R(30 + i * 96, 38 + (i % 3) * 30, 70, 16, i % 4 === 0 ? 'mag' : 'dim')) + T(400, 22, 'B∞F  SALE  SALE  SALE', 'hud', 'middle') },
  moon: { coord: '0.674N 23.473E', draw: () =>
    P('M0 170 Q200 150 400 165 Q600 180 800 160', '') + C(640, 60, 30, 'mid') + P('M612 60 Q640 45 668 60', 'dim') + `<ellipse class="ln dim" pathLength="1" cx="200" cy="185" rx="60" ry="8"/>` + `<ellipse class="ln dim" pathLength="1" cx="520" cy="190" rx="40" ry="5"/>` +
    R(300, 100, 160, 65, 'acc') + P('M300 100 L380 60 L460 100', 'acc') + L(380, 60, 380, 30, 'acc') },
  mkitchen: { coord: '0.681N 23.460E', draw: () =>
    L(0, 190, 800, 190, 'mid') + rep(9, i => { const x = 60 + i * 85, y = 130 + (i % 2) * 14; return P(`M${x - 30} ${y} Q${x} ${y + 22} ${x + 30} ${y}`, i === 4 ? 'acc' : '') + L(x + 30, y, x + 50, y - 8, 'dim') + L(x, y + 12, x, 190, 'dim'); }) +
    rep(9, i => L(60 + i * 85, 20, 60 + i * 85, 100, 'dim')) + L(0, 20, 800, 20, 'mid') + C(400, 60, 22, 'mid') + P('M378 60 Q400 50 422 60', 'dim') },
  office: { coord: '0.683N 23.455E', draw: () =>
    R(120, 20, 560, 150, 'mid') + C(400, 95, 58, '') + P('M350 80 Q380 60 420 78 Q450 90 440 120', 'dim') + P('M370 120 Q390 130 410 118', 'dim') +
    `<ellipse class="ln acc" pathLength="1" cx="400" cy="195" rx="150" ry="16"/>` + C(400, 190, 10, 'acc') + L(0, 175, 800, 175, 'dim') },
  kannai: { coord: '35.447N 139.637E', draw: () =>
    ground(190) + P('M340 190 L360 10 L440 10 L460 190') + rep(12, i => L(358 + i * 1.6, 25 + i * 14, 442 - i * 1.6, 25 + i * 14, i % 4 ? 'dim' : 'acc')) +
    R(180, 120, 90, 70, 'mid') + R(520, 100, 80, 90, 'mid') + R(620, 140, 60, 50, 'dim') + R(100, 150, 60, 40, 'dim') },
  minato: { coord: '35.455N 139.638E', draw: () =>
    ground(185) + C(250, 100, 72) + C(250, 100, 6, 'acc') + rep(12, i => L(250, 100, 250 + 72 * Math.cos(i * Math.PI / 6), 100 + 72 * Math.sin(i * Math.PI / 6), 'dim')) +
    P('M220 185 L250 100 L280 185') + P('M520 185 L540 20 L580 20 L600 185') + L(540, 20, 580, 20, 'acc') + water(185, 2) },
  honmoku: { coord: '35.422N 139.667E', draw: () =>
    ground(170) + water(170, 5) + P('M200 150 L600 150 L570 175 L230 175 Z') + R(470, 110, 80, 40) + L(510, 110, 510, 70, 'acc') +
    P('M660 170 L660 60 L740 60 M660 90 L720 60', 'mid') + rep(3, i => R(260 + i * 60, 130, 50, 20, 'dim')) },
  yamate: { coord: '35.438N 139.651E', draw: () =>
    P('M0 200 Q300 120 800 150', 'mid') + P('M150 170 L150 120 L190 95 L230 120 L230 162') + P('M300 152 L300 105 L340 80 L380 105 L380 145') + L(340, 80, 340, 55, 'acc') + L(330, 64, 350, 64, 'acc') +
    P('M520 148 L520 110 L565 88 L610 110 L610 150') + rep(3, i => R(165 + i * 120 + (i ? 30 : 0), 130 - i * 8, 14, 18, 'dim')) },
};

/* ---------- 雰囲気の層(全シーン共通): 空の色、遠景のシルエット、灯る窓、ネオン看板、霧 ---------- */
const SKY = { night: ['#2a0f2e', '#0b0916'], teal: ['#0d2a2e', '#0b0916'], deep: ['#06223a', '#020814'], space: ['#05040c', '#05040c'], warm: ['#2e1a0c', '#0b0916'], inside: ['#171028', '#0b0916'] };
const ATM = {
  pier: { sky: 'night', far: 1, sign: ['倉', 690, 40] }, chinatown: { sky: 'warm', far: 1, sign: ['朗々', 640, 60] }, kitchen: { sky: 'warm', sign: ['朗', 80, 50] },
  noge: { sky: 'night', far: 1, sign: ['酒', 90, 55], sign2: ['情報', 700, 70] }, bar: { sky: 'inside', sign: ['鳩', 720, 50] }, gw: { sky: 'night', far: 1, sign: ['麺', 610, 52] },
  tokyo: { sky: 'night', far: 2, sign: ['元祖', 120, 48], sign2: ['本家', 690, 58] }, factory: { sky: 'warm', far: 1, sign: ['鉄', 720, 48] }, onsen: { sky: 'teal', sign: ['湯', 680, 60] },
  suburb: { sky: 'teal', far: 1, sign: ['駅', 120, 60] }, mall: { sky: 'inside', sign: ['SALE', 660, 46] }, moon: { sky: 'space', stars: 1 }, mkitchen: { sky: 'space', stars: 1, sign: ['満', 700, 48] },
  office: { sky: 'space', stars: 1 }, kannai: { sky: 'night', far: 2, sign: ['MANKAN', 610, 34] }, minato: { sky: 'night', far: 1, sign: ['観', 90, 50] }, honmoku: { sky: 'night', far: 1, sign: ['闇', 120, 60] },
  yamate: { sky: 'night', far: 1 }, negishi: { sky: 'night', sign: ['馬券', 110, 52] }, gaien: { sky: 'inside' }, hakkei: { sky: 'deep', bubbles: 1, sign: ['水族館', 640, 40] },
  keirin: { sky: 'warm', far: 1, sign: ['競輪', 640, 44] }, tastelab: { sky: 'inside', sign: ['研', 700, 46] }, tone: { sky: 'teal', stars: 1 }, touge: { sky: 'night', stars: 1 },
  rooftop: { sky: 'night', far: 2, sign: ['屋台', 120, 56] }, usagi: { sky: 'space', stars: 1, sign: ['餅', 690, 52] },
};
const hash = (s, i) => { let h = 2166136261; for (const c of s + i) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };
function atmos(id) {
  const a = ATM[id] || ATM.pier, sk = SKY[a.sky] || SKY.night, g = 'g' + id;
  let s = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sk[0]}"/><stop offset="1" stop-color="${sk[1]}"/></linearGradient></defs><rect x="0" y="0" width="800" height="220" fill="url(#${g})"/>`;
  if (a.stars) s += rep(40, i => `<circle class="star" style="animation-delay:${(hash(id, i) * 4).toFixed(2)}s" cx="${(hash(id, i + 50) * 800).toFixed(0)}" cy="${(hash(id, i + 90) * 120).toFixed(0)}" r="${hash(id, i + 7) < 0.15 ? 1.4 : 0.8}"/>`);
  if (a.far) for (let L = 0; L < a.far; L++) s += rep(16, i => { const w = 30 + hash(id, i + L * 40) * 30, h = 30 + hash(id, i + 20 + L * 40) * (70 + L * 30), x = i * 52 + L * 20 - 10; return `<rect class="far${L}" x="${x.toFixed(0)}" y="${(180 - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}"/>` + rep(Math.floor(h / 16), j => hash(id, i * 7 + j + L) < 0.35 ? `<rect class="win" style="animation-delay:${(hash(id, i + j * 3) * 6).toFixed(2)}s" x="${(x + 6 + (j % 2) * 12).toFixed(0)}" y="${(186 - h + j * 14).toFixed(0)}" width="4" height="3"/>` : ''); });
  if (a.bubbles) s += rep(14, i => `<circle class="bub" style="animation-delay:${(hash(id, i) * 5).toFixed(2)}s;animation-duration:${(4 + hash(id, i + 3) * 4).toFixed(1)}s" cx="${(hash(id, i + 11) * 800).toFixed(0)}" cy="210" r="${(1 + hash(id, i + 5) * 3).toFixed(1)}"/>`);
  [a.sign, a.sign2].filter(Boolean).forEach(([t, x, y], k) => { s += `<g class="neon${k ? ' n2' : ''}"><rect x="${x - 6}" y="${y - 18}" width="${t.length * 17 + 12}" height="26" rx="3"/><text x="${x}" y="${y}">${t}</text></g>`; });
  return s;
}
const rain = id => { const a = ATM[id] || ATM.pier; if (a.stars || !['night', 'teal', 'warm'].includes(a.sky)) return ''; return `<g class="rainl">${rep(18, i => `<line style="animation-delay:${(hash(id, i) * 1.2).toFixed(2)}s" x1="${(hash(id, i + 30) * 820).toFixed(0)}" y1="-20" x2="${(hash(id, i + 30) * 820 - 8).toFixed(0)}" y2="0"/>`)}</g>`; };
const fog = () => `<rect class="fog" x="-200" y="150" width="1200" height="40"/>`;

/* ---------- 寄り道でしか行けない場所 ---------- */
Object.assign(SCENES, {
  negishi: { coord: '35.418N 139.613E', draw: () =>
    ground(178) + P('M0 160 Q400 120 800 160', 'mid') + P('M0 172 Q400 136 800 172', 'dim') +
    // 観覧席と電光掲示板
    P('M560 170 L560 90 L760 70 L760 170') + rep(5, i => L(560, 105 + i * 13, 760, 85 + i * 13 - i * 0, 'dim')) + R(590, 40, 140, 34, 'acc') + T(600, 62, '1着 ネギシオー', 'tx') +
    // 機械馬
    P('M180 150 L210 140 L260 140 L280 125 L295 128 L288 145 L270 150 L265 175 M200 150 L195 176 M215 150 L222 176 M255 152 L250 176', 'mag') + C(290, 132, 2, 'acc') +
    // ゲート
    rep(6, i => R(60 + i * 18, 140, 16, 36, 'dim')) },
  gaien: { coord: '35.440N 139.649E', draw: () =>
    ground(176) + rep(5, i => P(`M${80 + i * 140} 176 L${80 + i * 140} 140 Q${100 + i * 140} 124 ${120 + i * 140} 140 L${120 + i * 140} 176`, i % 2 ? 'dim' : 'mid')) + rep(5, i => L(100 + i * 140, 128, 100 + i * 140, 112, 'dim') + L(92 + i * 140, 118, 108 + i * 140, 118, 'dim')) +
    // 地下の回線
    P('M0 200 L800 200', 'dim') + rep(7, i => P(`M${60 + i * 110} 200 L${60 + i * 110} 176`, 'acc')) + rep(12, i => C(40 + i * 65, 200, 2, i % 3 ? 'dim' : 'mag')) +
    // 電信機
    R(370, 150, 60, 26, 'acc') + C(400, 163, 5, 'mag') },
  hakkei: { coord: '35.338N 139.637E', draw: () =>
    P('M60 200 Q400 -10 740 200', 'acc') + P('M110 200 Q400 30 690 200', 'dim') + rep(7, i => L(140 + i * 87, 200, 400 + (i - 3) * 20, 60, 'dim')) +
    // 魚と巨大な甲殻
    rep(6, i => P(`M${180 + i * 70} ${110 + (i % 3) * 18} l14 -6 l0 12 z M${194 + i * 70} ${110 + (i % 3) * 18} l10 -4 l0 8 z`, i === 2 ? 'mag' : 'mid')) +
    P('M300 190 Q400 140 500 190 M320 186 L300 200 M350 175 L335 200 M450 175 L465 200 M480 186 L500 200', 'mag') + T(560, 192, 'イルカショー 14:00', 'tx') },
  keirin: { coord: '35.533N 139.703E', draw: () =>
    `<ellipse class="ln" pathLength="1" cx="400" cy="150" rx="330" ry="48"/><ellipse class="ln dim" pathLength="1" cx="400" cy="150" rx="270" ry="30"/>` +
    // 自転車の選手
    rep(3, i => C(330 + i * 60, 172, 9, 'mid') + C(352 + i * 60, 172, 9, 'mid') + P(`M${330 + i * 60} 172 L${342 + i * 60} 158 L${352 + i * 60} 172 M${340 + i * 60} 156 L${344 + i * 60} 146`, i === 1 ? 'acc' : 'mag')) +
    R(80, 30, 120, 40, 'acc') + T(92, 56, '打鐘まで 1周', 'tx') + rep(10, i => L(560 + i * 20, 70, 560 + i * 20, 100, 'dim')) },
  tastelab: { coord: '35.546N 139.786E', draw: () =>
    ground(182) + R(40, 40, 720, 142, 'dim') + rep(6, i => L(40 + i * 120, 40, 40 + i * 120, 182, 'dim')) +
    // 水槽と巨大な舌
    R(300, 60, 200, 120, 'acc') + P('M330 170 Q340 90 400 80 Q460 90 470 170', 'mag') + rep(9, i => C(350 + (i % 3) * 25, 110 + Math.floor(i / 3) * 18, 3, 'mag')) +
    rep(4, i => R(80 + i * 50, 120, 30, 50, 'mid')) + T(560, 100, 'TASTE REGEN LAB', 'tx') + T(560, 118, '給餌停止中', 'tx') },
  tone: { coord: '35.874N 140.001E', draw: () =>
    P('M0 150 Q200 140 400 150 T800 150', 'mid') + water(150, 4) + P('M0 132 L800 128', 'dim') +
    // 土手と土俵
    C(560, 172, 26, 'acc') + C(560, 172, 20, 'dim') + P('M548 168 Q556 150 566 152 Q574 160 568 172 M552 148 L572 148', 'mag') +
    // 野球の金網と葦
    P('M100 150 L100 90 L220 90 L220 150', 'dim') + rep(6, i => L(100 + i * 24, 90, 100 + i * 24, 150, 'dim')) + rep(14, i => P(`M${300 + i * 14} 150 q-2 -18 4 -30`, 'mid')) },
  touge: { coord: '35.209N 139.067E', draw: () =>
    P('M0 200 Q150 120 300 150 T520 100 T800 60', 'acc') + P('M0 210 Q150 140 300 168 T520 120 T800 80', 'dim') +
    P('M80 70 L180 30 L280 80 L400 20 L520 70', 'dim') +
    // 白い車とテールランプ
    P('M470 106 L500 96 L540 96 L556 106 Z', 'mid') + C(482, 108, 5, 'mid') + C(544, 108, 5, 'mid') + L(556, 104, 600, 100, 'mag') + L(556, 100, 640, 92, 'mag') +
    rep(4, i => L(120 + i * 140, 174 - i * 26, 130 + i * 140, 178 - i * 26, 'acc')) },
  rooftop: { coord: '35.876N 139.790E', draw: () =>
    ground(180) + rep(12, i => L(30 + i * 66, 180, 60 + i * 66, 200, 'dim')) +
    // 提灯の列と屋台
    P('M40 70 Q400 110 760 70', 'dim') + rep(11, i => C(80 + i * 64, 80 + Math.sin(i / 10 * Math.PI) * 16, 6, i % 3 ? 'acc' : 'mag')) +
    rep(4, i => P(`M${110 + i * 160} 180 L${110 + i * 160} 130 L${200 + i * 160} 130 L${200 + i * 160} 180 M${100 + i * 160} 130 L${155 + i * 160} 112 L${210 + i * 160} 130`, i === 3 ? 'mag' : 'mid')) },
  usagi: { coord: 'FAR SIDE', draw: () =>
    P('M0 170 Q120 150 260 168 T520 160 T800 172', 'mid') + C(160, 172, 30, 'dim') +
    // ドームと臼と杵
    P('M440 170 Q520 70 600 170', 'acc') + P('M492 170 L496 146 L544 146 L548 170 Z', 'mid') + P('M560 120 L520 152 M552 112 L572 128', 'mag') + C(700, 50, 18, 'dim') },
});

/* 都市マップ: 地区の位置と、湾岸線 */
const MAPPOS = { minato: [430, 125], kannai: [380, 225], noge: [255, 200], chinatown: [450, 300], yamate: [420, 395], honmoku: [585, 400], pier: [660, 160] };
const ROADS = [['noge', 'kannai'], ['kannai', 'minato'], ['kannai', 'chinatown'], ['chinatown', 'yamate'], ['yamate', 'honmoku'], ['chinatown', 'honmoku'], ['minato', 'pier']];
const OUTSIDE = [
  { n: 'ネオ・トーキョー', x: 300, y: 22, a: '↑' }, { n: 'カワサキ・ディヴィジョン', x: 120, y: 48, a: '↖' }, { n: 'ハコネ・ディヴィジョン', x: 24, y: 300, a: '←' },
  { n: 'カシワタウン', x: 680, y: 22, a: '↗' }, { n: 'ネオコシガヤ', x: 680, y: 44, a: '↗' }, { n: '月面基地', x: 560, y: 22, a: '☾' }, { n: 'ネオヨコハマ外縁', x: 24, y: 440, a: '↙' },
];
function cityMap(st) {
  const coast = 'M470 0 L478 60 L492 96 L520 160 L540 245 L560 300 L640 330 L700 355 L800 372';
  const land = coast + ' L800 480 L0 480 L0 0 Z';
  let s = `<path class="land" d="${land}"/>` + P(coast, 'coast');
  // 埠頭の突堤
  s += [[600, 315], [655, 336], [710, 357], [765, 366]].map(([x, y]) => R(x, y - 36, 14, 36, 'mid')).join('');
  // 埋立島(コンテナ埠頭)と橋
  s += P('M605 118 L725 108 L735 196 L615 206 Z', 'coast') + L(500, 150, 605, 160, 'mid') + rep(5, i => L(625 + i * 20, 125, 628 + i * 20, 195, 'dim'));
  // 海のグリッドと陸の等高線(ヤマテの丘)
  s += rep(8, i => L(560 + (i % 3) * 70, 70 + i * 10 + (i > 3 ? 150 : 0), 600 + (i % 3) * 70, 70 + i * 10 + (i > 3 ? 150 : 0), 'dim'));
  s += P('M340 430 Q420 350 500 430', 'dim') + P('M365 440 Q420 375 475 440', 'dim');
  // 道
  ROADS.forEach(([a, b]) => { const [x1, y1] = MAPPOS[a], [x2, y2] = MAPPOS[b]; const on = st.open[a] && st.open[b]; s += L(x1, y1, x2, y2, on ? 'road on' : 'road'); });
  // 外の行き先
  s += OUTSIDE.filter(o => (o.n !== '月面基地' || st.moon) && (o.n !== 'ネオヨコハマ外縁' || st.outer)).map(o => T(o.x, o.y, `${o.a} ${o.n}`, 'out')).join('');
  // 地区のノード
  Object.entries(MAPPOS).forEach(([id, [x, y]]) => {
    const open = st.open[id], here = st.here === id, nm = st.names[id];
    const cls = here ? 'node here' : open ? 'node open' : 'node';
    s += `<g class="${cls}"${open ? ` onclick="goLoc('${id}')" role="button" tabindex="0" aria-label="${nm}へ行く"` : ''}>` +
      (open ? `<circle class="halo" cx="${x}" cy="${y}" r="16"/>` : '') +
      `<circle class="dot" cx="${x}" cy="${y}" r="${open ? 7 : 5}"/>` +
      (here ? `<circle class="ring" cx="${x}" cy="${y}" r="13"/>` : '') +
      `<text class="nlabel" x="${x + 14}" y="${y - 10}">${nm}</text>` + (st.lv ? `<text class="nlv${st.danger && st.danger[id] ? ' bad' : ''}" x="${x + 16}" y="${y + 20}">Lv${st.lv[id]}${id === 'kg' ? '〜' : ''}</text>` : '') + (st.guide && st.guide[id] ? `<g class="gmark"><circle cx="${x}" cy="${y}" r="22"/><text x="${x}" y="${y - 26}" text-anchor="middle">★ NEXT${st.guide[id] > 1 ? ' Lv' + st.guide[id] : ''}</text></g>` : '') + `</g>`;
  });
  // HUD
  const w = Math.min(st.wanted, 10);
  s += T(16, 462, 'YOKOHAMA PORTLAND DIVISION', 'hud') + T(784, 462, `WANTED ${'■'.repeat(w)}${'□'.repeat(Math.max(0, 5 - w))}`, 'hud w', 'end');
  return `<svg class="cmap" viewBox="0 0 800 480" role="img" aria-label="ネオヨコハマの都市マップ">${s}<rect class="scan" x="0" y="0" width="800" height="3"/></svg>`;
}
function titleArt() {
  let s = '';
  // 街並み
  s += rep(14, i => { const h = 40 + (i * 53) % 110, x = 10 + i * 57; return R(x, 300 - h, 44, h, i % 4 === 1 ? 'mid' : 'dim') + rep(Math.floor(h / 22), j => L(x + 8, 300 - h + 10 + j * 22, x + 36, 300 - h + 10 + j * 22, 'dim')); });
  s += L(0, 300, 860, 300, 'mid');
  // USBメモリと皿
  s += R(330, 190, 200, 54, 'acc') + R(530, 202, 34, 30, '') + rep(2, i => R(538, 208 + i * 12, 10, 6, 'dim')) + R(346, 200, 120, 34, 'mag') + T(406, 223, '朗々飯店', 'tlabel', 'middle');
  s += `<ellipse class="ln" pathLength="1" cx="430" cy="300" rx="120" ry="16"/>` + P('M318 300 Q430 350 542 300', '') ;
  s += rep(4, i => `<path class="ln dim steam" style="animation-delay:${i * 0.7}s" pathLength="1" d="M${380 + i * 30} 180 Q${370 + i * 30} 160 ${380 + i * 30} 140 Q${390 + i * 30} 120 ${380 + i * 30} 100"/>`);
  s = `<defs><linearGradient id="gtitle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0f2e"/><stop offset="1" stop-color="#0b0916"/></linearGradient></defs><rect width="860" height="340" fill="url(#gtitle)"/>` + rep(22, i => { const h = 60 + hash('t', i) * 160, x = i * 40 - 10; return `<rect class="far0" x="${x}" y="${300 - h}" width="34" height="${h}"/>` + rep(Math.floor(h / 18), j => hash('t', i * 9 + j) < 0.3 ? `<rect class="win" style="animation-delay:${(hash('w', i + j) * 6).toFixed(2)}s" x="${x + 6 + (j % 3) * 9}" y="${306 - h + j * 16}" width="4" height="3"/>` : ''); }) + s;
  s += rep(3, i => `<g class="car" style="animation-delay:${i * 3.1}s;animation-duration:${9 + i * 3}s"><rect x="-60" y="${118 + i * 26}" width="26" height="6" rx="3" class="carb"/><circle cx="-36" cy="${121 + i * 26}" r="2" class="carl"/></g>`);
  s += `<g class="neon"><rect x="40" y="132" width="48" height="26" rx="3"/><text x="46" y="151">朗々</text></g><g class="neon n2"><rect x="760" y="150" width="34" height="26" rx="3"/><text x="766" y="169">麺</text></g>`;
  s += `<text class="ttl tglow" x="430" y="70" text-anchor="middle">プロトコルチャーハン</text><text class="tsub" x="430" y="96" text-anchor="middle">PROTOCOL CHAHAN // CRACKSPEED</text>`;
  return `<svg class="scene titleart" viewBox="0 0 860 340" role="img" aria-label="プロトコルチャーハン">${s}<rect class="scan" x="0" y="0" width="860" height="3"/></svg>`;
}
function scene(id, opt) {
  const sc = SCENES[id] || SCENES.pier;
  opt = opt || {};
  return `<svg class="scene${opt.still ? ' still' : ''}${opt.cls ? ' ' + opt.cls : ''}" viewBox="0 0 800 220" preserveAspectRatio="${opt.slice ? 'xMidYMid slice' : 'xMidYMid meet'}" aria-hidden="true">${atmos(SCENE_ALIAS[id] || id)}${sc.draw()}${fog()}${rain(id)}${opt.hud === false ? '' : T(16, 208, opt.label || '', 'hud') + T(784, 208, sc.coord, 'hud', 'end')}<rect class="scan" x="0" y="0" width="800" height="2"/></svg>`;
}
const API = { scene, cityMap, titleArt, SCENES };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.SC = API;
})(typeof window !== 'undefined' ? window : globalThis);

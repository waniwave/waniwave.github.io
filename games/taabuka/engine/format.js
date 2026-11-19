// 数字の表示（仕様書 第10章「数字の表示」）
// 1万未満はそのまま（1,234）。1万以上は上から2つの単位まで（3兆2500億）。
// 10の72乗以上は「a 無量大数^n」、nが10以上は「a ター^n」（1ター＝無量大数の10乗）。
// 設定で指数表記（1.2e45）にも切り替えられる。

import { Big } from './big.js';

/** 4桁ごとの単位。添字×4が指数 */
export const UNITS = ['', '万', '億', '兆', '京', '垓', '秭', '穣', '溝', '澗', '正', '載', '極', '恒河沙', '阿僧祇', '那由他', '不可思議', '無量大数'];
const MURYO_EXP = 68;              // 無量大数＝10の68乗
const POWER_FROM = 72;             // これ以上は「a 無量大数^n」
const TA_POWER = 10;               // 無量大数^10 で「ター」
const TA_EXP = MURYO_EXP * TA_POWER;
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

function sup(n) {
  if (n === 1) return '';
  return String(n).split('').map((d) => SUP[Number(d)]).join('');
}

function commas(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 1万以上・10の72乗未満を、上から2つの単位で */
function kanji2(m, e) {
  const u = Math.min(Math.floor(e / 4), UNITS.length - 1);
  const x = Number((m * 10 ** (e - 4 * u + 4)).toPrecision(15));
  const top = Math.floor(x / 10000);
  const next = Math.floor(x) % 10000;
  return `${top}${UNITS[u]}${next > 0 ? `${next}${UNITS[u - 1]}` : ''}`;
}

/** 正の値を漢数字の単位で */
function kanji(b) {
  if (b.e < 4) return commas(Math.floor(b.toNumber() + 1e-9));
  if (b.e < POWER_FROM) return kanji2(b.m, b.e);
  const n = Math.floor(b.e / MURYO_EXP);
  if (n < TA_POWER) {
    const a = new Big(b.m, b.e - MURYO_EXP * n);
    return `${kanji(a)} 無量大数${sup(n)}`;
  }
  const t = Math.floor(b.e / TA_EXP);
  const a = new Big(b.m, b.e - TA_EXP * t);
  return `${kanji(a)} ター${sup(t)}`;
}

function expo(b) {
  if (b.e < 4) return commas(Math.floor(b.toNumber() + 1e-9));
  let r = Math.round(b.m * 10) / 10;
  let e = b.e;
  if (r >= 10) { r /= 10; e += 1; }
  return `${r.toFixed(1)}e${e}`;
}

/**
 * 数を表示用の文字列に
 * @param {Big|number|string} x
 * @param {{mode?: 'kanji'|'exp'}} [opts]
 */
export function format(x, opts = {}) {
  const b = Big.from(x);
  if (b.isZero()) return '0';
  const sign = b.isNeg() ? '−' : '';
  const a = b.abs();
  if (a.lt(1)) return '0';
  return sign + (opts.mode === 'exp' ? expo(a) : kanji(a));
}

/**
 * 一番上の単位の名前（桁越えの記録と文字色に使う）。
 * 1万未満は ''、10の72乗以上は '無量大数'＋累乗、さらに上は 'ター'。
 */
export function unitOf(x) {
  const b = Big.from(x).abs();
  if (b.lt(1) || b.e < 4) return '';
  if (b.e < POWER_FROM) return UNITS[Math.min(Math.floor(b.e / 4), UNITS.length - 1)];
  const n = Math.floor(b.e / MURYO_EXP);
  if (n < TA_POWER) return `無量大数${sup(n)}`;
  return 'ター';
}

/** 単位の段（0＝1万未満、1＝万 … 17＝無量大数、18＝無量大数の累乗、19＝ター）。文字色の段に使う */
export function unitLevel(x) {
  const b = Big.from(x).abs();
  if (b.lt(1) || b.e < 4) return 0;
  if (b.e < POWER_FROM) return Math.min(Math.floor(b.e / 4), UNITS.length - 1);
  return Math.floor(b.e / MURYO_EXP) < TA_POWER ? UNITS.length : UNITS.length + 1;
}

/** 倍率など小数を見せたい数（1.5、×1.2）。大きければ format と同じ */
export function formatMul(x) {
  const b = Big.from(x);
  if (b.abs().lt(10000)) {
    const n = Math.round(b.toNumber() * 100) / 100;
    return String(n).replace('-', '−');
  }
  return format(b);
}

// 大きな数：仮数 m（1 ≤ |m| < 10、または 0）と指数 e（整数）で持つ。
// 値＝m × 10^e。e は普通の数なので、10の10000乗を超えても壊れない。
// 値を変える操作は全て新しい Big を返す（元は変えない）。

const DIGITS = 15; // 仮数の有効桁

/** 仮数と指数をそろえる */
function norm(m, e) {
  if (!Number.isFinite(m) || !Number.isFinite(e)) throw new RangeError(`Big: 数ではない値 (${m}, ${e})`);
  if (m === 0) return [0, 0];
  let ex = Math.floor(Math.log10(Math.abs(m)));
  let mm = m / 10 ** ex;
  mm = Number(mm.toPrecision(DIGITS));
  if (Math.abs(mm) >= 10) { mm /= 10; ex += 1; mm = Number(mm.toPrecision(DIGITS)); }
  if (Math.abs(mm) < 1) { mm *= 10; ex -= 1; mm = Number(mm.toPrecision(DIGITS)); }
  return [mm, e + ex];
}

export class Big {
  /** @param {number} m @param {number} e */
  constructor(m = 0, e = 0) {
    const [mm, ee] = norm(m, e);
    this.m = mm;
    this.e = ee;
    Object.freeze(this);
  }

  /** 数・文字列・Big から作る。文字列は "123" "3.25e12" "1e5000" の形 */
  static from(x) {
    if (x instanceof Big) return x;
    if (typeof x === 'number') return new Big(x, 0);
    if (typeof x === 'string') {
      const s = x.trim();
      const mt = /^([+-]?\d+(?:\.\d+)?)(?:e([+-]?\d+))?$/i.exec(s);
      if (!mt) throw new TypeError(`Big: 読めない数「${x}」`);
      return new Big(Number(mt[1]), mt[2] ? Number(mt[2]) : 0);
    }
    if (x && typeof x === 'object' && Array.isArray(x.$big)) return new Big(x.$big[0], x.$big[1]);
    throw new TypeError(`Big: 読めない値 ${x}`);
  }

  /** 10^n */
  static pow10(n) { return new Big(1, n); }

  isZero() { return this.m === 0; }
  isNeg() { return this.m < 0; }
  neg() { return new Big(-this.m, this.e); }
  abs() { return this.m < 0 ? this.neg() : this; }

  add(x) {
    const b = Big.from(x);
    if (b.m === 0) return this;
    if (this.m === 0) return b;
    const [hi, lo] = this.e >= b.e ? [this, b] : [b, this];
    const d = hi.e - lo.e;
    if (d > DIGITS + 2) return hi;
    return new Big(hi.m + lo.m / 10 ** d, hi.e);
  }

  sub(x) { return this.add(Big.from(x).neg()); }

  mul(x) {
    const b = Big.from(x);
    if (b.m === 0 || this.m === 0) return ZERO;
    return new Big(this.m * b.m, this.e + b.e);
  }

  div(x) {
    const b = Big.from(x);
    if (b.m === 0) throw new RangeError('Big: 0で割った');
    if (this.m === 0) return ZERO;
    return new Big(this.m / b.m, this.e - b.e);
  }

  /** 比べる：小さければ -1、同じなら 0、大きければ 1 */
  cmp(x) {
    const b = Big.from(x);
    const sa = Math.sign(this.m), sb = Math.sign(b.m);
    if (sa !== sb) return sa < sb ? -1 : 1;
    if (sa === 0) return 0;
    if (this.e !== b.e) return (this.e < b.e ? -1 : 1) * sa;
    if (this.m === b.m) return 0;
    return this.m < b.m ? -1 : 1;
  }
  lt(x) { return this.cmp(x) < 0; }
  lte(x) { return this.cmp(x) <= 0; }
  gt(x) { return this.cmp(x) > 0; }
  gte(x) { return this.cmp(x) >= 0; }
  eq(x) { return this.cmp(x) === 0; }
  static max(a, b) { return Big.from(a).gte(b) ? Big.from(a) : Big.from(b); }
  static min(a, b) { return Big.from(a).lte(b) ? Big.from(a) : Big.from(b); }

  /** 常用対数。0 は -Infinity。負の数は絶対値の対数 */
  log10() { return this.m === 0 ? -Infinity : this.e + Math.log10(Math.abs(this.m)); }

  /** 小数を切り捨てる（指数が大きければもともと整数） */
  floor() {
    if (this.e >= DIGITS) return this;
    return new Big(Math.floor(this.toNumber()), 0);
  }
  round() {
    if (this.e >= DIGITS) return this;
    return new Big(Math.round(this.toNumber()), 0);
  }

  /** 普通の数へ（大きすぎれば Infinity） */
  toNumber() {
    if (this.e > 308) return Math.sign(this.m) * Infinity;
    return Number((this.m * 10 ** this.e).toPrecision(DIGITS));
  }

  toString() {
    if (this.m === 0) return '0';
    if (this.e >= -6 && this.e < 21) return String(Number(this.toNumber().toPrecision(DIGITS)));
    return `${this.m}e${this.e}`;
  }

  /** 保存用。Big.revive で戻す */
  toJSON() { return { $big: [this.m, this.e] }; }

  /** JSON.parse の reviver */
  static revive(key, value) {
    if (value && typeof value === 'object' && Array.isArray(value.$big) && value.$big.length === 2) {
      return new Big(value.$big[0], value.$big[1]);
    }
    return value;
  }
}

export const ZERO = new Big(0, 0);
export const ONE = new Big(1, 0);

/** 短く書くための関数 */
export const big = (x) => Big.from(x);

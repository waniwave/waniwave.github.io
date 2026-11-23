// util.js — シード付き乱数、BigNum、数値の表示、小物（DOM に触れない）

// ---- シード付き乱数（mulberry32） ----
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}

export function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: n => Math.floor(next() * n),
    chance: p => next() < p,
    pick: a => (a.length ? a[Math.floor(next() * a.length)] : undefined),
    pickWeighted(items, w = x => x.weight ?? 1) {
      const total = items.reduce((t, x) => t + w(x), 0);
      let v = next() * total;
      for (const x of items) { v -= w(x); if (v < 0) return x; }
      return items[items.length - 1];
    },
    shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
    get state() { return s; },
    set state(v) { s = v >>> 0; },
  };
}

// ---- BigNum（仮数 m と指数 e。|m| は 1 以上 10 未満、0 のときは m=0,e=0） ----
export class BigNum {
  constructor(m = 0, e = 0) {
    if (!m || !Number.isFinite(m)) { this.m = 0; this.e = 0; return; }
    const k = Math.floor(Math.log10(Math.abs(m)));
    m /= 10 ** k; e += k;
    if (Math.abs(m) >= 10) { m /= 10; e += 1; }
    if (Math.abs(m) < 1) { m *= 10; e -= 1; }
    this.m = m; this.e = e;
  }
  static from(x) {
    if (x instanceof BigNum) return x;
    if (x && typeof x === 'object') return new BigNum(x.m, x.e);
    return new BigNum(Number(x) || 0, 0);
  }
  isZero() { return this.m === 0; }
  neg() { return new BigNum(-this.m, this.e); }
  add(b) {
    b = BigNum.from(b);
    if (this.m === 0) return b;
    if (b.m === 0) return this;
    const d = this.e - b.e;
    if (d > 16) return this;
    if (d < -16) return b;
    return d >= 0 ? new BigNum(this.m + b.m * 10 ** -d, this.e) : new BigNum(this.m * 10 ** d + b.m, b.e);
  }
  sub(b) { return this.add(BigNum.from(b).neg()); }
  mul(b) { b = BigNum.from(b); return new BigNum(this.m * b.m, this.e + b.e); }
  div(b) { b = BigNum.from(b); return b.m === 0 ? new BigNum(0) : new BigNum(this.m / b.m, this.e - b.e); }
  cmp(b) {
    b = BigNum.from(b);
    const sa = Math.sign(this.m), sb = Math.sign(b.m);
    if (sa !== sb) return sa > sb ? 1 : -1;
    if (sa === 0) return 0;
    if (this.e !== b.e) return (this.e > b.e ? 1 : -1) * sa;
    return this.m === b.m ? 0 : (this.m > b.m ? 1 : -1);
  }
  gt(b) { return this.cmp(b) > 0; }
  gte(b) { return this.cmp(b) >= 0; }
  lt(b) { return this.cmp(b) < 0; }
  lte(b) { return this.cmp(b) <= 0; }
  eq(b) { return this.cmp(b) === 0; }
  // 10 の x 乗（x は小数可）
  static pow10(x) { const e = Math.floor(x); return new BigNum(10 ** (x - e), e); }
  // 正の数の n 乗
  pow(n) { return this.m <= 0 ? new BigNum(this.m === 0 ? 0 : NaN) : BigNum.pow10(n * (Math.log10(this.m) + this.e)); }
  toNumber() { return this.m * 10 ** this.e; }
  toJSON() { return { m: this.m, e: this.e }; }
  toString() { return fmt(this); }
  static max(a, b) { return BigNum.from(a).gte(b) ? BigNum.from(a) : BigNum.from(b); }
  static min(a, b) { return BigNum.from(a).lte(b) ? BigNum.from(a) : BigNum.from(b); }
}

// 999,999 までは3桁カンマ、それ以上は 1.42e7、指数が 1000 以上は e1.2e3
export function fmt(x) {
  const b = BigNum.from(x);
  if (b.m === 0) return '0';
  const sign = b.m < 0 ? '-' : '';
  let m = Math.abs(b.m), e = b.e;
  if (e < 6) {
    const v = Math.floor(m * 10 ** e + 1e-9);
    if (v < 1000000) return sign + v.toLocaleString('en-US');
  }
  if (e < 1000) {
    let mm = Number(m.toFixed(2));
    if (mm >= 10) { mm = 1; e += 1; }
    if (e < 1000) return `${sign}${mm.toFixed(2)}e${e}`;
  }
  const k = Math.floor(Math.log10(e));
  return `${sign}e${(Math.floor(e / 10 ** (k - 1)) / 10).toFixed(1)}e${k}`;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

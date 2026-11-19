// 乱数。潜行シードから「用途名＋番号」ごとに子乱数を作り、
// どの経路を選んでも他の用途の結果がずれないようにする（仕様書 第4章）。
// 状態は4つの32bit整数。getState() で保存し、Rng.fromState() で戻す。

/** 文字列から128bitのハッシュ（4つの32bit整数） */
export function hash128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export class Rng {
  /** @param {number[]} state 4つの32bit整数 */
  constructor(state) {
    if (!Array.isArray(state) || state.length !== 4) throw new TypeError('Rng: 状態は4つの整数');
    this.s = state.map((v) => v >>> 0);
    if (this.s.every((v) => v === 0)) this.s[0] = 1;
    this.calls = 0; // 何回引いたか（予測で「乱数を使ったか」を見るため。保存はしない）
  }

  /** 文字列や数のシードから作る */
  static fromSeed(seed) {
    const r = new Rng(hash128(String(seed)));
    for (let i = 0; i < 12; i++) r.nextU32(); // 立ち上がりを捨てる
    return r;
  }

  /** 保存した状態から戻す */
  static fromState(state) { return new Rng(state); }

  /**
   * 子乱数：潜行シード＋用途名＋番号（階・部屋など）
   * @param {string|number} seed @param {string} purpose @param {...(string|number)} nums
   */
  static child(seed, purpose, ...nums) {
    return Rng.fromSeed([seed, purpose, ...nums].join('|'));
  }

  getState() { return this.s.slice(); }
  clone() { return new Rng(this.getState()); }

  /** sfc32 */
  nextU32() {
    this.calls += 1;
    let [a, b, c, d] = this.s;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.s = [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
    return t >>> 0;
  }

  /** 0以上1未満 */
  next() { return this.nextU32() / 4294967296; }

  /** min以上max以下の整数 */
  int(min, max) {
    if (max < min) throw new RangeError('Rng.int: max < min');
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** 確率pで true */
  chance(p) { return this.next() < p; }

  pick(arr) {
    if (!arr.length) return undefined;
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** 重み付きで選ぶ。weights は {名前: 重み} または [[名前, 重み], ...] */
  weighted(weights) {
    const list = Array.isArray(weights) ? weights : Object.entries(weights);
    const total = list.reduce((s, [, w]) => s + Math.max(0, w), 0);
    if (total <= 0) return undefined;
    let x = this.next() * total;
    for (const [k, w] of list) {
      if (w <= 0) continue;
      x -= w;
      if (x < 0) return k;
    }
    return list[list.length - 1][0];
  }

  /** 新しい配列で返す（Fisher–Yates） */
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

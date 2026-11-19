// 共有コード（仕様書 第6章「共有コード」）：版・シード・宿泊客・深度・到達階・最大論破値・最後の席の常連客を短い英数字に。
// 形：TB1-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX（Crockford の32文字。読み違えやすい I L O U は使わない）。
// シードは36進の英数字（11文字まで）である必要がある（潜行のシードは全てこの形で作る）。

const ABC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const VERSION = 1;
// 各欄のビット数（合計120ビット＝24文字）
const FIELDS = [['seed', 60], ['guest', 5], ['depth', 5], ['deepest', 14], ['maxV', 14], ['seat', 10], ['check', 12]];

const bigOf = (s) => [...String(s).toLowerCase()].reduce((n, ch) => n * 36n + BigInt(parseInt(ch, 36)), 0n);
const strOf = (n) => (n === 0n ? '0' : (() => { let s = ''; while (n > 0n) { s = (n % 36n).toString(36) + s; n /= 36n; } return s; })());

/** シードが共有コードに入る形か（36進の英数字・11文字まで・先頭が0でない） */
export function shareableSeed(seed) { return /^[1-9a-z][0-9a-z]{0,10}$/.test(String(seed)); }

function checksum(n) {
  // 108ビットの中身から12ビットの検算（FNV風）
  let h = 0x811c9dc5;
  for (let i = 0; i < 14; i++) { h ^= Number((n >> BigInt(i * 8)) & 0xffn); h = Math.imul(h, 0x01000193) >>> 0; }
  return BigInt((h ^ (h >>> 12) ^ (h >>> 24)) & 0xfff);
}

/**
 * 作る
 * @param {object} content @param {{seed:string, guest:string, depth:number, deepest:number, maxVlog:number, seat?:string|null}} r
 */
export function encodeShare(content, r) {
  if (!shareableSeed(r.seed)) throw new Error(`共有コードに入らないシード「${r.seed}」`);
  const guests = Object.keys(content.guests).sort();
  const regs = Object.keys(content.regulars).sort();
  const vals = {
    seed: bigOf(r.seed), guest: BigInt(Math.max(0, guests.indexOf(r.guest))), depth: BigInt(Math.min(31, r.depth || 0)),
    deepest: BigInt(Math.min(16383, r.deepest || 0)), maxV: BigInt(Math.min(16383, Math.max(0, Math.round((r.maxVlog || 0) * 10)))),
    seat: BigInt(r.seat && regs.includes(r.seat) ? regs.indexOf(r.seat) + 1 : 0), check: 0n,
  };
  let n = 0n;
  for (const [k, bits] of FIELDS.slice(0, -1)) n = (n << BigInt(bits)) | (vals[k] & ((1n << BigInt(bits)) - 1n));
  n = (n << 12n) | checksum(n);
  let s = '';
  for (let i = 0; i < 24; i++) { s = ABC[Number(n & 31n)] + s; n >>= 5n; }
  return `TB${VERSION}-${s.match(/.{4}/g).join('-')}`;
}

/** 読む。読めなければ null */
export function decodeShare(content, code) {
  const m = /^TB(\d)-?([0-9A-Z-]+)$/.exec(String(code).trim().toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0'));
  if (!m || Number(m[1]) !== VERSION) return null;
  const body = m[2].replace(/-/g, '');
  if (body.length !== 24) return null;
  let n = 0n;
  for (const ch of body) { const v = ABC.indexOf(ch); if (v < 0) return null; n = (n << 5n) | BigInt(v); }
  const check = n & 0xfffn;
  const payload = n >> 12n;
  if (checksum(payload) !== check) return null;
  const out = {};
  let rest = payload;
  for (const [k, bits] of FIELDS.slice(0, -1).reverse()) { out[k] = rest & ((1n << BigInt(bits)) - 1n); rest >>= BigInt(bits); }
  const guests = Object.keys(content.guests).sort();
  const regs = Object.keys(content.regulars).sort();
  const guest = guests[Number(out.guest)];
  if (!guest) return null;
  return {
    v: VERSION, seed: strOf(out.seed), guest, depth: Number(out.depth), deepest: Number(out.deepest), maxVlog: Number(out.maxV) / 10,
    seat: Number(out.seat) ? regs[Number(out.seat) - 1] ?? null : null,
  };
}

/** 日替わり潜行のシード（日付 YYYY-MM-DD から。日付は画面側が日本時間で渡す） */
export function dailySeed(date) {
  const d = Number(String(date).replace(/-/g, ''));
  if (!Number.isFinite(d) || d < 20000101) throw new Error(`日付「${date}」が読めない`);
  return ((d * 7919 + 104729) % 3656158440062975).toString(36);
}

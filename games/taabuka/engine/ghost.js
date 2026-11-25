// ゴースト宿（非同期の対戦）。サーバーは使わない。
// 自分の宿のデッキを「ゴーストのコード」に書き出し、友だちが読み込むと、そのデッキが論客になって立ちはだかる。
// ゴーストの主張＝そのデッキが決まったターン数で出せた論破値の合計（同じコードなら誰が読んでも同じ。シードで決まる）。
// ゴーストの攻めは、こちらの体力をターン数でちょうど削り切る強さ。つまり「決まったターン数のうちに、相手のデッキより多く論破できるか」の勝負。
import { createBattle, openBattle, startBattle, play, endTurn, predict } from './battle.js';
import { Big } from './big.js';

const VER = 'TG1';

// ───────── 文字列 ⇔ バイト（UTF-8）と base64url（engine は window に触れないので自前で） ─────────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? B64[n & 63] : '');
  }
  return s;
}
function fromB64(s) {
  const out = [];
  for (let i = 0; i < s.length; i += 4) {
    const v = [0, 1, 2, 3].map((k) => (i + k < s.length ? B64.indexOf(s[i + k]) : 0));
    if (v.some((x) => x < 0)) return null;
    const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
    out.push((n >> 16) & 255);
    if (i + 2 < s.length) out.push((n >> 8) & 255);
    if (i + 3 < s.length) out.push(n & 255);
  }
  return new Uint8Array(out);
}
/** 短い検査の数（打ち間違いを見つける） */
function sum4(s) { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 1679616; return h.toString(36).padStart(4, '0'); }

/**
 * ゴーストのコードを作る
 * @param {{name:string, guest:string, deck:object[], rank?:string, deepest?:number}} g deck は蔵の札（id・rar・enh・ed・seal）
 */
export function encodeGhost(base, g) {
  const C = base.content;
  const ids = Object.keys(C.cards).sort();
  const rars = base.balance.rarity.order;
  const enh = Object.keys(base.balance.hands.enhancements);
  const eds = Object.keys(base.balance.hands.editions);
  const deck = g.deck.filter((x) => C.cards[x.id]).slice(0, 40).map((x) => {
    const a = [ids.indexOf(x.id), Math.max(0, rars.indexOf(x.rar ?? '')), x.enh ? enh.indexOf(x.enh) + 1 : 0, x.ed ? eds.indexOf(x.ed) + 1 : 0];
    return a.map((n) => n.toString(36)).join('.');
  });
  const body = JSON.stringify({ n: String(g.name || '名無しの宿').slice(0, 12), g: g.guest, r: g.rank ?? '', d: g.deepest ?? 0, c: deck.join(',') });
  const b = toB64(new TextEncoder().encode(body));
  return `${VER}-${b}-${sum4(b)}`;
}

/** ゴーストのコードを読む（読めなければ null） */
export function decodeGhost(base, code) {
  const C = base.content;
  const m = String(code || '').trim().replace(/\s+/g, '').match(/^TG1-([A-Za-z0-9_-]+)-([0-9a-z]{4})$/);
  if (!m || sum4(m[1]) !== m[2]) return null;
  const bytes = fromB64(m[1]);
  if (!bytes) return null;
  let o;
  try { o = JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
  const ids = Object.keys(C.cards).sort();
  const rars = base.balance.rarity.order;
  const enh = Object.keys(base.balance.hands.enhancements);
  const eds = Object.keys(base.balance.hands.editions);
  const deck = String(o.c || '').split(',').filter(Boolean).map((t, i) => {
    const [a, r, e, d] = t.split('.').map((x) => parseInt(x, 36));
    const id = ids[a];
    if (!id) return null;
    return { uid: `gh${i}`, id, origin: 'orig', ...(rars[r] ? { rar: rars[r] } : {}), ...(e ? { enh: enh[e - 1] } : {}), ...(d ? { ed: eds[d - 1] } : {}) };
  }).filter(Boolean);
  if (deck.length < 5 || !C.guests[o.g]) return null;
  return { name: String(o.n ?? '名無しの宿'), guest: o.g, rank: o.r ?? '', deepest: o.d ?? 0, deck, key: sum4(m[1] + m[2]) };
}

/** ゴーストの出し：手札から一番大きな論破値の組（全ての組を試す） */
function bestPlay(B, env) {
  const n = B.hand.length;
  const max = Math.min(B.maxPlay ?? env.balance.hands.play.maxPlayCards, n);
  let best = null;
  for (let m = 1; m < (1 << n); m++) {
    const s = [];
    for (let i = 0; i < n; i++) if (m & (1 << i)) s.push(i);
    if (s.length > max || s.length < env.balance.hands.play.minCards) continue;
    let p;
    try { p = predict(B, env, s, 0); } catch { continue; }
    if (!best || p.V.gt(best.V)) best = { s, V: p.V };
  }
  return best;
}

/**
 * ゴーストの主張：決まったターン数でデッキが出せた論破値の合計（同じゴーストなら毎回同じ）
 * @returns {{total: Big, perTurn: Big[]}}
 */
export function ghostPower(base, ghost) {
  const G = base.balance.economy.ghost;
  const B = createBattle(base, { seed: `ghost:${ghost.key}`, floor: 1, deck: ghost.deck, enemies: [base.balance.economy.ghost.enemy], guest: ghost.guest });
  B.enemies[0].claim = B.enemies[0].maxClaim = Big.pow10(300);
  B.enemies[0].atk = 0;
  const env = openBattle(base, B);
  startBattle(B, env);
  const perTurn = [];
  for (let t = 0; t < G.turns && !B.result; t++) {
    let sum = Big.from(0);
    let guard = 0;
    while (B.playsLeft > 0 && B.hand.length && guard++ < 10) {
      const c = bestPlay(B, env);
      if (!c) break;
      const n0 = B.log.length;
      try { play(B, env, c.s, 0); } catch (e) { if (globalThis.process?.env?.GHOSTDEBUG) console.error(e.message); break; }
      const e = B.log.slice(n0).find((l) => l.t === 'play');
      if (e?.V) sum = sum.add(e.V);
    }
    perTurn.push(sum);
    B.hp = B.maxHp; // ゴースト側は倒れない
    endTurn(B, env);
  }
  const total = perTurn.reduce((a, v) => a.add(v), Big.from(0));
  return { total: total.mul(G.claimMul).round(), perTurn };
}

/**
 * ゴーストとの戦闘を作る（自分の宿のデッキで挑む）
 * @param {object[]} deck 自分のデッキ（蔵の札） @param {string} guest 自分の宿泊客
 */
export function ghostBattle(base, ghost, deck, guest, power) {
  const G = base.balance.economy.ghost;
  const B = createBattle(base, { seed: `ghostfight:${ghost.key}`, floor: 1, deck, enemies: [base.balance.economy.ghost.enemy], guest });
  if (B.hp == null) { B.hp = 70; B.maxHp = 70; }
  const e = B.enemies[0];
  e.name = `${ghost.name}の宿`;
  e.claim = e.maxClaim = Big.max(power.total, 1);
  e.atk = Math.ceil(B.maxHp / G.turns);
  B.ghost = { key: ghost.key, name: ghost.name, turns: G.turns };
  B.turnLimit = G.turns;
  return B;
}

/** ゴーストとの勝負の決着を宿に記録。初めて勝ったゴーストなら宿銭 */
export function finishGhost(base, H, ghost, B) {
  const G = base.balance.economy.ghost;
  H.ghosts ||= {};
  const rec = H.ghosts[ghost.key] ||= { name: ghost.name, wins: 0, tries: 0 };
  rec.tries += 1;
  const won = B.result === 'win';
  let zeni = 0;
  if (won) {
    if (!rec.wins) { zeni = G.firstWinZeni; H.zeni += zeni; }
    rec.wins += 1;
  }
  return { won, zeni, rec };
}

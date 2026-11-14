/* ター宿のほとり — CPU
 * 手札の各カードを「取った場合」と「捨ててティアを動かした場合」に分けて、
 * 状態を複製して実際に効果を走らせ、点数の差で評価する。
 */
(function (G) {
'use strict';
const TJ = G.TJ;
const clone = st => JSON.parse(JSON.stringify(Object.assign({}, st, { log: [], ev: [] })));

function util(s, p) {
  const sc = TJ.allScores(s);
  const my = sc[p]; const o = sc.filter((_, i) => i !== p);
  const best = Math.max(...o); const avg = o.reduce((a, b) => a + b, 0) / 3;
  // 順位点を取りにいく：トップとの差を重く見る
  return my - 0.6 * best - 0.4 * avg;
}
function future(s, p, c) {
  const d = TJ.def(c); let v = 0;
  if (d.ai) { try { v += d.ai(TJ.api(s), p, c) * 0.8; } catch (e) { /* noop */ } }
  // まだ回ってくるカードとの相性（セット固有のカテゴリが同じものの数）
  const left = (TJ.TURNS - s.turn) / TJ.TURNS;
  const own = TJ.catsOf(c).filter(k => TJ.CATS[k] && !TJ.CATS[k].common);
  if (own.length && left > 0) {
    let n = 0;
    s.players.forEach(P => P.hand.forEach(x => { if (x.u !== c.u && TJ.catsOf(x).some(k => own.includes(k))) n++; }));
    v += Math.min(4, n) * 0.6 * left;
  }
  return v;
}
function doTake(s, p, u) {
  const P = s.players[p]; const i = P.hand.findIndex(x => x.u === u); if (i < 0) return null;
  const c = P.hand.splice(i, 1)[0]; c.o = p; c.t = s.turn; P.table.push(c);
  const d = TJ.def(c);
  if (d.onPick) { try { d.onPick(TJ.api(s), p, c); } catch (e) { /* noop */ } }
  delete s._later;
  return c;
}
function doTier(s, p, cat, d) {
  const dd = TJ.hook(s, 'tierPower', d, p, cat);
  TJ.moveTier(s, cat, dd, { vote: true, by: p });
}
function doCut(s, p, u) {
  const P = s.players[p]; const i = P.hand.findIndex(x => x.u === u); if (i < 0) return;
  const c = P.hand.splice(i, 1)[0]; c.o = p;
  const entry = { c, p, how: 'cut' }; s.discard.push(entry);
  const d = TJ.def(c); if (d.onCut) { try { d.onCut(TJ.api(s), p, c, entry); } catch (e) { /* noop */ } }
}
// 次に手札を受け取る人にとって、そのカードがどれくらい欲しいか（ざっくり）
function denial(s, p, c) {
  const q = (p + s.dir + 4) % 4; const d = TJ.def(c);
  let v = (d.base || 0) * 0.5;
  const cats = TJ.catsOf(c);
  s.players[q].table.forEach(x => { if (TJ.catsOf(x).some(k => cats.includes(k))) v += 1; });
  return Math.min(6, v);
}

TJ.ai = {
  choose(st, p, lv) {
    lv = lv || 2;
    const noise = lv <= 1 ? 5 : lv === 2 ? 1.2 : 0.2;
    const N = () => (Math.random() - 0.5) * 2 * noise;
    const P = st.players[p];
    const hand = P.hand;
    if (!hand.length) return null;
    const base = util(st, p);
    // 取る
    const takes = hand.map(c => {
      const s = clone(st); const cc = doTake(s, p, c.u);
      return { a: { type: 'take', u: c.u }, v: util(s, p) - base + future(s, p, cc || c) + N(), s };
    }).sort((a, b) => b.v - a.v);
    let best = takes[0];
    const bonus = TJ.hasBonus(st, p);
    const canTier = TJ.canTier(st, p);
    if (canTier && lv >= 1) {
      // ティアだけ動かした場合の差分
      const cats = TJ.tierCats(st);
      const moves = [];
      cats.forEach(cat => [2, -2, 1, -1].forEach(d => {
        const s = clone(bonus ? best.s : st); doTier(s, p, cat, d);
        moves.push({ cat, d, v: util(s, p) - (bonus ? util(best.s, p) : base) });
      }));
      moves.sort((a, b) => b.v - a.v);
      if (bonus) {
        const m = moves[0];
        if (m && m.v > 0.5) best = { a: { type: 'take', u: best.a.u, tier: { cat: m.cat, d: m.d } }, v: best.v + m.v };
      } else {
        // 捨てるカードは、相手に渡したくないものや【捨てられたとき】が得なもの
        const top = moves.slice(0, 3);
        let tb = null;
        hand.forEach(c => top.forEach(m => {
          const s = clone(st); doTier(s, p, m.cat, m.d); doCut(s, p, c.u);
          const v = util(s, p) - base + denial(st, p, c) * 0.5 + N();
          if (!tb || v > tb.v) tb = { a: { type: 'tier', u: c.u, cat: m.cat, d: m.d }, v };
        }));
        if (tb && tb.v > best.v) best = tb;
      }
    }
    return best.a;
  },
  random(st, p) {
    const hand = st.players[p].hand; const c = hand[Math.floor(Math.random() * hand.length)];
    if (TJ.canTier(st, p) && Math.random() < 0.3) {
      const cats = TJ.tierCats(st); const cat = cats[Math.floor(Math.random() * cats.length)];
      return { type: 'tier', u: c.u, cat, d: [2, -2, 1, -1][Math.floor(Math.random() * 4)] };
    }
    return { type: 'take', u: c.u };
  },
  // 画面のプレビュー用：ティア操作をしたら各自の点がどう変わるか
  previewTier(st, cat, d, p) {
    const before = TJ.allScores(st);
    const s = clone(st); doTier(s, p, cat, d);
    const after = TJ.allScores(s);
    return after.map((v, i) => v - before[i]);
  },
  explainTake(st, p, u) {
    const s = clone(st); doTake(s, p, u);
    const e = TJ.explain(s, p, u);
    if (e) e.st = s;
    return e;
  },
  previewTake(st, p, u) {
    const before = TJ.allScores(st);
    const s = clone(st); const c = doTake(s, p, u);
    const d = TJ.allScores(s).map((v, i) => v - before[i]);
    // そのカード自身が何点になるか（すぐ死ぬカードなどは場にいないので0）
    const on = c && s.players[p].table.find(x => x.u === u);
    d.self = on ? TJ.cardScore(s, p, on).total : 0;
    return d;
  }
};
if (typeof module !== 'undefined') module.exports = TJ.ai;
})(typeof window !== 'undefined' ? window : globalThis);

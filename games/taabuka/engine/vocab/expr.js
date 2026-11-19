// 式の評価（"熟成*3" "1+育ち" など）。eval は使わない。
// 使えるのは 数・名前・＋−×÷（+ - * / ＋ − × ÷）・括弧 だけ。名前は語彙の「式の名前」で値を引く。

const OPS = { '+': '+', '＋': '+', '-': '-', '−': '-', '*': '*', '×': '*', '/': '/', '÷': '/', '(': '(', ')': ')', '（': '(', '）': ')' };

function tokenize(src) {
  const out = [];
  const s = String(src);
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (OPS[ch]) { out.push({ t: 'op', v: OPS[ch] }); i++; continue; }
    if (/[0-9.０-９．]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.０-９．]/.test(s[j])) j++;
      const raw = s.slice(i, j).replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`式「${src}」の数「${raw}」が読めない`);
      out.push({ t: 'num', v: n });
      i = j; continue;
    }
    let j = i;
    while (j < s.length && !OPS[s[j]] && !/\s/.test(s[j])) j++;
    out.push({ t: 'name', v: s.slice(i, j) });
    i = j;
  }
  return out;
}

/** 式を読んで木にする。読めなければ投げる */
export function parseExpr(src) {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const take = () => toks[p++];
  const expect = (v) => { const t = take(); if (!t || t.v !== v) throw new Error(`式「${src}」で「${v}」が足りない`); };
  function primary() {
    const t = take();
    if (!t) throw new Error(`式「${src}」が途中で終わっている`);
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'name') return { k: 'name', v: t.v };
    if (t.v === '(') { const e = sum(); expect(')'); return e; }
    if (t.v === '-') return { k: 'neg', e: primary() };
    if (t.v === '+') return primary();
    throw new Error(`式「${src}」の「${t.v}」が読めない`);
  }
  function prod() {
    let e = primary();
    while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) {
      const op = take().v; e = { k: op, a: e, b: primary() };
    }
    return e;
  }
  function sum() {
    let e = prod();
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = take().v; e = { k: op, a: e, b: prod() };
    }
    return e;
  }
  const tree = sum();
  if (p < toks.length) throw new Error(`式「${src}」の「${toks[p].v}」から先が読めない`);
  return tree;
}

/** 式に出てくる名前 */
export function exprNames(tree, out = new Set()) {
  if (!tree) return out;
  if (tree.k === 'name') out.add(tree.v);
  for (const c of [tree.a, tree.b, tree.e]) if (c) exprNames(c, out);
  return out;
}

/**
 * 式を計算する。数ならそのまま
 * @param {string|number} src @param {(name:string)=>number} lookup
 */
export function evalExpr(src, lookup) {
  if (typeof src === 'number') return src;
  const tree = typeof src === 'object' ? src : parseExpr(src);
  const ev = (n) => {
    switch (n.k) {
      case 'num': return n.v;
      case 'name': {
        const v = lookup(n.v);
        if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`式の名前「${n.v}」の値がない`);
        return v;
      }
      case 'neg': return -ev(n.e);
      case '+': return ev(n.a) + ev(n.b);
      case '-': return ev(n.a) - ev(n.b);
      case '*': return ev(n.a) * ev(n.b);
      case '/': { const d = ev(n.b); return d === 0 ? 0 : ev(n.a) / d; }
      default: throw new Error('式が壊れている');
    }
  };
  return ev(tree);
}

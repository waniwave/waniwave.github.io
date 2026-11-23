// board.js — 盤面、6方向の隣接、なぞりの判定、落下・補充、圧縮進化、特殊ノード
// DOM に触れない。数値・ノードの種類はすべて registry（content/）から受け取る。

// 平頂型・Odd-Q（奇数列が半マス下）の6隣接（仕様書 5.1）
const D_EVEN = [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
const D_ODD = [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];

export function neighbors(c, r, cols, rows) {
  const out = [];
  for (const [dc, dr] of (c % 2 === 0 ? D_EVEN : D_ODD)) {
    const nc = c + dc, nr = r + dr;
    if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) out.push([nc, nr]);
  }
  return out;
}
export const key = (c, r) => c * 16 + r;

export class Board {
  constructor(reg, rng) {
    const B = reg.rules.board;
    Object.assign(this, {
      cols: B.cols, rows: B.rows, spineCol: B.spineCol, minChain: B.minChain,
      mergeMin: B.mergeMin, mergeChainLimit: B.mergeChainLimit, shockRange: B.shockRange,
      spawnSpread: B.spawnSpread ?? 0,
      mergeTrigger: B.mergeTrigger ?? 'any', mergePerPass: B.mergePerPass ?? 0, mergeKeepPulse: !!B.mergeKeepPulse,
    });
    const nodes = reg.all('nodes');
    this.colorDefs = nodes.filter(n => n.kind === 'color');
    this.pulseDef = nodes.find(n => n.kind === 'overlay') || null;
    this.cmpDefs = nodes.filter(n => n.kind === 'cmp').sort((a, b) => a.tier - b.tier);
    this.specialDefs = Object.fromEntries(nodes.filter(n => n.kind === 'special').map(n => [n.id, n]));
    this.rng = rng;
    this.uid = 1;
    this.spineWild = false;   // 脊髄臨界中：主脊髄の全ノードを全色扱い
    this.grid = Array.from({ length: this.cols }, () => Array(this.rows).fill(null));
    this.fill();
  }

  // ---- 生成 ----
  randomColor() { return this.rng.pickWeighted(this.colorDefs).id; }
  // spawnSpread の確率で、隣と同じ色を1回だけ引き直す（同色の塊を作りにくくする）
  spawnColor(c, r) {
    let col = this.randomColor();
    if (c != null && this.spawnSpread > 0 && this.rng.chance(this.spawnSpread)) {
      const near = new Set(this.nb(c, r).map(([nc, nr]) => this.at(nc, nr)?.color).filter(Boolean));
      if (near.has(col)) { const alt = this.colorDefs.filter(d => !near.has(d.id)); col = alt.length ? this.rng.pickWeighted(alt).id : col; }
    }
    return col;
  }
  newCell(c, r) {
    return {
      id: this.uid++, color: this.spawnColor(c, r), cmp: 0,
      pulse: this.pulseDef ? this.rng.chance(this.pulseDef.chance) : false,
      special: null, count: 0, fell: false,
    };
  }
  fill() {
    for (let c = 0; c < this.cols; c++) for (let r = 0; r < this.rows; r++) this.grid[c][r] = null;
    for (let c = 0; c < this.cols; c++) for (let r = this.rows - 1; r >= 0; r--) this.grid[c][r] = this.newCell(c, r);
  }

  // ---- 参照 ----
  at(c, r) { return this.grid[c]?.[r] ?? null; }
  *cells() { for (let c = 0; c < this.cols; c++) for (let r = 0; r < this.rows; r++) yield { c, r, cell: this.grid[c][r] }; }
  nb(c, r) { return neighbors(c, r, this.cols, this.rows); }
  isAdjacent(a, b) { return this.nb(a.c, a.r).some(([c, r]) => c === b.c && r === b.r); }
  isWild(c) { return this.spineWild && c === this.spineCol; }
  chainable(c, r) {
    const x = this.at(c, r);
    if (!x || x.color == null) return false;
    if (x.special && !this.specialDefs[x.special]?.chainable) return false;
    return true;
  }
  ring(c, r, range) {
    const seen = new Set([key(c, r)]); let front = [[c, r]]; const out = [];
    for (let d = 0; d < range; d++) {
      const next = [];
      for (const [fc, fr] of front) for (const [nc, nr] of this.nb(fc, fr)) {
        const k = key(nc, nr); if (seen.has(k)) continue;
        seen.add(k); next.push([nc, nr]); out.push([nc, nr]);
      }
      front = next;
    }
    return out;
  }

  // ---- なぞり ----
  pathColor(path) {
    for (const p of path) if (!this.isWild(p.c)) return this.at(p.c, p.r)?.color ?? null;
    return null;
  }
  // 'add'（繋げる） / 'back'（直前を取り消す） / null（不可）
  canExtend(path, c, r) {
    if (!path.length) return this.chainable(c, r) ? 'add' : null;
    const prev = path[path.length - 2];
    if (prev && prev.c === c && prev.r === r) return 'back';
    const last = path[path.length - 1];
    if (!this.isAdjacent(last, { c, r })) return null;
    if (path.some(p => p.c === c && p.r === r)) return null;
    if (!this.chainable(c, r)) return null;
    const pc = this.pathColor(path);
    if (this.isWild(c) || pc == null || this.at(c, r).color === pc) return 'add';
    return null;
  }
  // なぞりの始点から繋げられるノード（表示用）
  reachable(path) {
    const s = path[0], color = this.pathColor(path);
    const seen = new Set([key(s.c, s.r)]); const q = [s];
    while (q.length) {
      const p = q.pop();
      for (const [c, r] of this.nb(p.c, p.r)) {
        const k = key(c, r);
        if (seen.has(k) || !this.chainable(c, r)) continue;
        if (!(this.isWild(c) || color == null || this.at(c, r).color === color)) continue;
        seen.add(k); q.push({ c, r });
      }
    }
    return seen;
  }

  // ---- 連結の成立 → 消去 → 解除・浄化 → 落下・補充 → 圧縮進化 ----
  snap(c, r) {
    const x = this.at(c, r);
    return { c, r, id: x.id, color: x.color, cmp: x.cmp, pulse: x.pulse, special: x.special, count: x.count, spine: c === this.spineCol };
  }
  // なぞりから連結の記録を作る（盤面は変えない。予想ダメージにも使う）
  buildChain(path) {
    const chain = { color: this.pathColor(path) ?? this.at(path[0].c, path[0].r)?.color ?? null, cells: [], blasted: [], specials: [] };
    const removed = new Map();
    for (const p of path) { chain.cells.push(this.snap(p.c, p.r)); removed.set(key(p.c, p.r), p); }
    // 巻き込み（BOMB など blast を持つ CMP）
    for (const x of chain.cells) {
      const blast = x.cmp ? this.cmpDefs[x.cmp - 1]?.blast : 0;
      if (!blast) continue;
      for (const [c, r] of this.ring(x.c, x.r, blast)) {
        if (removed.has(key(c, r)) || !this.at(c, r)) continue;
        chain.blasted.push(this.snap(c, r)); removed.set(key(c, r), { c, r });
      }
    }
    for (const x of [...chain.cells, ...chain.blasted]) if (x.special) chain.specials.push({ id: x.special, count: x.count, c: x.c, r: x.r });
    return { chain, removed };
  }
  resolve(path) {
    if (path.length < this.minChain) return null;
    const { chain, removed } = this.buildChain(path);
    return { chain, ...this.removeAndSettle([...removed.values()]) };
  }
  removeAndSettle(points) {
    for (const p of points) this.grid[p.c][p.r] = null;
    const released = this.releaseAround(points);
    const merges = this.settle();
    return { released, merges };
  }

  // 消えたマスの隣の癒着を解除・壊死を浄化。主脊髄で消えたマスは衝撃波で範囲が広がる
  releaseAround(points) {
    const out = [];
    for (const p of points) {
      const range = p.c === this.spineCol ? this.shockRange : 1;
      for (const [c, r] of this.ring(p.c, p.r, range)) {
        const x = this.at(c, r);
        if (!x?.special) continue;
        const how = this.specialDefs[x.special]?.onAdjacentClear;
        if (how === 'release') { out.push({ c, r, id: x.special }); x.special = null; }
        else if (how === 'purify') { out.push({ c, r, id: x.special }); x.special = null; x.color = this.randomColor(); }
      }
    }
    return out;
  }

  // 落下・補充（落ちコンなし）。動いたノード（mergeTrigger が 'any' なら補充されたノードも）に fell を付ける
  collapse() {
    for (let c = 0; c < this.cols; c++) {
      const col = this.grid[c];
      let w = this.rows - 1;
      for (let r = this.rows - 1; r >= 0; r--) {
        const x = col[r]; if (!x) continue;
        if (r !== w) { col[w] = x; col[r] = null; x.fell = true; }
        w--;
      }
      for (let r = w; r >= 0; r--) { const x = this.newCell(c, r); x.fell = this.mergeTrigger === 'any'; col[r] = x; }
    }
  }
  clearFell() { for (const { cell } of this.cells()) if (cell) cell.fell = false; }

  settle() {
    const merges = [];
    this.collapse();
    for (let pass = 0; pass <= this.mergeChainLimit; pass++) {
      const groups = this.findMerges();
      if (!groups.length) break;
      for (const g of groups) merges.push({ ...this.applyMerge(g), pass });
      this.clearFell();
      this.collapse();
    }
    this.clearFell();
    return merges;
  }

  mergeable(x) { return !!x && x.color != null && !x.special; }
  // 落ちてきたノードを1個以上含む、同色 mergeMin 個以上の塊
  findMerges() {
    const seen = new Set(); const groups = [];
    for (const { c, r, cell } of this.cells()) {
      if (!cell?.fell || !this.mergeable(cell) || seen.has(key(c, r))) continue;
      const g = []; const q = [{ c, r }]; seen.add(key(c, r));
      while (q.length) {
        const p = q.pop(); g.push(p);
        for (const [nc, nr] of this.nb(p.c, p.r)) {
          const k = key(nc, nr), y = this.at(nc, nr);
          if (seen.has(k) || !this.mergeable(y) || y.color !== cell.color) continue;
          seen.add(k); q.push({ c: nc, r: nr });
        }
      }
      if (g.length >= this.mergeMin) groups.push(g);
    }
    groups.sort((a, b) => b.length - a.length);
    return this.mergePerPass > 0 ? groups.slice(0, this.mergePerPass) : groups;
  }
  tierForSize(n) { let t = 0; this.cmpDefs.forEach((d, i) => { if (n >= d.minSize) t = i + 1; }); return t; }
  applyMerge(g) {
    const cells = g.map(p => ({ ...p, x: this.at(p.c, p.r) }));
    const hasCmp = cells.some(p => p.x.cmp > 0);
    const tier = Math.min(this.cmpDefs.length, this.tierForSize(g.length) + (hasCmp ? 1 : 0));
    const px = p => ({ x: 1.5 * p.c, y: Math.sqrt(3) * (p.r + (p.c % 2 ? 0.5 : 0)) });
    const cx = cells.reduce((t, p) => t + px(p).x, 0) / cells.length;
    const cy = cells.reduce((t, p) => t + px(p).y, 0) / cells.length;
    let best = cells[0], bd = Infinity;
    for (const p of cells) { const q = px(p), d = (q.x - cx) ** 2 + (q.y - cy) ** 2; if (d < bd - 1e-9) { bd = d; best = p; } }
    const pulse = this.mergeKeepPulse ? cells.some(p => p.x.pulse) : best.x.pulse;
    const removedIds = [];
    for (const p of cells) if (p !== best) { removedIds.push(p.x.id); this.grid[p.c][p.r] = null; }
    best.x.cmp = tier; best.x.pulse = pulse;
    return { c: best.c, r: best.r, id: best.x.id, color: best.x.color, tier, size: g.length, removedIds };
  }

  // ---- 特殊ノード ----
  placeSpecial(id, opts = {}) {
    const def = this.specialDefs[id]; if (!def) return null;
    const cands = [...this.cells()].filter(({ c, cell }) => cell && !cell.special && !cell.cmp && cell.color != null && (opts.col == null || c === opts.col));
    const p = this.rng.pick(cands); if (!p) return null;
    p.cell.special = id; p.cell.count = def.count ?? 0;
    if (def.colorless) { p.cell.color = null; p.cell.pulse = false; }
    return { c: p.c, r: p.r, id };
  }
  // ターン終了時：カウント付きの特殊ノードを1減らし、0になったものを返す
  tickSpecials() {
    const out = [];
    for (const { c, r, cell } of this.cells()) {
      if (!cell?.special || !this.specialDefs[cell.special]?.count) continue;
      if (--cell.count <= 0) { out.push({ c, r, id: cell.special }); cell.special = null; cell.count = 0; }
    }
    return out;
  }

  // ---- アンプル・敵の操作 ----
  recolor(from, to) { let n = 0; for (const { cell } of this.cells()) if (cell.color === from) { cell.color = to; n++; } return n; }
  burnRow(r) {
    const pts = [], cells = [];
    for (let c = 0; c < this.cols; c++) if (this.at(c, r)) { cells.push(this.snap(c, r)); pts.push({ c, r }); }
    return { cells, ...this.removeAndSettle(pts) };
  }
  // 指定色のノードを、指定した列へ集める（入れ替え）
  magnet(color, cols) {
    const inCols = ({ c }) => cols.includes(c);
    const all = [...this.cells()];
    const dist = p => Math.abs(p.c - this.spineCol);
    const targets = all.filter(p => inCols(p) && p.cell.color !== color && !p.cell.special).sort((a, b) => dist(a) - dist(b) || b.r - a.r);
    const sources = all.filter(p => !inCols(p) && p.cell.color === color && !p.cell.special);
    let n = 0;
    for (const s of sources) {
      const t = targets[n]; if (!t) break;
      this.grid[t.c][t.r] = s.cell; this.grid[s.c][s.r] = t.cell; n++;
    }
    return n;
  }
  shuffle() {
    const all = [...this.cells()].map(p => p.cell);
    this.rng.shuffle(all);
    let i = 0; for (let c = 0; c < this.cols; c++) for (let r = 0; r < this.rows; r++) this.grid[c][r] = all[i++];
  }

  // ---- 保存 ----
  toJSON() { return JSON.parse(JSON.stringify({ uid: this.uid, spineWild: this.spineWild, grid: this.grid })); }
  load(d) { this.uid = d.uid; this.spineWild = !!d.spineWild; this.grid = d.grid.map(col => col.map(x => (x ? { ...x } : null))); }
}

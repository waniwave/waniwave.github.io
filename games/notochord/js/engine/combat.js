// combat.js — 神経発火、ダメージの逐次計算（EvalStep）、敵の行動、逆流汚染、脊髄臨界、アンプル
// DOM に触れない。数値・敵・アイテムはすべて registry（content/）から受け取る。
import { BigNum } from '../util.js';
import { Board } from './board.js';
import { collectEffects, callHooks } from './registry.js';

const B = x => BigNum.from(x);

export function enemyHp(mode, floor, edef, boss, mul = 1) {
  return B(mode.hpBase).mul(B(mode.hpGrowth).pow(floor - 1)).mul(boss ? mode.bossMul ?? 1 : 1).mul(edef.hpMul ?? 1).mul(mul);
}
// ボス階層：bossFloors に含まれるか、bossEvery の倍数
export function isBossFloor(mode, floor) {
  return !!mode.bossFloors?.includes(floor) || (mode.bossEvery > 0 && floor % mode.bossEvery === 0);
}
export function pickEnemy(mode, floor, rng) {
  if (mode.bosses?.[floor]) return mode.bosses[floor];
  if (isBossFloor(mode, floor) && mode.bossPool?.length) return rng.pick(mode.bossPool);
  return rng.pick(mode.pool);
}

export class Combat {
  // o: { mode, floor, enemy, mutagens:[id], ampoules:[id], ampouleSlots, sync, syncMax, myelin, gauge, backflowOn,
  //      sources:[{id,name,effect,scale}]（義体・系統共鳴・株・形質など）, elite:{hpMul,gimmick}, turnLimit, hpMul,
  //      wreck:true, protectHp:true, lastStandUsed, restore:<toJSON の結果> }
  constructor(reg, rng, o = {}) {
    this.reg = reg; this.rng = rng; this.R = reg.rules; this.o = { ...o, restore: undefined, sources: undefined };
    this.mode = reg.get('modes', o.mode) ?? reg.all('modes')[0];
    this.floor = o.floor ?? 1;
    this.isBoss = isBossFloor(this.mode, this.floor);
    const edef = reg.get('enemies', o.restore?.enemyId ?? o.enemy ?? pickEnemy(this.mode, this.floor, rng));
    this.extra = o.sources || [];
    this.mutagens = (o.mutagens || []).map(id => reg.get('mutagens', id)).filter(Boolean);
    this.nodes = Object.fromEntries(reg.all('nodes').map(n => [n.id, n]));
    this.syncMax = o.syncMax ?? 100;
    this.sync = Math.min(o.sync ?? this.syncMax, this.syncMax);
    this.myelin = o.myelin ?? 0; this.gauge = o.gauge ?? 0; this.backflow = 0;
    this.hitLast = false;
    // 盤面に効くルール変更
    const pulse = reg.all('nodes').find(n => n.kind === 'overlay');
    const mergeAdd = this.sumStat('mergeLimit');
    this.board = new Board(reg, rng, {
      pulseChance: pulse ? pulse.chance * (1 + this.sumStat('pulseChanceMul')) + this.sumStat('pulseChance') : 0,
      blastBonus: this.sumStat('bombRange'),
      mergeChainLimit: this.R.board.mergeChainLimit + mergeAdd,
      spineExtra: this.sumStat('spineExtra'), minChainAdd: this.sumStat('minChainAdd'), mergeTierAdd: this.sumStat('mergeTierAdd'),
    });
    this.cmpDefs = this.board.cmpDefs;
    this.alwaysWild = this.stat('alwaysWild').length > 0;
    this.board.spineWild = this.alwaysWild;
    const slots = o.ampouleSlots ?? this.R.combat.ampouleSlots;
    this.ampoules = Array.from({ length: Math.max(0, slots) }, (_, i) => o.ampoules?.[i] ?? null);
    this.passive = !!edef.passive;
    this.turnLimit = o.turnLimit ?? edef.turnLimit ?? 0;
    this.backflowOn = this.isBoss || !!this.mode.backflowAll || !!o.backflowOn;
    const hp = enemyHp(this.mode, this.floor, edef, this.isBoss, (o.hpMul ?? 1) * (o.elite?.hpMul ?? 1));
    const interval = Math.max(1, edef.interval - this.sumStat('telegraphShift'));
    this.enemy = { def: edef, hp, hpMax: hp, timer: interval, interval, stunned: false, cycle: 0, shuffled: false,
      gimmicks: [...(edef.gimmicks || []), ...(o.elite?.gimmick ? [o.elite.gimmick] : [])] };
    Object.assign(this, { turn: 0, phase: 'think', chains: [], crit: false, reserved: false, echo: false, lastCrit: false,
      rewindUsed: false, snapPrev: null, snapCur: null, freeze: 0, time: 0, bestDamage: B(0), maxChain: 0,
      fired: false, turnMerges: 0, bombs: 0, wreckTaken: false, lastStandUsed: !!o.lastStandUsed,
      protectHp: !!o.protectHp, lastCommitTime: 0, hitCount: 0 });
    this.events = [];
    if (o.restore) { this.load(o.restore); return; }
    if (o.wreck) { const w = Object.values(this.nodes).find(n => n.look === 'wreck'); if (w) this.board.placeSpecial(w.id); }
    this.applyGimmicks('start', this.events);
    if (!this.passive) this.telegraph(this.events);
    this.startTurn();
  }

  // ---- 効果の出どころ ----
  get sources() { return [...this.mutagens.map(m => ({ id: m.id, name: m.name, effect: m.effect, scale: m.base ?? 1 })), ...this.extra]; }
  scope(chains = []) { return { chains, sync: this.sync, backflow: this.backflow, myelin: this.myelin, crit: this.crit, hitLast: this.hitLast }; }
  stat(op) { return collectEffects(this.sources, this.scope([]), 'turn').filter(e => e.op === op); }
  sumStat(op) { return this.stat(op).reduce((t, e) => t + (Number(e.v) || 0), 0); }
  fireTime() { return Math.max(1, this.R.fire.time + this.sumStat('addFireTime')); }
  fallTime() { return Math.max(0.05, this.R.fire.fallTime + this.sumStat('fallTime')); }
  pulseTime() { const p = this.board.pulseDef; return p ? (p.time ?? 0) + this.sumStat('addPulseTime') : 0; }
  get timeScale() {
    if (this.crit) return this.R.spineBreak.timeScale * this.stat('critSlow').reduce((t, e) => t * e.v, 1);
    if (this.echo) return this.stat('spineEcho')[0]?.args[1] ?? 1;
    return 1;
  }
  get canCrit() { return this.gauge >= this.R.spineBreak.max; }

  // ---- ターン ----
  snapshot() { return { board: this.board.toJSON(), sync: this.sync, myelin: this.myelin, backflow: this.backflow }; }
  startTurn() {
    this.turn++;
    this.snapPrev = this.snapCur; this.snapCur = this.snapshot();
    this.phase = 'think'; this.chains = []; this.freeze = 0; this.reserved = false; this.fired = false; this.turnMerges = 0; this.graceUsed = false;
    this.time = this.fireTime();
  }
  toggleReserve() { if (this.phase === 'think' && this.canCrit) this.reserved = !this.reserved; return this.reserved; }
  beginFire() {
    if (this.phase !== 'think') return false;
    this.phase = 'fire'; this.fired = true;
    if (this.reserved && this.canCrit) { this.crit = true; this.gauge = 0; this.board.spineWild = true; }
    this.echo = !this.crit && this.lastCrit && this.stat('spineEcho').length > 0;
    callHooks(this.sources, 'ON_FIRE_START', { combat: this });
    return true;
  }
  tick(dt) {
    if (this.phase !== 'fire') return false;
    if (this.freeze > 0) { this.freeze -= dt; if (this.freeze >= 0) return false; dt = -this.freeze; this.freeze = 0; }
    this.time -= dt * this.timeScale;
    if (this.time <= 0 && !this.graceUsed) {   // 猶予：0秒になった後も少しだけ続けられる
      this.graceUsed = true;
      const g = this.sumStat('graceTime'); if (g > 0) this.time = g;
    }
    return this.time <= 0;
  }
  commit(path) {
    if (this.phase !== 'fire') return null;
    const res = this.board.resolve(path);
    if (!res) return null;
    const ch = res.chain;
    this.chains.push(ch);
    this.lastCommitTime = Math.max(0, this.time);
    this.maxChain = Math.max(this.maxChain, ch.cells.length);
    res.pulses = ch.cells.filter(n => n.pulse).length;
    let add = res.pulses * this.pulseTime();
    add += collectEffects(this.sources, this.scope([ch]), 'turn').filter(e => e.op === 'timePerChain').reduce((t, e) => t + e.v, 0);
    this.time += add; res.timeAdded = add;
    const look = s => this.nodes[s.id]?.look;
    res.weakpoint = ch.specials.some(s => look(s) === 'bracket');
    if (res.weakpoint) {
      this.enemy.stunned = true;
      const cut = this.sumStat('weakpointCut');
      if (cut > 0) { res.cut = this.enemy.hpMax.mul(cut); this.enemy.hp = BigNum.max(1, this.enemy.hp.sub(res.cut)); }
      callHooks(this.sources, 'ON_WEAKPOINT_BREAK', { combat: this });
    }
    res.reflect = ch.specials.some(s => this.nodes[s.id]?.reflect && s.count > 0);
    res.wreck = ch.specials.some(s => look(s) === 'wreck');
    if (res.wreck) this.wreckTaken = true;
    this.turnMerges += res.merges.length;
    const maxTier = this.cmpDefs.length;
    this.bombs += res.merges.filter(m => m.tier === maxTier).length;
    this.gauge = Math.min(this.R.spineBreak.max, this.gauge + res.merges.length * this.sumStat('gaugePerMerge'));
    callHooks(this.sources, 'ON_CHAIN_COMMIT', { combat: this, chain: ch });
    for (const m of res.merges) callHooks(this.sources, 'ON_MERGE_CREATED', { combat: this, merge: m });
    return res;
  }
  preview(path) {
    const chains = [...this.chains];
    let cur = null;
    if (path?.length >= this.board.minChain) { cur = this.board.buildChain(path).chain; chains.push(cur); }
    return { ...this.evaluate(chains), current: cur };
  }

  // ---- ダメージ計算（仕様書 6.2） ----
  evaluate(chainsIn) {
    const C = this.R.combat, srcs = this.sources;
    const real = chainsIn.filter(c => !c.burn);
    const list = real.map((ch, i) => ({ ...ch, prevColor: i ? real[i - 1].color : null }));
    const sc = this.scope(list);
    const active = new Set();
    const steps = [];
    let base = B(0), mult = B(C.startMult), factor = B(1);
    const push = s => steps.push({ ...s, base, mult, factor, total: base.mul(mult).mul(factor) });
    let myelin = 0, gauge = 0, synapse = 0;
    const turnEm = collectEffects(srcs, sc, 'turn');
    const has = op => turnEm.filter(e => e.op === op);
    const sum = op => has(op).reduce((t, e) => { active.add(e.src.id); return t + (Number(e.v) || 0); }, 0);
    const spineMul = this.R.board.spineMul + sum('spineMulAdd');
    const shift = sum('longBonusShift'), noLong = has('noLongBonus').length > 0;
    const chainBase = [];
    const nodeValue = (n, ch, useMods) => {
      const def = this.nodes[n.color]; if (!def) return { v: 0, m: 0, my: 0 };
      const val = { v: def.base ?? 0, m: def.mult ?? 0, my: def.myelin ?? 0 };
      if (useMods) {
        for (const e of collectEffects(srcs, { ...sc, chain: ch, node: n }, 'node')) {
          active.add(e.src.id);
          if (e.op === 'addBase') val.v += e.v; else if (e.op === 'addMult') val.m += e.v;
          else if (e.op === 'baseMul') val.v *= e.v; else if (e.op === 'addMyelin') val.my += e.v;
        }
        callHooks(srcs, 'ON_NODE_EVAL', { combat: this, node: n, chain: ch, val });
        if (n.spine) callHooks(srcs, 'ON_SPINE_PASS', { combat: this, node: n, chain: ch, val });
      }
      const cmp = n.cmp ? this.cmpDefs[n.cmp - 1] : null;
      const k = (n.spine ? spineMul : 1) * (cmp ? cmp.valueMul ?? 1 : 1);
      // 髄鞘外殻は主脊髄の2倍だけを受け、CMP の倍率は受けない（段階3の調整）
      return { v: val.v * k, m: val.m * k + (cmp?.mult ?? 0), my: val.my * (n.spine ? spineMul : 1), gauge: def.gauge ?? 0 };
    };
    for (const ch of chainsIn.filter(c => c.burn)) {
      let cb = 0; for (const n of ch.cells) cb += nodeValue(n, null, false).v;
      base = base.add(cb); push({ kind: 'burn', len: ch.cells.length, add: cb });
    }
    // 1〜2. 連結ごとの基礎値と倍率
    for (const ch of list) {
      let cb = 0, cm = 0;
      for (const n of [...ch.cells, ...ch.blasted]) {
        const x = nodeValue(n, ch, true);
        cb += x.v; cm += x.m; myelin += x.my;
        if (x.gauge) { gauge += x.gauge; synapse++; }
      }
      if (ch.cells.length >= C.bigChain) gauge += C.bigChainGauge;
      let lb = 1;
      if (!noLong) for (const [len, mul] of C.longBonus) if (ch.cells.length >= len + shift) lb = mul;
      cb *= lb; cm *= lb;
      for (const e of turnEm) if (e.chain === ch && (e.op === 'baseMul' || e.op === 'addBase')) {
        active.add(e.src.id); cb = e.op === 'baseMul' ? cb * e.v : cb + e.v;
      }
      chainBase.push(cb);
      base = base.add(cb); mult = mult.add(cm);
      push({ kind: 'chain', color: ch.color, len: ch.cells.length, blasted: ch.blasted.length, add: cb, multAdd: cm, long: lb });
    }
    const free = turnEm.filter(e => !e.chain || !['baseMul', 'addBase'].includes(e.op));
    const srcStep = (e, op = e.op, v = e.v) => { active.add(e.src.id); push({ kind: 'src', name: e.src.name, op, v }); };
    for (const e of free) {
      if (e.op === 'addBase') { base = base.add(e.v); srcStep(e); }
      else if (e.op === 'myelinToBase') { const v = this.myelin * e.v; if (!v) continue; base = base.add(v); srcStep(e, 'addBase', v); }
      else if (e.op === 'baseMul') { base = base.mul(e.v); srcStep(e); }
    }
    for (const e of free) {
      if (e.op === 'addMult') { mult = mult.add(e.v); srcStep(e); }
      else if (e.op === 'multPerMerge' && this.turnMerges) { const v = e.v * this.turnMerges; mult = mult.add(v); srcStep(e, 'addMult', v); }
      else if (e.op === 'myelinToMult' && this.myelin) { const v = this.myelin * e.v; mult = mult.add(v); srcStep(e, 'addMult', v); }
    }
    // 3. 連結数ボーナス
    if (list.length > 1 || has('chainBonusPow').length) {
      const pow = has('chainBonusPow')[0];
      const k = pow ? pow.v ** list.length : 1 + (C.chainBonus + sum('addChainBonus')) * (list.length - 1);
      if (pow) active.add(pow.src.id);
      if (k !== 1 && list.length) { factor = factor.mul(k); push({ kind: 'chainBonus', n: list.length, k }); }
    }
    // 4. 乗算
    for (const e of free.filter(e => e.op === 'mulMult')) { factor = factor.mul(e.v); srcStep(e); }
    // 5. 再発動
    const plus = sum('retriggerPlus');
    for (const e of free.filter(e => e.op === 'retrigger')) {
      const t = e.chain ? chainBase[list.indexOf(e.chain)] : Math.max(0, ...chainBase);
      if (!t) continue;
      const v = t * ((e.v || 1) + plus);
      base = base.add(v); srcStep(e, 'retrigger', v);
    }
    // 6. メタ増幅（系統共鳴・椎骨義体）
    for (const e of free.filter(e => e.op === 'metaMul')) { factor = factor.mul(e.v); srcStep(e); }
    for (const e of free.filter(e => e.op === 'syncScale')) {
      const k = 1 + (e.v - 1) * Math.max(0, this.syncMax - this.sync) / Math.max(1, this.syncMax - 1);
      factor = factor.mul(k); srcStep(e, 'metaMul', k);
    }
    // 7. 装甲・反射・脊髄臨界
    const armor = this.enemy.def.armor;
    if (list.length && armor && !list.some(ch => ch.color === armor.color)) { factor = factor.mul(armor.mul); push({ kind: 'armor', k: armor.mul, color: armor.color }); }
    const virus = list.flatMap(ch => ch.specials).find(s => this.nodes[s.id]?.reflect && s.count > 0);
    if (list.length && virus) { const k = this.nodes[virus.id].reflect; factor = factor.mul(k); push({ kind: 'reflect', k }); }
    if (list.length && this.crit) { const k = this.R.spineBreak.mul + sum('critMulAdd'); factor = factor.mul(k); push({ kind: 'crit', k }); }
    else if (list.length && this.echo) { const e = this.stat('spineEcho')[0]; factor = factor.mul(e.v); active.add(e.src.id); push({ kind: 'echo', k: e.v }); }
    for (const e of turnEm) if (['addFireTime', 'addPulseTime', 'addChainBonus', 'timePerChain'].includes(e.op)) active.add(e.src.id);
    myelin *= 1 + sum('myelinGainMul');
    const gaugeMul = 1 + sum('addGauge') / 100;
    return { steps, base, mult, factor, total: base.mul(mult).mul(factor), myelin, gauge: gauge * gaugeMul, synapse, active, chainCount: list.length };
  }

  endFire() {
    if (this.phase !== 'fire') return null;
    callHooks(this.sources, 'ON_FIRE_END', { combat: this });
    const ev = this.evaluate(this.chains);
    const e = this.enemy;
    const before = e.hp;
    e.hp = BigNum.max(0, e.hp.sub(ev.total));
    if (this.protectHp && e.hp.lte(0)) e.hp = B(1);
    ev.overkill = before.gt(0) ? ev.total.div(before).toNumber() : 0;
    ev.lastCommitTime = this.lastCommitTime;
    this.myelin += ev.myelin;
    // 臨界中のターンはゲージが溜まらない（gainDuringCrit: true で溜まる）
    if (!this.crit || this.R.spineBreak.gainDuringCrit) this.gauge = Math.min(this.R.spineBreak.max, this.gauge + ev.gauge);
    const BF = this.R.backflow;
    if (this.backflowOn && ev.synapse >= BF.reliefCount) this.backflow = Math.max(0, this.backflow - BF.relief);
    ev.best = ev.total.gt(this.bestDamage) && this.bestDamage.gt(0);
    if (ev.total.gt(this.bestDamage)) this.bestDamage = ev.total;
    ev.crit = this.crit;
    if (this.crit) this.gauge = Math.max(this.gauge, Math.min(this.R.spineBreak.max, this.sumStat('critRefund')));
    this.lastCrit = this.crit; this.crit = false; this.echo = false;
    this.board.spineWild = this.alwaysWild;
    const won = e.hp.lte(0);
    ev.kill = won;
    this.phase = won ? 'won' : 'enemy';
    return { ev, won };
  }

  // ---- 敵の行動 ----
  telegraph(events) {
    const wp = Object.values(this.nodes).find(n => n.look === 'bracket');
    if (wp && ![...this.board.cells()].some(p => p.cell?.special === wp.id)) {
      const p = this.board.placeSpecial(wp.id); if (p) events.push({ type: 'place', ...p });
    }
    events.push({ type: 'telegraph', turns: this.enemy.timer });
    this.applyGimmicks('telegraph', events);
  }
  applyGimmicks(on, events) {
    const d = this.enemy.def, g = this.enemy.gimmicks;
    let list;
    if (d.cycle) list = on === 'attack' && g.length ? [g[this.enemy.cycle++ % g.length]] : [];
    else list = g.filter(x => x.on === on);
    const boost = place => this.stat('gimmickBoost').filter(e => e.args[0] === place).reduce((t, e) => t + (Number(e.args[1]) || 0), 0);
    for (const x of list) for (let i = 0; i < (x.n ?? 1) + boost(x.place); i++) {
      const p = this.board.placeSpecial(x.place, { col: x.col === 'spine' ? this.rng.pick(this.board.spineCols) : x.col });
      if (p) events.push({ type: 'place', ...p });
    }
  }
  hitSync(dmg, events, type, extra = {}) {
    const absorbed = Math.min(this.myelin, dmg);
    this.myelin -= absorbed;
    const rest = dmg - absorbed;
    this.sync = Math.max(0, this.sync - rest);
    if (this.sync <= 0 && !this.lastStandUsed && this.stat('lastStand').length) { this.sync = 1; this.lastStandUsed = true; events.push({ type: 'lastStand' }); }
    if (rest > 0) this.hitNow = true;
    events.push({ type, dmg, absorbed, rest, ...extra });
    return rest;
  }
  enemyPhase() {
    if (this.phase !== 'enemy') return [];
    const ev = [], e = this.enemy, BF = this.R.backflow;
    const bm = (this.mode.backflowMul ?? 1) * (1 + this.sumStat('backflowRate') / 100);
    this.hitNow = false;
    for (const v of this.board.tickSpecials()) {
      const d = this.nodes[v.id];
      if (d?.syncDamage) this.hitSync(d.syncDamage, ev, 'virus', { c: v.c, r: v.r });
    }
    if (e.def.shuffleAt && !e.shuffled && e.hp.lte(e.hpMax.mul(e.def.shuffleAt))) { e.shuffled = true; this.board.shuffle(); ev.push({ type: 'shuffle' }); }
    if (this.passive) {
      if (this.turnLimit && this.turn >= this.turnLimit) { this.phase = 'closed'; ev.push({ type: 'closed' }); return ev; }
    } else {
      this.applyGimmicks('turn', ev);
      e.timer--;
      if (e.timer <= 0) {
        if (e.stunned) { e.stunned = false; ev.push({ type: 'stun' }); }
        else {
          this.hitSync(e.def.atk, ev, 'attack');
          this.hitCount++;
          callHooks(this.sources, 'ON_ENEMY_HIT', { combat: this });
          if (this.backflowOn) this.backflow += BF.perHit * bm;
          this.applyGimmicks('attack', ev);
        }
        e.timer = e.interval;
        this.telegraph(ev);
      }
    }
    // 毎ターンの悪条件：壊死を置く
    const nec = Object.values(this.nodes).find(n => n.look === 'necrosis');
    for (let i = 0; nec && i < this.sumStat('necrosisPerTurn'); i++) { const p = this.board.placeSpecial(nec.id); if (p) ev.push({ type: 'place', ...p }); }
    this.hitLast = !!this.hitNow;
    if (this.backflowOn) this.backflow += BF.perTurn * bm;
    this.backflow = Math.min(BF.max, this.backflow);
    if (this.sync <= 0) { this.phase = 'lost'; this.lostCause = 'sync'; ev.push({ type: 'lost', cause: 'sync' }); }
    else if (this.backflowOn && this.backflow >= BF.max) { this.phase = 'lost'; this.lostCause = 'backflow'; ev.push({ type: 'lost', cause: 'backflow' }); }
    else this.startTurn();
    return ev;
  }

  // ---- アンプル（思考フェーズ中のみ）。t: { row } / { color } / { from, to } ----
  useAmpoule(i, t = {}) {
    if (this.phase !== 'think') return { ok: false, reason: 'phase' };
    const def = this.reg.get('ampoules', this.ampoules[i]);
    if (!def) return { ok: false, reason: 'empty' };
    const res = { ok: true, def };
    switch (def.use) {
      case 'freeze': this.freeze = def.value; break;
      case 'heal': this.sync = Math.min(this.syncMax, this.sync + def.value); break;
      case 'recolor': if (!t.from || !t.to || t.from === t.to) return { ok: false, reason: 'target' }; this.board.recolor(t.from, t.to); break;
      case 'burnRow': {
        if (t.row == null) return { ok: false, reason: 'target' };
        const r = this.board.burnRow(t.row);
        this.chains.push({ burn: true, color: null, cells: r.cells, blasted: [], specials: [] });
        res.burn = r; break;
      }
      case 'magnet': {
        if (!t.color) return { ok: false, reason: 'target' };
        const k = def.range ?? 1, s = this.board.spineCol, cols = [];
        for (let c = s - k; c <= s + k; c++) cols.push(c);
        this.board.magnet(t.color, cols); break;
      }
      case 'rewind': {
        if (this.rewindUsed || !this.snapPrev) return { ok: false, reason: 'rewind' };
        const s = this.snapPrev;
        this.board.load(s.board); this.sync = s.sync; this.myelin = s.myelin; this.backflow = s.backflow;
        this.snapCur = s; this.snapPrev = null; this.rewindUsed = true; this.chains = [];
        break;
      }
    }
    this.ampoules[i] = null;
    return res;
  }

  // ---- 保存と再開（ターン開始時の状態を保存する） ----
  toJSON() {
    const e = this.enemy;
    return {
      enemyId: e.def.id, hp: e.hp.toJSON(), hpMax: e.hpMax.toJSON(), timer: e.timer, stunned: e.stunned, cycle: e.cycle, shuffled: e.shuffled,
      board: this.board.toJSON(), mutagens: this.mutagens.map(m => m.id), ampoules: [...this.ampoules],
      sync: this.sync, syncMax: this.syncMax, myelin: this.myelin, gauge: this.gauge, backflow: this.backflow, backflowOn: this.backflowOn,
      turn: this.turn, lastCrit: this.lastCrit, rewindUsed: this.rewindUsed, snapPrev: this.snapPrev, bestDamage: this.bestDamage.toJSON(),
      maxChain: this.maxChain, fired: this.fired, hitLast: this.hitLast, lastStandUsed: this.lastStandUsed, bombs: this.bombs,
      wreckTaken: this.wreckTaken, protectHp: this.protectHp, hitCount: this.hitCount, opts: this.o,
    };
  }
  load(d) {
    const e = this.enemy;
    Object.assign(e, { hp: B(d.hp), hpMax: B(d.hpMax), timer: Math.min(d.timer, e.interval), stunned: d.stunned, cycle: d.cycle, shuffled: d.shuffled });
    this.board.load(d.board);
    this.mutagens = (d.mutagens || []).map(id => this.reg.get('mutagens', id)).filter(Boolean);
    this.ampoules = this.ampoules.map((_, i) => (this.reg.get('ampoules', d.ampoules?.[i]) ? d.ampoules[i] : null));
    Object.assign(this, {
      sync: d.sync, syncMax: d.syncMax, myelin: d.myelin, gauge: d.gauge, backflow: d.backflow, backflowOn: d.backflowOn,
      turn: d.turn - 1, lastCrit: d.lastCrit, rewindUsed: d.rewindUsed, bestDamage: B(d.bestDamage), maxChain: d.maxChain,
      hitLast: d.hitLast, lastStandUsed: d.lastStandUsed, bombs: d.bombs, wreckTaken: d.wreckTaken, protectHp: d.protectHp, hitCount: d.hitCount ?? 0,
    });
    this.board.spineWild = this.alwaysWild;
    this.snapCur = d.snapPrev;
    this.startTurn();
    this.wasFired = !!d.fired;
  }
}

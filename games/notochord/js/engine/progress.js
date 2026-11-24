// progress.js — 潜行の進行、侵入経路、報酬、抜去・ロスト、残骸、義体の抽選、検体・素質・熟練・殿堂入り、保存
// DOM に触れない。どのモード（契約・深淵・今後のエンドコンテンツ）も content の modes の数値だけで同じように進める。
import { BigNum, fmt } from '../util.js';
import { Combat, isBossFloor, pickEnemy } from './combat.js';
import { fx, collectEffects, isUnlocked, runStory } from './registry.js';

export const SAVE_KEY = 'notochord_save_v1';
export const SAVE_VERSION = 1;
const B = x => BigNum.from(x);
const clone = x => JSON.parse(JSON.stringify(x));

export function newSave() {
  return {
    v: SAVE_VERSION, specimen: 1, diver: null, syn: 0, uid: 1, vault: [], vaultExp: 0, equipped: {}, ampoules: [], optic: 1,
    flags: [], fragments: [], seen: [], codex: [], residue: [], wreck: null, shelf: [], protocol: [], preserveOffer: null,
    records: { maxDamage: { m: 0, e: 0 }, maxChain: 0, lost: 0, runs: 0, extracts: 0, clears: {}, deepest: {} },
    bestCards: {},
    tutorial: { done: false }, prologue: false, shop: null, lastResult: null,
    settings: { reduceFlash: false, bgm: 0.6, sfx: 0.8 }, run: null, rngState: 0,
  };
}

// ---- チュートリアル（UI と検査で共用） ----
// step.board の文字を legend でノードに置き換えて盤面に置く。'.' は同じ色が隣り合わない並びで埋める
export function applyTutorialStep(reg, cb, tut, step) {
  const colors = reg.all('nodes').filter(n => n.kind === 'color').map(n => n.id);
  const b = cb.board, legend = tut.legend || {};
  for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) {
    const ch = step.board[r]?.[c] ?? '.', x = b.at(c, r);
    const q = c, ra = r - (c - (c & 1)) / 2, k = ((q - ra) % colors.length + colors.length) % colors.length;
    Object.assign(x, { special: null, count: 0, cmp: 0, fell: false, pulse: ch !== '.' && ch === ch.toLowerCase(),
      color: ch === '.' ? colors[k] : legend[ch.toUpperCase()] ?? colors[0] });
  }
  for (const [c, r, id] of step.specials || []) { const x = b.at(c, r), d = reg.get('nodes', id); if (x && d) { x.special = id; x.count = d.count ?? 0; } }
  if (step.gauge != null) cb.gauge = step.gauge;
}
// log: { chains, merges, pulses, crit, weakpoint }
export function tutorialDone(step, log) {
  const test = {
    chain: () => log.chains.length > 0,
    spineChain: () => log.chains.some(ch => ch.cells.some(n => n.spine)),
    multi: () => log.chains.length >= 2 && new Set(log.chains.map(ch => ch.color)).size >= 2,
    merge: () => log.merges > 0, pulse: () => log.pulses > 0, crit: () => !!log.crit, weakpoint: () => !!log.weakpoint,
  };
  return (step.until || []).every(u => test[u]?.());
}

export class Game {
  constructor(reg, rng, save) {
    this.reg = reg; this.rng = rng; this.R = reg.rules;
    this.s = this.sanitize(save ? clone(save) : newSave());
    if (this.s.rngState) rng.state = this.s.rngState;
    this.mem = { flags: new Set(this.s.flags), fragments: new Set(this.s.fragments), seen: new Set(this.s.seen) };
    this.queue = [];
  }

  // ---- 保存 ----
  toJSON() {
    const s = this.s;
    s.flags = [...this.mem.flags]; s.fragments = [...this.mem.fragments]; s.seen = [...this.mem.seen];
    s.rngState = this.rng.state;
    return clone(s);
  }
  // 見つからない id は捨てる（パックを外してもセーブが壊れない）
  sanitize(s) {
    const d = newSave(), reg = this.reg;
    for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
    s.records = { ...d.records, ...s.records }; s.records.deepest ||= {};
    const okItem = it => it && reg.get('vertebrae', it.tid) && reg.get('rarities', it.rarity);
    s.vault = (s.vault || []).filter(okItem).map(it => ({ ...it, affixes: (it.affixes || []).filter(a => reg.get('affixes', a)) }));
    const uids = new Set(s.vault.map(i => i.uid));
    const eq = {};
    for (const r of this.R.vertebra.regions) eq[r.id] = (s.equipped?.[r.id] || [null, null]).map(u => {
      const it = s.vault.find(i => i.uid === u); return it && reg.get('vertebrae', it.tid).region === r.id ? u : null;
    }).concat([null, null]).slice(0, 2);
    s.equipped = eq;
    s.ampoules = (s.ampoules || []).filter(a => reg.get('ampoules', a));
    if (s.diver && !reg.get('lineages', s.diver.lineage)) s.diver = null;
    s.shelf = (s.shelf || []).map(x => (x.trait && !reg.get('traits', x.trait.id) ? { ...x, trait: null } : x));
    s.protocol = (s.protocol || []).filter(i => s.shelf[i]?.trait);
    s.codex = (s.codex || []).filter(id => reg.get('vertebrae', id));
    if (s.wreck) s.wreck.items = (s.wreck.items || []).filter(okItem);
    if (s.shop) s.shop.items = (s.shop.items || []).filter(x => okItem(x.inst));
    const run = s.run;
    if (run && (!reg.get('modes', run.mode) || !s.diver)) s.run = null;
    else if (run) {
      run.mutagens = (run.mutagens || []).filter(id => reg.get('mutagens', id));
      run.ampoules = (run.ampoules || []).map(a => (reg.get('ampoules', a) ? a : null));
      run.found = (run.found || []).filter(okItem);
      if (run.route && !reg.get('enemies', run.route.enemy)) { run.route = null; run.battle = null; run.phase = 'route'; }
      if (run.battle && !reg.get('enemies', run.battle.enemyId)) run.battle = null;
      if (run.reward) run.reward.mutagens = (run.reward.mutagens || []).filter(id => reg.get('mutagens', id));
    }
    for (const id of uids) if (!s.vault.some(i => i.uid === id)) uids.delete(id);
    s.uid = Math.max(s.uid || 1, ...s.vault.map(i => i.uid + 1), 1);
    return s;
  }

  // ---- ストーリー・開放 ----
  has(flag) { return this.mem.flags.has(flag); }
  unlocked(item) { return isUnlocked(item, this.mem.flags); }
  emit(event, ctx = {}) {
    const out = runStory(this.reg, event, { specimen: this.s.specimen, ...ctx }, this.mem, this.rng);
    if (out.fragments.length || out.lines.length || out.texts.length || out.unlocked.length) this.queue.push({ event, ...out });
    return out;
  }
  takeQueue() { const q = this.queue; this.queue = []; return q; }

  // ---- 検体・素質・熟練 ----
  get diver() { return this.s.diver; }
  lineage() { return this.s.diver ? this.reg.get('lineages', this.s.diver.lineage) : null; }
  careerLevel(points = this.s.diver?.points ?? 0) { let lv = 0; this.R.career.levels.forEach((t, i) => { if (points >= t) lv = i; }); return lv; }
  lineages() { return this.reg.all('lineages').map(l => ({ ...l, locked: !this.unlocked(l) })); }
  thaw(id) {
    const l = this.reg.get('lineages', id);
    if (!l || !this.unlocked(l) || this.s.diver) return false;
    this.s.diver = { lineage: id, points: 0, runs: 0, extracts: 0, deepest: null, maxDamage: { m: 0, e: 0 }, born: Date.now() };
    this.s.preserveOffer = null;
    this.emit('THAW', { lineage: id });
    return true;
  }

  // ---- 背骨・義体 ----
  tmpl(it) { return this.reg.get('vertebrae', it?.tid); }
  rarity(it) { return this.reg.get('rarities', it?.rarity); }
  item(uid) { return this.s.vault.find(i => i.uid === uid) ?? null; }
  regions() { return this.R.vertebra.regions; }
  socketCount(region) {
    const r = this.regions().find(x => x.id === region);
    if (!r || !this.unlocked(r)) return 0;
    return this.has(this.R.vertebra.auxFlag + region) ? 2 : 1;
  }
  equippedItems() {
    const out = [];
    for (const r of this.regions()) (this.s.equipped[r.id] || []).forEach((uid, slot) => {
      if (uid != null && slot < this.socketCount(r.id)) { const it = this.item(uid); if (it) out.push({ region: r.id, slot, item: it }); }
    });
    return out;
  }
  isEquipped(uid) { return this.equippedItems().some(e => e.item.uid === uid); }
  equip(uid, region, slot) {
    const it = this.item(uid);
    if (!it || this.tmpl(it).region !== region || slot >= this.socketCount(region) || this.s.run) return false;
    for (const r of this.regions()) this.s.equipped[r.id] = this.s.equipped[r.id].map(u => (u === uid ? null : u));
    this.s.equipped[region][slot] = uid;
    return true;
  }
  unequip(region, slot) { if (this.s.run) return false; this.s.equipped[region][slot] = null; return true; }
  vaultCap() { return this.R.shop.vaultBase + this.s.vaultExp * this.R.shop.vaultStep; }
  storedItems() { return this.s.vault.filter(i => !this.isEquipped(i.uid)); }

  resonance() {
    const counts = {};
    for (const { item } of this.equippedItems()) { const st = this.tmpl(item).strain; counts[st] = (counts[st] || 0) + 1; }
    const lin = this.lineage();
    if (lin?.strain) counts[lin.strain] = (counts[lin.strain] || 0) + 1;
    for (const p of this.protocolTraits()) if (p.def.strainMemory && p.strain) counts[p.strain] = (counts[p.strain] || 0) + 1;
    const max = Math.max(0, ...Object.values(counts));
    return { counts, max };
  }

  // 戦闘に渡す効果（義体・副次変異・系統共鳴・株・遺伝形質・熟練）
  sources() {
    const reg = this.reg, out = [];
    for (const { item } of this.equippedItems()) {
      const t = this.tmpl(item), rar = this.rarity(item);
      out.push({ id: 'v:' + item.uid, name: t.name, effect: t.effect, scale: t.base * (rar?.mul ?? 1), kind: 'vertebra' });
      for (const a of item.affixes) { const af = reg.get('affixes', a); if (af) out.push({ id: `a:${item.uid}:${a}`, name: af.name, effect: af.effect, scale: af.base, kind: 'affix' }); }
    }
    const { counts } = this.resonance(), lin = this.lineage();
    for (const st of reg.all('strains')) for (const tier of st.resonance || []) {
      if ((counts[st.id] || 0) < tier.at) continue;
      const boost = lin?.strain === st.id ? lin.strainBoost ?? 1 : 1;
      out.push({ id: `r:${st.id}:${tier.at}`, name: `${st.name}共鳴${tier.at}`, effect: tier.effect, scale: (tier.base ?? 1) * boost, kind: 'resonance' });
    }
    if (lin?.effect) out.push({ id: lin.id, name: lin.name, effect: lin.effect, scale: 1, kind: 'lineage' });
    for (const p of this.protocolTraits()) if (p.def.effect) out.push({ id: 't:' + p.def.id, name: p.def.name, effect: p.def.effect, scale: p.def.values[p.tier - 1], kind: 'trait' });
    const lv = this.careerLevel();
    if (this.s.diver && lv) out.push({ id: 'career', name: `熟練 Lv.${lv}`, kind: 'career', scale: 1,
      effect: [fx.addFireTime(lv * this.R.career.fireTime), fx.syncMax(lv * this.R.career.syncMax)] });
    return out;
  }
  stat(op, sync = 100) {
    return collectEffects(this.sources(), { chains: [], sync, backflow: 0, myelin: 0 }, 'turn')
      .filter(e => e.op === op).reduce((t, e) => t + (Number(e.v) || 0), 0);
  }
  syncMax() { return Math.max(10, 100 + this.stat('syncMax')); }
  ampouleSlots() { return Math.max(0, this.R.combat.ampouleSlots + this.stat('ampouleSlots')); }

  // ---- 抽選 ----
  weighted(w) { const items = Object.entries(w || {}).filter(([, v]) => v > 0).map(([id, weight]) => ({ id, weight })); return items.length ? this.rng.pickWeighted(items).id : null; }
  vRarities() { return this.reg.all('rarities').filter(r => r.group === 'vertebra').sort((a, b) => a.tier - b.tier); }
  rollVertebra(weights, o = {}) {
    let rid = this.weighted(weights) ?? 'STANDARD';
    if (o.rarityUp && this.rng.chance(o.rarityUp)) {
      const list = this.vRarities(), i = list.findIndex(r => r.id === rid);
      if (list[i + 1] && (weights?.[list[i + 1].id] || !list[i + 1].exclusive)) rid = list[i + 1].id;
    }
    // rarity を指定した義体（LOT-Ω の遺物など）は、そのレアリティのときだけ出る。そのレアリティ専用の義体がなければ通常の義体から選ぶ
    const ok = t => this.unlocked(t) && (!o.strain || t.strain === o.strain) && (!o.region || t.region === o.region);
    let pool = this.reg.all('vertebrae').filter(t => ok(t) && t.rarityOnly === rid);
    if (!pool.length) pool = this.reg.all('vertebrae').filter(t => ok(t) && !t.rarityOnly);
    const t = this.rng.pick(pool);
    const rar = this.reg.get('rarities', rid);
    const [a, b] = rar.affixes || [0, 0];
    const n = a + this.rng.int(b - a + 1);
    const affs = this.rng.shuffle(this.reg.all('affixes').filter(x => this.unlocked(x)).map(x => x.id)).slice(0, n);
    return { uid: this.s.uid++, tid: t.id, rarity: rid, affixes: affs };
  }
  addCodex(it) { if (!this.s.codex.includes(it.tid)) this.s.codex.push(it.tid); }

  // ---- 契約・潜行 ----
  modes() { return this.reg.all('modes').sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map(m => ({ ...m, locked: !this.unlocked(m), clears: this.s.records.clears[m.id] || 0 })); }
  get run() { return this.s.run; }
  // 深度で変わる値（depthTable の from 以上の行を順に上書き）を合わせたモード
  modeAt(m, floor) {
    if (!m) return m;
    let out = m;
    for (const row of m.depthTable || []) if (floor >= row.from) out = { ...out, ...row };
    return out;
  }
  mode() { return this.s.run ? this.modeAt(this.reg.get('modes', this.s.run.mode), this.s.run.floor) : null; }
  isFinal(m, f) { return m.floors > 0 && f >= m.floors; }
  // 汚染段階：every 層ごとに1段。段階 n では stages を先頭から n 個（足りなければ繰り返し）積む
  pollutionStage(m, f) { const P = m?.pollution; return P ? Math.floor((f - 1) / P.every) : 0; }
  pollutionSources(m, f) {
    const P = m?.pollution, n = this.pollutionStage(m, f), out = [];
    for (let i = 0; P && i < n; i++) { const st = P.stages[i % P.stages.length]; out.push({ id: `pol:${i}`, name: `汚染段階${i + 1}：${st.label}`, effect: st.effect, scale: 1, kind: 'pollution' }); }
    return out;
  }
  pollutionLabels(m, f) { return this.pollutionSources(m, f).map(x => x.name); }
  saturation(m, f) { const d = m?.desaturate; return d ? Math.max(d.min ?? 0.2, 1 - (f - 1) * d.perFloor) : 1; }
  // 開始できる深度：1 と、startStep 刻みで「最深到達の半分」まで
  startDepths(id) {
    const m = this.reg.get('modes', id);
    if (!m?.startStep) return [1];
    const half = Math.floor((this.s.records.deepest[id] ?? 0) / 2), out = [1];
    for (let f = m.startStep; f <= half; f += m.startStep) out.push(f);
    return out;
  }
  tutorialData() { return this.reg.all('tutorial')[0] ?? null; }
  startRun(modeId, start = 1) {
    const m = this.reg.get('modes', modeId);
    if (!m || !this.unlocked(m) || !this.s.diver || this.s.run) return false;
    if (!this.startDepths(modeId).includes(start)) start = 1;
    const slots = this.ampouleSlots();
    const amps = [...this.s.ampoules].slice(0, slots);
    for (const a of this.lineage()?.startAmpoules || []) if (amps.length < slots) amps.push(a);
    while (amps.length < slots) amps.push(null);
    this.s.ampoules = this.s.ampoules.slice(slots);   // 持ち出した分は潜行中の持ち物になる
    const syncMax = this.syncMax();
    const tut = this.tutorialData();
    this.s.run = {
      mode: m.id, floor: start - 1, startFloor: start, syn: 0, mutagens: [], ampoules: amps, sync: syncMax, syncMax, myelin: 0,
      gauge: Math.min(this.R.spineBreak.max, this.stat('startGauge')), found: [], phase: 'route', routes: [], route: null, battle: null, reward: null,
      stats: { maxDamage: { m: 0, e: 0 }, maxChain: 0, floors: start - 1 }, lastStandUsed: false, recovered: null,
      tutorial: !this.s.tutorial.done && tut?.mode === m.id, residueShown: [],
    };
    this.s.records.runs++; this.s.diver.runs++;
    this.emit('RUN_START', { mode: m.id });
    this.nextFloor();
    return true;
  }
  nextFloor() {
    const run = this.s.run, m = this.mode();
    run.floor++;
    run.myelin = (run.carryMyelin ?? 0) + this.stat('floorMyelin');
    run.carryMyelin = 0;
    run.routes = this.genRoutes();
    run.route = null; run.battle = null; run.reward = null; run.phase = 'route';
    const dp = this.s.records.deepest;
    if (run.floor > (dp[m.id] ?? 0)) dp[m.id] = run.floor;
    this.emit('DEPTH_REACHED', { mode: m.id, floor: run.floor, pollution: this.pollutionStage(m, run.floor) });
  }
  genRoutes() {
    const run = this.s.run, m = this.mode(), f = run.floor, reg = this.reg;
    const routes = reg.all('routes').filter(r => this.unlocked(r));
    const normal = routes.find(r => r.kind === 'normal'), elite = routes.find(r => r.kind === 'elite'), vault = routes.find(r => r.kind === 'vault');
    let out;
    if (isBossFloor(m, f)) out = [{ kind: 'normal', routeId: normal.id, enemy: pickEnemy(m, f, this.rng), boss: true }];
    else if (run.tutorial && f === this.tutorialData().floor) out = [{ kind: 'normal', routeId: normal.id, enemy: this.tutorialData().enemy, tutorial: true }];
    else {
      out = []; const used = new Set();
      for (let i = 0; i < (m.routeChoices ?? 2); i++) {
        const x = this.rng.next();
        if (vault && x < (m.vaultChance ?? 0) && !out.some(r => r.kind === 'vault')) { out.push({ kind: 'vault', routeId: vault.id, enemy: vault.enemy }); continue; }
        let pool = m.pool.filter(id => !used.has(id) && this.unlocked(reg.get('enemies', id)));
        if (!pool.length) pool = m.pool;
        const enemy = this.rng.pick(pool); used.add(enemy);
        if (elite && x < (m.vaultChance ?? 0) + (m.eliteChance ?? 0)) {
          const ed = reg.get('enemies', enemy);
          const g = elite.extraGimmicks.filter(gm => !(ed.gimmicks || []).some(e => e.place === gm.place));
          out.push({ kind: 'elite', routeId: elite.id, enemy, gimmick: this.rng.pick(g.length ? g : elite.extraGimmicks) });
        } else out.push({ kind: 'normal', routeId: normal.id, enemy });
      }
    }
    const w = this.s.wreck;
    if (w && w.mode === m.id && w.floor === f && w.items.length) for (const r of out) r.wreck = r.kind !== 'vault';
    return out;
  }
  routeInfo(r) {
    const reg = this.reg, ed = reg.get('enemies', r.enemy), rd = reg.get('routes', r.routeId);
    const places = new Set([...(ed.gimmicks || []), ...(r.gimmick ? [r.gimmick] : [])].map(g => g.place));
    if (!ed.passive) places.add('WEAKPOINT');
    return { ...r, enemyDef: ed, routeDef: rd, specials: [...places].map(id => reg.get('nodes', id)).filter(Boolean) };
  }
  chooseRoute(i) {
    const run = this.s.run;
    if (!run || run.phase !== 'route' || !run.routes[i]) return false;
    run.route = run.routes[i]; run.phase = 'battle'; run.battle = null;
    this.emit('ROUTE_ENTER', { mode: run.mode, floor: run.floor, kind: run.route.kind });
    const res = this.s.residue.filter(x => x.mode === run.mode && x.floor === run.floor && !run.residueShown.includes(x.specimen));
    for (const x of res.slice(0, 1)) { run.residueShown.push(x.specimen); this.queue.push({ event: 'RESIDUE', residue: [x], fragments: [], lines: [], texts: [], unlocked: [] }); }
    return true;
  }
  combatOptions() {
    const run = this.s.run, r = run.route, rd = this.reg.get('routes', r.routeId);
    return {
      mode: run.mode, floor: run.floor, enemy: r.enemy, mutagens: run.mutagens, ampoules: run.ampoules, ampouleSlots: this.ampouleSlots(),
      sync: run.sync, syncMax: run.syncMax, myelin: run.myelin, gauge: run.gauge,
      sources: [...this.sources(), ...this.pollutionSources(this.mode(), run.floor)],
      elite: r.kind === 'elite' ? { hpMul: rd.hpMul, gimmick: r.gimmick } : null, backflowOn: r.kind === 'elite' && !!rd.backflow,
      hpMul: r.kind === 'vault' ? rd.hpMul : 1, turnLimit: r.kind === 'vault' ? rd.turnLimit : 0,
      wreck: !!r.wreck, protectHp: !!r.tutorial && !this.s.tutorial.done, lastStandUsed: run.lastStandUsed,
    };
  }
  makeCombat() {
    const run = this.s.run;
    const o = this.combatOptions();
    const cb = new Combat(this.reg, this.rng, run.battle ? { ...o, restore: run.battle } : o);
    if (!o.protectHp) cb.protectHp = false;
    return cb;
  }
  // ターン開始時（と発火開始時）に呼ぶ：戦闘の状態を潜行データに書く
  saveBattle(cb) { if (this.s.run?.phase === 'battle') this.s.run.battle = cb.toJSON(); }
  // 1ターンの結果：記録と特殊条件ログ
  recordTurn(cb, ev) {
    const run = this.s.run, st = run.stats;
    if (ev.total.gt(B(st.maxDamage))) st.maxDamage = ev.total.toJSON();
    st.maxChain = Math.max(st.maxChain, cb.maxChain);
    const rec = this.s.records;
    if (ev.total.gt(B(rec.maxDamage))) rec.maxDamage = ev.total.toJSON();
    rec.maxChain = Math.max(rec.maxChain, cb.maxChain);
    if (this.s.diver && ev.total.gt(B(this.s.diver.maxDamage))) this.s.diver.maxDamage = ev.total.toJSON();
    this.emit('RECORD', {
      mode: run.mode, floor: run.floor, chains: ev.chainCount, overkill: ev.overkill, lastTime: ev.lastCommitTime, kill: !!ev.kill,
      crit: !!ev.crit, reflect: ev.steps.some(s => s.kind === 'reflect'), sync: cb.sync, damage: ev.total.toNumber(), resonanceMax: this.resonance().max,
    });
  }
  // 戦闘の終了（won / lost / closed）
  finishBattle(cb) {
    const run = this.s.run;
    run.battle = null; run.sync = cb.sync; run.gauge = cb.gauge; run.lastStandUsed = cb.lastStandUsed;
    run.ampoules = [...cb.ampoules]; run.mutagens = cb.mutagens.map(m => m.id);
    if (cb.wreckTaken && this.s.wreck?.items.length) {
      const it = this.rng.pick(this.s.wreck.items);
      run.found.push(it); run.recovered = it; this.s.wreck = null;
      this.queue.push({ event: 'WRECK', recovered: it, fragments: [], lines: [], texts: [], unlocked: [] });
    }
    if (cb.phase === 'lost') return this.lose(cb.lostCause ?? 'sync', cb);
    if (cb.phase === 'closed') { run.reward = { closed: true, syn: 0, mutagens: [] }; run.phase = 'choice'; return { closed: true }; }
    return this.floorClear(cb);
  }
  floorClear(cb) {
    const run = this.s.run, m = this.mode(), f = run.floor, rd = this.reg.get('routes', run.route.routeId);
    const boss = !!run.route.boss, kind = run.route.kind;
    const over = cb.bestDamage.gte(cb.enemy.hpMax.mul(this.R.run.overkill));
    const syn = Math.round(m.synPerFloor * f * (rd.synMul ?? 1) * (1 + this.stat('synGain', run.sync) / 100) * (over ? 1 + this.R.run.overkillBonus : 1));
    run.syn += syn;
    run.syn += cb.bombs * this.stat('synPerBomb');
    run.stats.floors = f;
    run.carryMyelin = cb.myelin * this.stat('myelinCarry');
    run.sync = Math.min(run.syncMax, run.sync + this.stat('floorHeal'));
    // 義体
    let vert = null;
    if (kind !== 'vault' && (boss || kind === 'elite' || this.rng.chance(m.vertebraDrop ?? 0))) {
      vert = this.rollVertebra(boss ? m.bossRarity : m.vertebraRarity, { rarityUp: kind === 'elite' ? rd.rarityUp : 0 });
      run.found.push(vert);
    }
    // アンプル
    let amp = null, ampLost = false;
    if (rd.ampoule || this.rng.chance(this.R.run.ampouleDrop)) {
      const list = this.reg.all('ampoules').filter(a => this.unlocked(a));
      amp = this.rng.pickWeighted(list.map(a => ({ ...a, weight: a.rare ? 1 : 6 }))).id;
      const i = run.ampoules.indexOf(null);
      if (i >= 0) run.ampoules[i] = amp; else ampLost = true;
    }
    const final = this.isFinal(m, f);
    const mutagens = kind === 'vault' ? [] : this.genMutagens(kind === 'elite' ? rd.mutagenTierUp ?? 1 : 0);
    run.reward = { syn, synOption: Math.round(syn * this.R.run.rewardSyn), mutagens, vertebra: vert, ampoule: amp, ampouleLost: ampLost, overkill: over, final };
    this.emit('FLOOR_CLEAR', { mode: m.id, floor: f, boss, kind });
    if (final) {
      this.s.records.clears[m.id] = (this.s.records.clears[m.id] || 0) + 1;
      this.emit('MODE_CLEAR', { mode: m.id, floor: f });
    }
    run.phase = mutagens.length ? 'reward' : (final ? 'final' : 'choice');
    return { won: true, final };
  }
  genMutagens(tierUp = 0) {
    const run = this.s.run, m = this.mode(), reg = this.reg;
    const tiers = reg.all('rarities').filter(r => r.group === 'mutagen').sort((a, b) => a.tier - b.tier).map(r => r.id);
    const w = {};
    for (const [id, v] of Object.entries(m.mutagenRarity || {})) { const i = Math.min(tiers.length - 1, tiers.indexOf(id) + tierUp); w[tiers[i]] = (w[tiers[i]] || 0) + v; }
    const adaptive = this.stat('rewardChoices');
    let n = this.R.run.mutagenChoices;
    if (adaptive >= 2 || (adaptive >= 1 && run.floor === 1)) n++;
    const counts = {};
    for (const { item } of this.equippedItems()) { const st = this.tmpl(item).strain; counts[st] = (counts[st] || 0) + 1; }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const all = reg.all('mutagens').filter(x => this.unlocked(x) && !run.mutagens.includes(x.id));
    const out = [];
    for (let i = 0; i < n; i++) {
      let rid = this.weighted(w);
      if (i === 0 && adaptive >= 3) rid = tiers[Math.max(tiers.indexOf(rid), tiers.indexOf('RARE'))];
      let cand = all.filter(x => x.rarity === rid && !out.includes(x.id));
      if (!cand.length) cand = all.filter(x => !out.includes(x.id));
      if (!cand.length) break;
      out.push(this.rng.pickWeighted(cand.map(x => ({ ...x, weight: x.strain === top ? this.R.run.strainWeight : 1 }))).id);
    }
    return out;
  }
  // choice: { type: 'mutagen', id, replace } / { type: 'syn' } / { type: 'skip' }
  takeReward(choice) {
    const run = this.s.run;
    if (!run || run.phase !== 'reward') return { ok: false };
    if (choice.type === 'mutagen') {
      if (!run.reward.mutagens.includes(choice.id)) return { ok: false };
      if (run.mutagens.length >= this.R.combat.mutagenSlots) {
        if (choice.replace == null) return { ok: false, needReplace: true };
        run.mutagens.splice(choice.replace, 1);
      }
      run.mutagens.push(choice.id);
    } else if (choice.type === 'syn') run.syn += run.reward.synOption;
    run.phase = run.reward.final ? 'final' : 'choice';
    return { ok: true };
  }
  dive() {
    const run = this.s.run;
    if (!run || run.phase !== 'choice') return false;
    run.sync = Math.min(run.syncMax, run.sync + this.R.run.diveHeal);
    this.nextFloor();
    return true;
  }
  // 潜行記録カード用：背骨の状態
  spineSnapshot(items = null) {
    const list = items ?? this.equippedItems().map(e => e.item);
    const res = this.resonance();
    const tiers = [];
    for (const st of this.reg.all('strains')) for (const t of st.resonance || []) if ((res.counts[st.id] || 0) >= t.at) tiers.push(`${st.name}${t.at}`);
    return { items: list.map(i => ({ tid: i.tid, rarity: i.rarity, region: this.tmpl(i)?.region })), tiers, sockets: Object.fromEntries(this.regions().map(r => [r.id, this.socketCount(r.id)])) };
  }
  saveBest(result) {
    const b = this.s.bestCards, dmg = B(result.stats?.maxDamage ?? 0);
    if (!b.maxDamage || dmg.gt(B(b.maxDamage.stats?.maxDamage ?? 0))) b.maxDamage = clone(result);
    const depthKey = r => (this.reg.get('modes', r.mode)?.order ?? 0) * 100000 + (r.floor ?? 0);
    if (!b.deepest || depthKey(result) > depthKey(b.deepest)) b.deepest = clone(result);
  }
  extract() {
    const run = this.s.run;
    if (!run || !['choice', 'final'].includes(run.phase)) return null;
    const m = this.mode(), final = run.phase === 'final';
    const gain = Math.round(run.syn * (final ? this.R.run.finalBonus : 1));
    this.s.syn += gain;
    for (const it of run.found) { this.s.vault.push(it); this.addCodex(it); }
    this.s.ampoules = [...run.ampoules.filter(Boolean), ...this.s.ampoules];
    const d = this.s.diver, lvBefore = this.careerLevel();
    const pts = run.stats.floors * (m.careerCoef ?? 1) * (final ? this.R.career.finalMul : 1) * (1 + this.stat('careerMul'));
    d.points += pts; d.extracts++;
    if (!d.deepest || (m.order ?? 0) > (this.reg.get('modes', d.deepest.mode)?.order ?? 0) || (d.deepest.mode === m.id && run.stats.floors > d.deepest.floor)) d.deepest = { mode: m.id, floor: run.stats.floors };
    this.s.records.extracts++;
    const result = { type: 'extract', final, mode: m.id, floor: run.floor, floors: run.stats.floors, synGain: gain, found: run.found, stats: run.stats,
      careerPoints: pts, levelBefore: lvBefore, levelAfter: this.careerLevel(), specimen: this.s.specimen, lineage: d.lineage, mutagens: run.mutagens,
      spine: this.spineSnapshot(), pollution: this.pollutionStage(m, run.floor), date: Date.now() };
    this.saveBest(result);
    this.emit('EXTRACT', { mode: m.id, floor: run.stats.floors, final });
    this.s.run = null; this.s.lastResult = result; if (this.s.shop) this.s.shop.stale = true;
    return result;
  }
  lose(cause, cb) {
    const run = this.s.run, m = this.mode();
    const destroyed = this.equippedItems().map(e => e.item);
    const spine = this.spineSnapshot(destroyed);
    const ids = new Set(destroyed.map(i => i.uid));
    this.s.vault = this.s.vault.filter(i => !ids.has(i.uid));
    for (const r of this.regions()) this.s.equipped[r.id] = [null, null];
    const rate = Math.min(0.9, this.R.run.residue + this.stat('residueRate') / 100);
    const gain = Math.round(run.syn * rate);
    this.s.syn += gain;
    const words = this.reg.all('story').filter(x => x.type === 'lastword');
    const word = words.length ? this.rng.pick(words).text : '';
    const entry = { specimen: this.s.specimen, mode: m.id, floor: run.floor, lastDamage: fmt(B(run.stats.maxDamage)),
      broken: destroyed.map(i => `${this.regions().find(r => r.id === this.tmpl(i).region)?.name}《${this.tmpl(i).name}》`), cause, word };
    this.s.residue.unshift(entry); this.s.residue = this.s.residue.slice(0, 20);
    this.s.wreck = destroyed.length ? { mode: m.id, floor: run.floor, items: destroyed, specimen: this.s.specimen } : null;
    this.s.records.lost++;
    this.emit('LOST', { mode: m.id, floor: run.floor, cause });
    const result = { type: 'lost', cause, mode: m.id, floor: run.floor, synGain: gain, rate, destroyed, foundLost: run.found, stats: run.stats,
      specimen: this.s.specimen, lineage: this.s.diver.lineage, residue: entry, mutagens: run.mutagens, levelBefore: this.careerLevel(),
      spine, pollution: this.pollutionStage(m, run.floor), date: Date.now() };
    this.saveBest(result);
    this.s.specimen++; this.s.diver = null; this.s.run = null; this.s.lastResult = result; if (this.s.shop) this.s.shop.stale = true;
    return result;
  }
  completeTutorial() { this.s.tutorial.done = true; if (this.s.run) this.s.run.tutorial = false; }

  // ---- 殿堂入り（保存処置）と培養プロトコル ----
  canPreserve() { return !!this.s.diver && !this.s.run && this.careerLevel() >= this.R.career.preserveMin; }
  preserveOptions() {
    if (!this.canPreserve()) return [];
    if (this.s.preserveOffer) return this.s.preserveOffer;
    const C = this.R.career, lv = this.careerLevel(), lin = this.lineage();
    let n = 0, tier = 1;
    for (const [at, k] of C.choices) if (lv >= at) n = k;
    for (const [at, t] of C.tierByLevel) if (lv >= at) tier = t;
    const counts = {};
    for (const { item } of this.equippedItems()) { const st = this.tmpl(item).strain; counts[st] = (counts[st] || 0) + 1; }
    const strain = lin?.strain ?? Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'SPINE';
    const pool = this.reg.all('traits').filter(t => this.unlocked(t));
    const out = [];
    for (let i = 0; i < n; i++) {
      let t = Math.min(3, tier + (this.rng.chance(C.tierUpChance) ? 1 : 0));
      const cand = pool.filter(x => !out.some(o => o.id === x.id) && (x.minTier ?? 1) <= t);
      if (!cand.length) break;
      const pick = this.rng.pickWeighted(cand.map(x => ({ ...x, weight: (x.strains || []).includes(strain) || x.strainMemory ? 3 : 1 })));
      if (pick.minTier) t = Math.max(t, pick.minTier);
      out.push({ id: pick.id, tier: t, strain: pick.strainMemory ? strain : null });
    }
    this.s.preserveOffer = out;
    return out;
  }
  preserve(i) {
    const opt = this.preserveOptions()[i];
    if (!opt) return null;
    const d = this.s.diver, lv = this.careerLevel();
    const spine = this.spineSnapshot();   // 義体は砕けずに倉庫へ（下で外す）
    for (const r of this.regions()) this.s.equipped[r.id] = [null, null];
    const spec = { specimen: this.s.specimen, lineage: d.lineage, level: lv, runs: d.runs, extracts: d.extracts, deepest: d.deepest,
      maxDamage: d.maxDamage, trait: opt, retiredAt: Date.now(), spine };
    this.s.shelf.push(spec);
    if (this.s.protocol.length < this.protocolSlots()) this.s.protocol.push(this.s.shelf.length - 1);
    this.emit('PRESERVE', { lineage: d.lineage, level: lv });
    this.s.lastResult = { type: 'preserve', ...spec, date: Date.now() };
    this.s.specimen++; this.s.diver = null; this.s.preserveOffer = null;
    return spec;
  }
  protocolSlots() {
    const P = this.R.protocol;
    return Math.min(P.max, P.base + [...this.mem.flags].filter(f => f.startsWith(P.flagPrefix)).length);
  }
  protocolTraits() {
    return this.s.protocol.slice(0, this.protocolSlots()).map(i => this.s.shelf[i]?.trait).filter(Boolean)
      .map(t => ({ ...t, def: this.reg.get('traits', t.id) })).filter(t => t.def);
  }
  setProtocol(slot, shelfIndex) {
    if (slot >= this.protocolSlots() || this.s.run) return false;
    const p = this.s.protocol.filter(i => i !== shelfIndex);
    if (shelfIndex == null) p.splice(slot, 1);
    else if (this.s.shelf[shelfIndex]?.trait) p.splice(Math.min(slot, p.length), slot < p.length ? 1 : 0, shelfIndex);
    this.s.protocol = p.slice(0, this.protocolSlots());
    return true;
  }

  // ---- ブローカー ----
  shopWeights() {
    const open = this.modes().filter(m => !m.locked && m.shopRarity);
    return open.at(-1)?.shopRarity ?? { STANDARD: 100 };
  }
  price(it) { const S = this.R.shop; return Math.round((S.price[it.rarity] ?? 3000) * (1 + S.affixPrice * it.affixes.length)); }
  sellPrice(it) { return Math.round(this.price(it) * this.R.shop.sellRate); }
  shop() {
    if (!this.s.shop || this.s.shop.stale) {
      const items = [];
      for (let i = 0; i < this.R.shop.stock; i++) { const inst = this.rollVertebra(this.shopWeights()); items.push({ inst, price: this.price(inst) }); }
      this.s.shop = { items, stale: false };
    }
    return this.s.shop;
  }
  buy(i) {
    const x = this.shop().items[i];
    if (!x || this.s.syn < x.price || this.s.run) return false;
    this.s.syn -= x.price; this.s.vault.push(x.inst); this.addCodex(x.inst); this.s.shop.items.splice(i, 1);
    return true;
  }
  strainPrice() { return Math.round(this.R.shop.price.STANDARD * this.R.shop.strainMul); }
  buyStrain(strain) {
    const p = this.strainPrice();
    if (this.s.syn < p || this.s.run || !this.reg.get('strains', strain)) return null;
    this.s.syn -= p;
    const it = this.rollVertebra({ STANDARD: 100 }, { strain });
    this.s.vault.push(it); this.addCodex(it);
    return it;
  }
  sell(uid) {
    const it = this.item(uid);
    if (!it || this.isEquipped(uid) || this.s.run) return false;
    this.s.syn += this.sellPrice(it); this.s.vault = this.s.vault.filter(i => i.uid !== uid);
    return true;
  }
  ampoulePrice(a) { return a.rare ? this.R.shop.ampouleRarePrice : this.R.shop.ampoulePrice; }
  buyAmpoule(id) {
    const a = this.reg.get('ampoules', id);
    if (!a || !this.unlocked(a) || this.s.run || this.s.syn < this.ampoulePrice(a) || this.s.ampoules.length >= this.ampouleSlots()) return false;
    this.s.syn -= this.ampoulePrice(a); this.s.ampoules.push(id);
    return true;
  }
  opticNext() { return this.R.shop.optic.find(o => o.lv === this.s.optic + 1) ?? null; }
  upgradeOptic() { const n = this.opticNext(); if (!n || this.s.syn < n.price || this.s.run) return false; this.s.syn -= n.price; this.s.optic = n.lv; return true; }
  expandVault() { const p = this.R.shop.vaultPrice; if (this.s.syn < p || this.s.run) return false; this.s.syn -= p; this.s.vaultExp++; return true; }
}

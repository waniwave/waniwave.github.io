// 差し込み口（仕様書 第9章「差し込み口」）
//
// 2つの仕組みを持つ。
//  - 差し込み口（run）：処理を包む。各差し込みは (ctx, next) => {} の形で、
//    値を読み書きして next() を呼ぶ。呼ばなければ元の処理を止められる。2回呼べば2回通る。
//  - 合図（emit）：「採点時」「ターン終了」など、効果が反応するきっかけ。登録順に呼ぶだけ。
//
// どちらも同じ並び順：席の並び → 出した順 → 置物 → 宿泊客 → 層の癖 →（敵の特注）。
// 連鎖（呼び出し回数）は1つの行動につき CHAIN_LIMIT 回まで。超えた分は飛ばして記録する。
// 差し込みが例外を投げたら、その差し込みだけを無かったことにして続け、記録する。

export const HOOK_NAMES = Object.freeze([
  // 潜行
  'dive.start', 'floor.enter', 'room.enter', 'landing', 'dive.extract', 'dive.death', 'reward.roll', 'shop.roll',
  // 戦闘
  'battle.start', 'turn.start', 'draw.after', 'play.before', 'play.after', 'hand.evaluate', 'score.order', 'score.card', 'score.overlap',
  'score.held', 'score.regulars', 'score.relics', 'score.final', 'damage.apply', 'enemy.defeated', 'overkill',
  'turn.end', 'enemy.before', 'enemy.act', 'battle.end',
  // 番付・表示
  'banzuke.change', 'number.format', 'fx.queue',
]);

/** 合図（効果の when に書けるもの、20） */
export const SIGNALS = Object.freeze([
  '採点時', '手札に残る', '受けに回る', '出し', '出しの前', '出しの後', '流した時', '引いた時',
  'ターン開始', 'ターン終了', '戦闘開始', '戦闘終了', '敵を倒した時', '過剰論破の時', '敵の行動の前',
  '階に入った時', '部屋に入った時', '踊り場', '脱出時',
]);

/** 並び順のまとまり */
export const GROUPS = Object.freeze({ seat: 0, played: 1, relic: 2, guest: 3, quirk: 4, enemy: 5 });

/** 1つの行動あたりの連鎖の上限 */
export const CHAIN_LIMIT = 200;

let seq = 0;

export class Hooks {
  /** @param {{onError?: (e: object) => void, onLimit?: (e: object) => void}} [opts] */
  constructor(opts = {}) {
    this.handlers = new Map();   // 差し込み口名 → [{fn, group, index, owner, tag, seq}]
    this.listeners = new Map();  // 合図 → [...]
    this.sorted = new Map();
    this.chain = 0;
    this.limitHit = false;
    this.errors = [];
    this.onError = opts.onError || null;
    this.onLimit = opts.onLimit || null;
  }

  /**
   * 差し込み口に登録する
   * @param {string} name 差し込み口の名前
   * @param {(ctx: any, next: () => any) => any} fn
   * @param {{group?: keyof GROUPS, index?: number, owner?: object, tag?: string}} [opt]
   * @returns {() => void} 外す関数
   */
  add(name, fn, opt = {}) {
    if (!HOOK_NAMES.includes(name)) throw new Error(`知らない差し込み口「${name}」`);
    return this._put(this.handlers, name, fn, opt);
  }

  /** 合図に登録する */
  on(signal, fn, opt = {}) {
    if (!SIGNALS.includes(signal)) throw new Error(`知らない合図「${signal}」`);
    return this._put(this.listeners, signal, fn, opt);
  }

  _put(map, name, fn, opt) {
    if (typeof fn !== 'function') throw new TypeError(`「${name}」に関数でないものを登録した`);
    const group = opt.group ?? 'guest';
    if (!(group in GROUPS)) throw new Error(`知らない並び「${group}」`);
    const h = { fn, group, index: opt.index ?? 0, owner: opt.owner ?? null, tag: opt.tag ?? null, seq: seq++ };
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(h);
    this.sorted.clear();
    return () => {
      const list = map.get(name);
      const i = list ? list.indexOf(h) : -1;
      if (i >= 0) { list.splice(i, 1); this.sorted.clear(); }
    };
  }

  /** 同じ tag で登録したものをまとめて外す */
  removeTag(tag) {
    for (const map of [this.handlers, this.listeners]) {
      for (const [k, list] of map) map.set(k, list.filter((h) => h.tag !== tag));
    }
    this.sorted.clear();
  }

  _list(map, name, kind) {
    const key = `${kind}:${name}`;
    if (!this.sorted.has(key)) {
      const list = (map.get(name) || []).slice().sort((a, b) =>
        GROUPS[a.group] - GROUPS[b.group] || a.index - b.index || a.seq - b.seq);
      this.sorted.set(key, list);
    }
    return this.sorted.get(key);
  }

  /** 行動の始めに連鎖の数を戻す */
  beginChain() { this.chain = 0; this.limitHit = false; }

  _tick(h, name) {
    if (this.chain >= CHAIN_LIMIT) {
      if (!this.limitHit) {
        this.limitHit = true;
        const e = { hook: name, owner: h.owner, message: `連鎖が${CHAIN_LIMIT}回を超えたので止めた` };
        this.errors.push(e);
        if (this.onLimit) this.onLimit(e);
      }
      return false;
    }
    this.chain++;
    return true;
  }

  _fail(h, name, err) {
    const e = { hook: name, owner: h.owner, message: String(err && err.message ? err.message : err) };
    this.errors.push(e);
    if (this.onError) this.onError(e);
  }

  /**
   * 差し込み口を通して core を実行する
   * @param {string} name @param {any} ctx @param {(ctx:any)=>any} [core]
   */
  run(name, ctx, core) {
    if (!HOOK_NAMES.includes(name)) throw new Error(`知らない差し込み口「${name}」`);
    const list = this._list(this.handlers, name, 'h');
    const call = (i) => {
      if (i >= list.length) return core ? core(ctx) : undefined;
      const h = list[i];
      if (!this._tick(h, name)) return call(i + 1);
      let nexted = false;
      const next = () => { nexted = true; return call(i + 1); };
      try {
        return h.fn(ctx, next);
      } catch (err) {
        this._fail(h, name, err);
        if (!nexted) return call(i + 1);
        return undefined;
      }
    };
    return call(0);
  }

  /**
   * 合図を出す
   * @param {string} signal @param {any} ctx
   * @param {(h: {group:string, index:number, owner:any}) => boolean} [filter] 呼ぶ相手を絞る
   */
  emit(signal, ctx, filter) {
    if (!SIGNALS.includes(signal)) throw new Error(`知らない合図「${signal}」`);
    for (const h of this._list(this.listeners, signal, 'l')) {
      if (filter && !filter(h)) continue;
      if (!this._tick(h, signal)) continue;
      try { h.fn(ctx); } catch (err) { this._fail(h, signal, err); }
    }
  }

  /** その合図に反応するものがあるか */
  has(signal, filter) {
    return this._list(this.listeners, signal, 'l').some((h) => !filter || filter(h));
  }
}

/**
 * 差し込み口の説明（docs/hooks.md に書き出す）。ctx は差し込みに渡る中身。
 * 共通：battle（戦闘の状態）、env（balance・content・hooks・rng）
 */
export const HOOK_INFO = {
  'dive.start': { when: '潜行の始め（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く）', ctx: 'dive' },
  'floor.enter': { when: '階に入ったとき（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く）', ctx: 'dive, floor' },
  'room.enter': { when: '部屋に入ったとき（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く）', ctx: 'dive, room' },
  landing: { when: '踊り場に着いたとき（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く）', ctx: 'dive' },
  'dive.extract': { when: '脱出したとき（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く）', ctx: 'dive' },
  'dive.death': { when: '未帰還になったとき（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く）', ctx: 'dive' },
  'reward.roll': { when: '報酬を決めるとき（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く）', ctx: 'dive, reward' },
  'shop.roll': { when: '商いの品揃えを決めるとき（先行版ではまだ呼ばれない。持ち物の合図は fx の when「階に入った時」などで書く）', ctx: 'dive, shop' },
  'battle.start': { when: '戦闘の始め（山札を切った後、最初のターンの前）', ctx: 'battle, env' },
  'turn.start': { when: 'ターンの始め（引いて、伏せを決めた後）', ctx: 'battle, env' },
  'draw.after': { when: '札を引いた後（1回の引きごと）', ctx: 'battle, env, cards（引いた札）' },
  'play.before': { when: '出す直前（手札から出した後、組の判定の前）', ctx: 'battle, env, cards（出した札）, target（狙った敵の番号）, choices' },
  'hand.evaluate': { when: '組の判定。next() の後で ctx.result を書き換えれば判定を差し替えられる。next() の前に views を書き換えれば見え方を変えられる', ctx: 'battle, env, cards, views（{tier, cats, stone}）, strengths, result（{hand, scored, kickers, flushCats}）, choices' },
  'score.order': { when: '採点の順番を決めるとき（採点札の前）', ctx: '採点の場 sc（下）。sc.scored を並べ替えてよい' },
  'score.card': { when: '採点札1枚ごと（a 強さ〜f 宿泊客）。next() を2回呼べば2回採点', ctx: '採点の場 sc、sc.card（いまの札）' },
  'score.overlap': { when: '採点札のあと、重なり（同じカテゴリの枚数）で倍率を掛けるところ', ctx: '採点の場 sc、sc.overlap（カテゴリ→枚数）' },
  'score.held': { when: '手札に残った札1枚ごと（鋼、合図「手札に残る」）', ctx: '採点の場 sc、sc.card' },
  'score.regulars': { when: '常連客の段（左の席から全員）', ctx: '採点の場 sc、sc.regular（いまの常連客）' },
  'score.relics': { when: '置物の段（手に入れた順に全部）', ctx: '採点の場 sc、sc.relic' },
  'score.final': { when: '最後の S×M の直前', ctx: '採点の場 sc。sc.minM（倍率の下限）を変えられる' },
  'play.after': { when: '出し終えた後（与えて、受けを足し、捨て札にした後）', ctx: 'battle, env, cards, hand（組）, V（論破値）, choices' },
  'damage.apply': { when: '論破値を敵に与えるとき（貫通を含む）', ctx: 'battle, env, V, target, hits' },
  'enemy.defeated': { when: '敵を1体倒すとき。next() を呼ばなければ倒されない', ctx: 'battle, env, enemy' },
  overkill: { when: '全滅させたとき（過剰論破の判定）', ctx: 'battle, env, V, r（倍数）, level, rank, rewards' },
  'turn.end': { when: 'ターンの終わり（敵の番の前）', ctx: 'battle, env' },
  'enemy.before': { when: '敵が1体行動する直前', ctx: 'battle, env, enemy' },
  'enemy.act': { when: '敵の行動。next() を呼ばなければ行動しない', ctx: 'battle, env, enemy（enemy.intent が行動）' },
  'battle.end': { when: '戦闘の終わり（勝ち・未帰還・脱出）', ctx: 'battle, env, result' },
  'banzuke.change': { when: '番付が動くとき。next() を呼ばなければ動かない', ctx: 'battle, env, cat, from, to, src' },
  'number.format': { when: '数を画面に出すとき', ctx: 'value, text' },
  'fx.queue': { when: '出しの演出の手順を積むとき', ctx: 'battle, env, cards, hand, fx（[{show, arg, src}] に足す）' },
};

/** 採点の場 sc の中身（docs/hooks.md に書き出す） */
export const SCORE_CTX = 'battle, env, hand（組）, level（段位）, played, scored（採点札）, kickers（受け札）, held（手札に残った札）, target, choices, S, M, steps, banzukeMul, finalMuls, minM、addS(数, 出どころ) addM() mulM() mulS() note()';

// 演出の試し場：論破値を指定して段階・桁越えを再生し、組み込みの演出部品（show）を一つずつ鳴らす
import { h, toast } from '../dom.js';
import { Big } from '../../engine/big.js';
import { UNITS, unitOf } from '../../engine/format.js';
import { num, unitColor } from '../num.js';
import { SHOW_NAMES, SHOWS, playShow, playStage, playKetagoe, stageOf, rollNumber, godDescent } from '../fx/shows.js';
import { SE, playBgm, stopBgm, startHeart, stopHeart } from '../audio/audio.js';
import { confetti, embers, shards, sparkle } from '../fx/particles.js';
import { maxGlowsPerSecond } from '../fx/flash.js';

const ARGS = { 揺れ: '大', 筆文字: '論破', カットイン: 'ター深', 吹き出し: 'それな', スタンプ: '可', 背景色: '#2f5d9c', 横切る: '串', 早口字幕: 'つまりそういうことなんですよ', 音: '太鼓' };

export function fxLabScreen(ctx) {
  const { queue } = ctx;
  const root = h('div.scr.lab.fxlab');
  const vIn = h('input', { value: '1.5e9', inputmode: 'decimal' });
  const cIn = h('input', { value: '1000', inputmode: 'decimal' });
  const calc = h('div.calc', {}, [h('div.hd', { text: '論破値' }), h('div.nums', {}, [h('span.v', { text: '0' })])]);
  const card = h('div.card.fakecard', {}, [h('div.nm', { text: '試し札' })]);
  const foe = h('div.foe.fakefoe', {}, [h('div.nm', { text: '敵' }), h('div.bar', {}, [h('i')])]);
  const stage = h('div.fxstage', {}, [card, calc, foe]);
  const X = () => ({ queue, root, layer: queue.layer, cards: [card], foes: [foe] });
  const big = (s) => { try { return Big.from(String(s).trim()); } catch { return null; } };

  /** 数え上げ→回転→敵へ→段階→桁越え（論破値と主張を指定） */
  function runCount(force) {
    const V = big(vIn.value); const C = big(cIn.value);
    if (!V || !C) { toast('数を入れる'); return; }
    const stg = force ?? stageOf(V, C);
    const v = calc.querySelector('.v');
    calc.classList.remove('burn');
    foe.querySelector('i').style.width = '100%';
    const T = [];
    for (let i = 0; i < 4; i++) T.push({ ms: 180, run: () => { queue.bounce(card); queue.pop(`+${i * 3 + 2}`, card, calc, 's'); SE.score(i); } });
    T.push({ ms: 220, run: () => { queue.pop('×3', card, calc, 'x'); queue.slam(calc); SE.taiko(); } });
    T.push({ ms: 660, run: () => { rollNumber(v, num(V), queue, unitColor(V)); queue.slam(calc); SE.taiko(); if (V.gte(C)) { calc.classList.add('burn'); embers(180, 200, 18, 200); } } });
    T.push({ ms: 400, run: () => { queue.pop(`−${num(V.gt(C) ? C : V)}`, calc, foe, 'dmg'); queue.later(() => { foe.querySelector('i').style.width = V.gte(C) ? '0%' : `${Math.max(0, 100 - V.div(C).toNumber() * 100)}%`; SE.hit(); }, 240); } });
    let ms1 = 0; T.push({ get ms() { return ms1; }, run: () => { ms1 = playStage(stg, X()); } });
    let ms2 = 0; T.push({ get ms() { return ms2; }, run: () => { ms2 = playKetagoe(X(), unitOf(V), unitColor(V)); } });
    queue.play(T).then(() => { info.textContent = `段階：${stg ?? 'なし'}・単位：${unitOf(V) || 'なし'}・秒間の光の最多 ${maxGlowsPerSecond()}`; });
  }
  const info = h('p.q', { text: '' });
  const btn = (t, fn, cls = '') => h(`button.chip${cls}`, { type: 'button', onclick: fn }, [t]);
  const one = (fn) => () => { let ms = 0; queue.play([{ get ms() { return ms; }, run: () => { ms = fn() ?? 0; } }]); };

  root.append(
    h('div.ztop', {}, [h('h2', { text: '演出の試し場' }), h('button.btn', { type: 'button', onclick: () => ctx.back() }, ['戻る'])]),
    stage,
    h('div.grid2', {}, [h('label', {}, ['論破値（例 1.5e9）', vIn]), h('label', {}, ['狙った敵の残り主張', cIn])]),
    h('div.chips', {}, [
      btn('再生（段階は自動）', () => runCount(), '.on'),
      ...['燃える', '論破', '大論破', '完全論破', 'ター深'].map((s) => btn(s, () => runCount(s))),
    ]),
    info,
    h('h3', { text: '桁越え（単位を画面いっぱいに）' }),
    h('div.chips', {}, [...UNITS.slice(1), '無量大数²', 'ター'].map((u, i) => btn(u, one(() => playKetagoe(X(), u, unitColor(`1e${u === "ター" ? 700 : u === "無量大数²" ? 140 : (i + 1) * 4}`)))))),
    h('h3', { text: `演出部品（show ${SHOW_NAMES.length}種）` }),
    h('div.chips', {}, SHOW_NAMES.map((n) => btn(n, one(() => playShow(n, ARGS[n], X()))))),
    h('h3', { text: '拾う瞬間・粒子' }),
    h('div.chips', {}, [
      btn('宝箱（極：4回）', one(() => { for (let i = 0; i < 4; i++) queue.later(() => { SE.chest(); card.animate([{ transform: 'rotate(0)' }, { transform: `rotate(${i % 2 ? 9 : -9}deg)` }, { transform: 'rotate(0)' }], { duration: queue.dur(260) }); }, i * 380); return 1600; })),
      btn('神格', one(() => godDescent(X(), '神の札'))),
      btn('紙吹雪', one(() => { confetti(80); return 300; })),
      btn('火の粉', one(() => { embers(190, 300, 40, 300); return 300; })),
      btn('砕ける片', one(() => { shards(card.getBoundingClientRect(), '#8a7f6e', 24); return 300; })),
      btn('金の光', one(() => { sparkle(190, 300, 60); return 300; })),
    ]),
    h('h3', { text: '音' }),
    h('div.chips', {}, [
      ...Object.keys(SE).map((k) => btn(k, () => SE[k](3))),
      btn('BGM 宿', () => playBgm('宿')), btn('BGM 第一層', () => playBgm('layer1')), btn('BGM 第二層', () => playBgm('layer2', -4)), btn('BGM 層主', () => playBgm('層主')),
      btn('心音（踊り場）', () => { stopBgm(); startHeart(); }), btn('止める', () => { stopBgm(); stopHeart(); }),
    ]),
    h('p.note', { text: 'どの演出も画面をタップすると早送り。' }),
  );
  return { el: root };
}

// 図鑑：札・常連客・置物・敵・実績・記録・印・キーワード（タブ）。名前を押すと説明。見たことのない物は影だけ
import { h, tip, esc } from '../dom.js';
import { cardTip, enemyTip, kwLines, catGlyph, catColor, GRADE_COLOR, tierLabel, comboEffText, comboView } from '../labels.js';
import { thingFx } from '../things.js';
import { makeEnemy, makeBattleCard } from '../../engine/battle.js';
import { num as format } from '../num.js';

export function zukanScreen(ctx) {
  const { base } = ctx;
  const C = base.content;
  const env = { content: C, balance: base.balance };
  const H = ctx.title?.().H ?? ctx.H?.() ?? null;
  const seenL = H?.codex?.seen ?? null;
  const ownedL = H?.codex?.owned ?? null;
  const known = (id) => !seenL || seenL.includes(id) || ownedL?.includes(id);
  let tab = '札';
  const body = h('div.zbody');
  const tabs = h('div.chips.ztabs');
  const count = h('p.q.zcount');
  const shadow = (d) => h('div.zrow.shadow', {}, [h('b', { text: '？？？' }), h('span.q', { text: d.grade ?? d.kind ?? '' }), h('span.zset', { text: C.sets[d.set]?.name ?? '' })]);
  const tally = (list) => { const k = list.filter((d) => known(d.id)).length; count.textContent = `${k}／${list.length}`; };
  const things = (bucket, filter = () => true) => Object.values(C[bucket]).filter((d) => d.set !== '仮' && !d.id.startsWith('__') && filter(d));
  const TABS = {
    札: () => {
      const list = things('cards');
      tally(list);
      return list.map((d) => {
        if (!known(d.id)) return shadow(d);
        const c = makeBattleCard({ uid: `z_${d.id}`, id: d.id }, d);
        const el = h('div.zrow', { style: { '--g': GRADE_COLOR[d.grade] } }, [
          h('b', { text: d.name }),
          h('span.q', {}, [`${d.grade ? (env.balance.rarity.gradeFloor[d.grade] ?? '') : ''} `, ...(d.cat || []).map((x) => h('span.glyph', { style: { background: catColor(x) } }, [catGlyph(x)]))]),
          h('span.zset', { text: [C.sets[d.set]?.name ?? '', ownedL?.includes(d.id) ? '持った' : ''].filter(Boolean).join(' ') }),
          h('span.zfx', { text: thingFx(base, { type: 'card', id: d.id }) }),
        ]);
        tip(el, () => cardTip(env, c));
        return el;
      });
    },
    コンボ: () => {
      const list = C.comboList || [];
      const k = list.filter((cb) => comboView.known(cb.id)).length;
      count.textContent = `${k}／${list.length}`;
      return list.map((cb) => {
        if (!comboView.known(cb.id)) {
          const r = (H?.rumors || []).find((x) => x.combo === cb.id);
          return h('div.zrow.shadow', {}, [h('b', { text: '？？？' }), h('span.q', { text: r ? `噂：「${C.cards[r.card]?.name}」に相方がいるらしい（札${cb.need.length}枚）` : `札${cb.need.length}枚のコンボ。札を全部持つと分かる` })]);
        }
        const names = cb.need.map((set) => [...new Set(set.map((i) => C.cards[i]?.name))].join('か'));
        const el = h('div.zrow', { style: { '--g': cb.color || 'var(--acc)' } }, [h('b', { text: cb.name }), h('span.q', { text: comboEffText(C, cb.id) }), h('span.zfx', { text: names.join('＋') })]);
        tip(el, () => `<b>${esc(cb.name)}</b>　<span class="q">${esc(comboEffText(C, cb.id))}</span><br>${names.map(esc).join('＋')}${cb.text ? `<br><span class="fl">${esc(cb.text)}</span>` : ''}`);
        return el;
      });
    },
    常連客: () => {
      const list = things('regulars');
      tally(list);
      return list.map((d) => {
        if (!known(d.id)) return shadow(d);
        const el = h('div.zrow', { style: { '--g': GRADE_COLOR[d.grade] } }, [h('b', { text: d.name }), h('span.q', { text: d.text ?? '' }), h('span.zset', { text: C.sets[d.set]?.name ?? '' })]);
        tip(el, () => `<b>${esc(d.name)}</b>　<span class="q">${esc(d.grade)}</span><br>${kwLines(d).join('<br>')}${d.flavor ? `<br><span class="fl">${esc(d.flavor)}</span>` : ''}`);
        return el;
      });
    },
    置物: () => {
      const list = things('relics');
      tally(list);
      return list.map((d) => {
        if (!known(d.id)) return shadow(d);
        const el = h('div.zrow', { style: { '--g': GRADE_COLOR[d.grade] } }, [h('b', { text: d.name }), h('span.q', { text: d.text ?? '' }), h('span.zset', { text: C.sets[d.set]?.name ?? '' })]);
        tip(el, () => `<b>${esc(d.name)}</b><br>${esc(d.text ?? '')}${d.flavor ? `<br><span class="fl">${esc(d.flavor)}</span>` : ''}`);
        return el;
      });
    },
    敵: () => {
      const list = Object.values(C.enemies);
      tally(list);
      return list.map((d) => {
        if (!known(d.id)) return shadow(d);
        const e = makeEnemy(base.balance, d, { floor: Math.min(16, (d.layer?.[0] ?? 1) * 3 - 2) }, `z_${d.id}`);
        const el = h('div.zrow', {}, [h('b', { text: d.name }), h('span.q', { text: `${d.kind ?? '通常'}・${d.layer?.[0] === 6 ? '最深部' : `第${(d.layer || []).join('・')}層`}` }), h('span.zset', { text: d.bind ?? '' })]);
        tip(el, () => enemyTip(env, e));
        return el;
      });
    },
    実績: () => {
      const got = H?.achievements ?? [];
      const list = C.achievements || [];
      count.textContent = `${list.filter((a) => got.includes(a.id)).length}／${list.length}`;
      return list.map((a) => {
        const ok = got.includes(a.id);
        if (!ok && a.hidden) return h('div.zrow.shadow', {}, [h('b', { text: '？？？' }), h('span.q', { text: '（伏せられた実績）' }), h('span.zset', { text: '' })]);
        return h(`div.zrow${ok ? '' : '.dim'}`, {}, [h('b', { text: `${ok ? '◆' : '◇'} ${a.name}` }), h('span.q', { text: a.text ?? '' }), h('span.zset', { text: a.zeni ? `宿銭＋${a.zeni}` : '' })]);
      });
    },
    印: () => {
      const st = H?.stamps ?? {};
      count.textContent = '深度NでB16から脱出すると、その宿泊客に深度Nの印';
      return Object.values(C.guests).map((g) => {
        const d = st[g.id] ?? -1;
        const unlocked = !H || H.unlocked.guests.includes(g.id);
        return h('div.zrow', {}, [h('b', { text: unlocked ? g.name : '？？？' }), h('span.q', { text: d >= 0 ? `深度${d}の印` : '印なし' }),
          h('span.zset.stamp', { style: { '--d': Math.max(0, d) } }, [d >= 0 ? `◉${d}` : '○'])]);
      });
    },
    記録: () => {
      count.textContent = '';
      const R = H?.records ?? {};
      const rows = [
        ['最深到達', `B${R.deepest ?? 0}`], ['最大論破値', format(R.maxV ?? 0)], ['潜行', `${R.dives ?? 0}回`], ['脱出', `${R.extracts ?? 0}回`],
        ['未帰還', `${R.deaths ?? 0}回`], ['倒した敵', `${R.kills ?? 0}体`], ['一番の持ち帰り', `${R.bestHaul ?? 0}`], ['稼いだ宿銭', `${R.zeniTotal ?? 0}`],
        ['解放した深度', `${H?.unlocked?.depth ?? 0}`], ['実績', `${(H?.achievements ?? []).length}／${(C.achievements || []).length}`],
        ['図鑑', `${ownedL?.length ?? 0}種を手に入れた`], ['借金', `${H?.debt ?? 0}`],
      ];
      return rows.map(([k, v]) => h('div.zrow', {}, [h('b', { text: k }), h('span.q', { text: v }), h('span.zset', { text: '' })]));
    },
    キーワード: () => {
      count.textContent = '';
      const list = Object.values(C.kwByName).sort((a, b) => (a.set ? 1 : 0) - (b.set ? 1 : 0));
      return list.map((k) => {
        const users = Object.values(C.cards).filter((c) => (c.kwList || []).some((x) => x.name === k.name));
        const name = h('b.kwname', { text: `${k.name}${k.arg ? 'N' : ''}` });
        tip(name, () => `<b>${esc(k.name)}${k.arg ? 'N' : ''}</b><br>${esc(k.text)}${k.flavor ? `<br><span class="fl">${esc(k.flavor)}</span>` : ''}<br><span class="q">${k.set ? `セット「${esc(C.sets[k.set]?.name ?? k.set)}」` : '共通'}${users.length ? `・持つ札：${users.length}枚` : ''}</span>`);
        return h('div.zrow', {}, [name, h('span.q', { text: k.text }), h('span.zset', { text: k.set ? C.sets[k.set]?.name ?? k.set : '共通' })]);
      });
    },
  };
  const draw = () => {
    tabs.replaceChildren(...Object.keys(TABS).map((k) => h(`button.chip${k === tab ? '.on' : ''}`, { type: 'button', onclick: () => { tab = k; draw(); } }, [k])));
    body.replaceChildren(...TABS[tab]());
    body.scrollTop = 0;
  };
  draw();
  const el = h('div.scr.zukan', {}, [
    h('header.ztop', {}, [h('h2', { text: '図鑑' }), h('button.btn', { type: 'button', onclick: () => ctx.back() }, ['戻る'])]),
    tabs, count, body,
    h('p.q.zhint', { text: '名前を押すと説明。見たことのない物は影' }),
  ]);
  return { el };
}

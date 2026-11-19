// タイトル：「ター深」、最深到達階、最大論破値、「はじめる」か「つづきから」
import { h, holdButton } from '../dom.js';
import { num as format } from '../num.js';

export function titleScreen(ctx) {
  const { H, D } = ctx.title();
  const kids = [
    h('h1', { text: 'ター深' }),
    h('p', { text: '宿の床下に、ター深がある。' }),
  ];
  if (H) {
    kids.push(h('p.q', { text: `最深 B${H.records.deepest}・最大論破値 ${format(H.records.maxV)}` }));
    kids.push(h('button.btn.main', { type: 'button', onclick: () => ctx.resume() }, [H.diving && D ? `つづきから（B${D.floor}）` : 'つづきから']));
  } else {
    kids.push(holdButton('はじめる', () => ctx.begin(), 'main'));
  }
  kids.push(h('button.btn', { type: 'button', onclick: () => ctx.showZukan() }, ['図鑑']));
  kids.push(h('a', { href: '?dev=1', style: { color: 'var(--quiet)', fontSize: '13px', minHeight: '44px', display: 'inline-flex', alignItems: 'center' } }, ['試し場']));
  return { el: h('div.scr.title', {}, kids) };
}

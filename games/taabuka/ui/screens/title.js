// タイトル：奥へ襖が開いて落ちていく背景、筆文字風のロゴ、記録、「はじめる」か「つづきから」
// 試し場はタイトルに出さない。ロゴを10回叩くと開く（作り直し仕様 A）
import { installButton } from '../install.js';
import { h, holdButton, toast } from '../dom.js';
import { num as format } from '../num.js';

const LAB_TAPS = 10;

export function titleScreen(ctx) {
  const { H, D } = ctx.title();
  // 奥へ流れていく襖の枠（5枚。CSS で手前から奥へ縮みながら回る）
  const tunnel = h('div.ttun', {}, [0, 1, 2, 3, 4].map((i) => h('i', { style: { animationDelay: `${-i * 1.2}s` } })));
  let taps = 0, last = 0;
  const logo = h('h1.tlogo', { onclick: () => {
    const now = performance.now();
    taps = now - last < 900 ? taps + 1 : 1; last = now;
    logo.classList.remove('tap'); void logo.offsetWidth; logo.classList.add('tap');
    if (taps >= LAB_TAPS) { location.href = '?dev=1'; return; }
    if (taps >= LAB_TAPS - 3) toast(`…あと${LAB_TAPS - taps}回`);
  } }, [h('span', { text: 'ター' }), h('span.d', { text: '深' })]);
  const kids = [
    tunnel,
    h('div.tcol', {}, [
      logo,
      h('p.tsub', { text: '宿の床下に、ター深がある。' }),
      ...(H ? [h('p.trec', {}, [`潜った ${H.records.dives}回　最深 B${H.records.deepest}`, h('br'), `最大論破値 ${format(H.records.maxV)}`])] : []),
      H ? h('button.btn.main', { type: 'button', onclick: () => ctx.resume() }, [H.diving && D ? `つづきから（B${D.floor}）` : 'つづきから'])
        : holdButton('はじめる', () => ctx.begin(), 'main'),
      h('button.btn', { type: 'button', onclick: () => ctx.showZukan() }, ['図鑑']),
      installButton(ctx.app ?? document.getElementById('app'), () => ctx.rerender?.()),
    ]),
  ];
  return { el: h('div.scr.title', {}, kids), where: 'title' };
}

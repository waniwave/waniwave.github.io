// 札の高級感：レアリティで枠の素材が変わる（★3 金の細線・箔の帯、★4 金箔の枠と流れる光沢、★5 朱漆と金・浮き彫り、★6 七色の箔ときらめき）
// 刻印付きは枠の角に宝石。見た目だけ（計算に触れない）。戦闘の札（.card）と一覧の行（.thing）の両方に使う
import { h } from './dom.js';
import { affixLines } from './labels.js';

const RANK = { コモン: 1, アンコモン: 2, レア: 3, レジェンダリー: 4, ユニーク: 5, ミシック: 6 };

export function premium(el, r, ins, content) {
  const n = RANK[r] ?? 1;
  if (n >= 3) {
    el.classList.add('prem', `p${n}`);
    el.append(h('span.foil'));
    if (n >= 4) el.append(h('span.shine'));
    if (n >= 6) el.append(h('span.spark', {}, [h('i'), h('i'), h('i'), h('i')]));
  }
  if (ins?.length) el.append(h('span.gems', {}, (content ? affixLines(content, ins) : ins.map(() => ({}))).slice(0, 3).map((a) => h(`i${a.mythic ? '.m' : ''}`))));
  return el;
}

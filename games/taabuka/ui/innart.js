// 宿の絵（内装の段で変わる SVG）。見た目だけ。段は engine/meta.js decorState の slots[].lv
const KIMONO = ['#f4efe4', '#7a5a3a', '#d98aa0', '#d6a425'];
const NOREN = ['', '#2f4f7c', '#2f4f7c', '#5a2a6a'];
const SIGN = ['#c9b48e', '#9a6a3a', '#1d1a16', '#d6a425'];

/** @param {{slots:{id:string, lv:number}[]}} st @returns {string} SVG */
export function innArt(st) {
  const L = Object.fromEntries(st.slots.map((s) => [s.id, s.lv]));
  const lv = (k) => L[k] ?? 0;
  const y = lv('yane'); const two = y >= 2;
  const top = two ? 34 : 62; // 建物の上端
  const out = [];
  out.push('<defs><linearGradient id="ia-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3a5c"/><stop offset="1" stop-color="#e8a86a"/></linearGradient>'
    + '<radialGradient id="ia-glow"><stop offset="0" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>');
  out.push('<rect width="360" height="150" fill="url(#ia-sky)"/>');
  out.push('<rect y="124" width="360" height="26" fill="#6b5a44"/>');
  // 庭
  const n = lv('niwa');
  if (n >= 2) for (let i = 0; i < 5; i++) out.push(`<path d="M8 ${129 + i * 4} q30 -3 60 0" stroke="#d8cdb6" stroke-width="1.2" fill="none"/>`);
  if (n >= 3) out.push('<ellipse cx="40" cy="138" rx="34" ry="8" fill="#3a6a8a"/><ellipse cx="30" cy="137" rx="5" ry="2" fill="#e8662a"/><ellipse cx="50" cy="139" rx="4" ry="1.8" fill="#fff"/>');
  if (n >= 1) out.push('<rect x="30" y="86" width="5" height="40" fill="#5a3a22"/><ellipse cx="32" cy="80" rx="24" ry="9" fill="#2f5a2a"/><ellipse cx="22" cy="92" rx="15" ry="6" fill="#2f5a2a"/><ellipse cx="44" cy="70" rx="13" ry="6" fill="#3a6a32"/>');
  // 湯けむり
  const u = lv('yu');
  if (u >= 2) out.push('<ellipse cx="318" cy="128" rx="30" ry="7" fill="#7a8a9a"/><circle cx="296" cy="125" r="5" fill="#6a6058"/><circle cx="340" cy="124" r="6" fill="#6a6058"/>');
  if (u >= 1) for (let i = 0; i < u + 1; i++) out.push(`<path d="M${300 + i * 12} 120 q-6 -10 0 -20 q6 -10 0 -20" stroke="#fff" stroke-opacity=".55" stroke-width="3" fill="none"/>`);
  // 建物
  out.push(`<rect x="92" y="${top + 22}" width="176" height="${124 - top - 22}" fill="#c9a77a" stroke="#5a3a22" stroke-width="2"/>`);
  if (two) out.push('<rect x="80" y="84" width="200" height="8" fill="#3a2a22"/>');
  // 窓（客室）
  const hy = lv('heya');
  const wins = two ? [[108, top + 30], [150, top + 30], [192, top + 30], [234, top + 30], [108, 96], [234, 96]] : [[108, 92], [234, 92]];
  wins.slice(0, two ? 2 + hy + 1 : 2).forEach(([x, yy]) => {
    out.push(`<rect x="${x}" y="${yy}" width="22" height="16" fill="${hy >= 1 ? '#ffe2a0' : '#3a3530'}" stroke="#5a3a22" stroke-width="1.5"/>`);
    if (hy >= 2) out.push(`<path d="M${x + 11} ${yy} v16 M${x} ${yy + 8} h22" stroke="#8a6a4a" stroke-width="1"/>`);
  });
  // 屋根
  if (y === 0) out.push(`<path d="M84 ${top + 24} L180 ${top + 4} L276 ${top + 24} Z" fill="#8a8f94" stroke="#5a5f64" stroke-width="2"/>`);
  else {
    out.push(`<path d="M74 ${top + 26} Q180 ${top - 14} 286 ${top + 26} L270 ${top + 18} Q180 ${top - 4} 90 ${top + 18} Z" fill="#2a2e36"/>`);
    out.push(`<path d="M84 ${top + 22} Q180 ${top - 8} 276 ${top + 22}" stroke="#4a505a" stroke-width="6" fill="none"/>`);
    if (two) out.push('<path d="M70 92 Q180 72 290 92 L278 86 Q180 70 82 86 Z" fill="#2a2e36"/>');
  }
  if (y >= 3) out.push(`<path d="M150 ${top} q-6 -12 4 -16 q2 8 6 10 z" fill="#d6a425"/><path d="M210 ${top} q6 -12 -4 -16 q-2 8 -6 10 z" fill="#d6a425"/>`);
  // 看板
  const k = lv('kanban');
  out.push(`<rect x="150" y="${top + 26}" width="60" height="16" rx="2" fill="${SIGN[k]}" stroke="#3a2a22"/>`);
  out.push(`<text x="180" y="${top + 38}" text-anchor="middle" font-size="11" font-weight="900" font-family="serif" fill="${k === 2 ? '#d6a425' : k === 3 ? '#7a1a10' : '#3a2a22'}">ター宿</text>`);
  // 入口と暖簾
  out.push('<rect x="160" y="96" width="40" height="28" fill="#2a2520"/>');
  const nr = lv('noren');
  if (nr) {
    for (let i = 0; i < 3; i++) out.push(`<rect x="${161 + i * 13}" y="96" width="12" height="16" fill="${NOREN[nr]}"/>`);
    if (nr >= 2) out.push('<circle cx="180" cy="104" r="5" fill="none" stroke="#fff" stroke-width="1.5"/>');
    if (nr >= 3) out.push('<path d="M161 110 h38" stroke="#d6a425" stroke-width="2"/>');
  }
  // 灯り
  const c = lv('chouchin');
  const lantern = (x, yy) => `<circle cx="${x}" cy="${yy}" r="14" fill="url(#ia-glow)"/><ellipse cx="${x}" cy="${yy}" rx="5" ry="7" fill="#d0402a"/><path d="M${x - 5} ${yy} h10" stroke="#7a1a10"/>`;
  if (c === 0) out.push('<circle cx="152" cy="98" r="2.5" fill="#fff6c0"/>');
  if (c >= 1) out.push(lantern(150, 104), lantern(210, 104));
  if (c >= 2) for (const x of [104, 128, 232, 256]) out.push(lantern(x, top + 32));
  if (c >= 3) for (const x of [70, 120, 240, 290]) out.push(`<rect x="${x - 4}" y="114" width="8" height="12" fill="#8a8580"/><rect x="${x - 7}" y="108" width="14" height="6" fill="#a09a90"/><circle cx="${x}" cy="118" r="8" fill="url(#ia-glow)"/>`);
  // 女将
  const km = lv('kimono');
  out.push(`<circle cx="226" cy="104" r="4" fill="#f0d8b8"/><path d="M226 101 q-5 -4 0 -6 q5 2 0 6" fill="#1d1a16"/><path d="M220 124 L222 109 h8 L232 124 Z" fill="${KIMONO[km]}" stroke="#3a2a22" stroke-width=".8"/>`);
  if (km >= 3) out.push('<path d="M221 116 h10" stroke="#b8432c" stroke-width="2"/>');
  // 宿の音
  const o = lv('oto');
  if (o >= 1) for (let i = 0; i < o * 2; i++) out.push(`<text x="${240 + i * 14}" y="${70 - (i % 2) * 10}" font-size="12" fill="#fff" fill-opacity=".8">♪</text>`);
  return `<svg viewBox="0 0 360 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="宿の絵">${out.join('')}</svg>`;
}

// ===== 場の効果（お題） =====
// 局の始めに、この中から1枚だけ引かれて大きく発表される。どのカードセットの組み合わせでも動くように作る。
// 書き方：TJ.registerField({ id, name, e, text, rules: { hooks / onRoundStart / onTurnEnd / onKill / onMove / onAnyPick } })
(function () {
const F = TJ.registerField;


F({ id: 'f_gamecenter', name: 'ゲーセン大会', e: '🕹️', color: '#ff6ad5',
  text: '【ゲーセン大会】この局は、ティアの補正がすべて2倍。Godなら1枚+24、Tier5なら1枚−10。',
  rules: { hooks: { tierMod: (g, m) => m * 2 } } });

F({ id: 'f_sakasa', name: '逆さ宿', e: '🙃', color: '#5ec4c9',
  text: '【逆さ宿】この局は、ティア表の補正がひっくり返る。下の段ほど点が上がり、Godは1枚−12になる。この局のティアの動きは次の局に持ち越さない。',
  // carryReset：局の終わりに、共通カテゴリをこの局の始めの位置に戻して次の局へ渡す（ひっくり返った局の沈め合いを持ち越さない）
  rules: { carryReset: true, hooks: { tierMod: (g, m) => -m } } });

F({ id: 'f_gyakushin', name: '逆神の局', e: '🌀', color: '#a3a8bd',
  text: '【逆神の局】この局は、点数が一番低い人が1位になる。',
  rules: { hooks: { rankReverse: () => true } } });

F({ id: 'f_anka', name: '安価祭り', e: '📣', color: '#f19a4c',
  text: '【安価祭り】この局は、ティア操作が1段ぶん強くなる（+1なら+2段、−2なら−3段）。',
  rules: { hooks: { tierPower: (g, d) => d > 0 ? d + 1 : d < 0 ? d - 1 : d } } });

F({ id: 'f_kaso', name: '過疎スレ', e: '🕸️', color: '#6d6a7a',
  text: '【過疎スレ】この局は、5手番目からスレがdat落ちする（ティア操作禁止）。動かすなら今のうち。',
  rules: { onRoundStart: (g) => g.datFrom(5) } });

F({ id: 'f_manin', name: '満員御礼', e: '🈵', color: '#ea6450',
  text: '【満員御礼】この局は、選ばれていないセットのカードが全員の手札に1枚ずつ乱入し、8手番になる。',
  rules: { onRoundStart: (g) => g.addTurn(1, '満員御礼！ 選ばれていないセットのカードが1枚ずつ乱入し、この局は8手番。') } });

F({ id: 'f_yakkan8', name: '宿泊約款第8条', e: '📜', color: '#b385f2',
  text: '【宿泊約款第8条】局の始めに、ランダムなカテゴリ2つが欠番になる（補正0で動かせない。理由は聞かない）。',
  rules: { onRoundStart: (g) => { for (let i = 0; i < 2; i++) { const ks = g.cats().filter(k => g.pos(k) !== TJ.KESU); if (ks.length) g.kesuban(g.rand(ks)); } } } });

F({ id: 'f_kakuhan', name: '確定反撃', e: '⚡', color: '#ffcf4a',
  text: '【確定反撃】この局は、解決の順番が「親から」ではなく「点の低い人から」になる。下位が先に動いて、上位の手を潰せる。',
  rules: { hooks: { order: (g, v) => v.slice().sort((a, b) => g.score(a) - g.score(b)) } } });

F({ id: 'f_otsuya', name: 'お通夜', e: '🕯️', color: '#8a8494',
  text: '【お通夜】この局は、自分が捨てたカード（ティア操作に使ったカード）1枚につき+3。',
  rules: { hooks: { playerScore: (g, v, p) => v + g.cutCount(p) * 3 } } });

F({ id: 'f_gekokujo', name: '下剋上', e: '🗡️', color: '#c0392b',
  text: '【下剋上】局の終わりに、総合順位（順位点の合計）が最下位の人は+10、総合1位の人は−6。',
  rules: { hooks: { playerScore: (g, v, p) => { if (g.round === 0) return v; return p === g.totalLast() ? v + 10 : p === g.totalLeader() ? v - 6 : v; } } } });

F({ id: 'f_mure', name: '群れの掟', e: '🐺', color: '#8fc96c',
  text: '【群れの掟】局の終わりに、自分の場で一番多いカテゴリの枚数×2点。そろえた者が強い。',
  rules: { hooks: { playerScore: (g, v, p) => { const cnt = {}; g.table(p).forEach(c => g.catsOf(c).forEach(k => { cnt[k] = (cnt[k] || 0) + 1; })); const m = Math.max(0, ...Object.values(cnt)); return v + m * 2; } } } });

F({ id: 'f_daiidou', name: '民族大移動', e: '🧳', color: '#5e8bd8',
  text: '【民族大移動】3手番目と6手番目の終わりに、全員の場の一番新しいカードが、手札を渡す向きの隣へ引っ越す。',
  rules: { onTurnEnd: (g) => { if (g.turn !== 3 && g.turn !== 6) return; const mv = [0, 1, 2, 3].map(q => { const t = g.newest(q); return t ? [t, g.next(q)] : null; }).filter(Boolean); mv.forEach(([t, to]) => g.moveTo(t, to)); g.log('★ 民族大移動！ みんなの一番新しいカードが隣へ引っ越した。', true); } } });

F({ id: 'f_ranritsu', name: 'スレ乱立', e: '🧵', color: '#ff7fda',
  text: '【スレ乱立】手番の終わりごとに、ランダムなカテゴリ1つが2段上がり、別の1つが2段下がる。',
  rules: { onTurnEnd: (g) => { const ks = g.cats().filter(k => g.pos(k) !== TJ.KESU); if (ks.length < 2) return; const a = g.rand(ks); const b = g.rand(ks.filter(k => k !== a)); g.move(a, 2); g.move(b, -2); g.log(`スレが乱立して、〈${TJ.catName(a)}〉が上がり〈${TJ.catName(b)}〉が下がった。`); } } });

F({ id: 'f_kourin', name: '神降臨', e: '👼', color: '#f3c54a',
  text: '【神降臨】局の始めに、ランダムなカテゴリ1つがいきなりGodから始まる。奪い合え。',
  rules: { onRoundStart: (g) => { const ks = g.cats().filter(k => g.pos(k) !== TJ.KESU); if (!ks.length) return; const k = g.rand(ks); g.setPos(k, 0); g.log(`★ 神降臨！〈${TJ.catName(k)}〉がGodから始まる。`, true); } } });

F({ id: 'f_wani', name: 'ワニ注意報', e: '🐊', color: '#2f9e6b',
  text: '【ワニ注意報】この局は、場のカードを捨て札へ送られたり、よそへ持っていかれたりした人は、1枚につき+4（見舞金）。',
  rules: { hooks: { playerScore: (g, v, p) => v + g.lostCount(p) * 4 } } });

F({ id: 'f_kanshi', name: '監視社会', e: '👁️', color: '#7a6e86',
  text: '【監視社会】この局は、総合1位の人のティア操作が1段弱くなる（±1は効かない）。談合のチャンス。',
  rules: { hooks: { tierPower: (g, d, p) => { if (g.round === 0 || p !== g.totalLeader()) return d; return d > 0 ? d - 1 : d < 0 ? d + 1 : 0; } } } });

// チュートリアル用（ふつうの対局では引かれない）
F({ id: 'f_tut', name: '女将の目利き', e: '👘', color: '#f3c54a', tutOnly: true,
  text: '【女将の目利き】局の終わりに、自分の場で一番多いカテゴリの枚数×1点。同じカテゴリをそろえると得をする。',
  rules: { hooks: { playerScore: (g, v, p) => { const cnt = {}; g.table(p).forEach(c => g.catsOf(c).forEach(k => { cnt[k] = (cnt[k] || 0) + 1; })); return v + Math.max(0, ...Object.values(cnt)); } } } });
})();

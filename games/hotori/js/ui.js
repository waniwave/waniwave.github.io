/* ター宿のほとり — 画面・進行・通信のまとめ役 */
(function () {
'use strict';
const TJ = window.TJ;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmt = n => (n > 0 ? '+' : '') + n;
const SEATC = ['var(--s0)', 'var(--s1)', 'var(--s2)', 'var(--s3)'];
const SEATHEX = ['#6cc8bd', '#f2b648', '#ff8fb1', '#b39cff'];
const CPU_NAMES = ['CPU・名無しのター', 'CPU・ハーム', 'CPU・グターム', 'CPU・相当老', 'CPU・タタ木', 'CPU・EO'];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* noop */ } }
};
const CID = (() => { try { let c = sessionStorage.getItem('tjgod-cid'); if (!c) { c = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('tjgod-cid', c); } return c; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();

const A = {
  screen: 'menu', name: store.get('tjgod-name', ''), session: null, lobby: null, st: null, me: -1,
  sel: { mode: 'take', u: null, cat: null, d: null }, selKey: '', lastSeq: 0, newCards: {}, moved: {},
  netMode: undefined, deadline: 0, myAct: null, fxBusy: 0, roundOpen: false, finalShown: false, pvCache: null,
  modal: null
};

// ===== 小道具 =====
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
function genCode() { const s = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 4; i++) c += s[Math.floor(Math.random() * s.length)]; return c; }
function catName(k) { return TJ.CATS[k] ? TJ.CATS[k].name : k; }
function catColor(k) { return TJ.CATS[k] ? TJ.CATS[k].color : '#888'; }
function tierLabel(pos) { if (pos === TJ.KESU) return '欠番'; const t = TJ.TIERS[pos]; return t.k === 'G' ? 'God' : 'Tier' + t.k; }
function tierShort(pos) { if (pos === TJ.KESU) return '欠'; const t = TJ.TIERS[pos]; return t.k === 'G' ? 'G' : t.k; }
function richText(s) {
  return esc(s).replace(/【(.+?)】/g, '<b>【$1】</b>').replace(/〈(.+?)〉/g, (m, n) => {
    const k = Object.keys(TJ.CATS).find(x => TJ.CATS[x].name === n);
    return `<b style="color:${k ? catColor(k) : 'inherit'}">〈${n}〉</b>`;
  });
}
function cardShort(id) { const d = TJ.CARD[id]; return d ? (d.short || d.name) : '?'; }
function seatName(i) { return A.st ? A.st.seats[i].name : (A.lobby ? A.lobby.seats[i].name : ''); }

// ===== セッション（部屋主） =====
function Host(online) {
  this.online = online;
  this.code = online ? genCode() : '';
  const names = CPU_NAMES.slice().sort(() => Math.random() - 0.5);
  this.lobby = {
    code: this.code, online, host: CID, started: false,
    seats: [{ name: A.name || 'あなた', cpu: false, cid: CID }].concat([1, 2, 3].map(i => ({ name: names[i], cpu: true }))),
    sets: TJ.SET_ORDER.slice(), timer: online ? 60 : 0, lv: 2
  };
  this.st = null; this.seen = {}; this.pending = {}; this.conn = null; this.lastB = 0; this.roundEndAt = 0;
}
Host.prototype.isHost = true;
Host.prototype.open = async function () {
  if (this.online) this.conn = await TJ.net.open(this.code, true, m => this.onMsg(m), (s, e) => { if (s === 'error') toast('通信：' + (e && e.message || e || 'エラー')); });
  this.iv = setInterval(() => this.tick(), 1000);
  this.push();
};
Host.prototype.close = function () {
  clearInterval(this.iv);
  if (this.conn) { this.conn.send({ t: 'closed', from: CID }); setTimeout(() => this.conn && this.conn.close(), 300); }
};
Host.prototype.seatOf = function (cid) { return this.lobby.seats.findIndex(s => s.cid === cid); };
Host.prototype.onMsg = function (m) {
  if (!m || m.from === CID) return;
  this.seen[m.from] = Date.now();
  const i = this.seatOf(m.from);
  if (m.t === 'hello') {
    if (!this.lobby.started) {
      if (i < 0) {
        const j = this.lobby.seats.findIndex((s, k) => k > 0 && s.cpu);
        if (j < 0) { this.conn && this.conn.send({ t: 'full', from: CID, to: m.from }); return; }
        this.lobby.seats[j] = { name: String(m.name || 'ゲスト').slice(0, 12), cpu: false, cid: m.from };
        toast(`${this.lobby.seats[j].name} が入室しました`); TJ.audio.play('submit');
      } else this.lobby.seats[i].name = String(m.name || this.lobby.seats[i].name).slice(0, 12);
    } else if (i >= 0 && this.st && this.st.seats[i].cpu && this.lobby.seats[i].dropped) {
      this.st.seats[i].cpu = false; this.lobby.seats[i].dropped = false;
      this.st.log.push({ t: `${this.st.seats[i].name}が戻ってきた。`, k: 'sys' }); toast(`${this.st.seats[i].name} が戻ってきました`);
    }
    this.push();
  } else if (m.t === 'act') {
    if (i < 0 || !this.st) return;
    const st = this.st;
    if (m.a && m.a.type === 'ok') { TJ.submit(st, i, m.a); this.changed(); return; }
    if (m.round === st.round && m.turn === st.turn && !st.players[i].act) {
      const err = TJ.submit(st, i, m.a);
      if (!err) this.changed(); else this.push();
    } else this.push();
  } else if (m.t === 'bye') {
    if (i > 0 && !this.lobby.started) { this.lobby.seats[i] = { name: CPU_NAMES[i], cpu: true }; this.push(); }
  }
};
Host.prototype.tick = function () {
  const now = Date.now(); const st = this.st;
  if (this.online && now - this.lastB > 3000) this.push();
  if (!st) return;
  // 回線落ち → CPUが代打ち
  if (this.online && this.lobby.started) this.lobby.seats.forEach((s, i) => {
    if (s.cid && s.cid !== CID && !st.seats[i].cpu && now - (this.seen[s.cid] || now) > 25000) {
      st.seats[i].cpu = true; s.dropped = true;
      st.log.push({ t: `${s.name}の回線が落ちた。CPUが代打ちする。`, k: 'sys' }); this.changed();
    }
  });
  // 手番の制限時間
  if (st.phase === 'pick' && st.timer && st.deadline && now > st.deadline) {
    st.seats.forEach((s, i) => { if (!s.cpu && !st.players[i].act && st.phase === 'pick') { const a = TJ.ai.choose(st, i, 1); if (a) { TJ.submit(st, i, a); st.log.push({ t: `${s.name}は時間切れ。おまかせで選んだ。`, k: 'sys' }); } } });
    this.changed();
  }
  // 局の終わり：全員OKか45秒で次へ
  if (st.phase === 'roundEnd') {
    if (!this.roundEndAt) this.roundEndAt = now;
    if (TJ.allOk(st) || now - this.roundEndAt > 45000) { this.roundEndAt = 0; TJ.nextRound(st); this.changed(); }
  } else this.roundEndAt = 0;
};
Host.prototype.slim = function () {
  if (!this.st) return null;
  const s = JSON.parse(JSON.stringify(this.st));
  s.players.forEach(P => { P.act = P.act ? 1 : null; });
  s.log = s.log.slice(-60);
  s.dlLeft = this.st.deadline ? this.st.deadline - Date.now() : 0;
  delete s.deadline;
  return s;
};
Host.prototype.push = function () {
  this.lastB = Date.now();
  if (this.conn) this.conn.send({ t: 'state', from: CID, lobby: this.lobby, st: this.slim() });
  onState(this.lobby, this.st, true);
};
Host.prototype.changed = function () { this.push(); this.cpuMoves(); };
Host.prototype.cpuMoves = function () {
  const st = this.st; if (!st || st.phase !== 'pick') return;
  st.seats.forEach((s, i) => {
    if (!s.cpu || st.players[i].act || this.pending[i]) return;
    this.pending[i] = 1;
    const key = st.round + ':' + st.turn;
    setTimeout(() => {
      this.pending[i] = 0;
      if (this.st !== st || st.phase !== 'pick' || st.players[i].act || !st.seats[i].cpu || (st.round + ':' + st.turn) !== key) return;
      const a = TJ.ai.choose(st, i, this.lobby.lv);
      if (a) { const err = TJ.submit(st, i, a); if (err) TJ.submit(st, i, { type: 'take', u: st.players[i].hand[0].u }); }
      this.changed();
    }, 650 + Math.random() * 1100);
  });
};
Host.prototype.act = function (a) {
  const st = this.st; if (!st) return 'まだ始まっていない';
  const err = TJ.submit(st, 0 + this.seatOf(CID), a);
  if (!err) this.changed();
  return err;
};
Host.prototype.startGame = function () {
  const L = this.lobby;
  if (!L.sets.length) { toast('カードセットを1つ以上選んでください'); return; }
  this.st = TJ.newGame({ seats: L.seats.map(s => ({ name: s.name, cpu: s.cpu, lv: L.lv })), pool: L.sets.slice(), timer: L.timer });
  L.started = true; A.lastSeq = 0; A.finalShown = false;
  this.changed();
};
Host.prototype.backToLobby = function () { this.lobby.started = false; this.st = null; this.lobby.seats.forEach(s => { s.dropped = false; }); this.push(); };

// ===== セッション（参加者） =====
function Client(code) { this.code = code; this.lobby = null; this.st = null; this.pendingAct = null; this.heard = 0; }
Client.prototype.isHost = false;
Client.prototype.open = async function () {
  this.conn = await TJ.net.open(this.code, false, m => this.onMsg(m), (s) => { if (s === 'closed') leaveTo('部屋主との接続が切れました'); });
  this.hello();
  this.iv = setInterval(() => this.tick(), 1500);
};
Client.prototype.close = function () { clearInterval(this.iv); if (this.conn) { this.conn.send({ t: 'bye', from: CID }); setTimeout(() => this.conn && this.conn.close(), 300); } };
Client.prototype.hello = function () { this.conn.send({ t: 'hello', from: CID, name: A.name || 'ゲスト' }); };
Client.prototype.tick = function () {
  if (!this.lobby) { this.hello(); return; }
  this.conn.send({ t: 'ping', from: CID });
  if (this.lobby && !this.lobby.started && this.lobby.seats.findIndex(s => s.cid === CID) < 0) this.hello();
  if (this.pendingAct) this.conn.send(this.pendingAct);
  if (this.heard && Date.now() - this.heard > 15000) { toast('部屋主からの応答がありません…'); this.heard = Date.now(); }
};
Client.prototype.onMsg = function (m) {
  if (!m || m.from === CID) return;
  if (m.t === 'state') {
    if (this.lobby && m.lobby && m.lobby.host !== this.lobby.host) return;
    this.lobby = m.lobby; this.st = m.st; this.heard = Date.now();
    if (m.st && m.st.dlLeft) A.deadline = Date.now() + m.st.dlLeft; else A.deadline = 0;
    const me = this.lobby.seats.findIndex(s => s.cid === CID);
    if (this.pendingAct && this.st) {
      const p = this.pendingAct;
      if (this.st.round !== p.round || this.st.turn !== p.turn || this.st.phase !== p.phase || (me >= 0 && this.st.players[me].act) || (p.a.type === 'ok' && this.st.players[me] && this.st.players[me].ok)) this.pendingAct = null;
    }
    onState(this.lobby, this.st, false);
  } else if (m.t === 'full' && m.to === CID) { leaveTo('満席でした'); }
  else if (m.t === 'closed' && this.lobby && m.from === this.lobby.host) leaveTo('部屋主が部屋を閉じました');
};
Client.prototype.act = function (a) {
  if (!this.st) return 'まだ始まっていない';
  this.pendingAct = { t: 'act', from: CID, a, round: this.st.round, turn: this.st.turn, phase: this.st.phase };
  this.conn.send(this.pendingAct);
  return null;
};

function leaveTo(msg) {
  if (A.session) { try { A.session.close(); } catch (e) { /* noop */ } }
  A.session = null; A.lobby = null; A.st = null; A.screen = 'menu';
  if (msg) toast(msg);
  TJ.audio.music('menu');
  render();
}

// ===== 状態の受け取り =====
function onState(lobby, st, local) {
  A.lobby = lobby; A.st = st;
  A.me = lobby.seats.findIndex(s => s.cid === CID);
  if (local && st && st.deadline) A.deadline = st.deadline;
  if (!lobby.started || !st) {
    if (A.screen === 'game') { A.roundOpen = false; closeFinal(); }
    A.screen = 'lobby'; render(); return;
  }
  if (A.screen !== 'game') { A.screen = 'game'; A.lastSeq = 0; }
  if (st.phase === 'pick') A.roundOpen = false;
  // 選択のリセット（手番が変わったら）
  const key = st.round + ':' + st.turn + ':' + st.phase;
  if (key !== A.selKey) { A.selKey = key; A.sel = { mode: 'take', u: null, cat: null, d: null }; A.myAct = null; A.pvCache = null; }
  // 新しい出来事
  const evs = (st.ev || []).filter(e => e.seq > A.lastSeq);
  const first = A.lastSeq === 0;
  if (evs.length) A.lastSeq = Math.max(...evs.map(e => e.seq));
  A.newCards = {}; A.moved = {};
  if (!first) evs.forEach(e => {
    if (e.k === 'take' || e.k === 'token' || e.k === 'move' || e.k === 'revive') A.newCards[e.u] = 1;
    if (e.k === 'tier' && e.from != null) A.moved[e.cat] = (e.to === TJ.KESU || (e.from !== TJ.KESU && e.to > e.from)) ? 'dn' : 'up';
  });
  render();
  if (!first) playEvents(evs);
  else if (st.phase === 'pick') TJ.audio.music(st.turn >= 6 ? 'tense' : 'game');
  if (st.phase === 'roundEnd' && !A.roundOpen && !evs.some(e => e.k === 'roundEnd')) { A.roundOpen = true; render(); }
  if (st.phase === 'gameEnd' && !A.finalShown && first) showFinal();
}

// ===== 演出 =====
const fxQ = [];
let fxRun = false;
function fx(fn, ms) { fxQ.push([fn, ms]); if (!fxRun) runFx(); }
function runFx() {
  const it = fxQ.shift(); if (!it) { fxRun = false; return; }
  fxRun = true; try { it[0](); } catch (e) { console.error(e); }
  setTimeout(runFx, it[1]);
}
function banner(text, sound) {
  const b = document.createElement('div'); b.className = 'banner'; b.textContent = text;
  $('#fx').appendChild(b); setTimeout(() => b.remove(), 1600);
  if (sound !== false) TJ.audio.play('banner');
}
function alertBanner(text) {
  const b = document.createElement('div'); b.className = 'banner alert'; b.textContent = text;
  $('#fx').appendChild(b); setTimeout(() => b.remove(), 2600);
  TJ.audio.play('alert');
}
function myAlerts(evs) {
  const st = A.st; const me = A.me; if (me < 0) return [];
  const out = [];
  evs.forEach(e => {
    const by = e.src && e.src.p != null ? e.src.p : null;
    if (by === me) return;
    if (e.k === 'kill' && e.p === me) out.push(`あなたの「${cardShort(e.id)}」が捨て札に！（${srcText(e.src)}）`);
    if (e.k === 'move' && e.from === me) out.push(`あなたの「${cardShort(e.id)}」が${st.seats[e.to].name}の場へ！（${srcText(e.src)}）`);
    if (e.k === 'zero' && e.p === me) out.push(`あなたの「${cardShort(e.id)}」が化かされた！（${srcText(e.src)}）`);
    if (e.k === 'tier' && e.from != null && (e.to === TJ.KESU || (e.from !== TJ.KESU && e.to > e.from))) {
      const n = TJ.catCounts(st, e.cat)[me]; if (!n) return;
      let culprit = '';
      if (e.vote) { const v = st.recap && st.recap.votes.find(x => x.cat === e.cat); const neg = v ? v.voters.filter(x => x.d < 0 && x.p !== me) : []; if (!neg.length) return; culprit = neg.map(x => st.seats[x.p].name).join('・'); }
      else culprit = srcText(e.src);
      out.push(`〈${catName(e.cat)}〉が${tierLabel(e.to)}に下げられた！ あなたの${n}枚に影響（${culprit}）`);
    }
  });
  return out.slice(0, 3);
}
function playEvents(evs) {
  const st = A.st;
  const alerts = myAlerts(evs);
  const rev = evs.find(e => e.k === 'reveal');
  if (rev) {
    fx(() => {
      TJ.audio.play('reveal');
      const lines = [];
      [0, 1, 2, 3].map(i => (st.oya + i) % 4).forEach((p, n) => {
        const take = evs.find(e => e.k === 'take' && e.p === p);
        const cut = evs.find(e => e.k === 'cut' && e.p === p);
        const a = rev.acts[p];
        let s = '';
        if (cut) s = `<span class="cut">「${esc(cardShort(cut.id))}」を捨てて〈${esc(catName(a.cat))}〉を${fmt(a.d)}</span>`;
        else if (take) s = `「${esc(cardShort(take.id))}」を取った` + (a && a.cat ? `　＋〈${esc(catName(a.cat))}〉${fmt(a.d)}` : '');
        lines.push(`<div class="rvl" style="animation-delay:${n * 0.18}s"><span class="who" style="color:${SEATC[p]}">${esc(st.seats[p].name)}</span><span>${s}</span></div>`);
      });
      const d = document.createElement('div'); d.className = 'reveal';
      d.innerHTML = `<div class="rv"><h3>公開！</h3>${lines.join('')}</div>`;
      $('#fx').appendChild(d); setTimeout(() => d.remove(), 2000);
    }, 1900);
  }
  evs.forEach(e => {
    if (e.k === 'tier' && e.from != null) fx(() => TJ.audio.play(A.moved[e.cat] === 'up' ? 'up' : 'down'), 120);
    if (e.k === 'banner') fx(() => banner(e.text), 1400);
  });
  if (evs.some(e => e.k === 'take')) fx(() => TJ.audio.play('pick'), 50);
  alerts.forEach(t => fx(() => alertBanner(t), 2000));
  const tr = evs.find(e => e.k === 'turn');
  if (tr) fx(() => {
    TJ.audio.music(tr.turn >= 6 ? 'tense' : 'game');
    if (tr.turn === TJ.TURNS) banner('最終手番：スレがdat落ちした（ティア操作禁止）');
    else if (st.players[A.me] && TJ.hasBonus(st, A.me)) banner('スレ主の権限：取りながらティアも動かせる');
  }, 300);
  const rd = evs.find(e => e.k === 'round');
  if (rd) fx(() => { TJ.audio.play('round'); TJ.audio.music('game'); banner(`${TJ.ROUND_NAMES[rd.round]}　親（スレ主）：${st.seats[rd.oya].name}`, false); }, 1600);
  if (evs.some(e => e.k === 'roundEnd')) fx(() => { TJ.audio.play('round'); A.roundOpen = true; render(); }, 100);
  if (evs.some(e => e.k === 'gameEnd')) fx(() => showFinal(), 100);
}
function closeFinal() { const f = $('.final'); if (f) f.remove(); const c = $('.confetti'); if (c) c.remove(); }
function showFinal() {
  const st = A.st; if (!st || !st.final || A.finalShown) return;
  A.finalShown = true; A.roundOpen = false; render();
  TJ.audio.music(null);
  const el = document.createElement('div'); el.className = 'final';
  const rows = st.final.map((p, k) => {
    const t = TJ.FINAL_TITLES[k]; const tier = TJ.TIERS.find(x => x.k === t.k);
    return `<div class="fr ${k === 0 ? 'god' : ''}" data-k="${k}"><div class="ft" style="background:${tier.color}">${esc(t.name)}<small>${esc(t.desc)}</small></div>
      <div><div class="fn" style="color:${SEATC[p]}">${esc(st.seats[p].name)}</div><div class="fs">順位点 ${st.players[p].rp}　点数合計 ${st.players[p].raw}　局ごと：${st.players[p].hist.map(h => h.place + '位').join(' / ')}</div></div>
      <div class="fp">${st.players[p].rp}</div></div>`;
  });
  el.innerHTML = `<div class="thr">【結論】ター宿 強さ議論スレ 最終まとめ v${st.round + 1}.0</div><h2>強さ議論の結論が出ました</h2>
    <div class="flist">${rows.join('')}</div>
    <div class="row" style="justify-content:center;margin-top:8px" id="finalBtns" hidden>
      ${A.session && A.session.isHost ? '<button class="btn primary big" data-a="again">もう一度（同じ部屋で）</button>' : ''}
      <button class="btn big" data-a="tomenu">メニューへ</button></div>`;
  document.body.appendChild(el);
  const order = [3, 2, 1, 0];
  order.forEach((k, i) => setTimeout(() => {
    const r = el.querySelector(`.fr[data-k="${k}"]`); if (r) r.classList.add('on');
    TJ.audio.play(k === 0 ? 'god' : 'rank');
    if (k === 0) confetti();
    if (i === 3) { const b = el.querySelector('#finalBtns'); if (b) b.hidden = false; }
  }, 900 + i * (k === 0 ? 1500 : 1100)));
}
function confetti() {
  const c = document.createElement('div'); c.className = 'confetti';
  const cols = ['#f3c54a', '#ff8fb1', '#6cc8bd', '#b39cff', '#fff6c9', '#e2553f'];
  for (let i = 0; i < 90; i++) { const p = document.createElement('i'); p.style.left = Math.random() * 100 + '%'; p.style.background = cols[i % cols.length]; p.style.animationDuration = (2.5 + Math.random() * 2.5) + 's'; p.style.animationDelay = (Math.random() * 1.2) + 's'; c.appendChild(p); }
  document.body.appendChild(c); setTimeout(() => c.remove(), 7000);
}

// ===== カード表示 =====
function cardHTML(c, o) {
  o = o || {}; const d = TJ.CARD[c.id]; const st = A.st;
  const cats = d.cats.map(k => {
    const pos = st && st.tiers[k] != null ? st.tiers[k] : null;
    const m = pos == null ? null : TJ.modOf(st, pos) * (d.tierX || 1);
    return `<span class="cat" style="--catc:${catColor(k)}">${esc(catName(k))}${pos != null && !d.noTier ? `<i>${tierShort(pos)}${m ? ' ' + fmt(m) : ''}</i>` : ''}</span>`;
  }).join('');
  // 左上の大きな数字：このカードの点。手札なら「取ったら何点か」、場なら「いま何点か」、図鑑では基本の点
  const ptsVal = o.pts != null ? o.pts : (c.x && c.x.base != null ? c.x.base : d.base);
  const ptsLab = o.ptsLabel || (o.pts != null ? '' : '基本');
  const pv = o.total != null && o.total !== o.pts ? `<div class="pv">合計 <b class="${o.total > 0 ? 'p' : o.total < 0 ? 'n' : ''}">${fmt(o.total)}</b></div>` : '';
  const tag = o.button ? 'button' : 'div';
  const attrs = o.button ? `type="button" data-a="${o.button}" data-u="${c.u}" aria-label="${esc(d.name)}"` : '';
  const set = TJ.SETS[d.set];
  return `<${tag} class="card ${o.cls || ''}" style="--cc:${catColor(d.cats[0])}" ${attrs}>
    <div class="top"><span class="pts ${ptsVal > 0 ? 'p' : ptsVal < 0 ? 'n' : ''}" title="${ptsLab ? '基本の点' : 'このカードの点'}">${ptsLab ? `<small>${ptsLab}</small>` : ''}<b>${ptsVal}</b><small>点</small></span><span class="setb" title="${esc(set ? set.name : '')}">${set ? set.e : ''}</span></div>
    <div class="art"><span class="em">${d.e || '🃏'}</span><span class="gl">${esc(d.g || '')}</span></div>
    <div class="nm">${esc(d.name)}</div>
    <div class="cats">${cats}</div>
    <div class="tx">${richText(d.text || '')}</div>
    ${o.flavor ? `<div class="fl">${esc(d.flavor || '')}</div>` : ''}
    ${pv}</${tag}>`;
}
function ghostHTML(gh) {
  const st = A.st; const d = TJ.CARD[gh.c.id];
  const hid = d.hidden && gh.p !== A.me;
  const what = gh.why === 'kill' ? '捨て札へ' : `→ ${gh.to === A.me ? 'あなた' : esc(st.seats[gh.to].name)}の場へ`;
  return `<span class="mc ghost" title="${esc(srcText(gh.src))}"><span class="e">${hid ? '❔' : d.e || '🃏'}</span><span class="n">${hid ? '存在しない' : esc(d.short || d.name)}</span><span class="stp">${what}<small>${esc(srcText(gh.src))}</small></span></span>`;
}
function miniHTML(c, owner, val) {
  const d = TJ.CARD[c.id];
  if (d.hidden && owner !== A.me) return `<span class="mc hid ${A.newCards[c.u] ? 'new' : ''}"><span class="e">❔</span><span class="n">存在しない</span><span class="v">?</span></span>`;
  const st = A.st; const fr = c.x && c.x.from;
  const came = fr && fr.round === st.round && fr.turn >= st.turn - 1 ? `<span class="came">${fr.revive ? '復活' : '← ' + (fr.p === A.me ? 'あなた' : esc(st.seats[fr.p].name))}</span>` : '';
  const zb = c.x && c.x.zero ? '<span class="came z">化</span>' : '';
  return `<span class="mc ${A.newCards[c.u] ? 'new' : ''} ${c.x && c.x.zero ? 'zero' : ''}" style="--cc:${catColor(d.cats[0])}" data-a="zoom" data-u="${c.u}" data-o="${owner}">${came}${zb}<span class="e">${d.e || '🃏'}</span><span class="n">${esc(d.short || d.name)}</span><span class="v ${val > 0 ? 'p' : val < 0 ? 'n' : ''}">${val}</span></span>`;
}

function findCard(u) {
  const st = A.st; if (!st) return null;
  for (let i = 0; i < 4; i++) {
    const P = st.players[i];
    const t = P.table.find(y => y.u === u); if (t) return { c: t, o: i };
    const h = P.hand.find(y => y.u === u); if (h) return { c: h, o: -1 };
  }
  return null;
}
function srcText(src) {
  if (!src) return '';
  if (src.rule) { const S = TJ.SETS[src.rule]; return S ? `ルール（${S.e || ''}${S.name}）` : 'ルール'; }
  const who = src.p != null && src.p >= 0 && A.st ? (src.p === A.me ? 'あなた' : A.st.seats[src.p].name) : '';
  return `「${cardShort(src.id)}」${who ? '・' + who : ''}`;
}
function ruleNameWith(hookName) {
  const st = A.st; const sid = st.sets.find(id => { const R = TJ.SETS[id].rules; return R && R.hooks && R.hooks[hookName]; });
  return sid ? TJ.SETS[sid] : null;
}
// カードの点の内訳と、影響しているもの
function explainFor(u) {
  const st = A.st; const f = findCard(u); if (!f) return null;
  const key = st.v + ':' + st.round + ':' + st.turn + ':' + u;
  if (A.exCache && A.exCache.key === key && A.exCache.st === st) return A.exCache.e;
  let e = null;
  if (f.o >= 0) e = TJ.explain(st, f.o, u);
  else if (A.me >= 0 && st.players[A.me].hand.some(x => x.u === u)) { try { e = TJ.ai.explainTake(st, A.me, u); } catch (er) { e = null; } if (e) e.hand = 1; }
  if (e) e.owner = f.o >= 0 ? f.o : A.me;
  A.exCache = { key, st, e };
  return e;
}
function chipB(label, v) { return `<span class="xb ${v > 0 ? 'p' : v < 0 ? 'n' : ''}">${label} <b>${fmt(v)}</b></span>`; }
function breakdownHTML(e) {
  const st = A.st; const r = e.r; const parts = [];
  parts.push(`<span class="xb">基本 <b>${r.base}</b></span>`);
  r.parts.forEach(([k, m]) => parts.push(chipB(`〈${esc(catName(k))}〉${tierLabel(e.st ? e.st.tiers[k] : st.tiers[k])}`, m)));
  e.infl.forEach(x => {
    const who = x.o === e.owner ? '' : (x.o === A.me ? 'あなたの' : esc(st.seats[x.o].name) + 'の');
    parts.push(chipB(`${who}「${esc(cardShort(x.id))}」`, x.d));
  });
  if (r.acc) parts.push(chipB('積み上がった点', r.acc));
  if (e.other) parts.push(chipB(e.other < 0 && e.infl.length ? 'そろって発動する分の重なり' : '捨て札・手番などの条件', e.other));
  if (r.rule) { const R = ruleNameWith('cardScore'); parts.push(chipB(`ルール${R ? '（' + esc(R.name) + '）' : ''}`, r.rule)); }
  return `<div class="xbs">${parts.join('')}</div>`;
}
function infoHTML(u) {
  const st = A.st;
  if (A.hoverScore != null && st) return totalInfoHTML(A.hoverScore);
  const f = u != null ? findCard(u) : null;
  if (!f || (TJ.CARD[f.c.id].hidden && f.o >= 0 && f.o !== A.me)) return '<div class="cinfo empty">カードや点数にマウスを乗せる（スマホは選ぶ）と、ここに説明と点数の内訳が出ます。影響しているカードやティアは盤面で光ります。</div>';
  const c = f.c; const d = TJ.CARD[c.id]; const set = TJ.SETS[d.set];
  const cats = d.cats.map(k => `<span class="k" style="background:${catColor(k)}">${esc(catName(k))}</span>`).join('');
  const e = explainFor(u);
  const head = e ? `<span class="cs">${e.hand ? '取ったら' : 'いま'} ${e.r.total}点</span>` : '';
  const marks = [];
  if (c.x && c.x.zeroBy) marks.push(`化かされている：${esc(srcText(c.x.zeroBy.src))}`);
  if (c.x && c.x.from && c.x.from.round === st.round) marks.push(c.x.from.revive ? `捨て札から戻ってきた：${esc(srcText(c.x.from.src))}` : `${c.x.from.p === A.me ? 'あなた' : esc(st.seats[c.x.from.p].name)}の場から来た：${esc(srcText(c.x.from.src))}`);
  return `<div class="cinfo"><span class="ce">${d.e || '🃏'}</span><div style="flex:1;min-width:0"><div class="ch"><b>${esc(d.name)}</b>${cats}<span style="font-size:12px;color:#6a6474">${set ? esc(set.e + ' ' + set.name) : ''}</span></div>
    <div>${richText(d.text || '')}</div><div class="cf">${esc(d.flavor || '')}</div>
    ${marks.length ? `<div class="cm">${marks.join('<br>')}</div>` : ''}
    ${e ? breakdownHTML(e) : ''}</div>${head}</div>`;
}
function totalInfoHTML(p) {
  const st = A.st; const t = TJ.explainTotal(st, p);
  const rows = t.rows.map(([u, r]) => { const c = st.players[p].table.find(x => x.u === u); if (!c) return ''; const d = TJ.CARD[c.id]; if (d.hidden && p !== A.me) return chipB('存在しないカード', 0).replace('+0', '?'); return chipB(`${d.e || ''}${esc(d.short || d.name)}`, r.total); }).join('');
  const rules = t.rules.map(x => chipB(`ルール（${esc(TJ.SETS[x.sid].name)}）`, x.d)).join('');
  return `<div class="cinfo"><span class="ce">🧮</span><div style="flex:1;min-width:0"><div class="ch"><b style="color:${SEATC[p]}">${p === A.me ? 'あなた' : esc(st.seats[p].name)}の点数の内訳</b></div>
    <div class="xbs">${rows || '<span class="mute">まだカードがない</span>'}${rules}</div></div><span class="cs">${t.tot}点</span></div>`;
}
// 盤面を光らせる
function clearHL() { A.hl = null; document.querySelectorAll('.infp,.infn,.hovsrc').forEach(el => el.classList.remove('infp', 'infn', 'hovsrc')); }
function highlight(u) {
  clearHL(); A.hl = { u };
  const e = explainFor(u); if (!e) return;
  const mark = (sel, v) => document.querySelectorAll(sel).forEach(el => el.classList.add(v > 0 ? 'infp' : 'infn'));
  document.querySelectorAll(`[data-u="${u}"]`).forEach(el => el.classList.add('hovsrc'));
  e.infl.forEach(x => mark(`.mc[data-u="${x.u}"]`, x.d));
  e.r.parts.forEach(([k, m]) => { if (m) mark(`.chip[data-cat="${k}"]`, m); });
  if (e.r.rule) { const R = ruleNameWith('cardScore'); if (R) mark(`.rule[data-rule="${R.id}"]`, e.r.rule); }
  const tm = A.st.sets.find(id => { const R = TJ.SETS[id].rules; return R && R.hooks && R.hooks.tierMod; });
  if (tm && e.r.parts.some(([k]) => k === 'fgc')) mark(`.rule[data-rule="${tm}"]`, 1);
}
function highlightTotal(p) {
  clearHL(); A.hl = { p };
  const st = A.st; const t = TJ.explainTotal(st, p);
  t.rows.forEach(([u, r]) => { if (r.total) document.querySelectorAll(`.mc[data-u="${u}"]`).forEach(el => el.classList.add(r.total > 0 ? 'infp' : 'infn')); });
  t.rules.forEach(x => document.querySelectorAll(`.rule[data-rule="${x.sid}"]`).forEach(el => el.classList.add(x.d > 0 ? 'infp' : 'infn')));
}
document.addEventListener('mouseover', e => {
  if (A.screen !== 'game' || !A.st) return;
  const box = $('#cinfo');
  const sc = e.target.closest('[data-score]');
  if (sc) {
    const p = +sc.dataset.score; if (A.hoverScore === p) return;
    A.hoverScore = p; A.hoverU = null; if (box) box.innerHTML = infoHTML(null); highlightTotal(p); return;
  }
  const el = e.target.closest('[data-u]');
  if (!el) { if (A.hl) clearHL(); return; }
  const u = +el.dataset.u; if (A.hoverU === u && A.hoverScore == null) return;
  A.hoverScore = null; A.hoverU = u;
  if (box) box.innerHTML = infoHTML(u);
  highlight(u);
});

// ===== 画面：メニュー =====
// タイトルの絵：夜の川のほとりに建つター宿。窓の灯りが水面に映る
function hotoriScene() {
  const win = [[150, 92], [176, 92], [202, 92], [258, 92], [284, 92], [310, 92], [176, 126], [228, 126], [284, 126]]
    .map(([x, y], i) => `<rect x="${x}" y="${y}" width="16" height="18" rx="2" fill="#f2b648" opacity="${0.75 + (i % 3) * 0.08}"><animate attributeName="opacity" values="0.95;0.6;0.95" dur="${3 + (i % 4)}s" begin="${i * 0.4}s" repeatCount="indefinite"/></rect>`).join('');
  const refl = [[158, 182], [184, 186], [210, 182], [266, 186], [292, 182], [318, 186]]
    .map(([x, y], i) => `<rect x="${x - 4}" y="${y}" width="14" height="3" rx="1.5" fill="#f2b648" opacity=".55"><animate attributeName="x" values="${x - 6};${x - 2};${x - 6}" dur="${2.4 + i * 0.3}s" repeatCount="indefinite"/></rect>`).join('');
  const waves = [0, 1, 2, 3].map(i => `<path d="M-20 ${196 + i * 9} q 25 -5 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0" stroke="#6cc8bd" stroke-opacity="${0.35 - i * 0.06}" stroke-width="1.5" fill="none"><animateTransform attributeName="transform" type="translate" values="0 0;-50 0" dur="${4 + i}s" repeatCount="indefinite"/></path>`).join('');
  return `<svg class="hotori" viewBox="0 0 460 240" role="img" aria-label="夜の川のほとりに建つ宿">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0e22"/><stop offset="1" stop-color="#2a2d5e"/></linearGradient>
      <linearGradient id="river" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d3a52"/><stop offset="1" stop-color="#0b1424"/></linearGradient>
      <clipPath id="frame"><rect width="460" height="240" rx="14"/></clipPath></defs>
    <g clip-path="url(#frame)">
      <rect width="460" height="240" fill="url(#sky)"/>
      <circle cx="380" cy="48" r="20" fill="#f6eec8"/><circle cx="389" cy="42" r="18" fill="#141834"/>
      ${[[40, 30], [90, 60], [230, 26], [300, 54], [430, 90], [60, 110], [420, 24]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#efe6d0" opacity=".7"/>`).join('')}
      <path d="M0 168 L60 150 L110 158 L120 168 Z" fill="#191c3c"/><path d="M350 168 L400 146 L460 156 L460 168 Z" fill="#191c3c"/>
      <path d="M128 84 L230 54 L332 84 Z" fill="#3a2a2a"/><rect x="138" y="84" width="186" height="34" fill="#2a2440"/>
      <path d="M150 118 L230 100 L312 118 Z" fill="#3a2a2a"/><rect x="160" y="118" width="142" height="50" fill="#2a2440"/>
      <rect x="219" y="140" width="22" height="28" fill="#e2553f"/><rect x="221" y="140" width="8" height="18" fill="#efe6d0" opacity=".85"/><rect x="231" y="140" width="8" height="18" fill="#efe6d0" opacity=".85"/>
      ${win}
      <rect x="0" y="168" width="460" height="72" fill="url(#river)"/>
      <rect x="160" y="170" width="142" height="10" fill="#2a2440" opacity=".45"/>
      ${refl}${waves}
      <g><line x1="96" y1="150" x2="96" y2="168" stroke="#5a4a3a" stroke-width="2"/><ellipse cx="96" cy="146" rx="6" ry="8" fill="#f2b648"/></g>
      <g><line x1="366" y1="150" x2="366" y2="168" stroke="#5a4a3a" stroke-width="2"/><ellipse cx="366" cy="146" rx="6" ry="8" fill="#f2b648"/></g>
    </g></svg>`;
}
function netText() {
  if (A.netMode === undefined) return 'オンライン対戦が使えるか確認中…';
  if (A.netMode === 'peer') return '<b>オンライン対戦：使えます</b>。「部屋を作る」で出た4文字の部屋番号を伝えれば、同じページを開いた人が入れます。';
  if (TJ.net.inClaude) return 'ここではCPU戦だけ遊べます。オンライン対戦は、ウェブサイト（GitHub Pages など）に置いた版で遊べます。';
  return 'このブラウザではオンライン対戦を使えません。CPU戦は遊べます。';
}
function renderMenu() {
  const can = !!A.netMode;
  return `<div class="menu"><div class="menu-in">
    ${hotoriScene()}
    <h1 class="ttl"><span class="t1">ター宿</span><span class="t2">の</span><span class="t3">ほとり</span></h1>
    <div class="sub">強さ議論スレの宿で、4人で札を取りあう</div>
    <div class="panel">
      <label for="nm">なまえ（12文字まで）</label>
      <input id="nm" type="text" maxlength="12" value="${esc(A.name)}" placeholder="名無しのター" autocomplete="off">
      <button class="btn primary big" data-a="solo" type="button">CPUと遊ぶ</button>
      <div class="grid2">
        <button class="btn" data-a="host" type="button" ${can ? '' : 'disabled'}>部屋を作る</button>
        <div class="row" style="gap:6px;flex-wrap:nowrap"><input id="code" type="text" maxlength="4" placeholder="部屋番号" style="flex:1;text-transform:uppercase;width:0" autocomplete="off" ${can ? '' : 'disabled'}><button class="btn" data-a="join" type="button" ${can ? '' : 'disabled'}>入る</button></div>
      </div>
      <p class="netst">${netText()}</p>
    </div>
    <div class="row" style="justify-content:center">
      <button class="btn" data-a="rules" type="button">ルール説明</button>
      <button class="btn" data-a="catalog" type="button">カード図鑑</button>
      <button class="btn ghost" data-a="mute" type="button">${TJ.audio.muted ? '音：OFF' : '音：ON'}</button>
    </div>
    <p class="mute" style="font-size:12px">収録 ${TJ.SET_ORDER.length} セット ／ ${Object.values(TJ.CARD).filter(c => !c.token).length} 種</p>
  </div></div>`;
}

// ===== 画面：ルール =====
function rulesHTML() {
  const rows = TJ.TIERS.map(t => `<tr><td><span class="tl" style="background:${t.color}">${t.k === 'G' ? 'God' : t.k}</span></td><td>${t.mod == null ? '毎手番ランダム（−3〜+5）' : fmt(t.mod) + '点'}</td><td class="mute">${esc(t.desc)}</td></tr>`).join('');
  return `
  <div class="panel"><h3>勝ち方</h3>
    <p>4人で<b class="kw">4局</b>（東1局〜東4局）戦います。局ごとの順位で<b class="kw">順位点</b>（1位4点・2位2点・3位1点・4位0点）をもらい、4局の合計が一番多い人が<b class="kw">ティアGOD</b>です。2位はTier0、3位はTier1、4位はTier5（食べ物よりも弱い）。</p></div>
  <div class="panel"><h3>1局の流れ</h3><ol>
    <li>カードセットを4つ選び、28枚をよく混ぜて、1人7枚ずつ配ります。</li>
    <li>7回の手番があります。手番では全員が同時に、手札から1枚を選んで次のどちらかをします。
      <ul><li><b class="kw">取る</b>：自分の場に出す。【取ったとき】の効果が起きます。</li>
      <li><b class="kw">捨ててティアを動かす</b>：そのカードを捨て、どれか1つのカテゴリのティアを±1か±2段動かします。隣が欲しそうなカードを捨てれば、カットにもなります。</li></ul></li>
    <li>全員が選んだら一斉に公開。ティアの操作は合算され（+2と−2なら動かない）、そのあと親から順に効果が起きます。</li>
    <li>残った手札を隣に回します。回す向きは局ごとに変わります（効果で変わることも）。</li>
    <li>7手番目（最終手番）は<b class="kw">スレがdat落ち</b>していて、ティアを動かせません。</li>
    <li>局の終わりに点数を数え、順位点をもらいます。</li></ol></div>
  <div class="panel"><h3>点数</h3>
    <p>カード1枚の点 ＝ <b class="kw">基本の点（素点）</b>＋ <b class="kw">効果</b> ＋ <b class="kw">ティアの補正</b>。</p>
    <p>カードの左上の大きな数字が、そのカードの点です。手札では「いま取ったら何点になるか」、場では「いま何点か」が出ます。カード図鑑では基本の点が出ます。</p>
    <p>ティアの補正は、そのカードのカテゴリ<b>それぞれ</b>に入ります。カテゴリが3つあるカードは、当たれば大きく、外れれば大きく沈みます。</p>
    <table class="tt" style="margin-top:8px"><tr><th>ティア</th><th>補正（1枚・1カテゴリあたり）</th><th>スレでの説明</th></tr>${rows}
    <tr><td><span class="tl" style="background:#7a6a9a;color:#fff">欠番</span></td><td>0点で固定</td><td class="mute">Tier6・7。ここに入ったカテゴリは投票で動かせない</td></tr></table></div>
  <div class="panel"><h3>ティア表の決まり</h3><ul>
    <li>どのカテゴリも、はじめはTier3（補正0）。</li>
    <li><b>共通カテゴリ</b>（食べ物・死・宿・動物・スレ・湯・校庭・速さ・格ゲー・ター・老）のティアは、次の局へ引き継がれます。セット固有のカテゴリは毎局Tier3に戻ります。</li>
    <li>取ったカードは全員に見えています。誰が何を集めているかを読んで、ティアを動かしましょう。</li></ul></div>
  <div class="panel"><h3>親（スレ主）</h3><p>親は局ごとに交代します。親は<b class="kw">1手番目だけ</b>、カードを取りつつティアも動かせます。「>>1」などのカードで、ほかの人がこの権限を得ることもあります。</p></div>
  <div class="panel"><h3>セットごとのルール</h3><p>カードセットによっては、その局だけの追加ルールがあります。対局画面の上に表示されます。</p></div>
  <div class="panel"><h3>同点のとき</h3><p>局の中で同点なら、順位点を分け合います。最終結果が同点なら、4局の点数の合計で決めます。</p></div>`;
}
function renderRules() {
  return `<div class="page"><header class="hd"><span class="logo">ター宿のほとり<small>ルール説明</small></span><span class="sp"></span><button class="btn" data-a="tomenu" type="button">メニューへ</button></header>
  <h2>ルール説明</h2>${rulesHTML()}</div>`;
}

// ===== 画面：図鑑 =====
function setBlock(sid, showCards) {
  const s = TJ.SETS[sid];
  const cards = showCards ? s.cards.concat(s.tokens).map(d => `<div>${cardHTML({ id: d.id, u: 0, x: {} }, { flavor: 1 })}${d.copies ? `<p class="mute" style="font-size:12px;text-align:center">×${d.copies}枚</p>` : d.token ? '<p class="mute" style="font-size:12px;text-align:center">（効果で出てくる）</p>' : ''}</div>`).join('') : '';
  return `<div class="panel"><div class="sethead"><span class="e">${s.e || ''}</span><h3>${esc(s.name)}</h3><span class="mute" style="font-size:13px">${esc(s.desc || '')}</span></div>
    ${s.rules && s.rules.text ? `<p class="rule" style="margin-top:6px">${richText(s.rules.text)}</p>` : ''}
    ${showCards ? `<div class="setgrid" style="margin-top:10px">${cards}</div>` : ''}</div>`;
}
function renderCatalog() {
  return `<div class="page"><header class="hd"><span class="logo">ター宿のほとり<small>カード図鑑</small></span><span class="sp"></span><button class="btn" data-a="tomenu" type="button">メニューへ</button></header>
    <h2>カード図鑑</h2><p class="mute">1セット7枚。1局ではこの中から4セット（28枚）を使います。</p>
    ${TJ.SET_ORDER.map(id => setBlock(id, true)).join('')}</div>`;
}

// ===== 画面：ロビー =====
function renderLobby() {
  const L = A.lobby; const host = A.session && A.session.isHost;
  const seats = L.seats.map((s, i) => `<div class="seat" style="--sc:${SEATC[i]}"><span class="nm">${esc(s.name)}</span>
    ${i === 0 ? '<span class="tag">部屋主</span>' : ''}${s.cid === CID ? '<span class="tag ok">あなた</span>' : ''}${s.cpu ? '<span class="tag">CPU</span>' : ''}
    ${host && i > 0 && !s.cpu ? `<button class="btn sm ghost" data-a="kick" data-i="${i}" type="button">CPUにする</button>` : ''}</div>`).join('');
  const sets = TJ.SET_ORDER.map(id => {
    const s = TJ.SETS[id]; const on = L.sets.includes(id);
    const inner = `<span class="e">${s.e || ''}</span><span><b>${esc(s.name)}</b><small>${esc(s.desc || '')}</small>${s.rules && s.rules.text ? `<small class="rl">${esc(s.rules.text)}</small>` : ''}</span>`;
    return host ? `<button class="sp-i" type="button" data-a="toggleSet" data-id="${id}" aria-pressed="${on}">${inner}</button>` : `<div class="sp-i" aria-pressed="${on}">${inner}</div>`;
  }).join('');
  const n = L.sets.length;
  const sel = (id, opts, val) => `<select id="${id}" ${host ? '' : 'disabled'}>${opts.map(([v, t]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
  return `<header class="hd"><span class="logo">ター宿のほとり<small>${L.online ? 'オンライン対戦の部屋' : 'CPU戦の準備'}</small></span><span class="sp"></span>
    <button class="btn" data-a="rulesModal" type="button">ルール</button><button class="btn" data-a="leave" type="button">メニューへ戻る</button></header>
  <div class="lobby">
    <div style="display:flex;flex-direction:column;gap:10px">
      ${L.online ? `<div class="panel"><p class="mute" style="font-size:13px;text-align:center">部屋番号</p><div class="code">${esc(L.code)}</div><p class="mute" style="font-size:12.5px;text-align:center">この番号をいっしょに遊ぶ人に伝えてください。空いている席はCPUが入ります。</p></div>` : ''}
      <div class="panel"><h3 style="font-family:var(--f-disp);margin-bottom:8px">席</h3><div class="seats">${seats}</div></div>
      <div class="panel" style="display:flex;flex-direction:column;gap:8px">
        <label class="mute" style="font-size:13px">手番の制限時間 ${sel('opTimer', [[0, 'なし'], [30, '30秒'], [60, '60秒'], [90, '90秒']], L.timer)}</label>
        <label class="mute" style="font-size:13px">CPUの強さ ${sel('opLv', [[1, 'よわい'], [2, 'ふつう'], [3, 'つよい']], L.lv)}</label>
      </div>
      ${host ? `<button class="btn primary big" data-a="start" type="button" ${n ? '' : 'disabled'}>対局開始</button>` : '<div class="panel waitbox">部屋主が始めるのを待っています…</div>'}
    </div>
    <div class="panel" style="display:flex;flex-direction:column;gap:10px">
      <div class="row"><h3 style="font-family:var(--f-disp)">使うカードセット</h3><span class="mute" style="font-size:13px">${n}セット選択中。1局ごとに、この中から4セットをランダムに使います（4局すべて別にするなら16セット以上）。</span></div>
      ${host ? '<div class="row"><button class="btn sm" data-a="setsAll" type="button">全部</button><button class="btn sm" data-a="setsRand" type="button">ランダムに8つ</button><button class="btn sm" data-a="setsNone" type="button">全部はずす</button></div>' : ''}
      <div class="setpick">${sets}</div>
    </div>
  </div>`;
}

// ===== 画面：対局 =====
function scoresNow() {
  const st = A.st; if (!A.scoreCache || A.scoreCache.v !== st.v || A.scoreCache.st !== st) {
    const det = [0, 1, 2, 3].map(p => TJ.playerScore(st, p));
    const map = {}; det.forEach(d => d.rows.forEach(([u, r]) => { map[u] = r; }));
    A.scoreCache = { v: st.v, st, tot: det.map(d => d.tot), map };
  }
  return A.scoreCache;
}
function tierboardHTML() {
  const st = A.st; const sel = A.sel;
  const clickable = st.phase === 'pick' && A.me >= 0 && !st.players[A.me].act && (TJ.canTier(st, A.me));
  const chip = k => {
    const counts = TJ.catCounts(st, k);
    const mv = A.moved[k];
    const inner = `<span class="cn">${esc(catName(k))}${mv ? `<span class="arr" style="color:${mv === 'up' ? 'var(--up)' : 'var(--down)'}"> ${mv === 'up' ? '▲' : '▼'}</span>` : ''}</span><span class="cc">${counts.map((n, i) => `<span class="${n ? '' : 'z'}" style="background:${SEATHEX[i]}" title="${esc(st.seats[i].name)}：${n}枚">${n}</span>`).join('')}</span>`;
    const cls = `chip ${sel.cat === k && (sel.mode === 'tier' || (A.me >= 0 && TJ.hasBonus(st, A.me))) ? 'selc' : ''} ${mv === 'up' ? 'mvup' : mv === 'dn' ? 'mvdn' : ''}`;
    return st.tiers[k] !== TJ.KESU && clickable ? `<button type="button" class="${cls}" style="--cc:${catColor(k)}" data-a="cat" data-cat="${k}" title="〈${esc(catName(k))}〉を選ぶ">${inner}</button>` : `<span class="${cls}" style="--cc:${catColor(k)}" data-cat="${k}">${inner}</span>`;
  };
  const cats = Object.keys(st.tiers);
  const rows = TJ.TIERS.map((t, i) => {
    const here = cats.filter(k => st.tiers[k] === i);
    const mod = t.mod == null ? `今${fmt(st.t8)}` : fmt(t.mod);
    return `<div class="trow"><div class="tlab" style="background:${t.color}"><b>${t.k === 'G' ? 'God' : t.k}</b><small>${mod}</small></div><div class="tchips">${here.map(chip).join('')}</div></div>`;
  }).join('');
  const kes = cats.filter(k => st.tiers[k] === TJ.KESU);
  return `<aside class="tierboard" aria-label="ティア表">
    <div class="tb-h"><span>【ター宿】強さ議論スレ ティア表</span><b>v${st.round + 1}.${st.turn}</b></div>
    ${rows}
    <div class="trow kesurow"><div class="tlab" style="background:#7a6a9a;color:#fff"><b>欠番</b><small>±0</small></div><div class="tchips">${kes.map(chip).join('') || '<span class="mute" style="font-size:11px;padding:4px">理由は聞かない</span>'}</div></div>
    ${recapHTML()}
    <p class="tb-foot">数字は、そのカテゴリのカードを各自が場に何枚持っているか（色＝席）。ティアの補正は1枚・1カテゴリごとに入ります。</p>
  </aside>`;
}
function recapHTML() {
  const st = A.st; const r = st.recap;
  const head = `<div class="rc-h">【直前の手番の議論】${r ? `${esc(TJ.ROUND_NAMES[r.round] || '')} ${r.turn}手番目` : ''}</div>`;
  if (!r || (!r.votes.length && !(r.fx || []).length)) return `<div class="recap">${head}<div class="rc-none">${r ? 'この手番は、誰もティアを動かさなかった。' : 'まだ議論はない。'}</div></div>`;
  let n = 0; const posts = [];
  const nm = p => p === A.me ? 'あなた' : esc(st.seats[p].name);
  r.votes.forEach(v => {
    v.voters.forEach(x => { n++; posts.push(`<div class="rc-p"><span class="rc-n">${n}</span><b style="color:${SEATC[x.p]}">${nm(x.p)}</b>：〈${esc(catName(v.cat))}〉は <b class="${x.d > 0 ? 'p' : 'n'}">${fmt(x.d)}</b></div>`); });
    let res;
    if (!v.sum) res = `〈${esc(catName(v.cat))}〉 <b>平行線</b>（${v.voters.length >= 2 ? '打ち消し合って' : ''}動かず）`;
    else if (!v.moved) res = `〈${esc(catName(v.cat))}〉 これ以上動けなかった（${tierLabel(v.from)}のまま）`;
    else res = `〈${esc(catName(v.cat))}〉 ${tierLabel(v.from)} → <b class="${v.to < v.from || v.from === TJ.KESU ? 'p' : 'n'}">${tierLabel(v.to)}</b>`;
    const extra = v.sum !== v.raw ? `<span class="rc-x">（${v.sum !== 0 && Math.abs(v.sum) > Math.abs(v.raw) ? '安価・権限で加速' : '補正あり'}：合計${fmt(v.raw)}→${fmt(v.sum)}）</span>` : (v.voters.length >= 2 ? `<span class="rc-x">（合計${fmt(v.raw)}）</span>` : '');
    posts.push(`<div class="rc-r">→ ${res}${extra}</div>`);
  });
  (r.fx || []).forEach(x => posts.push(`<div class="rc-r fx">★ ${esc(srcText(x.src))}で〈${esc(catName(x.cat))}〉 ${tierLabel(x.from)} → <b class="${x.to === TJ.KESU || x.to > x.from ? 'n' : 'p'}">${tierLabel(x.to)}</b></div>`));
  return `<div class="recap">${head}${posts.join('')}</div>`;
}
function playerPanel(p, isMe) {
  const st = A.st; const sc = scoresNow(); const P = st.players[p];
  const tot = sc.tot; const lead = Math.max(...tot) === tot[p] && tot[p] > 0;
  const tags = [];
  if (p === st.oya) tags.push('<span class="tag oya">親</span>');
  if (st.seats[p].cpu) tags.push('<span class="tag">CPU</span>');
  if (st.phase === 'pick') tags.push(P.act ? '<span class="tag ok">決定</span>' : '<span class="tag wait">考え中</span>');
  if (st.phase === 'roundEnd' && (P.ok || st.seats[p].cpu)) tags.push('<span class="tag ok">OK</span>');
  if (!isMe && A.me >= 0) {
    if ((A.me + st.dir + 4) % 4 === p) tags.push('<span class="tag dir">あなたの手札が行く →</span>');
    if ((A.me - st.dir + 4) % 4 === p) tags.push('<span class="tag dir">← 手札をくれる</span>');
  }
  const cards = P.table.map(c => miniHTML(c, p, sc.map[c.u] ? sc.map[c.u].total : 0)).join('')
    + (st.ghosts || []).filter(gh => gh.p === p).map(gh => ghostHTML(gh)).join('');
  const body = `<div class="pp-h"><span class="nm">${esc(st.seats[p].name)}</span>${tags.join('')}</div>
    <div class="pp-s"><span class="sc" data-score="${p}" title="点数の内訳">${tot[p]}<small>点</small></span><span class="rp">順位点 <b>${P.rp}</b></span><span class="handc">手札 ${P.hand.length}</span></div>
    <div class="tbl">${cards || '<span class="mute" style="font-size:12px">まだ何も取っていない</span>'}</div>`;
  return isMe ? body : `<div class="pp ${lead ? 'lead' : ''}" style="--sc:${SEATC[p]}">${body}</div>`;
}
function previewTakes() {
  const st = A.st; const key = st.v + ':' + st.round + ':' + st.turn;
  if (A.pvCache && A.pvCache.key === key && A.pvCache.st === st) return A.pvCache.map;
  const map = {};
  st.players[A.me].hand.forEach(c => { try { const r = TJ.ai.previewTake(st, A.me, c.u); map[c.u] = { self: r.self, total: r[A.me] }; } catch (e) { map[c.u] = null; } });
  A.pvCache = { key, st, map };
  return map;
}
function prevLine(deltas) {
  const st = A.st;
  return `<div class="prev">${deltas.map((v, i) => `<span style="color:${SEATC[i]}">${i === A.me ? 'あなた' : esc(st.seats[i].name)} <b class="${v > 0 ? 'p' : v < 0 ? 'n' : ''}">${fmt(v)}</b></span>`).join('')}</div>`;
}
function actbarHTML() {
  const st = A.st; const me = A.me; const P = st.players[me]; const s = A.sel;
  if (st.phase !== 'pick') return '';
  if (P.act) {
    const done = st.players.filter(x => x.act).length;
    return `<div class="actbar"><div class="waitbox">✔ 決定しました${A.myAct ? '：' + esc(A.myAct) : ''}。ほかの人を待っています（${done}/4）</div></div>`;
  }
  const canTier = TJ.canTier(st, me); const bonus = TJ.hasBonus(st, me);
  const reason = st.turn >= TJ.TURNS ? '最終手番はスレがdat落ち（ティア操作禁止）' : P.block === st.turn ? '女将の手帳で、この手番はティアを動かせない' : 'いまはティアを動かせない';
  const deltas = `<div class="deltas">${[[2, '▲▲ +2', 'u'], [1, '▲ +1', 'u'], [-1, '▼ −1', 'd'], [-2, '▼▼ −2', 'd']].map(([d, t, c]) => `<button type="button" class="${c}" data-a="delta" data-d="${d}" aria-pressed="${s.d === d}">${t}</button>`).join('')}</div>`;
  let hint = '', extra = '', ok = false, label = '決定';
  const cardN = u => { const c = P.hand.find(x => x.u === u); return c ? cardShort(c.id) : ''; };
  if (s.mode === 'take') {
    ok = !!s.u;
    hint = s.u ? `「<b>${esc(cardN(s.u))}</b>」を取る` : '手札からカードを1枚選んでください。';
    label = s.u ? 'このカードを取る' : 'カードを選ぶ';
    if (bonus && canTier) {
      extra = `<span class="bonusnote">スレ主の権限</span><span class="hint" style="flex:0 1 auto;min-width:0">取りながらティアも動かせる（任意）：${s.cat ? `〈<b>${esc(catName(s.cat))}</b>〉` : 'ティア表のカテゴリを押す'}</span>${deltas}`;
      if (s.cat && s.d) extra += prevLine(TJ.ai.previewTier(st, s.cat, s.d, me));
      if (s.u && s.cat && s.d) label = `取って〈${catName(s.cat)}〉${fmt(s.d)}`;
    }
  } else {
    const steps = [];
    steps.push(s.cat ? `〈<b>${esc(catName(s.cat))}</b>〉` : '① ティア表でカテゴリを押す');
    steps.push(s.d ? `<b>${fmt(s.d)}</b>段` : '② 段数を選ぶ');
    steps.push(s.u ? `「<b>${esc(cardN(s.u))}</b>」を捨てる` : '③ 捨てるカードを選ぶ');
    hint = steps.join('　');
    ok = !!(s.u && s.cat && s.d);
    label = ok ? `捨てて〈${catName(s.cat)}〉を${fmt(s.d)}` : '選んでください';
    extra = deltas + (s.cat && s.d ? prevLine(TJ.ai.previewTier(st, s.cat, s.d, me)) : '');
  }
  return `<div class="actbar">
    <div class="modes" role="group" aria-label="行動">
      <button type="button" data-a="mode" data-m="take" aria-pressed="${s.mode === 'take'}">カードを取る</button>
      <button type="button" class="tm" data-a="mode" data-m="tier" aria-pressed="${s.mode === 'tier'}" ${canTier ? '' : `disabled title="${esc(reason)}"`}>捨ててティアを動かす</button>
    </div>
    <span class="hint">${hint}${!canTier ? `<br><span class="mute" style="font-size:12px">${esc(reason)}</span>` : ''}</span>
    ${extra}
    <button type="button" class="btn primary" data-a="submit" ${ok ? '' : 'disabled'}>${esc(label)}</button>
  </div>`;
}
function renderGame() {
  const st = A.st; const me = A.me; const spect = me < 0;
  const view = spect ? 0 : me;
  const opps = [1, 2, 3].map(k => (view + k) % 4);
  const rules = st.sets.map(id => TJ.SETS[id]).filter(s => s.rules && s.rules.text);
  const dirTxt = st.dir === 1 ? '左隣へ回す' : '右隣へ回す';
  const timeLeft = st.timer && st.phase === 'pick' && A.deadline ? Math.max(0, Math.ceil((A.deadline - Date.now()) / 1000)) : null;
  const sc = scoresNow();
  let meHTML = '';
  if (!spect) {
    const P = st.players[me];
    const pv = st.phase === 'pick' && !P.act ? previewTakes() : {};
    const hand = P.hand.map(c => cardHTML(c, {
      button: st.phase === 'pick' && !P.act ? 'hand' : '',
      pts: pv[c.u] ? pv[c.u].self : null,
      ptsLabel: pv[c.u] ? '' : null,
      total: pv[c.u] && A.sel.mode === 'take' ? pv[c.u].total : null,
      cls: A.sel.u === c.u ? (A.sel.mode === 'tier' ? 'cutsel' : 'sel') : (P.act ? 'dim' : '')
    })).join('');
    meHTML = `<section class="me" style="--sc:${SEATC[me]}" aria-label="あなたの場">
      ${playerPanel(me, true)}
      ${actbarHTML()}
      <div id="cinfo">${infoHTML(A.sel.u != null ? A.sel.u : A.hoverU)}</div>
      <div class="hand" aria-label="手札">${hand || '<span class="mute">手札はありません</span>'}</div>
    </section>`;
  } else meHTML = '<div class="panel waitbox">観戦中です（席がありません）</div>';
  const logs = st.log.slice(-40).map(l => `<div class="${l.b ? 'b' : l.k === 'sys' ? 's' : l.k === 'vote' ? 'v' : ''}">${esc(l.t)}</div>`).join('');
  let overlay = '';
  if (A.roundOpen && st.phase === 'roundEnd') overlay = roundHTML();
  if (A.modal) overlay = A.modal;
  return `<header class="hd">
      <span class="logo">ター宿のほとり</span>
      <span class="pill"><b>${TJ.ROUND_NAMES[st.round] || ''}</b></span>
      <span class="pill">親 <b style="color:${SEATC[st.oya]}">${esc(st.seats[st.oya].name)}</b></span>
      <span class="pill ${st.turn >= TJ.TURNS ? 'warn' : ''}">手番 <b>${Math.min(st.turn, 7)}</b>/7</span>
      <span class="pill">${st.dir === 1 ? '↺' : '↻'} ${dirTxt}</span>
      ${timeLeft != null ? `<span class="pill time ${timeLeft <= 10 ? 'low' : ''}" id="tmr">残り <b>${timeLeft}</b>秒</span>` : ''}
      <span class="sp"></span>
      <button class="btn sm" data-a="mute" type="button">${TJ.audio.muted ? '音：OFF' : '音：ON'}</button>
      <button class="btn sm" data-a="rulesModal" type="button">ルール</button>
      <button class="btn sm" data-a="leave" type="button">退出</button>
    </header>
    <div class="game">
      ${tierboardHTML()}
      <div class="main">
        <div class="ruleband">${st.sets.map(id => `<span class="setp">${TJ.SETS[id].e || ''} ${esc(TJ.SETS[id].name)}</span>`).join('')}${rules.map(s => `<span class="rule" data-rule="${s.id}">${s.e || ''} ${richText(s.rules.text)}</span>`).join('')}</div>
        <div class="opps">${opps.map(p => playerPanel(p, false)).join('')}</div>
        ${meHTML}
        <div class="logbox" id="logbox" aria-label="記録">${logs}</div>
      </div>
    </div>
    ${overlay ? `<div class="ov" data-a="ovbg">${overlay}</div>` : ''}`;
}
function roundHTML() {
  const st = A.st; const r = st.results[st.results.length - 1]; if (!r) return '';
  const order = [0, 1, 2, 3].sort((a, b) => r.place[a] - r.place[b]);
  const rows = order.map(p => {
    const bd = r.rows[p].map(x => { const d = TJ.CARD[x.id]; return `<tr><td>${d ? (d.e || '') + ' ' + esc(d.short || d.name) : '?'}</td><td>${x.r.base}</td><td>${fmt(x.r.eff)}</td><td>${fmt(x.r.tier)}</td><td><b>${x.r.total}</b></td></tr>`; }).join('');
    const sum = r.rows[p].reduce((a, x) => a + x.r.total, 0); const bonus = r.scores[p] - sum;
    return `<tr class="r${r.place[p]}"><td class="pl">${r.place[p]}位</td><td><b style="color:${SEATC[p]}">${esc(st.seats[p].name)}</b>
      <details class="bd"><summary>内訳</summary><table class="bdt"><tr><td></td><td>基本</td><td>効果</td><td>ティア</td><td>計</td></tr>${bd}${bonus ? `<tr><td>セットのルール</td><td></td><td></td><td></td><td><b>${fmt(bonus)}</b></td></tr>` : ''}</table></details></td>
      <td class="big">${r.scores[p]}点</td><td class="big" style="color:var(--andon)">${fmt(r.pts[p])}</td><td>${st.players[p].rp}</td></tr>`;
  }).join('');
  const P = st.players[A.me]; const ok = A.me >= 0 && P.ok;
  const ready = st.players.filter((x, i) => x.ok || st.seats[i].cpu).length;
  return `<div class="modal" role="dialog" aria-label="局の結果">
    <h2>${TJ.ROUND_NAMES[r.round]} 結果${r.reversed ? '（さかさま）' : ''}</h2>
    <table class="restbl"><tr><th>順位</th><th>名前</th><th>点数</th><th>順位点</th><th>合計</th></tr>${rows}</table>
    <p class="mute" style="font-size:13px">共通カテゴリのティアは次の局へ引き継がれます。</p>
    <div class="row">${A.me >= 0 ? `<button class="btn primary big" data-a="okRound" type="button" ${ok ? 'disabled' : ''}>${ok ? '待っています…' : '次の局へ'}</button>` : ''}<span class="mute">準備OK ${ready}/4（45秒で自動的に進みます）</span></div>
  </div>`;
}
function zoomHTML(u, owner) {
  const st = A.st; let c = null;
  st.players.forEach(P => { const x = P.table.find(y => y.u === u) || P.hand.find(y => y.u === u); if (x) c = x; });
  if (!c) return '';
  const r = owner >= 0 ? TJ.cardScore(st, owner, c) : null;
  return `<div class="modal" style="max-width:420px;align-items:center" role="dialog"><div class="cardzoom">${cardHTML(c, r ? { flavor: 1, pts: r.total } : { flavor: 1 })}</div><div style="width:100%">${infoHTML(u)}</div><button class="btn" data-a="closeModal" type="button">閉じる</button></div>`;
}

// ===== 描画 =====
let lastScreen = '';
function render() {
  const app = $('#app');
  const keepScroll = A.screen === lastScreen ? window.scrollY : 0;
  let html = '';
  if (A.screen === 'menu') html = renderMenu();
  else if (A.screen === 'rules') html = renderRules();
  else if (A.screen === 'catalog') html = renderCatalog();
  else if (A.screen === 'lobby' && A.lobby) html = renderLobby() + (A.modal ? `<div class="ov" data-a="ovbg">${A.modal}</div>` : '');
  else if (A.screen === 'game' && A.st) html = renderGame();
  const nmFocus = document.activeElement && document.activeElement.id;
  const nmVal = $('#code') ? $('#code').value : '';
  app.innerHTML = html;
  if (nmFocus === 'code' && $('#code')) { $('#code').value = nmVal; $('#code').focus(); }
  if (A.screen === lastScreen) window.scrollTo(0, keepScroll); else window.scrollTo(0, 0);
  lastScreen = A.screen;
  const lb = $('#logbox'); if (lb) lb.scrollTop = lb.scrollHeight;
  // 再描画しても光らせたままにする
  if (A.screen === 'game' && A.hl) { const h = A.hl; if (h.p != null) highlightTotal(h.p); else if (h.u != null) highlight(h.u); }
}
setInterval(() => {
  const t = $('#tmr'); const st = A.st;
  if (!t || !st || !A.deadline) return;
  const left = Math.max(0, Math.ceil((A.deadline - Date.now()) / 1000));
  t.querySelector('b').textContent = left;
  t.classList.toggle('low', left <= 10);
  if (left <= 5 && left > 0 && A.me >= 0 && !st.players[A.me].act) TJ.audio.play('tick');
}, 1000);

// ===== 操作 =====
async function startSession(sess) {
  A.session = sess;
  try { await sess.open(); }
  catch (e) { A.session = null; toast(e.message || '接続できませんでした'); A.screen = 'menu'; render(); return; }
  if (!sess.isHost) { A.screen = 'lobby'; A.lobby = A.lobby || { seats: [], sets: [], code: sess.code, online: true }; render(); }
}
function doSubmit() {
  const st = A.st; const s = A.sel; const me = A.me;
  let a = null;
  if (s.mode === 'take') {
    if (!s.u) return;
    a = { type: 'take', u: s.u };
    if (TJ.hasBonus(st, me) && TJ.canTier(st, me) && s.cat && s.d) a.tier = { cat: s.cat, d: s.d };
  } else {
    if (!(s.u && s.cat && s.d)) return;
    a = { type: 'tier', u: s.u, cat: s.cat, d: s.d };
  }
  const c = st.players[me].hand.find(x => x.u === a.u);
  A.myAct = a.type === 'take' ? `「${cardShort(c.id)}」を取る${a.tier ? `＋〈${catName(a.tier.cat)}〉${fmt(a.tier.d)}` : ''}` : `「${cardShort(c.id)}」を捨てて〈${catName(a.cat)}〉${fmt(a.d)}`;
  const err = A.session.act(a);
  if (err) { toast(err); TJ.audio.play('error'); A.myAct = null; return; }
  TJ.audio.play('submit');
  if (!A.session.isHost) { st.players[me].act = 1; render(); }
}

document.addEventListener('input', e => {
  if (e.target.id === 'nm') { A.name = e.target.value.trim().slice(0, 12); store.set('tjgod-name', A.name); }
});
document.addEventListener('change', e => {
  const H = A.session && A.session.isHost ? A.session : null; if (!H) return;
  if (e.target.id === 'opTimer') { H.lobby.timer = +e.target.value; H.push(); }
  if (e.target.id === 'opLv') { H.lobby.lv = +e.target.value; H.push(); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'code') clickAction('join', {});
  if (e.key === 'Escape' && A.modal) { A.modal = null; render(); }
});
document.addEventListener('click', e => {
  TJ.audio.unlock();
  if (A.screen === 'menu' && !A.musicStarted) { A.musicStarted = true; TJ.audio.music('menu'); }
  const b = e.target.closest('[data-a]'); if (!b) return;
  if (b.dataset.a === 'ovbg' && e.target !== b) return;
  clickAction(b.dataset.a, b.dataset);
});
function clickAction(a, ds) {
  const st = A.st; const H = A.session && A.session.isHost ? A.session : null;
  switch (a) {
    case 'solo': TJ.audio.play('click'); TJ.audio.music('menu'); startSession(new Host(false)); break;
    case 'host': TJ.audio.play('click'); startSession(new Host(true)); break;
    case 'join': {
      const code = ($('#code') && $('#code').value || '').trim().toUpperCase();
      if (code.length !== 4) { toast('4文字の部屋番号を入れてください'); return; }
      TJ.audio.play('click'); startSession(new Client(code)); break;
    }
    case 'rules': A.screen = 'rules'; render(); break;
    case 'catalog': A.screen = 'catalog'; render(); break;
    case 'tomenu': closeFinal(); leaveTo(); break;
    case 'leave': closeFinal(); leaveTo(); break;
    case 'mute': TJ.audio.toggle(); render(); break;
    case 'rulesModal': A.modal = `<div class="modal page" role="dialog"><div class="row"><h2>ルール</h2><span class="sp" style="flex:1"></span><button class="btn" data-a="closeModal" type="button">閉じる</button></div>${rulesHTML()}</div>`; render(); break;
    case 'closeModal': case 'ovbg': if (A.modal) { A.modal = null; render(); } break;
    case 'toggleSet': if (H) { const L = H.lobby; const i = L.sets.indexOf(ds.id); if (i >= 0) L.sets.splice(i, 1); else L.sets.push(ds.id); TJ.audio.play('click'); H.push(); } break;
    case 'setsAll': if (H) { H.lobby.sets = TJ.SET_ORDER.slice(); H.push(); } break;
    case 'setsNone': if (H) { H.lobby.sets = []; H.push(); } break;
    case 'setsRand': if (H) { H.lobby.sets = TJ.util.shuffle(TJ.SET_ORDER.slice()).slice(0, 8); H.push(); } break;
    case 'kick': if (H) { const i = +ds.i; H.lobby.seats[i] = { name: CPU_NAMES[i], cpu: true }; H.push(); } break;
    case 'start': if (H) { TJ.audio.play('round'); H.startGame(); } break;
    case 'again': if (H) { closeFinal(); A.finalShown = false; H.backToLobby(); TJ.audio.music('menu'); } break;
    case 'okRound': if (A.session) { A.session.act({ type: 'ok' }); if (!A.session.isHost && st) { st.players[A.me].ok = true; render(); } } break;
    case 'zoom': A.modal = zoomHTML(+ds.u, +ds.o); render(); break;
    case 'mode': A.sel.mode = ds.m; if (ds.m === 'take' && !TJ.hasBonus(st, A.me)) { A.sel.cat = null; A.sel.d = null; } TJ.audio.play('click'); render(); break;
    case 'hand': A.sel.u = A.sel.u === +ds.u ? null : +ds.u; A.hoverU = +ds.u; TJ.audio.play('click'); render(); break;
    case 'cat':
      if (!st || A.me < 0) return;
      if (A.sel.mode === 'take' && !TJ.hasBonus(st, A.me)) A.sel.mode = 'tier';
      A.sel.cat = A.sel.cat === ds.cat && A.sel.mode === 'take' ? null : ds.cat;
      if (!A.sel.d) A.sel.d = 2;
      TJ.audio.play('click'); render(); break;
    case 'delta': A.sel.d = A.sel.d === +ds.d && A.sel.mode === 'take' ? null : +ds.d; TJ.audio.play('click'); render(); break;
    case 'submit': doSubmit(); break;
  }
}

// ===== 起動 =====
render();
TJ.net.detect().then(m => { A.netMode = m; if (A.screen === 'menu') render(); }).catch(() => { A.netMode = null; render(); });
setTimeout(() => { if (A.netMode === undefined) { A.netMode = null; if (A.screen === 'menu') render(); } }, 11000);
window.TJ_APP = A;
})();

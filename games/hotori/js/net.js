/* ター宿のほとり — 通信
 * ター宿と同じく、ウェブサイト（GitHub Pages など）に置いて P2P（PeerJS / WebRTC）で対戦する。
 * 「部屋主が全員に状態を配り、参加者は部屋主に行動を送る」だけ。
 * claude.ai の中ではオンライン対戦は使わない（CPU戦のみ）。
 */
(function (G) {
'use strict';
const TJ = G.TJ;
const PEER_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'
];
const PREFIX = 'tajuku-hotori-';
let detected = null;

function loadScript(url) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function loadPeer() {
  if (window.Peer) return true;
  for (const u of PEER_URLS) { try { await loadScript(u); if (window.Peer) return true; } catch (e) { /* next */ } }
  return false;
}

TJ.net = {
  inClaude: !!(window.claude && typeof window.claude.use === 'function'),
  // 使える方式を調べる：'peer' | null
  async detect() {
    if (detected !== null) return detected;
    detected = (!this.inClaude && window.RTCPeerConnection) ? 'peer' : null;
    return detected;
  },
  // 接続を開く。戻り値 { send(msg), close(), mode }
  async open(code, isHost, onMsg, onStatus) {
    const mode = await this.detect();
    if (mode === 'peer') return openPeer(code, isHost, onMsg, onStatus);
    throw new Error('この環境ではオンライン対戦が使えません');
  }
};

async function openPeer(code, isHost, onMsg, onStatus) {
  if (!(await loadPeer())) throw new Error('通信ライブラリを読み込めませんでした');
  return new Promise((resolve, reject) => {
    const conns = [];
    let hostConn = null; let done = false;
    const peer = isHost ? new window.Peer(PREFIX + code) : new window.Peer();
    const api = {
      mode: 'peer',
      send: (m) => {
        if (isHost) conns.forEach(c => { if (c.open) try { c.send(m); } catch (e) { /* noop */ } });
        else if (hostConn && hostConn.open) try { hostConn.send(m); } catch (e) { /* noop */ }
      },
      close: () => { try { peer.destroy(); } catch (e) { /* noop */ } }
    };
    peer.on('error', (e) => {
      const msg = e && e.type === 'unavailable-id' ? 'その部屋番号はもう使われています' : e && e.type === 'peer-unavailable' ? '部屋が見つかりません' : '通信エラー';
      if (!done) { done = true; reject(new Error(msg)); } else onStatus && onStatus('error', msg);
    });
    peer.on('disconnected', () => { onStatus && onStatus('reconnecting'); try { peer.reconnect(); } catch (e) { /* noop */ } });
    if (isHost) {
      peer.on('open', () => { if (!done) { done = true; onStatus && onStatus('connected'); resolve(api); } });
      peer.on('connection', (c) => {
        conns.push(c);
        c.on('data', (d) => onMsg(d));
        c.on('close', () => { const i = conns.indexOf(c); if (i >= 0) conns.splice(i, 1); });
      });
    } else {
      peer.on('open', () => {
        hostConn = peer.connect(PREFIX + code, { reliable: true });
        hostConn.on('open', () => { if (!done) { done = true; onStatus && onStatus('connected'); resolve(api); } });
        hostConn.on('data', (d) => onMsg(d));
        hostConn.on('close', () => onStatus && onStatus('closed'));
        setTimeout(() => { if (!done) { done = true; reject(new Error('部屋が見つかりません')); } }, 12000);
      });
    }
  });
}
})(window);

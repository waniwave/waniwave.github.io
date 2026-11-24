// ホーム画面に追加（PWA）。アプリとして開いていないスマートフォンのプレイヤーにだけ、追加のボタンを出す。
// Android の Chrome などは beforeinstallprompt でそのまま追加の確認が出る。
// iPhone・iPad の Safari には追加を呼び出す仕組みが無いので、手順を絵つきで見せる。
import { h, sheet, toast } from './dom.js';

let deferred = null;   // beforeinstallprompt のイベント（あとで prompt() する）
const subs = new Set();
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; subs.forEach((f) => f()); });
window.addEventListener('appinstalled', () => { deferred = null; try { localStorage.setItem('taabuka.installed', '1'); } catch { /* 無視 */ } subs.forEach((f) => f()); toast('ホーム画面に追加しました'); });

const ua = navigator.userAgent || '';
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = isIOS || /Android|Mobile/.test(ua) || (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 820);
/** アプリとして（ホーム画面から）開いているか */
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches || navigator.standalone === true;
/** iOS の Safari 以外のブラウザ（Chrome・アプリ内ブラウザ）。iOS ではホーム画面に追加できるのは Safari（と一部のブラウザの共有メニュー）だけ */
const iosNotSafari = isIOS && (/CriOS|FxiOS|EdgiOS|Line\/|FBAN|FBAV|Instagram|Twitter/.test(ua));

/** ボタンを出すか：スマートフォンで、アプリとして開いていないとき */
export function canOfferInstall() {
  if (isStandalone()) return false;
  if (!isMobile) return !!deferred;   // パソコンでも Chrome が追加を許すなら出す
  return true;
}

/** ボタン（出さないときは null）。状態が変わったら onChange で描き直す */
export function installButton(app, onChange) {
  if (onChange) subs.add(onChange);
  if (!canOfferInstall()) return null;
  return h('button.btn.install', { type: 'button', onclick: () => doInstall(app) }, ['ホーム画面に追加']);
}

async function doInstall(app) {
  if (deferred) {
    const e = deferred;
    deferred = null;
    e.prompt();
    try { const r = await e.userChoice; if (r?.outcome !== 'accepted') deferred = e; } catch { /* 無視 */ }
    return;
  }
  showGuide(app);
}

/** 手順の窓（iPhone・iPad、または追加の確認を出せないブラウザ） */
function showGuide(app) {
  const step = (n, t, icon) => h('li', {}, [h('b.n', { text: n }), icon ? h('span.ic', { html: icon }) : null, h('span', { text: t })]);
  const SHARE = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3v12M7 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 11v9h14v-9" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const PLUS = '<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2"/></svg>';
  const body = isIOS
    ? (iosNotSafari
      ? [h('p', { text: 'このブラウザではホーム画面に追加できないことがあります。Safari でこのページを開いてから、次の手順で追加してください。' }),
        h('button.btn', { type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(location.href); toast('アドレスを写しました。Safari に貼り付けて開いてください'); } catch { toast(location.href); } } }, ['アドレスを写す'])]
      : [])
      .concat([h('ol.iguide', {}, [
        step('1', '画面の下（iPad は上）の共有ボタンを押す', SHARE),
        step('2', 'メニューを下にずらして「ホーム画面に追加」を押す', PLUS),
        step('3', '右上の「追加」を押す'),
      ])])
    : [h('ol.iguide', {}, [
      step('1', 'ブラウザの右上（または下）の「︙」メニューを開く'),
      step('2', '「ホーム画面に追加」または「アプリをインストール」を押す', PLUS),
      step('3', '「インストール」か「追加」を押す'),
    ])];
  const s = sheet(app, [
    h('h2', { text: 'ホーム画面に追加' }),
    h('p.q', { text: 'ホーム画面のアイコンから、アプリのように全画面で遊べます。追加したあとは、アイコンから開いてください。' }),
    isIOS ? h('p.warn', { text: 'iPhone・iPad では、ホーム画面のアイコンから開いたときのセーブは、Safari のセーブとは別になります。いまの宿を持っていくには、先に設定の「書き出し」で写しておき、アイコンから開いたあと設定の「読み込み」に貼ってください。' }) : null,
    ...body,
    h('div.row', {}, [h('button.btn.main', { type: 'button', onclick: () => s.close() }, ['閉じる'])]),
  ]);
}

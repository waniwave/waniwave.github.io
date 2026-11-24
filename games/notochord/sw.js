// sw.js — ホーム画面から起動したときのための Service Worker
// 方針：ネットワークを先に見て、つながらないときだけ保存しておいたファイルを使う（更新がすぐ反映される）。
// main.js が sw.js?v=BUILD で登録するので、BUILD が変わると新しい Service Worker に入れ替わる。
const BUILD = new URL(self.location).search || '';
const CACHE = 'notochord' + BUILD;
const Q = BUILD;   // js・css・content には ?v=BUILD が付いて読み込まれる
const CORE = [
  './', './index.html', './manifest.webmanifest', './style.css' + Q,
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
  './js/main.js' + Q, './js/util.js' + Q, './js/audio.js' + Q,
  './js/engine/registry.js' + Q, './js/engine/board.js' + Q, './js/engine/combat.js' + Q, './js/engine/progress.js' + Q,
  './js/ui/battle.js' + Q, './js/ui/screens.js' + Q,
  './content/index.js' + Q, './content/base.js' + Q, './content/campaign.js' + Q, './content/abyss.js' + Q,
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('notochord') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: false }).then(r => r || caches.match(req, { ignoreSearch: true }))));
});

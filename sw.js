// Daily Master — Service Worker
// 画面(HTML)は常に最新を取りに行く／写真・データ(?v=付き)・アイコンは一度取れたら端末から即表示
const CACHE = 'tdm-v15';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './words.js?v=9', './people.js?v=11'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isAsset = sameOrigin && (/\/p\/.+\.jpg$/.test(url.pathname) || /\.png$/.test(url.pathname) || url.search.includes('v='));
  const isFont = /fonts\.(gstatic|googleapis)\.com$/.test(url.hostname);
  if (isAsset || isFont) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    if (res && res.ok && sameOrigin) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req)));
});

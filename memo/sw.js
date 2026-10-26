// オフラインでも即起動するための控え。中身（書いたメモ）は扱わない。
// 同じサイトのこのアプリのファイルだけを控える。それ以外の通信には一切関わらない
var CACHE = 'memo-v2';
var FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];
var BASE = new URL('./', self.location).href;
var ALLOWED = FILES.map(function (f) { return new URL(f, BASE).href; });

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});
// 控えを先に返し、裏で新しい版を取って次回に備える
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  url.search = ''; url.hash = '';
  if (ALLOWED.indexOf(url.href) < 0) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(url.href).then(function (hit) {
      var net = fetch(url.href, { credentials: 'omit', redirect: 'error' }).then(function (res) {
        if (res && res.ok && res.type === 'basic') c.put(url.href, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  }));
});

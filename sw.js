// ===== オフラインでも開けるようにする仕組み(サービスワーカー) =====
// ジムの地下など電波が弱い場所でもアプリが開けるように、
// 一度読み込んだファイルをスマホの中にコピー(キャッシュ)しておきます。
// 電波があるときは最新版を取りに行き、ないときはコピーを使います。

const CACHE = 'kintore-v15';
const FILES = ['./', './index.html', './style.css', './app.js', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png', './owl.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

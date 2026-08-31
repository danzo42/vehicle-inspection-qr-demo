/*
 * 点検QRポータル Service Worker
 *
 * アプリ本体を端末にキャッシュし、電波の無い場所でも点検入力・PDF作成ができるようにします。
 *
 * ■ アプリを更新したとき
 *   下の CACHE_VERSION の数字を必ず 1 つ増やしてから index.html を差し替えてください。
 *   数字を変えないと、端末に残った古いアプリが使われ続けます。
 */
const CACHE_VERSION = "v2";
const CACHE_NAME = "inspection-qr-portal-" + CACHE_VERSION;

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

/*
 * ネットワーク優先・キャッシュ予備。
 * 通信できるときは最新を取りに行き、圏外ならキャッシュから返します。
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
  );
});

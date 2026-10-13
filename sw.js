/* =============================================================================
 * sw.js  ―― Service Worker（オフライン対応）
 * -----------------------------------------------------------------------------
 * 電波の届かない現場でもアプリが開けるよう、画面とプログラムを端末に
 * キャッシュしておきます。
 *
 * ★アプリを更新したら、下の CACHE_VERSION の数字を1つ上げてください。
 *   これで利用者の端末に新しいファイルが配られます。
 * ========================================================================== */

const CACHE_VERSION = 'vis-v5';

/** オフラインでも必ず動くよう、先に取っておくファイル */
const PRECACHE = [
  './',
  'index.html',
  'vehicle.html',
  'inspect.html',
  'view.html',
  'admin.html',
  'manifest.webmanifest',
  'css/style.css',
  'config/app-config.js',
  'config/firebase-config.js',
  'data/inspection-items.json',
  'demo/vehicles.json',
  'assets/ydec-logo.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'src/common/util.js',
  'src/storage/StorageAdapter.js',
  'src/storage/LocalStorageAdapter.js',
  'src/storage/FirebaseStorageAdapter.js',
  'src/storage/storageFactory.js',
  'src/auth/AuthProvider.js',
  'src/qr/scanner.js',
  'src/form/formRenderer.js',
  'src/pdf/pdfGenerator.js',
  'src/offline/syncQueue.js',
  'vendor/html5-qrcode.min.js',
  'vendor/qrcode.min.js',
  'vendor/jspdf.umd.min.js',
  'vendor/firebase-app-compat.js',
  'vendor/firebase-firestore-compat.js',
  'vendor/firebase-storage-compat.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      // 1つでも失敗すると全部失敗するのを避けるため、個別に入れる
      .then(cache => Promise.all(PRECACHE.map(url =>
        cache.add(url).catch(e => console.warn('キャッシュできませんでした:', url, e))
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Firebaseなど外部への通信はキャッシュせず、そのまま通す
  if (url.origin !== self.location.origin) return;

  // 画面・プログラムは「キャッシュ優先＋裏で更新」。
  // オフラインでもすぐ開き、オンライン時は次回起動から新しくなります。
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

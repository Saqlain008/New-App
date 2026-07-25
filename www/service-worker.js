/*
  Milk Ledger — Service Worker
  --------------------------------------------------------------
  Strategy:
  - APP_SHELL (this app's own HTML/CSS/JS/icons/manifest) is
    precached on install and served cache-first, so the whole
    app works with zero network after the first successful load.
  - RUNTIME_CACHE holds third-party CDN assets (Chart.js, jsPDF,
    Google Fonts). These are served cache-first once fetched, and
    fetched-and-cached in the background on future visits
    (stale-while-revalidate), so a slow/broken connection never
    blocks the app — it just uses the cached copy.
  - Navigation requests that fail *and* aren't cached fall back
    to offline.html so the user never sees a raw browser error.

  VERSIONING:
  Bump CACHE_VERSION whenever any app file changes. On activate,
  old caches are deleted automatically so users always pick up
  the new version on their next visit (no manual cache clearing
  required).
*/

const CACHE_VERSION = 'v1.0.0';
const APP_SHELL_CACHE = `milk-ledger-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `milk-ledger-runtime-${CACHE_VERSION}`;

const APP_SHELL_FILES = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './css/style.css',
  './js/utils.js',
  './js/storage.js',
  './js/billing.js',
  './js/charts.js',
  './js/customers.js',
  './js/rates.js',
  './js/entries.js',
  './js/payments.js',
  './js/invoices.js',
  './js/reports.js',
  './js/dashboard.js',
  './js/settings.js',
  './js/app.js',
  './assets/icons/favicon.svg',
  './assets/icons/favicon-32.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-192-maskable.png',
  './assets/icons/icon-512-maskable.png'
];

// Third-party CDN resources the app uses (charts + PDF export + webfonts).
// Cached at runtime so they still work offline after the first fetch.
const RUNTIME_HOSTS = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// ---------- INSTALL: precache the app shell ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// ---------- ACTIVATE: clean up old versioned caches ----------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ---------- FETCH ----------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navigation requests (loading a page / app start) — app-shell first,
  // fall back to offline.html only if nothing cached and network fails.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => {
        return (
          cached ||
          fetch(request).catch(() => caches.match('./offline.html'))
        );
      })
    );
    return;
  }

  // Third-party CDN assets — stale-while-revalidate.
  if (RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached); // offline & not cached yet — nothing we can do
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // Everything else same-origin (app shell files, in case new ones appear) —
  // cache-first, fall back to network, then cache the result for next time.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./offline.html'));
    })
  );
});

// Allow the page to trigger an immediate update (e.g. from a "Update available" toast).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

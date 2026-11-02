// Service worker игры «Шахтёр 1899»: игра работает без интернета, если её уже открывали.
// Сначала — сеть (чтобы новая версия приходила сразу), без сети — сохранённая копия.
const CACHE = 'm1899-play-v1';
const FILES = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // радио, видео, Telegram — как есть
    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
                return res;
            })
            .catch(() => caches.match(e.request, { ignoreSearch: true }).then(m => m || caches.match('./')))
    );
});

// __BUILD_TIMESTAMP__ is replaced with a numeric timestamp at build time so each
// new build gets its own cache bucket and old caches are cleaned up on activation.
const CACHE = 'land-ledger-__BUILD_TIMESTAMP__';

self.addEventListener('install', () => {
	// Take over immediately — don't wait for existing tabs to close
	self.skipWaiting();
});

self.addEventListener('activate', e => {
	e.waitUntil(
		caches
			.keys()
			.then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener('fetch', e => {
	const { request } = e;
	const url = new URL(request.url);

	// Only handle same-origin GET requests
	if (url.origin !== location.origin || request.method !== 'GET') return;

	const isStaticAsset = /\.(js|css|svg|png|ico|woff2?)(\?.*)?$/.test(url.pathname);
	const isAppShell = url.pathname === '/';

	if (isStaticAsset || isAppShell) {
		// Cache-first: serve immediately from cache, update in background
		e.respondWith(
			caches.open(CACHE).then(cache =>
				cache.match(request).then(cached => {
					const networkUpdate = fetch(request)
						.then(response => {
							if (response.ok) cache.put(request, response.clone());
							return response;
						})
						.catch(() => cached);

					return cached ?? networkUpdate;
				}),
			),
		);
		return;
	}

	// API calls — network-first, fall back to last cached response
	e.respondWith(
		caches.open(CACHE).then(cache =>
			fetch(request)
				.then(response => {
					if (response.ok) cache.put(request, response.clone());
					return response;
				})
				.catch(() =>
					cache.match(request).then(
						r =>
							r ??
							new Response('{"_offline":true}', {
								status: 503,
								headers: { 'Content-Type': 'application/json' },
							}),
					),
				),
		),
	);
});

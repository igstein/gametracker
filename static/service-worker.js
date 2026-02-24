// Service Worker for GameTracker PWA
// Provides offline support by caching app shell and assets

const CACHE_VERSION = 'v1';
const CACHE_NAME = `gametracker-${CACHE_VERSION}`;

// Files to cache for offline use
const STATIC_CACHE = [
	'/',
	'/favicon.ico'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
	console.log('[SW] Installing service worker...');

	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => {
				console.log('[SW] Caching app shell');
				return cache.addAll(STATIC_CACHE);
			})
			.then(() => self.skipWaiting())
			.catch((error) => {
				console.error('[SW] Install failed:', error);
			})
	);
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
	console.log('[SW] Activating service worker...');

	event.waitUntil(
		caches.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames
						.filter((name) => name !== CACHE_NAME)
						.map((name) => {
							console.log('[SW] Deleting old cache:', name);
							return caches.delete(name);
						})
				);
			})
			.then(() => self.clients.claim())
	);
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests
	if (request.method !== 'GET') {
		return;
	}

	// Skip Supabase requests (always need network)
	if (url.hostname.includes('supabase')) {
		return;
	}

	// Network-first strategy for app routes
	event.respondWith(
		fetch(request)
			.then((response) => {
				// Clone response before caching
				const responseToCache = response.clone();

				// Update cache with fresh content
				caches.open(CACHE_NAME)
					.then((cache) => {
						cache.put(request, responseToCache);
					});

				return response;
			})
			.catch(() => {
				// Network failed, try cache
				return caches.match(request)
					.then((cachedResponse) => {
						if (cachedResponse) {
							console.log('[SW] Serving from cache:', request.url);
							return cachedResponse;
						}

						// Nothing in cache either
						return new Response('Offline', {
							status: 503,
							statusText: 'Service Unavailable'
						});
					});
			})
	);
});

// Listen for skip waiting message
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});

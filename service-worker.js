// Application version - change this when updating the app
const APP_VERSION = 'neststash-v2'; // Increment this with each significant update
const CACHE_NAME = `${APP_VERSION}-cache`;
const BASE_PATH = '/neststash';
const ASSETS_TO_CACHE = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/app.js`,
  `${BASE_PATH}/styles.css`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/public/icon-192.png`,
  `${BASE_PATH}/public/icon-192-maskable.png`,
  `${BASE_PATH}/public/icon-512.png`,
  `${BASE_PATH}/public/icon-512-maskable.png`,
  `${BASE_PATH}/public/favicon.ico`,
  `${BASE_PATH}/public/apple-touch-icon.png`
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  // Skip waiting forces the waiting service worker to become the active service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache:', CACHE_NAME);
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  // Claim clients so the new service worker takes over immediately
  event.waitUntil(self.clients.claim());
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event with network-first strategy for app files and cache-first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Handle app update check
  if (url.pathname.endsWith('/app-version')) {
    return event.respondWith(new Response(APP_VERSION, {
      headers: { 'Content-Type': 'text/plain' }
    }));
  }
  
  // Network-first strategy for HTML, JS, and CSS files
  if (url.pathname.endsWith('.html') || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css') ||
      url.pathname === `${BASE_PATH}/` ||
      url.pathname === BASE_PATH) {
    
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the latest version
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try from cache
          return caches.match(event.request);
        })
    );
  } else {
    // Cache-first strategy for other resources (images, etc.)
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then(response => {
              // Cache the asset
              if (response && response.status === 200) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, responseToCache);
                });
              }
              return response;
            });
        })
    );
  }
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
}); 
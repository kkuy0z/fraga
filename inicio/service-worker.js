/**
 * Service Worker - Fraga Lanches PWA
 * Versão do cache - incrementar ao fazer mudanças nos arquivos estáticos
 */
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `fraga-lanches-${CACHE_VERSION}`;
const CACHE_STATIC = `fraga-static-${CACHE_VERSION}`;
const CACHE_API = `fraga-api-${CACHE_VERSION}`;
const CACHE_IMAGES = `fraga-images-${CACHE_VERSION}`;

// Arquivos essenciais para funcionamento offline (App Shell)
const STATIC_ASSETS = [
  '/inicio/index.html',
  '/inicio/cardapio.html',
  '/inicio/carrinho.html',
  '/inicio/checkout.html',
  '/inicio/meus-pedidos.html',
  '/inicio/perfil.html',
  '/inicio/admin-login.html',
  '/inicio/admin-dashboard.html',
  '/inicio/admin-categorias.html',
  '/inicio/admin-produtos.html',
  '/inicio/admin-pedidos.html',
  '/inicio/admin-horarios.html',
  '/inicio/admin-entrega.html',
  '/inicio/admin-pagamentos.html',
  '/inicio/admin-usuarios.html',
  '/inicio/style.css',
  '/inicio/style-pages.css',
  '/inicio/js/api.js',
  '/inicio/js/cart.js',
  '/inicio/js/carrinho.js',
  '/inicio/js/checkout.js',
  '/inicio/js/index.js',
  '/inicio/js/cardapio.js',
  '/inicio/js/utils.js',
  '/inicio/js/meus-pedidos.js',
  '/inicio/js/perfil.js',
  '/inicio/js/admin-login.js',
  '/inicio/js/admin-dashboard.js',
  '/inicio/js/admin-categorias.js',
  '/inicio/js/admin-produtos.js',
  '/inicio/js/admin-pedidos.js',
  '/inicio/js/admin-horarios.js',
  '/inicio/js/admin-entrega.js',
  '/inicio/js/admin-pagamentos.js',
  '/inicio/js/admin-usuarios.js',
  '/inicio/manifest.json',
  '/img/logo.png',
  '/img/icon-192.png',
  '/img/icon-512.png'
];

// Estratégias de cache
const CACHE_STRATEGIES = {
  // Cache First - para assets estáticos (CSS, JS, imagens)
  cacheFirst: async (request, cacheName) => {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      // Atualizar em background (stale-while-revalidate)
      fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
      }).catch(() => {});
      return cachedResponse;
    }

    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
  },

  // Network First - para APIs (dados dinâmicos)
  networkFirst: async (request, cacheName) => {
    const cache = await caches.open(cacheName);

    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      return new Response(JSON.stringify({
        error: 'Você está offline. Alguns dados podem não estar atualizados.',
        offline: true
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Stale While Revalidate - para recursos que podem ser servidos do cache mas atualizados em background
  staleWhileRevalidate: async (request, cacheName) => {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    const fetchPromise = fetch(request).then(networkResponse => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    }).catch(() => cachedResponse);

    return cachedResponse || fetchPromise;
  }
};

// Install - Cache do App Shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => {
        console.log('[SW] Caching App Shell');
        return cache.addAll(STATIC_ASSETS.map(url => {
          return new Request(url, { credentials: 'same-origin' });
        })).catch(err => {
          console.warn('[SW] Alguns assets falharam no cache:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate - Limpar caches antigos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('fraga-') && name !== CACHE_STATIC && name !== CACHE_API && name !== CACHE_IMAGES)
            .map(name => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch - Interceptar requisições
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não-GET
  if (request.method !== 'GET') return;

  // Ignorar extensões do Chrome, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // API calls - Network First com fallback para cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(CACHE_STRATEGIES.networkFirst(request, CACHE_API));
    return;
  }

  // Imagens - Cache First
  if (request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|ico)$/i)) {
    event.respondWith(CACHE_STRATEGIES.cacheFirst(request, CACHE_IMAGES));
    return;
  }

  // CSS/JS - Cache First
  if (request.destination === 'style' || request.destination === 'script' || url.pathname.match(/\.(css|js)$/i)) {
    event.respondWith(CACHE_STRATEGIES.cacheFirst(request, CACHE_STATIC));
    return;
  }

  // HTML pages - Stale While Revalidate
  if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(CACHE_STRATEGIES.staleWhileRevalidate(request, CACHE_STATIC));
    return;
  }

  // Outros - Network First
  event.respondWith(CACHE_STRATEGIES.networkFirst(request, CACHE_STATIC));
});

// Background Sync - para sincronizar pedidos quando voltar online
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }

  if (event.tag === 'sync-cart') {
    event.waitUntil(syncCart());
  }
});

async function syncOrders() {
  try {
    // Tentar buscar pedidos pendentes do IndexedDB e enviar
    console.log('[SW] Sincronizando pedidos...');
    // Implementação futura se necessário
  } catch (error) {
    console.error('[SW] Erro ao sincronizar pedidos:', error);
  }
}

async function syncCart() {
  try {
    console.log('[SW] Sincronizando carrinho...');
    // O carrinho já é salvo no localStorage, que persiste
  } catch (error) {
    console.error('[SW] Erro ao sincronizar carrinho:', error);
  }
}

// Push Notifications (futuro)
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Nova atualização no seu pedido',
    icon: '/img/icon-192.png',
    badge: '/img/icon-72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      { action: 'view', title: 'Ver Pedido' },
      { action: 'dismiss', title: 'Dispensar' }
    ],
    requireInteraction: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Fraga Lanches', options)
  );
});

// Notification Click
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/inicio/meus-pedidos.html')
    );
  }
});

// Message handling - comunicação com a página
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(names =>
        Promise.all(names.map(name => caches.delete(name)))
      ).then(() => event.ports[0].postMessage({ success: true }))
    );
  }
});

console.log('[SW] Service Worker carregado -', CACHE_VERSION);
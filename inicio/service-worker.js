/**
 * Service Worker - Fraga Lanches PWA
 * Versão do cache - incrementar ao fazer mudanças nos arquivos estáticos
 */
const CACHE_VERSION = 'v1.1.0';
const CACHE_NAME = `fraga-lanches-${CACHE_VERSION}`;
const CACHE_STATIC = `fraga-static-${CACHE_VERSION}`;
const CACHE_API = `fraga-api-${CACHE_VERSION}`;
const CACHE_IMAGES = `fraga-images-${CACHE_VERSION}`;

// Arquivos essenciais para funcionamento offline (App Shell)
const STATIC_ASSETS = [
  '/index.html',
  '/cardapio.html',
  '/carrinho.html',
  '/checkout.html',
  '/meus-pedidos.html',
  '/perfil.html',
  '/admin-login.html',
  '/admin-dashboard.html',
  '/admin-categorias.html',
  '/admin-produtos.html',
  '/admin-pedidos.html',
  '/admin-horarios.html',
  '/admin-entrega.html',
  '/admin-pagamentos.html',
  '/admin-usuarios.html',
  '/style.css',
  '/style-pages.css',
  '/js/api.js',
  '/js/cart.js',
  '/js/carrinho.js',
  '/js/checkout.js',
  '/js/index.js',
  '/js/cardapio.js',
  '/js/utils.js',
  '/js/meus-pedidos.js',
  '/js/perfil.js',
  '/js/admin-login.js',
  '/js/admin-dashboard.js',
  '/js/admin-categorias.js',
  '/js/admin-produtos.js',
  '/js/admin-pedidos.js',
  '/js/admin-horarios.js',
  '/js/admin-entrega.js',
  '/js/admin-pagamentos.js',
  '/js/admin-usuarios.js',
  '/manifest.json',
  '/img/logo.png',
  '/img/icon-192.svg',
  '/img/icon-512.svg'
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
    console.log('[SW] Sincronizando pedidos pendentes...');

    // Get pending orders from IndexedDB
    const pendingOrders = await getPendingOrdersFromIDB();

    if (pendingOrders.length === 0) {
      console.log('[SW] Nenhum pedido pendente para sincronizar');
      return;
    }

    console.log(`[SW] Encontrados ${pendingOrders.length} pedidos pendentes`);

    for (const order of pendingOrders) {
      try {
        const response = await fetch('/api/pedidos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${order.token}`
          },
          body: JSON.stringify(order.data)
        });

        if (response.ok) {
          // Remove from IndexedDB on success
          await removePendingOrderFromIDB(order.id);
          console.log(`[SW] Pedido ${order.id} sincronizado com sucesso`);

          // Notify the client
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'ORDER_SYNCED',
              orderId: order.id,
              success: true
            });
          });
        } else {
          const error = await response.json();
          console.error(`[SW] Falha ao sincronizar pedido ${order.id}:`, error);

          // Notify the client of failure
          const clients = await self.clients.matchAll();
          clients.forEach(client => {
            client.postMessage({
              type: 'ORDER_SYNC_FAILED',
              orderId: order.id,
              error: error.error || 'Erro ao sincronizar'
            });
          });
        }
      } catch (error) {
        console.error(`[SW] Erro ao sincronizar pedido ${order.id}:`, error);
      }
    }
  } catch (error) {
    console.error('[SW] Erro ao sincronizar pedidos:', error);
  }
}

async function syncCart() {
  try {
    console.log('[SW] Sincronizando carrinho...');
    // O carrinho já é salvo no localStorage, que persiste
    // Podemos notificar o cliente que a sincronização ocorreu
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'CART_SYNCED',
        success: true
      });
    });
  } catch (error) {
    console.error('[SW] Erro ao sincronizar carrinho:', error);
  }
}

// IndexedDB helpers for offline order storage
function openIDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FragaLanchesOffline', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingOrders')) {
        const store = db.createObjectStore('pendingOrders', { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getPendingOrdersFromIDB() {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingOrders'], 'readonly');
    const store = transaction.objectStore('pendingOrders');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removePendingOrderFromIDB(id) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingOrders'], 'readwrite');
    const store = transaction.objectStore('pendingOrders');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Push Notifications
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Nova atualização no seu pedido',
    icon: '/img/icon-192.svg',
    badge: '/img/icon-72.svg',
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
      clients.openWindow('/meus-pedidos.html')
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

  // Queue order for offline sync
  if (event.data && event.data.type === 'QUEUE_ORDER') {
    queueOrderForSync(event.data.orderData, event.data.token)
      .then(() => event.ports[0].postMessage({ success: true }))
      .catch(err => event.ports[0].postMessage({ success: false, error: err.message }));
  }
});

async function queueOrderForSync(orderData, token) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pendingOrders'], 'readwrite');
    const store = transaction.objectStore('pendingOrders');
    const request = store.add({
      data: orderData,
      token: token,
      timestamp: Date.now()
    });

    request.onsuccess = () => {
      console.log('[SW] Pedido adicionado à fila de sincronização offline');
      // Register for background sync
      self.registration.sync.register('sync-orders').catch(console.error);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

console.log('[SW] Service Worker carregado -', CACHE_VERSION);
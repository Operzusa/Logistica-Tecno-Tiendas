
const CACHE_NAME = 'tecno-logistics-v4';
const ASSETS = [
  '/',
  '/index.html',
  '/index.tsx',
  '/types.ts',
  '/manifest.json'
];

// Instalación y cacheo de assets críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Limpieza de caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Estrategia de red con fallback a cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});

// --- MANEJO DE NOTIFICACIONES PUSH (ESTADO BACKGROUND / KILLED) ---

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Tecno Logistics',
    body: 'Tienes una nueva actualización pendiente.',
    icon: 'https://api.dicebear.com/7.x/shapes/svg?seed=tecno&backgroundColor=0d93f2',
    data: { url: '/', serviceId: null }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload = { ...payload, ...data };
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: 'https://api.dicebear.com/7.x/shapes/svg?seed=tecno&backgroundColor=0d93f2',
    vibrate: [300, 100, 300, 100, 400],
    data: payload.data, // Aquí guardamos el serviceId para el deep link
    tag: payload.tag || 'general-notification',
    renotify: true,
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'Ver Detalles', icon: 'https://api.dicebear.com/7.x/material-symbols/svg?seed=visibility' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// --- MANEJO DE CLIC EN NOTIFICACIÓN ---

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;

  notification.close();

  if (action === 'close') return;

  const targetUrl = notification.data?.url || '/';
  const serviceId = notification.data?.serviceId;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Intentar encontrar una ventana ya abierta
      for (let client of windowClients) {
        if (client.url.includes(location.origin) && 'focus' in client) {
          // Enviar mensaje de navegación a la ventana activa
          client.postMessage({
            type: 'NAVIGATE',
            serviceId: serviceId
          });
          return client.focus();
        }
      }
      
      // 2. Si no hay ventana abierta, abrir una nueva con parámetros de ruta
      if (clients.openWindow) {
        const finalUrl = serviceId ? `${targetUrl}?serviceId=${serviceId}` : targetUrl;
        return clients.openWindow(finalUrl);
      }
    })
  );
});

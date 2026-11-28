// Service Worker minimal pour rendre Tito installable (PWA)
// Stratégie network-first : l'utilisateur obtient toujours la dernière version de l'application.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Laisse le navigateur gérer les requêtes normalement (évite tout cache obsolète)
});

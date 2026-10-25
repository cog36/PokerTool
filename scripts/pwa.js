import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Cache only the built interface. Chats, uploads and API responses stay on the network.
export default function phoneApp() {
  return {
    name: 'pokertool-phone-app',
    apply: 'build',
    writeBundle(output, bundle) {
      const revision = createHash('sha256');
      for (const file of Object.values(bundle)) revision.update(file.type === 'chunk' ? file.code : file.source);
      for (const name of ['manifest.webmanifest', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'images/poker-portraits.png']) {
        revision.update(readFileSync(resolve(output.dir, name)));
      }
      const cache = `pokertool-shell-${revision.digest('hex').slice(0, 12)}`;
      const files = ['./', ...Object.keys(bundle).map(name => `./${name}`),
        './manifest.webmanifest', './favicon.svg', './icons/icon-192.png', './icons/icon-512.png',
        './icons/apple-touch-icon.png', './images/poker-portraits.png'];
      writeFileSync(resolve(output.dir, 'sw.js'), `
const CACHE = ${JSON.stringify(cache)};
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
// A new version waits until the old app is closed; never interrupt a live hand.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('pokertool-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = url.pathname.slice(scope.pathname.length);
  if (path === 'api' || path.startsWith('api/')) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    // Static module requests can carry an Origin header absent during precache.
    const saved = await cache.match(event.request, { ignoreSearch: true, ignoreVary: true });
    if (saved) return saved;
    return fetch(event.request);
  }));
});`);
    },
  };
}

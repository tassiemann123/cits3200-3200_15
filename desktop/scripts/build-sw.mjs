import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
  }));
  return nested.flat();
}

const files = (await walk(dist))
  .map((path) => relative(dist, path).split(sep).join('/'))
  .filter((path) => path !== 'sw.js')
  .sort();
if (!files.includes('index.html')) throw new Error('Run vite build before generating the service worker.');
const digest = createHash('sha256');
for (const file of files) {
  digest.update(file).update('\0').update(await readFile(join(dist, file)));
}
const version = digest.digest('hex').slice(0, 16);

// Relative resource names allow the same output to run at / or a hosted subpath.
const worker = `/* Generated from all production files. Do not hand-edit. */
const VERSION = ${JSON.stringify(version)};
const FILES = ${JSON.stringify(files)};
const BASE = self.registration.scope;
const PREFIX = 'osteo-desktop-shell:' + encodeURIComponent(BASE) + ':';
const CACHE = PREFIX + VERSION;
const URLS = FILES.map(file => new URL(file, BASE).href);
const SHELL = new URL('index.html', BASE).href;
const ASSETS = new Set(URLS);

self.addEventListener('install', event => {
  // Installation fails atomically if even one required resource is unavailable.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    URLS.map(url => new Request(url, { cache: 'reload' }))
  )));
  // Updates wait for existing windows to close, keeping the current UI and shell consistent.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'OSTEO_CHECK_OFFLINE' || !event.ports[0]) return;
  event.waitUntil((async () => {
    let ready = false;
    try {
      if (await caches.has(CACHE)) {
        const cache = await caches.open(CACHE);
        const matches = await Promise.all(URLS.map(url => cache.match(url)));
        ready = matches.every(Boolean);
      }
    } catch { /* Unavailable browser storage must never be reported as ready. */ }
    event.ports[0].postMessage({ type: 'OSTEO_OFFLINE_STATUS', ready, version: VERSION });
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(BASE)) return;
  if (request.mode === 'navigate') {
    // The active app and its hashed assets always come from the same cached build.
    event.respondWith(caches.open(CACHE).then(async cache =>
      (await cache.match(SHELL)) || fetch(request)
    ));
    return;
  }
  url.search = '';
  if (!ASSETS.has(url.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache =>
    (await cache.match(url.href)) || fetch(request)
  ));
});
`;
await writeFile(join(dist, 'sw.js'), worker);
console.log(`Offline shell ${version}: ${files.length} local files precached.`);

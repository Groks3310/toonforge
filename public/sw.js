// ToonForge service worker: lets the app open and work without an internet connection.
//
// Strategy:
// - Pages: try the network first, fall back to the saved copy when offline.
// - Everything else from this site (scripts, styles, fonts, models, images): saved the first
//   time it is used, then served from the saved copy.
// When you change a file that keeps the same name (for example a model in public/models),
// raise VERSION so people get the new one.
const VERSION = 'toonforge-v1'
const SHELL_CACHE = VERSION + '-shell'
const FILE_CACHE = VERSION + '-files'
const START_URL = self.registration.scope
const EXTRA_FILES = ['models/RobotExpressive.glb']

self.addEventListener('install', function install(event) {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()))
})

// Save the start page and the scripts and styles it uses, so the first offline launch works.
async function precacheShell() {
  const shell = await caches.open(SHELL_CACHE)
  const response = await fetch(START_URL, { cache: 'reload' })
  await shell.put(START_URL, response.clone())

  const html = await response.text()
  const files = new Set()
  const pattern = /(?:src|href)="([^"]+\.(?:js|css|webmanifest|png|svg|ico))"/g
  let match = pattern.exec(html)
  while (match) {
    const url = new URL(match[1], START_URL)
    if (url.origin === self.location.origin) files.add(url.href)
    match = pattern.exec(html)
  }
  // The robot model is small and needed by two studios, so save it right away.
  // (The background-removal model and engine are larger. They are saved the first time you use them.)
  EXTRA_FILES.forEach((path) => files.add(new URL(path, START_URL).href))

  const cache = await caches.open(FILE_CACHE)
  await Promise.all(
    [...files].map((href) => cache.add(href).catch(() => undefined)),
  )
}

self.addEventListener('activate', function activate(event) {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith('toonforge-') && !name.startsWith(VERSION))
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', function onFetch(event) {
  const request = event.request
  if (request.method !== 'GET') return
  if (request.headers.has('range')) return // audio and video seeking cannot be saved
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // other websites are never saved

  if (request.mode === 'navigate') {
    event.respondWith(pageNetworkFirst(request))
  } else {
    event.respondWith(fileCacheFirst(request))
  }
})

async function pageNetworkFirst(request) {
  const shell = await caches.open(SHELL_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) await shell.put(START_URL, response.clone())
    return response
  } catch (error) {
    const saved = await shell.match(START_URL)
    if (saved) return saved
    throw error
  }
}

async function fileCacheFirst(request) {
  const cache = await caches.open(FILE_CACHE)
  const saved = await cache.match(request)
  if (saved) return saved
  const response = await fetch(request)
  if (response.ok && response.status === 200) {
    await cache.put(request, response.clone())
  }
  return response
}

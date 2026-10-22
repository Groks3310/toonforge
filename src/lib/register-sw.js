// Registers the service worker (public/sw.js). It only runs in the built app, not while you
// develop with "npm run dev", so old saved files never confuse your testing.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', function register() {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(function failed(error) {
        console.warn('Offline support could not start:', error)
      })
  })
}

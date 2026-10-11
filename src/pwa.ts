/** Registers the service worker in production builds, scoped to the app's base path. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((err: unknown) => {
      console.warn('Service worker registration failed', err);
    });
  });
}

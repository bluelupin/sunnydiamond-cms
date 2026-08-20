const CHUNK_RELOAD_KEY = 'strapi-admin-chunk-reload';
const CHUNK_RELOAD_COOLDOWN_MS = 30_000;

const reloadAfterStaleChunk = () => {
  const lastReload = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);

  if (Date.now() - lastReload < CHUNK_RELOAD_COOLDOWN_MS) return;

  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  window.location.reload();
};

export default {
  config: {},
  bootstrap() {
    window.addEventListener('vite:preloadError', (event) => {
      event.preventDefault();
      reloadAfterStaleChunk();
    });

    window.addEventListener('unhandledrejection', (event) => {
      const message = String(event.reason?.message ?? event.reason ?? '');
      const isStaleChunk =
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('error loading dynamically imported module');

      if (!isStaleChunk) return;

      event.preventDefault();
      reloadAfterStaleChunk();
    });
  },
};

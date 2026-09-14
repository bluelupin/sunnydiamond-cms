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
  bootstrap(app: { registerHook: (name: string, handler: (args: any) => any) => void }) {
    app.registerHook('Admin/CM/pages/EditView/mutate-edit-view-layout', (args) => {
      const component = args.layout.components?.['shared.showroom-section'];
      if (!component) return args;

      const isVisitSection = args.layout.layout.some((panel: any[][]) =>
        panel.some((row) => row.some((field) =>
          field.name === 'visitSection' &&
          field.attribute?.component === 'shared.showroom-section'
        ))
      );
      const hiddenFields = isVisitSection ? ['showrooms'] : ['backgroundImage', 'welcomeNote'];

      return {
        ...args,
        layout: {
          ...args.layout,
          components: {
            ...args.layout.components,
            'shared.showroom-section': {
              ...component,
              layout: component.layout
                .map((row: { name: string }[]) => row.filter((field) => !hiddenFields.includes(field.name)))
                .filter((row: { name: string }[]) => row.length > 0),
            },
          },
        },
      };
    });

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

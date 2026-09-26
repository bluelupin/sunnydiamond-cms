import { Download } from '@strapi/icons';

import pluginId from './pluginId';

export default {
  register(app: any) {
    app.addMenuLink({
      to: `plugins/${pluginId}`,
      icon: Download,
      intlLabel: {
        id: `${pluginId}.plugin.name`,
        defaultMessage: 'Form Export',
      },
      Component: async () => {
        const { default: App } = await import('./pages/App');

        return App;
      },
    });

    app.registerPlugin({
      id: pluginId,
      name: 'Form Export',
    });
  },
};

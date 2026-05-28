export default {
  routes: [
    {
      method: 'GET',
      path: '/homepage/shell',
      handler: 'homepage.shell',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/homepage/sections',
      handler: 'homepage.sections',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/homepage/shopping-blocks',
      handler: 'homepage.shoppingBlocks',
      config: {
        auth: false,
      },
    },
    {
      method: 'GET',
      path: '/homepage/editorial-blocks',
      handler: 'homepage.editorialBlocks',
      config: {
        auth: false,
      },
    },
  ],
};

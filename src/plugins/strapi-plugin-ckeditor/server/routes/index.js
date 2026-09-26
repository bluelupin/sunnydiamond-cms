'use strict';

module.exports = {
  admin: {
    type: 'admin',
    routes: [
      {
        method: 'GET',
        path: '/config',
        handler: 'config.getConfig',
        config: {
          policies: [],
        },
      },
    ],
  },
};

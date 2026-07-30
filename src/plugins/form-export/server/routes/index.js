'use strict';

module.exports = {
  admin: {
    type: 'admin',
    routes: [
      {
        method: 'GET',
        path: '/submissions/:type.csv',
        handler: 'export.submissions',
        config: {
          policies: [],
        },
      },
      {
        method: 'GET',
        path: '/job-applications',
        handler: 'export.jobApplications',
        config: {
          policies: [],
        },
      },
    ],
  },
};

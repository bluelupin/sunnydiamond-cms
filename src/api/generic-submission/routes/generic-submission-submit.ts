export default {
  routes: [
    {
      method: 'POST', path: '/generic-submissions/appointments/submit', handler: 'generic-submission.submit',
      config: { policies: ['global::trusted-magento-customer'] },
    },
    {
      method: 'POST',
      path: '/generic-submissions/submit',
      handler: 'generic-submission.submit',
      config: {
        auth: false,
      },
    },
  ],
};

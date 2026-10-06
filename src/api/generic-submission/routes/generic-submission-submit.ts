export default {
  routes: [
    {
      method: 'POST', path: '/generic-submissions/appointments/submit', handler: 'generic-submission.submit',
      config: { policies: [{ name: 'global::trusted-magento-customer', config: { allowGuestFormTags: ['book-an-appointment'] } }] },
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

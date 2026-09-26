export default {
  routes: [
    {
      method: 'POST',
      path: '/bespoke-submissions/submit',
      handler: 'bespoke-submission.submit',
      config: {
        auth: false,
      },
    },
  ],
};

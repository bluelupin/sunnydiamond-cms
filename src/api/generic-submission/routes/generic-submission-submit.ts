export default {
  routes: [
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

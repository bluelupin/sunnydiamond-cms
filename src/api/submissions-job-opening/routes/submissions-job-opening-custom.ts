export default {
  routes: [
    {
      method: 'POST',
      path: '/submissions-job-openings/submit',
      handler: 'submissions-job-opening.submit',
      config: {
        auth: false,
      },
    },
  ],
};

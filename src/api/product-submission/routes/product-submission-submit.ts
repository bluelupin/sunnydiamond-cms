export default {
  routes: [
    {
      method: 'POST',
      path: '/product-submissions/submit',
      handler: 'product-submission.submit',
      config: {
        auth: false,
      },
    },
  ],
};

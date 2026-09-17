export default {
  routes: [
    {
      method: 'POST',
      path: '/product-submissions/submit',
      handler: 'product-submission.submit',
      config: {
        auth: { strategies: ['content-api-token', 'api-token'] },
        policies: [],
      },
    },
  ],
};

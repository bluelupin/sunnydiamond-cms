export default {
  routes: [
    {
      method: 'POST',
      path: '/product-submissions/submit',
      handler: 'product-submission.submit',
      config: {
        policies: ['global::trusted-magento-customer'],
      },
    },
  ],
};

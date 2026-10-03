export default {
  routes: [
    {
      method: 'POST',
      path: '/product-submissions/submit',
      handler: 'product-submission.submit',
      config: {
        policies: [{ name: 'global::trusted-magento-customer', config: { allowGuestFormTags: ['store-visit', 'product-store-visit'] } }],
      },
    },
  ],
};

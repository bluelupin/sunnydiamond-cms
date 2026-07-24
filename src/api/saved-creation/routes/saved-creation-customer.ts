const customerPolicy = {
  auth: false,
  policies: ['global::magento-customer'],
};

export default {
  routes: [
    {
      method: 'POST',
      path: '/customer/saved-creations',
      handler: 'saved-creation.createForCustomer',
      config: customerPolicy,
    },
    {
      method: 'GET',
      path: '/customer/saved-creations',
      handler: 'saved-creation.listForCustomer',
      config: customerPolicy,
    },
    {
      method: 'DELETE',
      path: '/customer/saved-creations/:creationDocumentId',
      handler: 'saved-creation.deleteForCustomer',
      config: customerPolicy,
    },
  ],
};

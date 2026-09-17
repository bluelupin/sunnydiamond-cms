export default {
  routes: [
    {
      method: 'POST',
      path: '/customer/appointments/:documentId/cancel',
      handler: 'product-submission.cancel',
      config: {
        policies: ['global::trusted-magento-customer'],
      },
    },
    {
      method: 'POST',
      path: '/customer/appointments/:documentId/reschedule',
      handler: 'product-submission.reschedule',
      config: {
        policies: ['global::trusted-magento-customer'],
      },
    },
    {
      method: 'GET',
      path: '/customer/appointments',
      handler: 'product-submission.customerAppointments',
      config: {
        policies: ['global::trusted-magento-customer'],
      },
    },
  ],
};

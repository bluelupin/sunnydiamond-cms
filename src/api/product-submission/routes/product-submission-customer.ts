export default {
  routes: [
    {
      method: 'POST',
      path: '/customer/appointments/:documentId/cancel',
      handler: 'product-submission.cancel',
      config: {
        policies: [{ name: 'global::trusted-magento-customer', config: { allowGuestAppointments: true } }],
      },
    },
    {
      method: 'POST',
      path: '/customer/appointments/:documentId/reschedule',
      handler: 'product-submission.reschedule',
      config: {
        policies: [{ name: 'global::trusted-magento-customer', config: { allowGuestAppointments: true } }],
      },
    },
    {
      method: 'GET',
      path: '/customer/appointments',
      handler: 'product-submission.customerAppointments',
      config: {
        policies: [{ name: 'global::trusted-magento-customer', config: { allowGuestAppointments: true } }],
      },
    },
  ],
};

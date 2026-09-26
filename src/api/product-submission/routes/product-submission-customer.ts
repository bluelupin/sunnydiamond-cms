const customerOnly = { policies: ['global::trusted-magento-customer'] };

export default {
  routes: [
    {
      method: 'POST',
      path: '/customer/appointments/:documentId/cancel',
      handler: 'product-submission.cancel',
      config: customerOnly,
    },
    {
      method: 'POST',
      path: '/customer/appointments/:documentId/reschedule',
      handler: 'product-submission.reschedule',
      config: customerOnly,
    },
    {
      method: 'POST',
      path: '/customer/appointments/:documentId/pieces',
      handler: 'product-submission.addPiece',
      config: customerOnly,
    },
    {
      method: 'GET',
      path: '/customer/appointments/open',
      handler: 'product-submission.openAppointments',
      config: customerOnly,
    },
    {
      method: 'GET',
      path: '/customer/appointments',
      handler: 'product-submission.customerAppointments',
      config: customerOnly,
    },
  ],
};

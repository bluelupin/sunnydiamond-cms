export default {
  routes: [
    {
      method: 'POST',
      path: '/customer/appointments/:documentId/reschedule',
      handler: 'product-submission.reschedule',
      config: {
        auth: { strategies: ['content-api-token', 'api-token'] },
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/customer/appointments',
      handler: 'product-submission.customerAppointments',
      config: {
        auth: { strategies: ['content-api-token', 'api-token'] },
        policies: [],
      },
    },
  ],
};

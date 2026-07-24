export default {
  routes: [
    {
      method: 'GET',
      path: '/customer/appointments',
      handler: 'product-submission.customerAppointments',
      config: {
        auth: false,
        policies: ['global::magento-customer'],
      },
    },
  ],
};

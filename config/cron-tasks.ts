import { sendTomorrowShowroomAppointmentReminders } from '../src/utils/showroom-appointment-reminder';

export default {
  showroomAppointmentReminder: {
    task: async ({ strapi }) => sendTomorrowShowroomAppointmentReminders(strapi),
    options: {
      rule: '0 9 * * *',
      tz: 'Asia/Kolkata',
    },
  },
};

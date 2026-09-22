import { sendTomorrowShowroomAppointmentReminders } from '../src/utils/showroom-appointment-reminder';
import { sendTomorrowTryAtHomeReminders } from '../src/utils/try-at-home-reminder';

export default {
  showroomAppointmentReminder: {
    task: async ({ strapi }) => {
      await sendTomorrowShowroomAppointmentReminders(strapi);
      await sendTomorrowTryAtHomeReminders(strapi);
    },
    options: {
      rule: '0 9 * * *',
      tz: 'Asia/Kolkata',
    },
  },
};

import { sendTomorrowShowroomAppointmentReminders } from '../src/utils/showroom-appointment-reminder';
import { sendTomorrowTryAtHomeReminders } from '../src/utils/try-at-home-reminder';
import { sendTomorrowVideoCallAppointmentReminders } from '../src/utils/video-call-appointment-reminder';

export default {
  showroomAppointmentReminder: {
    task: async ({ strapi }) => {
      await sendTomorrowShowroomAppointmentReminders(strapi);
      await sendTomorrowTryAtHomeReminders(strapi);
      await sendTomorrowVideoCallAppointmentReminders(strapi);
    },
    options: {
      rule: '0 9 * * *',
      tz: 'Asia/Kolkata',
    },
  },
};

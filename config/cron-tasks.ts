import { sendTomorrowShowroomAppointmentReminders } from '../src/utils/showroom-appointment-reminder';
import { sendTomorrowTryAtHomeReminders } from '../src/utils/try-at-home-reminder';
import { sendTomorrowVideoCallAppointmentReminders } from '../src/utils/video-call-appointment-reminder';
import { closePastAppointments } from '../src/utils/close-past-appointments';
import { sendTomorrowGenericAppointmentReminders } from '../src/utils/generic-appointment-reminder';

export default {
  closePastAppointments: {
    task: async ({ strapi }) => {
      await closePastAppointments(strapi);
    },
    options: {
      rule: '5 0 * * *',
      tz: 'Asia/Kolkata',
    },
  },
  showroomAppointmentReminder: {
    task: async ({ strapi }) => {
      await sendTomorrowShowroomAppointmentReminders(strapi);
      await sendTomorrowGenericAppointmentReminders(strapi);
      await sendTomorrowTryAtHomeReminders(strapi);
      await sendTomorrowVideoCallAppointmentReminders(strapi);
    },
    options: {
      rule: '0 9 * * *',
      tz: 'Asia/Kolkata',
    },
  },
};

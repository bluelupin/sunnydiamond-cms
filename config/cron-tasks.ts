import { sendTomorrowShowroomAppointmentReminders } from '../src/utils/showroom-appointment-reminder';
import { sendTomorrowTryAtHomeReminders } from '../src/utils/try-at-home-reminder';
import { sendTomorrowVideoCallAppointmentReminders } from '../src/utils/video-call-appointment-reminder';
import { closePastAppointments } from '../src/utils/close-past-appointments';
import { sendTomorrowGenericAppointmentReminders } from '../src/utils/generic-appointment-reminder';
import { processSmsNotifications } from '../src/utils/process-sms-notifications';

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
  smsNotifications: {
    task: async ({ strapi }) => {
      try { await processSmsNotifications(strapi); }
      catch { strapi.log.error('SMS queue processing failed; pending notifications remain queued.'); }
    },
    options: { rule: '* * * * *' },
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

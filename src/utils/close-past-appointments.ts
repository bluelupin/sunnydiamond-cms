import type { Core } from '@strapi/strapi';
import { appointmentToday, RESCHEDULABLE_FORM_TAGS } from './appointment-schedule';

/** Close overdue appointments without changing completed or cancelled outcomes. */
export async function closePastAppointments(strapi: Core.Strapi) {
  const today = appointmentToday();
  const updatedAt = new Date();
  const where = {
    requestedDate: { $lt: today },
    workflowStatus: { $in: ['New', 'Contacted', 'Scheduled'] },
  };

  // Conditional bulk updates cover all records (no pagination limit) and recheck
  // date/status at write time. Keep groups and their submissions in one transaction.
  const result = await strapi.db.transaction(async () => {
    const groups = await strapi.db.query('api::appointment-group.appointment-group').updateMany({
      where,
      data: { workflowStatus: 'Closed', activeScheduleKey: null, updatedAt },
    });
    const submissions = await strapi.db.query('api::product-submission.product-submission').updateMany({
      where: { ...where, formTag: { $in: [...RESCHEDULABLE_FORM_TAGS, 'product-store-visit'] } },
      data: { workflowStatus: 'Closed', updatedAt },
    });
    return { groups: groups.count, submissions: submissions.count };
  });

  strapi.log.info(`Closed appointments before ${today}: ${result.groups} groups, ${result.submissions} submissions.`);
  return result;
}

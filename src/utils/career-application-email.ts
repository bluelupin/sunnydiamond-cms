import type { Core } from '@strapi/strapi';
import { careerApplicationReceivedTemplate } from '../emails/career-application-received';

interface CareerApplicationNotification {
  documentId: string;
  candidateName?: string | null;
  candidateEmail?: string | null;
}

export async function sendCareerApplicationReceivedEmail(
  strapi: Core.Strapi,
  data: CareerApplicationNotification,
) {
  const to = data.candidateEmail?.trim();
  if (!to || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to)) return;
  try {
    await strapi.plugin('email').service('email').send({
      to,
      ...careerApplicationReceivedTemplate({ candidateName: data.candidateName }),
    });
    strapi.log.info(`Career acknowledgement email accepted by the email provider for application ${data.documentId}.`);
  } catch {
    strapi.log.error(`Career acknowledgement email failed for application ${data.documentId}; the application remains saved.`);
  }
}

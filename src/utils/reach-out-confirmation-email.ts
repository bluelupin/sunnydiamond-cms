import type { Core } from '@strapi/strapi';
import { reachOutConfirmationTemplate } from '../emails/reach-out-confirmation';

interface ReachOutConfirmation {
  documentId: string;
  customerName?: string | null;
  customerEmail?: string | null;
}

export async function sendReachOutConfirmationEmail(strapi: Core.Strapi, data: ReachOutConfirmation) {
  const to = data.customerEmail?.trim();
  if (!to || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to)) return;
  try {
    await strapi.plugin('email').service('email').send({
      to,
      ...reachOutConfirmationTemplate({ customerName: data.customerName }),
    });
    strapi.log.info(`Reach-out confirmation email accepted by the email provider for submission ${data.documentId}.`);
  } catch {
    strapi.log.error(`Reach-out confirmation email failed for submission ${data.documentId}; the enquiry remains saved.`);
  }
}

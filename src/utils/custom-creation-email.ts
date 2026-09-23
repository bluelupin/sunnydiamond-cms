import type { Core } from '@strapi/strapi';
import { customCreationReceivedTemplate } from '../emails/custom-creation-received';

export async function sendCustomCreationReceivedEmail(strapi: Core.Strapi, data: {
  documentId: string; customerName?: string | null; customerEmail?: string | null;
}) {
  const to = data.customerEmail?.trim();
  if (!to || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to)) return;
  try {
    await strapi.plugin('email').service('email').send({
      to,
      ...customCreationReceivedTemplate({ customerName: data.customerName }),
    });
    strapi.log.info(`Custom creation acknowledgement email accepted by the email provider for submission ${data.documentId}.`);
  } catch {
    strapi.log.error(`Custom creation acknowledgement email failed for submission ${data.documentId}; the submission remains saved.`);
  }
}

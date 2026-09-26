import type { Core } from '@strapi/strapi';
import { productPersonalisationConfirmationTemplate } from '../emails/product-personalisation-confirmation';

interface ProductPersonalisationConfirmation {
  documentId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  productName: string;
  requestDetails?: string | null;
}

export async function sendProductPersonalisationConfirmationEmail(
  strapi: Core.Strapi,
  data: ProductPersonalisationConfirmation,
) {
  const to = data.customerEmail?.trim();
  if (!to || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to)) return;
  try {
    await strapi.plugin('email').service('email').send({
      to,
      ...productPersonalisationConfirmationTemplate({
        customerName: data.customerName,
        productName: data.productName,
        requestDetails: data.requestDetails,
      }),
    });
    strapi.log.info(`Personalisation confirmation email accepted for submission ${data.documentId}.`);
  } catch {
    strapi.log.error(`Personalisation confirmation email failed for submission ${data.documentId}; the request remains saved.`);
  }
}

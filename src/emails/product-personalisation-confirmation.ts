import { restyleSunnyEmail, sunnyEmailLogoAttachments } from './sunny-email-layout';

export interface ProductPersonalisationConfirmationData {
  customerName?: string | null;
  productName: string;
  requestDetails?: string | null;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

/** Customer acknowledgement for product-personalisation submissions. */
export function productPersonalisationConfirmationTemplate(data: ProductPersonalisationConfirmationData) {
  const name = data.customerName?.trim() || 'there';
  const requestDetails = data.requestDetails?.trim();
  const details = [['Product', data.productName], ...(requestDetails ? [['Personalisation Request', requestDetails]] : [])];
  return {
    subject: 'We’ve Received Your Personalisation Request – Sunny Diamonds',
    attachments: sunnyEmailLogoAttachments(),
    text: [
      `Dear ${name},`, '',
      'Thank you for choosing Sunny Diamonds to create something uniquely yours.', '',
      'We’ve received your product personalisation request. Our jewellery expert will review your requirements and contact you shortly.', '',
      'Request Details', '', ...details.map(([label, value]) => `${label}: ${value}`), '',
      'We look forward to helping bring your vision to life.', '',
      'Warm regards,', 'Team Sunny Diamonds', 'Crafted to celebrate your moments',
    ].join('\n'),
    html: restyleSunnyEmail(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Personalisation request received</title></head>
<body style="margin:0;background:#f5f5f5;color:#222;font-family:Arial,sans-serif;line-height:1.6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:32px">
      <h1 style="font-size:24px">We’ve received your personalisation request</h1>
      <p>Dear ${escapeHtml(name)},</p>
      <p>Thank you for choosing <strong>Sunny Diamonds</strong> to create something uniquely yours.</p>
      <p>We’ve received your product personalisation request. Our jewellery expert will review your requirements and contact you shortly.</p>
      <h2 style="font-size:19px">Request Details</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        ${details.map(([label, value]) => `<tr><th scope="row" align="left" style="padding:10px;border-bottom:1px solid #ddd;vertical-align:top">${escapeHtml(label)}</th><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('')}
      </table>
      <p>We look forward to helping bring your vision to life.</p>
      <p>Warm regards,<br><strong>Team Sunny Diamonds</strong><br><em>Crafted to celebrate your moments</em></p>
    </td></tr></table>
  </td></tr></table>
</body></html>`),
  };
}

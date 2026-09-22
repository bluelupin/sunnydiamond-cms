import { formatEmailDate, restyleSunnyEmail, sunnyEmailLogoAttachments } from './sunny-email-layout';

export interface TryAtHomeRescheduledData {
  appointmentId: string;
  customerName?: string | null;
  newDate: string;
  newTime: string;
  deliveryAddress: string;
  productNames: string[];
  manageUrl?: string | null;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

export function tryAtHomeRescheduledTemplate(data: TryAtHomeRescheduledData) {
  const name = data.customerName?.trim() || 'there';
  const products = data.productNames.length ? data.productNames : ['Selected jewellery'];
  const details = [['Appointment ID', data.appointmentId], ['Appointment Type', 'Try at Home'],
    ['New Date', formatEmailDate(data.newDate)], ['New Time', data.newTime], ['Delivery Address', data.deliveryAddress]];
  const manageText = data.manageUrl ? ['', `Manage Appointment: ${data.manageUrl}`,
    'If you need to make any further changes, you can manage your appointment using the link above.'] : [];
  const manageHtml = data.manageUrl ? `<p style="margin:28px 0"><a href="${escapeHtml(data.manageUrl)}" style="display:inline-block;background:#222;color:#fff;padding:12px 20px;text-decoration:none">Manage Appointment</a></p>
      <p>If you need to make any further changes, you can manage your appointment using the link above.</p>` : '';
  return {
    subject: 'Your Sunny Diamonds Try at Home Appointment Has Been Rescheduled',
    attachments: sunnyEmailLogoAttachments(),
    text: [`Dear ${name},`, '', 'Your Sunny Diamonds Try at Home appointment has been successfully rescheduled.', '',
      'Updated Appointment Details', '', ...details.map(([label, value]) => `${label}: ${value}`), '',
      'Selected Jewellery', '', ...products, '', ...manageText, '', 'Warm regards,', 'Team Sunny Diamonds',
      'Crafted to celebrate your moments'].join('\n'),
    html: restyleSunnyEmail(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Try at Home appointment rescheduled</title></head>
<body style="margin:0;background:#f5f5f5;color:#222;font-family:Arial,sans-serif;line-height:1.6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:32px">
      <p style="margin-top:0;font-size:20px;font-weight:bold">Sunny Diamonds</p>
      <h1 style="font-size:24px">Your Try at Home appointment has been rescheduled</h1>
      <p>Dear ${escapeHtml(name)},</p><p>Your <strong>Sunny Diamonds Try at Home appointment</strong> has been successfully rescheduled.</p>
      <h2 style="font-size:19px">Updated Appointment Details</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${details.map(([label, value]) => `<tr><th scope="row" align="left" style="padding:10px;border-bottom:1px solid #ddd;vertical-align:top">${escapeHtml(label)}</th><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('')}</table>
      <h2 style="font-size:19px">Selected Jewellery</h2><ul>${products.map(product => `<li><strong>${escapeHtml(product)}</strong></li>`).join('')}</ul>
      ${manageHtml}<p>Warm regards,<br><strong>Team Sunny Diamonds</strong><br><em>Crafted to celebrate your moments</em></p>
    </td></tr></table>
  </td></tr></table>
</body></html>`),
  };
}

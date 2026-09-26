export interface TryAtHomeConfirmedData {
  appointmentId: string;
  customerName?: string | null;
  appointmentDate: string;
  appointmentTime: string;
  deliveryAddress: string;
  productName: string;
  manageUrl?: string | null;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

export function tryAtHomeConfirmedTemplate(data: TryAtHomeConfirmedData) {
  const name = data.customerName?.trim() || 'there';
  const details = [
    ['Appointment ID', data.appointmentId], ['Date', formatEmailDate(data.appointmentDate)], ['Time', data.appointmentTime],
    ['Delivery Address', data.deliveryAddress],
  ];
  const manageText = data.manageUrl
    ? ['', `Manage Appointment: ${data.manageUrl}`, 'If you need to reschedule or cancel your appointment, you can do so using the link above.'] : [];
  const manageHtml = data.manageUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(data.manageUrl)}" style="display:inline-block;background:#222;color:#fff;padding:12px 20px;text-decoration:none">Manage Appointment</a></p>
      <p>If you need to reschedule or cancel your appointment, you can do so using the link above.</p>` : '';
  return {
    subject: 'Your Sunny Diamonds Try at Home Appointment Is Confirmed',
    attachments: sunnyEmailLogoAttachments(),
    text: [
      `Dear ${name},`, '', 'Thank you for choosing Sunny Diamonds.',
      'Your Try at Home appointment has been successfully booked. We look forward to bringing your selected jewellery to you, so you can explore it from the comfort of your home.', '',
      'Appointment Details', '', ...details.map(([label, value]) => `${label}: ${value}`), '',
      'Selected Jewellery', '', data.productName, '',
      'Our team will arrive at the scheduled time with your selected pieces. Please ensure that someone is available at the provided address to receive and try the jewellery.',
      ...manageText, '', 'We look forward to creating a personalised jewellery experience for you.', '',
      'Warm regards,', 'Team Sunny Diamonds', 'Crafted to celebrate your moments',
    ].join('\n'),
    html: restyleSunnyEmail(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Try at Home appointment confirmed</title></head>
<body style="margin:0;background:#f5f5f5;color:#222;font-family:Arial,sans-serif;line-height:1.6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:32px">
      <p style="margin-top:0;font-size:20px;font-weight:bold">Sunny Diamonds</p>
      <h1 style="font-size:24px">Your Try at Home appointment is confirmed</h1>
      <p>Dear ${escapeHtml(name)},</p>
      <p>Thank you for choosing <strong>Sunny Diamonds</strong>.</p>
      <p>Your <strong>Try at Home</strong> appointment has been successfully booked. We look forward to bringing your selected jewellery to you, so you can explore it from the comfort of your home.</p>
      <h2 style="font-size:19px">Appointment Details</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        ${details.map(([label, value]) => `<tr><th scope="row" align="left" style="padding:10px;border-bottom:1px solid #ddd;vertical-align:top">${escapeHtml(label)}</th><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('\n')}
      </table>
      <h2 style="font-size:19px">Selected Jewellery</h2>
      <p><strong>${escapeHtml(data.productName)}</strong></p>
      <p>Our team will arrive at the scheduled time with your selected pieces. Please ensure that someone is available at the provided address to receive and try the jewellery.</p>
      ${manageHtml}
      <p>We look forward to creating a personalised jewellery experience for you.</p>
      <p>Warm regards,<br><strong>Team Sunny Diamonds</strong><br><em>Crafted to celebrate your moments</em></p>
    </td></tr></table>
  </td></tr></table>
</body></html>`),
  };
}
import { formatEmailDate, restyleSunnyEmail, sunnyEmailLogoAttachments } from './sunny-email-layout';

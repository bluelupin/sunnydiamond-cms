export interface AppointmentRescheduledData {
  documentId: string;
  customerName?: string | null;
  previousDate?: string | null;
  previousTimeSlot?: string | null;
  requestedDate: string;
  selectedTimeSlot: string;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

/** Edit the email copy and layout here; delivery and triggers live separately. */
export function appointmentRescheduledTemplate(data: AppointmentRescheduledData) {
  const name = data.customerName?.trim() || 'there';
  const details = [
    ['Appointment reference', data.documentId],
    ['Previous date', formatEmailDate(data.previousDate)],
    ['Previous time', data.previousTimeSlot || 'Not specified'],
    ['New date', formatEmailDate(data.requestedDate)],
    ['New time', data.selectedTimeSlot],
  ];
  return {
    subject: 'Your Sunny Diamonds appointment has been rescheduled',
    attachments: sunnyEmailLogoAttachments(),
    text: [
      `Hi ${name},`, '', 'Your Sunny Diamonds appointment has been rescheduled.', '',
      ...details.map(([label, value]) => `${label}: ${value}`),
      '', 'Appointment times are in India Standard Time (IST).',
      'If you need help, please reply to this email.', '', 'Thank you,', 'Sunny Diamonds',
    ].join('\n'),
    html: restyleSunnyEmail(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Appointment rescheduled</title></head>
<body style="margin:0;background:#f5f5f5;color:#222;font-family:Arial,sans-serif;line-height:1.6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:32px">
      <p style="margin-top:0;font-size:20px;font-weight:bold">Sunny Diamonds</p>
      <h1 style="font-size:24px">Your appointment has been rescheduled</h1>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Please find your updated appointment details below.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        ${details.map(([label, value]) => `<tr><th scope="row" align="left" style="padding:10px;border-bottom:1px solid #ddd;vertical-align:top">${escapeHtml(label)}</th><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('\n')}
      </table>
      <p style="font-size:13px;color:#555">Appointment times are in India Standard Time (IST).</p>
      <p>If you need help, please reply to this email.</p>
      <p>Thank you,<br>Sunny Diamonds</p>
    </td></tr></table>
  </td></tr></table>
</body></html>`),
  };
}
import { formatEmailDate, restyleSunnyEmail, sunnyEmailLogoAttachments } from './sunny-email-layout';

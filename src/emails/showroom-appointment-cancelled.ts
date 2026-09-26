export interface ShowroomAppointmentCancelledData {
  appointmentId: string;
  customerName?: string | null;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
  showroomName?: string | null;
  showroomAddress?: string | null;
  bookAppointmentUrl?: string | null;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

/** Customer notification for a cancelled product-store-visit appointment. */
export function showroomAppointmentCancelledTemplate(data: ShowroomAppointmentCancelledData) {
  const name = data.customerName?.trim() || 'there';
  const details = [
    ['Appointment ID', data.appointmentId],
    ['Date', formatEmailDate(data.appointmentDate)],
    ['Time', data.appointmentTime || 'Not specified'],
    ['Showroom', data.showroomName || 'Sunny Diamonds showroom'],
    ['Location', data.showroomAddress || 'Not specified'],
  ];
  const bookText = data.bookAppointmentUrl ? ['', `Book a New Appointment: ${data.bookAppointmentUrl}`] : [];
  const bookHtml = data.bookAppointmentUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(data.bookAppointmentUrl)}" style="display:inline-block;background:#222;color:#fff;padding:12px 20px;text-decoration:none">Book a New Appointment</a></p>`
    : '';

  return {
    subject: 'Your Sunny Diamonds Showroom Appointment Has Been Cancelled',
    attachments: sunnyEmailLogoAttachments(),
    text: [
      `Dear ${name},`, '',
      'This is to confirm that your Sunny Diamonds showroom appointment has been successfully cancelled.', '',
      'Appointment Details', '', ...details.map(([label, value]) => `${label}: ${value}`), '',
      'If you cancelled the appointment by mistake or would like to visit us at another time, we’d be delighted to arrange a new appointment for you.',
      ...bookText, '',
      'If you have any questions or need assistance, our customer care team will be happy to help.', '',
      'We look forward to welcoming you to Sunny Diamonds soon.', '',
      'Warm regards,', 'Team Sunny Diamonds', 'Crafted to celebrate your moments',
    ].join('\n'),
    html: restyleSunnyEmail(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Appointment cancelled</title></head>
<body style="margin:0;background:#f5f5f5;color:#222;font-family:Arial,sans-serif;line-height:1.6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:32px">
      <p style="margin-top:0;font-size:20px;font-weight:bold">Sunny Diamonds</p>
      <h1 style="font-size:24px">Your showroom appointment has been cancelled</h1>
      <p>Dear ${escapeHtml(name)},</p>
      <p>This is to confirm that your <strong>Sunny Diamonds showroom appointment</strong> has been successfully cancelled.</p>
      <h2 style="font-size:19px">Appointment Details</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        ${details.map(([label, value]) => `<tr><th scope="row" align="left" style="padding:10px;border-bottom:1px solid #ddd;vertical-align:top">${escapeHtml(label)}</th><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('\n')}
      </table>
      <p>If you cancelled the appointment by mistake or would like to visit us at another time, we’d be delighted to arrange a new appointment for you.</p>
      ${bookHtml}
      <p>If you have any questions or need assistance, our customer care team will be happy to help.</p>
      <p>We look forward to welcoming you to <strong>Sunny Diamonds</strong> soon.</p>
      <p>Warm regards,<br><strong>Team Sunny Diamonds</strong><br><em>Crafted to celebrate your moments</em></p>
    </td></tr></table>
  </td></tr></table>
</body></html>`),
  };
}
import { formatEmailDate, restyleSunnyEmail, sunnyEmailLogoAttachments } from './sunny-email-layout';

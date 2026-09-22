export interface AppointmentConfirmedData {
  documentId: string;
  customerName?: string | null;
  requestedDate: string;
  selectedTimeSlot: string;
  location: string;
  manageUrl?: string | null;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

/** Copy and layout for the product-store-visit submission confirmation. */
export function appointmentConfirmedTemplate(data: AppointmentConfirmedData) {
  const name = data.customerName?.trim() || 'there';
  const details = [
    ['Appointment Type', 'Showroom Visit'],
    ['Date', data.requestedDate],
    ['Time', data.selectedTimeSlot],
    ['Showroom', data.location],
  ];
  const manageText = data.manageUrl
    ? ['', `Manage Appointment: ${data.manageUrl}`, 'If you need to reschedule or cancel your appointment, you can do so using the link above.']
    : [];
  const manageHtml = data.manageUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(data.manageUrl)}" style="display:inline-block;background:#222;color:#fff;padding:12px 20px;text-decoration:none">Manage Appointment</a></p>
      <p>If you need to reschedule or cancel your appointment, you can do so using the link above.</p>`
    : '';

  return {
    subject: `Your Sunny Diamonds Appointment Is Confirmed – ${data.requestedDate}`,
    text: [
      `Dear ${name},`, '', 'Thank you for choosing to connect with Sunny Diamonds. Your Showroom Visit appointment has been successfully booked.', '',
      'Appointment Details', '', ...details.map(([label, value]) => `${label}: ${value}`), '',
      'We look forward to helping you explore our jewellery collection and finding something perfect for your occasion.',
      ...manageText, '', 'Warm regards,', 'Team Sunny Diamonds', 'Crafted to celebrate your moments',
    ].join('\n'),
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Appointment confirmed</title></head>
<body style="margin:0;background:#f5f5f5;color:#222;font-family:Arial,sans-serif;line-height:1.6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:32px">
      <p style="margin-top:0;font-size:20px;font-weight:bold">Sunny Diamonds</p>
      <h1 style="font-size:24px">Your appointment is confirmed</h1>
      <p>Dear ${escapeHtml(name)},</p>
      <p>Thank you for choosing to connect with <strong>Sunny Diamonds</strong>. Your Showroom Visit appointment has been successfully booked.</p>
      <h2 style="font-size:19px">Appointment Details</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        ${details.map(([label, value]) => `<tr><th scope="row" align="left" style="padding:10px;border-bottom:1px solid #ddd;vertical-align:top">${escapeHtml(label)}</th><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('\n')}
      </table>
      <p>We look forward to helping you explore our jewellery collection and finding something perfect for your occasion.</p>
      ${manageHtml}
      <p>Warm regards,<br><strong>Team Sunny Diamonds</strong><br><em>Crafted to celebrate your moments</em></p>
    </td></tr></table>
  </td></tr></table>
</body></html>`,
  };
}

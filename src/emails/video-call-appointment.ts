import { formatEmailDate, restyleSunnyEmail, sunnyEmailLogoAttachments } from './sunny-email-layout';

export interface VideoCallAppointmentData {
  appointmentId: string;
  customerName?: string | null;
  appointmentDate: string;
  appointmentTime: string;
  productName?: string | null;
  manageUrl?: string | null;
  bookAppointmentUrl?: string | null;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

const details = (data: VideoCallAppointmentData, dateLabel = 'Date', timeLabel = 'Time') => [
  ['Appointment ID', data.appointmentId], ['Appointment Type', 'Video Call'],
  [dateLabel, formatEmailDate(data.appointmentDate)], [timeLabel, data.appointmentTime],
  ['Jewellery', data.productName || 'Selected jewellery'],
];

const action = (url: string | null | undefined, label: string, help: string) => ({
  text: url ? ['', `${label}: ${url}`, help] : [],
  html: url ? `<p style="margin:28px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#222;color:#fff;padding:12px 20px;text-decoration:none">${label}</a></p><p>${help}</p>` : '',
});

const message = (data: VideoCallAppointmentData, options: {
  subject: string; heading: string; intro: string; dateLabel?: string; timeLabel?: string;
  closing: string; actionUrl?: string | null; actionLabel?: string; actionHelp?: string;
}) => {
  const name = data.customerName?.trim() || 'there';
  const rows = details(data, options.dateLabel, options.timeLabel);
  const cta = action(options.actionUrl, options.actionLabel || 'Manage Appointment', options.actionHelp || 'Use the link above to manage your appointment.');
  return {
    subject: options.subject,
    attachments: sunnyEmailLogoAttachments(),
    text: [`Dear ${name},`, '', options.intro, '', 'Appointment Details', '',
      ...rows.map(([label, value]) => `${label}: ${value}`), '', options.closing,
      ...cta.text, '', 'Warm regards,', 'Team Sunny Diamonds', 'Crafted to celebrate your moments'].join('\n'),
    html: restyleSunnyEmail(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(options.heading)}</title></head>
<body style="margin:0;background:#f5f5f5;color:#222;font-family:Arial,sans-serif;line-height:1.6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:32px">
<h1 style="font-size:24px">${escapeHtml(options.heading)}</h1><p>Dear ${escapeHtml(name)},</p><p>${options.intro}</p><h2 style="font-size:19px">Appointment Details</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${rows.map(([label, value]) => `<tr><th scope="row" align="left" style="padding:10px;border-bottom:1px solid #ddd;vertical-align:top">${escapeHtml(label)}</th><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('')}</table>
<p>${options.closing}</p>${cta.html}<p>Warm regards,<br><strong>Team Sunny Diamonds</strong><br><em>Crafted to celebrate your moments</em></p>
</td></tr></table></td></tr></table></body></html>`),
  };
};

export const videoCallConfirmedTemplate = (data: VideoCallAppointmentData) => message(data, {
  subject: 'Your Sunny Diamonds Video Call Appointment Is Confirmed', heading: 'Your video call appointment is confirmed',
  intro: 'Thank you for choosing to connect with Sunny Diamonds. Your video call appointment has been successfully booked.',
  closing: 'Our jewellery expert looks forward to helping you explore the perfect piece for your special moment.',
  actionUrl: data.manageUrl, actionHelp: 'If you need to reschedule or cancel your appointment, please use the link above.',
});

export const videoCallReminderTemplate = (data: VideoCallAppointmentData) => message(data, {
  subject: 'Reminder: Your Sunny Diamonds Video Call Appointment Is Tomorrow', heading: 'Your video call appointment is tomorrow',
  intro: 'Just a gentle reminder that your Sunny Diamonds video call appointment is scheduled for tomorrow.',
  closing: 'Please keep your phone or computer ready. Our jewellery expert looks forward to speaking with you.',
  actionUrl: data.manageUrl, actionHelp: 'If you need to make any changes to your appointment, please use the link above.',
});

export const videoCallRescheduledTemplate = (data: VideoCallAppointmentData) => message(data, {
  subject: 'Your Sunny Diamonds Video Call Appointment Has Been Rescheduled', heading: 'Your video call appointment has been rescheduled',
  intro: 'Your Sunny Diamonds video call appointment has been successfully rescheduled as requested.',
  dateLabel: 'New Date', timeLabel: 'New Time',
  closing: 'Our jewellery expert looks forward to speaking with you at the updated time.',
  actionUrl: data.manageUrl, actionHelp: 'If you need to make any further changes, please use the link above.',
});

export const videoCallCancelledTemplate = (data: VideoCallAppointmentData) => message(data, {
  subject: 'Your Sunny Diamonds Video Call Appointment Has Been Cancelled', heading: 'Your video call appointment has been cancelled',
  intro: 'This is to confirm that your Sunny Diamonds video call appointment has been successfully cancelled.',
  closing: 'If you cancelled by mistake or would like to speak with us at another time, we would be delighted to arrange a new appointment.',
  actionUrl: data.bookAppointmentUrl, actionLabel: 'Book a New Appointment', actionHelp: 'Use the link above to book another video call appointment.',
});

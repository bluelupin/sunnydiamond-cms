export interface ReachOutConfirmationData {
  customerName?: string | null;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

/** Customer acknowledgement for reach-out-to-us submissions. */
export function reachOutConfirmationTemplate(data: ReachOutConfirmationData) {
  const name = data.customerName?.trim() || 'there';
  return {
    subject: 'We’ve Received Your Message – Sunny Diamonds',
    attachments: sunnyEmailLogoAttachments(),
    text: [
      `Dear ${name},`, '',
      'Thank you for reaching out to Sunny Diamonds.', '',
      'We’ve received your message and our team will review your enquiry and get back to you shortly.', '',
      'We appreciate your interest in Sunny Diamonds and look forward to assisting you.', '',
      'Warm regards,', 'Team Sunny Diamonds', 'Crafted to celebrate your moments',
    ].join('\n'),
    html: restyleSunnyEmail(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Message received</title></head>
<body style="margin:0;background:#f5f5f5;color:#222;font-family:Arial,sans-serif;line-height:1.6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:32px">
      <p style="margin-top:0;font-size:20px;font-weight:bold">Sunny Diamonds</p>
      <p>Dear ${escapeHtml(name)},</p>
      <p>Thank you for reaching out to <strong>Sunny Diamonds</strong>.</p>
      <p>We’ve received your message and our team will review your enquiry and get back to you shortly.</p>
      <p>We appreciate your interest in <strong>Sunny Diamonds</strong> and look forward to assisting you.</p>
      <p>Warm regards,<br><strong>Team Sunny Diamonds</strong><br><em>Crafted to celebrate your moments</em></p>
    </td></tr></table>
  </td></tr></table>
</body></html>`),
  };
}
import { restyleSunnyEmail, sunnyEmailLogoAttachments } from './sunny-email-layout';

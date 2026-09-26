import { restyleSunnyEmail, sunnyEmailLogoAttachments } from './sunny-email-layout';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

export function customCreationReceivedTemplate(data: { customerName?: string | null }) {
  const name = data.customerName?.trim() || 'Customer';
  const paragraphs = [
    'Thank you for sharing your custom creation idea with Sunny Diamonds.',
    'We have received your request. Our team will review your design vision and get in touch to discuss the details and next steps.',
    'We look forward to helping you create a piece that is uniquely yours.',
  ];
  return {
    subject: 'Your Custom Creation Request Has Been Received | Sunny Diamonds',
    attachments: sunnyEmailLogoAttachments(),
    text: [`Dear ${name},`, '', ...paragraphs.flatMap(paragraph => [paragraph, '']),
      'Warm regards,', 'Team Sunny Diamonds', 'Crafted to celebrate your moments'].join('\n'),
    html: restyleSunnyEmail(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Custom creation request received</title></head>
<body style="margin:0;background:#f5f5f5;color:#222;font-family:Arial,sans-serif;line-height:1.6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:32px">
      <p>Dear ${escapeHtml(name)},</p>
      ${paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('\n      ')}
      <p>Warm regards,<br><strong>Team Sunny Diamonds</strong><br><em>Crafted to celebrate your moments</em></p>
    </td></tr></table>
  </td></tr></table>
</body></html>`),
  };
}

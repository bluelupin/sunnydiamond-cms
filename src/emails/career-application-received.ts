export interface CareerApplicationReceivedData {
  candidateName?: string | null;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

export function careerApplicationReceivedTemplate(data: CareerApplicationReceivedData) {
  const name = data.candidateName?.trim() || 'Candidate';
  return {
    subject: 'Thank You for Your Interest in Sunny Diamonds',
    text: [
      `Dear ${name},`, '',
      'Thank you for your interest in Sunny Diamonds and for taking the time to apply for a career opportunity with us.', '',
      'We’ve successfully received your application and resume. Our team will review your profile and, if your experience and qualifications align with a suitable opportunity, we’ll be in touch with you regarding the next steps.', '',
      'We appreciate your interest in being part of the Sunny Diamonds team and wish you the very best.', '',
      'Warm regards,', 'Team Sunny Diamonds', 'Crafted to celebrate your moments',
    ].join('\n'),
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Application received</title></head>
<body style="margin:0;background:#f5f5f5;color:#222;font-family:Arial,sans-serif;line-height:1.6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:32px">
      <p style="margin-top:0;font-size:20px;font-weight:bold">Sunny Diamonds</p>
      <p>Dear ${escapeHtml(name)},</p>
      <p>Thank you for your interest in <strong>Sunny Diamonds</strong> and for taking the time to apply for a career opportunity with us.</p>
      <p>We’ve successfully received your application and resume. Our team will review your profile and, if your experience and qualifications align with a suitable opportunity, we’ll be in touch with you regarding the next steps.</p>
      <p>We appreciate your interest in being part of the <strong>Sunny Diamonds</strong> team and wish you the very best.</p>
      <p>Warm regards,<br><strong>Team Sunny Diamonds</strong><br><em>Crafted to celebrate your moments</em></p>
    </td></tr></table>
  </td></tr></table>
</body></html>`,
  };
}

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const sunnyEmailLogoAttachments = () => [{
  filename: 'sunny-diamonds-logo.png',
  content: readFileSync(resolve(process.cwd(), 'public/email-assets/sunny-diamonds-logo.png')),
  contentType: 'image/png',
  cid: 'sunny-diamonds-logo',
}];

export const formatEmailDate = (value?: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || 'Not specified';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(date);
};

/** Applies the shared, email-client-safe Sunny Diamonds card design. */
export function restyleSunnyEmail(html: string) {
  const responsiveStyles = `<style type="text/css">
    @media only screen and (max-width:480px) {
      .sunny-email-content { padding:24px 16px !important; }
      .sunny-email-details, .sunny-email-details tbody, .sunny-email-details tr,
      .sunny-email-label, .sunny-email-value { display:block !important; width:100% !important; box-sizing:border-box; }
      .sunny-email-label { padding:12px 0 4px !important; border-bottom:0 !important; }
      .sunny-email-value { padding:0 0 12px !important; }
    }
  </style>`;
  const header = `<tr><td align="center" style="background:#f3f3f3;padding:24px">
      <img src="cid:sunny-diamonds-logo" width="190" alt="Sunny Diamonds" style="display:block;width:190px;max-width:70%;height:auto;border:0">
    </td></tr>`;
  const footer = `<tr><td align="center" style="background:#f3f3f3;padding:22px 24px;color:#666;font-size:12px;line-height:1.7">
      <p style="margin:0 0 4px">Thank you, Sunny Diamonds!</p>
      <p style="margin:0 0 4px">Questions? Just reply to this email.</p>
      <p style="margin:0"><a href="https://www.sunnydiamonds.com" style="color:#b48618;text-decoration:none">sunnydiamonds.com</a></p>
    </td></tr>`;

  return html
    .replace('</head>', `${responsiveStyles}</head>`)
    .replace(
      /<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">/g,
      '<table class="sunny-email-details" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;border-collapse:collapse;text-align:left">',
    )
    .replace(
      /<th scope="row" align="left" style="padding:10px;border-bottom:1px solid #ddd;vertical-align:top">/g,
      '<th class="sunny-email-label" scope="row" align="left" valign="top" width="160" style="width:160px;padding:12px 16px 12px 0;border-bottom:1px solid #ddd;vertical-align:top;text-align:left;font-size:14px;line-height:1.5;font-weight:bold">',
    )
    .replace(
      /<td style="padding:10px;border-bottom:1px solid #ddd">/g,
      '<td class="sunny-email-value" align="left" valign="top" style="padding:12px 0;border-bottom:1px solid #ddd;vertical-align:top;text-align:left;font-size:14px;line-height:1.5;overflow-wrap:anywhere;word-wrap:break-word">',
    )
    .replace(
      '<body style="margin:0;background:#f5f5f5;color:#222;font-family:Arial,sans-serif;line-height:1.6">',
      '<body style="margin:0;background:#faf9f7;color:#222;font-family:Arial,Helvetica,sans-serif;line-height:1.55">',
    )
    .replace(
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:24px 12px">',
    )
    .replace(
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:32px">',
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-collapse:collapse">${header}<tr><td class="sunny-email-content" align="left" style="padding:30px 28px;font-size:14px;text-align:left">`,
    )
    .replace('<p style="margin-top:0;font-size:20px;font-weight:bold">Sunny Diamonds</p>', '')
    .replace(/font-size:24px/g, 'font-size:22px')
    .replace(/font-size:19px/g, 'font-size:17px')
    .replace(/background:#222;color:#fff/g, 'background:#0A0A0A;color:#FFFFFF')
    .replace(/border-bottom:1px solid #ddd/g, 'border-bottom:1px solid #ececec')
    .replace(
      '    </td></tr></table>\n  </td></tr></table>\n</body></html>',
      `    </td></tr>${footer}</table>\n  </td></tr></table>\n</body></html>`,
    );
}

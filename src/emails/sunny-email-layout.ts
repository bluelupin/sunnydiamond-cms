/** Applies the shared, email-client-safe Sunny Diamonds card design. */
export function restyleSunnyEmail(html: string) {
  const header = `<tr><td align="center" style="background:#f3f3f3;padding:28px 24px 24px">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:31px;font-style:italic;line-height:1;color:#a13b69">S</div>
      <div style="margin-top:7px;font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:1.8px;color:#a13b69">SUNNY DIAMONDS</div>
    </td></tr>`;
  const footer = `<tr><td align="center" style="background:#f3f3f3;padding:22px 24px;color:#666;font-size:12px;line-height:1.7">
      <p style="margin:0 0 4px">Thank you, Sunny Diamonds!</p>
      <p style="margin:0 0 4px">Questions? Just reply to this email.</p>
      <p style="margin:0"><a href="https://www.sunnydiamonds.com" style="color:#b48618;text-decoration:none">sunnydiamonds.com</a></p>
    </td></tr>`;

  return html
    .replace(
      '<body style="margin:0;background:#f5f5f5;color:#222;font-family:Arial,sans-serif;line-height:1.6">',
      '<body style="margin:0;background:#faf9f7;color:#222;font-family:Arial,Helvetica,sans-serif;line-height:1.55">',
    )
    .replace(
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:28px 12px">',
    )
    .replace(
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:32px">',
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-collapse:collapse">${header}<tr><td style="padding:30px 26px;font-size:14px">`,
    )
    .replace('<p style="margin-top:0;font-size:20px;font-weight:bold">Sunny Diamonds</p>', '')
    .replace(/background:#222;color:#fff/g, 'background:#a13b69;color:#fff')
    .replace(/border-bottom:1px solid #ddd/g, 'border-bottom:1px solid #ececec')
    .replace(
      '    </td></tr></table>\n  </td></tr></table>\n</body></html>',
      `    </td></tr>${footer}</table>\n  </td></tr></table>\n</body></html>`,
    );
}

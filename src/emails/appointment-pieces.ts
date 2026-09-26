import { formatEmailDate, restyleSunnyEmail, sunnyEmailLogoAttachments } from './sunny-email-layout';

export interface AppointmentPiece { productId: string; productName?: string | null; url?: string | null }

export interface AppointmentPiecesData {
  appointmentId: string;
  appointmentType: 'Showroom Visit' | 'Video Call';
  customerName?: string | null;
  requestedDate: string;
  selectedTimeSlot: string;
  showroom?: string | null;
  pieces: AppointmentPiece[];
  manageUrl?: string | null;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

const pieceLabel = (piece: AppointmentPiece) => `${piece.productName || 'Selected jewellery'} (${piece.productId})`;

const details = (data: AppointmentPiecesData, extra: string[][] = []) => [
  ['Appointment ID', data.appointmentId], ['Appointment Type', data.appointmentType],
  ['Date', formatEmailDate(data.requestedDate)], ['Time', data.selectedTimeSlot],
  ...(data.showroom ? [['Showroom', data.showroom]] : []), ...extra,
];

const layout = (title: string, body: string) => restyleSunnyEmail(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f5f5f5;color:#222;font-family:Arial,sans-serif;line-height:1.6">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff"><tr><td style="padding:32px">
      <p style="margin-top:0;font-size:20px;font-weight:bold">Sunny Diamonds</p>
      ${body}
    </td></tr></table>
  </td></tr></table>
</body></html>`);

const detailsHtml = (rows: string[][]) => `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        ${rows.map(([label, value]) => `<tr><th scope="row" align="left" style="padding:10px;border-bottom:1px solid #ddd;vertical-align:top">${escapeHtml(label)}</th><td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('\n')}
      </table>`;

const piecesHtml = (pieces: AppointmentPiece[]) => `<ul>${pieces.map(piece => piece.url
  ? `<li><a href="${escapeHtml(piece.url)}">${escapeHtml(pieceLabel(piece))}</a></li>`
  : `<li>${escapeHtml(pieceLabel(piece))}</li>`).join('')}</ul>`;

/** Customer copy: the full, updated list of pieces for the appointment. */
export function appointmentPiecesUpdatedTemplate(data: AppointmentPiecesData) {
  const name = data.customerName?.trim() || 'there';
  const rows = details(data);
  const manageHtml = data.manageUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(data.manageUrl)}" style="display:inline-block;background:#222;color:#fff;padding:12px 20px;text-decoration:none">Manage Appointment</a></p>`
    : '';
  return {
    subject: `Your Sunny Diamonds appointment now has ${data.pieces.length} pieces – ${formatEmailDate(data.requestedDate)}`,
    attachments: sunnyEmailLogoAttachments(),
    text: [
      `Dear ${name},`, '', `We have added the piece you chose to your ${data.appointmentType} appointment. Your date and time are unchanged.`, '',
      'Appointment Details', '', ...rows.map(([label, value]) => `${label}: ${value}`), '',
      'Pieces we will have ready for you', '', ...data.pieces.map(piece => `- ${pieceLabel(piece)}${piece.url ? `: ${piece.url}` : ''}`),
      ...(data.manageUrl ? ['', `Manage Appointment: ${data.manageUrl}`] : []),
      '', 'Warm regards,', 'Team Sunny Diamonds', 'Crafted to celebrate your moments',
    ].join('\n'),
    html: layout('Appointment updated', `<h1 style="font-size:24px">Your appointment has been updated</h1>
      <p>Dear ${escapeHtml(name)},</p>
      <p>We have added the piece you chose to your ${escapeHtml(data.appointmentType)} appointment. Your date and time are unchanged.</p>
      <h2 style="font-size:19px">Appointment Details</h2>
      ${detailsHtml(rows)}
      <h2 style="font-size:19px">Pieces we will have ready for you</h2>
      ${piecesHtml(data.pieces)}
      ${manageHtml}
      <p>Warm regards,<br><strong>Team Sunny Diamonds</strong><br><em>Crafted to celebrate your moments</em></p>`),
  };
}

/** Staff copy: which piece was added, so it can be ready for the meeting. */
export function appointmentPieceAddedStaffTemplate(data: AppointmentPiecesData, added: AppointmentPiece) {
  const rows = details(data, [['Customer', data.customerName?.trim() || 'Not specified']]);
  return {
    subject: `Piece added: ${added.productName || added.productId} – ${data.appointmentId}, ${formatEmailDate(data.requestedDate)} ${data.selectedTimeSlot}`,
    attachments: sunnyEmailLogoAttachments(),
    text: [
      `Piece added: ${pieceLabel(added)}${added.url ? ` ${added.url}` : ''}`, '',
      ...rows.map(([label, value]) => `${label}: ${value}`), '',
      'All pieces for this appointment', '', ...data.pieces.map(piece => `- ${pieceLabel(piece)}${piece.url ? `: ${piece.url}` : ''}`),
    ].join('\n'),
    html: layout('Piece added', `<h1 style="font-size:24px">Piece added to an appointment</h1>
      <p><strong>Piece added:</strong> ${piecesHtml([added]).replace(/^<ul><li>|<\/li><\/ul>$/g, '')}</p>
      ${detailsHtml(rows)}
      <h2 style="font-size:19px">All pieces for this appointment</h2>
      ${piecesHtml(data.pieces)}`),
  };
}

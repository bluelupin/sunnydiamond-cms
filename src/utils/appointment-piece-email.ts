import type { Core } from '@strapi/strapi';
import { appointmentPieceAddedStaffTemplate, appointmentPiecesUpdatedTemplate, type AppointmentPiece } from '../emails/appointment-pieces';
import { appointmentManageUrl } from './video-call-appointment-email';
import { appointmentSourceUrl } from './appointment-source-url';

const recipient = (value?: string | null) => {
  const to = value?.trim(); return to && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(to) ? to : undefined;
};

/** Store visits notify the showroom's own inbox; video calls have no showroom, so one configured inbox. */
const staffRecipient = (appointment: any) => appointment.formTag === 'product-store-visit'
  ? recipient(appointment.preferredShowroom?.email)
  : recipient(process.env.APPOINTMENT_STAFF_EMAIL);

export async function sendPieceAddedEmails(strapi: Core.Strapi, appointment: any, added: any) {
  const piece = (value: any): AppointmentPiece => ({
    productId: value.productId, productName: value.productName, url: appointmentSourceUrl(value.productPath),
  });
  const showroom = appointment.preferredShowroom;
  const data = {
    appointmentId: appointment.appointmentReference || appointment.documentId,
    appointmentType: appointment.formTag === 'product-store-visit' ? 'Showroom Visit' as const : 'Video Call' as const,
    customerName: appointment.customerName, requestedDate: appointment.requestedDate,
    selectedTimeSlot: appointment.selectedTimeSlot,
    showroom: [showroom?.address, showroom?.city].filter(Boolean).join(', ') || null,
    pieces: [
      ...(appointment.productId ? [{ productId: appointment.productId, productName: appointment.productName,
        url: appointmentSourceUrl(appointment.sourcePage) }] : []),
      ...appointment.addedPieces.map(piece),
    ],
    manageUrl: appointmentManageUrl(appointment.documentId),
  };
  const sends: [string | undefined, any, string][] = [
    [recipient(appointment.customerEmail), appointmentPiecesUpdatedTemplate(data), 'customer'],
    [staffRecipient(appointment), appointmentPieceAddedStaffTemplate(data, piece(added)), 'staff'],
  ];
  for (const [to, template, audience] of sends) {
    if (!to) { if (audience === 'staff') strapi.log.warn(`No staff inbox for appointment ${appointment.documentId}; piece-added email not sent.`); continue; }
    try {
      await strapi.plugin('email').service('email').send({ to, ...template });
      strapi.log.info(`Piece-added ${audience} email accepted for appointment ${appointment.documentId}.`);
    } catch {
      strapi.log.error(`Piece-added ${audience} email failed for appointment ${appointment.documentId}; the piece remains saved.`);
    }
  }
}

export function notifyPieceAddedAfterCommit(strapi: Core.Strapi, onCommit: (callback: () => void) => void, appointment: any, added: any) {
  onCommit(() => { void sendPieceAddedEmails(strapi, appointment, added); });
}

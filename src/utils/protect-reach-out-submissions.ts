import { errors } from '@strapi/utils';
import { isDeepStrictEqual } from 'node:util';

const UID = 'api::generic-submission.generic-submission';
const hasOwn = (value: any, name: string) => Object.prototype.hasOwnProperty.call(value, name);
const fields = ['formTag', 'fullName', 'email', 'phone', 'preferredDate', 'selectedTimeSlot',
  'notes', 'reasonForContact', 'sourcePage', 'consentAccepted'];

export function registerReachOutSubmissionProtection(strapi: any) {
  strapi.documents.use(async (context: any, next: any) => {
    if (context.uid !== UID || context.action !== 'update') return next();
    const row = await strapi.db.query(UID).findOne({
      where: { documentId: context.params.documentId }, populate: { preferredShowroom: true },
    });
    if (row?.formTag !== 'reach-out-to-us') return next();
    const data = context.params.data ?? {};
    const changed = fields.some(name => hasOwn(data, name) &&
      !isDeepStrictEqual(data[name] === '' ? null : data[name], row[name] ?? null));
    const relation = data.preferredShowroom;
    const unchangedRelation = relation === undefined ||
      (relation == null && !row.preferredShowroom) ||
      (typeof relation === 'string' && relation === row.preferredShowroom?.documentId) ||
      (typeof relation === 'number' && relation === row.preferredShowroom?.id) ||
      (relation && typeof relation === 'object' && !Array.isArray(relation) &&
        Object.keys(relation).every(key => ['connect', 'disconnect'].includes(key)) &&
        (!hasOwn(relation, 'connect') || Array.isArray(relation.connect) && relation.connect.length === 0) &&
        (!hasOwn(relation, 'disconnect') || Array.isArray(relation.disconnect) && relation.disconnect.length === 0));
    if (changed || !unchangedRelation) {
      throw new errors.ValidationError('Customer details in reach-out-to-us submissions are read-only. Only admin notes and status can be edited.');
    }
    return next();
  });
}

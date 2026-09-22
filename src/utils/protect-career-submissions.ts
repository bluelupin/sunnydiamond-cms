import { errors } from '@strapi/utils';
import { isDeepStrictEqual } from 'node:util';

const UID = 'api::submissions-job-opening.submissions-job-opening';
const EDITABLE_FIELDS = new Set(['workflowStatus', 'internalNotes']);
const SYSTEM_FIELDS = new Set(['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt', 'createdBy', 'updatedBy']);

const normalize = (value: any): any => {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value === '' ? null : value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !SYSTEM_FIELDS.has(key))
    .map(([key, item]) => [key, normalize(item)]));
};

const unchangedMedia = (value: any, current: any) => value === undefined ||
  (value == null && !current) ||
  (typeof value === 'number' && value === current?.id) ||
  (typeof value === 'string' && value === current?.documentId) ||
  (value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every(key => ['connect', 'disconnect'].includes(key)) &&
    (!value.connect || Array.isArray(value.connect) && value.connect.length === 0) &&
    (!value.disconnect || Array.isArray(value.disconnect) && value.disconnect.length === 0));

/** Server-side enforcement complements disabled fields in Content Manager. */
export function registerCareerSubmissionProtection(strapi: any) {
  strapi.documents.use(async (context: any, next: any) => {
    if (context.uid !== UID || context.action !== 'update') return next();
    const data = context.params.data ?? {};
    const protectedNames = Object.keys(data).filter(name => !EDITABLE_FIELDS.has(name) && !SYSTEM_FIELDS.has(name));
    if (!protectedNames.length) return next();
    const row = await strapi.db.query(UID).findOne({
      where: { documentId: context.params.documentId },
      populate: { personalDetails: true, educationDetails: true, workExperience: true,
        skillsAndLanguages: { populate: '*' }, addInfo: true, resume: true },
    });
    if (!row) return next();
    const changed = protectedNames.some(name => name === 'resume'
      ? !unchangedMedia(data[name], row[name])
      : !isDeepStrictEqual(normalize(data[name]), normalize(row[name])));
    if (changed) {
      throw new errors.ValidationError(
        'Submitted career application details are read-only. Only workflow status and internal notes can be edited.'
      );
    }
    return next();
  });
}

/**
 * submissions-job-opening controller
 */

import { factories } from '@strapi/strapi';
import { checkFormSubmissionRateLimit } from '../../../utils/form-submission-rate-limit';

const UID = 'api::submissions-job-opening.submissions-job-opening';
const CAREER_OPENING_UID = 'api::career-opening.career-opening';
const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ALLOWED_RESUME_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'image/jpeg',
  'image/png',
]);

const stringOrUndefined = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const requestData = (ctx: any) => {
  const body = ctx.request.body ?? {};
  const raw = body.data ?? body;

  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  return raw && typeof raw === 'object' ? raw : {};
};

const firstFile = (files: any) => {
  const file = files?.resume;
  return Array.isArray(file) ? file[0] : file;
};

const integerOrUndefined = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
};

const skillItems = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) =>
      typeof item === 'string'
        ? stringOrUndefined(item)
        : stringOrUndefined(item?.SkillName)
    )
    .filter((item): item is string => Boolean(item))
    .slice(0, 50)
    .map((SkillName) => ({ SkillName }));
};

export default factories.createCoreController(UID, ({ strapi }) => ({
  async submit(ctx) {
    const input = requestData(ctx);
    const resume = firstFile(ctx.request.files);
    const personalDetails = input.personalDetails ?? {};
    const email = stringOrUndefined(personalDetails.EmailId)?.toLowerCase();
    const rateLimit = checkFormSubmissionRateLimit([
      'job-opening',
      ctx.ip,
      email,
    ]);

    if (!rateLimit.allowed) {
      ctx.set('Retry-After', String(rateLimit.retryAfterSeconds));
      return ctx.tooManyRequests(
        'Too many job applications. Please try again later.'
      );
    }

    const jobID = stringOrUndefined(input.jobID);
    const name = stringOrUndefined(personalDetails.Name);
    const phone = stringOrUndefined(personalDetails.PhoneNo);

    if (!jobID) return ctx.badRequest('jobID is required.');
    if (!name) return ctx.badRequest('personalDetails.Name is required.');
    if (!phone || !/^\+?[\d\s()-]{7,20}$/.test(phone)) {
      return ctx.badRequest('personalDetails.PhoneNo must be valid.');
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ctx.badRequest('personalDetails.EmailId must be valid.');
    }
    if (!resume) return ctx.badRequest('resume is required.');

    const mime = resume.mimetype ?? resume.type;
    if (!ALLOWED_RESUME_MIME_TYPES.has(mime)) {
      return ctx.badRequest(
        'resume must be PDF, DOC, DOCX, ZIP, JPEG, or PNG.'
      );
    }
    if (resume.size && resume.size > MAX_RESUME_BYTES) {
      return ctx.badRequest('resume must be 5MB or smaller.');
    }

    const careerOpening = await strapi
      .documents(CAREER_OPENING_UID)
      .findFirst({
        status: 'published',
        filters: { jobID },
      } as any);
    if (!careerOpening) return ctx.badRequest('Unknown jobID.');

    const educationDetails = input.educationDetails ?? {};
    const workExperience = input.workExperience ?? {};
    const skillsAndLanguages = input.skillsAndLanguages ?? {};
    const addInfo = input.addInfo ?? {};

    const entity = await strapi.documents(UID).create({
      data: {
        jobID: careerOpening.jobID,
        jobTitle: careerOpening.title,
        experience: careerOpening.experience,
        location: careerOpening.location,
        department: careerOpening.department,
        personalDetails: {
          Name: name,
          PhoneNo: phone,
          EmailId: email,
          DOB: stringOrUndefined(personalDetails.DOB),
          Gender: stringOrUndefined(personalDetails.Gender),
        },
        educationDetails: {
          Degree: stringOrUndefined(educationDetails.Degree),
          AreaOfStudy: stringOrUndefined(educationDetails.AreaOfStudy),
          Year: stringOrUndefined(String(educationDetails.Year ?? '')),
        },
        workExperience: {
          RelvWorkExp: stringOrUndefined(workExperience.RelvWorkExp),
          CurrCompName: stringOrUndefined(workExperience.CurrCompName),
          CurrJobTitle: stringOrUndefined(workExperience.CurrJobTitle),
          CurrCtc: stringOrUndefined(String(workExperience.CurrCtc ?? '')),
          ExpecCtc: stringOrUndefined(String(workExperience.ExpecCtc ?? '')),
          NoticePerd: integerOrUndefined(workExperience.NoticePerd),
        },
        skillsAndLanguages: {
          Skills: skillItems(skillsAndLanguages.Skills),
          Languages: skillItems(skillsAndLanguages.Languages),
        },
        addInfo: {
          relation: addInfo.relation === true,
          EmpName: stringOrUndefined(addInfo.EmpName),
          EmpJobTitle: stringOrUndefined(addInfo.EmpJobTitle),
        },
        workflowStatus: 'new',
      },
    } as any);

    try {
      await strapi.plugin('upload').service('upload').upload({
        data: {
          ref: UID,
          refId: entity.id,
          field: 'resume',
        },
        files: resume,
      });
    } catch (error) {
      await strapi.documents(UID).delete({
        documentId: entity.documentId,
      } as any);
      throw error;
    }

    ctx.status = 201;
    return {
      data: {
        documentId: entity.documentId,
        jobID: entity.jobID,
        workflowStatus: entity.workflowStatus,
      },
      meta: {},
    };
  },
}));

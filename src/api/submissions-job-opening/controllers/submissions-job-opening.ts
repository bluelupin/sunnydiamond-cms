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
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
};

const dateOrUndefined = (value: unknown) => {
  const date = stringOrUndefined(value);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return undefined;
  }

  return date;
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
    const dob = dateOrUndefined(personalDetails.DOB);
    const gender = stringOrUndefined(personalDetails.Gender);
    const educationDetails = input.educationDetails ?? {};
    const degree = stringOrUndefined(educationDetails.Degree);
    const areaOfStudy = stringOrUndefined(educationDetails.AreaOfStudy);
    const completionYear = integerOrUndefined(educationDetails.Year);
    const workExperience = input.workExperience ?? {};
    const relevantWorkExperience = stringOrUndefined(workExperience.RelvWorkExp);
    const currentCtc = integerOrUndefined(workExperience.CurrCtc);
    const expectedCtc = integerOrUndefined(workExperience.ExpecCtc);
    const noticePeriod = integerOrUndefined(workExperience.NoticePerd);
    const addInfo = input.addInfo ?? {};

    if (!jobID) return ctx.badRequest('jobID is required.');
    if (!name) return ctx.badRequest('personalDetails.Name is required.');
    if (!phone || !/^\+?[\d\s()-]{7,20}$/.test(phone)) {
      return ctx.badRequest('personalDetails.PhoneNo must be valid.');
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return ctx.badRequest('personalDetails.EmailId must be valid.');
    }
    if (!dob) return ctx.badRequest('personalDetails.DOB is required and must use YYYY-MM-DD format.');
    if (dob > new Date().toISOString().slice(0, 10)) {
      return ctx.badRequest('personalDetails.DOB cannot be in the future.');
    }
    if (!gender) return ctx.badRequest('personalDetails.Gender is required.');
    if (!degree) return ctx.badRequest('educationDetails.Degree is required.');
    if (!areaOfStudy) return ctx.badRequest('educationDetails.AreaOfStudy is required.');
    if (completionYear === undefined || completionYear < 1900 || completionYear > new Date().getFullYear()) {
      return ctx.badRequest('educationDetails.Year must be a valid completion year.');
    }
    if (!relevantWorkExperience) {
      return ctx.badRequest('workExperience.RelvWorkExp is required.');
    }
    if (workExperience.CurrCtc !== undefined && (currentCtc === undefined || currentCtc < 0)) {
      return ctx.badRequest('workExperience.CurrCtc must be a non-negative integer value in LPA.');
    }
    if (expectedCtc === undefined || expectedCtc < 0) {
      return ctx.badRequest('workExperience.ExpecCtc is required and must be a non-negative integer value in LPA.');
    }
    if (workExperience.NoticePerd !== undefined && (noticePeriod === undefined || noticePeriod < 0)) {
      return ctx.badRequest('workExperience.NoticePerd must be a non-negative integer.');
    }
    if (typeof addInfo.relation !== 'boolean') {
      return ctx.badRequest('addInfo.relation must be selected.');
    }
    const employeeName = stringOrUndefined(addInfo.EmpName);
    const employeeJobTitle = stringOrUndefined(addInfo.EmpJobTitle);
    if (addInfo.relation && !employeeName) {
      return ctx.badRequest('addInfo.EmpName is required when relation is true.');
    }
    if (addInfo.relation && !employeeJobTitle) {
      return ctx.badRequest('addInfo.EmpJobTitle is required when relation is true.');
    }
    if (!resume) return ctx.badRequest('resume is required.');

    const mime = resume.mimetype ?? resume.type;
    if (!ALLOWED_RESUME_MIME_TYPES.has(mime)) {
      return ctx.badRequest(
        'resume must be PDF, ZIP, JPEG, or PNG.'
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

    const skillsAndLanguages = input.skillsAndLanguages ?? {};

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
          DOB: dob,
          Gender: gender,
        },
        educationDetails: {
          Degree: degree,
          AreaOfStudy: areaOfStudy,
          Year: completionYear,
        },
        workExperience: {
          RelvWorkExp: relevantWorkExperience,
          CurrCompName: stringOrUndefined(workExperience.CurrCompName),
          CurrJobTitle: stringOrUndefined(workExperience.CurrJobTitle),
          CurrCtc: currentCtc,
          ExpecCtc: expectedCtc,
          NoticePerd: noticePeriod,
        },
        skillsAndLanguages: {
          Skills: skillItems(skillsAndLanguages.Skills),
          Languages: skillItems(skillsAndLanguages.Languages),
        },
        addInfo: {
          relation: addInfo.relation === true,
          EmpName: addInfo.relation ? employeeName : undefined,
          EmpJobTitle: addInfo.relation ? employeeJobTitle : undefined,
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

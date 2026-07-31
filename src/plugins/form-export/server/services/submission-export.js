'use strict';

const EXPORTS = {
  generic: {
    uid: 'api::generic-submission.generic-submission',
    filename: 'sunny-generic-submissions.csv',
    fields: [
      'id',
      'documentId',
      'formTag',
      'fullName',
      'email',
      'phone',
      'preferredShowroom',
      'preferredDate',
      'selectedTimeSlot',
      'notes',
      'sourcePage',
      'consentAccepted',
      'workflowStatus',
      'internalNotes',
      'createdAt',
      'updatedAt',
    ],
    populate: ['preferredShowroom'],
  },
  product: {
    uid: 'api::product-submission.product-submission',
    filename: 'sunny-product-submissions.csv',
    fields: [
      'id',
      'documentId',
      'formTag',
      'productName',
      'productId',
      'customerName',
      'customerPhone',
      'customerEmail',
      'requestedDate',
      'selectedTimeSlot',
      'requestDetails',
      'addressLine1',
      'addressLine2',
      'pincode',
      'city',
      'state',
      'preferredShowroom',
      'sourcePage',
      'consentAccepted',
      'workflowStatus',
      'internalNotes',
      'uploadedImageUrl',
      'createdAt',
      'updatedAt',
    ],
    populate: ['uploadedImage', 'state', 'preferredShowroom'],
  },
  bespoke: {
    uid: 'api::bespoke-submission.bespoke-submission',
    filename: 'sunny-bespoke-submissions.csv',
    fields: [
      'id',
      'documentId',
      'fullName',
      'phone',
      'email',
      'designVision',
      'referenceImageUrl',
      'createdAt',
      'updatedAt',
    ],
    populate: ['referenceImage'],
  },
  job: {
    uid: 'api::submissions-job-opening.submissions-job-opening',
    filename: 'sunny-job-applications.csv',
    fields: [
      'id',
      'documentId',
      'jobID',
      'jobTitle',
      'department',
      'experience',
      'location',
      'personalDetails.Name',
      'personalDetails.PhoneNo',
      'personalDetails.EmailId',
      'personalDetails.DOB',
      'personalDetails.Gender',
      'educationDetails.Degree',
      'educationDetails.AreaOfStudy',
      'educationDetails.Year',
      'workExperience.RelvWorkExp',
      'workExperience.CurrCompName',
      'workExperience.CurrJobTitle',
      'workExperience.CurrCtc',
      'workExperience.ExpecCtc',
      'workExperience.NoticePerd',
      'skillsAndLanguages.Skills',
      'skillsAndLanguages.Languages',
      'addInfo.relation',
      'addInfo.EmpName',
      'addInfo.EmpJobTitle',
      'workflowStatus',
      'internalNotes',
      'resumeUrl',
      'resumeName',
      'createdAt',
      'updatedAt',
    ],
    headers: {
      id: 'ID',
      documentId: 'Document ID',
      jobID: 'Job ID',
      jobTitle: 'Job Title',
      department: 'Department',
      experience: 'Experience',
      location: 'Location',
      'personalDetails.Name': 'Applicant Name',
      'personalDetails.PhoneNo': 'Phone Number',
      'personalDetails.EmailId': 'Email',
      'personalDetails.DOB': 'Date of Birth',
      'personalDetails.Gender': 'Gender',
      'educationDetails.Degree': 'Degree',
      'educationDetails.AreaOfStudy': 'Area of Study',
      'educationDetails.Year': 'Graduation Year',
      'workExperience.RelvWorkExp': 'Relevant Work Experience',
      'workExperience.CurrCompName': 'Current Company',
      'workExperience.CurrJobTitle': 'Current Job Title',
      'workExperience.CurrCtc': 'Current CTC',
      'workExperience.ExpecCtc': 'Expected CTC',
      'workExperience.NoticePerd': 'Notice Period (Days)',
      'skillsAndLanguages.Skills': 'Skills',
      'skillsAndLanguages.Languages': 'Languages',
      'addInfo.relation': 'Employee Referral',
      'addInfo.EmpName': 'Employee Name',
      'addInfo.EmpJobTitle': 'Employee Job Title',
      workflowStatus: 'Status',
      internalNotes: 'Internal Notes',
      resumeUrl: 'Resume URL',
      resumeName: 'Resume File Name',
      createdAt: 'Submitted At',
      updatedAt: 'Updated At',
    },
    populate: [
      'resume',
      'personalDetails',
      'educationDetails',
      'workExperience',
      'skillsAndLanguages',
      'skillsAndLanguages.Skills',
      'skillsAndLanguages.Languages',
      'addInfo',
    ],
  },
};

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const normalized =
    value instanceof Date
      ? value.toISOString()
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);

  if (/[",\r\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
};

const absoluteUrl = (url, baseUrl) => {
  if (!url || !baseUrl || /^https?:\/\//i.test(url)) return url || '';

  try {
    return new URL(url, `${String(baseUrl).replace(/\/+$/, '')}/`).toString();
  } catch {
    return url;
  }
};

const getCellValue = (record, field, baseUrl) => {
  if (
    field === 'experience' &&
    typeof record.experience === 'string' &&
    /^\d+\s*-\s*\d+$/.test(record.experience.trim())
  ) {
    return `="${record.experience.trim()}"`;
  }
  if (field === 'uploadedImageUrl') {
    return record.uploadedImage?.url || '';
  }
  if (field === 'referenceImageUrl') {
    return record.referenceImage?.url || '';
  }
  if (field === 'resumeUrl') {
    return absoluteUrl(record.resume?.url, baseUrl);
  }
  if (field === 'resumeName') {
    return record.resume?.name || '';
  }
  if (field === 'preferredShowroom') {
    return record.preferredShowroom?.name || '';
  }
  if (field === 'state') {
    return record.state?.name || '';
  }

  return field.split('.').reduce((value, key) => value?.[key], record);
};

const toCsv = (records, fields, headers = {}, baseUrl) => {
  const rows = [
    fields.map((field) => escapeCsvValue(headers[field] || field)).join(','),
    ...records.map((record) =>
      fields
        .map((field) => escapeCsvValue(getCellValue(record, field, baseUrl)))
        .join(',')
    ),
  ];

  return `\uFEFF${rows.join('\r\n')}`;
};

module.exports = ({ strapi }) => ({
  async listJobApplications({ page, pageSize, search }) {
    const uid = 'api::submissions-job-opening.submissions-job-opening';
    const where = search
      ? {
          $or: [
            { jobID: { $containsi: search } },
            { jobTitle: { $containsi: search } },
            { department: { $containsi: search } },
            { location: { $containsi: search } },
          ],
        }
      : {};

    const [records, total] = await Promise.all([
      strapi.db.query(uid).findMany({
        where,
        orderBy: { createdAt: 'desc' },
        offset: (page - 1) * pageSize,
        limit: pageSize,
        populate: EXPORTS.job.populate,
      }),
      strapi.db.query(uid).count({ where }),
    ]);

    return {
      data: records.map((record) => ({
        id: record.id,
        documentId: record.documentId,
        jobID: record.jobID,
        jobTitle: record.jobTitle,
        department: record.department,
        experience: record.experience,
        location: record.location,
        applicantName: record.personalDetails?.Name || '',
        phone: record.personalDetails?.PhoneNo || '',
        email: record.personalDetails?.EmailId || '',
        workflowStatus: record.workflowStatus,
        createdAt: record.createdAt,
        resume: record.resume
          ? {
              name: record.resume.name,
              url: record.resume.url,
              mime: record.resume.mime,
              size: record.resume.size,
            }
          : null,
      })),
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount: Math.ceil(total / pageSize),
          total,
        },
      },
    };
  },

  async exportSubmissions(type, baseUrl) {
    const exportConfig = EXPORTS[type];

    if (!exportConfig) {
      const error = new Error('Unsupported submission export type');
      error.status = 400;
      throw error;
    }

    const records = await strapi.db.query(exportConfig.uid).findMany({
      orderBy: { createdAt: 'desc' },
      populate: exportConfig.populate || [],
    });

    return {
      filename: exportConfig.filename,
      csv: toCsv(records, exportConfig.fields, exportConfig.headers, baseUrl),
    };
  },
});

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
      'utmSource',
      'utmMedium',
      'utmCampaign',
      'consentAccepted',
      'workflowStatus',
      'internalNotes',
      'createdAt',
      'updatedAt',
    ],
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
      'sourcePage',
      'utmSource',
      'utmMedium',
      'utmCampaign',
      'consentAccepted',
      'workflowStatus',
      'internalNotes',
      'uploadedImageUrl',
      'createdAt',
      'updatedAt',
    ],
    populate: ['uploadedImage'],
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

const getCellValue = (record, field) => {
  if (field === 'uploadedImageUrl') {
    return record.uploadedImage?.url || '';
  }

  return record[field];
};

const toCsv = (records, fields) => {
  const rows = [
    fields.map(escapeCsvValue).join(','),
    ...records.map((record) =>
      fields.map((field) => escapeCsvValue(getCellValue(record, field))).join(',')
    ),
  ];

  return `\uFEFF${rows.join('\r\n')}`;
};

module.exports = ({ strapi }) => ({
  async exportSubmissions(type) {
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
      csv: toCsv(records, exportConfig.fields),
    };
  },
});

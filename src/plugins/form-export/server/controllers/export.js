'use strict';

const JOB_APPLICATION_UID =
  'api::submissions-job-opening.submissions-job-opening';

const attachmentHeader = (filename) => {
  const cleaned = String(filename || 'resume')
    .replace(/[\\/\r\n\0]/g, '_')
    .trim() || 'resume';
  const ascii = cleaned.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '_');
  const encoded = encodeURIComponent(cleaned).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
};

module.exports = ({ strapi }) => ({
  async jobApplications(ctx) {
    const page = Number(ctx.query.page);
    const pageSize = Number(ctx.query.pageSize);

    try {
      ctx.body = await strapi
        .plugin('form-export')
        .service('submissionExport')
        .listJobApplications({
          page: Number.isInteger(page) && page > 0 ? page : 1,
          pageSize:
            Number.isInteger(pageSize) && pageSize > 0
              ? Math.min(pageSize, 100)
              : 25,
          search:
            typeof ctx.query.search === 'string'
              ? ctx.query.search.trim()
              : '',
        });
    } catch (error) {
      strapi.log.error('Failed to list job applications', error);
      return ctx.internalServerError('Failed to list job applications');
    }
  },

  async submissions(ctx) {
    const { type } = ctx.params;

    try {
      const exportResult = await strapi
        .plugin('form-export')
        .service('submissionExport')
        .exportSubmissions(
          type,
          strapi.config.get('server.url') || ctx.origin
        );

      ctx.set('Content-Type', 'text/csv; charset=utf-8');
      ctx.set(
        'Content-Disposition',
        `attachment; filename="${exportResult.filename}"`
      );
      ctx.body = exportResult.csv;
    } catch (error) {
      if (error.status === 400) {
        return ctx.badRequest(error.message);
      }

      strapi.log.error('Failed to export form submissions', error);
      return ctx.internalServerError('Failed to export form submissions');
    }
  },

  async resume(ctx) {
    const documentId =
      typeof ctx.params.documentId === 'string'
        ? ctx.params.documentId.trim()
        : '';

    if (!documentId) return ctx.badRequest('Application documentId is required.');

    try {
      const application = await strapi.db.query(JOB_APPLICATION_UID).findOne({
        where: { documentId },
        populate: { resume: true },
      });
      const resume = application?.resume;

      if (!resume?.url) return ctx.notFound('Resume not found.');

      const sourceUrl = new URL(resume.url, ctx.origin).toString();
      const response = await fetch(sourceUrl);

      if (!response.ok) {
        strapi.log.error(
          `Failed to fetch resume ${resume.id}: upstream returned ${response.status}`
        );
        return ctx.internalServerError('Failed to download resume.');
      }

      const file = Buffer.from(await response.arrayBuffer());

      ctx.set(
        'Content-Type',
        resume.mime || response.headers.get('content-type') || 'application/octet-stream'
      );
      ctx.set('Content-Disposition', attachmentHeader(resume.name));
      ctx.set('Content-Length', String(file.length));
      ctx.set('Cache-Control', 'private, no-store');
      ctx.set('X-Content-Type-Options', 'nosniff');
      ctx.body = file;
    } catch (error) {
      strapi.log.error('Failed to download job application resume', error);
      return ctx.internalServerError('Failed to download resume.');
    }
  },
});

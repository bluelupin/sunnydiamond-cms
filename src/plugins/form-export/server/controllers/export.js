'use strict';

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
});

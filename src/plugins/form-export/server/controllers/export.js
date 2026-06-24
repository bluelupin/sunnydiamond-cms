'use strict';

module.exports = ({ strapi }) => ({
  async submissions(ctx) {
    const { type } = ctx.params;

    try {
      const exportResult = await strapi
        .plugin('form-export')
        .service('submissionExport')
        .exportSubmissions(type);

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

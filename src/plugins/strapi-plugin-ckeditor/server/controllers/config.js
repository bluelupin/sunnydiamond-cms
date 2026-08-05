'use strict';

module.exports = () => ({
  getConfig(ctx) {
    const licenseKey = process.env.CKEDITOR_LICENSE_KEY;

    if (!licenseKey) {
      return ctx.internalServerError('CKEDITOR_LICENSE_KEY is not configured');
    }

    ctx.body = { licenseKey };
  },
});

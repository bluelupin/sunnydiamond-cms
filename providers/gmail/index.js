'use strict';

const { google } = require('googleapis');
const nodemailer = require('nodemailer');

module.exports = {
  init(providerOptions = {}, settings = {}) {
    const { clientId, clientSecret, refreshToken } = providerOptions;
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth });
    // Compose MIME locally; no SMTP connection is made. Stream transport keeps
    // Bcc headers so Gmail can resolve all recipients from the raw message.
    const composer = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: 'windows',
      disableFileAccess: true,
      disableUrlAccess: true,
    });

    return {
      async send(options = {}) {
        // Check at send time so a missing secret does not prevent CMS startup.
        const missing = [
          ['GOOGLE_MAIL_CLIENT_ID', clientId],
          ['GOOGLE_MAIL_CLIENT_SECRET', clientSecret],
          ['GOOGLE_MAIL_REFRESH_TOKEN', refreshToken],
        ].filter(([, value]) => typeof value !== 'string' || !value.trim());
        if (missing.length) {
          throw new Error(`Gmail email provider: missing ${missing.map(([key]) => key).join(', ')}.`);
        }
        const from = options.from || settings.defaultFrom;
        if (!from) throw new Error('Gmail email provider: EMAIL_FROM is not configured.');

        const message = await composer.sendMail({
          from,
          to: options.to,
          cc: options.cc,
          bcc: options.bcc,
          replyTo: options.replyTo || settings.defaultReplyTo,
          subject: options.subject,
          text: options.text,
          html: options.html,
          attachments: options.attachments,
          headers: options.headers,
        });
        if (!message.envelope.to.length) {
          throw new Error('Gmail email provider: at least one recipient is required.');
        }
        try {
          // Google refreshes expired access tokens using the stored refresh token.
          const response = await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw: message.message.toString('base64url') },
          }, {
            timeout: 30000,
            retry: false, // A retry after an ambiguous response can duplicate mail.
          });
          return response.data;
        } catch (error) {
          // Google errors may contain authorization headers and MIME content.
          // Expose a useful category without propagating those request details.
          const status = Number(error?.response?.status);
          const reason = error?.response?.data?.error;
          if (reason === 'invalid_grant') {
            throw new Error('Gmail email provider: OAuth authorization expired or was revoked; reauthorize the sender and update its refresh token.');
          }
          if (status === 401 || reason === 'invalid_client') {
            throw new Error('Gmail email provider: OAuth authentication failed; check the matching client credentials and refresh token.');
          }
          if (status === 403) {
            throw new Error('Gmail email provider: access denied; check Gmail API enablement, gmail.send scope, sender authorization and quota.');
          }
          throw new Error(`Gmail email provider: delivery request failed${Number.isInteger(status) && status >= 400 && status <= 599 ? ` (HTTP ${status})` : ''}. Check Google account authorization and service availability before retrying.`);
        }
      },
    };
  },
};

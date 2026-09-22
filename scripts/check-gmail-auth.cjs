// Checks token refresh and granted scope without sending email or starting Strapi.
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env'), quiet: true });
const { google } = require('googleapis');

async function main() {
  for (const name of ['GOOGLE_MAIL_CLIENT_ID', 'GOOGLE_MAIL_CLIENT_SECRET', 'GOOGLE_MAIL_REFRESH_TOKEN']) {
    if (!process.env[name]?.trim()) throw new Error(`Missing ${name} in the environment.`);
  }
  const auth = new google.auth.OAuth2(process.env.GOOGLE_MAIL_CLIENT_ID, process.env.GOOGLE_MAIL_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GOOGLE_MAIL_REFRESH_TOKEN });
  try {
    const { token } = await auth.getAccessToken();
    if (!token) throw new Error('No access token returned');
    const info = await auth.getTokenInfo(token);
    if (!info.scopes.includes('https://www.googleapis.com/auth/gmail.send')) {
      throw new Error('Missing gmail.send scope');
    }
    console.log('Gmail OAuth refresh succeeded; gmail.send permission confirmed. No email sent.');
  } catch (error) {
    // Never print Google error objects: they may include secrets in requests.
    const reason = error?.response?.data?.error;
    if (reason === 'invalid_grant') throw new Error('OAuth grant expired or revoked. Obtain a new refresh token from the mail account administrator.');
    if (reason === 'invalid_client') throw new Error('Google rejected the OAuth client. Check matching client credentials.');
    if (error?.message === 'Missing gmail.send scope') throw new Error('The token does not grant gmail.send permission.');
    throw new Error('Google OAuth check failed. Check network access and the mail OAuth configuration; secrets have been omitted.');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

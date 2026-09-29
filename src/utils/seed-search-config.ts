import type { Core } from '@strapi/strapi';

// R-PS-1 popular searches; R-PS-8: exchange has no page yet, so it points at Contact until the
// client sends the URL. Everything here is editable in the admin afterwards.
const SEARCH_CONFIG = {
  popularSearches: [
    { label: 'Solitaire rings', href: '/search?q=solitaire%20rings' },
    { label: 'Bridal necklace', href: '/search?q=bridal%20necklace' },
    { label: 'Gifts under ₹50,000', href: '/jewellery?maxPrice=50000' },
    { label: 'Auriga', href: '/search?q=auriga' },
  ],
  serviceShortcuts: [
    { label: 'Old gold exchange', href: '/contact', keywords: 'exchange,old gold,gold exchange,trade in' },
    { label: 'EMI and Diamonds for Everyone', href: '/diamonds-for-everyone', keywords: 'emi,instalment,installment,finance,financing,dfe,diamonds for everyone,monthly plan' },
    { label: 'Bespoke jewellery', href: '/bespoke-jewellery', keywords: 'bespoke,custom,customise,customize,made to order,design my own' },
    { label: 'Find a store near you', href: '/store-locator', keywords: 'store,showroom,near me,nearest,location,address' },
    { label: 'Book an appointment', href: '/book-an-appointment', keywords: 'appointment,book,visit,video call,try at home' },
    { label: 'Gifts under ₹50,000', href: '/jewellery?maxPrice=50000', keywords: 'gift,gifts,under 50000,under 50k,budget' },
  ],
  educationLinks: [
    { label: 'The 4Cs of diamonds', href: '/learn-about-diamonds', keywords: '4c,4cs,4 cs,cut,clarity,colour,color,carat,if clarity,vvs,vs' },
    { label: 'Certification and hallmarking', href: '/policy-and-certifications', keywords: 'certificate,certification,certified,igi,gia,hallmark,hallmarking,bis' },
  ],
};

const READ_ACTION = 'api::search-config.search-config.find';
// The website reads the CMS with a custom API token. Any token that may already read the global
// config gets read access to the search config too; no other token is touched.
const WEBSITE_TOKEN_MARKER = 'api::global-config.global-config.find';

/** Creates and publishes the search config once; an existing one (edited by staff) is never touched. */
export async function seedSearchConfig(strapi: Core.Strapi) {
  await grantWebsiteTokenRead(strapi);
  const documents = strapi.documents('api::search-config.search-config' as any);
  if (await documents.findFirst({ status: 'draft' })) {
    strapi.log.info('Search config seed skipped: already exists.');
    return;
  }
  await documents.create({ data: SEARCH_CONFIG as any, status: 'published' });
  strapi.log.info('Search config seeded.');
}

async function grantWebsiteTokenRead(strapi: Core.Strapi) {
  const permissions = strapi.db.query('admin::api-token-permission');
  const marked = await permissions.findMany({ where: { action: WEBSITE_TOKEN_MARKER }, populate: ['token'] });
  let granted = 0;
  for (const { token } of marked) {
    if (!token || token.type !== 'custom') continue;
    if (await permissions.findOne({ where: { action: READ_ACTION, token: token.id } })) continue;
    await permissions.create({ data: { action: READ_ACTION, token: token.id } });
    granted += 1;
  }
  strapi.log.info(`Search config read access granted to ${granted} website token(s).`);
}

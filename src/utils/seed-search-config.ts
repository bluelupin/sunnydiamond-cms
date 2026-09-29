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

/** Creates and publishes the search config once; an existing one (edited by staff) is never touched. */
export async function seedSearchConfig(strapi: Core.Strapi) {
  await grantPublicRead(strapi);
  await grantEditorAccess(strapi);
  const documents = strapi.documents('api::search-config.search-config' as any);
  if (await documents.findFirst({ status: 'draft' })) {
    strapi.log.info('Search config seed skipped: already exists.');
    return;
  }
  await documents.create({ data: SEARCH_CONFIG as any, status: 'published' });
  strapi.log.info('Search config seeded.');
}

/** The website reads CMS content without a token, like the other page types (seeder.ts publicReadActions). */
async function grantPublicRead(strapi: Core.Strapi) {
  const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } } as any);
  if (!publicRole) return;
  const permissions = strapi.db.query('plugin::users-permissions.permission');
  if (await permissions.findOne({ where: { action: READ_ACTION, role: publicRole.id } } as any)) return;
  await permissions.create({ data: { action: READ_ACTION, role: publicRole.id } } as any);
  strapi.log.info('Search config: public read access granted.');
}

const SUBJECT = 'api::search-config.search-config';
const LINK_FIELDS = ['label', 'href', 'keywords'];
const FIELDS = ['popularSearches', 'serviceShortcuts', 'educationLinks'].flatMap((list) =>
  LINK_FIELDS.map((field) => `${list}.${field}`),
);

/**
 * Staff with the Editor role curate the search dropdown (PS-10). Strapi gives new content types
 * to Super Admin only, so the Editor role gets the same content-manager rights it has on the
 * other page types. Existing rights are left as they are.
 */
async function grantEditorAccess(strapi: Core.Strapi) {
  const editor = await strapi.db.query('admin::role').findOne({ where: { code: 'strapi-editor' } } as any);
  if (!editor) return;
  const permissions = strapi.db.query('admin::permission');
  let granted = 0;
  for (const verb of ['read', 'create', 'update', 'delete', 'publish']) {
    const action = `plugin::content-manager.explorer.${verb}`;
    if (await permissions.findOne({ where: { action, subject: SUBJECT, role: editor.id } } as any)) continue;
    const properties = ['read', 'create', 'update'].includes(verb) ? { fields: FIELDS } : {};
    await permissions.create({ data: { action, subject: SUBJECT, properties, conditions: [], role: editor.id } } as any);
    granted += 1;
  }
  if (granted) strapi.log.info(`Search config: ${granted} Editor permission(s) granted.`);
}

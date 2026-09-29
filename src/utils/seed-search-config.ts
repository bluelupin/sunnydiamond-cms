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

/** Creates and publishes the search config once; an existing one (edited by staff) is never touched. */
export async function seedSearchConfig(strapi: Core.Strapi) {
  const documents = strapi.documents('api::search-config.search-config' as any);
  if (await documents.findFirst({ status: 'draft' })) {
    strapi.log.info('Search config seed skipped: already exists.');
    return;
  }
  await documents.create({ data: SEARCH_CONFIG as any, status: 'published' });
  strapi.log.info('Search config seeded.');
}

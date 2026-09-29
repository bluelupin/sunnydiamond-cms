import type { Core } from '@strapi/strapi';

// Client-supplied showroom coordinates and PINs (R-NS-2, DECISIONS.md). Chennai is in the
// client's list but has no showroom in the CMS, so it is not created here.
const SHOWROOMS = [
  { slug: 'kochi', pincode: '682035', latitude: 9.9784983, longitude: 76.2824039 },
  { slug: 'trivandrum', pincode: '695004', latitude: 8.5188383, longitude: 76.9423012 },
  { slug: 'calicut', pincode: '673016', latitude: 11.2579924, longitude: 75.798338 },
  { slug: 'thrissur', pincode: '680004', latitude: 10.5223913, longitude: 76.2019176 },
  { slug: 'coimbatore', pincode: '641018', latitude: 11.00387, longitude: 76.9782124 },
];

/** Fills coordinates (and the matching PIN) on every draft, published and locale row that has none yet. */
export async function seedShowroomCoordinates(strapi: Core.Strapi) {
  const table = strapi.db.metadata.get('api::showroom.showroom').tableName;
  let updated = 0;
  for (const { slug, ...values } of SHOWROOMS) {
    updated += await strapi.db.connection(table).where({ slug }).whereNull('latitude').update(values);
  }
  strapi.log.info(`Showroom coordinates seeded: ${updated} rows updated.`);
}

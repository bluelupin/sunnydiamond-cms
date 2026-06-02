import type { Core } from '@strapi/strapi';

const bySortOrder = { sortOrder: 'asc' } as const;

const withExistingId = (component: any, data: Record<string, unknown>) => {
  return component?.id ? { id: component.id, ...data } : data;
};

export async function repairHomepageSections(strapi: Core.Strapi) {
  strapi.log.info('Starting one-time Homepage section repair...');

  const homepage = await strapi.documents('api::homepage.homepage').findFirst({
    sort: { updatedAt: 'desc' },
    populate: {
      featuredCollectionSection: { fields: ['id'] },
      occasionSection: { fields: ['id'] },
      craftsmanshipSection: { fields: ['id'] },
      showroomSection: { fields: ['id'] },
    },
  } as any);

  if (!homepage?.documentId) {
    strapi.log.warn('Homepage section repair skipped: no Homepage document found.');
    return;
  }

  const homepageWithSections = homepage as any;

  const [occasions, showrooms, collections] = await Promise.all([
    strapi.documents('api::occasion.occasion').findMany({
      status: 'published',
      sort: bySortOrder,
    } as any),
    strapi.documents('api::showroom.showroom').findMany({
      status: 'published',
      sort: bySortOrder,
    } as any),
    strapi.documents('api::editorial-collection.editorial-collection').findMany({
      status: 'published',
      sort: bySortOrder,
    } as any),
  ]);

  const occasionDocumentIds = occasions.map((occasion: any) => occasion.documentId).filter(Boolean);
  const showroomDocumentIds = showrooms.map((showroom: any) => showroom.documentId).filter(Boolean);
  const firstCollection = collections.find((collection: any) => collection.documentId);

  await strapi.documents('api::homepage.homepage').update({
    documentId: homepage.documentId,
    data: {
      featuredCollectionSection: withExistingId(homepageWithSections.featuredCollectionSection, {
        sectionTitle: 'Alankara Collection',
        description: 'A stellar showcase of signature flawless rings, pendants, and tennis bracelets reflecting traditional mastery.',
        magentoCollectionRef: firstCollection?.slug || 'alankara-collection',
        cta: { label: 'Explore Collection', url: '/products', targetType: 'internal' },
        isActive: true,
      }),
      occasionSection: withExistingId(homepageWithSections.occasionSection, {
        sectionTitle: 'Timeless Pieces for Every Occasion',
        description: 'Explore the highly curated jewelry selections suited perfectly for your Festival, Cocktail, or Wedding collections.',
        occasions: {
          set: occasionDocumentIds,
        },
        isActive: true,
      }),
      craftsmanshipSection: withExistingId(homepageWithSections.craftsmanshipSection, {
        sectionTitle: 'From Vision to Masterpiece',
        description: 'Our process brings each diamond from first sketch to finished jewel.',
        steps: [
          { title: 'Design', description: 'Collaborate with our designers to sketch your perfect piece, tailored to your style and story.', sortOrder: 1, isActive: true },
          { title: 'Source', description: 'Expert gemologists choose Belgium-sourced internally flawless stones adhering to conflict-free mandates.', sortOrder: 2, isActive: true },
          { title: 'Craft', description: 'Master artisans set each stone to capture ultimate light in our dedicated atelier.', sortOrder: 3, isActive: true },
          { title: 'Deliver', description: 'Secure complimentary shipping directly to your doorstep with guaranteed certification.', sortOrder: 4, isActive: true },
        ],
        isActive: true,
      }),
      showroomSection: withExistingId(homepageWithSections.showroomSection, {
        sectionTitle: 'Visit Our Showrooms',
        description: 'Step into our atelier to discover the Belgian-sourced mastery behind every stone. Located across Kochi, Calicut, Thrissur, Trivandrum, and Coimbatore.',
        showrooms: {
          set: showroomDocumentIds,
        },
        isActive: true,
      }),
      publishedAt: new Date(),
    },
  } as any);

  strapi.log.info(
    `Homepage section repair completed. Connected ${occasionDocumentIds.length} occasions and ${showroomDocumentIds.length} showrooms.`
  );
}

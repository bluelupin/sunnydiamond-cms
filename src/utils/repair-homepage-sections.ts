import type { Core } from '@strapi/strapi';

const bySortOrder = { sortOrder: 'asc' } as const;
const obsoleteHomepageFields = ['occasionsTeaser', 'showroomTeaser', 'craftsmanshipSteps'];

const withExistingId = (component: any, data: Record<string, unknown>) => {
  return component?.id ? { id: component.id, ...data } : data;
};

export async function repairHomepageSections(strapi: Core.Strapi) {
  strapi.log.info('Starting one-time Homepage section repair...');

  const findHomepages = () => strapi.documents('api::homepage.homepage').findMany({
    sort: { updatedAt: 'desc' },
    populate: {
      hero: { fields: ['id'] },
      featuredCollectionSection: { fields: ['id'] },
      giftingBanner: { fields: ['id'] },
      occasionSection: { fields: ['id'] },
      craftsmanshipSection: { fields: ['id'] },
      showroomSection: { fields: ['id'] },
    },
  } as any);
  let homepages = await findHomepages();

  const homepageDocumentIds = Array.from(
    new Set(homepages.map((homepage: any) => homepage.documentId).filter(Boolean))
  );

  if (homepageDocumentIds.length === 0) {
    strapi.log.warn('Homepage section repair skipped: no Homepage document found.');
    return;
  }
  const canonicalHomepage = [...homepages].sort((left: any, right: any) => {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  })[0] as any;
  const duplicateDocumentIds = homepageDocumentIds.filter((documentId) => documentId !== canonicalHomepage.documentId);

  for (const documentId of duplicateDocumentIds) {
    await strapi.documents('api::homepage.homepage').delete({ documentId } as any);
  }

  if (duplicateDocumentIds.length > 0) {
    homepages = await findHomepages();
  }

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
  const removedObsoleteLinks = await strapi.db
    .connection('homepages_cmps')
    .whereIn('field', obsoleteHomepageFields)
    .delete();

  const homepage = homepages.find((entry: any) => entry.documentId === canonicalHomepage.documentId) as any;

  await strapi.documents('api::homepage.homepage').update({
    documentId: canonicalHomepage.documentId,
    data: {
      hero: {
        eyebrow: '20 Years of Legacy',
        title: 'Fine jewellery designed with a tradition of excellence',
        subtitle: 'Crafting rarity into timeless brilliance',
        primaryCta: { label: 'Shop Now', url: '/products', targetType: 'internal', openInNewTab: false },
        isActive: true,
      },
      featuredCollectionSection: withExistingId(homepage.featuredCollectionSection, {
        sectionTitle: 'Alankara Collection',
        description: 'Guided by tradition and perfected by expertise, our craftsmen bring every diamond to life with',
        magentoCollectionRef: firstCollection?.slug || 'alankara-collection',
        cta: { label: 'Explore Collection', url: '/products', targetType: 'internal' },
        isActive: true,
      }),
      giftingBanner: {
        eyebrow: 'Gifting Special',
        title: 'Gifting For Your Valentine',
        subtitle: 'Traditional mastery bringing every diamond to radiant, eternal life.',
        primaryCta: { label: 'Shop Now', url: '/products', targetType: 'internal' },
        secondaryCta: { label: 'Send a Gift Card Instead', url: '/contact', targetType: 'internal' },
        isActive: true,
      },
      occasionSection: withExistingId(homepage.occasionSection, {
        sectionTitle: 'Timeless Pieces for Every Occasion',
        description: 'Explore the highly curated jewelry selections suited perfectly for your Festival, Cocktail, or Wedding collections.',
        occasions: {
          set: occasionDocumentIds,
        },
        isActive: true,
      }),
      craftsmanshipSection: withExistingId(homepage.craftsmanshipSection, {
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
      showroomSection: withExistingId(homepage.showroomSection, {
        sectionTitle: 'Visit Our Showrooms',
        description: 'Step into our atelier to discover the Belgian-sourced mastery behind every stone. Located across Kochi, Calicut, Thrissur, Trivandrum, and Coimbatore.',
        showrooms: {
          set: showroomDocumentIds,
        },
        isActive: true,
      }),
      publishedAt: new Date(),
    },
    status: 'published',
  } as any);

  strapi.log.info(
    `Homepage section repair completed for ${canonicalHomepage.documentId}. Deleted ${duplicateDocumentIds.length} duplicate document(s). Removed ${removedObsoleteLinks} obsolete component link(s). Connected ${occasionDocumentIds.length} occasions and ${showroomDocumentIds.length} showrooms.`
  );
}

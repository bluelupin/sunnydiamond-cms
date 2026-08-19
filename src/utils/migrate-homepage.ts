import type { Core } from '@strapi/strapi';

// Interfaces for Old Data Schema
interface OldCta {
  id?: number;
  label?: string;
  url?: string;
  targetType?: string;
  openInNewTab?: boolean;
}

interface OldImageAsset {
  id?: number;
  desktopImage?: any;
  mobileImage?: any;
  altText?: string;
  caption?: string;
}

interface OldVideoAsset {
  id?: number;
  heroVideo?: any;
  altText?: string;
}

interface OldPromoCard {
  id?: number;
  eyebrowText?: string;
  title?: string;
  description?: string;
  video?: OldVideoAsset;
  image?: OldImageAsset;
  cta?: OldCta;
  steps?: any[];
  isActive?: boolean;
}

// Obsolete homepage link fields to clean up
const obsoleteFields = [
  'categoryNavigation',
  'featuredCollectionSection',
  'featuredProductsSection',
  'sunnyPromiseSection',
  'bespokeForYouCards',
  'showroomSection'
];

// Utility to normalize property names for SQL row columns (camelCase -> snake_case)
function getVal(row: any, fieldName: string): any {
  if (!row) return undefined;
  if (row[fieldName] !== undefined) return row[fieldName];
  const snakeCase = fieldName.replace(/([A-Z])/g, "_$1").toLowerCase();
  if (row[snakeCase] !== undefined) return row[snakeCase];
  return undefined;
}

function extractMediaId(media: any): number | null {
  if (!media) return null;
  if (typeof media === 'number') return media;
  if (typeof media === 'string') return parseInt(media, 10) || null;
  if (media.id && (media.mime || media.url || media.ext || media.provider)) {
    return media.id;
  }
  return null;
}

function mapImageAsset(image: any): any {
  if (!image) return null;
  
  const mediaId = extractMediaId(getVal(image, 'desktopImage'));
  const mobileId = extractMediaId(getVal(image, 'mobileImage'));
  const altText = getVal(image, 'altText');
  const caption = getVal(image, 'caption');

  if (!mediaId && !mobileId && !altText) return null;

  return {
    desktopImage: mediaId,
    mobileImage: mobileId,
    altText: altText || '',
    caption: caption || '',
  };
}

function mapVideoAsset(video: any): any {
  if (!video) return null;
  const mediaId = extractMediaId(getVal(video, 'heroVideo'));
  if (!mediaId) return null;
  return {
    heroVideo: mediaId,
    altText: getVal(video, 'altText') || '',
  };
}

// Map CTA with fallback
function mapCta(cta: any): any {
  if (!cta) return null;
  return {
    label: getVal(cta, 'label') || '',
    url: getVal(cta, 'url') || '',
    targetType: getVal(cta, 'targetType') || 'internal',
    openInNewTab: typeof getVal(cta, 'openInNewTab') === 'boolean' ? getVal(cta, 'openInNewTab') : false,
  };
}

function mapHero(hero: any): any {
  if (!hero) return null;
  const heroVideo = getVal(hero, 'heroVideo');
  const bgImage = getVal(hero, 'bgImage');
  const image = getVal(hero, 'image');
  const primaryCta = getVal(hero, 'primaryCta');
  const isActive = getVal(hero, 'isActive');

  return {
    videoBackground: mapVideoAsset(heroVideo),
    imageBackground: mapImageAsset(bgImage || image),
    eyebrow: getVal(hero, 'eyebrow') || '',
    mainTitle: getVal(hero, 'title') || '',
    ctaButton: mapCta(primaryCta),
    showField: typeof isActive === 'boolean' ? isActive : true,
  };
}

function mapCategoryCards(cards: any[]): any[] {
  if (!Array.isArray(cards)) return [];
  return cards.map((card) => {
    const title = getVal(card, 'title');
    const sortOrder = getVal(card, 'sortOrder');
    const isActive = getVal(card, 'isActive');
    const hoverImage = getVal(card, 'hoverImage');
    const cutoutImage = getVal(card, 'cutoutImage');
    const cta = getVal(card, 'cta');

    return {
      title: title || '',
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      showField: typeof isActive === 'boolean' ? isActive : true,
      hoverImage: mapImageAsset(hoverImage),
      cutoutImage: mapImageAsset(cutoutImage),
      cta: mapCta(cta),
    };
  });
}

function mapDiamondSourcing(section: any): any {
  if (!section) return null;
  const sectionTitle = getVal(section, 'sectionTitle');
  const image = getVal(section, 'image');
  const cutoutImage = getVal(section, 'cutoutImage');
  const bgImage = getVal(section, 'bgImage');
  const isActive = getVal(section, 'isActive');

  const directImageId = extractMediaId(image);
  const gifOrImage = directImageId ? { desktopImage: directImageId, altText: sectionTitle || '' } : null;

  return {
    gifOrImage: gifOrImage || mapImageAsset(image),
    title: sectionTitle || '',
    cutoutImage: mapImageAsset(cutoutImage),
    backgroundImage: mapImageAsset(bgImage),
    showField: typeof isActive === 'boolean' ? isActive : true,
  };
}

function mapFeaturedCollection(section: any): any {
  if (!section) return null;
  const collection = getVal(section, 'collections') || getVal(section, 'collection');

  const collectionDocId = Array.isArray(collection) && collection.length > 0 ? collection[0] : collection;

  return {
    collections: collectionDocId ? { connect: [collectionDocId] } : null,
  };
}

function mapFeaturedProductsCta(cta: any): any {
  if (!cta) return null;
  return {
    label: getVal(cta, 'label') || '',
    targetType: getVal(cta, 'targetType') || 'internal',
    openInNewTab: Boolean(getVal(cta, 'openInNewTab')),
  };
}

function mapOccasionSection(section: any): any {
  if (!section) return null;
  const sectionTitle = getVal(section, 'sectionTitle');
  const isActive = getVal(section, 'isActive');
  const occasions = getVal(section, 'occasions');
  const occasionDocIds = Array.isArray(occasions) ? occasions : [];

  return {
    sectionTitle: sectionTitle || '',
    showField: typeof isActive === 'boolean' ? isActive : true,
    occasions: occasionDocIds.length > 0 ? { connect: occasionDocIds } : null,
  };
}

function mapFeaturedProducts(section: any): any {
  if (!section) return null;
  const sectionTitle = getVal(section, 'sectionTitle');
  const description = getVal(section, 'description');
  const cta = getVal(section, 'cta');
  const isActive = getVal(section, 'isActive');

  return {
    title: sectionTitle || '',
    subtitle: description || '',
    cta: mapFeaturedProductsCta(cta),
    showField: typeof isActive === 'boolean' ? isActive : true,
  };
}

function mapGiftingBanner(banner: any): any {
  if (!banner) return null;
  const title = getVal(banner, 'title');
  const subtitle = getVal(banner, 'subtitle');
  const bgImage = getVal(banner, 'bgImage');
  const backgroundColor = getVal(banner, 'backgroundColor');
  const image = getVal(banner, 'image');
  const primaryCta = getVal(banner, 'primaryCta');
  const secondaryCta = getVal(banner, 'secondaryCta');
  const isActive = getVal(banner, 'isActive');

  return {
    backgroundImage: mapImageAsset(bgImage),
    backgroundColor: backgroundColor || '',
    cutoutImage: mapImageAsset(image),
    title: title || '',
    description: subtitle || '',
    primaryCta: mapCta(primaryCta),
    secondaryCta: mapCta(secondaryCta),
    showField: typeof isActive === 'boolean' ? isActive : true,
  };
}

function mapSunnyPromise(section: any): any {
  if (!section) return null;
  const sectionTitle = getVal(section, 'sectionTitle');
  const video = getVal(section, 'video');
  const description = getVal(section, 'description');
  const cta = getVal(section, 'cta');
  const isActive = getVal(section, 'isActive');

  return {
    title: sectionTitle || '',
    video: mapVideoAsset(video),
    description: description || '',
    cta: mapCta(cta),
    showField: typeof isActive === 'boolean' ? isActive : true,
  };
}

function mapBespokeForYou(cards: OldPromoCard[]): any {
  if (!Array.isArray(cards) || cards.length === 0) return null;
  const mainCard = cards[0];
  const secondCard = cards[1];
  const title = getVal(mainCard, 'title');
  const description = getVal(mainCard, 'description');
  const cta = getVal(mainCard, 'cta');
  const isActive = getVal(mainCard, 'isActive');

  return {
    title: title || '',
    description: description || '',
    primaryCta: mapCta(cta),
    secondaryCta: secondCard ? mapCta(getVal(secondCard, 'cta')) : null,
    showField: typeof isActive === 'boolean' ? isActive : true,
  };
}

function mapDiamondsForEveryone(cards: OldPromoCard[]): any {
  if (!Array.isArray(cards) || cards.length < 2) return null;
  const dCard = cards[1];
  const eyebrowText = getVal(dCard, 'eyebrowText');
  const title = getVal(dCard, 'title');
  const description = getVal(dCard, 'description');
  const cta = getVal(dCard, 'cta');
  const isActive = getVal(dCard, 'isActive');
  const steps = getVal(dCard, 'steps');

  return {
    eyebrow: eyebrowText || '',
    title: title || '',
    subtitle: description || '',
    cta: mapCta(cta),
    showField: typeof isActive === 'boolean' ? isActive : true,
    steps: Array.isArray(steps)
      ? steps.map((step: any) => {
          const stepTitle = getVal(step, 'title');
          const stepLabel = getVal(step, 'label');
          const stepDesc = getVal(step, 'description');
          const stepImg = getVal(step, 'image');

          return {
            label: stepTitle || stepLabel || '',
            description: stepDesc || '',
            image: mapImageAsset(stepImg),
          };
        })
      : [],
  };
}

function mapCraftsmanship(section: any): any {
  if (!section) return null;
  const sectionTitle = getVal(section, 'sectionTitle');
  const description = getVal(section, 'description');
  const sortOrder = getVal(section, 'sortOrder');
  const isActive = getVal(section, 'isActive');
  const cta = getVal(section, 'cta');
  const image = getVal(section, 'image');
  const steps = getVal(section, 'steps');

  return {
    sectionTitle: sectionTitle || '',
    description: description || '',
    sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
    isActive: typeof isActive === 'boolean' ? isActive : true,
    showField: typeof isActive === 'boolean' ? isActive : true,
    cta: mapCta(cta),
    image: mapImageAsset(image),
    steps: Array.isArray(steps)
      ? steps.map((step: any) => {
          const stepTitle = getVal(step, 'title');
          const stepDesc = getVal(step, 'description');
          const stepSort = getVal(step, 'sortOrder');
          const stepActive = getVal(step, 'isActive');
          const stepIcon = getVal(step, 'icon');
          const stepImg = getVal(step, 'image');

          return {
            title: stepTitle || '',
            description: stepDesc || '',
            sortOrder: typeof stepSort === 'number' ? stepSort : 0,
            isActive: typeof stepActive === 'boolean' ? stepActive : true,
            icon: extractMediaId(stepIcon),
            image: mapImageAsset(stepImg),
          };
        })
      : [],
  };
}

function mapShowroom(section: any): any {
  if (!section) return null;
  const sectionTitle = getVal(section, 'sectionTitle');
  const description = getVal(section, 'description');
  const sortOrder = getVal(section, 'sortOrder');
  const isActive = getVal(section, 'isActive');
  const image = getVal(section, 'image');
  const showrooms = getVal(section, 'showrooms');
  const showroomDocIds = Array.isArray(showrooms) ? showrooms : [];

  return {
    sectionTitle: sectionTitle || '',
    description: description || '',
    sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
    isActive: typeof isActive === 'boolean' ? isActive : true,
    showField: typeof isActive === 'boolean' ? isActive : true,
    image: mapImageAsset(image),
    showrooms: showroomDocIds.length > 0 ? { connect: showroomDocIds } : null,
  };
}

function mapSEO(seo: any): any {
  if (!seo) return null;
  const metaTitle = getVal(seo, 'metaTitle');
  const metaDescription = getVal(seo, 'metaDescription');
  const canonicalUrl = getVal(seo, 'canonicalUrl');
  const structuredData = getVal(seo, 'structuredData');
  const ogImage = getVal(seo, 'ogImage');

  return {
    metaTitle: metaTitle || '',
    metaDescription: metaDescription || '',
    canonicalUrl: canonicalUrl || '',
    structuredData: structuredData || null,
    ogImage: extractMediaId(ogImage),
    showField: true,
  };
}

// Database helper functions to fetch components without schema validation
function isFieldRepeatable(parentType: string, fieldName: string): boolean {
  if (parentType === 'shared.process-section' && fieldName === 'steps') return true;
  if (parentType === 'shared.promo-card' && fieldName === 'steps') return true;
  return false;
}

async function findActualRelationTable(strapi: Core.Strapi, tableName: string, fieldName: string): Promise<string | null> {
  const standardName = `${tableName}_${fieldName}_lnk`;
  const hasStandard = await strapi.db.connection.schema.hasTable(standardName);
  if (hasStandard) return standardName;

  // Handles max identifier length truncation and hashing across DB clients.
  if (standardName.length > 60) {
    const client = strapi.db.connection.client.config.client;
    const tableQuery = client === 'pg' || client === 'postgres'
      ? "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
      : 'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE();';

    try {
      const res = await strapi.db.connection.raw(tableQuery);
      const rows = Array.isArray(res) ? res[0] : res?.rows;
      const tableNames = (Array.isArray(rows) ? rows : [])
        .map((row: any) => row.table_name || row.TABLE_NAME || row.name)
        .filter(Boolean);
      const prefix = tableName.substring(0, 30);
      const suffix = `_${fieldName}_lnk`;
      const matched = tableNames.find((t: string) => t.startsWith(prefix) && t.endsWith(suffix));
      if (matched) return matched;
    } catch (error) {
      strapi.log.warn(`Could not inspect relation tables for ${standardName}.`, error);
    }
  }
  return null;
}

async function fetchComponentTree(strapi: Core.Strapi, componentType: string, componentId: number): Promise<any> {
  const normalizedType = componentType.replace(/\./g, '_').replace(/-/g, '_');
  const tableName = `components_${normalizedType}s`;

  // Get primitive fields from component table
  const hasCompTable = await strapi.db.connection.schema.hasTable(tableName);
  if (!hasCompTable) return null;

  const row = await strapi.db.connection(tableName).where({ id: componentId }).first();
  if (!row) return null;

  const result = { ...row };

  // Get nested components link table
  const linkTableName = `${tableName}_cmps`;
  const hasLinkTable = await strapi.db.connection.schema.hasTable(linkTableName);
  if (hasLinkTable) {
    const links = await strapi.db.connection(linkTableName)
      .where({ entity_id: componentId })
      .orderBy('order', 'asc');

    for (const link of links) {
      const childData = await fetchComponentTree(strapi, link.component_type, link.cmp_id);
      if (childData) {
        const field = link.field;
        if (isFieldRepeatable(componentType, field)) {
          if (!result[field]) result[field] = [];
          result[field].push(childData);
        } else {
          result[field] = childData;
        }
      }
    }
  }

  // Get media fields from files_related_mph
  const mediaLinks = await strapi.db.connection('files_related_mph')
    .where({ related_id: componentId, related_type: componentType });
  for (const mediaLink of mediaLinks) {
    const field = mediaLink.field;
    result[field] = mediaLink.file_id;
  }

  // Get relations (like showrooms, occasions, collections)
  const fields = ['showrooms', 'occasions', 'collection'];
  for (const fieldName of fields) {
    const relTable = await findActualRelationTable(strapi, tableName, fieldName);
    if (relTable) {
      const columnsInfo = await strapi.db.connection(relTable).columnInfo();
      const colNames = Object.keys(columnsInfo);
      
      const compIdCol = colNames.find(c => c.endsWith('_id') && !c.includes('showroom_id') && !c.includes('occasion_id') && !c.includes('collection_id')) || 'entity_id';
      const targetCol = colNames.find(c => c !== compIdCol && c !== 'id' && c !== 'order' && c !== 'inv_order');

      if (targetCol) {
        const relRows = await strapi.db.connection(relTable).where({ [compIdCol]: componentId });
        const targetIds = relRows.map(r => r[targetCol]).filter(Boolean);

        if (targetIds.length > 0) {
          let targetTableName = fieldName;
          if (fieldName === 'collection') targetTableName = 'editorial_collections';

          const targetHasTable = await strapi.db.connection.schema.hasTable(targetTableName);
          if (targetHasTable) {
            const targets = await strapi.db.connection(targetTableName).whereIn('id', targetIds);
            result[fieldName] = targets.map(t => t.document_id || t.id).filter(Boolean);
          }
        }
      }
    }
  }

  return result;
}

export async function migrateHomepage(strapi: Core.Strapi) {
  strapi.log.info('Checking for Homepage Content Migration requirement...');

  // 1. One-time Occasions Table Data Migration: Copy is_active -> show_field
  const hasOccasionsTable = await strapi.db.connection.schema.hasTable('occasions');
  if (hasOccasionsTable) {
    const hasIsActive = await strapi.db.connection.schema.hasColumn('occasions', 'is_active');
    const hasShowField = await strapi.db.connection.schema.hasColumn('occasions', 'show_field');
    if (hasIsActive && hasShowField) {
      if (process.env.DRY_RUN === 'true') {
        strapi.log.info('[DRY RUN] Would copy occasions active status to show_field.');
      } else {
        await strapi.db.connection.raw('UPDATE occasions SET show_field = is_active WHERE show_field IS NULL');
        strapi.log.info('Successfully migrated existing Occasions active states to show_field.');
      }
    }
  }

  // 2. Homepage Content Migration
  const homepageRows = await strapi.db.connection('homepages');
  if (!homepageRows || homepageRows.length === 0) {
    strapi.log.warn('Homepage migration skipped: no Homepage rows found in DB.');
    return;
  }

  for (const row of homepageRows) {
    const homepageId = row.id;
    const documentId = row.document_id;
    const isPublished = Boolean(row.published_at);

    // Fetch the list of linked components for this homepage
    const cmpLinks = await strapi.db.connection('homepages_cmps')
      .where({ entity_id: homepageId })
      .orderBy('order', 'asc');

    // Idempotency check: If new fields categoryCards or diamondsForEveryone already exists
    const hasCategoryCards = cmpLinks.some(link => link.field === 'categoryCards');
    const hasDiamondsForEveryone = cmpLinks.some(link => link.field === 'diamondsForEveryone');

    if (hasCategoryCards || hasDiamondsForEveryone) {
      strapi.log.info(`Homepage document ${documentId} (ID: ${homepageId}) already migrated. Skipping.`);
      continue;
    }

    strapi.log.info(`Loading component tree for Homepage ${documentId} (ID: ${homepageId})...`);

    const oldData: Record<string, any> = {};

    for (const link of cmpLinks) {
      const childData = await fetchComponentTree(strapi, link.component_type, link.cmp_id);
      if (childData) {
        const field = link.field;
        const isRepeatable = ['trustBadges', 'categoryNavigation', 'bespokeForYouCards'].includes(field);
        if (isRepeatable) {
          if (!oldData[field]) oldData[field] = [];
          oldData[field].push(childData);
        } else {
          oldData[field] = childData;
        }
      }
    }

    strapi.log.info(`Transforming schemas for Homepage ${documentId}...`);
    const data: Record<string, any> = {};

    if (oldData.seo) data.seo = mapSEO(oldData.seo);
    if (oldData.hero) data.hero = mapHero(oldData.hero);
    if (oldData.trustBadges) {
      data.trustBadges = oldData.trustBadges.map((badge: any) => {
        const badgeLabel = getVal(badge, 'label');
        const badgeSort = getVal(badge, 'sortOrder');
        const badgeActive = getVal(badge, 'isActive');
        return {
          label: badgeLabel || '',
          sortOrder: typeof badgeSort === 'number' ? badgeSort : 0,
          isActive: typeof badgeActive === 'boolean' ? badgeActive : true,
          showField: typeof badgeActive === 'boolean' ? badgeActive : true,
        };
      });
    }
    if (oldData.categoryNavigation) data.categoryCards = mapCategoryCards(oldData.categoryNavigation);
    if (oldData.diamondSourcingSection) data.diamondSourcingSection = mapDiamondSourcing(oldData.diamondSourcingSection);
    if (oldData.featuredCollectionSection) {
      data.featuredCollection = mapFeaturedCollection(oldData.featuredCollectionSection);
    }
    if (oldData.occasionSection) data.occasionSection = mapOccasionSection(oldData.occasionSection);
    if (oldData.featuredProductsSection) data.featuredProducts = mapFeaturedProducts(oldData.featuredProductsSection);
    if (oldData.giftingBanner) data.giftingBanner = mapGiftingBanner(oldData.giftingBanner);
    if (oldData.sunnyPromiseSection) data.sunnyPromise = mapSunnyPromise(oldData.sunnyPromiseSection);
    if (oldData.bespokeForYouCards) {
      data.bespokeForYou = mapBespokeForYou(oldData.bespokeForYouCards);
      data.diamondsForEveryone = mapDiamondsForEveryone(oldData.bespokeForYouCards);
    }
    if (oldData.craftsmanshipSection) data.craftsmanshipSection = mapCraftsmanship(oldData.craftsmanshipSection);
    if (oldData.showroomSection) data.showroom = mapShowroom(oldData.showroomSection);

    try {
      if (process.env.DRY_RUN === 'true') {
        strapi.log.info(`[DRY RUN] Generated migration payload for homepage document ${documentId}:`);
        console.dir(data, { depth: null });
      } else {
        // Execute Update
        await strapi.documents('api::homepage.homepage').update({
          documentId,
          data,
          status: isPublished ? 'published' : 'draft',
        } as any);
        
        // Clean up old obsolete link rows for this homepage in homepages_cmps
        const deletedLinks = await strapi.db.connection('homepages_cmps')
          .where({ entity_id: homepageId })
          .whereIn('field', obsoleteFields)
          .delete();
          
        strapi.log.info(`Successfully migrated Homepage document ${documentId} (ID: ${homepageId}). Cleaned up ${deletedLinks} obsolete component links.`);
      }
    } catch (err: any) {
      strapi.log.error(`Failed to migrate Homepage document ${documentId}: ${err.message}`);
      throw err;
    }
  }
}

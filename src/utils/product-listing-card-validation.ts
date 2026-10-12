import { errors } from '@strapi/utils';
import type { Core } from '@strapi/strapi';

const UID = 'api::product-landing-page.product-landing-page';

export function validateProductListingCardPositions(listingCards: unknown) {
  if (!Array.isArray(listingCards)) return;

  for (const field of ['desktopPosition', 'mobilePosition']) {
    const seen = new Set<number>();
    for (const card of listingCards) {
      const position = card?.[field];
      if (typeof position !== 'number') continue;
      if (seen.has(position)) {
        const label = field === 'desktopPosition' ? 'desktop' : 'mobile';
        throw new errors.ValidationError(
          `Position ${position} already exists.`
        );
      }
      seen.add(position);
    }
  }
}

export function registerProductListingCardValidation(strapi: Core.Strapi) {
  strapi.documents.use(async (context, next) => {
    if (context.uid === UID && ['create', 'update'].includes(context.action)) {
      validateProductListingCardPositions((context.params as any).data?.listingCards);
    }
    return next();
  });
}

import { errors } from '@strapi/utils';

const validateListingCardPositions = (event: any) => {
  const { listingCards } = event.params.data;
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
};

export default {
  beforeCreate: validateListingCardPositions,
  beforeUpdate: validateListingCardPositions,
};

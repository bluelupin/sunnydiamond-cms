import type { Schema, Struct } from '@strapi/strapi';

export interface SharedBrandTaglineSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_brand_tagline_sections';
  info: {
    description: 'Footer brand statement accompanied by a logo mark';
    displayName: 'Brand Tagline Section';
  };
  attributes: {
    icon: Schema.Attribute.Component<'shared.image-asset', false>;
    tagline: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedBrillianceSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_brilliance_sections';
  info: {
    description: 'Pinned/sticky scroll section with feature slides';
    displayName: 'Brilliance Section';
  };
  attributes: {
    featureSlide: Schema.Attribute.Component<'shared.feature-slide', true>;
    pinnedImage: Schema.Attribute.Component<'shared.image-asset', false>;
  };
}

export interface SharedCategoryCard extends Struct.ComponentSchema {
  collectionName: 'components_shared_category_cards';
  info: {
    description: 'Homepage category navigation card';
    displayName: 'Category Card';
  };
  attributes: {
    cta: Schema.Attribute.Component<'shared.cta', false>;
    cutoutImage: Schema.Attribute.Component<'shared.image-asset', false>;
    hoverImage: Schema.Attribute.Component<'shared.image-asset', false>;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedCollectionShowcaseSection
  extends Struct.ComponentSchema {
  collectionName: 'components_shared_collection_showcase_sections';
  info: {
    description: 'Editorial collection showcase with CMS images and commerce references';
    displayName: 'Collection Showcase Section';
  };
  attributes: {
    collection: Schema.Attribute.Relation<
      'oneToOne',
      'api::editorial-collection.editorial-collection'
    >;
    cta: Schema.Attribute.Component<'shared.cta', false>;
    description: Schema.Attribute.Text;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    magentoCollectionRef: Schema.Attribute.String;
    primaryImage: Schema.Attribute.Component<'shared.image-asset', false>;
    secondaryImage: Schema.Attribute.Component<'shared.image-asset', false>;
    sectionTitle: Schema.Attribute.String;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface SharedContentSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_content_sections';
  info: {
    description: 'Reusable editorial content section with optional responsive image and CTA';
    displayName: 'Content Section';
  };
  attributes: {
    body: Schema.Attribute.RichText;
    cta: Schema.Attribute.Component<'shared.cta', false>;
    eyebrow: Schema.Attribute.String;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    layout: Schema.Attribute.Enumeration<
      ['text_only', 'image_left', 'image_right', 'full_bleed']
    > &
      Schema.Attribute.DefaultTo<'text_only'>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    title: Schema.Attribute.String;
  };
}

export interface SharedCraftMosaicSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_craft_mosaic_sections';
  info: {
    description: 'Grid mosaic displaying image layouts and textual elements';
    displayName: 'Craft Mosaic Section';
  };
  attributes: {
    tile: Schema.Attribute.Component<'shared.mosaic-tile', true>;
  };
}

export interface SharedCraftSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_craft_sections';
  info: {
    description: 'Editorial section highlighting craft features with an video-asset option';
    displayName: 'Craft Section';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Component<'shared.image-asset', false>;
    heading: Schema.Attribute.String & Schema.Attribute.Required;
    overlayOpacity: Schema.Attribute.Decimal &
      Schema.Attribute.SetMinMax<
        {
          max: 1;
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<0.5>;
    subheading: Schema.Attribute.String;
    videoUrl: Schema.Attribute.Component<'shared.video-asset', false>;
  };
}

export interface SharedCta extends Struct.ComponentSchema {
  collectionName: 'components_shared_ctas';
  info: {
    description: 'Button or link target';
    displayName: 'CTA';
  };
  attributes: {
    label: Schema.Attribute.String;
    openInNewTab: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    targetType: Schema.Attribute.Enumeration<
      ['internal', 'external', 'magento']
    > &
      Schema.Attribute.DefaultTo<'internal'>;
    url: Schema.Attribute.String;
  };
}

export interface SharedEditorialSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_editorial_sections';
  info: {
    description: 'Editorial wrapper for product or content sections';
    displayName: 'Editorial Section';
  };
  attributes: {
    cta: Schema.Attribute.Component<'shared.cta', false>;
    description: Schema.Attribute.Text;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    sectionTitle: Schema.Attribute.String;
  };
}

export interface SharedFeatureSlide extends Struct.ComponentSchema {
  collectionName: 'components_shared_feature_slides';
  info: {
    description: 'Slide entry for Brilliance Section';
    displayName: 'Feature Slide';
  };
  attributes: {
    body: Schema.Attribute.Text & Schema.Attribute.Required;
    heading: Schema.Attribute.String & Schema.Attribute.Required;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
  };
}

export interface SharedFooterLinkGroup extends Struct.ComponentSchema {
  collectionName: 'components_shared_footer_link_groups';
  info: {
    description: 'Grouped footer links';
    displayName: 'Footer Link Group';
  };
  attributes: {
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    links: Schema.Attribute.Component<'shared.link-item', true>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedHeroSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_hero_sections';
  info: {
    description: 'Page hero content';
    displayName: 'Hero Section';
  };
  attributes: {
    eyebrow: Schema.Attribute.String;
    heroVideo: Schema.Attribute.Component<'shared.video-asset', false>;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    primaryCta: Schema.Attribute.Component<'shared.cta', false>;
    secondaryCta: Schema.Attribute.Component<'shared.cta', false>;
    subtitle: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SharedImageAsset extends Struct.ComponentSchema {
  collectionName: 'components_shared_image_assets';
  info: {
    description: 'Responsive image asset';
    displayName: 'Image Asset';
  };
  attributes: {
    altText: Schema.Attribute.String;
    caption: Schema.Attribute.String;
    desktopImage: Schema.Attribute.Media;
    mobileImage: Schema.Attribute.Media;
  };
}

export interface SharedLegacyImageBlock extends Struct.ComponentSchema {
  collectionName: 'components_shared_legacy_child_blocks';
  info: {
    description: 'Individual block for the legacy section';
    displayName: 'Legacy Image Block';
  };
  attributes: {
    description: Schema.Attribute.RichText & Schema.Attribute.Required;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
  };
}

export interface SharedLegacySection extends Struct.ComponentSchema {
  collectionName: 'components_shared_legacy_sections';
  info: {
    description: 'Legacy gallery with descriptions and images';
    displayName: 'Legacy Section';
  };
  attributes: {
    heading: Schema.Attribute.String & Schema.Attribute.Required;
    legacyImageBlock: Schema.Attribute.Component<
      'shared.legacy-image-block',
      true
    >;
  };
}

export interface SharedLinkItem extends Struct.ComponentSchema {
  collectionName: 'components_shared_link_items';
  info: {
    description: 'Navigation or footer link';
    displayName: 'Link Item';
  };
  attributes: {
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    targetType: Schema.Attribute.Enumeration<
      ['internal', 'external', 'magento']
    > &
      Schema.Attribute.DefaultTo<'internal'>;
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedMosaicTile extends Struct.ComponentSchema {
  collectionName: 'components_shared_mosaic_tiles';
  info: {
    description: 'Individual cell within the craft mosaic grid';
    displayName: 'Mosaic Tile';
  };
  attributes: {
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    title: Schema.Attribute.String;
    type: Schema.Attribute.Enumeration<['image', 'textCard']> &
      Schema.Attribute.DefaultTo<'image'>;
  };
}

export interface SharedOccasionSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_occasion_sections';
  info: {
    description: 'Homepage occasion block with reusable occasion records';
    displayName: 'Occasion Section';
  };
  attributes: {
    cta: Schema.Attribute.Component<'shared.cta', false>;
    description: Schema.Attribute.Text;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    occasions: Schema.Attribute.Relation<'oneToMany', 'api::occasion.occasion'>;
    sectionTitle: Schema.Attribute.String;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface SharedProcessSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_process_sections';
  info: {
    description: 'Editorial process block with repeatable steps';
    displayName: 'Process Section';
  };
  attributes: {
    cta: Schema.Attribute.Component<'shared.cta', false>;
    description: Schema.Attribute.Text;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    sectionTitle: Schema.Attribute.String;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    steps: Schema.Attribute.Component<'shared.process-step', true>;
  };
}

export interface SharedProcessStep extends Struct.ComponentSchema {
  collectionName: 'components_shared_process_steps';
  info: {
    description: 'Craftsmanship or process step';
    displayName: 'Process Step';
  };
  attributes: {
    description: Schema.Attribute.Text;
    icon: Schema.Attribute.Media;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedPromoCard extends Struct.ComponentSchema {
  collectionName: 'components_shared_promo_cards';
  info: {
    description: 'Editorial promotional card';
    displayName: 'Promo Card';
  };
  attributes: {
    cta: Schema.Attribute.Component<'shared.cta', false>;
    description: Schema.Attribute.Text;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: 'Search and social metadata';
    displayName: 'SEO';
  };
  attributes: {
    canonicalUrl: Schema.Attribute.String;
    metaDescription: Schema.Attribute.Text;
    metaKeywords: Schema.Attribute.String;
    metaTitle: Schema.Attribute.String;
    ogImage: Schema.Attribute.Media;
    structuredData: Schema.Attribute.JSON;
  };
}

export interface SharedShowroomSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_showroom_sections';
  info: {
    description: 'Homepage showroom block with reusable showroom records';
    displayName: 'Showroom Section';
  };
  attributes: {
    cta: Schema.Attribute.Component<'shared.cta', false>;
    description: Schema.Attribute.Text;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    sectionTitle: Schema.Attribute.String;
    showrooms: Schema.Attribute.Relation<'oneToMany', 'api::showroom.showroom'>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface SharedTeamMember extends Struct.ComponentSchema {
  collectionName: 'components_shared_team_members';
  info: {
    description: 'Profile card details for a team member';
    displayName: 'Team Member';
  };
  attributes: {
    bio: Schema.Attribute.Text;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    role: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedTeamSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_team_sections';
  info: {
    description: 'Displays team members in grid, list, or carousel layouts';
    displayName: 'Team Section';
  };
  attributes: {
    displayStyle: Schema.Attribute.Enumeration<['grid', 'list', 'carousel']> &
      Schema.Attribute.DefaultTo<'grid'>;
    heading: Schema.Attribute.String & Schema.Attribute.Required;
    subheading: Schema.Attribute.Text;
    teamMember: Schema.Attribute.Component<'shared.team-member', true>;
  };
}

export interface SharedTimelineMilestone extends Struct.ComponentSchema {
  collectionName: 'components_shared_timeline_milestones';
  info: {
    description: 'Key milestone event card';
    displayName: 'Timeline Milestone';
  };
  attributes: {
    body: Schema.Attribute.Text & Schema.Attribute.Required;
    heading: Schema.Attribute.String & Schema.Attribute.Required;
    icon: Schema.Attribute.Component<'shared.image-asset', false>;
    year: Schema.Attribute.Integer & Schema.Attribute.Required;
  };
}

export interface SharedTimelineSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_timeline_sections';
  info: {
    description: 'Historical context milestone engine';
    displayName: 'Timeline Section';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Component<'shared.image-asset', false>;
    timelineMilestone: Schema.Attribute.Component<
      'shared.timeline-milestone',
      true
    >;
  };
}

export interface SharedTrustBadge extends Struct.ComponentSchema {
  collectionName: 'components_shared_trust_badges';
  info: {
    description: 'Homepage trust strip item';
    displayName: 'Trust Badge';
  };
  attributes: {
    icon: Schema.Attribute.Media;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface SharedTrustBadgeItem extends Struct.ComponentSchema {
  collectionName: 'components_shared_trust_badge_items';
  info: {
    description: 'Individual badge block';
    displayName: 'Trust Badge Item';
  };
  attributes: {
    icon: Schema.Attribute.Component<'shared.image-asset', false>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedTrustBadgesSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_trust_badges_sections';
  info: {
    description: 'Grid panel of certificates, badges or security icons';
    displayName: 'Trust Badges Section';
  };
  attributes: {
    trustBadge: Schema.Attribute.Component<'shared.trust-badge-item', true>;
  };
}

export interface SharedVideoAsset extends Struct.ComponentSchema {
  collectionName: 'components_shared_video_assets';
  info: {
    description: 'Video component with fallback alternative text';
    displayName: 'Video Asset';
  };
  attributes: {
    altText: Schema.Attribute.String;
    heroVideo: Schema.Attribute.Media<'videos'>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'shared.brand-tagline-section': SharedBrandTaglineSection;
      'shared.brilliance-section': SharedBrillianceSection;
      'shared.category-card': SharedCategoryCard;
      'shared.collection-showcase-section': SharedCollectionShowcaseSection;
      'shared.content-section': SharedContentSection;
      'shared.craft-mosaic-section': SharedCraftMosaicSection;
      'shared.craft-section': SharedCraftSection;
      'shared.cta': SharedCta;
      'shared.editorial-section': SharedEditorialSection;
      'shared.feature-slide': SharedFeatureSlide;
      'shared.footer-link-group': SharedFooterLinkGroup;
      'shared.hero-section': SharedHeroSection;
      'shared.image-asset': SharedImageAsset;
      'shared.legacy-image-block': SharedLegacyImageBlock;
      'shared.legacy-section': SharedLegacySection;
      'shared.link-item': SharedLinkItem;
      'shared.mosaic-tile': SharedMosaicTile;
      'shared.occasion-section': SharedOccasionSection;
      'shared.process-section': SharedProcessSection;
      'shared.process-step': SharedProcessStep;
      'shared.promo-card': SharedPromoCard;
      'shared.seo': SharedSeo;
      'shared.showroom-section': SharedShowroomSection;
      'shared.team-member': SharedTeamMember;
      'shared.team-section': SharedTeamSection;
      'shared.timeline-milestone': SharedTimelineMilestone;
      'shared.timeline-section': SharedTimelineSection;
      'shared.trust-badge': SharedTrustBadge;
      'shared.trust-badge-item': SharedTrustBadgeItem;
      'shared.trust-badges-section': SharedTrustBadgesSection;
      'shared.video-asset': SharedVideoAsset;
    }
  }
}

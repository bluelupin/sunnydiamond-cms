import type { Schema, Struct } from '@strapi/strapi';

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
    desktopImage: Schema.Attribute.Media;
    mobileImage: Schema.Attribute.Media;
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
    metaTitle: Schema.Attribute.String;
    ogImage: Schema.Attribute.Media;
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

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'shared.category-card': SharedCategoryCard;
      'shared.collection-showcase-section': SharedCollectionShowcaseSection;
      'shared.content-section': SharedContentSection;
      'shared.cta': SharedCta;
      'shared.editorial-section': SharedEditorialSection;
      'shared.footer-link-group': SharedFooterLinkGroup;
      'shared.hero-section': SharedHeroSection;
      'shared.image-asset': SharedImageAsset;
      'shared.link-item': SharedLinkItem;
      'shared.occasion-section': SharedOccasionSection;
      'shared.process-section': SharedProcessSection;
      'shared.process-step': SharedProcessStep;
      'shared.promo-card': SharedPromoCard;
      'shared.seo': SharedSeo;
      'shared.showroom-section': SharedShowroomSection;
      'shared.trust-badge': SharedTrustBadge;
    }
  }
}

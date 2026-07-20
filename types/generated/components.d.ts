import type { Schema, Struct } from '@strapi/strapi';

export interface SharedBespokeForYouSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_bespoke_for_you_sections';
  info: {
    description: 'Bespoke For You Section with Title, Description, Primary CTA, and Secondary CTA';
    displayName: 'Bespoke For You Section';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Component<'shared.image-asset', false>;
    description: Schema.Attribute.Text;
    primaryCta: Schema.Attribute.Component<'shared.cta', false>;
    secondaryCta: Schema.Attribute.Component<'shared.cta', false>;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    title: Schema.Attribute.String;
  };
}

export interface SharedBespokeGetInTouchSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_bespoke_get_in_touch_sections';
  info: {
    description: 'Bottom consultation call-to-action banner';
    displayName: 'Bespoke Get In Touch Section';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Component<'shared.image-asset', false> &
      Schema.Attribute.Required;
    cta: Schema.Attribute.Component<'shared.cta', false> &
      Schema.Attribute.Required;
    description: Schema.Attribute.Text;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedBespokeHero extends Struct.ComponentSchema {
  collectionName: 'components_shared_bespoke_heroes';
  info: {
    description: 'Bespoke Jewellery page hero';
    displayName: 'Bespoke Hero';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Component<'shared.image-asset', false> &
      Schema.Attribute.Required;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedBespokeServiceHighlight extends Struct.ComponentSchema {
  collectionName: 'components_shared_bespoke_service_highlights';
  info: {
    description: 'Icon and label shown below Featured Stories';
    displayName: 'Bespoke Service Highlight';
  };
  attributes: {
    icon: Schema.Attribute.Media<'images'>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface SharedBespokeVisionCard extends Struct.ComponentSchema {
  collectionName: 'components_shared_bespoke_vision_cards';
  info: {
    description: 'Image or video story card in the vision carousel';
    displayName: 'Bespoke Vision Card';
  };
  attributes: {
    description: Schema.Attribute.Text;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    stepLabel: Schema.Attribute.String & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    video: Schema.Attribute.Component<'shared.video-asset', false>;
  };
}

export interface SharedBespokeVisionSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_bespoke_vision_sections';
  info: {
    description: 'Designed around your story introduction and vision cards';
    displayName: 'Bespoke Vision Section';
  };
  attributes: {
    cards: Schema.Attribute.Component<'shared.bespoke-vision-card', true> &
      Schema.Attribute.Required;
    cta: Schema.Attribute.Component<'shared.cta', false>;
    description: Schema.Attribute.Text;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

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

export interface SharedCInfoPanel extends Struct.ComponentSchema {
  collectionName: 'components_shared_c_info_panel_subs';
  info: {
    description: 'Right side metrics copy and editorial dynamic callouts';
    displayName: 'C Info Panel';
  };
  attributes: {
    activeGradeCode: Schema.Attribute.String;
    activeGradeFullName: Schema.Attribute.String;
    brandNote: Schema.Attribute.String;
    description: Schema.Attribute.Text;
    displayTag: Schema.Attribute.String;
    sectionLabel: Schema.Attribute.String;
  };
}

export interface SharedCVisualPanel extends Struct.ComponentSchema {
  collectionName: 'components_shared_c_visual_panel_subs';
  info: {
    description: 'Left panel layout containing images and interactive slider stop points';
    displayName: 'C Visual Panel';
  };
  attributes: {
    gradeStops: Schema.Attribute.Component<'shared.grade-stop', true>;
    subTitle: Schema.Attribute.Text;
    visualImage: Schema.Attribute.Component<'shared.image-asset', false>;
  };
}

export interface SharedCarouselImage extends Struct.ComponentSchema {
  collectionName: 'components_shared_carousel_images';
  info: {
    displayName: 'Carousel Image';
  };
  attributes: {
    ctaButton: Schema.Attribute.Component<'shared.cta', false>;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
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
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedCertLabCard extends Struct.ComponentSchema {
  collectionName: 'components_shared_cert_lab_card_subs';
  info: {
    description: 'Individual grading laboratory information block';
    displayName: 'Cert Lab Card';
  };
  attributes: {
    ctaButtonLabel: Schema.Attribute.String;
    ctaButtonUrl: Schema.Attribute.String;
    labDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    labLogo: Schema.Attribute.Component<'shared.image-asset', false>;
    labName: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedCertificateSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_certificate_section_roots';
  info: {
    description: 'Trust validation panel displaying analytical verification institutes';
    displayName: 'Certificate Section';
  };
  attributes: {
    bgImage: Schema.Attribute.Component<'shared.image-asset', false>;
    certificationLabs: Schema.Attribute.Component<'shared.cert-lab-card', true>;
    cutoutImage: Schema.Attribute.Component<'shared.image-asset', false>;
    sectionDescription: Schema.Attribute.RichText;
    sectionHeading: Schema.Attribute.String & Schema.Attribute.Required;
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
    magentoCollectionRef: Schema.Attribute.String;
    primaryImage: Schema.Attribute.Component<'shared.image-asset', false>;
    sectionTitle: Schema.Attribute.String;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
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

export interface SharedCraftingBrillianceSection
  extends Struct.ComponentSchema {
  collectionName: 'components_shared_crafting_brilliances';
  info: {
    description: 'Crafting Brilliance Section with background, cutout image, title, and CTA';
    displayName: 'Crafting Brilliance Section';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Component<'shared.image-asset', false>;
    cta: Schema.Attribute.Component<'shared.cta', false>;
    cutoutImage: Schema.Attribute.Component<'shared.image-asset', false>;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
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

export interface SharedCtaBanner extends Struct.ComponentSchema {
  collectionName: 'components_shared_cta_banner_roots';
  info: {
    description: 'Action banner with deep call to action redirection';
    displayName: 'CTA Banner';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Component<'shared.image-asset', false>;
    ctaButtonLabel: Schema.Attribute.String & Schema.Attribute.Required;
    ctaButtonUrl: Schema.Attribute.String & Schema.Attribute.Required;
    heading: Schema.Attribute.String & Schema.Attribute.Required;
    steps: Schema.Attribute.Component<'shared.process-step', true>;
    subheading: Schema.Attribute.String;
  };
}

export interface SharedDiamondSourcingSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_diamond_sourcings';
  info: {
    description: 'Diamond Sourcing Section with GIF/Image, title, cutout, and background';
    displayName: 'Diamond Sourcing Section';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Component<'shared.image-asset', false>;
    cutoutImage: Schema.Attribute.Component<'shared.image-asset', false>;
    gifOrImage: Schema.Attribute.Component<'shared.image-asset', false>;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    title: Schema.Attribute.String;
  };
}

export interface SharedDiamondsForEveryoneSection
  extends Struct.ComponentSchema {
  collectionName: 'components_shared_diamonds_for_everyones';
  info: {
    description: 'Diamonds for Everyone Section with eyebrow, title, subtitle, repeatable steps, and CTA';
    displayName: 'Diamonds for Everyone Section';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Component<'shared.image-asset', false>;
    cta: Schema.Attribute.Component<'shared.cta', false>;
    eyebrow: Schema.Attribute.String;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    steps: Schema.Attribute.Component<'shared.diamonds-step', true>;
    subtitle: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface SharedDiamondsStep extends Struct.ComponentSchema {
  collectionName: 'components_shared_diamonds_steps';
  info: {
    description: 'Helper component for repeatable step list in Diamonds 4 Everyone';
    displayName: 'Diamonds Step';
  };
  attributes: {
    description: Schema.Attribute.Text;
    label: Schema.Attribute.String;
  };
}

export interface SharedDropdownOption extends Struct.ComponentSchema {
  collectionName: 'components_shared_dropdown_options';
  info: {
    description: 'A single select option for dropdown fields';
    displayName: 'Dropdown Option';
  };
  attributes: {
    optionValue: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedEditorialSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_editorial_sections';
  info: {
    description: 'Editorial wrapper for product or content sections';
    displayName: 'Editorial Section';
  };
  attributes: {
    bgImage: Schema.Attribute.Component<'shared.image-asset', false>;
    cta: Schema.Attribute.Component<'shared.cta', false>;
    cutoutImage: Schema.Attribute.Component<'shared.image-asset', false>;
    description: Schema.Attribute.Text;
    image: Schema.Attribute.Media<'images'>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    sectionTitle: Schema.Attribute.String;
    video: Schema.Attribute.Component<'shared.video-asset', false>;
  };
}

export interface SharedFaqItem extends Struct.ComponentSchema {
  collectionName: 'components_shared_faq_item_subs';
  info: {
    description: 'Accordion raw data entry mapping structural answers';
    displayName: 'FAQ Item';
  };
  attributes: {
    answer: Schema.Attribute.RichText & Schema.Attribute.Required;
    question: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedFaqSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_faq_section_roots';
  info: {
    description: 'Collapsible Accordion layout answering buyer questions';
    displayName: 'FAQ Section';
  };
  attributes: {
    faqItems: Schema.Attribute.Component<'shared.faq-item', true>;
    sectionHeading: Schema.Attribute.String & Schema.Attribute.Required;
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

export interface SharedFeaturedProductsSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_featured_products_sections';
  info: {
    description: 'Featured Products Section with Title, Subtitle, and CTA';
    displayName: 'Featured Products Section';
  };
  attributes: {
    cta: Schema.Attribute.Component<'shared.cta', false>;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    subtitle: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface SharedFeaturedStoriesSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_featured_stories_sections';
  info: {
    description: 'Editorial story cards over a background image';
    displayName: 'Featured Stories Section';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Component<'shared.image-asset', false>;
    cards: Schema.Attribute.Relation<
      'manyToMany',
      'api::featured-story.featured-story'
    >;
    cta: Schema.Attribute.Component<'shared.cta', false>;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedFeaturedStoryCard extends Struct.ComponentSchema {
  collectionName: 'components_shared_featured_story_cards';
  info: {
    description: 'Image card in the Featured Stories section';
    displayName: 'Featured Story Card';
  };
  attributes: {
    cta: Schema.Attribute.Component<'shared.cta', false>;
    image: Schema.Attribute.Component<'shared.image-asset', false> &
      Schema.Attribute.Required;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    title: Schema.Attribute.String;
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

export interface SharedFooterTickerItem extends Struct.ComponentSchema {
  collectionName: 'components_shared_footer_ticker_items';
  info: {
    description: 'Short trust or service message shown in the footer ticker';
    displayName: 'Footer Ticker Item';
  };
  attributes: {
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface SharedFormField extends Struct.ComponentSchema {
  collectionName: 'components_shared_form_fields';
  info: {
    description: 'Dynamic inputs for the frontend to render';
    displayName: 'Form Field';
  };
  attributes: {
    dropdownOptions: Schema.Attribute.Component<'shared.dropdown-option', true>;
    fieldType: Schema.Attribute.Enumeration<
      ['text', 'email', 'phone', 'date', 'dropdown', 'textarea']
    > &
      Schema.Attribute.DefaultTo<'text'>;
    formStep: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<1>;
    isRequired: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
    placeholder: Schema.Attribute.String;
  };
}

export interface SharedFourCsSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_four_cs_section_roots';
  info: {
    description: 'Interactive layout featuring left visual panels and right information tracks';
    displayName: 'Four Cs Section';
  };
  attributes: {
    cInfoPanel: Schema.Attribute.Component<'shared.c-info-panel', true>;
    cVisualPanel: Schema.Attribute.Component<'shared.c-visual-panel', true>;
  };
}

export interface SharedGiftingBanner extends Struct.ComponentSchema {
  collectionName: 'components_shared_gifting_banners';
  info: {
    description: 'Gifting banner with background, cutout image, title, description, and primary/secondary CTAs';
    displayName: 'Gifting Banner';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Component<'shared.image-asset', false>;
    cutoutImage: Schema.Attribute.Component<'shared.image-asset', false>;
    description: Schema.Attribute.Text;
    primaryCta: Schema.Attribute.Component<'shared.cta', false>;
    secondaryCta: Schema.Attribute.Component<'shared.cta', false>;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    title: Schema.Attribute.String;
  };
}

export interface SharedGradeStop extends Struct.ComponentSchema {
  collectionName: 'components_shared_grade_stop_nodes';
  info: {
    description: 'Specific slider metrics coordinates for diamond scales';
    displayName: 'Grade Stop';
  };
  attributes: {
    gradeCode: Schema.Attribute.String;
    gradeImage: Schema.Attribute.Component<'shared.image-asset', false>;
    gradeLongLabel: Schema.Attribute.String;
  };
}

export interface SharedHeroSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_hero_sections';
  info: {
    description: 'Page hero content';
    displayName: 'Hero Section';
  };
  attributes: {
    bgImage: Schema.Attribute.Component<'shared.image-asset', false>;
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

export interface SharedHomepageHero extends Struct.ComponentSchema {
  collectionName: 'components_shared_homepage_heroes';
  info: {
    description: 'Hero section with video, image background, eyebrow, main title, and cta button';
    displayName: 'Homepage Hero';
  };
  attributes: {
    ctaButton: Schema.Attribute.Component<'shared.cta', false>;
    eyebrow: Schema.Attribute.String;
    imageBackground: Schema.Attribute.Component<'shared.image-asset', false>;
    mainTitle: Schema.Attribute.String;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    videoBackground: Schema.Attribute.Component<'shared.video-asset', false>;
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
    desktopImage: Schema.Attribute.Media<'images'>;
    mobileImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedIndianState extends Struct.ComponentSchema {
  collectionName: 'components_shared_indian_states';
  info: {
    displayName: 'Indian State';
    icon: 'map-marker';
  };
  attributes: {
    code: Schema.Attribute.String;
    name: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedInfoCard extends Struct.ComponentSchema {
  collectionName: 'components_shared_info_cards';
  info: {
    description: 'Title, subtitle, optional image and form trigger buttons';
    displayName: 'Info Card';
  };
  attributes: {
    buttons: Schema.Attribute.Component<'shared.modal-cta', true>;
    image: Schema.Attribute.Media<'images'>;
    subtitle: Schema.Attribute.String;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedLearnMoreSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_learn_more_section_roots';
  info: {
    description: 'Multi-tab modular container explaining technical elements';
    displayName: 'Learn More Section';
  };
  attributes: {
    sectionHeading: Schema.Attribute.String & Schema.Attribute.Required;
    tabs: Schema.Attribute.Component<'shared.learn-more-tab', true>;
  };
}

export interface SharedLearnMoreTab extends Struct.ComponentSchema {
  collectionName: 'components_shared_learn_more_tab_subs';
  info: {
    description: 'Individual contextual tab details with item carousels';
    displayName: 'Learn More Tab';
  };
  attributes: {
    carouselImage: Schema.Attribute.Component<'shared.carousel-image', true>;
    featureImage: Schema.Attribute.Component<'shared.image-asset', false>;
    featureItems: Schema.Attribute.Component<'shared.trust-badge-item', true>;
    featureSubtitle: Schema.Attribute.Text;
    layoutType: Schema.Attribute.Enumeration<
      ['Carousel', 'Image Feature List', 'Feature List']
    >;
    tabDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    tabLabel: Schema.Attribute.Enumeration<
      ['SHAPE', 'FANCY_COLOUR', 'DIAMOND_ANATOMY', 'DIAMOND_CARE']
    > &
      Schema.Attribute.DefaultTo<'SHAPE'>;
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

export interface SharedModalCta extends Struct.ComponentSchema {
  collectionName: 'components_shared_form_ctas';
  info: {
    description: 'Button or link that triggers a form modal';
    displayName: 'Modal CTA';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
    modalTag: Schema.Attribute.String & Schema.Attribute.Required;
    style: Schema.Attribute.Enumeration<['primary', 'link']> &
      Schema.Attribute.DefaultTo<'primary'>;
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
    occasions: Schema.Attribute.Relation<'oneToMany', 'api::occasion.occasion'>;
    sectionTitle: Schema.Attribute.String;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
  };
}

export interface SharedPageIntro extends Struct.ComponentSchema {
  collectionName: 'components_shared_page_intro_roots';
  info: {
    description: 'Intro heading, body description, and decorative asset';
    displayName: 'Page Intro';
  };
  attributes: {
    body: Schema.Attribute.RichText & Schema.Attribute.Required;
    decorativeImage: Schema.Attribute.Component<'shared.image-asset', false>;
    fourCsTags: Schema.Attribute.Component<'shared.trust-badge', true>;
    heading: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedProcessSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_process_sections';
  info: {
    description: 'Editorial process block with repeatable steps';
    displayName: 'Process Section';
  };
  attributes: {
    backgroundImage: Schema.Attribute.Component<'shared.image-asset', false>;
    cta: Schema.Attribute.Component<'shared.cta', false>;
    description: Schema.Attribute.Text;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    sectionTitle: Schema.Attribute.String;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
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
    eyebrowText: Schema.Attribute.String;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
    steps: Schema.Attribute.Component<'shared.process-step', true>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    video: Schema.Attribute.Component<'shared.video-asset', false>;
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
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
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
    formCta: Schema.Attribute.Component<'shared.modal-cta', false>;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    sectionTitle: Schema.Attribute.String;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    showrooms: Schema.Attribute.Relation<'oneToMany', 'api::showroom.showroom'>;
    sortOrder: Schema.Attribute.Integer & Schema.Attribute.DefaultTo<0>;
  };
}

export interface SharedSizeRow extends Struct.ComponentSchema {
  collectionName: 'components_shared_size_rows';
  info: {
    displayName: 'Size Row';
    icon: 'align-justify';
  };
  attributes: {
    circumference: Schema.Attribute.String;
    diameter: Schema.Attribute.String;
    sizeLabel: Schema.Attribute.String;
  };
}

export interface SharedSunnyPromiseSection extends Struct.ComponentSchema {
  collectionName: 'components_shared_sunny_promise_sections';
  info: {
    description: 'Sunny Promise Section with Title, Video, Description, and CTA';
    displayName: 'Sunny Promise Section';
  };
  attributes: {
    cta: Schema.Attribute.Component<'shared.cta', false>;
    description: Schema.Attribute.Text;
    image: Schema.Attribute.Component<'shared.image-asset', false>;
    isVideo: Schema.Attribute.Boolean;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    title: Schema.Attribute.String;
    video: Schema.Attribute.Component<'shared.video-asset', false>;
  };
}

export interface SharedTag extends Struct.ComponentSchema {
  collectionName: 'components_shared_tags';
  info: {
    displayName: 'Tag';
    icon: 'tag';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
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

export interface SharedTimeSlot extends Struct.ComponentSchema {
  collectionName: 'components_shared_time_slots';
  info: {
    displayName: 'Time Slot';
  };
  attributes: {
    timeString: Schema.Attribute.String & Schema.Attribute.Required;
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
    label: Schema.Attribute.String & Schema.Attribute.Required;
    showField: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
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
      'shared.bespoke-for-you-section': SharedBespokeForYouSection;
      'shared.bespoke-get-in-touch-section': SharedBespokeGetInTouchSection;
      'shared.bespoke-hero': SharedBespokeHero;
      'shared.bespoke-service-highlight': SharedBespokeServiceHighlight;
      'shared.bespoke-vision-card': SharedBespokeVisionCard;
      'shared.bespoke-vision-section': SharedBespokeVisionSection;
      'shared.brand-tagline-section': SharedBrandTaglineSection;
      'shared.brilliance-section': SharedBrillianceSection;
      'shared.c-info-panel': SharedCInfoPanel;
      'shared.c-visual-panel': SharedCVisualPanel;
      'shared.carousel-image': SharedCarouselImage;
      'shared.category-card': SharedCategoryCard;
      'shared.cert-lab-card': SharedCertLabCard;
      'shared.certificate-section': SharedCertificateSection;
      'shared.collection-showcase-section': SharedCollectionShowcaseSection;
      'shared.content-section': SharedContentSection;
      'shared.craft-mosaic-section': SharedCraftMosaicSection;
      'shared.craft-section': SharedCraftSection;
      'shared.crafting-brilliance-section': SharedCraftingBrillianceSection;
      'shared.cta': SharedCta;
      'shared.cta-banner': SharedCtaBanner;
      'shared.diamond-sourcing-section': SharedDiamondSourcingSection;
      'shared.diamonds-for-everyone-section': SharedDiamondsForEveryoneSection;
      'shared.diamonds-step': SharedDiamondsStep;
      'shared.dropdown-option': SharedDropdownOption;
      'shared.editorial-section': SharedEditorialSection;
      'shared.faq-item': SharedFaqItem;
      'shared.faq-section': SharedFaqSection;
      'shared.feature-slide': SharedFeatureSlide;
      'shared.featured-products-section': SharedFeaturedProductsSection;
      'shared.featured-stories-section': SharedFeaturedStoriesSection;
      'shared.featured-story-card': SharedFeaturedStoryCard;
      'shared.footer-link-group': SharedFooterLinkGroup;
      'shared.footer-ticker-item': SharedFooterTickerItem;
      'shared.form-field': SharedFormField;
      'shared.four-cs-section': SharedFourCsSection;
      'shared.gifting-banner': SharedGiftingBanner;
      'shared.grade-stop': SharedGradeStop;
      'shared.hero-section': SharedHeroSection;
      'shared.homepage-hero': SharedHomepageHero;
      'shared.image-asset': SharedImageAsset;
      'shared.indian-state': SharedIndianState;
      'shared.info-card': SharedInfoCard;
      'shared.learn-more-section': SharedLearnMoreSection;
      'shared.learn-more-tab': SharedLearnMoreTab;
      'shared.legacy-image-block': SharedLegacyImageBlock;
      'shared.legacy-section': SharedLegacySection;
      'shared.link-item': SharedLinkItem;
      'shared.modal-cta': SharedModalCta;
      'shared.mosaic-tile': SharedMosaicTile;
      'shared.occasion-section': SharedOccasionSection;
      'shared.page-intro': SharedPageIntro;
      'shared.process-section': SharedProcessSection;
      'shared.process-step': SharedProcessStep;
      'shared.promo-card': SharedPromoCard;
      'shared.seo': SharedSeo;
      'shared.showroom-section': SharedShowroomSection;
      'shared.size-row': SharedSizeRow;
      'shared.sunny-promise-section': SharedSunnyPromiseSection;
      'shared.tag': SharedTag;
      'shared.team-member': SharedTeamMember;
      'shared.team-section': SharedTeamSection;
      'shared.time-slot': SharedTimeSlot;
      'shared.timeline-milestone': SharedTimelineMilestone;
      'shared.timeline-section': SharedTimelineSection;
      'shared.trust-badge': SharedTrustBadge;
      'shared.trust-badge-item': SharedTrustBadgeItem;
      'shared.trust-badges-section': SharedTrustBadgesSection;
      'shared.video-asset': SharedVideoAsset;
    }
  }
}

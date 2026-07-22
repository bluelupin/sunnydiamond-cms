import type { Core } from '@strapi/strapi';
import crypto from 'crypto';

const seedHash = (data: Record<string, unknown>) =>
  crypto
    .createHash('sha256')
    .update(JSON.stringify(data, (key, value) => (key === 'publishedAt' ? '__published_at__' : value)))
    .digest('hex');

const publicReadActions = [
  'api::about-page.about-page.find',
  'api::learn-about-diamonds-page.learn-about-diamonds-page.find',
  'api::contact-bespoke-page.contact-bespoke-page.find',
  'api::share-your-vision-page.share-your-vision-page.find',
  'api::featured-story.featured-story.find',
  'api::featured-story.featured-story.findOne',
  'api::design-story.design-story.find',
  'api::design-story.design-story.findOne',
  'api::gallery.gallery.find',
  'api::gallery.gallery.findOne',
  'api::global-config.global-config.find',
  'api::homepage.homepage.find',
  'api::homepage.homepage.shell',
  'api::homepage.homepage.sections',
  'api::homepage.homepage.shoppingBlocks',
  'api::homepage.homepage.editorialBlocks',
  'api::generic-form.generic-form.find',
  'api::generic-form.generic-form.findOne',
  'api::product-form.product-form.find',
  'api::product-form.product-form.findOne',
  'api::showroom.showroom.find',
  'api::showroom.showroom.findOne',
  'api::occasion.occasion.find',
  'api::occasion.occasion.findOne',
  'api::editorial-collection.editorial-collection.find',
  'api::editorial-collection.editorial-collection.findOne',
  'api::legal-page.legal-page.find',
  'api::legal-page.legal-page.findOne',
  'api::service-page.service-page.find',
  'api::service-page.service-page.findOne',
  'api::support-page.support-page.find',
  'api::support-page.support-page.findOne',
  'api::category-landing.category-landing.find',
  'api::category-landing.category-landing.findOne',
  'api::blog-post.blog-post.find',
  'api::blog-post.blog-post.findOne',
  'api::news-article.news-article.find',
  'api::news-article.news-article.findOne',
];

export async function seedCms(strapi: Core.Strapi) {
  strapi.log.info('Starting Strapi CMS programmatic seeding process...');

  try {
    const countExistingRows = (uid: string) => strapi.db.query(uid as any).count({});
    const seedStore = strapi.store({ type: 'plugin', name: 'sunny-cms-seeder' });
    const seedOnly = process.env.CMS_SEED_ONLY
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const shouldSeed = (uid: string, label: string) => {
      if (!seedOnly || seedOnly.length === 0) {
        return true;
      }

      return seedOnly.includes(uid) || seedOnly.includes(label);
    };

    const seedSingleType = async (uid: string, label: string, data: Record<string, unknown>) => {
      if (!shouldSeed(uid, label)) {
        return;
      }

      const count = await countExistingRows(uid);
      const hashKey = `${uid}:hash`;
      const nextHash = seedHash(data);
      const currentHash = await seedStore.get({ key: hashKey });

      if (count === 0) {
        strapi.log.info(`Seeding ${label}...`);
        await strapi.documents(uid as any).create({ data, status: 'published' } as any);
        await seedStore.set({ key: hashKey, value: nextHash });
        strapi.log.info(`${label} successfully seeded.`);
        return;
      }

      if (currentHash === nextHash) {
        strapi.log.info(`${label} seed unchanged. Skipping.`);
        return;
      }

      strapi.log.info(`${label} already exists and seed changed. Skipping to preserve CMS content.`);
    };
    const seedCollectionByField = async (
      uid: string,
      label: string,
      uniqueField: string,
      records: Record<string, unknown>[]
    ) => {
      if (!shouldSeed(uid, label)) {
        return;
      }

      for (const record of records) {
        const uniqueValue = record[uniqueField];
        if (!uniqueValue) {
          strapi.log.warn(`${label} seed record missing ${uniqueField}. Skipping.`);
          continue;
        }

        const existing = await strapi.documents(uid as any).findFirst({
          filters: { [uniqueField]: uniqueValue },
        } as any);

        const hashKey = `${uid}:${uniqueValue}:hash`;
        const nextHash = seedHash(record);
        const currentHash = await seedStore.get({ key: hashKey });

        if (!existing) {
          await strapi.documents(uid as any).create({ data: record, status: 'published' } as any);
          await seedStore.set({ key: hashKey, value: nextHash });
          strapi.log.info(`Seeded ${label}: ${uniqueValue}.`);
          continue;
        }

        if (currentHash === nextHash) {
          strapi.log.info(`${label} ${uniqueValue} seed unchanged. Skipping.`);
          continue;
        }

        strapi.log.info(`${label} ${uniqueValue} already exists and seed changed. Skipping to preserve CMS content.`);
      }
    };
    const ensurePublicReadPermissions = async () => {
      const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type: 'public' },
        populate: ['permissions'],
      } as any);

      if (!publicRole) {
        strapi.log.warn('Public role not found. Skipping public read permission seeding.');
        return;
      }

      const existingActions = new Set((publicRole.permissions ?? []).map((permission: any) => permission.action));
      const missingActions = publicReadActions.filter((action) => !existingActions.has(action));

      if (missingActions.length === 0) {
        strapi.log.info('Public read permissions already exist. Skipping.');
        return;
      }

      await Promise.all(
        missingActions.map((action) =>
          strapi.db.query('plugin::users-permissions.permission').create({
            data: { action, role: publicRole.id },
          } as any)
        )
      );

      strapi.log.info(`Seeded ${missingActions.length} public read permission(s).`);
    };
    let seededShowrooms: any[] = [];
    let seededOccasions: any[] = [];
    let seededCollections: any[] = [];

    await ensurePublicReadPermissions();

    const standardTimeSlots = [
      { timeString: '9:00 AM - 10:00 AM' },
      { timeString: '10:00 AM - 11:00 AM' },
      { timeString: '11:00 AM - 12:00 PM' },
      { timeString: '12:00 PM - 01:00 PM' },
      { timeString: '01:00 PM - 02:00 PM' },
      { timeString: '02:00 PM - 03:00 PM' },
      { timeString: '03:00 PM - 04:00 PM' },
      { timeString: '04:00 PM - 05:00 PM' },
    ];

    const showroomOptions = [
      { optionValue: 'Calicut' },
      { optionValue: 'Kochi' },
      { optionValue: 'Thrissur' },
      { optionValue: 'Coimbatore' },
      { optionValue: 'Trivandrum' },
    ];

    await seedCollectionByField('api::generic-form.generic-form', 'Generic Form', 'formTag', [
      {
        formName: 'Contact Message',
        formTag: 'contact-message',
        submitButtonText: 'Send Message',
        dynamicFields: [
          { label: 'Name', fieldType: 'text' as 'text', placeholder: 'Your name', isRequired: true },
          { label: 'Email', fieldType: 'email' as 'email', placeholder: 'Your email', isRequired: true },
          { label: 'Message', fieldType: 'textarea' as 'textarea', placeholder: 'Your message', isRequired: true },
        ],
      },
      {
        formName: 'Book Appointment',
        formTag: 'book-appointment',
        submitButtonText: 'Request Appointment',
        availableTimeSlots: standardTimeSlots,
        dynamicFields: [
          { label: 'Full Name', fieldType: 'text' as 'text', placeholder: 'Your full name', isRequired: true },
          { label: 'Email', fieldType: 'email' as 'email', placeholder: 'you@example.com', isRequired: true },
          { label: 'Phone', fieldType: 'phone' as 'phone', placeholder: '+91 00000 00000', isRequired: true },
          { label: 'Preferred Showroom', fieldType: 'dropdown' as 'dropdown', placeholder: 'Select showroom', dropdownOptions: showroomOptions },
          { label: 'Preferred Date', fieldType: 'date' as 'date', isRequired: true },
          { label: 'Notes', fieldType: 'textarea' as 'textarea', placeholder: "Tell us about the occasion or pieces you'd like to see" },
        ],
      },
      {
        formName: 'Showroom Visit',
        formTag: 'showroom-visit',
        submitButtonText: 'Book A Visit',
        availableTimeSlots: standardTimeSlots,
        dynamicFields: [
          { label: 'Full Name', fieldType: 'text' as 'text', placeholder: 'Your name', isRequired: true },
          { label: 'Phone', fieldType: 'phone' as 'phone', placeholder: '+91 00000 00000', isRequired: true },
          { label: 'Email', fieldType: 'email' as 'email', placeholder: 'Enter' },
          { label: 'Preferred Showroom', fieldType: 'dropdown' as 'dropdown', placeholder: 'Select showroom', dropdownOptions: showroomOptions },
          { label: 'Preferred Date', fieldType: 'date' as 'date' },
          { label: 'Purpose of Visit', fieldType: 'dropdown' as 'dropdown', placeholder: '-select-', dropdownOptions: [
            { optionValue: 'Engagement Ring' },
            { optionValue: 'Wedding Jewellery' },
            { optionValue: 'Gifting' },
            { optionValue: 'Personal Collection' },
            { optionValue: 'Just Browsing' }
          ] },
          { label: 'Notes', fieldType: 'textarea' as 'textarea', placeholder: 'Eg: I am looking for an engagement ring' },
        ],
      },
    ]);

    await seedCollectionByField('api::product-form.product-form', 'Product Form', 'formTag', [
      {
        formName: 'Product Video Call',
        formTag: 'product-video-call',
        submitButtonText: 'Schedule a Video Call',
        allowImageUpload: false,
        availableTimeSlots: standardTimeSlots,
        dynamicFields: [
          { label: 'Your Name', fieldType: 'text' as 'text', placeholder: 'Your name', isRequired: true },
          { label: 'Phone No.', fieldType: 'phone' as 'phone', placeholder: '+91', isRequired: true },
          { label: 'Email', fieldType: 'email' as 'email', placeholder: 'Enter' },
          { label: 'Date', fieldType: 'date' as 'date' },
          { label: 'Describe more about your visit', fieldType: 'textarea' as 'textarea', placeholder: 'Eg: I am looking for an engagement ring' },
        ],
      },
      {
        formName: 'Product Store Visit',
        formTag: 'product-store-visit',
        submitButtonText: 'Confirm Visit',
        allowImageUpload: false,
        availableTimeSlots: standardTimeSlots,
        dynamicFields: [
          { label: 'Your Name', fieldType: 'text' as 'text', placeholder: 'Your name', isRequired: true },
          { label: 'Phone No.', fieldType: 'phone' as 'phone', placeholder: '+91', isRequired: true },
          { label: 'Email', fieldType: 'email' as 'email', placeholder: 'Enter' },
          { label: 'Date', fieldType: 'date' as 'date' },
          { label: 'Describe more about your visit', fieldType: 'textarea' as 'textarea', placeholder: 'Eg: I am looking for an engagement ring' },
        ],
      },
      {
        formName: 'Product Personalisation',
        formTag: 'product-personalisation',
        submitButtonText: 'Get In Touch',
        allowImageUpload: true,
        dynamicFields: [
          { label: 'Your Name', fieldType: 'text' as 'text', placeholder: 'Your name', isRequired: true },
          { label: 'Phone No.', fieldType: 'phone' as 'phone', placeholder: '+91', isRequired: true },
          { label: 'Email', fieldType: 'email' as 'email', placeholder: 'Enter' },
          { label: 'Request Details', fieldType: 'textarea' as 'textarea', placeholder: 'Describe the gemstone, sizing, engraving or customisation you want' },
        ],
      },
    ]);

    // 1. Seed Showrooms (api::showroom.showroom)
    const showroomCount = await strapi.documents('api::showroom.showroom').count({});
    if (showroomCount === 0) {
      strapi.log.info('Seeding Showrooms...');
      const showrooms = [
        {
          name: 'Kochi',
          slug: 'kochi',
          address: 'Sunny Diamonds Kochi 40/9134 B & C, Rajaji Rd, Ernakulam, Kerala 682035',
          city: 'Kochi',
          state: 'Kerala',
          phone: '+91 97443 55555',
          mapUrl: 'https://maps.google.com/?q=Sunny+Diamonds+Kochi',
          openingHours: 'Mon-Sat: 10:00 AM - 8:00 PM',
          sortOrder: 1,
          isActive: true,
          publishedAt: new Date(),
        },
        {
          name: 'Calicut',
          slug: 'calicut',
          address: 'Sunny Diamonds Calicut, Kerala',
          city: 'Calicut',
          state: 'Kerala',
          phone: '+91 97443 55555',
          mapUrl: 'https://maps.google.com/?q=Sunny+Diamonds+Calicut',
          openingHours: 'Mon-Sat: 10:00 AM - 8:00 PM',
          sortOrder: 2,
          isActive: true,
          publishedAt: new Date(),
        },
        {
          name: 'Thrissur',
          slug: 'thrissur',
          address: 'Sunny Diamonds Thrissur, Kerala',
          city: 'Thrissur',
          state: 'Kerala',
          phone: '+91 97443 55555',
          mapUrl: 'https://maps.google.com/?q=Sunny+Diamonds+Thrissur',
          openingHours: 'Mon-Sat: 10:00 AM - 8:00 PM',
          sortOrder: 3,
          isActive: true,
          publishedAt: new Date(),
        },
        {
          name: 'Coimbatore',
          slug: 'coimbatore',
          address: 'Sunny Diamonds Coimbatore, Tamil Nadu',
          city: 'Coimbatore',
          state: 'Tamil Nadu',
          phone: '+91 97443 55555',
          mapUrl: 'https://maps.google.com/?q=Sunny+Diamonds+Coimbatore',
          openingHours: 'Mon-Sat: 10:00 AM - 8:00 PM',
          sortOrder: 4,
          isActive: true,
          publishedAt: new Date(),
        },
        {
          name: 'Trivandrum',
          slug: 'trivandrum',
          address: 'Sunny Diamonds Trivandrum, Kerala',
          city: 'Trivandrum',
          state: 'Kerala',
          phone: '+91 9744355555',
          mapUrl: 'https://maps.google.com/?q=Sunny+Diamonds+Trivandrum',
          openingHours: 'Mon-Sat: 10:00 AM - 8:00 PM',
          sortOrder: 5,
          isActive: true,
          publishedAt: new Date(),
        },
      ];

      for (const showroom of showrooms) {
        const createdShowroom = await strapi.documents('api::showroom.showroom').create({ data: showroom });
        seededShowrooms.push(createdShowroom);
      }
      strapi.log.info('Showrooms successfully seeded.');
    } else {
      strapi.log.info('Showrooms already exist. Skipping.');
      seededShowrooms = await strapi.documents('api::showroom.showroom').findMany({
        status: 'published',
        sort: { sortOrder: 'asc' },
      } as any);
    }

    // 2. Seed Occasions (api::occasion.occasion)
    const occasionCount = await strapi.documents('api::occasion.occasion').count({});
    if (occasionCount === 0) {
      strapi.log.info('Seeding Occasions...');
      const occasions = [
        {
          title: 'Festival',
          description: 'Timeless pieces for festival occasions.',
          sortOrder: 1,
          showField: true,
          publishedAt: new Date(),
        },
        {
          title: 'Cocktail',
          description: 'Premium collections for cocktail parties.',
          sortOrder: 2,
          showField: true,
          publishedAt: new Date(),
        },
        {
          title: 'Wedding',
          description: 'Exquisite settings for your special day.',
          sortOrder: 3,
          showField: true,
          publishedAt: new Date(),
        },
      ];

      for (const occasion of occasions) {
        const createdOccasion = await strapi.documents('api::occasion.occasion').create({ data: occasion });
        seededOccasions.push(createdOccasion);
      }
      strapi.log.info('Occasions successfully seeded.');
    } else {
      strapi.log.info('Occasions already exist. Skipping.');
      seededOccasions = await strapi.documents('api::occasion.occasion').findMany({
        status: 'published',
        sort: { sortOrder: 'asc' },
      } as any);
    }

    // 3. Seed Editorial Collections (api::editorial-collection.editorial-collection)
    const collectionCount = await strapi.documents('api::editorial-collection.editorial-collection').count({});
    if (collectionCount === 0) {
      strapi.log.info('Seeding Editorial Collections...');
      const collections = [
        {
          title: 'Alankara Collection',
          slug: 'alankara-collection',
          description: 'Our signature collection of internally flawless diamonds sourced from Belgium.',
          productSection: {
            sectionTitle: 'Explore Collection Products',
            description: 'Celestial Solitaire Ring, Aurora Halo Ring, Lumiere Pendant Necklace, and Riviere Tennis Bracelet.',
            isActive: true,
          },
          sortOrder: 1,
          isActive: true,
          publishedAt: new Date(),
        },
      ];
      strapi.log.info('Editorial Collections successfully seeded.');
    } else {
      strapi.log.info('Editorial Collections already exist. Skipping.');
      seededCollections = await strapi.documents('api::editorial-collection.editorial-collection').findMany({
        status: 'published',
        sort: { sortOrder: 'asc' },
      } as any);
    }

    // 4. Seed Legal Pages (api::legal-page.legal-page)
    const legalCount = await strapi.documents('api::legal-page.legal-page').count({});
    if (legalCount === 0) {
      strapi.log.info('Seeding Legal Pages...');
      const legalPages = [
        { title: 'Returns and Cancellations', slug: 'returns-and-cancellations', summary: 'Policy regarding returns and product cancellations.' },
        { title: 'Exchange and Resizing', slug: 'exchange-and-resizing', summary: 'Guidelines for exchange and resizing of jewelry items.' },
        { title: 'Shipping & Delivery', slug: 'shipping-delivery', summary: 'Shipping fees, delivery timelines, and transit insurance details.' },
        { title: 'Cash on Delivery Policy', slug: 'cash-on-delivery-policy', summary: 'Terms of payment on delivery.' },
        { title: 'Old Gold Purchase Policy (Kerala Only)', slug: 'old-gold-purchase-policy-kerala-only', summary: 'Exchange details for gold purchased in Kerala.' },
        { title: 'Privacy Policy', slug: 'privacy-policy', summary: 'Your privacy is extremely important to us.' },
        { title: 'Terms & Conditions', slug: 'terms-and-conditions', summary: 'The terms governing the use of Sunny Diamonds storefront.' },
        { title: 'Policy and Certification', slug: 'policy-and-certification', summary: 'Our product guarantee, BIS Hallmark, and internally flawless diamond certificates.' },
      ];

      for (const page of legalPages) {
        await strapi.documents('api::legal-page.legal-page').create({
          data: {
            ...page,
            body: `This is the placeholder page for ${page.title}. Real content can be configured directly from the Strapi Admin Panel.`,
            isActive: true,
            publishedAt: new Date(),
          },
        });
      }
      strapi.log.info('Legal Pages successfully seeded.');
    } else {
      strapi.log.info('Legal Pages already exist. Skipping.');
    }

    // 5. Seed Global Config Single Type (api::global-config.global-config)
    const globalConfigData = {
        headerNavigationLinks: [
          { label: 'Jewellery', url: '/products', targetType: 'internal' as 'internal', sortOrder: 1, isActive: true },
          { label: 'Collection', url: '/products', targetType: 'internal' as 'internal', sortOrder: 2, isActive: true },
          { label: 'Gifting', url: '/products', targetType: 'internal' as 'internal', sortOrder: 3, isActive: true },
          { label: 'Bespoke', url: '/contact', targetType: 'internal' as 'internal', sortOrder: 4, isActive: true },
          { label: 'World of Sunny', url: '/about', targetType: 'internal' as 'internal', sortOrder: 5, isActive: true },
        ],
        footerLinkGroups: [
          {
            title: 'Our Company',
            sortOrder: 1,
            isActive: true,
            links: [
              { label: 'About Us', url: '/about', targetType: 'internal' as 'internal', sortOrder: 1, isActive: true },
              { label: 'Learn About Diamonds', url: '/education', targetType: 'internal' as 'internal', sortOrder: 2, isActive: true },
              { label: 'Diamonds For Everyone', url: '/diamonds-for-everyone', targetType: 'internal' as 'internal', sortOrder: 3, isActive: true },
              { label: 'Careers', url: '/careers', targetType: 'internal' as 'internal', sortOrder: 4, isActive: true },
              { label: 'News', url: '/news', targetType: 'internal' as 'internal', sortOrder: 5, isActive: true },
              { label: 'Blog', url: '/blogs', targetType: 'internal' as 'internal', sortOrder: 6, isActive: true },
            ],
          },
          {
            title: 'Support',
            sortOrder: 2,
            isActive: true,
            links: [
              { label: 'Contact Us', url: '/contact', targetType: 'internal' as 'internal', sortOrder: 1, isActive: true },
              { label: 'Store Locator', url: '/store-locator', targetType: 'internal' as 'internal', sortOrder: 2, isActive: true },
              { label: 'FAQs', url: '/faqs', targetType: 'internal' as 'internal', sortOrder: 3, isActive: true },
              { label: 'Help and Support', url: '/help-and-support', targetType: 'internal' as 'internal', sortOrder: 4, isActive: true },
            ],
          },
          {
            title: 'Services',
            sortOrder: 3,
            isActive: true,
            links: [
              { label: 'Book an Appointment', url: '/book-an-appointment', targetType: 'internal' as 'internal', sortOrder: 1, isActive: true },
              { label: 'Bespoke Jewellery', url: '/bespoke-jewellery', targetType: 'internal' as 'internal', sortOrder: 2, isActive: true },
              { label: 'Monthly Plans', url: '/monthly-plans', targetType: 'internal' as 'internal', sortOrder: 3, isActive: true },
              { label: 'Gift Card', url: '/gift-card', targetType: 'internal' as 'internal', sortOrder: 4, isActive: true },
              { label: 'Finance Options', url: '/finance-options', targetType: 'internal' as 'internal', sortOrder: 5, isActive: true },
            ],
          },
          {
            title: 'Legal',
            sortOrder: 4,
            isActive: true,
            links: [
              { label: 'Returns and Cancellations', url: '/returns-and-cancellations', targetType: 'internal' as 'internal', sortOrder: 1, isActive: true },
              { label: 'Exchange and Resizing', url: '/exchange-and-resizing', targetType: 'internal' as 'internal', sortOrder: 2, isActive: true },
              { label: 'Shipping & Delivery', url: '/shipping-delivery', targetType: 'internal' as 'internal', sortOrder: 3, isActive: true },
              { label: 'Cash on Delivery Policy', url: '/cash-on-delivery-policy', targetType: 'internal' as 'internal', sortOrder: 4, isActive: true },
              { label: 'Old Gold Purchase Policy (Kerala Only)', url: '/old-gold-purchase-policy-kerala-only', targetType: 'internal' as 'internal', sortOrder: 5, isActive: true },
              { label: 'Privacy Policy', url: '/privacy-policy', targetType: 'internal' as 'internal', sortOrder: 6, isActive: true },
              { label: 'Terms & Conditions', url: '/terms-and-conditions', targetType: 'internal' as 'internal', sortOrder: 7, isActive: true },
              { label: 'Policy and Certification', url: '/policy-and-certification', targetType: 'internal' as 'internal', sortOrder: 8, isActive: true },
            ],
          },
        ],
        footerTickerItems: [
          { label: '100% MONEYBACK GUARANTEE', sortOrder: 1, isActive: true },
          { label: 'BIS HALLMARK FOR JEWELLERY', sortOrder: 2, isActive: true },
          { label: 'CASH ON DELIVERY', sortOrder: 3, isActive: true },
          { label: 'INTERNALLY FLAWLESS DIAMONDS', sortOrder: 4, isActive: true },
        ],
        socialLinks: [
          { label: 'Instagram', url: 'https://instagram.com/sunnydiamonds', targetType: 'external' as 'external', sortOrder: 1, isActive: true },
          { label: 'Facebook', url: 'https://facebook.com/sunnydiamonds', targetType: 'external' as 'external', sortOrder: 2, isActive: true },
        ],
        footerCopyright: '© 2026 Sunny Diamonds. All Rights Reserved.',
        defaultSeo: {
          metaTitle: 'Sunny Diamonds - Internally Flawless Diamonds',
          metaDescription: 'Fine jewellery designed with a tradition of excellence. Handcrafted conflict-free diamonds sourced from Belgium.',
        },
      publishedAt: new Date(),
    };
    await seedSingleType('api::global-config.global-config', 'Global Config', globalConfigData);

    // 6. Seed Homepage Single Type (api::homepage.homepage)
    const homepageData = {
        hero: {
          eyebrow: '20 Years of Legacy',
          mainTitle: 'Fine jewellery designed with a tradition of excellence',
          ctaButton: { label: 'Shop Now', url: '/products', targetType: 'internal' as 'internal', openInNewTab: false },
          showField: true,
        },
        trustBadges: [
          { label: 'BIS Halmark for Jewellery', sortOrder: 1, showField: true },
          { label: 'Cash on Delivery', sortOrder: 2, showField: true },
          { label: 'Internally Flawless Diamonds', sortOrder: 3, showField: true },
          { label: '100% Moneyback Guarantee', sortOrder: 4, showField: true },
        ],
        categoryCards: [
          { title: 'RINGS', sortOrder: 1, showField: true, cta: { label: 'Explore Rings', url: '/products?category=Rings', targetType: 'internal' as 'internal' } },
          { title: 'EARRINGS', sortOrder: 2, showField: true, cta: { label: 'Explore Earrings', url: '/products?category=Earrings', targetType: 'internal' as 'internal' } },
          { title: 'BRACELETS', sortOrder: 3, showField: true, cta: { label: 'Explore Bracelets', url: '/products?category=Bracelets', targetType: 'internal' as 'internal' } },
          { title: 'NECKLACE', sortOrder: 4, showField: true, cta: { label: 'Explore Necklaces', url: '/products?category=Necklaces', targetType: 'internal' as 'internal' } },
        ],
        diamondSourcingSection: {
          title: 'Internally flawless diamonds, sourced from Belgium',
          showField: true,
        },
        featuredCollection: {
          sectionTitle: 'Alankara Collection',
          description: 'A stellar showcase of signature flawless rings, pendants, and tennis bracelets reflecting traditional mastery.',
          magentoCollectionRef: 'alankara-collection',
          cta: { label: 'Explore Collection', url: '/products', targetType: 'internal' as 'internal' },
          showField: true,
        },
        giftingBanner: {
          title: 'Gifting For Your Valentine',
          description: 'Traditional mastery bringing every diamond to radiant, eternal life.',
          primaryCta: { label: 'Shop Now', url: '/products', targetType: 'internal' as 'internal' },
          secondaryCta: { label: 'Send a Gift Card Instead', url: '/contact', targetType: 'internal' as 'internal' },
          showField: true,
        },
        featuredProducts: {
          title: 'Your Diamond Awaits',
          subtitle: 'Traditional mastery bringing every diamond to radiant, eternal life. Highlighted by our signature Celestial Solitaire Ring, Lumiere Pendant Necklace, and Cascade Drop Earrings.',
          showField: true,
        },
        occasionSection: {
          sectionTitle: 'Timeless Pieces for Every Occasion',
          occasions: {
            connect: seededOccasions.map((occasion) => occasion.documentId).filter(Boolean),
          },
          showField: true,
        },
        craftsmanshipSection: {
          sectionTitle: 'From Vision to Masterpiece',
          description: 'Our process brings each diamond from first sketch to finished jewel.',
          steps: [
            { title: 'Design', description: 'Collaborate with our designers to sketch your perfect piece, tailored to your style and story.', sortOrder: 1, isActive: true },
            { title: 'Source', description: 'Expert gemologists choose Belgium-sourced internally flawless stones adhering to conflict-free mandates.', sortOrder: 2, isActive: true },
            { title: 'Craft', description: 'Master artisans set each stone to capture ultimate light in our dedicated atelier.', sortOrder: 3, isActive: true },
            { title: 'Deliver', description: 'Secure complimentary shipping directly to your doorstep with guaranteed certification.', sortOrder: 4, isActive: true },
          ],
          showField: true,
        },
        sunnyPromise: {
          title: 'THE SUNNY PROMISE',
          description: 'Guided by heritage and perfected by pride every setting a masterpiece of expert precision.',
          cta: { label: 'View Our Story', url: '/about', targetType: 'internal' as 'internal' },
          showField: true,
        },
        bespokeForYou: {
          title: 'BESPOKE JEWELLERY',
          description: 'Designs thoughtfully crafted to bring your vision to life',
          primaryCta: { label: 'Explore Bespoke', url: '/contact', targetType: 'internal' as 'internal' },
          secondaryCta: { label: 'Monthly Plans', url: '/diamonds-for-everyone', targetType: 'internal' as 'internal' },
          showField: true,
        },
        diamondsForEveryone: {
          title: 'DIAMONDS FOR EVERYONE',
          subtitle: 'Save monthly towards your timeless diamond',
          cta: { label: 'Monthly Plans', url: '/diamonds-for-everyone', targetType: 'internal' as 'internal' },
          showField: true,
        },
        showroom: {
          sectionTitle: 'Visit Our Showrooms',
          description: 'Step into our atelier to discover the Belgian-sourced mastery behind every stone. Located across Kochi, Calicut, Thrissur, Trivandrum, and Coimbatore.',
          showrooms: {
            connect: seededShowrooms.map((showroom) => showroom.documentId).filter(Boolean),
          },
          showField: true,
        },
        seo: {
          metaTitle: 'Sunny Diamonds | Home of Internally Flawless Diamonds',
          metaDescription: 'Discover our luxury diamond rings, bracelets, earrings, and necklaces sourced from Belgium.',
        },
        publishedAt: new Date(),
      };

    await seedSingleType('api::homepage.homepage', 'Homepage', homepageData);

    // 7. Seed About Page Single Type (api::about-page.about-page)
    const aboutPageData = {
        hero: {
          eyebrow: 'Our Story',
          title: 'Our Story',
          subtitle: 'We source Internally Flawless Diamonds from Belgium and craft them into timeless masterpieces.',
          isActive: true,
        },
        brillianceSection: {
          featureSlide: [
            {
              heading: 'Crafting rarity into timeless brilliance',
              body: 'We source Internally Flawless Diamonds from Belgium and craft them into timeless masterpieces, creating jewellery that resonates with you.',
            },
          ],
        },
        legacySection: {
          heading: 'Since 1997',
          legacyImageBlock: [
            {
              description: 'The story behind the brilliance of every Sunny Diamonds piece begins with the regal vision of our founder. From legacy and care to legacy and customer trust, our journey has been built on craftsmanship, goodwill and care.',
            },
          ],
        },
        teamSection: {
          heading: 'Faces Behind the Brilliance',
          subheading: 'We source Internally Flawless Diamonds from Belgium and craft them into timeless masterpieces, creating jewellery that resonates with you.',
          displayStyle: 'grid' as 'grid',
          teamMember: [
            { name: 'Boby Mathew', role: 'Chairman, Sunny Diamonds' },
            { name: 'Sunny Boby Mathew', role: 'Managing Director, Sunny Diamonds' },
            { name: 'Ryan Mathew', role: 'Director, Sunny Diamonds' },
          ],
        },
        craftSection: {
          heading: 'Handcrafted Brilliance',
          subheading: 'We are committed to creating finely crafted diamond jewellery — from sourcing and crafting to quality assurance — every step is held to the highest standard.',
          overlayOpacity: 0.2,
        },
        craftMosaicSection: {
          tile: [
            { type: 'textCard' as 'textCard', title: 'Ethically Sourced, conflict-free diamonds' },
            { type: 'textCard' as 'textCard', title: 'Pinnacle of Craftsmanship and Artistry' },
            { type: 'textCard' as 'textCard', title: 'Highest Level of Quality Checks' },
          ],
        },
        timelineSection: {
          timelineMilestone: [
            { year: 1997, heading: 'Since 1997', body: 'The Sunny Diamonds journey begins with craftsmanship, goodwill and care.' },
            { year: 2008, heading: 'Founded in Chalakkudy', body: 'We are passionate to create more brilliant moments with each customer experience. Our first standalone showroom opened with the promise of trust, brilliance and care.' },
            { year: 2023, heading: 'Crafting family heirlooms', body: 'Crafting family heirlooms at the pinnacle of diamond clarity.' },
          ],
        },
        trustBadgesSection: {
          trustBadge: [
            { label: 'Friendly Reviews Diamonds' },
            { label: '100% Moneyback Guarantee' },
            { label: 'BIS Hallmark Jewellery' },
            { label: '15 Days Return Policy' },
            { label: 'Cash on Delivery' },
          ],
        },
        brandTaglineSection: {
          tagline: 'Crafting family heirlooms at the pinnacle of diamond clarity',
        },
        seo: {
          metaTitle: 'Our Story | Sunny Diamonds',
          metaDescription: 'Learn about Sunny Diamonds\' legacy of crafting premium diamond jewellery with master artisans.',
          canonicalUrl: '/about',
        },
        publishedAt: new Date(),
      };

    await seedSingleType('api::about-page.about-page', 'About Page', aboutPageData);

    // 8. Seed Learn About Diamonds Page Single Type (api::learn-about-diamonds-page.learn-about-diamonds-page)
    const getUploadFileId = async (documentId: string, fallbackId: number) => {
      const byDocumentId = await strapi.db.query('plugin::upload.file' as any).findOne({
        where: { documentId },
      } as any);

      if (byDocumentId?.id) {
        return byDocumentId.id;
      }

      const byId = await strapi.db.query('plugin::upload.file' as any).findOne({
        where: { id: fallbackId },
      } as any);

      return byId?.id;
    };

    const imageAsset = (desktopImage?: number, mobileImage = desktopImage, altText?: string | null) => ({
      altText: altText ?? null,
      caption: null,
      ...(desktopImage ? { desktopImage } : {}),
      ...(mobileImage ? { mobileImage } : {}),
    });

    const diamondVideoId = await getUploadFileId('b1av8y20z01y7fn3mgs5t4sn', 186);
    const clarityImageId = await getUploadFileId('mqsky1606f05u28anvu3ahq6', 147);
    const giaLogoId = await getUploadFileId('w2umrugyogedweyu7o1plf5p', 148);
    const agsLogoDesktopId = await getUploadFileId('pup8ubxjra59hmirg32dafto', 149);
    const agsLogoMobileId = await getUploadFileId('voel54s4gsvh4z8wio16z0wf', 150);
    const hrdLogoId = await getUploadFileId('luv8qfrogtl19j9rx59vc2ak', 151);
    const tkpLogoId = await getUploadFileId('oyn9ndb6l0ojc9xqos9nmjyg', 152);

    const learnAboutDiamondsPageData = {
        hero: {
          eyebrow: 'The 4Cs and Beyond',
          title: 'Diamond Expertise',
          subtitle: 'Master the 4Cs of diamond quality and learn how Sunny Diamonds certifies every stone.',
          heroVideo: {
            altText: 'Diamond video',
            ...(diamondVideoId ? { heroVideo: diamondVideoId } : {}),
          },
          isActive: true,
        },
        fourCsIntro: {
          heading: 'The 4Cs of Diamond Quality',
          body: 'Diamond quality is defined by the harmony of cut, colour, clarity and carat. Sunny Diamonds focuses on the rarest grades, with internally flawless clarity, excellent cut and certified colourless stones.',
        },
        fourCsSection: {
          cVisualPanel: [
            {
              visualImage: imageAsset(clarityImageId, clarityImageId, null),
              gradeStops: [
                { gradeCode: 'I3', gradeLongLabel: 'Included' },
                { gradeCode: 'I2', gradeLongLabel: 'Included' },
                { gradeCode: 'I1', gradeLongLabel: 'Included' },
                { gradeCode: 'SI2', gradeLongLabel: 'Slight' },
                { gradeCode: 'SI1', gradeLongLabel: 'Slight' },
                { gradeCode: 'VS2', gradeLongLabel: 'Very Slight' },
                { gradeCode: 'VS1', gradeLongLabel: 'Very Slight' },
                { gradeCode: 'VVS2', gradeLongLabel: 'Very Very Slight' },
                { gradeCode: 'VVS1', gradeLongLabel: 'Very Very Slight' },
                { gradeCode: 'IF', gradeLongLabel: 'Internally Flawless' },
                { gradeCode: 'FL', gradeLongLabel: 'Flawless' },
              ],
            },
            {
              gradeStops: [
                { gradeCode: 'Poor', gradeLongLabel: 'Poor' },
                { gradeCode: 'Fair', gradeLongLabel: 'Fair' },
                { gradeCode: 'Good', gradeLongLabel: 'Good' },
                { gradeCode: 'Very Good', gradeLongLabel: 'Very Good' },
                { gradeCode: 'Excellent', gradeLongLabel: 'Excellent' },
              ],
            },
            {
              gradeStops: [
                { gradeCode: 'S-Z', gradeLongLabel: 'Light Yellow' },
                { gradeCode: 'N-R', gradeLongLabel: 'Very Light' },
                { gradeCode: 'K-M', gradeLongLabel: 'Faint' },
                { gradeCode: 'G-J', gradeLongLabel: 'Near Colourless' },
                { gradeCode: 'D-F', gradeLongLabel: 'Colourless' },
              ],
            },
            {
              gradeStops: [
                { gradeCode: '0.10 ct', gradeLongLabel: '0.10 ct' },
                { gradeCode: '0.25 ct', gradeLongLabel: '0.25 ct' },
                { gradeCode: '0.50 ct', gradeLongLabel: '0.50 ct' },
                { gradeCode: '1.00 ct', gradeLongLabel: '1.00 ct' },
                { gradeCode: '2.00 ct', gradeLongLabel: '2.00 ct' },
              ],
            },
          ],
          cInfoPanel: [
            {
              displayTag: 'C1',
              sectionLabel: 'CLARITY',
              description: 'Clarity measures how free a diamond is from inclusions or surface imperfections, with Internally Flawless being the rarest.',
              activeGradeCode: 'IF',
              activeGradeFullName: 'Internally Flawless',
              brandNote: 'Sunny Diamonds offer only IF & Flawless grade diamonds.',
            },
            {
              displayTag: 'C2',
              sectionLabel: 'CUT',
              description: 'A diamond\'s cut is the most important of the 4Cs. It governs the way light enters and reflects, giving the stone its brilliance.',
              activeGradeCode: 'Excellent',
              activeGradeFullName: 'Excellent Cut',
              brandNote: 'We only craft with Excellent and Triple Excellent cut diamonds.',
            },
            {
              displayTag: 'C3',
              sectionLabel: 'COLOUR',
              description: 'Diamonds naturally come in a D to Z colour scale, where D is icy white and Z carries the warmest tint of yellow or brown.',
              activeGradeCode: 'D-F',
              activeGradeFullName: 'Colourless',
              brandNote: 'All Sunny Diamonds are certified D-F Colourless grade.',
            },
            {
              displayTag: 'C4',
              sectionLabel: 'CARAT',
              description: 'Carat is the unit of weight for a diamond. While larger stones command higher value, brilliance and beauty are defined by the harmony of all four Cs.',
              activeGradeCode: '1.00 ct',
              activeGradeFullName: 'One Carat',
              brandNote: 'Available in a wide range of carat weights, certified for purity.',
            },
          ],
        },
        certificateSection: {
          sectionHeading: 'Certified Brilliance',
          sectionDescription: 'Certification gives you confidence about what you are investing in. Independent grading verifies cut, colour, clarity and carat, and each Sunny Diamond carries an independent lab report matched to your piece for lifetime traceability.',
          certificationLabs: [
            {
              labName: 'GIA',
              labDescription: 'The Gemological Institute of America',
              labLogo: imageAsset(giaLogoId),
            },
            {
              labName: 'AGS',
              labDescription: 'American Gem Society',
              labLogo: imageAsset(agsLogoDesktopId, agsLogoMobileId),
            },
            {
              labName: 'HRD',
              labDescription: 'The HRD Antwerp Diamond Lab',
              labLogo: imageAsset(hrdLogoId),
            },
            {
              labName: 'TKP',
              labDescription: 'The Kimberly Process',
              labLogo: imageAsset(tkpLogoId),
            },
          ],
        },
        learnMoreSection: {
          sectionHeading: 'Learn more about Diamonds',
          tabs: [
            {
              tabLabel: 'SHAPE' as 'SHAPE',
              tabDescription: 'Shape gives a diamond its identity. Explore the four classic forms that define our collection and the language jewellers use to read them.',
              featureSubtitle: 'Each cushion-shape diamond is laser-cut',
              carouselImage: [],
            },
            {
              tabLabel: 'FANCY_COLOUR' as 'FANCY_COLOUR',
              tabDescription: 'Fancy colour diamonds are valued for natural hue, tone and saturation beyond the classic D to Z scale.',
              carouselImage: [],
            },
            {
              tabLabel: 'DIAMOND_ANATOMY' as 'DIAMOND_ANATOMY',
              tabDescription: 'A diamond is read through table, crown, girdle, pavilion and culet, each affecting light return and brilliance.',
              carouselImage: [],
            },
            {
              tabLabel: 'DIAMOND_CARE' as 'DIAMOND_CARE',
              tabDescription: 'Clean with mild soap and warm water, store separately to avoid scratches, and visit our atelier annually for inspection and polish.',
              carouselImage: [],
            },
          ],
        },
        discoverSection: {
          heading: 'Discover What Speaks to You',
          subheading: 'Find your diamond, crafted around the moment you will wear it — to suit your occasion and preferences.',
          ctaButtonLabel: 'BOOK A CONSULTATION',
          ctaButtonUrl: '/book-appointment',
        },
        faqSection: {
          sectionHeading: 'Frequently Asked Questions',
          faqItems: [
            { question: 'What factors determine a diamond\'s overall value?', answer: 'A diamond\'s value is set by the interplay of the 4Cs — Cut, Colour, Clarity and Carat — together with shape, fluorescence and certification.' },
            { question: 'How can I verify the authenticity of my diamond?', answer: 'Every Sunny Diamonds piece ships with an independent GIA, IGI or HRD certificate and a laser-inscribed identification number matched to the stone.' },
            { question: 'What are the different diamond cuts offered at Sunny Diamonds?', answer: 'We craft with Round Brilliant, Cushion, Princess, Oval, Emerald, Pear and Marquise cuts — each finished to Excellent or Triple Excellent grade.' },
            { question: 'How will I properly care for my diamond to ensure it lasts?', answer: 'Clean with mild soap and warm water, store separately to avoid scratches, and visit our atelier annually for a complimentary inspection and polish.' },
          ],
        },
        publishedAt: new Date(),
      };

    await seedSingleType('api::learn-about-diamonds-page.learn-about-diamonds-page', 'Learn About Diamonds Page', learnAboutDiamondsPageData);

    // 9. Seed Contact Bespoke Page Single Type (api::contact-bespoke-page.contact-bespoke-page)
    const contactPageData = {
        hero: {
          eyebrow: 'Get in Touch',
          title: 'Contact Us',
          subtitle: 'Whether you\'re looking for the perfect piece or want to discuss a custom design, our team is here to help.',
          isActive: true,
        },
        introCopy: '### Custom Consultations\nCollaborate directly with our designers to sketch your perfect piece, tailored to your style and story.',
        contactEmail: 'hello@sunnydiamonds.com',
        contactPhone: '+1 (555) 123-4567',
        bespokeSteps: [
          { title: 'Design Sketching', description: 'Sketch your vision with certified, custom-design advisors.', sortOrder: 1, isActive: true },
          { title: 'Sourcing Selection', description: 'Filter the ultimate Belgian conflict-free diamonds.', sortOrder: 2, isActive: true },
          { title: 'Master Crafting', description: 'Artisanal setting of your custom solitaire or pendant.', sortOrder: 3, isActive: true },
          { title: 'Secure Delivery', description: 'Safe shipping straight to your home with certification.', sortOrder: 4, isActive: true },
        ],
        promoCards: [
          {
            title: 'Visit Our Boutique',
            description: '123 Diamond Avenue, New York, NY 10001',
            sortOrder: 1,
            isActive: true,
          },
        ],
        seo: {
          metaTitle: 'Contact Us & Bespoke Consultation | Sunny Diamonds',
          metaDescription: 'Discuss custom engagement ring designs, bespoke jewelry consultation, and support inquiries.',
        },
        publishedAt: new Date(),
      };

    await seedSingleType('api::contact-bespoke-page.contact-bespoke-page', 'Contact Bespoke Page', contactPageData);

    strapi.log.info('Strapi CMS programmatic seeding completed successfully.');
  } catch (error) {
    strapi.log.error('An error occurred during programmatic seeding:', error);
  }
}

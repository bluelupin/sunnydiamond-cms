import type { Core } from '@strapi/strapi';

export async function seedCms(strapi: Core.Strapi) {
  strapi.log.info('Starting Strapi CMS programmatic seeding process...');

  try {
    let seededShowrooms: any[] = [];
    let seededOccasions: any[] = [];
    let seededCollections: any[] = [];

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
          slug: 'festival',
          description: 'Timeless pieces for festival occasions.',
          sortOrder: 1,
          isActive: true,
          publishedAt: new Date(),
        },
        {
          title: 'Cocktail',
          slug: 'cocktail',
          description: 'Premium collections for cocktail parties.',
          sortOrder: 2,
          isActive: true,
          publishedAt: new Date(),
        },
        {
          title: 'Wedding',
          slug: 'wedding',
          description: 'Exquisite settings for your special day.',
          sortOrder: 3,
          isActive: true,
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

      for (const collection of collections) {
        const createdCollection = await strapi.documents('api::editorial-collection.editorial-collection').create({ data: collection });
        seededCollections.push(createdCollection);
      }
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
    const globalConfigCount = await strapi.documents('api::global-config.global-config').count({});
    if (globalConfigCount === 0) {
      strapi.log.info('Seeding Global Config...');
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

      await strapi.documents('api::global-config.global-config').create({ data: globalConfigData });
      strapi.log.info('Global Config successfully seeded.');
    } else {
      strapi.log.info('Global Config already exists. Skipping.');
    }

    // 6. Seed Homepage Single Type (api::homepage.homepage)
    const homepageCount = await strapi.documents('api::homepage.homepage').count({});
    if (homepageCount === 0) {
      strapi.log.info('Seeding Homepage...');
      const homepageData = {
        hero: {
          eyebrow: '20 Years of Legacy',
          title: 'Fine jewellery designed with a tradition of excellence',
          subtitle: 'Crafting rarity into timeless brilliance',
          primaryCta: { label: 'Shop Now', url: '/products', targetType: 'internal' as 'internal', openInNewTab: false },
          isActive: true,
        },
        trustBadges: [
          { label: 'BIS Halmark for Jewellery', sortOrder: 1, isActive: true },
          { label: 'Cash on Delivery', sortOrder: 2, isActive: true },
          { label: 'Internally Flawless Diamonds', sortOrder: 3, isActive: true },
          { label: '100% Moneyback Guarantee', sortOrder: 4, isActive: true },
        ],
        categoryNavigation: [
          { title: 'RINGS', sortOrder: 1, isActive: true, cta: { label: 'Explore Rings', url: '/products?category=Rings', targetType: 'internal' as 'internal' } },
          { title: 'EARRINGS', sortOrder: 2, isActive: true, cta: { label: 'Explore Earrings', url: '/products?category=Earrings', targetType: 'internal' as 'internal' } },
          { title: 'BRACELETS', sortOrder: 3, isActive: true, cta: { label: 'Explore Bracelets', url: '/products?category=Bracelets', targetType: 'internal' as 'internal' } },
          { title: 'NECKLACE', sortOrder: 4, isActive: true, cta: { label: 'Explore Necklaces', url: '/products?category=Necklaces', targetType: 'internal' as 'internal' } },
        ],
        diamondSourcingSection: {
          sectionTitle: 'Internally flawless diamonds, sourced from Belgium',
          description: 'Step into a world of ultimate purity. Every single stone is meticulously handpicked and imported directly from Antwerp, Belgium, the diamond capital of the world.',
          isActive: true,
        },
        featuredCollectionSection: {
          sectionTitle: 'Alankara Collection',
          description: 'A stellar showcase of signature flawless rings, pendants, and tennis bracelets reflecting traditional mastery.',
          magentoCollectionRef: 'alankara-collection',
          cta: { label: 'Explore Collection', url: '/products', targetType: 'internal' as 'internal' },
          isActive: true,
        },
        giftingBanner: {
          eyebrow: 'Gifting Special',
          title: 'Gifting For Your Valentine',
          subtitle: 'Traditional mastery bringing every diamond to radiant, eternal life.',
          primaryCta: { label: 'Shop Now', url: '/products', targetType: 'internal' as 'internal' },
          secondaryCta: { label: 'Send a Gift Card Instead', url: '/contact', targetType: 'internal' as 'internal' },
          isActive: true,
        },
        featuredProductsSection: {
          sectionTitle: 'Your Diamond Awaits',
          description: 'Traditional mastery bringing every diamond to radiant, eternal life. Highlighted by our signature Celestial Solitaire Ring, Lumiere Pendant Necklace, and Cascade Drop Earrings.',
          isActive: true,
        },
        occasionSection: {
          sectionTitle: 'Timeless Pieces for Every Occasion',
          description: 'Explore the highly curated jewelry selections suited perfectly for your Festival, Cocktail, or Wedding collections.',
          occasions: {
            connect: seededOccasions.map((occasion) => occasion.documentId).filter(Boolean),
          },
          isActive: true,
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
          isActive: true,
        },
        sunnyPromiseSection: {
          sectionTitle: 'THE SUNNY PROMISE',
          description: 'Guided by heritage and perfected by pride every setting a masterpiece of expert precision.',
          cta: { label: 'View Our Story', url: '/about', targetType: 'internal' as 'internal' },
          isActive: true,
        },
        bespokeForYouCards: [
          {
            title: 'BESPOKE JEWELLERY',
            description: 'Designs thoughtfully crafted to bring your vision to life',
            cta: { label: 'Explore Bespoke', url: '/contact', targetType: 'internal' as 'internal' },
            sortOrder: 1,
            isActive: true,
          },
          {
            title: 'DIAMONDS FOR EVERYONE',
            description: 'Save monthly towards your timeless diamond',
            cta: { label: 'Monthly Plans', url: '/diamonds-for-everyone', targetType: 'internal' as 'internal' },
            sortOrder: 2,
            isActive: true,
          },
        ],
        showroomSection: {
          sectionTitle: 'Visit Our Showrooms',
          description: 'Step into our atelier to discover the Belgian-sourced mastery behind every stone. Located across Kochi, Calicut, Thrissur, Trivandrum, and Coimbatore.',
          showrooms: {
            connect: seededShowrooms.map((showroom) => showroom.documentId).filter(Boolean),
          },
          isActive: true,
        },
        seo: {
          metaTitle: 'Sunny Diamonds | Home of Internally Flawless Diamonds',
          metaDescription: 'Discover our luxury diamond rings, bracelets, earrings, and necklaces sourced from Belgium.',
        },
        publishedAt: new Date(),
      };

      await strapi.documents('api::homepage.homepage').create({ data: homepageData });
      strapi.log.info('Homepage successfully seeded.');
    } else {
      strapi.log.info('Homepage already exists. Skipping.');
    }

    // 7. Seed About Page Single Type (api::about-page.about-page)
    const aboutPageCount = await strapi.documents('api::about-page.about-page').count({});
    if (aboutPageCount === 0) {
      strapi.log.info('Seeding About Page...');
      const aboutPageData = {
        hero: {
          eyebrow: 'Our Heritage',
          title: 'Crafting Brilliance Since 1987',
          subtitle: 'At Sunny Diamonds, we believe every diamond carries a universe of light within it.',
          isActive: true,
        },
        introTitle: 'Our Story',
        introBody: 'At Sunny Diamonds, we believe every diamond carries a universe of light within it. Founded in 1987 by master jeweller Antoine Delacroix, our atelier has been dedicated to transforming the world\'s finest diamonds into wearable works of art.\n\nEach piece in our collection is meticulously handcrafted by our team of skilled artisans, combining centuries-old techniques with contemporary design sensibilities. We source only conflict-free, GIA-certified diamonds, ensuring that every stone meets our exacting standards for cut, clarity, color, and carat.\n\nOur custom design service allows you to collaborate directly with our designers to create a piece that is uniquely yours. From engagement rings that capture your love story to heirloom pieces that will be treasured for generations, we bring your vision to life with unparalleled craftsmanship.\n\nWe invite you to visit our flagship boutique or explore our online collection. Every purchase comes with complimentary shipping, a lifetime warranty, and the assurance that you are wearing something truly exceptional.',
        storySections: [
          { title: '35+', description: 'Years of Excellence', sortOrder: 1, isActive: true },
          { title: '10,000+', description: 'Pieces Crafted', sortOrder: 2, isActive: true },
          { title: '50+', description: 'Master Artisans', sortOrder: 3, isActive: true },
        ],
        processSteps: [
          { title: 'Heritage Sourcing', description: 'Selecting internally flawless Belgium-cut stones.', sortOrder: 1, isActive: true },
          { title: 'Legacy Handcrafting', description: 'Generations of knowledge and design detail poured into settings.', sortOrder: 2, isActive: true },
        ],
        seo: {
          metaTitle: 'Our Legacy & Story | Sunny Diamonds',
          metaDescription: 'Crafting premium jewelry since 1987. Explore the story and heritage behind our Belgic internally flawless diamonds.',
        },
        publishedAt: new Date(),
      };

      await strapi.documents('api::about-page.about-page').create({ data: aboutPageData });
      strapi.log.info('About Page successfully seeded.');
    } else {
      strapi.log.info('About Page already exists. Skipping.');
    }

    // 8. Seed Contact Bespoke Page Single Type (api::contact-bespoke-page.contact-bespoke-page)
    const contactPageCount = await strapi.documents('api::contact-bespoke-page.contact-bespoke-page').count({});
    if (contactPageCount === 0) {
      strapi.log.info('Seeding Contact Bespoke Page...');
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

      await strapi.documents('api::contact-bespoke-page.contact-bespoke-page').create({ data: contactPageData });
      strapi.log.info('Contact Bespoke Page successfully seeded.');
    } else {
      strapi.log.info('Contact Bespoke Page already exists. Skipping.');
    }

    strapi.log.info('Strapi CMS programmatic seeding completed successfully.');
  } catch (error) {
    strapi.log.error('An error occurred during programmatic seeding:', error);
  }
}

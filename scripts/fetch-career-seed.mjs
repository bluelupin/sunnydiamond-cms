import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const SOURCE_URL =
  process.env.CAREER_SEED_SOURCE_URL ||
  'https://sunnydiamonds-cms-dev.on-forge.com/api/career-openings';
const OUTPUT_PATH = resolve('src/data/career-openings.json');

const decodeLabel = (value) =>
  value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

function splitHeadingSections(html = '') {
  const pattern = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  const headings = [...html.matchAll(pattern)];
  return headings.map((heading, index) => ({
    label: decodeLabel(heading[1]),
    headingHtml: heading[0],
    body: html
      .slice(heading.index + heading[0].length, headings[index + 1]?.index ?? html.length)
      .trim(),
  }));
}

function splitQualificationSections(html = '') {
  const pattern = /<p[^>]*>\s*(Education|Experience|Technical Skills|Soft Skills)\s*<\/p>/gi;
  const markers = [...html.matchAll(pattern)];
  const sections = new Map();
  for (const [index, marker] of markers.entries()) {
    sections.set(
      marker[1].toLowerCase(),
      html
        .slice(marker.index + marker[0].length, markers[index + 1]?.index ?? html.length)
        .trim()
    );
  }
  return {
    intro: markers.length ? html.slice(0, markers[0].index).trim() : html.trim(),
    sections,
  };
}

const section = (sectionTitle, sectionContent) => ({
  sectionTitle,
  sectionContent: sectionContent || null,
});

function structureDescription(description = '') {
  const sections = splitHeadingSections(description);
  const find = (prefix) => sections.find(({ label }) => label.startsWith(prefix));
  const summary = find('job summary');
  const responsibilities = sections.find(
    ({ label }) =>
      label.startsWith('roles and responsibilities') ||
      label.startsWith('roles & responsibilities')
  );
  const qualifications = sections.find(
    ({ label }) =>
      label.startsWith('qualifications and experience') ||
      label.startsWith('qualifications & experience')
  );
  const lookingFor = find("what we're looking for");
  const whyJoinUs = find('why join us');
  const qualification = splitQualificationSections(qualifications?.body);
  const technicalSkills = qualification.sections.get('technical skills');
  const softSkills = qualification.sections.get('soft skills');
  const reserved = new Set(
    [summary, responsibilities, qualifications, lookingFor, whyJoinUs].filter(Boolean)
  );
  const additionalContent = sections
    .filter((item) => !reserved.has(item) && item.body)
    .map((item) => `${item.headingHtml}${item.body}`)
    .join('');

  return {
    jobSummary: section('Job Summary', summary?.body),
    rolesAndResponsibilities: section('Roles & Responsibilities', responsibilities?.body),
    qualificationsAndExperience: {
      sectionTitle: 'Qualifications & Experience',
      sectionContent: qualification.intro || null,
      education: section('Education', qualification.sections.get('education')),
      experience: section('Experience', qualification.sections.get('experience')),
    },
    skills: section(
      'Skills',
      [
        technicalSkills ? `<h4>Technical Skills</h4>${technicalSkills}` : '',
        softSkills ? `<h4>Soft Skills</h4>${softSkills}` : '',
      ].join('')
    ),
    whatWeAreLookingFor: section("What We're Looking For", lookingFor?.body),
    whyJoinUs: section('Why Join Us?', whyJoinUs?.body),
    additionalInfo: section('Additional Information', additionalContent),
  };
}

function cleanOpening(opening) {
  const { id, documentId, createdAt, updatedAt, publishedAt, ...data } = opening;
  return {
    ...data,
    description: opening.description || null,
    jobDescription: structureDescription(opening.description),
    applyCta: opening.applyCta
      ? {
          label: opening.applyCta.label,
          url: opening.applyCta.url,
          targetType: opening.applyCta.targetType,
          openInNewTab: opening.applyCta.openInNewTab,
        }
      : null,
    seo: opening.seo
      ? {
          metaTitle: opening.seo.metaTitle,
          metaDescription: opening.seo.metaDescription,
          canonicalUrl: opening.seo.canonicalUrl,
          metaKeywords: opening.seo.metaKeywords,
          structuredData: opening.seo.structuredData,
          showField: opening.seo.showField,
        }
      : null,
  };
}

const url = new URL(SOURCE_URL);
url.searchParams.set('pagination[pageSize]', '1000');
url.searchParams.set('locale', 'en');
url.searchParams.set('populate', '*');
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`Career seed fetch failed: ${response.status} ${response.statusText}`);
}

const payload = await response.json();
const openings = (payload.data || []).map(cleanOpening).sort(
  (left, right) =>
    (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.slug.localeCompare(right.slug)
);
await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(openings, null, 2)}\n`, 'utf8');
console.log(`Saved ${openings.length} career openings to ${OUTPUT_PATH}`);

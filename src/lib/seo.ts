// Structured data (schema.org JSON-LD) and URL helpers for search engines and
// AI assistants. Everything here is generated from site.json and the work posts,
// so editing content in the CMS keeps it up to date automatically.
import type { CollectionEntry } from 'astro:content';
import site from '../data/site.json';
import { url, CATEGORIES, type Category } from './site';

export const SITE_ORIGIN = 'https://xanderbert.github.io';

/** Absolute URL for a site path (/portfolio/... or a path relative to the base). */
export function abs(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const p = path.startsWith(url('')) ? path : url(path);
  return new URL(p, SITE_ORIGIN).href;
}

export const PERSON_ID = abs('#person');

/** All skills from the toolbox, flattened. */
export function skills(): string[] {
  return site.toolbox.flatMap((g) => g.items);
}

/** Profiles that belong to the same person (helps AI tools merge identities). */
export function sameAs(): string[] {
  return [site.github, site.linkedin, site.blog].filter(Boolean);
}

export function personLd() {
  const current = site.experience[0];
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: site.name,
    jobTitle: site.role,
    description: `${site.tagline} ${site.seeking ?? ''}`.trim(),
    url: abs(''),
    image: site.portrait ? abs(site.portrait) : undefined,
    email: site.email ? `mailto:${site.email}` : undefined,
    address: { '@type': 'PostalAddress', addressLocality: site.location },
    sameAs: sameAs(),
    knowsAbout: [
      'Real-time rendering', 'Graphics programming', 'GPU-driven rendering', 'Physically based rendering',
      'Light transport', 'Ray tracing', 'Shadow mapping', 'Ambient occlusion', 'Tools programming',
      ...skills(),
    ],
    alumniOf: site.education.map((e) => ({ '@type': 'EducationalOrganization', name: e.org.split(',')[0] })),
    worksFor: current ? { '@type': 'Organization', name: current.org } : undefined,
    hasOccupation: {
      '@type': 'Occupation',
      name: site.role,
      occupationLocation: { '@type': 'City', name: site.location },
      skills: skills().join(', '),
    },
    award: site.awards.map((a) => `${a.title} (${a.year})`),
  };
}

export function websiteLd() {
  return {
    '@type': 'WebSite',
    '@id': abs('#website'),
    url: abs(''),
    name: `${site.name}, ${site.role}`,
    description: site.tagline,
    inLanguage: 'en',
    author: { '@id': PERSON_ID },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

export function workLd(w: CollectionEntry<'work'>) {
  const d = w.data;
  return {
    '@type': d.github ? 'SoftwareSourceCode' : 'CreativeWork',
    '@id': abs(`work/${w.id}/`),
    url: abs(`work/${w.id}/`),
    name: d.title,
    headline: d.title,
    description: d.summary,
    datePublished: d.date.toISOString().slice(0, 10),
    image: d.cover ? abs(d.cover) : undefined,
    keywords: [...d.tags, ...d.categories.map((c) => CATEGORIES[c as Category].label)].join(', '),
    author: { '@id': PERSON_ID },
    ...(d.github ? { codeRepository: d.github, programmingLanguage: d.languages } : {}),
    isPartOf: { '@id': abs('#website') },
  };
}

/** Wraps nodes in a single @graph document. */
export function graph(...nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

/** Markdown body with site-relative links made absolute (for llms.txt and .md exports). */
export function absolutizeMarkdown(md: string): string {
  return md.replace(/\]\((\/portfolio\/[^)\s]*)\)/g, (_, p) => `](${abs(p)})`);
}

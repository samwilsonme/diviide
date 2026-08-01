// Pure JSON-LD builders. These return plain objects that Base.astro (or any
// consuming page) serializes into a <script type="application/ld+json"> tag.
//
// Schema choices reflect 2026 reality: Article and BreadcrumbList still drive
// useful signals (and breadcrumbs still render in search). FAQPage and HowTo
// rich results have been deprecated by Google, so those builders exist only as
// extraction aids for AI/answer engines and must mirror visible page content.

import { SITE } from '../content/site';

type Json = Record<string, unknown>;

const abs = (path: string) => `${SITE.baseUrl}${path}`;

/**
 * Serialize a schema block for a <script type="application/ld+json"> tag.
 * JSON.stringify alone is not safe against `set:html`: a string field
 * containing `</script>` would close the tag early and inject markup. Escaping
 * `<` as `<` keeps the JSON semantically identical (JSON.parse yields the
 * same value) while making early tag closure impossible.
 */
export function jsonLdString(block: object): string {
  return JSON.stringify(block).replaceAll('<', '\\u003c');
}

export function personSchema(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': SITE.authorId,
    name: SITE.author,
    url: SITE.baseUrl,
    sameAs: [SITE.githubProfile],
  };
}

export function webSiteSchema(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.baseUrl,
    publisher: { '@id': SITE.authorId },
  };
}

export function webApplicationSchema(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE.name,
    url: SITE.baseUrl,
    description: 'Visual bookmark separator tool for organizing your bookmarks bar.',
    applicationCategory: 'BrowserApplication',
    operatingSystem: 'Chrome, Edge, Brave, Arc',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@id': SITE.authorId },
  };
}

export function articleSchema(opts: {
  title: string;
  description: string;
  path: string;
  updated: string;
  image?: string;
}): Json {
  const url = abs(opts.path);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.title,
    description: opts.description,
    datePublished: opts.updated,
    dateModified: opts.updated,
    author: { '@id': SITE.authorId },
    publisher: { '@id': SITE.authorId },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    image: abs(opts.image ?? SITE.defaultOgImage),
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

export function videoObjectSchema(opts: {
  name: string;
  description: string;
  /** Public path to the video file, e.g. '/diviide-welcome.mp4'. */
  contentUrl: string;
  /** Public path to a still/poster; defaults to the brand OG image. */
  thumbnailUrl?: string;
  /** ISO date the clip was published. Defaults to the site's content date. */
  uploadDate?: string;
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: opts.name,
    description: opts.description,
    thumbnailUrl: abs(opts.thumbnailUrl ?? SITE.defaultOgImage),
    uploadDate: opts.uploadDate ?? '2026-08-01',
    contentUrl: abs(opts.contentUrl),
  };
}

export function faqSchema(qa: { question: string; answer: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

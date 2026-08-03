import { describe, expect, it } from 'vitest';
import { SITE } from '../content/site';
import {
  articleSchema,
  breadcrumbSchema,
  faqSchema,
  jsonLdString,
  personSchema,
  videoObjectSchema,
  webApplicationSchema,
  webSiteSchema,
} from './schema';

// Assert against SITE rather than hardcoding the domain, so a brand change
// can't break these tests spuriously.

describe('articleSchema', () => {
  const opts = {
    title: 'How to organize bookmarks',
    description: 'A guide.',
    path: '/guides/how-to-organize-bookmarks/',
    updated: '2026-06-01',
  };

  it('absolutises the page url and mirrors it into mainEntityOfPage', () => {
    const schema = articleSchema(opts);
    const url = `${SITE.baseUrl}${opts.path}`;
    expect(schema.url).toBe(url);
    expect(schema.mainEntityOfPage).toEqual({ '@type': 'WebPage', '@id': url });
  });

  it('defaults the image to the site OG image and absolutises a custom one', () => {
    expect(articleSchema(opts).image).toBe(`${SITE.baseUrl}${SITE.defaultOgImage}`);
    expect(articleSchema({ ...opts, image: '/og/custom.png' }).image).toBe(
      `${SITE.baseUrl}/og/custom.png`
    );
  });

  it('mirrors updated into both datePublished and dateModified', () => {
    const schema = articleSchema(opts);
    expect(schema.datePublished).toBe(opts.updated);
    expect(schema.dateModified).toBe(opts.updated);
  });

  it('links author and publisher by the author @id', () => {
    const schema = articleSchema(opts);
    expect(schema.author).toEqual({ '@id': SITE.authorId });
    expect(schema.publisher).toEqual({ '@id': SITE.authorId });
  });
});

describe('breadcrumbSchema', () => {
  it('numbers items from 1 and absolutises every item path', () => {
    const schema = breadcrumbSchema([
      { name: 'Guides', path: '/guides/' },
      { name: 'FAQ', path: '/guides/faq/' },
    ]);
    expect(schema.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Guides', item: `${SITE.baseUrl}/guides/` },
      { '@type': 'ListItem', position: 2, name: 'FAQ', item: `${SITE.baseUrl}/guides/faq/` },
    ]);
  });
});

describe('videoObjectSchema', () => {
  it('absolutises contentUrl and defaults the thumbnail to the OG image', () => {
    const schema = videoObjectSchema({
      name: 'Welcome',
      description: 'Intro clip.',
      contentUrl: '/diviide-welcome.mp4',
    });
    expect(schema.contentUrl).toBe(`${SITE.baseUrl}/diviide-welcome.mp4`);
    expect(schema.thumbnailUrl).toBe(`${SITE.baseUrl}${SITE.defaultOgImage}`);
    // Google's VideoObject parser rejects a bare date; the default must be a
    // timezone-qualified ISO 8601 datetime. Pin the shape, not just that some
    // default exists.
    expect(schema.uploadDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/);
  });

  it('normalizes a bare upload date to a timezone-qualified datetime', () => {
    const schema = videoObjectSchema({
      name: 'Welcome',
      description: 'Intro clip.',
      contentUrl: '/clip.mp4',
      thumbnailUrl: '/poster.png',
      uploadDate: '2026-01-02',
    });
    expect(schema.thumbnailUrl).toBe(`${SITE.baseUrl}/poster.png`);
    expect(schema.uploadDate).toBe('2026-01-02T00:00:00+00:00');
  });

  it('passes through an upload date that already carries a time and timezone', () => {
    const schema = videoObjectSchema({
      name: 'Welcome',
      description: 'Intro clip.',
      contentUrl: '/clip.mp4',
      uploadDate: '2026-01-02T09:30:00+01:00',
    });
    expect(schema.uploadDate).toBe('2026-01-02T09:30:00+01:00');
  });
});

describe('faqSchema', () => {
  it('maps each Q/A pair into Question/acceptedAnswer entities', () => {
    const schema = faqSchema([
      { question: 'What is Diviide?', answer: 'A separator tool.' },
      { question: 'Is it free?', answer: 'Yes.' },
    ]);
    expect(schema.mainEntity).toEqual([
      {
        '@type': 'Question',
        name: 'What is Diviide?',
        acceptedAnswer: { '@type': 'Answer', text: 'A separator tool.' },
      },
      {
        '@type': 'Question',
        name: 'Is it free?',
        acceptedAnswer: { '@type': 'Answer', text: 'Yes.' },
      },
    ]);
  });
});

describe('jsonLdString', () => {
  it('neutralises </script> so a string field cannot close the tag early', () => {
    const out = jsonLdString({ name: 'Sneaky</script><img src=x onerror=alert(1)>' });
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<img');
  });

  it('escapes every < while round-tripping to the same value', () => {
    const block = { a: '<b>1 < 2</b>', nested: { q: 'plain' }, n: 3 };
    const out = jsonLdString(block);
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual(block);
  });

  it('serializes a schema builder output unchanged apart from escaping', () => {
    const schema = faqSchema([{ question: 'Free?', answer: 'Yes.' }]);
    expect(JSON.parse(jsonLdString(schema))).toEqual(schema);
  });
});

describe('identity schemas', () => {
  it('share the author @id linkage and schema.org context', () => {
    const person = personSchema();
    const site = webSiteSchema();
    const app = webApplicationSchema();
    for (const schema of [person, site, app]) {
      expect(schema['@context']).toBe('https://schema.org');
    }
    expect(person['@id']).toBe(SITE.authorId);
    expect(site.publisher).toEqual({ '@id': SITE.authorId });
    expect(app.author).toEqual({ '@id': SITE.authorId });
  });
});

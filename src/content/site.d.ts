// Type declarations for site.js (the runtime source of truth).

export interface Site {
  baseUrl: string;
  name: string;
  author: string;
  authorId: string;
  githubRepo: string;
  githubProfile: string;
  issuesUrl: string;
  contactEmail: string;
  coffeeUrl: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultOgImage: string;
}

export const SITE: Site;

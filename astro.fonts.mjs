// @ts-check
import { fontProviders } from 'astro/config';

// The font set, shared by this repo's astro.config.mjs and by any site consuming
// this repo as a submodule. Each repo builds independently, so both need the same
// families declared — but declaring them twice meant a weight or subset change in
// one silently diverged from the other. Importing this file keeps one definition.
//
// Fonts are downloaded at build time and self-hosted from /_astro/fonts/, so there
// are no runtime requests to any font CDN. Base.astro injects them with <Font />
// and theme.css maps the variables onto Tailwind's --font-sans / --font-mono.
export const fonts = [
  {
    provider: fontProviders.fontsource(),
    name: 'Inter',
    cssVariable: '--font-inter',
    weights: ['400 900'],
    styles: ['normal', 'italic'],
    subsets: ['latin'],
  },
  {
    provider: fontProviders.fontsource(),
    name: 'JetBrains Mono',
    cssVariable: '--font-jetbrains-mono',
    weights: ['400 700'],
    styles: ['normal'],
    subsets: ['latin'],
    fallbacks: ['monospace'],
  },
];

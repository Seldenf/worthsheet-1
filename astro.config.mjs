import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

// Production cutover: SITE=https://worthsheet.com BASE=/ PUBLIC_NOINDEX=false
const site = process.env.SITE ?? 'https://ziarnooo.github.io';
const base = process.env.BASE ?? '/worthsheet';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'always',
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !/\/(404|thank-you)\/?$/.test(page),
    }),
  ],
});

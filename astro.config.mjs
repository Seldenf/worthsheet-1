import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import rehypeBaseLinks from './src/lib/rehype-base-links.mjs';

// Production cutover: SITE=https://worthsheet.com BASE=/ PUBLIC_NOINDEX=false
const site = process.env.SITE ?? 'https://ziarnooo.github.io';
const base = process.env.BASE ?? '/worthsheet';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  // Old WordPress archive URLs (from the previous worthsheet.com sitemaps) that have no direct counterpart.
  redirects: {
    '/author/worthsheet/': `${base.replace(/\/$/, '')}/blog/`,
    '/category/uncategorized/': `${base.replace(/\/$/, '')}/blog/`,
  },
  markdown: {
    rehypePlugins: [[rehypeBaseLinks, { base }]],
  },
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

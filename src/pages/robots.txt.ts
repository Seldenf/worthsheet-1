import type { APIRoute } from 'astro';
import { abs, isNoindex } from '../lib/seo';

export const GET: APIRoute = () => {
  const body = isNoindex()
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap-index.xml')}\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};

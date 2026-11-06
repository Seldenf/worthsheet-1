import { SITE_NAME } from '../config';
import { url } from './url';

type Ld = Record<string, unknown>;
type DateLike = Date | string;

const AUTHOR_NAME = 'WorthSheet Team';

/** True unless PUBLIC_NOINDEX is explicitly "false" (staging default = noindex). */
export function isNoindex(): boolean {
  return (import.meta.env.PUBLIC_NOINDEX ?? 'true').trim().toLowerCase() !== 'false';
}

/** Site origin without trailing slash (from `site` in astro.config.mjs). */
export function siteOrigin(): string {
  return (import.meta.env.SITE ?? 'https://ziarnooo.github.io').replace(/\/+$/, '');
}

/**
 * Absolute URL for a route/file path WITHOUT base (`/blog/` → `https://host/base/blog/`).
 * Absolute inputs are returned as is.
 */
export function abs(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return siteOrigin() + url(path);
}

function iso(d: DateLike): string {
  return d instanceof Date ? d.toISOString() : d;
}

const orgRef = () => ({ '@id': abs('/') + '#organization' });

export function organizationLd(): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': abs('/') + '#organization',
    name: SITE_NAME,
    url: abs('/'),
    logo: abs('/favicon.svg'),
  };
}

export function websiteLd(): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': abs('/') + '#website',
    name: SITE_NAME,
    url: abs('/'),
    inLanguage: 'en-US',
    publisher: orgRef(),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

export function faqLd(items: { q: string; a: string }[]): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}

export function articleLd(opts: {
  title: string;
  description: string;
  path: string;
  datePublished: DateLike;
  dateModified?: DateLike;
  image?: string;
}): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.title,
    description: opts.description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': abs(opts.path) },
    url: abs(opts.path),
    image: ogImageUrl(opts.image),
    datePublished: iso(opts.datePublished),
    dateModified: iso(opts.dateModified ?? opts.datePublished),
    inLanguage: 'en-US',
    author: { '@type': 'Organization', name: AUTHOR_NAME, url: abs('/') },
    publisher: orgRef(),
  };
}

export function webAppLd(opts: {
  name: string;
  description: string;
  path: string;
  category?: string;
}): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: opts.name,
    description: opts.description,
    url: abs(opts.path),
    applicationCategory: 'FinanceApplication',
    ...(opts.category ? { applicationSubCategory: opts.category } : {}),
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: orgRef(),
  };
}

export function howToLd(opts: {
  name: string;
  description?: string;
  path?: string;
  steps: { name: string; text: string }[];
}): Ld {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.path ? { url: abs(opts.path) } : {}),
    step: opts.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

export const DEFAULT_OG_IMAGE = '/og/default.png';

/**
 * Absolute URL for an OG image. Accepts a route-style path (`/og/x.png`), an absolute URL, or an
 * already-based asset URL (e.g. `astro:assets` output `/worthsheet/_astro/hero.abc.png`).
 */
export function ogImageUrl(image?: string): string {
  return abs(image ?? DEFAULT_OG_IMAGE);
}

/** Serialises JSON-LD safely for inline <script type="application/ld+json">. */
export function ldString(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

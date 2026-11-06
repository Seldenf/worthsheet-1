/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  /** "true" (default) → noindex on every page and Disallow: / in robots.txt. Set "false" at production cutover. */
  readonly PUBLIC_NOINDEX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  /** Set once the GA4 script has been requested after consent. */
  __wsGa?: boolean;
}

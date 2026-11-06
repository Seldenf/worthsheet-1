const EXTERNAL = /^([a-z][a-z0-9+.-]*:|\/\/)/i;

/** Base path without a trailing slash ('' for root deployments). */
function basePrefix(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return base.replace(/\/+$/, '');
}

/**
 * Turns a route path (WITHOUT base, e.g. `/mortgage-calculator/`) into a deployable href/src.
 * - prefixes `import.meta.env.BASE_URL`, collapses duplicate slashes
 * - page paths get a trailing slash; paths whose last segment has a file extension do not
 * - `?query` / `#hash` suffixes are preserved; bare `#hash` / `?query` and absolute URLs
 *   (`https:`, `mailto:`, `tel:`, `//cdn`) are returned untouched
 * - idempotent: a path that already starts with the base is not prefixed again
 */
export function url(path: string): string {
  if (!path || EXTERNAL.test(path) || path.startsWith('#') || path.startsWith('?')) {
    return path || basePrefix() + '/';
  }

  const match = /^([^?#]*)(.*)$/.exec(path)!;
  let pathname = match[1];
  const suffix = match[2];

  const prefix = basePrefix();
  pathname = '/' + pathname.replace(/^\/+/, '');

  const alreadyPrefixed =
    prefix !== '' && (pathname === prefix || pathname.startsWith(prefix + '/'));
  if (!alreadyPrefixed) pathname = prefix + pathname;

  pathname = pathname.replace(/\/{2,}/g, '/');

  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (lastSegment !== '' && !lastSegment.includes('.')) pathname += '/';

  return pathname + suffix;
}

/**
 * Rehype plugin for Markdown/MDX content.
 *
 * - Root-relative `href` / `src` values (start with `/`, not `//`) get the site base prefixed,
 *   so content authors can write `/download/` regardless of the deployment base.
 *   Page-like paths (last segment without a file extension) also get a trailing slash
 *   (`trailingSlash: 'always'`). `?query` / `#hash` suffixes are preserved.
 * - External http(s) links open in a new tab with `rel="noopener"`.
 *
 * No dependencies: the hast tree is walked manually.
 * Base resolution mirrors astro.config.mjs (`process.env.BASE ?? '/worthsheet'`); an explicit
 * `{ base }` option overrides it.
 */

/** Normalised base without trailing slash; '' for root deployments. */
function normalizeBase(raw) {
  const trimmed = String(raw ?? '').trim();
  if (trimmed === '' || trimmed === '/') return '';
  return '/' + trimmed.replace(/^\/+|\/+$/g, '');
}

const EXTERNAL_HTTP = /^https?:\/\//i;

function prefixPath(value, base) {
  if (!value.startsWith('/') || value.startsWith('//')) return value;

  const match = /^([^?#]*)(.*)$/.exec(value);
  let pathname = match[1];
  const suffix = match[2];

  if (base !== '' && (pathname === base || pathname.startsWith(base + '/'))) {
    // already prefixed
  } else {
    pathname = base + pathname;
  }

  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (lastSegment !== '' && !lastSegment.includes('.')) pathname += '/';

  return pathname + suffix;
}

function mergeRel(existing) {
  const tokens = new Set(
    (Array.isArray(existing) ? existing : String(existing ?? '').split(/\s+/)).filter(Boolean),
  );
  tokens.add('noopener');
  return [...tokens];
}

export default function rehypeBaseLinks(options = {}) {
  const base = normalizeBase(options.base ?? process.env.BASE ?? '/worthsheet');

  function visit(node) {
    if (node.type === 'element' && node.properties) {
      const props = node.properties;

      for (const key of ['href', 'src']) {
        const value = props[key];
        if (typeof value === 'string') props[key] = prefixPath(value, base);
      }

      if (
        node.tagName === 'a' &&
        typeof props.href === 'string' &&
        EXTERNAL_HTTP.test(props.href)
      ) {
        props.target = '_blank';
        props.rel = mergeRel(props.rel);
      }
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) visit(child);
    }
  }

  return (tree) => {
    visit(tree);
  };
}

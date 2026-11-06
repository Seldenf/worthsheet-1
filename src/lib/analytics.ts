/**
 * Client-side GA4 event helper. Events are sent only after the visitor granted consent
 * (the consent banner sets `window.__wsGa` when it loads gtag.js); otherwise this is a no-op.
 *
 * Events used on the site:
 * - `generate_lead`   { purpose }                     lead form success
 * - `template_open`   { format: 'sheets' | 'xlsx' }   copy / xlsx click
 * - `calculator_use`  { calculator: slug }            once per page view, first valid result
 */
export function track(event: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  if (!window.__wsGa || typeof window.gtag !== 'function') return;
  window.gtag('event', event, params ?? {});
}

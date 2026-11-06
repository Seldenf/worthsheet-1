/**
 * Loaders and formatters for the FDIC data written by `scripts/fetch-fdic.mjs`.
 * Server-side only (build time); the hub/state pages render everything into static HTML.
 */
import summaryFile from './fdic/states.json';
import { STATES, STATE_BY_CODE, type StateInfo } from './states';

export interface StateSummary {
  code: string;
  banks: number;
  community: number;
  branches: number;
  operatorCount: number;
  outOfStateBranches: number;
  outOfStatePct: number;
  top3Pct: number;
  regulators: { FDIC: number; OCC: number; FED: number; STATE: number };
  stateChartered: number;
  largest: { name: string; cert: number; assets: number };
}

export interface Operator {
  name: string;
  cert: number;
  branches: number;
  hq: string;
}

/** [name, city, cert, community 0|1, assets in $ thousands] */
export type HqRow = [string, string, number, 0 | 1, number];

export interface StateDetail extends StateSummary {
  operators: Operator[];
  hq: HqRow[];
}

export const FDIC_META = summaryFile.meta as {
  dataDate: string;
  activeInstitutions51: number;
  activeInstitutionsNational: number;
};

const summaries = new Map<string, StateSummary>(
  (summaryFile.states as StateSummary[]).map((s) => [s.code, s]),
);

const detailFiles = import.meta.glob<StateDetail>('./fdic/states/*.json', {
  eager: true,
  import: 'default',
});

export function getSummary(code: string): StateSummary {
  const s = summaries.get(code);
  if (!s) throw new Error(`No FDIC summary for ${code}; run scripts/fetch-fdic.mjs`);
  return s;
}

export function getDetail(code: string): StateDetail {
  const d = detailFiles[`./fdic/states/${code}.json`];
  if (!d) throw new Error(`No FDIC detail file for ${code}; run scripts/fetch-fdic.mjs`);
  return d;
}

// Fail the build early if the data and the state list drift apart.
for (const s of STATES) getSummary(s.code);

// ------------------------------------------------------------------ formatting

export const fmt = (n: number) => n.toLocaleString('en-US');

/** 96 -> "96%", 22.3 -> "22.3%" (one decimal at most, no trailing ".0"). */
export const pct = (n: number) => `${Number(n.toFixed(1))}%`;

/** Share of `part` in `whole`, whole percent (community-bank share). */
export const sharePct = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`;

/** Drops the legal suffix FDIC appends ("..., National Association", "N.A.", "Inc.") for readability. */
export function shortName(name: string): string {
  return name.replace(/,?\s+(National Association|N\.A\.|Inc\.?)$/i, '').trim();
}

/** Assets are in $ thousands: 128791735 -> "$128.8 billion", 5123849 -> "$5.1 billion", 850000 -> "$850 million". */
export function formatAssets(thousands: number): string {
  const usd = thousands * 1000;
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)} trillion`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)} billion`;
  return `$${Math.round(usd / 1e6).toLocaleString('en-US')} million`;
}

export const ASSET_BUCKETS = [
  { max: 100_000, label: 'Under $100M' },
  { max: 1_000_000, label: '$100M–$1B' },
  { max: 10_000_000, label: '$1B–$10B' },
  { max: 100_000_000, label: '$10B–$100B' },
  { max: Infinity, label: 'Over $100B' },
] as const;

export const assetBucket = (thousands: number): string =>
  ASSET_BUCKETS.find((b) => thousands < b.max)!.label;

// ------------------------------------------------------------------ SEO copy

export function stateTitle(state: StateInfo, s: StateSummary): string {
  const title = `Banks in ${state.short}: ${s.banks} FDIC-Insured Banks | WorthSheet`;
  if (title.length > 60) throw new Error(`Title too long (${title.length}) for ${state.code}: ${title}`);
  return title;
}

export function stateDescription(state: StateInfo, s: StateSummary): string {
  // "DC" (not "The District of Columbia") keeps the description within 160 characters.
  const text =
    `${state.short} has ${s.banks} FDIC-insured banks, ${s.community} of them community banks. ` +
    `See the largest by branches, the biggest in-state banks and your state bank regulator.`;
  if (text.length < 140 || text.length > 160) {
    throw new Error(`Meta description for ${state.code} is ${text.length} chars (need 140–160): ${text}`);
  }
  return text;
}

export { STATES, STATE_BY_CODE };
export type { StateInfo };

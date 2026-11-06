#!/usr/bin/env node
/**
 * Builds the FDIC data behind /banks/ and /banks/{state}/ pages.
 *
 * Usage (Node >= 22, no dependencies, calls the public FDIC BankFind API, no API key):
 *
 *   node scripts/fetch-fdic.mjs
 *
 * Output (compact JSON, commit it):
 *   src/data/fdic/states.json         meta + one summary row per jurisdiction (hub page, titles/meta)
 *   src/data/fdic/states/{ST}.json    full detail for one jurisdiction (state page)
 *
 * Source endpoints (https://api.fdic.gov/banks/docs/):
 *   /institutions  filters=ACTIVE:1  fields=CERT,NAME,STALP,CITY,CB,ASSET,REGAGNT,STCHRTR   (one call)
 *   /locations     filters=STALP:"{ST}" AND (SERVTYPE:11 OR SERVTYPE:12)  agg_by=CERT       (one call per state)
 *
 * Definitions, verified against https://api.fdic.gov/banks/docs/location_properties.yaml
 * (SERVTYPE) and the live index on 2026-11-06:
 *   SERVTYPE 11 = Full Service - Brick and Mortar, 12 = Full Service - Retail.
 *   Codes 13-16 (home banking, mobile, phone banking, seasonal) and 21-99 (limited service) are NOT counted.
 *   ASSET is in thousands of USD; CB "1" = FDIC community bank; STCHRTR 1 = state charter;
 *   REGAGNT = primary federal regulator (FDIC | OCC | FED), or STATE for the few institutions with
 *   no federal primary regulator (kept as a separate bucket).
 *
 * Gotchas handled here:
 *   - the filter DSL treats a bare OR as an operator, so state codes are always quoted (STALP:"OR");
 *   - branch counts use the API's server-side aggregation (agg_by=CERT), which returns one row per
 *     bank instead of up to ~6,000 location records, and the sum is asserted against meta.total;
 *   - requests use fetch with a timeout, retries with backoff, and a small delay (the API is rate limited).
 *
 * Safety: the script aborts (and writes nothing) if the active-institution count in the 51
 * jurisdictions drops by more than 10% versus the previously committed states.json.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.fdic.gov/banks';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src/data/fdic');

// 50 states + DC (US territories are intentionally excluded).
const CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM',
  'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WV', 'WI', 'WY',
];

const TIMEOUT_MS = 45_000;
const RETRIES = 6;
const PAUSE_MS = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(endpoint, params) {
  const qs = new URLSearchParams(params).toString();
  const href = `${API}/${endpoint}?${qs}`;
  let lastError;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(href, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      if (/HTTP 4(?!29)/.test(String(err.message))) break; // client errors are not retryable
      const wait = Math.min(30_000, 1500 * 2 ** (attempt - 1));
      console.warn(`  ${endpoint} attempt ${attempt}/${RETRIES} failed (${err.message}); retrying in ${wait} ms`);
      await sleep(wait);
    }
  }
  throw new Error(`FDIC request failed: ${href} — ${lastError?.message}`);
}

const round1 = (n) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------- 1. institutions
console.log('Fetching active institutions…');
const inst = await api('institutions', {
  filters: 'ACTIVE:1',
  fields: 'CERT,NAME,STALP,CITY,CB,ASSET,REGAGNT,STCHRTR',
  limit: '10000',
  sort_by: 'CERT',
});
const instTotal = inst.meta.total;
if (inst.data.length !== instTotal) {
  throw new Error(`Institutions truncated: got ${inst.data.length} of ${instTotal}`);
}
const instIndex = inst.meta.index;
const byCert = new Map();
for (const { data: d } of inst.data) {
  byCert.set(String(d.CERT), {
    cert: Number(d.CERT),
    name: String(d.NAME).trim(),
    city: String(d.CITY ?? '').trim(),
    st: d.STALP,
    cb: d.CB === '1' || d.CB === 1,
    assets: Number(d.ASSET) || 0, // thousands of USD
    reg: d.REGAGNT,
    stateCharter: Number(d.STCHRTR) === 1,
  });
}
console.log(`  ${instTotal} active institutions (index ${instIndex.name}, ${instIndex.createTimestamp})`);

// ---------------------------------------------------------------- 2. branches per state
const states = [];
let locIndex = null;
for (const code of CODES) {
  await sleep(PAUSE_MS);
  const res = await api('locations', {
    filters: `STALP:"${code}" AND (SERVTYPE:11 OR SERVTYPE:12)`,
    agg_by: 'CERT',
    agg_limit: '5000',
    limit: '0',
  });
  locIndex ??= res.meta.index;
  const rows = res.data.map(({ data: d }) => ({ cert: String(d.CERT), n: Number(d.count) }));
  const branches = rows.reduce((s, r) => s + r.n, 0);
  if (branches !== res.meta.total) {
    throw new Error(`${code}: aggregation sums to ${branches}, API total is ${res.meta.total}`);
  }

  const operators = [];
  let outOfState = 0;
  for (const { cert, n } of rows) {
    const bank = byCert.get(cert);
    if (!bank) {
      // Branch of an institution that is not in the active list: cannot name it, so report loudly.
      console.warn(`  ${code}: CERT ${cert} (${n} branches) not in active institutions — ignored as operator`);
      continue;
    }
    if (bank.st !== code) outOfState += n;
    operators.push({ name: bank.name, cert: bank.cert, branches: n, hq: bank.st });
  }
  operators.sort((a, b) => b.branches - a.branches || a.name.localeCompare(b.name));

  const hqBanks = [...byCert.values()]
    .filter((b) => b.st === code)
    .sort((a, b) => b.assets - a.assets || a.name.localeCompare(b.name));
  if (hqBanks.length === 0) throw new Error(`${code}: no headquartered institutions found`);

  const reg = { FDIC: 0, OCC: 0, FED: 0, STATE: 0 };
  for (const b of hqBanks) {
    if (!(b.reg in reg)) throw new Error(`${code}: unexpected REGAGNT "${b.reg}" for CERT ${b.cert}`);
    reg[b.reg]++;
  }

  const top3 = operators.slice(0, 3).reduce((s, o) => s + o.branches, 0);
  const summary = {
    code,
    banks: hqBanks.length,
    community: hqBanks.filter((b) => b.cb).length,
    branches,
    operatorCount: operators.length, // distinct banks with a full-service office in the state
    outOfStateBranches: outOfState,
    outOfStatePct: branches ? round1((outOfState / branches) * 100) : 0,
    top3Pct: branches ? round1((top3 / branches) * 100) : 0,
    regulators: reg,
    stateChartered: hqBanks.filter((b) => b.stateCharter).length,
    largest: { name: hqBanks[0].name, cert: hqBanks[0].cert, assets: hqBanks[0].assets },
  };
  const detail = {
    ...summary,
    operators: operators.slice(0, 10),
    // [name, city, cert, community 0|1, assets in $ thousands], sorted by assets desc
    hq: hqBanks.map((b) => [b.name, b.city, b.cert, b.cb ? 1 : 0, b.assets]),
  };
  states.push({ summary, detail });
  console.log(`  ${code}: ${summary.banks} HQ banks, ${branches} branches, top ${operators[0]?.name} (${operators[0]?.branches})`);
}

// ---------------------------------------------------------------- 3. sanity + write
const totalBanks = states.reduce((s, x) => s + x.summary.banks, 0);
try {
  const prev = JSON.parse(await readFile(join(OUT_DIR, 'states.json'), 'utf8'));
  const prevTotal = prev.states.reduce((s, x) => s + x.banks, 0);
  if (totalBanks < prevTotal * 0.9) {
    throw new Error(`Active institutions in the 51 jurisdictions dropped from ${prevTotal} to ${totalBanks} (> 10%). Refusing to overwrite.`);
  }
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

const day = (ts) => ts.slice(0, 10);
const out = {
  meta: {
    source: 'FDIC BankFind Suite API (https://api.fdic.gov/banks/)',
    institutionsIndex: instIndex.name,
    locationsIndex: locIndex.name,
    dataDate: day(instIndex.createTimestamp),
    locationsDate: day(locIndex.createTimestamp),
    activeInstitutionsNational: instTotal,
    activeInstitutions51: totalBanks,
    fullServiceServtypes: [11, 12],
  },
  states: states.map((s) => s.summary),
};

await rm(join(OUT_DIR, 'states'), { recursive: true, force: true });
await mkdir(join(OUT_DIR, 'states'), { recursive: true });
await writeFile(join(OUT_DIR, 'states.json'), JSON.stringify(out) + '\n');
for (const s of states) {
  await writeFile(join(OUT_DIR, 'states', `${s.detail.code}.json`), JSON.stringify(s.detail) + '\n');
}
console.log(`Wrote ${states.length} states (${totalBanks} HQ banks), data date ${out.meta.dataDate}`);

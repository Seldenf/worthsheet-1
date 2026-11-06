/**
 * The 50 states + District of Columbia used by /banks/ and /banks/{slug}/.
 *
 * - `withArticle`: how the name reads in running text ("the District of Columbia").
 * - `short`: name used in titles where length matters (DC only).
 * - `neighbors`: adjacency from the keyword plan (§6.5); AK/HI link to CA and WA.
 * - `regulator`: state banking agency, name and URL as listed by CSBS
 *   ("Contact your state bank agency", https://www.csbs.org/contact-your-state-bank-agency, read 2026-11-06).
 */
export interface StateInfo {
  code: string;
  name: string;
  slug: string;
  withArticle: string;
  short: string;
  neighbors: string[];
  regulator: { name: string; url: string };
}

type Row = [code: string, name: string, neighbors: string, regulatorName: string, regulatorUrl: string];

const rows: Row[] = [
  ['AL', 'Alabama', 'FL GA MS TN', 'Alabama State Banking Department', 'https://banking.alabama.gov'],
  ['AK', 'Alaska', 'CA WA', 'Alaska Division of Banking and Securities', 'https://www.commerce.alaska.gov/web/dbs'],
  ['AZ', 'Arizona', 'CA NV UT CO NM', 'Arizona Department of Insurance and Financial Institutions', 'https://difi.az.gov/'],
  ['AR', 'Arkansas', 'LA MS MO OK TN TX', 'Arkansas State Bank Department', 'https://banking.arkansas.gov/'],
  ['CA', 'California', 'AZ NV OR', 'California Department of Financial Protection and Innovation', 'https://dfpi.ca.gov/'],
  ['CO', 'Colorado', 'AZ KS NE NM OK UT WY', 'Colorado Division of Banking', 'https://banking.colorado.gov/'],
  ['CT', 'Connecticut', 'MA NY RI', 'Connecticut Department of Banking', 'https://portal.ct.gov/dob'],
  ['DE', 'Delaware', 'MD NJ PA', 'Delaware Office of the State Bank Commissioner', 'https://banking.delaware.gov'],
  ['DC', 'District of Columbia', 'MD VA', 'District of Columbia Department of Insurance, Securities and Banking', 'https://disb.dc.gov/'],
  ['FL', 'Florida', 'AL GA', 'Florida Office of Financial Regulation', 'https://www.flofr.gov/'],
  ['GA', 'Georgia', 'AL FL NC SC TN', 'Georgia Department of Banking and Finance', 'https://dbf.georgia.gov/'],
  ['HI', 'Hawaii', 'CA WA', 'Hawaii Division of Financial Institutions', 'https://cca.hawaii.gov/dfi/'],
  ['ID', 'Idaho', 'MT NV OR UT WA WY', 'Idaho Department of Finance', 'https://www.finance.idaho.gov/'],
  ['IL', 'Illinois', 'IN IA KY MO WI', 'Illinois Department of Financial and Professional Regulation', 'https://idfpr.illinois.gov/'],
  ['IN', 'Indiana', 'IL KY MI OH', 'Indiana Department of Financial Institutions', 'https://www.in.gov/dfi/'],
  ['IA', 'Iowa', 'IL MN MO NE SD WI', 'Iowa Division of Banking', 'https://idob.iowa.gov'],
  ['KS', 'Kansas', 'CO MO NE OK', 'Kansas Office of the State Bank Commissioner', 'https://www.osbckansas.gov'],
  ['KY', 'Kentucky', 'IL IN MO OH TN VA WV', 'Kentucky Department of Financial Institutions', 'https://kfi.ky.gov/'],
  ['LA', 'Louisiana', 'AR MS TX', 'Louisiana Office of Financial Institutions', 'https://ofi.la.gov/'],
  ['ME', 'Maine', 'NH', 'Maine Bureau of Financial Institutions', 'https://www.maine.gov/pfr/financialinstitutions/'],
  ['MD', 'Maryland', 'DE DC PA VA WV', 'Maryland Office of Financial Regulation', 'https://www.dllr.state.md.us/finance'],
  ['MA', 'Massachusetts', 'CT NH NY RI VT', 'Massachusetts Division of Banks', 'https://www.mass.gov/orgs/division-of-banks'],
  ['MI', 'Michigan', 'IN OH WI', 'Michigan Department of Insurance and Financial Services', 'https://www.michigan.gov/difs/industry/banking'],
  ['MN', 'Minnesota', 'IA ND SD WI', 'Minnesota Department of Commerce', 'https://mn.gov/commerce/'],
  ['MS', 'Mississippi', 'AL AR LA TN', 'Mississippi Department of Banking and Consumer Finance', 'https://dbcf.ms.gov/'],
  ['MO', 'Missouri', 'AR IL IA KS KY NE OK TN', 'Missouri Division of Finance', 'https://finance.mo.gov/'],
  ['MT', 'Montana', 'ID ND SD WY', 'Montana Division of Banking and Financial Institutions', 'https://doa.mt.gov/bfid/'],
  ['NE', 'Nebraska', 'CO IA KS MO SD WY', 'Nebraska Department of Banking and Finance', 'https://ndbf.nebraska.gov/'],
  ['NV', 'Nevada', 'AZ CA ID OR UT', 'Nevada Financial Institutions Division', 'https://fid.nv.gov/'],
  ['NH', 'New Hampshire', 'ME MA VT', 'New Hampshire Banking Department', 'https://www.banking.nh.gov/'],
  ['NJ', 'New Jersey', 'DE NY PA', 'New Jersey Department of Banking and Insurance', 'https://www.nj.gov/dobi/index.html'],
  ['NM', 'New Mexico', 'AZ CO OK TX UT', 'New Mexico Financial Institutions Division', 'https://www.rld.nm.gov/financial-institutions/'],
  ['NY', 'New York', 'CT MA NJ PA VT', 'New York State Department of Financial Services', 'https://www.dfs.ny.gov/'],
  ['NC', 'North Carolina', 'GA SC TN VA', 'North Carolina Office of the Commissioner of Banks', 'https://nccob.nc.gov/'],
  ['ND', 'North Dakota', 'MN MT SD', 'North Dakota Department of Financial Institutions', 'https://www.nd.gov/dfi/'],
  ['OH', 'Ohio', 'IN KY MI PA WV', 'Ohio Division of Financial Institutions', 'https://com.ohio.gov/divisions-and-programs/financial-institutions'],
  ['OK', 'Oklahoma', 'AR CO KS MO NM TX', 'Oklahoma State Banking Department', 'https://banking.ok.gov'],
  ['OR', 'Oregon', 'CA ID NV WA', 'Oregon Division of Financial Regulation', 'https://dfr.oregon.gov/Pages/index.aspx'],
  ['PA', 'Pennsylvania', 'DE MD NJ NY OH WV', 'Pennsylvania Department of Banking and Securities', 'https://www.pa.gov/agencies/dobs'],
  ['RI', 'Rhode Island', 'CT MA', 'Rhode Island Department of Business Regulation', 'https://dbr.ri.gov/'],
  ['SC', 'South Carolina', 'GA NC', 'South Carolina State Board of Financial Institutions, Banking Division', 'https://banking.sc.gov/'],
  ['SD', 'South Dakota', 'IA MN MT ND NE WY', 'South Dakota Division of Banking', 'https://dlr.sd.gov/banking/default.aspx'],
  ['TN', 'Tennessee', 'AL AR GA KY MS MO NC VA', 'Tennessee Department of Financial Institutions', 'https://www.tn.gov/tdfi'],
  ['TX', 'Texas', 'AR LA NM OK', 'Texas Department of Banking', 'https://www.dob.texas.gov'],
  ['UT', 'Utah', 'AZ CO ID NV WY', 'Utah Department of Financial Institutions', 'https://dfi.utah.gov/'],
  ['VT', 'Vermont', 'MA NH NY', 'Vermont Department of Financial Regulation', 'https://dfr.vermont.gov/'],
  ['VA', 'Virginia', 'DC KY MD NC TN WV', 'Virginia State Corporation Commission, Bureau of Financial Institutions', 'https://www.scc.virginia.gov/regulated-industries/bureau-of-financial-institutions/'],
  ['WA', 'Washington', 'ID OR', 'Washington State Department of Financial Institutions', 'https://dfi.wa.gov/'],
  ['WV', 'West Virginia', 'KY MD OH PA VA', 'West Virginia Division of Financial Institutions', 'https://dfi.wv.gov/'],
  ['WI', 'Wisconsin', 'IL IA MI MN', 'Wisconsin Department of Financial Institutions', 'https://dfi.wi.gov/Pages/Home.aspx'],
  ['WY', 'Wyoming', 'CO ID MT NE SD UT', 'Wyoming Division of Banking', 'https://wyomingbankingdivision.wyo.gov/'],
];

export const STATES: StateInfo[] = rows
  .map(([code, name, neighbors, regulatorName, regulatorUrl]) => ({
    code,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    withArticle: code === 'DC' ? `the ${name}` : name,
    short: code === 'DC' ? 'DC' : name,
    neighbors: neighbors.split(' '),
    regulator: { name: regulatorName, url: regulatorUrl },
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const STATE_BY_CODE: Record<string, StateInfo> = Object.fromEntries(STATES.map((s) => [s.code, s]));

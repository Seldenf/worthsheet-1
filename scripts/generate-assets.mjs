#!/usr/bin/env node
/**
 * Generates the downloadable assets in public/downloads/:
 *   - personal-financial-statement-template-blank.pdf  (printable blank PFS)
 *   - personal-financial-statement-example.pdf         (filled example, fictional data)
 *   - sba-form-413-pfs-worksheet.xlsx                  (SBA Form 413-style worksheet with formulas)
 *
 * Structure follows the template PFS tab (docs/source/template-pfs.tsv).
 * Example figures live in scripts/pfs-example.json (also rendered by the example page).
 *
 * Run: npm run assets
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import ExcelJS from 'exceljs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'downloads');
const EXAMPLE = JSON.parse(await readFile(join(ROOT, 'scripts', 'pfs-example.json'), 'utf8'));

const FOOTER = 'worthsheet.com \u2014 free PFS template';
const FIXED_DATE = new Date('2026-11-06T12:00:00Z');

/* ------------------------------------------------------------------ */
/* Template structure (from the PFS tab of WorthSheet Template_v2)     */
/* ------------------------------------------------------------------ */

const BLANK_ASSETS = [
  { name: 'Checking accounts', hints: ['Bank name', 'Bank name'] },
  { name: 'Savings accounts', hints: ['Bank name', 'Bank name'] },
  { name: 'Retirement accounts', hints: ['401(k), 403(b), IRA, pension', 'IRA broker name'] },
  { name: 'Investment accounts', hints: ['Broker name', 'Broker name'] },
  { name: 'Real estate', hints: ['Primary residence address', 'Additional property address'] },
  { name: 'Auto, boat, RV', hints: ['Name & mileage', 'Name & mileage'] },
  { name: 'Private business interest', hints: ['Name of business'] },
  {
    name: 'Other',
    hints: ['Name of property (insurance, valuable)', 'Name of property (insurance, valuable)', 'Name of property (insurance, valuable)'],
  },
];

const BLANK_LIABILITIES = [
  { name: 'Credit cards', hints: ['Credit card name', 'Credit card name'] },
  { name: 'Home loans', hints: ['Mortgage bank name', 'HELOC bank name'] },
  { name: 'Student loans', hints: ['Subsidized', 'Non-subsidized'] },
  { name: 'Auto, boat, RV loans', hints: ['Auto loan bank name', 'Boat or RV loan lender'] },
  { name: 'Notes payable', hints: ['Note payable (lender)', 'Note payable (lender)'] },
  { name: 'Other obligations', hints: ['Other obligation', 'Other obligation'] },
];

/* ------------------------------------------------------------------ */
/* Example data checks                                                 */
/* ------------------------------------------------------------------ */

const sum = (groups) => groups.reduce((t, g) => t + g.rows.reduce((s, r) => s + r.value, 0), 0);
const groupTotal = (g) => g.rows.reduce((s, r) => s + r.value, 0);
const usd = (n) => '$' + Math.round(n).toLocaleString('en-US');

const totalAssets = sum(EXAMPLE.assets);
const totalLiabilities = sum(EXAMPLE.liabilities);
const netWorth = totalAssets - totalLiabilities;

function assertEqual(label, actual, expected) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}
assertEqual('total assets', totalAssets, 412500);
assertEqual('total liabilities', totalLiabilities, 186200);
assertEqual('net worth', netWorth, 226300);
const expectGroups = {
  Checking: 18400,
  Savings: 45000,
  Retirement: 149100,
  'Real estate': 200000,
  'Home loans': 168000,
  'Student loans': 11200,
  'Credit cards': 7000,
};
for (const g of [...EXAMPLE.assets, ...EXAMPLE.liabilities]) {
  const key = Object.keys(expectGroups).find((k) => g.name.startsWith(k));
  assertEqual(`group ${g.name}`, groupTotal(g), expectGroups[key]);
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 40;
const GAP = 28;
const COL_W = (PAGE_W - MARGIN * 2 - GAP) / 2; // 252
const COL_X = [MARGIN, MARGIN + COL_W + GAP];

const INK = rgb(0.18, 0.16, 0.15);
const GREY = rgb(0.4, 0.38, 0.37);
const LIGHT = rgb(0.91, 0.906, 0.898);
const SURFACE = rgb(0.96, 0.953, 0.949);
const HAIR = rgb(0.78, 0.77, 0.76);
const WHITE = rgb(1, 1, 1);
const GREEN = rgb(0.1, 0.5, 0.25);
const AMBER_BG = rgb(0.99, 0.94, 0.8);
const AMBER = rgb(0.45, 0.3, 0.02);

function fitText(font, text, size, maxW) {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + '...', size) > maxW) t = t.slice(0, -1);
  return t.trimEnd() + '...';
}

async function buildStatementPdf({ example }) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  doc.setTitle(
    example
      ? 'Personal Financial Statement Example (fictional data) - WorthSheet'
      : 'Personal Financial Statement - printable blank template - WorthSheet',
  );
  doc.setAuthor('WorthSheet');
  doc.setCreator('WorthSheet (worthsheet.com)');
  doc.setProducer('pdf-lib');
  doc.setSubject('Personal financial statement: assets, liabilities and net worth');
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);

  const page = doc.addPage([PAGE_W, PAGE_H]);
  const text = (t, x, y, { size = 9, font = regular, color = INK } = {}) =>
    page.drawText(t, { x, y, size, font, color });
  const textRight = (t, xr, y, opts = {}) => {
    const { size = 9, font = regular } = opts;
    text(t, xr - font.widthOfTextAtSize(t, size), y, opts);
  };
  const line = (x1, y1, x2, y2, thickness = 0.6, color = HAIR) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });

  /* Header */
  text('WorthSheet', MARGIN, 768, { size: 9, font: bold, color: GREY });
  text('worthsheet.com', MARGIN + bold.widthOfTextAtSize('WorthSheet', 9) + 6, 768, { size: 9, color: GREY });

  if (example) {
    const label = 'EXAMPLE \u2014 FICTIONAL DATA';
    const w = bold.widthOfTextAtSize(label, 8.5) + 20;
    page.drawRectangle({ x: PAGE_W - MARGIN - w, y: 761, width: w, height: 19, color: AMBER_BG, borderColor: AMBER, borderWidth: 0.6 });
    text(label, PAGE_W - MARGIN - w + 10, 767, { size: 8.5, font: bold, color: AMBER });
  }

  const titleLabel = 'Personal Financial Statement of:';
  text(titleLabel, MARGIN, 736, { size: 15, font: bold });
  const nameX = MARGIN + bold.widthOfTextAtSize(titleLabel, 15) + 10;
  line(nameX, 733, PAGE_W - MARGIN, 733, 0.8, INK);
  if (example) text(EXAMPLE.name, nameX + 4, 737, { size: 11.5 });

  text('As of:', MARGIN, 709, { size: 11, font: bold });
  const asOfX = MARGIN + bold.widthOfTextAtSize('As of:', 11) + 10;
  line(asOfX, 706, asOfX + 130, 706, 0.8, INK);
  if (example) text(EXAMPLE.asOf, asOfX + 4, 710, { size: 11 });
  else text('mm/dd/yyyy', asOfX + 4, 709, { size: 8, color: HAIR });

  /* Columns */
  const geometry = example
    ? { rh: 22, size: 9.5, hsize: 9.5, gap: 8 }
    : { rh: 17, size: 8, hsize: 8.5, gap: 4 };
  const BAR_TOP = 688;
  const BAR_H = 20;

  const drawColumn = (colIndex, title, groups) => {
    const x = COL_X[colIndex];
    const xr = x + COL_W - 6;
    page.drawRectangle({ x, y: BAR_TOP - BAR_H, width: COL_W, height: BAR_H, color: INK });
    text(title.toUpperCase(), x + 8, BAR_TOP - 13.5, { size: 10, font: bold, color: WHITE });

    let top = BAR_TOP - BAR_H - 6;
    for (const group of groups) {
      // group header row
      page.drawRectangle({ x, y: top - geometry.rh, width: COL_W, height: geometry.rh, color: LIGHT });
      const base = top - geometry.rh + (geometry.rh - geometry.hsize) / 2 + 1.5;
      text(group.name.toUpperCase(), x + 6, base, { size: geometry.hsize - 0.5, font: bold });
      if (example) {
        textRight(usd(groupTotal(group)), xr, base, { size: geometry.hsize, font: bold });
      } else {
        text('$', xr - 64, base, { size: geometry.hsize, color: GREY });
        line(xr - 56, base - 2, xr, base - 2, 0.6, GREY);
      }
      top -= geometry.rh;

      const rows = example ? group.rows : group.hints.map((h) => ({ hint: h }));
      for (const row of rows) {
        const rb = top - geometry.rh + (geometry.rh - geometry.size) / 2 + 1.5;
        const maxLabel = COL_W - 14 - 60;
        if (example) {
          text(fitText(regular, row.label, geometry.size, maxLabel), x + 10, rb, { size: geometry.size });
          textRight(usd(row.value), xr, rb, { size: geometry.size });
        } else {
          text(fitText(regular, row.hint, 7.5, maxLabel), x + 10, rb, { size: 7.5, color: GREY });
          text('$', xr - 64, rb, { size: geometry.size, color: GREY });
        }
        line(x, top - geometry.rh, x + COL_W, top - geometry.rh);
        top -= geometry.rh;
      }
      top -= geometry.gap;
    }
    return top;
  };

  const assetsEnd = drawColumn(0, 'Assets', example ? EXAMPLE.assets : BLANK_ASSETS);
  const liabEnd = drawColumn(1, 'Liabilities', example ? EXAMPLE.liabilities : BLANK_LIABILITIES);

  /* Example callout in the free space under the columns */
  if (example) {
    const boxTop = Math.min(assetsEnd, liabEnd) - 18;
    const boxH = 96;
    const boxBottom = boxTop - boxH;
    if (boxBottom > 222) {
      page.drawRectangle({ x: MARGIN, y: boxBottom, width: PAGE_W - MARGIN * 2, height: boxH, color: SURFACE, borderColor: HAIR, borderWidth: 0.6 });
      text('How the numbers tie out', MARGIN + 12, boxTop - 20, { size: 10, font: bold });
      text(`Total assets ${usd(totalAssets)} - total liabilities ${usd(totalLiabilities)} = net worth ${usd(netWorth)}.`, MARGIN + 12, boxTop - 38, { size: 9 });
      text('Each category total is the sum of the accounts listed under it, and the statement is dated to a single "as of" day.', MARGIN + 12, boxTop - 54, { size: 9 });
      text('Categories with no balance are left off. Every name, address and number on this page is fictional.', MARGIN + 12, boxTop - 70, { size: 9 });
    }
  }

  /* Totals */
  const TOT_TOP = 204;
  const TOT_H = 26;
  const totals = [
    ['TOTAL ASSETS', totalAssets],
    ['TOTAL LIABILITIES', totalLiabilities],
  ];
  totals.forEach(([label, value], i) => {
    const x = COL_X[i];
    page.drawRectangle({ x, y: TOT_TOP - TOT_H, width: COL_W, height: TOT_H, color: SURFACE, borderColor: INK, borderWidth: 0.8 });
    text(label, x + 8, TOT_TOP - 17, { size: 9.5, font: bold });
    if (example) textRight(usd(value), x + COL_W - 8, TOT_TOP - 17, { size: 12, font: bold });
    else {
      text('$', x + COL_W - 118, TOT_TOP - 17, { size: 11, color: GREY });
      line(x + COL_W - 108, TOT_TOP - 19, x + COL_W - 8, TOT_TOP - 19, 0.8, INK);
    }
  });

  const NW_TOP = TOT_TOP - TOT_H - 6;
  const NW_H = 30;
  page.drawRectangle({ x: MARGIN, y: NW_TOP - NW_H, width: PAGE_W - MARGIN * 2, height: NW_H, color: INK });
  text('NET WORTH', MARGIN + 10, NW_TOP - 19, { size: 12, font: bold, color: WHITE });
  text('Total assets - total liabilities', MARGIN + 92, NW_TOP - 19, { size: 8.5, color: rgb(0.85, 0.84, 0.83) });
  if (example) textRight(usd(netWorth), PAGE_W - MARGIN - 10, NW_TOP - 20, { size: 15, font: bold, color: WHITE });
  else {
    text('$', PAGE_W - MARGIN - 130, NW_TOP - 20, { size: 13, color: WHITE });
    line(PAGE_W - MARGIN - 118, NW_TOP - 22, PAGE_W - MARGIN - 10, NW_TOP - 22, 0.9, WHITE);
  }

  /* Signature & date */
  const SIG_Y = 106;
  text('Signature:', MARGIN, SIG_Y + 3, { size: 10, font: bold });
  line(MARGIN + 56, SIG_Y, 360, SIG_Y, 0.8, INK);
  text('Date:', 392, SIG_Y + 3, { size: 10, font: bold });
  line(422, SIG_Y, PAGE_W - MARGIN, SIG_Y, 0.8, INK);
  if (example) {
    text(EXAMPLE.signedBy, MARGIN + 62, SIG_Y + 4, { size: 11, font: italic });
    text(EXAMPLE.asOf, 428, SIG_Y + 4, { size: 11 });
  }
  text(
    'I certify that the information above is true and complete to the best of my knowledge.',
    MARGIN,
    SIG_Y - 14,
    { size: 7.5, color: GREY },
  );
  if (!example) {
    text(
      'Enter the most recent balance of each account at current market value. Add a line for every extra account.',
      MARGIN,
      SIG_Y - 26,
      { size: 7.5, color: GREY },
    );
  }

  /* Footer */
  line(MARGIN, 54, PAGE_W - MARGIN, 54, 0.6);
  const fw = regular.widthOfTextAtSize(FOOTER, 8.5);
  text(FOOTER, (PAGE_W - fw) / 2, 41, { size: 8.5, color: GREY });

  return doc.save();
}

/* ------------------------------------------------------------------ */
/* XLSX: SBA Form 413-style worksheet                                  */
/* ------------------------------------------------------------------ */

const OFFICIAL_URL = 'https://www.sba.gov/document/sba-form-413-personal-financial-statement';
const NOTE =
  'Worksheet to organize your numbers \u2014 submit the official SBA Form 413 to your lender.';
const SECTIONS_SHEET = 'Sections 2-8';
const S = (ref) => `'${SECTIONS_SHEET}'!${ref}`;

const CAT = {
  retirement: 'IRA or other retirement account',
  receivable: 'Accounts & notes receivable',
  autos: 'Automobiles',
  personal: 'Other personal property',
  other: 'Other assets',
};

const MONEY = '$#,##0;[Red]($#,##0);"-"';
const FILL_INPUT = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } };
const FILL_CALC = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDECEA' } };
const FILL_HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E2926' } };
const FILL_SECTION = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F2F9' } };
const THIN = { style: 'thin', color: { argb: 'FFC9C6C3' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const FONT = { name: 'Arial', size: 10 };

function style(cell, opts = {}) {
  cell.font = { ...FONT, ...(opts.font ?? {}) };
  if (opts.fill) cell.fill = opts.fill;
  if (opts.border !== false) cell.border = BORDER;
  cell.alignment = { vertical: 'middle', wrapText: true, ...(opts.alignment ?? {}) };
  if (opts.numFmt) cell.numFmt = opts.numFmt;
}

const input = (cell, numFmt = MONEY) => style(cell, { fill: FILL_INPUT, numFmt });
const calc = (cell, formula, numFmt = MONEY, bold = false) => {
  cell.value = { formula, result: 0 };
  style(cell, { fill: FILL_CALC, numFmt, font: { bold } });
};
const label = (cell, value, bold = false) => {
  cell.value = value;
  style(cell, { font: { bold } });
};
const head = (cell, value, align = 'left') => {
  cell.value = value;
  style(cell, { fill: FILL_HEAD, font: { bold: true, color: { argb: 'FFFFFFFF' } }, alignment: { horizontal: align } });
};

async function buildWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'WorthSheet';
  wb.title = 'SBA Form 413-style personal financial statement worksheet';
  wb.subject = 'Worksheet to organize numbers before completing the official SBA Form 413';
  wb.company = 'WorthSheet (worthsheet.com)';
  wb.created = FIXED_DATE;
  wb.modified = FIXED_DATE;
  wb.calcProperties = { fullCalcOnLoad: true };

  const main = wb.addWorksheet('Form 413 Worksheet', {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 1, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const det = wb.addWorksheet(SECTIONS_SHEET, {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 1, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const help = wb.addWorksheet('Read me', { views: [{ showGridLines: false }] });

  /* ---------------- Sections 2-8 (detail tables) ---------------- */
  det.columns = [
    { width: 38 },
    { width: 28 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 26 },
    { width: 28 },
  ];
  const ref = {}; // addresses used by the front sheet

  let r = 1;
  det.mergeCells(`A${r}:G${r}`);
  det.getCell(`A${r}`).value = 'Sections 2\u20138: detail tables (mirrors the section layout of SBA Form 413, 05-24 edition)';
  det.getCell(`A${r}`).font = { ...FONT, size: 14, bold: true };
  r++;
  det.mergeCells(`A${r}:G${r}`);
  det.getCell(`A${r}`).value = NOTE;
  det.getCell(`A${r}`).font = { ...FONT, bold: true };
  r++;
  det.mergeCells(`A${r}:G${r}`);
  det.getCell(`A${r}`).value =
    'Yellow cells are for your entries; grey cells calculate automatically and feed the front sheet. Omit cents. Attach extra pages if you need more rows (the official form allows signed attachments).';
  det.getCell(`A${r}`).font = { ...FONT, color: { argb: 'FF5A5552' } };
  det.getCell(`A${r}`).alignment = { wrapText: true, vertical: 'top' };
  det.getRow(r).height = 30;
  r += 2;

  const sectionTitle = (text) => {
    det.mergeCells(`A${r}:G${r}`);
    const c = det.getCell(`A${r}`);
    c.value = text;
    style(c, { fill: FILL_SECTION, font: { bold: true, size: 11 }, border: false });
    det.getRow(r).height = 22;
    r++;
  };
  const headers = (cols) => {
    cols.forEach((t, i) => head(det.getCell(r, i + 1), t, i === 0 ? 'left' : 'center'));
    det.getRow(r).height = 32;
    r++;
  };
  const blankRows = (n, cols, money = []) => {
    const first = r;
    for (let i = 0; i < n; i++) {
      for (let c = 1; c <= cols; c++) input(det.getCell(r, c), money.includes(c) ? MONEY : 'General');
      r++;
    }
    return [first, r - 1];
  };

  // Section 2
  sectionTitle('Section 2. Notes Payable to Banks and Others');
  headers(['Names and addresses of noteholder(s)', 'Original balance', 'Current balance', 'Payment amount', 'Frequency (monthly, etc.)', 'How secured or endorsed / type of collateral']);
  {
    const [a, b] = blankRows(6, 6, [2, 3, 4]);
    label(det.getCell(r, 1), 'Total', true);
    calc(det.getCell(r, 2), `SUM(B${a}:B${b})`, MONEY, true);
    calc(det.getCell(r, 3), `SUM(C${a}:C${b})`, MONEY, true);
    calc(det.getCell(r, 4), `SUM(D${a}:D${b})`, MONEY, true);
    ref.notes = S(`$C$${r}`);
    r += 2;
  }

  // Section 3
  sectionTitle('Section 3. Stocks and Bonds');
  headers(['Name of securities', 'Number of shares', 'Cost', 'Market value quotation (per share/unit)', 'Date of quotation', 'Total value']);
  {
    const first = r;
    for (let i = 0; i < 8; i++) {
      input(det.getCell(r, 1), 'General');
      input(det.getCell(r, 2), '#,##0.####');
      input(det.getCell(r, 3));
      input(det.getCell(r, 4), '$#,##0.00');
      input(det.getCell(r, 5), 'mm/dd/yyyy');
      calc(det.getCell(r, 6), `IF(AND(ISNUMBER(B${r}),ISNUMBER(D${r})),B${r}*D${r},0)`);
      r++;
    }
    const last = r - 1;
    label(det.getCell(r, 1), 'Total (shares \u00d7 quotation; type over a grey cell if a holding is priced differently)', true);
    calc(det.getCell(r, 3), `SUM(C${first}:C${last})`, MONEY, true);
    calc(det.getCell(r, 6), `SUM(F${first}:F${last})`, MONEY, true);
    det.getRow(r).height = 30;
    ref.stocks = S(`$F$${r}`);
    r += 2;
  }

  // Section 4
  sectionTitle('Section 4. Real Estate Owned (list each parcel separately)');
  {
    ['', 'Property A', 'Property B', 'Property C', 'Total'].forEach((t, i) => head(det.getCell(r, i + 1), t, i === 0 ? 'left' : 'center'));
    r++;
    const rows = [
      ['Type of real estate (primary residence, rental, land, etc.)', 'text'],
      ['Address', 'text'],
      ['Date purchased', 'date'],
      ['Original cost', 'money'],
      ['Present market value', 'money'],
      ['Name & address of mortgage holder', 'text'],
      ['Mortgage account number', 'text'],
      ['Mortgage balance', 'money'],
      ['Amount of payment per month/year', 'money'],
      ['Status of mortgage', 'text'],
    ];
    for (const [name, kind] of rows) {
      label(det.getCell(r, 1), name);
      for (let c = 2; c <= 4; c++) {
        input(det.getCell(r, c), kind === 'money' ? MONEY : kind === 'date' ? 'mm/dd/yyyy' : 'General');
      }
      if (kind === 'money') {
        calc(det.getCell(r, 5), `SUM(B${r}:D${r})`, MONEY, true);
      } else {
        style(det.getCell(r, 5), { fill: FILL_CALC });
      }
      if (name === 'Present market value') ref.realEstate = S(`$E$${r}`);
      if (name === 'Mortgage balance') ref.mortgages = S(`$E$${r}`);
      if (kind === 'text') det.getRow(r).height = name.startsWith('Name &') || name === 'Address' ? 32 : 20;
      r++;
    }
    r++;
  }

  // Section 5
  sectionTitle('Section 5. Other Personal Property and Other Assets (describe; state any lien holder, amount of lien, terms of payment and any delinquency)');
  headers(['Description (for automobiles include year / make / model)', 'Category', 'Value', 'Name & address of lien holder', 'Amount of lien', 'Terms of payment', 'If delinquent, describe']);
  {
    const first = r;
    for (let i = 0; i < 12; i++) {
      input(det.getCell(r, 1), 'General');
      input(det.getCell(r, 2), 'General');
      input(det.getCell(r, 3));
      input(det.getCell(r, 4), 'General');
      input(det.getCell(r, 5));
      input(det.getCell(r, 6), 'General');
      input(det.getCell(r, 7), 'General');
      det.getCell(r, 2).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`"${Object.values(CAT).join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Pick a category',
        error: 'Choose one of the listed categories so the front sheet totals correctly.',
      };
      r++;
    }
    const last = r - 1;
    label(det.getCell(r, 1), 'Total', true);
    calc(det.getCell(r, 3), `SUM(C${first}:C${last})`, MONEY, true);
    calc(det.getCell(r, 5), `SUM(E${first}:E${last})`, MONEY, true);
    ref.s5 = (cat) => `SUMIF(${S(`$B$${first}:$B$${last}`)},"${cat}",${S(`$C$${first}:$C$${last}`)})`;
    r += 2;
  }

  // Section 6
  sectionTitle('Section 6. Unpaid Taxes (type, to whom payable, when due, amount, property to which any tax lien attaches)');
  headers(['Type of tax', 'To whom payable', 'When due', 'Amount', 'Property the tax lien attaches to']);
  {
    const first = r;
    for (let i = 0; i < 5; i++) {
      input(det.getCell(r, 1), 'General');
      input(det.getCell(r, 2), 'General');
      input(det.getCell(r, 3), 'mm/dd/yyyy');
      input(det.getCell(r, 4));
      input(det.getCell(r, 5), 'General');
      r++;
    }
    label(det.getCell(r, 1), 'Total', true);
    calc(det.getCell(r, 4), `SUM(D${first}:D${r - 1})`, MONEY, true);
    ref.taxes = S(`$D$${r}`);
    r += 2;
  }

  // Section 7
  sectionTitle('Section 7. Other Liabilities (describe in detail)');
  headers(['Description', 'Amount']);
  {
    const first = r;
    for (let i = 0; i < 5; i++) {
      input(det.getCell(r, 1), 'General');
      input(det.getCell(r, 2));
      r++;
    }
    label(det.getCell(r, 1), 'Total', true);
    calc(det.getCell(r, 2), `SUM(B${first}:B${r - 1})`, MONEY, true);
    ref.otherLiab = S(`$B$${r}`);
    r += 2;
  }

  // Section 8
  sectionTitle('Section 8. Life Insurance Held (face amount and cash surrender value; insurance company and beneficiaries)');
  headers(['Name of insurance company', 'Beneficiaries', 'Face amount', 'Cash surrender value']);
  {
    const first = r;
    for (let i = 0; i < 5; i++) {
      input(det.getCell(r, 1), 'General');
      input(det.getCell(r, 2), 'General');
      input(det.getCell(r, 3));
      input(det.getCell(r, 4));
      r++;
    }
    label(det.getCell(r, 1), 'Total', true);
    calc(det.getCell(r, 3), `SUM(C${first}:C${r - 1})`, MONEY, true);
    calc(det.getCell(r, 4), `SUM(D${first}:D${r - 1})`, MONEY, true);
    ref.lifeCsv = S(`$D$${r}`);
    r++;
  }

  /* ---------------- Front sheet ---------------- */
  main.columns = [{ width: 52 }, { width: 18 }, { width: 3 }, { width: 52 }, { width: 18 }, { width: 18 }];

  main.mergeCells('A1:F1');
  main.getCell('A1').value = 'SBA Form 413-style Personal Financial Statement \u2014 Worksheet';
  main.getCell('A1').font = { ...FONT, size: 16, bold: true };
  main.getRow(1).height = 26;

  main.mergeCells('A2:F2');
  main.getCell('A2').value = NOTE;
  main.getCell('A2').font = { ...FONT, size: 11, bold: true, color: { argb: 'FF9A3412' } };

  main.mergeCells('A3:F3');
  main.getCell('A3').value =
    'Section names follow SBA Form 413 (05-24 edition) so your numbers line up with the official form. This is not an official SBA document and does not replace the form or your lender\u2019s own statement.';
  main.getCell('A3').alignment = { wrapText: true, vertical: 'top' };
  main.getCell('A3').font = { ...FONT, color: { argb: 'FF5A5552' } };
  main.getRow(3).height = 30;

  main.mergeCells('A4:F4');
  main.getCell('A4').value = { text: `Get the official form: ${OFFICIAL_URL}`, hyperlink: OFFICIAL_URL };
  main.getCell('A4').font = { ...FONT, color: { argb: 'FF0B6FA4' }, underline: true };

  const field = (row, name, numFmt = 'General') => {
    label(main.getCell(row, 1), name, true);
    main.mergeCells(`B${row}:E${row}`);
    input(main.getCell(row, 2), numFmt);
    for (const c of [3, 4, 5]) style(main.getCell(row, c), { fill: FILL_INPUT });
    main.getCell(row, 2).alignment = { horizontal: 'left', vertical: 'middle' };
  };
  field(6, 'Name');
  field(7, 'Business name of applicant / borrower');
  field(8, 'This information is current as of (mm/dd/yyyy)', 'mm/dd/yyyy');

  main.mergeCells('A9:F9');
  main.getCell('A9').value =
    'Timing: SBA Form 413 says the information must be current within 120 days of submission for 7(a), 504, surety bond, 8(a) BD and WOSB (within 90 days for Disaster). SOP 50 10 8.1 asks lenders for guarantor statements dated within 90 days of loan approval. Follow your lender\u2019s checklist.';
  main.getCell('A9').alignment = { wrapText: true, vertical: 'top' };
  main.getCell('A9').font = { ...FONT, size: 9, color: { argb: 'FF5A5552' } };
  main.getRow(9).height = 40;

  main.mergeCells('A10:F10');
  main.getCell('A10').value = 'Yellow cells = enter your numbers (omit cents).  Grey cells = calculated, do not overwrite.';
  main.getCell('A10').font = { ...FONT, size: 9, italic: true };

  // Assets / liabilities
  const HR = 12;
  head(main.getCell(HR, 1), 'ASSETS (omit cents)');
  head(main.getCell(HR, 2), 'Amount', 'right');
  head(main.getCell(HR, 4), 'LIABILITIES (omit cents)');
  head(main.getCell(HR, 5), 'Amount', 'right');
  head(main.getCell(HR, 6), 'Monthly payment', 'right');

  const assets = [
    ['Cash on hand & in banks', null],
    ['Savings accounts', null],
    ['IRA or other retirement account (describe in Section 5)', ref.s5(CAT.retirement)],
    ['Accounts & notes receivable (describe in Section 5)', ref.s5(CAT.receivable)],
    ['Life insurance \u2014 cash surrender value only (complete Section 8)', ref.lifeCsv],
    ['Stocks and bonds (describe in Section 3)', ref.stocks],
    ['Real estate (describe in Section 4)', ref.realEstate],
    ['Automobiles (describe in Section 5; include year/make/model)', ref.s5(CAT.autos)],
    ['Other personal property (describe in Section 5)', ref.s5(CAT.personal)],
    ['Other assets (describe in Section 5)', ref.s5(CAT.other)],
  ];
  const liabilities = [
    ['Accounts payable', null, false],
    ['Notes payable to banks and others (describe in Section 2)', ref.notes, false],
    ['Installment account (auto)', null, true],
    ['Installment account (other)', null, true],
    ['Loan(s) against life insurance', null, false],
    ['Mortgages on real estate (describe in Section 4)', ref.mortgages, false],
    ['Unpaid taxes (describe in Section 6)', ref.taxes, false],
    ['Other liabilities (describe in Section 7)', ref.otherLiab, false],
  ];

  const A1 = HR + 1; // first asset row
  const A_END = A1 + assets.length - 1;
  assets.forEach(([name, formula], i) => {
    const row = A1 + i;
    label(main.getCell(row, 1), name);
    if (formula) calc(main.getCell(row, 2), formula);
    else input(main.getCell(row, 2));
    main.getRow(row).height = 20;
  });
  const A_TOTAL = A_END + 1;
  label(main.getCell(A_TOTAL, 1), 'Total assets', true);
  calc(main.getCell(A_TOTAL, 2), `SUM(B${A1}:B${A_END})`, MONEY, true);

  liabilities.forEach(([name, formula, monthly], i) => {
    const row = A1 + i;
    label(main.getCell(row, 4), name);
    if (formula) calc(main.getCell(row, 5), formula);
    else input(main.getCell(row, 5));
    if (monthly) input(main.getCell(row, 6));
    else style(main.getCell(row, 6), { fill: FILL_CALC });
  });
  const L_END = A1 + liabilities.length - 1;
  const L_TOTAL = L_END + 1;
  const NW = L_TOTAL + 1;
  const NW_TOTAL = NW + 1;
  label(main.getCell(L_TOTAL, 4), 'Total liabilities', true);
  calc(main.getCell(L_TOTAL, 5), `SUM(E${A1}:E${L_END})`, MONEY, true);
  label(main.getCell(NW, 4), 'Net worth (total assets \u2212 total liabilities)', true);
  calc(main.getCell(NW, 5), `B${A_TOTAL}-E${L_TOTAL}`, MONEY, true);
  label(main.getCell(NW_TOTAL, 4), 'Total liabilities and net worth', true);
  calc(main.getCell(NW_TOTAL, 5), `E${L_TOTAL}+E${NW}`, MONEY, true);
  for (const row of [L_TOTAL, NW, NW_TOTAL]) {
    style(main.getCell(row, 6), { fill: FILL_CALC });
  }
  const CHECK = NW_TOTAL + 1;
  label(main.getCell(CHECK, 4), 'Tie-out: total liabilities and net worth must equal total assets');
  main.getCell(CHECK, 4).font = { ...FONT, size: 9 };
  main.getRow(CHECK).height = 26;
  main.getCell(CHECK, 5).value = { formula: `IF(E${NW_TOTAL}=B${A_TOTAL},"OK","Check totals")`, result: 'OK' };
  style(main.getCell(CHECK, 5), { fill: FILL_CALC, font: { bold: true }, alignment: { horizontal: 'right' } });

  // Section 1 and contingent liabilities
  let q = CHECK + 2;
  head(main.getCell(q, 1), 'SECTION 1. SOURCE OF INCOME (annual)');
  head(main.getCell(q, 2), 'Amount', 'right');
  head(main.getCell(q, 4), 'CONTINGENT LIABILITIES');
  head(main.getCell(q, 5), 'Amount', 'right');
  q++;
  const income = ['Salary', 'Net investment income', 'Real estate income', 'Other income (describe below)'];
  const contingent = ['As endorser or co-maker', 'Legal claims & judgments', 'Provision for federal income tax', 'Other special debt'];
  const q0 = q;
  income.forEach((name, i) => {
    label(main.getCell(q + i, 1), name);
    input(main.getCell(q + i, 2));
    label(main.getCell(q + i, 4), contingent[i]);
    input(main.getCell(q + i, 5));
  });
  q += income.length;
  label(main.getCell(q, 1), 'Total income', true);
  calc(main.getCell(q, 2), `SUM(B${q0}:B${q - 1})`, MONEY, true);
  label(main.getCell(q, 4), 'Total contingent liabilities', true);
  calc(main.getCell(q, 5), `SUM(E${q0}:E${q - 1})`, MONEY, true);
  q += 2;

  main.mergeCells(`A${q}:F${q}`);
  main.getCell(`A${q}`).value =
    'Description of other income in Section 1 (alimony or child support payments should not be disclosed in "Other Income" unless you want them counted toward total income)';
  main.getCell(`A${q}`).font = { ...FONT, bold: true };
  main.getCell(`A${q}`).alignment = { wrapText: true, vertical: 'top' };
  main.getRow(q).height = 30;
  q++;
  main.mergeCells(`A${q}:F${q}`);
  input(main.getCell(`A${q}`), 'General');
  main.getCell(`A${q}`).alignment = { wrapText: true, vertical: 'top' };
  main.getRow(q).height = 48;
  q += 2;

  main.mergeCells(`A${q}:F${q}`);
  main.getCell(`A${q}`).value =
    'Next step: copy these figures onto the official SBA Form 413 (or the equivalent statement your lender accepts), then review, sign and date it there. Signatures and certifications are not part of this worksheet.';
  main.getCell(`A${q}`).alignment = { wrapText: true, vertical: 'top' };
  main.getCell(`A${q}`).font = { ...FONT, bold: true };
  main.getRow(q).height = 34;
  q += 2;
  main.mergeCells(`A${q}:F${q}`);
  main.getCell(`A${q}`).value = 'WorthSheet \u2014 worthsheet.com. Estimates for educational purposes only. Not a loan offer or financial advice.';
  main.getCell(`A${q}`).font = { ...FONT, size: 9, color: { argb: 'FF5A5552' } };

  /* ---------------- Read me ---------------- */
  help.columns = [{ width: 110 }];
  const lines = [
    ['SBA Form 413-style worksheet \u2014 how to use it', 'title'],
    [NOTE, 'bold'],
    ['', ''],
    ['1. Fill the yellow cells on "Sections 2-8" first: notes payable, stocks and bonds, real estate, other personal property and assets, unpaid taxes, other liabilities and life insurance.', ''],
    ['2. On "Section 5", pick a category for each row. The front sheet adds up retirement accounts, receivables, automobiles, other personal property and other assets from those categories.', ''],
    ['3. On "Form 413 Worksheet", enter cash, savings, accounts payable, installment accounts, loans against life insurance, income and contingent liabilities. Grey cells calculate themselves.', ''],
    ['4. Use the figures to complete the official SBA Form 413 (or your lender\u2019s equivalent). Submit the official form, not this worksheet, to your lender.', ''],
    ['', ''],
    ['Good to know', 'bold'],
    ['\u2022 The form says omit cents, so amounts are formatted as whole dollars.', ''],
    ['\u2022 "Current as of" timing: the form says within 120 days of submission for 7(a)/504/SBG/8(a) BD/WOSB and 90 days for Disaster; SOP 50 10 8.1 asks lenders for guarantor statements dated within 90 days of loan approval. Ask your lender which date window applies.', ''],
    ['\u2022 Which lender, CDC or surety company receives the form, and who must sign it, depends on the program \u2014 follow the checklist your lender gives you.', ''],
    ['\u2022 Use the same market-value basis everywhere and keep the statements that support each figure.', ''],
    ['', ''],
    [`Official form: ${OFFICIAL_URL}`, 'link'],
    ['More guidance: https://worthsheet.com/sba-form-413/', ''],
    ['', ''],
    ['Estimates for educational purposes only. Not a loan offer or financial advice. This worksheet is not an official SBA document.', 'muted'],
  ];
  lines.forEach(([t, kind], i) => {
    const c = help.getCell(i + 1, 1);
    c.alignment = { wrapText: true, vertical: 'top' };
    if (kind === 'link') c.value = { text: t, hyperlink: OFFICIAL_URL };
    else c.value = t;
    c.font = {
      ...FONT,
      size: kind === 'title' ? 14 : 10,
      bold: kind === 'title' || kind === 'bold',
      ...(kind === 'link' ? { color: { argb: 'FF0B6FA4' }, underline: true } : {}),
      ...(kind === 'muted' ? { color: { argb: 'FF5A5552' } } : {}),
    };
  });

  return wb.xlsx.writeBuffer();
}

/* ------------------------------------------------------------------ */

await mkdir(OUT, { recursive: true });

const blank = await buildStatementPdf({ example: false });
await writeFile(join(OUT, 'personal-financial-statement-template-blank.pdf'), blank);

const filled = await buildStatementPdf({ example: true });
await writeFile(join(OUT, 'personal-financial-statement-example.pdf'), filled);

const xlsx = await buildWorkbook();
await writeFile(join(OUT, 'sba-form-413-pfs-worksheet.xlsx'), Buffer.from(xlsx));

console.log(
  `Wrote 3 files to public/downloads (example: assets ${usd(totalAssets)}, liabilities ${usd(totalLiabilities)}, net worth ${usd(netWorth)})`,
);

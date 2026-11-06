/**
 * Per-term page metadata from the keyword plan (section 4.1): exact H1 question and <title> tag.
 * Slugs match the file names in `src/content/glossary/`. Topic groups follow the plan's hub grouping.
 */

export type GlossaryTopic =
  | 'Statements & net worth'
  | 'Credit & lenders'
  | 'Ratios'
  | 'Mortgage terms';

export interface GlossaryMeta {
  h1: string;
  title: string;
  topic: GlossaryTopic;
}

export const GLOSSARY_META: Record<string, GlossaryMeta> = {
  'personal-financial-statement': {
    h1: 'What is a personal financial statement?',
    title: 'Personal financial statement (PFS): Definition | WorthSheet',
    topic: 'Statements & net worth',
  },
  'net-worth': {
    h1: 'What is net worth?',
    title: 'Net worth: Definition & Examples | WorthSheet',
    topic: 'Statements & net worth',
  },
  'net-worth-statement': {
    h1: 'What is a net worth statement?',
    title: 'Net worth statement: Definition & Examples | WorthSheet',
    topic: 'Statements & net worth',
  },
  'personal-balance-sheet': {
    h1: 'What is a personal balance sheet?',
    title: 'Balance sheet (personal): Definition & Examples | WorthSheet',
    topic: 'Statements & net worth',
  },
  assets: {
    h1: 'What are assets?',
    title: 'Assets: Definition & Examples | WorthSheet',
    topic: 'Statements & net worth',
  },
  liabilities: {
    h1: 'What are liabilities?',
    title: 'Liabilities: Definition & Examples | WorthSheet',
    topic: 'Statements & net worth',
  },
  'liquid-assets': {
    h1: 'What are liquid assets?',
    title: 'Liquid assets: Definition & Examples | WorthSheet',
    topic: 'Statements & net worth',
  },
  'debt-to-income-ratio': {
    h1: 'What is a debt-to-income ratio?',
    title: 'Debt-to-income ratio (DTI): Definition | WorthSheet',
    topic: 'Ratios',
  },
  'front-end-dti': {
    h1: 'What is front-end DTI?',
    title: 'Front-end DTI: Definition & Examples | WorthSheet',
    topic: 'Ratios',
  },
  'back-end-dti': {
    h1: 'What is back-end DTI?',
    title: 'Back-end DTI: Definition & Examples | WorthSheet',
    topic: 'Ratios',
  },
  'loan-to-value-ratio': {
    h1: 'What is a loan-to-value ratio?',
    title: 'Loan-to-value ratio (LTV): Definition | WorthSheet',
    topic: 'Ratios',
  },
  'five-cs-of-credit': {
    h1: "What are the five C's of credit?",
    title: "Five C's of credit: Definition & Examples | WorthSheet",
    topic: 'Credit & lenders',
  },
  'credit-report': {
    h1: 'What is a credit report?',
    title: 'Credit report: Definition & Examples | WorthSheet',
    topic: 'Credit & lenders',
  },
  'credit-score': {
    h1: 'What is a credit score?',
    title: 'Credit score: Definition & Examples | WorthSheet',
    topic: 'Credit & lenders',
  },
  'fico-score': {
    h1: 'What is a FICO score?',
    title: 'FICO score: Definition & Examples | WorthSheet',
    topic: 'Credit & lenders',
  },
  collateral: {
    h1: 'What is collateral?',
    title: 'Collateral: Definition & Examples | WorthSheet',
    topic: 'Credit & lenders',
  },
  'capacity-credit': {
    h1: "What is capacity in the five C's of credit?",
    title: 'Capacity (credit): Definition & Examples | WorthSheet',
    topic: 'Credit & lenders',
  },
  'character-credit': {
    h1: "What is character in the five C's of credit?",
    title: 'Character (credit): Definition & Examples | WorthSheet',
    topic: 'Credit & lenders',
  },
  'capital-credit': {
    h1: "What is capital in the five C's of credit?",
    title: 'Capital (credit): Definition & Examples | WorthSheet',
    topic: 'Credit & lenders',
  },
  'conditions-credit': {
    h1: "What are conditions in the five C's of credit?",
    title: 'Conditions (credit): Definition & Examples | WorthSheet',
    topic: 'Credit & lenders',
  },
  'pre-approval': {
    h1: 'What is a mortgage pre-approval?',
    title: 'Pre-approval: Definition & Examples | WorthSheet',
    topic: 'Mortgage terms',
  },
  'pre-qualification': {
    h1: 'What is mortgage pre-qualification?',
    title: 'Pre-qualification: Definition & Examples | WorthSheet',
    topic: 'Mortgage terms',
  },
  pmi: {
    h1: 'What is PMI?',
    title: 'Private mortgage insurance (PMI): Definition | WorthSheet',
    topic: 'Mortgage terms',
  },
  amortization: {
    h1: 'What is amortization?',
    title: 'Amortization: Definition & Examples | WorthSheet',
    topic: 'Mortgage terms',
  },
  apr: {
    h1: 'What is APR?',
    title: 'Annual percentage rate (APR): Definition | WorthSheet',
    topic: 'Mortgage terms',
  },
  'sba-form-413': {
    h1: 'What is SBA Form 413?',
    title: 'SBA Form 413: Definition & Examples | WorthSheet',
    topic: 'Statements & net worth',
  },
  'contingent-liabilities': {
    h1: 'What are contingent liabilities?',
    title: 'Contingent liabilities: Definition & Examples | WorthSheet',
    topic: 'Statements & net worth',
  },
  'down-payment': {
    h1: 'What is a down payment?',
    title: 'Down payment: Definition & Examples | WorthSheet',
    topic: 'Mortgage terms',
  },
  escrow: {
    h1: 'What is escrow?',
    title: 'Escrow: Definition & Examples | WorthSheet',
    topic: 'Mortgage terms',
  },
  underwriting: {
    h1: 'What is mortgage underwriting?',
    title: 'Underwriting: Definition & Examples | WorthSheet',
    topic: 'Credit & lenders',
  },
};

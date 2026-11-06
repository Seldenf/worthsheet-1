export const SITE_NAME = 'WorthSheet';

export const TEMPLATE_SHEET_ID = '1LmlBm_R6UAxpyMbrdcyAGbE8bytZXIU0QgT9Qtb_yao';
export const TEMPLATE_COPY_URL = `https://docs.google.com/spreadsheets/d/${TEMPLATE_SHEET_ID}/copy`;
export const TEMPLATE_XLSX_URL = `https://docs.google.com/spreadsheets/d/${TEMPLATE_SHEET_ID}/export?format=xlsx`;

export const LEADS_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbx_u49xlUCB8PNIz83qjuUtS8c9cxEHpFD2w82qNPP5ITzrbDAanV2C0NxUX5Ce4KE9/exec';

export const GA_ID = 'G-RVHR897PTG';

export const PURPOSES = [
  'Mortgage',
  'SBA or business loan',
  'Personal loan',
  'Financial advisor',
  'Other',
] as const;

export const STATS = {
  downloads: '9,000+',
  assetCategories: 27,
  liabilityCategories: 13,
} as const;

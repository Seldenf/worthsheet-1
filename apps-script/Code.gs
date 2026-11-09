/**
 * WorthSheet lead collector.
 * Bound to the leads spreadsheet; deployed as a Web app (Execute as: Me, Access: Anyone).
 * The site POSTs application/x-www-form-urlencoded fields:
 *   email (required), name (required), zip, purpose, page, referrer, website (honeypot, must be empty)
 * Each saved lead emails a notification to the comma-separated addresses in the
 * NOTIFY_EMAILS script property (Project Settings → Script Properties), or to the
 * script owner when that property is unset.
 */

const SHEET_NAME = 'Leads';
const HEADERS = ['timestamp', 'email', 'name', 'zip', 'purpose', 'page', 'referrer'];
const PURPOSES = ['Mortgage', 'SBA or business loan', 'Personal loan', 'Financial advisor', 'Other', ''];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function doPost(e) {
  const p = (e && e.parameter) || {};

  // Bots fill every field; humans never see this one.
  if (p.website) return json_({ ok: true });

  const email = clean_(p.email, 254).toLowerCase();
  const name = clean_(p.name, 100);
  const zip = clean_(p.zip, 10);
  const purpose = clean_(p.purpose, 40);

  if (!EMAIL_RE.test(email)) return json_({ ok: false, error: 'invalid_email' });
  if (!name) return json_({ ok: false, error: 'missing_name' });
  if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) return json_({ ok: false, error: 'invalid_zip' });
  if (PURPOSES.indexOf(purpose) === -1) return json_({ ok: false, error: 'invalid_purpose' });
  const page = clean_(p.page, 200);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet_().appendRow([
      new Date(),
      email,
      name,
      zip,
      purpose,
      page,
      clean_(p.referrer, 500),
    ]);
  } finally {
    lock.releaseLock();
  }

  // The lead is already saved; a mail quota/delivery failure must not fail the visitor's download.
  // Failures are written to the "Errors" tab so they are visible without opening the execution log.
  try {
    notify_({ email: email, name: name, zip: zip, purpose: purpose, page: page });
  } catch (err) {
    console.error('notify failed: ' + err);
    logError_('notify', err);
  }
  return json_({ ok: true });
}

/**
 * Run this once from the editor (select testNotify → Run). It triggers the Gmail send permission
 * prompt for the account that owns the Web app deployment and sends a test notification.
 * After that, redeploy: Deploy → Manage deployments → Edit → Version: New version → Deploy.
 */
function testNotify() {
  notify_({ email: 'test@example.com', name: 'Test lead', zip: '', purpose: 'Other', page: '/download/' });
  console.log('Sent to: ' + recipients_() + ' | remaining daily quota: ' + MailApp.getRemainingDailyQuota());
}

function recipients_() {
  return (
    PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAILS') || Session.getEffectiveUser().getEmail()
  );
}

function logError_(where, err) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Errors') || ss.insertSheet('Errors');
  sh.appendRow([new Date(), where, String(err)]);
}

function notify_(lead) {
  const to = recipients_();
  MailApp.sendEmail({
    to: to,
    subject: 'New WorthSheet signup: ' + lead.name,
    body: [
      'Name: ' + lead.name,
      'Email: ' + lead.email,
      'ZIP: ' + (lead.zip || '-'),
      'Purpose: ' + (lead.purpose || '-'),
      'Page: ' + (lead.page || '-'),
      '',
      SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    ].join('\n'),
  });
}

function doGet() {
  return json_({ ok: true, service: 'worthsheet-leads' });
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

// Trims, caps length, and neutralises spreadsheet formula injection (=, +, -, @).
function clean_(v, max) {
  const s = String(v == null ? '' : v).trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

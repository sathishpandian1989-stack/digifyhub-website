/**
 * Digifyhub — lead form backend (Google Apps Script Web App)
 *
 * Receives enquiries from the website form, validates and sanitises them,
 * generates a unique Lead ID, prevents duplicate rows, saves each lead to the
 * "Leads" sheet, emails a notification, and records every processing step in a
 * private "Logs" sheet. Failed notification emails are retried on a timer.
 *
 * Setup: see apps-script/README.md. In short — paste this file into
 * Extensions → Apps Script of your Google Sheet, run setup() once, then
 * Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 */

const CONFIG = {
  NOTIFY_EMAIL: 'sathishpandian1989@gmail.com',
  SPREADSHEET_ID: '',            // leave blank when the script is bound to the sheet
  LEADS_SHEET: 'Leads',
  LOGS_SHEET: 'Logs',
  TIMEZONE: 'Asia/Kolkata',
  SERVICES: ['SEO', 'Google Ads', 'Meta Ads', 'Social Media', 'Website', 'Lead Generation', 'Other'],
  LIMITS: { name: 80, phone: 20, email: 120, business: 120, message: 1000, landingPage: 200 },
  MIN_FILL_MS: 2500,             // faster than this is treated as a bot
  DUPLICATE_WINDOW_HOURS: 24,    // same email/phone within this window is flagged, not discarded
  RATE_LIMIT_MAX: 5,             // submissions per contact within the window below
  RATE_LIMIT_WINDOW_SEC: 600,
  MAX_EMAIL_RETRIES: 5,
  LOG_RETENTION_DAYS: 90,
};

const LEAD_HEADERS = [
  'Lead ID', 'Timestamp', 'Name', 'Phone', 'Email', 'Business Name', 'Service Interest', 'Message',
  'Landing Page / Source', 'Consent', 'Processing Status', 'Error / Retry Status', 'Email Retries',
  'Duplicate Flag', 'Lead Status', 'Follow-up Status', 'Follow-up Date', 'Submission Key',
];
const LOG_HEADERS = ['Timestamp', 'Correlation ID', 'Lead ID', 'Event', 'Status', 'Code', 'Details'];
const COL = LEAD_HEADERS.reduce((m, h, i) => { m[h] = i + 1; return m; }, {});

const STATUS = {
  RECEIVED: 'RECEIVED', VALIDATED: 'VALIDATED', SHEET_SAVED: 'SHEET_SAVED',
  EMAIL_SENT: 'EMAIL_SENT', RETRY_PENDING: 'RETRY_PENDING', FAILED: 'FAILED',
};

/* ------------------------------------------------------------------ */
/* HTTP entry points                                                   */
/* ------------------------------------------------------------------ */

function doGet() {
  return json_({ ok: true, service: 'digifyhub-leads', time: new Date().toISOString() });
}

function doPost(e) {
  const cid = Utilities.getUuid().slice(0, 8).toUpperCase();
  let leadId = '';
  try {
    const raw = parseBody_(e);
    log_(cid, '', 'SUBMISSION', STATUS.RECEIVED, '', '');

    // Honeypot / timing traps: answer like a success so bots learn nothing, but store nothing.
    if (raw.website || Number(raw.fillTimeMs || 0) < CONFIG.MIN_FILL_MS) {
      log_(cid, '', 'SPAM_BLOCKED', STATUS.FAILED, raw.website ? 'HONEYPOT' : 'TOO_FAST', '');
      return json_({ ok: true, leadId: '', spam: true });
    }

    const { data, errors } = validate_(raw);
    if (Object.keys(errors).length) {
      log_(cid, '', 'VALIDATION', STATUS.FAILED, 'VALIDATION_FAILED', 'fields=' + Object.keys(errors).join(','));
      return json_({ ok: false, code: 'VALIDATION', errors: errors, ref: cid });
    }
    log_(cid, '', 'VALIDATION', STATUS.VALIDATED, '', '');

    if (isRateLimited_(data)) {
      log_(cid, '', 'RATE_LIMIT', STATUS.FAILED, 'RATE_LIMITED', '');
      return json_({ ok: false, code: 'RATE_LIMITED', ref: cid });
    }

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) {
      log_(cid, '', 'LOCK', STATUS.FAILED, 'LOCK_TIMEOUT', '');
      return json_({ ok: false, code: 'BUSY', ref: cid });
    }
    let row;
    try {
      const sheet = getSheet_(CONFIG.LEADS_SHEET, LEAD_HEADERS);

      // Idempotency: the same submission key (double-click, refresh, network retry) never creates a second row.
      const existing = findLeadBySubmissionKey_(sheet, data.submissionKey);
      if (existing) {
        log_(cid, existing, 'DUPLICATE_SUBMISSION', 'REUSED', 'IDEMPOTENT_REPLAY', 'key=' + hash_(data.submissionKey));
        return json_({ ok: true, leadId: existing, duplicate: true });
      }

      leadId = newLeadId_(sheet);
      const duplicateOf = findRecentDuplicate_(sheet, data);
      if (duplicateOf) log_(cid, leadId, 'POSSIBLE_DUPLICATE', 'FLAGGED', 'SAME_CONTACT', 'matches ' + duplicateOf);

      const values = LEAD_HEADERS.map(() => '');
      values[COL['Lead ID'] - 1] = leadId;
      values[COL['Timestamp'] - 1] = new Date();
      values[COL['Name'] - 1] = safe_(data.name);
      values[COL['Phone'] - 1] = "'" + data.phone; // keep as text (leading + and zeros)
      values[COL['Email'] - 1] = safe_(data.email);
      values[COL['Business Name'] - 1] = safe_(data.business);
      values[COL['Service Interest'] - 1] = data.service;
      values[COL['Message'] - 1] = safe_(data.message);
      values[COL['Landing Page / Source'] - 1] = safe_(data.landingPage);
      values[COL['Consent'] - 1] = 'Yes';
      values[COL['Processing Status'] - 1] = STATUS.SHEET_SAVED;
      values[COL['Email Retries'] - 1] = 0;
      values[COL['Duplicate Flag'] - 1] = duplicateOf ? 'Possible duplicate of ' + duplicateOf : '';
      values[COL['Lead Status'] - 1] = 'New';
      values[COL['Follow-up Status'] - 1] = 'Not started';
      values[COL['Submission Key'] - 1] = data.submissionKey;

      row = withRetry_(() => {
        sheet.appendRow(values);
        SpreadsheetApp.flush();
        return sheet.getLastRow();
      }, 3);
      CacheService.getScriptCache().put('sk:' + data.submissionKey, leadId, 21600);
      log_(cid, leadId, 'SHEET_WRITE', STATUS.SHEET_SAVED, '', 'row=' + row);
    } catch (err) {
      log_(cid, leadId, 'SHEET_WRITE', STATUS.FAILED, 'SHEET_ERROR', String(err && err.message || err));
      return json_({ ok: false, code: 'SAVE_FAILED', ref: cid });
    } finally {
      lock.releaseLock();
    }

    // The lead is durably saved; an email failure must not turn this into an error for the visitor.
    sendNotification_(cid, leadId, row, data);
    return json_({ ok: true, leadId: leadId });
  } catch (err) {
    log_(cid, leadId, 'UNEXPECTED', STATUS.FAILED, 'SERVER_ERROR', String(err && err.stack || err).slice(0, 500));
    return json_({ ok: false, code: 'SERVER_ERROR', ref: cid });
  }
}

/* ------------------------------------------------------------------ */
/* Validation & sanitising                                             */
/* ------------------------------------------------------------------ */

function parseBody_(e) {
  if (e && e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (err) { /* fall through to form fields */ }
  }
  return (e && e.parameter) || {};
}

function clean_(v, max) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Prevent spreadsheet formula injection from user-entered text. */
function safe_(v) {
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function validate_(raw) {
  const L = CONFIG.LIMITS;
  const data = {
    name: clean_(raw.name, L.name),
    phone: clean_(raw.phone, L.phone),
    email: clean_(raw.email, L.email).toLowerCase(),
    business: clean_(raw.business, L.business),
    service: clean_(raw.service, 40),
    message: clean_(raw.message, L.message + 1).replace(/\n{3,}/g, '\n\n'),
    landingPage: clean_(raw.landingPage || raw.pageUrl, L.landingPage),
    consent: raw.consent === true || raw.consent === 'true' || raw.consent === 'on',
    submissionKey: clean_(raw.submissionKey, 64),
  };
  const errors = {};
  if (data.name.length < 2) errors.name = 'Please enter your name.';
  const digits = data.phone.replace(/\D/g, '');
  if (!/^\+?[\d\s\-().]{7,20}$/.test(data.phone) || digits.length < 7 || digits.length > 15) {
    errors.phone = 'Please enter a valid phone number.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) errors.email = 'Please enter a valid email address.';
  if (!data.business) errors.business = 'Please enter your business name.';
  if (data.service && CONFIG.SERVICES.indexOf(data.service) === -1) errors.service = 'Please choose a service from the list.';
  if (data.message.length > L.message) errors.message = 'Please keep your message under ' + L.message + ' characters.';
  if ((data.message.match(/https?:\/\//gi) || []).length > 3) errors.message = 'Please include no more than 3 links.';
  if (!data.consent) errors.consent = 'Please confirm you agree so we can respond.';
  if (!/^[\w-]{8,64}$/.test(data.submissionKey)) data.submissionKey = Utilities.getUuid();
  return { data: data, errors: errors };
}

function normPhone_(p) { return String(p).replace(/\D/g, '').slice(-10); }

function isRateLimited_(data) {
  const cache = CacheService.getScriptCache();
  const key = 'rl:' + hash_(data.email + '|' + normPhone_(data.phone));
  const count = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(count), CONFIG.RATE_LIMIT_WINDOW_SEC);
  return count > CONFIG.RATE_LIMIT_MAX;
}

/* ------------------------------------------------------------------ */
/* Lead ID, idempotency & duplicates                                   */
/* ------------------------------------------------------------------ */

function newLeadId_(sheet) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const day = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd');
  for (let attempt = 0; attempt < 10; attempt++) {
    let token = '';
    for (let i = 0; i < 6; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    const id = 'LEAD-' + day + '-' + token;
    const hit = sheet.getRange(1, COL['Lead ID'], Math.max(sheet.getLastRow(), 1), 1)
      .createTextFinder(id).matchEntireCell(true).findNext();
    if (!hit) return id; // uniqueness is checked, not assumed
  }
  throw new Error('Could not generate a unique Lead ID');
}

function findLeadBySubmissionKey_(sheet, key) {
  const cached = CacheService.getScriptCache().get('sk:' + key);
  if (cached) return cached;
  const last = sheet.getLastRow();
  if (last < 2) return '';
  const hit = sheet.getRange(2, COL['Submission Key'], last - 1, 1)
    .createTextFinder(key).matchEntireCell(true).findNext();
  return hit ? String(sheet.getRange(hit.getRow(), COL['Lead ID']).getValue()) : '';
}

function findRecentDuplicate_(sheet, data) {
  const last = sheet.getLastRow();
  if (last < 2) return '';
  const n = Math.min(last - 1, 500);
  const rows = sheet.getRange(last - n + 1, 1, n, LEAD_HEADERS.length).getValues();
  const since = Date.now() - CONFIG.DUPLICATE_WINDOW_HOURS * 3600 * 1000;
  const phone = normPhone_(data.phone);
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    const ts = r[COL['Timestamp'] - 1];
    if (!(ts instanceof Date) || ts.getTime() < since) continue;
    const sameEmail = String(r[COL['Email'] - 1]).toLowerCase() === data.email;
    const samePhone = normPhone_(r[COL['Phone'] - 1]) === phone;
    if (sameEmail || samePhone) return String(r[COL['Lead ID'] - 1]);
  }
  return '';
}

/* ------------------------------------------------------------------ */
/* Email notification & retries                                        */
/* ------------------------------------------------------------------ */

function sendNotification_(cid, leadId, row, data) {
  const sheet = getSheet_(CONFIG.LEADS_SHEET, LEAD_HEADERS);
  try {
    sendLeadEmail_(leadId, data);
    sheet.getRange(row, COL['Processing Status']).setValue(STATUS.EMAIL_SENT);
    log_(cid, leadId, 'EMAIL', STATUS.EMAIL_SENT, '', 'to=' + CONFIG.NOTIFY_EMAIL);
  } catch (err) {
    sheet.getRange(row, COL['Processing Status']).setValue(STATUS.RETRY_PENDING);
    sheet.getRange(row, COL['Error / Retry Status']).setValue('EMAIL_FAILED: ' + String(err.message || err).slice(0, 200));
    log_(cid, leadId, 'EMAIL', STATUS.RETRY_PENDING, 'EMAIL_ERROR', String(err.message || err).slice(0, 300));
  }
}

function sendLeadEmail_(leadId, d) {
  const esc = (s) => String(s || '—').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rows = [
    ['Lead ID', leadId], ['Name', d.name], ['Phone', d.phone], ['Email', d.email],
    ['Business', d.business], ['Service', d.service || 'Not specified'], ['Message', d.message],
    ['Landing page', d.landingPage],
    ['Received', Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'dd MMM yyyy, HH:mm') + ' IST'],
  ];
  const html =
    '<div style="font-family:Arial,sans-serif;max-width:600px">' +
    '<div style="background:#061A40;color:#fff;padding:18px 22px;border-radius:10px 10px 0 0">' +
    '<h2 style="margin:0;font-size:18px">New website enquiry — ' + esc(leadId) + '</h2></div>' +
    '<table style="width:100%;border-collapse:collapse;border:1px solid #e3e9f3">' +
    rows.map((r) => '<tr><td style="padding:10px 14px;background:#f4f7fc;font-weight:bold;width:140px;vertical-align:top">' + esc(r[0]) +
      '</td><td style="padding:10px 14px;white-space:pre-wrap">' + esc(r[1]) + '</td></tr>').join('') +
    '</table>' +
    '<p style="font-size:13px;color:#64728a">Reply to this email to respond to the lead directly. ' +
    'Call: <a href="tel:' + esc(d.phone.replace(/[^\d+]/g, '')) + '">' + esc(d.phone) + '</a> · ' +
    'WhatsApp: <a href="https://wa.me/' + esc(d.phone.replace(/\D/g, '')) + '">open chat</a></p></div>';
  const text = rows.map((r) => r[0] + ': ' + (r[1] || '—')).join('\n');

  MailApp.sendEmail({
    to: CONFIG.NOTIFY_EMAIL,
    subject: '[Digifyhub] New lead ' + leadId + ' — ' + d.business,
    body: text,
    htmlBody: html,
    replyTo: d.email,
    name: 'Digifyhub Website',
  });
}

/** Time-driven trigger (installed by setup): retries notification emails that failed. */
function retryPendingEmails() {
  const sheet = getSheet_(CONFIG.LEADS_SHEET, LEAD_HEADERS);
  const last = sheet.getLastRow();
  if (last < 2) return;
  const rows = sheet.getRange(2, 1, last - 1, LEAD_HEADERS.length).getValues();
  rows.forEach((r, i) => {
    if (r[COL['Processing Status'] - 1] !== STATUS.RETRY_PENDING) return;
    const row = i + 2;
    const leadId = String(r[COL['Lead ID'] - 1]);
    const tries = Number(r[COL['Email Retries'] - 1] || 0) + 1;
    const data = {
      name: String(r[COL['Name'] - 1]), phone: String(r[COL['Phone'] - 1]).replace(/^'/, ''),
      email: String(r[COL['Email'] - 1]), business: String(r[COL['Business Name'] - 1]),
      service: String(r[COL['Service Interest'] - 1]), message: String(r[COL['Message'] - 1]),
      landingPage: String(r[COL['Landing Page / Source'] - 1]),
    };
    sheet.getRange(row, COL['Email Retries']).setValue(tries);
    try {
      sendLeadEmail_(leadId, data);
      sheet.getRange(row, COL['Processing Status']).setValue(STATUS.EMAIL_SENT);
      sheet.getRange(row, COL['Error / Retry Status']).setValue('Sent on retry ' + tries);
      log_('RETRY', leadId, 'EMAIL_RETRY', STATUS.EMAIL_SENT, '', 'attempt=' + tries);
    } catch (err) {
      const giveUp = tries >= CONFIG.MAX_EMAIL_RETRIES;
      sheet.getRange(row, COL['Processing Status']).setValue(giveUp ? STATUS.FAILED : STATUS.RETRY_PENDING);
      sheet.getRange(row, COL['Error / Retry Status']).setValue('EMAIL_FAILED x' + tries + ': ' + String(err.message || err).slice(0, 150));
      log_('RETRY', leadId, 'EMAIL_RETRY', giveUp ? STATUS.FAILED : STATUS.RETRY_PENDING, 'EMAIL_ERROR', 'attempt=' + tries);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Setup, maintenance & helpers                                        */
/* ------------------------------------------------------------------ */

/** Run once from the Apps Script editor: creates sheets, formatting and triggers. */
function setup() {
  const leads = getSheet_(CONFIG.LEADS_SHEET, LEAD_HEADERS);
  const logs = getSheet_(CONFIG.LOGS_SHEET, LOG_HEADERS);

  [leads, logs].forEach((s) => {
    s.setFrozenRows(1);
    s.getRange(1, 1, 1, s.getLastColumn()).setFontWeight('bold').setBackground('#061A40').setFontColor('#ffffff');
  });
  leads.getRange('B:B').setNumberFormat('dd-mmm-yyyy hh:mm');
  leads.getRange('Q:Q').setNumberFormat('dd-mmm-yyyy');
  logs.getRange('A:A').setNumberFormat('dd-mmm-yyyy hh:mm:ss');
  leads.setColumnWidths(1, LEAD_HEADERS.length, 150);
  leads.setColumnWidth(COL['Message'], 320);

  const listRule = (items) => SpreadsheetApp.newDataValidation().requireValueInList(items, true).setAllowInvalid(false).build();
  leads.getRange(2, COL['Lead Status'], 5000, 1).setDataValidation(listRule(['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost', 'Spam']));
  leads.getRange(2, COL['Follow-up Status'], 5000, 1).setDataValidation(listRule(['Not started', 'Scheduled', 'In progress', 'Done']));
  leads.getRange(2, COL['Follow-up Date'], 5000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireDate().build());

  const status = leads.getRange(2, COL['Processing Status'], 5000, 1);
  const cf = (text, color) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(text).setBackground(color).setRanges([status]).build();
  leads.setConditionalFormatRules([cf(STATUS.EMAIL_SENT, '#dbf7ef'), cf(STATUS.RETRY_PENDING, '#fff4d6'), cf(STATUS.FAILED, '#ffe0e8')]);

  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('retryPendingEmails').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('cleanupLogs').timeBased().everyDays(1).atHour(3).create();
  log_('SETUP', '', 'SETUP', 'OK', '', 'sheets and triggers ready');
}

/** Daily trigger: removes technical log rows older than the retention period. */
function cleanupLogs() {
  const logs = getSheet_(CONFIG.LOGS_SHEET, LOG_HEADERS);
  const last = logs.getLastRow();
  if (last < 2) return;
  const cutoff = Date.now() - CONFIG.LOG_RETENTION_DAYS * 86400000;
  const stamps = logs.getRange(2, 1, last - 1, 1).getValues();
  let count = 0;
  while (count < stamps.length && stamps[count][0] instanceof Date && stamps[count][0].getTime() < cutoff) count++;
  if (count) logs.deleteRows(2, count);
}

/** Manual end-to-end test from the editor: creates one test lead and sends the email. */
function testSubmission() {
  const res = doPost({ postData: { contents: JSON.stringify({
    name: 'Test Lead', phone: '+91 98765 43210', email: CONFIG.NOTIFY_EMAIL, business: 'Test Business',
    service: 'SEO', message: 'Apps Script test submission', consent: true, landingPage: 'apps-script-test',
    submissionKey: Utilities.getUuid(), fillTimeMs: 10000,
  }) } });
  Logger.log(res.getContent());
}

function getSheet_(name, headers) {
  const ss = CONFIG.SPREADSHEET_ID ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

/** Logs contain IDs, codes and steps — never full form payloads or credentials. */
function log_(cid, leadId, event, status, code, details) {
  try {
    getSheet_(CONFIG.LOGS_SHEET, LOG_HEADERS).appendRow([new Date(), cid, leadId, event, status, code, details]);
  } catch (err) {
    console.error('log failed', err);
  }
}

function withRetry_(fn, attempts) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return fn(); } catch (err) { lastErr = err; Utilities.sleep(500 * Math.pow(2, i)); }
  }
  throw lastErr;
}

function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s))
    .map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('').slice(0, 16);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

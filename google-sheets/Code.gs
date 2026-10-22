/**
 * Family Finance ↔ Google Sheets bridge.
 *
 * Setup (one time):
 *   1. Create a Google Sheet, then Extensions → Apps Script.
 *   2. Replace everything in Code.gs with this file and change SECRET below.
 *   3. Deploy → New deployment → type "Web app",
 *      Execute as: Me, Who has access: Anyone → Deploy, authorize, copy the /exec URL.
 *   4. In the app: Settings → Google Sheets → paste the URL and the same secret.
 *
 * Each collection is stored in its own tab (members, incomes, expenses, …) with one row per record,
 * so the sheet stays readable. Nested fields (EMI shares, trip items…) are stored as JSON in a cell.
 */

const SECRET = 'change-me-to-something-long';

const TABLES = ['members', 'incomes', 'expenses', 'cards', 'emis', 'trips', 'goals'];
const META = '_meta';
const BUDGETS = 'budgets';

function doGet(e) {
  if (!authorized(e.parameter.token)) return json({ ok: false, error: 'Invalid secret key' });
  return json({ ok: true, data: readAll() });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'Bad request body' });
  }
  if (!authorized(body.token)) return json({ ok: false, error: 'Invalid secret key' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const savedAt = writeAll(body.data);
    return json({ ok: true, savedAt: savedAt });
  } finally {
    lock.releaseLock();
  }
}

function authorized(token) {
  return SECRET && SECRET !== 'change-me-to-something-long' && token === SECRET;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

// ---------- write ----------

function typeOf(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return 'number';
  if (typeof v === 'boolean') return 'boolean';
  if (typeof v === 'object') return 'json';
  return 'string';
}

function writeTable(name, rows) {
  const sh = sheet(name);
  sh.clear();
  const cols = [];
  const types = {};
  rows.forEach(function (r) {
    Object.keys(r).forEach(function (k) {
      if (cols.indexOf(k) === -1) cols.push(k);
      const t = typeOf(r[k]);
      if (t && !types[k]) types[k] = t;
    });
  });
  if (!cols.length) return types;
  const values = [cols].concat(rows.map(function (r) {
    return cols.map(function (k) {
      const v = r[k];
      if (v === null || v === undefined) return '';
      return types[k] === 'json' ? JSON.stringify(v) : v;
    });
  }));
  // Text format on string/json columns stops Sheets turning "2026-10-01" into a date or "0421" into 421
  cols.forEach(function (k, i) {
    if (types[k] === 'string' || types[k] === 'json') sh.getRange(1, i + 1, values.length, 1).setNumberFormat('@');
  });
  sh.getRange(1, 1, values.length, cols.length).setValues(values);
  sh.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#eef2ff');
  sh.setFrozenRows(1);
  return types;
}

function writeAll(data) {
  const columns = {};
  TABLES.forEach(function (t) {
    columns[t] = writeTable(t, data[t] || []);
  });
  const budgets = Object.keys(data.budgets || {}).map(function (k) {
    return { category: k, amount: data.budgets[k] };
  });
  columns[BUDGETS] = writeTable(BUDGETS, budgets);

  const savedAt = new Date().toISOString();
  const meta = sheet(META);
  meta.clear();
  meta.getRange(1, 1, 1, 2).setNumberFormat('@').setValues([['state', JSON.stringify({
    version: data.version,
    isSample: !!data.isSample,
    settings: data.settings,
    columns: columns,
    savedAt: savedAt,
  })]]);
  meta.hideSheet();
  return savedAt;
}

// ---------- read ----------

function readTable(name, types) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const cols = values[0];
  const tz = Session.getScriptTimeZone();
  return values.slice(1).filter(function (row) {
    return row.some(function (c) { return c !== ''; });
  }).map(function (row) {
    const obj = {};
    cols.forEach(function (k, i) {
      let v = row[i];
      if (v === '' || v === null) return;
      if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
      const t = (types && types[k]) || typeOf(v);
      if (t === 'number') v = Number(v);
      else if (t === 'boolean') v = v === true || String(v).toUpperCase() === 'TRUE';
      else if (t === 'json') { try { v = JSON.parse(v); } catch (err) { /* keep raw text */ } }
      else v = String(v);
      obj[k] = v;
    });
    return obj;
  });
}

function readAll() {
  const metaSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(META);
  if (!metaSheet) return null; // nothing saved yet
  const meta = JSON.parse(metaSheet.getRange(1, 2).getValue() || '{}');
  const columns = meta.columns || {};
  const data = { version: meta.version || 1, isSample: !!meta.isSample, settings: meta.settings, savedAt: meta.savedAt };
  TABLES.forEach(function (t) {
    data[t] = readTable(t, columns[t]);
  });
  data.budgets = {};
  readTable(BUDGETS, columns[BUDGETS]).forEach(function (r) {
    data.budgets[r.category] = Number(r.amount);
  });
  return data;
}

// The rule engine: compare the fields extracted from each document and report
// where they disagree. It is deterministic on purpose. The AI reads the documents
// and adds judgement afterwards, but it cannot talk these findings away, and a
// document that says "ignore all discrepancies" has no effect on them.
//
// Runs on the server for real packs and in the browser for the homepage demo.
import { checkImo, checkContainer, checkIban, checkBic, checkLei, checkAbn, checkAcn, checkIncoterm } from './checks.js';

// Every field the extractor may return. `group` makes fields comparable across
// documents under different names: a B/L "shipper" and an invoice "seller" are
// expected to be the same legal entity.
export const FIELDS = {
  seller: { label: 'Seller', kind: 'party', group: 'seller_party' },
  exporter: { label: 'Exporter', kind: 'party', group: 'seller_party' },
  shipper: { label: 'Shipper', kind: 'party', group: 'seller_party' },
  beneficiary: { label: 'Beneficiary', kind: 'party', group: 'seller_party' },
  buyer: { label: 'Buyer', kind: 'party', group: 'buyer_party' },
  applicant: { label: 'L/C applicant', kind: 'party', group: 'buyer_party' },
  consignee: { label: 'Consignee', kind: 'party', group: 'consignee' },
  notify_party: { label: 'Notify party', kind: 'party', group: 'notify_party' },
  account_name: { label: 'Bank account name', kind: 'party', group: 'account_name' },
  bank_name: { label: 'Bank', kind: 'text', group: 'bank_name' },
  iban: { label: 'IBAN', kind: 'ref', group: 'iban', check: checkIban },
  swift_bic: { label: 'SWIFT / BIC', kind: 'ref', group: 'swift_bic', check: checkBic },
  account_number: { label: 'Account number', kind: 'ref', group: 'account_number' },
  lei: { label: 'LEI', kind: 'ref', group: 'lei', check: checkLei },
  abn: { label: 'ABN', kind: 'ref', group: 'abn', check: checkAbn },
  acn: { label: 'ACN', kind: 'ref', group: 'acn', check: checkAcn },
  company_registration: { label: 'Company registration', kind: 'ref', group: 'company_registration' },
  commodity: { label: 'Commodity', kind: 'text', group: 'commodity' },
  hs_code: { label: 'HS code', kind: 'hs', group: 'hs_code' },
  net_quantity: { label: 'Net quantity', kind: 'quantity', group: 'net_quantity' },
  gross_weight: { label: 'Gross weight', kind: 'quantity', group: 'gross_weight' },
  packages: { label: 'Packages', kind: 'quantity', group: 'packages' },
  unit_price: { label: 'Unit price', kind: 'money', group: 'unit_price' },
  total_amount: { label: 'Total amount', kind: 'money', group: 'total_amount' },
  incoterm: { label: 'Incoterm', kind: 'incoterm', group: 'incoterm', check: checkIncoterm },
  port_of_loading: { label: 'Port of loading', kind: 'place', group: 'port_of_loading' },
  port_of_discharge: { label: 'Port of discharge', kind: 'place', group: 'port_of_discharge' },
  country_of_origin: { label: 'Country of origin', kind: 'place', group: 'country_of_origin' },
  vessel_name: { label: 'Vessel', kind: 'vessel', group: 'vessel_name' },
  voyage_number: { label: 'Voyage', kind: 'ref', group: 'voyage_number' },
  imo_number: { label: 'IMO number', kind: 'ref', group: 'imo_number', check: checkImo },
  container_number: { label: 'Container numbers', kind: 'set', group: 'container_number', check: checkContainer },
  seal_number: { label: 'Seal numbers', kind: 'set', group: 'seal_number' },
  bl_number: { label: 'B/L number', kind: 'ref', group: 'bl_number' },
  invoice_number: { label: 'Invoice number', kind: 'ref', group: 'invoice_number' },
  contract_number: { label: 'Contract number', kind: 'ref', group: 'contract_number' },
  lc_number: { label: 'L/C number', kind: 'ref', group: 'lc_number' },
  certificate_number: { label: 'Certificate number', kind: 'ref', group: 'certificate_number' },
  invoice_date: { label: 'Invoice date', kind: 'date', group: 'invoice_date' },
  contract_date: { label: 'Contract date', kind: 'date', group: 'contract_date' },
  shipment_date: { label: 'Shipment date', kind: 'date', group: 'shipment_date' },
  on_board_date: { label: 'Shipped on board', kind: 'date', group: 'shipment_date' },
  bl_issue_date: { label: 'B/L issue date', kind: 'date', group: 'bl_issue_date' },
  latest_shipment_date: { label: 'Latest shipment date', kind: 'date', group: 'latest_shipment_date' },
  lc_expiry_date: { label: 'L/C expiry', kind: 'date', group: 'lc_expiry_date' },
  lc_issue_date: { label: 'L/C issue date', kind: 'date', group: 'lc_issue_date' },
  certificate_date: { label: 'Certificate date', kind: 'date', group: 'certificate_date' },
  company_registration_date: { label: 'Company registration date', kind: 'date', group: 'company_registration_date' },
};

export const FIELD_KEYS = Object.keys(FIELDS);

const GROUP_LABELS = {
  seller_party: 'Seller / shipper / beneficiary',
  buyer_party: 'Buyer / applicant',
  shipment_date: 'Shipment date',
};

const SUFFIXES = [
  [/\bPRIVATE LIMITED\b/g, 'PTE LTD'], [/\bPVT\.? LTD\b/g, 'PTE LTD'], [/\bPROPRIETARY LIMITED\b/g, 'PTY LTD'],
  [/\bLIMITED\b/g, 'LTD'], [/\bCORPORATION\b/g, 'CORP'], [/\bINCORPORATED\b/g, 'INC'], [/\bCOMPANY\b/g, 'CO'],
  [/\bLIMITED LIABILITY COMPANY\b/g, 'LLC'], [/\bAND\b/g, '&'],
];

export function normaliseParty(value) {
  let s = String(value ?? '').toUpperCase();
  s = s.replace(/(\b[A-Z])\.(?=[A-Z]\b|\s|$)/g, '$1'); // S.A. -> SA, B.V. -> BV
  s = s.replace(/[.,'"()]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [re, to] of SUFFIXES) s = s.replace(re, to);
  return s.replace(/\s+/g, ' ').trim();
}

const isToOrder = (value) => /^(TO\s+(THE\s+)?ORDER\b|TO ORDER OF\b)/i.test(String(value ?? '').trim());

function similarity(a, b) {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = i - 1;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const hold = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = hold;
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

function normaliseVessel(value) {
  return String(value ?? '').toUpperCase()
    .replace(/\b(M\s*\/?\s*[VT]|M\.[VT]\.?|MV|MT|SS)\b\.?/g, ' ')
    .replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

const normaliseRef = (value) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const normaliseText = (value) => String(value ?? '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// "1,234.56" "1.234,56" "1 234,56" "500.000" -> number. Three digits after a single
// separator is a decimal only when the unit is a tonne (see parseQuantity).
export function parseNumber(text, { threeDigitDecimal = false } = {}) {
  const m = String(text ?? '').match(/-?\d[\d\s.,']*/);
  if (!m) return null;
  const s = m[0].replace(/[\s']/g, '').replace(/[.,]$/, '');
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  let clean;
  if (dots && commas) {
    clean = s.lastIndexOf('.') > s.lastIndexOf(',') ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (commas === 1) {
    clean = /,\d{3}$/.test(s) ? s.replace(',', '') : s.replace(',', '.');
  } else if (commas > 1) {
    clean = s.replace(/,/g, '');
  } else if (dots === 1) {
    clean = /\.\d{3}$/.test(s) && !threeDigitDecimal ? s.replace('.', '') : s;
  } else if (dots > 1) {
    clean = s.replace(/\./g, '');
  } else {
    clean = s;
  }
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

const UNIT_TO_KG = [
  [/\b(METRIC\s*TONS?|METRIC\s*TONNES?|MT|MTS|M\/T|TONNES?|TONS?)\b/i, 1000, 'MT'],
  [/\b(KILOGRAMS?|KILOS?|KGS?)\b/i, 1, 'KG'],
  [/\b(POUNDS?|LBS?)\b/i, 0.45359237, 'LB'],
];

export function parseQuantity(text) {
  const s = String(text ?? '');
  for (const [re, factor, unit] of UNIT_TO_KG) {
    if (re.test(s)) {
      const value = parseNumber(s, { threeDigitDecimal: unit === 'MT' });
      return value === null ? null : { value, unit, base: value * factor, comparable: 'mass' };
    }
  }
  const other = s.match(/\b(BBLS?|BARRELS?|LITRES?|LITERS?|LTRS?|M3|CBM|PCS|PIECES|CARTONS?|CTNS?|BAGS?|DRUMS?|PALLETS?|UNITS?)\b/i);
  const value = parseNumber(s);
  if (value === null) return null;
  const unit = other ? other[1].toUpperCase().replace(/S$/, '') : '';
  return { value, unit, base: value, comparable: unit || 'count' };
}

const CURRENCY_SYMBOLS = { 'US$': 'USD', 'A$': 'AUD', '€': 'EUR', '£': 'GBP', '¥': 'CNY', $: 'USD' };

export function parseMoney(text) {
  const s = String(text ?? '').toUpperCase();
  const code = s.match(/\b(USD|AUD|EUR|GBP|CNY|RMB|JPY|SGD|HKD|AED|CHF|CAD|NZD|INR|BRL|ZAR|PGK|SAR|KRW|MYR|THB|IDR)\b/);
  let currency = code ? code[1] : null;
  if (currency === 'RMB') currency = 'CNY';
  if (!currency) {
    for (const [symbol, c] of Object.entries(CURRENCY_SYMBOLS)) {
      if (s.includes(symbol)) { currency = c; break; }
    }
  }
  const value = parseNumber(s);
  return value === null ? null : { value, currency };
}

const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12 };

function utcDay(y, m, d) {
  const t = Date.UTC(y, m - 1, d);
  const date = new Date(t);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return t;
}

const fullYear = (y) => (y < 100 ? 2000 + y : y);

// Returns { time, ambiguous }. dd/mm/yyyy wins over mm/dd/yyyy because trade
// documents are overwhelmingly written that way, but it is flagged as ambiguous
// when both readings are possible, and ambiguous dates never raise a date finding.
export function parseDate(text) {
  const s = String(text ?? '').toUpperCase().replace(/(\d)(ST|ND|RD|TH)\b/g, '$1').trim();
  let m = s.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) {
    const time = utcDay(+m[1], +m[2], +m[3]);
    return time === null ? null : { time, ambiguous: false };
  }
  m = s.match(/\b(\d{1,2})[\s\-/.]*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEPT|SEP|OCT|NOV|DEC)[A-Z]*\.?[\s\-/.,]*(\d{2,4})\b/);
  if (m) {
    const time = utcDay(fullYear(+m[3]), MONTHS[m[2]], +m[1]);
    return time === null ? null : { time, ambiguous: false };
  }
  m = s.match(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEPT|SEP|OCT|NOV|DEC)[A-Z]*\.?\s+(\d{1,2}),?\s+(\d{2,4})\b/);
  if (m) {
    const time = utcDay(fullYear(+m[3]), MONTHS[m[1]], +m[2]);
    return time === null ? null : { time, ambiguous: false };
  }
  m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) {
    const a = +m[1]; const b = +m[2]; const y = fullYear(+m[3]);
    const time = utcDay(y, b, a) ?? utcDay(y, a, b);
    return time === null ? null : { time, ambiguous: a <= 12 && b <= 12 && a !== b };
  }
  return null;
}

const fmtDate = (time) => new Date(time).toISOString().slice(0, 10);
const round = (n) => Math.round(n * 1000) / 1000;

const STATUS_RANK = { mismatch: 3, caution: 2, format: 1, match: 0, single: -1 };
const SEVERITY_RANK = { high: 3, medium: 2, low: 1 };

function compareValues(kind, a, b) {
  switch (kind) {
    case 'party': {
      if (isToOrder(a) || isToOrder(b)) return { status: 'skip' };
      const na = normaliseParty(a); const nb = normaliseParty(b);
      if (na === nb) return { status: String(a).trim() === String(b).trim() ? 'match' : 'format' };
      return { status: 'mismatch', near: similarity(na, nb) >= 0.8 };
    }
    case 'vessel': return normaliseVessel(a) === normaliseVessel(b) ? { status: 'match' } : { status: 'mismatch' };
    case 'ref': return normaliseRef(a) === normaliseRef(b) ? { status: 'match' } : { status: 'mismatch' };
    case 'hs': {
      const ra = normaliseRef(a).slice(0, 6); const rb = normaliseRef(b).slice(0, 6);
      return ra === rb ? { status: 'match' } : { status: 'mismatch' };
    }
    case 'place':
    case 'text': {
      const na = normaliseText(a); const nb = normaliseText(b);
      if (na === nb) return { status: 'match' };
      if (na.includes(nb) || nb.includes(na)) return { status: 'format' };
      return kind === 'text' ? { status: 'caution' } : { status: similarity(na, nb) >= 0.85 ? 'format' : 'mismatch' };
    }
    case 'incoterm': {
      const ca = checkIncoterm(a).normalized; const cb = checkIncoterm(b).normalized;
      return ca === cb ? { status: 'match' } : { status: 'mismatch' };
    }
    case 'quantity': {
      const qa = parseQuantity(a); const qb = parseQuantity(b);
      if (!qa || !qb || qa.comparable !== qb.comparable) return { status: 'caution', note: 'units cannot be compared directly' };
      if (qa.base === qb.base) return { status: 'match' };
      const diff = Math.abs(qa.base - qb.base);
      const pct = (diff / Math.max(qa.base, qb.base)) * 100;
      return { status: 'mismatch', pct: round(pct), diff: round(diff), unit: qa.comparable === 'mass' ? 'kg' : qa.unit };
    }
    case 'money': {
      const ma = parseMoney(a); const mb = parseMoney(b);
      if (!ma || !mb) return { status: 'caution' };
      if (ma.currency && mb.currency && ma.currency !== mb.currency) return { status: 'mismatch', currencyDiffers: true };
      return ma.value === mb.value ? { status: 'match' } : { status: 'mismatch', diff: round(Math.abs(ma.value - mb.value)) };
    }
    case 'date': {
      const da = parseDate(a); const db = parseDate(b);
      if (!da || !db) return { status: 'caution', note: 'date could not be read' };
      if (da.time === db.time) return { status: 'match' };
      if (da.ambiguous || db.ambiguous) return { status: 'caution', note: 'date format is ambiguous (day/month order)' };
      return { status: 'mismatch', days: Math.round(Math.abs(da.time - db.time) / 86400000) };
    }
    default: return { status: 'match' };
  }
}

function severityFor(kind, group, outcome) {
  if (kind === 'quantity') return outcome.pct !== undefined && outcome.pct <= 0.5 ? 'medium' : 'high';
  if (group === 'seller_party' || group === 'buyer_party' || group === 'account_name') return 'high';
  if (['money', 'ref', 'vessel'].includes(kind)) return 'high';
  if (kind === 'date') return 'medium';
  if (kind === 'place' || kind === 'incoterm' || kind === 'hs') return 'medium';
  return 'low';
}

function explainMismatch(kind, group, outcome, label) {
  if (kind === 'party') {
    return outcome.near
      ? `The names are close but not the same legal entity. This can be a clerical slip, a related company, or an impersonation built to pass a quick read. Confirm the exact registered name at the registry.`
      : `These are different names for what should be one party. Confirm which entity holds the contract and why another appears.`;
  }
  if (kind === 'quantity') {
    return outcome.diff !== undefined
      ? `The documents differ by ${outcome.diff.toLocaleString('en-AU')} ${outcome.unit || ''} (${outcome.pct}%). Check against the contract tolerance, and ask which figure is correct rather than assuming.`.replace(/\s+/g, ' ')
      : `The quantities cannot be compared directly.`;
  }
  if (kind === 'money') {
    return outcome.currencyDiffers ? `The currencies differ.` : `The amounts differ by ${outcome.diff.toLocaleString('en-AU')}.`;
  }
  if (kind === 'date') return `The dates differ by ${outcome.days} day${outcome.days === 1 ? '' : 's'}. One of them is wrong or they describe different events.`;
  if (kind === 'vessel') return `Different vessel names across the pack. Check the IMO number, because vessels are renamed but the IMO number stays with the hull.`;
  return `${label} should be identical across the pack and it is not.`;
}

export function reconcile(docs, { now = Date.now() } = {}) {
  const findings = [];
  const stats = { documents: docs.length, fieldsRead: 0, comparisons: 0, agreed: 0, disagreed: 0, identifierChecks: 0, identifierFailures: 0 };
  const addFinding = (f) => findings.push({ source: 'rule', ...f });

  const rowsByGroup = new Map();
  docs.forEach((doc, docIndex) => {
    for (const field of doc.fields || []) {
      const def = FIELDS[field.key];
      const value = String(field.value ?? '').trim();
      if (!def || !value) continue;
      stats.fieldsRead++;
      if (!rowsByGroup.has(def.group)) rowsByGroup.set(def.group, { group: def.group, kind: def.kind, label: GROUP_LABELS[def.group] || def.label, entries: [] });
      rowsByGroup.get(def.group).entries.push({ docIndex, key: field.key, label: def.label, value, page: field.page ?? null, quote: field.quote || '' });
    }
  });

  const evidence = (entry) => ({ document: docs[entry.docIndex].name, field: entry.label, value: entry.value, page: entry.page, quote: entry.quote });

  const matrix = [];
  for (const row of rowsByGroup.values()) {
    let status = row.entries.length > 1 ? 'match' : 'single';

    if (row.kind === 'set') {
      status = compareSets(row, docs, evidence, addFinding, stats);
    } else {
      // Compare every pair, but report one finding per field: three documents
      // that disagree are one problem with three values, not three problems.
      const disagreements = { mismatch: [], caution: [] };
      for (let i = 0; i < row.entries.length; i++) {
        for (let j = i + 1; j < row.entries.length; j++) {
          const a = row.entries[i]; const b = row.entries[j];
          if (a.docIndex === b.docIndex) continue;
          const outcome = compareValues(row.kind, a.value, b.value);
          if (outcome.status === 'skip') continue;
          stats.comparisons++;
          if (outcome.status === 'match' || outcome.status === 'format') stats.agreed++;
          else stats.disagreed++;
          if (STATUS_RANK[outcome.status] > STATUS_RANK[status]) status = outcome.status;
          if (disagreements[outcome.status]) disagreements[outcome.status].push({ a, b, outcome });
        }
      }
      if (disagreements.mismatch.length) {
        const severities = disagreements.mismatch.map(({ outcome }) => severityFor(row.kind, row.group, outcome));
        const worst = severities.reduce((x, y) => (SEVERITY_RANK[y] > SEVERITY_RANK[x] ? y : x));
        const lead = disagreements.mismatch[severities.indexOf(worst)];
        addFinding({
          severity: worst,
          code: `mismatch.${row.group}`,
          title: `${row.label} does not match`,
          detail: explainMismatch(row.kind, row.group, lead.outcome, row.label),
          evidence: mergedEvidence(disagreements.mismatch, row, evidence),
        });
      } else if (disagreements.caution.length) {
        const lead = disagreements.caution[0];
        addFinding({
          severity: 'low',
          code: `mismatch.${row.group}`,
          title: `${row.label}: check by eye`,
          detail: lead.outcome.note
            ? `Could not be compared automatically because the ${lead.outcome.note}.`
            : `The wording differs. It may be the same thing described differently, so read both.`,
          evidence: mergedEvidence(disagreements.caution, row, evidence),
        });
      }
    }

    for (const entry of row.entries) {
      const def = FIELDS[entry.key];
      if (!def.check || row.kind === 'set') continue;
      const check = def.check(entry.value);
      stats.identifierChecks++;
      if (!check.valid) {
        stats.identifierFailures++;
        status = 'mismatch';
        addFinding({
          severity: entry.key === 'incoterm' ? 'medium' : entry.key === 'swift_bic' || entry.key === 'lei' ? 'medium' : 'high',
          code: `identifier.${entry.key}`,
          title: `${def.label} fails its standard check`,
          detail: `${check.reason} A real ${def.label} passes this check, so this is a typing error or an invented number.`,
          evidence: [evidence(entry)],
        });
      } else if (check.isTestCode) {
        addFinding({ severity: 'high', code: 'identifier.swift_test', title: 'SWIFT code is a test code', detail: check.reason, evidence: [evidence(entry)] });
      }
    }

    matrix.push({
      group: row.group,
      label: row.label,
      status,
      cells: docs.map((_, docIndex) => row.entries.filter((e) => e.docIndex === docIndex).map((e) => ({ value: e.value, page: e.page, field: e.label }))),
    });
  }

  runArithmetic(rowsByGroup, evidence, addFinding, stats);
  runWeightLogic(rowsByGroup, evidence, addFinding, stats);
  runDateLogic(rowsByGroup, evidence, addFinding, stats, now);
  runBankingCoherence(rowsByGroup, evidence, addFinding, stats);
  runContinuity(docs, addFinding);

  findings.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  matrix.sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status] || a.label.localeCompare(b.label));
  const counts = { high: 0, medium: 0, low: 0 };
  for (const f of findings) counts[f.severity]++;

  return { documents: docs.map((d) => ({ name: d.name, type: d.doc_type || 'other' })), matrix, findings, stats, counts };
}

// Every document that took part in a disagreement, in pack order, once each.
function mergedEvidence(pairs, row, evidence) {
  const involved = new Set();
  for (const { a, b } of pairs) { involved.add(a); involved.add(b); }
  return row.entries.filter((e) => involved.has(e)).map(evidence);
}

function compareSets(row, docs, evidence, addFinding, stats) {
  const perDoc = new Map();
  for (const entry of row.entries) {
    const items = entry.value.split(/[,;\n/]+|\s{2,}/).map(normaliseRef).filter(Boolean);
    if (!perDoc.has(entry.docIndex)) perDoc.set(entry.docIndex, { entry, items: new Set() });
    items.forEach((item) => perDoc.get(entry.docIndex).items.add(item));
  }

  let status = perDoc.size > 1 ? 'match' : 'single';
  const def = FIELDS[row.entries[0].key];
  if (def.check) {
    for (const { entry, items } of perDoc.values()) {
      for (const item of items) {
        const check = def.check(item);
        stats.identifierChecks++;
        if (!check.valid) {
          stats.identifierFailures++;
          status = 'mismatch';
          addFinding({
            severity: 'high',
            code: `identifier.${entry.key}`,
            title: `${item} fails the container check`,
            detail: `${check.reason} A real container number passes this check, so this is a typing error or an invented number.`,
            evidence: [evidence(entry)],
          });
        }
      }
    }
  }

  const groups = [...perDoc.values()];
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      stats.comparisons++;
      const onlyA = [...groups[i].items].filter((x) => !groups[j].items.has(x));
      const onlyB = [...groups[j].items].filter((x) => !groups[i].items.has(x));
      if (!onlyA.length && !onlyB.length) { stats.agreed++; continue; }
      stats.disagreed++;
      status = 'mismatch';
      const names = (doc, list) => `${docs[doc.entry.docIndex].name} alone lists ${list.join(', ')}`;
      addFinding({
        severity: 'high',
        code: `mismatch.${row.group}`,
        title: `${row.label} do not match`,
        detail: [onlyA.length && names(groups[i], onlyA), onlyB.length && names(groups[j], onlyB)].filter(Boolean).join('. ') + '.',
        evidence: [evidence(groups[i].entry), evidence(groups[j].entry)],
      });
    }
  }
  return status;
}

function runArithmetic(rows, evidence, addFinding, stats) {
  const qty = rows.get('net_quantity'); const price = rows.get('unit_price'); const total = rows.get('total_amount');
  if (!qty || !price || !total) return;
  for (const t of total.entries) {
    const p = price.entries.find((e) => e.docIndex === t.docIndex);
    const q = qty.entries.find((e) => e.docIndex === t.docIndex);
    if (!p || !q) continue;
    const pv = parseMoney(p.value); const qv = parseQuantity(q.value); const tv = parseMoney(t.value);
    if (!pv || !qv || !tv) continue;
    const priceUnit = (p.value.match(/\/\s*([A-Z]+)/i) || [])[1];
    let units = qv.value;
    if (priceUnit && qv.comparable === 'mass') {
      if (/^(MT|TON|TONS|TONNE|TONNES)$/i.test(priceUnit)) units = qv.base / 1000;
      else if (/^KGS?$/i.test(priceUnit)) units = qv.base;
    }
    stats.comparisons++;
    const expected = pv.value * units;
    const gap = Math.abs(expected - tv.value);
    if (gap > Math.max(1, tv.value * 0.0005)) {
      stats.disagreed++;
      addFinding({
        severity: 'high',
        code: 'arithmetic.total',
        title: 'Quantity times price does not equal the total',
        detail: `${q.value} at ${p.value} comes to ${round(expected).toLocaleString('en-AU')}, but the document states ${t.value}.`,
        evidence: [evidence(q), evidence(p), evidence(t)],
      });
    } else {
      stats.agreed++;
    }
  }
}

// Packaging weighs something, so gross can never be below net in the same document.
function runWeightLogic(rows, evidence, addFinding, stats) {
  const net = rows.get('net_quantity'); const gross = rows.get('gross_weight');
  if (!net || !gross) return;
  for (const g of gross.entries) {
    const n = net.entries.find((e) => e.docIndex === g.docIndex);
    if (!n) continue;
    const gv = parseQuantity(g.value); const nv = parseQuantity(n.value);
    if (!gv || !nv || gv.comparable !== 'mass' || nv.comparable !== 'mass') continue;
    stats.comparisons++;
    if (gv.base < nv.base) {
      stats.disagreed++;
      addFinding({
        severity: 'high',
        code: 'weight.gross_below_net',
        title: 'Gross weight is below net weight',
        detail: `This document states gross ${g.value} and net ${n.value}. Gross includes the packaging, so it cannot be lower than net. At least one figure is wrong.`,
        evidence: [evidence(g), evidence(n)],
      });
    } else {
      stats.agreed++;
    }
  }
}

function firstDate(rows, key) {
  const row = [...rows.values()].find((r) => r.entries.some((e) => e.key === key));
  if (!row) return [];
  return row.entries.filter((e) => e.key === key).map((entry) => ({ entry, parsed: parseDate(entry.value) })).filter((x) => x.parsed && !x.parsed.ambiguous);
}

function runDateLogic(rows, evidence, addFinding, stats, now) {
  // Each rule: `earlier` must not fall after `later`.
  const rules = [
    { earlier: 'on_board_date', later: 'latest_shipment_date', severity: 'high', title: 'Shipped after the latest shipment date', why: 'A late shipment is a standard ground for refusing documents under a letter of credit.' },
    { earlier: 'on_board_date', later: 'bl_issue_date', severity: 'high', title: 'B/L issued before the goods were on board', why: 'A shipped bill of lading cannot be issued before loading, so one of these dates is wrong.' },
    { earlier: 'on_board_date', later: 'lc_expiry_date', severity: 'high', title: 'Shipped after the L/C expired', why: 'The credit had expired by the time the goods were loaded.' },
    { earlier: 'invoice_date', later: 'lc_expiry_date', severity: 'medium', title: 'Invoice dated after the L/C expired', why: 'Check whether the presentation can still be made under this credit.' },
    { earlier: 'lc_issue_date', later: 'lc_expiry_date', severity: 'high', title: 'L/C expires before it was issued', why: 'These two dates cannot both be right.' },
    { earlier: 'contract_date', later: 'invoice_date', severity: 'medium', title: 'Invoice is dated before the contract', why: 'An invoice normally follows the contract it bills under.' },
    { earlier: 'contract_date', later: 'on_board_date', severity: 'medium', title: 'Goods shipped before the contract date', why: 'Ask why cargo moved before the contract existed.' },
    { earlier: 'company_registration_date', later: 'contract_date', severity: 'high', title: 'Company registered after the contract date', why: 'The entity did not exist when it supposedly signed. This is a common sign of an assembled pack.' },
  ];
  for (const rule of rules) {
    for (const a of firstDate(rows, rule.earlier)) {
      for (const b of firstDate(rows, rule.later)) {
        stats.comparisons++;
        if (a.parsed.time > b.parsed.time) {
          stats.disagreed++;
          addFinding({
            severity: rule.severity,
            code: `date.${rule.earlier}.${rule.later}`,
            title: rule.title,
            detail: `${a.entry.label} is ${fmtDate(a.parsed.time)} and ${b.entry.label} is ${fmtDate(b.parsed.time)}. ${rule.why}`,
            evidence: [evidence(a.entry), evidence(b.entry)],
          });
        } else {
          stats.agreed++;
        }
      }
    }
  }

  // Dates already in the future when the pack is checked.
  const backward = ['invoice_date', 'on_board_date', 'bl_issue_date', 'certificate_date', 'contract_date'];
  const tolerance = 86400000 * 2;
  for (const key of backward) {
    for (const { entry, parsed } of firstDate(rows, key)) {
      if (parsed.time > now + tolerance) {
        addFinding({
          severity: 'medium',
          code: 'date.future',
          title: `${entry.label} is in the future`,
          detail: `${entry.label} reads ${fmtDate(parsed.time)}, which has not happened yet. Ask why this document exists already.`,
          evidence: [evidence(entry)],
        });
      }
    }
  }
}

function runBankingCoherence(rows, evidence, addFinding, stats) {
  const account = rows.get('account_name'); const seller = rows.get('seller_party');
  if (account && seller) {
    for (const a of account.entries) {
      stats.comparisons++;
      const anyMatch = seller.entries.some((s) => normaliseParty(s.value) === normaliseParty(a.value));
      if (anyMatch) { stats.agreed++; continue; }
      stats.disagreed++;
      addFinding({
        severity: 'high',
        code: 'banking.third_party',
        title: 'Money goes to someone other than the seller',
        detail: `The bank account is held by "${a.value}", which is not the contracting party. Payment to a third party needs an explanation that holds up before any funds move.`,
        evidence: [evidence(a), evidence(seller.entries[0])],
      });
    }
  }

  const iban = rows.get('iban'); const bic = rows.get('swift_bic');
  if (iban && bic) {
    for (const i of iban.entries) {
      const b = bic.entries.find((e) => e.docIndex === i.docIndex) || bic.entries[0];
      const ic = checkIban(i.value); const bc = checkBic(b.value);
      if (!ic.valid || !bc.valid) continue;
      stats.comparisons++;
      if (ic.country !== bc.country) {
        stats.disagreed++;
        addFinding({
          severity: 'medium',
          code: 'banking.country',
          title: 'IBAN and SWIFT code point to different countries',
          detail: `The IBAN is from ${ic.country} and the SWIFT code is from ${bc.country}. A correspondent arrangement can explain this, so ask the bank directly.`,
          evidence: [evidence(i), evidence(b)],
        });
      } else {
        stats.agreed++;
      }
    }
  }
}

// From the GDN desk checklist: in a genuine deal entities recur, so an entity that
// surfaces in only one document is worth a second look. Low severity on its own.
function runContinuity(docs, addFinding) {
  if (docs.length < 3) return;
  const appearances = new Map();
  docs.forEach((doc, docIndex) => {
    for (const field of doc.fields || []) {
      const def = FIELDS[field.key];
      if (!def || def.kind !== 'party' || isToOrder(field.value)) continue;
      const name = normaliseParty(field.value);
      if (!name) continue;
      if (!appearances.has(name)) appearances.set(name, { display: field.value, docs: new Set() });
      appearances.get(name).docs.add(docIndex);
    }
  });
  const loners = [...appearances.values()].filter((a) => a.docs.size === 1);
  if (!loners.length) return;
  addFinding({
    severity: 'low',
    code: 'continuity.single_appearance',
    title: `${loners.length === 1 ? 'A party appears' : `${loners.length} parties appear`} in one document only`,
    detail: `${loners.map((l) => `"${l.display}" (${docs[[...l.docs][0]].name})`).join(', ')}. In a genuine deal the same entities recur across the paperwork, so check why these do not.`,
    evidence: [],
  });
}

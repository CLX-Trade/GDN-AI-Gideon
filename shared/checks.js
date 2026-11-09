// Published-standard identifier checks. Pure functions with no dependencies: the
// same file runs on the server inside a pack check and in the browser on the free
// tools pages. A pass means the number is well formed. It never proves the vessel,
// container, account or company exists, and the wording in the UI must say so.

const digitsOnly = (s) => String(s ?? '').replace(/\D/g, '');
const compact = (s) => String(s ?? '').replace(/[\s.\-/]/g, '').toUpperCase();

function result(valid, normalized, reason, extra = {}) {
  return { valid, normalized, reason, ...extra };
}

// IMO ship identification number: 7 digits, the last is a weighted check digit.
export function checkImo(input) {
  const raw = compact(input).replace(/^IMO/, '');
  if (!/^\d{7}$/.test(raw)) return result(false, raw, 'An IMO number has exactly 7 digits.');
  const d = [...raw].map(Number);
  const sum = d[0] * 7 + d[1] * 6 + d[2] * 5 + d[3] * 4 + d[4] * 3 + d[5] * 2;
  const expected = sum % 10;
  if (expected !== d[6]) {
    return result(false, raw, `Check digit fails: the last digit should be ${expected}, not ${d[6]}.`, { expected });
  }
  return result(true, raw, 'Check digit is correct.');
}

// ISO 6346 freight container number: owner + category + 6 digits + check digit.
const CONTAINER_VALUES = (() => {
  const map = {};
  let v = 10;
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    if (v % 11 === 0) v++; // multiples of 11 are skipped by the standard
    map[letter] = v++;
  }
  return map;
})();

export function checkContainer(input) {
  const raw = compact(input);
  if (!/^[A-Z]{4}\d{7}$/.test(raw)) {
    return result(false, raw, 'A container number is 4 letters followed by 7 digits, for example CSQU3054383.');
  }
  const category = raw[3];
  if (!'UJZ'.includes(category)) {
    return result(false, raw, `The fourth letter is the equipment category and must be U, J or Z, not ${category}.`);
  }
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const value = i < 4 ? CONTAINER_VALUES[raw[i]] : Number(raw[i]);
    sum += value * 2 ** i;
  }
  const expected = (sum % 11) % 10;
  const given = Number(raw[10]);
  if (expected !== given) {
    return result(false, raw, `Check digit fails: the last digit should be ${expected}, not ${given}.`, { expected });
  }
  return result(true, raw, 'Check digit is correct.', { owner: raw.slice(0, 3), category });
}

function mod97(numeric) {
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = Number(String(remainder) + numeric.slice(i, i + 7)) % 97;
  }
  return remainder;
}

const lettersToDigits = (s) => s.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));

const IBAN_LENGTHS = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BI: 27, BR: 29, BY: 28, CH: 21, CR: 22,
  CY: 28, CZ: 24, DE: 22, DJ: 27, DK: 18, DO: 28, EE: 20, EG: 29, ES: 24, FI: 18, FK: 18, FO: 18, FR: 27, GB: 22,
  GE: 22, GI: 23, GL: 18, GR: 27, GT: 28, HN: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27, JO: 30,
  KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, LY: 25, MC: 27, MD: 24, ME: 22, MK: 19, MN: 20,
  MR: 27, MT: 31, MU: 30, NI: 28, NL: 18, NO: 15, OM: 23, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22,
  RU: 33, SA: 24, SC: 31, SD: 18, SE: 24, SI: 19, SK: 24, SM: 27, SO: 23, ST: 25, SV: 28, TL: 23, TN: 24, TR: 26,
  UA: 29, VA: 22, VG: 24, XK: 20, YE: 30,
};

export function checkIban(input) {
  const raw = compact(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(raw)) {
    return result(false, raw, 'An IBAN starts with a 2-letter country code and 2 check digits.');
  }
  const country = raw.slice(0, 2);
  const expectedLength = IBAN_LENGTHS[country];
  if (!expectedLength) {
    return result(false, raw, `${country} does not issue IBANs. Accounts there use another format, so this one needs an explanation.`, { country });
  }
  if (raw.length !== expectedLength) {
    return result(false, raw, `An IBAN from ${country} has ${expectedLength} characters. This one has ${raw.length}.`, { country });
  }
  const rearranged = raw.slice(4) + raw.slice(0, 4);
  if (mod97(lettersToDigits(rearranged)) !== 1) {
    return result(false, raw, 'Check digits fail: at least one character is wrong.', { country });
  }
  return result(true, raw, 'Length and check digits are correct.', { country });
}

function regionName(code) {
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' }).of(code);
    return name && name !== 'Unknown Region' ? name : null;
  } catch {
    return null;
  }
}

// ISO 9362 BIC / SWIFT code. There is no check digit, so this checks shape only.
export function checkBic(input) {
  const raw = compact(input);
  if (!/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(raw)) {
    return result(false, raw, 'A SWIFT/BIC code has 8 or 11 characters: bank, 2-letter country, location, optional branch.');
  }
  const country = raw.slice(4, 6);
  const countryName = regionName(country);
  if (!countryName) {
    return result(false, raw, `${country} is not a recognised country code.`, { country });
  }
  const isTestCode = raw[7] === '0';
  return result(true, raw, isTestCode
    ? `Well formed, but a location code ending in 0 marks a test code that cannot carry live payments.`
    : `Well formed. The country is ${countryName}.`, { country, countryName, isTestCode });
}

// ISO 17442 Legal Entity Identifier: 20 characters, ISO 7064 mod 97-10.
export function checkLei(input) {
  const raw = compact(input);
  if (!/^[A-Z0-9]{18}\d{2}$/.test(raw)) {
    return result(false, raw, 'An LEI has 20 characters: 18 letters or digits and 2 check digits.');
  }
  if (mod97(lettersToDigits(raw)) !== 1) {
    return result(false, raw, 'Check digits fail: at least one character is wrong.');
  }
  return result(true, raw, 'Check digits are correct.');
}

// Australian Business Number: 11 digits, weighted mod 89.
export function checkAbn(input) {
  const raw = digitsOnly(input);
  if (raw.length !== 11) return result(false, raw, 'An ABN has exactly 11 digits.');
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = [...raw].reduce((acc, ch, i) => acc + (Number(ch) - (i === 0 ? 1 : 0)) * weights[i], 0);
  if (sum % 89 !== 0) return result(false, raw, 'Check fails: at least one digit is wrong.');
  return result(true, raw, 'Checksum is correct.');
}

// Australian Company Number: 9 digits, the last is a weighted check digit.
export function checkAcn(input) {
  const raw = digitsOnly(input);
  if (raw.length !== 9) return result(false, raw, 'An ACN has exactly 9 digits.');
  const sum = [...raw.slice(0, 8)].reduce((acc, ch, i) => acc + Number(ch) * (8 - i), 0);
  const expected = (10 - (sum % 10)) % 10;
  if (expected !== Number(raw[8])) {
    return result(false, raw, `Check digit fails: the last digit should be ${expected}, not ${raw[8]}.`, { expected });
  }
  return result(true, raw, 'Check digit is correct.');
}

export const INCOTERMS_2020 = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'];
export const RETIRED_INCOTERMS = ['DAT', 'DAF', 'DES', 'DEQ', 'DDU', 'C&F', 'CNF'];

export function checkIncoterm(input) {
  const text = String(input ?? '').toUpperCase().replace(/[.,]/g, ' ');
  const found = text.match(/\b(EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF|DAT|DAF|DES|DEQ|DDU|CNF)\b|C&F/);
  if (!found) return result(false, text.trim(), 'No Incoterm found.');
  const term = found[0];
  if (RETIRED_INCOTERMS.includes(term)) {
    return result(false, term, `${term} is not an Incoterms 2020 rule. The contract should say which edition applies.`);
  }
  return result(true, term, 'Valid Incoterms 2020 rule.');
}

'use strict';

const { newId } = require('./db');
const { OUTLET_TYPES, COLLAB_MODELS, CREATOR_TYPES } = require('./catalog');
const { ValidationError, F, str, url, num, email } = require('./validate');
const { seedEntities } = require('./entities-seed');
const { bi, isBi, pick } = require('./i18n');

// Global Entity Database: partner acquisition funnel (CRM) + a source of tasks for the Conductor.

const STAGES = {
  prospect: bi('Prospect', 'Prospekt'),
  contacted: bi('Contacted', 'Kontakt nawiązany'),
  negotiation: bi('Negotiation', 'Negocjacje'),
  partner: bi('Partner (in catalog)', 'Partner (w katalogu)'),
  declined: bi('Declined', 'Odmowa'),
};

const SUBMISSION_MODES = {
  open: bi('Open submissions', 'Otwarte zgłoszenia'),
  contact: bi('Editorial / A&R contact', 'Kontakt z redakcją / A&R'),
  platform: bi('Via a platform', 'Przez platformę'),
  paid: bi('Paid service', 'Płatna usługa'),
  invite: bi('Curated / invitation', 'Selekcja / zaproszenia'),
};

const REGIONS = {
  EU: bi('Europe', 'Europa'),
  NA: bi('North America', 'Ameryka Północna'),
  LA: bi('Latin America', 'Ameryka Łacińska'),
  AF: bi('Africa', 'Afryka'),
  AS: bi('Asia', 'Azja'),
  ME: bi('Middle East', 'Bliski Wschód'),
  OC: bi('Oceania', 'Oceania'),
  WW: bi('Worldwide', 'Świat'),
};

const ENTITY_KINDS = {
  ...OUTLET_TYPES,
  platform: bi('Platform / tool', 'Platforma / narzędzie'),
  distributor: bi('Distributor', 'Dystrybutor'),
  rights: bi('Rights organisation (PRO / CMO)', 'Organizacja praw autorskich (OZZ)'),
  funding: bi('Funding / export office', 'Finansowanie / biuro eksportu'),
};

const CONFIDENCE = ['high', 'medium', 'low'];

// Country → region (ISO 3166-1 alpha-2). Unknown codes fall back to WW.
const COUNTRY_REGION = {};
const addRegion = (region, codes) => codes.split(' ').forEach((c) => { COUNTRY_REGION[c] = region; });
addRegion('EU', 'PL CZ SK HU DE AT CH FR BE NL LU GB IE ES PT IT GR DK SE NO FI IS EE LV LT UA RO BG HR SI RS BA ME MK AL MD BY MT CY');
addRegion('NA', 'US CA');
addRegion('LA', 'MX BR AR CL CO PE UY PY BO EC VE CR PA GT HN SV NI CU DO PR JM TT');
addRegion('AF', 'ZA NG GH KE UG TZ RW ET SN CI CM MA DZ TN EG ZW ZM AO MZ');
addRegion('AS', 'JP KR CN TW HK SG MY ID TH VN PH IN PK BD LK NP KZ MN');
addRegion('ME', 'IL PS AE SA QA KW BH OM JO LB TR IR IQ');
addRegion('OC', 'AU NZ FJ PG');
COUNTRY_REGION.WW = 'WW';

// Common country names (PL/EN) accepted on import → ISO codes.
const COUNTRY_NAMES = {
  polska: 'PL', poland: 'PL', niemcy: 'DE', germany: 'DE', 'wielka brytania': 'GB', 'united kingdom': 'GB', uk: 'GB',
  usa: 'US', 'united states': 'US', 'stany zjednoczone': 'US', kanada: 'CA', canada: 'CA', francja: 'FR', france: 'FR',
  hiszpania: 'ES', spain: 'ES', włochy: 'IT', italy: 'IT', holandia: 'NL', netherlands: 'NL', belgia: 'BE', belgium: 'BE',
  czechy: 'CZ', czechia: 'CZ', 'czech republic': 'CZ', szwecja: 'SE', sweden: 'SE', norwegia: 'NO', norway: 'NO',
  dania: 'DK', denmark: 'DK', finlandia: 'FI', finland: 'FI', australia: 'AU', japonia: 'JP', japan: 'JP',
  irlandia: 'IE', ireland: 'IE', austria: 'AT', szwajcaria: 'CH', switzerland: 'CH', węgry: 'HU', hungary: 'HU',
  świat: 'WW', worldwide: 'WW', world: 'WW', global: 'WW',
};

const REGION_NAMES = {
  europa: 'EU', europe: 'EU', 'ameryka północna': 'NA', 'north america': 'NA', 'ameryka łacińska': 'LA', 'latin america': 'LA',
  afryka: 'AF', africa: 'AF', azja: 'AS', asia: 'AS', 'bliski wschód': 'ME', 'middle east': 'ME',
  'australia i oceania': 'OC', oceania: 'OC', świat: 'WW', worldwide: 'WW', world: 'WW',
};

function oneOf(value, map, field, fallback) {
  const v = value === undefined || value === '' ? fallback : String(value).trim();
  if (!Object.prototype.hasOwnProperty.call(map, v)) {
    const f = isBi(field) ? field : bi(String(field), String(field));
    throw new ValidationError(bi(`Invalid "${f.en}": ${v}.`, `Nieprawidłowe pole „${f.pl}”: ${v}.`));
  }
  return v;
}

function bool(v) {
  return v === true || v === 'true' || v === '1' || v === 1 || v === 'tak' || v === 'yes';
}

function normCountry(v) {
  const raw = String(v ?? '').trim();
  if (!raw) return '';
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  return COUNTRY_NAMES[raw.toLowerCase()] || raw.slice(0, 80);
}

function normRegion(v, country) {
  const raw = String(v ?? '').trim();
  if (!raw) return COUNTRY_REGION[country] || 'WW';
  if (REGIONS[raw.toUpperCase()]) return raw.toUpperCase();
  const code = REGION_NAMES[raw.toLowerCase()];
  if (!code) throw new ValidationError(bi(`Unknown region: ${raw}.`, `Nieznany region: ${raw}.`));
  return code;
}

function entityInput(body, { partial = false } = {}) {
  const has = (k) => !partial || body[k] !== undefined;
  const out = {};
  if (has('name')) out.name = str(body.name, F.name, { required: !partial, max: 160 });
  if (has('kind')) out.kind = oneOf(body.kind, ENTITY_KINDS, F.type, 'other');
  if (has('creatorTypes')) {
    const list = Array.isArray(body.creatorTypes) ? body.creatorTypes : String(body.creatorTypes || 'music').split(/[|,;]/);
    out.creatorTypes = [...new Set(list.map((x) => String(x).trim()).filter(Boolean))].map((x) => oneOf(x, CREATOR_TYPES, F.creatorType));
    if (!out.creatorTypes.length) out.creatorTypes = ['music'];
  }
  if (has('country')) out.country = normCountry(body.country);
  if (has('region') || has('country')) out.region = normRegion(body.region, out.country ?? normCountry(body.country));
  if (has('url')) out.url = url(body.url, F.link, { required: !partial });
  if (has('submission')) out.submission = oneOf(body.submission, SUBMISSION_MODES, F.submission, 'contact');
  if (has('model')) out.model = oneOf(body.model, COLLAB_MODELS, F.model, 'free');
  if (has('stage')) out.stage = oneOf(body.stage, STAGES, F.stage, 'prospect');
  if (has('tier')) out.tier = Math.round(num(body.tier, F.tier, { min: 0, max: 5 })) || 2;
  if (has('reach')) out.reach = Math.round(num(body.reach, F.reach, { max: 1e10 }));
  if (has('contactEmail')) out.contactEmail = email(body.contactEmail, F.email);
  // Notes: bilingual when both languages are provided (CSV: notes + notesPl).
  if (body.note !== undefined && isBi(body.note)) out.note = body.note;
  else if (body.notes !== undefined || body.notesPl !== undefined) {
    const en = str(body.notes, F.note, { max: 500 });
    const pl = str(body.notesPl, F.note, { max: 500 });
    out.note = en && pl ? bi(en, pl) : (en || pl);
  }
  if (body.sourceUrl !== undefined) out.sourceUrl = url(body.sourceUrl, F.link);
  if (body.evidence !== undefined) out.evidence = str(body.evidence, F.note, { max: 500 });
  if (body.confidence !== undefined && body.confidence !== '') {
    const c = String(body.confidence).toLowerCase();
    if (!CONFIDENCE.includes(c)) throw new ValidationError(bi('Confidence must be high, medium or low.', 'Pewność musi mieć wartość high, medium lub low.'));
    out.confidence = c;
  }
  if (body.lastChecked !== undefined && body.lastChecked !== '') {
    const d = String(body.lastChecked).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new ValidationError(bi('lastChecked must use YYYY-MM-DD.', 'lastChecked musi mieć format RRRR-MM-DD.'));
    out.lastChecked = d;
  }
  if (body.verified !== undefined) out.verified = bool(body.verified);
  if (body.publicListing !== undefined) out.publicListing = bool(body.publicListing);
  return out;
}

function makeEntity(input, { now, source = 'admin' }) {
  const at = now().toISOString();
  return {
    id: newId('ent'),
    kind: 'other',
    creatorTypes: ['music'],
    country: '',
    region: 'WW',
    submission: 'contact',
    model: 'free',
    tier: 2,
    stage: 'prospect',
    reach: 0,
    contactEmail: '',
    note: '',
    sourceUrl: '',
    evidence: '',
    confidence: '',
    lastChecked: '',
    ...input,
    verified: Boolean(input.verified),
    // Public only after admin verification.
    publicListing: Boolean(input.verified && input.publicListing),
    outletId: null,
    source,
    stageHistory: [{ at, stage: input.stage || 'prospect' }],
    createdAt: at,
  };
}

function dedupeKey(e) {
  let host = '';
  try { host = new URL(e.url).host.replace(/^www\./, ''); } catch { /* no URL */ }
  return `${host}|${String(e.name).toLowerCase().trim()}`;
}

function seedEntitiesInto(store, now = () => new Date()) {
  const keys = new Set(store.data.entities.map(dedupeKey));
  for (const row of seedEntities()) {
    const { noteKey, ...data } = row;
    const e = makeEntity(entityInput(data), { now, source: 'seed' });
    e.noteKey = noteKey;
    if (keys.has(dedupeKey(e))) continue;
    keys.add(dedupeKey(e));
    store.data.entities.push(e);
  }
  store.save();
}

// Text used for searching (both languages).
function searchText(e) {
  return [e.name, e.country, e.url, pick(e.note, 'en'), pick(e.note, 'pl'), isBi(e.note) ? '' : e.note].join(' ').toLowerCase();
}

// ---------- CSV ----------
const CSV_FIELDS = ['name', 'kind', 'creatorTypes', 'country', 'region', 'url', 'submission', 'model', 'tier', 'reach', 'contactEmail',
  'notes', 'notesPl', 'sourceUrl', 'evidence', 'confidence', 'lastChecked', 'stage', 'verified', 'publicListing'];

function csvCell(v) {
  const s = Array.isArray(v) ? v.join('|') : String(v ?? '');
  // Protection against formula injection in spreadsheets.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(entities) {
  const row = (e) => ({ ...e, notes: pick(e.note, 'en'), notesPl: isBi(e.note) ? e.note.pl : '' });
  return [CSV_FIELDS.join(','), ...entities.map((e) => { const r = row(e); return CSV_FIELDS.map((f) => csvCell(r[f])).join(','); })].join('\n');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = String(text).replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim()));
  if (!nonEmpty.length) return [];
  const header = nonEmpty[0].map((h) => h.trim());
  if (!header.includes('name') || !header.includes('url')) {
    throw new ValidationError(bi('The CSV needs a header with at least: name, url.', 'CSV musi mieć nagłówek z kolumnami co najmniej: name, url.'));
  }
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] || '').trim().replace(/^'(?=[=+\-@])/, '')])));
}

// ---------- outreach ----------
function outreach(entity, { lang = 'en', platformFeePercent, capPercent, baseUrl = '' }) {
  const kind = pick(ENTITY_KINDS[entity.kind] || entity.kind, lang);
  const creators = entity.creatorTypes.map((c) => pick(CREATOR_TYPES[c]?.label || c, lang)).join(', ');
  if (lang === 'en') {
    return {
      subject: `Partnership: curated submissions for ${entity.name}`,
      body: `Hi ${entity.name} team,

I run Promo Hub – a platform that connects independent creators (${creators}) with the outlets that suit them best, through one coordinated campaign per release. ${entity.name} (${kind}) is a great fit for our creators.

What we offer you:
• Curated, genre-matched submissions only – no spam. Big outlets can require a minimum creator level (Access Ladder), so you only receive creators with documented results.
• You choose the terms: free, a small review fee, barter, revenue share or a commission on the creator's revenue from the work (terms are frozen per submission). Total commission per work is capped at ${capPercent}%, so creators can afford it.
• A free curator panel: inbox, response deadlines, settlements. The platform keeps ${platformFeePercent}% of commissions/fees – nothing else.

Would you be open to a 15-minute call or to trying it with a few submissions?

Best regards,
Promo Hub${baseUrl ? `\n${baseUrl}` : ''}`,
    };
  }
  return {
    subject: `Współpraca: wyselekcjonowane zgłoszenia dla ${entity.name}`,
    body: `Dzień dobry,

prowadzę Promo Hub – platformę, która łączy niezależnych twórców (${creators}) z najlepiej dopasowanymi miejscami promocji w ramach jednej, skoordynowanej kampanii premiery. Piszę, bo ${entity.name} (${kind}) idealnie pasuje do naszych twórców.

Co proponujemy:
• Wyłącznie dopasowane gatunkowo zgłoszenia, bez spamu. Duże miejsca mogą wymagać minimalnego poziomu twórcy (Drabina dostępu) – dostajecie twórców z udokumentowanymi wynikami.
• Warunki ustalacie Państwo: bezpłatnie, niewielka opłata za odsłuch, barter, podział przychodów albo prowizja od przychodów twórcy z dzieła (warunki zamrażane przy każdym zgłoszeniu). Łączna prowizja na dzieło ma limit ${capPercent}%, więc twórców na nią stać.
• Bezpłatny panel kuratora: skrzynka zgłoszeń, terminy odpowiedzi, rozliczenia. Platforma pobiera ${platformFeePercent}% od prowizji/opłat – nic więcej.

Czy znajdą Państwo 15 minut na rozmowę albo test na kilku zgłoszeniach?

Pozdrawiam serdecznie,
Promo Hub${baseUrl ? `\n${baseUrl}` : ''}`,
  };
}

module.exports = {
  STAGES,
  SUBMISSION_MODES,
  REGIONS,
  ENTITY_KINDS,
  COUNTRY_REGION,
  entityInput,
  makeEntity,
  dedupeKey,
  seedEntitiesInto,
  searchText,
  toCsv,
  parseCsv,
  outreach,
};

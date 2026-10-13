'use strict';

const { newId } = require('./db');
const { OUTLET_TYPES, COLLAB_MODELS, CREATOR_TYPES } = require('./catalog');
const { ValidationError, str, url, num } = require('./validate');
const { seedEntities } = require('./entities-seed');

// Światowa Baza Podmiotów: lejek pozyskiwania partnerów (CRM) + źródło zadań dla Dyrygenta.

const STAGES = {
  prospect: 'Prospekt',
  contacted: 'Kontakt nawiązany',
  negotiation: 'Negocjacje',
  partner: 'Partner (w katalogu)',
  declined: 'Odmowa',
};

const SUBMISSION_MODES = {
  open: 'Otwarte zgłoszenia',
  contact: 'Kontakt z redakcją / A&R',
  platform: 'Przez platformę',
  paid: 'Płatna usługa',
  invite: 'Selekcja / zaproszenia',
};

const REGIONS = ['Europa', 'Ameryka Północna', 'Ameryka Łacińska', 'Afryka', 'Azja', 'Bliski Wschód', 'Australia i Oceania', 'Świat'];

const ENTITY_KINDS = { ...OUTLET_TYPES, platform: 'Platforma zgłoszeń / agregator' };

const CSV_FIELDS = ['name', 'kind', 'creatorTypes', 'country', 'region', 'url', 'submission', 'model', 'stage', 'contactEmail', 'verified', 'publicListing', 'notes'];

function oneOf(value, map, field, fallback) {
  const v = value === undefined || value === '' ? fallback : String(value).trim();
  if (!Object.prototype.hasOwnProperty.call(map, v)) throw new ValidationError(`Nieprawidłowe pole "${field}": ${v}.`);
  return v;
}

function bool(v) {
  return v === true || v === 'true' || v === '1' || v === 1 || v === 'tak';
}

function entityInput(body, { partial = false } = {}) {
  const has = (k) => !partial || body[k] !== undefined;
  const out = {};
  if (has('name')) out.name = str(body.name, 'nazwa', { required: !partial, max: 160 });
  if (has('kind')) out.kind = oneOf(body.kind, ENTITY_KINDS, 'typ', 'other');
  if (has('creatorTypes')) {
    const list = Array.isArray(body.creatorTypes) ? body.creatorTypes : String(body.creatorTypes || 'music').split(/[|,;]/);
    out.creatorTypes = [...new Set(list.map((x) => String(x).trim()).filter(Boolean))].map((x) => oneOf(x, CREATOR_TYPES, 'typ twórcy'));
    if (!out.creatorTypes.length) out.creatorTypes = ['music'];
  }
  if (has('country')) out.country = str(body.country, 'kraj', { max: 80 });
  if (has('region')) {
    const r = str(body.region, 'region', { max: 40 }) || 'Świat';
    if (!REGIONS.includes(r)) throw new ValidationError(`Nieznany region: ${r}.`);
    out.region = r;
  }
  if (has('url')) out.url = url(body.url, 'link', { required: !partial });
  if (has('submission')) out.submission = oneOf(body.submission, SUBMISSION_MODES, 'tryb zgłoszeń', 'contact');
  if (has('model')) out.model = oneOf(body.model, COLLAB_MODELS, 'model współpracy', 'free');
  if (has('stage')) out.stage = oneOf(body.stage, STAGES, 'etap', 'prospect');
  if (has('contactEmail')) {
    const e = str(body.contactEmail, 'e-mail', { max: 200 }).toLowerCase();
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new ValidationError('Nieprawidłowy e-mail.');
    out.contactEmail = e;
  }
  if (has('notes')) out.notes = str(body.notes, 'uwagi', { max: 2000 });
  if (has('reach')) out.reach = Math.round(num(body.reach, 'zasięg', { max: 1e10 }));
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
    region: 'Świat',
    submission: 'contact',
    model: 'free',
    stage: 'prospect',
    contactEmail: '',
    notes: '',
    reach: 0,
    ...input,
    verified: Boolean(input.verified),
    // Publiczne tylko po weryfikacji przez admina.
    publicListing: Boolean(input.verified && input.publicListing),
    outletId: null,
    source,
    stageHistory: [{ at, stage: input.stage || 'prospect' }],
    createdAt: at,
  };
}

function dedupeKey(e) {
  let host = '';
  try { host = new URL(e.url).host.replace(/^www\./, ''); } catch { /* bez URL */ }
  return `${host}|${String(e.name).toLowerCase().trim()}`;
}

function seedEntitiesInto(store, now = () => new Date()) {
  for (const row of seedEntities()) {
    store.data.entities.push(makeEntity(entityInput(row), { now, source: 'seed' }));
  }
  store.save();
}

// ---------- CSV ----------
function csvCell(v) {
  const s = Array.isArray(v) ? v.join('|') : String(v ?? '');
  // Ochrona przed wstrzyknięciem formuł w arkuszach kalkulacyjnych.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function toCsv(entities) {
  return [CSV_FIELDS.join(','), ...entities.map((e) => CSV_FIELDS.map((f) => csvCell(e[f])).join(','))].join('\n');
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
    throw new ValidationError('CSV musi mieć nagłówek z kolumnami co najmniej: name, url.');
  }
  return nonEmpty.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] || '').trim().replace(/^'(?=[=+\-@])/, '')])));
}

// ---------- outreach ----------
function outreach(entity, { lang = 'pl', platformFeePercent, capPercent, baseUrl = '' }) {
  const kind = ENTITY_KINDS[entity.kind] || entity.kind;
  const model = COLLAB_MODELS[entity.model]?.label || entity.model;
  const creators = entity.creatorTypes.map((c) => CREATOR_TYPES[c]?.label || c).join(', ');
  if (lang === 'en') {
    return {
      subject: `Partnership: curated submissions for ${entity.name}`,
      body: `Hi ${entity.name} team,

I run Promo Hub – a platform that connects independent creators (${creators}) with the outlets that suit them best, through one coordinated campaign per release.

What we offer you:
• Curated, genre-matched submissions only – no spam. Big outlets can require a minimum artist level (Access Ladder), so you only receive creators with documented results.
• You choose the terms: free, ${model.toLowerCase()} or a commission on the creator's revenue from the work (terms are frozen per submission). Total commission per work is capped at ${capPercent}%, so creators can afford it.
• A free curator panel: inbox, response deadlines, settlements. The platform keeps ${platformFeePercent}% of commissions/fees – nothing else.

Would you be open to a 15-minute call or to trying it with a few submissions?

Best regards,
Promo Hub${baseUrl ? `\n${baseUrl}` : ''}`,
    };
  }
  return {
    subject: `Współpraca: wyselekcjonowane zgłoszenia dla ${entity.name}`,
    body: `Dzień dobry,

prowadzę Promo Hub – platformę, która łączy niezależnych twórców (${creators}) z najlepiej dopasowanymi miejscami promocji w ramach jednej, skoordynowanej kampanii premiery. Piszę, bo ${entity.name} (${kind.toLowerCase()}) idealnie pasuje do naszych twórców.

Co proponujemy:
• Wyłącznie dopasowane gatunkowo zgłoszenia, bez spamu. Duże miejsca mogą wymagać minimalnego poziomu artysty (Drabina dostępu) – dostajecie twórców z udokumentowanymi wynikami.
• Warunki ustalacie Państwo: bezpłatnie, ${model.toLowerCase()} albo prowizja od przychodów twórcy z dzieła (warunki zamrażane przy każdym zgłoszeniu). Łączna prowizja na dzieło ma limit ${capPercent}%, więc twórców na nią stać.
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
  entityInput,
  makeEntity,
  dedupeKey,
  seedEntitiesInto,
  toCsv,
  parseCsv,
  outreach,
};

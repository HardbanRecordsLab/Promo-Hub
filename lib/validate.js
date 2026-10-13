'use strict';

const { OUTLET_TYPES, COLLAB_MODELS, PERCENT_MODELS, GENRES, CREATOR_TYPES } = require('./catalog');
const { bi, isBi } = require('./i18n');

// message: plain string or bilingual { en, pl } (localized by the HTTP layer).
class ValidationError extends Error {
  constructor(message) {
    super(isBi(message) ? message.en : message);
    this.i18n = isBi(message) ? message : null;
    this.status = 400;
  }
}

// Field names used in validation messages.
const F = {
  model: bi('collaboration model', 'model współpracy'),
  terms: bi('terms', 'warunki'),
  rate: bi('commission %', 'prowizja %'),
  duration: bi('agreement length', 'czas trwania umowy'),
  fee: bi('fee', 'opłata'),
  name: bi('name', 'nazwa'),
  type: bi('type', 'typ'),
  country: bi('country', 'kraj'),
  language: bi('language', 'język'),
  reach: bi('reach', 'zasięg'),
  link: bi('link', 'link'),
  contactEmail: bi('contact e-mail', 'e-mail kontaktowy'),
  description: bi('description', 'opis'),
  responseDays: bi('response time', 'czas odpowiedzi'),
  minLevel: bi('minimum creator level', 'minimalny poziom twórcy'),
  artist: bi('creator name', 'nazwa twórcy'),
  artistEmail: bi('creator e-mail', 'e-mail twórcy'),
  title: bi('title', 'tytuł'),
  workUrl: bi('link to the work', 'link do dzieła'),
  releaseDate: bi('release date', 'data premiery'),
  message: bi('message', 'wiadomość'),
  budget: bi('budget', 'budżet'),
  bio: bi('bio', 'bio'),
  bioEn: bi('bio (English)', 'bio (angielski)'),
  photo: bi('photo', 'zdjęcie'),
  city: bi('city', 'miasto'),
  listeners: bi('monthly listeners/readers', 'słuchacze/czytelnicy miesięcznie'),
  achievements: bi('achievements', 'osiągnięcia'),
  pressEmail: bi('press e-mail', 'e-mail do mediów'),
  period: bi('period', 'okres'),
  amount: bi('amount', 'kwota'),
  note: bi('note', 'uwagi'),
  placementUrl: bi('placement link', 'link do umieszczenia'),
  scheduledFor: bi('scheduled date', 'termin emisji'),
  curatorNote: bi('note', 'notatka'),
  email: bi('e-mail', 'e-mail'),
  region: bi('region', 'region'),
  creatorType: bi('creator type', 'typ twórcy'),
  submission: bi('submission mode', 'tryb zgłoszeń'),
  stage: bi('stage', 'etap'),
  tier: bi('recommended level', 'zalecany poziom'),
};

function fieldName(field) {
  return isBi(field) ? field : bi(String(field), String(field));
}

function err(field, en, pl) {
  const f = fieldName(field);
  return new ValidationError(bi(`"${f.en}" ${en}`, `Pole „${f.pl}” ${pl}`));
}

function str(v, field, { required = false, max = 200 } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw err(field, 'is required.', 'jest wymagane.');
    return '';
  }
  if (typeof v !== 'string') throw err(field, 'must be text.', 'musi być tekstem.');
  const t = v.trim();
  if (required && !t) throw err(field, 'is required.', 'jest wymagane.');
  if (t.length > max) throw err(field, `can have at most ${max} characters.`, `może mieć maks. ${max} znaków.`);
  return t;
}

function num(v, field, { min = 0, max = Number.MAX_SAFE_INTEGER, required = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw err(field, 'is required.', 'jest wymagane.');
    return 0;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw err(field, `must be a number between ${min} and ${max}.`, `musi być liczbą z zakresu ${min}–${max}.`);
  }
  return n;
}

function url(v, field, opts = {}) {
  const t = str(v, field, { ...opts, max: 500 });
  if (!t) return t;
  let parsed;
  try {
    parsed = new URL(t);
  } catch {
    throw err(field, 'must be a valid URL.', 'musi być poprawnym adresem URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw err(field, 'must start with http:// or https://.', 'musi zaczynać się od http:// lub https://.');
  }
  return parsed.toString();
}

function email(v, field, opts = {}) {
  const t = str(v, field, { ...opts, max: 200 });
  if (t && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
    throw err(field, 'must be a valid e-mail address.', 'musi być poprawnym adresem e-mail.');
  }
  return t.toLowerCase();
}

function genres(v) {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new ValidationError(bi('Genres must be a list.', 'Gatunki muszą być listą.'));
  const out = [...new Set(v.map((g) => String(g).trim().toLowerCase()))].filter(Boolean);
  for (const g of out) {
    if (!GENRES.includes(g)) throw new ValidationError(bi(`Unknown genre: ${g}.`, `Nieznany gatunek: ${g}.`));
  }
  if (out.length > 10) throw new ValidationError(bi('At most 10 genres.', 'Maks. 10 gatunków.'));
  return out;
}

function creatorType(v) {
  const t = v === undefined || v === '' ? 'music' : String(v);
  if (!CREATOR_TYPES[t]) throw new ValidationError(bi('Unknown creator type.', 'Nieznany typ twórcy.'));
  return t;
}

function creatorTypes(v) {
  if (v === undefined) return ['music'];
  if (!Array.isArray(v) || !v.length) {
    throw new ValidationError(bi('Choose at least one creator type.', 'Wybierz co najmniej jeden typ twórców.'));
  }
  return [...new Set(v.map(creatorType))];
}

function collaboration(v) {
  if (!v || typeof v !== 'object') throw new ValidationError(bi('Collaboration terms are missing.', 'Brak warunków współpracy.'));
  const model = str(v.model, F.model, { required: true });
  if (!COLLAB_MODELS[model]) throw new ValidationError(bi('Unknown collaboration model.', 'Nieznany model współpracy.'));
  const out = { model, ratePercent: 0, feePLN: 0, durationMonths: 0, terms: str(v.terms, F.terms, { max: 2000 }) };
  if (PERCENT_MODELS.has(model)) {
    out.ratePercent = num(v.ratePercent, F.rate, { min: 1, max: 50, required: true });
    out.durationMonths = num(v.durationMonths, F.duration, { min: 1, max: 36, required: true });
  }
  if (model === 'fee') {
    out.feePLN = num(v.feePLN, F.fee, { min: 1, max: 100000, required: true });
  }
  return out;
}

function outletInput(body, { partial = false } = {}) {
  const req = !partial;
  const out = {};
  const has = (k) => !partial || body[k] !== undefined;
  if (has('name')) out.name = str(body.name, F.name, { required: req, max: 120 });
  if (has('type')) {
    out.type = str(body.type, F.type, { required: req });
    if (!OUTLET_TYPES[out.type]) throw new ValidationError(bi('Unknown outlet type.', 'Nieznany typ miejsca promocji.'));
  }
  if (has('genres')) out.genres = genres(body.genres);
  if (has('creatorTypes')) out.creatorTypes = creatorTypes(body.creatorTypes);
  if (has('country')) out.country = str(body.country, F.country, { max: 60 });
  if (has('language')) out.language = str(body.language, F.language, { max: 60 });
  if (has('reach')) out.reach = Math.round(num(body.reach, F.reach, { max: 1e10 }));
  if (has('url')) out.url = url(body.url, F.link, { required: req });
  if (has('contactEmail')) out.contactEmail = email(body.contactEmail, F.contactEmail, { required: req });
  if (has('description')) out.description = str(body.description, F.description, { max: 2000 });
  if (has('responseDays')) out.responseDays = Math.round(num(body.responseDays, F.responseDays, { max: 90 }));
  if (has('acceptsSubmissions')) out.acceptsSubmissions = body.acceptsSubmissions !== false;
  if (has('minLevel')) out.minLevel = Math.round(num(body.minLevel, F.minLevel, { min: 0, max: 5 })) || 1;
  if (has('collaboration')) out.collaboration = collaboration(body.collaboration);
  return out;
}

function dateInput(value, field, { required = false } = {}) {
  const d = str(value, field, { required, max: 10 });
  if (d && (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`)))) {
    throw err(field, 'must use the YYYY-MM-DD format.', 'musi mieć format RRRR-MM-DD.');
  }
  return d;
}

function trackFields(body) {
  return {
    creatorType: creatorType(body.creatorType),
    artistName: str(body.artistName, F.artist, { required: true, max: 120 }),
    artistEmail: email(body.artistEmail, F.artistEmail, { required: true }),
    trackTitle: str(body.trackTitle, F.title, { required: true, max: 160 }),
    trackUrl: url(body.trackUrl, F.workUrl, { required: true }),
    genre: genres(body.genre ? [body.genre] : [])[0] || '',
    releaseDate: dateInput(body.releaseDate, F.releaseDate),
    message: str(body.message, F.message, { max: 2000 }),
  };
}

function submissionInput(body) {
  let outletIds = body.outletIds;
  if (!Array.isArray(outletIds) || outletIds.length === 0) {
    throw new ValidationError(bi('Choose at least one outlet.', 'Wybierz co najmniej jedno miejsce promocji.'));
  }
  outletIds = [...new Set(outletIds.map(String))];
  if (outletIds.length > 25) throw new ValidationError(bi('At most 25 outlets per submission.', 'Maks. 25 miejsc w jednym zgłoszeniu.'));
  if (body.acceptTerms !== true) {
    throw new ValidationError(bi('You must accept the collaboration terms of the selected outlets.', 'Musisz zaakceptować warunki współpracy wybranych miejsc.'));
  }
  return { outletIds, ...trackFields(body) };
}

function campaignInput(body) {
  if (body.acceptTerms !== true) {
    throw new ValidationError(bi('You must accept the collaboration terms of the outlets in the campaign.', 'Musisz zaakceptować warunki współpracy miejsc wybranych do kampanii.'));
  }
  const fields = trackFields(body);
  if (!fields.genre) throw new ValidationError(bi('Choose a genre – outlet selection depends on it.', 'Wybierz gatunek – od niego zależy dobór miejsc.'));
  fields.releaseDate = dateInput(body.releaseDate, F.releaseDate, { required: true });
  return { ...fields, budgetPLN: num(body.budgetPLN, F.budget, { max: 100000 }) };
}

function planInput(body) {
  return {
    creatorType: creatorType(body.creatorType),
    genre: genres(body.genre ? [body.genre] : [])[0] || '',
    releaseDate: dateInput(body.releaseDate, F.releaseDate, { required: true }),
    budgetPLN: num(body.budgetPLN, F.budget, { max: 100000 }),
  };
}

const PROFILE_LINKS = ['spotify', 'youtube', 'instagram', 'tiktok', 'soundcloud', 'website'];

function profileInput(body) {
  const links = {};
  for (const k of PROFILE_LINKS) links[k] = url((body.links || {})[k], `${k}`);
  return {
    creatorType: creatorType(body.creatorType),
    name: str(body.name, F.artist, { required: true, max: 120 }),
    bio: str(body.bio, F.bio, { max: 3000 }),
    bioEn: str(body.bioEn, F.bioEn, { max: 3000 }),
    photoUrl: url(body.photoUrl, F.photo),
    country: str(body.country, F.country, { max: 60 }),
    city: str(body.city, F.city, { max: 60 }),
    genres: genres(body.genres),
    monthlyListeners: Math.round(num(body.monthlyListeners, F.listeners, { max: 1e9 })),
    achievements: str(body.achievements, F.achievements, { max: 2000 }),
    contactEmail: email(body.contactEmail, F.pressEmail),
    links,
  };
}

function periodInput(v) {
  const p = str(v, F.period, { required: true, max: 7 });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) throw new ValidationError(bi('The period must use the YYYY-MM format.', 'Okres musi mieć format RRRR-MM.'));
  return p;
}

module.exports = {
  ValidationError,
  F,
  str,
  num,
  url,
  email,
  outletInput,
  submissionInput,
  campaignInput,
  profileInput,
  planInput,
  periodInput,
};

'use strict';

const { OUTLET_TYPES, COLLAB_MODELS, PERCENT_MODELS, GENRES } = require('./catalog');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

function str(v, field, { required = false, max = 200 } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw new ValidationError(`Pole "${field}" jest wymagane.`);
    return '';
  }
  if (typeof v !== 'string') throw new ValidationError(`Pole "${field}" musi być tekstem.`);
  const t = v.trim();
  if (required && !t) throw new ValidationError(`Pole "${field}" jest wymagane.`);
  if (t.length > max) throw new ValidationError(`Pole "${field}" może mieć maks. ${max} znaków.`);
  return t;
}

function num(v, field, { min = 0, max = Number.MAX_SAFE_INTEGER, required = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (required) throw new ValidationError(`Pole "${field}" jest wymagane.`);
    return 0;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new ValidationError(`Pole "${field}" musi być liczbą z zakresu ${min}–${max}.`);
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
    throw new ValidationError(`Pole "${field}" musi być poprawnym adresem URL.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ValidationError(`Pole "${field}" musi zaczynać się od http:// lub https://.`);
  }
  return parsed.toString();
}

function email(v, field, opts = {}) {
  const t = str(v, field, { ...opts, max: 200 });
  if (t && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) {
    throw new ValidationError(`Pole "${field}" musi być poprawnym adresem e-mail.`);
  }
  return t.toLowerCase();
}

function genres(v) {
  if (v === undefined) return [];
  if (!Array.isArray(v)) throw new ValidationError('Gatunki muszą być listą.');
  const out = [...new Set(v.map((g) => String(g).trim().toLowerCase()))].filter(Boolean);
  for (const g of out) {
    if (!GENRES.includes(g)) throw new ValidationError(`Nieznany gatunek: ${g}.`);
  }
  if (out.length > 10) throw new ValidationError('Maks. 10 gatunków.');
  return out;
}

function collaboration(v) {
  if (!v || typeof v !== 'object') throw new ValidationError('Brak warunków współpracy.');
  const model = str(v.model, 'model współpracy', { required: true });
  if (!COLLAB_MODELS[model]) throw new ValidationError('Nieznany model współpracy.');
  const out = { model, ratePercent: 0, feePLN: 0, durationMonths: 0, terms: str(v.terms, 'warunki', { max: 2000 }) };
  if (PERCENT_MODELS.has(model)) {
    out.ratePercent = num(v.ratePercent, 'prowizja %', { min: 1, max: 50, required: true });
    out.durationMonths = num(v.durationMonths, 'czas trwania umowy', { min: 1, max: 36, required: true });
  }
  if (model === 'fee') {
    out.feePLN = num(v.feePLN, 'opłata', { min: 1, max: 100000, required: true });
  }
  return out;
}

function outletInput(body, { partial = false } = {}) {
  const req = !partial;
  const out = {};
  const has = (k) => !partial || body[k] !== undefined;
  if (has('name')) out.name = str(body.name, 'nazwa', { required: req, max: 120 });
  if (has('type')) {
    out.type = str(body.type, 'typ', { required: req });
    if (!OUTLET_TYPES[out.type]) throw new ValidationError('Nieznany typ miejsca promocji.');
  }
  if (has('genres')) out.genres = genres(body.genres);
  if (has('country')) out.country = str(body.country, 'kraj', { max: 60 });
  if (has('language')) out.language = str(body.language, 'język', { max: 60 });
  if (has('reach')) out.reach = Math.round(num(body.reach, 'zasięg', { max: 1e10 }));
  if (has('url')) out.url = url(body.url, 'link', { required: req });
  if (has('contactEmail')) out.contactEmail = email(body.contactEmail, 'e-mail kontaktowy', { required: req });
  if (has('description')) out.description = str(body.description, 'opis', { max: 2000 });
  if (has('responseDays')) out.responseDays = Math.round(num(body.responseDays, 'czas odpowiedzi', { max: 90 }));
  if (has('acceptsSubmissions')) out.acceptsSubmissions = body.acceptsSubmissions !== false;
  if (has('collaboration')) out.collaboration = collaboration(body.collaboration);
  return out;
}

function submissionInput(body) {
  let outletIds = body.outletIds;
  if (!Array.isArray(outletIds) || outletIds.length === 0) {
    throw new ValidationError('Wybierz co najmniej jedno miejsce promocji.');
  }
  outletIds = [...new Set(outletIds.map(String))];
  if (outletIds.length > 25) throw new ValidationError('Maks. 25 miejsc w jednym zgłoszeniu.');
  if (body.acceptTerms !== true) {
    throw new ValidationError('Musisz zaakceptować warunki współpracy wybranych miejsc.');
  }
  return {
    outletIds,
    artistName: str(body.artistName, 'artysta', { required: true, max: 120 }),
    artistEmail: email(body.artistEmail, 'e-mail artysty', { required: true }),
    trackTitle: str(body.trackTitle, 'tytuł utworu', { required: true, max: 160 }),
    trackUrl: url(body.trackUrl, 'link do utworu', { required: true }),
    genre: genres(body.genre ? [body.genre] : [])[0] || '',
    releaseDate: str(body.releaseDate, 'data premiery', { max: 10 }),
    message: str(body.message, 'wiadomość', { max: 2000 }),
  };
}

function periodInput(v) {
  const p = str(v, 'okres', { required: true, max: 7 });
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) throw new ValidationError('Okres musi mieć format RRRR-MM.');
  return p;
}

module.exports = {
  ValidationError,
  str,
  num,
  url,
  outletInput,
  submissionInput,
  periodInput,
};

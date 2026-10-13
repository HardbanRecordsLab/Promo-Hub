'use strict';

// Server-side i18n. Content is stored as bilingual objects { en, pl } and localized once,
// right before a response is sent. English is the default language.

const LANGS = ['en', 'pl'];
const DEFAULT_LANG = 'en';

function getLang(req, url) {
  const q = url && url.searchParams.get('lang');
  const h = req.headers['x-lang'];
  const lang = String(q || h || '').toLowerCase().slice(0, 2);
  return LANGS.includes(lang) ? lang : DEFAULT_LANG;
}

// Bilingual text: bi('Hello', 'Cześć').
function bi(en, pl) {
  return { en, pl };
}

function isBi(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length === 2 && typeof v.en === 'string' && typeof v.pl === 'string';
}

// Deep-localizes a value: every { en, pl } object becomes a plain string.
function localize(value, lang) {
  if (Array.isArray(value)) return value.map((x) => localize(x, lang));
  if (isBi(value)) return value[lang] || value.en;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = localize(v, lang);
    return out;
  }
  return value;
}

// Text in one language, for building messages from bilingual parts.
function pick(v, lang) {
  return isBi(v) ? v[lang] : String(v ?? '');
}

// Joins several bilingual texts into one.
function joinBi(list, sep = ' ') {
  return bi(list.map((x) => pick(x, 'en')).join(sep), list.map((x) => pick(x, 'pl')).join(sep));
}

module.exports = { LANGS, DEFAULT_LANG, getLang, bi, isBi, localize, pick, joinBi };

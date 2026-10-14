'use strict';

const fs = require('fs');
const path = require('path');
const {
  CREATOR_TYPES,
  GENRE_LABELS,
  OUTLET_TYPES,
  COLLAB_MODELS,
  GENRES,
  SUBMISSION_STATUSES,
  CURATOR_TRANSITIONS,
  PLACED_STATUSES,
  PERCENT_MODELS,
} = require('./catalog');
const { newId, newSecret, hashSecret, secretMatches } = require('./db');
const v = require('./validate');
const { commissionFor, summarize, split, round2 } = require('./settlement');
const { buildPlan, orchestraScore, personalize } = require('./campaign');
const { CHANNELS } = require('./channels');
const { careerFor, LEVELS } = require('./career');
const { simulate } = require('./simulate');
const { nextActions } = require('./autopilot');
const ent = require('./entities');
const edge = require('./edge');
const { bi, isBi, pick, joinBi, localize, getLang } = require('./i18n');

const MAX_BODY = 2 * 1024 * 1024; // allows CSV imports of the Global Database
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

// message: plain string or bilingual { en, pl }.
class HttpError extends Error {
  constructor(status, message) {
    super(isBi(message) ? message.en : message);
    this.i18n = isBi(message) ? message : null;
    this.status = status;
  }
}

// Every `bi(...)`-style object below is localized once, right before sending the response.
const E = {
  adminToken: bi('Invalid admin token.', 'Nieprawidłowy token administratora.'),
  artistKey: bi('Invalid creator key.', 'Nieprawidłowy klucz twórcy.'),
  needKey: bi('Provide your creator key.', 'Podaj klucz twórcy.'),
  curatorKey: bi('Invalid curator key.', 'Nieprawidłowy klucz kuratora.'),
};

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(json);
}

function sendText(res, status, text, type) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new HttpError(413, bi('Request too large.', 'Zbyt duże żądanie.')));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('not an object');
        }
        resolve(parsed);
      } catch {
        reject(new HttpError(400, bi('Invalid JSON.', 'Nieprawidłowy JSON.')));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const { pathname } = new URL(req.url, 'http://x');
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || !path.extname(rel)) rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data: https:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; " +
        // Quick review players (YouTube without cookies, Spotify, SoundCloud).
        'frame-src https://www.youtube-nocookie.com https://open.spotify.com https://w.soundcloud.com',
    });
    res.end(buf);
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

function createApp(store, {
  adminToken = process.env.ADMIN_TOKEN,
  platformFeePercent = Number(process.env.PLATFORM_FEE_PERCENT ?? 20),
  trackCommissionCapPercent = Number(process.env.TRACK_COMMISSION_CAP_PERCENT ?? 30),
  discoverySharePercent = Number(process.env.DISCOVERY_SHARE_PERCENT ?? 2),
  discoveryMonths = Number(process.env.DISCOVERY_MONTHS ?? 24),
  now = () => new Date(),
} = {}) {
  const data = store.data;

  // Gwarancja odpowiedzi: zgłoszenie bez decyzji po terminie kuratora wygasa i obniża jego ranking.
  function expireOverdue() {
    let changed = false;
    const t = now().getTime();
    for (const s of data.submissions) {
      if (!['new', 'listening'].includes(s.status)) continue;
      const outlet = data.outlets.find((o) => o.id === s.outletId);
      const days = (outlet && outlet.responseDays) || 7;
      if (t - Date.parse(s.createdAt) > days * DAY_MS) {
        s.status = 'expired';
        s.history.push({ at: new Date(t).toISOString(), status: 'expired', by: 'system', note: bi(`No response within ${days} days.`, `Brak odpowiedzi w ${days} dni.`) });
        changed = true;
      }
    }
    if (changed) store.save();
  }

  const findOutlet = (id) => {
    const o = data.outlets.find((x) => x.id === id);
    if (!o) throw new HttpError(404, bi('Outlet not found.', 'Nie znaleziono miejsca promocji.'));
    return o;
  };
  const findSubmission = (id) => {
    const s = data.submissions.find((x) => x.id === id);
    if (!s) throw new HttpError(404, bi('Submission not found.', 'Nie znaleziono zgłoszenia.'));
    return s;
  };

  const isAdmin = (req) => Boolean(adminToken) && req.headers['x-admin-token'] === adminToken;
  const isCurator = (req, outlet) => isAdmin(req) || secretMatches(req.headers['x-manage-key'], outlet.manageKeyHash);
  const isArtist = (req, sub) => secretMatches(req.headers['x-artist-key'], sub.artistKeyHash);

  function outletStats(outlet) {
    const subs = data.submissions.filter((s) => s.outletId === outlet.id && s.status !== 'withdrawn');
    const decided = subs.filter((s) => s.status === 'rejected' || PLACED_STATUSES.has(s.status));
    const placed = subs.filter((s) => PLACED_STATUSES.has(s.status));
    const expired = subs.filter((s) => s.status === 'expired');
    const responseHours = decided
      .map((s) => {
        const first = s.history.find((h) => h.by === 'curator');
        return first ? (Date.parse(first.at) - Date.parse(s.createdAt)) / 3600000 : null;
      })
      .filter((h) => h !== null);
    return {
      submissions: subs.length,
      placed: placed.length,
      acceptanceRate: decided.length ? Math.round((placed.length / decided.length) * 100) : null,
      responseRate: decided.length + expired.length
        ? Math.round((decided.length / (decided.length + expired.length)) * 100)
        : null,
      avgResponseHours: responseHours.length
        ? Math.round(responseHours.reduce((a, b) => a + b, 0) / responseHours.length)
        : null,
    };
  }

  // Ranking dopasowania 0–100: gatunek, skuteczność, rzetelność, weryfikacja, zasięg, koszt dla artysty.
  function matchScore(o, { genre }) {
    const st = outletStats(o);
    const reasons = [];
    let score = 0;
    if (genre && o.genres.includes(genre)) { score += 35; reasons.push(bi('Your genre', 'Twój gatunek')); }
    else if (!o.genres.length) { score += 15; reasons.push(bi('All genres', 'Wszystkie gatunki')); }
    const acc = st.acceptanceRate ?? 30;
    score += Math.min(acc, 60) / 3;
    if (st.acceptanceRate !== null && st.acceptanceRate >= 25) reasons.push(bi(`Accepts ${st.acceptanceRate}%`, `Akceptuje ${st.acceptanceRate}%`));
    const resp = st.responseRate ?? 80;
    score += resp / 10;
    if (st.responseRate !== null && st.responseRate >= 90) reasons.push(bi('Always responds', 'Zawsze odpowiada'));
    if (o.verified) { score += 10; reasons.push(bi('Verified', 'Zweryfikowany')); }
    score += Math.min(Math.log10((o.reach || 0) + 1), 7) * 2;
    if (['commission', 'free', 'barter'].includes(o.collaboration.model)) {
      score += 5;
      reasons.push(o.collaboration.model === 'commission' ? bi('Pay only for results', 'Płacisz tylko za efekt') : bi('No upfront fees', 'Bez opłat z góry'));
    }
    return { score: Math.round(Math.min(score, 100)), reasons };
  }

  function publicOutlet(o, { withContact = false } = {}) {
    const { manageKeyHash, contactEmail, ...rest } = o;
    return { ...rest, creatorTypes: o.creatorTypes || ['music'], ...(withContact ? { contactEmail } : {}), stats: outletStats(o) };
  }

  function profileFor(keyHash) {
    return data.artists.find((a) => a.keyHash === keyHash) || null;
  }

  function publicProfile(a) {
    if (!a) return null;
    const { keyHash, ...rest } = a;
    return rest;
  }

  function slugify(name) {
    const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'artysta';
    let slug = base;
    for (let i = 2; data.artists.some((a) => a.slug === slug); i += 1) slug = `${base}-${i}`;
    return slug;
  }

  function careerOf(keyHash) {
    return careerFor({
      submissions: data.submissions.filter((x) => x.artistKeyHash === keyHash),
      outlets: data.outlets,
      profile: profileFor(keyHash),
    });
  }

  function publicSubmission(s, { forCurator = false } = {}) {
    const { artistKeyHash, artistEmail, ...rest } = s;
    const outlet = data.outlets.find((o) => o.id === s.outletId);
    const profile = forCurator ? profileFor(artistKeyHash) : null;
    return {
      ...rest,
      ...(profile ? { artistSlug: profile.slug, artistLevel: careerOf(artistKeyHash).name } : {}),
      ...(forCurator ? { artistEmail } : {}),
      outletName: outlet ? outlet.name : bi('(deleted)', '(usunięte)'),
      outletType: outlet ? outlet.type : null,
      ...(s.discovery ? { discoveryUntil: edge.discoveryWindow(s).to } : {}),
      settlement: summarize(s),
    };
  }

  const outletsById = () => Object.fromEntries(data.outlets.map((o) => [o.id, o]));

  // The first outlet that accepted this creator (holds the discovery share), if any.
  function discoveryOf(keyHash) {
    return data.submissions.find((x) => x.artistKeyHash === keyHash && x.discovery) || null;
  }

  function momentumOf(keyHash) {
    const own = data.submissions.filter((x) => x.artistKeyHash === keyHash);
    return edge.momentum(own.filter((x) => PLACED_STATUSES.has(x.status)), outletsById(), {
      today: now(),
      allFeedback: own.filter((x) => x.feedback).map((x) => x.feedback.tags),
    });
  }

  function history(sub, status, by, note = '') {
    sub.history.push({ at: now().toISOString(), status, by, note });
  }

  function resolveArtistKey(raw) {
    let artistKey = typeof raw === 'string' ? raw.trim() : '';
    if (artistKey && artistKey.length < 16) throw new HttpError(400, bi('The creator key is too short.', 'Klucz twórcy jest za krótki.'));
    if (!artistKey) artistKey = newSecret();
    return { artistKey, keyHash: hashSecret(artistKey) };
  }

  function createSubmissions({ outletIds, fields, keyHash, campaignId = null, by = null, lang = 'en' }) {
    const created = [];
    const skipped = [];
    const level = careerOf(keyHash).level;
    for (const outletId of outletIds) {
      const outlet = data.outlets.find((o) => o.id === outletId);
      if (!outlet) {
        skipped.push({ outletId, reason: bi('Does not exist.', 'Nie istnieje.') });
        continue;
      }
      if (!outlet.acceptsSubmissions) {
        skipped.push({ outletId, reason: bi(`${outlet.name}: not accepting submissions right now.`, `${outlet.name}: nie przyjmuje teraz zgłoszeń.`) });
        continue;
      }
      if (!(outlet.creatorTypes || ['music']).includes(fields.creatorType || 'music')) {
        skipped.push({ outletId, reason: bi(`${outlet.name}: does not accept this creator type.`, `${outlet.name}: nie przyjmuje zgłoszeń od tego typu twórców.`) });
        continue;
      }
      if ((outlet.minLevel || 1) > level) {
        skipped.push({ outletId, reason: bi(`${outlet.name}: requires creator level ${outlet.minLevel} (you are level ${level}).`, `${outlet.name}: wymaga poziomu twórcy ${outlet.minLevel} (masz ${level}).`) });
        continue;
      }
      const dup = data.submissions.find((x) =>
        x.outletId === outletId && x.trackUrl === fields.trackUrl && !['rejected', 'withdrawn', 'expired'].includes(x.status));
      if (dup) {
        skipped.push({ outletId, reason: bi(`${outlet.name}: this work is already awaiting a decision.`, `${outlet.name}: to dzieło już czeka na decyzję.`) });
        continue;
      }
      const sub = {
        id: newId('sub'),
        outletId,
        campaignId,
        ...fields,
        // Generator pitchu: {nazwa} i {gatunki} są podmieniane dla każdego kuratora.
        message: personalize(fields.message, outlet, lang),
        status: 'new',
        // Warunki są zamrażane w chwili zgłoszenia – późniejsza zmiana cennika nie działa wstecz.
        agreement: { ...outlet.collaboration, platformFeePercent },
        reviewFee: outlet.collaboration.model === 'fee'
          ? { amountPLN: outlet.collaboration.feePLN, ...split(outlet.collaboration.feePLN, platformFeePercent), paid: false }
          : null,
        curatorNote: '',
        feedback: null,
        artistLevel: level,
        // Discovery share terms are frozen too: they only matter if this outlet is the first to accept.
        discoveryTerms: edge.discoveryTerms(discoverySharePercent, discoveryMonths),
        placementUrl: '',
        scheduledFor: '',
        placedAt: null,
        revenue: [],
        history: [],
        createdAt: now().toISOString(),
        artistKeyHash: keyHash,
      };
      history(sub, 'new', by || (campaignId ? 'campaign' : 'artist'));
      data.submissions.push(sub);
      created.push(sub);
    }
    return { created, skipped };
  }

  function candidatesFor(genre, level = 1, creatorType = 'music') {
    return data.outlets
      .filter((o) => o.acceptsSubmissions && (o.minLevel || 1) <= level)
      .filter((o) => (o.creatorTypes || ['music']).includes(creatorType))
      .filter((o) => !genre || !o.genres.length || o.genres.includes(genre))
      .map((o) => ({ ...publicOutlet(o), match: matchScore(o, { genre }) }));
  }

  // Dotychczasowy dorobek artysty – baza dla symulatora awansu.
  function footprintOf(keyHash) {
    const placed = keyHash ? data.submissions.filter((x) => x.artistKeyHash === keyHash && PLACED_STATUSES.has(x.status)) : [];
    const outs = placed.map((x) => data.outlets.find((o) => o.id === x.outletId)).filter(Boolean);
    const profile = keyHash ? profileFor(keyHash) : null;
    return {
      placements: placed.length,
      reach: outs.reduce((a, o) => a + (o.reach || 0), 0),
      types: new Set(outs.map((o) => o.type)),
      countries: new Set(outs.map((o) => (o.country || '').toLowerCase()).filter(Boolean)),
      listeners: (profile && profile.monthlyListeners) || 0,
    };
  }

  function planFor(input, keyHash = null) {
    const plan = buildPlanFor(input, keyHash);
    const level = keyHash ? careerOf(keyHash).level : 1;
    const next = LEVELS.find((l) => l.level === level + 1);
    const picked = plan.waves.flatMap((w) => w.outletIds).map((id) => data.outlets.find((o) => o.id === id)).filter(Boolean)
      .map((o) => publicOutlet(o));
    plan.simulation = simulate(picked, { footprint: footprintOf(keyHash), nextReq: next ? next.req : null });
    if (next) plan.simulation.nextLevel = next.name;
    return plan;
  }

  function buildPlanFor({ genre, budgetPLN, releaseDate, creatorType = 'music' }, keyHash = null) {
    const level = keyHash ? careerOf(keyHash).level : 1;
    return buildPlan({
      candidates: candidatesFor(genre, level, creatorType),
      entities: publicEntities(creatorType),
      budgetPLN,
      releaseDate,
      creatorType,
      today: now().toISOString().slice(0, 10),
    });
  }

  // Efekt domina: umieszczenie w kampanii od razu otwiera drzwi do większych miejsc,
  // a pitch zawiera świeży dowód społeczny. Maks. MAX_DOMINO fal na kampanię.
  const MAX_DOMINO = 3;
  function triggerDomino(sub) {
    const c = sub.campaignId && data.campaigns.find((x) => x.id === sub.campaignId);
    if (!c) return;
    if (c.waves.filter((w) => w.domino).length >= MAX_DOMINO) return;
    const placedOutlet = data.outlets.find((o) => o.id === sub.outletId);
    if (!placedOutlet) return;
    const already = new Set(data.submissions
      .filter((x) => x.artistKeyHash === c.artistKeyHash && x.trackUrl === c.trackUrl)
      .map((x) => x.outletId));
    const level = careerOf(c.artistKeyHash).level;
    const next = candidatesFor(c.genre, level, c.creatorType || 'music')
      .filter((o) => !already.has(o.id) && o.collaboration.model !== 'fee' && (o.reach || 0) > (placedOutlet.reach || 0))
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 3);
    if (!next.length) return;
    const proof = c.lang === 'pl'
      ? `\n\nPS. Moje dzieło właśnie trafiło do: ${placedOutlet.name} (${pick(OUTLET_TYPES[placedOutlet.type], 'pl')}).`
      : `\n\nPS. My work was just featured by: ${placedOutlet.name} (${pick(OUTLET_TYPES[placedOutlet.type], 'en')}).`;
    const wave = {
      date: now().toISOString().slice(0, 10),
      phase: 'G',
      name: bi(`Domino effect: after ${placedOutlet.name}`, `Efekt domina: po umieszczeniu w ${placedOutlet.name}`),
      how: bi('Success opens bigger outlets – a submission with social proof was sent automatically.', 'Sukces otwiera kolejne, większe miejsca – zgłoszenie z dowodem społecznym wysłane automatycznie.'),
      outletIds: next.map((o) => o.id),
      outlets: next.map((o) => ({ id: o.id, name: o.name, type: o.type, model: o.collaboration.model, score: o.match.score })),
      domino: true,
      sent: false,
      sentAt: null,
      submissionIds: [],
      skipped: [],
    };
    c.waves.push(wave);
    for (const t of next.map((o) => o.type)) if (!c.sections.includes(t)) c.sections.push(t);
    sendWave(c, wave, proof);
  }

  function publicEntity(e) {
    const { contactEmail, stageHistory, stage, source, outletId, evidence, sourceUrl, confidence, lastChecked, noteKey, ...rest } = e;
    return rest;
  }

  // Zweryfikowane podmioty ze Światowej Bazy, oznaczone przez admina jako publiczne.
  function publicEntities(creatorType) {
    return data.entities
      .filter((e) => e.verified && e.publicListing && e.stage !== 'declined' && !e.outletId)
      .filter((e) => !creatorType || e.creatorTypes.includes(creatorType))
      .map(publicEntity);
  }

  function requireAdmin(req) {
    if (!isAdmin(req)) throw new HttpError(403, E.adminToken);
  }

  function findEntity(id) {
    const e = data.entities.find((x) => x.id === id);
    if (!e) throw new HttpError(404, bi('Entity not found.', 'Nie znaleziono podmiotu.'));
    return e;
  }

  function findCampaign(req, id) {
    const c = data.campaigns.find((x) => x.id === id);
    if (!c) throw new HttpError(404, bi('Campaign not found.', 'Nie znaleziono kampanii.'));
    if (!secretMatches(req.headers['x-artist-key'], c.artistKeyHash)) throw new HttpError(403, E.artistKey);
    return c;
  }

  function sendWave(c, wave, extraMessage = '') {
    const { id, budgetPLN, spentPLN, forecast, simulation, sections, waves, tasks, createdAt, artistKeyHash, ...fields } = c;
    const { created, skipped } = createSubmissions({
      outletIds: wave.outletIds,
      fields: { ...fields, message: fields.message + extraMessage },
      keyHash: c.artistKeyHash,
      campaignId: c.id,
      by: wave.domino ? 'domino' : null,
      lang: c.lang || 'en',
    });
    wave.sent = true;
    wave.sentAt = now().toISOString();
    wave.submissionIds = created.map((x) => x.id);
    wave.skipped = skipped;
  }

  // Dyrygent: wysyła fale, których termin nadszedł.
  function dispatchDueWaves() {
    const today = now().toISOString().slice(0, 10);
    let changed = false;
    for (const c of data.campaigns) {
      for (const w of c.waves) {
        if (!w.sent && w.date <= today) {
          sendWave(c, w);
          changed = true;
        }
      }
    }
    if (changed) store.save();
  }

  function publicCampaign(c) {
    const { artistKeyHash, ...rest } = c;
    const subs = data.submissions.filter((x) => x.campaignId === c.id);
    const byStatus = {};
    for (const x of subs) byStatus[x.status] = (byStatus[x.status] || 0) + 1;
    return {
      ...rest,
      orchestraScore: orchestraScore(c),
      results: {
        sent: subs.length,
        byStatus,
        placed: subs.filter((x) => PLACED_STATUSES.has(x.status)).map((x) => publicSubmission(x)),
        reachPlaced: subs
          .filter((x) => PLACED_STATUSES.has(x.status))
          .reduce((a, x) => a + ((data.outlets.find((o) => o.id === x.outletId) || {}).reach || 0), 0),
      },
    };
  }

  const routes = [
    ['GET', /^\/api\/meta$/, () => ({
      platformFeePercent,
      trackCommissionCapPercent,
      discoverySharePercent,
      discoveryMonths,
      feedbackTags: edge.FEEDBACK_TAGS,
      momentumTiers: edge.MOMENTUM_TIERS,
      creators: CREATOR_TYPES,
      genreLabels: GENRE_LABELS,
      channels: CHANNELS,
      entityKinds: ent.ENTITY_KINDS,
      entityStages: ent.STAGES,
      submissionModes: ent.SUBMISSION_MODES,
      regions: ent.REGIONS,
      types: OUTLET_TYPES,
      models: COLLAB_MODELS,
      genres: GENRES,
      statuses: SUBMISSION_STATUSES,
      transitions: CURATOR_TRANSITIONS,
    })],

    ['GET', /^\/api\/stats$/, () => {
      const byType = {};
      for (const o of data.outlets) byType[o.type] = (byType[o.type] || 0) + 1;
      const placed = data.submissions.filter((s) => PLACED_STATUSES.has(s.status)).length;
      return {
        outlets: data.outlets.length,
        totalReach: data.outlets.reduce((a, o) => a + (o.reach || 0), 0),
        submissions: data.submissions.length,
        placed,
        byType,
      };
    }],

    ['GET', /^\/api\/outlets$/, (req, _m, url) => {
      const q = (url.searchParams.get('q') || '').toLowerCase().trim();
      const type = url.searchParams.get('type');
      const genre = url.searchParams.get('genre');
      const model = url.searchParams.get('model');
      const country = (url.searchParams.get('country') || '').toLowerCase().trim();
      const open = url.searchParams.get('open') === '1';
      const creator = url.searchParams.get('creator');
      const sort = url.searchParams.get('sort') || 'reach';
      let list = data.outlets.filter((o) =>
        (!type || o.type === type) &&
        (!creator || (o.creatorTypes || ['music']).includes(creator)) &&
        (!genre || o.genres.includes(genre) || o.genres.length === 0) &&
        (!model || o.collaboration.model === model) &&
        (!country || (o.country || '').toLowerCase().includes(country)) &&
        (!open || o.acceptsSubmissions) &&
        (!q || [o.name, pick(o.description, 'en'), pick(o.description, 'pl'), o.country, ...o.genres].join(' ').toLowerCase().includes(q)));
      const sorters = {
        reach: (a, b) => b.reach - a.reach,
        name: (a, b) => a.name.localeCompare(b.name, 'pl'),
        new: (a, b) => b.createdAt.localeCompare(a.createdAt),
        rate: (a, b) => a.collaboration.ratePercent - b.collaboration.ratePercent,
      };
      list = [...list].sort(sorters[sort] || sorters.reach);
      return { outlets: list.map((o) => publicOutlet(o)) };
    }],

    ['GET', /^\/api\/match$/, (req, _m, url) => {
      const genre = url.searchParams.get('genre') || '';
      const type = url.searchParams.get('type') || '';
      const model = url.searchParams.get('model') || '';
      const creator = url.searchParams.get('creator') || '';
      const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
      const key = req.headers['x-artist-key'];
      const level = key ? careerOf(hashSecret(key)).level : 1;
      const list = data.outlets
        .filter((o) => o.acceptsSubmissions && (!type || o.type === type) && (!model || o.collaboration.model === model))
        .filter((o) => !creator || (o.creatorTypes || ['music']).includes(creator))
        .filter((o) => !genre || !o.genres.length || o.genres.includes(genre))
        .map((o) => ({
          ...publicOutlet(o),
          match: matchScore(o, { genre }),
          odds: edge.acceptanceOdds(o, { genre, creatorType: creator || 'music', level }, data.submissions),
        }))
        .sort((a, b) => b.match.score - a.match.score)
        .slice(0, limit);
      return { outlets: list, level };
    }],

    // ---------- Światowa Baza Podmiotów ----------
    ['GET', /^\/api\/entities$/, (req, _m, url) => {
      const creator = url.searchParams.get('creator') || '';
      return { entities: publicEntities(creator) };
    }],

    ['GET', /^\/api\/admin\/entities$/, (req, _m, url) => {
      requireAdmin(req);
      const p = (k) => (url.searchParams.get(k) || '').trim();
      const q = p('q').toLowerCase();
      const list = data.entities.filter((e) =>
        (!p('kind') || e.kind === p('kind')) &&
        (!p('creator') || e.creatorTypes.includes(p('creator'))) &&
        (!p('region') || e.region === p('region')) &&
        (!p('stage') || e.stage === p('stage')) &&
        (!p('submission') || e.submission === p('submission')) &&
        (!p('model') || e.model === p('model')) &&
        (!p('country') || e.country.toLowerCase().includes(p('country').toLowerCase())) &&
        (!q || ent.searchText(e).includes(q)));
      const count = (field) => {
        const out = {};
        for (const e of data.entities) {
          for (const v of [].concat(e[field])) out[v] = (out[v] || 0) + 1;
        }
        return out;
      };
      const countries = new Set(data.entities.map((e) => e.country).filter(Boolean));
      return {
        total: data.entities.length,
        countries: countries.size,
        facets: { stage: count('stage'), kind: count('kind'), region: count('region'), creatorTypes: count('creatorTypes'), submission: count('submission') },
        entities: list.sort((a, b) => a.name.localeCompare(b.name, 'pl')),
      };
    }],

    ['POST', /^\/api\/admin\/entities$/, async (req) => {
      requireAdmin(req);
      const input = ent.entityInput(await readBody(req));
      const key = ent.dedupeKey(input);
      if (data.entities.some((e) => ent.dedupeKey(e) === key)) throw new HttpError(409, bi('This entity is already in the database.', 'Taki podmiot już jest w bazie.'));
      const e = ent.makeEntity(input, { now });
      data.entities.push(e);
      store.save();
      return [201, e];
    }],

    ['POST', /^\/api\/admin\/entities\/import$/, async (req) => {
      requireAdmin(req);
      const { csv } = await readBody(req);
      const rows = ent.parseCsv(csv || '');
      const keys = new Set(data.entities.map(ent.dedupeKey));
      let added = 0;
      const errors = [];
      rows.forEach((row, i) => {
        try {
          const input = ent.entityInput(row);
          const key = ent.dedupeKey(input);
          if (keys.has(key)) { errors.push(`Wiersz ${i + 2}: duplikat (${input.name}).`); return; }
          keys.add(key);
          data.entities.push(ent.makeEntity(input, { now, source: 'csv' }));
          added += 1;
        } catch (err) {
          errors.push(`Wiersz ${i + 2}: ${err.message}`);
        }
      });
      if (added) store.save();
      return { added, skipped: errors.length, errors: errors.slice(0, 50) };
    }],

    ['GET', /^\/api\/admin\/entities\/export$/, (req) => {
      requireAdmin(req);
      return { raw: ent.toCsv(data.entities), type: 'text/csv; charset=utf-8' };
    }],

    ['PATCH', /^\/api\/admin\/entities\/([\w-]+)$/, async (req, m) => {
      requireAdmin(req);
      const e = findEntity(m[1]);
      const input = ent.entityInput(await readBody(req), { partial: true });
      if (input.stage && input.stage !== e.stage) e.stageHistory.push({ at: now().toISOString(), stage: input.stage });
      Object.assign(e, input);
      if (!e.verified) e.publicListing = false;
      e.updatedAt = now().toISOString();
      store.save();
      return e;
    }],

    ['DELETE', /^\/api\/admin\/entities\/([\w-]+)$/, (req, m) => {
      requireAdmin(req);
      const e = findEntity(m[1]);
      data.entities.splice(data.entities.indexOf(e), 1);
      store.save();
      return { deleted: true };
    }],

    ['GET', /^\/api\/admin\/entities\/([\w-]+)\/outreach$/, (req, m, url) => {
      requireAdmin(req);
      const e = findEntity(m[1]);
      const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'pl';
      const host = req.headers.host ? `http://${req.headers.host}` : '';
      return ent.outreach(e, { lang, platformFeePercent, capPercent: trackCommissionCapPercent, baseUrl: host });
    }],

    // Partner powiedział „tak”: podmiot staje się miejscem w katalogu z własnym kluczem kuratora.
    ['POST', /^\/api\/admin\/entities\/([\w-]+)\/convert$/, async (req, m) => {
      requireAdmin(req);
      const e = findEntity(m[1]);
      if (e.outletId) throw new HttpError(409, bi('This entity is already a partner in the catalog.', 'Ten podmiot jest już partnerem w katalogu.'));
      const body = await readBody(req);
      const input = v.outletInput({
        name: e.name,
        type: OUTLET_TYPES[e.kind] ? e.kind : 'other',
        url: e.url,
        contactEmail: body.contactEmail || e.contactEmail,
        creatorTypes: e.creatorTypes,
        country: e.country,
        reach: body.reach ?? e.reach ?? 0,
        genres: body.genres || [],
        description: typeof body.description === 'string' ? body.description : '',
        responseDays: body.responseDays || 14,
        minLevel: body.minLevel || 1,
        collaboration: body.collaboration || (PERCENT_MODELS.has(e.model)
          ? { model: e.model, ratePercent: 10, durationMonths: 6 }
          : { model: e.model, feePLN: 10 }),
      });
      if (!input.description && e.note) input.description = e.note;
      const manageKey = newSecret();
      const outlet = {
        id: newId('out'),
        language: '',
        acceptsSubmissions: true,
        ...input,
        verified: true,
        sample: false,
        entityId: e.id,
        createdAt: now().toISOString(),
        manageKeyHash: hashSecret(manageKey),
      };
      data.outlets.push(outlet);
      e.outletId = outlet.id;
      e.stage = 'partner';
      e.verified = true;
      e.stageHistory.push({ at: now().toISOString(), stage: 'partner' });
      store.save();
      return [201, { outlet: publicOutlet(outlet, { withContact: true }), manageKey, entity: e }];
    }],

    ['GET', /^\/api\/admin\/summary$/, (req) => {
      if (!isAdmin(req)) throw new HttpError(403, E.adminToken);
      let commissionFees = 0;
      let commissionFeesDue = 0;
      let reviewFees = 0;
      let reviewFeesDue = 0;
      for (const s of data.submissions) {
        for (const r of s.revenue) {
          commissionFees += r.platformFeePLN || 0;
          if (!r.paid) commissionFeesDue += r.platformFeePLN || 0;
        }
        if (s.reviewFee) {
          reviewFees += s.reviewFee.platformFeePLN;
          if (!s.reviewFee.paid) reviewFeesDue += s.reviewFee.platformFeePLN;
        }
      }
      return {
        platformFeePercent,
        earnings: {
          totalPLN: round2(commissionFees + reviewFees),
          fromCommissionsPLN: round2(commissionFees),
          fromReviewFeesPLN: round2(reviewFees),
          duePLN: round2(commissionFeesDue + reviewFeesDue),
        },
        pendingVerification: data.outlets.filter((o) => !o.verified).map((o) => publicOutlet(o, { withContact: true })),
        entities: {
          total: data.entities.length,
          partners: data.entities.filter((e) => e.stage === 'partner').length,
          inPipeline: data.entities.filter((e) => ['contacted', 'negotiation'].includes(e.stage)).length,
        },
        topOutlets: data.outlets
          .map((o) => ({ id: o.id, name: o.name, type: o.type, ...outletStats(o) }))
          .sort((a, b) => b.placed - a.placed)
          .slice(0, 10),
      };
    }],

    ['GET', /^\/api\/outlets\/([\w-]+)$/, (req, m) => publicOutlet(findOutlet(m[1]))],

    ['POST', /^\/api\/outlets$/, async (req) => {
      const input = v.outletInput(await readBody(req));
      const manageKey = newSecret();
      const outlet = {
        id: newId('out'),
        reach: 0,
        genres: [],
        country: '',
        language: '',
        description: '',
        responseDays: 7,
        acceptsSubmissions: true,
        minLevel: 1,
        ...input,
        verified: false,
        sample: false,
        createdAt: now().toISOString(),
        manageKeyHash: hashSecret(manageKey),
      };
      data.outlets.push(outlet);
      store.save();
      return [201, { outlet: publicOutlet(outlet, { withContact: true }), manageKey }];
    }],

    ['PATCH', /^\/api\/outlets\/([\w-]+)$/, async (req, m) => {
      const outlet = findOutlet(m[1]);
      if (!isCurator(req, outlet)) throw new HttpError(403, E.curatorKey);
      const body = await readBody(req);
      Object.assign(outlet, v.outletInput(body, { partial: true }));
      if (isAdmin(req) && typeof body.verified === 'boolean') outlet.verified = body.verified;
      outlet.updatedAt = now().toISOString();
      store.save();
      return publicOutlet(outlet, { withContact: true });
    }],

    ['DELETE', /^\/api\/outlets\/([\w-]+)$/, (req, m) => {
      const outlet = findOutlet(m[1]);
      if (!isCurator(req, outlet)) throw new HttpError(403, E.curatorKey);
      data.outlets.splice(data.outlets.indexOf(outlet), 1);
      store.save();
      return { deleted: true };
    }],

    // Panel kuratora: dane miejsca + skrzynka zgłoszeń.
    ['GET', /^\/api\/outlets\/([\w-]+)\/submissions$/, (req, m) => {
      const outlet = findOutlet(m[1]);
      if (!isCurator(req, outlet)) throw new HttpError(403, E.curatorKey);
      const subs = data.submissions
        .filter((s) => s.outletId === outlet.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((s) => publicSubmission(s, { forCurator: true }));
      const totals = subs.reduce(
        (acc, s) => ({
          commissionPLN: round2(acc.commissionPLN + s.settlement.commissionPLN),
          duePLN: round2(acc.duePLN + s.settlement.duePLN),
          paidPLN: round2(acc.paidPLN + s.settlement.paidPLN),
        }),
        { commissionPLN: 0, duePLN: 0, paidPLN: 0 },
      );
      const discoveries = data.submissions.filter((s) => s.outletId === outlet.id && s.discovery).length;
      return { outlet: publicOutlet(outlet, { withContact: true }), submissions: subs, totals, discoveries };
    }],

    ['POST', /^\/api\/submissions$/, async (req) => {
      const body = await readBody(req);
      const { outletIds, ...fields } = v.submissionInput(body);
      const { artistKey, keyHash } = resolveArtistKey(body.artistKey);
      const { created, skipped } = createSubmissions({ outletIds, fields, keyHash, lang: req.lang });
      if (!created.length) throw new HttpError(400, joinBi(skipped.map((x) => x.reason)));
      store.save();
      return [201, { artistKey, submissions: created.map((x) => publicSubmission(x)), skipped }];
    }],

    // Dyrygent kampanii: podgląd planu bez zapisu.
    ['POST', /^\/api\/campaigns\/preview$/, async (req) => {
      const input = v.planInput(await readBody(req));
      const key = req.headers['x-artist-key'];
      const plan = planFor(input, key ? hashSecret(key) : null);
      return { ...plan, platformFeePercent };
    }],

    ['POST', /^\/api\/campaigns$/, async (req) => {
      const body = await readBody(req);
      const input = v.campaignInput(body);
      const { artistKey, keyHash } = resolveArtistKey(body.artistKey);
      const plan = planFor(input, keyHash);
      if (!plan.waves.length) throw new HttpError(400, bi('No matching outlets for this genre and budget.', 'Brak pasujących miejsc dla tego gatunku i budżetu.'));
      const { budgetPLN, ...fields } = input;
      const campaign = {
        id: newId('cmp'),
        ...fields,
        budgetPLN,
        spentPLN: plan.spentPLN,
        forecast: plan.forecast,
        simulation: plan.simulation,
        sections: plan.sections,
        waves: plan.waves.map((w) => ({ ...w, sent: false, sentAt: null, submissionIds: [], skipped: [] })),
        tasks: plan.tasks.map((t) => ({ ...t, done: false })),
        createdAt: now().toISOString(),
        artistKeyHash: keyHash,
        lang: req.lang,
      };
      data.campaigns.push(campaign);
      dispatchDueWaves();
      store.save();
      return [201, { artistKey, campaign: publicCampaign(campaign) }];
    }],

    ['GET', /^\/api\/artist\/me$/, (req) => {
      const key = req.headers['x-artist-key'];
      if (!key) throw new HttpError(401, E.needKey);
      const keyHash = hashSecret(key);
      const known = data.submissions.some((x) => x.artistKeyHash === keyHash) ||
        data.campaigns.some((x) => x.artistKeyHash === keyHash) || profileFor(keyHash);
      if (!known) throw new HttpError(404, bi('No creator found for this key.', 'Nie znaleziono twórcy dla tego klucza.'));
      return { profile: publicProfile(profileFor(keyHash)), career: careerOf(keyHash) };
    }],

    // Klucz artysty bez zgłoszeń: start od profilu.
    ['POST', /^\/api\/artist\/register$/, () => {
      const { artistKey } = resolveArtistKey('');
      return [201, { artistKey }];
    }],

    ['PUT', /^\/api\/artist\/profile$/, async (req) => {
      const key = req.headers['x-artist-key'];
      if (!key || String(key).length < 16) throw new HttpError(401, E.needKey);
      const input = v.profileInput(await readBody(req));
      const keyHash = hashSecret(key);
      let profile = profileFor(keyHash);
      if (!profile) {
        profile = { id: newId('art'), slug: slugify(input.name), keyHash, createdAt: now().toISOString() };
        data.artists.push(profile);
      }
      Object.assign(profile, input, { updatedAt: now().toISOString() });
      store.save();
      return { profile: publicProfile(profile), career: careerOf(keyHash) };
    }],

    // Publiczny press kit (EPK) artysty.
    ['GET', /^\/api\/artists\/([\w-]+)$/, (req, m) => {
      const a = data.artists.find((x) => x.slug === m[1]);
      if (!a) throw new HttpError(404, bi('Creator not found.', 'Nie znaleziono twórcy.'));
      const { contactEmail, ...profile } = publicProfile(a);
      const placements = data.submissions
        .filter((x) => x.artistKeyHash === a.keyHash && PLACED_STATUSES.has(x.status))
        .map((x) => {
          const o = data.outlets.find((y) => y.id === x.outletId) || {};
          return { trackTitle: x.trackTitle, outletName: o.name, outletType: o.type, country: o.country, reach: o.reach, verifiedOutlet: Boolean(o.verified), placementUrl: x.placementUrl, at: x.placedAt, code: edge.verificationCode(x) };
        })
        .sort((p, q) => (q.at || '').localeCompare(p.at || ''));
      const career = careerOf(a.keyHash);
      const disc = discoveryOf(a.keyHash);
      const discOutlet = disc && data.outlets.find((o) => o.id === disc.outletId);
      const strengths = {};
      for (const x of data.submissions) {
        if (x.artistKeyHash !== a.keyHash || !x.feedback) continue;
        for (const tag of x.feedback.tags) if (edge.FEEDBACK_TAGS[tag].kind === 'strength') strengths[tag] = (strengths[tag] || 0) + 1;
      }
      const mo = momentumOf(a.keyHash);
      return {
        profile: { ...profile, hasContact: Boolean(contactEmail) },
        level: career.level,
        levelName: career.name,
        metrics: career.metrics,
        placements,
        passport: {
          momentum: mo.score,
          tier: mo.tier,
          tierName: edge.MOMENTUM_TIERS[mo.tier],
          parts: mo.parts,
          discoveredBy: discOutlet ? { outletName: discOutlet.name, outletId: discOutlet.id, at: disc.discovery.at } : null,
          strengths: Object.entries(strengths).sort((p, q) => q[1] - p[1]).map(([tag, count]) => ({ tag, label: edge.FEEDBACK_TAGS[tag].label, count })),
        },
      };
    }],

    // Autopilot kariery: uszeregowana lista następnych najlepszych ruchów.
    ['GET', /^\/api\/artist\/next-actions$/, (req) => {
      const key = req.headers['x-artist-key'];
      if (!key) throw new HttpError(401, E.needKey);
      const keyHash = hashSecret(key);
      const profile = profileFor(keyHash);
      const career = careerOf(keyHash);
      const creatorType = (profile && profile.creatorType) || 'music';
      const genre = profile && profile.genres && profile.genres[0];
      const outletsById = Object.fromEntries(data.outlets.map((o) => [o.id, o]));
      const actions = nextActions({
        today: now().toISOString().slice(0, 10),
        profile,
        career,
        campaigns: data.campaigns.filter((c) => c.artistKeyHash === keyHash),
        submissions: data.submissions.filter((x) => x.artistKeyHash === keyHash).map((x) => publicSubmission(x)),
        outletsById,
        creatorType,
        suggestOutlets: (filter) => candidatesFor(genre, career.level, creatorType)
          .filter(filter)
          .sort((a, b) => b.match.score - a.match.score),
        publicEntities: publicEntities(creatorType),
      });
      return { level: career.level, levelName: career.name, actions };
    }],

    ['GET', /^\/api\/artist\/campaigns$/, (req) => {
      const key = req.headers['x-artist-key'];
      if (!key) throw new HttpError(401, E.needKey);
      return {
        campaigns: data.campaigns
          .filter((c) => secretMatches(key, c.artistKeyHash))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(publicCampaign),
      };
    }],

    ['PATCH', /^\/api\/campaigns\/([\w-]+)\/tasks\/([\w-]+)$/, async (req, m) => {
      const c = findCampaign(req, m[1]);
      const task = c.tasks.find((t) => t.id === m[2]);
      if (!task) throw new HttpError(404, bi('Task not found.', 'Nie znaleziono zadania.'));
      task.done = (await readBody(req)).done === true;
      store.save();
      return publicCampaign(c);
    }],

    // Wyślij falę wcześniej niż wg planu.
    ['POST', /^\/api\/campaigns\/([\w-]+)\/waves\/(\d+)\/send$/, (req, m) => {
      const c = findCampaign(req, m[1]);
      const wave = c.waves[Number(m[2])];
      if (!wave) throw new HttpError(404, bi('Wave not found.', 'Nie znaleziono fali.'));
      if (wave.sent) throw new HttpError(409, bi('This wave has already been sent.', 'Ta fala została już wysłana.'));
      sendWave(c, wave);
      store.save();
      return publicCampaign(c);
    }],

    ['GET', /^\/api\/artist\/submissions$/, (req) => {
      const key = req.headers['x-artist-key'];
      if (!key) throw new HttpError(401, E.needKey);
      const subs = data.submissions
        .filter((s) => secretMatches(key, s.artistKeyHash))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((s) => publicSubmission(s));
      return { submissions: subs };
    }],

    // "What to fix" report: structured feedback from every curator, per work.
    ['GET', /^\/api\/artist\/feedback-report$/, (req) => {
      const key = req.headers['x-artist-key'];
      if (!key) throw new HttpError(401, E.needKey);
      const keyHash = hashSecret(key);
      const m = momentumOf(keyHash);
      return {
        works: edge.feedbackReport(data.submissions.filter((x) => x.artistKeyHash === keyHash && x.status !== 'withdrawn')),
        momentum: { score: m.score, tier: m.tier, tierName: edge.MOMENTUM_TIERS[m.tier], parts: m.parts },
      };
    }],

    // Anyone (a label, a booker, a festival) can check a placement from a creator's passport.
    ['GET', /^\/api\/verify\/([A-Za-z0-9]{6,20})$/, (req, m) => {
      const code = m[1].toUpperCase();
      const sub = data.submissions.find((x) => x.placedAt && PLACED_STATUSES.has(x.status) && edge.verificationCode(x) === code);
      if (!sub) return { valid: false, code };
      const o = data.outlets.find((x) => x.id === sub.outletId) || {};
      const a = profileFor(sub.artistKeyHash);
      return {
        valid: true,
        code,
        artistName: a ? a.name : sub.artistName,
        artistSlug: a ? a.slug : null,
        trackTitle: sub.trackTitle,
        outletName: o.name,
        outletType: o.type,
        outletVerified: Boolean(o.verified),
        country: o.country,
        status: sub.status,
        placedAt: sub.placedAt,
        placementUrl: sub.placementUrl,
        discovery: Boolean(sub.discovery),
      };
    }],

    // Quick review queue for curators: open submissions, best fit first.
    ['GET', /^\/api\/outlets\/([\w-]+)\/queue$/, (req, m) => {
      const outlet = findOutlet(m[1]);
      if (!isCurator(req, outlet)) throw new HttpError(403, E.curatorKey);
      const queue = data.submissions
        .filter((s) => s.outletId === outlet.id && ['new', 'listening'].includes(s.status))
        .map((s) => {
          const mo = momentumOf(s.artistKeyHash);
          const genreFit = !outlet.genres.length || outlet.genres.includes(s.genre);
          const deadline = new Date(Date.parse(s.createdAt) + (outlet.responseDays || 7) * DAY_MS).toISOString();
          const fit = Math.round((genreFit ? 50 : 10) + mo.score / 25 + (s.artistLevel || 1) * 2);
          return { ...publicSubmission(s, { forCurator: true }), fit, genreFit, momentum: mo.score, deadline };
        })
        .sort((p, q) => q.fit - p.fit || p.deadline.localeCompare(q.deadline));
      return { outlet: { id: outlet.id, name: outlet.name, genres: outlet.genres }, queue };
    }],

    ['PATCH', /^\/api\/submissions\/([\w-]+)$/, async (req, m) => {
      const sub = findSubmission(m[1]);
      const outlet = data.outlets.find((o) => o.id === sub.outletId);
      const body = await readBody(req);

      if (isArtist(req, sub)) {
        if (body.status !== 'withdrawn') throw new HttpError(400, bi('A creator can only withdraw a submission.', 'Twórca może jedynie wycofać zgłoszenie.'));
        if (!['new', 'listening'].includes(sub.status)) {
          throw new HttpError(409, bi('You can only withdraw before the curator decides.', 'Można wycofać tylko zgłoszenie przed decyzją kuratora.'));
        }
        sub.status = 'withdrawn';
        history(sub, 'withdrawn', 'artist');
        store.save();
        return publicSubmission(sub);
      }

      if (!outlet || !isCurator(req, outlet)) throw new HttpError(403, bi('No access to this submission.', 'Brak uprawnień do tego zgłoszenia.'));
      if (body.curatorNote !== undefined) sub.curatorNote = v.str(body.curatorNote, 'notatka', { max: 2000 });
      if (body.placementUrl !== undefined) sub.placementUrl = v.url(body.placementUrl, 'link do emisji');
      if (body.scheduledFor !== undefined) sub.scheduledFor = v.str(body.scheduledFor, 'termin emisji', { max: 16 });
      if (body.feedbackTags !== undefined) {
        const tags = edge.feedbackTagsInput(body.feedbackTags);
        sub.feedback = tags.length ? { tags, at: now().toISOString() } : null;
      }
      if (body.status !== undefined && body.status !== sub.status) {
        const allowed = CURATOR_TRANSITIONS[sub.status] || [];
        if (!allowed.includes(body.status)) {
          throw new HttpError(409, bi(
            `Cannot change status from "${pick(SUBMISSION_STATUSES[sub.status], 'en')}" to "${pick(SUBMISSION_STATUSES[body.status] || body.status, 'en')}".`,
            `Nie można zmienić statusu z „${pick(SUBMISSION_STATUSES[sub.status], 'pl')}” na „${pick(SUBMISSION_STATUSES[body.status] || body.status, 'pl')}”.`,
          ));
        }
        sub.status = body.status;
        history(sub, sub.status, 'curator', sub.curatorNote);
        if (PLACED_STATUSES.has(sub.status) && !sub.placedAt) {
          const first = !data.submissions.some((x) => x !== sub && x.artistKeyHash === sub.artistKeyHash && x.placedAt);
          sub.placedAt = now().toISOString();
          // Discovery share: the first outlet to accept a creator earns from their future revenue.
          if (first && sub.discoveryTerms) sub.discovery = { at: sub.placedAt, ...sub.discoveryTerms };
          triggerDomino(sub);
        }
      }
      sub.updatedAt = now().toISOString();
      store.save();
      return publicSubmission(sub, { forCurator: true });
    }],

    // Pula Efektu: artysta raportuje przychód utworu RAZ, a system dzieli prowizję między wszystkich
    // kuratorów, którzy go umieścili. Suma stawek jest ograniczona limitem – prowizje się nie piętrzą.
    ['POST', /^\/api\/submissions\/([\w-]+)\/revenue$/, async (req, m) => {
      const sub = findSubmission(m[1]);
      if (!isArtist(req, sub)) throw new HttpError(403, E.artistKey);
      if (!sub.placedAt) throw new HttpError(409, bi('The agreement starts only once the work is accepted.', 'Umowa rusza dopiero po akceptacji dzieła.'));
      const body = await readBody(req);
      const period = v.periodInput(body.period);
      const pool = data.submissions.filter((x) =>
        x.artistKeyHash === sub.artistKeyHash && x.trackUrl === sub.trackUrl &&
        PERCENT_MODELS.has(x.agreement.model) && x.placedAt);
      const discoverer = discoveryOf(sub.artistKeyHash);
      const isPoolEntry = (r) => r.kind !== 'discovery';
      const reported = pool.some((x) => x.revenue.some((r) => isPoolEntry(r) && r.period === period)) ||
        Boolean(discoverer && discoverer.revenue.some((r) => r.kind === 'discovery' && r.period === period && r.trackUrl === sub.trackUrl));
      if (reported) {
        throw new HttpError(409, bi(`Revenue for ${period} has already been reported for this work.`, `Przychód dzieła za ${period} został już zgłoszony.`));
      }
      const amountPLN = round2(v.num(body.amountPLN, 'kwota', { min: 0, max: 1e7, required: true }));
      const active = pool.filter((x) => commissionFor(x, period, amountPLN).inAgreement);
      // The discoverer earns on every work of the creator, unless it already earns a commission on this one.
      const discoveryOn = Boolean(discoverer && edge.discoveryActive(discoverer, period) && !active.includes(discoverer) &&
        data.outlets.some((o) => o.id === discoverer.outletId));
      if (!pool.length && !discoveryOn) {
        throw new HttpError(409, bi('This submission is not under a commission agreement.', 'To zgłoszenie nie jest objęte umową prowizyjną.'));
      }
      // The cap covers everything together: curator commissions + discovery share.
      const sumRatesPercent = active.reduce((a, x) => a + x.agreement.ratePercent, 0) + (discoveryOn ? discoverer.discovery.sharePercent : 0);
      const poolFactor = sumRatesPercent > trackCommissionCapPercent ? trackCommissionCapPercent / sumRatesPercent : 1;
      const note = v.str(body.note, 'uwagi', { max: 500 });
      const poolSize = active.length + (discoveryOn ? 1 : 0);
      let own = null;
      for (const x of pool) {
        const entry = {
          id: newId('rev'),
          period,
          amountPLN,
          ...commissionFor(x, period, amountPLN, poolFactor),
          poolSize,
          note,
          paid: false,
          reportedAt: now().toISOString(),
        };
        x.revenue.push(entry);
        x.revenue.sort((p, q) => p.period.localeCompare(q.period));
        if (x === sub) own = entry;
      }
      let discoveryEntry = null;
      if (discoveryOn) {
        const effectiveRatePercent = round2(discoverer.discovery.sharePercent * poolFactor);
        const commissionPLN = round2((amountPLN * effectiveRatePercent) / 100);
        discoveryEntry = {
          id: newId('rev'),
          kind: 'discovery',
          period,
          amountPLN,
          trackTitle: sub.trackTitle,
          trackUrl: sub.trackUrl,
          commissionPLN,
          effectiveRatePercent,
          ...split(commissionPLN, discoverer.agreement.platformFeePercent ?? platformFeePercent),
          inAgreement: true,
          poolSize,
          note,
          paid: false,
          reportedAt: now().toISOString(),
        };
        discoverer.revenue.push(discoveryEntry);
        discoverer.revenue.sort((p, q) => p.period.localeCompare(q.period));
        if (!own) own = discoveryEntry;
      }
      store.save();
      const poolTotal = pool.reduce((a, x) => a + x.revenue.find((r) => isPoolEntry(r) && r.period === period).commissionPLN, 0) +
        (discoveryEntry ? discoveryEntry.commissionPLN : 0);
      const discOutlet = discoveryEntry && data.outlets.find((o) => o.id === discoverer.outletId);
      return [201, {
        entry: own,
        pool: {
          size: poolSize,
          sumRatesPercent,
          capPercent: trackCommissionCapPercent,
          factor: round2(poolFactor),
          totalCommissionPLN: round2(poolTotal),
        },
        discovery: discoveryEntry ? { outletName: discOutlet.name, commissionPLN: discoveryEntry.commissionPLN, effectiveRatePercent: discoveryEntry.effectiveRatePercent } : null,
        settlement: summarize(sub),
      }];
    }],

    // Kurator potwierdza otrzymanie prowizji.
    ['PATCH', /^\/api\/submissions\/([\w-]+)\/revenue\/([\w-]+)$/, async (req, m) => {
      const sub = findSubmission(m[1]);
      const outlet = data.outlets.find((o) => o.id === sub.outletId);
      if (!outlet || !isCurator(req, outlet)) throw new HttpError(403, E.curatorKey);
      const entry = sub.revenue.find((r) => r.id === m[2]);
      if (!entry) throw new HttpError(404, bi('Entry not found.', 'Nie znaleziono wpisu.'));
      const body = await readBody(req);
      entry.paid = body.paid === true;
      entry.paidAt = entry.paid ? now().toISOString() : null;
      store.save();
      return { entry, settlement: summarize(sub) };
    }],
  ];

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end();
        return;
      }
      serveStatic(req, res);
      return;
    }
    const lang = getLang(req, url);
    req.lang = lang;
    try {
      expireOverdue();
      dispatchDueWaves();
      for (const [method, re, fn] of routes) {
        const m = url.pathname.match(re);
        if (!m || method !== req.method) continue;
        const result = await fn(req, m, url);
        if (Array.isArray(result)) send(res, result[0], localize(result[1], lang));
        else if (result && result.raw !== undefined) sendText(res, 200, result.raw, result.type);
        else send(res, 200, localize(result, lang));
        return;
      }
      throw new HttpError(404, bi('Unknown endpoint.', 'Nieznany endpoint.'));
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      const message = err.i18n ? err.i18n[lang] : err.message;
      send(res, status, { error: status === 500 ? pick(bi('Server error.', 'Błąd serwera.'), lang) : message });
    }
  };
}

module.exports = { createApp };

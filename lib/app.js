'use strict';

const fs = require('fs');
const path = require('path');
const {
  CREATOR_TYPES,
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

const MAX_BODY = 2 * 1024 * 1024; // import CSV bazy podmiotów
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

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
        reject(new HttpError(413, 'Zbyt duże żądanie.'));
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
        reject(new HttpError(400, 'Nieprawidłowy JSON.'));
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
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Nie znaleziono');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data: https:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'",
    });
    res.end(buf);
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

function createApp(store, {
  adminToken = process.env.ADMIN_TOKEN,
  platformFeePercent = Number(process.env.PLATFORM_FEE_PERCENT ?? 20),
  trackCommissionCapPercent = Number(process.env.TRACK_COMMISSION_CAP_PERCENT ?? 30),
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
        s.history.push({ at: new Date(t).toISOString(), status: 'expired', by: 'system', note: `Brak odpowiedzi w ${days} dni.` });
        changed = true;
      }
    }
    if (changed) store.save();
  }

  const findOutlet = (id) => {
    const o = data.outlets.find((x) => x.id === id);
    if (!o) throw new HttpError(404, 'Nie znaleziono miejsca promocji.');
    return o;
  };
  const findSubmission = (id) => {
    const s = data.submissions.find((x) => x.id === id);
    if (!s) throw new HttpError(404, 'Nie znaleziono zgłoszenia.');
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
    if (genre && o.genres.includes(genre)) { score += 35; reasons.push('Twój gatunek'); }
    else if (!o.genres.length) { score += 15; reasons.push('Wszystkie gatunki'); }
    const acc = st.acceptanceRate ?? 30;
    score += Math.min(acc, 60) / 3;
    if (st.acceptanceRate !== null && st.acceptanceRate >= 25) reasons.push(`Akceptuje ${st.acceptanceRate}%`);
    const resp = st.responseRate ?? 80;
    score += resp / 10;
    if (st.responseRate !== null && st.responseRate >= 90) reasons.push('Zawsze odpowiada');
    if (o.verified) { score += 10; reasons.push('Zweryfikowany'); }
    score += Math.min(Math.log10((o.reach || 0) + 1), 7) * 2;
    if (['commission', 'free', 'barter'].includes(o.collaboration.model)) {
      score += 5;
      reasons.push(o.collaboration.model === 'commission' ? 'Płacisz tylko za efekt' : 'Bez opłat z góry');
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
      outletName: outlet ? outlet.name : '(usunięte)',
      outletType: outlet ? outlet.type : null,
      settlement: summarize(s),
    };
  }

  function history(sub, status, by, note = '') {
    sub.history.push({ at: now().toISOString(), status, by, note });
  }

  function resolveArtistKey(raw) {
    let artistKey = typeof raw === 'string' ? raw.trim() : '';
    if (artistKey && artistKey.length < 16) throw new HttpError(400, 'Klucz artysty jest za krótki.');
    if (!artistKey) artistKey = newSecret();
    return { artistKey, keyHash: hashSecret(artistKey) };
  }

  function createSubmissions({ outletIds, fields, keyHash, campaignId = null, by = null }) {
    const created = [];
    const skipped = [];
    const level = careerOf(keyHash).level;
    for (const outletId of outletIds) {
      const outlet = data.outlets.find((o) => o.id === outletId);
      if (!outlet) {
        skipped.push({ outletId, reason: 'Nie istnieje.' });
        continue;
      }
      if (!outlet.acceptsSubmissions) {
        skipped.push({ outletId, reason: `${outlet.name}: nie przyjmuje teraz zgłoszeń.` });
        continue;
      }
      if (!(outlet.creatorTypes || ['music']).includes(fields.creatorType || 'music')) {
        skipped.push({ outletId, reason: `${outlet.name}: nie przyjmuje zgłoszeń od tego typu twórców.` });
        continue;
      }
      if ((outlet.minLevel || 1) > level) {
        skipped.push({ outletId, reason: `${outlet.name}: wymaga poziomu artysty ${outlet.minLevel} (masz ${level}).` });
        continue;
      }
      const dup = data.submissions.find((x) =>
        x.outletId === outletId && x.trackUrl === fields.trackUrl && !['rejected', 'withdrawn', 'expired'].includes(x.status));
      if (dup) {
        skipped.push({ outletId, reason: `${outlet.name}: ten utwór już czeka na decyzję.` });
        continue;
      }
      const sub = {
        id: newId('sub'),
        outletId,
        campaignId,
        ...fields,
        // Generator pitchu: {nazwa} i {gatunki} są podmieniane dla każdego kuratora.
        message: personalize(fields.message, outlet),
        status: 'new',
        // Warunki są zamrażane w chwili zgłoszenia – późniejsza zmiana cennika nie działa wstecz.
        agreement: { ...outlet.collaboration, platformFeePercent },
        reviewFee: outlet.collaboration.model === 'fee'
          ? { amountPLN: outlet.collaboration.feePLN, ...split(outlet.collaboration.feePLN, platformFeePercent), paid: false }
          : null,
        curatorNote: '',
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
    const proof = `\n\nPS. Utwór właśnie trafił do: ${placedOutlet.name} (${OUTLET_TYPES[placedOutlet.type]}).`;
    const wave = {
      date: now().toISOString().slice(0, 10),
      phase: 'G',
      name: `Efekt domina: po umieszczeniu w ${placedOutlet.name}`,
      how: 'Sukces otwiera kolejne, większe miejsca – zgłoszenie z dowodem społecznym wysłane automatycznie.',
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
    const { contactEmail, notes, stageHistory, stage, source, outletId, ...rest } = e;
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
    if (!isAdmin(req)) throw new HttpError(403, 'Nieprawidłowy token administratora.');
  }

  function findEntity(id) {
    const e = data.entities.find((x) => x.id === id);
    if (!e) throw new HttpError(404, 'Nie znaleziono podmiotu.');
    return e;
  }

  function findCampaign(req, id) {
    const c = data.campaigns.find((x) => x.id === id);
    if (!c) throw new HttpError(404, 'Nie znaleziono kampanii.');
    if (!secretMatches(req.headers['x-artist-key'], c.artistKeyHash)) throw new HttpError(403, 'Nieprawidłowy klucz artysty.');
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
      creators: CREATOR_TYPES,
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
        (!q || [o.name, o.description, o.country, ...o.genres].join(' ').toLowerCase().includes(q)));
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
      const list = data.outlets
        .filter((o) => o.acceptsSubmissions && (!type || o.type === type) && (!model || o.collaboration.model === model))
        .filter((o) => !creator || (o.creatorTypes || ['music']).includes(creator))
        .filter((o) => !genre || !o.genres.length || o.genres.includes(genre))
        .map((o) => ({ ...publicOutlet(o), match: matchScore(o, { genre }) }))
        .sort((a, b) => b.match.score - a.match.score)
        .slice(0, limit);
      return { outlets: list };
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
        (!q || [e.name, e.country, e.notes, e.url].join(' ').toLowerCase().includes(q)));
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
      if (data.entities.some((e) => ent.dedupeKey(e) === key)) throw new HttpError(409, 'Taki podmiot już jest w bazie.');
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
      if (e.outletId) throw new HttpError(409, 'Ten podmiot jest już partnerem w katalogu.');
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
        description: body.description || e.notes,
        responseDays: body.responseDays || 14,
        minLevel: body.minLevel || 1,
        collaboration: body.collaboration || (PERCENT_MODELS.has(e.model)
          ? { model: e.model, ratePercent: 10, durationMonths: 6 }
          : { model: e.model, feePLN: 10 }),
      });
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
      if (!isAdmin(req)) throw new HttpError(403, 'Nieprawidłowy token administratora.');
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
      if (!isCurator(req, outlet)) throw new HttpError(403, 'Nieprawidłowy klucz kuratora.');
      const body = await readBody(req);
      Object.assign(outlet, v.outletInput(body, { partial: true }));
      if (isAdmin(req) && typeof body.verified === 'boolean') outlet.verified = body.verified;
      outlet.updatedAt = now().toISOString();
      store.save();
      return publicOutlet(outlet, { withContact: true });
    }],

    ['DELETE', /^\/api\/outlets\/([\w-]+)$/, (req, m) => {
      const outlet = findOutlet(m[1]);
      if (!isCurator(req, outlet)) throw new HttpError(403, 'Nieprawidłowy klucz kuratora.');
      data.outlets.splice(data.outlets.indexOf(outlet), 1);
      store.save();
      return { deleted: true };
    }],

    // Panel kuratora: dane miejsca + skrzynka zgłoszeń.
    ['GET', /^\/api\/outlets\/([\w-]+)\/submissions$/, (req, m) => {
      const outlet = findOutlet(m[1]);
      if (!isCurator(req, outlet)) throw new HttpError(403, 'Nieprawidłowy klucz kuratora.');
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
      return { outlet: publicOutlet(outlet, { withContact: true }), submissions: subs, totals };
    }],

    ['POST', /^\/api\/submissions$/, async (req) => {
      const body = await readBody(req);
      const { outletIds, ...fields } = v.submissionInput(body);
      const { artistKey, keyHash } = resolveArtistKey(body.artistKey);
      const { created, skipped } = createSubmissions({ outletIds, fields, keyHash });
      if (!created.length) throw new HttpError(400, skipped.map((x) => x.reason).join(' '));
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
      if (!plan.waves.length) throw new HttpError(400, 'Brak pasujących miejsc dla tego gatunku i budżetu.');
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
      };
      data.campaigns.push(campaign);
      dispatchDueWaves();
      store.save();
      return [201, { artistKey, campaign: publicCampaign(campaign) }];
    }],

    ['GET', /^\/api\/artist\/me$/, (req) => {
      const key = req.headers['x-artist-key'];
      if (!key) throw new HttpError(401, 'Podaj klucz artysty.');
      const keyHash = hashSecret(key);
      const known = data.submissions.some((x) => x.artistKeyHash === keyHash) ||
        data.campaigns.some((x) => x.artistKeyHash === keyHash) || profileFor(keyHash);
      if (!known) throw new HttpError(404, 'Nie znaleziono artysty dla tego klucza.');
      return { profile: publicProfile(profileFor(keyHash)), career: careerOf(keyHash) };
    }],

    // Klucz artysty bez zgłoszeń: start od profilu.
    ['POST', /^\/api\/artist\/register$/, () => {
      const { artistKey } = resolveArtistKey('');
      return [201, { artistKey }];
    }],

    ['PUT', /^\/api\/artist\/profile$/, async (req) => {
      const key = req.headers['x-artist-key'];
      if (!key || String(key).length < 16) throw new HttpError(401, 'Podaj klucz artysty.');
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
      if (!a) throw new HttpError(404, 'Nie znaleziono artysty.');
      const { contactEmail, ...profile } = publicProfile(a);
      const placements = data.submissions
        .filter((x) => x.artistKeyHash === a.keyHash && PLACED_STATUSES.has(x.status))
        .map((x) => {
          const o = data.outlets.find((y) => y.id === x.outletId) || {};
          return { trackTitle: x.trackTitle, outletName: o.name, outletType: o.type, country: o.country, reach: o.reach, placementUrl: x.placementUrl, at: x.placedAt };
        })
        .sort((p, q) => (q.at || '').localeCompare(p.at || ''));
      const career = careerOf(a.keyHash);
      return { profile: { ...profile, hasContact: Boolean(contactEmail) }, level: career.level, levelName: career.name, metrics: career.metrics, placements };
    }],

    // Autopilot kariery: uszeregowana lista następnych najlepszych ruchów.
    ['GET', /^\/api\/artist\/next-actions$/, (req) => {
      const key = req.headers['x-artist-key'];
      if (!key) throw new HttpError(401, 'Podaj klucz artysty.');
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
      if (!key) throw new HttpError(401, 'Podaj klucz artysty.');
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
      if (!task) throw new HttpError(404, 'Nie znaleziono zadania.');
      task.done = (await readBody(req)).done === true;
      store.save();
      return publicCampaign(c);
    }],

    // Wyślij falę wcześniej niż wg planu.
    ['POST', /^\/api\/campaigns\/([\w-]+)\/waves\/(\d+)\/send$/, (req, m) => {
      const c = findCampaign(req, m[1]);
      const wave = c.waves[Number(m[2])];
      if (!wave) throw new HttpError(404, 'Nie znaleziono fali.');
      if (wave.sent) throw new HttpError(409, 'Ta fala została już wysłana.');
      sendWave(c, wave);
      store.save();
      return publicCampaign(c);
    }],

    ['GET', /^\/api\/artist\/submissions$/, (req) => {
      const key = req.headers['x-artist-key'];
      if (!key) throw new HttpError(401, 'Podaj klucz artysty.');
      const subs = data.submissions
        .filter((s) => secretMatches(key, s.artistKeyHash))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((s) => publicSubmission(s));
      return { submissions: subs };
    }],

    ['PATCH', /^\/api\/submissions\/([\w-]+)$/, async (req, m) => {
      const sub = findSubmission(m[1]);
      const outlet = data.outlets.find((o) => o.id === sub.outletId);
      const body = await readBody(req);

      if (isArtist(req, sub)) {
        if (body.status !== 'withdrawn') throw new HttpError(400, 'Artysta może jedynie wycofać zgłoszenie.');
        if (!['new', 'listening'].includes(sub.status)) {
          throw new HttpError(409, 'Można wycofać tylko zgłoszenie przed decyzją kuratora.');
        }
        sub.status = 'withdrawn';
        history(sub, 'withdrawn', 'artist');
        store.save();
        return publicSubmission(sub);
      }

      if (!outlet || !isCurator(req, outlet)) throw new HttpError(403, 'Brak uprawnień do tego zgłoszenia.');
      if (body.curatorNote !== undefined) sub.curatorNote = v.str(body.curatorNote, 'notatka', { max: 2000 });
      if (body.placementUrl !== undefined) sub.placementUrl = v.url(body.placementUrl, 'link do emisji');
      if (body.scheduledFor !== undefined) sub.scheduledFor = v.str(body.scheduledFor, 'termin emisji', { max: 16 });
      if (body.status !== undefined && body.status !== sub.status) {
        const allowed = CURATOR_TRANSITIONS[sub.status] || [];
        if (!allowed.includes(body.status)) {
          throw new HttpError(409, `Nie można zmienić statusu z "${SUBMISSION_STATUSES[sub.status]}" na "${SUBMISSION_STATUSES[body.status] || body.status}".`);
        }
        sub.status = body.status;
        history(sub, sub.status, 'curator', sub.curatorNote);
        if (PLACED_STATUSES.has(sub.status) && !sub.placedAt) {
          sub.placedAt = now().toISOString();
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
      if (!isArtist(req, sub)) throw new HttpError(403, 'Nieprawidłowy klucz artysty.');
      if (!PERCENT_MODELS.has(sub.agreement.model)) {
        throw new HttpError(409, 'To zgłoszenie nie jest objęte umową prowizyjną.');
      }
      if (!sub.placedAt) throw new HttpError(409, 'Umowa rusza dopiero po akceptacji utworu.');
      const body = await readBody(req);
      const period = v.periodInput(body.period);
      const pool = data.submissions.filter((x) =>
        x.artistKeyHash === sub.artistKeyHash && x.trackUrl === sub.trackUrl &&
        PERCENT_MODELS.has(x.agreement.model) && x.placedAt);
      if (pool.some((x) => x.revenue.some((r) => r.period === period))) {
        throw new HttpError(409, `Przychód utworu za ${period} został już zgłoszony.`);
      }
      const amountPLN = round2(v.num(body.amountPLN, 'kwota', { min: 0, max: 1e7, required: true }));
      const active = pool.filter((x) => commissionFor(x, period, amountPLN).inAgreement);
      const sumRatesPercent = active.reduce((a, x) => a + x.agreement.ratePercent, 0);
      const poolFactor = sumRatesPercent > trackCommissionCapPercent ? trackCommissionCapPercent / sumRatesPercent : 1;
      const note = v.str(body.note, 'uwagi', { max: 500 });
      let own = null;
      for (const x of pool) {
        const entry = {
          id: newId('rev'),
          period,
          amountPLN,
          ...commissionFor(x, period, amountPLN, poolFactor),
          poolSize: active.length,
          note,
          paid: false,
          reportedAt: now().toISOString(),
        };
        x.revenue.push(entry);
        x.revenue.sort((p, q) => p.period.localeCompare(q.period));
        if (x === sub) own = entry;
      }
      store.save();
      return [201, {
        entry: own,
        pool: {
          size: active.length,
          sumRatesPercent,
          capPercent: trackCommissionCapPercent,
          factor: round2(poolFactor),
          totalCommissionPLN: round2(pool.reduce((a, x) => a + x.revenue.find((r) => r.period === period).commissionPLN, 0)),
        },
        settlement: summarize(sub),
      }];
    }],

    // Kurator potwierdza otrzymanie prowizji.
    ['PATCH', /^\/api\/submissions\/([\w-]+)\/revenue\/([\w-]+)$/, async (req, m) => {
      const sub = findSubmission(m[1]);
      const outlet = data.outlets.find((o) => o.id === sub.outletId);
      if (!outlet || !isCurator(req, outlet)) throw new HttpError(403, 'Nieprawidłowy klucz kuratora.');
      const entry = sub.revenue.find((r) => r.id === m[2]);
      if (!entry) throw new HttpError(404, 'Nie znaleziono wpisu.');
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
    try {
      expireOverdue();
      dispatchDueWaves();
      for (const [method, re, fn] of routes) {
        const m = url.pathname.match(re);
        if (!m || method !== req.method) continue;
        const result = await fn(req, m, url);
        if (Array.isArray(result)) send(res, result[0], result[1]);
        else if (result && result.raw !== undefined) sendText(res, 200, result.raw, result.type);
        else send(res, 200, result);
        return;
      }
      throw new HttpError(404, 'Nieznany endpoint.');
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      send(res, status, { error: status === 500 ? 'Błąd serwera.' : err.message });
    }
  };
}

module.exports = { createApp };

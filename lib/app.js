'use strict';

const fs = require('fs');
const path = require('path');
const {
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

const MAX_BODY = 64 * 1024;
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
        "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'",
    });
    res.end(buf);
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

function createApp(store, {
  adminToken = process.env.ADMIN_TOKEN,
  platformFeePercent = Number(process.env.PLATFORM_FEE_PERCENT ?? 20),
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
    return { ...rest, ...(withContact ? { contactEmail } : {}), stats: outletStats(o) };
  }

  function publicSubmission(s, { forCurator = false } = {}) {
    const { artistKeyHash, artistEmail, ...rest } = s;
    const outlet = data.outlets.find((o) => o.id === s.outletId);
    return {
      ...rest,
      ...(forCurator ? { artistEmail } : {}),
      outletName: outlet ? outlet.name : '(usunięte)',
      outletType: outlet ? outlet.type : null,
      settlement: summarize(s),
    };
  }

  function history(sub, status, by, note = '') {
    sub.history.push({ at: now().toISOString(), status, by, note });
  }

  const routes = [
    ['GET', /^\/api\/meta$/, () => ({
      platformFeePercent,
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
      const sort = url.searchParams.get('sort') || 'reach';
      let list = data.outlets.filter((o) =>
        (!type || o.type === type) &&
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
      const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
      const list = data.outlets
        .filter((o) => o.acceptsSubmissions && (!type || o.type === type) && (!model || o.collaboration.model === model))
        .filter((o) => !genre || !o.genres.length || o.genres.includes(genre))
        .map((o) => ({ ...publicOutlet(o), match: matchScore(o, { genre }) }))
        .sort((a, b) => b.match.score - a.match.score)
        .slice(0, limit);
      return { outlets: list };
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
      const input = v.submissionInput(body);
      let artistKey = typeof body.artistKey === 'string' ? body.artistKey.trim() : '';
      if (artistKey && artistKey.length < 16) throw new HttpError(400, 'Klucz artysty jest za krótki.');
      if (!artistKey) artistKey = newSecret();
      const keyHash = hashSecret(artistKey);

      const created = [];
      const skipped = [];
      for (const outletId of input.outletIds) {
        const outlet = data.outlets.find((o) => o.id === outletId);
        if (!outlet) {
          skipped.push({ outletId, reason: 'Nie istnieje.' });
          continue;
        }
        if (!outlet.acceptsSubmissions) {
          skipped.push({ outletId, reason: `${outlet.name}: nie przyjmuje teraz zgłoszeń.` });
          continue;
        }
        const dup = data.submissions.find((s) =>
          s.outletId === outletId && s.trackUrl === input.trackUrl && !['rejected', 'withdrawn'].includes(s.status));
        if (dup) {
          skipped.push({ outletId, reason: `${outlet.name}: ten utwór już czeka na decyzję.` });
          continue;
        }
        const { outletIds, ...fields } = input;
        const sub = {
          id: newId('sub'),
          outletId,
          ...fields,
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
        history(sub, 'new', 'artist');
        data.submissions.push(sub);
        created.push(publicSubmission(sub));
      }
      if (!created.length) throw new HttpError(400, skipped.map((s) => s.reason).join(' '));
      store.save();
      return [201, { artistKey, submissions: created, skipped }];
    }],

    ['GET', /^\/api\/artist\/submissions$/, (req) => {
      const key = req.headers['x-artist-key'];
      if (!key) throw new HttpError(401, 'Podaj klucz artysty.');
      const subs = data.submissions
        .filter((s) => secretMatches(key, s.artistKeyHash))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((s) => publicSubmission(s));
      if (!subs.length) throw new HttpError(404, 'Brak zgłoszeń dla tego klucza.');
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
        if (PLACED_STATUSES.has(sub.status) && !sub.placedAt) sub.placedAt = now().toISOString();
        history(sub, sub.status, 'curator', sub.curatorNote);
      }
      sub.updatedAt = now().toISOString();
      store.save();
      return publicSubmission(sub, { forCurator: true });
    }],

    // Artysta raportuje przychód z utworu za dany miesiąc → system liczy prowizję kuratora.
    ['POST', /^\/api\/submissions\/([\w-]+)\/revenue$/, async (req, m) => {
      const sub = findSubmission(m[1]);
      if (!isArtist(req, sub)) throw new HttpError(403, 'Nieprawidłowy klucz artysty.');
      if (!PERCENT_MODELS.has(sub.agreement.model)) {
        throw new HttpError(409, 'To zgłoszenie nie jest objęte umową prowizyjną.');
      }
      if (!sub.placedAt) throw new HttpError(409, 'Umowa rusza dopiero po akceptacji utworu.');
      const body = await readBody(req);
      const period = v.periodInput(body.period);
      if (sub.revenue.some((r) => r.period === period)) {
        throw new HttpError(409, `Przychód za ${period} został już zgłoszony.`);
      }
      const amountPLN = round2(v.num(body.amountPLN, 'kwota', { min: 0, max: 1e7, required: true }));
      const entry = {
        id: newId('rev'),
        period,
        amountPLN,
        ...commissionFor(sub, period, amountPLN),
        note: v.str(body.note, 'uwagi', { max: 500 }),
        paid: false,
        reportedAt: now().toISOString(),
      };
      sub.revenue.push(entry);
      sub.revenue.sort((a, b) => a.period.localeCompare(b.period));
      store.save();
      return [201, { entry, settlement: summarize(sub) }];
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
      for (const [method, re, fn] of routes) {
        const m = url.pathname.match(re);
        if (!m || method !== req.method) continue;
        const result = await fn(req, m, url);
        if (Array.isArray(result)) send(res, result[0], result[1]);
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

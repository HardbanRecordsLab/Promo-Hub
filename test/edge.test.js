'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { Store } = require('../lib/db');
const { createApp } = require('../lib/app');
const { acceptanceOdds, feedbackReport, momentum } = require('../lib/edge');

let server;
let base;
let clock = new Date('2026-05-04T10:00:00Z');
const store = new Store(null);

async function api(method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  server = http.createServer(createApp(store, { adminToken: 'admin-secret', platformFeePercent: 20, trackCommissionCapPercent: 30, now: () => clock }));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

async function outlet(name, collaboration, extra = {}) {
  const r = await api('POST', '/api/outlets', {
    name, type: 'playlist', genres: ['pop'], url: `https://example.com/${encodeURIComponent(name)}`,
    contactEmail: 'c@example.com', reach: 5000, responseDays: 14, collaboration, ...extra,
  });
  assert.equal(r.status, 201);
  return r.body;
}

const work = (title, extra = {}) => ({
  artistName: 'Nova', artistEmail: 'nova@example.com', trackTitle: title,
  trackUrl: `https://open.spotify.com/track/${title.replace(/\W/g, '')}`, genre: 'pop', acceptTerms: true, ...extra,
});

test('acceptance odds: own history, genre outside the list and the top decline reason', () => {
  const o = { id: 'o1', genres: ['pop'], creatorTypes: ['music'], verified: true };
  const subs = [];
  for (let i = 0; i < 8; i += 1) subs.push({ outletId: 'o1', genre: 'pop', status: i < 6 ? 'accepted' : 'rejected', feedback: i >= 6 ? { tags: ['mix'] } : null });
  const fit = acceptanceOdds(o, { genre: 'pop' }, subs);
  const off = acceptanceOdds(o, { genre: 'jazz' }, subs);
  assert.ok(fit.percent > 50, `fit ${fit.percent}`);
  assert.ok(off.percent < fit.percent / 2);
  assert.equal(fit.confidence, 'medium');
  assert.match(fit.tips[0].en, /Mix needs work/);
  assert.equal(acceptanceOdds(o, { genre: 'pop', creatorType: 'writer' }, subs).percent, 0);
});

test('feedback report finds the consensus and momentum grows with placements', () => {
  const subs = [
    { trackTitle: 'A', trackUrl: 'u', status: 'rejected', feedback: { tags: ['mix', 'intro'] } },
    { trackTitle: 'A', trackUrl: 'u', status: 'rejected', feedback: { tags: ['mix'] } },
    { trackTitle: 'A', trackUrl: 'u', status: 'accepted', feedback: { tags: ['strong_hook'] } },
  ];
  const [w] = feedbackReport(subs);
  assert.equal(w.reviewers, 3);
  assert.equal(w.priorities[0].tag, 'mix');
  assert.equal(w.priorities.length, 1);
  assert.equal(w.strengths[0].tag, 'strong_hook');
  assert.equal(w.verdict, 'fix');
  const outs = { a: { reach: 100000, type: 'radio', country: 'PL', verified: true } };
  const none = momentum([], outs);
  const some = momentum([{ outletId: 'a', placedAt: '2026-05-01T00:00:00Z' }], outs, { today: new Date('2026-05-04') });
  assert.equal(none.score, 0);
  assert.ok(some.score > 300);
});

test('full flow: tags → report, discovery share inside the cap, passport + verification, quick queue', async () => {
  const free = await outlet('Free Blog', { model: 'free' });
  const comm = await outlet('Big Playlist', { model: 'commission', ratePercent: 20, durationMonths: 6 }, { reach: 90000 });
  const third = await outlet('Third Radio', { model: 'free' }, { type: 'radio' });

  const r1 = await api('POST', '/api/submissions', { ...work('First Song'), outletIds: [free.outlet.id, third.outlet.id] });
  assert.equal(r1.status, 201);
  const key = r1.body.artistKey;
  const h = { 'x-artist-key': key };
  await api('PUT', '/api/artist/profile', { name: 'Nova', creatorType: 'music', genres: ['pop'] }, h);
  const [toFree, toThird] = r1.body.submissions;

  // quick review queue is curator-only and carries a fit score
  assert.equal((await api('GET', `/api/outlets/${free.outlet.id}/queue`)).status, 403);
  const q = await api('GET', `/api/outlets/${free.outlet.id}/queue`, null, { 'x-manage-key': free.manageKey });
  assert.equal(q.body.queue.length, 1);
  assert.equal(q.body.queue[0].genreFit, true);

  // unknown tag is rejected; known tags are stored
  let r = await api('PATCH', `/api/submissions/${toThird.id}`, { status: 'rejected', feedbackTags: ['nope'] }, { 'x-manage-key': third.manageKey });
  assert.equal(r.status, 400);
  r = await api('PATCH', `/api/submissions/${toThird.id}`, { status: 'rejected', feedbackTags: ['mix', 'intro'] }, { 'x-manage-key': third.manageKey });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.feedback.tags, ['mix', 'intro']);

  // the free blog is the first to accept → it becomes the discoverer
  clock = new Date('2026-05-10T10:00:00Z');
  r = await api('PATCH', `/api/submissions/${toFree.id}`, { status: 'accepted', feedbackTags: ['strong_hook'] }, { 'x-manage-key': free.manageKey });
  assert.equal(r.body.discovery.sharePercent, 2);

  // a later work goes to the commission playlist; revenue is split inside the 30% cap
  const r2 = await api('POST', '/api/submissions', { ...work('Second Song'), outletIds: [comm.outlet.id], artistKey: key });
  const second = r2.body.submissions[0];
  await api('PATCH', `/api/submissions/${second.id}`, { status: 'accepted' }, { 'x-manage-key': comm.manageKey });
  r = await api('POST', `/api/submissions/${second.id}/revenue`, { period: '2026-06', amountPLN: 1000 }, h);
  assert.equal(r.status, 201);
  assert.equal(r.body.entry.commissionPLN, 200); // 20% for the playlist
  assert.equal(r.body.discovery.commissionPLN, 20); // 2% for the discoverer
  assert.equal(r.body.pool.size, 2);
  assert.equal(r.body.pool.sumRatesPercent, 22);
  r = await api('POST', `/api/submissions/${second.id}/revenue`, { period: '2026-06', amountPLN: 5 }, h);
  assert.equal(r.status, 409);

  // the discoverer sees the earnings in its inbox
  const inbox = await api('GET', `/api/outlets/${free.outlet.id}/submissions`, null, { 'x-manage-key': free.manageKey });
  assert.equal(inbox.body.discoveries, 1);
  assert.equal(inbox.body.totals.duePLN, 20);

  // the creator's report shows feedback per work
  const rep = await api('GET', '/api/artist/feedback-report', null, h);
  const first = rep.body.works.find((w) => w.trackTitle === 'First Song');
  assert.equal(first.reviewers, 2);
  assert.ok(first.fixes.some((f) => f.tag === 'mix'));
  assert.ok(first.strengths.some((f) => f.tag === 'strong_hook'));
  assert.ok(rep.body.momentum.score > 0);

  // public passport: momentum, discoverer, verifiable codes
  const me = await api('GET', '/api/artist/me', null, h);
  const epk = await api('GET', `/api/artists/${me.body.profile.slug}`);
  assert.equal(epk.body.passport.discoveredBy.outletName, 'Free Blog');
  assert.ok(epk.body.passport.momentum > 0);
  const code = epk.body.placements[0].code;
  const ok = await api('GET', `/api/verify/${code}`);
  assert.equal(ok.body.valid, true);
  assert.equal(ok.body.artistName, 'Nova');
  assert.equal((await api('GET', '/api/verify/AAAAAAAAAAAA')).body.valid, false);

  // odds appear in the match ranking
  const m = await api('GET', '/api/match?genre=pop&creator=music', null, h);
  assert.ok(m.body.outlets.every((o) => typeof o.odds.percent === 'number'));
});

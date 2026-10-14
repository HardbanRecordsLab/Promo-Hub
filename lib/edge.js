'use strict';

// Tools nobody else offers:
// - acceptance odds before sending (from the curator's real decisions),
// - one "what to fix" report built from structured feedback of every curator,
// - a verifiable creator passport with a Momentum score,
// - a discovery share for the first curator who believed in a creator.

const crypto = require('crypto');
const { bi } = require('./i18n');
const { PLACED_STATUSES } = require('./catalog');
const { agreementEndPeriod } = require('./settlement');

// Structured feedback. `fix` tags feed the "what to fix" report, `strength` tags the passport.
const FEEDBACK_TAGS = {
  genre_fit: { kind: 'fix', for: ['music', 'dj', 'writer'], label: bi('Not our genre / format', 'Nie nasz gatunek / format'),
    advice: bi('Target outlets that list this exact genre – the match ranking filters them for you.', 'Celuj w miejsca, które mają dokładnie ten gatunek – ranking dopasowania je odfiltruje.') },
  mix: { kind: 'fix', for: ['music', 'dj'], label: bi('Mix needs work', 'Miks do poprawy'),
    advice: bi('Get a second mix opinion (or a pro mix engineer) – balance, low end and vocal level first.', 'Daj miks do drugiej opinii (albo realizatorowi) – najpierw balans, dół pasma i poziom wokalu.') },
  master: { kind: 'fix', for: ['music', 'dj'], label: bi('Master too quiet / too loud', 'Master za cichy / za głośny'),
    advice: bi('Master to about -14 LUFS for streaming and -9 to -7 LUFS for club play; avoid clipping.', 'Mastering ok. -14 LUFS pod streaming, -9 do -7 LUFS pod kluby; bez przesterowań.') },
  vocals: { kind: 'fix', for: ['music'], label: bi('Vocals need work', 'Wokal do poprawy'),
    advice: bi('Re-record or tune the key lines, and check the vocal sits clearly above the mix.', 'Nagraj ponownie lub dostrój kluczowe frazy i sprawdź, czy wokal jest czytelny nad miksem.') },
  intro: { kind: 'fix', for: ['music', 'dj'], label: bi('Intro too long', 'Za długie intro'),
    advice: bi('Get to the hook within 30 seconds – curators decide in the first half-minute.', 'Dojdź do refrenu/hooka w 30 sekund – kuratorzy decydują w pierwszej połowie minuty.') },
  hook: { kind: 'fix', for: ['music', 'dj'], label: bi('Weak hook', 'Słaby hook / refren'),
    advice: bi('Strengthen the chorus or drop: one memorable melodic or rhythmic idea, repeated.', 'Wzmocnij refren lub drop: jeden zapamiętywalny motyw, powtórzony.') },
  arrangement: { kind: 'fix', for: ['music', 'dj'], label: bi('Arrangement / structure', 'Aranżacja / struktura'),
    advice: bi('Add contrast between sections (energy, instrumentation) and trim repeated parts.', 'Dodaj kontrast między częściami (energia, instrumentarium) i skróć powtórzenia.') },
  lyrics: { kind: 'fix', for: ['music'], label: bi('Lyrics', 'Tekst'),
    advice: bi('Sharpen the story and the title line; read the lyrics out loud without music.', 'Wyostrz historię i linijkę tytułową; przeczytaj tekst na głos bez muzyki.') },
  originality: { kind: 'fix', for: ['music', 'dj', 'writer'], label: bi('Sounds too familiar', 'Brzmi zbyt znajomo'),
    advice: bi('Find one signature element (sound, voice, angle) that only you have and push it forward.', 'Znajdź jeden wyróżnik (brzmienie, głos, perspektywa), który masz tylko Ty, i wysuń go na pierwszy plan.') },
  not_ready: { kind: 'fix', for: ['music', 'dj', 'writer'], label: bi('Feels like a demo / not finished', 'Brzmi jak demo / niedokończone'),
    advice: bi('Hold the release until production is finished – a second chance with the same curator is rare.', 'Wstrzymaj wydanie do końca produkcji – druga szansa u tego samego kuratora zdarza się rzadko.') },
  pitch: { kind: 'fix', for: ['music', 'dj', 'writer'], label: bi('Weak pitch / missing info', 'Słaby pitch / brak informacji'),
    advice: bi('Keep the pitch to 3 sentences: who you are, what the work is, why it fits this outlet. Add release date and links.', 'Pitch w 3 zdaniach: kim jesteś, czym jest dzieło, czemu pasuje do tego miejsca. Dodaj datę premiery i linki.') },
  synopsis: { kind: 'fix', for: ['writer'], label: bi('Synopsis unclear', 'Niejasna synopsa'),
    advice: bi('Rewrite the synopsis: protagonist, goal, stakes and ending in one page.', 'Przepisz synopsę: bohater, cel, stawka i zakończenie na jednej stronie.') },
  pacing: { kind: 'fix', for: ['writer'], label: bi('Pacing', 'Tempo narracji'),
    advice: bi('Cut slow openings – start closer to the first conflict.', 'Skróć powolne otwarcie – zacznij bliżej pierwszego konfliktu.') },
  editing: { kind: 'fix', for: ['writer'], label: bi('Needs editing / proofreading', 'Wymaga redakcji / korekty'),
    advice: bi('Invest in an editor and proofreader before the next round of submissions.', 'Zainwestuj w redakcję i korektę przed kolejną turą zgłoszeń.') },
  strong_hook: { kind: 'strength', for: ['music', 'dj'], label: bi('Strong hook', 'Mocny hook') },
  production: { kind: 'strength', for: ['music', 'dj'], label: bi('Great production', 'Świetna produkcja') },
  voice: { kind: 'strength', for: ['music', 'writer'], label: bi('Distinctive voice', 'Wyrazisty głos') },
  original: { kind: 'strength', for: ['music', 'dj', 'writer'], label: bi('Original', 'Oryginalne') },
  radio_ready: { kind: 'strength', for: ['music', 'dj'], label: bi('Ready for airplay', 'Gotowe do emisji') },
  strong_writing: { kind: 'strength', for: ['writer'], label: bi('Strong writing', 'Mocny warsztat') },
};

const MAX_TAGS = 6;

function feedbackTagsInput(v) {
  if (v === undefined || v === null || v === '') return [];
  const list = Array.isArray(v) ? v : String(v).split(',');
  const out = [...new Set(list.map((x) => String(x).trim()).filter(Boolean))];
  for (const tag of out) {
    if (!FEEDBACK_TAGS[tag]) {
      const err = new Error(`Unknown feedback tag: ${tag}.`);
      err.status = 400;
      err.i18n = bi(`Unknown feedback tag: ${tag}.`, `Nieznany tag feedbacku: ${tag}.`);
      throw err;
    }
  }
  return out.slice(0, MAX_TAGS);
}

const decided = (s) => s.status === 'rejected' || PLACED_STATUSES.has(s.status);

// ---------- Acceptance odds ----------
// Beta-binomial estimate: platform-wide acceptance as the prior, the outlet's own decisions
// as evidence, then the same for this genre at this outlet. Fit and level shift the result.
const PRIOR_STRENGTH = 6;

function acceptanceOdds(outlet, { genre = '', creatorType = 'music', level = 1 } = {}, allSubmissions = []) {
  const all = allSubmissions.filter(decided);
  const platformRate = all.length >= 10 ? all.filter((s) => PLACED_STATUSES.has(s.status)).length / all.length : 0.25;
  const own = allSubmissions.filter((s) => s.outletId === outlet.id && decided(s));
  const ownPlaced = own.filter((s) => PLACED_STATUSES.has(s.status)).length;
  let p = (platformRate * PRIOR_STRENGTH + ownPlaced) / (PRIOR_STRENGTH + own.length);
  const factors = [];

  const sameGenre = genre ? own.filter((s) => s.genre === genre) : [];
  if (sameGenre.length >= 2) {
    const gPlaced = sameGenre.filter((s) => PLACED_STATUSES.has(s.status)).length;
    const g = (p * 4 + gPlaced) / (4 + sameGenre.length);
    factors.push(g >= p
      ? bi(`Accepts this genre more often (${gPlaced}/${sameGenre.length})`, `Częściej przyjmuje ten gatunek (${gPlaced}/${sameGenre.length})`)
      : bi(`Accepts this genre less often (${gPlaced}/${sameGenre.length})`, `Rzadziej przyjmuje ten gatunek (${gPlaced}/${sameGenre.length})`));
    p = g;
  }
  if (genre && outlet.genres && outlet.genres.length && !outlet.genres.includes(genre)) {
    p *= 0.3;
    factors.push(bi('Genre outside the outlet’s list', 'Gatunek spoza listy tego miejsca'));
  }
  if (!(outlet.creatorTypes || ['music']).includes(creatorType)) {
    p = 0;
    factors.push(bi('Does not accept this creator type', 'Nie przyjmuje tego typu twórców'));
  }
  // Level: compare with the levels of creators this outlet accepted before.
  const acceptedLevels = own.filter((s) => PLACED_STATUSES.has(s.status) && s.artistLevel).map((s) => s.artistLevel);
  if (acceptedLevels.length >= 2) {
    const avg = acceptedLevels.reduce((a, b) => a + b, 0) / acceptedLevels.length;
    if (level < avg - 0.75) { p *= 0.8; factors.push(bi('Usually accepts more advanced creators', 'Zwykle przyjmuje bardziej zaawansowanych twórców')); }
    else if (level > avg + 0.75) { p = Math.min(p * 1.15, 0.95); factors.push(bi('Your level is above its usual picks', 'Twój poziom jest powyżej typowych wyborów')); }
  }
  if (outlet.verified) factors.push(bi('Verified partner', 'Zweryfikowany partner'));

  // What this outlet rejects most often – the tip to act on before sending.
  const tips = [];
  const counts = {};
  for (const s of own) {
    if (s.status !== 'rejected' || !s.feedback) continue;
    for (const tag of s.feedback.tags) if (FEEDBACK_TAGS[tag].kind === 'fix') counts[tag] = (counts[tag] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2);
  for (const [tag] of top) {
    const f = FEEDBACK_TAGS[tag];
    tips.push(bi(`Most common decline reason here: ${f.label.en}. ${f.advice.en}`, `Najczęstszy powód odmowy tutaj: ${f.label.pl}. ${f.advice.pl}`));
  }

  const expired = allSubmissions.filter((s) => s.outletId === outlet.id && s.status === 'expired').length;
  const answerRate = own.length + expired ? own.length / (own.length + expired) : null;
  const confidence = own.length >= 15 ? 'high' : own.length >= 5 ? 'medium' : 'low';
  return {
    percent: Math.round(Math.max(0, Math.min(p, 0.95)) * 100),
    confidence,
    basis: own.length,
    answerPercent: answerRate === null ? null : Math.round(answerRate * 100),
    factors,
    tips,
  };
}

// ---------- "What to fix" report ----------
function feedbackReport(submissions) {
  const works = new Map();
  for (const s of submissions) {
    const key = s.trackUrl || s.trackTitle;
    if (!works.has(key)) works.set(key, { trackTitle: s.trackTitle, trackUrl: s.trackUrl, submissions: [] });
    works.get(key).submissions.push(s);
  }
  const out = [];
  for (const w of works.values()) {
    const reviewed = w.submissions.filter((s) => s.feedback && s.feedback.tags.length);
    const decidedCount = w.submissions.filter(decided).length;
    const placed = w.submissions.filter((s) => PLACED_STATUSES.has(s.status)).length;
    const counts = {};
    for (const s of reviewed) for (const tag of s.feedback.tags) counts[tag] = (counts[tag] || 0) + 1;
    const rows = Object.entries(counts).map(([tag, n]) => ({
      tag,
      kind: FEEDBACK_TAGS[tag].kind,
      label: FEEDBACK_TAGS[tag].label,
      advice: FEEDBACK_TAGS[tag].advice || null,
      count: n,
      sharePercent: Math.round((n / reviewed.length) * 100),
    })).sort((a, b) => b.count - a.count);
    const fixes = rows.filter((r) => r.kind === 'fix');
    // Consensus: at least 2 curators and 30% of reviewers point at the same thing.
    const priorities = fixes.filter((r) => r.count >= 2 && r.sharePercent >= 30).slice(0, 3);
    out.push({
      trackTitle: w.trackTitle,
      trackUrl: w.trackUrl,
      sent: w.submissions.length,
      decided: decidedCount,
      placed,
      reviewers: reviewed.length,
      priorities,
      fixes,
      strengths: rows.filter((r) => r.kind === 'strength'),
      notes: w.submissions.filter((s) => s.curatorNote).map((s) => ({ note: s.curatorNote, status: s.status, at: s.updatedAt || s.createdAt })).slice(0, 10),
      verdict: !reviewed.length
        ? 'waiting'
        : priorities.length
          ? 'fix'
          : placed && placed >= decidedCount / 2 ? 'scale' : 'mixed',
    });
  }
  return out.sort((a, b) => b.reviewers - a.reviewers);
}

// ---------- Verifiable passport ----------
function verificationCode(sub) {
  return crypto.createHash('sha256').update(`${sub.id}|${sub.outletId}|${sub.placedAt}`).digest('hex').slice(0, 12).toUpperCase();
}

// Momentum 0–1000: volume, reach, breadth, quality of outlets, recency and curator opinions.
function momentum(placedSubs, outletsById, { today = new Date(), allFeedback = [] } = {}) {
  const outs = placedSubs.map((s) => outletsById[s.outletId]).filter(Boolean);
  const reach = outs.reduce((a, o) => a + (o.reach || 0), 0);
  const types = new Set(outs.map((o) => o.type)).size;
  const countries = new Set(outs.map((o) => o.country).filter(Boolean)).size;
  const verifiedShare = outs.length ? outs.filter((o) => o.verified).length / outs.length : 0;
  const recent = placedSubs.filter((s) => s.placedAt && today - Date.parse(s.placedAt) < 90 * 864e5).length;
  const tags = allFeedback.flat();
  const strengths = tags.filter((t) => FEEDBACK_TAGS[t] && FEEDBACK_TAGS[t].kind === 'strength').length;
  const positivity = tags.length ? strengths / tags.length : 0;
  const parts = {
    placements: Math.round(Math.min(Math.log2(placedSubs.length + 1) / Math.log2(51), 1) * 250),
    reach: Math.round(Math.min(Math.log10(reach + 1) / 7, 1) * 250),
    breadth: Math.round(Math.min((types + countries) / 12, 1) * 150),
    quality: Math.round(verifiedShare * 100),
    recency: Math.round(Math.min(recent / 5, 1) * 150),
    opinions: Math.round(positivity * 100),
  };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  const tier = score >= 800 ? 'icon' : score >= 600 ? 'breakout' : score >= 400 ? 'rising' : score >= 200 ? 'emerging' : 'new';
  return { score, tier, parts };
}

const MOMENTUM_TIERS = {
  new: bi('New', 'Nowy'),
  emerging: bi('Emerging', 'Wschodzący'),
  rising: bi('Rising', 'Na fali'),
  breakout: bi('Breakout', 'Przełom'),
  icon: bi('Icon', 'Ikona'),
};

// ---------- Discovery share ----------
// Terms are frozen at submission: if this outlet becomes the first to accept the creator,
// it earns sharePercent of the creator's reported revenue for `months` months.
function discoveryTerms(sharePercent, months) {
  return sharePercent > 0 ? { sharePercent, months } : null;
}

function discoveryWindow(sub) {
  if (!sub || !sub.discovery) return null;
  return { from: sub.discovery.at.slice(0, 7), to: agreementEndPeriod(sub.discovery.at, sub.discovery.months) };
}

function discoveryActive(sub, period) {
  const w = discoveryWindow(sub);
  return Boolean(w && period >= w.from && period <= w.to);
}

module.exports = {
  FEEDBACK_TAGS,
  MOMENTUM_TIERS,
  feedbackTagsInput,
  acceptanceOdds,
  feedbackReport,
  verificationCode,
  momentum,
  discoveryTerms,
  discoveryWindow,
  discoveryActive,
};

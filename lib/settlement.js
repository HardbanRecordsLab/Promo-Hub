'use strict';

const { PERCENT_MODELS } = require('./catalog');

// Ostatni miesiąc (RRRR-MM), za który należy się prowizja: miesiąc startu + (durationMonths - 1).
function agreementEndPeriod(startIso, durationMonths) {
  const d = new Date(startIso);
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + durationMonths - 1;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

function startPeriod(startIso) {
  return startIso.slice(0, 7);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Dzieli kwotę płaconą przez artystę na prowizję platformy i część dla kuratora.
function split(grossPLN, platformFeePercent) {
  const platformFeePLN = round2((grossPLN * platformFeePercent) / 100);
  return { platformFeePLN, curatorNetPLN: round2(grossPLN - platformFeePLN) };
}

// Wylicza prowizję dla zgłoszonego przychodu na podstawie zamrożonych warunków umowy.
function commissionFor(submission, period, amountPLN) {
  const terms = submission.agreement;
  const none = { commissionPLN: 0, platformFeePLN: 0, curatorNetPLN: 0, inAgreement: false };
  if (!terms || !PERCENT_MODELS.has(terms.model) || !submission.placedAt) return none;
  const from = startPeriod(submission.placedAt);
  const to = agreementEndPeriod(submission.placedAt, terms.durationMonths);
  if (period < from || period > to) return none;
  const commissionPLN = round2((amountPLN * terms.ratePercent) / 100);
  return { commissionPLN, ...split(commissionPLN, terms.platformFeePercent || 0), inAgreement: true };
}

function summarize(submission) {
  const reports = submission.revenue || [];
  const sum = (f) => round2(reports.reduce((acc, r) => acc + f(r), 0));
  const terms = submission.agreement;
  return {
    revenuePLN: sum((r) => r.amountPLN),
    commissionPLN: sum((r) => r.commissionPLN),
    platformFeePLN: sum((r) => r.platformFeePLN || 0),
    curatorNetPLN: sum((r) => r.curatorNetPLN || 0),
    paidPLN: sum((r) => (r.paid ? r.commissionPLN : 0)),
    duePLN: sum((r) => (r.paid ? 0 : r.commissionPLN)),
    agreementFrom: submission.placedAt ? startPeriod(submission.placedAt) : null,
    agreementTo:
      submission.placedAt && terms && PERCENT_MODELS.has(terms.model)
        ? agreementEndPeriod(submission.placedAt, terms.durationMonths)
        : null,
  };
}

module.exports = { agreementEndPeriod, commissionFor, summarize, split, round2 };

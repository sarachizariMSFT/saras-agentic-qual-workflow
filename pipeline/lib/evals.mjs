// evals.mjs — deterministic eval suite over a step's findings. Zero deps.
// Usage:
//   node lib/evals.mjs <studyRoot> <model> <stepFile.json> [--goals inputs/hypotheses.md]
// Writes runs/<model>/08-qa-evals.json (merged per run) and prints a summary.
// Exit code 1 if any HARD gate fails.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './validate.mjs';
import { loadAllTranscripts, speakerText } from './marvin-adapter.mjs';
import { updateJSON, readJSONSafe } from './fsx.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', 'finding.schema.json'), 'utf8'));
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const EVIDENCE = CONFIG.evidence || {};
const TS_RE = new RegExp(EVIDENCE.timestampPattern || '^\\d{1,2}:\\d{2}(:\\d{2})?$');
const CLIP_RE = new RegExp(EVIDENCE.clipUrlPattern || 'marvin', 'i');

// Evidence rows that are participant verbatims (the ones that must carry exact quote + timestamp + clip).
const isSaid = e => (e.observation_type || 'said') === (EVIDENCE.appliesTo || 'said');

// ---- Thresholds (versioned here; change via Design Review) ----
export const THRESHOLDS = {
  hallucinationMinCoverage: 0.9,   // fraction of quote tokens found in transcript
  severityInflationMaxShare: 0.6,  // >60% of scored findings at level 5 => calibration flag
};

const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Contiguous coverage: the fraction of the quote covered by its single LONGEST run of
// words that appears as a contiguous phrase in the transcript. An exact quote scores 1.0.
// A quote stitched together from words scattered across the transcript (the recombination
// attack) scores low, because no long contiguous run matches. This replaces the old
// order-insensitive token-SET coverage, which a fabricated recombined quote could beat 1.0.
function quoteCoverage(quote, transcript) {
  const q = norm(quote).split(' ').filter(Boolean);
  const t = ' ' + norm(transcript) + ' ';
  if (!q.length) return 0;
  if (t.includes(' ' + q.join(' ') + ' ')) return 1;
  let best = 0;
  for (let i = 0; i < q.length; i++) {
    for (let j = i + best + 1; j <= q.length; j++) {
      const window = ' ' + q.slice(i, j).join(' ') + ' ';
      if (t.includes(window)) { if (j - i > best) best = j - i; }
      else break; // a longer window from the same start can't match if this one doesn't
    }
  }
  return best / q.length;
}

// Ground a quote against the transcript, scoped to the cited speaker's turns when the
// transcript has speaker labels (prevents attributing one participant's words to another).
// Falls back to the whole transcript when the speaker can't be located (unlabeled notes).
function groundedCoverage(quote, transcript, participant) {
  const scoped = participant ? speakerText(transcript, participant) : '';
  const target = scoped && scoped.trim() ? scoped : transcript;
  return quoteCoverage(quote, target);
}

// Exact = the normalized quote appears as a contiguous substring of the cited speaker's turns.
const isExactQuote = (quote, transcript, participant) => {
  const scoped = participant ? speakerText(transcript, participant) : '';
  const target = scoped && scoped.trim() ? scoped : transcript;
  const q = norm(quote), t = norm(target);
  return q.length > 0 && t.includes(q);
};

function loadFindings(stepFile) {
  const raw = JSON.parse(fs.readFileSync(stepFile, 'utf8'));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.findings)) return raw.findings;
  // synthesis file: themes are findings too
  if (Array.isArray(raw.themes)) return raw.themes;
  return [];
}

export function runEvals(studyRoot, model, stepFile, goalsFile) {
  const findings = loadFindings(stepFile);
  const transcripts = loadAllTranscripts(studyRoot);
  const results = { step: path.basename(stepFile), model, count: findings.length, evals: {}, offenders: {} };

  // schema (HARD)
  const schemaErrors = [];
  for (const f of findings) {
    const errs = validate(f, SCHEMA, f.id || '(finding)');
    if (errs.length) schemaErrors.push({ id: f.id || '(no id)', errs });
  }
  results.evals.schema = { gate: 'hard', pass: schemaErrors.length === 0, invalid: schemaErrors.length };
  if (schemaErrors.length) results.offenders.schema = schemaErrors;

  // traceability (HARD): >=1 evidence with locator + transcript_id
  const untraceable = findings.filter(f =>
    !Array.isArray(f.evidence) || f.evidence.length === 0 ||
    f.evidence.some(e => !e.transcript_id || !e.locator || !e.quote));
  results.evals.traceability = { gate: 'hard', pass: untraceable.length === 0, failing: untraceable.length };
  if (untraceable.length) results.offenders.traceability = untraceable.map(f => f.id);

  // method_justification (HARD)
  const noMethod = findings.filter(f => !f.method_justification || String(f.method_justification).trim().length < 8);
  results.evals.method_justification = { gate: 'hard', pass: noMethod.length === 0, failing: noMethod.length };
  if (noMethod.length) results.offenders.method_justification = noMethod.map(f => f.id);

  // hallucination (HARD): every quote grounded as a CONTIGUOUS phrase in the cited speaker's turns
  const halluc = [];
  for (const f of findings) {
    for (const e of (f.evidence || [])) {
      const t = transcripts[e.transcript_id];
      if (t == null) { halluc.push({ id: f.id, reason: `no transcript '${e.transcript_id}'` }); continue; }
      const cov = groundedCoverage(e.quote, t, e.participant);
      if (cov < THRESHOLDS.hallucinationMinCoverage)
        halluc.push({ id: f.id, transcript_id: e.transcript_id, participant: e.participant, coverage: +cov.toFixed(2) });
    }
  }
  results.evals.hallucination = { gate: 'hard', pass: halluc.length === 0, failing: halluc.length };
  if (halluc.length) results.offenders.hallucination = halluc;

  // frequency_integrity (HARD): authored frequency must not exceed the count of DISTINCT
  // participants actually supporting the finding (evidence participants ∪ supporting_participants).
  // Stops a hand-typed frequency from inflating severity/priority/risk beyond the real support.
  const freqOffenders = [];
  for (const f of findings) {
    if (typeof f.frequency !== 'number') continue;
    const supporters = new Set([
      ...((f.evidence || []).map(e => e.participant).filter(Boolean)),
      ...((f.supporting_participants || []).filter(Boolean)),
    ]);
    const computed = supporters.size;
    if (f.frequency > computed)
      freqOffenders.push({ id: f.id, authored: f.frequency, supported_by: computed });
  }
  results.evals.frequency_integrity = { gate: 'hard', pass: freqOffenders.length === 0, failing: freqOffenders.length };
  if (freqOffenders.length) results.offenders.frequency_integrity = freqOffenders;

  // --- Evidence-Verifier gates (scoped to 'said' participant quotes) ---
  const saidRows = [];
  for (const f of findings)
    for (const e of (f.evidence || [])) if (isSaid(e)) saidRows.push({ id: f.id, e });

  // quote_exactness (HARD): the participant quote is an EXACT verbatim substring of the speaker's turns
  if (EVIDENCE.requireExactQuotes) {
    const inexact = [];
    for (const { id, e } of saidRows) {
      const t = transcripts[e.transcript_id];
      if (t == null) { inexact.push({ id, reason: `no transcript '${e.transcript_id}'` }); continue; }
      if (!isExactQuote(e.quote, t, e.participant)) inexact.push({ id, transcript_id: e.transcript_id, quote: e.quote });
    }
    results.evals.quote_exactness = { gate: 'hard', pass: inexact.length === 0, failing: inexact.length };
    if (inexact.length) results.offenders.quote_exactness = inexact;
  }

  // quote_timestamp (HARD): every participant quote carries a timestamp locator (hh:mm:ss / mm:ss)
  if (EVIDENCE.requireTimestamps) {
    const noTs = saidRows.filter(({ e }) => !TS_RE.test(String(e.locator || '').trim()));
    results.evals.quote_timestamp = { gate: 'hard', pass: noTs.length === 0, failing: noTs.length };
    if (noTs.length) results.offenders.quote_timestamp = noTs.map(({ id, e }) => ({ id, locator: e.locator || null }));
  }

  // clip_link (HARD): every participant quote is accompanied by a Marvin video clip.
  // A clip_status of 'pending' is accepted ONLY when config.evidence.allowPendingClips is true,
  // so the pipeline isn't deadlocked before Marvin clips are cut — but pending never counts as done.
  if (EVIDENCE.requireClips) {
    const allowPending = EVIDENCE.allowPendingClips === true;
    const noClip = saidRows.filter(({ e }) => {
      const hasClip = e.clip_url && CLIP_RE.test(String(e.clip_url));
      const isPending = allowPending && e.clip_status === 'pending';
      return !hasClip && !isPending;
    });
    const pendingCount = allowPending ? saidRows.filter(({ e }) => !e.clip_url && e.clip_status === 'pending').length : 0;
    results.evals.clip_link = { gate: 'hard', pass: noClip.length === 0, failing: noClip.length, pending: pendingCount };
    if (noClip.length) results.offenders.clip_link = noClip.map(({ id, e }) => ({ id, clip_url: e.clip_url || null, clip_status: e.clip_status || null }));
  }

  // causal_support (SOFT): a finding that asserts causation should carry behavioral/observed
  // evidence (or an explicit causal_strength), not just a participant self-report quote.
  const CAUSAL_RE = /\b(because|causes?|caused|leads? to|led to|results? in|due to|drives?|therefore)\b/i;
  const causalWeak = findings.filter(f => {
    if (!CAUSAL_RE.test(f.statement || '')) return false;
    if (f.causal_strength && f.causal_strength !== 'none') return false;
    const hasBehavioral = (f.evidence || []).some(e => e.observation_type === 'did' || e.observation_type === 'observed');
    return !hasBehavioral;
  });
  if (causalWeak.length) {
    results.evals.causal_support = { gate: 'soft', pass: false, failing: causalWeak.length };
    results.offenders.causal_support = causalWeak.map(f => f.id);
  }

  // coverage (SOFT): every hypothesis is ADDRESSED — supported, refuted, mixed, OR explicitly
  // insufficient_evidence. A refuted/insufficient hypothesis counts as covered (anti-confirmation-bias):
  // we reward looking for disconfirmation, not just mapping findings onto expected stories.
  if (goalsFile && fs.existsSync(goalsFile)) {
    const uniqueGoals = [...new Set(fs.readFileSync(goalsFile, 'utf8').match(/\bH\d+\b/g) || [])];
    // Prefer a structured synthesis verdict map if present on any finding/theme object.
    const verdictMap = {};
    for (const f of findings) {
      const gc = f.goal_coverage || f.hypothesis_verdicts;
      if (gc && typeof gc === 'object') for (const [k, v] of Object.entries(gc)) verdictMap[k] = v.verdict || v;
    }
    const VALID = new Set(['supported', 'refuted', 'mixed', 'insufficient_evidence']);
    const blob = JSON.stringify(findings);
    const covered = uniqueGoals.filter(g => VALID.has(verdictMap[g]) || (verdictMap[g] == null && blob.includes(g)));
    results.evals.coverage = {
      gate: 'soft',
      pass: uniqueGoals.length === 0 || covered.length === uniqueGoals.length,
      covered: covered.length, total: uniqueGoals.length,
      missing: uniqueGoals.filter(g => !covered.includes(g)),
    };
  }

  // calibration (SOFT): severity inflation
  const scored = findings.filter(f => typeof f.severity === 'number');
  if (scored.length) {
    const fives = scored.filter(f => f.severity === 5).length;
    const share = fives / scored.length;
    results.evals.calibration = {
      gate: 'soft', pass: share <= THRESHOLDS.severityInflationMaxShare,
      severity5Share: +share.toFixed(2),
    };
  }

  // recommendation_link (SOFT)
  const recs = findings.filter(f => f.type === 'design_recommendation');
  if (recs.length) {
    const unlinked = recs.filter(f => !Array.isArray(f.related_finding_ids) || f.related_finding_ids.length === 0);
    results.evals.recommendation_link = { gate: 'soft', pass: unlinked.length === 0, failing: unlinked.length };
    if (unlinked.length) results.offenders.recommendation_link = unlinked.map(f => f.id);
  }

  const hardGates = Object.entries(results.evals).filter(([, v]) => v.gate === 'hard');
  results.hardPass = hardGates.every(([, v]) => v.pass);
  results.softFlags = Object.entries(results.evals).filter(([, v]) => v.gate === 'soft' && !v.pass).map(([k]) => k);
  return results;
}

// Steps whose output is a set of findings and therefore MUST pass evals for a run to be green.
// hardPass is computed against this whole set: a required step that was never evaluated (or that
// failed) makes the run FAIL, so a missing/dropped step can no longer read as success.
export const EVAL_REQUIRED_STEPS = [
  '01-observed-behavior', '02-verbatim', '03-pain-points', '04-papercuts',
  '05-design-recommendations', '06b-powerful-moments', '07-synthesis',
];

const stepBase = s => String(s).replace(/\.json$/i, '');

export function mergeIntoReport(studyRoot, model, result) {
  const outFile = path.join(studyRoot, 'runs', model, '08-qa-evals.json');
  const manifest = readJSONSafe(path.join(studyRoot, 'runs', model, 'run-manifest.json'), { steps: [] });
  const manifestSteps = new Set((manifest.steps || []).map(s => s.step));
  // Only require the eval-bearing steps that this run actually scheduled.
  const required = EVAL_REQUIRED_STEPS.filter(s => manifestSteps.size === 0 || manifestSteps.has(s));

  return updateJSON(outFile, (report) => {
    if (!report.model) report.model = model;
    if (!Array.isArray(report.steps)) report.steps = [];
    report.steps = report.steps.filter(s => stepBase(s.step) !== stepBase(result.step));
    report.steps.push(result);
    report.generated_at = new Date().toISOString();

    const evaluated = new Map(report.steps.map(s => [stepBase(s.step), s]));
    const missing = required.filter(r => !evaluated.has(r));
    const allEvaluatedPass = report.steps.every(s => s.hardPass);
    report.required_steps = required;
    report.missing_required = missing;
    report.hardPass = missing.length === 0 && allEvaluatedPass;
    return report;
  }, { model, generated_at: new Date().toISOString(), steps: [] });
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [studyRoot, model, stepFile] = process.argv.slice(2);
  const goalsFlagIdx = process.argv.indexOf('--goals');
  const goalsFile = goalsFlagIdx > -1 ? process.argv[goalsFlagIdx + 1] : path.join(studyRoot || '', 'inputs', 'hypotheses.md');
  if (!studyRoot || !model || !stepFile) {
    console.error('Usage: node lib/evals.mjs <studyRoot> <model> <stepFile.json> [--goals <file>]');
    process.exit(2);
  }
  const result = runEvals(studyRoot, model, stepFile, goalsFile);
  mergeIntoReport(studyRoot, model, result);
  const out = path.join(studyRoot, 'runs', model, '08-qa-evals.json');
  const line = (k, v) => `  ${v.pass ? 'PASS' : 'FAIL'}  [${v.gate}] ${k}`;
  console.log(`\nEvals — ${result.step} (${model}), ${result.count} findings`);
  for (const [k, v] of Object.entries(result.evals)) console.log(line(k, v));
  console.log(`\n  HARD GATES: ${result.hardPass ? 'PASS' : 'FAIL'}`);
  if (result.softFlags.length) console.log(`  SOFT FLAGS: ${result.softFlags.join(', ')}`);
  console.log(`  Report: ${out}\n`);
  process.exit(result.hardPass ? 0 : 1);
}

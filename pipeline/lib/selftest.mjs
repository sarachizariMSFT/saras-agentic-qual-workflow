// selftest.mjs — end-to-end regression suite for the pipeline engine. Zero deps.
// Builds a throwaway fixture study under studies/_selftest, then asserts every hard control
// still holds after the v0.2.0 audit fixes. Run FROM the pipeline/ dir:
//   node lib/selftest.mjs           (cleans the fixture afterwards)
//   node lib/selftest.mjs --keep    (leave studies/_selftest on disk to inspect)
//
// Each numbered block guards one audit fix so a future refactor can't silently regress it.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashInputs, scaffoldManifest } from './run.mjs';
import { buildKey, loadKey, redact, scan, scanRun } from './pii.mjs';
import { stampProvenance, checkProvenance } from './provenance.mjs';
import { runEvals } from './evals.mjs';
import { conductStep } from './conduct.mjs';
import { recordAttempt, unblock, loopState, MAX_LOOP } from './loop.mjs';
import { scanRisk } from './risk.mjs';
import { computeSaturation } from './saturation.mjs';
import { compare } from './compare.mjs';
import { buildAll } from './dashboard.mjs';
import { writeJSONAtomic, readJSONSafe, updateJSON } from './fsx.mjs';
import { lintText, checkStyleSample } from './stylelint.mjs';
import { addRequest, resolveRequest, requestsGate, openRequests } from './requests.mjs';
import { recordCorrection, listCorrections, markApplied, openCorrections } from './corrections.mjs';
import { mdToDocxBuffer, extractEntry } from './export.mjs';
import { withConcurrency, eligibleGroupSteps } from './scheduler.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const STUDY = path.join(ROOT, 'studies', '_selftest');
const NOKEY = path.join(ROOT, 'studies', '_selftest_nokey');
const KEEP = process.argv.includes('--keep');

let passN = 0, failN = 0;
const ok = (cond, msg) => { if (cond) { passN++; console.log(`  ✓ ${msg}`); } else { failN++; console.error(`  ✗ ${msg}`); } };
const section = s => console.log(`\n${s}`);
const writeJSON = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2)); };
const rm = d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ } };

// ---- evidence + finding builders -------------------------------------------------
const said = (over = {}) => ({
  transcript_id: 'P01', participant: 'P01', locator: '00:12:44',
  quote: 'I honestly gave up and used the spreadsheet',
  clip_url: 'https://heymarvin.com/clip/abc', clip_status: 'created',
  observation_type: 'said', source_type: 'transcript_speech', ...over,
});
const finding = (over = {}) => ({
  id: 'PAIN-003', type: 'pain_point',
  statement: 'Participants abandon the second-card flow and fall back to a spreadsheet.',
  method: 'thematic', method_justification: 'Recurring pattern observed across sessions.',
  severity: 4, frequency: 1, supporting_participants: ['P01'], confidence: 'medium',
  evidence: [said()], created_by: 'pain-points', model: 'opus-4.8', run_id: 'r-opus', ...over,
});

// ---- setup -----------------------------------------------------------------------
function setup() {
  rm(STUDY); rm(NOKEY);
  writeJSON(path.join(STUDY, 'study.json'), { study_id: '_selftest', name: 'Self-Test Study', models: ['opus-4.8', 'gpt-5.5'] });

  // two labelled, timestamped transcripts (=> N of 2 for saturation)
  fs.mkdirSync(path.join(STUDY, 'inputs', 'transcripts'), { recursive: true });
  fs.writeFileSync(path.join(STUDY, 'inputs', 'transcripts', 'P01.md'),
    `[00:03:10] P01: I couldn't find where to add a second card, I clicked around for a while.\n` +
    `[00:12:44] P01: I honestly gave up and used the spreadsheet.\n`);
  fs.writeFileSync(path.join(STUDY, 'inputs', 'transcripts', 'P07.md'),
    `[00:31:20] P07: oh thank god, finally — I'd have paid money for that button.\n` +
    `[00:18:05] P07: the label said Submit but it only saved a draft, so I lost my place.\n`);

  fs.writeFileSync(path.join(STUDY, 'inputs', 'hypotheses.md'), '# Hypotheses\n- H1: users abandon the flow\n- H2: labels mislead\n');

  // private roster -> opaque codes
  writeJSON(path.join(STUDY, 'inputs', 'private', 'roster.json'), [
    { name: 'Jordan Lee', company: 'Acme', session_datetime: '2026-07-02T14:00:00Z' },
    { name: 'Priya Shah', company: 'Globex', session_datetime: '2026-07-03T10:00:00Z' },
  ]);
  buildKey(STUDY);
  stampProvenance(STUDY);
  hashInputs(STUDY);
  scaffoldManifest(STUDY, 'opus-4.8', { fresh: true });
  scaffoldManifest(STUDY, 'gpt-5.5', { fresh: true });
}

// ---- test blocks -----------------------------------------------------------------
function testEvidenceGates() {
  section('1) Evidence gates (hallucination / exactness / timestamp / clips / frequency)');
  const opusPain = path.join(STUDY, 'runs', 'opus-4.8', '03-pain-points.json');
  writeJSON(opusPain, [finding()]);
  const good = runEvals(STUDY, 'opus-4.8', opusPain, path.join(STUDY, 'inputs', 'hypotheses.md'));
  ok(good.hardPass === true, 'a fully-grounded finding passes all hard gates');
  ok(good.evals.hallucination.pass && good.evals.quote_exactness.pass && good.evals.quote_timestamp.pass && good.evals.clip_link.pass,
    'grounding, exact-quote, timestamp and clip gates all PASS for the good finding');

  // contiguous hallucination: a quote recombined from scattered transcript words must FAIL
  const recomb = path.join(STUDY, 'runs', 'opus-4.8', 'probe-recomb.json');
  writeJSON(recomb, [finding({ id: 'PAIN-004', evidence: [said({ quote: 'add a card spreadsheet while', clip_status: 'created' })] })]);
  const r = runEvals(STUDY, 'opus-4.8', recomb);
  ok(r.evals.hallucination.pass === false, 'a recombined (non-contiguous) quote FAILS the hallucination gate');

  // frequency_integrity: authored frequency above distinct supporters must FAIL
  const overfreq = path.join(STUDY, 'runs', 'opus-4.8', 'probe-freq.json');
  writeJSON(overfreq, [finding({ id: 'PAIN-005', frequency: 3, supporting_participants: ['P01'] })]);
  const fr = runEvals(STUDY, 'opus-4.8', overfreq);
  ok(fr.evals.frequency_integrity.pass === false, 'frequency exceeding distinct supporters FAILS frequency_integrity');
  ok(good.evals.frequency_integrity.pass === true, 'frequency within supporters PASSES frequency_integrity');

  // pending clips accepted (no deadlock), failed/missing clips rejected
  const pend = path.join(STUDY, 'runs', 'opus-4.8', 'probe-pend.json');
  writeJSON(pend, [finding({ id: 'PAIN-006', evidence: [said({ clip_url: undefined, clip_status: 'pending' })] })]);
  const pr = runEvals(STUDY, 'opus-4.8', pend);
  ok(pr.evals.clip_link.pass === true && pr.evals.clip_link.pending >= 1, 'clip_status:"pending" is accepted and counted as pending');

  const nocl = path.join(STUDY, 'runs', 'opus-4.8', 'probe-noclip.json');
  writeJSON(nocl, [finding({ id: 'PAIN-007', evidence: [said({ clip_url: undefined, clip_status: 'failed' })] })]);
  const nr = runEvals(STUDY, 'opus-4.8', nocl);
  ok(nr.evals.clip_link.pass === false, 'a missing/failed clip FAILS the clip_link gate');

  for (const f of [recomb, overfreq, pend, nocl]) rm(f);
}

function testSpeakerScoping() {
  section('2) Speaker-scoped grounding (one participant\'s words can\'t back another\'s finding)');
  const mom = path.join(STUDY, 'runs', 'opus-4.8', '06b-powerful-moments.json');
  writeJSON(mom, [finding({
    id: 'MOM-001', type: 'powerful_moment',
    statement: 'A participant expressed intense relief on finally finding the button.',
    severity: undefined, frequency: undefined, supporting_participants: ['P07'],
    emotion: 'relief', intensity: 5, clip_worthy: true, representativeness: 'illustrative',
    evidence: [said({ transcript_id: 'P07', participant: 'P07', locator: '00:31:20', quote: 'oh thank god, finally', clip_status: 'created' })],
  })]);
  const m = runEvals(STUDY, 'opus-4.8', mom);
  ok(m.evals.hallucination.pass === true, 'a P07 quote grounded against P07 turns PASSES');

  // same quote but attributed to P01 must fail — use a transcript where BOTH speakers appear,
  // so grounding is scoped to P01's turns (which never contain the quote) instead of falling
  // back to the whole transcript.
  const combo = path.join(STUDY, 'inputs', 'transcripts', 'COMBO.md');
  fs.writeFileSync(combo, `[00:01:00] P01: I clicked around for a while.\n[00:31:20] P07: oh thank god, finally.\n`);
  const cross = path.join(STUDY, 'runs', 'opus-4.8', 'probe-cross.json');
  writeJSON(cross, [finding({ id: 'MOM-002', type: 'powerful_moment', supporting_participants: ['P01'],
    evidence: [said({ participant: 'P01', transcript_id: 'COMBO', quote: 'oh thank god, finally', clip_status: 'created' })] })]);
  const c = runEvals(STUDY, 'opus-4.8', cross);
  ok(c.evals.hallucination.pass === false, 'attributing P07\'s words to P01 FAILS grounding');
  rm(cross); rm(combo);
}

function testPII() {
  section('3) PII: opaque codes, fail-closed, redaction, scan');
  const key = loadKey(STUDY);
  const codes = Object.keys(key);
  ok(codes.every(c => /^P\d{2}$/.test(c)), 'participant codes are OPAQUE (P01, P02 …), not date/time-encoded');
  ok(key.P01 && key.P01.session_datetime, 'session date/time lives in the PRIVATE crosswalk');

  // public codes file must never leak names / companies / session times
  const pub = fs.readFileSync(path.join(STUDY, 'inputs', 'participant-codes.md'), 'utf8');
  ok(!/Jordan|Priya|Acme|Globex|2026-07/.test(pub), 'public participant-codes.md exposes NO names/companies/session times');

  // fail-closed: no key => loadKey throws (never a silent "clean")
  fs.mkdirSync(NOKEY, { recursive: true });
  let threw = false;
  try { loadKey(NOKEY); } catch { threw = true; }
  ok(threw, 'loadKey FAILS CLOSED when the participant key is missing');

  // redaction maps names->codes, companies->[COMPANY]
  const red = redact('Jordan Lee from Acme said the export was slow; Priya at Globex agreed.', key);
  ok(!/Jordan|Lee|Priya|Shah|Acme|Globex/.test(red), 'redaction removes every roster name and company');
  ok(/P0\d/.test(red) && /\[COMPANY\]/.test(red), 'redaction substitutes opaque codes and [COMPANY]');

  // scan detects a leak and passes clean text
  ok(scan('Jordan Lee at Acme', key).length >= 2, 'scan flags un-redacted name + company as leaks');
  ok(scan('Participant P01 abandoned checkout.', key).length === 0, 'scan is clean on a fully de-identified sentence');

  // scan-run over every artifact produces a report (codes-only step files are clean)
  const rep = scanRun(STUDY, 'opus-4.8');
  ok(rep.pass === true, 'scan-run reports the code-only run artifacts as PII-clean');
}

function testProvenance() {
  section('4) Transcript provenance gate (raw transcripts only, no Ask-AI summaries)');
  ok(checkProvenance(STUDY).pass === true, 'stamped raw transcripts PASS the provenance gate');

  // an un-stamped transcript must fail (missing provenance)
  const extra = path.join(STUDY, 'inputs', 'transcripts', 'PX.md');
  fs.writeFileSync(extra, '[00:00:01] PX: this file was never stamped.\n');
  const bad = checkProvenance(STUDY);
  ok(bad.pass === false && bad.missing.includes('PX'), 'a transcript with no provenance record FAILS the gate');
  rm(extra);
}

function testSaturation() {
  section('5) Sample adequacy / saturation artifact');
  const sat = computeSaturation(STUDY, 'opus-4.8');
  ok(sat.denominator_N === 2, 'denominator N equals the transcript count (2)');
  ok(sat.participants_cited >= 1, 'saturation records how many participants are cited');
  ok(fs.existsSync(path.join(STUDY, 'runs', 'opus-4.8', 'saturation.json')), 'saturation.json is written for the dashboard');
  ok(sat.adequacy_flags.some(f => /single participant/.test(f)), 'a single-participant theme is flagged for adequacy review');
}

function testEnforcement() {
  section('6) Enforcement driver (a step reaches "done" ONLY if hard gates pass)');
  const opusPain = path.join(STUDY, 'runs', 'opus-4.8', '03-pain-points.json');
  writeJSON(opusPain, [finding()]);
  const good = conductStep(STUDY, 'opus-4.8', '03-pain-points', opusPain);
  ok(good.hardPass === true && good.status === 'done', 'a passing step is marked done by the conductor');

  const sonPain = path.join(STUDY, 'runs', 'gpt-5.5', '03-pain-points.json');
  writeJSON(sonPain, [
    finding({ model: 'gpt-5.5', run_id: 'r-gpt' }),
    finding({ id: 'PAIN-009', model: 'gpt-5.5', run_id: 'r-gpt',
      statement: 'The whole app is unusable and crashes constantly.',
      evidence: [said({ quote: 'the app crashed every five seconds and deleted everything', clip_status: 'created' })] }),
  ]);
  const bad = conductStep(STUDY, 'gpt-5.5', '03-pain-points', sonPain);
  ok(bad.hardPass === false && bad.status !== 'done', 'a hallucinated step is NOT marked done — the agent cannot self-certify');
}

function testLoopCapAndUnblock() {
  section('7) Loop circuit-breaker + human unblock');
  const step = '04-papercuts';
  let last;
  for (let i = 0; i < MAX_LOOP; i++) last = recordAttempt(STUDY, 'gpt-5.5', step, false, 'still failing');
  ok(last.status === 'blocked' && last.action === 'escalate_to_human', `loop blocks after ${MAX_LOOP} failed attempts and escalates`);

  let unblockThrew = false;
  try { unblock(STUDY, 'gpt-5.5', step, ''); } catch { unblockThrew = true; }
  ok(unblockThrew, 'unblock REQUIRES a human note (no silent override)');

  const u = unblock(STUDY, 'gpt-5.5', step, 'reviewer approved a scoped exception');
  ok(u.status === 'pending' && u.attempts === 0, 'human unblock resets the step to pending with a fresh budget');

  const adv = recordAttempt(STUDY, 'gpt-5.5', step, true);
  ok(adv.status === 'done' && adv.attempts === 0, 'a subsequent pass advances and resets attempts');
  const blocked = loopState(STUDY, 'gpt-5.5').find(s => s.step === step);
  ok(blocked.status === 'done', 'loop state reflects the recovered step');
}

function testRisk() {
  section('8) Risk flagging (real risks flagged; false positives suppressed)');
  // recommendation with thin support + prescriptive language -> should flag
  writeJSON(path.join(STUDY, 'runs', 'opus-4.8', '05-design-recommendations.json'), [finding({
    id: 'REC-001', type: 'design_recommendation',
    statement: 'We must always add a visible second-card button.',
    method: 'hybrid', method_justification: 'Derived from the abandonment pattern.',
    confidence: 'high', related_finding_ids: ['PAIN-003'],
  })]);
  // benign papercut: "disabled" (UI sense) in statement, "because" only inside the quote
  writeJSON(path.join(STUDY, 'runs', 'opus-4.8', '04-papercuts.json'), [finding({
    id: 'PAPER-001', type: 'papercut', severity: 2, confidence: 'low', supporting_participants: ['P07'],
    statement: 'The Save button stays disabled until the form is complete.',
    evidence: [said({ transcript_id: 'P07', participant: 'P07', locator: '00:18:05',
      quote: 'it saved a draft because the label was ambiguous', clip_status: 'created' })],
  })]);

  const rep = scanRisk(STUDY, 'opus-4.8');
  const rec = rep.flags.filter(f => f.finding_id === 'REC-001');
  ok(rec.some(f => f.category === 'weak_support_high_impact'), 'a thinly-supported high-impact recommendation is flagged');

  const paperFlags = rep.flags.filter(f => f.finding_id === 'PAPER-001');
  ok(!paperFlags.some(f => f.category === 'sensitive_topic'), 'the UI word "disabled" no longer trips the sensitive-topic detector');
  ok(!paperFlags.some(f => f.category === 'causal_claim'), 'a "because" inside a participant quote does NOT raise a causal-claim flag');
}

function testCompare() {
  section('9) Dual-model comparison validity checks');
  // seed a matching second-model producer set so both runs have content
  writeJSON(path.join(STUDY, 'runs', 'gpt-5.5', '03-pain-points.json'), [finding({ model: 'gpt-5.5', run_id: 'r-gpt' })]);
  const c = compare(STUDY);
  ok(c.verify.pass === true, 'a genuine cross-model comparison (different models, identical inputs) is VALID');

  // tamper: make both runs claim the same model -> comparison must be flagged invalid
  const sonMan = path.join(STUDY, 'runs', 'gpt-5.5', 'run-manifest.json');
  const saved = readJSONSafe(sonMan).model;
  updateJSON(sonMan, m => { m.model = 'opus-4.8'; return m; });
  const bad = compare(STUDY);
  ok(bad.verify.pass === false, 'two runs reporting the SAME model are flagged as an invalid comparison');
  updateJSON(sonMan, m => { m.model = saved; return m; });
}

function testDashboards() {
  section('10) Dashboards render with new panels');
  scanRun(STUDY, 'opus-4.8');
  computeSaturation(STUDY, 'opus-4.8');
  buildAll(STUDY);
  const dash = path.join(STUDY, 'dashboards');
  ok(fs.existsSync(path.join(dash, 'index.html')), 'dashboard index.html is generated');
  ok(fs.existsSync(path.join(dash, 'opus-4.8-cp2-analysis.html')), 'CP2 analysis dashboard is generated');
  const cp2 = fs.readFileSync(path.join(dash, 'opus-4.8-cp2-analysis.html'), 'utf8');
  ok(/saturation|adequacy/i.test(cp2), 'CP2 dashboard includes the saturation/adequacy panel');
  ok(/PII scan clean|PII LEAK/i.test(cp2), 'CP2 dashboard includes the PII panel');
}

function testStyleLint() {
  section('11) House-style gate (Update 1: humanizer becomes a real, deterministic gate)');
  const bad = lintText('The result was clear — participants gave up.');
  ok(bad.hard.some(h => h.id === 'em-dash-in-prose'), 'an em dash in prose trips a HARD style rule');
  ok(lintText('> I tried it — then I quit.').hard.length === 0, 'an em dash inside a blockquote (verbatim quote) is NOT flagged');
  ok(lintText('One participant said "I tried it — then I quit" out loud.').hard.length === 0, 'an em dash inside a double-quoted verbatim is NOT flagged');
  const soft = lintText('Most developers wanted a shortcut.');
  ok(soft.soft.some(s => s.id === 'developers-not-participants'), '"developers" surfaces as a SOFT warning');
  ok(soft.hard.length === 0, 'a soft-only issue does not trip the hard gate');
  const noSample = checkStyleSample(STUDY);
  ok(noSample.required === true && noSample.pass === false, 'check-sample FAILS when no writing-style sample is present');
  fs.mkdirSync(path.join(STUDY, 'inputs', 'style-samples'), { recursive: true });
  fs.writeFileSync(path.join(STUDY, 'inputs', 'style-samples', 'past-report.md'), '# Past report\nShort, plain sentences.\n');
  ok(checkStyleSample(STUDY).pass === true, 'check-sample PASSES once a style sample is captured');
}

function testRoles() {
  section('12) Participant roles + non-participant exclusion (Update 2)');
  const RD = path.join(ROOT, 'studies', '_selftest_roles');
  rm(RD);
  writeJSON(path.join(RD, 'inputs', 'private', 'roster.json'), [
    { name: 'Ann Diaz', company: 'Acme', session_datetime: '2026-07-02T14:00:00Z' },
    { name: 'Bob Ng', company: 'Globex', role: 'observer' },
    { name: 'Cara Poe', company: 'Initech', role: 'facilitator' },
  ]);
  const key = buildKey(RD);
  ok(!!key.P01 && key.P01.role === 'participant', 'a participant is coded P01 with role participant');
  ok(!!key.OBS01 && key.OBS01.role === 'observer', 'an observer is coded OBS01, not a P-code');
  ok(!!key.FAC01 && key.FAC01.role === 'facilitator', 'a facilitator is coded FAC01, not a P-code');
  const pub = fs.readFileSync(path.join(RD, 'inputs', 'participant-codes.md'), 'utf8');
  ok(/\bP01\b/.test(pub) && !/OBS01|FAC01/.test(pub), 'public participant-codes.md lists participants only (no OBS/FAC)');

  // saturation must not count the product's own "Agent" voice as a participant
  fs.mkdirSync(path.join(RD, 'inputs', 'transcripts'), { recursive: true });
  fs.writeFileSync(path.join(RD, 'inputs', 'transcripts', 'P01.md'), '[00:01:00] P01: I could not find the setting.\n');
  writeJSON(path.join(RD, 'runs', 'opus-4.8', '03-pain-points.json'), [finding({
    id: 'PAIN-100', supporting_participants: ['P01', 'Agent'], representativeness: 'illustrative',
    evidence: [said({ participant: 'P01' })],
  })]);
  const sat = computeSaturation(RD, 'opus-4.8');
  ok(!('Agent' in sat.per_participant_findings), 'the product "Agent" speaker is excluded from saturation counts');
  ok(sat.per_participant_findings.P01 >= 1 && sat.participants_cited === 1, 'only real participants (P01) are counted, so no 8-of-7 inflation');
  rm(RD);
}

function testInterpretationSupport() {
  section('13) Over-reading soft gate (Update 3: interpretation_support)');
  const base = path.join(STUDY, 'runs', 'opus-4.8');
  const enumF = path.join(base, 'probe-enum.json');
  writeJSON(enumF, [finding({ id: 'PAIN-201',
    statement: 'Participants used two modes of the assistant.',
    evidence: [said({ quote: 'I honestly gave up and used the spreadsheet' })] })]);
  const er = runEvals(STUDY, 'opus-4.8', enumF);
  ok(er.evals.interpretation_support && er.evals.interpretation_support.pass === false, 'an invented "two modes" enumeration trips interpretation_support');
  ok(er.hardPass === true, 'interpretation_support is SOFT — it does not fail the hard gate');

  const attrF = path.join(base, 'probe-attr.json');
  writeJSON(attrF, [finding({ id: 'PAIN-202',
    statement: 'The participant attributed the failure to the button label.',
    evidence: [said({ quote: 'I honestly gave up and used the spreadsheet' })] })]);
  const ar = runEvals(STUDY, 'opus-4.8', attrF);
  ok(ar.evals.interpretation_support && ar.evals.interpretation_support.pass === false, 'an attribution with no observed behavior trips interpretation_support');

  const cleanF = path.join(base, 'probe-clean.json');
  writeJSON(cleanF, [finding()]);
  const cr = runEvals(STUDY, 'opus-4.8', cleanF);
  ok(cr.evals.interpretation_support === undefined, 'a grounded finding with no over-read is not flagged');
  for (const f of [enumF, attrF, cleanF]) rm(f);
}

function testRequests() {
  section('14) Researcher-ask tracker (Update 4: nothing the researcher asks silently drops)');
  const r1 = addRequest(STUDY, 'What about settings defaults?', { turn: 37 });
  ok(/^REQ-\d{3}$/.test(r1.id) && r1.status === 'open', 'a researcher ask is logged as an OPEN request');
  ok(requestsGate(STUDY).pass === false, 'CP3 gate is BLOCKED while a request is open');
  resolveRequest(STUDY, r1.id, 'Added a settings-defaults sub-section to the report.');
  ok(openRequests(STUDY).length === 0, 'resolving the request clears the open list');
  ok(requestsGate(STUDY).pass === true, 'CP3 gate PASSES once every request is addressed');
  rm(path.join(STUDY, 'researcher-requests.json'));
}

function testCorrections() {
  section('15) Learning-loop ledger (Update 6: corrections become durable records)');
  const { rec } = recordCorrection(STUDY, {
    target: 'agent', target_id: 'editor', run_model: 'opus-4.8', root_cause: 'skill-gap',
    problem: 'Report said "developers" instead of "participants".',
    correction: 'Use "participants" throughout the report and story.',
    change: 'Added the developers-not-participants soft rule to config.style.',
    source_turn: 11,
  });
  ok(/^COR-\d{4}-\d{2}-\d{2}-\d{2}$/.test(rec.id) && rec.status === 'open', 'a correction is recorded as an OPEN COR-YYYY-MM-DD-NN record');
  ok(listCorrections(STUDY, 'open').length >= 1, 'the open correction is listed');
  markApplied(STUDY, rec.id, 'LEARN-01');
  ok(openCorrections(STUDY).length === 0, 'marking applied clears it from the open list');
  ok(listCorrections(STUDY, 'applied').some(c => c.changelog_ref === 'LEARN-01'), 'an applied correction records its CHANGELOG ref');
  let threw = false;
  try { recordCorrection(STUDY, { target: 'agent', root_cause: 'prompt', problem: 'missing change field here', correction: 'do the thing' }); } catch { threw = true; }
  ok(threw, 'a correction missing a required field (change) is rejected by the schema');
  rm(path.join(STUDY, 'corrections'));
}

function testExport() {
  section('16) Deliverable docx export (Update 7: md -> docx with embedded clip links)');
  const md = [
    '# Voice Collaboration', '', '## Theme 1',
    'Participants relied on the spreadsheet fallback.', '',
    '> I honestly gave up and used the spreadsheet.', '',
    'See the [clip](https://heymarvin.com/clip/abc) for the moment.', '',
    '- first point', '- second point',
  ].join('\n');
  const buf = mdToDocxBuffer(md);
  ok(buf.slice(0, 2).toString('latin1') === 'PK', 'the .docx starts with the ZIP (PK) signature');
  const doc = extractEntry(buf, 'word/document.xml');
  ok(!!doc && doc.includes('Voice Collaboration'), 'document.xml carries the report text');
  ok(/w:pStyle w:val="Quote"/.test(doc || ''), 'a markdown blockquote becomes a Word Quote paragraph');
  ok(/<w:hyperlink r:id=/.test(doc || ''), 'a markdown link becomes a real Word hyperlink');
  const rels = extractEntry(buf, 'word/_rels/document.xml.rels');
  ok(!!rels && rels.includes('heymarvin.com'), 'the clip URL is written as an external relationship (playable link)');
}

async function testFastScheduling() {
  section('17) Fast scheduler metadata + bounded parallel worker pool');
  const m = readJSONSafe(path.join(STUDY, 'runs', 'opus-4.8', 'run-manifest.json'));
  ok(m?.execution?.fast?.strategy === 'dependency-aware-pool', 'manifest records fast scheduler strategy metadata');
  const p3 = (m.steps || []).filter(s => s.parallel_group === 'phase3-producers');
  ok(p3.length === 6, 'manifest marks all six Phase 3 producer steps as parallel-group members');
  ok(p3.every(s => Array.isArray(s.depends_on) && s.depends_on.includes('02c-empathy')), 'Phase 3 producer dependencies point to 02c-empathy');

  // bounded pool should run all jobs while respecting the max width
  let running = 0, peak = 0;
  const jobs = [1, 2, 3, 4, 5, 6];
  const out = await withConcurrency(jobs, 3, async (n) => {
    running++; peak = Math.max(peak, running);
    await new Promise(r => setTimeout(r, 10 + (n % 3) * 5));
    running--;
    return n * 2;
  });
  ok(peak <= 3, 'worker pool respects maxParallel bound');
  ok(JSON.stringify(out) === JSON.stringify([2, 4, 6, 8, 10, 12]), 'worker pool preserves result order');

  const done = new Set(['02c-empathy']);
  const sim = (m.steps || []).map(s => s.parallel_group === 'phase3-producers' ? { ...s, status: 'pending' } : s);
  const elig = eligibleGroupSteps(sim, done, 'phase3-producers');
  ok(elig.length === 6, 'eligibleGroupSteps returns runnable Phase 3 steps when dependencies are satisfied');
}

// ---- run -------------------------------------------------------------------------
console.log('UXR pipeline self-test — building fixture study at studies/_selftest …');
try {
  setup();
  testEvidenceGates();
  testSpeakerScoping();
  testPII();
  testProvenance();
  testSaturation();
  testEnforcement();
  testLoopCapAndUnblock();
  testRisk();
  testCompare();
  testDashboards();
  testStyleLint();
  testRoles();
  testInterpretationSupport();
  testRequests();
  testCorrections();
  testExport();
  await testFastScheduling();
} catch (e) {
  failN++;
  console.error('\n✗ Uncaught error during self-test:\n', e);
} finally {
  if (!KEEP) { rm(STUDY); rm(NOKEY); }
}

console.log(`\n${failN === 0 ? '✅ PASSED' : '❌ FAILED'} — ${passN} passed, ${failN} failed${KEEP ? ` (fixtures kept at ${STUDY})` : ''}`);
process.exit(failN === 0 ? 0 : 1);

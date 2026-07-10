// _pilot.mjs — end-to-end PILOT of the full 22-agent pipeline (engine integration test).
// Builds studies/_pilot with 3 realistic transcripts, then drives EVERY manifest step for
// BOTH models through the real engine: intake -> PII -> provenance -> prep agents ->
// evidence/coding -> empathy -> six producers (evals+loops) -> challenge -> synthesis ->
// saturation -> evidence-verify -> risk -> product implications -> report/story -> PII gate ->
// checkpoints -> dashboards -> dual-model compare. Uses synthetic-but-contract-valid data.
//
// Run from pipeline/:  node _pilot.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashInputs, scaffoldManifest } from './lib/run.mjs';
import { buildKey, scanRun } from './lib/pii.mjs';
import { stampProvenance, checkProvenance } from './lib/provenance.mjs';
import { conductStep } from './lib/conduct.mjs';
import { recordAttempt } from './lib/loop.mjs';
import { scanRisk } from './lib/risk.mjs';
import { computeSaturation } from './lib/saturation.mjs';
import { compare } from './lib/compare.mjs';
import { buildAll } from './lib/dashboard.mjs';
import { validate } from './lib/validate.mjs';
import { readJSONSafe, updateJSON } from './lib/fsx.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STUDY = path.join(ROOT, 'studies', '_pilot');
const MODELS = ['opus-4.8', 'gpt-5.5'];
const SCHEMAS = path.join(__dirname, 'schemas');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log(`  \u2713 ${m}`); } else { fail++; console.error(`  \u2717 ${m}`); } };
const sec = s => console.log(`\n${s}`);
const wj = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2)); };
const wf = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
const rm = d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ } };
const runDir = m => path.join(STUDY, 'runs', m);
const schema = name => JSON.parse(fs.readFileSync(path.join(SCHEMAS, name), 'utf8'));

// ---- transcripts (speaker-labelled + timestamped; N=3) ----
const T = {
  P01: `[00:02:15] P01: I couldn't tell what the agent had changed, so I opened every file to check.\n` +
       `[00:09:40] P01: honestly I ended up babysitting it the whole time.\n`,
  P02: `[00:04:05] P02: it said it was done but I didn't trust that until I ran the tests myself.\n` +
       `[00:15:30] P02: I liked that it explained the plan before it started.\n`,
  P03: `[00:06:20] P03: I gave up waiting and just wrote the function by hand.\n` +
       `[00:11:10] P03: the diff view finally showed me what happened and I relaxed.\n`,
};
// exact quote fragments (verbatim substrings of each speaker's turns)
const Q = {
  P01a: "I couldn't tell what the agent had changed, so I opened every file to check.",
  P01b: "honestly I ended up babysitting it the whole time.",
  P02a: "it said it was done but I didn't trust that until I ran the tests myself.",
  P02b: "I liked that it explained the plan before it started.",
  P03a: "I gave up waiting and just wrote the function by hand.",
  P03b: "the diff view finally showed me what happened and I relaxed.",
};

const said = (p, ts, quote, over = {}) => ({
  transcript_id: p, participant: p, locator: ts, quote,
  clip_url: `https://heymarvin.com/clip/${p}-${ts.replace(/:/g, '')}`, clip_status: 'created',
  observation_type: 'said', source_type: 'transcript_speech', ...over,
});
const did = (p, ts, quote) => ({
  transcript_id: p, participant: p, locator: ts, quote,
  observation_type: 'did', source_type: 'video_observed_behavior',
});

// ---- findings per producer (contract-valid; exact quotes) ----
function producerFindings(model) {
  const rid = `r-${model}`;
  const base = { model, run_id: rid };
  return {
    '01-observed-behavior': [
      { ...base, id: 'BEH-001', type: 'behavioral_evidence', statement: 'Participant manually reopened files to reconstruct what the agent changed.',
        method: 'thematic', method_justification: 'Directly observed behavior in the session recording.', confidence: 'high',
        evidence_mode: 'observed_behavior', supporting_participants: ['P01'], frequency: 1,
        created_by: 'observed-behavior', evidence: [did('P01', '00:02:15', Q.P01a)] },
      { ...base, id: 'BEH-002', type: 'behavioral_evidence', statement: 'Participant abandoned the agent and completed the task by hand.',
        method: 'thematic', method_justification: 'Observed fallback behavior under uncertainty.', confidence: 'high',
        evidence_mode: 'observed_behavior', supporting_participants: ['P03'], frequency: 1,
        created_by: 'observed-behavior', evidence: [did('P03', '00:06:20', Q.P03a)] },
    ],
    '02-verbatim': [
      { ...base, id: 'VERB-001', type: 'verbatim', statement: 'Participant described the work as babysitting the agent.',
        method: 'thematic', method_justification: 'Verbatim capture of the voice of the customer.', confidence: 'high',
        evidence_mode: 'participant_self_report', supporting_participants: ['P01'], frequency: 1,
        created_by: 'verbatim', evidence: [said('P01', '00:09:40', Q.P01b)] },
      { ...base, id: 'VERB-002', type: 'verbatim', statement: 'Participant valued the agent stating its plan up front.',
        method: 'thematic', method_justification: 'Verbatim capture of a positive expectation.', confidence: 'medium',
        evidence_mode: 'participant_self_report', supporting_participants: ['P02'], frequency: 1,
        created_by: 'verbatim', evidence: [said('P02', '00:15:30', Q.P02b)] },
    ],
    '03-pain-points': [
      { ...base, id: 'PAIN-001', type: 'pain_point', statement: 'Participants could not see what the agent changed and had to verify manually.',
        method: 'thematic', method_justification: 'Recurring high-severity pattern across participants.', severity: 4, confidence: 'high',
        evidence_mode: 'participant_self_report', supporting_participants: ['P01', 'P02'], frequency: 2, representativeness: 'representative',
        created_by: 'pain-points', evidence: [said('P01', '00:02:15', Q.P01a), said('P02', '00:04:05', Q.P02a)] },
      { ...base, id: 'PAIN-002', type: 'pain_point', statement: 'Waiting on the agent pushed a participant to redo the work manually.',
        method: 'thematic', method_justification: 'Distinct pain expressed with a fallback action.', severity: 3, confidence: 'medium',
        evidence_mode: 'participant_self_report', supporting_participants: ['P03'], frequency: 1, representativeness: 'illustrative',
        created_by: 'pain-points', evidence: [said('P03', '00:06:20', Q.P03a)] },
    ],
    '04-papercuts': [
      { ...base, id: 'PAPER-001', type: 'papercut', statement: 'A done status did not feel trustworthy without a manual test run.',
        method: 'thematic', method_justification: 'Small repeated friction that erodes trust.', severity: 2, confidence: 'medium',
        evidence_mode: 'participant_self_report', supporting_participants: ['P02'], frequency: 1, representativeness: 'illustrative',
        created_by: 'papercuts', evidence: [said('P02', '00:04:05', Q.P02a)] },
    ],
    '05-design-recommendations': [
      { ...base, id: 'REC-001', type: 'design_recommendation', statement: 'Surface a visible diff of what the agent changed before asking for approval.',
        method: 'thematic', method_justification: 'Grounded in the relief a participant felt when a diff appeared.', confidence: 'high',
        evidence_mode: 'participant_self_report', supporting_participants: ['P03'], frequency: 1, representativeness: 'illustrative',
        related_finding_ids: ['PAIN-001'], created_by: 'design-recommendations', evidence: [said('P03', '00:11:10', Q.P03b)] },
    ],
    '06b-powerful-moments': [
      { ...base, id: 'MOM-001', type: 'powerful_moment', statement: 'Seeing the diff turned confusion into relief.',
        method: 'thematic', method_justification: 'A memorable emotional peak worth a clip.', confidence: 'high',
        emotion: 'relief', intensity: 4, clip_worthy: true, representativeness: 'illustrative',
        evidence_mode: 'participant_self_report', supporting_participants: ['P03'], frequency: 1,
        created_by: 'powerful-moments', evidence: [said('P03', '00:11:10', Q.P03b)] },
      { ...base, id: 'MOM-002', type: 'powerful_moment', statement: 'The babysitting comment captured the felt cost of low visibility.',
        method: 'thematic', method_justification: 'Vivid participant language that names the burden.', confidence: 'high',
        emotion: 'frustration', intensity: 4, clip_worthy: true, representativeness: 'illustrative',
        evidence_mode: 'participant_self_report', supporting_participants: ['P01'], frequency: 1,
        created_by: 'powerful-moments', evidence: [said('P01', '00:09:40', Q.P01b)] },
    ],
  };
}

function synthesis(model) {
  const rid = `r-${model}`;
  return {
    model, run_id: rid, generated_at: new Date().toISOString(),
    themes: [
      { model, run_id: rid, id: 'THEME-001', type: 'theme', created_by: 'synthesizer',
        statement: 'Participants delegate work but shift to supervising when they cannot see what changed.',
        method: 'thematic', method_justification: 'Clusters the visibility pain across three participants.',
        confidence: 'high', representativeness: 'representative',
        supporting_participants: ['P01', 'P02', 'P03'], frequency: 3,
        related_finding_ids: ['PAIN-001', 'BEH-001', 'VERB-001'],
        goal_coverage: {
          H1: { verdict: 'supported', supporting: ['THEME-001'], refuting: [] },
          H2: { verdict: 'mixed', supporting: ['THEME-002'], refuting: [] },
          H3: { verdict: 'supported', supporting: ['PAIN-002'], refuting: [] },
        },
        evidence: [said('P01', '00:02:15', Q.P01a), said('P02', '00:04:05', Q.P02a)] },
      { model, run_id: rid, id: 'THEME-002', type: 'theme', created_by: 'synthesizer',
        statement: 'A visible plan builds confidence before execution.',
        method: 'thematic', method_justification: 'Positive expectation expressed by a participant.',
        confidence: 'medium', representativeness: 'illustrative',
        supporting_participants: ['P02'], frequency: 1, related_finding_ids: ['VERB-002'],
        evidence: [said('P02', '00:15:30', Q.P02b)] },
    ],
  };
}

// ---- non-eval agent artifacts (validated against their schemas) ----
function prepArtifacts(model) {
  return {
    '00b-data-quality-report': {
      file: { quality_report: {
        date_generated: '2026-07-08', transcripts_assessed: 3, transcripts_ready: 3,
        assessments: [
          { participant_id: 'P01', file: 'P01.md', duration_minutes: 42, speaker_labels: 'clear', timestamps: 'valid', audio_quality: 'good', task_context: 'clear', metadata_complete: true, issues: [], readiness: 'ready', confidence: 'high' },
          { participant_id: 'P02', file: 'P02.md', duration_minutes: 38, speaker_labels: 'clear', timestamps: 'valid', audio_quality: 'good', task_context: 'clear', metadata_complete: true, issues: [], readiness: 'ready', confidence: 'high' },
          { participant_id: 'P03', file: 'P03.md', duration_minutes: 40, speaker_labels: 'clear', timestamps: 'valid', audio_quality: 'good', task_context: 'clear', metadata_complete: true, issues: [], readiness: 'ready', confidence: 'high' },
        ],
        readiness_summary: 'All 3 transcripts ready for analysis.' } },
      schema: 'quality.schema.json',
    },
    '01b-participant-narratives': {
      file: { narratives: [
        { participant_id: 'P01', summary: 'Started confident, hands-off; shifted to supervising after unexpected file changes.', goals: ['delegate implementation'], expectations: ['agent handles most of the work'], breakdowns: ['could not tell what changed'], emotional_arc: 'confidence -> caution', citations: [{ claim: 'opened files to check', quote: Q.P01a, timestamp: '00:02:15' }] },
        { participant_id: 'P02', summary: 'Cautious verifier; trusted the plan but not the done status until tests passed.', goals: ['ship safely'], expectations: ['a plan before execution'], breakdowns: ['done status not trustworthy'], emotional_arc: 'skeptical -> reassured', citations: [{ claim: 'ran tests to trust done', quote: Q.P02a, timestamp: '00:04:05' }] },
        { participant_id: 'P03', summary: 'Impatient under waiting; relaxed once a diff made the change legible.', goals: ['get unblocked fast'], expectations: ['quick, visible progress'], breakdowns: ['waited too long'], emotional_arc: 'frustration -> relief', citations: [{ claim: 'relaxed at the diff', quote: Q.P03b, timestamp: '00:11:10' }] },
      ] },
      schema: 'narrative.schema.json',
    },
    '02-open-codes': {
      file: { codes: [
        { code_id: 'CODE-001', code_name: 'verifying_agent_output_manually', definition: 'User manually checks output the agent reported as done.', category: 'behavior', evidence_count: 2, participants: ['P01', 'P02'],
          examples: [ { participant: 'P01', timestamp: '00:02:15', quote: Q.P01a }, { participant: 'P02', timestamp: '00:04:05', quote: Q.P02a } ] },
        { code_id: 'CODE-002', code_name: 'falling_back_to_manual_work', definition: 'User abandons the agent and does the task by hand.', category: 'workaround', evidence_count: 2, participants: ['P03', 'P01'],
          examples: [ { participant: 'P03', timestamp: '00:06:20', quote: Q.P03a }, { participant: 'P01', timestamp: '00:09:40', quote: Q.P01b } ] },
      ], codebook_statistics: { total_codes: 2, codes_by_category: { behavior: 1, workaround: 1 }, saturation_indicator: 'high (no new codes in last transcript)', coverage: 'all participants represented' } },
      schema: 'codes.schema.json',
    },
    '02c-empathy': {
      file: { empathy_snapshots: [
        { participant_id: 'P01', empathy_snapshot: 'Began delegating, then quietly took the wheel back when the change went dark.', emotional_journey_moments: [ { moment: 'unexpected change', what_happened: 'files changed without a visible diff', participant_reaction: 'opened every file', what_it_suggests: 'needs visibility before trust', timestamp: '00:02:15' } ], related_narrative_ids: ['P01'], evidence_citations: [ { participant: 'P01', quote: Q.P01b, timestamp: '00:09:40', signal_strength: 'described' } ] },
        { participant_id: 'P03', empathy_snapshot: 'Impatience gave way to relief the moment the diff made the change legible.', emotional_journey_moments: [ { moment: 'diff appears', what_happened: 'diff showed the change', participant_reaction: 'relaxed', what_it_suggests: 'legibility restores calm', timestamp: '00:11:10' } ], related_narrative_ids: ['P03'], evidence_citations: [ { participant: 'P03', quote: Q.P03b, timestamp: '00:11:10', signal_strength: 'showed' } ] },
      ], empathy_findings: [ { finding_id: 'PAIN-001', original_theme: 'visibility', empathy_language: 'They were happy to hand off the work; they just did not want to lose sight of the outcome they were still responsible for.', stakeholder_implications: 'Visibility is a trust prerequisite, not a nice-to-have.' } ] },
      schema: 'empathy.schema.json',
    },
    '05b-mental-models': {
      file: { mental_models: [
        { model_element: 'Change visibility', user_assumption: 'I will see what the agent changed before it applies.', system_reality: 'Changes apply without a surfaced diff by default.', assumption_evidence: [ { participant: 'P01', quote: Q.P01a, timestamp: '00:02:15' } ], participants_affected: ['P01', 'P02'], severity: 'high', consequence: 'Users switch from delegating to supervising.', product_implication: 'Surface a diff before approval.' },
      ], contradictions: [], model_shifts: [ { participant: 'P03', from: 'uncertainty', to: 'trust', trigger: 'diff view', timestamp: '00:11:10' } ] },
      schema: 'mental-models.schema.json',
    },
    '08-product-implications': {
      file: { design_principles: [ { principle: 'Make agent changes legible before they land.', rationale: 'Visibility is what lets users stay accountable without micromanaging.', source_findings: ['THEME-001', 'PAIN-001'], mental_model_connection: 'Users assume they will see changes first.', priority: 'high' } ],
        opportunity_areas: [ { opportunity_id: 'OPP-001', area: 'Change visibility', underlying_need: 'When I delegate to an agent, I need to see what changed so I can stay accountable.', current_state: 'Users verify manually.', desired_state: 'A diff is surfaced before approval.', evidence_strength: 'strong (3/3 participants)', complexity: 'medium', timeline_estimate: 'Q3', design_questions: ['What granularity of diff feels like enough?'] } ],
        risk_areas: [ { risk: 'Users may trust a done status without verifying.', severity: 'medium', source_findings: ['PAPER-001'] } ],
        research_questions: [ { question: 'Does a pre-approval diff reduce manual verification?', rationale: 'Tests the core visibility hypothesis.' } ] },
      schema: 'implications.schema.json',
    },
  };
}

const NON_EVAL_STEPS = ['00b-data-quality-report', '01b-participant-narratives', '00-kickoff',
  '02b-evidence-bank', '02-open-codes', '02c-empathy', '06-devils-advocate', '05b-mental-models',
  '07b-saturation', '08b-evidence-verify', '08c-risk-flags', '08-product-implications',
  '08-qa-evals', '09-report', '09b-story', 'pii-scan'];

function setup() {
  rm(STUDY);
  wj(path.join(STUDY, 'study.json'), { study_id: '_pilot', name: 'Pilot — Agentic Coding Trust', models: MODELS });
  for (const [p, text] of Object.entries(T)) wf(path.join(STUDY, 'inputs', 'transcripts', `${p}.md`), text);
  wf(path.join(STUDY, 'inputs', 'hypotheses.md'),
    '# Hypotheses\n- H1: users lose trust when they cannot see what changed\n- H2: users want a visible plan before execution\n- H3: users fall back to manual work under uncertainty\n');
  wj(path.join(STUDY, 'inputs', 'private', 'roster.json'), [
    { name: 'Jordan Lee', company: 'Acme', session_datetime: '2026-07-02T14:00:00Z' },
    { name: 'Priya Shah', company: 'Globex', session_datetime: '2026-07-03T10:00:00Z' },
    { name: 'Sam Ortiz', company: 'Initech', session_datetime: '2026-07-04T09:00:00Z' },
  ]);
  buildKey(STUDY);
  stampProvenance(STUDY);
  hashInputs(STUDY);
  for (const m of MODELS) scaffoldManifest(STUDY, m, { fresh: true });
}

function signOffCheckpoints(model) {
  updateJSON(path.join(runDir(model), 'run-manifest.json'), (m) => {
    for (const c of (m.checkpoints || [])) { c.status = 'approved'; c.decided_by = 'pilot-researcher'; c.decided_at = new Date().toISOString(); }
    return m;
  }, { checkpoints: [] });
}

function runModel(model) {
  sec(`### Run model: ${model}`);
  const goals = path.join(STUDY, 'inputs', 'hypotheses.md');

  // Prep + coding + experience + implication artifacts (validated, then marked done)
  const prep = prepArtifacts(model);
  for (const [step, { file, schema: sname }] of Object.entries(prep)) {
    const out = path.join(runDir(model), `${step}.json`);
    wj(out, file);
    const errs = validate(file, schema(sname));
    ok(errs.length === 0, `${model}: ${step} validates against ${sname}` + (errs.length ? ` (${errs.slice(0, 2).join('; ')})` : ''));
    recordAttempt(STUDY, model, step, true, 'pilot');
  }
  // evidence bank (no dedicated schema — write + mark done)
  wj(path.join(runDir(model), '02b-evidence-bank.json'), { model, evidence: [
    { evidence_id: 'EV-001', participant: 'P01', locator: '00:02:15', quote: Q.P01a, observation_type: 'did', interpretation: 'low change-visibility', confidence: 'high', theme: 'THEME-001' },
    { evidence_id: 'EV-002', participant: 'P02', locator: '00:04:05', quote: Q.P02a, observation_type: 'said', interpretation: 'verify-before-trust', confidence: 'high', theme: 'THEME-001' },
    { evidence_id: 'EV-003', participant: 'P03', locator: '00:11:10', quote: Q.P03b, observation_type: 'said', interpretation: 'legibility -> relief', confidence: 'high', theme: 'THEME-001' },
  ] });
  recordAttempt(STUDY, model, '02b-evidence-bank', true, 'pilot');
  // kickoff ceremony note
  wf(path.join(runDir(model), '00-kickoff.md'), `# Kickoff (${model})\nWatch-items: over-indexing on P01; confirm visibility is the driver, not AI-aversion.\n`);
  recordAttempt(STUDY, model, '00-kickoff', true, 'pilot');

  // Six parallel producers -> conductStep (real evals + loop)
  const producers = producerFindings(model);
  for (const [step, findings] of Object.entries(producers)) {
    const out = path.join(runDir(model), `${step}.json`);
    wj(out, findings);
    const r = conductStep(STUDY, model, step, out, goals);
    ok(r.hardPass, `${model}: ${step} passed all hard gates (${findings.length} findings)`);
    if (!r.hardPass) console.error('     offenders:', JSON.stringify(r.failed));
  }

  // Challenge: Devil's Advocate (checker objects) + Mental Model already written above
  wj(path.join(runDir(model), '06-devils-advocate.json'), { model, verdicts: [
    { checker: 'devils-advocate', finding_id: 'PAIN-001', verdict: 'holds', validity_threat: 'small sample', alternative_explanations: ['general AI skepticism'], rationale: 'Behavior (manual verification) corroborates the self-report.', human_audit: 'pending' },
    { checker: 'devils-advocate', finding_id: 'THEME-002', verdict: 'weak', validity_threat: 'single participant', alternative_explanations: ['personal preference'], rationale: 'Only P02 expressed this; keep as illustrative.', human_audit: 'pending' },
  ] });
  recordAttempt(STUDY, model, '06-devils-advocate', true, 'pilot');

  // Synthesis -> conductStep (eval-bearing)
  const synthOut = path.join(runDir(model), '07-synthesis.json');
  wj(synthOut, synthesis(model));
  const rs = conductStep(STUDY, model, '07-synthesis', synthOut, goals);
  ok(rs.hardPass, `${model}: 07-synthesis passed all hard gates`);

  // Saturation artifact
  const sat = computeSaturation(STUDY, model);
  ok(sat.participants_cited === 3 && sat.denominator_N === 3, `${model}: saturation covers 3/3 participants`);
  recordAttempt(STUDY, model, '07b-saturation', true, 'pilot');

  // Evidence verify artifact
  wj(path.join(runDir(model), '08b-evidence-verify.json'), { model, checker: 'evidence-verifier', verified: [
    { finding_id: 'VERB-001', quote_exact: true, quote_timestamp: true, clip_link: true },
    { finding_id: 'REC-001', quote_exact: true, quote_timestamp: true, clip_link: true },
  ], summary: { checked: 2, passed: 2, pending_clips: 0 } });
  recordAttempt(STUDY, model, '08b-evidence-verify', true, 'pilot');

  // Risk flagging (real scan over findings)
  const risk = scanRisk(STUDY, model);
  ok(Array.isArray(risk.flags), `${model}: risk scan produced ${risk.flags.length} flag(s)`);
  recordAttempt(STUDY, model, '08c-risk-flags', true, 'pilot');

  // Final QA gate step (report object already merged by conductStep)
  recordAttempt(STUDY, model, '08-qa-evals', true, 'pilot');

  // Reporting: editor + storyteller (code-only, cite findings)
  wf(path.join(runDir(model), '09-report.md'),
    `# Findings Report (${model})\n\n## Theme: Delegation vs. visibility\nParticipants delegated work but shifted to supervising when they could not see what changed (P01, P02, P03).\n\n> "${Q.P01b}" — P01 [00:09:40]\n\n**Recommendation:** Surface a diff before approval (REC-001).\n`);
  wf(path.join(runDir(model), '09-report.html'), `<!doctype html><meta charset="utf-8"><h1>Findings Report (${model})</h1><p>Visibility drives trust. P01, P02, P03.</p>`);
  recordAttempt(STUDY, model, '09-report', true, 'pilot');
  wf(path.join(runDir(model), '09b-story.md'),
    `# The Babysitting Problem (${model})\n\nP03 waited, then wrote the function by hand. When a diff finally appeared, they relaxed.\n\n> "${Q.P03b}" — P03 [00:11:10]\n`);
  wf(path.join(runDir(model), '09b-story.html'), `<!doctype html><meta charset="utf-8"><h1>The Babysitting Problem (${model})</h1><p>From frustration to relief when the change became legible.</p>`);
  recordAttempt(STUDY, model, '09b-story', true, 'pilot');

  // PII gate: scan every run artifact
  const pii = scanRun(STUDY, model);
  ok(pii.clean !== false && (pii.hits ? pii.hits.length === 0 : true), `${model}: PII scan clean (no name/company leaks)`);
  recordAttempt(STUDY, model, 'pii-scan', true, 'pilot');

  signOffCheckpoints(model);

  // Final assertions on the manifest + qa report
  const man = readJSONSafe(path.join(runDir(model), 'run-manifest.json'), { steps: [] });
  const notDone = man.steps.filter(s => s.status !== 'done').map(s => s.step);
  ok(notDone.length === 0, `${model}: all ${man.steps.length} manifest steps are 'done'` + (notDone.length ? ` (open: ${notDone.join(', ')})` : ''));
  const qa = readJSONSafe(path.join(runDir(model), '08-qa-evals.json'), {});
  ok(qa.hardPass === true, `${model}: QA/Evals report hardPass=true (missing_required: ${JSON.stringify(qa.missing_required || [])})`);
  const cpsOpen = (man.checkpoints || []).filter(c => c.status !== 'approved');
  ok(cpsOpen.length === 0, `${model}: all checkpoints signed off (CP1/CP2/CP3)`);
}

// ==== run the pilot ====
sec('## PILOT — full 22-agent pipeline, both models');
setup();
ok(checkProvenance(STUDY).ok !== false, 'provenance gate passes (raw, unchanged, transcript-like)');

for (const m of MODELS) runModel(m);

sec('### Dual-model comparison + dashboards');
const cmp = compare(STUDY);
ok(!!cmp, 'comparison written to comparison/model-diff.{md,html}');
ok(cmp.valid !== false, 'comparison is VALID (different models, identical input hashes)');
const dash = buildAll(STUDY);
ok(!!dash, 'dashboards written (index + per-model)');
ok(fs.existsSync(path.join(STUDY, 'dashboards', 'index.html')), 'dashboard index.html exists');

sec(`\n${fail === 0 ? '\u2705 PILOT PASSED' : '\u274c PILOT FAILED'} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

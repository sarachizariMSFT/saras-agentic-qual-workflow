// run.mjs — study lifecycle helpers. Zero deps.
// Commands:
//   node lib/run.mjs init <study-id> "<Study Name>"   -> scaffold studies/<id> from _TEMPLATE
//   node lib/run.mjs hash <studyRoot>                 -> write inputs/intake-manifest.json (sha256 of inputs)
//   node lib/run.mjs manifest <studyRoot> <model>     -> scaffold runs/<model>/run-manifest.json

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readJSONSafe, writeJSONAtomic } from './fsx.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');          // repo root
const STUDIES = path.join(ROOT, 'studies');
const TEMPLATE = path.join(STUDIES, '_TEMPLATE');
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const MAX_LOOP = CONFIG.loop.maxIterations;
const MODELS = CONFIG.models;
const RUN = CONFIG.run || {};
const PIPELINE_VERSION = CONFIG.pipeline_version || '0.4.0';
const FAST_DEFAULT = RUN.fastModeDefault === true;
const FAST_MAX_PARALLEL = Math.max(1, Number(RUN.fastMaxParallel) || 4);
// Single-model by default: run only the primary model unless dual-model comparison is switched on
// (config.run.dualModel or the Conductor's --dual flag). The skipped second pass was routinely
// unwanted and showed up as a confusing, half-finished phase.
const ACTIVE_MODELS = RUN.dualModel ? MODELS : [RUN.primaryModel || MODELS[0]];

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) copyRecursive(path.join(src, entry), path.join(dst, entry));
  } else {
    fs.copyFileSync(src, dst);
  }
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

export function initStudy(studyId, name) {
  const dst = path.join(STUDIES, studyId);
  if (fs.existsSync(dst)) { console.error(`Study '${studyId}' already exists.`); process.exit(1); }
  copyRecursive(TEMPLATE, dst);
  fs.writeFileSync(path.join(dst, 'study.json'), JSON.stringify({
    study_id: studyId, name: name || studyId, created_at: new Date().toISOString(),
    models: ACTIVE_MODELS, primary_model: RUN.primaryModel || MODELS[0], dual_model: !!RUN.dualModel,
    fast_mode_default: FAST_DEFAULT, fast_max_parallel: FAST_MAX_PARALLEL,
  }, null, 2));
  console.log(`✓ Created studies/${studyId} from _TEMPLATE` +
    ` — ${RUN.dualModel ? `dual-model (${ACTIVE_MODELS.join(', ')})` : `single-model (${ACTIVE_MODELS[0]})`}`);
  return dst;
}

export function hashInputs(studyRoot) {
  const inputsDir = path.join(studyRoot, 'inputs');
  const files = walkFiles(inputsDir).filter(f => path.basename(f) !== 'intake-manifest.json');
  const inputs = {};
  for (const f of files) inputs[path.relative(studyRoot, f).replace(/\\/g, '/')] = sha256(f);
  const manifest = { study_id: path.basename(studyRoot), hashed_at: new Date().toISOString(), inputs };
  fs.writeFileSync(path.join(inputsDir, 'intake-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`✓ Hashed ${files.length} input files -> inputs/intake-manifest.json`);
  return manifest;
}

export function scaffoldManifest(studyRoot, model, { fresh = false } = {}) {
  const intake = path.join(studyRoot, 'inputs', 'intake-manifest.json');
  const inputs = fs.existsSync(intake) ? JSON.parse(fs.readFileSync(intake, 'utf8')).inputs : {};
  // The manifest schedules every pipeline agent in phase order. Step names double as output
  // filenames (`runs/<model>/<step>.json`), so they must match what each agent/lib actually writes.
  // Eval-bearing steps (see EVAL_REQUIRED_STEPS in evals.mjs) keep their exact historical names;
  // prep/coding/experience/implication steps are non-eval producers that advance like 00-kickoff.
  const stepDefs = [
    // Phase 1 — data readiness (pre-analysis), part of CP1
    { step: '00b-data-quality-report', agent: 'data-integrity', phase: 'phase-1' },
    { step: '01b-participant-narratives', agent: 'participant-narrative', phase: 'phase-1', depends_on: ['00b-data-quality-report'] },
    // Phase 1c — kickoff ceremony
    { step: '00-kickoff', agent: 'conductor', phase: 'phase-1c', depends_on: ['01b-participant-narratives'] },
    // Phase 2a/2b — evidence bank + open coding (run in parallel)
    { step: '02b-evidence-bank', agent: 'evidence-extraction', phase: 'phase-2a', depends_on: ['00-kickoff'], parallel_group: 'phase-2a' },
    { step: '02-open-codes', agent: 'open-coding', phase: 'phase-2a', depends_on: ['00-kickoff'], parallel_group: 'phase-2a' },
    // Phase 2c — empathy building (after the evidence bank)
    { step: '02c-empathy', agent: 'empathy-builder', phase: 'phase-2c', depends_on: ['02b-evidence-bank', '02-open-codes'] },
    // Phase 3 — six parallel analysis producers (eval-bearing)
    { step: '01-observed-behavior', agent: 'observed-behavior', phase: 'phase-3', depends_on: ['02c-empathy'], parallel_group: 'phase3-producers' },
    { step: '02-verbatim', agent: 'verbatim', phase: 'phase-3', depends_on: ['02c-empathy'], parallel_group: 'phase3-producers' },
    { step: '03-pain-points', agent: 'pain-points', phase: 'phase-3', depends_on: ['02c-empathy'], parallel_group: 'phase3-producers' },
    { step: '04-papercuts', agent: 'papercuts', phase: 'phase-3', depends_on: ['02c-empathy'], parallel_group: 'phase3-producers' },
    { step: '05-design-recommendations', agent: 'design-recommendations', phase: 'phase-3', depends_on: ['02c-empathy'], parallel_group: 'phase3-producers' },
    { step: '06b-powerful-moments', agent: 'powerful-moments', phase: 'phase-3', depends_on: ['02c-empathy'], parallel_group: 'phase3-producers' },
    // Phase 4 — challenge (Devil's Advocate + Mental Model)
    { step: '06-devils-advocate', agent: 'devils-advocate', phase: 'phase-4', depends_on: ['01-observed-behavior', '02-verbatim', '03-pain-points', '04-papercuts', '05-design-recommendations', '06b-powerful-moments'] },
    { step: '05b-mental-models', agent: 'mental-model', phase: 'phase-4', depends_on: ['06-devils-advocate'] },
    // Phase 5 — synthesis + saturation
    { step: '07-synthesis', agent: 'synthesizer', phase: 'phase-5', depends_on: ['05b-mental-models'] },
    { step: '07b-saturation', agent: 'qa-evals', phase: 'phase-5', depends_on: ['07-synthesis'] },
    // Phase 5b/5c/5d — verification, risk flagging, product implications
    { step: '08b-evidence-verify', agent: 'evidence-verifier', phase: 'phase-5b', depends_on: ['07b-saturation'] },
    { step: '08c-risk-flags', agent: 'risk-flagger', phase: 'phase-5c', depends_on: ['08b-evidence-verify'] },
    { step: '08-product-implications', agent: 'product-implication', phase: 'phase-5d', depends_on: ['08c-risk-flags'] },
    // Phase 6 — final QA gate + reporting (Editor ∥ Storyteller) + privacy sweep
    { step: '08-qa-evals', agent: 'qa-evals', phase: 'phase-6', depends_on: ['08-product-implications'] },
    { step: '09-report', agent: 'editor', phase: 'phase-6', depends_on: ['08-qa-evals'], parallel_group: 'phase-6-reporting' },
    { step: '09b-story', agent: 'storyteller', phase: 'phase-6', depends_on: ['08-qa-evals'], parallel_group: 'phase-6-reporting' },
    { step: 'pii-scan', agent: 'privacy', phase: 'phase-6', depends_on: ['09-report', '09b-story'] },
  ];

  // Preserve human-owned state on re-scaffold: checkpoint sign-offs and per-step human overrides
  // must NOT be wiped just because we regenerated the run plan. Pass { fresh:true } to reset everything.
  const prior = fresh ? null : readJSONSafe(path.join(studyRoot, 'runs', model, 'run-manifest.json'));
  const priorStepByName = new Map((prior?.steps || []).map(s => [s.step, s]));

  const steps = stepDefs.map(def => {
    const { step, agent, ...meta } = def;
    const base = { step, agent, status: 'pending', output: `runs/${model}/${step}.json`, attempts: 0, max_attempts: MAX_LOOP, ...meta };
    const p = priorStepByName.get(step);
    if (p?.unblocked_by_human) base.unblocked_by_human = p.unblocked_by_human; // keep audit trail
    return base;
  });

  const defaultCheckpoints = [
    { id: 'CP1-intake', kind: 'human', status: 'pending' },
    { id: 'CP2-synthesis', kind: 'human', status: 'pending' },
    { id: 'CP3-signoff', kind: 'human', status: 'pending' },
  ];
  // carry over prior checkpoint decisions by id
  const priorCp = new Map((prior?.checkpoints || []).map(c => [c.id, c]));
  const checkpoints = defaultCheckpoints.map(c => priorCp.get(c.id) ? { ...c, ...priorCp.get(c.id) } : c);

  const manifest = {
    run_id: prior?.run_id || `${path.basename(studyRoot)}-${model}-${Date.now()}`,
    study_id: path.basename(studyRoot),
    model,
    pipeline_version: PIPELINE_VERSION,
    created_at: prior?.created_at || new Date().toISOString(),
    rescaffolded_at: prior ? new Date().toISOString() : undefined,
    inputs,
    execution: {
      mode: FAST_DEFAULT ? 'fast' : 'normal',
      fast: { enabled: FAST_DEFAULT, max_parallel: FAST_MAX_PARALLEL, strategy: 'dependency-aware-pool', scope: 'phase3-producers' },
    },
    steps,
    checkpoints,
  };
  writeJSONAtomic(path.join(studyRoot, 'runs', model, 'run-manifest.json'), manifest);
  console.log(`✓ Scaffolded runs/${model}/run-manifest.json${prior ? ' (preserved checkpoint decisions)' : ''}`);
  return manifest;
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'init') initStudy(a, b);
  else if (cmd === 'hash') hashInputs(path.resolve(a));
  else if (cmd === 'manifest') scaffoldManifest(path.resolve(a), b, { fresh: process.argv.includes('--fresh') });
  else { console.error('Commands: init <id> "<name>" | hash <studyRoot> | manifest <studyRoot> <model>'); process.exit(2); }
}

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
    study_id: studyId, name: name || studyId, created_at: new Date().toISOString(), models: MODELS,
  }, null, 2));
  console.log(`✓ Created studies/${studyId} from _TEMPLATE`);
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
    ['00b-data-quality-report', 'data-integrity'],
    ['01b-participant-narratives', 'participant-narrative'],
    // Phase 1c — kickoff ceremony
    ['00-kickoff', 'conductor'],
    // Phase 2a/2b — evidence bank + open coding (run in parallel)
    ['02b-evidence-bank', 'evidence-extraction'],
    ['02-open-codes', 'open-coding'],
    // Phase 2c — empathy building (after the evidence bank)
    ['02c-empathy', 'empathy-builder'],
    // Phase 3 — six parallel analysis producers (eval-bearing)
    ['01-observed-behavior', 'observed-behavior'],
    ['02-verbatim', 'verbatim'],
    ['03-pain-points', 'pain-points'],
    ['04-papercuts', 'papercuts'],
    ['05-design-recommendations', 'design-recommendations'],
    ['06b-powerful-moments', 'powerful-moments'],
    // Phase 4 — challenge (Devil's Advocate + Mental Model)
    ['06-devils-advocate', 'devils-advocate'],
    ['05b-mental-models', 'mental-model'],
    // Phase 5 — synthesis + saturation
    ['07-synthesis', 'synthesizer'],
    ['07b-saturation', 'qa-evals'],
    // Phase 5b/5c/5d — verification, risk flagging, product implications
    ['08b-evidence-verify', 'evidence-verifier'],
    ['08c-risk-flags', 'risk-flagger'],
    ['08-product-implications', 'product-implication'],
    // Phase 6 — final QA gate + reporting (Editor ∥ Storyteller) + privacy sweep
    ['08-qa-evals', 'qa-evals'],
    ['09-report', 'editor'],
    ['09b-story', 'storyteller'],
    ['pii-scan', 'privacy'],
  ];

  // Preserve human-owned state on re-scaffold: checkpoint sign-offs and per-step human overrides
  // must NOT be wiped just because we regenerated the run plan. Pass { fresh:true } to reset everything.
  const prior = fresh ? null : readJSONSafe(path.join(studyRoot, 'runs', model, 'run-manifest.json'));
  const priorStepByName = new Map((prior?.steps || []).map(s => [s.step, s]));

  const steps = stepDefs.map(([step, agent]) => {
    const base = { step, agent, status: 'pending', output: `runs/${model}/${step}.json`, attempts: 0, max_attempts: MAX_LOOP };
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
    pipeline_version: '0.3.0',
    created_at: prior?.created_at || new Date().toISOString(),
    rescaffolded_at: prior ? new Date().toISOString() : undefined,
    inputs,
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

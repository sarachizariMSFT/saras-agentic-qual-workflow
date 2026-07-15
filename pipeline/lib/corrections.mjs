// corrections.mjs — the learning loop's ledger. Zero deps.
// Turns a human correction into a durable record under studies/<id>/corrections/, so the Retrospective
// (pipeline/loop.md) can apply each one as a small permanent fix to an agent/skill/eval/schema/config
// and log it to the CHANGELOG + the agent's history. Without this, the same voice/roster/over-read
// mistakes recur every study — which is exactly what happened before this run's debrief.
//
// CLI:
//   node lib/corrections.mjs add   <studyRoot> --target <t> --root <rc> --problem "…" --correction "…" --change "…" [--target-id …] [--model …] [--turn N]
//   node lib/corrections.mjs list  <studyRoot> [open|applied|all]
//   node lib/corrections.mjs apply <studyRoot> <COR-id> ["CHANGELOG ref"]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './validate.mjs';
import { readJSONSafe, writeJSONAtomic } from './fsx.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schemas', 'correction.schema.json'), 'utf8'));

const dir = studyRoot => path.join(studyRoot, 'corrections');
const slugify = s => String(s || 'correction').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').split('-').slice(0, 6).join('-') || 'correction';

function allRecords(studyRoot) {
  const d = dir(studyRoot);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => ({ file: path.join(d, f), rec: readJSONSafe(path.join(d, f)) })).filter(x => x.rec);
}

function nextId(studyRoot) {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const todays = allRecords(studyRoot).filter(x => (x.rec.id || '').startsWith(`COR-${day}`)).length;
  return `COR-${day}-${String(todays + 1).padStart(2, '0')}`;
}

// Write one correction record. `fields` maps to the schema; status defaults to 'open'.
export function recordCorrection(studyRoot, fields) {
  const rec = {
    id: fields.id || nextId(studyRoot),
    study_id: fields.study_id || path.basename(studyRoot),
    run_model: fields.run_model || 'n/a',
    target: fields.target,
    ...(fields.target_id ? { target_id: fields.target_id } : {}),
    problem: fields.problem,
    root_cause: fields.root_cause,
    correction: fields.correction,
    change: fields.change,
    status: fields.status || 'open',
    created_at: fields.created_at || new Date().toISOString(),
    ...(fields.source_turn != null ? { source_turn: fields.source_turn } : {}),
    ...(fields.changelog_ref ? { changelog_ref: fields.changelog_ref } : {}),
  };
  const errs = validate(rec, SCHEMA, rec.id);
  if (errs.length) throw new Error(`Invalid correction record:\n  ${errs.join('\n  ')}`);
  const file = path.join(dir(studyRoot), `${rec.created_at.replace(/[:.]/g, '-')}-${slugify(rec.problem)}.json`);
  writeJSONAtomic(file, rec);
  return { file, rec };
}

export const listCorrections = (studyRoot, status = 'all') =>
  allRecords(studyRoot).map(x => x.rec).filter(r => status === 'all' || r.status === status)
    .sort((a, b) => (a.id || '').localeCompare(b.id || ''));

export const openCorrections = studyRoot => listCorrections(studyRoot, 'open');

// Mark a record applied once the durable fix has landed + been logged to the CHANGELOG.
export function markApplied(studyRoot, id, changelogRef = null) {
  const hit = allRecords(studyRoot).find(x => x.rec.id === id);
  if (!hit) throw new Error(`No correction '${id}' in ${dir(studyRoot)}`);
  hit.rec.status = 'applied';
  hit.rec.applied_at = new Date().toISOString();
  if (changelogRef) hit.rec.changelog_ref = changelogRef;
  writeJSONAtomic(hit.file, hit.rec);
  return hit.rec;
}

// CLI
function parseFlags(args) {
  const out = {}; for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) { out[args[i].slice(2)] = args[i + 1]; i++; }
  } return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, sr, ...rest] = process.argv.slice(2);
  const studyRoot = sr && path.resolve(sr);
  if (cmd === 'add' && studyRoot) {
    const f = parseFlags(rest);
    const { rec } = recordCorrection(studyRoot, {
      target: f.target, target_id: f['target-id'], root_cause: f.root, run_model: f.model,
      problem: f.problem, correction: f.correction, change: f.change,
      source_turn: f.turn != null ? Number(f.turn) : undefined,
    });
    console.log(`✓ ${rec.id} (${rec.status}) target=${rec.target}${rec.target_id ? '/' + rec.target_id : ''} root=${rec.root_cause}`);
  } else if (cmd === 'list' && studyRoot) {
    const rows = listCorrections(studyRoot, rest[0] || 'all');
    if (!rows.length) console.log('(no corrections)');
    for (const r of rows) console.log(`${r.status === 'open' ? '○' : '●'} ${r.id} [${r.status}] ${r.target}${r.target_id ? '/' + r.target_id : ''}: ${r.problem}`);
  } else if (cmd === 'apply' && studyRoot && rest[0]) {
    const r = markApplied(studyRoot, rest[0], rest[1]);
    console.log(`✓ ${r.id} applied${r.changelog_ref ? ' (' + r.changelog_ref + ')' : ''}`);
  } else {
    console.error('Usage: node lib/corrections.mjs add <studyRoot> --target <t> --root <rc> --problem "…" --correction "…" --change "…" [--target-id …] [--model …] [--turn N] | list <studyRoot> [open|applied|all] | apply <studyRoot> <COR-id> ["ref"]');
    process.exit(2);
  }
}

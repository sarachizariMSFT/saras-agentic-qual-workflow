// loop.mjs — the circuit breaker. Enforces the max-iteration cap (default 10) on every revision loop.
// The Conductor calls recordAttempt() after each eval of a step. When a loop exhausts its budget,
// the step is marked 'blocked' and the run stops at the nearest human checkpoint.
//
// Usage (CLI): node lib/loop.mjs attempt <studyRoot> <model> <step> <pass|fail> ["reason"]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendJournal } from './journal.mjs';
import { updateJSON, readJSONSafe } from './fsx.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
export const MAX_LOOP = CONFIG.loop.maxIterations;

function manifestPath(studyRoot, model) {
  return path.join(studyRoot, 'runs', model, 'run-manifest.json');
}

export function recordAttempt(studyRoot, model, step, passed, reason = '') {
  const mp = manifestPath(studyRoot, model);
  let result;
  updateJSON(mp, (m) => {
    const s = m.steps.find(x => x.step === step);
    if (!s) throw new Error(`No step '${step}' in manifest`);
    if (s.max_attempts == null) s.max_attempts = MAX_LOOP;
    s.attempts = (s.attempts || 0) + 1;
    s.last_reason = reason;

    let action;
    if (passed) {
      s.status = 'done';
      s.attempts = 0; // reset budget on success so a later revision gets a fresh 10
      action = 'advance';
    } else if (s.attempts >= s.max_attempts) {
      s.status = 'blocked';
      s.blocked_reason = `Loop exhausted after ${s.attempts}/${s.max_attempts} attempts. ${reason}`;
      action = CONFIG.loop.onExhaustion; // 'escalate_to_human'
    } else { s.status = 'running'; action = 'revise'; }

    result = { step, attempts: s.attempts, max: s.max_attempts, status: s.status, action };
    return m;
  }, { steps: [] });
  appendJournal(studyRoot, model, step, `attempt → ${result.status} (${result.action})${reason ? ' — ' + reason : ''}`);
  return result;
}

// Recover a blocked step: reset its attempt budget and reopen it, with a mandatory
// human note recorded to the journal. Without this the only way past a loop-capped
// step was hand-editing the manifest.
export function unblock(studyRoot, model, step, note = '') {
  if (!note) throw new Error('unblock requires a human note explaining the override.');
  const mp = manifestPath(studyRoot, model);
  let result;
  updateJSON(mp, (m) => {
    const s = m.steps.find(x => x.step === step);
    if (!s) throw new Error(`No step '${step}' in manifest`);
    s.attempts = 0;
    s.status = 'pending';
    s.blocked_reason = null;
    s.unblocked_by_human = { at: new Date().toISOString(), note };
    result = { step, status: s.status, attempts: s.attempts };
    return m;
  }, { steps: [] });
  appendJournal(studyRoot, model, step, `UNBLOCKED by human — ${note}`);
  return result;
}

export function loopState(studyRoot, model) {
  const m = readJSONSafe(manifestPath(studyRoot, model), { steps: [] });
  return (m.steps || []).map(s => ({ step: s.step, attempts: s.attempts || 0, max: s.max_attempts || MAX_LOOP, status: s.status }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, studyRoot, model, step, verdict, reason] = process.argv.slice(2);
  if (cmd === 'attempt') {
    const r = recordAttempt(path.resolve(studyRoot), model, step, verdict === 'pass', reason || '');
    console.log(`loop[${r.step}] attempt ${r.attempts}/${r.max} -> status=${r.status}, action=${r.action}`);
    if (r.action === 'escalate_to_human') { console.error('⛔ Loop cap reached. Escalating to human.'); process.exit(3); }
  } else if (cmd === 'unblock') {
    // node lib/loop.mjs unblock <studyRoot> <model> <step> "<note>"
    const r = unblock(path.resolve(studyRoot), model, step, verdict || '');
    console.log(`✓ ${r.step} unblocked -> status=${r.status} (attempts reset)`);
  } else if (cmd === 'state') {
    console.table(loopState(path.resolve(studyRoot), model));
  } else {
    console.error('Usage: node lib/loop.mjs attempt <studyRoot> <model> <step> <pass|fail> ["reason"] | unblock <studyRoot> <model> <step> "<note>" | state <studyRoot> <model>');
    process.exit(2);
  }
}

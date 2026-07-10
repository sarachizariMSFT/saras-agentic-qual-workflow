// conduct.mjs — the enforcement driver. Zero deps.
// The loop cap, gates, and "don't mark done unless it passed" were previously CONVENTIONS an agent
// could skip by writing a step file and setting status:'done' itself. This driver makes them real:
// a step can only advance to 'done' by going through runEvals -> mergeIntoReport -> recordAttempt with
// the ACTUAL hard-gate verdict. Agents are instructed to close every step via this command.
//
// CLI: node lib/conduct.mjs step <studyRoot> <model> <step> <stepFile.json> [--goals <file>]

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runEvals, mergeIntoReport } from './evals.mjs';
import { recordAttempt } from './loop.mjs';
import { appendJournal } from './journal.mjs';

// Run evals for a step and record the attempt with the real verdict. Returns the loop action.
// The status becomes 'done' ONLY when result.hardPass is true — the agent cannot self-certify.
export function conductStep(studyRoot, model, step, stepFile, goalsFile) {
  const result = runEvals(studyRoot, model, stepFile, goalsFile);
  mergeIntoReport(studyRoot, model, result);
  const failed = Object.entries(result.evals)
    .filter(([, v]) => v.gate === 'hard' && !v.pass).map(([k]) => k);
  const reason = result.hardPass ? '' : `hard gates failed: ${failed.join(', ')}`;
  const rec = recordAttempt(studyRoot, model, step, result.hardPass, reason);
  appendJournal(studyRoot, model, step,
    `conduct: hardPass=${result.hardPass} → ${rec.status}` + (result.softFlags.length ? ` (soft: ${result.softFlags.join(',')})` : ''));
  return { hardPass: result.hardPass, failed, softFlags: result.softFlags, action: rec.action, status: rec.status, attempts: rec.attempts };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const [cmd, studyRoot, model, step, stepFile] = args;
  const goalsIdx = args.indexOf('--goals');
  const goalsFile = goalsIdx > -1 ? args[goalsIdx + 1] : path.join(studyRoot || '', 'inputs', 'hypotheses.md');
  if (cmd === 'step' && studyRoot && model && step && stepFile) {
    if (!fs.existsSync(stepFile)) { console.error(`Step file not found: ${stepFile}`); process.exit(2); }
    const r = conductStep(path.resolve(studyRoot), model, step, stepFile, goalsFile);
    console.log(`conduct[${step}] hardPass=${r.hardPass} status=${r.status} action=${r.action} attempts=${r.attempts}`);
    if (r.failed.length) console.error(`  FAILED hard gates: ${r.failed.join(', ')}`);
    if (r.softFlags.length) console.log(`  soft flags: ${r.softFlags.join(', ')}`);
    if (r.action === 'escalate_to_human') { console.error('⛔ Loop cap reached. Escalating to human.'); process.exit(3); }
    process.exit(r.hardPass ? 0 : 1);
  } else {
    console.error('Usage: node lib/conduct.mjs step <studyRoot> <model> <step> <stepFile.json> [--goals <file>]');
    process.exit(2);
  }
}

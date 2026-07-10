// journal.mjs — append-only run journal. Zero deps.
// Keeps a compact, chronological record of every step attempt / gate result / human action so progress
// is persisted continuously and agents (or a human) can catch up from a few lines instead of re-reading
// every artifact. This is the pipeline's main defense against context bloat: state lives in files, not in
// an ever-growing conversation.
//
// CLI: node lib/journal.mjs note <studyRoot> <model> "<message>"
//      node lib/journal.mjs show <studyRoot> <model> [n]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function journalPath(studyRoot, model) {
  return path.join(studyRoot, 'runs', model, 'journal.md');
}

// Append one compact line: `- 2026-07-08T00:39:05Z · <step> · <event> · <detail>`
export function appendJournal(studyRoot, model, event, detail = '') {
  const jp = journalPath(studyRoot, model);
  fs.mkdirSync(path.dirname(jp), { recursive: true });
  if (!fs.existsSync(jp)) {
    fs.writeFileSync(jp, `# Run Journal — ${model}\n\nOne line per event. Newest at the bottom. Compact by design.\n\n`);
  }
  const ts = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  fs.appendFileSync(jp, `- ${ts} · ${event}${detail ? ' · ' + detail : ''}\n`);
  return jp;
}

// Return the last n journal lines (default 20) — a cheap way to reload state without the full history.
export function tailJournal(studyRoot, model, n = 20) {
  const jp = journalPath(studyRoot, model);
  if (!fs.existsSync(jp)) return [];
  const lines = fs.readFileSync(jp, 'utf8').split('\n').filter(l => l.startsWith('- '));
  return lines.slice(-n);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, studyRoot, model, arg] = process.argv.slice(2);
  if (cmd === 'note' && studyRoot && model && arg) {
    console.log('✓ ' + appendJournal(path.resolve(studyRoot), model, 'note', arg));
  } else if (cmd === 'show' && studyRoot && model) {
    for (const l of tailJournal(path.resolve(studyRoot), model, Number(arg) || 20)) console.log(l);
  } else {
    console.error('Usage: node lib/journal.mjs note <studyRoot> <model> "<msg>" | show <studyRoot> <model> [n]');
    process.exit(2);
  }
}

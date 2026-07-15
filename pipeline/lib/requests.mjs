// requests.mjs — researcher-request tracker. Zero deps.
// Mid-run, the researcher floats questions ("what about settings defaults?", "does voice add value
// vs plain dictation?"). Those are easy to lose between phases. This logs each as a first-class OPEN
// item; CP3 sign-off cannot close while any request is still open, so nothing the researcher asked
// for silently drops out of the report.
//
// File: studies/<id>/researcher-requests.json  (array of records)
// CLI:
//   node lib/requests.mjs add     <studyRoot> "<request text>" [--turn N]
//   node lib/requests.mjs resolve <studyRoot> <REQ-id> "<how/where it was addressed>"
//   node lib/requests.mjs list    <studyRoot> [open|addressed|all]
//   node lib/requests.mjs gate    <studyRoot>            exit 1 if any request is still open

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJSONSafe, writeJSONAtomic } from './fsx.mjs';

const file = studyRoot => path.join(studyRoot, 'researcher-requests.json');
const load = studyRoot => readJSONSafe(file(studyRoot), []);
const save = (studyRoot, arr) => writeJSONAtomic(file(studyRoot), arr);
const nextId = arr => `REQ-${String(arr.length + 1).padStart(3, '0')}`;

export function addRequest(studyRoot, request, { turn = null } = {}) {
  const arr = load(studyRoot);
  const rec = { id: nextId(arr), asked_at: new Date().toISOString(), turn, request, status: 'open', resolution: null, where: null };
  arr.push(rec);
  save(studyRoot, arr);
  return rec;
}

export function resolveRequest(studyRoot, id, resolution, where = null) {
  const arr = load(studyRoot);
  const rec = arr.find(r => r.id === id);
  if (!rec) throw new Error(`No request '${id}' in ${file(studyRoot)}`);
  rec.status = 'addressed';
  rec.resolution = resolution || '';
  rec.where = where;
  rec.resolved_at = new Date().toISOString();
  save(studyRoot, arr);
  return rec;
}

export const listRequests = (studyRoot, status = 'all') =>
  load(studyRoot).filter(r => status === 'all' || r.status === status);

export const openRequests = studyRoot => listRequests(studyRoot, 'open');

// CP3 gate: sign-off is blocked while any researcher request is still open.
export function requestsGate(studyRoot) {
  const open = openRequests(studyRoot);
  return { pass: open.length === 0, open };
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, sr, ...rest] = process.argv.slice(2);
  const studyRoot = sr && path.resolve(sr);
  if (cmd === 'add' && studyRoot && rest[0]) {
    const turnIdx = rest.indexOf('--turn');
    const turn = turnIdx > -1 ? Number(rest[turnIdx + 1]) : null;
    const text = rest.filter((_, i) => i !== turnIdx && i !== turnIdx + 1).join(' ');
    const rec = addRequest(studyRoot, text, { turn });
    console.log(`✓ Logged ${rec.id} (open): ${rec.request}`);
  } else if (cmd === 'resolve' && studyRoot && rest[0]) {
    const rec = resolveRequest(studyRoot, rest[0], rest.slice(1).join(' '));
    console.log(`✓ ${rec.id} addressed: ${rec.resolution}`);
  } else if (cmd === 'list' && studyRoot) {
    const rows = listRequests(studyRoot, rest[0] || 'all');
    if (!rows.length) console.log('(no requests)');
    for (const r of rows) console.log(`${r.status === 'open' ? '○' : '●'} ${r.id} [${r.status}] ${r.request}${r.where ? `  → ${r.where}` : ''}`);
  } else if (cmd === 'gate' && studyRoot) {
    const g = requestsGate(studyRoot);
    if (g.pass) console.log('✓ No open researcher requests — CP3 clear on this gate.');
    else { console.error(`⛔ ${g.open.length} open researcher request(s) block sign-off:`); for (const r of g.open) console.error(`  - ${r.id}: ${r.request}`); process.exit(1); }
  } else {
    console.error('Usage: node lib/requests.mjs add <studyRoot> "<text>" [--turn N] | resolve <studyRoot> <REQ-id> "<note>" | list <studyRoot> [open|addressed|all] | gate <studyRoot>');
    process.exit(2);
  }
}

// pii.mjs — privacy / de-identification layer. Zero deps.
// - Codes each participant to an OPAQUE id (P01, P02, …). The session date/time and the real
//   name/company live ONLY in the private crosswalk (inputs/private/participant-key.json, git-ignored),
//   so nothing shareable re-identifies a participant — not even via the code itself.
// - Redacts transcripts/text to codes; scans reports for leaked names/companies/emails/phones (hard),
//   and flags unknown proper nouns (possible third parties) for human review (soft).
// - The gate FAILS CLOSED: a missing/empty participant key is an error, never a silent "clean".
//
// CLI:
//   node lib/pii.mjs key    <studyRoot>              build opaque codes from inputs/private/roster.json
//   node lib/pii.mjs redact <studyRoot> <file>       print redacted text (names/companies -> codes)
//   node lib/pii.mjs scan   <studyRoot> <file>       exit 1 if any name/company/email/phone leaks
//   node lib/pii.mjs scan-run <studyRoot> <model>    scan EVERY run artifact (step JSON + report + story)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJSONSafe, writeJSONAtomic } from './fsx.mjs';

const privateDir = studyRoot =>
  process.env.UXR_PRIVATE_DIR
    ? path.join(process.env.UXR_PRIVATE_DIR, path.basename(studyRoot))
    : path.join(studyRoot, 'inputs', 'private');
const keyPath = studyRoot => path.join(privateDir(studyRoot), 'participant-key.json');
const rosterPath = studyRoot => path.join(privateDir(studyRoot), 'roster.json');
const publicCodesPath = studyRoot => path.join(studyRoot, 'inputs', 'participant-codes.md');

// Build the crosswalk from roster.json: [{ name, company, session_datetime }].
// Codes are OPAQUE and sequential (P01, P02, …) — the session slot is NOT encoded in the code.
export function buildKey(studyRoot) {
  const rp = rosterPath(studyRoot);
  if (!fs.existsSync(rp)) throw new Error(`Missing ${rp}. Create it (private) with [{name, company, session_datetime}].`);
  const roster = JSON.parse(fs.readFileSync(rp, 'utf8'));
  const key = {};
  roster.forEach((r, i) => {
    const code = `P${String(i + 1).padStart(2, '0')}`;
    key[code] = { name: r.name, company: r.company || null, session_datetime: r.session_datetime || null };
  });
  fs.mkdirSync(privateDir(studyRoot), { recursive: true });
  writeJSONAtomic(keyPath(studyRoot), key);

  // public codes file: OPAQUE codes only — never names, companies, or session date/time.
  const lines = ['# Participant Codes (safe to share)\n',
    'Opaque codes only. Real names, companies, and session date/time live in the private crosswalk.\n',
    '| Code |', '|---|',
    ...Object.keys(key).map(c => `| ${c} |`)];
  fs.writeFileSync(publicCodesPath(studyRoot), lines.join('\n') + '\n');
  console.log(`✓ Built ${Object.keys(key).length} opaque codes -> inputs/private/participant-key.json (private) + inputs/participant-codes.md (public)`);
  return key;
}

// Load the crosswalk. By default FAILS CLOSED: a missing/empty key throws, so a privacy gate can
// never report "clean" simply because the key wasn't present in this environment.
export function loadKey(studyRoot, { requireKey = true } = {}) {
  const kp = keyPath(studyRoot);
  const key = readJSONSafe(kp, null);
  if ((key == null || Object.keys(key).length === 0) && requireKey) {
    throw new Error(
      `PII gate cannot run: ${kp} is missing or empty. This is a FAIL-CLOSED control — ` +
      `build it with 'node lib/pii.mjs key <studyRoot>' before scanning. Never ship without a loaded key.`
    );
  }
  return key || {};
}

// --- generic PII detectors (independent of the roster) ---
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
// Capitalized single/multi-word proper nouns (possible third-party names).
const PROPER_NOUN_RE = /\b([A-Z][a-z]{1,}(?:\s+[A-Z][a-z]{1,}){0,3})\b/g;
// Words that look like proper nouns but usually aren't people/companies — reduce review noise.
const PROPER_STOPWORDS = new Set(['I', 'The', 'A', 'An', 'This', 'That', 'These', 'Those', 'It',
  'We', 'They', 'He', 'She', 'You', 'Participant', 'Participants', 'Code', 'Codes', 'Company',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December', 'Submit', 'Save', 'Cancel', 'Settings', 'Export', 'Report', 'Story']);

// Roster-derived sensitive terms: full names, name tokens (>=2 chars), companies.
function sensitiveTerms(key) {
  const terms = [];
  for (const v of Object.values(key)) {
    if (v.name) {
      terms.push(v.name);
      for (const tok of v.name.split(/\s+/)) if (tok.length >= 2) terms.push(tok);
    }
    if (v.company) terms.push(v.company);
  }
  return [...new Set(terms)].sort((a, b) => b.length - a.length); // longest first
}

// Map a term to the participant code ONLY when it unambiguously identifies one participant.
// Ambiguous first names shared by multiple participants must not be reassigned to the wrong code.
function codeForTerm(key, term) {
  const t = term.toLowerCase();
  const matches = [];
  for (const [code, v] of Object.entries(key)) {
    const tokens = (v.name || '').split(/\s+/).map(s => s.toLowerCase());
    if ((v.name || '').toLowerCase() === t || tokens.includes(t)) matches.push(code);
  }
  return matches.length === 1 ? matches[0] : null; // ambiguous -> null
}

const isCompanyTerm = (key, term) =>
  Object.values(key).some(v => v.company && v.company.toLowerCase() === term.toLowerCase());

export function redact(text, key) {
  let out = text;
  for (const term of sensitiveTerms(key)) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    let replacement;
    if (isCompanyTerm(key, term)) replacement = '[COMPANY]';
    else replacement = codeForTerm(key, term) || '[PARTICIPANT]'; // ambiguous -> generic, never a wrong code
    out = out.replace(re, replacement);
  }
  // generic PII
  out = out.replace(EMAIL_RE, '[EMAIL]').replace(PHONE_RE, '[PHONE]');
  return out;
}

// Low-level scan. Returns { leaks:[...], review:[...] }:
//   leaks  — roster names/companies + emails/phones that MUST NOT appear (hard).
//   review — unknown proper nouns (possible third parties) for a human to eyeball (soft).
export function scanText(text, key) {
  const leaks = [];
  for (const term of sensitiveTerms(key)) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(text)) leaks.push(term);
  }
  for (const m of text.match(EMAIL_RE) || []) leaks.push(m);
  for (const m of text.match(PHONE_RE) || []) leaks.push(m);

  const known = new Set();
  for (const v of Object.values(key)) {
    if (v.name) v.name.split(/\s+/).forEach(t => known.add(t.toLowerCase()));
    if (v.company) known.add(v.company.toLowerCase());
  }
  const review = new Set();
  for (const m of text.match(PROPER_NOUN_RE) || []) {
    const head = m.split(/\s+/)[0];
    if (PROPER_STOPWORDS.has(head)) continue;
    if (known.has(m.toLowerCase())) continue; // already a hard leak, don't double-report
    review.add(m);
  }
  return { leaks: [...new Set(leaks)], review: [...review] };
}

// Backward-compatible helper: returns just the hard-leak list.
export function scan(text, key) {
  return scanText(text, key).leaks;
}

// Gate over a list of files (reports/stories). FAILS CLOSED via loadKey.
// Returns { pass, offenders:{file:[terms]}, review:{file:[nouns]} }.
export function scanFiles(studyRoot, files, { requireKey = true } = {}) {
  const key = loadKey(studyRoot, { requireKey });
  const offenders = {};
  const review = {};
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const { leaks, review: rev } = scanText(fs.readFileSync(f, 'utf8'), key);
    if (leaks.length) offenders[path.basename(f)] = leaks;
    if (rev.length) review[path.basename(f)] = rev;
  }
  return { pass: Object.keys(offenders).length === 0, offenders, review };
}

// Scan EVERY artifact of a run — step JSON, report, story — not just the final files. Un-redacted
// PII in an intermediate step still renders on the CP1/CP2 dashboards a human reviews before sign-off.
// (run-manifest.json is excluded: it holds only ids/paths/sha256 hashes — no participant content —
// and its long hex digit-runs would otherwise trip the phone detector.)
export function scanRun(studyRoot, model) {
  const runDir = path.join(studyRoot, 'runs', model);
  const files = fs.existsSync(runDir)
    ? fs.readdirSync(runDir).filter(f => /\.(json|md)$/i.test(f) && f !== 'pii-report.json' && f !== 'run-manifest.json').map(f => path.join(runDir, f))
    : [];
  const result = scanFiles(studyRoot, files);
  const report = { model, generated_at: new Date().toISOString(),
    pass: result.pass, scanned: files.map(f => path.basename(f)),
    offenders: result.offenders, review: result.review };
  writeJSONAtomic(path.join(runDir, 'pii-report.json'), report);
  return report;
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, studyRoot, file] = process.argv.slice(2);
  const sr = studyRoot && path.resolve(studyRoot);
  if (cmd === 'key') buildKey(sr);
  else if (cmd === 'redact') {
    if (!file || !fs.existsSync(file)) { console.error(`File not found: ${file}`); process.exit(2); }
    process.stdout.write(redact(fs.readFileSync(file, 'utf8'), loadKey(sr)));
  } else if (cmd === 'scan') {
    if (!file || !fs.existsSync(file)) { console.error(`File not found: ${file}`); process.exit(2); }
    const { leaks, review } = scanText(fs.readFileSync(file, 'utf8'), loadKey(sr));
    if (review.length) console.error(`⚠ Review (possible third parties) in ${file}: ${review.join(', ')}`);
    if (leaks.length) { console.error(`⛔ PII LEAK in ${file}: ${leaks.join(', ')}`); process.exit(1); }
    console.log(`✓ No PII leak in ${file}`);
  } else if (cmd === 'scan-run') {
    const model = file; // third arg
    const r = scanRun(sr, model);
    console.log(`PII scan-run — ${model}: ${r.pass ? '✓ clean' : '⛔ LEAKS'} across ${r.scanned.length} artifacts`);
    if (!r.pass) { console.error(JSON.stringify(r.offenders, null, 2)); process.exit(1); }
    if (Object.keys(r.review).length) console.error(`⚠ Review: ${JSON.stringify(r.review)}`);
  } else { console.error('Usage: node lib/pii.mjs key|redact|scan <studyRoot> [file] | scan-run <studyRoot> <model>'); process.exit(2); }
}

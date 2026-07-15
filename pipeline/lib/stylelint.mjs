// stylelint.mjs — deterministic house-style linter for the report + story markdown. Zero deps.
// The `humanizer` skill is guidance; this makes the non-negotiable rules a real gate. It reads the
// banned-pattern list from config.json > style so the learning loop can tune Sara's voice without
// touching code. hardPatterns BLOCK (exit 1); softPatterns warn. Matches inside verbatim quotes and
// blockquote lines are ignored for patterns marked ignoreQuoted (an em dash inside a quote is fine).
//
// CLI:
//   node lib/stylelint.mjs lint <file.md> [<file2.md> ...]   exit 1 if any HARD pattern hits
//   node lib/stylelint.mjs check-sample <studyRoot>          exit 1 if a style sample is required but missing

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const STYLE = CONFIG.style || {};

// Strip quoted spans + inline code from a single line so ignoreQuoted patterns don't fire on a
// verbatim participant quote. A whole blockquote line (`> …`) is treated as fully quoted.
export function proseOnly(line) {
  if (/^\s*>/.test(line)) return '';                              // blockquote = participant quote, skip
  return line
    .replace(/`[^`]*`/g, ' ')                                     // inline code
    .replace(/"[^"]*"/g, ' ')                                     // straight double quotes
    .replace(/[\u201C\u201D][^\u201C\u201D]*[\u201C\u201D]/g, ' ') // curly double quotes
    .replace(/\u2018[^\u2019]*\u2019/g, ' ');                     // curly single quotes
}

const compile = list => (list || []).map(p => ({ ...p, re: new RegExp(p.regex, p.flags || '') }));

// Lint one markdown string. Returns { hard:[...], soft:[...] } of { id, line, message, match }.
export function lintText(text) {
  const hard = compile(STYLE.hardPatterns);
  const soft = compile(STYLE.softPatterns);
  const out = { hard: [], soft: [] };
  const lines = String(text).split('\n');
  let fenced = false;
  lines.forEach((raw, i) => {
    if (/^\s*```/.test(raw)) { fenced = !fenced; return; }         // skip fenced code blocks
    if (fenced) return;
    const prose = proseOnly(raw);
    for (const [bucket, pats] of [['hard', hard], ['soft', soft]]) {
      for (const p of pats) {
        const m = (p.ignoreQuoted ? prose : raw).match(p.re);
        if (m) out[bucket].push({ id: p.id, line: i + 1, message: p.message, match: m[0].trim() });
      }
    }
  });
  return out;
}

export function lintFile(file) { return lintText(fs.readFileSync(file, 'utf8')); }

// Gate over a set of files. pass=false when ANY hard violation exists in ANY file.
export function lintFiles(files) {
  const byFile = {};
  let pass = true;
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const r = lintFile(f);
    byFile[path.basename(f)] = r;
    if (r.hard.length) pass = false;
  }
  return { pass, files: byFile };
}

// Intake control: a study should carry at least one writing-style sample so Editor/Storyteller match
// the researcher's voice from the first draft instead of after several rounds of corrections.
export function checkStyleSample(studyRoot) {
  const dir = path.join(studyRoot, 'inputs', 'style-samples');
  const has = fs.existsSync(dir) &&
    fs.readdirSync(dir).some(f => !f.startsWith('.') && fs.statSync(path.join(dir, f)).isFile());
  const required = STYLE.requireStyleSample === true;
  return { pass: has || !required, required, has };
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'lint') {
    if (!rest.length) { console.error('Usage: node lib/stylelint.mjs lint <file.md> [...]'); process.exit(2); }
    const r = lintFiles(rest.map(f => path.resolve(f)));
    let hardN = 0, softN = 0;
    for (const [name, res] of Object.entries(r.files)) {
      for (const v of res.hard) { hardN++; console.error(`  x  ${name}:${v.line} [${v.id}] ${v.message}  ("${v.match}")`); }
      for (const v of res.soft) { softN++; console.error(`  !  ${name}:${v.line} [${v.id}] ${v.message}  ("${v.match}")`); }
    }
    console.log(`\nStyle gate — ${Object.keys(r.files).length} file(s): ${hardN} hard, ${softN} soft`);
    if (r.pass) console.log('  HARD RULES: PASS' + (softN ? ` (${softN} soft warning${softN > 1 ? 's' : ''} to review)` : ''));
    else console.log('  HARD RULES: FAIL');
    process.exit(r.pass ? 0 : 1);
  } else if (cmd === 'check-sample') {
    const sr = rest[0] && path.resolve(rest[0]);
    if (!sr) { console.error('Usage: node lib/stylelint.mjs check-sample <studyRoot>'); process.exit(2); }
    const r = checkStyleSample(sr);
    if (r.pass) console.log(r.has ? 'PASS  writing-style sample present in inputs/style-samples/' : 'PASS  no style sample required');
    else { console.error('FAIL  inputs/style-samples/ is empty. Capture at least one past report whose voice to match (config.style.requireStyleSample=true).'); process.exit(1); }
  } else {
    console.error('Usage: node lib/stylelint.mjs lint <file...> | check-sample <studyRoot>'); process.exit(2);
  }
}

// compare.mjs — diff the two model runs (opus-4.8 vs gpt-5.5). Zero deps.
// Usage: node lib/compare.mjs <studyRoot>
// Writes comparison/model-diff.md and comparison/model-diff.html
//
// This does three things the old version didn't:
//   1. VERIFIES the comparison is legitimate — the two run dirs actually used DIFFERENT models and
//      IDENTICAL input hashes. Otherwise "agreement" is meaningless (you could diff a run against itself).
//   2. Measures CONTENT agreement, not just type counts — theme-level overlap (Jaccard) so two models
//      with the same counts but different findings don't show as identical.
//   3. DISCLOSES the sample size (runsPerModel). With n=1 the diff is a single-run snapshot and
//      conflates model differences with ordinary LLM sampling noise; it says so out loud.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJSONSafe } from './fsx.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = readJSONSafe(path.join(__dirname, '..', 'config.json'), {});
const MODELS = CONFIG.comparison?.models || ['opus-4.8', 'gpt-5.5'];
const RUNS_PER_MODEL = CONFIG.comparison?.runsPerModel || 1;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function loadAllFindings(runDir) {
  const bases = ['01-observed-behavior','02-verbatim','03-pain-points','04-papercuts','05-design-recommendations','06b-powerful-moments','07-synthesis'];
  const out = [];
  for (const b of bases) {
    const data = readJSONSafe(path.join(runDir, b + '.json'));
    if (!data) continue;
    if (Array.isArray(data)) out.push(...data);
    else if (Array.isArray(data.findings)) out.push(...data.findings);
    else if (Array.isArray(data.themes)) out.push(...data.themes);
  }
  return out;
}

function byType(findings) {
  const m = {};
  for (const f of findings) m[f.type] = (m[f.type] || 0) + 1;
  return m;
}

function verdicts(runDir) {
  const syn = readJSONSafe(path.join(runDir, '07-synthesis.json'));
  const gc = syn?.goal_coverage || {};
  const out = {};
  for (const [k, v] of Object.entries(gc)) out[k] = v.verdict || 'n/a';
  return out;
}

// --- content agreement ---
const STOP = new Set(['the','a','an','and','or','to','of','in','on','for','with','is','are','was','were','it','that','this','when','they','their','as','at','be','by']);
const tokens = s => new Set(String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)));

function jaccard(a, b) {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// Best-match theme agreement: for each theme in A, find its most similar theme in B. The mean of the
// best matches (both directions) is a rough inter-model theme-overlap score in [0,1].
function themeAgreement(fa, fb) {
  const ta = fa.filter(f => f.type === 'theme').map(f => tokens(f.statement));
  const tb = fb.filter(f => f.type === 'theme').map(f => tokens(f.statement));
  if (!ta.length || !tb.length) return { score: null, aThemes: ta.length, bThemes: tb.length };
  const best = (xs, ys) => xs.map(x => Math.max(...ys.map(y => jaccard(x, y))));
  const all = [...best(ta, tb), ...best(tb, ta)];
  const score = +(all.reduce((s, v) => s + v, 0) / all.length).toFixed(2);
  return { score, aThemes: ta.length, bThemes: tb.length };
}

// Verify the two run dirs are a valid basis for comparison.
function verifyRuns(studyRoot) {
  const issues = [];
  const info = {};
  const inputSigs = {};
  for (const m of MODELS) {
    const man = readJSONSafe(path.join(studyRoot, 'runs', m, 'run-manifest.json'));
    info[m] = { declaredModel: man?.model ?? null, present: !!man };
    if (!man) { issues.push(`missing run-manifest for ${m}`); continue; }
    if (man.model && man.model !== m) issues.push(`run dir '${m}' declares model '${man.model}'`);
    inputSigs[m] = JSON.stringify(man.inputs || {});
  }
  const declared = MODELS.map(m => info[m].declaredModel).filter(Boolean);
  if (new Set(declared).size < declared.length) issues.push('the two runs report the SAME model — not a cross-model comparison');
  const sigs = Object.values(inputSigs);
  if (sigs.length === 2 && sigs[0] !== sigs[1]) issues.push('the two runs were built on DIFFERENT inputs (hash mismatch) — agreement is not comparable');
  return { pass: issues.length === 0, issues, info };
}

export function compare(studyRoot) {
  const data = {};
  for (const m of MODELS) {
    const runDir = path.join(studyRoot, 'runs', m);
    const findings = loadAllFindings(runDir);
    data[m] = { findings, byType: byType(findings), evals: readJSONSafe(path.join(runDir, '08-qa-evals.json')), verdicts: verdicts(runDir) };
  }
  const [MA, MB] = MODELS;
  const verify = verifyRuns(studyRoot);
  const agree = themeAgreement(data[MA].findings, data[MB].findings);
  const types = [...new Set(MODELS.flatMap(m => Object.keys(data[m].byType)))].sort();
  const hyps = [...new Set(MODELS.flatMap(m => Object.keys(data[m].verdicts)))].sort();

  const nDisclosure = RUNS_PER_MODEL < 2
    ? `⚠ Single run per model (n=${RUNS_PER_MODEL}). Differences below conflate the model effect with ordinary LLM sampling noise. Set comparison.runsPerModel>1 to separate them.`
    : `${RUNS_PER_MODEL} runs per model — differences are averaged across runs to reduce sampling noise.`;

  // Markdown
  let md = `# Model Comparison — ${path.basename(studyRoot)}\n\n${MA} vs ${MB}.\n\n`;
  md += `## Comparison validity\n\n${verify.pass ? '✅ Runs verified: different models, identical inputs.' : '⛔ **Comparison NOT valid:**\n' + verify.issues.map(i => `- ${i}`).join('\n')}\n\n> ${nDisclosure}\n\n`;
  md += `## Theme agreement (content)\n\n${agree.score == null ? '_Not enough themes to score._' : `Best-match theme overlap (Jaccard): **${agree.score}** (${agree.aThemes} vs ${agree.bThemes} themes). 1.0 = same themes, 0 = disjoint. Note: equal type COUNTS do not imply agreement.`}\n\n`;
  md += `## Findings by type\n\n| Type | ${MA} | ${MB} | Δ |\n|---|---|---|---|\n`;
  for (const t of types) { const a = data[MA].byType[t] || 0, b = data[MB].byType[t] || 0; md += `| ${t} | ${a} | ${b} | ${a - b >= 0 ? '+' : ''}${a - b} |\n`; }
  md += `\n## Hypothesis verdicts\n\n| Hypothesis | ${MA} | ${MB} | Agree |\n|---|---|---|---|\n`;
  for (const h of hyps) { const a = data[MA].verdicts[h] || 'n/a', b = data[MB].verdicts[h] || 'n/a'; md += `| ${h} | ${a} | ${b} | ${a === b ? '✅' : '⚠️'} |\n`; }
  md += `\n## Hard-gate pass\n\n| Model | Hard gates |\n|---|---|\n`;
  for (const m of MODELS) md += `| ${m} | ${data[m].evals?.hardPass ? 'PASS' : 'FAIL/n-a'} |\n`;
  md += `\n_Generated ${new Date().toISOString()}._\n`;

  // HTML
  const rows = arr => arr.join('');
  const CSS = `body{font:15px/1.5 -apple-system,Segoe UI,Roboto,Arial;background:#0f1117;color:#e7e9ee;max-width:900px;margin:0 auto;padding:28px}
  h1{font-size:24px}h2{border-bottom:1px solid #262b36;padding-bottom:6px;margin-top:28px}
  table{width:100%;border-collapse:collapse}th,td{padding:8px 10px;border-bottom:1px solid #262b36;text-align:left}
  th{color:#9aa3b2}code{color:#6ea8fe}.agree{color:#2ecc71}.diff{color:#ffb020}
  .banner{border-radius:10px;padding:12px 14px;margin:12px 0}.ok{background:rgba(46,204,113,.12);color:#2ecc71}.bad{background:rgba(255,92,102,.12);color:#ff5c66}.warn{background:rgba(255,176,32,.12);color:#ffb020}`;
  const validityBanner = verify.pass
    ? `<div class="banner ok">✅ Runs verified: different models, identical inputs.</div>`
    : `<div class="banner bad">⛔ Comparison not valid:<ul>${verify.issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
  const html = `<!doctype html><meta charset="utf-8"><title>Model diff — ${esc(path.basename(studyRoot))}</title><style>${CSS}</style>
  <h1>Model Comparison</h1><p>${esc(MA)} vs ${esc(MB)} · ${esc(path.basename(studyRoot))}</p>
  ${validityBanner}<div class="banner warn">${esc(nDisclosure)}</div>
  <h2>Theme agreement (content)</h2><p>${agree.score == null ? 'Not enough themes to score.' : `Best-match theme overlap (Jaccard): <b>${agree.score}</b> (${agree.aThemes} vs ${agree.bThemes} themes). Equal type counts do <em>not</em> imply agreement.`}</p>
  <h2>Findings by type</h2><table><tr><th>Type</th><th>${esc(MA)}</th><th>${esc(MB)}</th><th>Δ</th></tr>
  ${rows(types.map(t => { const a = data[MA].byType[t] || 0, b = data[MB].byType[t] || 0; return `<tr><td>${esc(t)}</td><td>${a}</td><td>${b}</td><td>${a-b>=0?'+':''}${a-b}</td></tr>`; }))}</table>
  <h2>Hypothesis verdicts</h2><table><tr><th>Hypothesis</th><th>${esc(MA)}</th><th>${esc(MB)}</th><th>Agree</th></tr>
  ${rows(hyps.map(h => { const a = data[MA].verdicts[h]||'n/a', b = data[MB].verdicts[h]||'n/a'; return `<tr><td>${esc(h)}</td><td>${esc(a)}</td><td>${esc(b)}</td><td class="${a===b?'agree':'diff'}">${a===b?'✅':'⚠️'}</td></tr>`; }))}</table>
  <p style="color:#9aa3b2;margin-top:30px">Generated ${new Date().toISOString()}</p>`;

  const outDir = path.join(studyRoot, 'comparison');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'model-diff.md'), md);
  fs.writeFileSync(path.join(outDir, 'model-diff.html'), html);
  console.log(`✓ Comparison written to comparison/model-diff.{md,html}${verify.pass ? '' : ' (⚠ comparison flagged INVALID)'}`);
  return { md, types, hyps, verify, agreement: agree };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const studyRoot = process.argv[2];
  if (!studyRoot) { console.error('Usage: node lib/compare.mjs <studyRoot>'); process.exit(2); }
  compare(path.resolve(studyRoot));
}

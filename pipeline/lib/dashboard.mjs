// dashboard.mjs — generate self-contained HTML dashboards per checkpoint + an index. Zero deps.
// Usage: node lib/dashboard.mjs <studyRoot> [model]
// Builds studies/<id>/dashboards/*.html from run-manifest + eval reports + step outputs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJSONSafe } from './fsx.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS = ['opus-4.8', 'gpt-5.5'];

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const readJSON = readJSONSafe;

const CSS = `
:root{--bg:#0f1117;--card:#171a23;--ink:#e7e9ee;--mut:#9aa3b2;--line:#262b36;--ok:#2ecc71;--bad:#ff5c66;--warn:#ffb020;--acc:#6ea8fe}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
.sub{color:var(--mut);margin:0 0 18px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600}
.ok{background:rgba(46,204,113,.15);color:var(--ok)}.bad{background:rgba(255,92,102,.15);color:var(--bad)}
.warn{background:rgba(255,176,32,.15);color:var(--warn)}.mut{background:rgba(154,163,178,.15);color:var(--mut)}
table{width:100%;border-collapse:collapse;margin-top:8px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--mut);font-weight:600;font-size:13px}
.finding{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:10px 0}
.fid{font-family:ui-monospace,Menlo,monospace;color:var(--acc);font-weight:700}
.ev{border-left:3px solid var(--line);padding:6px 12px;margin:8px 0;color:var(--mut)}
.ev q{color:var(--ink)}.meta{color:var(--mut);font-size:13px}
a{color:var(--acc);text-decoration:none}a:hover{text-decoration:underline}
.tag{display:inline-block;background:rgba(110,168,254,.12);color:var(--acc);border-radius:6px;padding:1px 7px;font-size:12px;margin:2px 4px 0 0}
.sev5{color:var(--bad)}.sev4{color:var(--warn)}.foot{color:var(--mut);font-size:12px;margin-top:40px}
`;

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>${CSS}</style></head><body><div class="wrap">${body}
<div class="foot">Generated ${new Date().toISOString()} · UXR pipeline v0.4.0 · self-contained, offline.</div>
</div></body></html>`;
}

const gate = v => v == null ? '<span class="pill mut">n/a</span>'
  : v.pass ? '<span class="pill ok">PASS</span>' : `<span class="pill ${v.gate === 'hard' ? 'bad' : 'warn'}">${v.gate === 'hard' ? 'FAIL' : 'FLAG'}</span>`;

function evalsTable(evalReport) {
  if (!evalReport?.steps?.length) return '<p class="sub">No eval results yet.</p>';
  let rows = '';
  for (const step of evalReport.steps) {
    for (const [k, v] of Object.entries(step.evals)) {
      rows += `<tr><td>${esc(step.step)}</td><td>${esc(k)}</td><td>${esc(v.gate)}</td><td>${gate(v)}</td>
        <td class="meta">${esc(Object.entries(v).filter(([kk]) => !['gate','pass'].includes(kk)).map(([kk,vv]) => `${kk}=${Array.isArray(vv)?vv.join('/'):vv}`).join(', '))}</td></tr>`;
    }
  }
  return `<table><tr><th>Step</th><th>Eval</th><th>Gate</th><th>Result</th><th>Detail</th></tr>${rows}</table>`;
}

function findingCard(f) {
  const sevClass = f.severity === 5 ? 'sev5' : f.severity === 4 ? 'sev4' : '';
  const ev = (f.evidence || []).map(e =>
    `<div class="ev"><q>“${esc(e.quote)}”</q><br><span class="meta">— ${esc(e.participant)} · ${esc(e.transcript_id)} @ ${esc(e.locator)}${e.observation_type ? ' · ' + esc(e.observation_type) : ''}</span></div>`).join('');
  const tags = (f.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('');
  const rel = (f.related_finding_ids || []).map(r => `<span class="tag">${esc(r)}</span>`).join('');
  const bits = [];
  if (f.severity != null) bits.push(`<span class="${sevClass}">severity ${f.severity}</span>`);
  if (f.frequency != null) bits.push(`frequency ${f.frequency}`);
  if (f.intensity != null) bits.push(`intensity ${f.intensity}`);
  if (f.emotion) bits.push(`emotion ${esc(f.emotion)}`);
  if (f.confidence) bits.push(`confidence ${esc(f.confidence)}`);
  if (f.clip_worthy) bits.push('🎬 clip-worthy');
  return `<div class="finding"><div><span class="fid">${esc(f.id)}</span> <span class="pill mut">${esc(f.type)}</span></div>
    <div style="margin:6px 0 4px;font-weight:600">${esc(f.statement)}</div>
    <div class="meta">${bits.join(' · ')}</div>
    <div class="meta" style="margin-top:4px"><em>method:</em> ${esc(f.method)} — ${esc(f.method_justification)}</div>
    ${ev}${tags ? `<div style="margin-top:6px">${tags}</div>` : ''}${rel ? `<div class="meta" style="margin-top:6px">relates: ${rel}</div>` : ''}
  </div>`;
}

function loadStep(runDir, base) {
  const f = path.join(runDir, base + '.json');
  const data = readJSON(f);
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.findings)) return data.findings;
  if (Array.isArray(data.themes)) return data.themes;
  return [];
}

function flagsPanel(flagReport) {
  if (!flagReport?.flags?.length) return '<p class="sub">No risk flags raised.</p>';
  const open = flagReport.flags.filter(f => f.status === 'open');
  const sevPill = s => `<span class="pill ${s === 'high' ? 'bad' : s === 'medium' ? 'warn' : 'mut'}">${esc(s)}</span>`;
  const statPill = s => `<span class="pill ${s === 'open' ? 'warn' : s === 'fixed' ? 'ok' : 'mut'}">${esc(s)}</span>`;
  const rows = flagReport.flags.map(f =>
    `<tr><td class="fid">${esc(f.id)}</td><td>${esc(f.finding_id)}</td><td>${esc(f.category)}</td>
      <td>${sevPill(f.severity)}</td><td>${statPill(f.status)}</td>
      <td class="meta">${esc(f.reason)}${f.reviewer_note ? `<br><em>note: ${esc(f.reviewer_note)}</em>` : ''}</td></tr>`).join('');
  const banner = open.length
    ? `<p class="sub"><span class="pill warn">${open.length} OPEN</span> risk flag(s) need your review before sign-off.</p>`
    : '<p class="sub"><span class="pill ok">All flags triaged</span></p>';
  return `${banner}<table><tr><th>Flag</th><th>Finding</th><th>Category</th><th>Severity</th><th>Status</th><th>Why it's risky</th></tr>${rows}</table>`;
}

function saturationPanel(sat) {
  if (!sat) return '<p class="sub">No saturation report yet.</p>';
  const flags = (sat.adequacy_flags || []).map(f => `<span class="pill warn">${esc(f)}</span>`).join(' ') || '<span class="pill ok">no adequacy flags</span>';
  const rows = (sat.themes || []).map(t =>
    `<tr><td class="fid">${esc(t.id)}</td><td>${esc(t.type)}</td><td>${esc(t.n)}/${esc(t.N)}</td><td>${esc(t.representativeness || '—')}</td></tr>`).join('');
  return `<p class="sub">Participants cited: <b>${esc(sat.participants_cited)}/${esc(sat.denominator_N)}</b> (coverage ${esc(sat.coverage_ratio ?? 'n/a')}) · ${flags}</p>
    ${rows ? `<table><tr><th>Theme/Finding</th><th>Type</th><th>Support n/N</th><th>Representativeness</th></tr>${rows}</table>` : ''}`;
}

function piiBanner(piiReport) {
  if (!piiReport) return '';
  if (piiReport.pass) return '<div class="card"><span class="pill ok">PII scan clean</span> across all run artifacts.</div>';
  const files = Object.keys(piiReport.offenders || {}).join(', ');
  return `<div class="card"><span class="pill bad">PII LEAK</span> un-redacted identifiers in: ${esc(files)}. Redact before any human review.</div>`;
}

function manifestSummary(m) {
  if (!m) return '';
  const cards = (m.steps || []).map(s => {
    const cls = s.status === 'done' ? 'ok' : s.status === 'failed' || s.status === 'blocked' ? 'bad' : s.status === 'awaiting_human' ? 'warn' : 'mut';
    return `<div class="card"><div class="meta">${esc(s.agent)}</div><div>${esc(s.step)}</div><span class="pill ${cls}">${esc(s.status)}</span></div>`;
  }).join('');
  const cps = (m.checkpoints || []).map(c => {
    const cls = c.status === 'passed' ? 'ok' : c.status === 'rejected' ? 'bad' : c.status === 'changes_requested' ? 'warn' : 'mut';
    return `<span class="pill ${cls}">${esc(c.id)}: ${esc(c.status)}</span>`;
  }).join(' ');
  return `<h2>Run status</h2><p class="sub">run <code>${esc(m.run_id)}</code> · model <b>${esc(m.model)}</b> · ${esc(Object.keys(m.inputs || {}).length)} inputs hashed</p>
    <div style="margin-bottom:10px">${cps}</div><div class="grid">${cards}</div>`;
}

function buildForModel(studyRoot, model) {
  const runDir = path.join(studyRoot, 'runs', model);
  if (!fs.existsSync(runDir)) return [];
  const dashDir = path.join(studyRoot, 'dashboards');
  fs.mkdirSync(dashDir, { recursive: true });
  const manifest = readJSON(path.join(runDir, 'run-manifest.json'));
  const evalReport = readJSON(path.join(runDir, '08-qa-evals.json'));
  const flagReport = readJSON(path.join(runDir, '08c-risk-flags.json'));
  const satReport = readJSON(path.join(runDir, 'saturation.json'));
  const piiReport = readJSON(path.join(runDir, 'pii-report.json'));
  const studyName = readJSON(path.join(studyRoot, 'study.json'))?.name || path.basename(studyRoot);
  const built = [];

  // Checkpoint 1 — intake
  const intake = readJSON(path.join(studyRoot, 'inputs', 'intake-manifest.json'));
  const cp1 = page(`CP1 Intake — ${studyName}`, `<h1>Checkpoint 1 · Intake</h1><p class="sub">${esc(studyName)} — ${esc(model)}</p>
    ${manifestSummary(manifest)}<h2>Inputs hashed</h2>
    <table><tr><th>Artifact</th><th>sha256</th></tr>${Object.entries(intake?.inputs || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="meta">${esc(v.slice(0, 16))}…</td></tr>`).join('') || '<tr><td class="meta" colspan=2>No inputs hashed yet.</td></tr>'}</table>`);
  fs.writeFileSync(path.join(dashDir, `${model}-cp1-intake.html`), cp1); built.push(`${model}-cp1-intake.html`);

  // Checkpoint 2 — analysis + synthesis
  const producers = ['01-observed-behavior','02-verbatim','03-pain-points','04-papercuts','05-design-recommendations','06b-powerful-moments','07-synthesis'];
  const allFindings = producers.flatMap(b => loadStep(runDir, b));
  const cp2 = page(`CP2 Analysis — ${studyName}`, `<h1>Checkpoint 2 · Analysis & Synthesis</h1><p class="sub">${esc(studyName)} — ${esc(model)}</p>
    ${manifestSummary(manifest)}${piiBanner(piiReport)}<h2>Automated evals</h2>${evalsTable(evalReport)}
    <h2>Sample adequacy & saturation</h2>${saturationPanel(satReport)}
    <h2>⚑ Risk flags to review</h2>${flagsPanel(flagReport)}
    <h2>Findings (${allFindings.length})</h2>${allFindings.map(findingCard).join('') || '<p class="sub">No findings yet.</p>'}`);
  fs.writeFileSync(path.join(dashDir, `${model}-cp2-analysis.html`), cp2); built.push(`${model}-cp2-analysis.html`);

  // Checkpoint 3 — final
  const reportMd = path.join(runDir, '09-report.md');
  const storyMd = path.join(runDir, '09b-story.md');
  const reportHtml = fs.existsSync(reportMd) ? `<pre style="white-space:pre-wrap">${esc(fs.readFileSync(reportMd, 'utf8'))}</pre>` : '<p class="sub">Report not written yet.</p>';
  const storyHtml = fs.existsSync(storyMd) ? `<pre style="white-space:pre-wrap">${esc(fs.readFileSync(storyMd, 'utf8'))}</pre>` : '<p class="sub">Story not written yet.</p>';
  const cp3 = page(`CP3 Final — ${studyName}`, `<h1>Checkpoint 3 · Final Sign-off</h1><p class="sub">${esc(studyName)} — ${esc(model)}</p>
    ${manifestSummary(manifest)}${piiBanner(piiReport)}<h2>⚑ Risk flags</h2>${flagsPanel(flagReport)}<h2>Report</h2>${reportHtml}<h2>Story</h2>${storyHtml}`);
  fs.writeFileSync(path.join(dashDir, `${model}-cp3-final.html`), cp3); built.push(`${model}-cp3-final.html`);

  return built;
}

export function buildAll(studyRoot) {
  const studyName = readJSON(path.join(studyRoot, 'study.json'))?.name || path.basename(studyRoot);
  const dashDir = path.join(studyRoot, 'dashboards');
  fs.mkdirSync(dashDir, { recursive: true });
  let links = '';
  const present = MODELS.filter(m => fs.existsSync(path.join(studyRoot, 'runs', m, 'run-manifest.json')));
  for (const model of present) {
    const built = buildForModel(studyRoot, model);
    links += `<h2>${esc(model)}</h2><div class="grid">` +
      built.map(f => `<a class="card" href="./${esc(f)}">${esc(f.replace(model + '-', '').replace('.html', ''))}</a>`).join('') + '</div>';
  }
  const cmp = path.join(studyRoot, 'comparison', 'model-diff.html');
  if (fs.existsSync(cmp)) links += `<h2>Comparison</h2><div class="grid"><a class="card" href="../comparison/model-diff.html">Opus vs GPT-5.5 diff</a></div>`;
  const index = page(`UXR Dashboard — ${studyName}`, `<h1>${esc(studyName)}</h1><p class="sub">UXR analysis dashboards · ${present.join(' & ') || 'no runs yet'}</p>${links || '<p class="sub">No runs found. Scaffold a manifest first.</p>'}`);
  fs.writeFileSync(path.join(dashDir, 'index.html'), index);
  console.log(`✓ Dashboards written to ${path.relative(process.cwd(), dashDir)} (index.html + ${present.length} model set(s))`);
  return path.join(dashDir, 'index.html');
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const studyRoot = process.argv[2];
  if (!studyRoot) { console.error('Usage: node lib/dashboard.mjs <studyRoot> [model]'); process.exit(2); }
  buildAll(path.resolve(studyRoot));
}

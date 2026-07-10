// risk.mjs — the risky-arguments checker + flagging system. Zero deps.
// Scans a run's findings for arguments that are risky to publish or act on — even when they're "true" —
// and raises FLAGS for the human to review at a checkpoint. This is NOT a hard gate: nothing is blocked,
// but every open flag should be triaged (acknowledged / dismissed / fixed) before sign-off.
//
// Human decisions persist across re-runs: statuses are carried over by (finding_id + category).
//
// CLI:
//   node lib/risk.mjs scan   <studyRoot> <model>                     compute/refresh flags
//   node lib/risk.mjs review <studyRoot> <model>                     list OPEN flags
//   node lib/risk.mjs set    <studyRoot> <model> <flagId> <status> ["note"]   triage a flag
//        status: open | acknowledged | dismissed | fixed

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJSONSafe, updateJSON } from './fsx.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
const RISK = CONFIG.risk || {};
const enabled = cat => !RISK.categories || RISK.categories.includes(cat);

const flagsPath = (studyRoot, model) => path.join(studyRoot, 'runs', model, '08c-risk-flags.json');

// --- detectors ---
const ABSOLUTE = /\b(all|every|everyone|everybody|always|never|none|nobody|no one|universally)\b/i;
const GENERALIZE = /\b(users|participants|people|customers|everyone|they all)\b/i;
const CAUSAL = /\b(because|causes?|caused|leads? to|led to|results? in|due to|drives?|therefore|so that)\b/i;
const SPECULATE = /\b(maybe|probably|might|may be|could be|i think|seems? to|presumably|likely)\b/i;
const PRESCRIPTIVE = /\b(must not|must|never|always|immediately|required?|require[sd]?)\b/i;
// Anchored to genuinely sensitive contexts. "disabilit\w*" avoids the ubiquitous UI sense of
// "disabled" (e.g. a disabled button); protected-class and legal/health terms stay.
const SENSITIVE = /\b(legal|lawsuit|sue[ds]?|illegal|discriminat\w*|harass\w*|racis\w*|sexis\w*|disabilit\w*|medical|health condition|salary|compensation|fired|termination|layoff|gdpr|hipaa|privacy breach|security (?:flaw|hole|vuln\w*)|complian\w*|unethical)\b/i;

// The researcher's CLAIM (statement) — this is what risk detectors judge. Participant verbatims
// are deliberately excluded so a causal word inside someone's quote doesn't flag the finding.
const claimText = f => f.statement || '';

// Produce the raw flag set for one finding.
function flagsForFinding(f, allById) {
  const out = [];
  const t = claimText(f);
  const nEvidence = (f.evidence || []).length;
  const freq = typeof f.frequency === 'number' ? f.frequency : null;
  const add = (category, severity, reason) => out.push({ category, severity, reason });

  if (enabled('overgeneralization') && ABSOLUTE.test(f.statement || ''))
    add('overgeneralization', 'medium', `Absolute language ("${(f.statement.match(ABSOLUTE) || [])[0]}") generalizes beyond the sample.`);
  if (enabled('overgeneralization') && freq != null && freq <= (RISK.smallSampleN ?? 1) && GENERALIZE.test(f.statement || ''))
    add('overgeneralization', 'high', `Generalizes to a group from a small sample (frequency=${freq}).`);

  if (enabled('causal_claim') && CAUSAL.test(t))
    add('causal_claim', 'medium', `Causal phrasing ("${(t.match(CAUSAL) || [])[0]}") in the claim — qualitative data rarely proves causation.`);

  if (enabled('weak_support_high_impact') && f.type === 'design_recommendation' &&
      (nEvidence < (RISK.minEvidenceForRec ?? 2) || (freq != null && freq <= 1)))
    add('weak_support_high_impact', 'high', `High-impact recommendation on thin support (evidence=${nEvidence}, frequency=${freq ?? 'n/a'}).`);

  if (enabled('low_evidence_high_confidence') && f.confidence === 'high' && (nEvidence < 2 || (freq != null && freq <= 1)))
    add('low_evidence_high_confidence', 'high', `Confidence "high" but thin evidence (evidence=${nEvidence}, frequency=${freq ?? 'n/a'}).`);

  if (enabled('contradiction') && Array.isArray(f.contradicts) && f.contradicts.length)
    add('contradiction', 'high', `Directly challenges ${f.contradicts.join(', ')} — reconcile before publishing.`);
  if (enabled('contradiction')) {
    const challengers = Object.values(allById).filter(o => Array.isArray(o.contradicts) && o.contradicts.includes(f.id));
    if (challengers.length) add('contradiction', 'high', `Challenged by ${challengers.map(c => c.id).join(', ')}.`);
  }

  if (enabled('sensitive_topic') && SENSITIVE.test(t))
    add('sensitive_topic', 'high', `Touches a sensitive topic ("${(t.match(SENSITIVE) || [])[0]}") — needs careful framing / stakeholder review.`);

  if (enabled('speculation') && SPECULATE.test(f.statement || ''))
    add('speculation', 'medium', `Speculative hedge ("${(f.statement.match(SPECULATE) || [])[0]}") stated as a finding.`);

  if (enabled('absolute_recommendation') && f.type === 'design_recommendation' && PRESCRIPTIVE.test(f.statement || ''))
    add('absolute_recommendation', 'medium', `Prescriptive language ("${(f.statement.match(PRESCRIPTIVE) || [])[0]}") — confirm it's warranted.`);

  return out;
}

function loadFindings(runDir) {
  const bases = ['01-observed-behavior','02-verbatim','03-pain-points','04-papercuts','05-design-recommendations','06b-powerful-moments','07-synthesis'];
  const all = [];
  for (const b of bases) {
    const data = readJSONSafe(path.join(runDir, b + '.json'));
    if (!data) continue;
    if (Array.isArray(data)) all.push(...data);
    else if (Array.isArray(data.findings)) all.push(...data.findings);
    else if (Array.isArray(data.themes)) all.push(...data.themes);
  }
  return all;
}

export function scanRisk(studyRoot, model) {
  const runDir = path.join(studyRoot, 'runs', model);
  const findings = loadFindings(runDir);
  const byId = Object.fromEntries(findings.filter(f => f.id).map(f => [f.id, f]));

  // preserve prior human decisions keyed by finding_id + category
  const prior = {};
  const priorReport = readJSONSafe(flagsPath(studyRoot, model));
  if (priorReport) {
    for (const fl of (priorReport.flags || []))
      prior[`${fl.finding_id}::${fl.category}`] = { status: fl.status, reviewer_note: fl.reviewer_note };
  }

  const flags = [];
  let seq = 0;
  for (const f of findings) {
    for (const r of flagsForFinding(f, byId)) {
      const key = `${f.id}::${r.category}`;
      const carried = prior[key] || {};
      flags.push({
        id: `FLAG-${String(++seq).padStart(3, '0')}`,
        finding_id: f.id, finding_type: f.type,
        category: r.category, severity: r.severity, reason: r.reason,
        snippet: (f.statement || '').slice(0, 160),
        status: carried.status || 'open',
        reviewer_note: carried.reviewer_note || '',
      });
    }
  }

  const bySev = { high: 0, medium: 0, low: 0 };
  const byCat = {};
  let open = 0;
  for (const fl of flags) {
    if (fl.status === 'open') { open++; bySev[fl.severity] = (bySev[fl.severity] || 0) + 1; byCat[fl.category] = (byCat[fl.category] || 0) + 1; }
  }
  const report = { model, generated_at: new Date().toISOString(),
    summary: { total: flags.length, open, open_by_severity: bySev, open_by_category: byCat }, flags };

  return updateJSON(flagsPath(studyRoot, model), () => report, report);
}

export function setFlagStatus(studyRoot, model, flagId, status, note = '') {
  const fp = flagsPath(studyRoot, model);
  if (!['open', 'acknowledged', 'dismissed', 'fixed'].includes(status)) throw new Error(`Bad status '${status}'`);
  let updated = null;
  updateJSON(fp, (report) => {
    if (!report || !Array.isArray(report.flags)) throw new Error('No risk-flags file. Run: node lib/risk.mjs scan <studyRoot> <model>');
    const fl = report.flags.find(x => x.id === flagId);
    if (!fl) throw new Error(`No flag '${flagId}'`);
    fl.status = status; if (note) fl.reviewer_note = note;
    report.summary.open = report.flags.filter(x => x.status === 'open').length;
    updated = fl;
    return report;
  });
  return updated;
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, studyRoot, model, a, b, c] = process.argv.slice(2);
  const sr = studyRoot && path.resolve(studyRoot);
  if (cmd === 'scan' && sr && model) {
    const r = scanRisk(sr, model);
    console.log(`\nRisk scan — ${model}: ${r.summary.total} flags, ${r.summary.open} OPEN`);
    console.log(`  by severity: ${JSON.stringify(r.summary.open_by_severity)}`);
    console.log(`  by category: ${JSON.stringify(r.summary.open_by_category)}`);
    if (r.summary.open) console.log(`  ▶ Review at the checkpoint: node lib/risk.mjs review ${studyRoot} ${model}`);
  } else if (cmd === 'review' && sr && model) {
    const report = readJSONSafe(flagsPath(sr, model));
    if (!report) { console.error('No flags file. Run scan first.'); process.exit(2); }
    const open = (report.flags || []).filter(f => f.status === 'open');
    if (!open.length) { console.log('✓ No open risk flags.'); process.exit(0); }
    for (const f of open) console.log(`[${f.severity.toUpperCase()}] ${f.id} · ${f.finding_id} · ${f.category}\n   ${f.reason}\n   “${f.snippet}”\n`);
  } else if (cmd === 'set' && sr && model && a && b) {
    const fl = setFlagStatus(sr, model, a, b, c || '');
    console.log(`✓ ${fl.id} -> ${fl.status}${fl.reviewer_note ? ' (' + fl.reviewer_note + ')' : ''}`);
  } else {
    console.error('Usage: node lib/risk.mjs scan|review <studyRoot> <model> | set <studyRoot> <model> <flagId> <status> ["note"]');
    process.exit(2);
  }
}

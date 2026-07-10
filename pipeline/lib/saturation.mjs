// saturation.mjs — sample adequacy + saturation artifact. Zero deps.
// Traceability proves a claim came from somewhere; it does NOT prove the claim is representative or
// well-sampled. This computes the numbers a stakeholder will ask for: how many of N participants
// support each theme, which themes rest on a single participant, and a new-code emergence curve
// (are we still discovering new codes, or has the signal saturated?).
//
// CLI: node lib/saturation.mjs <studyRoot> <model>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJSONSafe, writeJSONAtomic } from './fsx.mjs';
import { listTranscripts } from './marvin-adapter.mjs';

const PRODUCER_BASES = ['01-observed-behavior','02-verbatim','03-pain-points','04-papercuts','05-design-recommendations','06b-powerful-moments','07-synthesis'];

function loadStep(runDir, base) {
  const data = readJSONSafe(path.join(runDir, base + '.json'));
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.findings)) return data.findings;
  if (Array.isArray(data.themes)) return data.themes;
  return [];
}

const supportersOf = f => new Set([
  ...((f.evidence || []).map(e => e.participant).filter(Boolean)),
  ...((f.supporting_participants || []).filter(Boolean)),
]);

export function computeSaturation(studyRoot, model) {
  const runDir = path.join(studyRoot, 'runs', model);
  const findings = PRODUCER_BASES.flatMap(b => loadStep(runDir, b));
  const N = listTranscripts(studyRoot).length; // one transcript ≈ one participant session

  const citedParticipants = new Set();
  const perParticipant = {};
  const themes = [];
  const singleParticipant = [];

  for (const f of findings) {
    const supporters = [...supportersOf(f)];
    supporters.forEach(p => { citedParticipants.add(p); perParticipant[p] = (perParticipant[p] || 0) + 1; });
    if (['theme', 'pain_point', 'papercut', 'design_recommendation'].includes(f.type)) {
      const row = { id: f.id, type: f.type, n: supporters.length, N, representativeness: f.representativeness || null };
      themes.push(row);
      if (supporters.length <= 1 && f.representativeness !== 'illustrative' && f.representativeness !== 'outlier')
        singleParticipant.push(f.id);
    }
  }

  // new-code emergence: order findings and count when a NEW supporting participant first appears.
  // A flat tail (few new participants late) is weak evidence of saturation; a rising tail means undersampled.
  const seen = new Set();
  const emergence = [];
  for (const f of findings) {
    let newOnes = 0;
    for (const p of supportersOf(f)) if (!seen.has(p)) { seen.add(p); newOnes++; }
    emergence.push({ finding: f.id, new_participants: newOnes, cumulative: seen.size });
  }

  const report = {
    model, generated_at: new Date().toISOString(),
    denominator_N: N,
    participants_cited: citedParticipants.size,
    coverage_ratio: N ? +(citedParticipants.size / N).toFixed(2) : null,
    per_participant_findings: perParticipant,
    themes,
    single_participant_themes: singleParticipant,
    emergence,
    adequacy_flags: [
      ...(N === 0 ? ['no_transcripts_found'] : []),
      ...(N && citedParticipants.size < N ? [`only ${citedParticipants.size}/${N} participants cited`] : []),
      ...(singleParticipant.length ? [`${singleParticipant.length} theme(s) rest on a single participant`] : []),
    ],
  };
  writeJSONAtomic(path.join(runDir, 'saturation.json'), report);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [studyRoot, model] = process.argv.slice(2);
  if (!studyRoot || !model) { console.error('Usage: node lib/saturation.mjs <studyRoot> <model>'); process.exit(2); }
  const r = computeSaturation(path.resolve(studyRoot), model);
  console.log(`Saturation — ${model}: ${r.participants_cited}/${r.denominator_N} participants cited`);
  if (r.adequacy_flags.length) console.log('  ⚠ ' + r.adequacy_flags.join('; '));
}

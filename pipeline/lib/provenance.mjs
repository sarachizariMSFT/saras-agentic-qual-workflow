// provenance.mjs — transcript provenance gate. Zero deps.
// The pipeline promises "raw Marvin transcripts, never Ask AI." Nothing stopped someone dropping a
// summarized/cleaned file into inputs/transcripts and having exact-quote checks bless it. This gate
// requires a provenance record per transcript and verifies the file is (a) unmodified since export
// (sha256) and (b) structurally transcript-like (speaker labels + timestamps). CP1 blocks if it fails.
//
// inputs/transcripts/provenance.json:
//   { "P01": { "source_type": "raw_transcript", "marvin_session_id": "…",
//              "exported_at": "2026-07-02T15:10:00Z", "exported_by": "marvin-mcp:getTranscript",
//              "sha256": "…" }, … }
//
// CLI: node lib/provenance.mjs check <studyRoot>
//      node lib/provenance.mjs stamp <studyRoot>   (dev helper: (re)write hashes for local files)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readJSONSafe, writeJSONAtomic } from './fsx.mjs';
import { listTranscripts } from './marvin-adapter.mjs';

const provenancePath = studyRoot => path.join(studyRoot, 'inputs', 'transcripts', 'provenance.json');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// Heuristic: a raw transcript has speaker labels ("Name:" or "P01:") AND at least one timestamp.
function looksLikeTranscript(text) {
  const hasSpeaker = /^\s*(?:\[[^\]]+\]\s*)?[A-Za-z0-9 _-]{1,40}:\s+\S/m.test(text);
  const hasTimestamp = /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(text);
  return hasSpeaker && hasTimestamp;
}

export function checkProvenance(studyRoot) {
  const transcripts = listTranscripts(studyRoot);
  const prov = readJSONSafe(provenancePath(studyRoot), {}) || {};
  const missing = [], mismatched = [], unstructured = [], notRaw = [];

  for (const t of transcripts) {
    const rec = prov[t.transcript_id];
    if (!rec) { missing.push(t.transcript_id); continue; }
    if (rec.source_type && rec.source_type !== 'raw_transcript') notRaw.push(t.transcript_id);
    if (rec.sha256 && rec.sha256 !== sha256(t.file)) mismatched.push(t.transcript_id);
    if (!looksLikeTranscript(fs.readFileSync(t.file, 'utf8'))) unstructured.push(t.transcript_id);
  }
  const pass = transcripts.length > 0 && !missing.length && !mismatched.length && !unstructured.length && !notRaw.length;
  return { pass, count: transcripts.length, missing, mismatched, unstructured, notRaw };
}

// Dev helper: stamp/refresh provenance for locally-saved files (source_type defaults to raw_transcript).
export function stampProvenance(studyRoot, { source_type = 'raw_transcript', exported_by = 'local-intake' } = {}) {
  const prov = readJSONSafe(provenancePath(studyRoot), {}) || {};
  for (const t of listTranscripts(studyRoot)) {
    prov[t.transcript_id] = {
      source_type,
      marvin_session_id: prov[t.transcript_id]?.marvin_session_id || null,
      exported_at: prov[t.transcript_id]?.exported_at || new Date().toISOString(),
      exported_by,
      sha256: sha256(t.file),
    };
  }
  writeJSONAtomic(provenancePath(studyRoot), prov);
  return prov;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, studyRoot] = process.argv.slice(2);
  const sr = studyRoot && path.resolve(studyRoot);
  if (cmd === 'check' && sr) {
    const r = checkProvenance(sr);
    console.log(`Provenance — ${r.count} transcripts: ${r.pass ? '✓ PASS' : '⛔ FAIL'}`);
    if (r.missing.length) console.error(`  missing provenance: ${r.missing.join(', ')}`);
    if (r.mismatched.length) console.error(`  sha256 mismatch (modified since export): ${r.mismatched.join(', ')}`);
    if (r.unstructured.length) console.error(`  not transcript-like (possible Ask-AI summary): ${r.unstructured.join(', ')}`);
    if (r.notRaw.length) console.error(`  source_type not raw_transcript: ${r.notRaw.join(', ')}`);
    process.exit(r.pass ? 0 : 1);
  } else if (cmd === 'stamp' && sr) {
    const p = stampProvenance(sr);
    console.log(`✓ Stamped provenance for ${Object.keys(p).length} transcripts.`);
  } else { console.error('Usage: node lib/provenance.mjs check|stamp <studyRoot>'); process.exit(2); }
}

// marvin-adapter.mjs
// Single source of truth for transcript access.
// TODAY: reads raw transcript files saved during intake (studies/<id>/inputs/transcripts/).
// INTEGRATION POINT: when the Marvin MCP server is connected, wire fetchFromMarvin() to pull
// raw transcript text (NOT the Ask AI feature) and save it to the same local path, so nothing
// downstream changes. The saved-file contract is the contract.

import fs from 'node:fs';
import path from 'node:path';

export function transcriptsDir(studyRoot) {
  return path.join(studyRoot, 'inputs', 'transcripts');
}

// List locally-saved transcripts for a study.
export function listTranscripts(studyRoot) {
  const dir = transcriptsDir(studyRoot);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => /\.(txt|md|vtt)$/i.test(f))
    .map(f => ({ transcript_id: path.basename(f).replace(/\.(txt|md|vtt)$/i, ''), file: path.join(dir, f) }));
}

// Load a transcript's raw text by id.
export function loadTranscript(studyRoot, transcriptId) {
  const dir = transcriptsDir(studyRoot);
  if (!fs.existsSync(dir)) return null;
  const match = fs.readdirSync(dir).find(f =>
    path.basename(f).replace(/\.(txt|md|vtt)$/i, '') === transcriptId);
  if (!match) return null;
  return fs.readFileSync(path.join(dir, match), 'utf8');
}

// Load all transcripts as { transcript_id: text }.
export function loadAllTranscripts(studyRoot) {
  const out = {};
  for (const t of listTranscripts(studyRoot)) {
    out[t.transcript_id] = fs.readFileSync(t.file, 'utf8');
  }
  return out;
}

// Return only the turns spoken by `speaker` within a transcript, concatenated.
// Recognizes lines like "[00:31:20] P07: ..." or "P07: ..." (optionally continuing
// across wrapped lines until the next speaker label). Used to scope quote-grounding
// to the cited participant so one participant's words can't be attributed to another.
// Returns '' when no speaker labels for `speaker` are found (caller may fall back).
export function speakerText(transcript, speaker) {
  if (!transcript || !speaker) return '';
  const label = String(speaker).trim();
  const lines = transcript.split(/\r?\n/);
  const speakerRe = /^\s*(?:\[[^\]]+\]\s*)?([A-Za-z0-9 _-]{1,40}?)\s*:\s*(.*)$/;
  const chunks = [];
  let capturing = false;
  for (const line of lines) {
    const m = line.match(speakerRe);
    if (m) {
      capturing = m[1].trim().toLowerCase() === label.toLowerCase();
      if (capturing) chunks.push(m[2]);
    } else if (capturing && line.trim()) {
      chunks.push(line.trim()); // continuation of the current speaker's turn
    }
  }
  return chunks.join(' ');
}

// --- INTEGRATION POINT (Marvin MCP not connected yet) ---
// When Marvin MCP is available, implement this to fetch RAW transcript text (with speaker labels
// and timestamps) and write it to transcriptsDir(studyRoot). Do NOT call any Ask AI / summarize tool.
export async function fetchFromMarvin(/* { studyRoot, marvinStudyId, sessionIds } */) {
  throw new Error(
    'Marvin MCP is not connected. Save transcripts to inputs/transcripts/ during intake, ' +
    'or wire this function to the Marvin MCP raw-transcript tools (never Ask AI).'
  );
}

export function marvinStatus() {
  // Flip to true once the MCP server is wired into fetchFromMarvin.
  return { connected: false, note: 'Reading transcripts from local inputs/transcripts/ (intake-saved).' };
}

// --- INTEGRATION POINT: video clips (used by the Evidence-Verifier via the marvin-clipper skill) ---
// Given an interview URL + start/end seconds (derived from the quote's timestamp), create a Marvin clip
// and return its shareable URL. Today this is driven interactively by the `marvin-clipper` global skill
// (Playwright). When the Marvin MCP exposes a clip tool, wire it here so evidence.clip_url is populated
// programmatically. Never call Ask AI.
//
// Until the MCP clip tool is wired, this returns a PENDING placeholder instead of throwing, so the
// pipeline can run end-to-end and backfill clips later. The clip_link gate accepts clip_status:'pending'
// only when config.evidence.allowPendingClips is true — so pending clips never silently pass as "done".
export async function createClip({ interviewUrl = null, startSec = null, endSec = null, label = '' } = {}) {
  return {
    clip_url: null,
    clip_status: 'pending',
    requested: { interviewUrl, startSec, endSec, label },
    note: 'Marvin MCP clip tool not connected. Cut the clip with the marvin-clipper skill (Playwright) ' +
      'and write its URL into evidence.clip_url (set clip_status:"created"), or wire this to the Marvin MCP clip tool.',
  };
}

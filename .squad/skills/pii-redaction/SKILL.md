---
name: "pii-redaction"
description: "Code participants to OPAQUE ids, keep a secure crosswalk (name + company + session date/time), and keep identifiers out of every shared artifact."
domain: "privacy"
confidence: "high"
source: "manual"
tools:
  - name: "pipeline/lib/pii.mjs"
    description: "Deterministic coding, redaction, and PII leak-scan."
    when: "At intake (key + redact) and before Checkpoint 3 (scan)."
---

## Context
Used by the Privacy agent, and respected by every producing agent. Participants must be de-identified:
names, companies, **and session date/time** never appear in the final report, story, dashboard, or any
intermediate step file. Findings stay fully traceable — the private crosswalk maps each opaque code back
to the exact session (date/time) and the real person, and that private key is the only path to identity.

## Patterns

### Coding scheme
- Each participant -> an OPAQUE sequential id (`P01`, `P02`, …). The code carries no meaning.
- The session date/time is NOT encoded into the code — it's a quasi-identifier, so it lives only in the
  private crosswalk. A shareable code can therefore never re-identify a participant, not even by timing.
- Ambiguous shared first names redact to `[PARTICIPANT]` (never a guessed code); companies to `[COMPANY]`.

### Secure crosswalk (private, git-ignored)
- `inputs/private/roster.json`: `[{ "name": "...", "company": "...", "session_datetime": "2026-07-02T14:00" }]`
- `inputs/private/participant-key.json`: `code -> { name, company, session_datetime }` (built by `pii.mjs key`).
- `inputs/private/` is in `.gitignore`. Never commit it, never paste it into a report or dashboard.
- Set `UXR_PRIVATE_DIR` to keep the key entirely outside a synced/cloud folder if the study root is synced.
- Public `inputs/participant-codes.md` lists opaque codes ONLY — no names, companies, or session times.

### Redaction on intake
- Run `node lib/pii.mjs redact` over saved transcripts so `inputs/transcripts/*` use codes, not names.
- Every finding's `evidence[].participant` MUST be a code. Reviewers/QA reject a name there.

### The PII gate (hard, fail-closed, every artifact)
- `loadKey` FAILS CLOSED: a missing/empty participant key is an error, never a silent "clean".
- `node lib/pii.mjs scan-run <studyRoot> <model>` scans EVERY run artifact (each step JSON, report, and
  story) — not just the final files — and writes `runs/<model>/pii-report.json`, surfaced as a banner on
  the CP2 and CP3 dashboards. Un-redacted PII in an intermediate step is caught before a human reviews it.
- Beyond roster names/companies, pattern detectors catch emails and phone numbers, and flag unknown
  proper nouns (possible third parties) for human review.
- Any hard leak -> fail, offending terms listed, bounce to Editor/Storyteller. No sign-off until clean.

### Tracing back
- To learn who a code is (and the exact session date/time), an authorized human opens the private
  crosswalk. That is the only path from code to person.

## Examples
Transcript in: `[00:12:44] Jordan Lee (Acme): I gave up.` -> redacted: `[00:12:44] P01 ([COMPANY]): I gave up.`
Report leak check: if `Acme` or `Jordan` appears in `09-report.md`, the gate fails and names the term.

## Anti-Patterns
- Putting a real name in a finding, dashboard, or report. Codes only.
- Committing `inputs/private/`. It stays local.
- Trusting "I didn't include names" without running the scan. Always scan.

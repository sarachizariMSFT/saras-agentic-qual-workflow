---
name: "uxr-intake"
description: "Interactive, artifact-by-artifact intake of everything a study needs, saved to findable files."
domain: "uxr-operations"
confidence: "high"
source: "manual"
tools:
  - name: "workiq-ask_work_iq"
    description: "Pulls internal M365 context (emails, meetings, chats, files) related to the study."
    when: "Only when the researcher opts in to auto-pulling internal notes/communications."
  - name: "ask_user"
    description: "Prompts the researcher for each artifact."
    when: "For every intake artifact, one at a time."
---

## Context
The Conductor runs this at study kickoff, before any analysis. Intake is interactive: ask for each artifact
one at a time, confirm, and save it to a predictable path. Nothing analytical happens until intake is complete
and the human passes Checkpoint 1.

## Patterns

### The intake checklist (ask one at a time)
Save everything under `studies/<study-id>/inputs/`:

| Artifact | File | Notes |
|---|---|---|
| Research goals | `inputs/research-goals.md` | Why the study exists. |
| Objectives | `inputs/objectives.md` | Specific questions to answer. |
| Hypotheses | `inputs/hypotheses.md` | Each gets an ID (H1, H2...) for later verdicts. |
| Observational notes | `inputs/observational-notes.md` | Moderator/observer notes. |
| Stakeholder notes | `inputs/stakeholder-notes.md` | What stakeholders care about. |
| Chats / async | `inputs/chats.md` | Slack/Teams threads, follow-ups. |
| Participant roster | `inputs/private/roster.json` | **Private.** name + company + session date/time + optional `role` (`participant`, `observer`, `facilitator`). Used to build codes; git-ignored, never in reports. |
| Sample reports | `inputs/style-samples/` | Required. At least one past report or writing sample so agents learn Sara's voice and structure. |
| Transcripts | `inputs/transcripts/` | Pulled DIRECTLY from Marvin (see `marvin-transcript-access`), then redacted to codes. |
| Participant roster | `inputs/participants.md` | IDs + segments, for frequency counts. |

### Procedure
1. Ask the researcher for the study id and a one-line study name. Create the folder from `studies/_TEMPLATE`.
2. For each checklist row, ask: "Do you have <artifact>? Paste it, point me to a file, or say skip."
3. Offer the WorkIQ option: "Want me to search your email/Teams/files for related internal notes?" If yes,
   use `workiq-ask_work_iq`, show what it found, and save confirmed items to the matching file.
4. Ask: "Do you have one or two past reports whose writing style you'd like the agents to match? Paste or point
   me to them." Save to `inputs/style-samples/`. At least one sample is required. Run
   `node lib/stylelint.mjs check-sample <studyRoot>` before CP1.
5. Pull transcripts via `marvin-transcript-access` and save raw text to `inputs/transcripts/`.
6. Privacy pass (skill `pii-redaction`): collect the private roster to `inputs/private/roster.json`, run
   `node lib/pii.mjs key <studyRoot>` to build codes + the public `inputs/participant-codes.md`, then
   `node lib/pii.mjs redact` over the saved transcripts so everything downstream uses codes, not names.
   Capture `role` for each person when known. Participants default to `participant`; observers and facilitators are
   still redacted, but they do not appear in public participant codes or saturation counts.
7. Write `inputs/intake-manifest.json`: list every artifact, its path, and a sha256 hash (for run reproducibility).
8. Generate the Checkpoint 1 dashboard and STOP for human approval.

### Findability rule
Predictable names, one artifact per file, hashes recorded. A teammate should find any input in under 10 seconds.

## Examples
- Hypotheses file uses `H1: Users abandon checkout because shipping cost appears too late.` so QA can score coverage per hypothesis id.

## Anti-Patterns
- Dumping all artifacts into one file. Keep them separate and named.
- Starting analysis before Checkpoint 1 approval.
- Using Marvin's Ask AI to summarize transcripts. Always pull raw transcript text.
- Skipping the writing-style sample. The style sample gate blocks when the configured sample is missing.

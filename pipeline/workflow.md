# UXR Pipeline — Workflow — v0.4.0

How the Conductor runs a study. This is the operational contract behind the `pipeline-orchestration`
skill. Loops are explicit and **capped at `config.json > loop.maxIterations` (default 10)**.

## Phases

### 0. Intake  (skill: `uxr-intake`)
- Interactive, artifact-by-artifact. Save to `studies/<id>/inputs/`.
- Transcripts pulled **directly** from Marvin (`marvin-transcript-access`), never Ask AI.
- **Privacy pass (skill `pii-redaction`):** collect the private roster (`inputs/private/roster.json`),
`node lib/pii.mjs key <studyRoot>` to assign each participant an **opaque code** (`P01`, `P02` …);
the session date/time lives **only** in the private crosswalk, never in the code itself. Then
`node lib/pii.mjs redact` the transcripts. A missing or empty participant key is a hard error —
`loadKey` fails closed, never silently skips. Set `UXR_PRIVATE_DIR` to keep the key file outside
synced folders. Downstream agents see **codes only**; the name/company crosswalk stays in
git-ignored `inputs/private/`.
- Roster entries include an optional `role`: `participant` (default), `observer`, or `facilitator`. The key maps
  participants to `P01...`, observers to `OBS01...`, and facilitators to `FAC01...`. Only participants land in the
  public `inputs/participant-codes.md` and count toward saturation. Observer and facilitator names are still redacted everywhere.
**Provenance gate (skill `provenance`):** `node lib/provenance.mjs check <studyRoot>` — each
transcript must have a provenance record, a sha256 that has not changed since export, and a
transcript-like structure (speaker labels + timestamps). This blocks an Ask-AI summary from
masquerading as a raw transcript. Provenance is checked at CP1 before analysis begins.
- Required: at least one writing-style sample in `inputs/style-samples/`. Run
  `node lib/stylelint.mjs check-sample <studyRoot>` before CP1. If the configured style sample is missing, the run blocks.
- Optional: WorkIQ pull for internal notes.
- `node lib/run.mjs hash <studyRoot>` writes `intake-manifest.json` (sha256 of every input).
- **▶ Human Checkpoint 1** — dashboard generated, run stops for approval.

### 1. Data Quality Check (Phase 1b)
- Data Integrity agent assesses all transcripts: speaker labels, timestamps, audio quality, task context, session metadata.
- Output: `00b-data-quality-report.json`. Part of CP1 gates.
- Hard gate: missing data or blocking issues prevent analysis (unless researcher overrides with caveat).

### 1b. Participant Narratives (Phase 1c, sequential)
- Participant Narrative agent reads each transcript, produces case summary: goals, expectations, breakdowns, mental models, emotional arc.
- Output: `01b-participant-narratives.json`. One summary per participant.
- This preserves individual stories *before* synthesis flattens them.
- Part of CP1 gates.

### 1c. Kickoff ceremony (before parallel analysis)
- Agents state what they'll look for + bias risks; brainstorm falsifiers and watch-items.
- Output: `runs/<model>/00-kickoff.md`. Part of CP1.

### 2. Evidence Extraction + Open Coding (Phase 2a-2b, PARALLEL)
**Evidence Extraction Agent (Phase 2b):**
- Reads all transcripts; produces centralized evidence bank: quote, participant, context, related behavior, interpretation, confidence.
- Output: `02b-evidence-bank.json`. All downstream analysis references this.

**Open Coding Agent (Phase 2a):**
- Reads all transcripts without pre-existing codebook; generates descriptive codes bottom-up.
- Output: `02-open-codes.json`. First-pass codebook with saturation stats.

### 2b. Empathy Building (Phase 2c, sequential — after the evidence bank)
- Empathy Builder reads participant narratives + the evidence bank and produces stakeholder-readable, evidence-grounded empathy: participant empathy snapshots, emotional-journey moments, empathy-centered finding language, and stakeholder empathy prompts.
- Output: `02c-empathy.json`. Every emotional claim is tied to a specific quote/behavior/timestamp — no invented feelings, no dramatizing.
- Its claims are subject to the **Challenge loop** (Devil's Advocate checks whether each empathy claim is fair and supported) before the Storyteller may use the approved empathy language.
- Feeds Synthesizer (human framing of themes) and Storyteller (narrative voice). Not a hard gate on producers.

### 2c. Analysis — PARALLEL producers (Phase 3)
Spawn all six at once (Squad: "Team, analyze…"), each reading transcripts + evidence bank:
`observed-behavior · verbatim · pain-points · papercuts · design-recommendations · powerful-moments`
Each writes its step file (`03…`, `04…`, `05…`, `06…`, `07…`, `08b…`).
In fast mode (`--fast`), the Conductor runs these six producers with a bounded, dependency-aware pool
(`config.json > run.fastMaxParallel`, default 4). As soon as one producer finishes, the next pending
producer starts. Gates and loop rules stay the same.
`config.json > analysis.nonParticipantSpeakers` lists speaker labels that are not participants. Analysis and
saturation exclude those labels, plus `OBS..` and `FAC..` codes, so observer, moderator, and product voice turns do
not inflate participant counts.

**Revision loop (per producer, capped at 10):**
```
produce -> node lib/evals.mjs <studyRoot> <model> <stepFile>
   pass -> node lib/loop.mjs attempt <studyRoot> <model> <step> pass   (status: done via runEvals → mergeIntoReport → recordAttempt)
   fail -> node lib/loop.mjs attempt <studyRoot> <model> <step> fail "<reason>"
           author revises the offending finding IDs, re-run evals
   at 10 failed attempts -> step 'blocked' + escalate_to_human (stop at nearest checkpoint)
                            use `loop.mjs unblock` with a human note to reset
```
`lib/conduct.mjs` enforces this contract — agents may not self-certify by writing `status: "done"` directly.
`hardPass` is `false` if any scheduled eval-bearing step is missing or failing.

### 3. Challenge — Devil's Advocate + Mental Model + Counterfactual (Phase 4, sequential)
**Devil's Advocate (Phase 4a):**
- Runs after all producers pass. Verdicts each finding `holds | weak | unsupported` (`06-devils-advocate.json`).
- **Now generates competing explanations** for major findings; flags ambiguous evidence.
- Runs the `interpretation_support` soft eval to flag over-reading. It challenges enumerated categories when the
  head noun is missing from cited quotes, and attribution claims when only said evidence exists without observed behavior.
- **Challenge loop (capped at 10):** `unsupported`/`weak` findings route back to their author to revise or drop, then re-challenge. Same circuit breaker.

**Mental Model Agent (Phase 4b):**
- Maps user assumptions vs. system reality; detects contradictions and model shifts.
- Output: `05b-mental-models.json`. Diagnoses root causes of friction.
- **Mental-model loop (capped at 10):** if the Synthesizer or Devil's Advocate finds an assumption-reality pair that is thinly evidenced or reads as user-error rather than a design gap, it routes back to the Mental Model Agent to refine the root-cause analysis, then re-check. Same circuit breaker (`config.json > loop.maxIterations`).

**Counterfactual (Phase 4c):**
- Enhanced as part of Devil's Advocate charter; alternative explanations now explicit in verdicts.

### 4. Synthesis — Synthesizer (Phase 5, sequential)
- Only synthesizes surviving findings. Reads participant narratives, codes, mental models, alternative explanations.
- Themes + `goal_coverage` (hypothesis verdicts) -> `07-synthesis.json`.
- QA/Evals synthesis gate.
- **Now participant-aware:** themes include coverage per participant, not flattened averages.

### 4a. Saturation — `07b-saturation` (sequential, after synthesis)
- `node lib/saturation.mjs <studyRoot> <model>` produces a sample-adequacy artifact: participants-cited / N,
  single-participant themes, new-code emergence curve, and adequacy flags.
- Surfaced on **CP2 dashboard** so the researcher can judge whether more sessions are needed before findings
  go into a report. Does not block the pipeline, but the artifact is required for CP2 sign-off.

- **▶ Human Checkpoint 2** — dashboard generated (includes saturation artifact), run stops for approval.

### 5b. Evidence verification — Evidence-Verifier (sequential, after saturation)
- Enforces `quote_exactness` + `quote_timestamp` + `clip_link` (hard gates) over every `said` quote across the
  surviving findings (skill `evidence-verification`).
- For each verbatim, derives start/end seconds from the timestamp and drives `marvin-clipper` to cut the clip,
  then writes `clip_url` + `clip_status: created` back into the evidence. Result -> `08b-evidence-verify.json`.
- `clip_status: "pending"` is accepted when `config.evidence.allowPendingClips` is `true` (e.g. Marvin clips are
  still being cut), but **pending never counts as created** — the run records it separately and pending clips must
  be resolved before final sign-off.
- **Verify loop (capped at 10):** inexact/untimestamped/unclipped quotes route back to the author (tighten the
  quote, add the timestamp) or to the clipper (cut the clip), then re-run. Same circuit breaker.
- Feeds the report/story only clip-backed, exact-quote evidence.

### 5c. Risk flagging — Risk-Flagger (sequential, after Evidence-Verifier)
- `node lib/risk.mjs scan <studyRoot> <model>` raises **risky-argument flags** (overgeneralization, causal claims,
  thin-support/high-impact recs, low-evidence/high-confidence, contradictions, sensitive topics, speculation,
  absolute recommendations) -> `08c-risk-flags.json` (skill `risk-flagging`).

### 5d. Product Implications — Product Implication Agent (Phase 6, sequential, after Risk-Flagger)
- Translates findings into design principles, opportunity areas, risks, and future research questions.
- Output: `08-product-implications.json`.
- Feeds into Storyteller (for narrative framing) and stakeholder summary.
- **Not feature recommendations; strategy and design principles.**
- **Not a hard gate** — it never blocks producers. But flags render on the CP2 + CP3 dashboards and **CP3 sign-off
  cannot close while any high-severity flag is still `open`.** The researcher triages each:
  `node lib/risk.mjs set <studyRoot> <model> <flagId> acknowledged|dismissed|fixed "note"`. Decisions persist across re-runs.

### 6. Reporting — PARALLEL: Editor + Storyteller (Phase 7)
- Editor: `09-report.md` (+ html). Storyteller: `09b-story.md` (+ html) + highlight-reel script.
- Every claim/argument must cite a finding whose evidence passed Evidence-Verifier (exact quote + timestamp + clip).
  Quotes render with their timestamp and a link to the Marvin `clip_url`.
- Now include product implications and design principles in narrative.
- Both match the required `inputs/style-samples/` voice (skill `humanizer`).
- Before the reconcile loop, the report and story must pass the hard style-lint gate:
  `node lib/stylelint.mjs lint <files>`. Hard style hits block reconciliation; soft hits surface as CP3 warnings.
- **Reconcile loop (capped at 10):** Editor and Storyteller must not contradict; iterate until consistent.
- **PII gate (hard, skill `pii-redaction`):** `node lib/pii.mjs scan <studyRoot>` scans **every run artifact**
  (not just the final report) and writes `runs/<model>/pii-report.json`. Results render as a CP2/CP3 dashboard
  banner. Any leaked name/company blocks — bounce to Editor/Storyteller. Set `UXR_PRIVATE_DIR` to keep the
  participant key outside synced folders.
- QA/Evals final gate.
- **Researcher-request gate:** `node lib/requests.mjs gate <studyRoot>` must pass before CP3 closes. Any open
  researcher ask keeps sign-off open until it is addressed.
- **▶ Human Checkpoint 3** — final sign-off. After approval, export deliverables with embedded Marvin clip links:
  `node lib/export.mjs deliverables <runDir>`.

### 7. Model runs + comparison
- By default, run phases 1–6 once with `config.json > run.primaryModel` (`opus-4.8`).
- `config.json > comparison.enabled` is `false` by default.
- Fast mode is off by default (`config.json > run.fastModeDefault=false`). Enable with `--fast` to speed
  Phase 3 producer scheduling without changing quality gates.
- Only start the `gpt-5.5` pass and `compare.mjs` when `config.json > run.dualModel` is `true`, or when the
  Conductor is invoked with `--dual`.
- In dual mode, run phases 1–6 twice with identical prompts, skills, and inputs.
- `node lib/compare.mjs <studyRoot>` -> `comparison/model-diff.{md,html}`.
- `verifyRuns()` asserts the two runs used **different models** and **identical input hashes** before
  trusting any agreement number. Comparison also reports best-match theme Jaccard (content agreement,
  not just type counts). Discloses `runsPerModel: 1`, because a single run per model conflates model effect
  with LLM sampling noise.

### 8. Retrospective ceremony -> learning loop
- At CP3, collect each human correction with `node lib/corrections.mjs add <studyRoot> --target <finding|agent|skill|eval|schema|workflow|config|data> --root <prompt|skill-gap|rubric|schema|data|model|process> --problem "..." --correction "..." --change "..." [--target-id <e.g. editor>] [--model <opus-4.8|gpt-5.5|both|n/a>] [--turn N]`.
- Apply durable fixes with `node lib/corrections.mjs apply <studyRoot> <COR-id> ["CHANGELOG ref"]`, then log them
  to `pipeline/CHANGELOG.md` and the affected agent's `history.md`.
- Reflect on disagreements + human corrections. Every action item -> a correction record. See `loop.md`.

## Commands cheat-sheet
```powershell
node lib/run.mjs init <id> "<name>"
node lib/run.mjs hash studies/<id>
node lib/run.mjs manifest studies/<id> opus-4.8
node lib/provenance.mjs check studies/<id>
node lib/stylelint.mjs check-sample studies/<id>
node lib/evals.mjs studies/<id> opus-4.8 studies/<id>/runs/opus-4.8/03-pain-points.json
node lib/saturation.mjs studies/<id> opus-4.8
node lib/risk.mjs scan studies/<id> opus-4.8
node lib/risk.mjs review studies/<id> opus-4.8
node lib/risk.mjs set studies/<id> opus-4.8 FLAG-004 fixed "added 'for the participants we spoke with' caveat"
node lib/journal.mjs show studies/<id> opus-4.8
node lib/loop.mjs attempt studies/<id> opus-4.8 03-pain-points fail "hallucination on PAIN-009"
node lib/loop.mjs state studies/<id> opus-4.8
node lib/loop.mjs unblock studies/<id> opus-4.8 03-pain-points "manually verified; quote confirmed in transcript"
node lib/dashboard.mjs studies/<id>
node lib/pii.mjs scan studies/<id>
node lib/stylelint.mjs lint studies/<id>/runs/opus-4.8/09-report.md studies/<id>/runs/opus-4.8/09b-story.md
node lib/requests.mjs add studies/<id> "what about settings defaults?" --turn 12
node lib/requests.mjs resolve studies/<id> REQ-001 "covered in the settings section"
node lib/requests.mjs list studies/<id> open
node lib/requests.mjs gate studies/<id>
node lib/export.mjs deliverables studies/<id>/runs/opus-4.8
node lib/corrections.mjs add studies/<id> --target skill --root rubric --problem "Severity was too high." --correction "Treat label-only issues as minor." --change "Update severity-scoring examples." --target-id severity-scoring --model both --turn 18
node lib/corrections.mjs list studies/<id> open
node lib/corrections.mjs apply studies/<id> COR-2026-07-08-01 "CHANGELOG 2026-07-08"
node lib/compare.mjs studies/<id>
node lib/server.mjs --port 4173
```

## Status semantics
`pending -> running -> done | failed | awaiting_human | blocked`
- `failed`: a hard gate failed this attempt (loop continues).
- `blocked`: loop cap reached — human must intervene.
- `awaiting_human`: a checkpoint is waiting on a person.
Never mark `done` without the output file present and its hard gates passing. A step reaches `done`
**only** via `runEvals → mergeIntoReport → recordAttempt` with the actual verdict (`lib/conduct.mjs`
enforces this — agents can't self-certify). Use `node lib/loop.mjs unblock <studyRoot> <model> <step> "<human note>"`
to reset a loop-capped step; the command requires a note, journals the override, and resets the attempt
budget — no hand-editing the manifest.

## Context hygiene (how we avoid context bloat)
State lives in **files, not in the conversation.** The engine is built so no agent has to hold the whole study in context:
- **File-based handoffs.** Each agent writes one step file and reads only the inputs it needs (its transcripts + upstream
  step files), never the whole history.
- **Manifest = status, not content.** `run-manifest.json` tracks step status/attempts; catching up means reading a few
  fields, not re-ingesting artifacts.
- **Run journal (periodic progress).** Every step attempt auto-appends one compact line to `runs/<model>/journal.md`
  (via `loop.mjs` → `journal.mjs`). To resume, read `node lib/journal.mjs show <studyRoot> <model>` — the last ~20 lines
  restore "where we are" cheaply. Add manual notes with `node lib/journal.mjs note …`.
- **Checkpoints + dashboards.** At CP1/CP2/CP3 the human reviews a rendered dashboard, not raw context.
- **Session checkpoints.** The build itself is checkpointed to `session-state/…/checkpoints/` so long sessions summarize
  and discard stale detail instead of growing unbounded.
- **Learning loop appends, doesn't accumulate in context.** Corrections go to `CHANGELOG.md` + agent `history.md`, read on demand.

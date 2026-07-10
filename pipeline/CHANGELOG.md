# Pipeline Changelog

The learning loop appends here whenever a correction changes an agent, skill, rubric, or schema.
Format: `YYYY-MM-DD · COR-id · files changed · one-line rationale`.

## 0.1.0 — initial pipeline
- 2026-07-08 · setup · 12 agents, 13 skills, schemas, evals, dashboards, dual-model compare, loop cap 10 · first build.
- 2026-07-08 · setup · +Powerful-Moments + Storyteller agents, +powerful-moments/storytelling skills, ceremonies (kickoff+retrospective) · reflect/learn additions.
- 2026-07-08 · setup · +Privacy agent + pii-redaction skill + lib/pii.mjs · code participants to session date/time, private crosswalk, final PII leak gate; roster to 13 agents / 14 skills.
- 2026-07-08 · setup · +Evidence-Verifier agent + evidence-verification skill · quote_exactness/quote_timestamp/clip_link hard gates + Marvin clip_url on evidence; roster to 14 agents / 15 skills.
- 2026-07-08 · setup · +Risk-Flagger agent + risk-flagging skill + lib/risk.mjs + lib/journal.mjs · human-review risk flags (8 categories, persist across re-runs) surfaced on CP2/CP3; run journal for context-bloat defense; roster to 15 agents / 16 skills.

## 0.2.0 — critical-audit hardening
Fixes the 26 findings from the multi-model (Opus 4.8 / GPT-5.5 / Gemini 3.1) skeptical audit. All 40
self-test assertions green (`node lib/selftest.mjs`). Every fix below is guarded by a regression test.

### Concurrency & fail-safe I/O
- 2026-07-09 · AUD-01/02 · +lib/fsx.mjs (readJSONSafe / writeJSONAtomic / withLock / updateJSON) · every shared-file writer (loop, evals, risk, run, pii, compare, dashboard) now uses an exclusive lockfile + atomic temp-rename read-modify-write, killing the parallel-producer lost-update race; every reader tolerates a corrupt/half-written artifact instead of aborting the whole build.

### Evidence integrity
- 2026-07-09 · AUD-03 · lib/evals.mjs · replaced order-insensitive token-SET quote coverage with a CONTIGUOUS longest-run measure — a quote recombined from words scattered across the transcript can no longer score 1.0 and slip past the hallucination gate.
- 2026-07-09 · AUD-04 · lib/evals.mjs + marvin-adapter.mjs (speakerText) · grounding, exact-quote and hallucination checks are now scoped to the CITED speaker's turns, so one participant's words can't back another's finding (falls back to the whole transcript only for unlabeled notes).
- 2026-07-09 · AUD-05 · lib/evals.mjs · new HARD frequency_integrity gate — an authored `frequency` may not exceed distinct supporters (evidence participants ∪ supporting_participants), stopping hand-typed counts from inflating severity/priority/risk.
- 2026-07-09 · AUD-06 · lib/marvin-adapter.mjs + evals.mjs + config.json · createClip() returns a `pending` placeholder instead of throwing; clip_link accepts clip_status:"pending" only when evidence.allowPendingClips=true and counts it separately, so the run isn't deadlocked before Marvin clips are cut and pending never reads as "created".
- 2026-07-09 · AUD-07 · lib/evals.mjs · new SOFT causal_support flag — a causal statement with no behavioral/observed evidence (and no explicit causal_strength) is surfaced for review.

### Privacy / PII
- 2026-07-09 · AUD-08 · lib/pii.mjs · codes are now OPAQUE (P01, P02 …); session date/time lives ONLY in the private crosswalk, so the code itself no longer re-identifies a participant.
- 2026-07-09 · AUD-09 · lib/pii.mjs · loadKey/scanFiles FAIL CLOSED — a missing/empty participant key is an error, never a silent "clean".
- 2026-07-09 · AUD-10 · lib/pii.mjs · +email/phone detectors and unknown-proper-noun review flags (possible third parties); ambiguous shared first names redact to [PARTICIPANT], never a wrong code; run-manifest.json excluded from scan-run (hashes only).
- 2026-07-09 · AUD-11 · lib/pii.mjs (scanRun) + dashboard.mjs · PII is scanned on EVERY run artifact (not just the final report) and rendered as a CP2/CP3 dashboard banner; +UXR_PRIVATE_DIR override to keep the key out of synced folders.

### Validity layer (representativeness, not just traceability)
- 2026-07-09 · AUD-12 · finding.schema.json · +supporting_participants, evidence_mode, causal_strength, alternative_explanations, representativeness, goal_coverage; evidence source_type; observation_type now REQUIRED (no silent "said" default).
- 2026-07-09 · AUD-13 · +lib/saturation.mjs + run.mjs (07b-saturation step) + dashboard.mjs · sample-adequacy artifact: participants-cited / N, single-participant themes, new-code emergence curve, adequacy flags — surfaced on CP2.
- 2026-07-09 · AUD-14 · lib/evals.mjs · coverage soft-gate credits refuted / insufficient_evidence verdicts, rewarding disconfirmation instead of only mapping findings onto expected stories (anti-confirmation-bias).

### Enforcement (conventions → controls)
- 2026-07-09 · AUD-15 · +lib/conduct.mjs · a step reaches "done" ONLY by going through runEvals → mergeIntoReport → recordAttempt with the ACTUAL hard-gate verdict; agents can no longer self-certify by writing status:"done".
- 2026-07-09 · AUD-16 · lib/evals.mjs (EVAL_REQUIRED_STEPS + mergeIntoReport) · run hardPass is false if any scheduled eval-bearing step is missing or failing, so a dropped step can't read as success.
- 2026-07-09 · AUD-17 · lib/loop.mjs · recordAttempt is lock-safe and resets the attempt budget on pass; +unblock() (and CLI) requires a human note, resets a loop-capped step, and journals the override — no more hand-editing the manifest.

### Risk tuning (fewer false alarms, no missed real risks)
- 2026-07-09 · AUD-18 · lib/risk.mjs · detectors judge the researcher's CLAIM (statement) only, not participant verbatims, so a "because" inside a quote no longer raises a causal flag.
- 2026-07-09 · AUD-19 · lib/risk.mjs · SENSITIVE anchor uses `disabilit\\w*` (dropped bare "disabled"/"gender") so the ubiquitous UI sense of "disabled" stops tripping the sensitive-topic detector.

### Provenance
- 2026-07-09 · AUD-20 · +lib/provenance.mjs · transcript provenance gate — each transcript needs a provenance record, an unmodified-since-export sha256, and a transcript-like structure (speaker labels + timestamps); CP1 blocks an Ask-AI summary masquerading as a raw transcript.

### Comparison validity
- 2026-07-09 · AUD-21 · lib/compare.mjs · verifyRuns() asserts the two runs used DIFFERENT models and IDENTICAL input hashes before trusting any agreement number; +best-match theme Jaccard (content agreement, not just type counts); discloses runsPerModel (n=1 conflates model effect with LLM sampling noise).

### Contracts & docs
- 2026-07-09 · AUD-22 · +schemas/checker.schema.json · structured verdict contract for the Devil's-Advocate / Evidence-Verifier (checker, finding_id, verdict, validity_threat, rationale, human_audit).
- 2026-07-09 · AUD-23..26 · lib/selftest.mjs rewritten (40 assertions), config.json (privacy/comparison/allowPendingClips blocks), pipeline_version 0.2.0, dashboards + charters/skills doc sync · lock in every fix and document it.

## 0.3.0 — agent roster reconciliation
- 2026-07-09 · DOC-01 · +.squad/agents/evidence-extraction/charter.md · created the missing Phase 2b Evidence Extraction charter (evidence-bank builder) that workflow.md, README, and the topology already referenced but had no charter on disk.
- 2026-07-09 · DOC-02 · workflow.md + README.md · wired the orphaned Empathy Builder (charter existed but was referenced nowhere) into Phase 2c, the team table, and the ASCII topology; its empathy claims run through the Devil's-Advocate challenge loop.
- 2026-07-09 · DOC-03 · docs/pipeline-explained.html + README.md · reconciled the agent count to 22 pipeline agents (+ ralph/scribe infra). Added the 7 agents missing from the HTML team roster (Data Integrity, Participant Narrative, Open Coding, Evidence Extraction, Empathy Builder, Mental Model, Product Implication); refreshed the topology diagram (upstream extract parallel + Mental Model in the sequential chain) and the loops table (added the mental-model loop, 5 total).
- 2026-07-09 · WIRE-01 · lib/run.mjs · **core gap fixed** — `scaffoldManifest` only scheduled 15 of the 22 agents, so the Conductor never actually ran Data Integrity, Participant Narrative, Open Coding, Evidence Extraction, Empathy Builder, Mental Model, or Product Implication. Added all 7 as manifest steps in phase order (00b/01b prep → 02b/02 extract → 02c empathy → six producers → 06/05b challenge → 07/07b synth → 08b/08c/08 verify-risk-implications → qa/report/story/pii). Manifest now emits 23 steps / 22 distinct agents.
- 2026-07-09 · WIRE-02 · lib/run.mjs · renamed step `08c-risk-check` → `08c-risk-flags` so the manifest output path matches what risk.mjs actually writes and what dashboard/README/workflow/charter/skill already reference (dangling `08c-risk-check.json` output removed).
- 2026-07-09 · WIRE-03 · lib/run.mjs + config.json + workflow.md + README.md + docs/pipeline-explained.html + lib/dashboard.mjs · bumped pipeline_version to 0.3.0 everywhere (manifest constant + live banners) to match config.json.
- 2026-07-09 · WIRE-04 · schemas/{quality,narrative,codes,mental-models,implications,empathy}.schema.json · created the 6 schema contracts the newer charters referenced but that did not exist on disk (only manifest/finding/checker were present).
- 2026-07-09 · WIRE-05 · .squad/agents/empathy-builder/charter.md · reconciled the empathy output contract to the canonical single file `02c-empathy.json` (`{ empathy_snapshots[], empathy_findings[] }`) instead of the stale two-file `02-empathy-snapshots.json` / `02b-empathy-findings.json` that collided with the Verbatim/Evidence step numbers.
- 2026-07-09 · WIRE-06 · workflow.md · documented the mental-model loop (Phase 4b) so all 5 config loops are described in the workflow; refreshed the HTML topology flow to include Data Integrity, Participant Narrative, Empathy Builder, and Product Implication nodes. Self-test 40/40; all 6 Mermaid diagrams render clean.

## 0.3.1 — comparison model swap
- 2026-07-09 · MODEL-01 · config.json + schemas/{finding,manifest}.schema.json + lib/{compare,dashboard,selftest}.mjs + _pilot.mjs · replaced the second comparison model `sonnet-4.6` → `gpt-5.5` across the engine: both config model arrays, the two model enums that gate findings/manifests, the compare fallback + banner, the dashboard MODELS list + diff label, and the self-test/pilot second-run fixtures (`r-sonnet` → `r-gpt`). Squad framework dev-agent model selection (`.github/agents`, `.squad/templates/**`) left untouched — that `claude-sonnet-4.6` is unrelated to the UXR comparison. Verified: self-test 40/40, end-to-end pilot 43/43.
- 2026-07-09 · MODEL-02 · workflow.md + README.md + docs/pipeline-explained.html + .squad/agents/conductor/charter.md + .squad/team.md + .squad/skills/{learning-loop,pipeline-orchestration}/SKILL.md · updated all prose/diagram references (incl. the comparison Mermaid node "Run on Sonnet 4.6" → "Run on GPT-5.5") to the new second model.



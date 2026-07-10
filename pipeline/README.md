# UXR Qualitative Analysis Pipeline — v0.3.0

A traceable, eval-gated, multi-agent pipeline that turns Marvin interview transcripts and study
artifacts into UXR findings, a report, and a story. It runs identically under **Claude Opus 4.8**
and **GPT-5.5**, then diffs the two. Every claim traces back to a transcript quote.

Built on the [Squad](https://github.com/bradygaster/squad) agent framework. Engine is zero-dependency Node.

---

## The team (22 agents)

| Agent | Role | Phase | Runs |
|---|---|---|---|
| **Conductor** | Orchestrator: routes, gates, records, owns analysis plan, dual-model | all | — |
| **Privacy** | PII Guardian: assigns opaque codes (P01, P02 …); blocks name/company leaks; scans every run artifact | intake + final gate | — |
| **Data Integrity** | Data quality guardian: assesses transcripts, flags issues, certifies readiness | preparation | sequential |
| **Participant Narrative** | Story preservation: case summaries per participant before synthesis | phase 1c | sequential |
| **Open Coding** | Inductive code generation: bottom-up codes from data | phase 2a | parallel |
| **Evidence Extraction** | Centralized evidence bank: quotes, behaviors, moments, with metadata | phase 2b | parallel |
| **Empathy Builder** | Evidence-grounded empathy: participant snapshots, emotional-journey maps, stakeholder empathy prompts | phase 2c | sequential |
| **Observed-Behavior** | What people *did* (behavioral evidence) | phase 3 | parallel |
| **Verbatim** | Representative quotes (voice of customer) | phase 3 | parallel |
| **Pain Points** | Meaningful pain, severity-scored | phase 3 | parallel |
| **Papercuts** | Small cumulative friction | phase 3 | parallel |
| **Design Recommendations** | Evidence-backed fixes, prioritized | phase 3 | parallel |
| **Powerful-Moments** | Emotional peaks, memorable moments, clip candidates | phase 3 | parallel |
| **Devil's Advocate** | Red-team every finding; generate competing explanations | phase 4a | sequential |
| **Mental Model** | Map assumptions vs. reality; diagnose root causes | phase 4b | sequential |
| **Synthesizer** | Themes, hypothesis verdicts, participant-aware prioritization | phase 5 | sequential |
| **QA/Evals** | Automated gates: schema, traceability, hallucination | gating | after each step |
| **Evidence-Verifier** | Every claim backed by an exact, timestamped, clip-linked quote | phase 5b | sequential |
| **Risk-Flagger** | Flags risky arguments for human review (not a block) | phase 5c | sequential |
| **Product Implication** | Translates findings → design principles, opportunity areas, risks | phase 5d | sequential |
| **Editor** + **Storyteller** | Report (factual) + narrative (arc, personas, highlight reel) | phase 7 | parallel |

Charters live in `.squad/agents/<name>/charter.md`. Skills in `.squad/skills/<name>/SKILL.md`.

## Topology

```
Intake (+ Privacy: assign opaque codes P01/P02…, redact transcripts; Provenance: sha256 + structure gate)
  └▶ Data Integrity: quality check, metadata extraction ─▶ [Human CP1]
       └▶ Participant Narratives (sequential, per participant)
            └▶ PARALLEL: Open Coding (bottom-up) · Evidence Extraction (centralized bank)
                 └▶ Empathy Builder (evidence-grounded empathy snapshots + emotional-journey maps)
                      └▶ PARALLEL: observed-behavior · verbatim · pain-points · papercuts · design-recommendations · powerful-moments
                      └▶ QA/Evals (hard gates per step)
                           └▶ Devil's Advocate (+ alternative explanations) ─▶ Mental Model (root cause) ─▶ Counterfactual
                                └▶ Synthesizer (participant-aware themes)
                                     └▶ QA/Evals (synthesis gate) ─▶ 07b-saturation (sample-adequacy artifact)
                                          └▶ [Human CP2 — includes saturation artifact]
                                               └▶ Evidence-Verifier (exact quote + timestamp + Marvin clip per claim)
                                                    └▶ Risk-Flagger (raise risky arguments for human review)
                                                         └▶ Product Implication (design principles, opportunity areas, risks)
                                                              └▶ PARALLEL: Editor + Storyteller
                                                                   └▶ Privacy PII gate (scans every run artifact) + QA/Evals (final gate) ─▶ [Human CP3 sign-off]
                                                                        └▶ Retrospective ceremony ─▶ learning loop
```

Run this whole flow **twice** (opus-4.8, gpt-5.5), then `compare.mjs` produces the model diff.

## Human checkpoints

1. **CP1 — after Intake:** goals/artifacts complete and correct; provenance gate passed for every transcript.
2. **CP2 — after Synthesis:** themes, hypothesis verdicts, contradictions before reporting; saturation artifact reviewed (participants-cited/N, single-participant themes, new-code emergence curve).
3. **CP3 — final sign-off:** approve report + story; triggers retrospective and optional clips.

The Conductor sets manifest status `awaiting_human` and generates a dashboard at each, then stops.

## Loops (bounded — cap 10)

Loops are explicit and capped by `config.json > loop.maxIterations` (default **10**), enforced by `lib/loop.mjs`:

| Loop | Cycle | On exhaustion |
|---|---|---|
| Revision | producer fails a hard gate → author revises → re-eval | step `blocked` → escalate to human |
| Challenge | Devil's Advocate marks `unsupported` or alternative explanations remain ambiguous → author revises → re-challenge | step `blocked` → escalate |
| Mental Model | Mental Model Agent flags root cause gaps → author revises narrative/codes → re-assess | escalate |
| Reconcile | Editor ↔ Storyteller until consistent | escalate |
| Learning | one pass per open correction record | escalate |

No loop grinds forever — a stuck step surfaces to a person. See `workflow.md` and `loop.md`.

## Evals (automated, deterministic)

Run by `lib/evals.mjs`. **Hard gates block; soft gates flag for the human.**
Gates are non-optional — `lib/conduct.mjs` enforces that a step reaches `done` only by going through
`runEvals → mergeIntoReport → recordAttempt` with the actual hard-gate verdict. An agent may not
self-certify by writing `status: "done"` directly. `hardPass` is `false` if any scheduled
eval-bearing step is missing or failing, so a dropped step can't read as success.

| Eval | Gate | Passes when |
|---|---|---|
| schema | hard | every finding validates `schemas/finding.schema.json` (`observation_type` required; `source_type` on evidence) |
| traceability | hard | every finding has >=1 evidence citation with a locator |
| hallucination | hard | every quote matches via **contiguous longest-run** in the **cited speaker's** turns (falls back to full transcript for unlabeled notes) |
| frequency_integrity | hard | authored `frequency` may not exceed distinct supporter count (`evidence` participants ∪ `supporting_participants`) |
| method_justification | hard | every finding justifies its method |
| quote_exactness | hard | every participant (`said`) quote is an **exact** verbatim substring of its transcript |
| quote_timestamp | hard | every `said` quote carries a timestamp locator (`hh:mm:ss` / `mm:ss`) |
| clip_link | hard | every `said` quote has a Marvin `clip_url`; `clip_status:"pending"` accepted when `config.evidence.allowPendingClips` is `true`, but pending never counts as created (`config.evidence.requireClips`) |
| coverage | soft | every hypothesis (H1, H2…) maps to >=1 finding; **refuted** and **insufficient_evidence** verdicts count toward coverage (disconfirmation is rewarded) |
| causal_support | soft | causal statements with no behavioral/observed evidence and no explicit `causal_strength` are flagged for review |
| calibration | soft | severity not inflated (>60% at level 5 flags) |
| recommendation_link | soft | every recommendation links to a finding |
| participant_coverage | soft | themes include coverage per participant (single-participant themes flagged separately) |
| alternative_explanation_ambiguity | soft | when Devil's Advocate generates competing explanations equally supported by evidence, finding is marked `ambiguous` or downgraded to `weak` |
| **pii_leak** | **hard** | **no real name or company appears in the report or story** (`lib/pii.mjs scan` runs over every run artifact, not just the final report; rendered as a CP2/CP3 dashboard banner) |

## Risk flags (human review, not a block)

The **Risk-Flagger** raises *risky arguments* — claims that may be true but are dangerous to publish or act on — for
you to triage. It runs `lib/risk.mjs` after the gates and writes `runs/<model>/08c-risk-flags.json`, rendered on the
CP2 + CP3 dashboards. It never blocks producers, but **CP3 sign-off can't close while a high-severity flag is `open`.**

| Category | Raised when |
|---|---|
| overgeneralization | absolute language, or a group claim from a tiny sample |
| causal_claim | causal phrasing on qualitative evidence |
| weak_support_high_impact | a recommendation on thin evidence |
| low_evidence_high_confidence | `confidence: high` but thin evidence |
| contradiction | the finding challenges / is challenged by another |
| sensitive_topic | legal / ethical / medical / compensation / discrimination / security wording |
| speculation | a hedge stated as a finding |
| absolute_recommendation | prescriptive "must / never" that may not be warranted |

Triage: `node lib/risk.mjs review <study> <model>` then `node lib/risk.mjs set <study> <model> <flagId> acknowledged|dismissed|fixed "note"`.
Decisions persist across re-runs (keyed by finding + category).

## Context hygiene (no context bloat)

State lives in **files, not the conversation**, so no agent must hold the whole study in context:
- **File handoffs** — each agent writes one step file and reads only what it needs.
- **Manifest = status** — resuming reads a few fields, not all artifacts.
- **Run journal** — every step attempt auto-appends one compact line to `runs/<model>/journal.md`
  (`node lib/journal.mjs show <study> <model>` restores "where we are" from the last ~20 lines).
- **Checkpoints + dashboards** — humans review rendered HTML, not raw context.
- **Session checkpoints** — long build sessions are checkpointed and summarized under `session-state/…/checkpoints/`.

## Folder layout

```
studies/<study-id>/
  inputs/                 research-goals, objectives, hypotheses, notes, chats, style-samples/, transcripts/
    private/              roster.json + participant-key.json (code↔name/company crosswalk) — GIT-IGNORED
    participant-codes.md  opaque codes (P01, P02 …) only — safe to share
    intake-manifest.json  sha256 of every input (reproducibility)
  runs/opus-4.8/          per-step outputs + run-manifest.json + 08-qa-evals.json + 08c-risk-flags.json + pii-report.json + journal.md
  runs/gpt-5.5/           same, second model
  comparison/             model-diff.md / .html
  dashboards/             self-contained HTML per checkpoint + index.html
  corrections/            learning-loop records
```

## Library modules

Key files in `pipeline/lib/` referenced throughout this doc:

| Module | Purpose |
|---|---|
| `lib/evals.mjs` | Automated hard/soft gates |
| `lib/fsx.mjs` | Safe I/O — `readJSONSafe`, `writeJSONAtomic`, `withLock`, `updateJSON` |
| `lib/conduct.mjs` | Enforcement — gates non-optional; `runEvals → mergeIntoReport → recordAttempt` contract |
| `lib/provenance.mjs` | Transcript provenance gate — sha256, speaker labels, timestamp structure |
| `lib/saturation.mjs` | Sample-adequacy artifact — participants-cited/N, single-participant themes, new-code emergence curve |
| `lib/pii.mjs` | PII coding (opaque P01/P02…), redaction, fail-closed key loading, run-wide scan |
| `lib/loop.mjs` | Attempt tracking, circuit breaker, `unblock` with human note |
| `lib/risk.mjs` | Risky-argument detection (researcher claims only) |
| `lib/journal.mjs` | Append-only run journal |
| `lib/compare.mjs` | Dual-model diff — `verifyRuns()`, best-match Jaccard, n=1 disclosure |
| `lib/run.mjs` | Study scaffolding, input hashing, manifest |
| `lib/dashboard.mjs` | HTML checkpoint dashboards with PII banner |
| `lib/marvin-adapter.mjs` | Transcript access, speaker-scoped text, clip creation with pending fallback |

## Quick start

```powershell
cd pipeline
node lib/selftest.mjs            # prove the engine works end-to-end

node lib/run.mjs init acme-checkout "ACME Checkout Study"   # scaffold a study
# ... intake fills studies/acme-checkout/inputs/ (see .squad/skills/uxr-intake) ...
node lib/pii.mjs key studies/acme-checkout                 # assign opaque codes P01, P02… (private crosswalk)
node lib/provenance.mjs check studies/acme-checkout        # verify transcript sha256 + structure before CP1
node lib/run.mjs hash studies/acme-checkout                 # hash inputs
node lib/run.mjs manifest studies/acme-checkout opus-4.8    # scaffold a run manifest
# ... agents produce runs/opus-4.8/*.json ...
node lib/evals.mjs studies/acme-checkout opus-4.8 studies/acme-checkout/runs/opus-4.8/03-pain-points.json
node lib/saturation.mjs studies/acme-checkout opus-4.8     # sample-adequacy artifact for CP2
node lib/risk.mjs scan studies/acme-checkout opus-4.8      # raise risky-argument flags for review
node lib/dashboard.mjs studies/acme-checkout               # build HTML dashboards (includes PII banner)
# repeat for gpt-5.5, then:
node lib/compare.mjs studies/acme-checkout                 # diff the two models (verifies different models + identical input hashes)
node lib/pii.mjs scan studies/acme-checkout                # PII leak gate — scans every run artifact -> pii-report.json
node lib/server.mjs --port 4173                            # live dashboard (rebuilds on load)
```

## How to run it with the agents

Ask Squad: **"Run the UXR pipeline on study `<id>` with both models."** The Conductor drives intake
(interactively), spawns the specialists per `workflow.md`, gates with QA/Evals, stops at the three
human checkpoints, and produces dashboards. See `workflow.md` for the exact orchestration and
`loop.md` for the learning loop.

## Marvin note

Transcripts are read **directly** (never Marvin's Ask AI) via `lib/marvin-adapter.mjs`. Hallucination and
grounding checks are scoped to the **cited speaker's turns** (`speakerText()`), so one participant's words
can't back another's finding. The Marvin MCP server isn't connected in this session yet, so the adapter
reads transcripts saved locally during intake. When Marvin MCP is attached, wire `fetchFromMarvin()` — the
saved-file contract stays identical, so nothing downstream changes.

# Sara's Agentic Qual Workflow

**A traceable, eval-gated, multi-agent pipeline that turns raw interview transcripts into findings, a report, and a story — with a researcher in the loop at every decision that matters.**

> v0.3.1 · 22 specialist agents · 16 skills · 13 automated evals · 3 human checkpoints · 2 models compared · loops capped at 10 · zero-dependency Node engine

---

## TL;DR

You hand the pipeline your research goals, hypotheses, and Marvin transcripts. A team of AI specialists reads the transcripts **directly** — one hunts behaviors, one pain points, one papercuts, one powerful moments, one quotes, one design fixes. A red-team agent tries to break every finding before a synthesizer weaves the survivors into themes. Automated gates check that every claim traces to an **exact, timestamped, video-clipped quote**, that nobody's real name leaked, and that we didn't overclaim from a thin sample. You approve at three checkpoints via an HTML dashboard. The whole thing runs twice — once on **Opus 4.8**, once on **GPT-5.5** — and we diff the two. Every correction feeds a **learning loop** that permanently improves the agents. Nothing grinds forever: every loop stops at 10 and asks a human.

---

## Table of Contents

1. [The Problem This Solves](#1-the-problem-this-solves)
2. [Six Design Principles](#2-six-design-principles)
3. [Big Picture Flow](#3-big-picture-flow)
4. [The Agent Team — 22 Specialists](#4-the-agent-team--22-specialists)
5. [Pipeline Topology — Why Parallel and Sequential](#5-pipeline-topology--why-parallel-and-sequential)
6. [Three Layers: Agents, Skills, and Engine](#6-three-layers-agents-skills-and-engine)
7. [Evals — The Gates That Make Output Trustworthy](#7-evals--the-gates-that-make-output-trustworthy)
8. [Human Checkpoints](#8-human-checkpoints)
9. [Loops — Self-Correcting, Never Runaway](#9-loops--self-correcting-never-runaway)
10. [Evidence and Clips — No Claim Without a Receipt](#10-evidence-and-clips--no-claim-without-a-receipt)
11. [Privacy and PII](#11-privacy-and-pii)
12. [Risk Flagging](#12-risk-flagging)
13. [Dual-Model Comparison](#13-dual-model-comparison)
14. [Saturation Check](#14-saturation-check)
15. [Context Hygiene](#15-context-hygiene)
16. [Ceremonies — Reflect Before and After](#16-ceremonies--reflect-before-and-after)
17. [The Learning Loop](#17-the-learning-loop)
18. [File and Folder Layout](#18-file-and-folder-layout)
19. [Library Modules](#19-library-modules)
20. [Quick Start](#20-quick-start)
21. [Running With the Agents](#21-running-with-the-agents)
22. [Commands Cheat Sheet](#22-commands-cheat-sheet)

---

## 1. The Problem This Solves

Qualitative analysis done by hand is slow. Qualitative analysis done by a single LLM is fast but untrustworthy. This pipeline is designed to give you the speed without surrendering the things a good researcher refuses to compromise on.

### What breaks with a naive "summarize my transcripts" prompt

- **Hallucinated quotes** — the model invents plausible-sounding verbatims.
- **Cross-contamination** — one participant's words get attributed to another.
- **Overclaiming** — "users want X" from a single session.
- **No traceability** — you can't get from a claim back to the moment it came from.
- **PII leaks** — real names and companies end up in a shareable deck.
- **Black box** — no way to see *where* in the process something went wrong.

### What this pipeline insists on instead

- Every claim → an **exact quote + timestamp + video clip**.
- Grounding scoped to the **cited speaker's own turns** — P07's words can't back P01's finding.
- Frequency claims can't exceed the number of people who actually said it.
- **De-identification at intake**, plus a leak check over every run artifact.
- **Human sign-off** at intake, after synthesis, and before publishing.
- Full **traceability and observability** — each step is its own file and its own dashboard panel.

> **Why a team of agents and not one big prompt?** Analysis quality goes up when each lens has a single, narrow job and a charter that says exactly what "good" looks like. A pain-points specialist that *only* hunts pain reasons more carefully than a generalist juggling six goals at once. It also makes the system observable: when something's off, you know exactly which agent and which step to inspect.

---

## 2. Six Design Principles

Every design decision traces back to one of these. When two approaches competed, the one that served these principles won.

| Principle | What it means in practice |
|---|---|
| **1. Traceability** | Every claim links to an exact quote, a timestamp, and a Marvin clip. No orphan assertions. |
| **2. Accuracy over fluency** | Hard gates block hallucinated or inflated claims even if the prose reads beautifully. |
| **3. Observability** | Each step is its own file; each checkpoint is an HTML dashboard. You can always see where we are and why. |
| **4. Human authority** | The machine drafts and gates; a person approves. Three checkpoints, plus risk flags that can hold sign-off. |
| **5. Bounded autonomy** | Loops are explicit and capped at 10. Nothing runs away; a stuck step surfaces to a human. |
| **6. Self-improvement** | Every correction becomes a durable fix to an agent, skill, or rubric — never a one-off patch. |

---

## 3. Big Picture Flow

The whole pipeline end to end. Blue diamonds are the moments a human takes over. Everything upstream of a checkpoint stops and waits for approval.

```
Intake (goals · hypotheses · transcripts · notes · style samples)
  └▶ Privacy: assign opaque codes P01/P02… · redact names/companies
       └▶ Provenance gate: sha256 + speaker labels + timestamps
            └▶ ◆ Human CP1 — inputs correct?
                 └▶ Kickoff ceremony (state biases · brainstorm falsifiers)
                      └▶ Data Integrity → Participant Narratives
                           └▶ PARALLEL: Open Coding · Evidence Extraction
                                └▶ Empathy Builder
                                     └▶ PARALLEL: Observed-Behavior · Verbatim · Pain Points · 
                                       Papercuts · Design Recs · Powerful Moments
                                          └▶ QA/Evals (hard gates per step)
                                               └▶ Devil's Advocate (red-team every finding)
                                                    └▶ Mental Model (root cause mapping)
                                                         └▶ Synthesizer (themes · hypothesis verdicts)
                                                              └▶ QA/Evals (synthesis gate)
                                                                   └▶ Saturation artifact (sample adequacy)
                                                                        └▶ ◆ Human CP2 — themes + saturation OK?
                                                                             └▶ Evidence-Verifier (exact quote + timestamp + Marvin clip)
                                                                                  └▶ Risk-Flagger (raise risky arguments)
                                                                                       └▶ Product Implication (design principles · opportunity areas)
                                                                                            └▶ PARALLEL: Editor (report) · Storyteller (story + reel)
                                                                                                 └▶ Privacy PII gate (scan every artifact)
                                                                                                      └▶ QA/Evals (final gate)
                                                                                                           └▶ ◆ Human CP3 — sign-off
                                                                                                                └▶ Retrospective → learning loop
```

Then the **entire path runs a second time** on the other model. `compare.mjs` diffs the two runs.

---

## 4. The Agent Team — 22 Specialists

The design goal: enough agents that each has a single sharp job; not so many that they trip over each other.

### Orchestration and Safety

| Agent | Job | Why it's separate |
|---|---|---|
| **Conductor** | Routes work, enforces gates, records status, owns the analysis plan, runs both models. | Someone has to own the run and the checkpoints. Keeping orchestration out of the analysts keeps them focused on their one job. |
| **Privacy** | Assigns opaque codes (P01, P02…), redacts transcripts, blocks name/company leaks, scans every run artifact. | De-identification is a safety function, not an analysis one — it must gate independently and fail closed. |

### Preparation and Grounding *(sequential)*

| Agent | Job | Why it's separate |
|---|---|---|
| **Data Integrity** | Assesses all transcripts: speaker labels, timestamps, audio quality, task context, session metadata. Flags issues, certifies readiness. | Bad qualitative analysis starts with messy data. Quality is a gate, not an afterthought. |
| **Participant Narrative** | One structured case summary per participant — goals, expectations, breakdowns, mental models, emotional arc — *before* synthesis flattens them. | Preserves each person's story so the team doesn't abstract into themes prematurely. Individual voices matter. |

### Coding and Evidence — The Parallel Pair *(parallel)*

| Agent | Job | Why it's separate |
|---|---|---|
| **Open Coding** | Bottom-up descriptive codes straight from the data — no pre-existing framework. | Protects the inductive process. Lets the data speak before anyone jumps to polished themes. |
| **Evidence Extraction** | Builds the centralized evidence bank: quotes, behaviors, contradictions, confidence levels, with metadata. All downstream agents cite this. | A finding is only as strong as its evidence. One owner for the bank keeps the analysis from becoming vibes. |

### Experience *(sequential)*

| Agent | Job | Why it's separate |
|---|---|---|
| **Empathy Builder** | Translates evidence into stakeholder-readable empathy — participant snapshots, emotional-journey maps, empathy prompts — grounded in exact quotes, never invented or dramatized. | Empathy ≠ storytelling. It makes the analysis more human without becoming less rigorous. Its claims are red-teamed like any other finding. |

### Analysis — The Six Parallel Lenses *(parallel)*

| Agent | What it hunts for |
|---|---|
| **Observed-Behavior** | What people actually *did* — task outcomes, workarounds, behavioral evidence (not opinions). |
| **Verbatim** | Representative quotes — the true voice of the customer, attributed and timestamped. |
| **Pain Points** | Meaningful pain and blockers, severity-scored. |
| **Papercuts** | Small cumulative friction — the quick wins that add up. |
| **Design Recommendations** | Evidence-backed fixes, prioritized against findings. |
| **Powerful-Moments** | Emotional peaks, memorable moments, powerful stories — the clip-worthy highlights. |

> **Why these six specifically?** They map to the distinct products a researcher actually ships: evidence, voice, problems (big and small), solutions, and the human moments that make a readout land. Pain vs. papercut is a deliberate split — conflating "this blocked me" with "this annoyed me" is one of the most common analysis errors, so each gets its own owner and its own severity rubric.

### Challenge and Synthesis *(sequential)*

| Agent | Job | Why it runs alone, in order |
|---|---|---|
| **Devil's Advocate** | Red-teams every finding *and every empathy claim*: `holds / weak / unsupported`, plus 2–3 competing explanations for major findings. | You can't challenge findings before they exist. It needs the full set to spot sampling bias and contradictions. |
| **Mental Model** | Maps what users *assumed* vs. how the system actually works; diagnoses the root cause behind friction. | A lot of AI-product friction is model mismatch, not usability. Different root cause, different fix — so it earns its own pass. |
| **Synthesizer** | Themes, hypothesis verdicts, participant-aware prioritization — only over surviving findings. | Synthesis is inherently holistic; it must see everything that passed the challenge before weaving themes. |

### Implications *(sequential)*

| Agent | Job | Why it's separate |
|---|---|---|
| **Product Implication** | Translates surviving findings into design principles, opportunity areas, risks, and future research questions. | Keeps analysis tied to real product decisions — and makes that leap explicit rather than smuggling it into a finding. |

### Gating

| Agent | Job |
|---|---|
| **QA / Evals** | Runs the automated eval suite after each step — schema, traceability, hallucination, frequency integrity, coverage. |
| **Evidence-Verifier** | Proves every claim has an exact, timestamped, clip-linked quote; drives Marvin to cut the clip. |
| **Risk-Flagger** | Raises risky arguments for human review (overreach, causal claims, sensitive topics). Not a block — a flag. |

### Reporting *(parallel)*

| Agent | Job |
|---|---|
| **Editor** | The factual report, in the researcher's own voice (learned from style samples in `inputs/style-samples/`). |
| **Storyteller** | Narrative arc, participant journeys, and a highlight reel built from the powerful moments. |

> **Why two writers?** A report and a narrative serve different audiences. They write in parallel, then go through a reconcile loop until they don't contradict each other.

A background **Scribe** logs sessions automatically — it never needs routing and never blocks.

Charters live in [`.squad/agents/<name>/charter.md`](.squad/agents/). Skills live in [`.squad/skills/<name>/SKILL.md`](.squad/skills/).

---

## 5. Pipeline Topology — Why Parallel and Sequential

The single biggest orchestration decision was which agents run at once and which must wait. The answer is a hybrid — because the work genuinely has both shapes.

**Parallel** when work is independent: the evidence extraction and open coding agents both read raw transcripts and neither needs the other. The six analysis lenses run together — pain points don't need papercuts to finish first. Same for the two writers at the end. Running each burst concurrently is faster *and* keeps each agent's context small.

**Sequential** when work depends on a whole: you can't challenge findings before they exist, can't map mental models against unchallenged findings, can't synthesize before the challenge runs, and can't verify evidence before synthesis picks the survivors. These stages need everything upstream, so they run one after another.

```
[Sequential: data readiness]
  Data Integrity → Participant Narrative

[Parallel: extract]
  Evidence Extraction ↔ Open Coding

[Sequential: experience]
  Empathy Builder

[Parallel: analysis — all six at once]
  Observed-Behavior ↔ Verbatim ↔ Pain Points ↔ Papercuts ↔ Design Recs ↔ Powerful Moments

[Sequential: challenge → root cause → synthesis → verify → flag → implications]
  Devil's Advocate → Mental Model → Synthesizer → Evidence-Verifier → Risk-Flagger → Product Implication

[Parallel: reporting]
  Editor ↔ Storyteller
```

> **Why not just run everything in parallel?** Because correctness depends on order. Synthesis over unchallenged findings would bake in weak claims; verifying evidence before synthesis picks survivors would waste effort clipping quotes we're about to drop. The hybrid gets parallel speed where it's safe and sequential rigor where it's required.

There's a third axis of parallelism: the whole pipeline runs **twice**. Everything above executes once on Opus 4.8 and once on GPT-5.5 — a meta-parallel across models that we diff afterward.

---

## 6. Three Layers: Agents, Skills, and Engine

People often ask why there are "skills" *and* "agents" *and* a bunch of `.mjs` files. Each layer answers a different question.

| Layer | Answers | Lives in | Example |
|---|---|---|---|
| **Agent charter** | *Who* does the work and how they should think. | `.squad/agents/<name>/charter.md` | Pain-Points' rubric and boundaries |
| **Skill** | *How* to perform a reusable technique, shareable across agents. | `.squad/skills/<name>/SKILL.md` | `severity-scoring`, `storytelling-method` |
| **Engine module** | The *deterministic* checks a model must not be trusted to do by vibes. | `pipeline/lib/*.mjs` | `evals.mjs`, `pii.mjs` |

> **Why push gates into code instead of prompts?** A model asked "did every quote appear verbatim?" will sometimes say yes when it shouldn't. The same check in `evals.mjs` — a contiguous longest-run substring match scoped to the cited speaker — gives the *same answer every time*. Determinism is what makes the gates trustworthy and the runs reproducible. Skills and charters guide judgment; the engine enforces facts.

### The 16 skills

`uxr-intake` · `marvin-transcript-access` · `pii-redaction` · `evidence-coding` · `severity-scoring` · `powerful-moments-detection` · `synthesis-method` · `devils-advocate-method` · `evidence-verification` · `eval-rubrics` · `traceability-contract` · `risk-flagging` · `storytelling-method` · `humanizer` · `learning-loop` · `pipeline-orchestration`

---

## 7. Evals — The Gates That Make Output Trustworthy

[`lib/evals.mjs`](pipeline/lib/evals.mjs) runs a deterministic suite after each step. **Hard gates block** and force a revision loop. **Soft gates flag** for the human but don't stop the run.

| Eval | Gate | Passes when… |
|---|---|---|
| `schema` | **HARD** | Every finding validates `schemas/finding.schema.json` (`observation_type` required; `source_type` on evidence). |
| `traceability` | **HARD** | Every finding has ≥1 evidence citation with a locator. |
| `hallucination` | **HARD** | Every quote matches via **contiguous longest-run** in the **cited speaker's own turns** (falls back to full transcript only for unlabeled notes). |
| `frequency_integrity` | **HARD** | Authored `frequency` never exceeds the distinct count of people who actually said it (evidence participants ∪ supporting_participants). |
| `method_justification` | **HARD** | Every finding justifies its method. |
| `quote_exactness` | **HARD** | Every participant quote is an exact verbatim substring of its transcript — no paraphrasing. |
| `quote_timestamp` | **HARD** | Every quote carries a timestamp locator (`hh:mm:ss` / `mm:ss`). |
| `clip_link` | **HARD** | Every quote has a Marvin `clip_url`. `clip_status:"pending"` accepted when `config.evidence.allowPendingClips` is `true`, but pending never counts as created. |
| `pii_leak` | **HARD** | No real name or company appears in any run artifact. |
| `coverage` | soft | Every hypothesis maps to ≥1 finding. **Refuted and `insufficient_evidence` verdicts count** — disconfirmation is rewarded, not penalized. |
| `causal_support` | soft | Causal claims lacking behavioral evidence and no explicit `causal_strength` are flagged for review. |
| `calibration` | soft | Severity isn't inflated (>60% of findings at level 5 flags). |
| `recommendation_link` | soft | Every recommendation links to a finding. |
| `participant_coverage` | soft | Themes include coverage per participant; single-participant themes are flagged separately. |

### Two subtle decisions worth calling out

**Speaker-scoped hallucination.** A quote is only "real" if it appears in the *cited speaker's own turns* — not just somewhere in the transcript. This kills the classic error of attributing P07's words to P01. The `speakerText()` function in `lib/marvin-adapter.mjs` isolates exactly those turns.

**Disconfirmation is rewarded.** A hypothesis that comes back *refuted* still counts as covered. The pipeline should never feel pressure to "find support" — killing a wrong hypothesis is a win, and the coverage rule encodes that.

### Gates are non-optional by construction

[`lib/conduct.mjs`](pipeline/lib/conduct.mjs) enforces that a step only reaches `done` by going through `runEvals → mergeIntoReport → recordAttempt` with the real hard-gate verdict. An agent can't self-certify by writing `status:"done"` directly. A *missing* eval-bearing step also makes the run-level `hardPass` false — so a dropped step can't quietly read as success.

---

## 8. Human Checkpoints

The pipeline puts humans exactly where judgment beats automation — and nowhere else. Three checkpoints. At each, the Conductor sets status to `awaiting_human`, renders an HTML dashboard, and stops.

| Checkpoint | After | What you're deciding |
|---|---|---|
| **CP1 — Intake** | De-identify + provenance gate | Are the goals, hypotheses, and transcripts complete and correct? Did every transcript pass the provenance check? |
| **CP2 — Synthesis** | Themes + saturation artifact | Do the themes and hypothesis verdicts hold up? Is the sample adequate, or do you need more sessions before reporting? |
| **CP3 — Sign-off** | Report + story + PII leak scan | Approve the final report and story. Triggers the retrospective ceremony and optional clip cutting via Marvin. |

> **Why three and not more (or fewer)?** These are the three moments where a wrong call is expensive and hard to undo: bad inputs poison everything downstream (CP1), a wrong theme becomes a wrong recommendation (CP2), and anything published is public (CP3). Adding checkpoints between every agent would just turn the researcher into a bottleneck.
>
> One special rule: **CP3 cannot close while any high-severity risk flag is still `open`** — the one place where a flag becomes a soft block.

---

## 9. Loops — Self-Correcting, Never Runaway

The pipeline fixes its own mistakes through explicit loops. Every one is capped at **10 iterations** (`config.json → loop.maxIterations`, enforced by [`lib/loop.mjs`](pipeline/lib/loop.mjs)). Hit the cap and the step goes `blocked` and surfaces to a human — it never grinds.

### The five loops

| Loop | Cycle | On exhaustion (10 attempts) |
|---|---|---|
| **Revision** | Producer fails a hard gate → author revises the flagged finding IDs → re-eval | Step `blocked` → escalate to human |
| **Challenge** | Devil's Advocate marks `unsupported`/`weak` → author revises or drops → re-challenge | Step `blocked` → escalate |
| **Mental-model** | Mental Model Agent refines root-cause analysis when a friction pattern is thinly evidenced | Escalate |
| **Reconcile** | Editor ↔ Storyteller iterate until they don't contradict each other | Escalate |
| **Learning** | One pass per open correction record | Escalate |

### Step status semantics

```
pending → running → done | failed | awaiting_human | blocked
```

- `failed` — a hard gate failed this attempt; the loop continues.
- `blocked` — loop cap reached; a human must intervene.
- `awaiting_human` — a checkpoint is waiting on a person.

A step can only reach `done` via `runEvals → mergeIntoReport → recordAttempt` with a passing verdict. Use `node lib/loop.mjs unblock <studyRoot> <model> <step> "<human note>"` to reset a loop-capped step. The command requires a note, journals the override, and resets the attempt budget — no hand-editing the manifest.

> **Why cap at 10, and why require a human note to unblock?** A cap guarantees termination — no infinite spend, no silent thrash. But we don't just fail hard: `loop.mjs unblock` lets a human reset the budget *with a required note* that's journaled. An override is always a deliberate, logged human decision, never a hidden manifest edit.

---

## 10. Evidence and Clips — No Claim Without a Receipt

This is the heart of the trust model. The **Evidence-Verifier** proves that every participant quote backing a claim is **exact**, **timestamped**, and **clip-linked** — then drives Marvin to actually cut the clip.

1. For every `said` quote, confirm it's an exact substring of the cited speaker's own transcript turns.
2. Confirm it carries a real timestamp (`mm:ss` or `hh:mm:ss`).
3. Derive start/end seconds and drive `marvin-clipper` to cut a clip; write `clip_url` + `clip_status: created` back into the evidence.
4. Anything inexact, untimestamped, or unclipped routes back to the author or clipper (capped at 10).
5. Only clip-backed, exact-quote evidence flows into the report and story.

**Pending clips, handled honestly.** Because the Marvin MCP isn't wired in every session, `allowPendingClips:true` lets a run proceed with `clip_status:"pending"` — but pending never counts as created. The run records it separately and pending clips must be resolved before final sign-off.

Transcripts are always read **directly** via [`lib/marvin-adapter.mjs`](pipeline/lib/marvin-adapter.mjs) — never through Marvin's Ask AI. When Marvin MCP is attached, wire `fetchFromMarvin()` in the adapter; nothing downstream changes.

---

## 11. Privacy and PII

The requirement was precise: a researcher must be able to trace `P01` back to the exact person and session, but **a real name or company must never appear in a shareable file.**

### How it works

```
Private roster (name · company · session date/time)
  → pii.mjs key → participant-key.json [GIT-IGNORED]
                 → Opaque codes P01, P02, P03…
                      → Redacted transcripts + every downstream artifact
                           → pii.mjs scan over every run file
                                → clean: report and story safe to share
                                → leak found: hard block → bounce to Editor/Storyteller
```

### The key decision: opaque codes, not date-encoded ones

An earlier design encoded the session as `P-YYYYMMDD-HHMM` — convenient, but that's a *quasi-identifier*: a date and time can re-identify someone. Codes are now purely opaque (`P01, P02…`), and the date/time-to-person mapping lives **only** in the git-ignored crosswalk. An authorized human can still trace `P01` to the real session; no shareable file can.

### Three more safety choices baked in

- **Fail closed.** A missing or empty participant key is a hard error, not a silent skip. `loadKey` always fails closed.
- **Scan everything.** The leak check runs over *every* run artifact — not just the final report — and renders as a CP2/CP3 dashboard banner.
- **Extra detectors.** Beyond roster names, [`lib/pii.mjs`](pipeline/lib/pii.mjs) catches emails, phone numbers, and flags unknown proper nouns (possible third parties) for human review.

Set `UXR_PRIVATE_DIR` to keep the participant key file outside synced folders.

---

## 12. Risk Flagging

Some claims can be *true* yet dangerous to publish or act on. The **Risk-Flagger** ([`lib/risk.mjs`](pipeline/lib/risk.mjs)) raises these for human triage. It never blocks a producer — but a high-severity flag left `open` holds CP3 sign-off.

| Category | Raised when… |
|---|---|
| `overgeneralization` | Absolute language, or a group claim from a tiny sample. |
| `causal_claim` | Causal phrasing on qualitative evidence. |
| `weak_support_high_impact` | A recommendation resting on thin evidence. |
| `low_evidence_high_confidence` | `confidence:high` but thin evidence. |
| `contradiction` | The finding challenges or is challenged by another. |
| `sensitive_topic` | Legal / ethical / medical / compensation / discrimination / security wording. |
| `speculation` | A hedge stated as a finding. |
| `absolute_recommendation` | Prescriptive "must / never" that may not be warranted. |

Triage each flag: `acknowledged`, `dismissed`, or `fixed` with a note. **Your decisions persist across re-runs**, keyed by finding + category, so you never re-triage the same thing twice.

> **Why a flag and not a block?** Blocking every risky-sounding claim would gut honest findings — sometimes the sample *is* small and you want to say so. The right control is a human judgment call, surfaced clearly on the dashboard, with the one guardrail that you can't ship (CP3) while a high-severity flag is unresolved.

---

## 13. Dual-Model Comparison

The exact same pipeline runs twice: once on **Opus 4.8**, once on **GPT-5.5** — identical prompts, skills, and inputs. Then [`compare.mjs`](pipeline/lib/compare.mjs) diffs them.

```
Same study inputs (identical sha256 hashes)
  → Run on Opus 4.8
  → Run on GPT-5.5
       → verifyRuns(): different models? identical input hashes?
            → yes: compare.mjs → best-match theme Jaccard + agreements/divergences → model-diff.md / .html
            → no: refuse to trust the diff
```

### Why verify before trusting agreement?

A comparison is only meaningful if the two runs really used *different models* on *identical inputs*. `verifyRuns()` asserts both before reporting any agreement number. And we're honest about the limit: with `runsPerModel:1`, a single run per model mixes the model effect with normal LLM sampling noise — the diff is disclosed as a single-run snapshot. Bump `runsPerModel` in `config.json` to separate the two.

The comparison also uses **best-match theme Jaccard** — content agreement, not just type counts — so two themes with different labels but the same underlying evidence register as agreement.

---

## 14. Saturation Check

Before findings become a report, [`lib/saturation.mjs`](pipeline/lib/saturation.mjs) produces a sample-adequacy artifact and puts it on the CP2 dashboard. It doesn't block — it informs a human judgment.

- **Participants cited / N** — how much of your sample actually shows up in the findings.
- **Single-participant themes** — themes resting on just one voice (fragile; flagged separately).
- **New-code emergence curve** — are you still discovering new codes, or has the signal plateaued?

> **Why surface this at all?** The most common qualitative sin is reporting a confident theme from too few sessions. Rather than let the pipeline pretend a thin sample is solid, we hand the researcher the evidence to decide "ship it" or "run three more sessions" — at exactly the moment (CP2) when that call is cheap to make.

---

## 15. Context Hygiene

A big risk with multi-agent LLM systems is that context balloons until quality craters. The answer: **state lives in files, not in the conversation.** No agent ever has to hold the whole study in its head.

| Mechanism | What it does |
|---|---|
| **File handoffs** | Each agent writes one step file and reads only the inputs it needs — its transcripts and the specific upstream files, never the whole history. |
| **Manifest = status** | `run-manifest.json` tracks step status and attempt counts. Resuming means reading a few fields, not re-ingesting artifacts. |
| **Run journal** | Every step attempt auto-appends one compact line to `journal.md`. `journal.mjs show` restores "where we are" from ~20 lines. Add manual notes with `node lib/journal.mjs note`. |
| **Dashboards** | Humans review rendered HTML at checkpoints, not raw context. |
| **Session checkpoints** | Long build sessions get checkpointed and summarized so stale detail is discarded instead of accumulating. |
| **Learning loop appends** | Corrections go to the changelog + agent `history.md`, read on demand — not carried in context. |

---

## 16. Ceremonies — Reflect Before and After

Two lightweight team meetings bracket the analysis. They keep the agents honest going in and turn every run into learning coming out.

### Kickoff and Brainstorm *(before parallel analysis)*

Right after intake, before the specialists spawn. Each agent states what it'll look for and its known bias risks. The team brainstorms: what would surprise us? What would *falsify* each hypothesis? What moments should Powerful-Moments watch for? Output → `runs/<model>/00-kickoff.md`, part of CP1.

> **Why bother with a kickoff in an automated system?** It forces agents to *pre-register* what they're testing and how they could be wrong — the single best defense against confirmation bias.

### Retrospective and Learn *(after CP3 or any correction)*

What did the two models disagree on, and who was right? Which findings did the human correct, and why? Root cause: prompt, skill, rubric, or schema? Each action item becomes a structured correction record that feeds the learning loop.

---

## 17. The Learning Loop

Every correction becomes a **durable** change to an agent, skill, rubric, or schema — never a one-off patch. See [`pipeline/loop.md`](pipeline/loop.md) for the full protocol.

### Each cycle (one pass per correction, bounded at 10)

1. **Collect.** Read open records in `studies/<id>/corrections/*.json`.
2. **Diagnose.** Classify `root_cause`: `prompt | skill-gap | rubric | schema | data | model`.
3. **Apply the smallest durable fix** to the right artifact:
   - `prompt` / behavior → the agent's `.squad/agents/<name>/charter.md`
   - `skill-gap` → the relevant `.squad/skills/<name>/SKILL.md`
   - `rubric` → `severity-scoring` or `eval-rubrics`, and thresholds in `config.json`
   - `schema` → `pipeline/schemas/finding.schema.json` (run Design Review first)
   - `data` → intake procedure in `uxr-intake`
   - `model` → note it; prefer fixes that help both runs
4. **Log.** Append to [`pipeline/CHANGELOG.md`](pipeline/CHANGELOG.md): date, correction id, files changed, one-line rationale.
5. **Remember.** Append the learning to the affected agent's `history.md`.
6. **Close.** Mark the correction record `applied`.
7. **Guard.** If the change touches a shared contract (schema, eval rubric, workflow), run Design Review.

### Model-comparison feedback

When the two models disagree and the human picks a winner, capture *why* as a correction. Usually the fix — a clearer rubric, a tighter charter — improves both runs. Only diverge prompts for a documented model quirk.

---

## 18. File and Folder Layout

```
studies/<study-id>/
  inputs/
    research-goals, objectives, hypotheses, notes, chats, style-samples/
    private/                  ← roster.json + participant-key.json (code↔name crosswalk) — GIT-IGNORED
    participant-codes.md      ← opaque codes (P01, P02…) only — safe to share
    intake-manifest.json      ← sha256 of every input (reproducibility)
    transcripts/              ← redacted transcripts
  runs/
    opus-4.8/
      00-kickoff.md           ← kickoff ceremony
      00b-data-quality-report.json
      01-observed-behavior.json
      01b-participant-narratives.json
      02-open-codes.json
      02-verbatim.json
      02b-evidence-bank.json
      02c-empathy.json
      03-pain-points.json
      04-papercuts.json
      05-design-recommendations.json
      05b-mental-models.json
      06-devils-advocate.json
      06b-powerful-moments.json
      07-synthesis.json
      08-product-implications.json
      08-qa-evals.json
      08b-evidence-verify.json
      08c-risk-flags.json
      09-report.md / .html
      09b-story.md / .html
      journal.md
      pii-report.json
      run-manifest.json
      saturation.json
    gpt-5.5/                  ← same structure, second model
  comparison/
    model-diff.md
    model-diff.html
  dashboards/
    index.html                ← study overview
    *-cp1-intake.html         ← per-model checkpoint dashboards
    *-cp2-analysis.html
    *-cp3-final.html
  corrections/                ← learning-loop records (one json per correction)

pipeline/
  lib/                        ← engine modules (see §19)
  schemas/                    ← JSON schemas for every output type
  docs/
    pipeline-explained.html   ← interactive HTML walkthrough (this doc in visual form)
  config.json                 ← all tunable thresholds and switches
  package.json
  workflow.md                 ← step-by-step operational contract
  loop.md                     ← learning-loop protocol
  CHANGELOG.md                ← append-only correction log

.squad/
  agents/<name>/
    charter.md                ← who this agent is + how it thinks
    history.md                ← learning-loop memory for this agent
  skills/<name>/SKILL.md      ← reusable techniques
  config.json                 ← squad configuration
  team.md                     ← team roster and routing
  decisions.md                ← design decision log
  ceremonies.md               ← ceremony protocols

.github/
  agents/squad.agent.md
  workflows/                  ← CI: triage, issue-assign, label sync
```

---

## 19. Library Modules

All in [`pipeline/lib/`](pipeline/lib/).

| Module | Purpose |
|---|---|
| [`evals.mjs`](pipeline/lib/evals.mjs) | Automated hard/soft gates — the deterministic eval suite |
| [`fsx.mjs`](pipeline/lib/fsx.mjs) | Safe I/O — `readJSONSafe`, `writeJSONAtomic`, `withLock`, `updateJSON` |
| [`conduct.mjs`](pipeline/lib/conduct.mjs) | Enforcement — gates non-optional; `runEvals → mergeIntoReport → recordAttempt` contract |
| [`provenance.mjs`](pipeline/lib/provenance.mjs) | Transcript provenance gate — sha256, speaker labels, timestamp structure |
| [`saturation.mjs`](pipeline/lib/saturation.mjs) | Sample-adequacy artifact — participants-cited/N, single-participant themes, code emergence curve |
| [`pii.mjs`](pipeline/lib/pii.mjs) | PII coding (P01/P02…), redaction, fail-closed key loading, run-wide scan |
| [`loop.mjs`](pipeline/lib/loop.mjs) | Attempt tracking, circuit breaker, `unblock` with required human note |
| [`risk.mjs`](pipeline/lib/risk.mjs) | Risky-argument detection — scans researcher claims only (not participant verbatims) |
| [`journal.mjs`](pipeline/lib/journal.mjs) | Append-only run journal — cheap "where are we" restore from ~20 lines |
| [`compare.mjs`](pipeline/lib/compare.mjs) | Dual-model diff — `verifyRuns()`, best-match theme Jaccard, n=1 disclosure |
| [`run.mjs`](pipeline/lib/run.mjs) | Study scaffolding, input hashing, manifest generation |
| [`dashboard.mjs`](pipeline/lib/dashboard.mjs) | HTML checkpoint dashboards with PII banner |
| [`marvin-adapter.mjs`](pipeline/lib/marvin-adapter.mjs) | Transcript access, `speakerText()` for speaker-scoped grounding, clip creation with pending fallback |
| [`server.mjs`](pipeline/lib/server.mjs) | Live dashboard server (rebuilds on load) |
| [`selftest.mjs`](pipeline/lib/selftest.mjs) | 40-assertion end-to-end self-test — run this to prove the engine works |

---

## 20. Quick Start

**Prerequisites:** Node.js (v18+). Zero runtime dependencies.

```powershell
cd pipeline

# Prove the engine works end-to-end
node lib/selftest.mjs

# Scaffold a new study
node lib/run.mjs init acme-checkout "ACME Checkout Study"

# Assign opaque participant codes (builds private crosswalk)
node lib/pii.mjs key studies/acme-checkout

# Verify transcript integrity before analysis starts
node lib/provenance.mjs check studies/acme-checkout

# Hash all inputs (for reproducibility)
node lib/run.mjs hash studies/acme-checkout

# Scaffold a run manifest for a model
node lib/run.mjs manifest studies/acme-checkout opus-4.8

# --- agents produce runs/opus-4.8/*.json ---

# Run evals on a step file
node lib/evals.mjs studies/acme-checkout opus-4.8 studies/acme-checkout/runs/opus-4.8/03-pain-points.json

# Produce the saturation artifact (before CP2)
node lib/saturation.mjs studies/acme-checkout opus-4.8

# Scan for risky arguments
node lib/risk.mjs scan studies/acme-checkout opus-4.8

# Build HTML dashboards for all checkpoints
node lib/dashboard.mjs studies/acme-checkout

# Repeat for gpt-5.5, then diff the two models
node lib/compare.mjs studies/acme-checkout

# Final PII leak scan over every run artifact
node lib/pii.mjs scan studies/acme-checkout

# Serve the dashboards locally
node lib/server.mjs --port 4173
```

---

## 21. Running With the Agents

Ask Squad: **"Run the UXR pipeline on study `<id>` with both models."**

The Conductor drives intake interactively, spawns the specialists per [`workflow.md`](pipeline/workflow.md), gates with QA/Evals, stops at the three human checkpoints, and produces dashboards. See [`workflow.md`](pipeline/workflow.md) for the exact orchestration and [`loop.md`](pipeline/loop.md) for the learning loop.

For a visual walkthrough of every component and decision, open [`pipeline/docs/pipeline-explained.html`](pipeline/docs/pipeline-explained.html) in a browser.

---

## 22. Commands Cheat Sheet

```powershell
# Study lifecycle
node lib/run.mjs init <id> "<name>"
node lib/run.mjs hash studies/<id>
node lib/run.mjs manifest studies/<id> opus-4.8

# Integrity
node lib/provenance.mjs check studies/<id>
node lib/pii.mjs key studies/<id>
node lib/pii.mjs scan studies/<id>

# Evals and gating
node lib/evals.mjs studies/<id> opus-4.8 studies/<id>/runs/opus-4.8/03-pain-points.json
node lib/saturation.mjs studies/<id> opus-4.8

# Risk flags
node lib/risk.mjs scan studies/<id> opus-4.8
node lib/risk.mjs review studies/<id> opus-4.8
node lib/risk.mjs set studies/<id> opus-4.8 FLAG-004 fixed "added 'for the participants we spoke with' caveat"

# Loop management
node lib/loop.mjs attempt studies/<id> opus-4.8 03-pain-points fail "hallucination on PAIN-009"
node lib/loop.mjs state studies/<id> opus-4.8
node lib/loop.mjs unblock studies/<id> opus-4.8 03-pain-points "manually verified; quote confirmed in transcript"

# Journal
node lib/journal.mjs show studies/<id> opus-4.8

# Reporting and comparison
node lib/dashboard.mjs studies/<id>
node lib/compare.mjs studies/<id>
node lib/server.mjs --port 4173

# Validate engine
node lib/selftest.mjs
```

---

## Built With

- [Squad](https://github.com/bradygaster/squad) — multi-agent framework
- [Marvin](https://heymarvin.com) — UX research platform (transcript access + clip creation)
- Zero-dependency Node.js engine (`pipeline/lib/`)

---

*For the full interactive walkthrough with diagrams, open [`pipeline/docs/pipeline-explained.html`](pipeline/docs/pipeline-explained.html) in a browser.*

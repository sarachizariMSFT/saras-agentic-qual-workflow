# Squad Team

> Sara's agentic qual workflow

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Conductor | Pipeline Orchestrator | `.squad/agents/conductor/charter.md` | active |
| Privacy | PII Guardian / De-identification | `.squad/agents/privacy/charter.md` | active |
| Observed-Behavior | Behavioral Evidence Analyst | `.squad/agents/observed-behavior/charter.md` | active |
| Verbatim | Voice-of-Customer Curator | `.squad/agents/verbatim/charter.md` | active |
| Pain Points | Pain & Frustration Analyst | `.squad/agents/pain-points/charter.md` | active |
| Papercuts | Small-Friction Analyst | `.squad/agents/papercuts/charter.md` | active |
| Design Recommendations | Solution Designer | `.squad/agents/design-recommendations/charter.md` | active |
| Powerful-Moments | Emotional & Memorable-Moment Detector | `.squad/agents/powerful-moments/charter.md` | active |
| Devil's Advocate | Red-Team Analyst | `.squad/agents/devils-advocate/charter.md` | active |
| Synthesizer | Insight Synthesizer | `.squad/agents/synthesizer/charter.md` | active |
| QA/Evals | Quality & Evaluation Gate | `.squad/agents/qa-evals/charter.md` | active |
| Evidence-Verifier | Quote & Evidence Fidelity Gate | `.squad/agents/evidence-verifier/charter.md` | active |
| Risk-Flagger | Risk & Sensitivity Reviewer | `.squad/agents/risk-flagger/charter.md` | active |
| Editor | Report Writer | `.squad/agents/editor/charter.md` | active |
| Storyteller | Research Narrative Designer | `.squad/agents/storyteller/charter.md` | active |
| Scribe | Documentation specialist | `.squad/agents/scribe/charter.md` | active |

## Pipeline

This team runs the UXR Qualitative Analysis Pipeline. See `pipeline/README.md` for the full design,
`pipeline/workflow.md` for orchestration, and `pipeline/loop.md` for the learning loop.

Topology: Privacy de-identifies at intake → 6 producers **parallel** → Devil's Advocate → Synthesizer → QA gate → Evidence-Verifier (exact quote + timestamp + Marvin clip) → Risk-Flagger (human-review flags) → Editor + Storyteller → Privacy PII gate + QA final gate.
Runs twice (opus-4.8, gpt-5.5) then diffs. Loops capped at 10.

## Project Context

- **Project:** Sara's agentic qual workflow
- **Created:** 2026-07-08

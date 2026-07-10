---
name: "learning-loop"
description: "Capture corrections as structured records, apply them to agents/skills/evals, and log the change."
domain: "continuous-improvement"
confidence: "high"
source: "manual"
---

## Context
The pipeline improves itself. Any human correction or change request becomes a durable improvement to the
agents, skills, rubrics, or schema — not a one-off fix. Driven by the Conductor and the Retrospective ceremony.

## Patterns

### Correction record
On any correction/rejection, write `studies/<study-id>/corrections/<timestamp>-<slug>.json`:
```json
{
  "id": "COR-2026-07-08-01",
  "study_id": "...",
  "run_model": "opus-4.8 | gpt-5.5 | both",
  "target": "finding | agent | skill | eval | schema | workflow",
  "target_id": "PAIN-005 | pain-points | severity-scoring | ...",
  "problem": "What was wrong (human's words).",
  "root_cause": "prompt | skill-gap | rubric | schema | data | model",
  "correction": "The specific fix.",
  "change": "What to change in the repo so it doesn't recur.",
  "status": "open | applied"
}
```

### Applying the loop (`squad loop` reads `pipeline/loop.md`)
1. Read open correction records.
2. For each, edit the right artifact: agent `charter.md`, a `SKILL.md`, an eval threshold in `evals.mjs`,
   or the schema. Small, surgical, reversible edits.
3. Append a line to `pipeline/CHANGELOG.md`: date, correction id, files changed, one-line rationale.
4. Append the learning to the affected agent's `history.md`.
5. Mark the record `applied`.
6. If the change touches a shared contract (schema, eval rubric, workflow), run Design Review first.

### Model-specific learnings
If only one model erred, note it in the record. Prefer fixes that improve both runs; only diverge prompts if
a documented model quirk requires it (rare — divergence weakens the comparison).

## Examples
Human rejects a severity-5 that was really a 3 -> record with root_cause `rubric`, change: tighten the "5 =
blocking" wording in `severity-scoring` and add the example. Changelog + history updated. Both models benefit.

## Anti-Patterns
- Fixing the finding but not the cause — the same error returns next study.
- Editing a shared contract without Design Review or a changelog entry.
- Silent prompt drift between the two models.

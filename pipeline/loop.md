# Learning Loop

The pipeline improves itself. This file drives `squad loop` and the Retrospective ceremony.
Each correction becomes a durable change to an agent, skill, rubric, or schema — never a one-off.
Every loop pass is bounded; the whole learning loop honors the cap in `config.json > loop.maxIterations` (10).

## Trigger
- A human correction/rejection at any checkpoint, OR
- The Retrospective ceremony after final sign-off, OR
- `squad loop --file pipeline/loop.md`

## Each cycle (bounded — one pass per correction, max 10 open corrections per cycle)

1. **Collect.** Read open records in `studies/<id>/corrections/*.json` (schema in skill `learning-loop`).
2. **Diagnose.** For each, classify `root_cause`: `prompt | skill-gap | rubric | schema | data | model`.
3. **Apply the smallest durable fix** to the right artifact:
   - `prompt` / behavior -> the agent's `.squad/agents/<name>/charter.md`
   - `skill-gap` -> the relevant `.squad/skills/<name>/SKILL.md`
   - `rubric` -> `.squad/skills/severity-scoring` or `eval-rubrics`, and thresholds in `pipeline/config.json`
   - `schema` -> `pipeline/schemas/finding.schema.json` (run Design Review first)
   - `data` -> intake procedure in `uxr-intake`
   - `model` -> note it; prefer fixes that help both runs (divergence weakens the comparison)
4. **Log.** Append to `pipeline/CHANGELOG.md`: date, correction id, files changed, one-line rationale.
5. **Remember.** Append the learning to the affected agent's `history.md`.
6. **Close.** Mark the record `applied`.
7. **Guard.** If the change touches a shared contract (schema, eval rubric, workflow), run Design Review.

## Circuit breaker
If applying a correction re-breaks an eval and you loop trying to fix it, stop at 10 attempts
(`node lib/loop.mjs`) and escalate to the human. Don't grind.

## Model-comparison feedback
When the two models disagree and the human picks a winner, capture *why* as a correction. Usually the fix
(a clearer rubric, a tighter charter) improves both runs. Only diverge prompts for a documented model quirk.

## Example
> Human at CP2: "Severity 5 on PAPER-004 is wrong — it's a minor label issue."
- Record: `target: skill`, `target_id: severity-scoring`, `root_cause: rubric`.
- Fix: tighten "5 = blocking" wording + add the label-issue example to `severity-scoring`.
- Changelog + `papercuts/history.md` updated. Both models benefit next run. Record -> `applied`.

---
name: "pipeline-orchestration"
description: "The topology, checkpoints, and dual-model run rules the Conductor follows."
domain: "orchestration"
confidence: "high"
source: "manual"
---

## Context
Used by the Conductor. Defines exactly how a study run flows, where it stops for humans, and how the two
model runs stay identical so their outputs are comparable.

## Patterns

### Topology (per model run)
```
Intake ─▶ [Human Checkpoint 1] ─▶ Kickoff ceremony
   └▶ PARALLEL producers: observed-behavior, verbatim, pain-points, papercuts,
        design-recommendations, powerful-moments
        └▶ QA/Evals (per-step hard gates)
             └▶ Devil's Advocate (sequential)
                  └▶ Synthesizer (sequential)
                       └▶ QA/Evals (synthesis gate) ─▶ [Human Checkpoint 2]
                            └▶ PARALLEL: Editor (report) + Storyteller (narrative)
                                 └▶ QA/Evals (final gate) ─▶ [Human Checkpoint 3: sign-off]
                                      └▶ Retrospective ceremony
```

### Dual-model rule
- Run the ENTIRE pipeline twice: once `opus-4.8`, once `gpt-5.5`, with identical prompts, skills, inputs.
- Outputs go to `runs/opus-4.8/` and `runs/gpt-5.5/`. Never mix models within a run.
- After both complete and pass Checkpoint 3, produce `comparison/model-diff.(md|html)`.
- Inputs are hashed in each manifest so the comparison is proven to be on identical inputs.

### Checkpoints (human)
1. **After Intake** — confirm goals/artifacts complete and correct. Gate before any analysis.
2. **After Synthesis** — review themes, hypothesis verdicts, contradictions before reporting.
3. **Final sign-off** — approve the report + story; triggers the Retrospective and (optionally) clips.
At each, the Conductor sets manifest status `awaiting_human` and generates the checkpoint dashboard, then stops.

### Status discipline
Manifest step status flows `pending -> running -> done|failed|awaiting_human|blocked`. Never mark done without the
output file present and its QA gate passed.

### Loop policy (circuit breaker — cap = `config.json > loop.maxIterations`, default 10)
Every revision/challenge/reconcile loop is bounded. After each eval, call
`node lib/loop.mjs attempt <studyRoot> <model> <step> <pass|fail> "<reason>"`:
- `pass` -> step `done`, advance.
- `fail` and attempts < cap -> step `running`, author revises the offending finding IDs, re-eval.
- `fail` and attempts == cap -> step `blocked`, `escalate_to_human`, stop at the nearest checkpoint.
No loop grinds forever; a stuck step surfaces to a human instead.

## Examples
Producer failure: if `pain-points` fails schema eval, the Conductor keeps it `failed`, does not start Devil's
Advocate on that stream, and routes back to the author.

## Anti-Patterns
- Starting Synthesis before all producers pass their gates.
- Skipping a human checkpoint to save time.
- Different model per agent in one run — breaks the comparison.

---
name: "pipeline-orchestration"
description: "The topology, checkpoints, and model run rules the Conductor follows."
domain: "orchestration"
confidence: "high"
source: "manual"
---

## Context
Used by the Conductor. Defines exactly how a study run flows, where it stops for humans, and when a second
model run is needed for comparison.

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

### Model run rule
- Run one model by default: `config.json > run.primaryModel` (`opus-4.8`).
- Keep comparison off by default with `config.json > comparison.enabled` set to false.
- Keep fast mode off by default (`config.json > run.fastModeDefault=false`).
- In fast mode (`--fast`), run Phase 3 producers with a bounded dependency-aware pool
  (`config.json > run.fastMaxParallel`, default 4). Keep eval gates and checkpoints unchanged.
- Start `gpt-5.5` and comparison only when `config.json > run.dualModel` is true, or when the Conductor is invoked with `--dual`.
- In dual mode, outputs go to `runs/opus-4.8/` and `runs/gpt-5.5/`. Never mix models within a run.
- After both complete and pass Checkpoint 3, produce `comparison/model-diff.(md|html)`.
- Inputs are hashed in each manifest so the comparison is proven to be on identical inputs.

### Checkpoints (human)
1. **After Intake** — confirm goals/artifacts complete and correct. Gate before any analysis.
2. **After Synthesis** — review themes, hypothesis verdicts, contradictions before reporting.
3. **Final sign-off** — approve the report + story; triggers the Retrospective and (optionally) clips.
At each, the Conductor sets manifest status `awaiting_human` and generates the checkpoint dashboard, then stops.
Before CP3 can close, the Conductor runs `node lib/requests.mjs gate <studyRoot>`. Any open researcher request keeps
sign-off open.

### Visibility
For every step, emit one compact progress line, for example `[7/23] pain-points: running evals`. Use one stable
task and agent name across the whole run, and offer a clear cancel path so the researcher can stop the run.

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
- Starting the second model when `run.dualModel` is false.
- Turning on fast mode and relaxing gates. Fast mode is scheduling only.
- Closing CP3 with open researcher requests.

---
name: "eval-rubrics"
description: "The automated eval suite: dimensions, thresholds, and hard vs soft gates."
domain: "quality"
confidence: "high"
source: "manual"
tools:
  - name: "pipeline/lib/evals.mjs"
    description: "Deterministic Node script that scores a step's output against these rubrics."
    when: "After every producing step, and on the final report."
---

## Context
Used by QA/Evals. Evals are deterministic scripts over the actual output files — never a model's self-assessment.
Hard gates block advancement; soft gates surface to the human checkpoint.

## Patterns

### Dimensions
| Eval | Type | Gate | Pass condition |
|---|---|---|---|
| schema | structural | HARD | 100% of findings validate against `finding.schema.json` (incl. required `observation_type` per evidence item). |
| traceability | structural | HARD | 100% of findings have >=1 evidence item with a resolvable locator. |
| hallucination | grounding | HARD | Every `quote` matches as a **contiguous longest-run** phrase (>= 0.9) in the **cited speaker's** turns — not a token-set match. Recombined quotes fail. Falls back to the full transcript only for unlabeled notes. |
| frequency_integrity | integrity | HARD | Authored `frequency` <= distinct supporters (`evidence` participants ∪ `supporting_participants`). |
| method_justification | discipline | HARD | Every finding has non-empty `method_justification`. |
| quote_exactness | grounding | HARD | Every `said` quote is an **exact** contiguous substring of the cited speaker's turns. |
| quote_timestamp | grounding | HARD | Every `said` quote's `locator` is a timestamp (`hh:mm:ss` / `mm:ss`). |
| clip_link | grounding | HARD | Every `said` quote carries a Marvin `clip_url`; `clip_status:"pending"` is accepted when `config.evidence.allowPendingClips` is true and counted separately (never as "created"). Toggle with `requireClips`. |
| causal_support | validity | SOFT | A causal statement carries behavioral/observed evidence or an explicit `causal_strength` (not just a self-report quote). |
| coverage | completeness | SOFT | Every hypothesis is addressed; a **refuted** or **insufficient_evidence** verdict COUNTS as covered (anti-confirmation-bias). |
| calibration | consistency | SOFT | Severity distribution not skewed (>60% at level 5 flags inflation). |
| recommendation_link | discipline | SOFT | Every `design_recommendation` has non-empty `related_finding_ids`. |
| dual_model_consistency | comparison | REPORT | Best-match theme Jaccard + verdict diff across models, after `verifyRuns` confirms different models + identical inputs (informational, not a gate). |

### Verdict rules
- Any HARD failure -> step status `failed`, run halts, offending finding IDs listed. Author fixes, re-run eval.
- A step reaches `done` ONLY via the enforcement driver (`lib/conduct.mjs`) with the real verdict — no self-certifying.
- Run `hardPass` is false if any scheduled eval-bearing step (`EVAL_REQUIRED_STEPS`) is missing or failing.
- SOFT failure -> step passes but the failure is written to the checkpoint dashboard for the human to weigh.
- Every eval run writes `runs/<model>/08-qa-evals.json` and updates the manifest step `evals` block.

### Thresholds live in code
`pipeline/lib/evals.mjs` holds the exact thresholds so they're versioned and changed via Design Review.

## Examples
Hard fail: finding `REC-002` cites quote "it was really slow" not present in `P04.md` -> hallucination fail,
run halts, message names `REC-002`.

## Anti-Patterns
- Passing a gate by model judgment instead of running the script.
- Turning a hard gate soft to "get unblocked." Fix the finding, not the gate.
- Changing thresholds silently — thresholds change through Design Review + changelog.

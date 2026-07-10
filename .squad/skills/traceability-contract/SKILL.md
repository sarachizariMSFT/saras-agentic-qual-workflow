---
name: "traceability-contract"
description: "The non-negotiable rule that every finding cites resolvable transcript evidence."
domain: "quality"
confidence: "high"
source: "manual"
---

## Context
Traceability is the backbone of this pipeline. If a claim can't be traced to a participant's words or actions,
it isn't a finding — it's an opinion. Every producing agent obeys this contract; QA/Evals enforces it.

## Patterns

### The contract
Every finding MUST:
1. Validate against `pipeline/schemas/finding.schema.json`.
2. Carry >=1 `evidence` item with `transcript_id`, `participant`, `locator`, and a verbatim `quote`.
3. Use a `quote` that actually appears in the saved transcript (QA fuzzy-matches it).
4. Declare `method` + `method_justification` (the hybrid-with-justification rule).
5. Carry `created_by`, `model`, and `run_id` so any claim is attributable to an agent + model + run.

### Chain of custody
`report prose -> finding id -> evidence.locator -> transcript file`. Every hop must resolve. The Editor keeps
inline `[PAIN-003]`-style refs so a reader can walk the chain from a sentence to a timestamp.

### Derived findings
Themes, recommendations, and stories don't re-cite everything, but MUST list `related_finding_ids` that
themselves carry evidence. Traceability is transitive but never broken.

## Examples
Good: `{ "statement": "Users abandon at shipping cost reveal", "evidence": [{ "transcript_id": "P07",
"participant": "P07", "locator": "00:12:44", "quote": "I gave up and used the spreadsheet", "observation_type": "said" }] }`

Bad: `{ "statement": "Users find checkout confusing" }`  ← no evidence, fails the hard gate.

## Anti-Patterns
- Paraphrasing a quote so it no longer matches the transcript (fails hallucination check).
- A recommendation with empty `related_finding_ids`.
- Citing a transcript_id that has no saved file.

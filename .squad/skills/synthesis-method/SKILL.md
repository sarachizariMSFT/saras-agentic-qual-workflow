---
name: "synthesis-method"
description: "Cluster surviving findings into themes, map to goals/hypotheses, prioritize, keep traceability."
domain: "qualitative-analysis"
confidence: "high"
source: "manual"
---

## Context
Used by the Synthesizer after Devil's Advocate. Turns six streams of findings into a prioritized, coherent
answer to the study's questions — without losing the thread back to evidence.

## Patterns

### Steps
1. Intake only findings that survived red-team (`holds` or revised). Exclude `unsupported`.
2. Cluster by affinity into `theme` findings; each theme lists its child `related_finding_ids`.
3. Map every research goal and hypothesis (H1, H2...) to supporting/refuting finding IDs -> a `goal_coverage` map.
4. Give each hypothesis a verdict: `supported`, `refuted`, `mixed`, or `insufficient_evidence`.
5. Prioritize themes with `severity × frequency × confidence` (see `severity-scoring`), but keep rare blockers visible.
6. Surface contradictions flagged via `contradicts` — do not smooth them over.
7. Note gaps: goals the evidence can't answer, and what future research would resolve them.

### Output
`runs/<model>/07-synthesis.json`:
- array of `theme` findings (schema-valid, with `related_finding_ids`)
- `goal_coverage`: `{ "H1": { "verdict": "...", "supporting": ["PAIN-003"], "refuting": [] }, ... }`
- `contradictions`: list of `{ ids: [...], note }`
- `gaps`: list of unanswered goals

## Examples
`{ "id": "THEME-002", "type": "theme", "statement": "Cost transparency drives abandonment",
"related_finding_ids": ["PAIN-003","PAPER-004","MOM-001"], "method": "thematic",
"method_justification": "Multiple findings converge on when cost is revealed." }`

## Anti-Patterns
- Themes with no child finding IDs (untraceable).
- Leaving a research goal unaddressed with no gap note.
- Averaging away a contradiction instead of naming it.

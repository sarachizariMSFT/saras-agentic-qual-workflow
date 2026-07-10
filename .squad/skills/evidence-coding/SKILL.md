---
name: "evidence-coding"
description: "How specialists code raw transcript evidence into findings using a hybrid method, justified per finding."
domain: "qualitative-analysis"
confidence: "high"
source: "manual"
---

## Context
Used by the six producing specialists. The researcher chose a hybrid approach: pick the method that best fits
each finding, and justify it. This skill defines the methods and the coding discipline so "hybrid" doesn't
become "sloppy."

## Patterns

### The method menu (choose per finding, record in `method` + `method_justification`)
- **thematic** — recurring codes rolled into themes. Default for patterns across participants.
- **jtbd** — frame around the job the user is trying to get done; good for needs/motivations.
- **affinity** — cluster loosely related observations when structure is still emerging.
- **hybrid** — explicitly combine (e.g., thematic codes framed as jobs); justify the combination.

### Coding discipline
1. Open-code the transcript: tag segments with short codes tied to a locator.
2. Group codes into candidate findings. One finding = one defensible claim.
3. For each finding, pick the method that fits and write one sentence of justification.
4. Attach evidence (>=1 citation) and set `frequency` = distinct participants, `confidence` by evidence strength.
5. Keep `observation_type` honest: `said` (quote), `did`/`observed` (behavior).

### Saturation & representativeness
- Note when a code stops producing new information (saturation).
- Don't let one vivid participant become "users." Frequency and confidence keep single-source claims modest.

## Examples
`method: "jtbd", method_justification: "This is about the underlying job (reconcile invoices fast), not a UI theme, so a jobs frame explains the workaround better than a thematic code."`

## Anti-Patterns
- "hybrid" with no justification — that's the one thing the researcher explicitly disallowed.
- Coding sentiment as behavior, or inferring intent not shown in the transcript.
- One-participant findings marked `high` confidence.

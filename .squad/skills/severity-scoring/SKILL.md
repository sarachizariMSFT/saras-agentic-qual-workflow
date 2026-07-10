---
name: "severity-scoring"
description: "Consistent 1-5 severity scoring and the pain-point vs papercut boundary."
domain: "qualitative-analysis"
confidence: "high"
source: "manual"
---

## Context
Used by Pain Points, Papercuts, Design Recommendations, and Devil's Advocate. Keeps severity comparable across
agents and across the two model runs, so the comparison report measures real differences, not scoring noise.

## Patterns

### Severity rubric (1-5)
- **5 Blocking** — user cannot complete the task; abandons or needs external help.
- **4 Severe** — completes but with major cost (long delay, error, lost trust); would churn if repeated.
- **3 Moderate** — noticeable friction that slows the task or causes a recoverable mistake.
- **2 Minor** — small annoyance; task completes fine. Typical papercut ceiling.
- **1 Trivial** — cosmetic; noticed but no real cost.

Score on evidence, and justify any 4-5 with a blocking/severe citation.

### Pain point vs papercut boundary
- **Pain point** — meaningful; blocks or seriously frustrates; usually severity 3-5.
- **Papercut** — small, often cosmetic; severity 1-2; matters cumulatively (use `frequency`).
- Boundary cases go to Pain Points to decide; Papercuts records the disagreement in the decisions inbox.

### Priority (for synthesis/recommendations)
`priority ≈ severity × frequency × confidence_weight` (high=1.0, medium=0.7, low=0.4).
Use it to rank, not as gospel — a rare severity-5 blocker can still top the list.

## Examples
- "Shipping cost only shown on final step; 4/6 abandoned" -> pain point, severity 4, frequency 4.
- "Button label says 'Submit' but action is 'Save draft'" -> papercut, severity 2, frequency 3.

## Anti-Patterns
- Severity inflation (everything is a 5). QA flags a skewed distribution as a soft-gate calibration issue.
- Scoring on emotion alone without task impact.
- Different agents using different scales — this rubric is shared and fixed per study.

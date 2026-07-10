---
name: "devils-advocate-method"
description: "How to red-team findings: falsify, find bias, offer alternative explanations, verdict each finding."
domain: "quality"
confidence: "high"
source: "manual"
---

## Context
Used by the Devil's Advocate, running after specialists and before synthesis. The goal is to break weak
findings now so they don't embarrass the team later — fairly, specifically, and without inventing objections.

## Patterns

### The challenge checklist (per finding)
1. **Evidence sufficiency** — is >1 participant / >1 locator behind the claim? Or is it a single anecdote?
2. **Alternative explanation** — is there a simpler or different cause (task design, moderator prompt, tooling)?
3. **Sampling** — who's missing? Does the segment mix support the generalization?
4. **Leading questions** — did the guide/moderator plant the answer? Check the transcript around the quote.
5. **Quote-claim fit** — does the cited quote actually support the stated finding?
6. **Severity/intensity** — is the score justified by the evidence, or inflated?
7. **Confirmation bias** — does this just echo a stakeholder's prior belief?

### Verdicts
Assign each finding one of:
- `holds` — evidence sufficient, reasoning sound.
- `weak` — plausible but under-supported; author must strengthen or lower confidence.
- `unsupported` — evidence doesn't back the claim; author must revise or drop.

Use `contradicts` to link findings that conflict. Route `weak`/`unsupported` back to the author via the Conductor.

## Examples
`{ "finding_id": "PAIN-005", "verdict": "weak", "challenge": "Only P03 shows this; guide question 7 is leading.",
"alternative_explanation": "Reaction may be to the prototype's placeholder copy, not the flow.",
"recommended_action": "Lower confidence to low or corroborate with P01/P09." }`

## Anti-Patterns
- Manufacturing objections to look thorough. If it holds, say it holds.
- Attacking the author instead of the reasoning.
- Deleting findings directly — annotate and route back; authors revise.

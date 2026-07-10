---
name: "risk-flagging"
description: "Detect risky arguments (overreach, causal claims, thin-support/high-impact, sensitive topics) and raise human-review flags — never a silent block."
domain: "qualitative-analysis"
confidence: "high"
source: "manual"
tools:
  - name: "node lib/risk.mjs scan"
    description: "Compute risk flags over a run's findings -> 08c-risk-flags.json."
    when: "After QA/Evals + Evidence-Verifier, before reporting."
  - name: "node lib/risk.mjs review"
    description: "List OPEN flags for the researcher."
    when: "At CP2 / CP3 review."
  - name: "node lib/risk.mjs set"
    description: "Triage a flag: acknowledged | dismissed | fixed (+ note)."
    when: "As the human reviews each flag."
---

## Context
Used by the Risk-Flagger agent. This is the "even if it's true, is it risky to say?" layer. It runs after the
truth/quality gates and produces flags for a human — it does not block the pipeline, but high-severity flags left
`open` must be triaged before CP3 sign-off. Decisions persist across re-runs (keyed by finding + category).

## Patterns

### The eight risk categories (severity)
- **overgeneralization** (med/high) — absolute language, or a group claim from n≤`smallSampleN`.
- **causal_claim** (med) — causal phrasing on qualitative evidence.
- **weak_support_high_impact** (high) — a recommendation on `< minEvidenceForRec` citations or n≤1.
- **low_evidence_high_confidence** (high) — `confidence: high` with thin evidence.
- **contradiction** (high) — the finding challenges or is challenged by another.
- **sensitive_topic** (high) — legal/ethical/medical/compensation/discrimination/security wording.
- **speculation** (med) — a hedge stated as a finding.
- **absolute_recommendation** (med) — prescriptive "must/never" that may not be warranted.

### The flag lifecycle
`open` → the human picks one of: **acknowledged** (seen, accept the risk), **dismissed** (not a real risk here),
**fixed** (wording changed by Editor/Storyteller). Re-running `scan` keeps these decisions.

### Reviewing
- CP2 dashboard shows all flags with severity + status; CP3 blocks sign-off while high flags are `open`.
- Prefer *fixing* over *dismissing* when the fix is a one-line caveat ("for the participants we spoke with…").

## Examples
`{ "id": "FLAG-004", "finding_id": "REC-002", "category": "weak_support_high_impact", "severity": "high",
   "reason": "High-impact recommendation on thin support (evidence=1, frequency=1).",
   "snippet": "Rebuild the entire checkout flow around a single-page design.", "status": "open" }`

## Anti-Patterns
- Blocking the pipeline on a flag — flags inform the human, they don't gate.
- Auto-dismissing your own flags. Only the human triages.
- Flagging so aggressively every finding lights up — tune to the arguments that would actually embarrass or mislead.
- Exposing participant names/companies in a flag — reference finding IDs and codes.

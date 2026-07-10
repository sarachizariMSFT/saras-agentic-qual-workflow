# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Orchestration / run a study | Conductor | Start a run, enforce checkpoints, dual-model, comparison |
| Privacy / PII / de-identification | Privacy | Assign opaque participant codes (P01, P02 …), redact transcripts, block name/company leaks |
| Behavioral evidence | Observed-Behavior | What participants did, task outcomes, workarounds |
| Quotes / voice of customer | Verbatim | Representative quotes, attribution |
| Pain points | Pain Points | Blockers, high-friction failures, severity scoring |
| Papercuts | Papercuts | Minor/cosmetic friction, quick wins |
| Design recommendations | Design Recommendations | Evidence-backed fixes, prioritization |
| Emotional / powerful moments | Powerful-Moments | Emotional peaks, memorable stories, clip candidates |
| Red-team / challenge | Devil's Advocate | Falsify findings, bias/sampling checks |
| Synthesis | Synthesizer | Themes, hypothesis verdicts, prioritization |
| Evals / quality gate | QA/Evals | schema, traceability, hallucination, coverage |
| Quote/evidence fidelity | Evidence-Verifier | Exact quotes, timestamps, Marvin clip attachment, claim↔quote checks |
| Risky arguments / review flags | Risk-Flagger | Overreach, causal claims, thin-support recs, sensitive topics — flagged for human review |
| Report writing | Editor | Executive summary, findings report |
| Storytelling | Storyteller | Narrative arc, personas/journeys, highlight reel |
| Session logging | Scribe | Automatic — never needs routing |

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Lead |
| `squad:{name}` | Pick up issue and complete the work | Named member |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, the **Lead** triages it — analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" — untriaged issues waiting for Lead review.

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for "what port does the server run on?"
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If a feature is being built, spawn the tester to write test cases from requirements simultaneously.
7. **Issue-labeled work** — when a `squad:{member}` label is applied to an issue, route to that member. The Lead handles all `squad` (base label) triage.

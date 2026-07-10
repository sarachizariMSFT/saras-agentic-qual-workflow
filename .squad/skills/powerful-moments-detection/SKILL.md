---
name: "powerful-moments-detection"
description: "Detect emotional peaks, memorable lines, and powerful stories; score intensity; flag clip-worthy moments."
domain: "qualitative-analysis"
confidence: "high"
source: "manual"
tools:
  - name: "powerful-moments-curation (global skill)"
    description: "Identify and score video-clip-worthy interview moments."
    when: "To score memorability/clip-worthiness of a candidate moment."
  - name: "marvin-clipper (global skill)"
    description: "Create video clips from Marvin interview transcripts."
    when: "To turn clip_worthy moments (transcript_id + timestamp) into clips."
---

## Context
Used by the Powerful-Moments agent. Finds the moments that make a readout land: the gut-punch quote, the
visible relief, the story a participant tells that explains everything. Bridges to the researcher's global
`powerful-moments-curation` and `marvin-clipper` skills.

## Patterns

### What qualifies
- **Emotional peak** — strong, evidenced emotion (frustration, delight, relief, anxiety, pride) with task context.
- **Memorable line** — a quote so vivid it becomes the study's shorthand.
- **Powerful story** — a full arc (setup -> tension -> resolution) the participant narrates.
A moment must be memorable/revealing, not just emotional. Capture surrounding context so it isn't misread.

### Scoring
- `emotion`: dominant emotion. `intensity`: 1-5 (5 = unforgettable). Use `powerful-moments-curation` to score.
- `clip_worthy`: true when the moment stands alone as a short, powerful clip. Include exact `locator` for `marvin-clipper`.
- `frequency`: how many participants had a similar moment (a shared peak is gold; a lone one is still valuable but flagged).

### Handoffs
- Feed `clip_worthy` moments (transcript_id + timestamp) to `marvin-clipper` for a highlight reel.
- Feed all moments to the Storyteller as raw material for the narrative arc.

## Examples
`{ "id": "MOM-001", "type": "powerful_moment", "emotion": "relief", "intensity": 5, "clip_worthy": true,
"statement": "P07 exhales and laughs when the export finally works", "evidence": [{ "transcript_id": "P07",
"participant": "P07", "locator": "00:31:20", "quote": "oh thank god, finally — I'd have paid money for that button",
"observation_type": "said" }], "method": "affinity", "method_justification": "Isolated emotional peak, not a cross-participant theme." }`

## Anti-Patterns
- Treating any emotion word as a powerful moment. It must be memorable or revealing.
- Marking `clip_worthy` without a precise timestamp (breaks marvin-clipper).
- Fabricating or compositing a story — every moment traces to one real participant.

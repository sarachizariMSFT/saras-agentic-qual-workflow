---
name: "evidence-verification"
description: "Verify every claim is backed by a strong, exact participant quote with a timestamp and a Marvin video clip; attach clip_url."
domain: "qualitative-analysis"
confidence: "high"
source: "manual"
tools:
  - name: "node lib/evals.mjs"
    description: "Runs quote_exactness, quote_timestamp, and clip_link hard gates over a step's findings."
    when: "After a producer/synthesis step, and again over report/story-backing findings."
  - name: "marvin-clipper (global skill)"
    description: "Cut a Marvin video clip for a quote and return a shareable URL."
    when: "For each 'said' quote, to populate evidence.clip_url."
  - name: "marvin-transcript-access"
    description: "Read raw transcripts to confirm quotes word-for-word."
    when: "To verify exactness and derive precise start/end seconds."
---

## Context
Used by the Evidence-Verifier agent. This is the fidelity layer on top of the anti-hallucination gate: it isn't
enough that a quote *roughly* appears — for participant verbatims it must be **exact, timestamped, and clipped**, and
every argument in the report/story must trace to such a quote. Real names/companies never appear; cite participant codes.

## Patterns

### The three gates (scoped to `said` evidence)
- **quote_exactness (HARD):** the quote is an exact verbatim substring of its transcript (coverage == 1 after
  case/punctuation normalization). Paraphrase or compositing fails. Fix by tightening to the transcript's real words.
- **quote_timestamp (HARD):** `locator` matches `hh:mm:ss` or `mm:ss`. A line reference alone is not enough for a spoken quote.
- **clip_link (HARD):** `clip_url` is present and points at Marvin. Cut via `marvin-clipper`; set `clip_status: created`.

### Claim ↔ evidence check (report/story)
- Walk each argument/claim in `09-report.md` / `09b-story.md`. Every one must cite a finding ID whose evidence
  passes all three gates. A confident sentence with no clip-backed exact quote is a defect — bounce it to the author.
- Prefer the *strongest* quote for a claim: unambiguous, self-contained, in the participant's own words.

### Deriving clip bounds
- From the timestamp, set `startSec` at the quote's first word and `endSec` at its last — no lead-in/trail-off
  (matches marvin-clipper's exact-words rule). Only clip participant speech, never the interviewer.

## Examples
`{ "id": "PAIN-003", "type": "pain_point",
   "statement": "Users abandon the task when they can't add a second card.",
   "evidence": [{ "transcript_id": "P01", "participant": "P01", "locator": "00:12:44",
     "quote": "I honestly gave up and used the spreadsheet", "observation_type": "said",
     "clip_url": "https://app.heymarvin.com/c/abc123", "clip_status": "created" }] }`

## Anti-Patterns
- Accepting a paraphrased or "close enough" quote for a claim. Exact or it doesn't count.
- A quote with no timestamp, or a timestamp with no clip.
- Clipping the interviewer, or padding the clip beyond the quoted words.
- Letting the Editor/Storyteller assert something no participant actually said on the record.
- Surfacing a real name/company in a quote label — always the participant code.

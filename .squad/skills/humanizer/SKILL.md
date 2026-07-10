---
name: "humanizer"
description: "House writing style for reports and stories: clear, direct, human, no AI tone or buzzwords."
domain: "writing"
confidence: "high"
source: "manual"
---

## Context
Used by Editor and Storyteller. The deliverables should read like a sharp researcher wrote them, not a model.
This encodes the researcher's house style.

## Patterns

### Learn the researcher's voice first
If `inputs/style-samples/` has any past reports, read them BEFORE writing. Extract and match:
- sentence rhythm and average length, how sections are structured and titled,
- how findings and quotes are introduced, how recommendations are framed,
- tone (formal vs conversational), and recurring phrasings the researcher favors.
Match that voice while keeping the house rules below. If no samples exist, use the house style as-is.
Write what you learned to `runs/<model>/00-style-guide.md` so both model runs match the same voice.

### Voice
- Clear, simple, direct. Short and varied sentence lengths. Use contractions.
- Talk to a smart human. Natural transitions ("here's the thing", "what this means").
- Every word intentional. If it can be said in fewer words, do it.

### Structure for the report (Editor)
1. Executive summary (90-second read): top themes, verdicts, top 3 recommendations.
2. Themes, each with severity/frequency and 1-2 representative quotes + `[IDs]`.
3. Pains and papercuts, prioritized.
4. Recommendations, tied to finding IDs, with impact/effort.
5. Hypothesis verdicts + gaps.
6. Appendix: evidence table and raw agent outputs (never edited).

### Traceability in prose
Keep inline refs like `[PAIN-003]`. A reader can walk from any sentence to a timestamped quote.

## Examples
Good: "Four of six people gave up when shipping cost appeared at the last step [PAIN-003]. One just closed the tab."
Bad: "Leveraging a seamless, robust checkout experience is mission-critical in today's fast-paced landscape."

## Anti-Patterns
- Buzzwords: "cutting-edge", "robust", "seamless", "leverage", "synergy", "in today's fast-paced world".
- AI throat-clearing ("It is important to note that..."), padding, hedging everything.
- Dropping citations to make prose flow — keep the `[IDs]`.

---
name: "marvin-transcript-access"
description: "Pull raw interview transcripts DIRECTLY from Marvin (never the Ask AI feature) and save them locally."
domain: "data-access"
confidence: "medium"
source: "manual"
tools:
  - name: "marvin (MCP)"
    description: "Marvin UX research platform MCP server — transcripts, insights, clips."
    when: "To list studies/sessions and fetch full raw transcript text and timestamps."
---

## Context
Every analysis agent reads transcripts directly. We deliberately do NOT use Marvin's "Ask AI" — we want the
raw text so our own agents and evals do the reasoning and can cite exact locators. This skill is the single
place that knows how to get transcripts; agents call it, they don't invent their own access.

## Patterns

### Direct access, not Ask AI
- Use the Marvin MCP tools that return raw transcript content (sessions/transcript endpoints), including
  speaker labels and timestamps. Do not call any "ask"/"summarize"/"insight-generation" tool for analysis input.
- Save each transcript verbatim to `studies/<study-id>/inputs/transcripts/<transcript_id>.txt` (or `.md`),
  preserving timestamps/line numbers so `locator` citations resolve.

### Locator convention
- Prefer timestamps `hh:mm:ss` when present; else line references `L120-L128`.
- The evals hallucination-check matches `quote` strings against these saved files, so save them faithfully.

### If Marvin MCP is not connected (current state)
The Marvin MCP server is not attached in this session. Until it is:
1. The Conductor reports Marvin is offline at run start.
2. Fall back to transcripts the researcher provides during intake (paste or file), saved to the same path.
3. `pipeline/lib/marvin-adapter.mjs` is the integration point — it reads local files today and is the
   place to wire Marvin MCP calls when the server is available. Keep the saved-file contract identical so
   nothing downstream changes.

## Examples
- `inputs/transcripts/P07.md` with lines like `[00:12:44] P07: I honestly gave up and used the spreadsheet.`
  lets Verbatim cite `locator: "00:12:44"` and QA verify the quote exists.

## Anti-Patterns
- Using Ask AI / Marvin summaries as analysis input. Banned — it hides evidence and breaks traceability.
- Editing transcript text on save. Save verbatim; clean-up belongs in findings, not the source.
- Agents each inventing their own Marvin access. Route through this skill / the adapter.

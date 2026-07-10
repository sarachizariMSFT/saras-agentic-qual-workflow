# Open Coding Method

## Overview

This skill guides the Open Coding agent through generating descriptive codes from the data *without* forcing them into a pre-existing framework.

The goal: let the data's vocabulary emerge; preserve inductive grounding.

## Process

### Phase 1: Read Without Pre-Judgment

Don't bring a codebook. Don't code as you read.

- First pass: What is the transcript saying?
- What patterns do you notice?
- What gets repeated across participants?
- Where does the data use surprising language?

**Technique:** Read each transcript straight through. Take notes of recurring elements (behaviors, language, situations, pain points), but don't label them yet.

### Phase 2: Identify Repeated Elements

Now look across transcripts. What shows up multiple times?

**Types of repetition:**
- Same behavior in multiple participants → candidate code
- Same phrase or metaphor across transcripts → candidate code
- Same pain point or workaround → candidate code
- Same expectation or assumption → candidate code
- Same tension or contradiction → candidate code

**Example:** P01 and P03 both describe stopping mid-task to check an external system. That's a repeated *behavior*, worth a code.

### Phase 3: Create Descriptive Code Names

Code names must be:
- **Data-grounded:** based on what the data says
- **Not theory-loaded:** avoid jargon or theory language
- **Verb + noun when possible:** "reconstructing lost context" not "cognitive load"
- **Self-explaining:** someone unfamiliar with the study should understand what the code captures

**Bad code names:**
- "Cognitive load" (theory language)
- "User confusion" (vague)
- "System gap" (not specific)

**Good code names:**
- "Reconstructing lost context" (describes behavior)
- "Avoiding parallel work" (describes choice)
- "Verifying output manually" (describes action)
- "Treating agent as junior teammate" (describes metaphor)

### Phase 4: Write Code Definitions

One sentence that explains what the code captures:

**Format:** "[What does the user do / what is the pattern?] in order to [why they do it / what gap it fills]"

**Examples:**
- "User manually reconstructs information the system should have preserved"
- "User stops mid-task to verify agent output in an external system"
- "User asks for plan visibility before delegating to avoid micromanaging"

**Bad definitions:**
- "Cognitive overload" (no detail)
- "Confused" (judges, doesn't describe)

### Phase 5: Assign Categories

Choose one primary category per code:

| Category | Definition | Example |
|---|---|---|
| **behavior** | Something the user does (action, workaround, strategy) | "Manually copying output to external document" |
| **language_pattern** | Repeated phrasing, metaphor, hedging language | "Treating agent as 'junior teammate'" |
| **pain_point** | Friction, frustration, effort | "Session starts over without context" |
| **workaround** | What user does to compensate for system gap | "Using external notepad to preserve context" |
| **expectation** | What user thought would happen | "Agent would remember previous decisions" |
| **need** | Functional, emotional, or social need | "Ability to stay accountable without micromanaging" |
| **tension** | Contradiction between two user statements/behaviors | "Wants autonomy AND wants control" |
| **strategy** | Deliberate approach or tactic | "Testing agent conservatively on small tasks first" |

### Phase 6: Collect Examples

For each code, find 2+ examples:
- Participant ID (P01, P02, etc.)
- Exact timestamp (mm:ss)
- Verbatim quote or precise behavior description
- Brief context (1–2 sentences)

**Example:**
```json
{
  "code_name": "reconstructing_lost_context",
  "examples": [
    {
      "participant": "P01",
      "timestamp": "05:30",
      "quote": "I had to re-explain the whole thing because it didn't remember what we worked on yesterday",
      "context": "User expected agent to retain context across sessions"
    },
    {
      "participant": "P02",
      "timestamp": "12:15",
      "quote": "Every time I come back, I have to start from scratch and remind it what the project is",
      "context": "Same issue; user has to manually restore state"
    }
  ]
}
```

### Phase 7: Watch for Saturation

Stop when new transcripts yield no new codes.

**Saturation indicators:**
- Last 2 transcripts produced no new codes
- Codes from new transcript fit into existing categories without needing new codes
- Codebook is stable across multiple passes

**Report saturation:**
```json
{
  "saturation": {
    "indicator": "high",
    "last_new_code": "CODE-047 at P05",
    "transcripts_since_last_new_code": 1,
    "note": "P06 produced no new codes; saturation likely"
  }
}
```

### Phase 8: Analyze Code Statistics

Generate statistics:
- Total codes generated
- Codes per category
- Participant coverage (which participants exhibit which codes?)
- Density (how evenly distributed are codes across participants?)

**Example:**
```json
{
  "codebook_statistics": {
    "total_codes": 47,
    "codes_by_category": {
      "behavior": 22,
      "language_pattern": 15,
      "pain_point": 12,
      "workaround": 8,
      "expectation": 6,
      "tension": 4
    },
    "participant_coverage": {
      "P01": 31,
      "P02": 28,
      "P03": 22,
      "P04": 19,
      "P05": 18,
      "P06": 14
    },
    "saturation": "high",
    "note": "Behavior and language_pattern codes dominate; strong consistency across first 4 participants"
  }
}
```

## Credibility Checks

Before finalizing the codebook, ask:

1. **Can a second analyst apply these codes consistently to new data?**
   - If definitions are vague, they won't.

2. **Are codes description, not interpretation?**
   - Compare: "User verifies output manually" (description) vs. "User doesn't trust the agent" (interpretation).

3. **Is every code backed by 2+ examples?**
   - Single examples aren't patterns.

4. **Do codes overlap, or is each distinct?**
   - Codes should be orthogonal (non-overlapping). If you see overlap, merge or refine.

5. **Did you avoid forcing data into pre-existing categories?**
   - Codebook should be *generated* from data, not *imposed* on it.

6. **Are code names data-grounded, not theory-loaded?**
   - "Reconstructing lost context" ✓ | "Information architecture gap" ✗

## Common Mistakes

| Mistake | Fix |
|---|---|
| Code names use jargon ("cognitive overhead") | Use data language ("stopping mid-task to check external system") |
| Only one example per code | Find 2+ examples; one is anecdote, two is pattern |
| Codes are too abstract ("communication issues") | Be specific ("User asks for step-by-step reasoning from agent") |
| Forcing data into pre-existing categories | Let codes emerge; don't impose theory |
| Missing saturation | When no new codes appear in 2+ transcripts, stop and report saturation |
| Code overlap (two codes mean nearly the same thing) | Merge similar codes or refine definitions |

## Output Quality Rubric

A strong codebook:
- [ ] All codes are data-grounded, not theory-loaded
- [ ] All code names are self-explaining (verb + noun)
- [ ] Every code has a one-sentence definition
- [ ] Every code has 2+ examples with timestamps and quotes
- [ ] Codes are assigned to appropriate categories (behavior, language_pattern, etc.)
- [ ] Codes are distinct (not overlapping)
- [ ] Saturation is documented
- [ ] Coverage statistics show which participants exhibit which codes
- [ ] Another analyst could apply this codebook to new data and get consistent results

## Next Steps for Synthesis Team

The Synthesizer will:
- Cluster codes into higher-order themes
- Identify relationships between codes
- Distinguish strong patterns from weak signals
- Reference codes when building themes (maintaining traceability)

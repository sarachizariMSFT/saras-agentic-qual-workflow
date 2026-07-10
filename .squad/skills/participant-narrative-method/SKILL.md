# Participant Narrative Method

## Overview

This skill guides the Participant Narrative agent through reconstructing and documenting the lived experience of each participant *before* the team abstracts into themes.

## Process

### Phase 1: Read for Story, Not Codes

Don't code as you read. Let the person's journey emerge.

**Key questions:**
- What is this person trying to accomplish?
- What surprises them?
- Where do they get stuck?
- What do they do when stuck?
- How does their confidence change?
- What do they assume about the system?

**Technique:** Read the transcript sequentially, highlighting transitions where the person's mood, confidence, or strategy shifts.

### Phase 2: Mark Key Moments

Identify emotional peaks, turning points, contradictions, and AHA moments.

**For each key moment, record:**
- Exact timestamp
- Type: turning_point | emotional_peak | contradiction | aha_moment | breakdown
- What happened (description)
- Why it matters (significance)
- Direct quote or behavior

**Example:**
```json
{
  "timestamp": "15:45",
  "type": "emotional_peak",
  "description": "User expresses frustration after agent produces unexpected output",
  "quote": "I didn't expect it to do that... I have to redo this",
  "significance": "Reveals trust boundary; user didn't have control mechanism"
}
```

### Phase 3: Extract Mental Model Signals

What does this person assume about the system? Listen for:
- "I thought..."
- "I expected..."
- "I didn't know..."
- Metaphors ("it's like...", "it works like...")
- What they ask or don't ask (revealing assumptions)

**For each signal, record:**
- The assumption (stated or inferred)
- Evidence (quote or behavior)
- Timestamp
- Confidence level (high/medium/low)

### Phase 4: Document Breakdowns

Where did the experience fail? For each breakdown:
- **Trigger:** What led to the problem?
- **User expectation:** What did they think would happen?
- **System behavior:** What actually happened?
- **User reaction:** What did they do/feel/say?
- **Recovery behavior:** How did they move forward or give up?
- **Severity:** low | medium | high

**Example:**
```json
{
  "trigger": "Agent restarted and participant tried to reference a previous decision",
  "user_expectation": "Agent would remember the previous decision",
  "system_behavior": "Agent had no context; asked for clarification",
  "user_reaction": "Frustrated; manually reconstructed the context",
  "recovery_behavior": "Added context to prompt and proceeded",
  "severity": "medium"
}
```

### Phase 5: Track Emotional Trajectory

How does confidence, trust, or frustration change over time?

Create an arc:
- Beginning: Who is this person? What are they trying to accomplish?
- Middle: What goes well? What goes wrong? How do they adapt?
- End: What did they learn? Did they succeed?

**Record transitions:**
- Confident → confused → frustrated → resigned
- Confident → confused → delighted → cautious
- Skeptical → interested → engaged

### Phase 6: Identify Internal Contradictions

Do they hold conflicting beliefs?
- "I think the agent is learning" AND "I can't predict what it will do"
- "I want the agent to be autonomous" AND "I'm nervous about letting it work alone"

Record:
- Statement 1 (with timestamp)
- Statement 2 (with timestamp)
- Why the contradiction matters

### Phase 7: Synthesize the Overall Journey

Tell the story:
- Who is this person? (role, context, goals)
- What were they trying to do?
- What went smoothly?
- What broke? How did they handle it?
- What did they learn?
- What does this reveal about their mental model and needs?

Write 2–3 paragraphs that capture the essence of their experience.

### Phase 8: Extract Research Implications

What does this narrative suggest for:
- Product design?
- User segmentation?
- Mental model gaps?
- Future research?

## Credibility Checks

Before finalizing a narrative, ask:

1. **Can you point to a quote or timestamp for every major claim?**
   - If not, you're interpolating. Acknowledge that.

2. **Did you preserve contradictions, or smooth them away?**
   - Contradiction is signal, not noise.

3. **Would this narrative surprise the participant, or would they recognize themselves?**
   - The best test: would they say "yes, that's me"?

4. **Did you avoid judgment?**
   - Don't interpret why they believe something; just report what they believe.

5. **Did you capture emotional texture?**
   - Flat narratives miss what matters to the person.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Over-interpreting ("The user has abandonment issues") | Report the behavior ("User stopped using the feature after two failed attempts") |
| Only one example per pattern | Collect 2+ examples showing the pattern is real |
| Forcing consistency ("They said X then Y, so they meant Z") | Preserve the contradiction; it's data |
| Missing emotional cues | Listen for tone shifts, pauses, laughter, frustration |
| Skipping the mundane ("They seemed fine") | Even "fine" is data if it contradicts expectations |

## Output Quality Rubric

A strong narrative:
- [ ] Captures the participant's goals and expectations upfront
- [ ] Documents at least 2–3 key moments (breakdowns, insights, emotional peaks)
- [ ] Includes mental model signals with evidence
- [ ] Preserves contradictions or uncertainties (not resolved)
- [ ] Shows emotional trajectory (confidence/trust changes)
- [ ] Every major claim cites a timestamp or quote
- [ ] Reads like a case study; another analyst could predict how this person would behave in a similar situation
- [ ] Contains no assumptions about *why* they believe something, only what they believe

## Next Steps for Synthesis Team

The Synthesizer will:
- Compare narratives across participants to spot patterns
- Track which participants experience similar breakdowns
- Identify participant segments with distinct mental models
- Preserve participant context when extracting themes

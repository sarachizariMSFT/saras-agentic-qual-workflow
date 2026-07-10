# Product Implications Method

## Overview

This skill guides the Product Implication agent through translating research findings into *strategy*, not feature lists.

Core principle: Do NOT say "build X." Say "this suggests the product should support Y." Then let design explore solutions.

## Process

### Phase 1: Extract the Need Behind the Finding

Start with a finding. Dig down to the underlying need.

**Levels of abstraction:**
1. **Observation:** "Users manually verify agent output before using it"
2. **Task:** What are users doing? "Checking outputs"
3. **Goal:** Why are they doing it? "Ensure output is correct"
4. **Need:** What do they actually need? "Confidence that delegation is safe"

**Technique:** Ask "why?" five times:

Finding: "Users manually verify agent output"
- Why? "To check if it's correct"
- Why do they care if it's correct? "Because they'll use it"
- Why do they need to check before using? "They don't trust it automatically"
- Why don't they trust it? "They haven't had time to build trust"
- What would build trust? "Knowing the agent's reasoning, seeing consistent accuracy"

**Underlying need:** "When I delegate work to an agent, I need to understand its reasoning and track its accuracy, so I can build trust and delegate more confidently."

### Phase 2: Identify Design Principles

From the need, extract the principle the product should stand for.

**Good design principles:**
- Are general (apply to multiple opportunities)
- Are actionable (inform design decisions)
- Are human-centered (based on user needs, not features)

**Examples:**
- "Surface agent reasoning to build user trust" (good)
- "Add a transparency button" (bad—too specific, not a principle)
- "Enable users to verify outputs" (okay—principle, but passive)
- "Make verification lightweight so users can delegate confidently" (good—principle + implication)

**From the need above:**
- "The product should surface agent reasoning"
- "The product should help users track agent accuracy over time"
- "The product should make verification lightweight"

### Phase 3: Map to Opportunity Area

Define:
- **Current state:** How do users achieve this goal today? (What's the workaround?)
- **Desired state:** How should users achieve it in the product?
- **Opportunity:** The gap between current and desired

**Example:**
```json
{
  "opportunity_id": "OPP-001",
  "area": "Progress visibility",
  "finding_source": ["F-023", "F-041"],
  "current_state": "Users manually check outputs to verify progress (30-60 min per task)",
  "desired_state": "Users see reasoning and next steps automatically; can spot issues early",
  "opportunity": "Design lightweight verification workflow that builds confidence without adding overhead",
  "key_questions": [
    "What information would users need to feel confident?",
    "How should this surface in the UI?",
    "When should users see it (proactive vs. on-demand)?"
  ],
  "complexity": "medium (requires UX design + backend logic)",
  "timeline_estimate": "Q3",
  "affected_users": "5/6 participants"
}
```

### Phase 4: Assess Risk

What could go wrong if we ignore this finding?

| Risk Level | Definition | Example |
|---|---|---|
| **Critical** | Users abandon the product or make critical errors | If we don't surface trust signals, users will over-trust or abandon |
| **High** | Users lose productivity or create workarounds | Users spend 30+ min per task verifying manually |
| **Medium** | User experience degrades but product still works | Users feel anxious but proceed; friction but no abandonment |
| **Low** | Nice-to-have but not essential | Users would like this but can live without it |

**For each risk:**
- What's the consequence if we don't address it?
- Who is affected?
- How likely is the bad outcome?
- How severe is it?

### Phase 5: Identify Future Research Questions

What do we still need to understand to design well?

**Good research questions:**
- Are specific ("How do users decide whether to trust an agent?")
- Are actionable (answering it would change a design decision)
- Are feasible (answerable in the next study or iteration)

**Examples:**
- "How do users calibrate their trust in the agent over time?"
- "What signals make verification feel thorough vs. perfunctory?"
- "What's the right balance between autonomy and control for different task types?"

**Don't ask:**
- "Do users want better transparency?" (too vague; already answered)
- "Should we build a feature?" (not a research question; a product decision)

### Phase 6: Synthesize into Product Implications

Bring it together:

```json
{
  "implication_id": "IMP-001",
  "source_findings": ["F-023", "F-041", "F-045"],
  "design_principle": "Surface agent reasoning to enable user oversight without micromanagement",
  "underlying_need": "When I delegate work to an AI agent, I need to understand what it is doing and why, so I can stay accountable without controlling every step",
  "current_friction": "Users manually verify outputs; takes 30-60 min per task; creates bottleneck",
  "desired_experience": "Agent surfaces reasoning proactively; users spot issues early; verification is fast",
  "opportunity_areas": [
    {
      "area": "Progress visibility",
      "design_questions": [
        "What reasoning should be visible (all steps or just summaries)?",
        "When should visibility kick in (during work or after)?",
        "How should users navigate/filter reasoning?"
      ]
    },
    {
      "area": "Verification flow",
      "design_questions": [
        "How can users efficiently spot errors?",
        "What's the 'review unit' (per-step, per-task, per-output)?",
        "How much detail is enough?"
      ]
    }
  ],
  "risks": [
    {
      "risk": "If reasoning is too detailed, users get overwhelmed; if too sparse, they don't trust",
      "mitigation": "User research on information preferences; iterative refinement"
    }
  ],
  "priority": "high",
  "related_mental_models": ["Users assume agent is transparent about reasoning"],
  "research_needed": [
    {
      "question": "What makes verification feel thorough vs. perfunctory?",
      "research_method": "Prototype testing + follow-up interviews"
    }
  ]
}
```

### Phase 7: Avoid Feature Creep

**Red flags (you're thinking like a feature team, not a strategy team):**
- "Build a progress bar" ← Too specific, too fast
- "Add a reasoning tab" ← Solution, not principle
- "Allow users to set transparency level" ← Might be right, but derive it from principle first

**Good framing:**
- "The product should surface agent reasoning in a way that builds user confidence"
- "Users need lightweight verification; design should minimize friction"
- "Design principle: transparency + efficiency over completeness"

## Credibility Checks

Before finalizing product implications, ask:

1. **Is every implication linked back to a source finding?**
   - Don't invent opportunities; base them on research.

2. **Did I avoid jumping to solutions?**
   - "Needs to support X" ✓ | "Add feature Y" ✗

3. **Are design principles general enough to apply to multiple opportunities?**
   - Compare: "Surface reasoning" (general) vs. "Add a reasoning tab" (specific)

4. **Are risks realistic and testable?**
   - "Users might get overwhelmed" (testable) vs. "Users might leave" (vague)

5. **Are research questions specific enough to guide future work?**
   - "What makes verification feel thorough?" ✓ | "What do users want?" ✗

6. **Did I consider contradictory findings?**
   - If one group wants X and another wants not-X, say so. That's a design challenge.

## Common Mistakes

| Mistake | Fix |
|---|---|
| "Add a button for X" (solution) | "Users need lightweight way to X" (need) → design explores solutions |
| Ignoring contradictions ("Most users want X, some want Y; so build X") | "Most want X, some want Y—design must address both or pick a segment" |
| Treating all opportunities equally | Prioritize by impact × likelihood × effort |
| Implications with no research connection | Every implication must link back to a finding |
| Speculative opportunities ("Users might want...") | Base on research; flag as "speculative" if you must include it |

## Output Quality Rubric

Strong product implications:
- [ ] Every implication is linked to source finding(s)
- [ ] Underlying need extracted (not just task)
- [ ] Design principle articulated (general, actionable)
- [ ] Opportunity areas defined (current state vs. desired state)
- [ ] Risks identified and mitigations considered
- [ ] Future research questions specific and actionable
- [ ] Prioritized (high/medium/low)
- [ ] Free of feature-level specificity (supports X, not "add Y")
- [ ] Contradictions surfaced (if groups disagree, say so)

## Next Steps for Stakeholders

- **Product manager:** Use implications to prioritize roadmap
- **Design:** Use design principles + opportunities to scope exploration
- **Researchers:** Plan follow-up studies based on research questions

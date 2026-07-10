# Mental Model Mapping

## Overview

This skill guides the Mental Model agent through diagnosing root causes. It separates *usability* friction (hard to use) from *expectation mismatch* (user thinks something is true that isn't).

Key principle: A lot of AI product friction isn't just usability friction. It's model mismatch.

## Process

### Phase 1: Extract Assumptions

From participant narratives, pain-points, and observed behavior, identify what users assume is true about the system.

**Listen for:**
- "I thought..."
- "I expected..."
- "I assumed..."
- "I didn't know..."
- Metaphors: "It's like..." or "It works like..."
- What they ask or don't ask (silence reveals assumptions)

**Common assumptions to look for:**
- How the system stores information (persistent? shared? encrypted?)
- What the system "knows" about the user (goals? constraints? history?)
- How the system decides (deterministic? probabilistic? random?)
- What the user can control (inputs only? process? output?)
- When the system learns (in-session? across sessions? never?)
- Who can access outputs (private? shared? logged?)

**Record each assumption:**
```json
{
  "assumption": "Agent remembers all previous conversations",
  "assumed_by": ["P01", "P02", "P03"],
  "evidence": [
    {
      "participant": "P01",
      "quote": "I expected it to remember what we did last time",
      "timestamp": "05:30",
      "confidence": "high"
    }
  ],
  "evidence_type": "explicit (stated directly)"
}
```

### Phase 2: Map to System Reality

For each assumption, ask: **Is this true?**

Find the documented system behavior or ask the product team:
- What is actually true?
- How would a user discover the truth?
- Is the system ambiguous about this?

**Examples:**
| Assumption | Reality | Match? |
|---|---|---|
| "Agent remembers previous conversations" | "Agent restarts each session; context via prompt only" | ✗ Mismatch |
| "Agent will ask if it's uncertain" | "Agent sometimes guesses confidently" | ✗ Mismatch |
| "I can control what the agent does" | "Agent can act autonomously if I approve delegation" | ✗ Partial mismatch |

### Phase 3: Assess Severity

Not all mismatches matter equally.

| Severity | Definition | Example |
|---|---|---|
| **Critical** | User expects A, gets B; takes wrong action based on mismatch | User thinks agent output persists; trusts it with sensitive data |
| **High** | User confused; creates workaround or loses trust | User expects persistence; manually copies outputs as backup |
| **Medium** | User confused but figures it out; slows them down | User assumes deterministic behavior; experiments to understand pattern |
| **Low** | User has wrong theory but reaches correct action anyway | User thinks agent "learns"; actually adjusting prompt feedback works |

**Severity factors:**
- Does the mismatch cause wrong behavior?
- Does the user lose trust?
- Do they create workarounds?
- How much productivity is lost?

### Phase 4: Detect Contradictions

Do users hold *conflicting* beliefs simultaneously?

These reveal where the product is ambiguous or confusing.

**Examples:**
- "The agent is deterministic" AND "The agent adapts to my feedback"
- "I can fully control what the agent does" AND "The agent does unexpected things"
- "The agent is just a tool" AND "The agent has its own judgment"

**For each contradiction:**
- What conflicting beliefs does the user hold?
- Is this contradiction resolved by end of session, or do they keep both beliefs?
- What would clarify the contradiction?

```json
{
  "contradiction": {
    "belief_1": "Agent is deterministic (same input → same output)",
    "belief_2": "Agent adapts to my feedback (learns)",
    "held_by": ["P04", "P05"],
    "evidence": [
      {
        "participant": "P04",
        "timestamp": "08:15",
        "statement_1": "I expected the same output if I ask the same question"
      },
      {
        "participant": "P04",
        "timestamp": "22:30",
        "statement_2": "The agent seems to understand better now that I've given feedback"
      }
    ],
    "significance": "User is confused about when/how agent behavior changes",
    "design_implication": "Clarify determinism vs. learning in onboarding"
  }
}
```

### Phase 5: Track Mental Model Shifts

When does a user change their mental model? What triggers the shift?

**For each shift:**
- Initial model
- Shifted-to model
- What triggered it (observation? explicit explanation? surprise?)
- Timestamp
- Confidence (did they fully shift, or hedge both models?)

**Example:**
```json
{
  "shift": {
    "participant": "P02",
    "initial_model": "Agent is a helper I give instructions to; I control everything",
    "shifted_to": "Agent is like a junior teammate; I need to monitor it and set boundaries",
    "trigger": "First time agent did something unexpected without asking",
    "trigger_timestamp": "15:45",
    "trigger_behavior": "User discovered agent could act autonomously",
    "confidence": "high (user explicitly stated the shift)",
    "implications": "Need to set autonomy expectations early"
  }
}
```

### Phase 6: Connect to Design

For each mismatch, contradiction, or shift:

- **What design change would align reality with expectation?** (or surface reality clearly?)
- **Is it a feature gap, a communication gap, or both?**
- **What would users need to know to avoid the mismatch?**

**Example:**
| Problem | Design Solution | Type |
|---|---|---|
| Users assume persistence that doesn't exist | Surface session boundaries in UI; clarify in onboarding | Communication |
| Users think agent is deterministic but it isn't | Show how feedback changes behavior; document patterns | Communication |
| Users want autonomy but fear uncontrolled behavior | Design pause/review points; show what agent will do before it acts | Feature + Communication |

### Phase 7: Prioritize for Product

Not all mental model gaps need fixing immediately.

**Prioritization factors:**
- **Impact:** How many users are affected? How severe is the consequence?
- **Frequency:** How often does this mismatch cause problems?
- **Effort:** How hard is it to fix (communication vs. feature)?

**Priority matrix:**
| Impact | Frequency | Effort | Priority |
|---|---|---|---|
| High | High | Low (communication) | 🔴 DO FIRST |
| High | High | High (feature) | 🟠 DO SECOND |
| High | Low | Low | 🟡 DO LATER |
| Low | Any | Any | 🟢 NICE TO HAVE |

## Credibility Checks

Before finalizing the mental model analysis, ask:

1. **Is every assumption backed by a quote or observed behavior?**
   - Don't infer assumptions; find evidence.

2. **Did I avoid judgment ("user thinks the wrong thing")?**
   - Frame as: "User assumes X; system actually does Y."

3. **Are contradictions real, or am I misreading?**
   - Do they hold both beliefs simultaneously, or do they shift between them?

4. **Would the user recognize their mental model if you showed it to them?**
   - Best test: "Does this feel like how you actually think about the system?"

5. **Did I distinguish between fixable (communication) and unfixable (user misconception) gaps?**
   - Some gaps are just hard-to-understand systems. Some are genuine design misses.

## Common Mistakes

| Mistake | Fix |
|---|---|
| "Users are confused" (vague) | "Users assume X; system does Y" (specific) |
| Only one example of an assumption | Find 2+ examples; show it's a pattern |
| Forcing a single interpretation of contradiction | Maybe the user genuinely holds both beliefs; that's the finding |
| Assuming the fix ("Add a button") | Diagnose the need first; design decides solutions |
| Missing silent assumptions (things users don't say) | Listen for what they don't ask; it reveals assumptions |

## Output Quality Rubric

A strong mental model analysis:
- [ ] Every assumption backed by evidence (quote or behavior)
- [ ] System reality documented for each assumption
- [ ] Severity assessed for each mismatch (critical/high/medium/low)
- [ ] Contradictions identified and explained
- [ ] Mental model shifts documented with triggers
- [ ] Design implications extracted (communication vs. feature vs. both)
- [ ] Prioritized for product work
- [ ] Free from judgment ("users are wrong"); framed as "assumption vs. reality"

## Next Steps for Synthesis & Product Team

The Synthesizer will:
- Reference mental models when building themes (e.g., "themes reflect user expectations, not reality")
- Flag themes where design can address root cause vs. just symptom

The Product Implications Agent will:
- Use mental model maps to inform design principles and product strategy

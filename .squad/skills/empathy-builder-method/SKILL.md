# Empathy Builder Method

A systematic process for translating raw participant experience into evidence-based empathy language that helps stakeholders understand the participant's point of view without exaggerating it.

---

## Phase 1: Read Participant Narrative Output

**Input:** `01b-participant-narratives.json` (one per participant)

**What to extract:**
- Emotional arc: confidence → uncertainty → caution (or other trajectory)
- Breakdowns: trigger → expectation → what actually happened → participant reaction
- Mental models: what did they assume? When did that assumption break?
- Goals and pressures: what were they trying to accomplish? What were they responsible for?
- Moments of hesitation, relief, frustration, confusion, trust, doubt
- The participant's own language: metaphors, emotional phrasing, how they describe the experience
- Shifts in behavior: when did they change tactics? Why?

**Output so far:** Raw emotional data extracted from narrative

---

## Phase 2: Identify Evidence for Emotional Signals

For each emotional reaction, find supporting evidence:

**Valid evidence sources (in order of strength):**

1. **Participant said it explicitly** ("I felt nervous," "I was confused," "I was relieved")
2. **Behavior showed it** (hesitation, pause before accepting, repeated checking, slowing down, taking back control)
3. **Timing/sequence revealed it** (they waited 30 seconds before proceeding, which suggests caution)
4. **Tone or phrasing showed it** ("I guess I'll check... but I probably shouldn't need to" suggests doubt)
5. **Task flow changed** (they abandoned one approach and switched to another, suggesting frustration or uncertainty)
6. **Researcher observation notes** (if available: "participant appeared uncertain," "noticeably more cautious")

**Invalid evidence (don't use):**
- Assumption: "They probably felt X because people usually feel X"
- Demographic inference: "As a senior engineer, they likely felt threatened"
- Dramatization: "They were terrified" without evidence
- Over-interpretation: "nervous laugh" → "anxious" (be more specific: nervous laugh suggests discomfort)

**Output:** Emotional claims paired with evidence citations

---

## Phase 3: Build Emotional Journey Map

Create a sequence map showing emotional shifts:

**Template:**

| Moment | What Happened | Participant Reaction | Evidence | What It Suggests About Experience |
|--------|---------------|----------------------|----------|-------------------------------------|
| **Start** | Agent receives instruction | Confident, hands-off | Participant spoke quickly, direct tone | Expects delegation to transfer responsibility |
| **Agent acts** | Agent changes files | Participant pauses, says "Wait" | Observed hesitation + quote | Expects transparency; surprised by changes |
| **Verification** | Manually checks files | Cautious, slows down | Reopens files multiple times | Shifted to supervisory mode |
| **Acceptance** | Accepts final output | Cautious but proceeds | Proceeds after manual check | Trust is conditional on visibility |

**Key questions to answer:**
- How did the participant feel at each stage?
- What triggered emotional shifts?
- What was the trajectory? (improving → declining, stable → shifting, etc.)
- Where did confidence drop? Rise? Plateau?

**Output:** Sequenced emotional journey with evidence

---

## Phase 4: Translate Into Empathy Language

Take abstract observations and reframe for stakeholder empathy.

**Bad (abstract, disconnected from experience):**
> Users need better transparency.
> Users lack trust in AI.
> Users want more control.

**Good (grounded in experience):**
> Participants delegated work to the agent but couldn't fully let go because they remained accountable for the outcome. When they couldn't tell what changed, they shifted from trusting the agent to verifying every change. The issue wasn't distrust of AI itself; it was the gap between handing off work and handing off responsibility.

**Translation process:**

1. **Start with the observation:** "Participants reopened files after agent completed work"
2. **Name the emotional shift:** From confident delegation → to cautious verification
3. **Ask "why":** Why did they reopen files? What was the pressure? ("I'm still responsible")
4. **Connect to product moment:** What in the experience triggered this? ("They couldn't tell what changed")
5. **Translate to participant perspective:** "From their point of view, completing work ≠ finishing responsibility"
6. **Frame as reasonable:** "Their caution made sense because…"
7. **Make it actionable:** What design/communication gap created this?

**Example translations:**

| Raw Observation | Empathy-Centered Translation |
|-----------------|-------|
| Participant hesitated before accepting | Participant needed reassurance before trusting the output; they wanted to maintain accountability |
| Participant checked files multiple times | Participant couldn't verify the agent's work was complete without manual inspection; verification burden stayed with them |
| Participant asked "What changed?" repeatedly | Participant couldn't predict agent behavior; the lack of transparency created uncertainty |
| Participant's confidence dropped over time | Participant started with trust but lost confidence as they saw unexpected changes; visibility before acceptance became critical |

**Output:** Empathy-centered language for all major moments

---

## Phase 5: Create Empathy Snapshot per Participant

Write a 200-300 word snapshot that captures "what the experience felt like from their perspective."

**Structure:**
1. **Opening: The overall experience** — One sentence capturing their emotional journey
2. **Goals and context** — What were they trying to do? What constraints were they working under?
3. **Key emotional shifts** — When did things change? Why?
4. **The underlying pressure** — What was really driving their behavior? (often not what they said explicitly)
5. **The experience from their POV** — How did this feel from their perspective?

**Example:**

> P03 started confidently, expecting the agent to handle the implementation work. That confidence quickly evaporated when they saw the agent had changed files they hadn't explicitly instructed. From that moment, P03 shifted into a supervisory role — repeatedly checking diffs, reopening files, and slowing down before accepting changes. The experience transformed from "saving time" into "making sure hidden work wasn't created." Underneath this shift was a simple pressure: P03 was still responsible for the final code, even though someone else had produced it. They couldn't fully delegate because accountability didn't transfer with the work. The caution wasn't about distrusting AI; it was about the weight of responsibility without full visibility. From P03's perspective, the agent's work wasn't finished until they verified it themselves.

**Guardrails for snapshots:**
- Ground in evidence (can you point to quotes/behaviors?)
- Preserve dignity (frame as reasonable, not neurotic)
- Show emotional transitions (how did it change?)
- Connect to product moments (what created this feeling?)
- Avoid dramatization (don't exaggerate intensity)
- Use participant language where it carries meaning
- Keep contradictions visible (if they felt confident AND cautious, say so)

**Output:** Empathy snapshots, one per participant

---

## Phase 6: Generate Stakeholder Empathy Prompts

Create 5-10 questions that help PMs, designers, engineers step into the user's shoes.

**Template questions (adapt per participant):**

- **Responsibility:** What would it feel like to be responsible for work you produced but didn't fully create?
- **Control:** Where did you lose ability to predict what would happen next?
- **Verification:** What would you need to do to verify this work was safe to accept?
- **Effort:** What hidden work did you have to do because of unclear communication?
- **Confidence:** What would it take to feel safe delegating this fully?
- **Capability:** What part of this experience made you feel capable? Exposed?
- **Communication:** What would you have needed to know upfront to feel differently?
- **Accountability:** How did you stay accountable for someone else's work?

**Example prompts for P03:**
- If you were responsible for code you didn't write, what would you need to see to trust it?
- What's the difference between "the agent finished" and "the work is finished" from your perspective?
- How would you feel if someone changed your code and didn't tell you what changed?

**Output:** Stakeholder empathy prompts, tailored per participant type

---

## Phase 7: Reframe Abstract Findings Into Empathy Language

Take themes from Participant Narrative and reframe with human context.

**Before (abstract theme):**
> "Users need better visibility into agent actions."

**After (empathy-centered finding):**
> Participants were willing to let the agent do the work, but they could not lose sight of what changed. When visibility was low, they shifted from trusting the agent to verifying every change. The underlying need was not just "more information." It was enough visibility to stay responsible while delegating — maintaining psychological safety while handing off work they were still accountable for.

**Process:**

1. **Identify abstract theme** — e.g., "visibility," "transparency," "control"
2. **Ask:** What's the *emotional* need underneath? (not just the surface request)
3. **Find evidence** — Where did this show up behaviorally?
4. **Translate:** What would it feel like to be in that situation?
5. **Connect to product** — What in the product experience created this need?
6. **Make actionable** — What does this imply for design/communication?

**Output:** Reframed findings with empathy-centered language

---

## Phase 8: Quality Check Before Submission

Ask these questions about every empathy output:

**Evidence-based:**
- [ ] Did I ground every emotional claim in evidence?
- [ ] Can I point to a quote, behavior, or observation for each interpretation?
- [ ] Did I distinguish between "they said this" and "I inferred this"?

**Respectful:**
- [ ] Did I preserve the participant's dignity?
- [ ] Did I avoid pathologizing their behavior as irrational or fearful?
- [ ] Would the participant feel fairly represented?

**Not dramatized:**
- [ ] Did I avoid exaggerating emotional intensity?
- [ ] Did I use careful language ("seemed," "suggested," "appeared")?
- [ ] Did I avoid "shattered," "terrified," "abandoned"?

**Connected to context:**
- [ ] Did I connect emotions to specific product moments?
- [ ] Did I explain the pressures/constraints that shaped behavior?
- [ ] Did I show how the experience changed over time?

**Not invented:**
- [ ] Did I assign feelings only where there was evidence?
- [ ] Did I avoid assuming emotions from demographics or personality?
- [ ] Did I include contradictions instead of smoothing them away?

**Human-centered:**
- [ ] Did I use the participant's own language where powerful?
- [ ] Did I preserve their point of view, not mine?
- [ ] Is this traceable back to raw data?

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Inventing Emotions

**Bad:**
> The participant was terrified the agent would break the code.

**Evidence-based:**
> The participant hesitated before accepting the agent's changes and asked to verify the files first. This suggests they wanted confidence that the code was safe before proceeding.

**Fix:** Use only evidence you can see or hear. Mark low confidence when inferring.

---

### ❌ Mistake 2: Dramatizing the Data

**Bad:**
> The agent completely shattered the participant's trust.

**Evidence-based:**
> The participant became more cautious after seeing an unexpected file change. Trust shifted from unconditional to conditional — trust upon verification.

**Fix:** Avoid superlatives. Use precise, measured language.

---

### ❌ Mistake 3: Pathologizing Participants

**Bad:**
> The user was paranoid about AI and couldn't let the agent work independently.

**Evidence-based:**
> The participant remained cautious because they were responsible for the final code. Their verification process was a reasonable response to staying accountable for work they didn't produce.

**Fix:** Frame reactions as reasonable responses to context, not personal flaws.

---

### ❌ Mistake 4: Replacing Evidence with Vibes

**Bad:**
> This felt emotionally heavy and burdened.

**Evidence-based:**
> The participant paused several times, reread the agent's output, and reopened the same file twice. They said afterward, "I feel like I'm babysitting it." This sequence suggests they experienced the work as effortful despite being delegated.

**Fix:** Always cite behavior, quotes, or observable signals.

---

### ❌ Mistake 5: Erasing Contradictions

**Bad:**
> All participants wanted more transparency and didn't trust the agent.

**Evidence-based:**
> Most participants became more cautious after seeing unexpected changes. However, one participant trusted the agent quickly because they felt the task was low-risk and easy to reverse. Participants' trust was conditional on task severity, not on AI itself.

**Fix:** Keep differences visible, especially when behavior diverges.

---

### ❌ Mistake 6: Over-Interpretation

**Bad:**
> The participant laughed nervously because they were afraid.

**Evidence-based:**
> The participant laughed nervously when the agent proposed changes. The nervous laugh suggests discomfort or uncertainty, though the underlying cause isn't explicit from the laugh alone. Later, the participant reopened files to verify, which suggests their discomfort was about verification, not fear.

**Fix:** Describe what you see (nervous laugh) without jumping to cause (fear). Let behavior pile up before inferring.

---

## Example Outputs

### Empathy Snapshot (Full Example)

**Participant P02:**

> P02 approached the task methodically and expected to stay in control throughout. They gave the agent clear, detailed instructions and then stepped back. Early on, this felt good — they had delegated work and the agent was progressing. But as the agent worked, P02 became increasingly uncertain about what was happening. They didn't receive frequent updates, and when the agent finished, P02 couldn't immediately see what had been done. Rather than accepting the output, P02 asked the agent to walk them through each change. As the changes were explained, P02's confidence partially returned — but only after they understood the reasoning. The underlying pressure for P02 was clarity: they could accept delegation IF they understood the "why" behind decisions. Without that understanding, they couldn't move forward. From P02's perspective, the issue wasn't that the agent was capable or not; it was that the agent's decision-making was opaque. Knowing *why* decisions were made would have transformed the experience from confusing to collaborative.

### Emotional Journey Map (Full Example)

| Moment | What Happened | Reaction | Evidence | Interpretation |
|--------|---------------|----------|----------|------------------|
| **0:00 - Give instructions** | P02 provides detailed instructions to agent | Confident, clear communication | Speaks methodically; detailed instructions | Expects a clear handoff; trusts the agent can execute |
| **5:30 - Agent progresses** | Agent completes first batch of work | Satisfied, stepped back | P02 relaxes, does not interrupt | Initial delegation feels successful |
| **12:00 - No updates** | P02 doesn't hear from agent for extended time | Growing uncertainty | P02 checks progress multiple times; says "I wonder what it's doing" | Needs visibility into progress; silence creates doubt |
| **18:00 - Agent finishes** | Agent presents completed work | Caution, hesitation | P02 pauses, doesn't immediately accept; asks "Can you walk me through this?" | Needs to understand changes before accepting |
| **22:00 - Explanation** | Agent explains reasoning for each change | Partial relief, growing confidence | P02 nods, asks clarifying questions; says "Okay, I understand" | Understanding the *why* restores confidence |
| **25:00 - Acceptance** | P02 accepts changes and moves forward | Confidence restored (but conditional) | P02 proceeds, but says "I'd want this level of explanation every time" | Trust is now tied to transparency of reasoning |

### Stakeholder Empathy Prompts (Full Example)

**For PMs/Designers:**
1. How would you feel if someone made decisions that affected your work, but you couldn't see their reasoning?
2. What's the difference between trusting someone's capability and understanding their decision-making?
3. How would knowing the "why" behind changes change your willingness to delegate?

**For Engineers:**
1. If you were responsible for code changes you didn't make, what would help you feel safe accepting them?
2. What information would you need to see upfront, vs. after the fact?
3. How do you currently verify work from teammates? What would you need from an agent?

**For Product:**
1. What does "transparency" actually mean from a user's perspective in this context?
2. Is the problem lack of information, or lack of understanding of the reasoning?
3. How do we show decision-making, not just results?

---

## Integration with Guardrails

This skill is infused with the **Universal Guardrails**, especially:

- **#3: Separate observation from interpretation** — Every empathy claim explicitly marks what was observed vs. inferred
- **#4: Preserve participant nuance** — Differences between participants are kept visible
- **#9: Distinguish behavior from preference** — Behavior (repeated checking) gets more weight than stated preference ("I trust it")
- **#13: Do not confuse participant language with interpretation** — Preserve their exact words when they reveal understanding
- **#15: Do not treat transcript as whole truth** — Use behavior, timing, tone alongside words
- **#16: Protect participant dignity** — Frame reactions as reasonable, not pathological

---

## Master Instruction for Empathy Builder

> Your job is to help stakeholders understand the participant's lived experience without exaggerating it. Stay grounded in what the participant said, did, paused on, repeated, avoided, or worked around. Describe emotional signals carefully and respectfully. Make the experience human, but do not invent feelings, dramatize the story, or turn a single moment into a universal truth. Every empathy claim must be traceable to evidence. You are the bridge between what happened (Participant Narrative Agent) and what it meant (Storyteller Agent).

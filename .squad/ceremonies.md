# Ceremonies

> Team meetings that happen before or after work. Each squad configures their own.

## Design Review

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before |
| **Condition** | multi-agent task involving 2+ agents modifying shared systems |
| **Facilitator** | lead |
| **Participants** | all-relevant |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. Review the task and requirements
2. Agree on interfaces and contracts between components
3. Identify risks and edge cases
4. Assign action items

---

## Retrospective

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | after |
| **Condition** | build failure, test failure, or reviewer rejection |
| **Facilitator** | lead |
| **Participants** | all-involved |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. What happened? (facts only)
2. Root cause analysis
3. What should change?
4. Action items for next iteration


---

## Retrospective with Enforcement

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | weekly |
| **Condition** | No *retrospective* log in .squad/log/ within the last 7 days |
| **Facilitator** | lead |
| **Participants** | all |
| **Time budget** | focused |
| **Enabled** | yes |
| **Enforcement skill** | retro-enforcement |

**Agenda:**
1. What shipped this week? (closed issues, merged PRs)
2. What did not ship? (open issues, blockers)
3. Root cause on any failures
4. Action items -- each MUST become a GitHub Issue labeled retro-action

**Coordinator integration:**
At round start, call Test-RetroOverdue (see skill retro-enforcement). If overdue, run this ceremony before the work queue.

**Why GitHub Issues, not markdown:**
Production data: 0% completion across 6 retros using markdown checklists, 100% after switching to GitHub Issues.

---

## Analysis Kickoff & Brainstorm

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before |
| **Condition** | A UXR analysis run is about to start (after Intake, before specialists spawn) |
| **Facilitator** | Conductor |
| **Participants** | all analysis agents + human researcher |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Purpose:** Align the team before analysis so agents don't work blind, and surface hypotheses/watch-items to test.

**Agenda:**
1. Read research goals, objectives, and hypotheses from `inputs/`.
2. Each specialist states what it will look for and any known bias risks (e.g., leading questions in the guide).
3. Brainstorm: what would surprise us? what would falsify each hypothesis? what moments should Powerful-Moments watch for?
4. Confirm the pain/papercut boundary and severity rubric for this study.
5. Record watch-items to `runs/<model>/00-kickoff.md`. This is part of Human Checkpoint 1.

---

## Analysis Retrospective & Learn

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | after |
| **Condition** | A run finishes final sign-off (Human Checkpoint 3) OR a correction is submitted |
| **Facilitator** | Conductor |
| **Participants** | all-involved + human researcher |
| **Time budget** | focused |
| **Enabled** | ✅ yes |
| **Enforcement skill** | learning-loop |

**Purpose:** Reflect, learn, and improve the pipeline. This is the human-facing half of the learning loop.

**Agenda:**
1. What did the two models disagree on, and which was right? (from the comparison report)
2. Which findings did the human correct or reject, and why?
3. Root cause: was it a prompt, a skill gap, a rubric, or a schema issue?
4. Improvements + suggestions: what should change in agent charters, skills, or evals?
5. Each action item -> a structured correction record (`corrections/`) that the `learning-loop` skill applies,
   with a changelog entry. Brainstorm next-study improvements here too.

---

## Design Review (analysis edition)

Runs before any change to shared analysis contracts (the finding schema, eval rubrics, or the workflow),
using the standard Design Review above with the Conductor as facilitator and QA/Evals required as a participant.

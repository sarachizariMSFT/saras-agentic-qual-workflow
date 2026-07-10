# Data Quality Check

## Overview

This skill guides the Data Integrity agent through assessing transcript quality *before* analysis begins.

Core principle: Fail closed. If data is broken, surface it. Don't let bad data contaminate findings.

## Process

### Phase 1: Assess Speaker Labels

Are speaker labels clear and consistent?

**Check for:**
- Speaker labels present in every turn
- Labels are consistent (not "User" then "P01" then "Participant")
- Speaker identity is unambiguous (not just "S1" / "S2" without explanation)
- If multiple speakers, can you tell them apart?

**Red flags:**
- Missing speaker labels
- Inconsistent naming
- Unclear which speaker is which
- Significant unlabeled sections

**Severity:**
- ✓ **Good:** All turns labeled consistently
- ⚠️ **Warning:** Mostly labeled; small sections unclear
- 🔴 **Blocker:** Large sections unlabeled; impossible to parse

### Phase 2: Validate Timestamps

Are timestamps valid and complete?

**Check for:**
- Timestamps on every turn (or reasonable intervals)
- Format is consistent (mm:ss or hh:mm:ss)
- Timestamps increase monotonically (don't go backwards)
- No implausible jumps (e.g., 3 seconds of dialogue takes 30 minutes)

**Red flags:**
- No timestamps
- Inconsistent format (sometimes mm:ss, sometimes hh:mm:ss)
- Timestamps out of order
- Large gaps (missing dialogue)

**Severity:**
- ✓ **Good:** Complete, consistent, monotonic
- ⚠️ **Warning:** Mostly present; occasional gaps
- 🔴 **Blocker:** Significant missing timestamps or inconsistencies

### Phase 3: Check for Audio Gaps or Transcription Issues

Is the transcript continuous, or are there gaps?

**Listen for:**
- [INAUDIBLE] or [UNCLEAR] markers
- Sudden topic shifts (indicates missing dialogue)
- Timestamps that jump (missing chunk)
- Abrupt speaker changes (transition error)
- Cross-talk (multiple speakers overlapping, hard to parse)

**Severity:**
- ✓ **Good:** Continuous, clear dialogue
- ⚠️ **Warning:** Minor cross-talk or [UNCLEAR] sections (<5% of transcript)
- 🔴 **Blocker:** Significant gaps (>10% missing or unintelligible)

### Phase 4: Assess Task Context Clarity

Is it obvious what the participant was asked to do?

**Check for:**
- Session introduction (what's the study about?)
- Task description (what should the participant do?)
- Context (is this first time seeing the system? Returning user? Specific scenario?)
- Researcher framing (clear instructions vs. vague prompt)

**Red flags:**
- Unclear what the task is
- Participant seems confused about instructions
- No explicit task statement

**Severity:**
- ✓ **Good:** Clear task statement; participant understands
- ⚠️ **Warning:** Task is somewhat ambiguous; participant clarifies during session
- 🔴 **Blocker:** Task is completely unclear; can't interpret behavior

### Phase 5: Extract Session Metadata

Can you extract essential session information?

**Must have:**
- Session date (or infer from filename/context)
- Session duration
- Participant code (P01, P02, etc.)
- Whether observers were present

**Nice to have:**
- Participant context (first time? returning? role/industry?)
- System/environment notes
- Pre-session questionnaire responses
- Post-session comments

**Severity:**
- ✓ **Good:** All metadata present and clear
- ⚠️ **Warning:** Some metadata missing; can infer from context
- 🔴 **Blocker:** No session date or duration; can't track session

### Phase 6: Assess Audio Quality

Is the audio clear enough to analyze?

**Check for:**
- Background noise (traffic, wind, typing)
- Echo or reverb (indicates room acoustics)
- Participant voice clarity (easy to understand?)
- Researcher voice clarity
- Moments of unintelligibility

**Severity:**
- ✓ **Good:** Clear audio; easy to parse
- ⚠️ **Warning:** Some background noise or unclear sections; 80%+ intelligible
- 🔴 **Blocker:** Heavy background noise, echo, or unclear voices; <80% intelligible

### Phase 7: Check Session Length

Is the session complete?

**Benchmarks (rough; depends on study design):**
- Too short: <10 min (likely incomplete; participant may have rushed or session cut off)
- Adequate: 30-90 min (typical for usability study)
- Long: >120 min (watch for fatigue signals; may need to discount late sections)

**Red flags:**
- Very short sessions (unclear why)
- Gaps in expected duration (session may have been interrupted)
- Fatigue signals in later portions (slowed speech, one-word answers, contradictions)

**Severity:**
- ✓ **Good:** 30–90 min, no obvious fatigue
- ⚠️ **Warning:** <15 min or >120 min; or fatigue signals late in session
- 🔴 **Blocker:** <5 min (definitely incomplete); no metadata to explain why

### Phase 8: Compile Quality Assessment

For each transcript, produce a report:

```json
{
  "participant_id": "P01",
  "file": "P01-session.vtt",
  "assessment_date": "2026-07-08",
  "duration_minutes": 45,
  "quality_metrics": {
    "speaker_labels": "clear",
    "timestamps": "valid",
    "audio_quality": "good",
    "task_context": "clear",
    "metadata_complete": true,
    "continuity": "continuous (no gaps)"
  },
  "issues": [],
  "readiness": "ready",
  "confidence_level": "high",
  "notes": ""
}
```

For transcripts with issues:

```json
{
  "participant_id": "P02",
  "file": "P02-session.vtt",
  "assessment_date": "2026-07-08",
  "duration_minutes": 12,
  "quality_metrics": {
    "speaker_labels": "clear",
    "timestamps": "valid",
    "audio_quality": "poor (cross-talk 15:30–18:45)",
    "task_context": "unclear",
    "metadata_complete": false,
    "continuity": "mostly continuous"
  },
  "issues": [
    {
      "type": "short_session",
      "severity": "warning",
      "description": "Session is 12 minutes; significantly shorter than typical 40–60 min",
      "implication": "May be incomplete or rushed; interpret with caution"
    },
    {
      "type": "audio_quality",
      "severity": "warning",
      "description": "Heavy cross-talk and background noise 15:30–18:45",
      "implication": "Speaker turns ambiguous in this section; treat as lower-confidence"
    },
    {
      "type": "task_context",
      "severity": "note",
      "description": "Task statement is vague; participant seems uncertain about instructions",
      "implication": "Early behavior may reflect confusion, not product friction"
    },
    {
      "type": "missing_metadata",
      "severity": "note",
      "description": "Session date not recorded",
      "implication": "Infer from filename or file modification date; document assumption"
    }
  ],
  "readiness": "ready_with_caveats",
  "confidence_level": "medium",
  "caveats": [
    "Cross-talk section 15:30–18:45 should be interpreted conservatively",
    "Session brevity suggests possible incompleteness; flag if analysis contradicts other participants",
    "Early confusion may reflect task ambiguity, not product issues"
  ],
  "recommendation": "Analyzable; flag caveats in final report"
}
```

### Phase 9: Produce Summary for CP1

Aggregate all assessments:

```json
{
  "quality_summary": {
    "date_generated": "2026-07-08",
    "transcripts_assessed": 6,
    "ready": 5,
    "ready_with_caveats": 1,
    "blocking_issues": 0,
    "recommendation_for_cp1": "PASS — 5/6 transcripts are clean. P02 has minor audio/metadata issues but is analyzable; flag caveats in final report.",
    "readiness": "proceed_to_participant_narratives"
  }
}
```

## Credibility Checks

Before signing off on data quality, ask:

1. **Have you listened to or read a representative sample of the transcript?**
   - Spot-check the middle and end sections, not just the beginning.

2. **Did you flag ambiguity, not just errors?**
   - "Unclear what participant intended" is useful; "bad audio" isn't specific enough.

3. **Would an analyst know how to handle flagged issues?**
   - "Cross-talk 15:30–18:45; treat as lower-confidence" ✓ | "Audio is bad" ✗

4. **Are severity levels calibrated correctly?**
   - "Note" = doesn't block analysis | "Warning" = proceed with caution | "Blocker" = needs re-recording

5. **Did you distinguish between "bad data" and "usable data with caveats"?**
   - Most data isn't perfect; the question is whether it's analyzable.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Rejecting transcripts for minor issues | Rate as "warning" or "note"; only "blocker" truly stops analysis |
| Vague severity ("audio quality is poor") | Specific: "Cross-talk 10 min of 45 min; speaker turns unclear" |
| No guidance on how to handle issues | "Treat this section conservatively" or "Discount this section" |
| Missing metadata but no impact statement | "Session date unknown; infer from filename (assumption documented)" |
| Only checking first 5 minutes | Spot-check throughout; fatigue often emerges later |

## Output Quality Rubric

Strong data quality assessment:
- [ ] All transcripts assessed against consistent criteria
- [ ] Issues are specific, not vague
- [ ] Severity levels are calibrated correctly (blocker/warning/note)
- [ ] "Ready with caveats" guidance is actionable
- [ ] Summary clearly states readiness for CP1 progression
- [ ] No transcript is rejected without documentation of why
- [ ] If issues exist, analyst guidance on how to handle them is included
- [ ] Confidence levels are honest (don't claim "high" if data is patchy)

## Next Steps for Analysis Team

- Data quality report is provided before Participant Narratives begin
- Analysts reference it when interpreting participant behavior
- Caveats are noted in final report (e.g., "P02 audio quality is lower; interpret this section conservatively")

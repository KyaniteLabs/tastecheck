---
id: T13
title: Spec artifact path and shape for handoff
type: wayfinder:grilling
status: closed
assignee: grok-session
blocked_by: []
resolved: 2026-07-14
---

# Spec artifact path and shape for handoff

## Question

Where does the decision-locked written spec live, and what sections must it contain so an implementer can build `tasteroll.html` + mint inventory without re-grilling?

## Resolution

**Path:** `docs/spec/tasteroll-live-demo.md` (canonical in-repo).  
**Tracker:** GitHub issue on `KyaniteLabs/tastecheck` with label `ready-for-agent` (body mirrors or links the file).  
**Shape:** to-spec template — Problem, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes.  
**Seams in Implementation Decisions:** inventory mint; apply/whole-page render; demo interaction.

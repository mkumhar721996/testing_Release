---
id: ADR-0034
category: component
title: Web App
status: accepted
superseded_by: null
component_id: comp_web_app
responsibility: 'Browser-based React UI: app shell, sign-in, People directory and
  profiles, Leave, role-based views, and the chat and shopping screens as modules'
kind: web_ui
serves:
- TESTING-RELEASE-EPIC-003
- TESTING-RELEASE-EPIC-004
- TESTING-RELEASE-EPIC-005
- TESTING-RELEASE-EPIC-006
- TESTING-RELEASE-EPIC-007
- TESTING-RELEASE-EPIC-008
- TESTING-RELEASE-EPIC-009
- TESTING-RELEASE-EPIC-010
- TESTING-RELEASE-EPIC-011
- TESTING-RELEASE-EPIC-012
- TESTING-RELEASE-STORY-012
- TESTING-RELEASE-STORY-013
- TESTING-RELEASE-STORY-046
- TESTING-RELEASE-STORY-057
- TESTING-RELEASE-STORY-066
- TESTING-RELEASE-STORY-073
split_reason: 'Already built: the React web client in apps/web; the only client the
  backlog describes.'
talks_to:
- component_id: comp_api_service
  interaction: sync
  evidence: Web App calls the API directly
- component_id: comp_identity_provider
  interaction: sync
  evidence: TESTING-RELEASE-STORY-028
rule: The Web App reaches business data only through the API Service and authenticates
  users only through the Identity Provider.
evidence:
- type: human
  ref: Modules inside the existing Web App and API Service
basis: stated
supersedes:
- ADR-0016
---

## Context

The draft recorded none for this component.

Serves: TESTING-RELEASE-EPIC-003, TESTING-RELEASE-EPIC-004, TESTING-RELEASE-EPIC-005, TESTING-RELEASE-EPIC-006, TESTING-RELEASE-EPIC-007, TESTING-RELEASE-EPIC-008, TESTING-RELEASE-EPIC-009, TESTING-RELEASE-EPIC-010, TESTING-RELEASE-EPIC-011, TESTING-RELEASE-EPIC-012, TESTING-RELEASE-STORY-012, TESTING-RELEASE-STORY-013, TESTING-RELEASE-STORY-046, TESTING-RELEASE-STORY-057, TESTING-RELEASE-STORY-066, TESTING-RELEASE-STORY-073.

## Decision

**Rule.** The Web App reaches business data only through the API Service and authenticates users only through the Identity Provider.

Browser-based React UI: app shell, sign-in, People directory and profiles, Leave, role-based views, and the chat and shopping screens as modules

Kept separate because Already built: the React web client in apps/web; the only client the backlog describes..

## Talks to

- **API Service** (sync) — Web App calls the API directly
- **Identity Provider** (sync) — TESTING-RELEASE-STORY-028

## Alternatives considered

The draft recorded none for this component.

## Consequences

The draft recorded none for this component.

## Evidence

Basis: stated.
- human: Modules inside the existing Web App and API Service

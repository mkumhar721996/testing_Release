---
id: ADR-0035
category: component
title: API Service
status: accepted
superseded_by: null
component_id: comp_api_service
responsibility: 'NestJS backend: server-side role enforcement, employee, leave (request
  intake, approval, balances), onboarding, recruitment and review records, org structure,
  document metadata, user and role administration, audit logging, reports, and chat
  and shopping modules; PostgreSQL via TypeORM'
kind: api_service
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
split_reason: 'Already built: the NestJS service in services/api. Access must be enforced
  on the server as well as in screens (STORY-030).'
talks_to:
- component_id: comp_relational_database
  interaction: sync
  evidence: TESTING-RELEASE-EPIC-004
- component_id: comp_object_storage
  interaction: sync
  evidence: TESTING-RELEASE-STORY-017
- component_id: comp_job_queue
  interaction: async
  evidence: TESTING-RELEASE-STORY-018
- component_id: comp_identity_provider
  interaction: sync
  evidence: 'Human: accounts are created in the app by HR admins and bulk import;
    API Service and Worker hold Cognito admin rights'
rule: Business records and audit logs are written only through the API Service, which
  applies role checks on every request.
evidence:
- type: human
  ref: Modules inside the existing Web App and API Service
basis: stated
supersedes:
- ADR-0017
---

## Context

The draft recorded none for this component.

Serves: TESTING-RELEASE-EPIC-003, TESTING-RELEASE-EPIC-004, TESTING-RELEASE-EPIC-005, TESTING-RELEASE-EPIC-006, TESTING-RELEASE-EPIC-007, TESTING-RELEASE-EPIC-008, TESTING-RELEASE-EPIC-009, TESTING-RELEASE-EPIC-010, TESTING-RELEASE-EPIC-011, TESTING-RELEASE-EPIC-012, TESTING-RELEASE-STORY-012, TESTING-RELEASE-STORY-013, TESTING-RELEASE-STORY-046, TESTING-RELEASE-STORY-057, TESTING-RELEASE-STORY-066, TESTING-RELEASE-STORY-073.

## Decision

**Rule.** Business records and audit logs are written only through the API Service, which applies role checks on every request.

NestJS backend: server-side role enforcement, employee, leave (request intake, approval, balances), onboarding, recruitment and review records, org structure, document metadata, user and role administration, audit logging, reports, and chat and shopping modules; PostgreSQL via TypeORM

Kept separate because Already built: the NestJS service in services/api. Access must be enforced on the server as well as in screens (STORY-030)..

## Talks to

- **Relational Database** (sync) — TESTING-RELEASE-EPIC-004
- **Object Storage** (sync) — TESTING-RELEASE-STORY-017
- **Job Queue** (async) — TESTING-RELEASE-STORY-018
- **Identity Provider** (sync) — Human: accounts are created in the app by HR admins and bulk import; API Service and Worker hold Cognito admin rights

## Alternatives considered

The draft recorded none for this component.

## Consequences

The draft recorded none for this component.

## Evidence

Basis: stated.
- human: Modules inside the existing Web App and API Service

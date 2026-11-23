---
id: ADR-0036
category: component
title: Worker
status: accepted
superseded_by: null
component_id: comp_worker
responsibility: 'Background jobs from the Job Queue: email notifications and reminders
  for leave and onboarding tasks, bulk import of about 600 staff from a spreadsheet,
  report generation'
kind: worker
serves:
- TESTING-RELEASE-EPIC-005
- TESTING-RELEASE-EPIC-006
- TESTING-RELEASE-STORY-018
split_reason: 'Already built: the worker in services/worker. Email, reminders and
  a 600-row import run outside the request path.'
talks_to:
- component_id: comp_job_queue
  interaction: async
  evidence: TESTING-RELEASE-EPIC-005
- component_id: comp_relational_database
  interaction: sync
  evidence: TESTING-RELEASE-STORY-018
- component_id: comp_object_storage
  interaction: sync
  evidence: Worker generates documents
- component_id: comp_identity_provider
  interaction: sync
  evidence: TESTING-RELEASE-STORY-018
rule: Background and long-running work runs in the Worker via the Job Queue, never
  inside API request handling.
evidence:
- type: scan
  ref: services/worker
- type: work_item
  ref: TESTING-RELEASE-STORY-018
basis: stated
supersedes:
- ADR-0018
---

## Context

The draft recorded none for this component.

Serves: TESTING-RELEASE-EPIC-005, TESTING-RELEASE-EPIC-006, TESTING-RELEASE-STORY-018.

## Decision

**Rule.** Background and long-running work runs in the Worker via the Job Queue, never inside API request handling.

Background jobs from the Job Queue: email notifications and reminders for leave and onboarding tasks, bulk import of about 600 staff from a spreadsheet, report generation

Kept separate because Already built: the worker in services/worker. Email, reminders and a 600-row import run outside the request path..

## Talks to

- **Job Queue** (async) — TESTING-RELEASE-EPIC-005
- **Relational Database** (sync) — TESTING-RELEASE-STORY-018
- **Object Storage** (sync) — Worker generates documents
- **Identity Provider** (sync) — TESTING-RELEASE-STORY-018

## Alternatives considered

The draft recorded none for this component.

## Consequences

The draft recorded none for this component.

## Evidence

Basis: stated.
- scan: services/worker
- work_item: TESTING-RELEASE-STORY-018

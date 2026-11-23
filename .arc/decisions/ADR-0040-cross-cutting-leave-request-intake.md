---
id: ADR-0040
category: cross_cutting
title: 'Cross-cutting: Leave request intake'
status: accepted
superseded_by: null
component_id: null
rule: Leave requests are created in the app by employees through the API Service;
  leave notification emails are sent by the Worker from the Job Queue.
decision: Employees submit leave requests in the app; the API Service stores them
  with balances and approval state, and enqueues email notifications (approval requests,
  decisions, reminders) for the Worker to send. EPIC-011's review-only wording is
  superseded.
evidence:
- type: human
  ref: 'Submitted in the app (EPIC-005): employees file requests, so Leave needs request
    intake and email notifications.'
- type: work_item
  ref: TESTING-RELEASE-EPIC-005
basis: stated
contested: true
alternatives:
- option: Review-only leave from existing data (EPIC-011)
  why_not: The human chose in-app submission; review-only would leave no intake path.
consequences:
- EPIC-011 must be reconciled with EPIC-005; no separate leave-data import path is
  needed.
---

## Decision

**Rule.** Leave requests are created in the app by employees through the API Service; leave notification emails are sent by the Worker from the Job Queue.

Employees submit leave requests in the app; the API Service stores them with balances and approval state, and enqueues email notifications (approval requests, decisions, reminders) for the Worker to send. EPIC-011's review-only wording is superseded.

## Alternatives considered

- Review-only leave from existing data (EPIC-011) — The human chose in-app submission; review-only would leave no intake path.

## Consequences

- EPIC-011 must be reconciled with EPIC-005; no separate leave-data import path is needed.

## Evidence

Basis: stated.
- human: Submitted in the app (EPIC-005): employees file requests, so Leave needs request intake and email notifications.
- work_item: TESTING-RELEASE-EPIC-005

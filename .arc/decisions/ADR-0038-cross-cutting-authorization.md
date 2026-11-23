---
id: ADR-0038
category: cross_cutting
title: 'Cross-cutting: Authorization'
status: accepted
superseded_by: null
component_id: null
rule: The API Service authorises every request by one of four roles (employee, manager,
  HR admin, read-only executive), with managers limited to direct reports; the role-to-permission
  split lives in configuration.
decision: 'Four roles, one per person: employee, manager, HR admin, read-only executive.
  Managers see direct reports only, via the reporting line. Manager, HR admin and
  executive also get own-profile and own-leave self-service. Roles are enforced in
  the API Service as well as the screens, and the role-to-permission split is held
  in developer-changeable configuration.'
evidence:
- type: human
  ref: Four roles (EPIC-003); managers see direct reports only
- type: work_item
  ref: TESTING-RELEASE-STORY-020
- type: work_item
  ref: TESTING-RELEASE-STORY-030
basis: stated
contested: true
alternatives:
- option: Two roles (HR admin, manager) per EPIC-009
  why_not: The human chose the four-role model of EPIC-003, which also needs an executive
    view and employee self-service.
consequences:
- Manager access depends on reporting lines from Employee Records.
- EPIC-009 and STORY-031 wording that managers see all employees must be reconciled.
---

## Decision

**Rule.** The API Service authorises every request by one of four roles (employee, manager, HR admin, read-only executive), with managers limited to direct reports; the role-to-permission split lives in configuration.

Four roles, one per person: employee, manager, HR admin, read-only executive. Managers see direct reports only, via the reporting line. Manager, HR admin and executive also get own-profile and own-leave self-service. Roles are enforced in the API Service as well as the screens, and the role-to-permission split is held in developer-changeable configuration.

## Alternatives considered

- Two roles (HR admin, manager) per EPIC-009 — The human chose the four-role model of EPIC-003, which also needs an executive view and employee self-service.

## Consequences

- Manager access depends on reporting lines from Employee Records.
- EPIC-009 and STORY-031 wording that managers see all employees must be reconciled.

## Evidence

Basis: stated.
- human: Four roles (EPIC-003); managers see direct reports only
- work_item: TESTING-RELEASE-STORY-020
- work_item: TESTING-RELEASE-STORY-030

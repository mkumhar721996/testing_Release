---
id: ADR-0004
category: component
title: Relational Database
status: accepted
superseded_by: null
component_id: comp_relational_database
responsibility: Primary store for business records, users, roles, master data, workflow
  state, audit logs; runs on PostgreSQL (Amazon RDS)
kind: infrastructure
serves:
- TESTING-RELEASE-EPIC-003
- TESTING-RELEASE-EPIC-004
- TESTING-RELEASE-EPIC-005
- TESTING-RELEASE-EPIC-006
- TESTING-RELEASE-EPIC-007
- TESTING-RELEASE-EPIC-008
- TESTING-RELEASE-EPIC-010
- TESTING-RELEASE-EPIC-011
split_reason: Backing data store the project runs, not built in-house
rule: Relational business data lives only in the Relational Database, inside us-east-1.
evidence:
- type: note
  ref: 'Human: ''postgres''; deployment target is AWS'
---

## Context

The draft recorded none for this component.

Serves: TESTING-RELEASE-EPIC-003, TESTING-RELEASE-EPIC-004, TESTING-RELEASE-EPIC-005, TESTING-RELEASE-EPIC-006, TESTING-RELEASE-EPIC-007, TESTING-RELEASE-EPIC-008, TESTING-RELEASE-EPIC-010, TESTING-RELEASE-EPIC-011.

## Decision

**Rule.** Relational business data lives only in the Relational Database, inside us-east-1.

Primary store for business records, users, roles, master data, workflow state, audit logs; runs on PostgreSQL (Amazon RDS)

Kept separate because Backing data store the project runs, not built in-house.

## Alternatives considered

The draft recorded none for this component.

## Consequences

The draft recorded none for this component.

## Evidence

Basis: stated.
- work_item: TESTING-RELEASE-EPIC-004

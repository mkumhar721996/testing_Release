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
split_reason: Backing data store the project runs, not built in-house
evidence: 'Human: ''postgres''; deployment target is AWS'
---

## Context

Human: 'postgres'; deployment target is AWS

## Decision

Primary store for business records, users, roles, master data, workflow state, audit logs; runs on PostgreSQL (Amazon RDS)

Kept separate because Backing data store the project runs, not built in-house.

---
id: ADR-0028
category: cross_cutting
title: 'Cross-cutting: Audit logging & activity tracking'
status: accepted
superseded_by: null
component_id: null
rule: Every change to a business record is written to the audit trail by the API Service
  in the same operation.
decision: API Service writes change and access events to an audit trail in the Relational
  Database
evidence: 'Human: ''Audit logs and activity tracking'''
---

## Context

Human: 'Audit logs and activity tracking'

## Decision

API Service writes change and access events to an audit trail in the Relational Database

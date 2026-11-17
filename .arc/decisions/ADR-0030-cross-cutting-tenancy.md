---
id: ADR-0030
category: cross_cutting
title: 'Cross-cutting: Tenancy'
status: accepted
superseded_by: null
component_id: null
rule: The system is single-tenant; do not add tenant partitioning to the schema or
  API.
decision: 'Single-tenant: one customer organisation per deployment; no tenant id or
  per-tenant isolation in the data model'
evidence: 'Human: ''Single tenant'''
---

## Context

Human: 'Single tenant'

## Decision

Single-tenant: one customer organisation per deployment; no tenant id or per-tenant isolation in the data model

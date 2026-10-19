---
id: ADR-0013
category: cross_cutting
title: 'Cross-cutting: Configurability & reusability across business domains'
status: accepted
superseded_by: null
component_id: null
decision: Entities, workflows, and settings are modeled as configurable metadata in
  the API/data layer rather than hard-coded per domain, so new business use cases
  are configured, not rebuilt
evidence: 'Human: ''reusable, scalable, and configurable so that it can support different
  business use cases without major redesign'''
---

## Context

Human: 'reusable, scalable, and configurable so that it can support different business use cases without major redesign'

## Decision

Entities, workflows, and settings are modeled as configurable metadata in the API/data layer rather than hard-coded per domain, so new business use cases are configured, not rebuilt

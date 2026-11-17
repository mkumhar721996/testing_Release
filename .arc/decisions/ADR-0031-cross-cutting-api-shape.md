---
id: ADR-0031
category: cross_cutting
title: 'Cross-cutting: API shape'
status: accepted
superseded_by: null
component_id: null
rule: Keep one API Service that the Web App calls directly; add a gateway or BFF only
  through a new architecture decision.
decision: A single API Service, called directly by the Web App; no gateway or BFF
  component
evidence: recommended default, accepted by the human without review
---

## Context

recommended default, accepted by the human without review

## Decision

A single API Service, called directly by the Web App; no gateway or BFF component

---
id: ADR-0022
category: nfr
title: "NFR: data residency \u2014 all customer and application data remains in us-east-1;\
  \ no cross-region\u2026"
status: accepted
superseded_by: null
dimension: data residency
metric: location of stored customer and application data
threshold: all customer and application data remains in us-east-1; no cross-region
  replication
component_id: null
needs_dedicated_tracking: true
rule: Customer and application data is stored and processed only in us-east-1, with
  no cross-region replication.
evidence: 'Human: ''us-east-1''; earlier: ''All customer and application data must
  remain within the selected AWS region.'''
---

## Context

Human: 'us-east-1'; earlier: 'All customer and application data must remain within the selected AWS region.'

## Decision

location of stored customer and application data: all customer and application data remains in us-east-1; no cross-region replication

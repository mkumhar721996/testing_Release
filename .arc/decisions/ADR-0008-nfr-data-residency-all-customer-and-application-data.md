---
id: ADR-0008
category: nfr
title: "NFR: data residency \u2014 all customer and application data remains within\
  \ the single selected AWS\u2026"
status: accepted
superseded_by: null
dimension: data residency
metric: location of stored customer and application data
threshold: all customer and application data remains within the single selected AWS
  region; no cross-region replication
component_id: null
needs_dedicated_tracking: true
evidence: 'Human: ''All customer and application data must remain within the selected
  AWS region. No additional data residency requirements are currently defined.'''
---

## Context

Human: 'All customer and application data must remain within the selected AWS region. No additional data residency requirements are currently defined.'

## Decision

location of stored customer and application data: all customer and application data remains within the single selected AWS region; no cross-region replication

---
id: ADR-0024
category: nfr
title: "NFR: recovery \u2014 RPO 15 min, RTO 1 h"
status: accepted
superseded_by: null
dimension: recovery
metric: RPO / RTO
threshold: RPO 15 min, RTO 1 h
component_id: null
needs_dedicated_tracking: true
rule: Back up the Relational Database and Object Storage so data loss is at most 15
  minutes and service is restored within 1 hour.
evidence: 'Human: ''99.9% uptime, Multi-AZ, RPO 15m / RTO 1h, thousands of users'''
---

## Context

Human: '99.9% uptime, Multi-AZ, RPO 15m / RTO 1h, thousands of users'

## Decision

RPO / RTO: RPO 15 min, RTO 1 h

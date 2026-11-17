---
id: ADR-0025
category: nfr
title: "NFR: scale \u2014 thousands (order of 1,000\u201310,000)"
status: accepted
superseded_by: null
dimension: scale
metric: registered users
threshold: "thousands (order of 1,000\u201310,000)"
component_id: null
needs_dedicated_tracking: true
rule: Size the system for thousands of users; revisit the design if load grows an
  order of magnitude beyond that.
evidence: 'Human: ''99.9% uptime, Multi-AZ, RPO 15m / RTO 1h, thousands of users'''
---

## Context

Human: '99.9% uptime, Multi-AZ, RPO 15m / RTO 1h, thousands of users'

## Decision

registered users: thousands (order of 1,000–10,000)

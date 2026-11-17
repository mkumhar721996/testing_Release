---
id: ADR-0023
category: nfr
title: "NFR: availability \u2014 99.9%"
status: accepted
superseded_by: null
dimension: availability
metric: monthly uptime
threshold: 99.9%
component_id: null
needs_dedicated_tracking: true
rule: Run every component Multi-AZ within us-east-1 and meet 99.9% monthly availability.
evidence: 'Human: ''99.9% uptime, Multi-AZ, RPO 15m / RTO 1h, thousands of users'''
---

## Context

Human: '99.9% uptime, Multi-AZ, RPO 15m / RTO 1h, thousands of users'

## Decision

monthly uptime: 99.9%

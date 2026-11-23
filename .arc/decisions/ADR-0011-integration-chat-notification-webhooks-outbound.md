---
id: ADR-0011
category: integration_surface
title: 'Integration: Chat Notification Webhooks (outbound)'
status: accepted
superseded_by: null
component_id: comp_worker
rule: Chat notifications (Microsoft Teams, Slack) go out only from the Worker as webhook
  calls, alongside Amazon SES email.
evidence:
- type: note
  ref: 'Human: ''Notifications: Microsoft Teams and Slack webhooks'''
---

## Context

Human: 'Notifications: Microsoft Teams and Slack webhooks'

## Decision

Chat Notification Webhooks (outbound)

Applies to Worker.

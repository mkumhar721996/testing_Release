---
id: ADR-0016
category: component
title: Web App
status: superseded
superseded_by: ADR-0034
component_id: comp_web_app
responsibility: Browser-based React UI for End Users and Administrators with role-based
  views
kind: web_ui
split_reason: Only client/runtime described so far; serves both user groups via RBAC-driven
  views
talks_to:
- component_id: comp_api_service
  interaction: sync
  evidence: Only client described
- component_id: comp_identity_provider
  interaction: sync
  evidence: Login redirect flow
rule: The Web App reaches business data only through the API Service and authenticates
  users only through the Identity Provider.
evidence:
- type: note
  ref: 'Codebase scan: apps/web (React, index.html entry)'
---

## Context

Codebase scan: apps/web (React, index.html entry)

## Decision

Browser-based React UI for End Users and Administrators with role-based views

Kept separate because Only client/runtime described so far; serves both user groups via RBAC-driven views.

## Talks to

- **API Service** (sync) — Only client described
- **Identity Provider** (sync) — Login redirect flow

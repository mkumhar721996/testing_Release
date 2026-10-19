---
id: ADR-0001
category: component
title: Web App
status: accepted
superseded_by: null
component_id: comp_web_app
responsibility: Browser-based UI for End Users (manage business records, view dashboards/reports,
  receive notifications) and Administrators (manage users/roles, master data, settings,
  analytics dashboards), with role-based views
kind: web_ui
split_reason: Only client/runtime described so far; serves both user groups via RBAC-driven
  views
talks_to:
- component_id: comp_api_service
  interaction: sync
  evidence: Only client described; UI calls backend for all data and actions
- component_id: comp_identity_provider
  interaction: sync
  evidence: Login/auth redirect flow against Cognito/OIDC provider
evidence: 'Human: ''platform should be a generic business web application... End Users...
  Administrators'''
---

## Context

Human: 'platform should be a generic business web application... End Users... Administrators'

## Decision

Browser-based UI for End Users (manage business records, view dashboards/reports, receive notifications) and Administrators (manage users/roles, master data, settings, analytics dashboards), with role-based views

Kept separate because Only client/runtime described so far; serves both user groups via RBAC-driven views.

## Talks to

- **API Service** (sync) — Only client described; UI calls backend for all data and actions
- **Identity Provider** (sync) — Login/auth redirect flow against Cognito/OIDC provider

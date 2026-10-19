---
id: ADR-0002
category: component
title: API Service
status: accepted
superseded_by: null
component_id: comp_api_service
responsibility: 'Core business logic: authentication/authorization, RBAC, business
  record CRUD, workflow/task management, search & filtering, reporting, audit logging,
  document metadata, API integrations'
kind: api_service
split_reason: Separate backend serving the Web App client
talks_to:
- component_id: comp_relational_database
  interaction: sync
  evidence: API owns business records, users, roles, audit logs
- component_id: comp_object_storage
  interaction: sync
  evidence: 'Human: ''Document and file management'''
- component_id: comp_job_queue
  interaction: async
  evidence: API enqueues notification/report/document jobs for background processing
- component_id: comp_identity_provider
  interaction: sync
  evidence: API validates tokens / enforces authorization against Cognito/OIDC provider
evidence: 'Human: list of core capabilities (auth, RBAC, dashboards, workflow, documents,
  search, notifications, audit logs, API integrations)'
---

## Context

Human: list of core capabilities (auth, RBAC, dashboards, workflow, documents, search, notifications, audit logs, API integrations)

## Decision

Core business logic: authentication/authorization, RBAC, business record CRUD, workflow/task management, search & filtering, reporting, audit logging, document metadata, API integrations

Kept separate because Separate backend serving the Web App client.

## Talks to

- **Relational Database** (sync) — API owns business records, users, roles, audit logs
- **Object Storage** (sync) — Human: 'Document and file management'
- **Job Queue** (async) — API enqueues notification/report/document jobs for background processing
- **Identity Provider** (sync) — API validates tokens / enforces authorization against Cognito/OIDC provider

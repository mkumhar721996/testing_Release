---
id: ADR-0017
category: component
title: API Service
status: superseded
superseded_by: ADR-0035
component_id: comp_api_service
responsibility: 'NestJS backend: authorization/RBAC, business record CRUD, workflow,
  search, reporting, audit logging, document metadata, inbound API and outbound webhooks'
kind: api_service
split_reason: Separate backend serving the Web App client
talks_to:
- component_id: comp_relational_database
  interaction: sync
  evidence: API owns business records
- component_id: comp_object_storage
  interaction: sync
  evidence: 'Human: ''Document and file management'''
- component_id: comp_job_queue
  interaction: async
  evidence: API enqueues jobs
- component_id: comp_identity_provider
  interaction: sync
  evidence: API validates tokens
rule: Business records and audit logs are written only through the API Service; clients
  and the Worker never bypass its authorization rules.
evidence:
- type: note
  ref: 'Codebase scan: services/api (NestJS, src/main.ts starts a server)'
---

## Context

Codebase scan: services/api (NestJS, src/main.ts starts a server)

## Decision

NestJS backend: authorization/RBAC, business record CRUD, workflow, search, reporting, audit logging, document metadata, inbound API and outbound webhooks

Kept separate because Separate backend serving the Web App client.

## Talks to

- **Relational Database** (sync) — API owns business records
- **Object Storage** (sync) — Human: 'Document and file management'
- **Job Queue** (async) — API enqueues jobs
- **Identity Provider** (sync) — API validates tokens

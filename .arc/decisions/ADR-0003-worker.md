---
id: ADR-0003
category: component
title: Worker
status: accepted
superseded_by: null
component_id: comp_worker
responsibility: 'Background jobs: asynchronous notification/alert delivery, scheduled/heavy
  report generation, document processing'
kind: worker
split_reason: Background work (notifications, report generation) has different scaling/scheduling
  needs than request/response API traffic
talks_to:
- component_id: comp_job_queue
  interaction: async
  evidence: Worker consumes queued jobs
- component_id: comp_relational_database
  interaction: sync
  evidence: Worker reads/writes records while generating reports or processing notifications
- component_id: comp_object_storage
  interaction: sync
  evidence: Worker processes/generates documents and files
evidence: 'Human: ''Notifications and alerts'', ''Generate reports'''
---

## Context

Human: 'Notifications and alerts', 'Generate reports'

## Decision

Background jobs: asynchronous notification/alert delivery, scheduled/heavy report generation, document processing

Kept separate because Background work (notifications, report generation) has different scaling/scheduling needs than request/response API traffic.

## Talks to

- **Job Queue** (async) — Worker consumes queued jobs
- **Relational Database** (sync) — Worker reads/writes records while generating reports or processing notifications
- **Object Storage** (sync) — Worker processes/generates documents and files

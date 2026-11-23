---
id: ADR-0018
category: component
title: Worker
status: superseded
superseded_by: ADR-0036
component_id: comp_worker
responsibility: 'Background jobs consumed from the Job Queue: notification delivery,
  report generation, document processing'
kind: worker
split_reason: Background work (notifications, report generation) has different scaling/scheduling
  needs than request/response API traffic
talks_to:
- component_id: comp_job_queue
  interaction: async
  evidence: Worker consumes jobs
- component_id: comp_relational_database
  interaction: sync
  evidence: Worker reads/writes records
- component_id: comp_object_storage
  interaction: sync
  evidence: Worker generates documents
rule: Background and long-running work runs in the Worker via the Job Queue, never
  inside API request handling.
evidence:
- type: note
  ref: 'Codebase scan: services/worker'
---

## Context

Codebase scan: services/worker

## Decision

Background jobs consumed from the Job Queue: notification delivery, report generation, document processing

Kept separate because Background work (notifications, report generation) has different scaling/scheduling needs than request/response API traffic.

## Talks to

- **Job Queue** (async) — Worker consumes jobs
- **Relational Database** (sync) — Worker reads/writes records
- **Object Storage** (sync) — Worker generates documents

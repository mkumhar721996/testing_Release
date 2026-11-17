---
id: ADR-0020
category: component
title: Job Queue
status: accepted
superseded_by: null
component_id: comp_job_queue
responsibility: Queues async work between API Service and Worker; runs on Amazon SQS
kind: infrastructure
split_reason: Decouples request/response API from background processing
rule: The API Service hands background work to the Worker only by enqueuing jobs on
  the Job Queue.
evidence: 'Human: ''Amazon SQS'''
---

## Context

Human: 'Amazon SQS'

## Decision

Queues async work between API Service and Worker; runs on Amazon SQS

Kept separate because Decouples request/response API from background processing.

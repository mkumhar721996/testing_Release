---
id: ADR-0006
category: component
title: Job Queue
status: accepted
superseded_by: null
component_id: comp_job_queue
responsibility: Queues asynchronous work (notification delivery, report generation,
  document processing) between API Service and Worker; runs on Amazon SQS
kind: infrastructure
split_reason: Decouples request/response API from background processing
evidence: 'Human: ''Amazon SQS'''
---

## Context

Human: 'Amazon SQS'

## Decision

Queues asynchronous work (notification delivery, report generation, document processing) between API Service and Worker; runs on Amazon SQS

Kept separate because Decouples request/response API from background processing.

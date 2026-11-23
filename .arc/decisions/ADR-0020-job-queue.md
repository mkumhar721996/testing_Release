---
id: ADR-0020
category: component
title: Job Queue
status: accepted
superseded_by: null
component_id: comp_job_queue
responsibility: Queues async work between API Service and Worker; runs on Amazon SQS
kind: infrastructure
serves:
- TESTING-RELEASE-EPIC-005
- TESTING-RELEASE-EPIC-006
- TESTING-RELEASE-STORY-018
split_reason: Decouples request/response API from background processing
rule: The API Service hands background work to the Worker only by enqueuing jobs on
  the Job Queue.
evidence:
- type: note
  ref: 'Human: ''Amazon SQS'''
---

## Context

The draft recorded none for this component.

Serves: TESTING-RELEASE-EPIC-005, TESTING-RELEASE-EPIC-006, TESTING-RELEASE-STORY-018.

## Decision

**Rule.** The API Service hands background work to the Worker only by enqueuing jobs on the Job Queue.

Queues async work between API Service and Worker; runs on Amazon SQS

Kept separate because Decouples request/response API from background processing.

## Alternatives considered

The draft recorded none for this component.

## Consequences

The draft recorded none for this component.

## Evidence

Basis: stated.
- work_item: TESTING-RELEASE-EPIC-005

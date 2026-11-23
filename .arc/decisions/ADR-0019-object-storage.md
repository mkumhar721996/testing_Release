---
id: ADR-0019
category: component
title: Object Storage
status: accepted
superseded_by: null
component_id: comp_object_storage
responsibility: Stores uploaded documents and files; runs on Amazon S3
kind: infrastructure
serves:
- TESTING-RELEASE-STORY-017
split_reason: Document/file management is a distinct backing-service capability (blob
  storage) separate from relational data
rule: HR documents are stored encrypted in Object Storage and read only through the
  API Service; the database holds metadata only.
evidence:
- type: note
  ref: 'Human: ''File storage: Amazon S3'''
---

## Context

The draft recorded none for this component.

Serves: TESTING-RELEASE-STORY-017.

## Decision

**Rule.** HR documents are stored encrypted in Object Storage and read only through the API Service; the database holds metadata only.

Stores uploaded documents and files; runs on Amazon S3

Kept separate because Document/file management is a distinct backing-service capability (blob storage) separate from relational data.

## Alternatives considered

The draft recorded none for this component.

## Consequences

The draft recorded none for this component.

## Evidence

Basis: stated.
- work_item: TESTING-RELEASE-STORY-017

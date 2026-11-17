---
id: ADR-0005
category: component
title: Object Storage
status: superseded
superseded_by: ADR-0019
component_id: comp_object_storage
responsibility: Stores uploaded documents and files referenced by business records;
  runs on Amazon S3
kind: infrastructure
split_reason: Document/file management is a distinct backing-service capability (blob
  storage) separate from relational data
evidence: 'Human: ''File storage: Amazon S3'''
---

## Context

Human: 'File storage: Amazon S3'

## Decision

Stores uploaded documents and files referenced by business records; runs on Amazon S3

Kept separate because Document/file management is a distinct backing-service capability (blob storage) separate from relational data.

---
id: ADR-0019
category: component
title: Object Storage
status: accepted
superseded_by: null
component_id: comp_object_storage
responsibility: Stores uploaded documents and files; runs on Amazon S3
kind: infrastructure
split_reason: Document/file management is a distinct backing-service capability (blob
  storage) separate from relational data
rule: Documents and files live in Object Storage; only their metadata is kept in the
  Relational Database.
evidence: 'Human: ''File storage: Amazon S3'''
---

## Context

Human: 'File storage: Amazon S3'

## Decision

Stores uploaded documents and files; runs on Amazon S3

Kept separate because Document/file management is a distinct backing-service capability (blob storage) separate from relational data.

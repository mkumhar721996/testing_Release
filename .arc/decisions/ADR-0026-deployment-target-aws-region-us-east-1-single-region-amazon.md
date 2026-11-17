---
id: ADR-0026
category: deployment_target
title: "Deployment target: AWS region us-east-1 (single region), Amazon ECS Fargate\
  \ (managed containers)\u2026"
status: accepted
superseded_by: null
component_id: null
rule: All components run as containers on ECS Fargate in us-east-1, with production
  and staging in separate AWS accounts; changing region topology needs a new architecture
  decision.
decision: AWS region us-east-1 (single region), Amazon ECS Fargate (managed containers)
  for compute; production and staging environments in separate AWS accounts
evidence: 'recommended default, accepted by the human without review (environments);
  Human: ''us-east-1'''
---

## Context

recommended default, accepted by the human without review (environments); Human: 'us-east-1'

## Decision

AWS region us-east-1 (single region), Amazon ECS Fargate (managed containers) for compute; production and staging environments in separate AWS accounts

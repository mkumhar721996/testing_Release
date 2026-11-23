---
id: ADR-0021
category: component
title: Identity Provider
status: accepted
superseded_by: null
component_id: comp_identity_provider
responsibility: Authentication via OIDC/SAML; AWS Cognito initially, swappable for
  Entra ID, Okta, Keycloak or any OIDC/SAML provider
kind: managed_service
serves:
- TESTING-RELEASE-EPIC-003
- TESTING-RELEASE-EPIC-009
- TESTING-RELEASE-STORY-019
- TESTING-RELEASE-STORY-028
split_reason: Backing identity service the project uses but doesn't build
rule: Authentication uses standard OIDC/SAML only, so the provider can be replaced
  without application code changes.
evidence:
- type: note
  ref: 'Human: ''AWS Cognito ... Future support for Microsoft Entra ID, Okta, Keycloak'''
---

## Context

The draft recorded none for this component.

Serves: TESTING-RELEASE-EPIC-003, TESTING-RELEASE-EPIC-009, TESTING-RELEASE-STORY-019, TESTING-RELEASE-STORY-028.

## Decision

**Rule.** Authentication uses standard OIDC/SAML only, so the provider can be replaced without application code changes.

Authentication via OIDC/SAML; AWS Cognito initially, swappable for Entra ID, Okta, Keycloak or any OIDC/SAML provider

Kept separate because Backing identity service the project uses but doesn't build.

## Alternatives considered

The draft recorded none for this component.

## Consequences

The draft recorded none for this component.

## Evidence

Basis: stated.
- work_item: TESTING-RELEASE-STORY-028

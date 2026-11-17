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
split_reason: Backing identity service the project uses but doesn't build
rule: Authentication uses standard OIDC/SAML only, so the provider can be replaced
  without application code changes.
evidence: 'Human: ''AWS Cognito ... Future support for Microsoft Entra ID, Okta, Keycloak'''
---

## Context

Human: 'AWS Cognito ... Future support for Microsoft Entra ID, Okta, Keycloak'

## Decision

Authentication via OIDC/SAML; AWS Cognito initially, swappable for Entra ID, Okta, Keycloak or any OIDC/SAML provider

Kept separate because Backing identity service the project uses but doesn't build.

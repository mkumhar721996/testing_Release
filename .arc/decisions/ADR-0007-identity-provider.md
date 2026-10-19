---
id: ADR-0007
category: component
title: Identity Provider
status: accepted
superseded_by: null
component_id: comp_identity_provider
responsibility: Authentication and authorization via OIDC/SAML; AWS Cognito initially,
  with future support for Microsoft Entra ID, Okta, Keycloak, or any OIDC/SAML-compatible
  provider
kind: managed_service
split_reason: Backing identity service the project uses but doesn't build
evidence: 'Human: ''AWS Cognito (best fit since the deployment target is AWS); Future
  support for Microsoft Entra ID, Okta, Keycloak, any OIDC/SAML-compatible provider'''
---

## Context

Human: 'AWS Cognito (best fit since the deployment target is AWS); Future support for Microsoft Entra ID, Okta, Keycloak, any OIDC/SAML-compatible provider'

## Decision

Authentication and authorization via OIDC/SAML; AWS Cognito initially, with future support for Microsoft Entra ID, Okta, Keycloak, or any OIDC/SAML-compatible provider

Kept separate because Backing identity service the project uses but doesn't build.

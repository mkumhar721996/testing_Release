---
id: ADR-0039
category: cross_cutting
title: 'Cross-cutting: Account provisioning'
status: accepted
superseded_by: null
component_id: null
rule: Only the API Service and the Worker create, change or deactivate Identity Provider
  accounts and roles; no one does it outside the app.
decision: Accounts and roles are created and changed inside the app. The API Service
  handles HR-admin invites, role changes, deactivation and reactivation; the Worker
  creates accounts during bulk import. Both call the Identity Provider's admin API,
  and the role reaches the sign-in token from the Identity Provider.
evidence:
- type: human
  ref: 'In the app: HR admins (STORY-021) and the bulk import (STORY-018) create the
    accounts, so the API Service and Worker create Cognito users and hold Cognito
    admin rights.'
- type: work_item
  ref: TESTING-RELEASE-STORY-021
- type: work_item
  ref: TESTING-RELEASE-STORY-018
basis: stated
contested: true
alternatives:
- option: Create accounts in Cognito outside the app (STORY-028)
  why_not: The app's HR admins must manage users and roles without engineering help
    (STORY-021), and the import must create accounts (STORY-018).
consequences:
- API Service and Worker hold Cognito admin permissions, so their credentials need
  tight scoping.
- STORY-028's wording that account creation and role assignment happen in Cognito,
  not in the app, is superseded.
---

## Decision

**Rule.** Only the API Service and the Worker create, change or deactivate Identity Provider accounts and roles; no one does it outside the app.

Accounts and roles are created and changed inside the app. The API Service handles HR-admin invites, role changes, deactivation and reactivation; the Worker creates accounts during bulk import. Both call the Identity Provider's admin API, and the role reaches the sign-in token from the Identity Provider.

## Alternatives considered

- Create accounts in Cognito outside the app (STORY-028) — The app's HR admins must manage users and roles without engineering help (STORY-021), and the import must create accounts (STORY-018).

## Consequences

- API Service and Worker hold Cognito admin permissions, so their credentials need tight scoping.
- STORY-028's wording that account creation and role assignment happen in Cognito, not in the app, is superseded.

## Evidence

Basis: stated.
- human: In the app: HR admins (STORY-021) and the bulk import (STORY-018) create the accounts, so the API Service and Worker create Cognito users and hold Cognito admin rights.
- work_item: TESTING-RELEASE-STORY-021
- work_item: TESTING-RELEASE-STORY-018

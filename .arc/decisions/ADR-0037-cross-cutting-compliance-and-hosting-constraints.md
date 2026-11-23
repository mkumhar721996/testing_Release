---
id: ADR-0037
category: cross_cutting
title: 'Cross-cutting: Compliance and hosting constraints'
status: accepted
superseded_by: null
component_id: null
rule: Restrict employee personal data by role, encrypt HR documents, and record access
  to them in the audit log, which is never expired.
decision: 'CCPA applies to HR data: personal data is stored only in us-east-1, access
  is limited by role, HR documents are encrypted, and access is recorded in the audit
  log. No other regime, mandated AWS services or budget limit is recorded. Audit-log
  retention is undecided, so entries are not expired (STORY-022).'
evidence:
- type: human
  ref: CCPA
- type: work_item
  ref: TESTING-RELEASE-STORY-022
basis: stated
supersedes:
- ADR-0032
---

## Decision

**Rule.** Restrict employee personal data by role, encrypt HR documents, and record access to them in the audit log, which is never expired.

CCPA applies to HR data: personal data is stored only in us-east-1, access is limited by role, HR documents are encrypted, and access is recorded in the audit log. No other regime, mandated AWS services or budget limit is recorded. Audit-log retention is undecided, so entries are not expired (STORY-022).

## Evidence

Basis: stated.
- human: CCPA
- work_item: TESTING-RELEASE-STORY-022

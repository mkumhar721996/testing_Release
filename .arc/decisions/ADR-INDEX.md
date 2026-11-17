# ADR Index

One line per decision — the rule, not the reasoning. Read the full ADR (`.arc/decisions/ADR-NNNN-*.md`) for context and rationale.

## Accepted — binding rules

| ADR | Category | Status | Rule |
|---|---|---|---|
| ADR-0004 | component | accepted | Relational business data lives only in the Relational Database, inside the selected AWS region. |
| ADR-0010 | integration_surface | accepted | Email is sent only by the Worker through Amazon SES. |
| ADR-0011 | integration_surface | accepted | Chat notifications go out only from the Worker as webhook calls. |
| ADR-0012 | integration_surface | accepted | All components send structured logs and metrics to CloudWatch. |
| ADR-0016 | component | accepted | The Web App reaches business data only through the API Service and authenticates users only through the Identity Provider. |
| ADR-0017 | component | accepted | Business records and audit logs are written only through the API Service; clients and the Worker never bypass its authorization rules. |
| ADR-0018 | component | accepted | Background and long-running work runs in the Worker via the Job Queue, never inside API request handling. |
| ADR-0019 | component | accepted | Documents and files live in Object Storage; only their metadata is kept in the Relational Database. |
| ADR-0020 | component | accepted | The API Service hands background work to the Worker only by enqueuing jobs on the Job Queue. |
| ADR-0021 | component | accepted | Authentication uses standard OIDC/SAML only, so the provider can be replaced without application code changes. |
| ADR-0022 | nfr | accepted | Customer and application data is stored and processed only in us-east-1, with no cross-region replication. |
| ADR-0023 | nfr | accepted | Run every component Multi-AZ within us-east-1 and meet 99.9% monthly availability. |
| ADR-0024 | nfr | accepted | Back up the Relational Database and Object Storage so data loss is at most 15 minutes and service is restored within 1 hour. |
| ADR-0025 | nfr | accepted | Size the system for thousands of users; revisit the design if load grows an order of magnitude beyond that. |
| ADR-0026 | deployment_target | accepted | All components run as containers on ECS Fargate in us-east-1, with production and staging in separate AWS accounts; changing region topology needs a new architecture decision. |
| ADR-0027 | cross_cutting | accepted | Business-domain specifics are expressed as configuration, not hard-coded per use case. |
| ADR-0028 | cross_cutting | accepted | Every change to a business record is written to the audit trail by the API Service in the same operation. |
| ADR-0029 | cross_cutting | accepted | Third-party integrations use the API's inbound endpoints and outbound webhooks, never direct data access. |
| ADR-0030 | cross_cutting | accepted | The system is single-tenant; do not add tenant partitioning to the schema or API. |
| ADR-0031 | cross_cutting | accepted | Keep one API Service that the Web App calls directly; add a gateway or BFF only through a new architecture decision. |
| ADR-0032 | cross_cutting | accepted | No compliance regime beyond us-east-1 residency applies; raise a new decision before adding one. |
| ADR-0033 | cross_cutting | accepted | Map components to epics and stories once a backlog exists. |

## Superseded and retired — not binding

| ADR | Category | Status | Title |
|---|---|---|---|
| ADR-0001 | component | superseded by ADR-0016 | Web App |
| ADR-0002 | component | superseded by ADR-0017 | API Service |
| ADR-0003 | component | superseded by ADR-0018 | Worker |
| ADR-0005 | component | superseded by ADR-0019 | Object Storage |
| ADR-0006 | component | superseded by ADR-0020 | Job Queue |
| ADR-0007 | component | superseded by ADR-0021 | Identity Provider |
| ADR-0008 | nfr | superseded by ADR-0022 | NFR: data residency — all customer and application data remains within the single selected AWS… |
| ADR-0009 | deployment_target | superseded by ADR-0026 | Deployment target: AWS, single region, Amazon ECS Fargate (managed containers) for compute |
| ADR-0013 | cross_cutting | superseded by ADR-0027 | Cross-cutting: Configurability & reusability across business domains |
| ADR-0014 | cross_cutting | superseded by ADR-0028 | Cross-cutting: Audit logging & activity tracking |
| ADR-0015 | cross_cutting | superseded by ADR-0029 | Cross-cutting: API/webhook extensibility |

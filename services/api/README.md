# API Service (`comp_api_service`)

Core business logic backend: authentication/authorization, RBAC, business record CRUD,
workflow/task management, search & filtering, reporting, audit logging, document metadata,
and API integrations. See `.arc/decisions/ADR-0002-api-service.md`.

- Language: TypeScript
- Framework: NestJS
- Database: PostgreSQL (via TypeORM)

## Commands

```bash
pnpm install
pnpm run build      # compile to dist/
pnpm test           # unit tests (jest)
pnpm run test:e2e   # e2e tests (jest + supertest)
pnpm run start:dev  # local dev server
```

Copy `.env.example` to `.env` and adjust database connection settings as needed.

# `src/modules/`

Feature-by-feature business logic. Each module is self-contained:

```
modules/<name>/
  repository.ts   only file that calls prisma.* — always scoped by workspaceId
  service.ts      orchestrates repo + emits domain events + business rules
  schemas.ts      Zod schemas, shared by API + server actions
  permissions.ts  declarative (resource, action) → required permission map
  events.ts       domain events emitted by this module
  index.ts        public surface exposed to app/ and api/
```

App routes (`src/app/(app)/...`) and API routes (`src/app/api/v1/...`) stay thin: parse → permission check → call service → render/respond.

Currently scaffolded modules: see [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) §3.

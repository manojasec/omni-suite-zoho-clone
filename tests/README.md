# `tests/`

- `unit/`        — Vitest, pure functions (permissions matrix, invoice math, Zod schemas)
- `integration/` — Vitest + Testcontainers (real Postgres), module services, multi-tenancy
- `e2e/`        — Playwright, critical user journeys

See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) §16.

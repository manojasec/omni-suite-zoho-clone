# `src/platform/`

Cross-cutting capabilities used by every module:

- `auth/`          — Auth.js config, session helpers, password hashing
- `permissions/`   — role matrix, `assertCan()`, `usePermission()`
- `tenancy/`       — `requireSession()`, `withWorkspace()`, RLS helpers
- `audit/`         — `recordAuditEvent()`
- `billing/`       — Stripe service, plan limits, `assertWithinPlanLimit()`
- `email/`         — transactional + bulk senders, templates
- `files/`         — S3 presigner, attachment lifecycle
- `queue/`         — BullMQ queues + job schemas
- `webhooks/`      — outbound webhook dispatcher (HMAC, retry)
- `search/`        — global search service
- `observability/` — pino logger, OTel tracer, metrics
- `api/`           — REST helpers (pagination, RFC 7807 errors, rate limit)

Migration plan: existing code under `src/lib/` (e.g. `auth.ts`, `session.ts`) will move here as each module is implemented.

# OmniSuite — Technical Architecture (v1.0)

> Companion to [docs/PRD.md](PRD.md). This document is the implementation contract for the engineering team. It is opinionated, multi-tenant from day one, and scoped to the MVP defined in the PRD.

---

## 1. Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Runtime / framework | **Next.js 15 (App Router) + TypeScript** | One framework for SSR, RSC, server actions, REST routes, edge auth |
| UI | **Tailwind CSS + custom shadcn-style primitives** | Original look, no off-the-shelf vendor styling |
| Charts | **Recharts** | Lightweight, RSC-friendly |
| DB | **PostgreSQL 16** | Strong types, RLS for tenant isolation, JSONB for custom fields |
| ORM | **Prisma 5** | Typed schema, migrations, single source of truth |
| Auth | **Auth.js v5 (NextAuth)** | Sessions, OAuth, credentials; pluggable adapters |
| Payments | **Stripe** (Checkout + Customer Portal + Webhooks) | SAQ-A scope, no card data on our infra |
| Cache / queues | **Redis + BullMQ** (added in M3) | Email, PDF, webhook retry, scheduled sends |
| File storage | **S3-compatible** (R2 / S3) with presigned URLs | Scalable, cheap, vendor-portable |
| Transactional email | **Resend** | Templated transactional messages |
| Bulk email | **SendGrid (or AWS SES)** | Separate IP pool for marketing, deliverability isolation |
| Observability | **OpenTelemetry → Grafana / Loki / Tempo + Sentry** | One pipeline for logs, traces, errors |
| CI/CD | **GitHub Actions → Vercel (web) + Fly/Render (workers) + Neon/RDS (DB)** | Standard, proven |
| IaC | **Terraform** for cloud infra; **Docker Compose** for local | Reproducible environments |

Defer until clearly needed: GraphQL, microservices, Kubernetes, custom search engine, custom auth.

---

## 2. Multi-tenancy model

**Pattern:** Single shared database, single shared schema, **`workspaceId`** column on every tenant-scoped table.

**Three layers of isolation, all enforced:**

1. **Application-layer guard** — every Prisma call goes through repository helpers that automatically inject `workspaceId` from the session context. Never trust a client-provided workspace ID.
2. **Postgres Row-Level Security (RLS)** — defense in depth. Each request sets `SET LOCAL app.workspace_id = '<id>'` and policies restrict every read/write.
3. **Type-system guard** — `WorkspaceScopedRepository<T>` wrapper makes it a compile error to call `prisma.contact.findMany` directly from a route handler.

```sql
-- example RLS policy (one per tenant-scoped table)
ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_tenant_isolation ON "Contact"
  USING ("workspaceId" = current_setting('app.workspace_id', true));
```

**Tenant-scoped tables (~25):** Contact, Company, Lead, Deal, Pipeline, Stage, Invoice, InvoiceLineItem, Payment, Customer, Product, Project, Task, TimeEntry, Ticket, TicketMessage, Form, FormSubmission, Audience, Campaign, Activity, Notification, AuditLog, ApiKey, Membership, Invitation, Webhook.

**Shared tables (no tenant scope):** User, Account, Session, VerificationToken, Workspace, Plan metadata.

A user can hold memberships in multiple workspaces. The active workspace is part of the session JWT and resolved on every request.

---

## 3. Folder structure

```
omnisuite/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md          ← this file
│   ├── DEPLOYMENT.md            (M6)
│   └── SECURITY.md              (M6)
├── prisma/
│   ├── schema.prisma            single source of truth
│   ├── migrations/
│   ├── seed.ts
│   └── policies.sql             RLS policies, applied after migrate
├── src/
│   ├── app/                     Next.js App Router
│   │   ├── (marketing)/         landing, pricing, legal
│   │   ├── (auth)/              login, signup, forgot, reset, verify
│   │   ├── (app)/               authed shell — sidebar + topbar
│   │   │   └── app/
│   │   │       ├── crm/
│   │   │       ├── sales/
│   │   │       ├── billing/
│   │   │       ├── projects/
│   │   │       ├── helpdesk/
│   │   │       ├── forms/
│   │   │       ├── campaigns/
│   │   │       ├── reports/
│   │   │       └── settings/
│   │   ├── (portal)/            client portal (separate shell)
│   │   ├── api/
│   │   │   ├── v1/              public REST API
│   │   │   ├── auth/            Auth.js handler
│   │   │   ├── webhooks/        Stripe, inbound email, etc.
│   │   │   └── public/          form submit, lead capture
│   │   └── onboarding/
│   ├── modules/                 ← feature-by-feature business logic
│   │   ├── crm/
│   │   │   ├── repository.ts    workspace-scoped Prisma calls
│   │   │   ├── service.ts       business rules, validation
│   │   │   ├── schemas.ts       Zod schemas (shared by API + actions)
│   │   │   ├── permissions.ts   per-action permission map
│   │   │   ├── events.ts        domain events (contact.created, …)
│   │   │   └── index.ts         public surface for the module
│   │   ├── sales/
│   │   ├── billing/
│   │   ├── projects/
│   │   ├── helpdesk/
│   │   ├── forms/
│   │   ├── campaigns/
│   │   ├── analytics/
│   │   └── notifications/
│   ├── platform/                ← cross-cutting capabilities
│   │   ├── auth/                Auth.js config + session helpers
│   │   ├── permissions/         role matrix + check() helpers
│   │   ├── tenancy/             requireSession, withWorkspace
│   │   ├── audit/               recordAuditEvent()
│   │   ├── billing/             Stripe service + plan limits
│   │   ├── email/               transactional + campaign senders
│   │   ├── files/               S3 presigner
│   │   ├── queue/                BullMQ queues + workers
│   │   ├── webhooks/            outbound webhook dispatcher
│   │   ├── search/              global search service
│   │   ├── observability/       logger, tracer, metrics
│   │   └── api/                 REST helpers (pagination, errors)
│   ├── components/
│   │   ├── ui/                  primitives (Button, Input, Card…)
│   │   ├── app/                 shell (Sidebar, Topbar, ModuleStub)
│   │   ├── data-table/          shared table component
│   │   └── forms/               shared form helpers
│   ├── lib/                     small utilities (cn, date, currency)
│   ├── hooks/                   client hooks (useWorkspace, usePermission)
│   ├── styles/                  globals.css, theme tokens
│   ├── workers/                 BullMQ entry points (separate process)
│   │   ├── email.worker.ts
│   │   ├── webhook.worker.ts
│   │   ├── campaign.worker.ts
│   │   └── recurring-invoice.worker.ts
│   └── middleware.ts            auth gate for /app/*
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/                     Playwright
├── public/
├── scripts/
│   └── apply-rls.ts             reads policies.sql and applies
├── docker-compose.yml           local Postgres + Redis + Mailhog
├── .env.example
├── .github/workflows/
│   ├── ci.yml                   typecheck, lint, test, build
│   └── deploy.yml               on tag → prod
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

**Module pattern (every business module follows this):**
- `repository.ts` — only file that calls `prisma.*`, always scoped by `workspaceId`
- `service.ts` — orchestrates repository + emits events + enforces business rules
- `schemas.ts` — Zod schemas reused by both REST endpoints and server actions
- `permissions.ts` — declarative `(resource, action) → required permission`
- App routes are thin: parse → permission check → call service → render
- API routes are thin: parse → permission check → call service → format JSON

---

## 4. Database architecture

### 4.1 Conventions
- IDs: `cuid()` (collision-resistant, sortable enough, URL-safe)
- Timestamps: `createdAt`, `updatedAt` on every row; `deletedAt` for soft delete on user-facing records
- Money: `Decimal(14,2)`; never `Float`
- Currency: ISO 4217 string column on every monetary record (never derived)
- Time zones: store UTC, render in user's tz; per-workspace default tz
- JSONB used only for: form schemas, audience filter DSL, custom field values, audit diffs
- Every tenant-scoped table has a composite index `(workspaceId, <hot column>)`

### 4.2 Indexing strategy (initial)
- `Contact (workspaceId, email)`, `(workspaceId, lifecycleStage)`
- `Deal (workspaceId, stageId)`, `(workspaceId, status, expectedCloseAt)`
- `Invoice (workspaceId, status)`, `(workspaceId, dueDate)`, unique `(workspaceId, number)`
- `Ticket (workspaceId, status)`, unique `(workspaceId, number)`
- `Activity (workspaceId, contactId)`, `(workspaceId, createdAt)`
- `AuditLog (workspaceId, createdAt)`
- Trigram (`pg_trgm`) GIN index on `Contact.firstName + lastName + email`, `Company.name`, `Deal.name`, `Invoice.number`, `Ticket.subject` for global search

### 4.3 Soft delete
- Records with downstream references use `deletedAt IS NULL` filter in repository layer.
- Hard delete after 30 days via a daily scheduled job (also drives GDPR erasure SLA).

### 4.4 Migrations
- `prisma migrate dev` in development
- `prisma migrate deploy` in CI on protected branches
- RLS policies live in `prisma/policies.sql`, applied by `scripts/apply-rls.ts` after each deploy
- Backfills run as one-shot scripts in `scripts/migrations/` and are reviewed like code

---

## 5. Authentication flow

**Provider:** Auth.js v5 with Prisma adapter. JWT session strategy (stateless, scales on serverless).

```
                    ┌──────────────┐
   Browser ────────▶│  /login UI   │
                    └──────┬───────┘
                           │ credentials / OAuth start
                           ▼
                    ┌──────────────┐  Argon2/bcrypt verify
                    │ Auth.js core │──▶ Postgres (User)
                    └──────┬───────┘
                           │ JWT signed (sub = userId)
                           ▼
                  HttpOnly Secure SameSite=Lax cookie
                           │
                           ▼
              every request → middleware.ts
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
      requireSession()             public route allowed
      → load active Membership
      → resolve { userId, workspaceId, role }
      → SET LOCAL app.workspace_id (for RLS)
      → handler runs
```

**Session JWT contents:** `sub` (user id), `email`. Active workspace + role are resolved server-side per request from `Membership` (cheap, indexed lookup) so role changes take effect immediately without re-issuing tokens.

**Password rules:** Argon2id (or bcrypt cost 12 in MVP), min 12 chars, HIBP breach check on signup.

**2FA:** TOTP enrolment with backup codes. When enabled, login flow inserts an interstitial step before the JWT is issued.

**OAuth:** Google + Microsoft via Auth.js providers. SAML deferred.

**Email verification:** Mandatory; signup creates a `VerificationToken` and emails a one-click link.

**Sessions:** absolute 30 days, idle 14 days. Revocation list in Redis for "force-logout" use cases.

---

## 6. Permission model

**Tuple:** `(resource, action, scope)` where
- `resource` ∈ contact, company, lead, deal, invoice, …, settings.users
- `action` ∈ view, create, edit, delete, export, assign, send
- `scope` ∈ `own` | `team` | `all`

**Storage:**
- 8 system roles (Owner / Admin / Manager / Member / Agent / Sales / Finance / Viewer) ship as static permission matrices in `src/platform/permissions/matrix.ts`.
- A user's effective permissions = role matrix + custom workspace overrides (post-MVP).

**Server-side checks (single helper):**
```ts
await assertCan(ctx, "contact", "edit", { ownerId: contact.ownerId });
// throws PermissionError → 403 in API, redirect in pages
```

Every repository write goes through a service function that runs `assertCan` *before* the DB call. Every API handler runs `assertCan` after parsing inputs.

**Client-side:**
- `usePermission("contact", "create")` hook used to hide UI affordances. UI hiding is convenience only — server is the source of truth.

**Tests:**
- A permission matrix test enumerates every (role × resource × action) combination against fixtures and snapshots the result. Any change to the matrix forces a snapshot update.

---

## 7. API route structure

### 7.1 Internal app calls
- Pages and forms use **Next.js Server Actions** for mutations. Type-safe, no separate client.
- Reads are done in Server Components (RSC) through the same module services — no extra wire format.

### 7.2 Public REST API (`/api/v1/*`)
- Authenticated by `Authorization: Bearer <api_key>` (workspace-scoped, scoped permissions).
- JSON, cursor pagination, RFC 7807 errors, idempotency keys on POST.
- Versioned at `/v1`. New incompatible changes go to `/v2`; deprecation policy: 12 months.
- Rate-limited by Redis token bucket (600 req/min/key, 60 req/min/IP for unauth).

### 7.3 Public unauthenticated endpoints
- `POST /api/public/forms/{publicId}/submit` — hosted forms
- `POST /api/public/leads` — web-to-lead with workspace API key
- `POST /api/public/inbound-email/{address}` — email-to-ticket (verified by signed parser)

### 7.4 Webhooks (inbound)
- `/api/webhooks/stripe` — signature verified
- `/api/webhooks/resend` — bounce / complaint events
- `/api/webhooks/sendgrid` — campaign engagement events

### 7.5 Webhooks (outbound)
- Workspaces register URLs; events delivered with HMAC-SHA256 signature; retried with exponential backoff up to 24h, then dead-letter.

---

## 8. Frontend route structure

| Group | Layout | Purpose |
|---|---|---|
| `(marketing)` | minimal header/footer | landing, pricing, legal |
| `(auth)` | centered card | login, signup, password reset, verify, invitation accept |
| `(app)` | sidebar + topbar | the authenticated SaaS app |
| `(portal)` | branded portal shell | external client portal (separate route segment + auth provider) |
| `api/*` | none | REST + webhooks + Auth.js |

Server Components by default; client components only where interactivity is needed (kanban boards, form builder, data table filters). Error boundaries at the layout group level. Loading UI with `loading.tsx` for skeletons.

See [docs/PRD.md](PRD.md) §6 for the full page list.

---

## 9. Background job strategy

**Queue:** BullMQ on Redis. Each queue gets a dedicated worker process.

| Queue | Use cases |
|---|---|
| `email-transactional` | invitations, password reset, invoice emails, ticket replies |
| `email-bulk` | campaign sends (chunked into batches of ~500) |
| `webhook-out` | outbound webhook delivery + retry |
| `pdf` | invoice & estimate PDF rendering |
| `recurring` | recurring invoices, scheduled campaigns, SLA timers |
| `housekeeping` | nightly: AR aging recompute, hard-delete expired soft-deletes, audit log archival |

**Scheduling:** BullMQ repeatable jobs for cron-like work. Idempotency keys on every job payload to safely retry.

**Workers run as a separate process** (`src/workers/*`), deployed independently from the web app. This isolates failure domains and lets us scale them differently.

**Backpressure:** rate limit per workspace on `email-bulk` to protect deliverability.

---

## 10. Email architecture

- **Transactional** (Resend): one-to-one, low volume, high importance. Templates live in `src/platform/email/templates/`. From-address: `noreply@<workspace-sender-domain>`.
- **Bulk** (SendGrid): campaign sends only. Separate IP pool, separate sending domain per workspace (DKIM/SPF setup wizard in M6).
- **Inbound**: per-workspace address `<slug>+<token>@inbound.omnisuite.app` parsed by webhook → ticket or activity.
- **Suppression**: a single `Suppression` table is checked before any send; one-click unsubscribe writes to it.

---

## 11. File uploads

- All uploads use **presigned PUT URLs** issued by the server.
- `Attachment` row created server-side first; `fileKey` is the S3 path.
- Server-side virus scan (ClamAV worker) flips `status` from `pending` to `clean | infected`.
- Downloads use presigned GET, max 5 min TTL.
- Max size 25 MB (MVP). PDF generation outputs to the same bucket.

---

## 12. Search

**MVP:** Postgres full-text + `pg_trgm` GIN indexes on hot columns.
- A single `/api/v1/search?q=…` returns results grouped by entity.
- Permission-filtered server-side; never include records the caller can't view.

**Post-MVP:** OpenSearch / Meilisearch when query volume or ranking quality requires.

---

## 13. Subscription billing flow

```
Workspace → /settings/billing → Stripe Checkout (hosted)
   └──── webhook checkout.session.completed
              └──── update Workspace.plan + seats
                    create BillingSubscription row

Daily/monthly Stripe invoice → webhook invoice.paid / invoice.payment_failed
   └──── update BillingSubscription.status
         downgrade to STARTER on prolonged failure (dunning)

Customer portal for self-serve plan changes / cancellations.
```

**Plan limits enforced by `assertWithinPlanLimit(workspaceId, "campaign_sends_month", n)`** before any rate-counted operation. Limits live in code (`platform/billing/plans.ts`); changing them is a code change reviewed in PR.

---

## 14. Observability

- **Logging:** structured JSON via Pino → Loki. Every log line includes `workspaceId`, `userId`, `requestId`, `traceId`. PII redaction filter on email + phone fields.
- **Tracing:** OpenTelemetry auto-instrumentation for HTTP + Prisma, exported to Tempo.
- **Errors:** Sentry with sourcemaps; environment + release tagged.
- **Metrics:** RED (rate, errors, duration) per route; business KPIs (signups, MRR) emitted as counters.
- **Audit log:** business-domain events written to `AuditLog` table — separate from technical logs.

---

## 15. Security posture (cross-cutting)

| Concern | Control |
|---|---|
| Tenant isolation | Application layer + RLS + tenancy tests in CI |
| Authn | Auth.js JWT, Argon2/bcrypt, 2FA, breach check, email verification |
| Authz | Server-side `assertCan` on every write; UI hides only |
| Input | Zod validation on every server action and API route |
| Output | React auto-escaping; explicit allowlist for `dangerouslySetInnerHTML` (campaign templates only, sanitized) |
| Transport | TLS 1.2+, HSTS preload |
| Headers | Strict CSP, X-Frame-Options DENY (forms/portal allowlisted), Referrer-Policy strict-origin |
| Secrets | Vault / cloud KMS; never in env files in prod; rotated quarterly |
| Webhooks | HMAC-SHA256 (outbound), Stripe signature (inbound) |
| File uploads | Presigned URLs, ClamAV scan, max size, MIME sniff |
| Rate limit | Redis token bucket on auth, signup, public form, API |
| Backups | Nightly full + 7-day PITR; quarterly restore drill |
| Compliance | GDPR export/erasure endpoints; PCI SAQ-A via Stripe |

See [docs/PRD.md](PRD.md) §9 for the full security requirements.

---

## 16. Testing strategy

| Layer | Tool | What we test |
|---|---|---|
| Unit | Vitest | Pure logic: permission matrix, invoice math, Zod schemas, plan-limit gates |
| Integration | Vitest + Testcontainers (Postgres) | Module services against a real DB: tenant scoping, RLS, repository correctness |
| API contract | Vitest + supertest | `/api/v1/*` endpoints incl. auth, rate limit, error format |
| E2E | Playwright | Critical user journeys: signup → workspace → invite → contact CRUD → invoice → payment |
| Load | k6 (M6) | List endpoints under 50k records; p95 budgets |
| Security | Static (Semgrep) + deps (Snyk/OSV) | Each PR |

**Multi-tenancy test** runs against every module on every PR: creates two workspaces, performs CRUD as workspace A, asserts workspace B sees zero leak via every read path (list, detail, search, export). A failure here blocks merge.

**Coverage targets:** 80% lines on `src/modules/*` and `src/platform/permissions/*`. Coverage on UI components is not enforced.

---

## 17. Deployment strategy

**Environments:** `local` → `dev` → `staging` → `prod`. Branches: trunk-based; every merge to `main` deploys to `dev` automatically; tags deploy to staging then prod via approval.

**Topology:**
- **Web** (Next.js) → Vercel (preferred) or Fly.io (containerized fallback).
- **Workers** → Fly.io machines (one per queue family), autoscaled by queue depth.
- **DB** → Neon (serverless Postgres) or AWS RDS Postgres in single-AZ for MVP, multi-AZ at GA.
- **Redis** → Upstash or AWS ElastiCache.
- **S3** → Cloudflare R2 (cheap egress) with bucket per environment.
- **Email** → Resend + SendGrid; DNS managed via Cloudflare.

**Pipeline:**
1. PR → CI: typecheck, lint, unit + integration tests, Prisma migrate dry-run, build.
2. Merge → deploy `dev`, run smoke tests + multi-tenancy test.
3. Tag `vX.Y.Z` → deploy staging, run E2E suite.
4. Manual approval → blue/green deploy to prod, run smoke checks, then flip traffic.
5. DB migrations: `prisma migrate deploy` runs *before* the new app version is promoted; only backwards-compatible migrations are allowed in any single release (expand → migrate code → contract pattern).

**SLOs:** 99.9% availability, p95 API < 300 ms, error budget tracked weekly.

**DR:** RPO 24h, RTO 8h MVP. PITR backups, runbook in `docs/RUNBOOKS.md`, quarterly restore drill.

---

## 18. Local development

```powershell
# one-time
copy .env.example .env
docker compose up -d            # Postgres + Redis + Mailhog
npm install
npm run db:push                 # Prisma schema
npm run db:seed                 # demo workspace
npm run dev
```

`docker-compose.yml` provides:
- Postgres 16 with `pg_trgm` extension
- Redis 7
- Mailhog for catching outbound email locally
- Minio for S3 emulation (added in M3)

---

## 19. Module-by-module milestone map

Each milestone leaves the system production-ready and chargeable. Milestones map directly to PRD §14.

| Milestone | New modules | New platform capabilities |
|---|---|---|
| **M0** | — | Tenancy, auth, RBAC matrix, app shell, Stripe stub, audit log skeleton |
| **M1** | CRM, Forms | Custom fields, CSV import, public form endpoints, hCaptcha |
| **M2** | Sales pipeline, Analytics v1 | Kanban, dashboard widgets |
| **M3** | Invoicing & billing | Stripe full integration, PDF queue, recurring jobs |
| **M4** | Projects & tasks | Comments + attachments, time entries → invoice |
| **M5** | Helpdesk | Inbound email, SLA timers, client portal |
| **M6** | Email campaigns + cross-module polish | Public REST API, outbound webhooks, full reports, hardening |

Each module ships with: schema migration, repository, service, permissions, schemas, UI, integration tests, and a permission-matrix entry. **No module is "done" until its multi-tenancy test passes.**

---

*End of Architecture v1.0.*

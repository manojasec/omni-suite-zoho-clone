# OmniSuite

A multi-tenant SaaS business suite — CRM, sales pipeline, invoicing & payments, projects & tasks, helpdesk, public forms, email campaigns, analytics, and global search — built with Next.js 15, React 19, Prisma, and MySQL.

Every record is scoped by `workspaceId`. Every server action / API route is gated by `requireSession()` + `assertCan(role, resource, action)`. Mutations write to `auditLog`. Subscription billing via Stripe with plan-based feature & usage limits.

## Feature highlights

- **CRM** – Contacts, companies, activities, lifecycle stages, tagging, owner assignment.
- **Sales** – Configurable pipelines, kanban deal board, won/lost tracking.
- **Billing** – Invoices with line items, taxes, payments, partial payments, customers, products.
- **Projects** – Projects, sub-tasks, status board, assignees, due dates.
- **Helpdesk** – Tickets with priorities, statuses, tags, assignment & SLA scaffold.
- **Forms** – Drag-free form builder with public submission endpoint, honeypot + Contact auto-create.
- **Campaigns** – Audience filters (DSL), HTML campaign editor, scheduling, send/cancel.
- **Analytics** – Server-rendered SVG charts (no client JS) for every module + cross-module overview.
- **Global search** – `Ctrl/⌘-K` modal querying all permission-allowed resources with debounce + keyboard nav.
- **Notifications & audit log** – Persistent in-app notifications + tamper-resistant audit trail.
- **Subscription billing** – Stripe Checkout + Customer Portal + webhook sync; 4 plans with feature flags & resource limits.
- **Roles & permissions** – 8-role static matrix (Owner → Viewer) over ~30 resources × 8 actions.

## Stack

- **Runtime**: Next.js 15 (App Router) · React 19 · TypeScript strict
- **UI**: Tailwind CSS 3.4 · custom shadcn-style primitives · `lucide-react`
- **Data**: Prisma 5 · MySQL 8.0+
- **Auth**: Auth.js v5 (credentials + optional Google) · bcryptjs
- **Payments**: Stripe (checkout, customer portal, webhooks)
- **Validation**: Zod everywhere
- **Tests**: Vitest 2 (unit + future integration)

## Prerequisites

- Node.js 20+
- MySQL 8.0+ (local or remote)
- (optional) Stripe account & CLI for subscription billing

## Quick start

```powershell
# 1. Install dependencies
npm install

# 2. Configure environment
copy .env.example .env
# Edit .env and set DATABASE_URL + AUTH_SECRET (and optionally Stripe keys)

# 3. Generate Prisma client + push schema
npm run db:push

# 4. Seed a demo workspace
npm run db:seed
#    Demo login: owner@demo.test / Password123!

# 5. Run the dev server
npm run dev
```

Open <http://localhost:3000>.

## Available scripts

| Command            | What it does                                    |
| ------------------ | ----------------------------------------------- |
| `npm run dev`      | Next.js dev server                              |
| `npm run build`    | `prisma generate && next build`                 |
| `npm start`        | Run the production build                        |
| `npm test`         | Run the Vitest unit suite (~80 tests)           |
| `npm run db:push`  | Push the Prisma schema to your database         |
| `npm run db:seed`  | Seed a demo workspace + owner                   |
| `npm run lint`     | ESLint                                          |

## Project layout

```
prisma/
  schema.prisma            # All ~30 tables + enums
  seed.ts                  # Demo workspace
src/
  lib/
    prisma.ts              # Singleton Prisma client
    auth.ts                # Auth.js config
    session.ts             # requireSession()
    stripe.ts              # Lazy Stripe client + plan↔price mapping
  middleware.ts            # Gates /app/* with Auth.js
  platform/
    permissions/           # Roles × resources × actions matrix + assertCan
  modules/                 # Domain logic (validation, helpers, audit, notifications, billing, search, analytics)
  components/              # Shared UI (ui/, app/ shell, analytics/ charts)
  app/
    (auth)/                # /login, /signup
    (app)/app/             # All authenticated pages
      crm/ sales/ billing/ projects/ tasks/ helpdesk/
      forms/ campaigns/ reports/ notifications/ inbox/
      settings/            # 15 settings pages
    forms/[publicId]/      # Public form rendering (outside auth)
    api/
      auth/[...nextauth]/  # Auth.js
      search/              # Global search JSON
      stripe/              # checkout, portal, webhook
tests/
  unit/                    # Vitest unit suite
```

## Pattern for adding a module

1. Define Zod schemas in `src/modules/<name>/schemas.ts`.
2. Add server actions in `src/app/(app)/app/<area>/actions.ts`:
   - Call `requireSession()` and `assertCan(ctx.role, "<resource>", "<action>")`.
   - For "create" actions on quota-tracked resources, call `assertWithinPlanLimit(ctx.workspaceId, "<key>")`.
   - Always include `workspaceId: ctx.workspaceId` in `where` clauses.
   - On mutate, call `recordAuditEvent(...)` and `revalidatePath(...)`.
3. Build server-component pages in `src/app/(app)/app/<area>/page.tsx`. Use client components only for forms / interactivity (`useTransition`).

## Security model

- All `/app/*` routes are protected by `middleware.ts`.
- Every server action / page calls `requireSession()` to resolve the active workspace + role.
- Every Prisma query includes `workspaceId: ctx.workspaceId` in `where`.
- Every privileged action calls `assertCan(role, resource, action)` from the role matrix.
- All Form-data inputs are parsed by Zod schemas before reaching the database.
- Public form submissions use a hidden honeypot field (`hp_url`) for spam mitigation.
- Stripe webhook signature is validated via `STRIPE_WEBHOOK_SECRET`.
- Audit log captures actor, action, resource, IP, and user-agent for sensitive actions.

## Subscription billing

1. Create products & prices in Stripe Dashboard for Starter / Professional / Enterprise.
2. Set the price IDs in `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PRICE_STARTER=price_...
   STRIPE_PRICE_PROFESSIONAL=price_...
   STRIPE_PRICE_ENTERPRISE=price_...
   ```
3. Configure your webhook endpoint to `POST {APP_URL}/api/stripe/webhook` and capture the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Plan limits & feature flags live in `src/modules/billing/plans.ts`. Enforce in code with:
   ```ts
   await assertWithinPlanLimit(workspaceId, "contacts");
   await assertPlanFeature(workspaceId, "advancedReports");
   ```

## Deployment

The app is a standard Next.js 15 server-rendered application. Recommended targets:

### Vercel

1. Set environment variables (everything from `.env.example`).
2. Set the build command to `npm run build` (which runs `prisma generate` first).
3. Configure `prisma migrate deploy` in a release/post-deploy hook so the database schema is migrated.
4. Add Stripe webhook endpoint pointing to `https://<your-domain>/api/stripe/webhook`.

### Self-host (Node + MySQL)

1. Provision a MySQL 8.0+ instance and set `DATABASE_URL`.
2. `npm ci && npm run build && npx prisma migrate deploy`.
3. `npm start` behind a TLS-terminating reverse proxy (Caddy / nginx / Cloudflare).
4. Open port 3000 (or set `PORT`) and ensure `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and Stripe webhook target the public hostname.

### Production checklist

- [ ] Strong `AUTH_SECRET` (32+ bytes from `openssl rand -base64 32`)
- [ ] HTTPS only (`AUTH_URL` and `NEXT_PUBLIC_APP_URL` must be `https://`)
- [ ] Database backups configured
- [ ] Stripe in live mode with webhook reachable
- [ ] Run `npm test` and `npm run build` in CI
- [ ] Connection pooling for MySQL (ProxySQL / PlanetScale / RDS Proxy)
- [ ] Email provider wired up for password reset flows (TODO)
- [ ] Configure log aggregation (Vercel logs, Datadog, etc.)

## Testing

```powershell
npm test
```

The Vitest suite covers permission matrices (including coverage assertions for every (role, resource) pair), validation schemas across all modules (CRM, sales, billing, projects, helpdesk, forms, marketing, mail), analytics time bucketing, and the billing plan catalog.

## Production deployment

### Recommended hosts

- **App**: Vercel, Fly.io, Railway, or any Node 20+ container host.
- **Database**: PlanetScale, AWS RDS, or DigitalOcean Managed MySQL (8.0+ required for `Json` columns).
- **Object storage** (future): S3 / R2 for receipts, signature documents, mail attachments.

### Build & start

```powershell
npm ci
npm run build      # runs `prisma generate && next build`
npm start          # production server on $PORT (default 3000)
```

### Database migrations

Use Prisma migrations rather than `db push` in production:

```powershell
npx prisma migrate deploy
```

Run the migration step from a release pipeline before promoting the new app version.

### Environment

Copy `.env.example` to `.env`, then in your hosting provider set every variable (especially `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and Stripe keys). The provided `next.config.js` ships with sensible security defaults: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and a restrictive Permissions-Policy. The `X-Powered-By` header is disabled.

### Health check

`GET /` (marketing landing) and `GET /app` (auth-gated, returns 302 → `/sign-in` if unauthenticated) are both safe for uptime probes.

### Pre-flight checklist

- [ ] All env vars set; no values committed to source.
- [ ] `AUTH_SECRET` is at least 32 bytes (`openssl rand -base64 32`).
- [ ] `AUTH_URL` and `NEXT_PUBLIC_APP_URL` are `https://`.
- [ ] Stripe webhook endpoint registered and `STRIPE_WEBHOOK_SECRET` set.
- [ ] DB is at the latest migration; backups configured.
- [ ] CI runs `npm test` and `npm run build` and blocks on failure.
- [ ] Log aggregation set up (Vercel logs / Datadog / Logtail).
- [ ] Connection pooling configured for MySQL (ProxySQL / RDS Proxy / PlanetScale).
- [ ] Custom domain has HSTS preloaded once stable.

## License

Internal sample project.

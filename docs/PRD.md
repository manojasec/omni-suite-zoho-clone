# Product Requirements Document — OmniSuite (MVP)

> **Codename:** OmniSuite
> **Category:** All-in-one business software platform for SMBs
> **Document type:** MVP PRD (v1.0)
> **Status:** Draft for engineering kickoff

OmniSuite is an original, multi-tenant SaaS business suite that bundles CRM, sales pipeline, invoicing, projects, helpdesk, forms, email campaigns, analytics, and administration into a single workspace. This document defines the scope of the first production-ready MVP. It does not copy branding, UI, wording, or proprietary workflows of any existing vendor.

---

## 1. Vision and positioning

**One-line pitch:** A single, affordable workspace where small teams run their customers, sales, money, projects, and support — without stitching together five tools.

**Design principles**
- One unified data model (contacts, companies, users) shared across every module.
- Opinionated defaults; configuration is optional, not mandatory.
- Fast keyboard-first UI, clean tables, predictable navigation.
- Multi-tenant by `workspaceId` from day one.
- Every record is auditable, exportable, and permission-aware.

**Out of scope for MVP** (deferred to later phases): inventory, accounting ledger, HR/payroll, custom-code automation, marketplace, mobile apps, on-prem deployment, AI agents, telephony.

---

## 2. Target customers

| Segment | Profile | Why they buy |
|---|---|---|
| **Primary: SMB service businesses (5–50 employees)** | Agencies, consultancies, IT services, B2B service firms | Replace 4–6 separate SaaS tools with one bill |
| **Secondary: Solo founders & freelancers** | 1–4 person teams selling services or light products | Need CRM + invoicing + simple projects in one place |
| **Tertiary: Internal ops teams at mid-market companies** | 50–200 employee firms running a department on it | Need a customer-facing helpdesk + project tracker |

**Geography for MVP:** English-speaking markets (US, UK, CA, AU, IN). Currency: USD, EUR, GBP, INR. Timezone-aware everywhere.

---

## 3. Main user roles (system-level)

Roles are defined per workspace. A user can hold different roles in different workspaces.

| Role | Scope | Typical permissions |
|---|---|---|
| **Owner** | One per workspace | Full access, billing, delete workspace |
| **Admin** | Multiple allowed | Full access except billing/delete workspace |
| **Manager** | Per team | Read/write within owned teams; approve invoices, close deals |
| **Member** | Default seat | Read/write records they own or are assigned |
| **Agent** | Helpdesk-focused | Tickets + linked contacts only |
| **Sales Rep** | Sales-focused | CRM + pipeline; read-only invoices |
| **Finance** | Billing-focused | Invoices, payments, customers; read-only CRM |
| **Viewer** | Read-only | Dashboards + assigned records, no edits |
| **External Client** *(portal only)* | Outside workspace | View own invoices, tickets, project status |

Roles are **templates** that map to fine-grained permissions (see §11). Custom roles are post-MVP.

---

## 4. Modules and core workflows

### 4.1 CRM
**Purpose:** Single source of truth for contacts and companies.

**Core workflow**
1. Capture lead (manual, web form, email, CSV import).
2. Auto-deduplicate by email/domain.
3. Enrich with company, owner, tags, lifecycle stage.
4. Log activities (notes, calls, emails, meetings).
5. Convert lead → contact + optional deal.

**MVP features**
- Contacts and companies with custom fields (text/number/date/select).
- Activity timeline (notes, tasks, emails synced via IMAP/forwarding address).
- Tags, lifecycle stages, owner assignment.
- List views with filters, saved views, bulk edit, CSV import/export.
- Web-to-lead capture endpoint.

**Future**
- Email & calendar two-way sync (OAuth Google/Microsoft).
- Lead scoring, duplicate merge UI, territory rules, AI summarization.

---

### 4.2 Sales pipeline
**Purpose:** Move deals from opportunity to closed-won.

**Core workflow**
1. Create deal linked to contact/company.
2. Drag across stages on a Kanban board.
3. Forecast by stage probability.
4. On win → generate invoice (one click).

**MVP features**
- Multiple pipelines, configurable stages with probability %.
- Kanban + table views.
- Deal value, expected close date, owner, products line items.
- Win/lose reasons, activity log.
- "Convert to invoice" action.

**Future**
- Multi-currency forecasting, quotes/proposals, e-signature, goals & quotas.

---

### 4.3 Invoicing and billing
**Purpose:** Get paid.

**Core workflow**
1. Create invoice from deal, project, or scratch.
2. Send branded PDF via email with payment link.
3. Customer pays online (Stripe).
4. Auto-mark paid, send receipt, update analytics.

**MVP features**
- Customers (linked to CRM companies).
- Invoices: line items, taxes, discounts, multi-currency.
- Recurring invoices (monthly/yearly).
- PDF generation with workspace branding.
- Stripe + manual payment recording.
- Statuses: draft → sent → partially paid → paid → overdue → void.
- Tax rates per workspace; basic GST/VAT support.
- Estimates/quotes that convert to invoices.

**Future**
- Credit notes, expense tracking, full ledger, accountant export, multi-entity, tax filings, dunning rules.

---

### 4.4 Projects and tasks
**Purpose:** Deliver client work.

**Core workflow**
1. Create project (optionally linked to deal/customer).
2. Break into tasks with assignees, due dates, dependencies.
3. Track time (optional) → bill against invoice.
4. Close project when all milestones complete.

**MVP features**
- Projects with members, status, start/end, budget (hours or amount).
- Tasks: title, description, assignee, due date, priority, status, subtasks (1 level), checklists.
- Views: list, kanban, calendar.
- Comments and file attachments per task.
- Manual time entries; per-task and per-project rollup.
- Convert tracked time to invoice line items.

**Future**
- Gantt, resource planning, automated time tracking, recurring tasks, baselines.

---

### 4.5 Helpdesk / ticketing
**Purpose:** Handle inbound customer issues.

**Core workflow**
1. Customer emails support address or submits portal form.
2. Ticket created and routed (round-robin or rule-based).
3. Agent replies; threaded conversation.
4. SLA timer; resolution → CSAT email.

**MVP features**
- Channels: email-to-ticket, web form, portal.
- Ticket fields: subject, description, requester, assignee, priority, status, tags.
- Threaded conversation (public reply / internal note).
- Basic SLA: first-response and resolution time per priority.
- Simple round-robin assignment.
- Macros (canned responses).
- Customer portal: view own tickets and reply.

**Future**
- Multi-channel (chat, social), knowledge base, AI suggested replies, CSAT analytics, time-based escalation rules.

---

### 4.6 Forms
**Purpose:** Capture data into the suite.

**Core workflow**
1. Build form by drag-drop fields.
2. Map fields → CRM lead, helpdesk ticket, or generic submissions table.
3. Embed via iframe/JS or share public URL.
4. Submissions trigger notifications.

**MVP features**
- Field types: text, number, email, phone, dropdown, multi-select, date, file upload, textarea, consent checkbox.
- Validation, required fields, conditional logic (show/hide).
- Destinations: lead, contact, ticket, generic submission record.
- Spam protection: hCaptcha, honeypot, rate limit.
- Hosted public page + embed snippet.
- Submission inbox with export.

**Future**
- Multi-page forms, payment forms, signature fields, prefill from URL params, A/B testing.

---

### 4.7 Email campaigns
**Purpose:** Send marketing email to lists.

**Core workflow**
1. Build segment from CRM contacts (filter by tags, stage, custom field).
2. Compose email (template or drag-drop blocks).
3. Send now or schedule.
4. Track opens, clicks, unsubscribes.

**MVP features**
- Audiences/segments built from CRM filters.
- Email composer: subject, preheader, HTML template + plain-text fallback.
- Merge tags ({{first_name}}, etc.).
- Send via Resend/SendGrid; per-workspace sending domain (DKIM/SPF guidance).
- Scheduling, time-zone send.
- Per-campaign analytics: sent, delivered, opens, clicks, bounces, unsubscribes.
- One-click unsubscribe + suppression list.
- CAN-SPAM / GDPR consent fields.

**Future**
- Drip automations, A/B subject testing, transactional templates, deliverability dashboard, AI subject lines.

---

### 4.8 Analytics dashboard
**Purpose:** Cross-module visibility.

**MVP features**
- Workspace home dashboard with fixed widgets:
  - Pipeline value by stage
  - Revenue this month / YTD
  - Outstanding invoices
  - Open tickets by priority
  - Tasks due this week
  - New leads (last 30 days)
  - Campaign performance (last send)
- Per-module reports page (filter by date range, owner, team).
- Export any chart to CSV/PNG.

**Future**
- Custom dashboard builder, drilldowns, scheduled email reports, cohort analysis, BI connectors.

---

### 4.9 Admin settings
- Workspace profile (name, logo, currency, timezone, fiscal year).
- Branding (logo, accent color used in invoices/emails/portal).
- Billing & subscription (plan, seats, invoices, payment method).
- Custom fields per entity.
- Pipelines & stages, ticket statuses, project statuses.
- Tax rates, payment gateways.
- Email sending domain & templates.
- Integrations (Stripe, Google/Microsoft OAuth, Slack webhook).
- API keys & webhooks.
- Audit log viewer.
- Data import/export and workspace deletion.

---

### 4.10 User, team, role, permission management
- Invite users by email; pending/accepted state.
- Teams (e.g., "Sales-EMEA"), users can belong to multiple.
- Assign role per user (one of templates in §3).
- Permission matrix: per module → per action (view/create/edit/delete/export/assign) → scope (own / team / all).
- Record-level ownership and team visibility.
- SSO via Google/Microsoft OAuth (MVP); SAML post-MVP.
- 2FA (TOTP) optional per user, enforceable per workspace.
- Session management: active sessions, force logout.

---

## 5. Database entities (logical model)

All tables include `id (uuid)`, `workspaceId`, `createdAt`, `updatedAt`, `createdById`, `deletedAt` (soft delete). Tenant isolation via `workspaceId` on every query (enforced in repository layer + Postgres RLS as defense-in-depth).

### Core / identity
- `Workspace` — name, slug, plan, currency, timezone, branding
- `User` — email, name, hashedPassword, twoFactorSecret, status
- `Membership` — userId, workspaceId, roleId, status (joins User ↔ Workspace)
- `Team` — name, workspaceId
- `TeamMember` — teamId, userId
- `Role` — name, isSystem, workspaceId
- `Permission` — roleId, resource, action, scope
- `Invitation` — email, workspaceId, roleId, token, expiresAt
- `ApiKey` — workspaceId, hashedKey, scopes, lastUsedAt
- `AuditLog` — workspaceId, actorId, action, resource, resourceId, diff, ip, userAgent

### CRM
- `Contact` — firstName, lastName, email, phone, companyId, ownerId, lifecycleStage, tags[]
- `Company` — name, domain, industry, size, ownerId
- `Lead` — same shape as Contact + source, status (pre-conversion)
- `Activity` — type (note/call/meeting/email), subject, body, contactId, dealId, ownerId, dueAt, completedAt
- `CustomField` — entity, key, label, type, options
- `CustomFieldValue` — recordId, fieldId, value

### Sales
- `Pipeline` — name, default
- `Stage` — pipelineId, name, order, probability
- `Deal` — name, value, currency, stageId, contactId, companyId, ownerId, expectedCloseAt, wonAt, lostReason
- `DealLineItem` — dealId, productId, qty, price

### Billing
- `Customer` — companyId or standalone, billingAddress, taxId, currency
- `Product` — name, sku, price, taxRateId
- `Invoice` — number, customerId, status, issueDate, dueDate, currency, subtotal, tax, total, balance, dealId?, projectId?
- `InvoiceLineItem` — invoiceId, description, qty, unitPrice, taxRateId, amount
- `Estimate` — same shape as Invoice with status quote→accepted→converted
- `Payment` — invoiceId, amount, method, gatewayRef, paidAt
- `RecurringInvoice` — template, schedule (rrule), nextRunAt
- `TaxRate` — name, percent, region

### Projects
- `Project` — name, customerId?, status, startDate, endDate, budgetType, budgetAmount, ownerId
- `ProjectMember` — projectId, userId, hourlyRate?
- `Task` — projectId?, title, description, assigneeId, status, priority, dueAt, parentTaskId
- `Checklist` / `ChecklistItem`
- `TimeEntry` — userId, taskId/projectId, startedAt, durationMinutes, billable, invoicedLineItemId?
- `Comment` — resource, resourceId, authorId, body
- `Attachment` — resource, resourceId, fileKey, filename, size, mime

### Helpdesk
- `Ticket` — number, subject, requesterContactId, assigneeId, status, priority, channel, slaPolicyId, firstResponseAt, resolvedAt, tags[]
- `TicketMessage` — ticketId, authorType (agent/contact), body, isInternal, attachments
- `SlaPolicy` — priority → firstResponseMins, resolveMins, businessHoursId
- `BusinessHours` — schedule
- `Macro` — name, body, scope

### Forms
- `Form` — name, schema (json), destination, isPublished
- `FormSubmission` — formId, payload (json), ip, userAgent, createdContactId?, createdTicketId?

### Email campaigns
- `Audience` — name, filterDsl (json)
- `EmailTemplate` — name, html, plain
- `Campaign` — name, audienceId, templateId, subject, status, scheduledAt, sentAt
- `CampaignRecipient` — campaignId, contactId, status, openedAt, clickedAt, bouncedAt, unsubscribedAt
- `Suppression` — workspaceId, email, reason

### Platform
- `Notification` — userId, type, payload, readAt
- `Webhook` — url, events[], secret
- `Integration` — provider, config, oauthTokensEncrypted
- `BillingSubscription` — workspaceId, stripeCustomerId, plan, seats, status, currentPeriodEnd

---

## 6. Page list

### Public / unauth
- `/` Marketing landing
- `/pricing`, `/security`, `/legal/*`
- `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`
- `/invitations/[token]`
- `/forms/[publicId]` (hosted form)
- `/portal/[workspaceSlug]/login` (client portal)

### App shell (auth required, scoped to workspace)
- `/app` Dashboard (analytics home)
- `/app/inbox` Notifications + assigned items

**CRM**
- `/app/crm/contacts`, `/app/crm/contacts/[id]`
- `/app/crm/companies`, `/app/crm/companies/[id]`
- `/app/crm/leads`, `/app/crm/leads/[id]`

**Sales**
- `/app/sales/pipelines/[pipelineId]` (kanban)
- `/app/sales/deals`, `/app/sales/deals/[id]`

**Billing**
- `/app/billing/invoices`, `/app/billing/invoices/[id]`, `/app/billing/invoices/new`
- `/app/billing/estimates`, `/app/billing/estimates/[id]`
- `/app/billing/customers`, `/app/billing/customers/[id]`
- `/app/billing/products`
- `/app/billing/payments`

**Projects**
- `/app/projects`, `/app/projects/[id]` (overview/tasks/files/time)
- `/app/projects/[id]/tasks/[taskId]`
- `/app/tasks` (cross-project my tasks)
- `/app/time` (timesheet)

**Helpdesk**
- `/app/helpdesk/tickets`, `/app/helpdesk/tickets/[id]`
- `/app/helpdesk/macros`

**Forms**
- `/app/forms`, `/app/forms/[id]/edit`, `/app/forms/[id]/submissions`

**Campaigns**
- `/app/campaigns`, `/app/campaigns/[id]`, `/app/campaigns/new`
- `/app/campaigns/audiences`, `/app/campaigns/templates`

**Reports**
- `/app/reports` (per module subpages)

**Settings**
- `/app/settings/workspace`
- `/app/settings/branding`
- `/app/settings/billing`
- `/app/settings/users`
- `/app/settings/teams`
- `/app/settings/roles`
- `/app/settings/custom-fields`
- `/app/settings/pipelines`
- `/app/settings/ticket-statuses`
- `/app/settings/sla`
- `/app/settings/taxes`
- `/app/settings/email-domains`
- `/app/settings/integrations`
- `/app/settings/api-keys`
- `/app/settings/webhooks`
- `/app/settings/audit-log`
- `/app/settings/profile` (per-user)
- `/app/settings/security` (per-user 2FA, sessions)

**Client portal** (separate shell)
- `/portal/.../home`
- `/portal/.../invoices`
- `/portal/.../tickets`
- `/portal/.../projects`

---

## 7. Navigation structure

**Top bar:** workspace switcher · global search (Cmd/Ctrl-K) · quick-create (+) · notifications · user menu.

**Left sidebar (collapsible, role-aware):**
```
Home (Dashboard)
Inbox
─────────────
CRM
  Contacts
  Companies
  Leads
Sales
  Pipeline
  Deals
Billing
  Invoices
  Estimates
  Customers
  Products
Projects
  All projects
  My tasks
  Time
Helpdesk
  Tickets
Forms
Campaigns
Reports
─────────────
Settings  (footer of sidebar)
```

Items are hidden if the user's role lacks any permission in that module. Quick-create supports: Contact, Company, Deal, Invoice, Project, Task, Ticket, Campaign.

---

## 8. API requirements

**Style:** REST + JSON, versioned at `/api/v1`. GraphQL is post-MVP. Internal app uses tRPC or typed REST client.

**Conventions**
- Resource URLs: `/api/v1/{resource}` with standard CRUD verbs.
- Pagination: cursor-based (`?cursor=...&limit=50`, max 100).
- Filtering: `?filter[field]=value`, `?q=` for full-text.
- Sorting: `?sort=-createdAt`.
- Sparse fields: `?fields=id,name`.
- Idempotency: `Idempotency-Key` header on POSTs that create money/email side effects.
- Rate limit: 600 req/min per API key, 60 req/min per IP unauth. Headers: `X-RateLimit-*`.
- Errors: RFC 7807 problem+json.
- Authentication: session cookie (web) **or** `Authorization: Bearer <api_key>`.
- Tenant scope: every request resolves a `workspaceId` from session/api-key — never accepted from the client.

**Resource endpoints (MVP, abbreviated)**
- Auth: `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/2fa/*`, `/auth/oauth/{provider}`
- Workspaces: `/workspaces`, `/workspaces/{id}`, `/workspaces/{id}/members`
- Users/teams/roles: `/users`, `/teams`, `/roles`, `/permissions`, `/invitations`
- CRM: `/contacts`, `/companies`, `/leads`, `/activities`, `/custom-fields`
- Sales: `/pipelines`, `/stages`, `/deals`
- Billing: `/customers`, `/products`, `/invoices`, `/invoices/{id}/send`, `/invoices/{id}/payments`, `/estimates`, `/recurring-invoices`, `/tax-rates`
- Projects: `/projects`, `/tasks`, `/time-entries`, `/comments`, `/attachments`
- Helpdesk: `/tickets`, `/tickets/{id}/messages`, `/sla-policies`, `/macros`
- Forms: `/forms`, `/forms/{id}/submissions`, `/public/forms/{publicId}/submit`
- Campaigns: `/audiences`, `/templates`, `/campaigns`, `/campaigns/{id}/send`, `/unsubscribe/{token}`
- Reports: `/reports/{module}/{report}`
- Platform: `/webhooks`, `/api-keys`, `/audit-logs`, `/notifications`
- Webhooks (outbound): events like `contact.created`, `deal.won`, `invoice.paid`, `ticket.created`, `form.submitted`, `campaign.sent`. Signed with HMAC-SHA256.

**Public endpoints**
- `POST /public/forms/{publicId}/submit`
- `POST /public/leads` (web-to-lead with API key)
- `POST /public/inbound-email/{address}` (email-to-ticket / activity)
- `POST /webhooks/stripe`

---

## 9. Security requirements

**Authentication**
- Argon2id password hashing; min length 12; HIBP breach check on signup.
- Email verification mandatory.
- TOTP 2FA; backup codes; admin can enforce per workspace.
- OAuth (Google, Microsoft) for SSO. SAML post-MVP.
- Sessions: HttpOnly + Secure + SameSite=Lax cookies; rotating session IDs; absolute timeout 30 days, idle timeout 14 days.

**Authorization**
- Role + permission matrix evaluated server-side on every request.
- Object-level checks (`ownerId` / team membership) — never trust client claims.
- Postgres Row-Level Security keyed on `workspaceId` as defense in depth.
- API keys scoped per workspace, with allow-listed scopes; hashed at rest.

**Data protection**
- TLS 1.2+ everywhere; HSTS preload; secure ciphers only.
- Encryption at rest for DB, file storage, backups (AES-256).
- OAuth tokens, API keys, webhook secrets encrypted with envelope encryption (KMS).
- PII minimization; soft delete + 30-day hard-delete job; export (GDPR Art. 20) and erasure (Art. 17) endpoints.
- File uploads: virus scanning, MIME sniffing, signed URLs, max 25 MB MVP.

**Application security (OWASP Top 10)**
- Input validation with Zod on every endpoint; output encoding.
- Parameterized queries via Prisma; no string SQL.
- CSRF tokens on cookie-auth state-changing requests.
- Strict CSP, X-Frame-Options DENY (except portal/forms with allow-list), Referrer-Policy strict-origin.
- Rate limiting + bot protection on auth and form endpoints.
- Audit log for all privileged actions; immutable append.
- Secrets in vault (not env files in production); rotated.
- Dependency scanning, SAST, secret scanning in CI.

**Infrastructure**
- Per-workspace logical isolation; per-workspace encryption keys post-MVP.
- Backups: daily full, 7-day PITR, monthly off-site; quarterly restore drill.
- DR target: RPO 24h, RTO 8h for MVP.
- Logging: structured, redacted PII, 90-day retention.

**Compliance posture (MVP)**
- GDPR-ready: DPA template, sub-processor list, data export/erasure.
- SOC 2 Type I path: policies, access reviews, change management documented.
- PCI: out of scope — Stripe handles cards (SAQ-A).

---

## 10. Subscription plans

All prices indicative; final pricing set at launch. Per user / month, billed annually (monthly +20%). Free trial 14 days, no card.

| Feature | **Starter** | **Growth** | **Scale** |
|---|---|---|---|
| Price (annual, per user/mo) | $0 (up to 3 users) | $19 | $39 |
| CRM contacts | 1,000 | 25,000 | Unlimited |
| Pipelines | 1 | 5 | Unlimited |
| Invoices/month | 25 | Unlimited | Unlimited |
| Recurring invoices | — | ✓ | ✓ |
| Projects | 3 active | Unlimited | Unlimited |
| Helpdesk tickets/month | 100 | 2,000 | Unlimited |
| Forms | 3 | 25 | Unlimited |
| Email campaign sends/mo | — | 5,000 | 50,000 |
| Custom fields | 5/entity | 25/entity | Unlimited |
| Roles & permissions | Defaults only | Defaults | Defaults + scoped |
| API access | Read-only | Full | Full + webhooks |
| Audit log retention | 30 days | 1 year | Forever |
| SSO (Google/MS) | ✓ | ✓ | ✓ |
| Enforced 2FA | — | ✓ | ✓ |
| Client portal | — | ✓ | ✓ |
| Support | Community | Email | Email + priority |

**Add-ons:** extra campaign volume, additional storage (>10/50 GB), sandbox workspace.
**Enterprise (post-MVP):** SAML, custom roles, audit export, DPA negotiation, dedicated CSM.

Billing handled in Stripe with seat-based proration; downgrades take effect at next period.

---

## 11. Permission model (MVP detail)

Permission tuple = `(resource, action, scope)`.

- **Resources:** contact, company, lead, deal, invoice, estimate, payment, project, task, time_entry, ticket, form, campaign, report, settings.*
- **Actions:** view, create, edit, delete, export, assign, send (where applicable).
- **Scopes:** `own` | `team` | `all`.

Each system role ships with a default matrix; Admin can clone a role and tweak in Scale plan. Unknown resources default to deny.

---

## 12. Non-functional requirements

- **Performance:** p95 API < 300 ms for list endpoints up to 50k records per workspace; dashboard first paint < 2 s on broadband.
- **Availability:** 99.9% monthly target.
- **Scale targets (MVP):** 2,000 workspaces, 20,000 active users, 5M CRM records, 1M invoices, 10M emails/month aggregate.
- **Browsers:** latest 2 versions of Chrome, Edge, Firefox, Safari. No IE.
- **Accessibility:** WCAG 2.1 AA for app shell and forms.
- **i18n:** English at launch; copy externalized for future locales; full timezone & currency awareness from day one.

---

## 13. Tech stack (reference)

Frontend: Next.js (App Router), TypeScript, Tailwind, shadcn/ui, Recharts, TanStack Table/Query.
Backend: Next.js Route Handlers (or NestJS service for heavy modules), Zod, Prisma.
DB: PostgreSQL 16 with RLS. Redis for cache, rate limiting, BullMQ queues.
Storage: S3-compatible. Email: Resend (transactional) + SendGrid (campaigns). Payments: Stripe. Auth: Auth.js + custom adapter. Observability: OpenTelemetry → Grafana/Loki/Tempo, Sentry. CI/CD: GitHub Actions, Docker, deploy to Vercel/Fly/AWS.

---

## 14. Development milestones

Sequenced for one full-stack team of ~5 engineers + 1 designer + 1 PM. Each milestone ends with deployable, paying-customer-ready scope.

### M0 — Foundation
- Repo, CI/CD, environments (dev/stage/prod), observability, error tracking.
- Multi-tenant data model, RLS, auth (email + Google/MS), 2FA.
- Workspace creation, invitations, base RBAC, audit log skeleton.
- App shell, navigation, settings/profile pages, billing skeleton (Stripe).
- **Exit criteria:** a user can sign up, create a workspace, invite teammates, and we can charge them.

### M1 — CRM + Forms
- Contacts, companies, leads, custom fields, activities, list views.
- CSV import/export, deduplication, web-to-lead.
- Forms builder + hosted page + embed + spam protection.
- **Exit:** lead capture → CRM works end-to-end.

### M2 — Sales pipeline + Analytics v1
- Pipelines, stages, deals, kanban, deal → invoice action stub.
- Workspace dashboard with the seven core widgets.
- **Exit:** sales team can run their week in OmniSuite.

### M3 — Invoicing & billing
- Customers, products, tax rates, invoices, estimates, recurring invoices.
- Stripe payment links, manual payments, PDF generation, branding.
- Invoice analytics (AR aging, revenue MTD/YTD).
- **Exit:** money in.

### M4 — Projects & tasks
- Projects, tasks (list/kanban/calendar), checklists, comments, attachments.
- Time entries → invoice line items.
- **Exit:** services firms can deliver work and bill it.

### M5 — Helpdesk
- Email-to-ticket pipeline, ticket views, threaded conversations, macros.
- SLA policies + first-response/resolution timers.
- Client portal (invoices + tickets + project status).
- **Exit:** support team can fully replace their existing tool.

### M6 — Email campaigns + cross-module polish
- Audiences from CRM filters, templates, scheduled sends, tracking, suppressions.
- Public API v1 + webhooks + API keys UI.
- Reports per module, exports.
- Hardening: load testing, security audit, accessibility pass, docs.
- **Exit:** GA launch.

### Post-MVP backlog (priority order)
1. Mobile (React Native) read-first, then write.
2. Two-way email/calendar sync.
3. Knowledge base + chat for helpdesk.
4. Quotes/proposals + e-signature.
5. Custom roles & granular permissions UI.
6. Automation builder (if-this-then-that across modules).
7. Marketplace + public app SDK.
8. SAML SSO, SCIM, audit export, EU data residency.
9. AI: summaries, reply suggestions, lead scoring, forecast.

---

## 15. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope blowout vs. incumbents | Strict module-per-milestone gate; ship narrow, deepen later |
| Email deliverability for campaigns | Separate sending pool; per-domain DKIM; suppression discipline; warmup |
| Multi-tenant data leak | RLS + repository-layer guard + automated tenancy tests in CI |
| Stripe edge cases (refunds, disputes) | Webhook-driven state machine; reconciliation job nightly |
| Performance on large workspaces | Cursor pagination, indexed `workspaceId` + owner, async exports |
| Permission complexity | Ship templates only in MVP; custom matrix gated to Scale plan |

---

## 16. Success metrics (first 6 months post-GA)

- Activation: 60% of signups invite ≥1 teammate within 7 days.
- Breadth: 40% of paying workspaces use ≥3 modules.
- Retention: 90% logo retention quarter-over-quarter on Growth+.
- Revenue: $30k MRR, NRR > 105%.
- Reliability: 99.9% uptime, p95 API < 300 ms, < 1% 5xx rate.
- Support: median first-response < 4 business hours.

---

*End of MVP PRD v1.0.*

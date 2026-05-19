# Implementation Tracker — Zoho Competitor

Goal: surpass Zoho. Move every domain from CRUD-only → real engines + integrations + public surfaces.

Legend: ⬜ not started · 🟨 in progress · ✅ done · ❌ blocked

---

## Corrected Baseline (audit v2)

The codebase uses **Next.js Server Actions** as primary RPC layer. CRUD coverage is far higher than initially reported.

| Layer | Coverage |
|---|---|
| Prisma models | ✅ ~90% — comprehensive schema |
| Zod schemas | ✅ 77+ tests |
| Server-action CRUD | ✅ ~85% — `actions.ts` files in nearly every module (100–500 LOC each) |
| UI pages (lists, forms, details) | ✅ ~70% — most modules wired |
| **Calculation engines** | ⚠️ ~30% — basic math, GL posting, formula, scoring, slots; **no SLA, tax, commission, payroll, reorder** |
| **Public/embed endpoints** | ❌ ~10% — only SCIM + experiments + notifications SSE |
| **Real-time** | ❌ polling only; no WebSocket/SSE pub-sub |
| **Integrations** | ❌ Stripe only; no IMAP/SMTP, S3, WebRTC, OAuth (Google/MS/Slack), SAML IdP, Social APIs |
| **Background jobs** | ❌ no queue/runner |

**Overall ~40% feature parity with Zoho.**

---

## Module-Level Snapshot

### Tier 1 — SaaS staples
| # | Module | % | What's there | Genuine gaps |
|---|---|---|---|---|
| 1 | inventory | 55 | Items, warehouses, stock movements, suppliers, POs, reorder points | Auto-PO on reorder; barcode/SKU import |
| 2 | accounting | 40 | Ledger, journals, bank txns, trial balance, P&L, BS | GL auto-post from invoice/expense; reconciliation matcher |
| 3 | expenses | 50 | CRUD, categories, draft→submit→approve | Multi-level routing; mileage; reimburse → GL |
| 4 | hr | 45 | Departments, employees, leave types/requests, attendance | Leave-balance accrual; org-chart UI; payroll engine |
| 5 | recruit | 50 | Jobs, candidates, applications, interviews, careers public site | Interview scheduling; offer letters; pipeline kanban |
| 6 | esign | 5 | Schemas only | **Full signing workflow + UI + audit + PDF render** |
| 7 | bookings | 55 | Types, availability, slot calc, public slug | **Public calendar UI; ICS export; TZ selector** |
| 8 | surveys | 50 | CRUD, questions, responses, publish | Logic jumps; analytics dashboard; share links |
| 9 | chat (SalesIQ) | 45 | Public visitor unauth chat, agent route | **Embeddable widget JS; visitor tracking; SSE** |
| 10 | bugs | 50 | Projects, issues, comments, status, tags | Linking/duplicates; custom fields; kanban |

### Tier 2 — collaboration
| # | Module | % | Gaps |
|---|---|---|---|
| 11 | mail | 30 | **IMAP/SMTP sync; outbound send; threading via Message-ID** |
| 12 | cliq | 10 | **UI + SSE realtime + reactions + mentions** |
| 13 | meetings | 5 | **WebRTC (Daily/LiveKit); join links; recording** |
| 14 | files | 40 | **S3 upload; signed URLs; versions; preview** |
| 15 | notes | 40 | Rich-text editor (WYSIWYG) |
| 16 | writer | 35 | **Collaborative CRDT/OT editor**; export PDF |
| 17 | sheet | 50 | Has basic formulas, charts | Pivot tables; data validation |
| 18 | slides | 5 | **Presentation editor + render + export** |
| 19 | connect | 40 | Notifications, search, moderation |
| 20 | vault | 70 | Encryption + access logs done | Secret rotation; SSH keys |

### Tier 3 — marketing & web
| # | Module | % | Gaps |
|---|---|---|---|
| 21 | marketing | 35 | **Email send engine + journey runner**; analytics |
| 22 | scoring | 60 | Engine works | Behavior tracking webhook |
| 23 | social | 10 | **OAuth; publishing API; scheduler job** |
| 24 | sites | 30 | **Drag-drop builder; static page render** |
| 25 | heatmaps | 30 | **Tracking pixel JS; viz overlay; session replay** |
| 26 | experiments | 50 | Assignment + tracking | Stats engine; UI dashboard |
| 27 | events | 10 | Registration flow; tickets; check-in |

### Tier 4 — BI & developer
| # | Module | % | Gaps |
|---|---|---|---|
| 28 | analytics | 5 | **Metrics catalog; query builder; embed** |
| 29 | pivots | 40 | Drill-down; CSV/Excel export |
| 30 | dashboards | 50 | Widgets work | Drill-through; share/embed |
| 31 | creator | 35 | Form/list runtime; relationships |
| 32 | flows | 40 | Models + canvas | **Execution engine + scheduler + retry** |
| 33 | dataprep | 30 | **Rule execution engine** |
| 34 | catalyst | 5 | **Sandboxed function runtime** |

### Tier 5 — IT & security
| # | Module | % | Gaps |
|---|---|---|---|
| 35 | itsm | 10 | **UI + SLA engine + change/problem flows** |
| 36 | assist | 5 | **WebRTC remote support; session record** |
| 37 | sso | 25 | SCIM v2 + SAML metadata done | **Full SAML IdP issuer; OIDC issuer; JIT prov** |
| 38 | two-factor | 30 | TOTP done | **WebAuthn/passkeys**; SMS/email codes |

---

## Top 12 highest-impact gaps (cross-cutting infra first)

| Rank | Gap | Module(s) | Why critical |
|---|---|---|---|
| 1 | **Background job queue** (BullMQ/pg-boss style) | platform | Unblocks email send, flows, scheduled posts, retries |
| 2 | **IMAP/SMTP email sync** | mail | Receiving, threading, email-to-ticket |
| 3 | **S3 file storage + upload handler** | files, mail-attach, esign, social | Real attachments, signed URLs, versions |
| 4 | **Realtime fanout (SSE channel hub)** | cliq, chat, notifications, helpdesk | Replaces 5s polling |
| 5 | **GL auto-posting engine** | accounting + invoices + expenses | Books-grade financial accuracy |
| 6 | **Public booking calendar UI** | bookings | Visitor-facing scheduling |
| 7 | **Chat widget JS embed** | chat (SalesIQ) | External-site live chat |
| 8 | **Calendar / Kanban view kit** | bookings, hr, projects, recruit, sales | Critical UX missing |
| 9 | **SLA calculator** | helpdesk + itsm | Response/resolve SLAs |
| 10 | **PDF generation** | billing, esign, quotes, reports | Customer deliverables |
| 11 | **WebAuthn / passkeys** | two-factor, auth | Modern security baseline |
| 12 | **Flows execution engine** | flows | Real iPaaS |

---

## Iteration Plan (3–4 items at a time)

### Iteration 1 — ✅ COMPLETE — *Foundations that unlock the rest*
Picks: **Job queue · Realtime SSE hub · S3 storage adapter · GL auto-posting**

| # | Item | Status |
|---|---|---|
| 1.1 | `src/platform/jobs/` — DB-backed queue (`Job` Prisma model, `enqueue/processOnce/runWorker`, retry+backoff, `uniqueKey` idempotency) | ✅ |
| 1.2 | `src/platform/realtime/` — in-memory SSE channel hub + `/api/realtime/[channel]/route.ts` (auth on `ws:*`, open `public:*`) | ✅ |
| 1.3 | `src/platform/storage/` — zero-dep SigV4 S3 adapter + `/api/files/upload-url` and `/api/files/[id]/download` routes | ✅ |
| 1.4 | `src/modules/accounting/posting.ts` — `postInvoiceToGL` / `postPaymentToGL` / `postExpenseToGL` (idempotent via reference); hooked into invoice status / payment / expense-approve actions; `seedDefaultChart()` | ✅ |
| 1.5 | Tests: `realtime-hub` (9), `storage-presign` (6), `jobs-queue` (3), `accounting-posting` (2) | ✅ |

**Result:** 81 test files, 1051 tests, all green. Zero TS errors.

### Iteration 2 — ✅ COMPLETE — *Public surfaces*
Picks: **Bookings public calendar ICS · Chat widget embed JS · IMAP/SMTP mail sync · Heatmap tracking pixel**

| # | Item | Status |
|---|---|---|
| 2.1 | `src/modules/bookings/ics.ts` (RFC 5545 generator) + `/api/bookings/[publicId]/ics` route + confirmed-page "Add to calendar" link | ✅ |
| 2.2 | `/api/chat/widget.js` zero-dep launcher script + `/chat/embed/[slug]/page.tsx` iframe surface (postMessage close protocol) | ✅ |
| 2.3 | `MailAccount` Prisma model + `src/platform/mail/{parser,smtp,imap,sync}.ts` (zero-dep RFC 5322 parser, SMTP client over net+tls, IMAP UID FETCH client). Registers `mail.imap.sync` + `mail.smtp.send` job handlers using AES-256-GCM credential encryption. `scheduleAllImapSyncs()` helper enqueues per active account. | ✅ |
| 2.4 | `/api/heatmap/pixel.js` tracker (sendBeacon + click/scroll capture) + `/api/heatmap/track` POST ingest with `trackerKey` validation, sample-rate gating, CORS preflight | ✅ |
| 2.5 | Tests: `bookings-ics` (5), `mail-parser` (9), `mail-smtp-imap` (11), `chat-widget` (3), `heatmap-tracker` (2) | ✅ |

**Result:** 86 test files, 1081 tests, all green. Zero TS errors.

### Iteration 3 — ✅ COMPLETE — *Productive UX kits*
Calendar view · Kanban view · Rich-text editor (zero-dep) · PDF generation (zero-dep)

### Iteration 4 — ✅ COMPLETE — *Workflow & approvals*
Flows execution engine · Multi-level approval routing · SLA calculator · Inventory auto-reorder PO

### Iteration 5 — ✅ COMPLETE — *Auth & identity*
WebAuthn/passkeys · SAML IdP issuer · OIDC issuer · JIT provisioning

### Iteration 6 — ✅ COMPLETE — *eSign + Surveys + Forms*
eSign signer flow + audit + PDF · Survey logic jumps + analytics · Form embed widget

### Iteration 7 — ✅ COMPLETE — *Realtime collab*
Cliq SSE chat · Notifications via hub · Mail outbound via job · Helpdesk live updates

### Iteration 8 — ✅ COMPLETE — *Marketing & social*
Email journey runner · Social OAuth + scheduler · Lead-scoring webhook · Marketing analytics

### Iteration 9 — ✅ COMPLETE — *BI*
Analytics metrics catalog · Dashboard share/embed · Pivot drill-down + export · DataPrep executor

### Iteration 10 — ⬜ Apps platform
Catalyst sandboxed runtime · Creator runtime · Flows webhook+cron triggers · Storefront polish

### Iteration 11 — ⬜ Files & docs
File preview + versions · Writer CRDT MVP · Sheet richer functions + pivots · Slides MVP

### Iteration 12 — ⬜ Sites & events
Sites drag-drop builder · Events registration · Connect notifications · Status page render

### Iteration 13 — ⬜ Remote & meetings
Meetings WebRTC · Assist remote support · ITSM full UI · Vault rotation

---

## Definition of Done

A module is **COMPLETE** when:
1. Prisma models + migration ✅
2. Zod schemas + tests ✅
3. Engine pure functions
4. Server actions OR API routes with auth + permissions + audit + rate-limit
5. UI: list + create + detail + relevant view (calendar/kanban/timeline)
6. Public/embed surface where applicable
7. Real-time updates where applicable
8. Integration with job queue for async work
9. Billing limit enforced
10. Engine unit tests + integration test

---

## Iteration Log

### Iteration 1 — ✅ done 2026-04-30
- 1.1 Job queue: ✅
- 1.2 Realtime SSE hub: ✅
- 1.3 S3 storage adapter: ✅
- 1.4 GL auto-posting (invoices + payments + expenses): ✅
- 1.5 Tests: ✅ (1051 total passing)

### Iteration 2 — ✅ done 2026-04-30
- 2.1 Bookings ICS: ✅
- 2.2 Chat widget embed: ✅
- 2.3 Mail IMAP/SMTP (zero-dep): ✅ — new `MailAccount` model, AES-GCM creds, registered job handlers
- 2.4 Heatmap pixel + ingest: ✅
- 2.5 Tests: ✅ (1081 total passing across 86 files)

### Iteration 3 — ✅ done 2026-05-01
- 3.1 Calendar view kit: ✅ — `src/platform/views/calendar.ts` pure month-grid + `CalendarView.tsx`
- 3.2 Kanban view kit: ✅ — `src/platform/views/kanban.ts` fractional ranks + WIP-limited `KanbanView.tsx` (HTML5 DnD)
- 3.3 Rich-text editor: ✅ — zero-dep contentEditable `RichTextEditor.tsx` + allowlist sanitiser/markdown helpers in `richtext.ts` (Tiptap dropped to stay zero-dep)
- 3.4 PDF generation: ✅ — zero-dep PDF 1.4 writer in `src/platform/pdf/index.ts` (xref/trailer, Helvetica, multi-page) + `renderInvoicePdf` template + `/api/invoices/[id]/pdf` download route
- 3.5 Tests: ✅ (+34 tests → 1115 total across 90 files; 0 TS errors)

### Iteration 4 — ✅ done 2026-05-09
- 4.1 Flows execution engine: ✅ — `src/modules/flows/engine.ts` pure step-resolver: START/TASK/CONDITION/APPROVAL/WEBHOOK_CALL/DELAY/END + safe boolean DSL (no eval) + `resumeApproval`
- 4.2 Multi-level approval routing: ✅ — `src/modules/approvals/routing.ts` parses `approverIds` levels (`alice;bob,carol#2;david`) + `progressOf`/`applyDecision`; backwards-compatible with single-level data
- 4.3 SLA calculator: ✅ — `src/modules/helpdesk/sla.ts` business-hours-aware `addBusinessMinutes`, holiday support, paused-time slack, default per-priority matrix
- 4.4 Inventory auto-reorder PO: ✅ — `src/modules/inventory/reorder.ts` (pure suggestions + supplier grouping) + `reorder-service.ts` creates draft POs from low-stock scan with audit + `inventory.reorder.scan` job kind
- 4.5 Tests: ✅ (+48 tests → 1163 total across 94 files; 0 TS errors)

### Iteration 5 — ✅ done 2026-05-09
- 5.1 WebAuthn/passkeys: ✅ — `src/modules/two-factor/webauthn.ts` zero-dep CBOR + COSE→SPKI + ES256/RS256 verifier; full registration + authentication round-trip
- 5.2 SAML IdP issuer: ✅ — `src/modules/sso/saml-idp.ts` IdP metadata + AuthnRequest parser + RSA-SHA256 enveloped-signature `<Response>`/`<Assertion>` builder + POST-binding form + self-verifier
- 5.3 OIDC issuer: ✅ — `src/modules/sso/oidc-issuer.ts` RS256 JWT sign/verify, JWKS, discovery doc, in-memory authorization-code store, RFC 7636 PKCE S256
- 5.4 JIT provisioning: ✅ — `src/modules/sso/jit.ts` pure attribute→user mapper with role/group mapping + domain allowlist + CREATE/UPDATE/NOOP plan
- 5.5 Tests: ✅ (+48 tests → 1211 total across 98 files; 0 TS errors)

### Iteration 6 — ✅ done 2026-05-09
- 6.1 eSign engine + audit chain: ✅ — `src/modules/esign/engine.ts` pure state machine (DRAFT→SENT→IN_PROGRESS→COMPLETED|DECLINED|CANCELLED), sequential signer ordering via `activeSigner`, tamper-evident SHA-256 audit chain (`chainEvents`/`verifyChain`), `buildAuditCertificate`
- 6.2 eSign certificate PDF: ✅ — `src/modules/esign/certificate-pdf.ts` renders Letter-size signature certificate using zero-dep `PdfDoc`; multi-page audit trail with hash column
- 6.3 Survey logic engine: ✅ — `src/modules/surveys/logic.ts` pure `nextQuestion` with skip rules (equals/includes/gte/lte → goto|END), `validateAnswer` per type, `aggregateSurvey` (choice counts, mean, rating histogram), `completionRate`
- 6.4 Form embed widget: ✅ — `src/modules/forms/embed.ts` `buildEmbedSnippet` + `buildLoaderJs` (origin-pinned postMessage resize) + `buildEmbedResizeJs` (ResizeObserver child)
- 6.5 Tests: ✅ (+41 tests → 1252 total across 102 files; 0 TS errors)

### Iteration 7 — ✅ done 2026-05-09
- 7.1 Cliq SSE chat: ✅ — `src/modules/cliq/realtime.ts` pure event builders + `cliqChannelKey` (`ws:<wsId>:cliq:<channelId>`) + `publishCliqMessage`/`publishCliqTyping` hub wrappers
- 7.2 Notifications via hub: ✅ — `src/modules/notifications/realtime.ts` per-user channel `ws:<wsId>:notifications:<userId>`, `publishNotification`/`publishUnreadCount`/`publishNotificationToUsers`
- 7.3 Mail outbound via job: ✅ — `src/modules/mail/outbound.ts` pure `buildOutboundDraft` (recipient parse + dedup + SENT folder) + `enqueueOutboundMail` orchestrator that creates MailThread+MailMessage and enqueues `mail.smtp.send` (idempotent uniqueKey)
- 7.4 Helpdesk live updates: ✅ — `src/modules/helpdesk/realtime.ts` `ticketChannelKey` + `helpdeskQueueKey`, `publishTicketUpdate` (fans out to ticket + queue), `publishTicketMessage`
- 7.5 Tests: ✅ (+25 tests → 1277 total across 106 files; 0 TS errors)

### Iteration 8 — ✅ done 2026-05-14
- 8.1 Email journey runner: ✅ — `src/modules/marketing/journey.ts` pure DAG engine (START/SEND_EMAIL/WAIT/BRANCH/EXIT) with `evaluateCondition` (hasTag/hasEvent/scoreGte), loop guard (history threshold 5), step-budget cap, and `enroll`/`advance` actions (`send`/`wait`/`exit`/`noop`)
- 8.2 Social OAuth + scheduler: ✅ — `src/modules/social/oauth.ts` zero-dep PKCE (RFC 7636 S256) + `buildAuthorizeUrl` + stateless `signState`/`verifyState` (timing-safe) + `parseCallback` + `buildTokenRequestBody`; `src/modules/social/scheduler.ts` `selectDuePosts` (per-platform length gate) + `planSchedule`
- 8.3 Lead-scoring webhook: ✅ — `src/modules/scoring/webhook.ts` HMAC-SHA256 `verifySignature` (timing-safe) + `parseWebhookPayload` (single + batch) + `resolvePoints` precedence (explicit > active rule > DEFAULT_POINTS)
- 8.4 Marketing analytics: ✅ — `src/modules/marketing/analytics.ts` `aggregateCampaign` (open/click/CTOR rates with delivered-fallback), `topClickedUrls`, `dailyCohort`, `workspaceRollup`
- 8.5 Tests: ✅ (+48 tests → 1325 total across 111 files; 0 TS errors)

### Iteration 9 — ✅ done 2026-05-14
- 9.1 Analytics metrics catalog: ✅ — `src/modules/analytics/metrics.ts` frozen registry of metric definitions (`deals.count`, `deals.revenue`, `invoices.collected`, `tickets.open`, `tasks.completed`, `expenses.total`, `mrr`, `campaigns.delivered`) with dimensions / grains / goalDirection; helpers `listMetrics`, `metricsForSource`, `isValidDimension`, `isValidGrain`, `deltaFor`
- 9.2 Dashboard share/embed: ✅ — `src/modules/dashboards/share.ts` HMAC-signed stateless tokens (`createShareToken`/`verifyShareToken` with TTL + scope + expected-id checks), `buildEmbedUrl`, sandboxed `buildEmbedIframe`
- 9.3 Pivot drill-down + export: ✅ — `src/modules/pivots/drilldown.ts` `resolveDrill` (row/col/cell coords → filter spec, handles flat pivots) + `pivotToCsv` (CSV with row/col/grand totals, RFC-4180 escaping)
- 9.4 DataPrep executor: ✅ — `src/modules/dataprep/executor.ts` pure rule engine (TRIM / LOWERCASE / UPPERCASE / REMOVE_DUPLICATES / FILL_MISSING / REPLACE / DROP_COLUMN / RENAME_COLUMN) + `profileRows` data-quality summary; `src/modules/dataprep/types.ts` shared rule type
- 9.5 Tests: ✅ (+38 tests → 1363 total across 115 files; 0 TS errors)

### Next — Iteration 10 (planned)
**Catalyst function runtime · Creator app generator · Flow connectors · Webhook signing** — apps platform.

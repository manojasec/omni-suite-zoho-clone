# Step-By-Step Prompts To Build A Complete Zoho Competitor

Build this as an original business SaaS suite inspired by the category, not as a Zoho clone. Avoid copying Zoho branding, UI, wording, proprietary workflows, or product names.

A real Zoho-style competitor is very large, so build it in phases: platform foundation first, then one module at a time.

## Recommended Stack

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: Next.js API routes or NestJS
- Database: PostgreSQL
- ORM: Prisma
- Authentication: Auth.js / NextAuth
- Payments: Stripe
- Cache and queues later: Redis, BullMQ
- File storage: S3-compatible storage
- Email: Resend, SendGrid, or SMTP
- Charts: Recharts
- UI: shadcn/ui or custom components

## Build Order

1. Platform foundation
2. Authentication and organizations
3. Permissions
4. Dashboard shell
5. CRM
6. Deals and sales pipeline
7. Invoices
8. Projects and tasks
9. Helpdesk
10. Forms
11. Email campaigns
12. Analytics
13. Global search
14. Notifications and audit logs
15. Subscription billing
16. Settings
17. Production polish
18. Testing
19. Final review

## Prompt 1: Product Definition

```text
Act as a senior SaaS product architect. I want to build an original all-in-one business software platform that competes with tools like Zoho, but does not copy Zoho branding, UI, wording, or proprietary workflows.

Create a complete product requirements document for an MVP business suite with these modules:

1. CRM
2. Sales pipeline
3. Invoicing and billing
4. Projects and tasks
5. Helpdesk/ticketing
6. Forms
7. Email campaigns
8. Analytics dashboard
9. Admin settings
10. User, team, role, and permission management

Include:
- Target customers
- Main user roles
- Core workflows
- MVP features
- Future features
- Database entities
- Page list
- Navigation structure
- API requirements
- Security requirements
- Subscription plans
- Development milestones

Keep the scope realistic for a first production-ready MVP.
```

## Prompt 2: Technical Architecture

```text
Act as a principal full-stack architect. Based on the product requirements, design the technical architecture for this SaaS platform.

Use:
- Next.js with TypeScript
- PostgreSQL
- Prisma
- Tailwind CSS
- Auth.js or NextAuth
- Stripe for subscriptions

Design for:
- Multi-tenancy
- Organizations/workspaces
- Role-based access control
- Audit logs
- File uploads
- Email notifications
- API security
- Scalable module architecture

Output:
- Folder structure
- Database architecture
- Auth flow
- Permission model
- API route structure
- Frontend route structure
- Background job strategy
- Deployment strategy
- Testing strategy
```

## Prompt 3: Create The Project

```text
Create a new production-ready Next.js TypeScript SaaS project for the business suite described above.

Set up:
- Next.js app router
- TypeScript
- Tailwind CSS
- ESLint
- Prisma
- PostgreSQL connection
- Auth.js / NextAuth foundation
- Basic layout structure
- Environment variable example file
- README with setup instructions

Create clean folders for:
- app routes
- components
- lib utilities
- database
- modules
- auth
- permissions
- billing
- email
- shared UI

Do not implement every module yet. First create a clean foundation that future modules can plug into.
```

## Prompt 4: Multi-Tenant Auth

```text
Implement authentication and multi-tenant organization support.

Requirements:
- Users can sign up and log in
- Users can create an organization/workspace
- Users can invite team members by email
- A user can belong to multiple organizations
- Each organization has members
- Each member has a role
- Roles: Owner, Admin, Manager, Member, Viewer
- Add middleware to protect authenticated routes
- Add organization switcher in the app shell
- Store active organization context
- Add Prisma models and migrations
- Add seed data for local development

Also create basic pages:
- Login
- Signup
- Onboarding
- Organization settings
- Team members
- Invite member
```

## Prompt 5: App Shell And Dashboard

```text
Build the main authenticated app shell.

Requirements:
- Sidebar navigation
- Top bar with organization switcher, search, notifications, and user menu
- Responsive layout
- Dashboard home page
- Empty states for modules not implemented yet
- Consistent design system
- Light and dark mode support
- Breadcrumbs
- Loading states
- Error states

Navigation should include:
- Dashboard
- CRM
- Deals
- Invoices
- Projects
- Helpdesk
- Forms
- Campaigns
- Analytics
- Settings

Use a polished but original SaaS design. Do not copy Zoho's UI.
```

## Prompt 6: Permission System

```text
Implement a reusable role-based permission system.

Requirements:
- Define permissions by module and action
- Example actions: view, create, update, delete, export, manage
- Roles should map to permissions
- Add server-side permission helpers
- Add client-side permission hooks
- Hide restricted UI actions
- Protect API routes
- Add tests for permission behavior

Modules:
- CRM
- Deals
- Invoices
- Projects
- Helpdesk
- Forms
- Campaigns
- Analytics
- Settings
```

## Prompt 7: CRM Module

```text
Implement the CRM module.

Features:
- Companies/accounts
- Contacts
- Leads
- Lead status
- Contact owner
- Notes
- Activity timeline
- Tags
- Search and filtering
- Import-ready data model
- Create/edit/delete flows
- Detail pages
- List pages
- Empty states
- Permission checks

Database models:
- Account
- Contact
- Lead
- Note
- Activity
- Tag

Build frontend pages, API routes/server actions, Prisma schema updates, validation, and basic tests.
```

## Prompt 8: Deals And Sales Pipeline

```text
Implement the sales pipeline module.

Features:
- Deals/opportunities
- Pipeline stages
- Kanban board
- Deal value
- Expected close date
- Probability
- Deal owner
- Related account/contact
- Activity history
- Drag-and-drop stage updates
- Lost reason
- Won/lost status
- Pipeline analytics

Pages:
- Deal list
- Deal board
- Deal detail
- Create/edit deal
- Pipeline settings

Make it integrate with the CRM contacts and accounts.
```

## Prompt 9: Invoicing And Billing

```text
Implement the invoicing module.

Features:
- Customers linked to CRM accounts
- Products/services
- Invoice creation
- Invoice line items
- Taxes
- Discounts
- Invoice status: draft, sent, paid, overdue, void
- PDF invoice generation
- Send invoice by email
- Payment tracking
- Basic revenue dashboard

Database models:
- Customer
- Product
- Invoice
- InvoiceItem
- Payment
- TaxRate

Include permission checks, validation, and polished invoice UI.
```

## Prompt 10: Projects And Tasks

```text
Implement the projects module.

Features:
- Projects
- Tasks
- Task statuses
- Assignees
- Due dates
- Priorities
- Comments
- Attachments
- Project members
- Kanban view
- List view
- Calendar-friendly date fields
- Activity timeline

Pages:
- Project list
- Project detail
- Task board
- Task detail drawer/modal
- My tasks

Integrate with organizations, users, permissions, and audit logging.
```

## Prompt 11: Helpdesk Module

```text
Implement the helpdesk/ticketing module.

Features:
- Tickets
- Ticket status: open, pending, resolved, closed
- Priority
- Assignee
- Customer/contact link
- Conversation thread
- Internal notes
- Tags
- SLA fields
- Ticket categories
- Search and filters

Pages:
- Ticket inbox
- Ticket detail
- Customer ticket history
- Helpdesk settings

Add email-ready architecture but keep actual inbound email integration as a later step.
```

## Prompt 12: Forms Module

```text
Implement a forms module.

Features:
- Form builder
- Field types: text, email, phone, textarea, select, checkbox, radio, date, number
- Required fields
- Public form sharing URL
- Form submissions
- Submission detail page
- Spam protection placeholder
- Ability to map form submissions into CRM leads

Pages:
- Forms list
- Form builder
- Form preview
- Public form page
- Submissions list
- Submission detail
```

## Prompt 13: Email Campaigns

```text
Implement a basic email campaigns module.

Features:
- Contact lists
- Segments
- Campaign drafts
- Email subject
- Email body editor
- Send test email
- Schedule/send campaign
- Campaign status
- Basic metrics: sent, opened placeholder, clicked placeholder
- Unsubscribe model

For now, implement the internal architecture and UI. Use a mock email provider or development email transport unless production email credentials are available.
```

## Prompt 14: Analytics

```text
Implement analytics dashboards across the platform.

Dashboards:
- Executive overview
- CRM analytics
- Sales pipeline analytics
- Invoice/revenue analytics
- Project analytics
- Helpdesk analytics
- Campaign analytics

Use charts and summary cards.

Metrics:
- Leads by status
- Deals by stage
- Revenue by month
- Open invoices
- Overdue invoices
- Open tickets
- Ticket resolution time
- Active projects
- Completed tasks
- Campaign sends

Make analytics organization-scoped and permission-protected.
```

## Prompt 15: Global Search

```text
Implement global search.

Requirements:
- Search across contacts, accounts, leads, deals, invoices, projects, tasks, and tickets
- Organization-scoped search
- Keyboard shortcut support
- Search modal
- Result grouping by module
- Permission-aware results
- Fast database queries with indexes
```

## Prompt 16: Notifications And Audit Logs

```text
Implement notifications and audit logs.

Notifications:
- Assigned task
- Assigned ticket
- Deal updated
- Invoice paid
- Team invite accepted

Audit logs:
- User actions
- Organization changes
- Permission changes
- Record creation/update/delete
- Billing changes

Create reusable helpers for writing audit events.
Add pages for notification center and audit log viewer.
```

## Prompt 17: Subscription Billing

```text
Implement SaaS subscription billing using Stripe.

Requirements:
- Pricing plans
- Free trial support
- Stripe checkout
- Stripe customer portal
- Webhook handling
- Subscription status sync
- Organization-level subscription
- Feature limits by plan
- Usage limits by plan

Plans:
- Free
- Starter
- Professional
- Enterprise

Restrict features based on subscription plan.
```

## Prompt 18: Settings

```text
Build complete settings pages.

Settings sections:
- Organization profile
- Team members
- Roles and permissions
- Billing and subscription
- Module preferences
- Email settings
- API keys placeholder
- Import/export placeholder
- Security settings
- Audit logs

Ensure all settings are permission-protected and organization-scoped.
```

## Prompt 19: Polish And Production Readiness

```text
Review the entire app for production readiness.

Improve:
- Loading states
- Empty states
- Error handling
- Form validation
- Accessibility
- Mobile responsiveness
- Database indexes
- API security
- Permission coverage
- Audit logging
- Navigation consistency
- README setup docs

Also add:
- Seed script
- Example environment file
- Basic automated tests
- Deployment guide
```

## Prompt 20: Testing

```text
Add a focused test suite.

Include:
- Unit tests for permissions
- Unit tests for validation schemas
- Integration tests for auth-protected server actions/API routes
- Tests for organization scoping
- Tests for CRM creation flows
- Tests for invoice calculations
- Tests for subscription feature limits

Use the testing tools already configured in the project. If none exist, recommend and configure an appropriate testing setup.
```

## Prompt 21: Final Review

```text
Perform a full code review of the SaaS platform.

Focus on:
- Security bugs
- Multi-tenant data leaks
- Missing permission checks
- Broken workflows
- Bad database relationships
- Missing indexes
- Payment webhook risks
- Form validation gaps
- Accessibility issues
- Production deployment blockers

Return findings ordered by severity. Then fix the critical and high-severity issues.
```

## Important Build Advice

Do not ask an AI to build a complete Zoho competitor in one prompt. Ask it to build a multi-tenant business suite platform, then add one module at a time. This gives you a real application instead of a huge unfinished scaffold.

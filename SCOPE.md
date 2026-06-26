# Temple App — Project Scope & Phases

## Overview

Temple management web app for Tamil Nadu villages. Admins manage temple festivals, track fixed family contributions, record payments, and send SMS reminders. Family members can log in and view their own payment status.

---

## Roles & Permissions

Roles are stored in the `Role` DB table (not hardcoded enums). Permissions are stored in the `Permission` table. Which permissions each role has is controlled via the `RolePermission` junction table — configurable without code changes.

| Role | Who | Access |
|------|-----|--------|
| super_admin | App owner(s) | All 28 permissions — manages temples, users, and everything. Multiple allowed; first created via seed, rest via Users page. |
| admin | Temple admin | 21 permissions — manages festivals, families, payments, SMS (no temple/user mgmt) |
| viewer | Family member | 5 permissions — reads own festival, family, and payment data |

JWT carries `roleName` + `permissions[]`. Middleware: `requireRole()` or `requirePermission('resource:action')`.

---

## Phase 1 — Foundation

> Goal: Project skeleton, DB schema, authentication working end to end.

### Backend
- [ ] Project setup (Express + TypeScript + Prisma)
- [ ] PostgreSQL via Docker
- [x] Prisma schema — all 14 models (Role, Permission, RolePermission, User, Temple, Festival, Family, Payment, FestivalAgenda, SmsLog, District, TempleGallery, RefreshToken, PaymentAuditLog)
- [x] bcrypt password hashing
- [x] JWT auth — HTTP-only cookies (access 15m + refresh 7d)
- [x] Auth routes:
  - `POST /auth/login` (username + password)
  - `POST /auth/refresh`
  - `POST /auth/logout`
- [x] RBAC middleware — `requireRole()` + `requirePermission('resource:action')`
- [ ] `GET /auth/me` — session persist on page refresh
- [ ] temple_id guard on all protected routes

### Frontend
- [ ] Project setup (React + Vite + TypeScript)
- [ ] Axios instance (base URL + credentials)
- [ ] TanStack Query setup
- [ ] React Router setup
- [ ] Login page
  - Phone + Password tab
  - Phone + OTP tab (with 60s resend timer)
- [ ] Protected route wrapper (redirect if not logged in)
- [ ] Role-based redirect after login

### Deliverable
Working login → role-based redirect → protected routes enforced.

---

## Phase 2 — Temple & Super Admin

> Goal: super_admin can manage temples and assign admins.

### Backend
- [ ] `GET /temples` — list all temples
- [ ] `POST /temples` — create temple
- [ ] `PUT /temples/:id` — edit temple
- [ ] `DELETE /temples/:id` — delete if empty
- [ ] `GET /users` — list admin users
- [ ] `POST /users` — create admin (bcrypt password + SMS credentials via MSG91)
- [ ] `PUT /users/:id` — edit admin
- [ ] `PUT /users/:id/deactivate` — deactivate admin

### Frontend
- [ ] Temples list page (`/temples`) — card grid, search, paginate
- [ ] Add/Edit Temple modal
- [ ] Temple Profile page (`/temple`) — cover photo placeholder, details, gallery placeholder
- [ ] Users page (`/users`) — table, search, filter by temple
- [ ] Add/Edit Admin modal

### Deliverable
super_admin can create temples and assign admins. Admin can log in.

---

## Phase 3 — Festivals

> Goal: Admin can create and manage festivals with day-wise agenda.

### Backend
- [ ] `GET /festivals` — list (filter by status)
- [ ] `POST /festivals` — create festival + auto-generate agenda rows
- [ ] `PUT /festivals/:id` — edit festival + update agenda
- [ ] `DELETE /festivals/:id` — delete if no payments
- [ ] `GET /festivals/:id` — detail + agenda

### Frontend
- [ ] Festivals list page (`/festivals`)
  - Active + past sections
  - Add/Edit modal with day-wise agenda (dynamic rows)
  - Delete with guard
- [ ] Festival Detail page (`/festivals/:id`)
  - Admin view: festival info + all families payment status
  - Viewer view: festival info + own payment only

### Deliverable
Admin can create festivals with agenda. Festival detail visible to all roles.

---

## Phase 4 — Families & Viewer Accounts

> Goal: Admin manages families. Family members get auto-created accounts.

### Backend
- [ ] `GET /families` — list families (admin: all, viewer: own only)
- [ ] `POST /families` — create family + auto create viewer account + SMS credentials if new phone
- [ ] `PUT /families/:id` — admin edits all fields
- [ ] `PUT /families/:id/children` — viewer edits children only
- [ ] `DELETE /families/:id` — delete if no payments
- [ ] Cloudinary integration for profile picture
- [ ] `PUT /families/:id/photo` — upload profile picture

### Frontend
- [ ] Families list page (`/families`)
  - Admin: card grid of all families, search, paginate
  - Viewer: only their own card
- [ ] Add/Edit Family modal (admin)
- [ ] Family Detail page (`/families/:id`)
  - Admin view: full profile + payment history across festivals
  - Viewer view: own profile + upload photo + add children + payment history
- [ ] Initials avatar fallback

### Deliverable
Admin can add families. Viewer account auto-created, SMS sent. Family member can log in and see their profile.

---

## Phase 5 — Payments

> Goal: Admin records payments. Pending amounts calculated correctly.

### Backend
- [ ] `POST /payments` — record cash payment (manual)
- [ ] `GET /payments?familyId=&festivalId=` — payment history
- [ ] Pending calculation: `(fixed amount × families) − SUM(regular payments)`
- [ ] Razorpay order creation — `POST /payments/order`
- [ ] Razorpay webhook — signature verification + auto-record payment
- [ ] `POST /payments/link` — send Razorpay payment link via SMS

### Frontend
- [ ] Record Payment modal (on Family Detail + Festival Detail pages)
  - Select festival, amount, mode (cash/upi/card/netbanking/wallet), type (regular/extra)
- [ ] Payment history table (family detail + festival detail)
- [ ] Pending amount display (festival summary card + family row)
- [ ] Razorpay payment link trigger button

### Deliverable
Admin can record cash payments. Razorpay handles online payments via webhook.

---

## Phase 6 — Dashboard

> Goal: Admin and viewer see live summary on login.

### Backend
- [ ] `GET /festivals?status=active` — active festivals with summary stats
- [ ] `GET /festivals?status=past&page=1` — past festivals paginated

### Frontend
- [ ] Dashboard page (`/dashboard`)
  - Admin: ongoing festival cards (total families, collected, pending) + history
  - Viewer: own payment status for active festivals + history
- [ ] Empty state if no active festival
- [ ] Quick nav cards (admin)
- [ ] Viewer navbar: My Festival | My Family

### Deliverable
Both admin and viewer land on a meaningful dashboard after login.

---

## Phase 7 — SMS Reminders

> Goal: Admin can send and schedule SMS via MSG91.

### Backend
- [ ] `POST /reminders/payment` — bulk payment reminder SMS
- [ ] `POST /reminders/greeting` — welcome greeting SMS
- [ ] `POST /reminders/agenda` — day-wise festival details SMS
- [ ] `POST /reminders/schedule` — schedule SMS (node-cron)
- [ ] `DELETE /reminders/schedule/:id` — cancel scheduled SMS
- [ ] `GET /reminders/history` — SMS send log

### Frontend
- [ ] SMS Reminders page (`/reminders`)
  - Tab 1: Payment Reminders — family list with pending, checkboxes, send selected/all
  - Tab 2: Welcome Greeting — preview + send now / schedule
  - Tab 3: Festival Day Details — day-wise preview + send / schedule
- [ ] SMS history log below each tab
- [ ] Scheduled SMS status (pending / sent)

### Deliverable
Admin can send all SMS types manually or on a schedule.

---

## Phase 8 — Reports

> Goal: Admin can download Excel and PDF reports.

### Backend
- [ ] `GET /reports/festival/:id` — festival report data
- [ ] `GET /reports/family/:id?from=&to=` — family report with date filter
- [ ] `GET /reports/festival/:id/excel` — ExcelJS stream download
- [ ] `GET /reports/family/:id/excel` — ExcelJS stream with date filter

### Frontend
- [ ] Reports page (`/reports`) — admin only
  - Tab 1: Festival Report — select festival, preview table, download Excel/PDF
  - Tab 2: Family Report — select family, date range, preview, download Excel/PDF
- [ ] react-pdf simple table layout

### Deliverable
Admin can download festival and family payment reports in Excel and PDF.

---

## Phase 9 — Temple Images & Polish

> Goal: Temple cover photo, gallery, profile pictures fully working. UI polished.

### Backend
- [ ] `POST /temple/cover` — upload cover photo (Cloudinary)
- [ ] `POST /temple/gallery` — upload gallery image (max 20, 5MB each)
- [ ] `DELETE /temple/gallery/:imageId` — delete gallery image
- [ ] Image size validation (5MB max)

### Frontend
- [ ] Temple Profile page — cover photo hero, gallery grid, upload/delete
- [ ] Profile picture upload (family member)
- [ ] Cloudinary upload widget integration
- [ ] UI polish: loading states, error states, empty states across all pages
- [ ] Mobile responsiveness

### Deliverable
Full UI complete, images working, app production-ready.

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TypeScript |
| State | TanStack Query v5 |
| HTTP | Axios |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma 5 |
| DB | PostgreSQL 16 |
| Auth | JWT + HTTP-only cookies + bcrypt |
| SMS | MSG91 (OTP + reminders) |
| Payments | Razorpay |
| Images | Cloudinary (free tier) |
| Excel | ExcelJS |
| PDF | react-pdf |
| Scheduler | node-cron |

---

## Testing Strategy

### Approach
- Build phase → manual verify → write tests → tests pass → next phase
- Never skip to next phase with failing tests

### Layers
| Type | Framework | What it covers |
|------|-----------|----------------|
| Backend unit | Jest | bcrypt, jwt, validators, pending calculation |
| Backend integration | Jest + Supertest | API routes against real test PostgreSQL DB |
| Frontend component | Vitest + RTL | UI behavior, role-based rendering, forms |
| E2E (optional) | Playwright | Full flows, Phase 10 only |

### Test DB
- Separate PostgreSQL DB (`temple_test`) in Docker
- Same schema as dev, wiped before each test run
- External services mocked: MSG91, Razorpay, Cloudinary

---

## Git & Version Control

### Platform
- **Git** — local version control (commits, branches, push)
- **GitHub** — remote code hosting, CI/CD via GitHub Actions, PR reviews, branch protection

### Branch Strategy
```
local → dev → uat → staging → prod
```

| Branch | Purpose | Deploy | Gate |
|--------|---------|--------|------|
| `dev` | Active development | Dev environment | CI must pass |
| `uat` | Real user testing | UAT environment | CI + 1 reviewer |
| `staging` | Final check before prod | Staging environment | CI + 1 reviewer |
| `prod` | Live app | Production | CI + manual approval |

### Commit Convention
```
feat:    new feature
fix:     bug fix
test:    adding/updating tests
chore:   config, deps, tooling
docs:    documentation changes
```

---

## CI/CD Pipeline

### Local — Husky Pre-push Hook
Runs automatically before every `git push`:
```
git push
  ↓
Husky fires
  ├── ESLint (lint check — FE + BE)
  ├── Prettier (format check — FE + BE)
  └── Tests (Jest + Vitest)
        ├── All pass → push goes through
        └── Any fail → push blocked
```

### Remote — GitHub Actions
```
.github/
  workflows/
    ci.yml          ← lint + test on every push/PR
    deploy-dev.yml  ← auto deploy on merge to dev
    deploy-uat.yml  ← auto deploy on merge to uat
    deploy-prod.yml ← manual approval required → deploy to prod
```

| Workflow | Trigger | Action |
|----------|---------|--------|
| `ci.yml` | Every push / PR | Lint, format, run all tests |
| `deploy-dev.yml` | Merge to `dev` | Auto deploy to dev environment |
| `deploy-uat.yml` | Merge to `uat` | Auto deploy to UAT environment |
| `deploy-prod.yml` | Merge to `prod` | Manual approval → deploy to production |

### Environments
| Environment | Branch | Auto Deploy |
|-------------|--------|-------------|
| Dev | `dev` | Yes |
| UAT | `uat` | Yes |
| Staging | `staging` | Yes |
| Production | `prod` | No — manual approval required |

---

## Deployment

| Layer | Platform | Plan |
|-------|---------|------|
| Frontend | Vercel | Free |
| Backend | Fly.io | Free (no spin down) |
| Database | Neon | Free (no pause) |
| Images | Cloudinary | Free (25GB) |

### Notes
- Render rejected — free tier spins down after 15 min (bad UX)
- Supabase rejected — pauses after 1 week inactivity
- Railway rejected — $5 credit runs out, not sustainable
- All free tiers sufficient for village temple app scale

---

## Security & Production Readiness

### Security
- Rate limiting on all auth routes + API routes (express-rate-limit)
- Helmet.js HTTP security headers on every response
- Account lockout after N failed login attempts
- CORS — whitelisted origins only
- JWT access token (short-lived) + refresh token (long-lived)
- Forgot password → OTP reset flow
- Change password for all logged-in users
- Admin can reset family member password

### API Design
- All routes: `/api/v1/` prefix
- Success: `{ success: true, data: {} }`
- Error: `{ success: false, message, errors? }`

### Logging & Monitoring
- Morgan — HTTP request logs
- Winston — app logs (errors, warnings, info)
- Sentry — production error tracking + alerts
- Uptime monitoring (UptimeRobot / Betterstack free tier)

### Reliability
- SMS retry — 3 attempts before marking failed
- Razorpay webhook — idempotency check (no duplicate payments)
- DB connection pooling configured for production

### Environment
- `.env` per environment (dev, uat, staging, prod)
- `.env.example` committed, real `.env` never committed
- Secrets via GitHub Actions secrets

### Data & Legal
- Daily automated DB backups on production
- Payment records kept permanently
- India DPDP Act — user consent for phone + payment data storage
- Privacy policy required before go-live

---

## SMS vs WhatsApp

| Feature | Channel | Why |
|---------|---------|-----|
| OTP login | SMS | Works on any phone, feature phones too |
| New account credentials | SMS | Reliable delivery |
| Payment reminders (bulk) | SMS | Cheap (₹0.15–0.25/msg) |
| Festival welcome greeting | WhatsApp | Rich, better engagement |
| Day-wise festival details | WhatsApp | Rich content |
| Payment confirmation | WhatsApp | Feels premium, instant |

## Super Admin Account

- Created via **manual DB insert** (one-time at initial deployment)
- Guided step by step when needed
- Never created through the app UI

## API Documentation

- Swagger (OpenAPI 3.0) at `/api/docs`
- Auto-generated from Express routes
- Libraries: `swagger-ui-express` + `swagger-jsdoc`

---

## Key Constants & Decisions

| Setting | Value |
|---------|-------|
| Phone format | `+919876543210` (always stored with +91) |
| Pagination | 15 items per page (all lists) |
| Image types | All types accepted |
| Image size limit | 5MB per image |
| Temple gallery max | 20 images |
| Account lockout | 5 failed attempts → 15 min lock |
| Access token expiry | 15 minutes |
| Refresh token expiry | 7 days (no rotation) |
| Children structure | `{ name: string, age: number }` |
| District list | Stored in DB, seeded (38 Tamil Nadu districts) |
| Languages | English + Tamil (react-i18next, switcher in navbar) |
| Cash payment | Admin can edit amount; logged in PaymentAuditLog |
| Online payment | Auto-populated from Razorpay, NOT editable |
| Payment receipt | PDF, downloadable by admin + family; sendable via WhatsApp |
| Bulk family import | Admin uploads Excel; row-level error report returned |
| Import template | Downloadable blank Excel format |

---

## Key Rules (apply across all phases)

- Every DB query filtered by `temple_id` — no cross-temple data leak
- Passwords hashed with bcrypt (salt rounds: 10) — never stored plain
- Zod validation on all incoming request bodies
- Viewer (family member) sees only their own data
- Delete allowed only when no dependent records exist
- Auto-create viewer account on family creation (SMS credentials if new phone)
- Cloudinary for all image storage (profile pics + temple gallery)

# Temple App — Implementation Plan

> Phases are executed in order. Each phase has a clear deliverable before moving to the next.
> **Cycle per phase:** Build → Manual verify → Write tests → Tests pass → Next phase

---

## Phase 0 — Project Scaffold

> Goal: Folder structure only. No logic. Just the skeleton.

### Frontend (`/frontend`)
```
frontend/
  src/
    api/            ← axios instance + API call functions
    assets/         ← images, icons
    components/     ← shared/reusable UI components
    hooks/          ← custom react hooks
    pages/
      auth/         ← login page
      dashboard/    ← dashboard page
      festivals/    ← festivals list + detail
      families/     ← families list + detail
      reports/      ← reports page
      reminders/    ← SMS reminders page
      temple/       ← temple profile page
      users/        ← users page (super_admin)
      temples/      ← temples list page (super_admin)
    routes/         ← route definitions + protected route wrapper
    types/          ← shared TypeScript types/interfaces
    utils/          ← helper functions
    App.tsx
    main.tsx
```

### Backend (`/backend`)
```
backend/
  src/
    controllers/    ← route handler functions
    middlewares/    ← auth, role check, temple_id guard
    routes/         ← express route definitions
    services/       ← business logic
    validators/     ← zod schemas per resource
    utils/          ← helpers (bcrypt, jwt, password gen)
    lib/            ← prisma client, cloudinary, msg91, razorpay init
    app.ts          ← express app setup
    server.ts       ← entry point
  prisma/
    schema.prisma
```

### Tasks
- [ ] Initialize frontend (Vite + React + TypeScript)
- [ ] Initialize backend (Node + Express + TypeScript)
- [ ] Create all folders above (empty with .gitkeep)
- [ ] Install all dependencies (frontend + backend)
- [ ] Setup docker-compose.yml for PostgreSQL (dev DB + test DB on separate ports)
- [ ] Initialize Prisma
- [ ] Setup Jest + Supertest (backend)
- [ ] Setup Vitest + React Testing Library (frontend)
- [ ] Setup ESLint + Prettier (frontend + backend)
- [ ] Setup Husky pre-push hook (lint + format + test)
- [ ] Initialize GitHub repository
- [ ] Create branches: `dev`, `uat`, `staging`, `production`
- [ ] Setup GitHub Actions workflows:
  - `ci.yml` — lint + format + test on every push
  - `deploy-dev.yml` — auto deploy on merge to dev
  - `deploy-uat.yml` — auto deploy on merge to uat
  - `deploy-prod.yml` — manual approval → deploy to prod
- [ ] Setup branch protection rules on GitHub:
  - `dev` → CI must pass
  - `uat` → CI pass + 1 reviewer
  - `staging` → CI pass + 1 reviewer
  - `production` → CI pass + manual approval
- [ ] Verify both dev servers start without errors

### Deliverable
Both frontend and backend boot. Folder structure in place. Test frameworks, linting, formatting, Husky hooks, and GitHub Actions all configured. No app logic yet.

---

## Phase 1 — Foundation (Auth + DB Schema)

> Goal: DB schema defined. Login working end to end for all roles.

### Database Schema (Prisma)
- [x] `Role` — id, name, description (DB table, not enum — dynamically configurable)
- [x] `Permission` — id, resource, action, description (e.g. resource=`festivals`, action=`create`)
- [x] `RolePermission` — roleId × permissionId junction (controls what each role can do)
- [x] `User` — id, username, password (bcrypt), roleId (FK → Role), temples (m-n via `_TempleToUser` — admins manage many, viewers one), familyId, failedAttempts, lockedUntil
- [x] `RefreshToken` — id, userId, tokenHash (bcrypt), expiresAt
- [x] `District` — id, name (38 Tamil Nadu districts, seeded)
- [x] `Temple` — id, name, deity, village, address, about, phone, phone2, phone3, contacts (JSON: `[{ name, phone }]`), districtId
- [x] `TempleGallery` — id, templeId, url, publicId
- [x] `Festival` — id, templeId, name, description, headName, headPhone, phone2, phone3, startDate, endDate, fixedAmount, isActive
- [x] `FestivalAgenda` — id, festivalId, order (Day number), date (optional), title, description — manual day-wise entries
- [x] `Family` — id, templeId, headName, primaryPhone, children (JSON), profilePicUrl
- [x] `Payment` — id, templeId, festivalId, familyId, amount, type, method, razorpayId
- [x] `PaymentAuditLog` — id, paymentId, editedById, oldAmount, newAmount
- [x] `SmsLog` — id, templeId, channel, recipient, message, status, scheduledAt, sentAt

### RBAC Design
Roles and permissions are stored in the DB, not hardcoded as enums. To change what a role can do, update the `RolePermission` table — no code deploy needed.

**Default permissions seeded:**

| Resource | super_admin | admin | viewer |
|----------|-------------|-------|--------|
| temples | create, read, update, delete | read | — |
| users | create, read, update, deactivate | — | — |
| festivals | create, read, update, delete | create, read, update, delete | read |
| families | create, read, update, delete, import | create, read, update, delete, import | read |
| payments | create, read, update | create, read, update | read |
| reports | read, download | read, download | — |
| reminders | send, schedule | send, schedule | — |
| dashboard | read | read | read |
| gallery | create, delete | create, delete | — |
| profile | update | update | update |

**JWT payload carries permissions at login time:**
```json
{ "userId": 1, "username": "superadmin", "roleId": 1, "roleName": "super_admin", "permissions": ["temples:create", "festivals:read", ...], "templeIds": [] }
```

**Middleware:**
- `requireRole('super_admin')` — checks `req.user.roleName`
- `requirePermission('festivals:create')` — checks `req.user.permissions.includes(...)`

**Seed script** (`prisma/seed.ts`) creates roles, permissions, 38 districts, and superadmin user. Run with `npm run db:seed`.

### Backend
- [x] Prisma schema + migrations (incremental via `prisma migrate dev`)
- [x] Auth middleware — verify access token (JWT), attach user + permissions to `req`
- [x] Role middleware — `requireRole(...roleNames)`
- [x] Permission middleware — `requirePermission(permission)` ← new, use this in Phase 2+
- [x] Account lockout — 5 failed attempts → 15 min lock
- [x] Rate limiting — 100 req/15min (global)
- [x] `POST /api/v1/auth/login` — username + password → JWT cookies (access 15m + refresh 7d)
- [x] `POST /api/v1/auth/refresh` — refresh token → new access token
- [x] `POST /api/v1/auth/logout` — clear both cookies
- [x] `GET /api/v1/auth/me` — return current user from JWT (session persist on page refresh)
- [ ] Temple guard middleware — attach temple_id from JWT to all scoped requests
- [ ] Zod validators for all auth routes *(login done; others pending)*
- [ ] `POST /api/v1/auth/otp/send` — MSG91 OTP *(Phase 7, needs MSG91 key)*
- [ ] `POST /api/v1/auth/otp/verify` — OTP → JWT cookies *(Phase 7)*
- [ ] `POST /api/v1/auth/forgot-password` *(Phase 7)*
- [ ] `POST /api/v1/auth/reset-password` *(Phase 7)*
- [ ] `PUT /api/v1/auth/change-password` *(Phase 7)*

### Frontend
- [x] Axios instance (base URL + withCredentials + 401 auto-refresh interceptor)
- [x] React Router setup
- [x] Auth context (`useAuth` — user state, login, logout)
- [x] Login page (username + password form, error states, loading state)
- [x] Protected route — redirect to `/login` if not authenticated
- [x] `GET /auth/me` call on app load (persist session on page refresh)
- [x] Role-based redirect after login (super_admin → `/temples`, admin/viewer → `/dashboard`)
- [x] Navbar shell (role-aware links, active state)
- [ ] TanStack Query provider setup
- [ ] react-i18next setup (English + Tamil) *(Phase 10)*
- [ ] Translation files: `en.json` + `ta.json`
- [ ] Login page
  - Tab 1: Phone + Password form
  - Tab 2: Phone + OTP form (send OTP, 60s resend timer, verify)
  - Inline error messages
  - Loading states on buttons
- [ ] `useAuth` hook — current user, login, logout
- [ ] Protected route wrapper — redirect to /login if not authenticated
- [ ] Role-based redirect after login:
  - super_admin → `/temples`
  - admin → `/dashboard`
  - viewer → `/dashboard`
- [ ] Navbar shell (empty links, just structure)

### Testing (after build)
**Backend (Jest + Supertest)**
- [x] Unit: bcrypt hash + compare + salt uniqueness
- [x] Unit: JWT sign + verify + expired + wrong secret
- [x] Unit: Zod loginSchema (valid + empty username + empty password + missing fields)
- [x] Integration: `POST /auth/login` — correct credentials → JWT cookies set
- [x] Integration: `POST /auth/login` — wrong password → 401
- [x] Integration: `POST /auth/login` — unknown user → 401
- [x] Integration: `POST /auth/login` — missing fields → 400
- [x] Integration: `POST /auth/refresh` — valid refresh token → new access token
- [x] Integration: `POST /auth/refresh` — no cookie → 401
- [x] Integration: `POST /auth/logout` — clears cookies
- [x] Integration: `POST /auth/login` — 5 failed attempts → account locked (423)
- [x] Integration: protected route without JWT → 401
- [x] Integration: wrong role on protected route → 403
- [ ] Integration: `POST /auth/otp/send` *(Phase 7)*
- [ ] Integration: `POST /auth/otp/verify` *(Phase 7)*
- [ ] Integration: `POST /auth/forgot-password` *(Phase 7)*
- [ ] Integration: `POST /auth/reset-password` *(Phase 7)*

**Frontend (Vitest + RTL)**
- [x] Login form: renders username + password fields
- [x] Login form: shows error message on failed login
- [x] Login form: calls login API with entered credentials
- [x] Protected route: renders children when authenticated
- [x] Protected route: redirects to /login when unauthenticated
- [x] Protected route: renders nothing while loading (prevents flash redirect)
- [ ] Role redirect: super_admin → /temples after login
- [ ] Login form: shows OTP input after Send OTP clicked *(Phase 7)*

### Deliverable
Login works for all roles. JWT issued. Role-based redirect. Protected routes enforced. All security middleware active. All tests passing.

---

## Phase 2 — Super Admin (Temples + Users)

> Goal: super_admin can create temples and assign admin accounts.

### Backend
- [x] `GET /temples` — list all temples (super_admin)
- [x] `POST /temples` — create temple (name, deity, village, address, about, phone, phone2, phone3, contacts, districtId)
- [x] `PUT /temples/:id` — edit temple
- [x] `DELETE /temples/:id` — delete if no festivals/families (409 if has dependencies)
- [x] `GET /users` — list all super_admin + admin users (super_admin only)
- [x] `POST /users` — create super_admin or admin (auto-generates password, logs to console; Phase 7 → MSG91 SMS)
- [x] `PUT /users/:id` — edit user
- [x] `PUT /users/:id/deactivate` — deactivate user
- [x] `GET /districts` — list all 38 districts (authenticated)
- [x] Zod validators for temple + user routes

### Temple Fields
- `name` — temple name (required)
- `deity` — presiding deity (optional)
- `village` — village / area (optional)
- `address` — full address (optional)
- `about` — description of the temple (optional, max 2000 chars)
- `phone` / `phone2` / `phone3` — up to 3 contact numbers (E.164 `+91XXXXXXXXXX`)
- `contacts` — JSON array `[{ name: string, phone?: string }]` — named contacts (trustee, head, etc.), unlimited

### Frontend
- [x] Temples list page (`/temples`)
  - Card grid (initial placeholder + name + deity + village + district + primary phone)
  - Search by name / village / district
  - [+ Add Temple] button → modal
  - [Details] [Edit] [Delete] per card
- [x] Add/Edit Temple modal
  - Fields: name*, deity, village/area, address, about (textarea)
  - Contact numbers: primary phone, phone 2, phone 3 (all with +91 prefix input)
  - Temple Contacts: dynamic list — [+ Add] creates a new Name + Phone row; ✕ removes
  - District selector (populated from `/districts`)
- [x] Temple Details modal (read-only)
  - About section, all 3 phones shown as pills, named contacts list
  - "Edit Temple" button transitions from detail to edit modal
- [x] Users page (`/users`)
  - Table: name | phone | role | temple | status | actions
  - Search + filter by role
  - [+ Add User] button → modal
  - [Edit] [Deactivate] per row
- [x] Add/Edit User modal
  - Role dropdown: super_admin | admin
  - Temple assignment — multi-select checklist (an admin can manage several temples), shown only when role = admin
  - Phone: +91 prefix + 10-digit input
- [x] Phone UX throughout: `+91` fixed prefix, 10-digit numeric input, display as `+91 XXXXX XXXXX`

### Testing (after build)
**Backend (Jest + Supertest)**
- [x] Integration: `POST /temples` — creates temple, returns correct fields
- [x] Integration: `GET /temples` — list with district + counts
- [x] Integration: `PUT /temples/:id` — updates fields
- [x] Integration: `DELETE /temples/:id` — blocked if festivals/families exist
- [x] Integration: `POST /users` with role=admin — creates admin, assigned to temple
- [x] Integration: `POST /users` with role=super_admin — creates super_admin, no temples
- [x] Integration: `POST /users` — admin with no temples → 400
- [x] Integration: `POST /users` — duplicate username → 409
- [x] Integration: `PUT /users/:id/deactivate` — user status updated
- [x] Integration: non-super_admin accessing `/temples` → 403

**Frontend (Vitest + RTL)**
- [x] Temple card renders name, deity, village
- [x] Add Temple modal — submit with missing required field → shows error
- [x] Add Admin modal — submit creates admin, modal closes

### Deliverable
super_admin can create temples (with contacts, about, multiple phones) and admin accounts. Temple detail modal shows all info. All tests passing.

---

## Phase 3 — Festivals

> Goal: Admin can create and manage festivals with day-wise agenda.

### Backend
- [x] `GET /festivals` — list all for the active temple (scoped by `X-Temple-Id`, validated against the admin's `templeIds`)
- [x] `POST /festivals` — create + persist the provided day-wise agenda (order = list position)
- [x] `PUT /festivals/:id` — edit + replace the agenda when a new list is provided
- [x] `DELETE /festivals/:id` — blocked if payments exist (409)
- [x] `GET /festivals/:id` — detail + agenda rows (ordered by `order`)
- [x] Zod validators: startDate/endDate datetime (payment window), endDate ≥ startDate refine, fixedAmount positive, agenda[] items
- [x] RBAC: `requirePermission('festivals:*')` per route; user with no temples (e.g. super_admin) → 403 via `resolveTemple`
- [ ] `GET /festivals/:id/payments` — all family payments for festival (Phase 5)
- [ ] `GET /festivals/:id/my-payments` — logged-in family's payments (Phase 5)

### Frontend
- [x] Festivals list page (`/festivals`) — card grid with Active/Upcoming/Past/Inactive badges
- [x] Add/Edit Festival modal:
  - Name*, description (textarea)
  - Festival Contacts — dynamic name + phone list (Day-1-style; one mandatory row, + Add)
  - Agenda* — dynamic day-wise list (Day 1 mandatory, + Add for more days)
  - Payment Start Date* + Payment Due Date* (date pickers, due ≥ start enforced) — the payment window families see
  - Fixed Amount per family (₹)
  - Active checkbox
- [x] Festival Details modal (read-only) — about, contacts, agenda list (Day N · title)
- [x] Delete confirmation — pre-blocked if payments > 0

### Testing (after build)
**Backend (Jest + Supertest)**
- [x] Integration: `POST /festivals` — creates festival + persists the provided agenda (order 1..n)
- [x] Integration: `GET /festivals` — lists temple's festivals
- [x] Integration: `GET /festivals/:id` — returns festival with agenda
- [x] Integration: `PUT /festivals/:id` — replaces the agenda when a new list is provided
- [x] Integration: `POST /festivals` — endDate before startDate → 400
- [x] Integration: `POST /festivals` — missing name → 400
- [x] Integration: `DELETE /festivals/:id` — deletes festival with no payments
- [x] Integration: super_admin (no temples) accessing `/festivals` → 403
- [x] Integration: multi-temple admin without `X-Temple-Id` → 400; wrong temple → 403; valid header scopes results

**Frontend (Vitest + RTL)**
- [ ] Festival card renders name, dates, amount
- [ ] Add Festival modal — submit with missing required field → shows error

### Deliverable
Admin can create and manage festivals with a manual day-wise agenda and a payment window. Festival details modal shows agenda. All tests passing.

---

## Phase 4 — Families & Viewer Accounts

> Goal: Admin manages families. Family members get auto-created accounts and can log in.

### Backend
- [x] `GET /families` — all families in active temple (admin) / own family only (viewer), scoped by `X-Temple-Id`
- [x] `POST /families` — create family + link existing account or auto-create viewer User (new phone); credentials stubbed to console (TODO Phase 7: MSG91 SMS)
- [x] `GET /families/:id` — detail (viewer restricted to own)
- [x] `PUT /families/:id` — admin edits headName/address/children (phone change deferred — would desync viewer login)
- [x] `DELETE /families/:id` — blocked if payments (409); also removes the linked viewer account (personal data)
- [x] Zod validators for family routes
- [ ] `PUT /families/:id/children` — viewer edits children only *(needs familyId in JWT — next increment)*
- [ ] `PUT /families/:id/photo` — upload to Cloudinary, update photoUrl *(needs Cloudinary keys)*
- [ ] `POST /families/import` — parse uploaded Excel, bulk create families, return row-level error report
- [ ] `GET /families/import/template` — stream blank Excel template download
- [ ] Cloudinary SDK integration

### Frontend
- [ ] Families list page (`/families`)
  - Admin: card grid (all families), search, paginate, [+ Add Family], [Import Excel], [Download Template]
  - Viewer: only own family card + [Upload Photo]
- [ ] Add/Edit Family modal (admin)
  - Head name, mother name, children[{name, age}], primary phone (+91), secondary phone
- [ ] Family Detail page (`/families/:id`)
  - Admin: full profile + [Edit] + payment history across festivals
  - Viewer: own profile + [Upload Photo] + [Edit Children] + payment history
- [ ] Excel import modal — upload file, show progress, show row-level error report
- [ ] Initials avatar (fallback when no photo)
- [ ] Cloudinary upload widget for profile photo

### Testing (after build)
**Backend (Jest + Supertest)**
- [x] Integration: `POST /families` — new phone → viewer user created + credentials returned
- [x] Integration: `POST /families` — existing phone → linked, no new user, no credentials
- [x] Integration: `POST /families` — duplicate phone in temple → 409
- [x] Integration: `GET /families` — admin lists temple families; viewer sees only own
- [x] Integration: `GET /families/:id` — viewer cannot read another family → 404
- [x] Integration: `DELETE /families/:id` — removes family + linked viewer account
- [ ] Integration: `DELETE /families/:id` — blocked if payments exist *(needs Phase 5 payments)*
- [ ] Integration: viewer `PUT /families/:id/children` — children updated correctly *(next increment)*
- [ ] Integration: cross-temple family access → 403

**Frontend (Vitest + RTL)**
- [ ] Family card renders initials avatar when no photo
- [ ] Admin sees all family cards, viewer sees only own
- [ ] Add Family modal — submit with missing primary phone → shows error

### Deliverable
Admin adds families. Viewer account auto-created, SMS sent. Family member logs in, sees own profile and payment history. All tests passing.

---

## Phase 5 — Payments

> Goal: Admin records cash payments. Razorpay handles online payments.

### Backend
- [ ] `POST /payments` — record manual cash payment
- [ ] `PUT /payments/:id` — admin edits cash payment amount only (logs to PaymentAuditLog)
- [ ] `GET /payments?familyId=&festivalId=` — payment history
- [ ] `GET /payments/:id/receipt` — generate PDF receipt
- [ ] `POST /payments/:id/receipt/whatsapp` — send receipt PDF to family WhatsApp via MSG91
- [ ] Pending calculation service: `(fixedAmount × totalFamilies) − SUM(regular payments)`
- [ ] `POST /payments/order` — create Razorpay order
- [ ] `POST /payments/webhook` — Razorpay webhook, verify signature, idempotency check, auto-record payment + send WhatsApp confirmation
- [ ] `POST /payments/link` — generate + send Razorpay payment link via MSG91 SMS
- [ ] Zod validators for payment routes

### Frontend
- [ ] Record Payment modal (accessible from Family Detail + Festival Detail)
  - Select festival, amount, mode (cash/upi/card/netbanking/wallet), type (regular/extra)
- [ ] Edit Payment modal (cash only) — admin edits amount, audit log entry created
- [ ] Payment history table (family detail + festival detail pages)
- [ ] Pending amount display on festival summary cards + family rows
- [ ] [Download Receipt] button — admin + family
- [ ] [Send Receipt via WhatsApp] button — admin + family
- [ ] [Send Payment Link] button → triggers Razorpay link via SMS

### Testing (after build)
**Backend (Jest + Supertest)**
- [ ] Unit: pending calculation — correct result for partial + full + zero payments
- [ ] Integration: `POST /payments` — cash payment recorded, pending updated
- [ ] Integration: `POST /payments/webhook` — valid Razorpay signature → payment recorded
- [ ] Integration: `POST /payments/webhook` — invalid signature → 400 rejected
- [ ] Integration: extra payment type does not affect pending calculation

**Frontend (Vitest + RTL)**
- [ ] Payment modal: all mode options render (cash/upi/card/netbanking/wallet)
- [ ] Pending amount updates after payment recorded

### Deliverable
Admin records cash payments. Razorpay webhook auto-records online payments (with idempotency). Pending amounts calculated correctly everywhere. All tests passing.

---

## Phase 6 — Dashboard

> Goal: Admin and viewer land on a meaningful dashboard after login.

### Backend
- [ ] `GET /dashboard` — active festivals with summary stats (total families, collected, pending)
- [ ] `GET /festivals?status=past&page=1` — past festivals paginated for history

### Frontend
- [ ] Dashboard page (`/dashboard`)
  - Admin view:
    - Ongoing festival cards (name, dates, total families, collected ₹, pending ₹)
    - Quick actions per card: [View Families] [Send Reminders] [Report]
    - Empty state if no active festival
    - Quick nav: Festivals | Families | Reports | SMS Reminders
    - Past festivals history table (paginated)
  - Viewer view:
    - Active festival(s) with own payment status (paid ₹ / pending ₹)
    - [View Details] per festival
    - Past festivals with own payment history
- [ ] Viewer navbar: My Festival | My Family | Logout
- [ ] Admin navbar: Dashboard | Festivals | Families | Reports | Reminders | Logout

### Testing (after build)
**Backend (Jest + Supertest)**
- [ ] Integration: `GET /dashboard` — returns only active festivals for that temple
- [ ] Integration: stats correct — collected + pending match payment records

**Frontend (Vitest + RTL)**
- [ ] Admin dashboard: shows festival card with correct stats
- [ ] Admin dashboard: shows empty state when no active festival
- [ ] Viewer dashboard: shows own payment status only
- [ ] Viewer navbar: only My Festival + My Family links visible

### Deliverable
Both admin and viewer see relevant data on dashboard. Navigation fully wired. All tests passing.

---

## Phase 7 — SMS Reminders

> Goal: Admin sends and schedules SMS via MSG91.

### Backend
- [ ] MSG91 SMS service (OTP, credentials, bulk payment reminders — retry up to 3 times on failure)
- [ ] MSG91 WhatsApp service (festival greetings, day-wise details, payment confirmations)
- [ ] Payment confirmation WhatsApp message on successful payment (cash + Razorpay)
- [ ] `POST /reminders/payment` — payment reminder SMS to pending families
- [ ] `POST /reminders/greeting` — welcome greeting SMS to all families
- [ ] `POST /reminders/agenda` — day-wise festival details SMS
- [ ] `POST /reminders/schedule` — schedule SMS via node-cron
- [ ] `DELETE /reminders/schedule/:id` — cancel scheduled SMS
- [ ] `GET /reminders/history` — SMS send log per temple
- [ ] SmsLog DB writes on every send

### Frontend
- [ ] SMS Reminders page (`/reminders`)
  - Tab 1: Payment Reminders
    - Select festival
    - Family list with pending amounts + checkboxes
    - [Send Selected] [Send All]
  - Tab 2: Welcome Greeting
    - Select festival
    - Message preview
    - [Send Now] [Schedule → N days before start]
  - Tab 3: Festival Day Details
    - Select festival
    - Day-wise agenda preview
    - [Send All Days Now] [Schedule → N days before start]
  - SMS history log below each tab (date | type | count | status)

### Testing (after build)
**Backend (Jest + Supertest)**
- [ ] Integration: `POST /reminders/payment` — only families with pending > 0 receive SMS (MSG91 mocked)
- [ ] Integration: `POST /reminders/schedule` — cron job created, SmsLog entry created
- [ ] Integration: `DELETE /reminders/schedule/:id` — cron cancelled
- [ ] Integration: SmsLog written correctly after every send

**Frontend (Vitest + RTL)**
- [ ] Payment reminders tab: only pending families shown in list
- [ ] Schedule input: appears when [Schedule] clicked

### Deliverable
Admin sends all SMS types. Scheduled SMS fires automatically via cron. All tests passing.

---

## Phase 8 — Reports

> Goal: Admin downloads Excel and PDF reports.

### Backend
- [ ] `GET /reports/festival/:id` — festival report data (all families + payments)
- [ ] `GET /reports/family/:id?from=&to=` — family payment history with date filter
- [ ] `GET /reports/festival/:id/excel` — ExcelJS stream download
- [ ] `GET /reports/family/:id/excel` — ExcelJS stream with date filter

### Frontend
- [ ] Reports page (`/reports`) — admin only
  - Tab 1: Festival Report
    - Select festival dropdown
    - Preview table: family | fixed amt | paid | pending | mode
    - [Download Excel] [Download PDF]
  - Tab 2: Family Report
    - Search + select family
    - From date → To date filter
    - Preview table: festival | fixed amt | paid | pending | date
    - [Download Excel] [Download PDF]
- [ ] react-pdf simple table layout for PDF generation

### Testing (after build)
**Backend (Jest + Supertest)**
- [ ] Integration: `GET /reports/festival/:id` — returns all families with correct payment totals
- [ ] Integration: `GET /reports/family/:id?from=&to=` — date filter returns correct range
- [ ] Integration: `GET /reports/festival/:id/excel` — response is valid Excel file (check content-type)

**Frontend (Vitest + RTL)**
- [ ] Festival report tab: shows preview table after festival selected
- [ ] Family report tab: date pickers appear and filter results

### Deliverable
Admin downloads festival and family reports in Excel and PDF. All tests passing.

---

## Phase 9 — Temple Profile & Images

> Goal: Temple cover photo, gallery, profile pictures fully working.

### Backend
- [ ] `GET /temple` — get temple profile (scoped to temple_id)
- [ ] `PUT /temple` — update temple details
- [ ] `POST /temple/cover` — upload cover photo to Cloudinary
- [ ] `POST /temple/gallery` — upload gallery image (max 20, 5MB each, validated)
- [ ] `DELETE /temple/gallery/:imageId` — delete gallery image from Cloudinary + DB
- [ ] File size validation middleware (5MB max)

### Frontend
- [ ] Temple Profile page (`/temple`)
  - Cover photo (full width hero) + [Change Cover] (admin/super_admin)
  - Temple name, deity, village, district, address, est. year, contact, description
  - [Edit Details] (admin/super_admin)
  - Gallery grid (up to 20 images)
  - [Upload Images] [Delete Image] (admin/super_admin)
  - Viewer sees read-only
- [ ] Cloudinary upload widget for cover + gallery
- [ ] Image size error handling (>5MB rejected with clear message)

### Testing (after build)
**Backend (Jest + Supertest)**
- [ ] Integration: `POST /temple/gallery` — blocked if already 20 images
- [ ] Integration: `POST /temple/gallery` — file > 5MB rejected with clear error
- [ ] Integration: `DELETE /temple/gallery/:imageId` — removed from DB + Cloudinary mocked

**Frontend (Vitest + RTL)**
- [ ] Gallery: upload button disabled when 20 images reached
- [ ] Image > 5MB: shows error message before upload

### Deliverable
Temple profile fully functional with cover + gallery images. All tests passing.

---

## Phase 10 — Polish & Production Readiness

> Goal: UI complete, edge cases handled, app ready for real use.

### Tasks
- [ ] Loading states on all data fetches
- [ ] Error states on all API failures
- [ ] Empty states on all list pages
- [ ] Mobile responsiveness (all pages)
- [ ] Form validations — inline errors everywhere
- [ ] Toast notifications (success/error on all actions)
- [ ] Confirm dialogs for all destructive actions (delete, deactivate)
- [ ] Session expiry handling — refresh token auto-renews, expired session → redirect to login
- [ ] `.env` files per environment (dev, uat, staging, production)
- [ ] `.env.example` committed (no real values)
- [ ] Production build test (frontend + backend)

### Testing (after build)
- [ ] Full E2E (Playwright — optional): login → create festival → add family → record payment → check dashboard stats correct
- [ ] All previous phase tests still passing (regression check)
- [ ] Manual test on mobile screen sizes

### Deliverable
App is stable, polished, and ready for real temple use. All tests passing.

---

## Phase 11 — Monitoring, Backup & Compliance

> Goal: Production observability, data safety, and legal compliance.

### Tasks

**Monitoring**
- [ ] Sentry integration — backend + frontend error tracking
- [ ] Winston log shipping — send logs to cloud (Logtail / Papertrail free tier)
- [ ] Uptime monitoring setup (UptimeRobot or Betterstack free tier)
- [ ] Alert setup — notify on production errors + downtime

**DB Backup**
- [ ] Automated daily backup on production DB (platform-level setting)
- [ ] Test restore procedure — verify backup can be restored

**Security Hardening**
- [ ] Verify Helmet.js headers in production (check via browser devtools)
- [ ] Verify rate limiting working in production
- [ ] Verify CORS rejects unauthorized origins
- [ ] Penetration test checklist — SQL injection, XSS, CSRF, auth bypass

**Legal & Compliance**
- [ ] Privacy policy page added to app
- [ ] User consent on signup — "I agree to storage of my phone + payment data"
- [ ] DPDP Act — data deletion flow tested (family delete removes all personal data)

**Performance**
- [ ] DB query performance check — slow queries identified and indexed
- [ ] Prisma connection pool configured for production
- [ ] Lighthouse score check on frontend (performance + accessibility)

### Testing (after build)
- [ ] Sentry receives test error correctly
- [ ] Uptime monitor pings and alerts work
- [ ] DB backup + restore tested

### Deliverable
App is fully observable, data is backed up, legal requirements met. Production-ready.

---

## Git & CI/CD Strategy

### Platform
- **Git** — local version control
- **GitHub** — remote hosting, CI/CD via GitHub Actions, branch protection

### Branch Flow
```
local → dev → uat → staging → production
```

| Branch | Deploy | Gate |
|--------|--------|------|
| `dev` | Dev environment (auto) | CI must pass |
| `uat` | UAT environment (auto) | CI + 1 reviewer |
| `staging` | Staging environment (auto) | CI + 1 reviewer |
| `production` | Production (manual approval) | CI + manual approval |

### Commit Convention
```
feat:    new feature
fix:     bug fix
test:    adding/updating tests
chore:   config, deps, tooling
docs:    documentation
```

### Local Pre-push (Husky)
```
git push → Husky fires → ESLint → Prettier → Tests → pass? push : block
```

### GitHub Actions Workflows
```
.github/workflows/
  ci.yml          ← lint + format + test on every push/PR
  deploy-dev.yml  ← auto deploy on merge to dev
  deploy-uat.yml  ← auto deploy on merge to uat
  deploy-prod.yml ← manual approval → deploy to prod
```

### Deployment Targets
| Layer | Platform | Plan |
|-------|---------|------|
| Frontend | Vercel | Free |
| Backend | Fly.io | Free (no spin down) |
| Database | Neon | Free (no pause) |
| Images | Cloudinary | Free (25GB) |

---

## Dependency Order

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9 → Phase 10 → Phase 11
```

Each phase depends on the previous. Do not skip ahead.

---

## Testing Strategy

### Frameworks
| Layer | Framework | Purpose |
|-------|-----------|---------|
| Backend unit | Jest | Pure logic (bcrypt, jwt, validators, calculations) |
| Backend integration | Jest + Supertest | API routes against real test DB |
| Frontend component | Vitest + RTL | UI behavior, role-based rendering, form validation |
| E2E (optional) | Playwright | Full flow, Phase 10 only |

### Test DB
- Separate PostgreSQL DB in Docker (`temple_test`)
- Same Prisma schema as dev DB
- Wiped and reseeded before each test run
- External services mocked: MSG91, Razorpay, Cloudinary

### What is mocked
- MSG91 → never sends real SMS in tests
- Razorpay → never makes real payment calls
- Cloudinary → never uploads real images

### When to write tests
- **After** each phase is built and manually verified
- All tests must pass before moving to next phase

---

## Tech Stack Reference

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + TypeScript |
| State | TanStack Query v5 |
| HTTP | Axios |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma 5 |
| DB | PostgreSQL 16 (Docker) |
| Auth | JWT + HTTP-only cookies + bcrypt |
| SMS / OTP | MSG91 |
| Payments | Razorpay |
| Images | Cloudinary (free tier) |
| Excel | ExcelJS |
| PDF | react-pdf |
| Scheduler | node-cron |
| Backend testing | Jest + Supertest |
| Frontend testing | Vitest + React Testing Library |
| E2E testing | Playwright (Phase 10, optional) |
| Linting | ESLint |
| Formatting | Prettier |
| Git hooks | Husky (pre-push) |
| CI/CD | GitHub Actions |
| Frontend deploy | Vercel |
| Backend deploy | TBD (Railway / Render / AWS) |
| DB deploy | TBD (Supabase / RDS / Railway) |

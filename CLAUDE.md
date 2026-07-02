# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Temple management web app for Tamil Nadu villages. Admins manage temple festivals, track fixed family contributions, record payments, and send SMS/WhatsApp notifications. Family members (viewers) log in to see their own payment status. See `TECH_STACK.md` for full stack rationale and `APP_SPEC.md` for screen-by-screen spec.

## Deployment

| Layer | Platform | Notes |
|-------|---------|-------|
| Frontend | Vercel | Auto deploy from GitHub |
| Backend | Fly.io | No spin down on free tier |
| Database | Neon | PostgreSQL, no pause on free tier |
| Images | Cloudinary | Profile pics + temple gallery, 5MB/image max |

## Environment Variables

### Backend (`/backend/.env`)
| Variable | Purpose |
|---------|---------|
| `PORT` | Express server port (default 4000) |
| `NODE_ENV` | `development` / `test` / `production` |
| `DATABASE_URL` | Dev PostgreSQL connection string |
| `TEST_DATABASE_URL` | Test PostgreSQL connection string (separate DB on port 5433) |
| `JWT_SECRET` | Access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `JWT_ACCESS_EXPIRY` | `15m` |
| `JWT_REFRESH_EXPIRY` | `7d` |
| `CORS_ORIGIN` | Allowed frontend origin (e.g. `http://localhost:5173`) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `MSG91_API_KEY` | MSG91 API key (SMS + WhatsApp) |
| `MSG91_SENDER_ID` | 6-char SMS sender ID |
| `MSG91_OTP_TEMPLATE_ID` | MSG91 OTP template ID |
| `MSG91_WHATSAPP_NUMBER` | WhatsApp business number |
| `RAZORPAY_KEY_ID` | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook verification secret |
| `SENTRY_DSN` | Sentry DSN (leave blank in dev) |

### Frontend (`/frontend/.env`)
| Variable | Purpose |
|---------|---------|
| `VITE_API_BASE_URL` | Backend API base URL |
| `VITE_RAZORPAY_KEY_ID` | Razorpay public key (safe to expose) |
| `VITE_SENTRY_DSN` | Frontend Sentry DSN (leave blank in dev) |

> Copy `.env.example` → `.env` in both `/backend` and `/frontend` to get started.

---

## Dev Commands

```bash
# Start local PostgreSQL (dev port 5432, test port 5433)
docker compose up -d

# Backend (from /backend)
npm run dev          # tsx watch mode on port 4000
npm run lint         # ESLint
npm run format       # Prettier
npm test             # all Jest tests (--runInBand, uses TEST_DATABASE_URL)
npm test -- --testPathPattern=auth          # single test file
npm test -- --testNamePattern="POST /auth/login"  # single test case

# Frontend (from /frontend)
npm run dev          # Vite dev server on port 5173
npm run lint         # ESLint
npm run format       # Prettier
npm test             # Vitest watch mode
npx vitest run LoginForm     # single component test (filename filter)
npx vitest run -t "renders"  # single test by name

# Prisma (from /backend)
npx prisma migrate dev              # apply schema changes + regenerate client
npx prisma migrate dev --name foo   # with explicit migration name
npx prisma studio                   # visual DB browser
npm run db:seed                     # seed roles, permissions, 38 districts, superadmin
```

### First-time setup
```bash
docker compose up -d
cd backend
cp .env.example .env          # fill in JWT_SECRET etc.
npm install
npx prisma migrate dev
npm run db:seed               # creates superadmin (username: superadmin, password: Admin@1234)

# Seed the test DB too — tests require roles to exist
DATABASE_URL="postgresql://temple:temple@localhost:5433/temple_test" npx prisma migrate deploy
DATABASE_URL="postgresql://temple:temple@localhost:5433/temple_test" npx tsx prisma/seed.ts
```

---

## Frontend Tooling Notes

- **Two config files intentionally**: `vite.config.ts` (build only, imports from `vite`) and `vitest.config.ts` (test only, imports from `vitest/config`). Merging them caused TypeScript type conflicts between Vite 6 and Vitest 3 — keep them separate.
- **ESLint v9 flat config**: `eslint.config.js` (not `.eslintrc`). Backend uses `eslint.config.mjs` (`.mjs` because `package.json` is CommonJS).
- **Prettier**: `.prettierrc` — single quotes, no semicolons, 100 char width.

---

## Architecture

### Multi-tenancy
Every resource (festival, family, payment) carries `templeId`. All DB queries **must** filter by `templeId` — never expose cross-temple data.

An admin can manage **multiple temples** (many-to-many `User.temples`). The JWT carries `templeIds: number[]` (all temples the user may act on). The client picks the **active temple** via a navbar switcher and sends it as the `X-Temple-Id` header on every request. The `resolveTemple` middleware validates the header is in `req.user.templeIds`, then sets `req.templeId` for handlers. When a user has exactly one temple it is auto-selected (header optional); with multiple temples the header is required (400 if missing, 403 if not a member).

### Auth Flow
Two JWT tokens per session, both HTTP-only cookies:
- `access_token` — 15 min, verified in-memory on every request (no DB hit)
- `refresh_token` — 7 days, bcrypt hash stored in `RefreshToken` table for revocation

```
Login  → bcrypt compare → build permissions[] from DB → sign JWT → set both cookies
Request → verify access_token signature in-memory → attach req.user
Expired → POST /api/v1/auth/refresh → bcrypt compare refresh hash → new access_token
Logout  → delete RefreshToken row → clear both cookies
```

The first `superadmin` is created by `npm run db:seed`. Additional super_admins are created through the Users page (`/users`) by an existing super_admin. Multiple super_admins are supported — super_admins have no `templeId`.

### Middleware Order (every request)
```
Helmet → CORS → Morgan → Rate Limiter → Cookie Parser
→ JWT verify → Role/Permission check → Temple ID guard → Zod validate → Handler
```

### RBAC
Roles and permissions are stored in the DB (`Role`, `Permission`, `RolePermission` tables) — not hardcoded enums. The JWT payload carries `roleName` and `permissions[]` so no DB hit is needed per request.

```typescript
requireRole('super_admin')              // checks req.user.roleName
requirePermission('festivals:create')   // checks req.user.permissions[] — preferred
```

JWT payload shape:
```typescript
{ userId, username, roleId, roleName, permissions: string[], templeIds: number[] }
```

To grant/revoke a permission: update `RolePermission` in the DB. The next login/refresh picks up the change automatically.

Default seeded permissions: `super_admin` → 28, `admin` → 21, `viewer` → 5.

### Frontend Auth Pattern
- `src/context/AuthContext.tsx` — holds `user` state, `setUser`, `logout`. Wrap app with `<AuthProvider>`.
- `src/components/ProtectedRoute.tsx` — redirects to `/login` if `user` is null.
- `src/api/axios.ts` — axios instance with `withCredentials: true` + 401 interceptor that calls `/auth/refresh` once before redirecting to `/login`.
- `src/api/auth.ts` — typed `login()` and `logout()` functions.

### Tamil / Unicode Text Support
All text fields (temple name, family name, address, etc.) fully support Tamil and other Unicode scripts end-to-end:
- **PostgreSQL**: UTF-8 encoding confirmed (`server_encoding = UTF8`). `length()` counts characters (not bytes), so Zod `.max(100)` allows 100 Tamil characters correctly.
- **Node/Express**: `express.json()` parses UTF-8 JSON bodies natively. No special config needed.
- **Prisma**: passes `String` values as-is; no transcoding.
- **React**: input fields accept Tamil via OS/IME keyboard on any device.
- **Phone numbers**: stored in E.164 format (`+91XXXXXXXXXX`). UI shows `+91` prefix with a 10-digit input; displayed as `+91 XXXXX XXXXX`. Utility in `src/utils/phone.ts` handles format/parse.

### Core Data Model (non-obvious relationships)
- `User.roleId` → FK to `Role` table (not an enum — dynamically configurable)
- `User.familyId` — only set for `viewer` role, links the user account to their family record
- `User.temples` — many-to-many (`_TempleToUser` join table). An `admin` can be linked to multiple temples; a `viewer` has exactly one; `super_admin` has none. Requests choose the active temple via the `X-Temple-Id` header (see Multi-tenancy)
- `User.failedAttempts` + `User.lockedUntil` — account lockout (5 attempts → 15 min lock)
- `Family.children` — stored as JSON array `[{ name: string, age: number }]`
- `Family.primaryPhone` — stored with country code: `+919876543210`
- `FestivalAgenda` — manual day-wise entries (`order` = Day number, `title` = the day's plan). Entered by the admin (Day 1 mandatory, "+ Add" for more), not derived from dates. Consolidated for WhatsApp and shown on the viewer's festival page. Festival `startDate`/`endDate` are the **payment window** (collection start → due date), independent of the agenda
- `Payment.type` — `regular` affects pending calculation; `extra` does not
- `Payment` (online) — auto-populated from Razorpay webhook, NOT editable
- `Payment` (cash) — admin can edit amount; all edits logged in `PaymentAuditLog`
- `District` — 38 Tamil Nadu districts, seeded once via `npm run db:seed`
- Pending = `festival.fixedAmount − SUM(payments where type='regular' and familyId=X and festivalId=Y)`
- `RefreshToken.tokenHash` — bcrypt hash of the raw token (never stored plain); no rotation on use

### API Design
- All routes: `/api/v1/`
- Success: `{ success: true, data: {} }`
- Error: `{ success: false, message: string, errors?: [] }`

### SMS vs WhatsApp (both via MSG91)
| Use case | Channel |
|---------|---------|
| OTP, credentials, payment reminders | SMS |
| Festival greetings, day-wise agenda, payment confirmation | WhatsApp |

### Family Account Creation (non-obvious flow)
When admin creates a family:
1. Check if `User` with `primaryPhone` already exists
2. If yes → link `user.familyId` to new family (no SMS)
3. If no → auto-create `viewer` User, generate password, bcrypt hash it, SMS credentials via MSG91

### Payments
- Cash → admin records via `POST /api/v1/payments`
- Online → `POST /api/v1/payments/order` creates Razorpay order → family pays → webhook `POST /api/v1/payments/webhook` → verify signature → idempotency check (`razorpayId` unique) → record payment
- Webhook must check `razorpayId` uniqueness before inserting to prevent duplicate records on retry

### Scheduled SMS
node-cron jobs stored in memory. On server restart, active schedules from `SmsLog` (status=`pending`) must be re-registered. Keep this in mind when modifying the reminders service.

### Exports & Imports
- Excel reports → ExcelJS, backend streamed download
- Bulk family import → admin uploads Excel → backend parses → creates families + accounts + SMS credentials; returns row-level error report
- PDF receipts → generated per payment, sendable to family WhatsApp via MSG91
- PDF reports → react-pdf, generated client-side

### i18n
- English + Tamil via `react-i18next`. Language switcher in navbar. Preference saved in localStorage.

### Key Constants
- Phone format: `+919876543210` (always stored with `+91`)
- Image limit: 5MB max, 20 images per temple gallery
- Account lockout: 5 failed attempts → 15 min lock
- Refresh token: 7 days, no rotation on use
- Access token: 15 min expiry
- Pagination default: 15 items per page

---

## Testing

```bash
# Backend — integration tests hit the real temple_test PostgreSQL DB
cd backend && npm test

# Frontend — component tests with Vitest + React Testing Library
cd frontend && npm test
```

- Test DB must be migrated and seeded before the first run (see First-time setup above)
- Each test file cleans up its own data in `beforeAll`/`afterAll` — the DB is **not** wiped between runs
- External services always mocked: MSG91, Razorpay, Cloudinary
- Tests are written after each phase is complete, before moving to the next phase

---

## Git

```
local → dev → uat → staging → production
```

Pre-push hook (Husky at repo root) blocks push if ESLint, Prettier, or backend tests fail.
Commit format: `feat:` `fix:` `test:` `chore:` `docs:`

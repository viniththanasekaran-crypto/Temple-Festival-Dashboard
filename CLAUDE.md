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
| `TEST_DATABASE_URL` | Test PostgreSQL connection string (separate DB) |
| `JWT_SECRET` | Access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `JWT_ACCESS_EXPIRY` | `15m` |
| `JWT_REFRESH_EXPIRY` | `7d` |
| `CORS_ORIGIN` | Allowed frontend origin |
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

> Copy `.env.example` → `.env` in both `/backend` and `/frontend` to get started. Never commit `.env` files.

---

## Dev Commands

```bash
# Start local PostgreSQL (dev + test DBs)
docker compose up -d

# Backend (from /backend)
npm run dev          # tsx watch mode
npm run lint         # ESLint
npm run format       # Prettier
npm test             # all Jest tests
npm test -- --testPathPattern=auth          # single test file
npm test -- --testNamePattern="POST /auth/login"  # single test case

# Frontend (from /frontend)
npm run dev          # Vite dev server
npm run lint         # ESLint
npm run format       # Prettier
npm test             # Vitest watch mode
npx vitest run LoginForm     # single component test (filename filter)
npx vitest run -t "renders"  # single test by name

# Prisma (from /backend)
npx prisma migrate dev      # apply migrations + regenerate client
npx prisma studio           # visual DB browser
npx prisma db seed          # seed initial data
```

## Frontend Tooling Notes

- **Two config files intentionally**: `vite.config.ts` (build only, imports from `vite`) and `vitest.config.ts` (test only, imports from `vitest/config`). Merging them caused TypeScript type conflicts between Vite 6 and Vitest 3's bundled Vite — keep them separate.
- **ESLint v9 flat config**: `eslint.config.js` (not `.eslintrc`). Adding new rules goes in that file.
- **Prettier config**: `.prettierrc` — single quotes, no semicolons, 100 char width.

---

## Architecture

### Multi-tenancy
Every resource (festival, family, payment) carries `temple_id`. All DB queries **must** filter by `temple_id` — never expose cross-temple data. The `temple_id` comes from the JWT payload, attached to `req` by the temple guard middleware before any route handler runs.

### Auth
Three roles: `super_admin`, `admin`, `viewer` (viewer = family member).

Two JWT tokens per session, both HTTP-only cookies:
- `access_token` — 15 min, verified in-memory on every request (no DB hit)
- `refresh_token` — 7 days, bcrypt hash stored in `RefreshToken` table for revocation

```
Login  → set both cookies
Request → verify access_token signature in-memory
Expired → POST /api/v1/auth/refresh → check hash in DB → new access_token
Logout  → delete RefreshToken row → clear both cookies
```

First `super_admin` is created via manual DB insert at initial deployment — never through the UI.

### Middleware Order (every request)
```
Helmet → CORS → Morgan → Rate Limiter → Cookie Parser
→ JWT verify → Role check → Temple ID guard → Zod validate → Handler
```

### Core Data Model (non-obvious relationships)
- `User.family_id` — only set for `viewer` role, links the user account to their family record
- `User.temple_id` — set for `admin` and `viewer`; `super_admin` has no temple_id
- `User.failed_attempts` + `User.locked_until` — account lockout (5 attempts → 15 min lock)
- `Family.children` — array of `{ name: string, age: number }`
- `Family.primaryPhone` — stored as `+919876543210` (with `+91` country code)
- `FestivalAgenda` — auto-generated rows (one per day) when a festival is created; date range drives count
- `Payment.type` — `regular` affects pending calculation; `extra` does not
- `Payment` (online) — auto-populated from Razorpay webhook, NOT editable
- `Payment` (cash) — admin can edit amount; all edits logged in `PaymentAuditLog`
- `PaymentAuditLog` — tracks every cash payment edit: who, what changed, when
- `District` — 38 Tamil Nadu districts stored in DB, seeded once
- Pending = `festival.fixedAmount − SUM(payments where type='regular' and familyId=X and festivalId=Y)`
- `RefreshToken.token_hash` — bcrypt hash of the token, not the raw token; same token kept for 7 days (no rotation)
- `SmsLog` — written after every MSG91 send (SMS or WhatsApp), tracks retry count + status

### API Design
- All routes: `/api/v1/`
- Success: `{ success: true, data: {} }`
- Error: `{ success: false, message: string, errors?: [] }`
- Swagger UI at `/api/docs`

### SMS vs WhatsApp (both via MSG91)
| Use case | Channel |
|---------|---------|
| OTP, credentials, payment reminders | SMS |
| Festival greetings, day-wise agenda, payment confirmation | WhatsApp |

### Family Account Creation (non-obvious flow)
When admin creates a family:
1. Check if `User` with `primaryPhone` already exists
2. If yes → link `user.family_id` to new family (no SMS)
3. If no → auto-create `viewer` User, generate password, bcrypt hash it, send SMS with credentials via MSG91

### Payments
- Cash → admin records manually via `POST /api/v1/payments`
- Online → `POST /api/v1/payments/order` creates Razorpay order → family pays → webhook hits `POST /api/v1/payments/webhook` → verify signature → idempotency check → record payment
- Webhook must check `razorpayId` uniqueness before inserting to prevent duplicate records on retry

### Scheduled SMS
node-cron jobs stored in memory. On server restart, active schedules from `SmsLog` (status=pending) must be re-registered. Keep this in mind when modifying the reminders service.

### Exports & Imports
- Excel reports → ExcelJS, backend streamed download
- Bulk family import → admin uploads Excel → backend parses → creates families + accounts + SMS credentials; returns row-level error report for failures
- Excel import template → downloadable blank format so admin knows exact column structure
- PDF payment receipt → generated per payment; downloadable by admin + family; can be sent to family WhatsApp via MSG91
- PDF reports → react-pdf, generated client-side

### i18n
- English + Tamil both supported via `react-i18next`
- Language switcher in navbar for all users
- Preference saved in localStorage

### Pagination
- Default: 15 items per page across all list pages

### Key Constants
- Phone format: `+919876543210` (always stored with `+91`)
- Image types: all types accepted, 5MB max per image
- Account lockout: 5 failed attempts → 15 min lock
- Refresh token: 7 days, no rotation on use
- Access token: 15 min expiry
- Gallery max: 20 images per temple

## Testing

```bash
# Backend — integration tests use temple_test PostgreSQL DB (separate Docker container)
cd backend && npm test

# Frontend — component tests with Vitest + React Testing Library
cd frontend && npm test
```

- External services always mocked: MSG91, Razorpay, Cloudinary
- Test DB (`temple_test`) is wiped before each test run
- Tests written after each phase is complete, before moving to next phase

## Git

```
local → dev → uat → staging → prod
```

Pre-push hook (Husky) blocks push if ESLint, Prettier, or tests fail.
Commit format: `feat:` `fix:` `test:` `chore:` `docs:`

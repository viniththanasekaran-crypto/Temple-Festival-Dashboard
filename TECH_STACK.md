# Temple Management App — Tech Stack

## Overview

A production web app to manage temple festivals, family contributions, and payments across Tamil Nadu villages.

---

## Project Structure

```
temple-app/
  frontend/    ← React app (Vite)
  backend/     ← Node.js + Express API
  docker-compose.yml
```

---

## Frontend

| Tool | Version | Purpose |
|------|---------|---------|
| React | 18+ | UI library |
| Vite | 5+ | Build tool and dev server |
| TypeScript | 5+ | Type safety |
| Tailwind CSS | 3+ | Utility-first styling |
| shadcn/ui | Latest | Pre-built accessible components |
| React Router | 6+ | Client-side routing |
| TanStack Query | 5+ | Server state management (API fetching, caching) |
| Axios | Latest | HTTP client for API calls |
| react-pdf | Latest | PDF export (reports + payment receipts) |
| react-i18next | Latest | English + Tamil i18n |

---

## Backend

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ LTS | JavaScript runtime |
| Express | 4+ | Web framework / API routes |
| TypeScript | 5+ | Type safety |
| Prisma | 5+ | ORM (database access, migrations) |
| JWT (jsonwebtoken) | Latest | Authentication tokens (access + refresh) |
| bcrypt | Latest | Password hashing |
| ExcelJS | Latest | Excel export |
| Razorpay SDK | Latest | Payment gateway integration |
| MSG91 SDK | Latest | SMS notifications + OTP |
| Zod | Latest | Request validation |
| cors | Latest | Cross-origin requests (whitelisted origins only) |
| dotenv | Latest | Environment variables |
| helmet | Latest | HTTP security headers (XSS, clickjacking protection) |
| express-rate-limit | Latest | Rate limiting on auth + API routes |
| morgan | Latest | HTTP request logging |
| winston | Latest | Application logging (errors, warnings, info) |
| @sentry/node | Latest | Error tracking + alerting in production |
| node-cron | Latest | Scheduled SMS jobs |

---

## Database

| Tool | Purpose |
|------|---------|
| PostgreSQL 16 | Primary database |
| Docker (local) | Run PostgreSQL locally without installing |
| Prisma Migrate | Schema migrations |

---

## Authentication & Security

- **JWT** — two tokens per session, both stored as HTTP-only cookies:
  - `access_token` — expires in 15 min, verified in-memory (no DB hit, stateless)
  - `refresh_token` — expires in 7 days, hash stored in `RefreshToken` DB table for revocation
- **Token flow:**
  ```
  Login → set access_token + refresh_token cookies
  Request → verify access_token signature (in-memory, no DB)
  Expired → POST /auth/refresh → check refresh_token in DB → new access_token
  Logout → delete RefreshToken row → clear both cookies
  ```
- **Scalability:** 1000 concurrent users = 1000 in-memory signature verifications. No DB hit per request. Only DB hit is on refresh (every 15 min) and logout.
- Passwords hashed with **bcrypt** (salt rounds: 10)
- **RBAC** — roles and permissions in DB (`Role`, `Permission`, `RolePermission` tables). JWT carries `permissions[]`. Use `requirePermission('resource:action')` on routes.
- **Helmet.js** — sets secure HTTP headers on every response
- **Rate limiting** — max login attempts per IP, block after threshold
- **Account lockout** — lock after 5 failed attempts (failed_attempts + locked_until on User table)
- **CORS** — whitelisted origins only (no wildcard in production)
- **Forgot password** — reset via OTP (MSG91) → set new password
- **Change password** — available to all logged-in users
- **Admin password reset** — admin can reset a family member's password

---

## Roles & Permissions

Roles are stored in the `Role` DB table (not hardcoded enums). The `Permission` table lists every grantable action (`resource:action` format). `RolePermission` maps which permissions each role holds — editable without code changes.

| Role | Permissions | Access |
|------|------------|--------|
| super_admin | 28 (all) | Full product — manages all temples and admin users |
| admin | 21 | Temple-scoped — festivals, families, payments, SMS, reports |
| viewer | 5 | Own data only — festival status, own family, own payment history |

To protect a route:
```typescript
requirePermission('festivals:create')  // preferred — fine-grained
requireRole('super_admin')             // fallback — role name check
```

---

## Payments

| Provider | Methods Supported |
|----------|------------------|
| Razorpay | UPI, Credit/Debit Card, Net Banking, Wallets |
| Manual (Cash) | Recorded by Admin with "cash" tag |

**Payment mode tags:** `cash` `upi` `card` `netbanking` `wallet`

**Payment type tags:** `regular` `extra`

---

## SMS & WhatsApp Notifications

| Channel | Provider | Purpose |
|---------|---------|---------|
| SMS | MSG91 | OTP, login credentials, bulk payment reminders |
| WhatsApp | MSG91 WhatsApp API | Festival greetings, payment confirmations |

### Why Both
- **SMS** — works on any phone including feature phones (village context), cheap (₹0.15–0.25/msg), reliable for OTP
- **WhatsApp** — rich messages, better engagement for greetings + confirmations, families see it instantly

### Cost
| Type | Cost |
|------|------|
| SMS (OTP / credentials / reminders) | ₹0.15–0.25 per message |
| WhatsApp (greetings / confirmations) | ₹0.58–0.78 per conversation |

### Usage by Feature
| Feature | Channel |
|---------|---------|
| OTP login | SMS |
| New account credentials | SMS |
| Payment reminders | SMS (bulk, cheap) |
| Festival welcome greeting | WhatsApp |
| Day-wise festival details | WhatsApp |
| Payment confirmation | WhatsApp |

---

## Export & Import

| Feature | Library | Notes |
|---------|---------|-------|
| Excel reports | ExcelJS | Backend, streamed download |
| Excel import template | ExcelJS | Blank template for bulk family upload |
| Bulk family import | ExcelJS (parse) | Admin uploads → creates families + accounts + SMS; row-level error report |
| PDF payment receipt | react-pdf | Per payment, downloadable by admin + family |
| PDF receipt via WhatsApp | MSG91 WhatsApp API | Admin or family sends receipt to family's WhatsApp |
| PDF reports | react-pdf | Festival + family reports, client-side |

## Internationalisation (i18n)

| Tool | Purpose |
|------|---------|
| react-i18next | English + Tamil language support |

- Language switcher in navbar for all users
- Preference saved in localStorage
- Both languages supported from day 1

---

## Testing

### Strategy
- Tests written **after** each phase is built and manually verified
- All tests must pass before moving to next phase
- External services (MSG91, Razorpay, Cloudinary) are always mocked in tests

### Frameworks

| Layer | Framework | Purpose |
|-------|-----------|---------|
| Backend unit | Jest | Pure logic — bcrypt, jwt, validators, pending calculation |
| Backend integration | Jest + Supertest | API routes tested against real PostgreSQL test DB |
| Frontend component | Vitest + React Testing Library | UI behavior, role-based rendering, form validation |
| E2E (optional) | Playwright | Full user flows — Phase 10 only |

### Test Database
- Separate PostgreSQL DB (`temple_test`) running in Docker
- Same Prisma schema as dev DB
- Wiped and reseeded before each test run
- Never shares data with dev DB

### What is Mocked
| Service | Why mocked |
|---------|-----------|
| MSG91 | Don't send real SMS during tests |
| Razorpay | Don't make real payment calls |
| Cloudinary | Don't upload real images |

### Run Tests
```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test
```

---

## Git & CI/CD

### Version Control
| Tool | Purpose |
|------|---------|
| Git | Local version control — commits, branches, push |
| GitHub | Remote hosting — code storage, PRs, branch protection, CI/CD |

### Branch Strategy
```
local → dev → uat → staging → prod
```

| Branch | Deploy | Gate |
|--------|--------|------|
| `dev` | Dev environment | Auto deploy, CI must pass |
| `uat` | UAT environment | Auto deploy, CI + 1 reviewer |
| `staging` | Staging environment | Auto deploy, CI + 1 reviewer |
| `prod` | Production | Manual approval required |

### Commit Convention
```
feat:    new feature
fix:     bug fix
test:    adding/updating tests
chore:   config, deps, tooling
docs:    documentation
```

### Local Pre-push Hook (Husky)
Runs automatically before every `git push`:
```
ESLint → Prettier → Tests → all pass? push : block
```

### GitHub Actions Workflows
```
.github/workflows/
  ci.yml          ← lint + format + test on every push/PR
  deploy-dev.yml  ← auto deploy on merge to dev
  deploy-uat.yml  ← auto deploy on merge to uat
  deploy-prod.yml ← manual approval → deploy to prod
```

### Code Quality Tools
| Tool | Purpose |
|------|---------|
| ESLint | Linting — catches code errors and bad patterns (FE + BE) |
| Prettier | Formatting — consistent code style (FE + BE) |
| Husky | Git hooks — runs lint + format + tests before every push |

---

## Deployment

| Layer | Platform | Plan | Notes |
|-------|---------|------|-------|
| Frontend | Vercel | Free | Best for React/Vite, fast CDN, unlimited |
| Backend | Fly.io | Free | 3 shared VMs, no spin down, always alive |
| Database | Neon | Free | 0.5GB PostgreSQL, never pauses |
| Images | Cloudinary | Free | 25GB storage + 25GB bandwidth, profile pics + temple gallery |

### Why These Choices
- **Vercel** — zero config for React/Vite, instant deploys, global CDN
- **Fly.io over Render** — Render free tier spins down after 15 min inactivity (30-60s wake time — bad UX). Fly.io stays alive
- **Neon over Supabase** — Neon never pauses on free tier. Supabase pauses after 1 week inactivity
- **Cloudinary** — already handles image upload, resize, optimization — no extra storage needed on server

### Upgrade Path (when app grows)
| Layer | Upgrade Cost |
|-------|-------------|
| Neon | ~$19/month |
| Fly.io | ~$5–10/month |
| Cloudinary | Pay-as-you-go after 25GB |
| Vercel | Free for most use cases |

---

## Local Development

| Tool | Purpose |
|------|---------|
| Docker + Docker Compose | Run PostgreSQL locally (dev DB + test DB) |
| Vite dev server | Frontend hot reload |
| ts-node / tsx | Run TypeScript backend locally |
| Prisma Studio | Visual DB browser (like pgAdmin) |

### Run locally

```bash
# Start database
docker compose up -d

# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

---

## Error Handling & Logging

| Tool | Purpose |
|------|---------|
| Morgan | HTTP request logging (every API call logged) |
| Winston | App logging — errors, warnings, info to files + cloud |
| Sentry | Production error tracking + alerts |
| Global error handler | Consistent error response: `{ success, message, errors }` |

---

## API Design

- **Versioning** — all routes prefixed with `/api/v1/`
- **Consistent error format** — `{ success: false, message: string, errors?: [] }`
- **Consistent success format** — `{ success: true, data: {} }`
- **API Documentation** — Swagger (OpenAPI 3.0) auto-generated, accessible at `/api/docs`
  - Libraries: `swagger-ui-express` + `swagger-jsdoc`
  - Interactive — test endpoints directly from browser
  - Documents all routes, params, request bodies, response formats

---

## Reliability

- **SMS retry** — retry failed MSG91 sends up to 3 times before marking failed
- **Razorpay webhook** — idempotency check to handle duplicate webhook events
- **DB connection pooling** — Prisma connection pool configured for production load

---

## Environment & Secrets

- `.env` file per environment: `.env.dev`, `.env.uat`, `.env.staging`, `.env.prod`
- `.env.example` committed to repo (no real values)
- `.env` files never committed to GitHub (`.gitignore`)
- Secrets managed via GitHub Actions secrets for CI/CD

---

## Monitoring & Observability

| Tool | Purpose |
|------|---------|
| Sentry | Error tracking + production alerts |
| Morgan + Winston | Request + app logs |
| Uptime monitor | UptimeRobot / Betterstack (free tier) |

---

## Super Admin Account

- First `super_admin` account is created via **manual DB insert** (one-time setup)
- Done during initial deployment — guided step by step at that point
- Never created through the app UI — no self-registration for super_admin

---

## Data & Backup

- **DB backups** — automated daily backups on production DB
- **Data retention** — payment records kept permanently (legal requirement)
- **Soft deletes** — deactivate instead of hard delete for users

---

## Legal & Compliance

- **India DPDP Act** — Digital Personal Data Protection Act compliance
  - User consent for storing phone numbers + payment data
  - Right to erasure — admin can delete family data if no payments exist
- **Privacy policy** — required before going live

---

## Geography

- **Scope:** Tamil Nadu only (Phase 1)
- **Districts:** 38 Tamil Nadu districts (from official govt data)
- **Language:** English UI (Tamil support considered for Phase 2)

# Temple App — Architecture Diagram

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                           TEMPLE APP — ARCHITECTURE                             ║
╚══════════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          USERS (Browser)                                        │
│                                                                                 │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                     │
│   │  super_admin │    │    admin     │    │    viewer    │                     │
│   │  /temples    │    │  /dashboard  │    │  /dashboard  │                     │
│   │  /users      │    │  /festivals  │    │  /my-family  │                     │
│   └──────┬───────┘    │  /families   │    └──────┬───────┘                     │
│          │            │  /payments   │           │                             │
│          │            │  /reminders  │           │                             │
│          │            │  /reports    │           │                             │
│          │            └──────┬───────┘           │                             │
│          └───────────────────┼───────────────────┘                             │
│                              │                                                  │
│         React + Vite + TypeScript                                               │
│         TanStack Query v5 (cache + refetch)                                     │
│         Axios (withCredentials + base URL)                                      │
│         Tailwind CSS + shadcn/ui                                                │
│         react-pdf (PDF generated client-side)                                   │
└──────────────────────────────┼──────────────────────────────────────────────────┘
                               │ HTTPS
                               │ HTTP-only cookies (JWT access + refresh)
                               ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Express + TypeScript)                           │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                        Middleware Stack                                   │  │
│  │  Helmet → CORS → Morgan → Rate Limiter → Cookie Parser → JWT Auth        │  │
│  │  → Role/Permission Check → Temple ID Guard → Zod Validator → Route Handler │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐   │
│  │  /api/v1  │ │/festivals │ │ /families │ │ /payments │ │  /reminders   │   │
│  │   /auth   │ │           │ │           │ │           │ │  /reports     │   │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └──────┬────────┘   │
│        │             │             │             │              │             │  │
│  ┌─────▼─────────────▼─────────────▼─────────────▼──────────────▼────────┐   │
│  │                         Services Layer                                  │   │
│  │  AuthService │ FestivalService │ FamilyService │ PaymentService │ ...   │   │
│  └─────────────────────────────────┬───────────────────────────────────────┘   │
│                                    │                                            │
│  ┌─────────────────────────────────▼───────────────────────────────────────┐   │
│  │                          Prisma ORM                                      │   │
│  │               ($transaction for multi-step writes)                       │   │
│  └─────────────────────────────────┬───────────────────────────────────────┘   │
│                                    │                                            │
│  ┌─────────────────────────────────▼───────────────────────────────────────┐   │
│  │                      PostgreSQL 16                                       │   │
│  │  User │ Temple │ Festival │ FestivalAgenda │ Family │ Payment │ SmsLog  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  Winston (logs) │ Global Error Handler │ node-cron (scheduled SMS)              │
└─────────────────────────────────────────────────────────────────────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │    MSG91     │ │  Razorpay    │ │  Cloudinary  │ │   Sentry     │
  │              │ │              │ │              │ │              │
  │ OTP delivery │ │ UPI / Card   │ │ Profile pics │ │ Error alerts │
  │ SMS reminders│ │ Netbanking   │ │ Temple gallery│ │ Production   │
  │ Credentials  │ │ Wallets      │ │ (free tier)  │ │ monitoring   │
  │ Scheduled SMS│ │ Webhook →    │ │ Max 5MB/img  │ │              │
  └──────────────┘ │ backend      │ └──────────────┘ └──────────────┘
                   └──────────────┘

╔══════════════════════════════════════════════════════════════════════════════════╗
║                            CI/CD PIPELINE                                       ║
╚══════════════════════════════════════════════════════════════════════════════════╝

  Developer
     │
     ├── git commit (feat: / fix: / test: / chore:)
     │
     ▼
  Husky Pre-push Hook
     ├── ESLint ──────────── fail → block push
     ├── Prettier ─────────── fail → block push
     └── Jest + Vitest ────── fail → block push
                                        │
                                    pass ▼
                               git push to GitHub
                                        │
                          ┌─────────────▼──────────────┐
                          │     GitHub Actions CI        │
                          │  Install deps               │
                          │  ESLint + Prettier          │
                          │  Spin up test PostgreSQL    │
                          │  Jest (backend integration) │
                          │  Vitest (frontend)          │
                          └─────────────────────────────┘
                                        │
              ┌─────────────────────────┼──────────────────────────┐
              ▼                         ▼                           ▼
         merge → dev              merge → uat                merge → prod
              │                         │                           │
         auto deploy              auto deploy               manual approval
              │                         │                           │
              ▼                         ▼                           ▼
       Dev Environment           UAT Environment           Production
       (Vercel + Fly.io          (Vercel + Fly.io          (Vercel + Fly.io
        + Neon)                   + Neon)                   + Neon + Cloudinary)

╔══════════════════════════════════════════════════════════════════════════════════╗
║                           SECURITY LAYERS                                       ║
╚══════════════════════════════════════════════════════════════════════════════════╝

  Request
    │
    ├── Helmet.js ──────────── Sets XSS, clickjacking, MIME headers
    ├── CORS ────────────────── Whitelisted origins only
    ├── Rate Limiter ────────── Auth: 5 req/min │ API: 100 req/min
    ├── JWT Verify ──────────── Access token from HTTP-only cookie
    ├── Account Lockout ─────── Block after 5 failed logins
    ├── Role/Permission Check ── requireRole() or requirePermission('resource:action')
    ├── Temple Guard ────────── Attach + enforce temple_id
    └── Zod Validation ──────── Reject invalid request bodies

╔══════════════════════════════════════════════════════════════════════════════════╗
║                        DATA FLOW — KEY SCENARIOS                                ║
╚══════════════════════════════════════════════════════════════════════════════════╝

  LOGIN (Username + Password)
  POST /auth/login → bcrypt compare → build permissions[] from Role → Permission DB tables
       → sign JWT with { userId, roleId, roleName, permissions[], templeIds[] }
       → store bcrypt(refresh_token) in RefreshToken DB table
       → set both as HTTP-only cookies → redirect based on roleName

  EVERY REQUEST (1000 users = no problem)
  Request arrives → verify access_token signature in-memory (no DB, pure math, ~1ms)
       → attach user to req → proceed

  TOKEN REFRESH (every 15 min silently)
  access_token expires → POST /auth/refresh
       → check refresh_token hash in DB → valid? issue new access_token
       → invalid/expired? → redirect to login

  LOGOUT
  POST /auth/logout → delete RefreshToken row from DB → clear both cookies

  ADD FAMILY
  Admin → POST /families → check phone exists?
       → No: create User + hash password + MSG91 SMS credentials
       → Yes: link existing user → save Family

  CASH PAYMENT
  Admin → POST /payments {mode:cash} → Prisma write → pending recalculated

  ONLINE PAYMENT
  Admin sends link → Razorpay → family pays → webhook → signature verified
  → idempotency check → Payment saved → pending updated

  SCHEDULED SMS
  Admin sets schedule → node-cron stores job → fires on date
  → MSG91 bulk send (retry x3 on fail) → SmsLog written
```

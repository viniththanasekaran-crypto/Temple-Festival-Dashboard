# Temple App — Screen Spec

> One page finalized at a time. Update this doc as each page is cleared.

---

## Status

| Page | Status |
|------|--------|
| 1. Login | ✅ Finalized |
| 2. Dashboard | ✅ Finalized |
| 3. Festivals | ✅ Finalized |
| 4. Festival Detail | ✅ Finalized |
| 5. Families | ✅ Finalized |
| 6. Families List | ✅ Finalized |
| 7. Family Detail | ✅ Finalized |
| 8. Reports | ✅ Finalized |
| 10. SMS Reminders | ✅ Finalized |
| 9. Temple Profile | ✅ Finalized |
| 11. Temples List (super_admin) | ✅ Finalized |
| 12. Users (super_admin) | ✅ Finalized |

---

## 1. Login Page

### Route
`/login`

### Description
Entry point for all users. Two login methods available via tabs.

### Components
```
LoginPage
  ├── TabSwitcher          (Password tab | OTP tab)
  ├── PhonePasswordForm
  │     ├── PhoneInput
  │     ├── PasswordInput
  │     └── SubmitButton
  └── PhoneOTPForm
        ├── PhoneInput
        ├── SendOTPButton
        ├── OTPInput       (shown after OTP sent)
        ├── ResendTimer    (60s countdown)
        └── VerifyButton
```

### UI / UX
- Tab 1: Phone + Password → [Phone] [Password] [Login]
- Tab 2: Phone + OTP → [Phone] [Send OTP] then [OTP input] [Verify]
- ResendOTP available after 60s timer expires
- Show inline error on wrong password / wrong OTP
- Show loading state on submit buttons

### Backend Endpoints
| Method | Route | Body | Response |
|--------|-------|------|----------|
| POST | `/auth/login` | `{ username, password }` | JWT HTTP-only cookies + user |
| POST | `/auth/refresh` | — (uses cookie) | new access_token cookie |
| POST | `/auth/logout` | — (uses cookie) | clears both cookies |
| GET | `/auth/me` | — (uses cookie) | current user (for page refresh) |
| POST | `/auth/otp/send` | `{ phone }` | `{ success: true }` *(Phase 7)* |
| POST | `/auth/otp/verify` | `{ phone, otp }` | JWT cookies *(Phase 7)* |

### Auth Flow
- JWT issued on success → stored as two HTTP-only cookies (`access_token` 15m, `refresh_token` 7d)
- JWT payload carries: `userId`, `roleId`, `roleName`, `permissions[]`, `templeId`
- After login → redirect based on role:
  - `super_admin` → `/temples`
  - `admin` → `/dashboard`
  - `viewer` → `/dashboard`

### RBAC
Roles and permissions stored in DB — not hardcoded enums. Three default roles seeded:
- `super_admin` — 28 permissions (full access)
- `admin` — 21 permissions (temple-scoped, no temple/user management)
- `viewer` — 5 permissions (own data only)

Route protection uses:
- `requireRole('super_admin')` — role name check
- `requirePermission('festivals:create')` — fine-grained permission check (preferred)

### OTP Details *(Phase 7 — requires MSG91 key)*
- MSG91 handles OTP generation, delivery, storage, expiry
- Backend calls MSG91 send API → MSG91 delivers SMS
- Backend calls MSG91 verify API → on success issues JWT
- No OTP stored in our DB

### Validation (Zod)
- Username: non-empty string
- Password: min 8 chars

### Password Storage
- Hashed with **bcrypt** (salt rounds: 10) before storing in DB
- Plain password never stored
- On login → bcrypt compares input against stored hash
- Applies to all accounts: super_admin, admin, and auto-created viewer accounts

### Roles that see this page
All (unauthenticated users only). Redirect to home if already logged in.

---

## 2. Dashboard

### Route
`/dashboard`

### Description
First screen after login for admin and viewer. Shows live summary of ongoing festival(s) for this temple. If multiple festivals are active simultaneously, each gets its own card. Past festivals accessible via history section.

### Layout
```
DashboardPage
  ├── Navbar                        (logo, nav links, user menu)
  ├── OngoingFestivalsSection
  │     ├── SectionHeader           ("Ongoing Festivals")
  │     ├── FestivalSummaryCard[]   (one per active festival)
  │     │     ├── FestivalName + Date
  │     │     ├── StatCard: Total Families
  │     │     ├── StatCard: Total Collected (₹)
  │     │     ├── StatCard: Total Pending (₹)
  │     │     └── QuickActions: [View Families] [Send Reminders] [Report]
  │     └── EmptyState              (if no active festival)
  ├── QuickNavSection
  │     ├── NavCard: Festivals
  │     ├── NavCard: Families
  │     ├── NavCard: Reports
  │     └── NavCard: SMS Reminders
  └── FestivalHistorySection
        ├── SectionHeader           ("Past Festivals")
        └── FestivalHistoryRow[]    (name, date, collected, families)
              └── [View Details] → /festivals/:id
```

### Ongoing Festival Logic
- A festival is "ongoing" if its `status = active` (admin sets this manually)
- Multiple ongoing festivals shown as separate cards, stacked vertically
- If zero ongoing festivals → EmptyState with CTA to create one

### Summary Card Numbers (per festival)
- **Total Families** → count of all families in temple
- **Total Collected** → SUM of `regular` payments for this festival
- **Total Pending** → (fixed amount × total families) − total collected
- Numbers fetched fresh on page load (TanStack Query)

### Navigation Links (Navbar + QuickNav)
| Link | Route | Visible to |
|------|-------|------------|
| Dashboard | `/dashboard` | admin, viewer |
| Festivals | `/festivals` | admin, viewer |
| Families | `/families` | admin, viewer |
| Reports | `/reports` | admin, viewer |
| SMS Reminders | `/reminders` | admin only |
| Temples | `/temples` | super_admin only |
| Users | `/users` | super_admin only |

### Festival History Section
- Shows all past (non-active) festivals sorted by date desc
- Columns: Festival Name, Date, Fixed Amount, Total Collected, Families Paid
- Click row → `/festivals/:id` (read-only detail for viewer, full detail for admin)
- Paginated (10 per page)

### Backend Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/festivals?status=active` | Fetch ongoing festivals with summary stats |
| GET | `/festivals?status=past&page=1` | Fetch past festivals paginated |

### Roles
- `admin` → full dashboard with all family stats, all quick actions visible
- `viewer` → scoped dashboard — sees only their own festival payment status (active + history), no global stats, no Send Reminders
- `super_admin` → redirected to `/temples`, does not see this dashboard

### Viewer Dashboard Layout
```
Dashboard (viewer)
  ├── Active Festival Card(s)
  │     ├── Festival name, dates, fixed amount
  │     ├── My Payment: Paid ₹X | Pending ₹Y
  │     └── [View Details] → /festivals/:id
  └── Past Festivals
        └── Row: Festival Name | Fixed Amt | Paid | Pending | [View]
```

### Viewer Navbar
```
Logo | My Festival | My Family | Logout
```

---

## 3. Festivals List Page

### Route
`/festivals`

### Layout
```
FestivalsPage
  ├── Header: "Festivals" + [+ New Festival] button (admin only)
  ├── Active Festivals (top section)
  │     └── FestivalRow: Name | Start–End Date | Fixed Amt | Deadline | Status | Actions
  │           └── Actions (admin only): [Edit] [Delete]
  └── Past Festivals (below)
        └── FestivalRow: same columns, [View] action only
```

### Create / Edit Festival (Modal)
```
FestivalModal
  ├── Name (required)
  ├── Description (optional)
  ├── Start Date (required)
  ├── End Date (required)
  ├── Collection Deadline (required) ← last date to collect payment
  ├── Fixed Amount per family (required)
  ├── Status: active | closed
  ├── Day-wise Agenda (auto-generated rows between start & end date)
  │     └── Row per day: Date (read-only) | Agenda text (editable)
  └── [Cancel] [Save]
```

### Rules
- Delete only if zero payments exist for that festival
- Edit available for both active and closed festivals
- Viewer sees list only — no create/edit/delete

### Backend Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/festivals` | List all festivals for temple |
| POST | `/festivals` | Create festival (admin only) |
| PUT | `/festivals/:id` | Edit festival (admin only) |
| DELETE | `/festivals/:id` | Delete if no payments exist (admin only) |

---

## 4. Festival Detail Page

### Route
`/festivals/:id`

### Layout — Admin View
```
FestivalDetailPage
  ├── Festival Info (top, read-only display)
  │     ├── Name, Description, Start–End Date, Deadline, Fixed Amount, Status
  │     └── Day-wise Agenda table (Date | Agenda)
  └── All Families + Payment Status (below)
        ├── Search / filter (paid | partial | pending)
        ├── FamilyPaymentRow: Family Name | Fixed Amt | Paid | Pending | Mode | Actions
        │     └── Actions: [Record Payment] [Send Reminder]
        └── Pagination
```

### Layout — Viewer View (Family Member)
```
FestivalDetailPage
  ├── Festival Info (top, read-only)
  │     ├── Name, Description, Start–End Date, Deadline, Fixed Amount
  │     └── Day-wise Agenda table
  └── My Family's Payment (below)
        ├── Fixed Amount | Amount Paid | Amount Pending
        └── Payment History: Date | Amount | Mode | Type
```

### Backend Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/festivals/:id` | Festival detail + agenda |
| GET | `/festivals/:id/payments` | All family payments (admin) |
| GET | `/festivals/:id/my-payments` | Logged-in family's payments (viewer) |

---

## 5. Families (Data Model + Account Creation)

### Family Record
```
Family
  ├── head_name (required)
  ├── mother_name (optional)
  ├── children[]  (optional)
  ├── primary_phone (required) ← used for login
  ├── secondary_phone (optional) ← contact only
  └── temple_id
```

### User Account (viewer) linked to Family
```
User
  ├── phone ← same as family primary_phone
  ├── password (auto-generated on first creation)
  ├── role: viewer
  ├── temple_id
  └── family_id ← links user to family record
```

### Account Creation Logic (when admin creates a family)
```
primary_phone provided
  ├── Phone exists in users table
  │     └── Link existing user to this family (skip creation, no SMS)
  └── Phone not found
        ├── Auto-create viewer User with primary_phone
        ├── Generate default password
        └── Send SMS via MSG91: "Your login: Phone: <phone>, Password: <password>"
```

---

## 6. Families List Page

### Route
`/families`

### Admin View
```
FamiliesPage
  ├── Header: "Families" + [+ Add Family] button
  ├── Search bar (by head name / phone)
  ├── FamilyCardGrid
  │     └── FamilyCard (per family)
  │           ├── Profile Picture (or initials avatar)
  │           ├── Head Name
  │           ├── Primary Phone
  │           └── Actions: [View] [Edit] [Delete]
  └── Pagination
```

### Viewer View (family member)
```
FamiliesPage
  └── Only their own FamilyCard shown
        ├── Profile Picture (or initials avatar)
        ├── [Upload Photo] button
        └── [View My Details]
```

### Add / Edit Family Modal (admin only)
```
FamilyModal
  ├── Head Name (required)
  ├── Mother Name (optional)
  ├── Children[] (add multiple, optional)
  ├── Primary Phone (required) ← login + account creation
  ├── Secondary Phone (optional) ← contact only
  └── [Cancel] [Save]
```

### Profile Picture
- Stored on Cloudinary free tier
- Default: initials avatar generated from head name
- Family member uploads from their own login → updates immediately
- Admin cannot change family's profile picture

### Rules
- Delete only if family has zero payments
- New family → auto account creation → SMS with login credentials if new phone

### Viewer Self-Edit Rules
| Field | Family Member | Admin |
|-------|--------------|-------|
| Profile picture | ✅ Can upload | ❌ |
| Children list | ✅ Can add/edit | ✅ |
| Head name | ❌ | ✅ |
| Mother name | ❌ | ✅ |
| Primary phone | ❌ | ✅ |
| Secondary phone | ❌ | ✅ |

---

## 7. Family Detail Page

### Route
`/families/:id`

### Admin View
```
FamilyDetailPage
  ├── Profile picture + initials fallback
  ├── Family Info: Head name, Mother name, Children[], Primary phone, Secondary phone
  ├── [Edit Family] button → Edit Modal (admin can edit all fields)
  └── Payment History (across all festivals)
        └── Row: Festival Name | Fixed Amt | Paid | Pending | Mode | Date
```

### Viewer View (their own family only)
```
FamilyDetailPage
  ├── Profile picture + [Upload Photo] button
  ├── Family Info (read-only for names/phones)
  ├── Children[] → [Add/Edit Children] allowed
  └── Payment History (across all festivals)
        └── Row: Festival Name | Fixed Amt | Paid | Pending | Mode | Date
```

### My Festival Page (viewer scoped `/festivals`)
```
  ├── Active Festival(s)
  │     ├── Festival info + day-wise agenda (read-only)
  │     └── My Payment: Paid ₹X | Pending ₹Y
  │           └── Payment history: Date | Amount | Mode | Type
  └── Past Festivals
        └── Festival info + payment history for each
```

### Backend Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/families/:id` | Family detail |
| PUT | `/families/:id` | Admin edits family |
| PUT | `/families/:id/children` | Viewer adds/edits children |
| PUT | `/families/:id/photo` | Upload photo to Cloudinary |

---

## 8. Reports Page

### Route
`/reports` (admin only)

### Layout
```
ReportsPage
  ├── Tab 1: Festival Report
  │     ├── Select Festival (dropdown)
  │     ├── Preview: table of all families | Fixed Amt | Paid | Pending | Mode
  │     └── [Download Excel] [Download PDF]
  └── Tab 2: Family Report
        ├── Search & select Family
        ├── From Date → To Date (history filter)
        ├── Preview: table of festivals | Fixed Amt | Paid | Pending | Date
        └── [Download Excel] [Download PDF]
```

### Output Format
- **Excel** → backend generates via ExcelJS, streamed as download
- **PDF** → frontend generates via react-pdf, simple table layout

### Access
- Admin only — viewer has no access, their profile page covers their own history

### Backend Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/reports/festival/:id` | Festival report data |
| GET | `/reports/family/:id?from=&to=` | Family report data with date filter |
| GET | `/reports/festival/:id/excel` | Stream Excel download |
| GET | `/reports/family/:id/excel` | Stream Excel download with date filter |

---

## 9. Temple Profile Page

### Route
`/temple` (admin, viewer) — `/temples/:id` (super_admin)

### Fields
- Temple name
- Deity name
- Village
- District (dropdown — 38 Tamil Nadu districts)
- Address (optional)
- Established year (optional)
- Primary contact phone
- Description (optional)
- Cover photo (1 image)
- Gallery images (up to 20, max 5MB each)

### Layout
```
TempleProfilePage
  ├── Cover Photo (full width hero)
  ├── Temple Name + Deity Name (below cover)
  ├── Details: Village | District | Address | Est. Year | Contact
  ├── Description
  └── Gallery grid (up to 20 images)
        └── [Upload Images] [Delete Image] (admin + super_admin only)
```

### Rules
- Cover photo → replace anytime
- Gallery → max 20 images, max 5MB per image
- Admin + super_admin can upload/delete images
- Viewer sees gallery read-only
- All images stored on Cloudinary

### Backend Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/temple` | Get temple profile |
| PUT | `/temple` | Update temple details (admin + super_admin) |
| POST | `/temple/cover` | Upload cover photo |
| POST | `/temple/gallery` | Upload gallery image (max 20, 5MB each) |
| DELETE | `/temple/gallery/:imageId` | Delete gallery image |

---

## 10. SMS Reminders Page

### Route
`/reminders` (admin only)

### SMS Types

#### 1. Payment Reminder
- Select festival → list of families with pending amounts + checkboxes
- Message: "Dear [Family], Pending amount ₹X for [Festival]. Pay before [Deadline]."
- [Send Selected] or [Send All]

#### 2. Festival Welcome Greeting
- Select festival → preview message → send to all families
- Message: "Dear [Family], Welcome to [Festival Name] starting [Date]."
- Send manually or schedule N days before festival start date

#### 3. Day-wise Festival Details
- Select festival → preview each day's agenda
- [Send All Days Now] or schedule N days before festival start

### Layout
```
RemindersPage
  ├── Tab 1: Payment Reminders
  │     ├── Select Festival
  │     ├── Family list with pending amounts (checkboxes)
  │     └── [Send Selected] [Send All]
  ├── Tab 2: Welcome Greeting
  │     ├── Select Festival
  │     ├── Preview message
  │     ├── [Send Now]
  │     └── [Schedule] → set days before festival start
  └── Tab 3: Festival Day Details
        ├── Select Festival
        ├── Day-wise agenda preview
        ├── [Send All Days Now]
        └── [Schedule] → set days before festival start
```

### Scheduled SMS
- Backend cron job fires on scheduled date → MSG91 bulk send
- Admin can see scheduled SMS: date, type, status (pending / sent)

### SMS History (below each tab)
- Log: date sent | type | count | status

---

## 11. Temples List Page

### Route
`/temples` (super_admin only)

### Layout
```
TemplesPage
  ├── Header: "Temples" + [+ Add Temple] button
  ├── Search bar (by temple name / village / district)
  ├── TempleCardGrid
  │     └── TempleCard (per temple)
  │           ├── Cover photo (or placeholder)
  │           ├── Temple name + Deity name
  │           ├── Village, District
  │           └── Actions: [View] [Edit] [Delete]
  └── Pagination
```

### Add / Edit Temple Modal
```
TempleModal
  ├── Temple name (required)
  ├── Deity name (required)
  ├── Village (required)
  ├── District (dropdown — 38 Tamil Nadu districts, required)
  ├── Address (optional)
  ├── Established year (optional)
  ├── Primary contact phone (required)
  ├── Description (optional)
  └── [Cancel] [Save]
```

### Rules
- super_admin searches by village + district first
- If not found → [+ Add Temple] to create new one
- Cover photo + gallery uploaded from Temple Profile page (not here)
- Delete only if temple has no festivals or families
- [View] → `/temples/:id` (temple profile page)
- Images (cover + gallery) uploadable by admin + super_admin from Temple Profile page

### Backend Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/temples` | List all temples |
| POST | `/temples` | Create temple (super_admin only) |
| PUT | `/temples/:id` | Edit temple (super_admin only) |
| DELETE | `/temples/:id` | Delete temple if empty (super_admin only) |

---

## 12. Users Page

### Route
`/users` (super_admin only)

### User Creation Hierarchy
```
super_admin → creates Admin accounts → assigns to temple
Admin       → creates Viewer accounts (family members)
                ├── Auto-created when adding a family (primary phone)
                └── Or manually via [Add User] under their temple
```

### Layout
```
UsersPage
  ├── Header: "Users" + [+ Add Admin] button
  ├── Search bar (by name / phone / temple)
  ├── Filter by temple (dropdown)
  ├── UserTable
  │     └── Row: Name | Phone | Role | Temple | Status | Actions
  │           └── Actions: [Edit] [Deactivate]
  └── Pagination
```

### Add / Edit Admin Modal
```
AdminModal
  ├── Name (required)
  ├── Phone (required)
  ├── Password (auto-generated, sent via SMS)
  ├── Assign Temple (dropdown — search by village/district)
  └── [Cancel] [Save]
```

### Rules
- super_admin creates admin accounts only (not viewers)
- On create → SMS sent with login credentials
- Deactivate instead of hard delete
- Viewer accounts managed by admin via Families page

### Backend Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/users` | List all admin users (super_admin only) |
| POST | `/users` | Create admin account |
| PUT | `/users/:id` | Edit admin account |
| PUT | `/users/:id/deactivate` | Deactivate admin account |

---

### Backend Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/reminders/payment` | Send payment reminders |
| POST | `/reminders/greeting` | Send welcome greeting |
| POST | `/reminders/agenda` | Send day-wise festival details |
| POST | `/reminders/schedule` | Schedule an SMS (cron) |
| GET | `/reminders/history` | SMS send history |
| DELETE | `/reminders/schedule/:id` | Cancel a scheduled SMS |

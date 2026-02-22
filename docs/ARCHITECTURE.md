# Architecture

This document explains how Open House Lead Station is structured and how data flows through the system.

## Overview

Open House Lead Station is a **local-first kiosk application** for real estate open houses.

It is made of:

- **Frontend (React)** for kiosk + admin UI
- **Backend (Node/Express)** for API + business logic
- **SQLite database** for local storage
- **Offline queue** on client device for temporary network loss

The app is typically deployed on a **Raspberry Pi** and accessed from a **tablet** browser.

---

## System Components

## 1) Frontend (React)

**Primary file:** `client/src/App.jsx`

Responsibilities:
- Kiosk sign-in flow
- Admin dashboard UI
- Validation and form UX
- QR code generation on thank-you screen
- Offline queue awareness and sync behavior

The frontend calls backend endpoints under `/api/...`.

## 2) Backend (Express)

**Primary file:** `server/index.js`

Responsibilities:
- Expose public kiosk endpoints
- Expose admin endpoints
- Validate and process sign-ins
- Manage admin PIN login and token auth
- Read/write settings and leads via DB layer
- Export CSV
- Serve built frontend in production

## 3) Database (SQLite)

**Primary file:** `server/db.js`  
**Data file:** `server/data/openhouse.db`

Responsibilities:
- Persist settings
- Persist visitors/leads
- Return visitor lists and stats
- Clear leads safely when requested

## 4) Offline Queue (Client-side)

**Primary file:** `client/src/offlineQueue.js`

Responsibilities:
- Save sign-ins locally if API submission fails
- Track queue count
- Retry sync when online returns
- Prevent accidental lead clearing while queued items exist

---

## Data Flow

## A) Kiosk Sign-In Submission

1. Visitor enters data in kiosk UI (`App.jsx`)
2. Frontend validates:
   - First/last name
   - Email or phone
   - Phone length
   - Consent (if required)
3. Frontend POSTs to:
   - `/api/public/checkin`
4. Backend validates again (server-side validation)
5. Backend calculates:
   - lead score
   - lead label (Hot / Warm / Nurture)
6. Backend inserts row into `visitors`
7. Frontend shows thank-you screen and QR codes

### Offline scenario
If API fails:
- frontend stores sign-in in offline queue
- thank-you screen still appears
- queue auto-flushes later when online returns

---

## B) Admin Settings Save

1. Admin logs in with PIN
2. Frontend loads settings from:
   - `/api/admin/settings`
3. Admin edits settings (branding, URLs, QR titles, timer, etc.)
4. Frontend POSTs to:
   - `/api/admin/settings`
5. Backend sanitizes / clamps values (e.g. reset timer)
6. Backend stores key/value settings in `settings`
7. Frontend reloads config and admin panel state

---

## C) Admin PIN Change

1. Admin enters:
   - current PIN
   - new PIN
   - confirm PIN
2. Frontend POSTs to:
   - `/api/admin/change-pin`
3. Backend verifies:
   - current PIN matches
   - new PIN is 4–8 digits
   - confirmation matches
4. Backend updates `settings.admin_pin`

PIN precedence:
1. DB `admin_pin`
2. `.env` `ADMIN_PIN`
3. `"1234"`

---

## D) Lead Export

1. Admin clicks **Export CSV**
2. Frontend opens:
   - `/api/admin/export.csv?token=<admin-token>`
3. Backend loads visitors
4. Backend converts rows to CSV
5. Browser downloads `openhouse-leads.csv`

---

## E) Lead Clearing

1. Admin enters `CLEAR` in confirmation field
2. Frontend checks queue count first
   - if pending queue > 0, block clearing
3. Frontend POSTs:
   - `/api/admin/clear-leads`
4. Backend validates confirmation text
5. Backend deletes all visitor rows
6. Admin dashboard refreshes

---

## Authentication Model

## Admin Authentication
- PIN-based login (`/api/admin/login`)
- Server issues a random token (`crypto.randomUUID()`)
- Token is stored in memory (`Set`)
- Frontend includes token on admin requests (`x-admin-token`)

### Important behavior
These tokens are **in-memory only**, so they reset if the server restarts.

This is acceptable for a local kiosk/admin setup, but not enterprise auth.

---

## API Endpoints

## Public
- `GET /api/public/config`
- `POST /api/public/checkin`

## Admin
- `POST /api/admin/login`
- `POST /api/admin/change-pin`
- `GET /api/admin/status`
- `GET /api/admin/settings`
- `POST /api/admin/settings`
- `GET /api/admin/visitors`
- `POST /api/admin/clear-leads`
- `GET /api/admin/export.csv`

## Utility
- `GET /api/health`

---

## Database Design

## `settings`
Simple key/value store for app configuration.

Benefits:
- Flexible for adding new settings
- No migrations needed for most changes
- Easy admin save logic

Tradeoff:
- No strict typed schema at DB level for settings values

## `visitors`
Structured lead records table.

Benefits:
- Easy exports
- Simple stats queries
- Fast local performance with SQLite

---

## Deployment Model

## Recommended (Field Use)
- Raspberry Pi runs backend server + static frontend
- Tablet connects to Pi over LAN/Wi-Fi
- Browser opens app in kiosk mode
- systemd auto-starts service on boot

## Alternative (Dev)
- Mac runs frontend (Vite) and backend separately
- Tablet accesses dev server on local network

---

## Key Production Considerations

### Strengths
- Local-first (great for unreliable venues)
- No cloud dependency required
- Fast and simple setup
- Low hardware cost

### Limitations (Current)
- Single-event model (`event_slug` fixed to default)
- Admin PIN stored in plain settings (not hashed)
- In-memory admin tokens reset on restart
- No cloud backup unless user exports CSV
- No multi-user admin roles

---

## Future Architecture Options

## Option 1: Multi-Event Local Mode
Add `events` table and assign `visitors.event_id`.

Would enable:
- Multiple listings/events per device
- Session switching in admin
- Historical archives without clearing DB

## Option 2: Cloud Sync Mode
Add optional remote sync layer:
- webhook integration
- Google Sheets
- CRM / SaaS backend

Would enable:
- Centralized reporting
- Backup across devices
- Multi-agent fleet management

## Option 3: Commercial / White-Label
Add:
- licensing
- branding packs
- remote configuration sync
- support bundle

---

## Directory Map

```text
openhouse-lead-station/
├─ client/
│  ├─ src/
│  │  ├─ App.jsx
│  │  ├─ styles.css
│  │  ├─ api.js
│  │  └─ offlineQueue.js
│  └─ dist/               # production build output
├─ server/
│  ├─ index.js
│  ├─ db.js
│  └─ data/
│     └─ openhouse.db
├─ docs/
│  ├─ QUICK-START.md
│  ├─ DEV-NOTES.md
│  ├─ ARCHITECTURE.md
│  ├─ SYSTEMD_SERVICE.md
│  └─ AI-ASSISTANT-OVERVIEW.md
├─ README.md
├─ CHANGELOG.md
└─ LICENSE
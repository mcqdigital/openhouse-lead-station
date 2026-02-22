````md
# DEV-NOTES.md

## Open House Lead Station — Developer Notes

This document is the **developer-facing reference** for maintaining, troubleshooting, and extending the Open House Lead Station project.

It is written for future you (or another developer) so the app can be deployed, updated, and debugged quickly without digging through old chats.

---

## 1) What This App Is

Open House Lead Station is a **tablet-friendly open house sign-in app** with:

- A **kiosk mode** for visitors
- A hidden **admin mode** for realtors
- **SQLite** storage on-device (Raspberry Pi or other local machine)
- **Offline queue support** in the browser (if internet drops)
- **CSV export** for lead backups
- **Admin settings** for branding, QR links, colors, timers, etc.
- **Admin PIN** (changeable from admin panel)

### Core stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** SQLite (`better-sqlite3`)
- **QR generation:** `qrcode`

---

## 2) Project Structure

> Adjust paths if your repo layout changes. This reflects the current expected layout.

```text
openhouse-lead-station/
├─ client/
│  ├─ src/
│  │  ├─ App.jsx               # Main kiosk + admin UI
│  │  ├─ api.js                # API helpers (GET/POST + admin token handling)
│  │  ├─ offlineQueue.js       # Browser offline queue logic (local queue)
│  │  └─ styles.css            # Full app styling
│  ├─ index.html
│  ├─ package.json
│  └─ dist/                    # Production build output (generated)
│
├─ server/
│  ├─ index.js                 # Express API server
│  ├─ db.js                    # SQLite schema + DB helpers
│  ├─ data/
│  │  └─ openhouse.db          # SQLite DB file (runtime data)
│  ├─ .env                     # Optional env vars (port/admin pin fallback)
│  └─ package.json
│
├─ docs/
│  └─ (documentation files)
│
└─ README.md
````

---

## 3) Key Files and What They Do

### `client/src/App.jsx`

Main frontend app. Handles:

* Kiosk flow (steps 1–5)
* Contact validation
* Buyer profile questions
* Consent step
* Thank-you QR screen
* Hidden admin hotspot (4 taps)
* Admin dashboard UI
* Settings save
* PIN change UI
* Clear leads UI
* Refresh & sync queue behavior
* Auto-reset countdown on thank-you screen

### `client/src/api.js`

Small wrapper for API calls.

Typical responsibilities:

* `apiGet()`
* `apiPost()`
* admin token header injection (`x-admin-token`)
* token storage helpers (`setAdminToken`, `getAdminToken`, `clearAdminToken`)

### `client/src/offlineQueue.js`

Client-side offline storage queue.

Typical responsibilities:

* Save sign-ins locally when POST fails
* Flush queued sign-ins later
* Return pending count

> “All Synced” in admin only means the **browser offline queue is empty**.
> It does **not** mean sync to cloud/CRM/email automatically.

### `client/src/styles.css`

All styling for kiosk/admin UI.

Includes:

* Kiosk layout
* Hero section
* Form styling
* QR cards
* Admin dashboard
* Status pills
* Live Summary styling
* Session header styling
* Responsive rules

### `server/index.js`

Express API server.

Provides:

* Public kiosk endpoints
* Admin auth endpoints
* Admin settings CRUD
* Visitor listing/export
* Clear leads endpoint
* PIN change endpoint
* Optional static file hosting (`client/dist`)
* Network URL console output (Local / Network / Bind)

### `server/db.js`

SQLite setup and DB helpers.

Provides:

* DB initialization
* `settings` table
* `visitors` table
* default settings seeding
* CRUD helpers for settings
* insert/list stats for visitors
* `clearVisitors()` helper

---

## 4) Current Backend API Endpoints

### Public

* `GET /api/health`
* `GET /api/public/config`
* `POST /api/public/checkin`

### Admin (requires `x-admin-token` or `?token=...`)

* `POST /api/admin/login`
* `POST /api/admin/change-pin`
* `GET /api/admin/status`
* `GET /api/admin/settings`
* `POST /api/admin/settings`
* `GET /api/admin/visitors`
* `POST /api/admin/clear-leads`
* `GET /api/admin/export.csv`

---

## 5) Settings Stored in SQLite (`settings` table)

Important keys currently used by the app:

### Branding / event info

* `brand_name`
* `agent_name`
* `brokerage_name`
* `property_address`
* `welcome_message`

### Links

* `listing_url`
* `feature_sheet_url`
* `similar_homes_url`
* `book_showing_url`

### QR labels

* `qr_listing_title`
* `qr_feature_title`
* `qr_similar_title`
* `qr_book_showing_title`

### Kiosk behavior

* `kiosk_reset_seconds`
* `require_consent`
* `ask_financing_question`

### Visuals

* `hero_image_url`
* `agent_photo_url`
* `brand_color`
* `accent_color`

### Options JSON

* `areas_options_json`
* `price_ranges_json`

### Security

* `admin_pin` (stored in DB after changing PIN from admin UI)

---

## 6) Admin PIN Behavior

### How it works

* Login checks the PIN against:

  1. `settings.admin_pin` (if present)
  2. `.env` `ADMIN_PIN` (fallback)
  3. `"1234"` (final fallback)

### What this means

* Once a PIN is changed in admin, it is stored in SQLite and becomes the active PIN.
* `.env` is still used as a fallback only if no DB PIN exists.

### If PIN is forgotten

Recovery options:

1. **Use SQLite and manually update `admin_pin`**
2. **Delete the `admin_pin` setting** so app falls back to `.env`
3. **Restore from backup DB**
4. Last resort: rebuild DB (not recommended if leads/settings matter)

#### Example (SQLite CLI)

```bash
cd ~/openhouse-lead-station/server/data
sqlite3 openhouse.db
```

Then inside SQLite:

```sql
SELECT key, value FROM settings WHERE key = 'admin_pin';
UPDATE settings SET value = '1234' WHERE key = 'admin_pin';
-- or remove it:
DELETE FROM settings WHERE key = 'admin_pin';
.quit
```

---

## 7) Lead Data Storage and “Sync” Clarification

### Where leads are stored

Leads are stored in:

* `server/data/openhouse.db`
* Table: `visitors`

### What “Offline Queue” means

If the browser cannot POST to the server:

* The check-in is temporarily stored in the browser queue (client-side)
* It will flush later when connection returns

### What “All Synced” means in admin

It means:

* The **browser queue is empty**
* All queued sign-ins have been successfully posted to the Pi server

It does **not** mean:

* Synced to cloud
* Synced to CRM
* Emailed anywhere
* Uploaded to GitHub

---

## 8) Developer Run Commands

## Local dev (Mac/PC)

### Client

```bash
cd client
npm install
npm run dev
```

Typical Vite output:

* Local: `http://localhost:5173`
* Network: `http://<your-ip>:5173`

### Server

```bash
cd server
npm install
npm run dev
# or
node index.js
```

Typical API output:

* Local: `http://localhost:8787`
* Network: `http://<your-ip>:8787`

---

## 9) Production Build + Deploy Flow

When making frontend changes (`App.jsx`, `styles.css`, etc.):

### 1) Build client

```bash
cd client
npm run build
```

This creates/updates:

* `client/dist/`

### 2) Restart server (if backend changed or to reload static files)

On Raspberry Pi:

```bash
sudo systemctl restart openhouse-kiosk
```

### 3) Verify

Open from tablet or laptop:

```text
http://<pi-ip>:8787
```

### Do I need to delete old build files manually?

No. `npm run build` overwrites `client/dist` output.

---

## 10) Raspberry Pi Notes (Developer Operations)

## SSH access

Example:

```bash
ssh piadmin@openhousepi.local
```

Or:

```bash
ssh piadmin@192.168.x.x
```

## Useful paths (example)

```bash
/home/piadmin/openhouse-lead-station
/home/piadmin/openhouse-lead-station/server
/home/piadmin/openhouse-lead-station/client
/home/piadmin/openhouse-lead-station/server/data/openhouse.db
```

## Service management

```bash
sudo systemctl status openhouse-kiosk
sudo systemctl restart openhouse-kiosk
sudo systemctl stop openhouse-kiosk
sudo systemctl start openhouse-kiosk
```

## View live logs

```bash
journalctl -u openhouse-kiosk -f
```

You should see lines like:

* Local URL
* Network URL(s)
* DB path

---

## 11) GitHub Backup / Update Workflow (Mac + GitHub Desktop)

### Standard workflow

1. Edit files in VS Code
2. Test locally
3. Commit in GitHub Desktop
4. Push to GitHub
5. Pull/update on Raspberry Pi

### Pi update workflow (manual)

SSH into Pi:

```bash
ssh piadmin@openhousepi.local
cd ~/openhouse-lead-station
git pull
cd client && npm run build
cd ../server
sudo systemctl restart openhouse-kiosk
```

> If dependencies changed:

```bash
cd client && npm install
cd ../server && npm install
```

---

## 12) Database Backup / Restore (Important)

## Backup database (Pi)

```bash
cp ~/openhouse-lead-station/server/data/openhouse.db \
   ~/openhouse-lead-station/server/data/openhouse-$(date +%F-%H%M).db.bak
```

## Backup entire project

```bash
tar -czf ~/openhouse-lead-station-backup-$(date +%F-%H%M).tar.gz \
  ~/openhouse-lead-station
```

## Restore DB (example)

1. Stop app:

```bash
sudo systemctl stop openhouse-kiosk
```

2. Replace DB:

```bash
cp /path/to/backup/openhouse.db ~/openhouse-lead-station/server/data/openhouse.db
```

3. Start app:

```bash
sudo systemctl start openhouse-kiosk
```

---

## 13) Common Troubleshooting

## A) Tablet can’t reach app

Check:

* Pi is on same Wi-Fi/LAN
* Server service is running
* Correct IP (`journalctl -u openhouse-kiosk -f`)
* Firewall/router isolation isn’t blocking devices

Test from laptop:

```bash
curl http://<pi-ip>:8787/api/health
```

Expected:

```json
{"ok":true,"time":"..."}
```

## B) Admin login fails

Check:

* Correct PIN
* If changed before, it may now be in DB (`settings.admin_pin`)
* Reset via SQLite if needed (see PIN recovery section)

## C) “All Synced” but no leads exported

“All Synced” only reflects browser queue status.
Use:

* Admin → **Recent Visitors**
* Admin → **Export CSV**
* Check `visitors` table in SQLite

## D) QR code missing on thank-you page

A QR card only shows if its URL exists in settings and QR generation succeeds:

* `listing_url`
* `feature_sheet_url`
* `similar_homes_url`
* `book_showing_url`

If `book_showing_url` is blank, the Book Showing QR won’t appear.

## E) Hero image/headshot not showing at open house (no internet)

If image URLs are remote and internet is unavailable:

* They may not load
* Fallback initials will show for agent photo
* Hero image may fall back to gradient look

### Recommended production improvement (future)

Add local image uploads/storage on the Pi (instead of remote URLs).

## F) App changes not showing after deployment

Usually one of these:

* Forgot `npm run build` in `client`
* Service not restarted
* Browser cache still serving old files

Try:

* hard refresh browser
* restart service
* confirm `client/dist` timestamp changed

---

## 14) Data Model Notes

## `visitors` table fields

* `id`
* `event_slug`
* `first_name`
* `last_name`
* `email`
* `phone`
* `has_agent`
* `buying_timeline`
* `preapproved`
* `price_range`
* `areas_interest_json`
* `notes`
* `consent_property_contact`
* `consent_marketing`
* `lead_score`
* `lead_label`
* `source_status`
* `created_at`

### `source_status` values seen

* `online`
* `offline_queued` (posted later after queue flush)

---

## 15) Security Notes (Current vs Future)

## Current (good for MVP / field use)

* Admin PIN
* Token-based admin access in memory
* No public admin endpoints without token
* SQLite local-only storage

## Current limitations

* Admin tokens are in-memory (cleared on server restart)
* No HTTPS on local LAN by default
* PIN is stored plain in SQLite (not hashed)

## Recommended future hardening (if selling commercially)

1. Hash admin PIN (bcrypt)
2. Session expiry / token expiration
3. Optional HTTPS reverse proxy (Caddy/Nginx)
4. Audit log for admin actions
5. User roles (agent/admin)
6. Encrypted backup export option
7. Cloud sync / CRM integration with retries

---

## 16) Professional/Commercialization Enhancements (Future Roadmap)

If selling to other realtors, strong next steps:

### Product polish

* Multi-event support (event selector + archived sessions)
* Per-event export and reset
* Branded onboarding wizard
* Local image upload (stored on device)
* Optional email delivery after sign-in
* CRM integrations (HubSpot, Follow Up Boss, KV Core, etc.)

### Stability

* Auto DB backup after each export
* Health dashboard (disk space, uptime, queue health)
* Crash-safe watchdog / service checks
* Admin “Test QR” / “Test network” tools

### Business/Distribution

* Installer script for Pi
* One-command update script
* License key / activation model
* White-label branding pack
* Support docs + training videos
* Demo mode

---

## 17) Notes on `0.0.0.0` vs `localhost` vs Network IP

When the server logs:

* `Bind: http://0.0.0.0:8787`
  means Express is listening on **all interfaces**
* `Local: http://localhost:8787`
  means usable from the Pi itself
* `Network: http://192.168.x.x:8787`
  means usable from other devices on LAN (tablet/laptop)

`0.0.0.0` is a bind address, not the address you type into a tablet.

---

## 18) Suggested .gitignore Entries

Make sure these are ignored (or handled intentionally):

```gitignore
node_modules/
client/node_modules/
server/node_modules/

client/dist/

.env
server/.env

*.db
*.db-shm
*.db-wal
*.bak
```

> If you want to keep a demo DB in repo, use a separate sanitized sample file.

---

## 19) Quick Sanity Checklist Before Open House

### On Pi

* [ ] `openhouse-kiosk` service is running
* [ ] Tablet can open `http://<pi-ip>:8787`
* [ ] Admin PIN works
* [ ] Correct property address/agent/branding loaded
* [ ] QR links configured
* [ ] Test sign-in works
* [ ] Export CSV works
* [ ] Queue shows `All Synced`

### After event

* [ ] Export CSV
* [ ] Confirm file downloaded
* [ ] (Optional) DB backup
* [ ] Clear leads for next event

---

## 20) Developer Change Log Notes (Manual)

When making changes, note:

* Date
* File(s) changed
* Why
* Migration impact (DB/settings?)
* Rebuild required? (frontend)
* Restart required? (backend/service)

Example format:

```md
### 2026-02-22
- Added admin PIN change endpoint and UI
- Added clear leads endpoint + UI
- Added configurable QR titles and kiosk reset timer
- Added network URL logging on server startup
- Files: server/index.js, server/db.js, client/src/App.jsx, client/src/styles.css
```

---

## 21) Final Developer Reminder

This app is already in a strong MVP/production state for field use on a Raspberry Pi + tablet.

The biggest future upgrade areas are:

1. **local image uploads**
2. **multi-event support**
3. **cloud/CRM sync**
4. **security hardening (hashed PIN/tokens)**

Everything else is incremental polish.

---



````md
# DEV-NOTES.md

## Open House Lead Station — Developer Notes

This document is the **developer-facing reference** for the Open House Lead Station app. It is intended to help with:

- local development
- Raspberry Pi deployment
- troubleshooting
- code structure
- update workflow
- backups
- production stability

---

## 1) Project Overview

Open House Lead Station is a **self-hosted kiosk app** used at open houses to collect visitor sign-ins and lead data.

### Core behavior
- Runs locally on a device (typically a **Raspberry Pi**)
- Visitors sign in on a tablet
- Data is stored locally in **SQLite**
- Admin panel allows:
  - branding changes
  - QR link setup
  - lead export (CSV)
  - clear leads
  - PIN management
  - kiosk timer adjustments
- Offline-friendly:
  - if internet is unavailable, check-ins can be queued locally (browser queue)
  - queued records sync when internet returns

---

## 2) Recommended Deployment Topology

### Production setup (recommended)
- **Raspberry Pi** runs the server and serves the built frontend
- **Tablet** opens the kiosk UI in browser kiosk mode
- Both are on the same Wi-Fi network (or Pi hotspot if configured later)

### Why this is preferred
- The Pi stores the database locally
- Tablet can be swapped/replaced without losing data
- Easy to back up the app and database on the Pi
- Stable “appliance-like” setup

---

## 3) Main Technologies

### Frontend
- React (Vite app)
- `App.jsx` = main kiosk + admin interface
- QR generation with `qrcode`

### Backend
- Node.js + Express
- `index.js` = API + static file serving
- `db.js` = SQLite data layer

### Database
- SQLite via `better-sqlite3`
- File path (default on Pi):
  - `server/data/openhouse.db`

---

## 4) Typical Project Structure

> Your exact folders may vary slightly, but this is the expected structure.

```text
openhouse-lead-station/
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── offlineQueue.js
│   │   └── styles.css
│   ├── dist/                 # built frontend output (generated)
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── data/
│   │   └── openhouse.db      # SQLite database
│   ├── db.js
│   ├── index.js
│   ├── package.json
│   └── .env                  # optional, local secrets/defaults
├── docs/
│   └── DEV-NOTES.md
└── README.md
````

---

## 5) Key Files and What They Do

## `client/src/App.jsx`

Main UI for both:

* **Kiosk mode** (visitor sign-in)
* **Admin mode** (hidden hotspot or localhost dev button)

### Responsibilities

* Loads public config from `/api/public/config`
* Multi-step sign-in flow
* Validates contact info before submit
* Submits leads to `/api/public/checkin`
* Queues offline submissions using `offlineQueue.js`
* Generates QR codes on thank-you screen
* Admin login and admin dashboard
* Admin settings save
* CSV export link
* Clear leads action
* Admin PIN change form

---

## `client/src/api.js`

Small helper wrapper for API requests.

### Typically handles

* GET/POST wrappers
* Admin token header injection (`x-admin-token`)
* Error normalization

---

## `client/src/offlineQueue.js`

Browser-side offline queue logic (usually localStorage or IndexedDB-backed).

### Purpose

* If `/api/public/checkin` fails (network/server issue), queue payload locally
* Sync queued check-ins later when internet comes back

### Important note

“**All Synced**” in admin refers to this browser queue for the current device/session context, **not** syncing to an external CRM automatically.

---

## `client/src/styles.css`

All kiosk/admin styles.

### Notes

* Contains kiosk layout, hero, forms, thank-you QR grid
* Contains admin dashboard layout and status badges
* Keep styles grouped and commented by section (already done nicely)

---

## `server/index.js`

Express server entry point.

### Responsibilities

* Starts API
* Reads/writes settings
* Receives check-ins
* Scores and labels leads
* Admin auth (PIN + in-memory session tokens)
* Exports CSV
* Clears leads
* Serves built frontend from `client/dist` (production)
* Logs local/network URLs on startup

### Important routes

#### Public

* `GET /api/public/config`
* `POST /api/public/checkin`

#### Admin

* `POST /api/admin/login`
* `POST /api/admin/change-pin`
* `GET /api/admin/status`
* `GET /api/admin/settings`
* `POST /api/admin/settings`
* `GET /api/admin/visitors`
* `POST /api/admin/clear-leads`
* `GET /api/admin/export.csv`

---

## `server/db.js`

SQLite schema + data access helpers.

### Responsibilities

* Initialize DB and tables
* Seed default settings (without overwriting saved values)
* CRUD-style helpers for settings
* Insert/list visitors
* Stats query
* Clear leads query

### Existing core tables

* `settings`
* `visitors`

---

## 6) Environment Variables (`server/.env`)

The app can run without many environment variables now because some values are stored in the DB settings, but `.env` is still useful.

### Common values

```env
PORT=8787
ADMIN_PIN=1234
```

### Behavior note

* On first run, login can use `.env` `ADMIN_PIN` fallback
* Once `admin_pin` is saved in DB settings, that becomes the active PIN
* `.env` is still useful as fallback/recovery default if DB PIN is missing

---

## 7) Local Development (Mac / VS Code)

## Frontend dev server (Vite)

From `client/`:

```bash
npm install
npm run dev
```

You’ll usually see:

* Local: `http://localhost:5173`
* Network: `http://<your-mac-ip>:5173`

## Backend server

From `server/`:

```bash
npm install
node index.js
```

API usually runs on:

* `http://localhost:8787`

### Dev workflow (common)

Use two terminals:

1. Frontend (`client`) → `npm run dev`
2. Backend (`server`) → `node index.js`

If your frontend is configured with a proxy in Vite, it can call `/api/...` without CORS headaches.

---

## 8) Production Build + Update Workflow

When you change frontend files (React / CSS), the Raspberry Pi needs a **new build**.

## A) Build frontend (on your Mac or on the Pi)

From `client/`:

```bash
npm run build
```

This creates/updates:

* `client/dist/`

## B) Deploy updated files to Pi

You can use Git (recommended) or SCP/rsync.

### Option 1: Git-based deploy (recommended)

On Pi:

```bash
cd ~/openhouse-lead-station
git pull
cd client
npm install
npm run build
cd ../server
npm install
sudo systemctl restart openhouse-kiosk
```

### Option 2: Copy files manually

* Copy changed files from Mac to Pi
* Rebuild frontend if needed
* Restart service

---

## 9) Raspberry Pi Service (systemd) Notes

Your service is likely named:

* `openhouse-kiosk.service`

### Useful commands

```bash
sudo systemctl status openhouse-kiosk
sudo systemctl restart openhouse-kiosk
sudo systemctl stop openhouse-kiosk
sudo systemctl start openhouse-kiosk
sudo systemctl enable openhouse-kiosk
```

### View logs

```bash
journalctl -u openhouse-kiosk -f
```

### What good startup logs look like

You already confirmed output similar to:

* Local URL
* Network URLs (eth0 / wlan0)
* Bind URL (`0.0.0.0`)
* SQLite DB path

That’s exactly what you want.

---

## 10) SSH / Access Notes

### SSH to Pi (your current working command)

```bash
ssh piadmin@openhousepi.local
```

### If mDNS fails (`.local` not found), use IP

```bash
ssh piadmin@192.168.8.xxx
```

---

## 11) GitHub + GitHub Desktop Workflow (Mac)

## One-time setup

* Open project folder in **GitHub Desktop**
* Connect to your GitHub repo
* Make sure `.gitignore` excludes generated and sensitive files (see section below)

## Daily workflow

1. Edit code in VS Code
2. Test locally
3. Commit in GitHub Desktop (clear commit message)
4. Push to GitHub
5. On Pi: `git pull`, rebuild, restart service

### Recommended commit message style

* `feat: add admin PIN change panel`
* `fix: show book showing QR card on thank-you screen`
* `chore: improve live summary status badges`

---

## 12) Recommended `.gitignore`

If you do not already have one, create a root `.gitignore` like this:

```gitignore
# Node modules
node_modules/
client/node_modules/
server/node_modules/

# Build output
client/dist/

# Logs
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# Environment files
server/.env

# SQLite runtime files (decide based on your workflow)
server/data/*.db-wal
server/data/*.db-shm

# Optional: exclude live DB from git (recommended)
server/data/openhouse.db
```

### Important note about database backup

Do **not** rely on GitHub as your lead-data backup.
CSV export + DB backup on Pi is the right approach.

---

## 13) Data Backup and Recovery

## CSV backup (admin panel)

Use **Export CSV** after each open house.

## Full database backup (Pi)

Backup the SQLite DB file:

```bash
cp ~/openhouse-lead-station/server/data/openhouse.db ~/openhouse-backups/openhouse-$(date +%F-%H%M).db
```

### Create backup folder once

```bash
mkdir -p ~/openhouse-backups
```

## Restore DB (if needed)

Stop service, replace DB, restart:

```bash
sudo systemctl stop openhouse-kiosk
cp ~/openhouse-backups/openhouse-YYYY-MM-DD-HHMM.db ~/openhouse-lead-station/server/data/openhouse.db
sudo systemctl start openhouse-kiosk
```

---

## 14) Admin Auth / PIN Behavior

## Current design

* Admin login uses a PIN
* Successful login returns a random token
* Token is stored client-side and sent via `x-admin-token`
* Tokens are **in-memory only** on the server

### Important consequence

After server restart:

* existing admin sessions are invalidated
* user must log in again with PIN

This is normal and acceptable for this app.

## If PIN is forgotten

Recovery options:

1. Check `server/.env` fallback PIN (if still valid and DB doesn’t override)
2. Edit `settings` table (`admin_pin`) directly in SQLite
3. Add a temporary script/route to reset the PIN (dev only)
4. Replace DB with backup if needed

---

## 15) “All Synced” Meaning (Important)

On the admin panel, **All Synced** means:

* There are **no pending offline check-ins in the local browser queue**
* It does **not** mean leads are synced to:

  * CRM
  * Google Sheets
  * cloud server
  * email system

### Where leads are stored

Leads are stored in:

* `server/data/openhouse.db` on the Raspberry Pi

### What “Export CSV” does

Exports leads from the Pi’s SQLite DB as a CSV file through:

* `GET /api/admin/export.csv`

---

## 16) Common Troubleshooting

## Problem: Tablet can’t load the app

### Check:

* Pi is powered on
* service is running:

  ```bash
  sudo systemctl status openhouse-kiosk
  ```
* correct URL/IP is being used
* tablet is on same network
* if using Wi-Fi, ensure Pi and tablet are on same SSID

---

## Problem: API running but frontend not loading

### Check:

* `client/dist` exists
* `npm run build` completed successfully
* `server/index.js` static serving block is present
* restart service after build

---

## Problem: “Unauthorized” in admin

### Causes

* token expired after server restart
* token missing
* token invalid

### Fix

* log out / log in again with PIN

---

## Problem: Book Showing QR not appearing

### Check

* `book_showing_url` is set in admin settings
* frontend thank-you screen uses `qrs.bookShowing`
* QR card filter only hides cards with no generated QR image

---

## Problem: New admin settings not sticking

### Check

* `/api/admin/settings` route includes the field in `patch`
* `buildConfig()` returns the field
* frontend `saveAdminSettings()` sends the field
* `db.js` settings seeding does not overwrite existing values (it shouldn’t)

---

## Problem: PIN change works, but old PIN still works

### Usually caused by

* not actually saving `admin_pin` to DB
* testing against old running server process
* multiple server instances running

### Fix

* restart service
* verify only one Node process
* inspect settings table if needed

---

## 17) SQLite Inspection (Advanced)

If you want to inspect the DB directly on Pi:

```bash
sqlite3 ~/openhouse-lead-station/server/data/openhouse.db
```

### Helpful queries

```sql
.tables
SELECT key, value FROM settings;
SELECT COUNT(*) FROM visitors;
SELECT id, first_name, last_name, created_at FROM visitors ORDER BY id DESC LIMIT 10;
```

### Exit sqlite

```sql
.quit
```

---

## 18) Production Hardening Recommendations (Next Steps)

These are the best next improvements if you want to sell/distribute this app.

## High priority

1. **Admin session expiry**

   * Add token expiration timestamp
   * Auto-logout after inactivity

2. **Rate limiting on admin routes**

   * Prevent brute-force PIN attempts

3. **Stronger admin auth**

   * Optional password mode (not just PIN)
   * Per-device setup wizard

4. **Image uploads**

   * Store hero/headshot locally on Pi instead of remote URLs
   * Avoid broken images at internet-poor sites

5. **Automated DB backup**

   * Nightly backup on Pi via cron/systemd timer

6. **Audit log**

   * Track admin changes (settings saved, leads cleared, PIN changed)

---

## Nice-to-have “wow” features

1. **Event profiles**

   * Multiple open houses/events on one device
   * Select active event in admin

2. **CRM integrations**

   * Email lead summary
   * Zapier/webhook
   * Google Sheets sync
   * Follow Up Boss / KV Core / etc.

3. **Printable sign rider QR**

   * Generate branded QR sheet for the property

4. **Lead source tagging**

   * Open House / QR-only / floor sign / ad campaign

5. **Analytics panel**

   * Conversion rates
   * busy times by hour
   * hot/warm mix

6. **Brand templates**

   * Presets per realtor/team/brokerage

---

## 19) Developer Conventions (Recommended)

## Code style

* Keep backend routes grouped:

  * public
  * admin
  * exports
* Keep settings fields mirrored in **three places** whenever adding a new setting:

  1. `db.js` defaults (`seedDefaults`)
  2. `index.js` (`buildConfig` + `/api/admin/settings` patch)
  3. `App.jsx` (admin form + usage in UI)

This is the #1 source of bugs when adding new settings.

## Comments

Use clear section comments, for example:

* `// ---------- Admin routes ----------`
* `// New fields`
* `// Auto-reset thank-you screen`

## Naming

Stick to snake_case for API payload/settings keys to match current codebase style:

* `book_showing_url`
* `kiosk_reset_seconds`

---

## 20) Release Checklist (Before a Real Open House)

### On Mac (prep)

* [ ] Test kiosk sign-in flow
* [ ] Test admin login
* [ ] Test CSV export
* [ ] Test clear leads confirmation
* [ ] Build frontend (`npm run build`)
* [ ] Push to GitHub

### On Pi (deploy)

* [ ] `git pull`
* [ ] `cd client && npm run build`
* [ ] `cd ../server && npm install` (if deps changed)
* [ ] `sudo systemctl restart openhouse-kiosk`
* [ ] Check logs (`journalctl -u openhouse-kiosk -f`)

### On tablet (field check)

* [ ] Open kiosk URL
* [ ] Test hidden admin hotspot
* [ ] Confirm branding/property loaded
* [ ] Confirm QR cards display correctly
* [ ] Test one fake sign-in and export
* [ ] Clear test lead before event starts

---

## 21) Quick Commands Reference

## Restart service

```bash
sudo systemctl restart openhouse-kiosk
```

## Service status

```bash
sudo systemctl status openhouse-kiosk
```

## View live logs

```bash
journalctl -u openhouse-kiosk -f
```

## Pull latest code

```bash
cd ~/openhouse-lead-station
git pull
```

## Build frontend

```bash
cd ~/openhouse-lead-station/client
npm run build
```

## Start backend manually (debug)

```bash
cd ~/openhouse-lead-station/server
node index.js
```

## SSH to Pi

```bash
ssh piadmin@openhousepi.local
```

---

## 22) Final Notes for Future Developers / AI Assistants

When changing the app, always verify the end-to-end chain:

### If adding a new admin setting:

* `db.js` default seed key
* `index.js` `buildConfig()` return field
* `index.js` admin settings save route patch
* `App.jsx` admin form input
* `App.jsx` kiosk/admin UI usage
* Save + reload test

### If changing lead data schema:

* `db.js` table schema
* `insertVisitor()`
* `listVisitors()`
* CSV export in `index.js`
* Admin visitor list UI in `App.jsx`

### If changing networking/deploy behavior:

* `server/index.js` startup logs
* systemd service config
* tablet kiosk browser startup script

This app is already in a strong place for real-world field use. The most important ongoing priorities are:

* data safety (backups)
* deployment consistency
* reducing “forgot to patch all 3 places” bugs

---



Yes — got it. You want **three separate copy/paste-ready `.md` files**, each with the **right content in the right place**.

Below are:

1. `QUICK-START.md` (user-facing)
2. `DEV-NOTES.md` (developer/troubleshooting)
3. `SYSTEMD_SERVICE.md` (deployment/service setup on Raspberry Pi)

You can copy each one directly into your local docs folder.

---

## `QUICK-START.md`

```md
# Quick Start

## Open House Lead Station

A simple, professional kiosk app for open houses that lets visitors sign in on a tablet, captures leads, and gives them QR codes for listing info, feature sheets, similar homes, and booking a showing.

This guide is for **agents / users** (not developers).

---

## What This App Does

- Shows a clean **Open House sign-in screen**
- Collects visitor contact info
- Asks a few quick buyer profile questions
- Saves leads locally on the device
- Shows QR codes after sign-in for:
  - Listing page
  - Feature sheet
  - Similar homes
  - Book showing
- Has an **Admin area** to:
  - Update branding and property info
  - Export leads to CSV
  - Clear leads after an event
  - Change admin PIN
  - Adjust QR labels and reset timer

---

## What You Need

### Minimum setup (recommended)
- **Raspberry Pi** running the app
- **Tablet** connected to the same Wi-Fi
- Internet connection (recommended, but app can still store sign-ins offline)

### Optional
- Tablet mounted on a stand
- External battery / power bank for tablet
- Portable hotspot (if no house Wi-Fi)

---

## How to Access the App

### Visitor kiosk screen
Open this in the tablet browser:

- `http://<raspberry-pi-ip>:8787`

Example:
- `http://192.168.8.202:8787`

### Admin mode
On the kiosk screen, tap the **top-right hidden hotspot** quickly (4 taps) to open Admin mode.

> Tip: On a development computer (`localhost`), a visible Admin button may appear.

---

## Admin Login

Use your Admin PIN to unlock the admin area.

### Default PIN (if never changed)
- `1234`

If you changed it in the app, use your new PIN.

---

## Admin Features

### 1) Event & Branding
Update:
- Brand name
- Agent name
- Brokerage name
- Property address
- Welcome message
- Hero image URL
- Agent photo/headshot URL
- Brand colors
- Area options
- Price ranges

### 2) QR Links and Titles
You can set:
- Listing URL + QR title
- Feature Sheet URL + QR title
- Similar Homes URL + QR title
- Book Showing URL + QR title

If a URL is blank, that QR code is automatically hidden on the thank-you screen.

### 3) Auto Reset Timer
Set how long the thank-you / QR screen stays visible before the kiosk resets.

Recommended:
- **90 seconds**

### 4) Live Summary
Shows:
- Online / Offline status
- Pending sync count
- Lead totals (Hot / Warm / Nurture)
- Recent visitor sign-ins

### 5) Data Management
- **Refresh & Sync Queue**  
  Refreshes dashboard data and tries to send any offline-saved sign-ins
- **Export CSV**  
  Downloads all leads as a CSV file
- **Clear Leads**  
  Deletes all leads on the device (requires typing `CLEAR`)

> Important: Export your CSV before clearing leads.

### 6) Security
Change the Admin PIN (4–8 digits)

---

## Offline / Internet Behavior

### If internet is available
- Sign-ins submit normally
- QR codes work (if links are valid)

### If internet goes down
- The app can still **save sign-ins locally** on the device
- It will show a message that the sign-in was saved offline
- When internet comes back, the app can sync queued sign-ins automatically

### “All Synced” means
It means:
- There are **no offline-pending sign-ins** waiting in the local queue on that device

It does **not** mean the leads were sent to a cloud CRM (unless you build that later).

---

## Best Practices for Open House Day

### Before the open house
- Turn on Raspberry Pi and make sure app loads
- Test on the tablet
- Open Admin mode and confirm:
  - Property address
  - Agent name
  - QR links
  - Auto reset timer
- Do one test sign-in and delete it if needed

### During the open house
- Keep tablet plugged in if possible
- Leave kiosk on the sign-in page
- Check Admin mode occasionally for lead count

### After the open house
1. Open Admin
2. Click **Export CSV**
3. Save the file to your computer
4. Confirm CSV opens correctly
5. Click **Clear Leads**
6. Type `CLEAR` and confirm

---

## Kiosk Use on Tablet

### Best setup (recommended)
Use the tablet as the screen and the Raspberry Pi as the server.

### Can it run on a tablet alone?
**Not fully**, unless you deploy a cloud-hosted version.

This app uses:
- A browser frontend (tablet)
- A Node/Express backend + SQLite database (server)

A tablet alone usually cannot run the server/database reliably by itself.

---

## Troubleshooting

### Tablet can’t load the page
- Confirm Pi is powered on
- Confirm tablet is on same Wi-Fi
- Confirm Pi IP address (check Pi terminal)
- Try opening:
  - `http://<pi-ip>:8787`

### Admin PIN not working
- Use the current PIN (it may have been changed)
- If forgotten, a developer can reset the PIN in the server settings/database (see DEV-NOTES.md)

### QR code not showing
- Make sure the matching URL is entered in Admin settings
- Save settings
- Submit a test sign-in again

### “Offline” banner showing
- Internet may be down
- Sign-ins still save locally
- Use **Refresh & Sync Queue** when connection returns

---

## Recommended Hardware Setup

- Raspberry Pi 4 or 5 (recommended)
- Power supply for Pi
- microSD card (32GB+)
- Tablet (iPad or Android)
- Tablet stand
- Wi-Fi connection or hotspot

---

## Support Notes

If you’re using this across multiple listings or multiple devices:
- Each device keeps its own local data unless you build a shared/cloud backend
- Export the CSV from each device after the event
- Standardize your setup (same PIN, same branding style, same timer)

---

## Version Notes

This Quick Start covers the current local-device version with:
- Admin branding controls
- QR title customization
- Auto-reset timer
- Offline queue
- CSV export
- Lead clearing
- PIN change support
```

---

## `DEV-NOTES.md`

````md
# DEV NOTES

## Open House Lead Station (Developer Notes)

This document is for developers maintaining, troubleshooting, or extending the Open House Lead Station app.

It includes:
- Project structure
- Runtime behavior
- Raspberry Pi access
- Build/deploy workflow
- Common troubleshooting
- Production hardening recommendations

---

## Stack Overview

### Frontend
- React (Vite)
- Browser kiosk UI
- Admin UI in same app

### Backend
- Node.js
- Express
- SQLite (`better-sqlite3`)

### Local Storage / Offline
- Browser-side offline queue (queued check-ins)
- Server-side SQLite database for saved leads/settings

---

## Key Features Implemented

- Visitor kiosk flow (multi-step)
- Lead scoring (`Hot`, `Warm`, `Nurture`)
- Admin dashboard
- Configurable branding and property info
- Configurable QR titles + URLs
- Configurable kiosk reset timer
- CSV export
- Clear leads endpoint
- Admin PIN change (stored in settings)
- Offline queue + sync indicator
- Systemd auto-start support on Raspberry Pi

---

## Project Structure (Typical)

```text
openhouse-lead-station/
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── offlineQueue.js
│   │   └── styles.css
│   ├── dist/              # built frontend (generated)
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── index.js           # Express server/API
│   ├── db.js              # SQLite setup + queries
│   ├── data/
│   │   └── openhouse.db   # SQLite database file
│   ├── .env               # optional env vars
│   └── package.json
├── docs/
│   ├── QUICK-START.md
│   ├── DEV-NOTES.md
│   └── SYSTEMD_SERVICE.md
└── README.md
````

---

## Core Files and Their Roles

### `client/src/App.jsx`

Main UI logic for:

* Kiosk mode
* Admin mode
* Step flow
* Form validation
* QR generation
* Admin settings editing
* PIN change UI
* Data management UI
* Offline queue status UI

### `client/src/styles.css`

App styling:

* Kiosk layout
* Admin layout
* Session header panel
* Status pills
* Responsive behavior
* QR card display

### `server/index.js`

Main backend:

* Public routes:

  * `/api/public/config`
  * `/api/public/checkin`
* Admin routes:

  * `/api/admin/login`
  * `/api/admin/change-pin`
  * `/api/admin/status`
  * `/api/admin/settings`
  * `/api/admin/visitors`
  * `/api/admin/export.csv`
  * `/api/admin/clear-leads`
* Serves frontend from `client/dist` if build exists
* Logs local + network IPs on startup

### `server/db.js`

SQLite setup and data access:

* Creates `settings` table
* Creates `visitors` table
* Seeds default settings (without overwriting existing)
* Exposes functions:

  * `getAllSettings()`
  * `updateSettings(patch)`
  * `insertVisitor(visitor)`
  * `listVisitors(limit)`
  * `getStats()`
  * `clearVisitors()`

---

## Environment Variables (`server/.env`)

Optional but supported:

```env
PORT=8787
ADMIN_PIN=1234
```

### Important behavior

* The app now reads admin PIN from SQLite `settings.admin_pin` if present.
* If `admin_pin` is not set in DB, it falls back to:

  1. `process.env.ADMIN_PIN`
  2. `"1234"`

So `.env` is still useful as a **fallback / first-run PIN**.

---

## Raspberry Pi Access (Current Workflow)

### SSH from Mac

```bash
ssh piadmin@openhousepi.local
```

If mDNS name fails, use IP:

```bash
ssh piadmin@192.168.x.x
```

### Project path on Pi

```bash
/home/piadmin/openhouse-lead-station
```

---

## Local Dev Workflow (Mac)

### 1) Edit in VS Code

Edit files locally on Mac (project repo).

### 2) Commit + push with GitHub Desktop

* Open GitHub Desktop
* Review changed files
* Write commit message
* Commit to main (or your working branch)
* Push origin

### 3) Pull updates on Raspberry Pi

SSH into Pi and run:

```bash
cd ~/openhouse-lead-station
git pull
```

### 4) Rebuild frontend (if client files changed)

```bash
cd ~/openhouse-lead-station/client
npm install
npm run build
```

### 5) Restart server

```bash
sudo systemctl restart openhouse-kiosk
```

### 6) Check logs

```bash
sudo journalctl -u openhouse-kiosk -n 50 --no-pager
```

---

## Build / Deploy Notes

### When you change frontend only (`App.jsx`, `styles.css`, etc.)

You must rebuild `client/dist`:

```bash
cd ~/openhouse-lead-station/client
npm run build
sudo systemctl restart openhouse-kiosk
```

### When you change backend only (`server/index.js`, `server/db.js`)

No frontend build needed:

```bash
cd ~/openhouse-lead-station
sudo systemctl restart openhouse-kiosk
```

### When you change both

Do both steps:

```bash
cd ~/openhouse-lead-station/client
npm run build
cd ~/openhouse-lead-station
sudo systemctl restart openhouse-kiosk
```

---

## Database Notes (SQLite)

### DB file location on Pi

```bash
/home/piadmin/openhouse-lead-station/server/data/openhouse.db
```

### What is stored in DB

* `settings` (branding, links, QR labels, PIN, reset timer, etc.)
* `visitors` (lead records)

### What is NOT in DB

* Browser offline queue (that lives in the browser until synced)

---

## “All Synced” Meaning (Important)

The admin UI status “All Synced” refers to the **browser/device offline queue**.

It means:

* The browser currently has **0 queued sign-ins** waiting to be submitted to the server.

It does **not** mean:

* Data is synced to a cloud server
* Data is synced to a CRM
* Data is synced to GitHub

The current app is a **local-first kiosk** system.

---

## Admin PIN Recovery (If PIN Is Forgotten)

### Option A (simple): Use `.env` fallback only if DB has no `admin_pin`

This only works before a custom PIN is saved.

### Option B (recommended): Reset the DB setting directly

Use a SQLite command or small Node script to reset `admin_pin`.

Example with sqlite3 CLI (if installed):

```bash
sqlite3 /home/piadmin/openhouse-lead-station/server/data/openhouse.db
```

Then run:

```sql
UPDATE settings SET value='1234' WHERE key='admin_pin';
.quit
```

If the row does not exist:

```sql
INSERT INTO settings(key, value) VALUES ('admin_pin', '1234');
.quit
```

### Option C: Temporary reset route (dev only)

A protected/temporary recovery route can be added, but do not leave this in production.

---

## Common Troubleshooting

### 1) App loads but API fails

Check systemd logs:

```bash
sudo journalctl -u openhouse-kiosk -f
```

Look for:

* Syntax errors in `index.js`
* Missing module errors
* Database issues

### 2) Tablet can’t connect

Verify server startup output shows:

* `Local: http://localhost:8787`
* `Network: http://<ip>:8787`

If no network IP appears:

* Check Wi-Fi/Ethernet connection on Pi
* Run:

  ```bash
  ip addr
  ```

### 3) QR code missing

Check in Admin settings:

* URL is present for that QR item
* Save was clicked
* Test sign-in again (QRs are generated on thank-you screen)

### 4) Book Showing QR not appearing

Usually one of these:

* `book_showing_url` blank
* Frontend not rebuilt after App change
* Old cached frontend still being served

Fix:

```bash
cd ~/openhouse-lead-station/client
npm run build
sudo systemctl restart openhouse-kiosk
```

### 5) PIN change route works but UI doesn’t

Make sure `App.jsx` includes:

* `pinForm` state
* `pinMsg` state
* `changeAdminPin()` function
* Security panel UI block
* API route `/api/admin/change-pin`

---

## Production Hardening (Recommended Next Steps)

### High priority

1. **Session token expiry**

   * Current admin tokens live in memory and never expire until restart
   * Add TTL (e.g. 8 hours)

2. **Better admin auth**

   * PIN is fine for kiosk MVP, but long-term:
   * Add optional username + PIN or username + password

3. **Local image uploads**

   * Hero/agent images currently use URLs
   * If internet is unavailable, remote image URLs may fail
   * Add upload support and store files locally on Pi

4. **Lead backup automation**

   * Add “Export JSON backup” in addition to CSV
   * Optional automatic daily backup file

5. **Event support**

   * Current app is single-event style
   * Add event records (multiple open houses) later if needed

### Nice-to-have

* CRM export formats (KV Core, Follow Up Boss, etc.)
* Email notifications
* Branded PDF export
* Multi-agent profiles
* Remote admin dashboard (cloud-hosted version)

---

## Useful Commands (Pi)

### Service status

```bash
sudo systemctl status openhouse-kiosk
```

### Restart service

```bash
sudo systemctl restart openhouse-kiosk
```

### Follow logs live

```bash
sudo journalctl -u openhouse-kiosk -f
```

### View last 100 log lines

```bash
sudo journalctl -u openhouse-kiosk -n 100 --no-pager
```

### Reboot Pi

```bash
sudo reboot
```

---

## Git / Backup Workflow (Recommended)

### Best practice after making changes

1. Test locally
2. Commit in GitHub Desktop
3. Push to GitHub
4. Pull on Pi
5. Rebuild client (if needed)
6. Restart service
7. Test on tablet

### Backup the database

Copy DB file from Pi:

```bash
scp piadmin@openhousepi.local:/home/piadmin/openhouse-lead-station/server/data/openhouse.db ~/Desktop/openhouse-backup.db
```

---

## Notes for Future AI / Dev Sessions

When asking for help, include:

* Which file you changed (`App.jsx`, `index.js`, `db.js`, `styles.css`)
* Whether issue is frontend or backend
* Whether you ran `npm run build`
* Whether you restarted systemd service
* The exact error (from terminal or browser console)

This speeds up troubleshooting a lot.

````

---

## `SYSTEMD_SERVICE.md`

```md
# SYSTEMD SERVICE

## Raspberry Pi Deployment and Auto-Start Service

This guide explains how to run Open House Lead Station on a Raspberry Pi and make it start automatically on boot using `systemd`.

This is the **deployment/service guide** (server-side).

---

## Overview

The Raspberry Pi runs the Node/Express backend and serves the built frontend.

The app will:
- Start automatically when the Pi boots
- Restart automatically if it crashes
- Be available on the local network at:
  - `http://<pi-ip>:8787`

---

## Assumptions

- Raspberry Pi OS is installed
- You can SSH into the Pi
- Project folder is:
  - `/home/piadmin/openhouse-lead-station`
- Backend entry file is:
  - `/home/piadmin/openhouse-lead-station/server/index.js`

---

## 1) Install Node.js (LTS)

### Check current Node version
```bash
node -v
npm -v
````

If Node is missing or outdated, install Node 20 LTS (recommended).

### Install Node 20 (NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Verify

```bash
node -v
npm -v
```

---

## 2) Clone the Project

```bash
cd /home/piadmin
git clone https://github.com/YOUR-ORG-OR-USER/openhouse-lead-station.git
cd openhouse-lead-station
```

> Replace the GitHub URL with your actual repo URL.

---

## 3) Install Dependencies

### Server dependencies

```bash
cd /home/piadmin/openhouse-lead-station/server
npm install
```

### Client dependencies + build

```bash
cd /home/piadmin/openhouse-lead-station/client
npm install
npm run build
```

This generates:

* `client/dist/`

The server will serve this built frontend automatically.

---

## 4) (Optional) Create `.env` File

Create:

* `/home/piadmin/openhouse-lead-station/server/.env`

Example:

```env
PORT=8787
ADMIN_PIN=1234
```

### Note

* `ADMIN_PIN` is now mainly a **fallback/default**.
* Once PIN is changed in Admin UI, it is stored in SQLite `settings`.

---

## 5) Test Run Manually First

Before creating the service, test the server manually.

```bash
cd /home/piadmin/openhouse-lead-station/server
node index.js
```

You should see output like:

```text
Open House Lead Station API is running
Local:   http://localhost:8787
Network: http://192.168.x.x:8787 (wlan0)
Bind:    http://0.0.0.0:8787
SQLite DB: /home/piadmin/openhouse-lead-station/server/data/openhouse.db
```

Press `Ctrl + C` to stop.

---

## 6) Create systemd Service

Create the service file:

```bash
sudo nano /etc/systemd/system/openhouse-kiosk.service
```

Paste this:

```ini
[Unit]
Description=Open House Lead Station Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=piadmin
Group=piadmin
WorkingDirectory=/home/piadmin/openhouse-lead-station/server
ExecStart=/usr/bin/node /home/piadmin/openhouse-lead-station/server/index.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

# Optional: if you want to force a PATH
# Environment=PATH=/usr/bin:/usr/local/bin

[Install]
WantedBy=multi-user.target
```

Save and exit.

---

## 7) Enable and Start the Service

### Reload systemd

```bash
sudo systemctl daemon-reload
```

### Enable auto-start on boot

```bash
sudo systemctl enable openhouse-kiosk
```

### Start now

```bash
sudo systemctl start openhouse-kiosk
```

---

## 8) Verify Service Status

```bash
sudo systemctl status openhouse-kiosk
```

You should see `active (running)`.

---

## 9) View Logs

### Last 50 lines

```bash
sudo journalctl -u openhouse-kiosk -n 50 --no-pager
```

### Live logs (follow mode)

```bash
sudo journalctl -u openhouse-kiosk -f
```

Useful for debugging after updates.

---

## 10) Find the Pi IP Address

The app now logs local/network addresses automatically on startup.

Example log output:

```text
Local:   http://localhost:8787
Network: http://192.168.8.202:8787 (eth0)
Network: http://192.168.8.119:8787 (wlan0)
```

Use the `Network` IP on your tablet.

---

## 11) Tablet Kiosk Mode Setup (Recommended)

The Pi hosts the app. The tablet opens the app URL.

### Example URL on tablet

```text
http://192.168.8.202:8787
```

---

## Android Tablet Kiosk Setup (Basic)

### Option A: Chrome + full screen

1. Open Chrome
2. Go to the Pi URL
3. Tap menu (`⋮`)
4. Tap **Add to Home screen**
5. Open from home screen
6. Enable screen to stay awake (device settings)

### Option B: Fully Kiosk Browser (best)

Use **Fully Kiosk Browser** (Android app) for a more locked-down setup:

* Launch URL on boot
* Full-screen
* Disable address bar
* Prevent accidental exit
* Screen idle controls

---

## iPad Kiosk Setup (Basic)

### Option A: Safari shortcut

1. Open Safari
2. Go to the Pi URL
3. Share → **Add to Home Screen**
4. Open from the home screen

### Option B: Guided Access (recommended)

Use **Guided Access** to lock the iPad into the app/browser:

1. Settings → Accessibility → Guided Access → On
2. Open Safari to app URL
3. Triple-click side/home button
4. Start Guided Access

This prevents users from leaving the kiosk screen.

---

## 12) Update Process (After Code Changes)

### A) Pull latest code

```bash
cd /home/piadmin/openhouse-lead-station
git pull
```

### B) Rebuild frontend (if client files changed)

```bash
cd /home/piadmin/openhouse-lead-station/client
npm install
npm run build
```

### C) Restart service

```bash
sudo systemctl restart openhouse-kiosk
```

### D) Check logs

```bash
sudo journalctl -u openhouse-kiosk -n 50 --no-pager
```

---

## 13) Common systemd Commands

### Start

```bash
sudo systemctl start openhouse-kiosk
```

### Stop

```bash
sudo systemctl stop openhouse-kiosk
```

### Restart

```bash
sudo systemctl restart openhouse-kiosk
```

### Enable on boot

```bash
sudo systemctl enable openhouse-kiosk
```

### Disable on boot

```bash
sudo systemctl disable openhouse-kiosk
```

### Status

```bash
sudo systemctl status openhouse-kiosk
```

---

## 14) Backup and Cloning for More Units

### Option A (recommended): Clone from GitHub + install

Best for repeatable installs:

* Clone repo to each Pi
* Run install/build
* Use same systemd service file

### Option B: Clone the SD card

You can clone the Pi SD card for faster duplication, but note:

* Hostname may duplicate
* SSH keys may duplicate
* Network settings may need cleanup

If cloning SD cards, update:

* Hostname
* Wi-Fi settings
* Device-specific branding/PIN as needed

---

## 15) Production Recommendations

### Stability

* Keep Pi on wired Ethernet if possible (more stable than Wi-Fi)
* Use a reliable power supply
* Use a high-quality SD card (A1/A2 rated)

### Operations

* Reboot/test before each event
* Export CSV after each event
* Clear leads after export
* Keep a spare Pi and SD card image ready

### Security

* Change default PIN
* Use a private Wi-Fi/hotspot
* Don’t expose the Pi directly to the public internet

---

## 16) Troubleshooting

### Service won’t start

Check logs:

```bash
sudo journalctl -u openhouse-kiosk -n 100 --no-pager
```

Common causes:

* Wrong `ExecStart` path
* Node not installed at `/usr/bin/node`
* Syntax error in `server/index.js`
* Missing dependencies (`npm install` not run)

### Frontend shows old version

You probably changed React files but didn’t rebuild.

Fix:

```bash
cd /home/piadmin/openhouse-lead-station/client
npm run build
sudo systemctl restart openhouse-kiosk
```

### Tablet can’t connect

* Confirm Pi and tablet are on same network
* Use the correct `Network:` IP shown in logs
* Try `ping <pi-ip>` from another device

---

## 17) Current Service Output Example

This is a good/healthy startup example:

```text
Open House Lead Station API is running
Local:   http://localhost:8787
Network: http://192.168.8.202:8787 (eth0)
Network: http://192.168.8.119:8787 (wlan0)
Bind:    http://0.0.0.0:8787
SQLite DB: /home/piadmin/openhouse-lead-station/server/data/openhouse.db
```

* `localhost` = Pi itself
* `Network` = what tablets/computers should use
* `0.0.0.0` = server is listening on all interfaces

---

## 18) Optional Next-Step Improvements

If you want to make deployments even more professional:

* Add **Nginx reverse proxy** (optional)
* Add **HTTPS** (local certificate or cloud-hosted)
* Add **Watchdog** for auto-recovery
* Add **daily DB backup script**
* Add **health-check endpoint monitor**

---

End of document.

```

---

If you want, I can do the next batch the same way (copy/paste-ready):  
- `ARCHITECTURE.md`  
- `AI-ASSISTANT-OVERVIEW.md` (the AI-facing “how this app works” file)  
- `CHANGELOG.md`  
- `LICENSE` (MIT or another license you choose)
::contentReference[oaicite:0]{index=0}
```

```
```

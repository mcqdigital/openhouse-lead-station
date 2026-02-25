# AI Assistant Overview

This document is written specifically for AI assistants (and developers using AI tools) to quickly understand the project, architecture, workflows, and file responsibilities.

## What This App Is

**Open House Lead Station by PropertyConnector** is a self-hosted kiosk app for real estate open houses.

It runs on a local device setup (commonly a Raspberry Pi + tablet) and allows visitors to:

- Sign in at an open house
- Enter contact information
- Answer a few buyer-profile questions
- Give consent for follow-up
- View QR codes for:
  - Listing
  - Feature sheet
  - Similar homes
  - Book showing

It includes a PIN-protected admin interface for the realtor to:

- Update branding and event details
- Change the admin PIN
- Export leads as CSV
- Clear leads (with confirmation and safety checks)
- Monitor device/queue status and recent visitors

The app is designed to continue working even if internet drops:
- Sign-ins can be saved locally
- Offline submissions are queued
- Queue syncs automatically when internet returns

---

## Core Goals

1. **Professional kiosk experience**
   - Fast, clean UI for in-person sign-ins
   - Touch-friendly form controls
   - Strong branding support

2. **Reliable in the field**
   - Works on local network
   - Stores leads in SQLite
   - Handles temporary internet outages

3. **Simple deployment**
   - Raspberry Pi friendly
   - Auto-start on boot using systemd
   - Easy update workflow from GitHub

4. **Future productization**
   - Could be packaged and sold to realtors
   - Multi-event support is possible in future
   - Could evolve into hosted SaaS later

---

## High-Level Architecture

### Frontend
- **React app** (Vite-based)
- Main UI file:
  - `client/src/App.jsx`
- Styling:
  - `client/src/styles.css`
- API helper:
  - `client/src/api.js`
- Offline queue helper:
  - `client/src/offlineQueue.js`

### Backend
- **Node.js + Express**
- Main server:
  - `server/index.js`
- SQLite DB wrapper:
  - `server/db.js`

### Database
- SQLite (local file)
- Path:
  - `server/data/openhouse.db`

### Runtime Model
- Frontend calls backend API routes (`/api/...`)
- Backend stores settings + visitors in SQLite
- Admin auth uses a simple PIN and in-memory tokens
- Tokens reset when server restarts (expected behavior)

---

## File Responsibilities

## Frontend Files

### `client/src/App.jsx`
Main application UI and flow logic.

Key responsibilities:
- Kiosk mode and admin mode switching
- Multi-step sign-in flow
- Validation (name, email, phone)
- Thank-you screen + QR generation
- Auto-reset timer
- Admin dashboard UI
- Admin settings form
- PIN change UI
- Data management UI (export / clear leads)
- Online/offline state display
- Offline queue sync trigger

### `client/src/styles.css`
All UI styling for kiosk and admin.

Key sections:
- Theme variables and base styles
- Kiosk layout
- Hero card
- Form controls
- QR cards
- Admin grid and panels
- Live Summary status pills
- Session header panel
- Responsive layout rules

### `client/src/api.js`
Fetch helpers for API requests.

Typically includes:
- `apiGet()`
- `apiPost()`
- Admin token helpers:
  - `getAdminToken()`
  - `setAdminToken()`
  - `clearAdminToken()`

### `client/src/offlineQueue.js`
Offline queue storage and sync helpers.

Typical responsibilities:
- Save queued sign-ins locally on device
- Read queue count
- Flush queued records to server when online
- Keep data safe during network interruptions

---

## Backend Files

### `server/index.js`
Express server and API routes.

Key responsibilities:
- Serve public config (`/api/public/config`)
- Accept sign-ins (`/api/public/checkin`)
- Admin auth (`/api/admin/login`)
- Admin PIN changes (`/api/admin/change-pin`)
- Admin dashboard status (`/api/admin/status`)
- Admin settings save/load (`/api/admin/settings`)
- Lead list (`/api/admin/visitors`)
- CSV export (`/api/admin/export.csv`)
- Lead clearing (`/api/admin/clear-leads`)
- Serve built frontend in production (`client/dist`)
- Print local/network URLs at startup

### `server/db.js`
SQLite database layer using `better-sqlite3`.

Key responsibilities:
- Create tables if missing
- Seed default settings
- Read/update settings
- Insert visitors
- List visitors
- Return lead stats
- Clear visitors (all leads)

---

## Database Schema Summary

## `settings` table
Stores key/value settings used by kiosk and admin.

Examples:
- `brand_name`
- `agent_name`
- `brokerage_name`
- `property_address`
- `listing_url`
- `feature_sheet_url`
- `similar_homes_url`
- `book_showing_url`
- `qr_listing_title`
- `qr_feature_title`
- `qr_similar_title`
- `qr_book_showing_title`
- `kiosk_reset_seconds`
- `admin_pin`
- `brand_color`
- `accent_color`

## `visitors` table
Stores submitted sign-ins.

Includes:
- Name
- Contact info
- Buyer profile answers
- Consent flags
- Lead score + label
- Source status (`online`, `offline_queued`)
- Timestamp

---

## Important Behaviors AI Should Know

### 1) Admin PIN Source
Admin PIN is read from:
1. `settings.admin_pin` (database)
2. Fallback to `.env` `ADMIN_PIN`
3. Fallback to `"1234"`

This means:
- `.env` is still useful as a fallback/recovery/default
- Once changed in admin UI, DB value overrides `.env`

### 2) “All Synced” meaning
“All Synced” in admin refers to the **device’s offline sign-in queue**.

It does **not** mean:
- synced to a cloud CRM
- synced to Google Sheets
- synced to a remote server

It means:
- no pending offline check-ins remain in local queue storage

### 3) Lead Storage
Leads are stored in local SQLite:
- `server/data/openhouse.db`

Exporting CSV is currently the main backup/export workflow.

### 4) Startup URLs
Server binds to:
- `0.0.0.0` (all network interfaces)

It also logs:
- localhost URL
- LAN IP URLs (eth0 / wlan0) for easy tablet access

### 5) Kiosk Auto-Reset
The thank-you screen resets automatically after `kiosk_reset_seconds` (admin configurable).
Recommended default is 90 seconds.

### 6) QR Cards Auto-Hide
QR cards only render if a corresponding URL exists.
Titles are admin-configurable.

---

## Common AI Tasks for This Project

When helping with this project, AI should be ready to assist with:

### Frontend
- React UI refinements in `App.jsx`
- Touch UX improvements
- Validation tweaks
- Admin dashboard polish
- Responsive layout adjustments in `styles.css`

### Backend
- Express route additions
- Settings schema expansion
- Safer validation and sanitization
- Additional export formats
- Integrations (email, CRM, Zapier/webhooks, etc.)

### Deployment
- Raspberry Pi setup
- systemd service updates
- Kiosk mode browser launch
- Auto-update/redeploy workflow

### Productization
- Multi-event support
- Multi-user access
- Licensing/activation
- White-label branding
- Remote dashboards / cloud sync

---

## Recommended Future Improvements

### Reliability / Ops
- Add automatic DB backup rotation
- Add healthcheck endpoint usage in systemd monitoring
- Add disk space checks
- Add log rotation guidance

### Security
- Hash admin PIN instead of storing plaintext
- Add session expiry for admin tokens
- Add optional “force re-login after X minutes”
- Restrict admin routes to local network (optional mode)

### Product Features
- Multi-event support (event list + active session)
- Email/SMS delivery of feature sheet links
- CRM integrations (webhook, Zapier, Google Sheets)
- Custom lead tags / source tags
- Branded print PDF summary after event

### UX polish
- Branded QR card icons
- Better recent-visitor search/filter
- Duplicate lead warning
- “Last export time” indicator
- “Leads since last clear” metric

---

## Troubleshooting Pointers for AI

If user reports issue, check these first:

### “App loads but no styling”
- Confirm `styles.css` imported in frontend entry point
- Rebuild client (`npm run build`)
- Restart server if serving production build

### “Admin login fails”
- Verify current PIN source:
  - DB `admin_pin` may override `.env`
- Use fallback recovery process (update DB or remove `admin_pin`)
- Confirm admin token header is being sent by frontend

### “Book Showing QR not showing”
- Confirm `book_showing_url` is set in admin
- Confirm QR generation includes `book_showing_url`
- Confirm thank-you screen QR card includes `qrs.bookShowing`
- Confirm QR card auto-hide filter is not removing it due to blank URL

### “All Synced but leads missing”
- “All Synced” only refers to offline queue
- Leads are in SQLite; use admin visitors list or export CSV
- Check `server/data/openhouse.db` path in startup logs

### “Tablet can’t connect”
- Confirm tablet and Pi on same network
- Use `Network: http://<ip>:8787` URL from Pi logs
- Confirm service running: `systemctl status openhouse-kiosk`
- Confirm firewall/router isolation is not blocking LAN clients

---

## AI Editing Rules (Recommended)

When modifying this project:
1. Keep changes minimal and patch-oriented
2. Preserve existing behavior unless requested
3. Prefer clear labels and admin-configurable settings
4. Add comments in backend for new settings/route logic
5. Keep Raspberry Pi deployment in mind (low complexity, local-first)

---

## Project Identity

This project is intended to feel:
- Professional
- Reliable
- Realtor-friendly
- Fast to deploy
- Easy to duplicate for multiple agents/devices

It is a strong candidate for a commercial tool (standalone product or add-on to a larger real estate tech stack).
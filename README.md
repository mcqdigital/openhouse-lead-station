# Open House Lead Station

A polished, offline-friendly **open house sign-in kiosk** for realtors.  
Built for **Raspberry Pi + tablet** deployments, with branded QR links, lead scoring, admin tools, CSV export, and offline queue support.

---

## Features

- ✅ Fast, touch-friendly open house sign-in flow
- ✅ Branded kiosk experience (agent, brokerage, address, colors, hero image)
- ✅ QR codes for:
  - Listing
  - Feature Sheet
  - Similar Homes
  - Book Showing
- ✅ Custom QR titles (editable in Admin)
- ✅ Auto-hide QR cards when links are not configured
- ✅ Adjustable thank-you screen auto-reset timer
- ✅ Lead scoring (Hot / Warm / Nurture)
- ✅ Admin dashboard with:
  - Live summary
  - Recent visitors
  - CSV export
  - Clear Leads (with confirmation)
  - PIN change
- ✅ Offline queue support (captures sign-ins when internet is down)
- ✅ SQLite local database
- ✅ Raspberry Pi auto-start compatible (systemd)
- ✅ Tablet kiosk mode compatible

---

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** SQLite (`better-sqlite3`)
- **QR Codes:** `qrcode`
- **Offline Queue:** browser local queue + auto-sync

---

## Project Structure

```text
openhouse-lead-station/
├─ client/                  # React kiosk/admin frontend
│  ├─ src/
│  │  ├─ App.jsx
│  │  ├─ api.js
│  │  ├─ offlineQueue.js
│  │  └─ styles.css
│  └─ dist/                 # Production build output
├─ server/
│  ├─ index.js              # Express API server
│  ├─ db.js                 # SQLite schema + data access
│  └─ data/
│     └─ openhouse.db       # SQLite database (created automatically)
├─ .env                     # Local environment variables
└─ README.md
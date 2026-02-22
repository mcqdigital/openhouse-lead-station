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
Absolutely. Here’s a **full copy/paste setup guide** to deploy your open house signup app to a **new Raspberry Pi** by **pulling from GitHub** and getting it running for another open house.

---

# Raspberry Pi Setup Guide (Mac Terminal + GitHub Deploy)

This assumes:

* You already have your project on GitHub
* You’re using a Raspberry Pi OS install
* You want it to auto-start on boot
* You’ll access it from a tablet on the same network

---

## 1) Flash the Raspberry Pi SD card (recommended)

Use **Raspberry Pi Imager** on your Mac.

### In Raspberry Pi Imager:

* **OS:** Raspberry Pi OS Lite (64-bit) *(or Desktop if you want kiosk browser on the Pi screen)*
* **Storage:** Your SD card
* Click **Edit Settings** before writing:

  * Set hostname: `openhousepi` (or `openhousepi2`)
  * Enable SSH ✅
  * Username: `piadmin`
  * Set password
  * Configure Wi-Fi (SSID + password) if needed
  * Set locale/timezone

Write the image, insert SD into Pi, power it on.

---

## 2) SSH into the Pi from your Mac

Open Terminal on Mac:

```bash
ssh piadmin@openhousepi.local
```

If `.local` doesn’t work, use the Pi’s IP (from router/app):

```bash
ssh piadmin@192.168.x.x
```

---

## 3) Update the Pi

```bash
sudo apt update && sudo apt upgrade -y
```

Install basic tools:

```bash
sudo apt install -y git curl build-essential
```

---

## 4) Install Node.js (LTS) + npm

Use NodeSource (recommended):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Confirm versions:

```bash
node -v
npm -v
```

---

## 5) Clone your GitHub project

Go to home folder:

```bash
cd /home/piadmin
```

Clone your repo (replace with your actual repo URL if needed):

```bash
git clone https://github.com/mcqdigital/openhouse-lead-station.git
```

Enter project folder:

```bash
cd /home/piadmin/openhouse-lead-station
```

---

## 6) Install project dependencies (server + client)

If your app has separate `server` and `client` folders:

```bash
cd /home/piadmin/openhouse-lead-station/server
npm install
```

```bash
cd /home/piadmin/openhouse-lead-station/client
npm install
```

---

## 7) Build the frontend (client)

From the client folder:

```bash
cd /home/piadmin/openhouse-lead-station/client
npm run build
```

This creates the production build in:

* `client/dist`

Your Express server serves this automatically.

---

## 8) Create the server `.env` file (optional but recommended)

Go to server folder:

```bash
cd /home/piadmin/openhouse-lead-station/server
```

Create `.env`:

```bash
nano .env
```

Paste this (adjust if needed):

```env
PORT=8787
ADMIN_PIN=1234
```

Save and exit:

* `Ctrl + O`, Enter
* `Ctrl + X`

> Note: If you’ve enabled PIN change in the app, the saved PIN in SQLite will override `.env` after first change.

---

## 9) Test-run the app manually (first launch)

From the server folder:

```bash
cd /home/piadmin/openhouse-lead-station/server
node index.js
```

You should see output like:

```bash
Open House Lead Station API is running
Local:   http://localhost:8787
Network: http://192.168.x.x:8787
Bind:    http://0.0.0.0:8787
SQLite DB: /home/piadmin/openhouse-lead-station/server/data/openhouse.db
```

### Test from your Mac or tablet browser:

Open:

```bash
http://192.168.x.x:8787
```

(Use the Pi’s LAN IP shown in terminal)

Stop the app after testing:

```bash
Ctrl + C
```

---

## 10) Set up auto-start on boot (systemd service)

Create a systemd service:

```bash
sudo nano /etc/systemd/system/openhouse-kiosk.service
```

Paste this:

```ini
[Unit]
Description=Open House Lead Station Server
After=network.target

[Service]
Type=simple
User=piadmin
WorkingDirectory=/home/piadmin/openhouse-lead-station/server
ExecStart=/usr/bin/node /home/piadmin/openhouse-lead-station/server/index.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Save and exit.

### Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable openhouse-kiosk.service
sudo systemctl start openhouse-kiosk.service
```

### Check status:

```bash
sudo systemctl status openhouse-kiosk.service
```

### View logs live:

```bash
journalctl -u openhouse-kiosk.service -f
```

---

## 11) (Optional) Auto-open kiosk mode on the Pi screen

If your Pi has a screen attached and you want it to launch fullscreen automatically, use **Raspberry Pi OS Desktop** and Chromium kiosk mode.

### Install desktop + chromium (if not already installed)

```bash
sudo apt install -y --no-install-recommends xserver-xorg x11-xserver-utils xinit openbox chromium-browser
```

### Create autostart folder

```bash
mkdir -p /home/piadmin/.config/openbox
mkdir -p /home/piadmin/.config/lxsession/LXDE-pi
```

### Create Openbox autostart file

```bash
nano /home/piadmin/.config/openbox/autostart
```

Paste:

```bash
xset -dpms
xset s off
xset s noblank

sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' /home/piadmin/.config/chromium/Default/Preferences 2>/dev/null
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' /home/piadmin/.config/chromium/Default/Preferences 2>/dev/null

chromium-browser --noerrdialogs --disable-infobars --kiosk http://localhost:8787
```

Save and exit.

### Enable auto-login to desktop (if needed)

Run:

```bash
sudo raspi-config
```

Go to:

* **System Options**
* **Boot / Auto Login**
* Choose **Desktop Autologin**

Reboot:

```bash
sudo reboot
```

Now the Pi should boot into kiosk mode automatically.

---

# Updating the app later (GitHub → Pi)

When you make changes on your Mac and push to GitHub, update the Pi like this:

## On the Pi:

```bash
cd /home/piadmin/openhouse-lead-station
git pull
```

If frontend changes were made:

```bash
cd /home/piadmin/openhouse-lead-station/client
npm install
npm run build
```

If server dependencies changed:

```bash
cd /home/piadmin/openhouse-lead-station/server
npm install
```

Restart the service:

```bash
sudo systemctl restart openhouse-kiosk.service
```

Check logs:

```bash
journalctl -u openhouse-kiosk.service -f
```

---

# Backing up / restoring data (important)

Your leads and settings are stored in:

```bash
/home/piadmin/openhouse-lead-station/server/data/openhouse.db
```

## Backup the database on the Pi:

```bash
cp /home/piadmin/openhouse-lead-station/server/data/openhouse.db /home/piadmin/openhouse-lead-station/server/data/openhouse-backup-$(date +%F-%H%M).db
```

## Copy backup to your Mac (from Mac terminal):

```bash
scp piadmin@openhousepi.local:/home/piadmin/openhouse-lead-station/server/data/openhouse.db ~/Downloads/openhouse.db
```

---

# Quick troubleshooting commands (Pi)

### Check service status

```bash
sudo systemctl status openhouse-kiosk.service
```

### Restart app

```bash
sudo systemctl restart openhouse-kiosk.service
```

### Watch logs

```bash
journalctl -u openhouse-kiosk.service -f
```

### See Pi IP addresses

```bash
hostname -I
```

### Test server locally on Pi

```bash
curl http://localhost:8787/api/health
```

---

# Optional pro upgrades (recommended)

These will make it more production-ready if you sell this later:

* **Static IP reservation** in router (so tablet URL doesn’t change)
* **Branded hostname** (e.g. `openhouse1.local`)
* **USB backup script** for CSV/database after each event
* **HTTPS local reverse proxy** (not required for LAN use, but nice)
* **Daily database backup cron**
* **UPS battery** for Pi (prevents corruption from power loss)

---

If you want, I can also give you a **single “New Pi Setup Checklist” version** (shorter, print-friendly) and a **“Update Existing Pi” mini guide** you can keep in your project docs.



Perfect — here are **both**:

1. a **copy/paste Raspberry Pi setup + deployment guide** (from GitHub)
2. a **repeatable update workflow** for future app changes

I’m also including a **ready-to-use systemd service file** and a **quick clone/restore method** so you can spin up more units fast.

---

# 1) New Raspberry Pi Setup (from GitHub) — Full Step-by-Step

## A. Prep the Raspberry Pi (OS + basics)

### On your Mac (flash SD card)

Use **Raspberry Pi Imager** and set:

* **OS:** Raspberry Pi OS Lite (64-bit) *(recommended for kiosk server + stability)*
* **Hostname:** `openhousepi` (or `openhousepi2`, etc.)
* **Username:** `piadmin`
* **Password:** choose a strong one
* **Wi-Fi:** set SSID/password (optional if using Ethernet)
* **Enable SSH:** **Yes**
* **Locale/timezone:** set to your local timezone

---

## B. SSH into the Pi from Mac Terminal

```bash
ssh piadmin@openhousepi.local
```

If mDNS/`.local` doesn’t resolve, use the IP address from your router.

---

## C. Update the Pi and install essentials

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential
```

---

## D. Install Node.js (LTS, recommended)

Use NodeSource (reliable and current LTS):

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

Check versions:

```bash
node -v
npm -v
```

---

## E. Clone your app from GitHub

Go to your home folder and clone:

```bash
cd /home/piadmin
git clone https://github.com/mcqdigital/openhouse-lead-station.git
cd openhouse-lead-station
```

If your repo is private, use your GitHub auth method (PAT or SSH key).

---

## F. Install dependencies (server + client)

```bash
cd /home/piadmin/openhouse-lead-station/server
npm install

cd /home/piadmin/openhouse-lead-station/client
npm install
```

---

## G. Build the client (production frontend)

```bash
cd /home/piadmin/openhouse-lead-station/client
npm run build
```

This creates:

```bash
/home/piadmin/openhouse-lead-station/client/dist
```

Your `server/index.js` serves this automatically.

---

## H. Create the server `.env` file

Create/edit:

```bash
nano /home/piadmin/openhouse-lead-station/server/.env
```

Paste this (adjust if needed):

```env
PORT=8787
ADMIN_PIN=1234
```

Save:

* `Ctrl + O` then Enter
* `Ctrl + X`

> Note: Your app now supports changing the PIN in admin, and it stores that in SQLite settings. `.env` is still the fallback/default.

---

## I. Test run the app manually (first run)

```bash
cd /home/piadmin/openhouse-lead-station/server
node index.js
```

You should see output like:

```bash
Open House Lead Station API is running
Local:   http://localhost:8787
Network: http://192.168.x.x:8787 (eth0)
Bind:    http://0.0.0.0:8787
SQLite DB: /home/piadmin/openhouse-lead-station/server/data/openhouse.db
```

Press `Ctrl + C` to stop after confirming it works.

---

# 2) Auto-start on Boot (systemd service)

## A. Create the service file

```bash
sudo nano /etc/systemd/system/openhouse-kiosk.service
```

Paste this exactly:

```ini
[Unit]
Description=Open House Lead Station Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=piadmin
WorkingDirectory=/home/piadmin/openhouse-lead-station/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /home/piadmin/openhouse-lead-station/server/index.js
Restart=always
RestartSec=3

# Logs go to journalctl
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Save and exit.

---

## B. Enable + start service

```bash
sudo systemctl daemon-reload
sudo systemctl enable openhouse-kiosk.service
sudo systemctl start openhouse-kiosk.service
```

Check status:

```bash
sudo systemctl status openhouse-kiosk.service
```

View live logs:

```bash
journalctl -u openhouse-kiosk.service -f
```

---

# 3) Tablet Kiosk Mode (open directly to app)

You have 2 common options:

---

## Option A (easiest): Use a browser on the tablet and pin the URL

On the tablet, open:

* `http://192.168.x.x:8787`

(Use the **Pi LAN IP** shown in terminal logs, e.g. `http://192.168.8.202:8787`)

Then:

### iPad (Safari)

* Open URL
* Tap **Share**
* **Add to Home Screen**
* Launch from icon
* Turn on **Guided Access** (optional, locks to app)

  * Settings → Accessibility → Guided Access

### Android (Chrome)

* Open URL
* Tap menu (⋮)
* **Add to Home screen**
* Launch from icon
* Use **Screen Pinning** or a kiosk app for lock-down

This works great if the tablet is on the same Wi-Fi/Ethernet network as the Pi.

---

## Option B (best “appliance” setup): Tablet opens kiosk URL automatically

If using a managed Android tablet, use a kiosk browser app (Fully Kiosk Browser, etc.) and set home URL to:

```txt
http://192.168.x.x:8787
```

This gives auto-launch + screen-on + locked-down behavior.

---

# 4) Repeatable Update Workflow (Mac → GitHub → Pi)

This is the clean “production” flow.

---

## A. On your Mac (edit and commit)

### 1) Open project and make changes

Edit in VS Code as usual.

### 2) If frontend changed, test locally

In your project root (or client folder depending on your setup):

```bash
cd /path/to/openhouse-lead-station/client
npm install
npm run dev
```

### 3) Commit and push with GitHub Desktop

In **GitHub Desktop**:

* Review changed files
* Add commit message
* **Commit to main**
* **Push origin**

(Or terminal if you prefer:)

```bash
git add .
git commit -m "Your update message"
git push origin main
```

---

## B. On the Raspberry Pi (pull + rebuild + restart)

SSH into the Pi:

```bash
ssh piadmin@openhousepi.local
```

Then run this sequence:

```bash
cd /home/piadmin/openhouse-lead-station
git pull origin main

cd /home/piadmin/openhouse-lead-station/server
npm install

cd /home/piadmin/openhouse-lead-station/client
npm install
npm run build

sudo systemctl restart openhouse-kiosk.service
sudo systemctl status openhouse-kiosk.service --no-pager
```

That’s it.

---

# 5) Fast “one command” update script on the Pi (recommended)

Create a helper script so future updates are easy.

## A. Create script

```bash
nano /home/piadmin/openhouse-lead-station/update-and-restart.sh
```

Paste:

```bash
#!/bin/bash
set -e

echo "== Open House Lead Station Update =="

cd /home/piadmin/openhouse-lead-station
git pull origin main

echo "== Installing server deps =="
cd /home/piadmin/openhouse-lead-station/server
npm install

echo "== Installing client deps + build =="
cd /home/piadmin/openhouse-lead-station/client
npm install
npm run build

echo "== Restarting service =="
sudo systemctl restart openhouse-kiosk.service

echo "== Service status =="
sudo systemctl status openhouse-kiosk.service --no-pager

echo "== Done =="
```

Make it executable:

```bash
chmod +x /home/piadmin/openhouse-lead-station/update-and-restart.sh
```

## B. Use it anytime

```bash
/home/piadmin/openhouse-lead-station/update-and-restart.sh
```

---

# 6) Backing up the database (important)

Your leads and admin settings are stored in:

```bash
/home/piadmin/openhouse-lead-station/server/data/openhouse.db
```

## Manual backup command (Pi)

```bash
cp /home/piadmin/openhouse-lead-station/server/data/openhouse.db /home/piadmin/openhouse-lead-station/server/data/openhouse-$(date +%Y%m%d-%H%M%S).db
```

## Copy backup to Mac (from Mac Terminal)

```bash
scp piadmin@openhousepi.local:/home/piadmin/openhouse-lead-station/server/data/openhouse.db ~/Downloads/openhouse.db
```

---

# 7) Duplicating for more units (best practice)

You asked if you can duplicate SD cards — yes, and that works. But for cleaner scaling:

### Better approach

* Keep one “golden” Pi image or setup checklist
* Clone repo from GitHub on each Pi
* Use same service file
* Restore settings by either:

  * importing/replacing the `openhouse.db`, or
  * re-entering settings in admin panel

### Quick clone of database/settings to another Pi

From old Pi → new Pi (after app is installed):

```bash
scp piadmin@OLDPI.local:/home/piadmin/openhouse-lead-station/server/data/openhouse.db \
    piadmin@NEWPI.local:/home/piadmin/openhouse-lead-station/server/data/openhouse.db
```

Then restart service on the new Pi:

```bash
ssh piadmin@NEWPI.local
sudo systemctl restart openhouse-kiosk.service
```

---

# 8) Useful Commands (Pi)

## Check service status

```bash
sudo systemctl status openhouse-kiosk.service
```

## Follow logs live

```bash
journalctl -u openhouse-kiosk.service -f
```

## Restart app

```bash
sudo systemctl restart openhouse-kiosk.service
```

## Stop/start app

```bash
sudo systemctl stop openhouse-kiosk.service
sudo systemctl start openhouse-kiosk.service
```

## Reboot Pi

```bash
sudo reboot
```

---

# 9) What starts automatically after reboot?

Since you enabled the systemd service:

* ✅ Node server starts automatically
* ✅ App serves on port `8787`
* ✅ SQLite DB remains on disk
* ✅ Settings and leads remain available

What **doesn’t** auto-start by itself:

* The tablet browser page (unless you use a kiosk browser / home-screen shortcut / device management)

---

# 10) Professional “field-ready” tips (high value)

A few things that make this more reliable when you’re using it for real clients:

### Network reliability

* Prefer **Ethernet** to Pi when possible
* If Wi-Fi, reserve a static IP in router DHCP (so tablet URL stays the same)

### Power reliability

* Use a quality Pi power supply
* Consider a small UPS battery pack if power blips happen at open houses

### Security

* Change default `ADMIN_PIN`
* Change Pi user password
* Don’t expose port 8787 to the public internet

### Tablet

* Enable auto-lock off during event
* Set brightness fixed
* Use Guided Access / Screen Pinning

### Operations

* Export CSV after each open house
* Use **Clear Leads** after backup/export
* Keep one spare Pi + SD card ready

---

If you want, I can also give you a **single master “Pi Setup Checklist” markdown file** next (copy/paste ready) that you can keep in your repo and use every time you build a new unit.

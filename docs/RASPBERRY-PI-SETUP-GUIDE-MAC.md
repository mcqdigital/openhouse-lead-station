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

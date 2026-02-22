# Changelog

All notable changes to this project will be documented in this file.

This project follows a practical changelog format inspired by Keep a Changelog and Semantic Versioning.

## [Unreleased]

### Added
- Admin-configurable QR titles:
  - Listing
  - Feature Sheet
  - Similar Homes
  - Book Showing
- Auto-hide QR cards when no URL is configured
- Admin-configurable thank-you screen auto-reset timer (`kiosk_reset_seconds`)
- Admin PIN change flow in the admin UI
- Admin route to securely change PIN (`/api/admin/change-pin`)
- Lead export to CSV (`/api/admin/export.csv`)
- Lead clearing flow with confirmation (`CLEAR`) and queue safety check
- Session header panel in admin with:
  - Property address
  - Agent/brokerage
  - Device hostname
  - Session lead count
  - Online/offline + sync status pills
- Live admin status improvements:
  - Last updated time
  - Queue state
  - Device status
- Offline queue sync banner in kiosk mode
- Server startup logs for:
  - Local URL
  - Network URL(s)
  - Bind URL
  - SQLite DB path

### Changed
- Improved thank-you screen QR rendering logic to support dynamic titles and hidden cards
- Improved server-side settings handling for QR title fields and reset timer
- Admin PIN source now supports DB-stored PIN with `.env` fallback
- Better production-ready startup logs on Raspberry Pi

### Fixed
- Book Showing QR not appearing due to missing end-screen QR rendering support
- Route catch-all serving issue for non-API paths (production static serving)
- Input validation and formatting consistency for phone numbers and names

---

## [0.1.0] - 2026-02-22

### Added
- Initial Open House Lead Station release
- Kiosk sign-in flow with multi-step form
- Local SQLite storage (`better-sqlite3`)
- Admin dashboard (PIN-protected)
- Branding and event settings
- Lead scoring (Hot / Warm / Nurture)
- Offline queue support and automatic sync retry
- Raspberry Pi deployment support
- Auto-start via systemd
- Tablet kiosk-mode usage with browser auto-launch
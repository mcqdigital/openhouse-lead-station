# Offline Image Caching Plan (Hero + Agent Photo)

This note explains how to keep admin-configured image URLs available when internet is unavailable.

## Goal

Allow admins to keep entering remote image URLs, but have the app download a local cached copy that is used offline.

## Recommended approach

## 1) Keep URL fields as-is
- Continue saving:
  - `hero_image_url`
  - `agent_photo_url`

This preserves current admin workflow.

## 2) Add server-managed local cache folder
- Create folder: `server/data/media-cache/`
- Store downloaded files there (e.g. `hero.jpg`, `agent.jpg`).

## 3) Download on settings save
When admin saves settings:
1. Validate URL starts with `http://` or `https://`
2. Server fetches the file
3. Enforce safety checks:
   - content type is image/*
   - max size (e.g. 5 MB)
   - request timeout (e.g. 10 s)
4. Save file to cache folder
5. Store/update extra settings keys:
   - `hero_image_cached_path`
   - `agent_photo_cached_path`

If download fails, keep existing cached file (if present).

## 4) Serve cached media from Express
- Add route like:
  - `GET /media-cache/:file`
- Use `express.static` for only the cache directory.

## 5) Frontend fallback logic
For each image, attempt in this order:
1. Cached local path (`/media-cache/...`)
2. Remote URL from settings
3. Existing fallback UI (initials / no background image)

This makes kiosk resilient when internet drops.

## 6) Replacement behavior when URL changes
Yes—this works well:
- On new URL, download and overwrite prior cache file (or version by hash and switch pointer).
- Optionally delete old cache files if hash/version strategy is used.

---

## Effort estimate

## Minimal reliable version
- **~4 to 8 hours**
- Includes:
  - download + validation
  - local storage
  - route serving
  - frontend fallback wiring

## Production-hardened version
- **~1 to 2 days**
- Adds:
  - stricter MIME sniffing
  - retry/backoff
  - log messages/admin feedback
  - cleanup policy for stale cache files

---

## Security and reliability notes

- Never allow arbitrary file path writes; only write inside fixed cache directory.
- Restrict allowed schemes (`http`, `https`) and follow a small redirect limit.
- Enforce max size and timeout to avoid hanging or memory abuse.
- Consider disallowing private network targets if this is ever internet-exposed.

---

## Optional: fully offline-first import mode

If you ever want stronger offline behavior, add an "Upload image" option in admin:
- uploads file directly to Pi/app storage
- no dependency on external URL availability

This can coexist with URL mode.
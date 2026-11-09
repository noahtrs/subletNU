# Admin Scripts

This directory contains administrative scripts for managing the SubletNU platform.

## Files

### admin-fix-heic.mjs
Converts HEIC images to JPEG for existing listings. Requires `VITE_SUPABASE_SERVICE_ROLE_KEY` in `.env`.

Usage:
```bash
node scripts/admin-fix-heic.mjs
```

### compress-existing-photos.mjs
One-time backfill that shrinks listing photos uploaded before the app compressed photos in the browser. Resizes each oversized photo to fit 1600x1600, re-encodes it as JPEG under a new `<name>_c.jpg` path, and updates the listing's `photos`. Dry run by default; originals are kept unless `--delete-originals` is passed. Writes an old→new URL log (`compress-photos-log-*.json`) when applying.

Needs `SUPABASE_SERVICE_ROLE_KEY` (no `VITE_` prefix) in `.env` and `sharp`, which isn't a project dependency:
```bash
npm install --no-save sharp
node scripts/compress-existing-photos.mjs                      # dry run: shows what would change
node scripts/compress-existing-photos.mjs --apply --limit 1    # try it on one listing
node scripts/compress-existing-photos.mjs --apply              # convert everything (keeps originals)
node scripts/compress-existing-photos.mjs --apply --delete-originals  # also remove unused originals
```
Also accepts `--listing <id>` to target one listing. Safe to re-run.

### check-images.mjs
Diagnostic tool to check image URLs and storage bucket configuration for a specific listing.

Usage:
```bash
node scripts/check-images.mjs
```

### fix-heic-listing.mjs
Displays manual instructions for fixing HEIC images in listings.

### debug-listing.js
Legacy debug script for listing investigation.

## Requirements

All scripts require environment variables in `.env`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SERVICE_ROLE_KEY` (for admin scripts)

## Security

**Never commit the service role key to version control.** It should only exist in `.env` locally.

# Admin Scripts

This directory contains administrative scripts for managing the SubletNU platform.

## Files

### admin-fix-heic.mjs
Converts HEIC images to JPEG for existing listings. Requires a Supabase **secret key** (`sb_secret_...`, Dashboard → Settings → API Keys) in `.env` as `SUPABASE_SECRET_KEY` (never with a `VITE_` prefix). A legacy `service_role` key in `SUPABASE_SERVICE_ROLE_KEY` also works until Supabase retires those keys (end of 2026).

Usage:
```bash
node scripts/admin-fix-heic.mjs
```

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
- `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_...`; the old `VITE_SUPABASE_ANON_KEY` name is still read as a fallback)
- `SUPABASE_SECRET_KEY` (`sb_secret_...`, admin scripts only)

## Security

**Never commit the secret key to version control or give it a `VITE_` prefix** (Vite inlines `VITE_*` vars into the public bundle). It should only exist in `.env` locally.

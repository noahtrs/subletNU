# Admin Scripts

This directory contains administrative scripts for managing the SubletNU platform.

## Files

### admin-fix-heic.mjs
Converts HEIC images to JPEG for existing listings. Requires `VITE_SUPABASE_SERVICE_ROLE_KEY` in `.env`.

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
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SERVICE_ROLE_KEY` (for admin scripts)

## Security

**Never commit the service role key to version control.** It should only exist in `.env` locally.

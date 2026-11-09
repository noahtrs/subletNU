// One-time backfill: shrink listing photos that were uploaded before the app
// started compressing photos in the browser (see src/lib/imageCompression.ts).
//
// For each photo in the `sublet-photos` bucket that is larger than needed, this
// downloads it, resizes it to fit 1600x1600 (same as the upload path), re-encodes
// it as JPEG, uploads it under a NEW path (`<name>_c.jpg`) with a one-year cache
// header, and swaps the URL in the listing's `photos` array.
//
// Safe by default:
//   - Dry run unless you pass --apply (prints what it would do and the savings).
//   - Originals are kept unless you pass --delete-originals, so you can roll back
//     by restoring the old URLs from the log file this script writes.
//   - Re-reads each listing right before updating it and only replaces the URLs
//     it converted, so an edit made by the owner mid-run isn't overwritten.
//   - Safe to re-run: already-compressed photos (`_c.jpg`) and small photos are skipped.
//
// Setup (sharp is not a project dependency, so deploys stay lean):
//   npm install --no-save sharp
//   # .env (gitignored) needs:
//   #   VITE_SUPABASE_URL=https://<ref>.supabase.co     (or SUPABASE_URL)
//   #   SUPABASE_SECRET_KEY=sb_secret_...               (Dashboard → Settings → API Keys)
//   # The secret key bypasses Row Level Security, which the script needs to update
//   # other users' listings. Never give it a VITE_ prefix (Vite can ship VITE_* vars
//   # to the browser). The legacy service_role JWT in SUPABASE_SERVICE_ROLE_KEY is
//   # also accepted, but Supabase is deprecating it by the end of 2026.
//
// Usage:
//   node scripts/compress-existing-photos.mjs                     # dry run, all listings
//   node scripts/compress-existing-photos.mjs --listing <id>      # dry run, one listing
//   node scripts/compress-existing-photos.mjs --apply --limit 1   # convert one listing to try it out
//   node scripts/compress-existing-photos.mjs --apply             # convert everything
//   node scripts/compress-existing-photos.mjs --apply --delete-originals

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';

config();

const BUCKET = 'sublet-photos';
const MAX_DIMENSION = 1600; // keep in sync with src/lib/imageCompression.ts
const JPEG_QUALITY = 82;
// Photos already within MAX_DIMENSION and under this size are left alone.
const SKIP_UNDER_BYTES = 400 * 1024;
const COMPRESSED_SUFFIX = '_c.jpg';

// --- args -------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};

const APPLY = flag('--apply');
const DELETE_ORIGINALS = flag('--delete-originals');
const ONLY_LISTING = option('--listing');
const LIMIT = option('--limit') ? Number(option('--limit')) : Infinity;

if (DELETE_ORIGINALS && !APPLY) {
  console.error('--delete-originals only makes sense with --apply');
  process.exit(1);
}
if (Number.isNaN(LIMIT) || LIMIT < 1) {
  console.error('--limit must be a positive number');
  process.exit(1);
}

// --- setup ------------------------------------------------------------------

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('sharp is not installed. Run: npm install --no-save sharp');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !secretKey) {
  console.error('Missing VITE_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SECRET_KEY in .env.');
  console.error('Create/copy a secret key (sb_secret_...) under Settings → API Keys in the Supabase dashboard.');
  process.exit(1);
}

/** Role claimed by a legacy JWT key (anon / service_role), or null if it isn't one. */
const legacyJwtRole = (key) => {
  if (!key.startsWith('eyJ')) return null;
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role ?? null;
  } catch {
    return null;
  }
};

// A publishable/anon key would let the dry run "succeed" (listings and photos
// are public) and then fail on every write, so reject it up front.
if (secretKey.startsWith('sb_publishable_') || legacyJwtRole(secretKey) === 'anon') {
  console.error('That is a publishable (or legacy anon) key, which can only do what Row Level Security allows.');
  console.error('This script needs a secret key (sb_secret_...) from Settings → API Keys in the Supabase dashboard.');
  process.exit(1);
}
if (legacyJwtRole(secretKey) === 'service_role') {
  console.log('Note: using a legacy service_role key. Supabase is deprecating these by the end of 2026; prefer SUPABASE_SECRET_KEY=sb_secret_...\n');
}

// This script never uses Realtime, but supabase-js builds a Realtime client up
// front and, on Node < 22 (no built-in WebSocket), throws "native WebSocket not
// found". Give it a placeholder so the script runs on older Node too.
class RealtimeNotUsed {
  constructor() {
    throw new Error('Realtime is not used by this script');
  }
}

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: RealtimeNotUsed },
});

const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

/** Storage path inside the bucket for one of our public URLs, or null for anything else. */
const storagePathFromUrl = (url) => {
  try {
    const { pathname } = new URL(url);
    const i = pathname.indexOf(PUBLIC_PREFIX);
    return i === -1 ? null : decodeURIComponent(pathname.slice(i + PUBLIC_PREFIX.length));
  } catch {
    return null;
  }
};

const compressedPathFor = (path) => path.replace(/\.[^./]+$/, '') + COMPRESSED_SUFFIX;

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

// --- per-photo work ---------------------------------------------------------

/**
 * Returns { status: 'skip', reason } or { status: 'convert', newPath, newUrl, before, after }.
 * In dry-run mode nothing is uploaded.
 */
async function processPhoto(url) {
  const path = storagePathFromUrl(url);
  if (!path) return { status: 'skip', reason: 'not in the sublet-photos bucket' };
  if (path.endsWith(COMPRESSED_SUFFIX)) return { status: 'skip', reason: 'already compressed' };

  const response = await fetch(url);
  if (!response.ok) return { status: 'skip', reason: `download failed (${response.status})` };
  const original = Buffer.from(await response.arrayBuffer());

  let meta;
  try {
    meta = await sharp(original).metadata();
  } catch (error) {
    return { status: 'skip', reason: `unreadable image (${error.message})` };
  }
  if ((meta.pages ?? 1) > 1) return { status: 'skip', reason: 'animated image' };

  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (longest <= MAX_DIMENSION && original.length <= SKIP_UNDER_BYTES) {
    return { status: 'skip', reason: `already small (${meta.width}x${meta.height}, ${kb(original.length)})` };
  }

  const compressed = await sharp(original)
    .rotate() // apply EXIF orientation so phone photos stay upright
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' }) // JPEG has no transparency
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  if (compressed.length >= original.length * 0.9) {
    return { status: 'skip', reason: `compression saves <10% (${kb(original.length)})` };
  }

  const newPath = compressedPathFor(path);
  const newUrl = supabase.storage.from(BUCKET).getPublicUrl(newPath).data.publicUrl;

  if (APPLY) {
    const { error } = await supabase.storage.from(BUCKET).upload(newPath, compressed, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: true, // a previous interrupted run may have uploaded it already
    });
    if (error) return { status: 'skip', reason: `upload failed (${error.message})` };
  }

  return { status: 'convert', path, newPath, newUrl, before: original.length, after: compressed.length };
}

// --- main -------------------------------------------------------------------

async function main() {
  // Confirm the key really has admin access before doing anything: only an
  // elevated key can list storage buckets, so a wrong key shows up here.
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError || !buckets?.some((b) => b.name === BUCKET)) {
    console.error(`Could not confirm admin access to the "${BUCKET}" bucket${bucketsError ? ` (${bucketsError.message})` : ''}.`);
    console.error('Check that SUPABASE_SECRET_KEY is a secret key (sb_secret_...) for this project and that the URL is right.');
    process.exit(1);
  }

  console.log(APPLY ? 'APPLY mode — photos and listings will be updated.' : 'DRY RUN — nothing will be changed. Pass --apply to convert.');
  if (DELETE_ORIGINALS) console.log('Originals no longer used by any listing will be deleted at the end.');
  console.log('');

  let query = supabase.from('sublets').select('id, photos').order('created_at', { ascending: false });
  if (ONLY_LISTING) query = query.eq('id', ONLY_LISTING);
  const { data: listings, error } = await query;
  if (error) throw error;

  const log = []; // { listingId, oldUrl, newUrl, before, after }
  let listingsChanged = 0;
  let totalBefore = 0;
  let totalAfter = 0;
  let skipped = 0;
  const originalsToDelete = new Map(); // oldUrl -> storage path

  for (const listing of listings) {
    if (listingsChanged >= LIMIT) break;
    const photos = Array.isArray(listing.photos) ? listing.photos : [];
    if (photos.length === 0) continue;

    console.log(`Listing ${listing.id} (${photos.length} photo${photos.length === 1 ? '' : 's'})`);
    const replacements = new Map(); // oldUrl -> result
    for (const url of photos) {
      let result;
      try {
        result = await processPhoto(url);
      } catch (error) {
        result = { status: 'skip', reason: `error (${error.message})` };
      }
      const name = url.split('/').pop();
      if (result.status === 'convert') {
        console.log(`  ✓ ${name}: ${kb(result.before)} → ${kb(result.after)}`);
        replacements.set(url, result);
      } else {
        console.log(`  - ${name}: skipped, ${result.reason}`);
        skipped++;
      }
    }

    if (replacements.size === 0) continue;
    listingsChanged++;

    if (APPLY) {
      // Re-read so an edit made while we were converting isn't clobbered.
      const { data: fresh, error: readError } = await supabase
        .from('sublets').select('photos').eq('id', listing.id).single();
      if (readError || !fresh) {
        console.log(`  ! could not re-read listing, leaving it unchanged (${readError?.message})`);
        continue;
      }
      const updatedPhotos = fresh.photos.map((url) => replacements.get(url)?.newUrl ?? url);
      const { error: updateError } = await supabase
        .from('sublets').update({ photos: updatedPhotos }).eq('id', listing.id);
      if (updateError) {
        console.log(`  ! listing update failed, leaving it unchanged (${updateError.message})`);
        continue;
      }
      // Only count/log what actually made it into the listing.
      const applied = [...replacements].filter(([oldUrl]) => fresh.photos.includes(oldUrl));
      for (const [oldUrl, r] of applied) {
        log.push({ listingId: listing.id, oldUrl, newUrl: r.newUrl, before: r.before, after: r.after });
        totalBefore += r.before;
        totalAfter += r.after;
      }
      console.log(`  ✓ listing updated (${applied.length} photo${applied.length === 1 ? '' : 's'})`);

      applied.forEach(([oldUrl, r]) => originalsToDelete.set(oldUrl, r.path));
    } else {
      for (const [oldUrl, r] of replacements) {
        log.push({ listingId: listing.id, oldUrl, newUrl: r.newUrl, before: r.before, after: r.after });
        totalBefore += r.before;
        totalAfter += r.after;
      }
    }
  }

  console.log('');
  console.log(`${APPLY ? 'Converted' : 'Would convert'} ${log.length} photo(s) across ${listingsChanged} listing(s); skipped ${skipped}.`);
  if (log.length > 0) {
    console.log(`Total size: ${kb(totalBefore)} → ${kb(totalAfter)} (${Math.round((1 - totalAfter / totalBefore) * 100)}% smaller)`);
  }

  // Delete originals last, and only ones no listing still points at (e.g. if
  // two listings ever share a photo, or an owner re-added it mid-run).
  if (DELETE_ORIGINALS && originalsToDelete.size > 0) {
    const { data: all, error: allError } = await supabase.from('sublets').select('photos');
    if (allError) {
      console.log(`Could not re-check listings, so originals were NOT deleted (${allError.message}).`);
    } else {
      const stillUsed = new Set(all.flatMap((row) => row.photos ?? []));
      const paths = [...originalsToDelete].filter(([url]) => !stillUsed.has(url)).map(([, path]) => path);
      const kept = originalsToDelete.size - paths.length;
      for (let i = 0; i < paths.length; i += 100) {
        const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
        if (removeError) console.log(`Could not delete some originals (${removeError.message}).`);
      }
      console.log(`Deleted ${paths.length} original(s)${kept ? `; kept ${kept} still referenced by a listing` : ''}.`);
    }
  }

  if (APPLY && log.length > 0) {
    const file = `compress-photos-log-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeFileSync(file, JSON.stringify(log, null, 2));
    console.log(`Old → new URL mapping written to ${file}${DELETE_ORIGINALS ? '' : ' (originals kept, so this can be used to roll back)'}.`);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

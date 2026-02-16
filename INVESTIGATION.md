# Image Loading Investigation for Listing 2188e736-09e6-4c66-80ea-3580e141e3e6

## Problem
Images are not loading for the listing at: https://subletnu.com/sublet/2188e736-09e6-4c66-80ea-3580e141e3e6

## Investigation Steps

### 1. Access Debug Page (Admin Only)
**Note:** This page is protected and only accessible to admin users listed in ADMIN_EMAILS.

Visit: http://localhost:5173/debug-images
This will show:
- The listing data from Supabase
- Each photo URL and whether it's accessible
- HTTP status codes for each image
- Storage bucket configuration

### 2. Check Supabase Dashboard

**Direct Access:**
1. Log into Supabase Dashboard: https://supabase.com/dashboard
2. Select your project

**Check Storage Configuration:**
1. Go to **Storage** in the left sidebar
2. Click on **sublet-photos** bucket
3. Check if the bucket is PUBLIC:
   - Look for "Public" badge or toggle
   - If not public, images won't load

**Check Policies:**
1. In Storage → sublet-photos → Policies
2. You should see a policy allowing public SELECT/READ
3. Example policy needed:
   ```sql
   CREATE POLICY "Public Access"
   ON storage.objects FOR SELECT
   USING ( bucket_id = 'sublet-photos' );
   ```

**Check Files:**
1. Browse the files in the sublet-photos bucket
2. Look for files that might belong to this listing
3. Try to view/download them to verify they exist

**Check the Database:**
1. Go to **Table Editor** in left sidebar
2. Select the **sublets** table
3. Find the row with id = `2188e736-09e6-4c66-80ea-3580e141e3e6`
4. Look at the `photos` column - it should contain an array of URLs
5. Copy one of the URLs and try to access it directly in a browser

### 3. Common Issues & Solutions

#### Issue 1: Bucket Not Public
**Symptom:** All images return 403 or 400 errors
**Solution:**
1. Storage → sublet-photos → Settings
2. Enable "Public bucket"
3. Or add policy: Allow SELECT for authenticated and anon roles

#### Issue 2: Broken URLs
**Symptom:** Photos array contains malformed URLs
**Expected Format:**
```
https://[project-ref].supabase.co/storage/v1/object/public/sublet-photos/[user-id]/[filename]
```
**Solution:** Check if URLs match this format

#### Issue 3: Files Don't Exist
**Symptom:** 404 errors when accessing image URLs
**Solution:**
- Files may have been deleted
- Upload may have failed but URL was saved
- Check Storage browser to verify files exist

#### Issue 4: CORS Issues
**Symptom:** Browser console shows CORS errors
**Solution:**
1. Storage → sublet-photos → Settings
2. Check CORS configuration
3. Should allow your domain (subletnu.com)

#### Issue 5: RLS Policies Too Restrictive
**Symptom:** Images work when logged in as owner, but not for others
**Solution:**
- Check storage policies allow anon access for SELECT
- Bucket should be public OR have permissive read policy

### 4. SQL Queries to Run in Supabase

**Get listing data:**
```sql
SELECT id, photos, user_id, location, created_at
FROM sublets
WHERE id = '2188e736-09e6-4c66-80ea-3580e141e3e6';
```

**Check storage policies:**
```sql
SELECT *
FROM storage.objects
WHERE bucket_id = 'sublet-photos'
LIMIT 10;
```

### 5. Quick Fixes

**Make Bucket Public (SQL Editor):**
```sql
-- Make bucket public
UPDATE storage.buckets
SET public = true
WHERE id = 'sublet-photos';
```

**Add Public Read Policy:**
```sql
-- Allow public read access
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'sublet-photos');
```

## Expected Behavior

When working correctly:
1. Photo URLs should be publicly accessible
2. Images should load without authentication
3. All users should see the images on listing page
4. URLs should return 200 OK with image/jpeg or image/png content-type

## Testing

After making changes:
1. Visit the listing page: https://subletnu.com/sublet/2188e736-09e6-4c66-80ea-3580e141e3e6
2. Open browser DevTools (F12) → Network tab
3. Refresh the page
4. Look for image requests - should be 200 OK
5. If still failing, check Console for errors

## Files Created for Debugging

- `src/pages/DebugImagePage.tsx` - Comprehensive debug page
- `debug-listing.js` - Node script to test URLs (requires env vars)
- This document: `INVESTIGATION.md`

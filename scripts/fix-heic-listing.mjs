import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync, readFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const listingId = '2188e736-09e6-4c66-80ea-3580e141e3e6';

async function fixHeicListing() {
  console.log('🔧 Fixing HEIC images for listing:', listingId);
  console.log('');

  // Fetch the listing
  const { data: listing, error } = await supabase
    .from('sublets')
    .select('*')
    .eq('id', listingId)
    .single();

  if (error || !listing) {
    console.error('❌ Could not fetch listing:', error);
    return;
  }

  console.log('📋 Current photos:');
  listing.photos.forEach((url, i) => {
    console.log(`  ${i + 1}. ${url}`);
  });
  console.log('');

  console.log('⚠️  Manual steps required:');
  console.log('');
  console.log('This script requires server-side access or manual intervention.');
  console.log('');
  console.log('Option A - Ask the listing owner to:');
  console.log('  1. Visit: https://subletnu.com/edit/' + listingId);
  console.log('  2. Remove all current photos');
  console.log('  3. Convert HEIC to JPG on their device:');
  console.log('     - Mac: Open in Preview, Export as JPEG');
  console.log('     - iPhone: Share → Save to Files as JPEG');
  console.log('     - Online: Use https://heictojpg.com');
  console.log('  4. Re-upload the converted JPG files');
  console.log('');
  console.log('Option B - Admin direct fix (requires service role key):');
  console.log('  1. Download the 4 HEIC files from Supabase Storage');
  console.log('  2. Convert using imagemagick or online tool');
  console.log('  3. Upload new JPG versions to storage');
  console.log('  4. Update database with new URLs');
  console.log('');
  console.log('Option C - Delete the listing (if owner cannot be reached):');
  console.log('  Only if the listing violates terms or owner is unreachable');
}

fixHeicListing().catch(console.error);

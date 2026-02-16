import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import convert from 'heic-convert';
import { promisify } from 'util';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create admin client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey);

const listingId = '2188e736-09e6-4c66-80ea-3580e141e3e6';

async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function convertHeicToJpeg(heicBuffer) {
  const outputBuffer = await convert({
    buffer: heicBuffer,
    format: 'JPEG',
    quality: 0.9
  });
  return Buffer.from(outputBuffer);
}

async function fixHeicListing() {
  console.log('🔧 Starting HEIC to JPEG conversion for listing:', listingId);
  console.log('');

  // Fetch the listing
  const { data: listing, error: fetchError } = await supabase
    .from('sublets')
    .select('*')
    .eq('id', listingId)
    .single();

  if (fetchError || !listing) {
    console.error('❌ Could not fetch listing:', fetchError);
    return;
  }

  console.log('📋 Found listing with', listing.photos.length, 'photos');
  console.log('👤 User ID:', listing.user_id);
  console.log('');

  const newPhotoUrls = [];

  for (let i = 0; i < listing.photos.length; i++) {
    const heicUrl = listing.photos[i];
    console.log(`\n📥 Processing photo ${i + 1}/${listing.photos.length}`);
    console.log(`   URL: ${heicUrl}`);

    try {
      // Download HEIC file
      console.log('   ⬇️  Downloading HEIC...');
      const heicBuffer = await downloadImage(heicUrl);
      console.log(`   ✅ Downloaded (${Math.round(heicBuffer.length / 1024)}KB)`);

      // Convert to JPEG
      console.log('   🔄 Converting to JPEG...');
      const jpegBuffer = await convertHeicToJpeg(heicBuffer);
      console.log(`   ✅ Converted (${Math.round(jpegBuffer.length / 1024)}KB)`);

      // Extract the file path from the URL
      const urlParts = heicUrl.split('/storage/v1/object/public/sublet-photos/');
      if (urlParts.length < 2) {
        throw new Error('Invalid URL format');
      }
      const oldPath = urlParts[1];
      const newPath = oldPath.replace(/\.HEIC$/i, '.jpg');

      // Upload JPEG to storage
      console.log('   ⬆️  Uploading JPEG...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('sublet-photos')
        .upload(newPath, jpegBuffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('sublet-photos')
        .getPublicUrl(newPath);

      console.log(`   ✅ Uploaded: ${publicUrlData.publicUrl}`);
      newPhotoUrls.push(publicUrlData.publicUrl);

      // Delete old HEIC file
      console.log('   🗑️  Deleting old HEIC file...');
      const { error: deleteError } = await supabase.storage
        .from('sublet-photos')
        .remove([oldPath]);

      if (deleteError) {
        console.log('   ⚠️  Warning: Could not delete old file:', deleteError.message);
      } else {
        console.log('   ✅ Old file deleted');
      }

    } catch (error) {
      console.error(`   ❌ Error processing photo ${i + 1}:`, error.message);
      console.log('   ⚠️  Skipping this photo');
    }
  }

  if (newPhotoUrls.length === 0) {
    console.log('\n❌ No photos were successfully converted');
    return;
  }

  // Update database with new photo URLs
  console.log(`\n💾 Updating database with ${newPhotoUrls.length} new URLs...`);
  const { error: updateError } = await supabase
    .from('sublets')
    .update({ photos: newPhotoUrls })
    .eq('id', listingId);

  if (updateError) {
    console.error('❌ Failed to update database:', updateError);
    return;
  }

  console.log('✅ Database updated successfully!');
  console.log('\n🎉 Conversion complete!');
  console.log(`   Converted: ${newPhotoUrls.length}/${listing.photos.length} photos`);
  console.log(`   View listing: https://subletnu.com/sublet/${listingId}`);
}

fixHeicListing().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

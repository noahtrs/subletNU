import { createClient } from '@supabase/supabase-js';

// Get environment variables from command line arguments
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugListing() {
  const listingId = '2188e736-09e6-4c66-80ea-3580e141e3e6';

  console.log('Fetching listing:', listingId);

  const { data, error } = await supabase
    .from('sublets')
    .select('*')
    .eq('id', listingId)
    .single();

  if (error) {
    console.error('Error fetching listing:', error);
    return;
  }

  console.log('\n=== Listing Data ===');
  console.log('ID:', data.id);
  console.log('Location:', data.location);
  console.log('Price:', data.price);
  console.log('Photos:', JSON.stringify(data.photos, null, 2));
  console.log('\n=== Testing Photo URLs ===');

  if (data.photos && Array.isArray(data.photos)) {
    for (let i = 0; i < data.photos.length; i++) {
      const photoUrl = data.photos[i];
      console.log(`\nPhoto ${i + 1}:`, photoUrl);

      // Try to fetch the photo
      try {
        const response = await fetch(photoUrl);
        console.log(`  Status: ${response.status} ${response.statusText}`);
        console.log(`  Content-Type: ${response.headers.get('content-type')}`);
        console.log(`  Content-Length: ${response.headers.get('content-length')}`);
      } catch (err) {
        console.log(`  Error fetching: ${err.message}`);
      }
    }
  } else {
    console.log('No photos found or photos is not an array');
  }

  // Check storage bucket policy
  console.log('\n=== Checking Storage Bucket ===');
  const { data: buckets, error: bucketError } = await supabase
    .storage
    .listBuckets();

  if (bucketError) {
    console.error('Error listing buckets:', bucketError);
  } else {
    console.log('Available buckets:', buckets.map(b => b.name));
    const subletPhotosBucket = buckets.find(b => b.name === 'sublet-photos');
    if (subletPhotosBucket) {
      console.log('sublet-photos bucket found:', JSON.stringify(subletPhotosBucket, null, 2));
    }
  }
}

debugListing().catch(console.error);

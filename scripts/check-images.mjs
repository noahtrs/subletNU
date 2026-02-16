import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkListing() {
  const listingId = '2188e736-09e6-4c66-80ea-3580e141e3e6';

  console.log('🔍 Fetching listing:', listingId);
  console.log('');

  const { data, error } = await supabase
    .from('sublets')
    .select('*')
    .eq('id', listingId)
    .single();

  if (error) {
    console.error('❌ Error fetching listing:', error);
    return;
  }

  console.log('✅ Listing found!');
  console.log('Location:', data.location);
  console.log('Price: $' + data.price);
  console.log('Created:', data.created_at);
  console.log('');
  console.log('📸 Photos:', data.photos ? data.photos.length : 0);
  console.log('');

  if (data.photos && Array.isArray(data.photos)) {
    console.log('Testing each photo URL...');
    console.log('');

    for (let i = 0; i < data.photos.length; i++) {
      const photoUrl = data.photos[i];
      console.log(`Photo ${i + 1}/${data.photos.length}:`);
      console.log(`  URL: ${photoUrl}`);

      try {
        const response = await fetch(photoUrl, { method: 'HEAD' });
        console.log(`  Status: ${response.status} ${response.statusText}`);
        console.log(`  Content-Type: ${response.headers.get('content-type')}`);

        if (response.ok) {
          console.log('  ✅ Image is accessible!');
        } else {
          console.log('  ❌ Image failed to load');
        }
      } catch (err) {
        console.log(`  ❌ Error: ${err.message}`);
      }
      console.log('');
    }
  } else {
    console.log('⚠️  No photos found or photos is not an array');
  }

  // Check storage bucket
  console.log('🗄️  Checking storage buckets...');
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

  if (bucketError) {
    console.error('❌ Error listing buckets:', bucketError);
  } else {
    console.log('Available buckets:', buckets.map(b => b.name).join(', '));
    const subletPhotosBucket = buckets.find(b => b.name === 'sublet-photos');
    if (subletPhotosBucket) {
      console.log('✅ sublet-photos bucket found');
      console.log('   Public:', subletPhotosBucket.public);
      console.log('   Created:', subletPhotosBucket.created_at);
    } else {
      console.log('❌ sublet-photos bucket not found!');
    }
  }
}

checkListing().catch(console.error);

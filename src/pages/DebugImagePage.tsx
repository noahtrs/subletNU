import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const DebugImagePage = () => {
  const { currentUser, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imageTests, setImageTests] = useState<any[]>([]);
  const [bucketInfo, setBucketInfo] = useState<any>(null);

  // List of admin emails - only these users can access this page
  const ADMIN_EMAILS = ['torres.no@northeastern.edu']; // Add your admin emails here

  const listingId = '2188e736-09e6-4c66-80ea-3580e141e3e6';

  // Check if user is admin
  useEffect(() => {
    if (!isLoadingAuth && !currentUser) {
      navigate('/auth');
      return;
    }

    if (!isLoadingAuth && currentUser && !ADMIN_EMAILS.includes(currentUser.email || '')) {
      navigate('/');
      return;
    }
  }, [currentUser, isLoadingAuth, navigate]);

  useEffect(() => {
    const debugListing = async () => {
      console.log('🔍 Fetching listing:', listingId);

      // Fetch listing data
      const { data, error } = await supabase
        .from('sublets')
        .select('*')
        .eq('id', listingId)
        .single();

      if (error) {
        console.error('❌ Error fetching listing:', error);
        setLoading(false);
        return;
      }

      console.log('✅ Listing data:', data);
      setListing(data);

      // Test each photo URL
      if (data.photos && Array.isArray(data.photos)) {
        const tests = await Promise.all(
          data.photos.map(async (photoUrl: string, index: number) => {
            console.log(`\n📸 Testing Photo ${index + 1}:`, photoUrl);

            try {
              const response = await fetch(photoUrl, { method: 'HEAD' });
              const result = {
                index: index + 1,
                url: photoUrl,
                status: response.status,
                statusText: response.statusText,
                contentType: response.headers.get('content-type'),
                contentLength: response.headers.get('content-length'),
                accessible: response.ok,
              };
              console.log(`  Status: ${result.status} ${result.statusText}`);
              console.log(`  Content-Type: ${result.contentType}`);
              console.log(`  Accessible: ${result.accessible ? '✅' : '❌'}`);
              return result;
            } catch (err: any) {
              console.error(`  ❌ Error: ${err.message}`);
              return {
                index: index + 1,
                url: photoUrl,
                error: err.message,
                accessible: false,
              };
            }
          })
        );
        setImageTests(tests);
      }

      // Check storage buckets
      console.log('\n🗄️ Checking storage buckets...');
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

      if (bucketError) {
        console.error('❌ Error listing buckets:', bucketError);
      } else {
        console.log('✅ Available buckets:', buckets.map((b: any) => b.name));
        const subletPhotosBucket = buckets.find((b: any) => b.name === 'sublet-photos');
        setBucketInfo(subletPhotosBucket || { error: 'sublet-photos bucket not found' });
        console.log('Bucket info:', subletPhotosBucket);
      }

      // Test getting public URL for a test file
      if (data.photos && data.photos.length > 0) {
        const firstPhoto = data.photos[0];
        // Extract the path from the URL
        const urlParts = firstPhoto.split('/storage/v1/object/public/sublet-photos/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          console.log('\n🔗 Testing getPublicUrl for path:', filePath);
          const { data: publicUrlData } = supabase.storage
            .from('sublet-photos')
            .getPublicUrl(filePath);
          console.log('Generated public URL:', publicUrlData.publicUrl);
        }
      }

      setLoading(false);
    };

    debugListing();
  }, []);

  // Show loading state while checking auth
  if (isLoadingAuth || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neu-red" />
        <p className="ml-4">
          {isLoadingAuth ? 'Checking authentication...' : 'Debugging listing images...'}
        </p>
      </div>
    );
  }

  // If not admin, this will redirect above, but add safety check
  if (!currentUser || !ADMIN_EMAILS.includes(currentUser.email || '')) {
    return null;
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Image Debug Report</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Listing Data</h2>
          {listing ? (
            <div className="space-y-2">
              <p><strong>ID:</strong> {listing.id}</p>
              <p><strong>Location:</strong> {listing.location}</p>
              <p><strong>Price:</strong> ${listing.price}/mo</p>
              <p><strong>Photos Count:</strong> {listing.photos?.length || 0}</p>
            </div>
          ) : (
            <p className="text-red-600">Failed to load listing</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Storage Bucket Info</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
            {JSON.stringify(bucketInfo, null, 2)}
          </pre>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Image URL Tests</h2>
          {imageTests.map((test) => (
            <div key={test.index} className="mb-6 pb-6 border-b last:border-b-0">
              <h3 className="font-semibold mb-2">
                Photo {test.index}: {test.accessible ? '✅ Accessible' : '❌ Not Accessible'}
              </h3>
              <div className="space-y-1 text-sm">
                <p className="break-all"><strong>URL:</strong> {test.url}</p>
                {test.status && <p><strong>Status:</strong> {test.status} {test.statusText}</p>}
                {test.contentType && <p><strong>Content-Type:</strong> {test.contentType}</p>}
                {test.contentLength && <p><strong>Content-Length:</strong> {test.contentLength}</p>}
                {test.error && <p className="text-red-600"><strong>Error:</strong> {test.error}</p>}
              </div>
              <div className="mt-4">
                <p className="text-sm font-semibold mb-2">Image Preview:</p>
                <img
                  src={test.url}
                  alt={`Photo ${test.index}`}
                  className="max-w-md border rounded"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'text-red-600 p-4 border border-red-300 rounded';
                    errorDiv.textContent = '❌ Failed to load image';
                    e.currentTarget.parentElement?.appendChild(errorDiv);
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Console Output</h2>
          <p className="text-sm text-gray-600">
            Check the browser console (F12) for detailed debug logs.
          </p>
          <Button
            onClick={() => window.location.href = `/sublet/${listingId}`}
            className="mt-4"
          >
            View Actual Listing Page
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DebugImagePage;

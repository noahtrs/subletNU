import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSublet } from "@/contexts/SubletContext";
import SubletCard from "@/components/SubletCard";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wifi, Dumbbell, Shield, Check, Loader2, Share, Link, MapPin, Heart } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import InteractiveMap from "@/components/InteractiveMap";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Sublet } from "@/types";
import { motion } from "framer-motion";
import { useSavedListings } from '@/hooks/useSavedListings';

// Define type for coordinates
interface Coordinates {
  lat: number;
  lng: number;
}

const SubletDetailPage = () => {
  const { subletId } = useParams<{ subletId: string }>();
  const { currentUser, isLoadingAuth } = useAuth();
  const { sublets, isLoadingSublets } = useSublet();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSaved, isSaving, toggleSave } = useSavedListings();

  // Local state for direct sublet fetching
  const [directSublet, setDirectSublet] = useState<Sublet | null>(null);
  const [isLoadingDirectSublet, setIsLoadingDirectSublet] = useState(false);

  const [isProcessingShare, setIsProcessingShare] = useState(false);
  const [locationCoords, setLocationCoords] = useState<Coordinates | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(true);
  const [geocodingError, setGeocodingError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const location = useLocation();
  const [showShareReminder, setShowShareReminder] = useState(false);
  const shareButtonRef = useRef<HTMLButtonElement>(null);

  // Get sublet from context if available, otherwise use direct fetch
  const contextSublet = subletId ? sublets.find(s => s.id === subletId) : null;

  // Function to fetch sublet directly if not in context
  const fetchSubletDirectly = async (id: string) => {
    setIsLoadingDirectSublet(true);
    try {
      const { data, error } = await supabase
        .from('sublets')
        .select(`
          *,
          instagram_handle,
          snapchat_handle
        `)
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching sublet directly:', error);
        setDirectSublet(null);
        return;
      }

      if (data) {
        // Get the user email
        const { data: profileData } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', data.user_id)
          .single();

        const formattedSublet: Sublet = {
          id: data.id,
          userId: data.user_id,
          userEmail: profileData?.email || "unknown@northeastern.edu",
          price: data.price,
          location: data.location,
          distanceFromNEU: data.distance_from_neu,
          startDate: data.start_date,
          endDate: data.end_date,
          description: data.description,
          photos: data.photos,
          createdAt: data.created_at,
          genderPreference: data.gender_preference as "male" | "female" | "any",
          pricingType: data.pricing_type as "firm" | "negotiable",
          amenities: data.amenities || [],
          noBrokersFee: data.no_brokers_fee || false,
          instagramHandle: data.instagram_handle,
          snapchatHandle: data.snapchat_handle,
        };

        setDirectSublet(formattedSublet);
      }
    } catch (err) {
      console.error("Error fetching sublet:", err);
    } finally {
      setIsLoadingDirectSublet(false);
    }
  };

  useEffect(() => {
    // If we have the sublet in context, we're good
    if (contextSublet) {
      setDirectSublet(null);
      return;
    }

    // Otherwise, fetch directly
    if (subletId && !isLoadingSublets) {
      fetchSubletDirectly(subletId);
    }
  }, [subletId, contextSublet, isLoadingSublets]);

  // Use either the context sublet or directly fetched sublet
  const sublet = contextSublet || directSublet;
  const isLoading = isLoadingSublets || isLoadingDirectSublet;

  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string; // Key for Maps JS API (InteractiveMap, Autocomplete)
  const geocodeApiKey = import.meta.env.VITE_GEOCODE_API_KEY as string; // Dedicated key for Geocoding API fetch call

  // Check if this is a newly created sublet
  useEffect(() => {
    if (location.state?.isNewlyCreated) {
      // Set a flag to show the share reminder 
      setShowShareReminder(true);

      // After 500ms, show toast notification
      const timer = setTimeout(() => {
        toast({
          title: "Share Your Listing!",
          description: "Your sublet was created successfully. Share the link with friends to find someone faster.",
          variant: "default",
          duration: 8000,
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [location.state, toast]);

  useEffect(() => {
    // Allow unauthenticated users to view this page
    // if (!isLoadingAuth && !currentUser) {
    //   navigate('/auth');
    // }
  }, [currentUser, isLoadingAuth, navigate]);

  useEffect(() => {
    if (sublet?.location && geocodeApiKey) {
      setIsGeocoding(true);
      setGeocodingError(null);
      setLocationCoords(null);

      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(sublet.location)}&key=${geocodeApiKey}`;

      fetch(geocodeUrl)
        .then(response => response.json())
        .then(data => {
          if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
            setLocationCoords(data.results[0].geometry.location);
          } else {
            console.warn("Geocoding failed:", data.status, data.error_message);
            setGeocodingError(`Could not find coordinates for the address. Status: ${data.status}`);
          }
        })
        .catch(error => {
          console.error("Error fetching geocoding data:", error);
          setGeocodingError("Failed to contact Geocoding service.");
        })
        .finally(() => {
          setIsGeocoding(false);
        });
    } else if (sublet && !geocodeApiKey) {
      console.error("Geocoding API key is missing. Make sure VITE_GEOCODE_API_KEY is set in your .env file.");
      setGeocodingError("API key is missing. Map cannot be loaded.");
      setIsGeocoding(false);
    } else if (!sublet?.location) {
      setGeocodingError("Location address is missing.");
      setIsGeocoding(false);
    }
  }, [sublet?.location]);

  // Highlight the share button with a pulsing effect when viewing a newly created listing
  useEffect(() => {
    if (showShareReminder && shareButtonRef.current) {
      // Add pulsing animation class to draw attention to share button
      shareButtonRef.current.classList.add('animate-pulse-attention');

      // Remove animation after 10 seconds
      const timer = setTimeout(() => {
        if (shareButtonRef.current) {
          shareButtonRef.current.classList.remove('animate-pulse-attention');
        }
        setShowShareReminder(false);
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [showShareReminder]);

  // Function to copy the listing link
  const handleShareLink = async () => {
    if (isProcessingShare) return;
    setIsProcessingShare(true);
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied!",
        description: "The listing link has been copied to your clipboard.",
      });
    } catch (err) {
      console.error("Failed to copy link: ", err);
      toast({
        title: "Error Copying Link",
        description: "Could not copy the link to your clipboard.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingShare(false);
    }
  };

  const handleToggleSave = async () => {
    if (!currentUser) {
      toast({
        title: "Authentication Required",
        description: "Please log in to save listings.",
        variant: "default",
        action: <Button onClick={() => navigate('/auth')}>Login</Button>
      });
      return;
    }
    if (!sublet) return;

    await toggleSave(sublet.id);
  };

  if (isLoadingAuth || isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neu-red" />
        <p className="mt-4 text-gray-600">Loading details...</p>
      </div>
    );
  }

  if (!sublet) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-xl font-bold mb-4">Sublet Not Found</h1>
        <p className="text-gray-600 mb-4">The listing might have been removed or the link is incorrect.</p>
        <Button onClick={() => navigate('/')}>Back to Home</Button>
      </div>
    );
  }

  const amenities = sublet.amenities ?? [];

  // Map amenities to corresponding icons
  const getAmenityIcon = (amenity: string) => {
    const lowerAmenity = amenity.toLowerCase();
    if (lowerAmenity.includes('wifi') || lowerAmenity.includes('internet')) {
      return <Wifi className="h-4 w-4 mr-2" />;
    } else if (lowerAmenity.includes('gym') || lowerAmenity.includes('fitness')) {
      return <Dumbbell className="h-4 w-4 mr-2" />;
    } else if (lowerAmenity.includes('security') || lowerAmenity.includes('safe')) {
      return <Shield className="h-4 w-4 mr-2" />;
    }
    return null;
  };

  return (
    <>
      <div className="flex flex-col w-full">
        <header className="bg-neu-red text-white p-4 flex items-center justify-between w-full" style={{ borderRadius: 0 }}>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-neu-red/80"
              onClick={() => navigate('/')}
            >
              <ArrowLeft />
            </Button>
            <h1 className="text-xl font-bold ml-2">Sublet Details</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={handleToggleSave}
              disabled={isLoading || isSaving(sublet.id)}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-neu-red/80 disabled:opacity-50"
              aria-label={isSaved(sublet.id) ? "Unsave this listing" : "Save this listing"}
            >
              <Heart className="h-5 w-5" fill={isSaved(sublet.id) ? "currentColor" : "none"} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  ref={shareButtonRef}
                  disabled={isProcessingShare}
                  variant="ghost"
                  size="icon"
                  className={`text-white hover:bg-neu-red/80 disabled:opacity-50 ${showShareReminder ? 'ring-2 ring-white ring-opacity-70' : ''
                    }`}
                >
                  {isProcessingShare ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="flex items-center gap-2 cursor-pointer"
                  onSelect={handleShareLink}
                >
                  <Link className="h-4 w-4" />
                  <span>Share Link</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      </div>
      <div className="pb-20 max-w-2xl mx-auto">
        <div className="p-4">
          <motion.div layoutId={`sublet-card-${sublet.id}`}>
            <SubletCard sublet={sublet} expanded={true} />
          </motion.div>

          <div className="mt-6 bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-bold mb-3">Amenities</h2>
            {amenities.length === 0 && !sublet.noBrokersFee && (
              <p className="text-sm text-gray-500">No amenities listed.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {amenities.map((amenity, index) => {
                const icon = getAmenityIcon(amenity);
                return (
                  <Badge
                    key={index}
                    variant="outline"
                    className="flex items-center justify-start px-3 py-2 bg-gray-50"
                  >
                    {icon ? icon : <Check className="h-4 w-4 mr-2 text-gray-400" />}
                    <span>{amenity}</span>
                  </Badge>
                );
              })}

              {/* No Broker's Fee Badge */}
              {sublet.noBrokersFee && (
                <Badge
                  variant="outline"
                  className="flex items-center justify-start px-3 py-2 bg-green-50 text-green-800 border-green-200"
                >
                  <Check className="h-4 w-4 mr-2" />
                  <span>No Broker's Fee</span>
                </Badge>
              )}
            </div>
          </div>

          {/* Add Social Media Handles Section */}
          {(sublet.instagramHandle || sublet.snapchatHandle) && (
            <div className="mt-6 bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-bold mb-1">Contact via Social Media</h2>
              <p className="text-sm text-gray-500 mb-3">Tap to connect on social media</p>
              <div className="flex flex-wrap gap-3">
                {sublet.instagramHandle && (
                  <a
                    href={`https://www.instagram.com/${sublet.instagramHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 bg-gradient-to-r from-pink-500 to-orange-400 text-white px-4 py-2 rounded-full hover:opacity-90 transition-all transform hover:scale-105 shadow-md"
                  >
                    <img src="/images/icons8-instagram.svg" alt="Instagram" className="w-5 h-5 filter invert" />
                    <span className="font-medium">@{sublet.instagramHandle}</span>
                  </a>
                )}
                {sublet.snapchatHandle && (
                  <a
                    href={`https://www.snapchat.com/add/${sublet.snapchatHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 bg-yellow-300 text-black px-4 py-2 rounded-full hover:opacity-90 transition-all transform hover:scale-105 shadow-md"
                  >
                    <img src="/images/icons8-snapchat.svg" alt="Snapchat" className="w-5 h-5" />
                    <span className="font-medium">@{sublet.snapchatHandle}</span>
                  </a>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-bold mb-2">Location Details</h2>
            <p className="text-gray-700 mb-3">
              <MapPin className="inline h-4 w-4 mr-1 text-gray-500" />
              {sublet.location}, {sublet.distanceFromNEU} miles from Northeastern University
            </p>
            <div className="mt-4 h-64 bg-gray-200 rounded overflow-hidden">
              {isGeocoding ? (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading map...
                </div>
              ) : geocodingError ? (
                <div className="w-full h-full flex items-center justify-center text-red-600 text-sm px-4 text-center">
                  Error: {geocodingError}
                </div>
              ) : locationCoords ? (
                <InteractiveMap apiKey={googleMapsApiKey || ""} center={locationCoords} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                  Map could not be loaded.
                </div>
              )}
            </div>
          </div>
        </div>

        {!isMobile && <BottomNav />}
      </div>
    </>
  );
};

export default SubletDetailPage;

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Sublet } from '@/types';

interface UseSavedListingsReturn {
  savedListings: Sublet[];
  isLoading: boolean;
  error: string | null;
  isSaved: (listingId: string) => boolean;
  isSaving: (listingId: string) => boolean;
  toggleSave: (listingId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

// Helper function to transform database sublet to frontend Sublet type
const transformSubletData = (dbSublet: any, userEmail?: string, savedAt?: string): Sublet => {
  return {
    id: dbSublet.id,
    userId: dbSublet.user_id,
    userEmail: userEmail || '', // Use the provided email or empty string as fallback
    price: dbSublet.price,
    location: dbSublet.location,
    distanceFromNEU: dbSublet.distance_from_neu,
    description: dbSublet.description,
    startDate: dbSublet.start_date,
    endDate: dbSublet.end_date,
    photos: dbSublet.photos || [],
    genderPreference: dbSublet.gender_preference,
    pricingType: dbSublet.pricing_type,
    amenities: dbSublet.amenities || [],
    createdAt: dbSublet.created_at,
    noBrokersFee: dbSublet.no_brokers_fee || false,
    instagramHandle: dbSublet.instagram_handle,
    snapchatHandle: dbSublet.snapchat_handle,
    saved_at: savedAt,
  };
};

export const useSavedListings = (): UseSavedListingsReturn => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  
  const [savedListings, setSavedListings] = useState<Sublet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});
  
  // Track intended save states and operation IDs
  const intendedStatesRef = useRef<Record<string, boolean>>({});
  const operationIdsRef = useRef<Record<string, number>>({});
  const nextOperationIdRef = useRef(1);

  // Fetch all saved listings for the current user
  const fetchSavedListings = useCallback(async () => {
    if (!currentUser) {
      setSavedListings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('saved_listings')
        .select(`
          created_at,
          sublets (*)
        `)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to include saved_at timestamp and fetch user emails
      const listings = await Promise.all(
        (data || []).filter((item) => item.sublets).map(async (item) => {
          const subletData = item.sublets;
          
          // Fetch the user email for this sublet
          const { data: profileData } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', subletData.user_id)
            .single();
          
          const userEmail = profileData?.email || "unknown@northeastern.edu";
          
          return transformSubletData(
            subletData, 
            userEmail,
            item.created_at
          );
        })
      );

      setSavedListings(listings);
    } catch (err: any) {
      console.error('Error fetching saved listings:', err);
      setError(err.message || 'Failed to fetch saved listings');
      setSavedListings([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // Check if a specific listing is saved
  const isSaved = useCallback((listingId: string): boolean => {
    // First check if there's an intended state (for ongoing operations)
    if (listingId in intendedStatesRef.current) {
      return intendedStatesRef.current[listingId];
    }
    // Otherwise check actual saved listings
    return savedListings.some(listing => listing.id === listingId);
  }, [savedListings]);

  // Toggle save state for a listing with improved race condition handling
  const toggleSave = useCallback(async (listingId: string) => {
    if (!currentUser) {
      toast({
        title: "Authentication Required",
        description: "Please log in to save listings.",
        variant: "default",
      });
      return;
    }

    // Generate a unique operation ID
    const operationId = nextOperationIdRef.current++;
    operationIdsRef.current[listingId] = operationId;

    // Determine current and intended states
    const currentState = savedListings.some(listing => listing.id === listingId);
    const intendedState = !currentState;
    
    // Set intended state immediately
    intendedStatesRef.current[listingId] = intendedState;
    
    // Set loading state
    setSavingStates(prev => ({ ...prev, [listingId]: true }));
    
    // Optimistic update
    if (intendedState) {
      // Adding to saved listings
      const placeholder: Sublet = {
        id: listingId,
        userId: currentUser.id,
        userEmail: '',
        price: 0,
        location: '',
        distanceFromNEU: 0,
        description: '',
        startDate: '',
        endDate: '',
        photos: [],
        createdAt: new Date().toISOString(),
        genderPreference: 'any',
        pricingType: 'firm',
        amenities: [],
        noBrokersFee: false,
        instagramHandle: '',
        snapchatHandle: '',
        saved_at: new Date().toISOString(),
      };
      setSavedListings(prev => [placeholder, ...prev.filter(listing => listing.id !== listingId)]);
    } else {
      // Removing from saved listings
      setSavedListings(prev => prev.filter(listing => listing.id !== listingId));
    }

    try {
      // Check if this operation is still the latest for this listing
      if (operationIdsRef.current[listingId] !== operationId) {
        return; // This operation was superseded by a newer one
      }

      if (intendedState) {
        // Add to saved listings
        const { error } = await supabase
          .from('saved_listings')
          .insert({
            user_id: currentUser.id,
            listing_id: listingId,
          });

        // Check if this operation is still the latest
        if (operationIdsRef.current[listingId] !== operationId) {
          return;
        }

        if (error) {
          // Handle unique constraint violation (already saved)
          if (error.code === '23505') {
            toast({
              title: "Already Saved",
              description: "This listing is already in your saved items.",
            });
            // Refresh to get current state
            await fetchSavedListings();
            return;
          }
          throw error;
        }

        // Fetch the listing details for optimistic update
        const { data: listingData } = await supabase
          .from('sublets')
          .select('*')
          .eq('id', listingId)
          .single();

        // Check if this operation is still the latest
        if (operationIdsRef.current[listingId] !== operationId) {
          return;
        }

        if (listingData) {
          // Fetch the user email for this sublet
          const { data: profileData } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', listingData.user_id)
            .single();
          
          const userEmail = profileData?.email || "unknown@northeastern.edu";
          
          const transformedListing = transformSubletData(listingData, userEmail, new Date().toISOString());
          // Replace the placeholder with actual data
          setSavedListings(prev => prev.map(listing => 
            listing.id === listingId ? transformedListing : listing
          ));
        }

        toast({
          title: "Listing Saved",
          description: "This listing has been added to your saved items.",
        });
      } else {
        // Remove from saved listings
        const { error } = await supabase
          .from('saved_listings')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('listing_id', listingId);

        // Check if this operation is still the latest
        if (operationIdsRef.current[listingId] !== operationId) {
          return;
        }

        if (error) throw error;

        toast({
          title: "Listing Unsaved",
          description: "This listing has been removed from your saved items.",
        });
      }
    } catch (err: any) {
      // Check if this operation is still the latest before handling errors
      if (operationIdsRef.current[listingId] !== operationId) {
        return;
      }
      
      console.error('Error toggling save state:', err);
      
      // Revert optimistic update on error
      if (intendedState) {
        // Remove the optimistically added placeholder
        setSavedListings(prev => prev.filter(listing => listing.id !== listingId));
      } else {
        // Re-add the listing back
        await fetchSavedListings();
      }

      toast({
        title: "Error",
        description: err.message || `Failed to ${intendedState ? 'save' : 'unsave'} listing`,
        variant: "destructive",
      });
    } finally {
      // Clean up only if this is still the active operation
      if (operationIdsRef.current[listingId] === operationId) {
        delete operationIdsRef.current[listingId];
        delete intendedStatesRef.current[listingId];
        setSavingStates(prev => {
          const newState = { ...prev };
          delete newState[listingId];
          return newState;
        });
      }
    }
  }, [currentUser, savedListings, toast, fetchSavedListings]);

  // Fetch saved listings when user changes
  useEffect(() => {
    fetchSavedListings();
  }, [fetchSavedListings]);

  return {
    savedListings,
    isLoading,
    error,
    isSaved,
    isSaving: (listingId: string) => savingStates[listingId] || false,
    toggleSave,
    refetch: fetchSavedListings,
  };
}; 
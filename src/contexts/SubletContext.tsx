import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Sublet } from "../types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "./AuthContext";
import { compressImage } from "@/lib/imageCompression";

type SubletContextType = {
  sublets: Sublet[];
  isLoadingSublets: boolean;
  addSublet: (sublet: Omit<Sublet, "id" | "userId" | "userEmail" | "createdAt">) => Promise<void>;
  updateSublet: (subletId: string, sublet: Partial<Omit<Sublet, "id" | "userId" | "userEmail" | "createdAt">>) => Promise<void>;
  uploadPhoto: (file: File, userId: string) => Promise<string | null>;
};

const SubletContext = createContext<SubletContextType | undefined>(undefined);

const CACHE_KEY = 'subletnu:sublets:v1';

// Last fetched listings, so returning visitors see the grid immediately while a
// fresh copy loads in the background.
const readCachedSublets = (): Sublet[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeCachedSublets = (sublets: Sublet[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(sublets));
  } catch {
    // Storage full or unavailable (private mode) — caching is best-effort.
  }
};

export const SubletProvider = ({ children }: { children: ReactNode }) => {
  const [sublets, setSublets] = useState<Sublet[]>(() => readCachedSublets() ?? []);
  // True until the first fresh fetch finishes. `sublets` may already hold cached
  // listings during that time; pages that act on a listing (edit, detail) should
  // keep waiting on this, while the browse grid can render the cached copy.
  const [isLoadingSublets, setIsLoadingSublets] = useState(true);
  const { currentUser } = useAuth();

  const fetchSublets = async () => {
    try {
      const { data, error } = await supabase
        .from('sublets')
        .select(`
          *,
          instagram_handle,
          snapchat_handle
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // Keep whatever is on screen rather than blanking the page.
        console.error('Error fetching sublets:', error);
        return;
      }

      const rows = data ?? [];

      // One query for all posters' emails instead of one request per listing.
      const userIds = [...new Set(rows.map((item) => item.user_id))];
      const emailById = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds);
        if (profilesError) {
          console.error('Error fetching listing profiles:', profilesError);
        }
        profiles?.forEach((profile) => {
          if (profile.email) emailById.set(profile.id, profile.email);
        });
      }

      const mapped: Sublet[] = rows.map((item) => ({
        id: item.id,
        userId: item.user_id,
        userEmail: emailById.get(item.user_id) || "unknown@northeastern.edu",
        price: item.price,
        location: item.location,
        distanceFromNEU: item.distance_from_neu,
        startDate: item.start_date,
        endDate: item.end_date,
        description: item.description,
        photos: item.photos,
        createdAt: item.created_at,
        genderPreference: item.gender_preference as "male" | "female" | "any",
        pricingType: item.pricing_type as "firm" | "negotiable",
        amenities: item.amenities || [],
        noBrokersFee: item.no_brokers_fee || false,
        instagramHandle: item.instagram_handle,
        snapchatHandle: item.snapchat_handle,
      }));

      setSublets(mapped);
      writeCachedSublets(mapped);
    } catch (error) {
      console.error('Failed to fetch sublets:', error);
    } finally {
      setIsLoadingSublets(false);
    }
  };

  useEffect(() => {
    fetchSublets();

    // Coalesce bursts of realtime events (e.g. a listing edit touching several
    // rows) into a single refetch.
    let refetchTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefetch = () => {
      clearTimeout(refetchTimer);
      refetchTimer = setTimeout(fetchSublets, 300);
    };

    const channel = supabase
      .channel('public:sublets')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'sublets' },
        scheduleRefetch
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Subscription channel error:', err);
        }
        if (status === 'TIMED_OUT') {
          console.error('Subscription timed out');
        }
      });

    return () => {
      clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const addSublet = async (subletData: Omit<Sublet, "id" | "userId" | "userEmail" | "createdAt">) => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('sublets')
        .insert({
          user_id: currentUser.id,
          price: subletData.price,
          location: subletData.location,
          distance_from_neu: subletData.distanceFromNEU,
          description: subletData.description,
          start_date: subletData.startDate,
          end_date: subletData.endDate,
          photos: subletData.photos,
          gender_preference: subletData.genderPreference,
          pricing_type: subletData.pricingType,
          amenities: subletData.amenities,
          no_brokers_fee: subletData.noBrokersFee,
          instagram_handle: subletData.instagramHandle,
          snapchat_handle: subletData.snapchatHandle,
        })
        .select();

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to post your sublet",
          variant: "destructive",
        });
        throw error;
      }

      // Trigger notification for new listing if we have the sublet ID
      if (data && data.length > 0) {
        try {
          // Call the edge function to notify users about the new listing
          await supabase.functions.invoke('send-new-listing-notification', {
            body: { subletId: data[0].id }
          });
        } catch (notifyError) {
          console.error("Error sending notifications:", notifyError);
          // We don't throw here as the sublet was created successfully
        }
      }

      fetchSublets();

      toast({
        title: "Sublet Posted",
        description: "Your sublet has been posted successfully.",
      });
    } catch (error) {
      console.error("Error adding sublet:", error);
      throw error;
    }
  };

  const updateSublet = async (subletId: string, subletData: Partial<Omit<Sublet, "id" | "userId" | "userEmail" | "createdAt">>) => {
    if (!currentUser) return;

    try {
      const supabaseData: any = {};

      if (subletData.price !== undefined) supabaseData.price = subletData.price;
      if (subletData.location !== undefined) supabaseData.location = subletData.location;
      if (subletData.distanceFromNEU !== undefined) supabaseData.distance_from_neu = subletData.distanceFromNEU;
      if (subletData.description !== undefined) supabaseData.description = subletData.description;
      if (subletData.startDate !== undefined) supabaseData.start_date = subletData.startDate;
      if (subletData.endDate !== undefined) supabaseData.end_date = subletData.endDate;
      if (subletData.photos !== undefined) supabaseData.photos = subletData.photos;
      if (subletData.genderPreference !== undefined) supabaseData.gender_preference = subletData.genderPreference;
      if (subletData.pricingType !== undefined) supabaseData.pricing_type = subletData.pricingType;
      if (subletData.amenities !== undefined) supabaseData.amenities = subletData.amenities;
      if (subletData.noBrokersFee !== undefined) supabaseData.no_brokers_fee = subletData.noBrokersFee;
      if (subletData.instagramHandle !== undefined) supabaseData.instagram_handle = subletData.instagramHandle;
      if (subletData.snapchatHandle !== undefined) supabaseData.snapchat_handle = subletData.snapchatHandle;

      const { error } = await supabase
        .from('sublets')
        .update(supabaseData)
        .eq('id', subletId)
        .eq('user_id', currentUser.id);

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to update your sublet",
          variant: "destructive",
        });
        throw error;
      } else {
        fetchSublets();
        toast({
          title: "Sublet Updated",
          description: "Your sublet has been updated successfully.",
        });
      }
    } catch (error: any) {
      console.error("Error updating sublet in context:", error);
      throw error;
    }
  };

  const uploadPhoto = async (file: File, userId: string): Promise<string | null> => {
    if (!file || !userId) {
      console.error("UploadPhoto: File or userId missing");
      return null;
    }

    // Shrink phone-sized photos before upload so listings load quickly.
    const uploadFile = await compressImage(file);

    const fileExt = uploadFile.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('sublet-photos')
        .upload(filePath, uploadFile, {
          // File names are unique and never overwritten, so browsers/CDN can cache them for a year.
          cacheControl: '31536000',
          contentType: uploadFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('sublet-photos')
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) {
        throw new Error('Failed to get public URL for the uploaded image.');
      }

      return publicUrlData.publicUrl;
    } catch (error: any) {
      console.error('Error in uploadPhoto function:', error);
      toast({
        title: "Upload Failed",
        description: error.message || `An unexpected error occurred uploading ${file.name}.`,
        variant: "destructive",
      });
      return null;
    }
  };

  const value = {
    sublets,
    isLoadingSublets,
    addSublet,
    updateSublet,
    uploadPhoto,
  };

  return <SubletContext.Provider value={value}>{children}</SubletContext.Provider>;
};

export const useSublet = () => {
  const context = useContext(SubletContext);
  if (context === undefined) {
    throw new Error("useSublet must be used within a SubletProvider");
  }
  return context;
}; 
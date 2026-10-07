import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSublet } from "@/contexts/SubletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, CalendarIcon, ImagePlus, X, Menu as MenuIcon, Home, PlusCircle, MessageSquare, User } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import BottomNav from "@/components/BottomNav";
import { toast } from "@/hooks/use-toast";
import { format, differenceInCalendarMonths } from "date-fns";
import AmenitiesSelector from "@/components/AmenitiesSelector";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import { Drawer, DrawerContent, DrawerHeader } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import Header from "@/components/Header";

// Define Northeastern University coordinates
const NEU_COORDINATES = { lat: 42.3398, lng: -71.0892 };

// Add custom element type for Google Maps Place Autocomplete Element
// @ts-ignore
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'gmpx-place-autocomplete': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { placeholder?: string };
    }
  }
}

const CreateSubletPage = () => {
  const { currentUser } = useAuth();
  const { uploadPhoto } = useSublet();
  const navigate = useNavigate();

  const [price, setPrice] = useState("");
  const [locationInputValue, setLocationInputValue] = useState("");
  const [distanceFromNEU, setDistanceFromNEU] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [photos, setPhotos] = useState<string[]>([]);
  const [genderPreference, setGenderPreference] = useState<"male" | "female" | "any">("any");
  const [pricingType, setPricingType] = useState<"firm" | "negotiable">("firm");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noBrokersFee, setNoBrokersFee] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Add state for social media handles
  const [instagramHandle, setInstagramHandle] = useState("");
  const [snapchatHandle, setSnapchatHandle] = useState("");

  // New state for file handling
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ref for the Google Places input
  const googlePlacesInputRef = useRef<HTMLInputElement | null>(null);

  // Add state to track if Google Maps and the custom element are ready
  const [mapsReady, setMapsReady] = useState(false);

  // Fallback state if new autocomplete fails
  const [forceClassicAutocomplete, setForceClassicAutocomplete] = useState(false);

  // Flag to toggle new autocomplete (set to true for production, false for localhost fallback)
  const useNewAutocomplete = !forceClassicAutocomplete && !(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // Ref for classic input
  const classicInputRef = useRef<HTMLInputElement | null>(null);

  // Detect if new autocomplete is not interactive and fallback
  useEffect(() => {
    if (!useNewAutocomplete) return;
    // Wait a bit for the element to render and initialize
    const timeout = setTimeout(() => {
      const el = document.getElementById('google-places-autocomplete-element');
      // Check if the element exists and has a shadowRoot (should have if initialized)
      if (!el || !(el as any).shadowRoot || !(el as any).shadowRoot.querySelector('input')) {
        setForceClassicAutocomplete(true);
      }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [useNewAutocomplete]);

  const photoPreviewsRef = useRef<string[]>([]);
  photoPreviewsRef.current = photoPreviews;
  useEffect(() => {
    return () => {
      photoPreviewsRef.current.forEach(URL.revokeObjectURL);
    };
  }, []);

  // Calculate total cost based on price and date range
  const totalCost = useMemo(() => {
    if (!startDate || !endDate || !price || isNaN(parseFloat(price))) {
      return null;
    }

    // Calculate number of months (rounded up for partial months)
    const months = differenceInCalendarMonths(endDate, startDate) + 1;

    // Calculate total
    return parseFloat(price) * months;
  }, [startDate, endDate, price]);

  // Classic Autocomplete fallback effect
  useEffect(() => {
    if (useNewAutocomplete) return;
    function loadScript(src: string, id: string) {
      if (document.getElementById(id)) return;
      const script = document.createElement('script');
      script.src = src;
      script.id = id;
      script.async = true;
      document.body.appendChild(script);
    }
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    loadScript(
      `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`,
      'google-maps-script-classic'
    );
    function initClassicAutocomplete() {
      if (!(window as any).google || !(window as any).google.maps || !(window as any).google.maps.places) {
        setTimeout(initClassicAutocomplete, 300);
        return;
      }
      const input = classicInputRef.current;
      if (!input) return;
      const autocomplete = new (window as any).google.maps.places.Autocomplete(input, {
        types: ['geocode'],
        componentRestrictions: { country: 'us' },
      });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place && place.formatted_address && place.geometry && place.geometry.location) {
          setLocationInputValue(place.formatted_address);
          // Calculate distance from NEU
          const placeLat = place.geometry.location.lat();
          const placeLng = place.geometry.location.lng();
          const R = 3958.8; // Radius of Earth in miles
          const dLat = (NEU_COORDINATES.lat - placeLat) * Math.PI / 180;
          const dLng = (NEU_COORDINATES.lng - placeLng) * Math.PI / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(placeLat * Math.PI / 180) *
            Math.cos(NEU_COORDINATES.lat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;
          setDistanceFromNEU(distance.toFixed(1));
        }
      });
    }
    setTimeout(initClassicAutocomplete, 500);
  }, [useNewAutocomplete]);

  // Update handlePlaceSelect to accept the newer Place type
  const handlePlaceSelect = useCallback((place: google.maps.places.Place | null, distanceInMiles: number | null) => {
    // LocationAutocomplete already called setInputValue with the formatted address.
    // This function now only needs to handle the distance calculation result.
    // Use place.formattedAddress (available on Place type)
    if (place && place.formattedAddress) {
      // REMOVED: setLocationInputValue(place.formatted_address);

      if (distanceInMiles !== null) {
        const roundedDistance = distanceInMiles.toFixed(1);
        setDistanceFromNEU(roundedDistance);
        toast({
          title: "Distance Calculated",
          description: `Set distance to approx. ${roundedDistance} miles from NEU. You can adjust if needed.`,
          variant: "default",
        });
      } else {
        // If distance calculation failed for a valid place, set to "0" or "N/A"
        setDistanceFromNEU("0");
        toast({
          title: "Distance Calculation Failed",
          description: "Could not automatically calculate distance. Using 0 miles. Please adjust if needed.",
          variant: "default",
        });
      }
    } else {
      // If place is null or invalid, also set distance to "0" or "N/A"
      // Keep the potentially manually typed locationInputValue
      setDistanceFromNEU("0");
      if (place) { // Only toast error if place existed but was invalid
        toast({
          title: "Address Error",
          description: "Could not get a valid address from the selection. The place object was incomplete.",
          variant: "destructive",
        });
      }
      // No toast if place was null (likely just cleared input)
    }
  }, [setDistanceFromNEU]); // Remove setLocationInputValue from dependencies

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    const currentPhotoCount = photoFiles.length;
    const remainingSlots = 5 - currentPhotoCount;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      toast({
        title: "Too Many Photos",
        description: `You can only add ${remainingSlots} more photo(s).`,
        variant: "destructive",
      });
    }

    for (const file of filesToProcess) {
      try {
        const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
                       file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif');

        if (isHeic) {
          toast({
            title: "HEIC Format Not Supported",
            description: "Please convert your photo to JPG or PNG before uploading. On iPhone: Go to Settings > Camera > Formats and select 'Most Compatible'.",
            variant: "destructive",
            duration: 10000,
          });
          continue;
        }

        if (file.type.startsWith('image/')) {
          if (photoFiles.length + newFiles.length < 5) {
            newFiles.push(file);
            newPreviews.push(URL.createObjectURL(file));
          }
        } else {
          toast({
            title: "Invalid File Type",
            description: `File "${file.name}" is not a supported image type.`,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error processing file:', error);
        toast({
          title: "Error Processing File",
          description: `Could not process ${file.name}.`,
          variant: "destructive",
        });
      }
    }

    setPhotoFiles(prev => [...prev, ...newFiles]);
    setPhotoPreviews(prev => [...prev, ...newPreviews]);

    // Clear the input value to allow selecting the same file again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle photo removal
  const handleRemovePhoto = (indexToRemove: number) => {
    // Revoke the object URL before removing the preview
    URL.revokeObjectURL(photoPreviews[indexToRemove]);

    setPhotoFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    setPhotoPreviews(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // Initialize Turnstile only in production
  useEffect(() => {
    if (import.meta.env.MODE === 'development') return;
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 5;
    const initTurnstile = () => {
      if (!mounted || !turnstileRef.current) return;
      if (typeof window.turnstile === 'undefined') {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initTurnstile, 1000);
        }
        return;
      }
      try {
        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: import.meta.env.VITE_CAPTCHA_SITE_KEY,
          callback: function (token: string) {
            if (mounted) setCaptchaToken(token);
          },
          'error-callback': function () {
            if (mounted) setCaptchaToken(null);
          },
          'expired-callback': function () {
            if (mounted) setCaptchaToken(null);
          },
          theme: 'light',
          appearance: 'always',
        });
      } catch (error) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(initTurnstile, 1000);
        }
      }
    };
    const timer = setTimeout(initTurnstile, 500);
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) { }
        widgetIdRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ADD THIS AUTHENTICATION CHECK:
    if (!currentUser) {
      navigate('/auth', { state: { fromProtected: true, intendedPath: '/create' } });
      toast({
        title: "Login Required",
        description: "You need to log in or sign up to post a sublet.",
        variant: "default",
      });
      return; // Stop submission process
    }

    // Only require CAPTCHA in production
    if (import.meta.env.MODE !== 'development' && !captchaToken) {
      toast({
        title: "Verification Required",
        description: "Please complete the captcha verification.",
        variant: "destructive",
      });
      return;
    }

    // Add check for distance field being filled (either auto or manual)
    if (!distanceFromNEU) {
      toast({
        title: "Missing Distance",
        description: "Please enter or calculate the distance from Northeastern.",
        variant: "destructive",
      });
      return;
    }

    // Validate using the input value state
    if (!locationInputValue) {
      toast({
        title: "Missing Location",
        description: "Please enter or select a valid address.", // Updated message
        variant: "destructive",
      });
      return;
    }
    if (!startDate || !endDate) {
      toast({
        title: "Missing Dates",
        description: "Please select both start and end dates.",
        variant: "destructive",
      });
      return;
    }
    if (endDate <= startDate) {
      toast({
        title: "Invalid Date Range",
        description: "End date must be after start date.",
        variant: "destructive",
      });
      return;
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price.",
        variant: "destructive",
      });
      return;
    }
    if (photoFiles.length === 0) {
      toast({
        title: "No Photos",
        description: "Please add at least one photo.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Only send captcha token in production
      const verifyCaptchaToken = import.meta.env.MODE !== 'development' ? captchaToken : undefined;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (verifyCaptchaToken) {
        if (!supabaseUrl) {
          toast({
            title: "Configuration Error",
            description: "Supabase URL is not set. Please contact support.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }
        const verifyResponse = await fetch(`${supabaseUrl}/functions/v1/verify-captcha`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            token: verifyCaptchaToken,
          }),
        });
        const verifyResult = await verifyResponse.json();
        if (!verifyResult.success) {
          toast({
            title: "Verification Failed",
            description: "Please complete the captcha verification again.",
            variant: "destructive",
          });
          if (window.turnstile && widgetIdRef.current) {
            window.turnstile.reset(widgetIdRef.current);
          }
          setIsSubmitting(false);
          return;
        }
      }

      // Parse distance 
      const distanceToSend = parseFloat(distanceFromNEU) || 0;

      // Upload photos first
      const uploadedPhotos = await Promise.all(photoFiles.map(async (file) => {
        const publicUrl = await uploadPhoto(file, currentUser.id);
        if (publicUrl) {
          return publicUrl;
        } else {
          throw new Error(`Failed to upload ${file.name}.`);
        }
      }));

      // Import Supabase client directly to avoid context issues
      const { supabase } = await import('@/integrations/supabase/client');

      // Insert the sublet directly
      const { data, error } = await supabase
        .from('sublets')
        .insert({
          user_id: currentUser.id,
          price: parseFloat(price),
          location: locationInputValue,
          distance_from_neu: distanceToSend,
          description,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          photos: uploadedPhotos,
          gender_preference: genderPreference,
          pricing_type: pricingType,
          amenities,
          no_brokers_fee: noBrokersFee,
          instagram_handle: instagramHandle.trim() || undefined,
          snapchat_handle: snapchatHandle.trim() || undefined,
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

      // If we successfully created the sublet, navigate to its page
      if (data && data.length > 0) {
        const newSubletId = data[0].id;

        // Attempt to trigger notifications (optional, won't block if it fails)
        try {
          await supabase.functions.invoke('send-new-listing-notification', {
            body: { subletId: newSubletId }
          });
        } catch (notifyError) {
          console.error("Error sending notifications:", notifyError);
          // We don't fail on notification errors
        }

        // Navigate to the new sublet detail page
        navigate(`/sublet/${newSubletId}`, {
          state: { isNewlyCreated: true }
        });

        toast({
          title: "Sublet Posted",
          description: "Your sublet has been posted successfully.",
        });
      } else {
        // This is unlikely, but handle just in case
        navigate('/');
        toast({
          title: "Sublet Posted",
          description: "Your sublet has been posted, but we couldn't find its ID.",
        });
      }
    } catch (error) {
      console.error("Error posting sublet:", error);
      toast({
        title: "Error",
        description: "Failed to post your sublet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function checkReady() {
      if (
        (window as any).google &&
        (window as any).google.maps &&
        customElements.get('gmpx-place-autocomplete')
      ) {
        setMapsReady(true);
      } else {
        timer = setTimeout(checkReady, 200);
      }
    }
    checkReady();
    return () => clearTimeout(timer);
  }, []);

  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const backButton = (
    <button
      className="mr-2 p-2 rounded focus:outline-none focus:ring-2 focus:ring-white text-white hover:bg-neu-red/80"
      onClick={() => navigate('/')}
      aria-label="Back to Home"
    >
      <ArrowLeft />
    </button>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Post a Sublet" left={!isMobile ? backButton : undefined} />
      <main className="flex-1 overflow-y-auto">
        <div className="pb-20 mx-auto w-full max-w-[90%] md:max-w-4xl lg:max-w-6xl">
          <div className="p-4 md:p-6 lg:p-8">
            <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl mx-auto">
              {/* ... photos, price ... */}
              {/* Photos Div */}
              <div>
                <h2 className="text-lg font-bold mb-4">Photos (1-5)</h2>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  id="photo-upload"
                />
                <div className="grid grid-cols-3 gap-2">
                  {photoPreviews.map((previewUrl, index) => (
                    <div key={index} className="relative aspect-square rounded overflow-hidden group">
                      <img src={previewUrl} alt={`Sublet Preview ${index}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove photo"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {photoFiles.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-neu-red cursor-pointer"
                    >
                      <ImagePlus className="text-gray-400" />
                    </button>
                  )}
                </div>
                {photoFiles.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">Add at least one photo (required)</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {photoFiles.length}/5 photos added.
                </p>
              </div>
              {/* Price Div */}
              <div className="space-y-2">
                <label htmlFor="price" className="text-sm font-medium">
                  Price ($/month)
                </label>
                <Input
                  id="price"
                  type="number"
                  placeholder="e.g., 750"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  max="6000"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="location" className="text-sm font-medium">
                  Location
                </label>
                <div className="w-full">
                  {useNewAutocomplete && mapsReady ? (
                    <gmpx-place-autocomplete
                      id="google-places-autocomplete-element"
                      placeholder="Start typing and select an address from the suggestions."
                    ></gmpx-place-autocomplete>
                  ) : (
                    <input
                      ref={classicInputRef}
                      type="text"
                      className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neu-red"
                      placeholder="Start typing and select an address from the suggestions."
                      value={locationInputValue}
                      onChange={e => setLocationInputValue(e.target.value)}
                      autoComplete="off"
                    />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Start typing and select an address from the suggestions.
                </p>
              </div>

              {/* ... distance, gender, etc. ... */}
              {/* Distance Div */}
              <div className="space-y-2">
                <label htmlFor="distance" className="text-sm font-medium">
                  Distance from Northeastern (miles)
                </label>
                <Input
                  id="distance"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g., 0.5 (auto-calculates)"
                  value={distanceFromNEU}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || parseFloat(value) >= 0) {
                      setDistanceFromNEU(value);
                    }
                  }}
                  required
                />
                <p className="text-xs text-gray-500">Calculated automatically. Adjust if needed.</p>
              </div>
              {/* Gender Preference Div */}
              <div className="space-y-2">
                <label htmlFor="genderPreference" className="text-sm font-medium">
                  Gender Preference
                </label>
                <Select
                  value={genderPreference}
                  onValueChange={(value) => setGenderPreference(value as "male" | "female" | "any")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select gender preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Open to All</SelectItem>
                    <SelectItem value="male">For Guys</SelectItem>
                    <SelectItem value="female">For Girls</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Pricing Type Div */}
              <div className="space-y-2">
                <label htmlFor="pricingType" className="text-sm font-medium">
                  Pricing Type
                </label>
                <Select
                  value={pricingType}
                  onValueChange={(value) => setPricingType(value as "firm" | "negotiable")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select pricing type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="firm">Firm Price</SelectItem>
                    <SelectItem value="negotiable">Negotiable Price</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Broker's Fee Div */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="brokersFee"
                  checked={noBrokersFee}
                  onCheckedChange={() => setNoBrokersFee(!noBrokersFee)}
                />
                <label
                  htmlFor="brokersFee"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  No Broker's Fee
                </label>
              </div>
              {/* Amenities Div */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Amenities
                </label>
                <AmenitiesSelector
                  selectedAmenities={amenities}
                  onChange={setAmenities}
                />
              </div>
              {/* Dates Div */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "MMM d, yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">End Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "MMM d, yyyy") : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {/* Total Cost Display */}
              {totalCost !== null && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                  <div className="text-sm text-gray-600">Estimated Total Cost:</div>
                  <div className="text-xl font-bold text-neu-red">${totalCost.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">
                    Based on ${price}/month for {differenceInCalendarMonths(endDate!, startDate!) + 1} month(s)
                  </div>
                </div>
              )}
              {/* Description Div */}
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description (max 600 characters)
                </label>
                <Textarea
                  id="description"
                  placeholder="Describe your sublet..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={600}
                  rows={4}
                  required
                />
                <p className="text-xs text-gray-500 text-right">
                  {description.length}/600
                </p>
              </div>
              {/* Add Social Media Inputs */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-md font-semibold text-gray-700">Social Media (Optional)</h3>
                <p className="text-xs text-gray-500">Add your Instagram or Snapchat so interested people can reach out.</p>
                <div className="space-y-2">
                  <label htmlFor="instagramHandle" className="text-sm font-medium">
                    Instagram Username
                  </label>
                  <Input
                    id="instagramHandle"
                    placeholder="e.g., northeastern"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))} // Basic validation
                    maxLength={30}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="snapchatHandle" className="text-sm font-medium">
                    Snapchat Username
                  </label>
                  <Input
                    id="snapchatHandle"
                    placeholder="e.g., northeasternu"
                    value={snapchatHandle}
                    onChange={(e) => setSnapchatHandle(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''))} // Basic validation
                    maxLength={15}
                  />
                </div>
              </div>
              {/* CAPTCHA widget for sublet creation (only in production) */}
              {import.meta.env.MODE !== 'development' && (
                <div className="flex justify-center mb-4">
                  <div ref={turnstileRef} className="cf-turnstile-sublet" />
                </div>
              )}
              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full bg-neu-red hover:bg-neu-red/90"
                disabled={isSubmitting || (import.meta.env.MODE !== 'development' && !captchaToken)}
              >
                {isSubmitting ? "Posting..." : "Post Sublet"}
              </Button>
            </form>
          </div>
        </div>
      </main>

      {/* Bottom Navigation for Desktop/Tablet */}
      {!isMobile && (
        <div className="sticky bottom-0 z-50">
          <BottomNav />
        </div>
      )}
    </div>
  );
};

export default CreateSubletPage;

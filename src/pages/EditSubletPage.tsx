import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSublet } from "@/contexts/SubletContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { CalendarIcon, ArrowLeft, Loader2, Share2, XCircle, ImagePlus } from "lucide-react";
import { CalendarIcon as CalendarIcon2 } from "lucide-react";
import AmenitiesSelector from "@/components/AmenitiesSelector";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import heic2any from 'heic2any';

// Define Northeastern University coordinates
const NEU_COORDINATES = { lat: 42.3398, lng: -71.0892 };
const MAX_PHOTOS = 5; // Define max photos

const EditSubletPage = () => {
  const { subletId } = useParams<{ subletId: string }>();
  const { currentUser } = useAuth();
  const { sublets, updateSublet, uploadPhoto } = useSublet();
  const navigate = useNavigate();

  const sublet = sublets.find(s => s.id === subletId);

  const [price, setPrice] = useState("");
  const [locationInputValue, setLocationInputValue] = useState("");
  const [distanceFromNEU, setDistanceFromNEU] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoFilesToAdd, setPhotoFilesToAdd] = useState<File[]>([]);
  const [photoPreviewsToAdd, setPhotoPreviewsToAdd] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [genderPreference, setGenderPreference] = useState<"male" | "female" | "any">("any");
  const [pricingType, setPricingType] = useState<"firm" | "negotiable">("firm");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noBrokersFee, setNoBrokersFee] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [instagramHandle, setInstagramHandle] = useState("");
  const [snapchatHandle, setSnapchatHandle] = useState("");

  // Load sublet data
  useEffect(() => {
    if (!currentUser) {
      navigate('/auth', { state: { fromProtected: true } });
      return;
    }

    if (sublet) {
      setPrice(String(sublet.price));
      setLocationInputValue(sublet.location);
      setDistanceFromNEU(String(sublet.distanceFromNEU));
      setDescription(sublet.description);
      setStartDate(new Date(sublet.startDate));
      setEndDate(new Date(sublet.endDate));
      setPhotos(sublet.photos || []);
      setGenderPreference(sublet.genderPreference);
      setPricingType(sublet.pricingType);
      setAmenities(sublet.amenities || []);
      setNoBrokersFee(sublet.noBrokersFee || false);
      setInstagramHandle(sublet.instagramHandle || "");
      setSnapchatHandle(sublet.snapchatHandle || "");
      setIsLoading(false);
    } else {
      // Sublet not found or doesn't belong to user
      toast({
        title: "Error",
        description: "Listing not found or you don't have permission to edit it",
        variant: "destructive",
      });
      navigate('/profile');
    }
  }, [currentUser, navigate, sublet]);

  // Cleanup object URLs on unmount or when previews change
  useEffect(() => {
    const previews = photoPreviewsToAdd; // Capture current previews
    return () => {
      previews.forEach(URL.revokeObjectURL);
    };
  }, [photoPreviewsToAdd]);

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

  // Add handlePlaceSelect callback (similar to CreateSubletPage)
  const handlePlaceSelect = useCallback((place: google.maps.places.Place | null, distanceInMiles: number | null) => {
    // LocationAutocomplete calls setLocationInputValue internally via prop
    if (place && place.formattedAddress) {
      if (distanceInMiles !== null) {
        const roundedDistance = distanceInMiles.toFixed(1);
        setDistanceFromNEU(roundedDistance);
        toast({
          title: "Distance Calculated",
          description: `Set distance to approx. ${roundedDistance} miles from NEU.`, // Simplified toast
          variant: "default",
        });
      } else {
        setDistanceFromNEU("0"); // Reset distance if calculation failed
        toast({
          title: "Distance Calculation Failed",
          description: "Could not automatically calculate distance. Using 0 miles.",
          variant: "default",
        });
      }
    } else {
      // Place is null or invalid, reset distance
      setDistanceFromNEU("0");
      if (place) { // Only toast error if place existed but was invalid
        toast({
          title: "Address Error",
          description: "Could not get a valid address from the selection.",
          variant: "destructive",
        });
      }
      // No toast if place was null (input cleared)
    }
  }, [setDistanceFromNEU]);

  // Function to handle removing an *existing* photo (by URL)
  const handleRemoveExistingPhoto = (urlToRemove: string) => {
    setPhotos(currentPhotos => currentPhotos.filter((url) => url !== urlToRemove));
    toast({
      title: "Photo Marked for Removal",
      description: "The photo will be removed when you update the listing.",
      variant: "default"
    });
  };

  // Function to handle removing a *newly added* photo (by index in the preview/file arrays)
  const handleRemoveNewPhotoPreview = (indexToRemove: number) => {
    // Revoke the object URL before removing the preview
    URL.revokeObjectURL(photoPreviewsToAdd[indexToRemove]);

    setPhotoFilesToAdd(prev => prev.filter((_, index) => index !== indexToRemove));
    setPhotoPreviewsToAdd(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // Handle file selection for adding new photos
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !currentUser) return;

    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    const currentTotalPhotos = photos.length + photoFilesToAdd.length;
    const remainingSlots = MAX_PHOTOS - currentTotalPhotos;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      toast({
        title: "Too Many Photos",
        description: `You can only add ${remainingSlots} more photo(s). Max ${MAX_PHOTOS} photos allowed.`,
        variant: "destructive",
      });
    }

    for (const file of filesToProcess) {
      try {
        let processedFile = file;

        // Check if file is HEIC/HEIF and convert to JPEG
        if (file.type === 'image/heic' || file.type === 'image/heif' ||
            file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {

          toast({
            title: "Converting HEIC Image",
            description: `Converting ${file.name} to JPEG format...`,
          });

          try {
            const convertedBlob = await heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: 0.9
            });

            // heic2any can return Blob or Blob[]
            const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

            // Create a new File from the converted blob
            const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
            processedFile = new File([blob], newFileName, { type: 'image/jpeg' });

            toast({
              title: "Conversion Complete",
              description: `${file.name} converted to JPEG successfully!`,
            });
          } catch (conversionError) {
            console.error('HEIC conversion error:', conversionError);
            toast({
              title: "Conversion Failed",
              description: `Could not convert ${file.name}. Please use JPG or PNG instead.`,
              variant: "destructive",
            });
            continue;
          }
        }

        if (processedFile.type.startsWith('image/')) {
          if (photos.length + photoFilesToAdd.length + newFiles.length < MAX_PHOTOS) {
            newFiles.push(processedFile);
            newPreviews.push(URL.createObjectURL(processedFile));
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

    setPhotoFilesToAdd(prev => [...prev, ...newFiles]);
    setPhotoPreviewsToAdd(prev => [...prev, ...newPreviews]);

    // Clear the input value
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !sublet) return;

    const currentTotalPhotos = photos.length + photoFilesToAdd.length;
    if (isSubmitting || isUploadingPhotos) return; // Prevent double submission

    // Validation including photo count
    if (!price || !locationInputValue || !distanceFromNEU || !description || !startDate || !endDate || currentTotalPhotos === 0) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields (including location and dates) and ensure at least one photo is present.",
        variant: "destructive",
      });
      return;
    }
    if (currentTotalPhotos > MAX_PHOTOS) {
      toast({
        title: "Too Many Photos",
        description: `Please remove ${currentTotalPhotos - MAX_PHOTOS} photo(s). Maximum ${MAX_PHOTOS} allowed.`,
        variant: "destructive",
      });
      return;
    }
    if (isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price",
        variant: "destructive",
      });
      return;
    }
    if (isNaN(parseFloat(distanceFromNEU)) || parseFloat(distanceFromNEU) <= 0) {
      toast({
        title: "Invalid Distance",
        description: "Please enter a valid distance from NEU",
        variant: "destructive",
      });
      return;
    }
    if (startDate > endDate) {
      toast({
        title: "Invalid Date Range",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true); // Indicate overall submission start
    let finalPhotoUrls = [...photos]; // Start with existing, filtered photos

    // --- Upload New Photos if any ---
    if (photoFilesToAdd.length > 0) {
      setIsUploadingPhotos(true); // Indicate photo upload start
      const uploadedUrls: string[] = [];
      try {
        for (const file of photoFilesToAdd) {
          const publicUrl = await uploadPhoto(file, currentUser.id);
          if (publicUrl) {
            uploadedUrls.push(publicUrl);
          } else {
            // Throw error if uploadPhoto returns null (it handles its own toast)
            throw new Error(`Failed to upload ${file.name}.`);
          }
        }
        finalPhotoUrls = [...finalPhotoUrls, ...uploadedUrls]; // Add new URLs
        setPhotoFilesToAdd([]); // Clear the files to add state
        setPhotoPreviewsToAdd([]); // Clear previews
      } catch (uploadError) {
        console.error("Error uploading photos during update:", uploadError);
        // Toasting is handled within uploadPhoto or the catch block above
        setIsUploadingPhotos(false);
        setIsSubmitting(false);
        return; // Stop the submission process
      } finally {
        setIsUploadingPhotos(false); // Indicate photo upload end
      }
    }
    // --- End Upload New Photos ---

    try {
      // Use updateSublet from context with the final list of photo URLs
      await updateSublet(sublet.id, {
        price: parseFloat(price),
        location: locationInputValue,
        distanceFromNEU: parseFloat(distanceFromNEU),
        description,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        photos: finalPhotoUrls, // Pass the combined list
        genderPreference: genderPreference,
        pricingType: pricingType,
        amenities,
        noBrokersFee: noBrokersFee,
        instagramHandle: instagramHandle.trim() || null,
        snapchatHandle: snapchatHandle.trim() || null,
      });

      toast({
        title: "Listing Updated",
        description: "Your listing has been successfully updated",
      });

      navigate('/profile');
    } catch (error: any) {
      console.error("Error updating sublet:", error);
      toast({
        title: "Update Error",
        description: error.message || "Failed to update your listing after photo upload",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false); // Indicate overall submission end regardless of success/failure
    }
  };

  // Function to handle copying the link
  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Link Copied!",
        description: "The listing link has been copied to your clipboard.",
      });
    } catch (err) {
      console.error("Failed to copy link: ", err);
      toast({
        title: "Error",
        description: "Could not copy the link.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neu-red" />
        <p className="mt-4 text-gray-600">Loading listing details...</p>
      </div>
    );
  }

  return (
    <div className="pb-20 max-w-2xl mx-auto">
      <header className="bg-neu-red text-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-neu-red/80"
            onClick={() => navigate('/profile')}
          >
            <ArrowLeft />
          </Button>
          <h1 className="text-xl font-bold ml-2">Edit Listing</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-neu-red/80"
          onClick={handleShare}
        >
          <Share2 />
        </Button>
      </header>

      <form className="p-4 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="price" className="text-sm font-medium">
            Monthly Price ($) *
          </label>
          <Input
            id="price"
            type="number"
            placeholder="1000"
            min="1"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="location" className="text-sm font-medium">
            Location *
          </label>
          <LocationAutocomplete
            onPlaceSelect={handlePlaceSelect}
            inputValue={locationInputValue}
            setInputValue={setLocationInputValue}
            destinationCoordinates={NEU_COORDINATES}
            placeholder="Start typing and select an address from the suggestions."
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="distanceFromNEU" className="text-sm font-medium">
            Distance from NEU (miles) *
          </label>
          <Input
            id="distanceFromNEU"
            type="number"
            placeholder="0.5"
            min="0"
            step="0.1"
            value={distanceFromNEU}
            onChange={(e) => setDistanceFromNEU(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium">Availability Period *</label>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon2 className="mr-2 h-4 w-4" />
                    {startDate ? (
                      format(startDate, "PPP")
                    ) : (
                      <span>Start date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate || undefined}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon2 className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>End date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate || undefined}
                    onSelect={setEndDate}
                    initialFocus
                    disabled={(date) =>
                      startDate ? date < startDate : false
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Gender Preference</label>
          <Select
            value={genderPreference}
            onValueChange={(value) => setGenderPreference(value as "male" | "female" | "any")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">For males</SelectItem>
              <SelectItem value="female">For females</SelectItem>
              <SelectItem value="any">No preference</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Pricing Type</label>
          <Select
            value={pricingType}
            onValueChange={(value) => setPricingType(value as "firm" | "negotiable")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Firm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="firm">Firm Price</SelectItem>
              <SelectItem value="negotiable">Negotiable Price</SelectItem>
            </SelectContent>
          </Select>
        </div>

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

        <div className="space-y-2">
          <label className="text-sm font-medium">Amenities</label>
          <AmenitiesSelector
            selectedAmenities={amenities}
            onChange={setAmenities}
          />
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

        <div className="space-y-2">
          <label htmlFor="description" className="text-sm font-medium">
            Description (max 600 characters) *
          </label>
          <Textarea
            id="description"
            placeholder="Describe your sublet..."
            maxLength={600}
            className="h-24"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <div className="text-xs text-gray-500 text-right">
            {description.length}/600
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-md font-semibold text-gray-700">Social Media (Optional)</h3>
          <p className="text-xs text-gray-500">Update your Instagram or Snapchat usernames.</p>
          <div className="space-y-2">
            <label htmlFor="instagramHandle" className="text-sm font-medium">
              Instagram Username
            </label>
            <Input
              id="instagramHandle"
              placeholder="e.g., northeastern"
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))}
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
              onChange={(e) => setSnapchatHandle(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ''))}
              maxLength={15}
            />
          </div>
        </div>

        {/* Photo Display and Management Section */}
        <div className="space-y-2 pt-4 border-t">
          <h3 className="text-md font-semibold text-gray-700">Manage Photos ({photos.length + photoPreviewsToAdd.length} / {MAX_PHOTOS}) *</h3>
          <p className="text-xs text-gray-500">
            View, remove, or add photos. You need at least one photo.
          </p>
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            id="photo-upload"
            disabled={isUploadingPhotos || (photos.length + photoFilesToAdd.length >= MAX_PHOTOS)}
          />

          {/* Grid for Photos */}
          <div className="grid grid-cols-3 gap-2">
            {/* Existing Photos */}
            {photos.map((photoUrl) => (
              <div key={photoUrl} className="relative group aspect-square">
                <img
                  src={photoUrl}
                  alt="Existing sublet photo"
                  className="w-full h-full object-cover rounded-md"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveExistingPhoto(photoUrl)}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove existing photo"
                  disabled={isUploadingPhotos || isSubmitting}
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            ))}

            {/* New Photo Previews */}
            {photoPreviewsToAdd.map((previewUrl, index) => (
              <div key={previewUrl} className="relative group aspect-square">
                <img
                  src={previewUrl}
                  alt={`New photo preview ${index + 1}`}
                  className="w-full h-full object-cover rounded-md"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveNewPhotoPreview(index)}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove new photo"
                  disabled={isUploadingPhotos || isSubmitting}
                >
                  <XCircle className="h-4 w-4" />
                </button>
                {/* Optional: Add an indicator for 'new' photos if needed */}
                <div className="absolute bottom-1 left-1 bg-blue-500 text-white text-[10px] px-1 rounded-sm">New</div>
              </div>
            ))}

            {/* Upload Slot */}
            {(photos.length + photoFilesToAdd.length) < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-neu-red cursor-pointer text-gray-400"
                disabled={isUploadingPhotos || isSubmitting}
                aria-label="Add photo"
              >
                {isUploadingPhotos ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
              </button>
            )}
          </div>

          {/* Validation/Info Message */}
          {(photos.length + photoPreviewsToAdd.length === 0) && !isUploadingPhotos && (
            <p className="text-sm text-red-600 mt-2">Please add at least one photo.</p>
          )}
          {(photos.length + photoPreviewsToAdd.length > 0) && !isUploadingPhotos && (
            <p className="text-xs text-gray-500 mt-1">Click 'Update Listing' to save changes.</p>
          )}
          {isUploadingPhotos && (
            <div className="flex items-center text-sm text-gray-600 mt-2">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading photos...
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/profile')}
            disabled={isSubmitting || isUploadingPhotos} // Disable cancel during operations
          >
            Cancel
          </Button>

          <Button
            type="submit"
            className="bg-neu-red hover:bg-red-800"
            disabled={isSubmitting || isUploadingPhotos || (photos.length + photoFilesToAdd.length === 0)} // Disable submit if uploading, submitting, or no photos
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isUploadingPhotos ? 'Uploading...' : 'Saving...'}
              </>
            ) : (
              "Update Listing"
            )}
          </Button>
        </div>
      </form>

      <BottomNav />
    </div>
  );
};

export default EditSubletPage;

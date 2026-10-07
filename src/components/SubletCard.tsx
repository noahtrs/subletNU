import { useState, useEffect } from "react";
import { Sublet } from "../types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css"; // Import lightbox styles

interface SubletCardProps {
  sublet: Sublet;
  expanded?: boolean;
}

// Utility function to get the short address (e.g., "123 Main St")
const getShortAddress = (fullAddress: string): string => {
  if (!fullAddress) return "";
  // Split by comma and take the first part (street address)
  return fullAddress.split(',')[0].trim();
};

const SubletCard = ({ sublet, expanded = false }: SubletCardProps) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false); // State for lightbox
  const [aspectRatioClass, setAspectRatioClass] = useState('aspect-video'); // Default to landscape
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setAspectRatioClass('aspect-video');
  }, [currentPhotoIndex]);

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentPhotoIndex < sublet.photos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    }
  };

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  // Open lightbox when image is clicked
  const handleImageClick = (e: React.MouseEvent) => {
    // Only open lightbox if the card is expanded (on the detail page)
    if (expanded) {
      e.stopPropagation(); // Prevent triggering other clicks if needed
      setIsLightboxOpen(true);
    }
    // If not expanded, do nothing here; the main card click handler will navigate
  };

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    const ratio = naturalWidth / naturalHeight;

    if (ratio > 1.2) { // Wider than 5:4 -> Landscape
      setAspectRatioClass('aspect-video'); // 16:9
    } else if (ratio < 0.8) { // Taller than 4:5 -> Portrait
      setAspectRatioClass('aspect-[3/4]'); // 3:4
    } else { // Close to square
      setAspectRatioClass('aspect-square'); // 1:1
    }
  };

  const handleCardClick = () => {
    if (!expanded) {
      navigate(`/sublet/${sublet.id}`);
    }
  };

  const handleMessageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/messages/${sublet.userId}`, { state: { subletId: sublet.id } });
  };

  const formatDateRange = () => {
    const start = new Date(sublet.startDate);
    const end = new Date(sublet.endDate);
    return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
  };

  const getGenderBadge = () => {
    const genderInfo = {
      male: {
        label: "For guys",
        className: "bg-soft-blue hover:bg-soft-blue"
      },
      female: {
        label: "For girls",
        className: "bg-soft-pink hover:bg-soft-pink"
      },
      any: {
        label: "Open to all",
        className: "bg-light-purple hover:bg-light-purple"
      }
    };

    const preference = sublet.genderPreference || "any";
    const info = genderInfo[preference];

    return (
      <Badge
        variant="outline"
        className={`${info.className} border-none text-gray-700 font-medium inline-flex w-auto whitespace-nowrap px-2 py-0.5`}
      >
        {info.label}
      </Badge>
    );
  };

  const getPricingBadge = () => {
    return (
      <Badge
        variant="outline"
        className={`${sublet.pricingType === 'negotiable' ? 'bg-green-100 hover:bg-green-100' : 'bg-gray-100 hover:bg-gray-100'} border-none text-gray-700 font-medium inline-flex w-auto whitespace-nowrap px-2 py-0.5`}
      >
        {sublet.pricingType === 'negotiable' ? 'Negotiable Price' : 'Firm Price'}
      </Badge>
    );
  };

  const getAmenityBadges = () => {
    if (!sublet.amenities || sublet.amenities.length === 0) {
      return null;
    }

    // Display up to 3 amenities
    const displayedAmenities = sublet.amenities.slice(0, 3);

    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {displayedAmenities.map((amenity) => (
          <Badge
            key={amenity}
            variant="outline"
            className="bg-gray-50 text-xs border-none rounded-md px-2 py-0.5 whitespace-nowrap min-w-0 w-auto max-w-full"
            style={{ display: 'inline-block', lineHeight: '1.2', padding: '0 0.5rem', minWidth: 0, width: 'auto', maxWidth: '100%' }}
          >
            <span className="inline-block whitespace-nowrap w-auto min-w-0 max-w-full" style={{ padding: 0 }}>{amenity}</span>
          </Badge>
        ))}
      </div>
    );
  };

  // Prepare slides for the lightbox
  const lightboxSlides = sublet.photos.map(photoUrl => ({ src: photoUrl }));

  // Add function to format description with line breaks
  const formatDescription = (text: string) => {
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  // Add function to check if description needs expansion
  const shouldShowExpandButton = () => {
    return !expanded && (
      sublet.description.length > 150 ||
      sublet.description.split('\n').length > 2
    );
  };

  // Add function to get truncated description
  const getTruncatedDescription = () => {
    if (isDescriptionExpanded) {
      return formatDescription(sublet.description);
    }

    const lines = sublet.description.split('\n');
    if (lines.length > 2) {
      return formatDescription(lines.slice(0, 2).join('\n') + '...');
    }

    if (sublet.description.length > 150) {
      return formatDescription(sublet.description.slice(0, 150) + '...');
    }

    return formatDescription(sublet.description);
  };

  // Define the content to be rendered
  const cardContent = (
    <>
      <div className={`photo-carousel relative w-full overflow-hidden ${aspectRatioClass} ${expanded ? 'rounded-t-lg' : 'rounded-t-md'} bg-gray-100 flex items-center justify-center`}>
        <div
          onClick={expanded ? handleImageClick : undefined} // Attach click handler only when expanded
          className={`cursor-${expanded ? 'pointer' : 'default'} w-full h-full flex items-center justify-center`}
        >
          <img
            key={sublet.photos[currentPhotoIndex]}
            src={sublet.photos[currentPhotoIndex]}
            alt={`Sublet at ${sublet.location}`}
            className={`carousel-image object-contain max-w-full max-h-full`}
            onLoad={handleImageLoad}
          />
        </div>

        {sublet.photos.length > 1 && (
          <>
            <button
              onClick={handlePrevPhoto}
              disabled={currentPhotoIndex === 0}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-70 disabled:opacity-50"
              aria-label="Previous photo"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleNextPhoto}
              disabled={currentPhotoIndex === sublet.photos.length - 1}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full p-1 hover:bg-opacity-70 disabled:opacity-50"
              aria-label="Next photo"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded-full">
              {currentPhotoIndex + 1}/{sublet.photos.length}
            </div>
          </>
        )}
      </div>

      <div className={expanded ? "p-4" : "p-4 lg:flex lg:flex-col lg:flex-1"}>
        {/* Top section: Price and badges */}
        <div className={`flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-0 ${expanded ? '' : 'lg:flex-col lg:gap-1'}`}>
          <div className="flex flex-col gap-1">
            <div className="text-xl font-bold text-neu-red">${sublet.price}/mo</div>
            <div className="flex flex-row flex-nowrap items-center gap-2">
              {getGenderBadge()}
              {getPricingBadge()}
            </div>
          </div>
          {/* Address, distance, and date info */}
          <div className={`text-sm text-gray-600 mt-1 sm:mt-0 ${expanded ? '' : 'lg:mt-1'}`}>
            {getShortAddress(sublet.location)} • {sublet.distanceFromNEU} mi from NU • {formatDateRange()}
          </div>
        </div>
        {/* Description */}
        <div className="mt-2 text-gray-800 text-sm">
          <div className={!expanded && !isDescriptionExpanded ? 'lg:line-clamp-4' : ''}>
            {expanded ? formatDescription(sublet.description) : getTruncatedDescription()}
          </div>
          {!expanded && shouldShowExpandButton() && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 h-6 text-neu-red hover:text-neu-red/90 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setIsDescriptionExpanded(!isDescriptionExpanded);
              }}
            >
              {isDescriptionExpanded ? (
                <>Show less <ChevronUp className="h-4 w-4 ml-1" /></>
              ) : (
                <>Show more <ChevronDown className="h-4 w-4 ml-1" /></>
              )}
            </Button>
          )}
        </div>
        {/* Amenities */}
        {getAmenityBadges()}
        {/* Social/contact and message button */}
        <div className={`mt-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0 ${expanded ? '' : 'lg:mt-auto lg:pt-4 lg:flex-col lg:items-stretch lg:gap-2'}`}>
          <div className="text-sm text-gray-600">
            {(sublet.instagramHandle || sublet.snapchatHandle) ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                {sublet.instagramHandle && (
                  <a
                    href={`https://instagram.com/${sublet.instagramHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                  >
                    <img src="/images/icons8-instagram.svg" alt="Instagram" className="w-5 h-5" />
                    <span className="text-gray-500 truncate">@{sublet.instagramHandle}</span>
                  </a>
                )}
                {sublet.snapchatHandle && (
                  <a
                    href={`https://snapchat.com/add/${sublet.snapchatHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                  >
                    <img src="/images/icons8-snapchat.svg" alt="Snapchat" className="w-5 h-5" />
                    <span className="text-gray-500 truncate">@{sublet.snapchatHandle}</span>
                  </a>
                )}
              </div>
            ) : (
              <span className="text-gray-500">Posted by: {sublet.userEmail}</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className={`text-neu-red border-neu-red hover:bg-neu-red hover:text-white w-full sm:w-auto mt-2 sm:mt-0 ${expanded ? '' : 'lg:w-full'}`}
            onClick={handleMessageClick}
          >
            <MessageSquare size={16} className="mr-1" />
            Message
          </Button>
        </div>
      </div>
    </>
  );

  // Conditionally wrap content in Card or a simple div
  return (
    <>
      {expanded ? (
        <div className="sublet-card-expanded bg-white rounded-lg shadow overflow-hidden">
          {cardContent}
        </div>
      ) : (
        <Card
          className="sublet-card cursor-pointer overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
          onClick={handleCardClick}
        >
          {cardContent}
        </Card>
      )}

      {/* Render Lightbox */}
      <Lightbox
        open={isLightboxOpen}
        close={() => setIsLightboxOpen(false)}
        slides={lightboxSlides}
        index={currentPhotoIndex} // Start lightbox at the currently viewed photo
        on={{ view: ({ index: currentIndex }) => setCurrentPhotoIndex(currentIndex) }} // Sync card index with lightbox
      />
    </>
  );
};

export default SubletCard;

import { Sublet } from "../types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPostedDate, formatSubletDateRange, isSubletExpired } from "@/lib/utils";
import { Edit, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ProfileListingCardProps {
  sublet: Sublet;
  onDelete?: (subletId: string) => void;
  onEdit?: (subletId: string) => void;
}

const ProfileListingCard = ({ sublet, onDelete, onEdit }: ProfileListingCardProps) => {
  const navigate = useNavigate();

  const handleViewClick = () => {
    navigate(`/sublet/${sublet.id}`);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(sublet.id);
    } else {
      navigate(`/edit/${sublet.id}`);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(sublet.id);
    }
  };

  const formatDateRange = () => formatSubletDateRange(sublet.startDate, sublet.endDate);
  const isExpired = isSubletExpired(sublet.endDate);

  const posted = formatPostedDate(sublet.createdAt);

  return (
    <Card
      className="my-2 cursor-pointer hover:shadow-md transition-shadow"
      onClick={handleViewClick}
    >
      <div className="flex p-4">
        <div className="w-24 h-24 mr-4 overflow-hidden rounded">
          <img
            src={sublet.photos[0]}
            alt={sublet.location}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1">
          <div className="flex justify-between">
            <div className="flex items-center gap-2">
              <div className="font-bold text-neu-red">${sublet.price}/mo</div>
              {isExpired && (
                <Badge
                  variant="outline"
                  className="bg-gray-700 hover:bg-gray-700 border-none text-white font-medium"
                >
                  Expired
                </Badge>
              )}
            </div>
            <Badge
              variant="outline"
              className={`${sublet.pricingType === 'negotiable' ? 'bg-green-100 hover:bg-green-100' : 'bg-gray-100 hover:bg-gray-100'} border-none text-gray-700 font-medium`}
            >
              {sublet.pricingType === 'negotiable' ? 'Negotiable Price' : 'Firm Price'}
            </Badge>
          </div>

          <div className="text-sm text-gray-600 mt-1">
            {sublet.distanceFromNEU} mi from NEU • {formatDateRange()}
          </div>

          {posted && (
            <div className="text-xs text-gray-400 mt-0.5" title={posted.absolute}>
              Posted {posted.relative}
            </div>
          )}

          <p className="text-sm text-gray-800 line-clamp-1 mt-1">
            {sublet.description}
          </p>

          {isExpired && (
            <p className="text-xs text-gray-500 mt-1">
              This listing's dates have passed, so it's hidden from search. Edit the dates to relist it, or delete it.
            </p>
          )}

          {/* Add Social Media Handles Display */}
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-500 mt-2">
            {sublet.instagramHandle && (
              <span className="flex items-center">
                {/* Update IMG tag src */}
                <img src="/images/icons8-instagram.svg" alt="Instagram" className="w-4 h-4 mr-1" />
                @{sublet.instagramHandle}
              </span>
            )}
            {sublet.snapchatHandle && (
              <span className="flex items-center">
                {/* Update IMG tag src */}
                <img src="/images/icons8-snapchat.svg" alt="Snapchat" className="w-4 h-4 mr-1" />
                @{sublet.snapchatHandle}
              </span>
            )}
          </div>

          <div className="flex justify-end mt-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-gray-600"
              onClick={handleEditClick}
            >
              <Edit size={16} />
              <span className="ml-1">Edit</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleDeleteClick}
            >
              <Trash2 size={16} />
              <span className="ml-1">Delete</span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ProfileListingCard;

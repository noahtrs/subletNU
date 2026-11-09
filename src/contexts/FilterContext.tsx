import { createContext, useContext, useState, ReactNode } from "react";
import { Sublet } from "../types";
import { useSublet } from "./SubletContext";
import { isSubletExpired } from "@/lib/utils";

type FilterContextType = {
  filteredSublets: Sublet[];
  isLoading: boolean;
  maxPrice: number;
  maxDistance: number;
  dateRange: { start: string | null; end: string | null };
  genderFilter: "male" | "female" | "any" | "all";
  pricingTypeFilter: "firm" | "negotiable" | "all";
  amenitiesFilter: string[];
  setMaxPrice: (price: number) => void;
  setMaxDistance: (distance: number) => void;
  setDateRange: (range: { start: string | null; end: string | null }) => void;
  setGenderFilter: (gender: "male" | "female" | "any" | "all") => void;
  setPricingTypeFilter: (type: "firm" | "negotiable" | "all") => void;
  setAmenitiesFilter: (amenities: string[]) => void;
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider = ({ children }: { children: ReactNode }) => {
  const { sublets, isLoadingSublets } = useSublet();
  const [maxPrice, setMaxPrice] = useState<number>(3000);
  const [maxDistance, setMaxDistance] = useState<number>(5);
  const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  });
  const [genderFilter, setGenderFilter] = useState<"male" | "female" | "any" | "all">("all");
  const [pricingTypeFilter, setPricingTypeFilter] = useState<"firm" | "negotiable" | "all">("all");
  const [amenitiesFilter, setAmenitiesFilter] = useState<string[]>([]);

  // While the first fetch is in flight, `sublets` holds the cached list from the
  // last visit (if any), so filter and show that instead of a spinner.
  const isLoading = isLoadingSublets && sublets.length === 0;

  const filteredSublets = isLoading || !sublets
    ? []
    : sublets.filter((sublet) => {
      // Listings whose dates have passed stay in the DB (owners can still see,
      // edit, or relist them) but are hidden from browsing.
      if (isSubletExpired(sublet.endDate)) return false;

      const priceFilter = sublet.price <= maxPrice;
      const distanceFilter = sublet.distanceFromNEU <= maxDistance;

      let dateFilter = true;
      if (dateRange.start && dateRange.end) {
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        const subletStart = new Date(sublet.startDate);
        const subletEnd = new Date(sublet.endDate);

        dateFilter = (
          (subletStart <= end && subletEnd >= start)
        );
      }

      const genderFilterMatch = genderFilter === "all" || sublet.genderPreference === genderFilter;
      const pricingTypeFilterMatch = pricingTypeFilter === "all" || sublet.pricingType === pricingTypeFilter;

      const amenitiesFilterMatch = amenitiesFilter.length === 0 ||
        (sublet.amenities && amenitiesFilter.every(amenity => sublet.amenities.includes(amenity)));

      return priceFilter && distanceFilter && dateFilter && genderFilterMatch && pricingTypeFilterMatch && amenitiesFilterMatch;
    });

  const value = {
    filteredSublets,
    isLoading,
    maxPrice,
    maxDistance,
    dateRange,
    genderFilter,
    pricingTypeFilter,
    amenitiesFilter,
    setMaxPrice,
    setMaxDistance,
    setDateRange,
    setGenderFilter,
    setPricingTypeFilter,
    setAmenitiesFilter,
  };

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
};

export const useFilter = () => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error("useFilter must be used within a FilterProvider");
  }
  return context;
}; 
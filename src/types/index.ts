export interface User {
  id: string;
  email: string;
  verified: boolean;
}

export interface Sublet {
  id: string;
  userId: string;
  userEmail: string;
  price: number;
  location: string;
  distanceFromNEU: number;
  startDate: string;
  endDate: string;
  description: string;
  photos: string[];
  createdAt: string;
  genderPreference: "male" | "female" | "any";
  pricingType: "firm" | "negotiable";
  amenities?: string[];
  noBrokersFee?: boolean;
  instagramHandle?: string;
  snapchatHandle?: string;
  saved_at?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
}

export interface SavedListing {
  id: string;
  userId: string;
  listingId: string;
  createdAt: string;
}

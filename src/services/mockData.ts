
import { Sublet, User, Message } from "../types";

// Mock Users
export const mockUsers: User[] = [
  {
    id: "user1",
    email: "jane.doe@northeastern.edu",
    verified: true,
  },
  {
    id: "user2",
    email: "john.smith@northeastern.edu",
    verified: true,
  },
  {
    id: "user3",
    email: "alex.chen@northeastern.edu",
    verified: true,
  },
];

// Mock Sublets
export const mockSublets: Sublet[] = [
  {
    id: "sublet1",
    userId: "user1",
    userEmail: "jane.doe@northeastern.edu",
    price: 750,
    location: "Huntington Ave",
    distanceFromNEU: 0.5,
    startDate: "2023-05-01",
    endDate: "2023-08-31",
    description: "Cozy 1-bed near Huntington Ave",
    photos: [
      "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
    ],
    createdAt: "2023-03-15T12:00:00Z",
    genderPreference: "female",
    pricingType: "firm"
  },
  {
    id: "sublet2",
    userId: "user2",
    userEmail: "john.smith@northeastern.edu",
    price: 850,
    location: "Mission Hill",
    distanceFromNEU: 1.2,
    startDate: "2023-06-01",
    endDate: "2023-09-15",
    description: "Spacious 2-bed apartment with roommate",
    photos: [
      "https://images.unsplash.com/photo-1721322800607-8c38375eef04?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1649972904349-6e44c42644a7?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
    ],
    createdAt: "2023-03-18T14:30:00Z",
    genderPreference: "male",
    pricingType: "negotiable"
  },
  {
    id: "sublet3",
    userId: "user3",
    userEmail: "alex.chen@northeastern.edu",
    price: 950,
    location: "Symphony",
    distanceFromNEU: 0.8,
    startDate: "2023-05-15",
    endDate: "2023-07-31",
    description: "Modern studio with gym access",
    photos: [
      "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1721322800607-8c38375eef04?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"
    ],
    createdAt: "2023-03-20T09:45:00Z",
    genderPreference: "any",
    pricingType: "firm"
  },
];

// Mock Messages
export const mockMessages: Message[] = [
  {
    id: "msg1",
    senderId: "user2",
    receiverId: "user1",
    text: "Is the apartment still available?",
    timestamp: "2023-03-21T10:15:00Z",
  },
  {
    id: "msg2",
    senderId: "user1",
    receiverId: "user2",
    text: "Yes, it's available! When would you like to see it?",
    timestamp: "2023-03-21T10:35:00Z",
  },
];

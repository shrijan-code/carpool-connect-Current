import { Timestamp } from 'firebase/firestore';

export type City = 'Canberra' | 'Sydney' | 'Melbourne';
export type SpaceSize = 'small' | 'medium' | 'large';
export type TripStatus = 'open' | 'full' | 'completed' | 'cancelled';
export type Community = 'nepali' | 'indian' | 'srilankan' | 'filipino' | 'other';

export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'paid'
  | 'picked_up'
  | 'delivered'
  | 'cancelled'
  | 'disputed'
  | 'refunded';

export type ItemCategory =
  | 'food_homecooked'
  | 'food_packaged'
  | 'documents'
  | 'clothing'
  | 'gifts_small'
  | 'cultural_religious'
  | 'other';

export interface DeclarationRecord {
  noDrugs: boolean;
  noWeapons: boolean;
  noCash: boolean;
  noStolenGoods: boolean;
  noDangerousGoods: boolean;
  noRestrictedItems: boolean;
  descriptionAccurate: boolean;
  acceptsLiability: boolean;
  signedName: string;
  signedAt: string;
  ipAddress: string;
  userAgent: string;
}

export interface User {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  photoURL: string | null;
  idVerified: boolean;
  communityVerified: boolean;
  community: Community;
  rating: number;
  totalRatings: number;
  totalDeliveries: number;
  totalSent: number;
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  bio: string;
  cities: City[];
  responseRate?: number;
  pendingPayout?: {
    amount: number;
    bookingId: string;
    failedAt: string;
  };
}

export interface Trip {
  id: string;
  travellerId: string;
  travellerName: string;
  travellerPhoto: string | null;
  travellerRating: number;
  fromCity: City;
  toCity: City;
  travelDate: Timestamp;
  departureTime: string;
  availableSpace: SpaceSize;
  pricePerKg: number;
  maxWeight: number;
  maxItems: number;
  currentItems: number;
  restrictions: string[];
  notes: string;
  status: TripStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Booking {
  id: string;
  tripId: string;
  travellerId: string;
  senderId: string;
  senderName: string;
  recipientName: string;
  recipientPhone: string;
  recipientCity: string;
  itemDescription: string;
  itemCategory: ItemCategory;
  itemPhotoURL: string;
  estimatedWeight: number;
  agreedPrice: number;
  platformFee: number;
  travellerPayout: number;
  declarationSignedAt: Timestamp | null;
  declarationData: DeclarationRecord | null;
  stripePaymentIntentId: string | null;
  stripeTransferId: string | null;
  status: BookingStatus;
  pickupLocation: string;
  pickupConfirmedAt: Timestamp | null;
  deliveryConfirmedAt: Timestamp | null;
  cancelledAt: Timestamp | null;
  cancelledBy: string | null;
  disputeReason: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  fromCity?: City;
  toCity?: City;
  travelDate?: Timestamp;
}

export interface Message {
  id: string;
  bookingId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: Timestamp;
  readBy: string[];
}

export interface Rating {
  id: string;
  bookingId: string;
  ratedBy: string;
  ratedUser: string;
  role: 'traveller' | 'sender';
  score: number;
  comment: string;
  createdAt: Timestamp;
}

export interface Incident {
  id: string;
  bookingId: string;
  userId: string;
  type: 'police_stop' | 'lost_item' | 'damage' | 'dispute' | 'suspicious_item';
  description: string;
  evidenceURLs: string[];
  status: 'open' | 'investigating' | 'resolved';
  createdAt: Timestamp;
  resolvedAt: Timestamp | null;
  adminNotes: string;
}

export const CITIES: City[] = ['Canberra', 'Sydney', 'Melbourne'];

export const ITEM_CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: 'food_homecooked', label: 'Home cooked food' },
  { value: 'food_packaged', label: 'Packaged food' },
  { value: 'documents', label: 'Documents' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'gifts_small', label: 'Small gifts' },
  { value: 'cultural_religious', label: 'Cultural / religious items' },
  { value: 'other', label: 'Other' },
];

export const RESTRICTIONS = [
  { value: 'no_liquids', label: 'No liquids' },
  { value: 'food_only', label: 'Food items only' },
  { value: 'no_fragile', label: 'No fragile items' },
  { value: 'documents_only', label: 'Documents only' },
  { value: 'small_items_only', label: 'Small items only' },
];

export const ROUTE_DISTANCES: Record<string, { km: number; hours: number }> = {
  'Canberra-Sydney': { km: 290, hours: 3.5 },
  'Sydney-Canberra': { km: 290, hours: 3.5 },
  'Sydney-Melbourne': { km: 880, hours: 9 },
  'Melbourne-Sydney': { km: 880, hours: 9 },
  'Canberra-Melbourne': { km: 650, hours: 7 },
  'Melbourne-Canberra': { km: 650, hours: 7 },
};

export const PLATFORM_FEE_RATE = 0.13;

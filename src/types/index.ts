// Core user types
export interface User {
  id: string;
  displayName: string;
  name: string;
  email: string;
  phone: string;
  photoURL?: string;
  role: 'driver' | 'rider' | 'both';
  preferredRole?: 'driver' | 'rider';
  canBeDriver: boolean;
  canBeRider: boolean;
  avatar?: string;
  rating: number;
  totalRides: number;
  joinedDate: string;
  verified: boolean;
  profilePicture?: string;
  carDetails?: Vehicle;
  stripeAccountId?: string;
  defaultPaymentMethodId?: string;
  stripeConnectCompleted?: boolean;
  stripeConnectCompletedAt?: string;
  stripeConnectState?: string;
  stripeConnectStarted?: string;
  stripeChargesEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
  stripeRequirements?: string[];
  walkingDistanceTolerance?: number;
  fcmToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  seats: number;
  registrationDocument?: string;
  insuranceDocument?: string;
  verified: boolean;
}

export interface Location {
  id?: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  latitude?: number;
  longitude?: number;
}

// Ride types following the new schema
export interface Ride {
  id: string;
  driverId: string;
  driver?: User;
  vehicle?: Vehicle;
  origin: Location;
  destination: Location;
  departureAt: string; // Timestamp
  totalSeats: number;
  seatsAvailable: number;
  pricePerSeatCents: number; // cents, integer
  status: 'active' | 'cancelled' | 'completed' | 'draft';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  passengers?: RidePassenger[];
  distance?: string;
  duration?: string;
  route?: RoutePoint[];
  incidentImages?: string[];
  note?: string;
  // Legacy fields for backward compatibility
  from?: Location;
  to?: Location;
  departureTime?: string;
  availableSeats?: number;
  seatsTotal?: number;
  pricePerSeat?: number;
}

export interface RidePassenger {
  id: string;
  seats: number;
  bookingId: string;
  user: User;
}

// Booking types following the new schema
export interface Booking {
  id: string;
  rideId: string;
  driverId: string;
  riderId: string | null;
  seats: number;
  status: 'requested' | 'pending_driver' | 'accepted' | 'declined' | 'cancelled_rider' | 'cancelled_driver' | 'completed' | 'refunded';
  payment: {
    id: string;
    status: 'mock_authorized' | 'mock_captured' | 'voided' | 'refunded';
    amountCents: number;
    platformFeeCents: number;
  };
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  ride?: Ride;
  passenger?: User;
  amountTotal?: number; // Legacy field
  rejectionReason?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  rejectedBy?: string;
}

// Chat and messaging
export interface ChatMessage {
  id: string;
  rideId: string;
  bookingId?: string;
  threadId?: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
  type: 'text' | 'system' | 'image';
  imageUrl?: string;
  readBy: string[];
}

export interface MessageThread {
  id: string;
  bookingId: string;
  rideId: string;
  driverId: string;
  passengerId: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: string;
  createdAt: string;
  updatedAt: string;
}

// Notifications
export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'booking_request' | 'booking_accepted' | 'booking_rejected' | 'ride_started' | 'ride_completed' | 'message' | 'payment' | 'system';
  data?: any;
  read: boolean;
  createdAt: string;
}

// Reviews and ratings
export interface Review {
  id: string;
  rideId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

// Payment and financial
export interface PaymentMethod {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  type: 'card';
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

export interface MockPayment {
  id: string;
  status: 'mock_authorized' | 'mock_captured' | 'voided' | 'refunded';
  amountCents: number;
  platformFeeCents: number;
  createdAt: string;
  updatedAt: string;
}

// Utility types
export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp?: string;
}

export interface AdminStats {
  totalUsers: number;
  totalRides: number;
  totalBookings: number;
  totalRevenue: number;
  activeRides: number;
  pendingDisputes: number;
}

// Audit and logging
export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  data?: any;
  timestamp: string;
  createdAt: string;
}

export interface BookingAudit {
  id: string;
  bookingId: string;
  action: string;
  userId: string;
  previousStatus?: string;
  newStatus: string;
  data?: any;
  timestamp: string;
}

export interface PaymentAudit {
  id: string;
  paymentId: string;
  action: string;
  previousStatus?: string;
  newStatus: string;
  amountCents: number;
  data?: any;
  timestamp: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Form and validation types
export interface CreateRideForm {
  origin: Location;
  destination: Location;
  departureDate: string;
  departureTime: string;
  totalSeats: number;
  pricePerSeatCents: number;
  note?: string;
}

export interface SearchRideForm {
  origin: Location;
  destination: Location;
  departureDate: string;
  walkingTolerance: number;
}

export interface BookingForm {
  seats: number;
  specialRequests?: string;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Configuration types
export interface AppConfig {
  PLATFORM_FEE_PERCENT: number;
  RESERVATION_TTL_MINUTES: number;
  CANCELLATION_POLICY: {
    FULL_REFUND_HOURS: number;
    PARTIAL_REFUND_PERCENT: number;
  };
  GOOGLE_MAPS_CONFIG: {
    API_KEY: string;
    COUNTRY_RESTRICTION: string;
  };
}
export interface User {
  id: string;
  displayName: string;
  name: string;
  email: string;
  phone: string;
  photoURL?: string;
  role: 'driver' | 'rider' | 'both';
  preferredRole?: 'driver' | 'rider'; // User's current active role
  canBeDriver: boolean; // Whether user can switch to driver mode
  canBeRider: boolean; // Whether user can switch to rider mode

  avatar?: string;
  rating: number;
  ratingAsDriver?: number;       // Average rating when user is a driver (from riders)
  ratingAsRider?: number;        // Average rating when user is a rider (from drivers)
  totalRides: number;
  totalReviews?: number;
  totalDriverReviews?: number;   // Count of reviews received as driver
  totalRiderReviews?: number;    // Count of reviews received as rider
  recentRatingCount?: number;
  // Abuse tracking
  noShowCount?: number;          // Times marked as no-show by drivers
  cancellationCount?: number;    // Times cancelled bookings
  joinedDate: string;
  verified: boolean;
  profilePicture?: string;
  carDetails?: Vehicle;
  stripeAccountId?: string; // for drivers
  defaultPaymentMethodId?: string; // for riders
  stripeConnectCompleted?: boolean;
  stripeConnectCompletedAt?: string;
  stripeConnectState?: string;
  stripeConnectStarted?: string;
  stripeChargesEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
  stripeRequirements?: string[];
  walkingDistanceTolerance?: number; // In meters
  fcmToken?: string;
  // Notification preferences
  notificationPreferences?: {
    bookingUpdates: boolean;   // Booking confirmations, cancellations
    rideReminders: boolean;    // Upcoming ride reminders
    messages: boolean;         // Chat messages
    paymentAlerts: boolean;    // Payment success/failure
    promotions: boolean;       // Marketing & promotions
  };
  verification?: {
    status: 'unverified' | 'pending' | 'verified' | 'failed';
    sessionId?: string;
    method?: 'stripe_identity';
    initiatedAt?: string;
    verifiedAt?: string;
  };
  // Driver approval status - controls whether driver can post rides
  driverApproval?: {
    status: 'not_submitted' | 'pending' | 'approved' | 'rejected' | 'expired';
    submittedAt?: string;
    reviewedAt?: string;
    reviewedBy?: string;
    rejectionReason?: string;
    // Document locking - prevents driver from changing docs after submission
    documentsLocked?: boolean;
    lockedAt?: string;
    unlockedBy?: string;          // Admin ID who unlocked for re-upload
    unlockedAt?: string;
    unlockedReason?: string;
    // Expiry date - when document validity expires (e.g., insurance expiry)
    expiryDate?: string;          // ISO date when approval expires
    expiryNotificationSent?: boolean;
    expiryNotificationDate?: string;
  };
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
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface Ride {
  id: string;
  driverId: string;
  driver: User;
  vehicle: Vehicle;
  origin: Location;
  destination: Location;
  departureAt: string; // ISO timestamp
  seatsTotal: number;
  seatsAvailable: number;
  pricePerSeat: number; // in cents
  status: 'upcoming' | 'active' | 'cancelled' | 'completed' | 'completed_partial' | 'expired';
  trackingStatus?: 'waiting' | 'driver_assigned' | 'pickup_confirmed' | 'passengers_onboard' | 'in_transit' | 'arrived' | 'completed';
  passengers: RidePassenger[];
  distance: string;
  duration: string;
  createdAt: string;
  updatedAt: string;
  route?: RoutePoint[];
  incidentImages?: string[];
  note?: string;
  // Tracking timestamps
  driverAssignedAt?: string;
  pickupConfirmedAt?: string;
  passengersOnboardAt?: string;
  inTransitAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  expiredAt?: string;           // When ride was auto-expired
  // Legacy fields for backward compatibility
  from?: Location;
  to?: Location;
  departureTime?: string;
  availableSeats?: number;
  totalSeats?: number;
  // Feature toggles
  availableForDelivery?: boolean;
}

export interface RidePassenger {
  id: string;
  seats: number;
  bookingId: string;
  user: User;
}

export interface Booking {
  id: string;
  rideId: string;
  ride: Ride;
  driverId: string;
  riderId: string;
  passenger: User;
  seats: number;
  amountTotal: number; // in cents
  status: 'pending_driver' | 'confirmed' | 'declined' | 'completed' | 'cancelled_by_rider' | 'cancelled_by_driver' | 'refunded' | 'expired' | 'payment_failed' | 'no_show';
  passengerStatus?: 'waiting' | 'ready' | 'onboard' | 'dropped_off';
  payment: {
    intentId: string;
    latestChargeId?: string;
    status: 'authorized' | 'captured' | 'cancelled' | 'refunded' | 'authorization_failed' | 'capture_failed' | 'permanently_failed';
    // Authorization tracking
    authorizationRetries?: number;
    lastAuthorizationAttempt?: string;
    lastAuthorizationError?: string;
    // Capture tracking
    captureRetries?: number;
    lastCaptureAttempt?: string;
    lastCaptureError?: string;
    failedAt?: string;
  };
  createdAt: string;
  updatedAt?: string;
  incidentImages?: string[];
  disputeReason?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  rejectedBy?: string;
  // Expiry tracking
  expiresAt?: string;           // When pending booking will expire (48h after creation)
  expiredAt?: string;
  expiredReason?: string;
  // Cancellation fees
  cancellationFee?: number;     // Fee charged for cancellation (in cents)
  refundAmount?: number;        // Amount refunded after fee (in cents)
  // No-show tracking
  noShowAt?: string;            // When marked as no-show
  // Passenger tracking timestamps
  passengerReadyAt?: string;
  passengerOnboardAt?: string;
  passengerDroppedOffAt?: string;
  // Review tracking for two-way review system
  driverReviewedRider?: boolean;  // Has driver reviewed this rider?
  riderReviewedDriver?: boolean;  // Has rider reviewed the driver?
  driverReviewId?: string;        // Reference to driver's review of rider
  riderReviewId?: string;         // Reference to rider's review of driver
}

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
  participants: string[];
  // Message status tracking
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  deliveredTo?: string[];  // User IDs who have received the message
  deliveredAt?: string;    // ISO timestamp when first delivered
  readAt?: string;         // ISO timestamp when first read
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

export interface Review {
  id: string;
  rideId: string;
  bookingId?: string;                         // Link to specific booking
  reviewerId: string;
  revieweeId: string;
  rating: number;                             // 1-5 star rating
  comment: string;
  reviewerRole: 'driver' | 'rider';           // Who is writing the review
  revieweeRole: 'driver' | 'rider';           // Who is being reviewed
  createdAt: string;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'booking_request' | 'booking_accepted' | 'booking_rejected' | 'ride_started' | 'ride_completed' | 'message' | 'payment' | 'system';
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  type: 'card' | 'bank_account';
  last4: string;
  brand: string;
  expiryMonth?: number;  // Only for cards
  expiryYear?: number;   // Only for cards
  isDefault: boolean;
}

export interface AdminStats {
  totalUsers: number;
  totalRides: number;
  totalBookings: number;
  totalRevenue: number;
  activeRides: number;
  pendingDisputes: number;
}

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyReport {
  id: string;
  reporterId: string;
  reporter?: User;
  rideId?: string;
  deliveryId?: string;  // For delivery-related safety reports
  ride?: Ride;
  type: 'unsafe_driving' | 'harassment' | 'vehicle_issue' | 'route_deviation' | 'emergency' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: Location;
  evidence?: {
    photos?: string[];
    audio?: string;
    video?: string;
  };
  status: 'pending' | 'investigating' | 'resolved' | 'escalated' | 'closed';
  assignedTo?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Error Handling Types
// ============================================================================

/**
 * Standard error interface with message
 */
export interface ErrorWithMessage {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Type guard to check if error has a message property
 */
export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

/**
 * Get error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

// ============================================================================
// Audit & Logging Types
// ============================================================================

/**
 * Generic audit log data type
 */
export type AuditLogData = Record<string, unknown> | null | undefined;

/**
 * Structured audit log entry
 */
export interface AuditLog {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  data: AuditLogData;
  timestamp: string;
  createdAt: string;
}

// ============================================================================
// Legacy Compatibility Types
// ============================================================================

/**
 * Legacy booking type that used passengerId instead of riderId
 * Used for backwards compatibility with old bookings
 */
export interface LegacyBooking extends Omit<Booking, 'riderId'> {
  passengerId?: string;
  riderId?: string;
}

/**
 * Type guard to check if booking is legacy format
 */
export function isLegacyBooking(booking: Booking | LegacyBooking): booking is LegacyBooking {
  return 'passengerId' in booking && !!booking.passengerId && !booking.riderId;
}

/**
 * Normalize legacy booking to current format
 */
export function normalizeBooking(booking: Booking | LegacyBooking): Booking {
  if (isLegacyBooking(booking)) {
    return {
      ...booking,
      riderId: booking.passengerId!,
    };
  }
  return booking as Booking;
}

/**
 * Get rider ID from booking (handles both legacy and current format)
 */
export function getBookingRiderId(booking: Booking | LegacyBooking): string {
  return booking.riderId || (booking as LegacyBooking).passengerId || '';
}
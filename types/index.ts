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
  acceptDeliveries?: boolean; // Driver toggle to accept deliveries along with rides
  avatar?: string;
  rating: number;
  totalRides: number;
  totalReviews?: number;
  recentRatingCount?: number;
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
  status: 'upcoming' | 'active' | 'cancelled' | 'completed';
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
  // Legacy fields for backward compatibility
  from?: Location;
  to?: Location;
  departureTime?: string;
  availableSeats?: number;
  // Delivery availability toggle
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
  status: 'pending_driver' | 'confirmed' | 'declined' | 'cancelled_by_rider' | 'cancelled_by_driver' | 'refunded';
  passengerStatus?: 'waiting' | 'ready' | 'onboard' | 'dropped_off';
  payment: {
    intentId: string;
    latestChargeId?: string;
    status: 'authorized' | 'captured' | 'cancelled' | 'refunded';
  };
  createdAt: string;
  updatedAt?: string;
  incidentImages?: string[];
  disputeReason?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  rejectedBy?: string;
  // Passenger tracking timestamps
  passengerReadyAt?: string;
  passengerOnboardAt?: string;
  passengerDroppedOffAt?: string;
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
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment: string;
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
  data?: any;
  read: boolean;
  createdAt: string;
}

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

export interface AdminStats {
  totalUsers: number;
  totalRides: number;
  totalBookings: number;
  totalRevenue: number;
  activeRides: number;
  pendingDisputes: number;
}

export interface DeliveryItem {
  itemId: string;
  name: string;
  quantity: number;
  description?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
}

export interface Delivery {
  id: string;
  businessId: string;
  business?: Business;
  driverId?: string;
  driver?: User;
  rideId?: string;
  ride?: Ride;
  items: DeliveryItem[];
  pickupLocation: Location;
  dropoffLocation: Location;
  packageSize: 'small' | 'medium' | 'large' | 'extra_large';
  specialInstructions?: string;
  priceCents: number;
  preferredTimeWindow: {
    start: string;
    end: string;
  };
  status: 'pending' | 'matched' | 'confirmed' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
  estimatedDeliveryTime?: string;
  actualPickupTime?: string;
  actualDeliveryTime?: string;
  confirmedAt?: string;
  inTransitAt?: string;
  deliveryProof?: {
    photoUrl?: string;
    signature?: string;
    recipientName?: string;
  };
  deliveryType?: 'riderPost';
  availabilityId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Business {
  id: string;
  name: string;
  displayName?: string;
  email: string;
  phone: string;
  photoURL?: string;
  address: string;
  businessType: string;
  verified: boolean;
  rating: number;
  totalDeliveries: number;
  createdAt: string;
  updatedAt: string;
}

export interface DriverAvailability {
  id: string;
  driverId: string;
  driver?: User;
  fromLocation: Location;
  toLocation?: Location;
  vehicleType?: 'Bike' | 'Car' | 'Van' | 'Truck' | string;
  capacity?: number;
  priceExpectationCents?: number;
  availabilityWindow?: { start: string; end: string };
  notes?: string;
  active: boolean;
  contactPhone?: string;
  deliveryType: 'driverAvailability';
  createdAt: string;
  updatedAt: string;
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
  ride?: Ride;
  deliveryId?: string;
  delivery?: Delivery;
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
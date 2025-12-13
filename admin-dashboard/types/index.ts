// Admin role types - Microsoft 365 style
export type AdminRole = 'global_admin' | 'editor_admin' | 'viewer_admin';

// AdminUser for session/auth usage
export interface AdminUser {
    id: string;
    email: string;
    name: string;
    role: AdminRole;
}

export interface Admin {
    id: string;
    email: string;
    name: string;
    role: AdminRole;
    active: boolean;
    createdAt: string;
    lastLogin?: string;
    createdBy?: string; // ID of admin who created this admin
}

// Role permission helpers
export const ROLE_PERMISSIONS = {
    global_admin: {
        canManageAdmins: true,
        canEditData: true,
        canViewData: true,
        label: 'Global Admin',
        description: 'Full access to everything, can manage other admins',
    },
    editor_admin: {
        canManageAdmins: false,
        canEditData: true,
        canViewData: true,
        label: 'Editor Admin',
        description: 'Can view and modify data, cannot manage admins',
    },
    viewer_admin: {
        canManageAdmins: false,
        canEditData: false,
        canViewData: true,
        label: 'Viewer Admin',
        description: 'Read-only access to all data',
    },
} as const;

export interface SafetyReport {
    id: string;
    reporterId: string;
    type: 'unsafe_driving' | 'harassment' | 'vehicle_issue' | 'route_deviation' | 'emergency' | 'other';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    status: 'pending' | 'investigating' | 'resolved' | 'escalated' | 'closed';
    rideId?: string;
    deliveryId?: string;
    evidence?: {
        photos?: string[];
    };
    createdAt: string;
    updatedAt: string;
}

export interface User {
    id: string;
    email: string;
    name: string;
    phone?: string;
    role: 'rider' | 'driver' | 'both';
    rating: number;
    totalRides: number;
    createdAt: string;
    suspended?: boolean;
    stripeAccountId?: string;
}

export interface Ride {
    id: string;
    driverId: string;
    origin: string;
    destination: string;
    departureTime: string;
    seatsTotal: number;
    seatsAvailable: number;
    pricePerSeat: number;
    status: 'upcoming' | 'active' | 'completed' | 'cancelled';
    createdAt: string;
}

export interface Booking {
    id: string;
    rideId: string;
    riderId: string;
    driverId: string;
    status: 'pending_driver' | 'confirmed' | 'cancelled_by_rider' | 'cancelled_by_driver' | 'completed';
    seatsRequested: number;
    amountTotal: number;
    paymentStatus: 'unpaid' | 'paid' | 'refunded';
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
}

export interface AdminNote {
    id: string;
    reportId: string;
    adminId: string;
    adminName: string;
    note: string;
    createdAt: string;
}

export interface DashboardStats {
    totalUsers: number;
    totalRides: number;
    activeRides: number;
    pendingSafetyReports: number;
    totalRevenue: number;
    userGrowth: number;
}

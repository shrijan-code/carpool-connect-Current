/**
 * Trip Sharing Service
 * Generates shareable links for live trip tracking
 */

import { db } from '@/config/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import * as Location from 'expo-location';

const SHARE_BASE_URL = 'https://carpoolconnect.app/track';
const SHARE_TOKENS_COLLECTION = 'trip_share_tokens';

export interface TripShareToken {
    id: string;
    rideId: string;
    riderId: string;
    createdAt: unknown;
    expiresAt: unknown;
    isActive: boolean;
    lastLocation?: {
        latitude: number;
        longitude: number;
        updatedAt: unknown;
    };
}

export interface TripShareData {
    rideId: string;
    riderName: string;
    driverName: string;
    origin: string;
    destination: string;
    departureTime: string;
    status: string;
    currentLocation?: {
        latitude: number;
        longitude: number;
    };
}

function generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 12; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

export const TripSharingService = {
    /**
     * Generate a shareable trip link
     */
    async createShareLink(
        rideId: string,
        riderId: string,
        expirationHours: number = 24
    ): Promise<{ token: string; shareUrl: string }> {
        const token = generateToken();
        const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

        const tokenData: Omit<TripShareToken, 'id'> = {
            rideId,
            riderId,
            createdAt: serverTimestamp(),
            expiresAt: expiresAt.toISOString(),
            isActive: true,
        };

        await setDoc(doc(db, SHARE_TOKENS_COLLECTION, token), tokenData);

        return {
            token,
            shareUrl: `${SHARE_BASE_URL}/${token}`,
        };
    },

    /**
     * Update location for a shared trip
     */
    async updateLocation(token: string): Promise<void> {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            const location = await Location.getCurrentPositionAsync({});

            await setDoc(
                doc(db, SHARE_TOKENS_COLLECTION, token),
                {
                    lastLocation: {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        updatedAt: serverTimestamp(),
                    },
                },
                { merge: true }
            );
        } catch (error) {
            console.error('Failed to update trip location:', error);
        }
    },

    /**
     * Deactivate a share token
     */
    async deactivateToken(token: string): Promise<void> {
        await setDoc(
            doc(db, SHARE_TOKENS_COLLECTION, token),
            { isActive: false },
            { merge: true }
        );
    },

    /**
     * Get trip share data by token (for viewing shared trip)
     */
    async getTripShareData(token: string): Promise<TripShareToken | null> {
        const tokenDoc = await getDoc(doc(db, SHARE_TOKENS_COLLECTION, token));

        if (!tokenDoc.exists()) return null;

        const data = tokenDoc.data();

        // Check if expired
        const expiresAt = new Date(data.expiresAt);
        if (expiresAt < new Date() || !data.isActive) {
            return null;
        }

        return {
            id: token,
            ...data,
        } as TripShareToken;
    },

    /**
     * Generate SMS message with trip link
     */
    generateShareMessage(shareUrl: string, riderName: string, destination: string): string {
        return `${riderName} is sharing their CarpoolConnect trip to ${destination} with you.\n\nTrack live: ${shareUrl}\n\nThis link expires in 24 hours.`;
    },

    /**
     * Generate Google Maps link from coordinates
     */
    getLocationMapUrl(lat: number, lng: number): string {
        return `https://maps.google.com/maps?q=${lat},${lng}`;
    },
};

export default TripSharingService;

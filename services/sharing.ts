/**
 * Sharing Service
 * Handles generating and sharing ride deep links
 */

import { Share, Platform, Linking } from 'react-native';
import { Ride } from '@/types';
import { logger } from '@/utils/logger';

// App-specific URL schemes
const APP_SCHEME = 'carpoolconnect';
const WEB_URL = 'https://carpoolconnect.app';

/**
 * Generate a shareable deep link for a ride
 */
export function generateRideLink(rideId: string): string {
    // Use web URL that can redirect to app or show web preview
    return `${WEB_URL}/ride/${rideId}`;
}

/**
 * Generate an app-native deep link (for internal navigation)
 */
export function generateAppRideLink(rideId: string): string {
    return `${APP_SCHEME}://ride/${rideId}`;
}

/**
 * Format ride details for sharing
 */
function formatRideForSharing(ride: Ride): string {
    const origin = ride.origin?.name || ride.from?.name || 'Unknown';
    const destination = ride.destination?.name || ride.to?.name || 'Unknown';
    const departureDate = new Date(ride.departureAt || ride.departureTime || '');

    const formattedDate = departureDate.toLocaleDateString('en-AU', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });

    const formattedTime = departureDate.toLocaleTimeString('en-AU', {
        hour: 'numeric',
        minute: '2-digit',
    });

    const price = ride.pricePerSeat ? `$${(ride.pricePerSeat / 100).toFixed(2)}` : 'Free';
    const seats = ride.seatsAvailable ?? ride.availableSeats ?? 0;

    return `🚗 Carpool Ride Available!\n\n📍 ${origin} → ${destination}\n📅 ${formattedDate} at ${formattedTime}\n💺 ${seats} seat${seats !== 1 ? 's' : ''} available\n💰 ${price}/seat`;
}

/**
 * Share a ride with other apps
 */
export async function shareRide(ride: Ride): Promise<boolean> {
    try {
        const link = generateRideLink(ride.id);
        const message = formatRideForSharing(ride);
        const fullMessage = `${message}\n\nBook now: ${link}`;

        const result = await Share.share({
            message: fullMessage,
            url: Platform.OS === 'ios' ? link : undefined,
            title: 'Share Ride',
        });

        if (result.action === Share.sharedAction) {
            logger.info('Ride shared successfully', { rideId: ride.id });
            return true;
        }

        return false;
    } catch (error) {
        logger.error('Error sharing ride', error);
        return false;
    }
}

/**
 * Share ride by ID only (for when full ride object isn't available)
 */
export async function shareRideById(
    rideId: string,
    origin: string,
    destination: string
): Promise<boolean> {
    try {
        const link = generateRideLink(rideId);
        const message = `🚗 Check out this carpool ride!\n\n📍 ${origin} → ${destination}\n\nBook now: ${link}`;

        const result = await Share.share({
            message,
            url: Platform.OS === 'ios' ? link : undefined,
            title: 'Share Ride',
        });

        return result.action === Share.sharedAction;
    } catch (error) {
        logger.error('Error sharing ride', error);
        return false;
    }
}

/**
 * Open a ride deep link
 */
export async function openRideLink(rideId: string): Promise<boolean> {
    const appLink = generateAppRideLink(rideId);

    try {
        const canOpen = await Linking.canOpenURL(appLink);
        if (canOpen) {
            await Linking.openURL(appLink);
            return true;
        }

        // Fallback to web URL
        const webLink = generateRideLink(rideId);
        await Linking.openURL(webLink);
        return true;
    } catch (error) {
        logger.error('Error opening ride link', error);
        return false;
    }
}

/**
 * Parse a ride ID from a deep link URL
 */
export function parseRideIdFromUrl(url: string): string | null {
    try {
        // Handle app scheme: carpoolconnect://ride/abc123
        if (url.startsWith(`${APP_SCHEME}://ride/`)) {
            return url.replace(`${APP_SCHEME}://ride/`, '');
        }

        // Handle web URL: https://carpoolconnect.app/ride/abc123
        if (url.includes('/ride/')) {
            const parts = url.split('/ride/');
            return parts[1]?.split('?')[0] || null;
        }

        return null;
    } catch {
        return null;
    }
}

export const SharingService = {
    generateRideLink,
    generateAppRideLink,
    shareRide,
    shareRideById,
    openRideLink,
    parseRideIdFromUrl,
};

/**
 * Shared utility functions for Firebase Cloud Functions
 * Contains reusable logic extracted from handlers
 */

import * as admin from "firebase-admin";
import { logger } from "./logger";

// Lazy initialization to avoid errors before admin.initializeApp() in index.ts
const getDb = () => admin.firestore();

export interface SeatFixResult {
    rideId: string;
    before: number;
    after: number;
    totalSeats: number;
    seatsUsed: number;
}

export interface SeatFixSummary {
    fixedCount: number;
    totalRides: number;
    details: SeatFixResult[];
}

/**
 * Recalculate seat availability for all rides
 * Shared logic between fixSeatAvailability and fixSeatAvailabilityHttp
 * 
 * @returns Summary of fixed rides
 */
export async function recalculateSeatAvailability(): Promise<SeatFixSummary> {
    logger.info("Starting seat availability recalculation");

    const ridesSnapshot = await getDb().collection("rides").get();
    logger.info(`Found ${ridesSnapshot.size} rides to check`);

    let fixedCount = 0;
    const results: SeatFixResult[] = [];

    for (const rideDoc of ridesSnapshot.docs) {
        const rideData = rideDoc.data();
        const rideId = rideDoc.id;

        // Get total seats - use seatsOffered as primary source if available
        const totalSeats = rideData.seatsOffered || rideData.totalSeats || rideData.seatsTotal || 4;

        // Count seats used by active bookings
        const bookingsSnapshot = await getDb().collection("bookings")
            .where("rideId", "==", rideId)
            .get();

        let seatsUsed = 0;
        bookingsSnapshot.forEach((bookingDoc) => {
            const booking = bookingDoc.data();
            // Count seats for confirmed and pending_driver bookings
            if (booking.status === "confirmed" || booking.status === "pending_driver") {
                seatsUsed += booking.seats || 1;
            }
        });

        // Calculate correct available seats (never negative)
        const correctAvailable = Math.max(0, totalSeats - seatsUsed);
        const currentAvailable = rideData.availableSeats ?? rideData.seatsAvailable ?? 0;

        // Check if needs fixing (negative or incorrect)
        if (currentAvailable !== correctAvailable || currentAvailable < 0) {
            await getDb().collection("rides").doc(rideId).update({
                availableSeats: correctAvailable,
                seatsAvailable: correctAvailable,
                totalSeats: totalSeats,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            fixedCount++;
            results.push({
                rideId,
                before: currentAvailable,
                after: correctAvailable,
                totalSeats,
                seatsUsed,
            });

            logger.ride.seatFixed(rideId, currentAvailable, correctAvailable);
        }
    }

    logger.info(`Seat availability fix complete`, { fixedCount, totalRides: ridesSnapshot.size });

    return {
        fixedCount,
        totalRides: ridesSnapshot.size,
        details: results,
    };
}

/**
 * Get the appropriate label for a safety report type
 */
export function getSafetyReportTypeLabel(type: string): string {
    const labels: Record<string, string> = {
        unsafe_driving: "Unsafe Driving",
        harassment: "Harassment",
        vehicle_issue: "Vehicle Safety Issue",
        route_deviation: "Route Deviation",
        emergency: "Emergency Situation",
        other: "Other Safety Concern",
    };
    return labels[type] || type;
}

/**
 * Get the appropriate label for a booking status
 */
export function getBookingStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        pending_driver: "Awaiting Driver Response",
        pending_payment: "Awaiting Payment",
        confirmed: "Confirmed",
        completed: "Completed",
        cancelled: "Cancelled",
        declined: "Declined by Driver",
    };
    return labels[status] || status;
}

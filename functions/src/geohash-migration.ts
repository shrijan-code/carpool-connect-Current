/**
 * Geohash Backfill and Migration Functions
 * One-time functions to add geohash fields to existing rides
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import ngeohash from "ngeohash";

// Lazy initialization to avoid errors before admin.initializeApp()
const getDb = () => admin.firestore();

// Geohash precision levels
const DEFAULT_PRECISION = 5;  // ~5km
const CITY_PRECISION = 4;     // ~20km

/**
 * Encode latitude/longitude to geohash
 */
function encodeGeohash(lat: number, lon: number, precision: number): string {
    return ngeohash.encode(lat, lon, precision);
}

/**
 * Create geohash fields for a ride
 */
function createRideGeohashes(
    originLat: number,
    originLon: number,
    destLat: number,
    destLon: number
) {
    return {
        originGeohash: encodeGeohash(originLat, originLon, DEFAULT_PRECISION),
        originGeohash4: encodeGeohash(originLat, originLon, CITY_PRECISION),
        destinationGeohash: encodeGeohash(destLat, destLon, DEFAULT_PRECISION),
        destinationGeohash4: encodeGeohash(destLat, destLon, CITY_PRECISION),
    };
}

/**
 * Backfill geohash fields for all existing rides
 * This is a one-time migration function
 * Call via: firebase functions:shell -> backfillRideGeohashes()
 */
export const backfillRideGeohashes = onCall(async (request) => {
    // Only allow admin users
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be logged in");
    }

    console.log("🔄 Starting geohash backfill for rides...");

    try {
        const ridesSnapshot = await getDb().collection("rides").get();
        let updated = 0;
        let skipped = 0;
        let errors = 0;

        const batch = getDb().batch();
        let batchCount = 0;
        const MAX_BATCH = 500;

        for (const rideDoc of ridesSnapshot.docs) {
            const data = rideDoc.data();

            // Skip if already has geohash
            if (data.originGeohash && data.originGeohash4) {
                skipped++;
                continue;
            }

            // Get origin and destination
            const origin = data.from || data.origin;
            const destination = data.to || data.destination;

            if (!origin?.latitude || !origin?.longitude ||
                !destination?.latitude || !destination?.longitude) {
                console.warn(`⚠️ Ride ${rideDoc.id} has invalid location data`);
                errors++;
                continue;
            }

            // Create geohash fields
            const geohashes = createRideGeohashes(
                origin.latitude,
                origin.longitude,
                destination.latitude,
                destination.longitude
            );

            batch.update(rideDoc.ref, {
                ...geohashes,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            updated++;
            batchCount++;

            // Commit batch every 500 documents
            if (batchCount >= MAX_BATCH) {
                await batch.commit();
                console.log(`✅ Committed batch of ${batchCount} rides`);
                batchCount = 0;
            }
        }

        // Commit remaining
        if (batchCount > 0) {
            await batch.commit();
            console.log(`✅ Committed final batch of ${batchCount} rides`);
        }

        console.log(`🎉 Backfill complete: ${updated} updated, ${skipped} skipped, ${errors} errors`);

        return {
            success: true,
            updated,
            skipped,
            errors,
            total: ridesSnapshot.size,
        };
    } catch (error) {
        console.error("❌ Backfill error:", error);
        throw new HttpsError("internal", "Backfill failed");
    }
});

/**
 * HTTP endpoint for backfill - easier to call from browser
 * URL: https://us-central1-carpoolconnect1-0.cloudfunctions.net/backfillRideGeohashesHttp
 * 
 * Add ?key=carpoolconnect-backfill-2024 to authorize
 */
export const backfillRideGeohashesHttp = onRequest(async (req, res) => {
    // Simple authorization key
    const authKey = req.query.key;
    if (authKey !== "carpoolconnect-backfill-2024") {
        res.status(403).json({ error: "Unauthorized. Add ?key=carpoolconnect-backfill-2024" });
        return;
    }

    console.log("🔄 Starting geohash backfill for rides (HTTP)...");

    try {
        const ridesSnapshot = await getDb().collection("rides").get();
        let updated = 0;
        let skipped = 0;
        let errors = 0;

        const batch = getDb().batch();
        let batchCount = 0;
        const MAX_BATCH = 500;

        for (const rideDoc of ridesSnapshot.docs) {
            const data = rideDoc.data();

            // Skip if already has geohash
            if (data.originGeohash && data.originGeohash4) {
                skipped++;
                continue;
            }

            // Get origin and destination
            const origin = data.from || data.origin;
            const destination = data.to || data.destination;

            if (!origin?.latitude || !origin?.longitude ||
                !destination?.latitude || !destination?.longitude) {
                console.warn(`⚠️ Ride ${rideDoc.id} has invalid location data`);
                errors++;
                continue;
            }

            // Create geohash fields
            const geohashes = createRideGeohashes(
                origin.latitude,
                origin.longitude,
                destination.latitude,
                destination.longitude
            );

            batch.update(rideDoc.ref, {
                ...geohashes,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });

            updated++;
            batchCount++;

            // Commit batch every 500 documents
            if (batchCount >= MAX_BATCH) {
                await batch.commit();
                console.log(`✅ Committed batch of ${batchCount} rides`);
                batchCount = 0;
            }
        }

        // Commit remaining
        if (batchCount > 0) {
            await batch.commit();
            console.log(`✅ Committed final batch of ${batchCount} rides`);
        }

        console.log(`🎉 Backfill complete: ${updated} updated, ${skipped} skipped, ${errors} errors`);

        res.json({
            success: true,
            message: "Backfill complete!",
            updated,
            skipped,
            errors,
            total: ridesSnapshot.size,
        });
    } catch (error) {
        console.error("❌ Backfill error:", error);
        res.status(500).json({ error: "Backfill failed", details: String(error) });
    }
});

/**
 * Scheduled job to ensure new rides have geohash (backup)
 * Runs daily to catch any rides that might have been created without geohash
 */
export const ensureRideGeohashes = onSchedule("every 24 hours", async () => {
    console.log("🔍 Checking for rides without geohash...");

    try {
        // Find rides without originGeohash
        const ridesSnapshot = await getDb().collection("rides")
            .where("originGeohash", "==", null)
            .limit(100)
            .get();

        if (ridesSnapshot.empty) {
            console.log("✅ All rides have geohash fields");
            return;
        }

        let updated = 0;
        const batch = getDb().batch();

        for (const rideDoc of ridesSnapshot.docs) {
            const data = rideDoc.data();
            const origin = data.from || data.origin;
            const destination = data.to || data.destination;

            if (origin?.latitude && origin?.longitude &&
                destination?.latitude && destination?.longitude) {
                const geohashes = createRideGeohashes(
                    origin.latitude,
                    origin.longitude,
                    destination.latitude,
                    destination.longitude
                );

                batch.update(rideDoc.ref, {
                    ...geohashes,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                updated++;
            }
        }

        if (updated > 0) {
            await batch.commit();
            console.log(`✅ Updated ${updated} rides with geohash`);
        }
    } catch (error) {
        console.error("❌ Error ensuring geohashes:", error);
    }
});

/**
 * HTTP endpoint to backfill review tracking fields on completed bookings
 * This enables pending reviews to be found for existing rides
 * URL: https://us-central1-carpoolconnect1-0.cloudfunctions.net/backfillBookingReviewFields?key=carpoolconnect-backfill-2024
 */
export const backfillBookingReviewFields = onRequest(async (req, res) => {
    // Simple key-based auth for this one-time migration
    const authKey = req.query.key;
    if (authKey !== "carpoolconnect-backfill-2024") {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    console.log("📝 Starting booking review fields backfill...");

    try {
        // Find completed bookings without review tracking fields
        const bookingsSnapshot = await getDb().collection("bookings")
            .where("status", "==", "completed")
            .get();

        let updated = 0;
        let skipped = 0;
        let errors = 0;
        let batch = getDb().batch();
        let batchCount = 0;
        const BATCH_SIZE = 500;

        for (const bookingDoc of bookingsSnapshot.docs) {
            const data = bookingDoc.data();

            // Skip if already has review tracking fields
            if (data.riderReviewedDriver !== undefined && data.driverReviewedRider !== undefined) {
                skipped++;
                continue;
            }

            try {
                batch.update(bookingDoc.ref, {
                    riderReviewedDriver: data.riderReviewedDriver ?? false,
                    driverReviewedRider: data.driverReviewedRider ?? false,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });

                batchCount++;
                updated++;

                // Commit batch when full
                if (batchCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`✅ Committed batch of ${batchCount} bookings`);
                    batch = getDb().batch();
                    batchCount = 0;
                }
            } catch (err) {
                console.error(`❌ Error updating booking ${bookingDoc.id}:`, err);
                errors++;
            }
        }

        // Commit remaining
        if (batchCount > 0) {
            await batch.commit();
            console.log(`✅ Committed final batch of ${batchCount} bookings`);
        }

        console.log(`🎉 Backfill complete: ${updated} updated, ${skipped} skipped, ${errors} errors`);

        res.json({
            success: true,
            message: "Booking review fields backfill complete!",
            updated,
            skipped,
            errors,
            total: bookingsSnapshot.size,
        });
    } catch (error) {
        console.error("❌ Backfill error:", error);
        res.status(500).json({ error: "Backfill failed", details: String(error) });
    }
});

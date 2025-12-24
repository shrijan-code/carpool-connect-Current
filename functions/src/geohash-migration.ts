/**
 * Geohash Backfill and Migration Functions
 * One-time functions to add geohash fields to existing rides
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import ngeohash from "ngeohash";

const db = admin.firestore();

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
        const ridesSnapshot = await db.collection("rides").get();
        let updated = 0;
        let skipped = 0;
        let errors = 0;

        const batch = db.batch();
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
 * Scheduled job to ensure new rides have geohash (backup)
 * Runs daily to catch any rides that might have been created without geohash
 */
export const ensureRideGeohashes = onSchedule("every 24 hours", async () => {
    console.log("🔍 Checking for rides without geohash...");

    try {
        // Find rides without originGeohash
        const ridesSnapshot = await db.collection("rides")
            .where("originGeohash", "==", null)
            .limit(100)
            .get();

        if (ridesSnapshot.empty) {
            console.log("✅ All rides have geohash fields");
            return;
        }

        let updated = 0;
        const batch = db.batch();

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

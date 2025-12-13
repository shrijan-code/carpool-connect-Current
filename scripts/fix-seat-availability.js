// Fix Seat Availability Script
// Run with: node scripts/fix-seat-availability.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, query, where } = require('firebase/firestore');
require('dotenv').config();

// Initialize Firebase
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixSeatAvailability() {
    console.log('🔧 Starting seat availability fix...\n');

    try {
        // Get all upcoming rides
        const ridesQuery = query(
            collection(db, 'rides'),
            where('status', '==', 'upcoming')
        );
        const ridesSnapshot = await getDocs(ridesQuery);

        console.log(`Found ${ridesSnapshot.size} upcoming rides\n`);

        let fixedCount = 0;

        for (const rideDoc of ridesSnapshot.docs) {
            const rideData = rideDoc.data();
            const rideId = rideDoc.id;
            const totalSeats = rideData.totalSeats || rideData.seatsAvailable || rideData.availableSeats || 4;

            console.log(`\n📍 Ride ${rideId}`);
            console.log(`   From: ${rideData.from?.name || 'Unknown'} → To: ${rideData.to?.name || 'Unknown'}`);
            console.log(`   Total Seats: ${totalSeats}`);
            console.log(`   Current Available: ${rideData.availableSeats || rideData.seatsAvailable || 0}`);

            // Get all confirmed bookings for this ride
            const bookingsQuery = query(
                collection(db, 'bookings'),
                where('rideId', '==', rideId),
                where('status', '==', 'confirmed')
            );
            const bookingsSnapshot = await getDocs(bookingsQuery);

            // Calculate seats used by confirmed bookings
            let seatsUsed = 0;
            bookingsSnapshot.forEach(bookingDoc => {
                const booking = bookingDoc.data();
                seatsUsed += booking.seats || 0;
                console.log(`   - Confirmed booking: ${booking.seats} seats (ID: ${bookingDoc.id})`);
            });

            // Calculate correct available seats
            const correctAvailableSeats = Math.max(0, totalSeats - seatsUsed);

            console.log(`   Seats Used (confirmed): ${seatsUsed}`);
            console.log(`   Correct Available: ${correctAvailableSeats}`);

            // Update ride if needed
            const currentAvailable = rideData.availableSeats || rideData.seatsAvailable || 0;
            if (currentAvailable !== correctAvailableSeats) {
                console.log(`   ✏️  Updating: ${currentAvailable} → ${correctAvailableSeats}`);

                await updateDoc(doc(db, 'rides', rideId), {
                    availableSeats: correctAvailableSeats,
                    seatsAvailable: correctAvailableSeats, // Update both for compatibility
                });

                console.log(`   ✅ Fixed!`);
                fixedCount++;
            } else {
                console.log(`   ⏭️  Already correct`);
            }
        }

        console.log(`\n\n✨ Completed! Fixed ${fixedCount} rides.`);
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

// Run the script
fixSeatAvailability();

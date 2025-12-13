import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

// Initialize Firebase (use your config)
const firebaseConfig = {
    // Add your Firebase config here or import from config file
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface Booking {
    id: string;
    rideId: string;
    seats: number;
    status: string;
}

interface Ride {
    id: string;
    totalSeats: number;
    seatsAvailable?: number;
    availableSeats?: number;
}

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

        for (const rideDoc of ridesSnapshot.docs) {
            const rideData = rideDoc.data() as Ride;
            const rideId = rideDoc.id;
            const totalSeats = rideData.totalSeats || rideData.seatsAvailable || rideData.availableSeats || 4;

            console.log(`\n📍 Processing Ride ${rideId}`);
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
                const booking = bookingDoc.data() as Booking;
                seatsUsed += booking.seats || 0;
                console.log(`   - Confirmed booking: ${booking.seats} seats`);
            });

            // Calculate correct available seats
            const correctAvailableSeats = Math.max(0, totalSeats - seatsUsed);

            console.log(`   Seats Used (confirmed): ${seatsUsed}`);
            console.log(`   Correct Available: ${correctAvailableSeats}`);

            // Update ride if needed
            if ((rideData.availableSeats !== correctAvailableSeats) ||
                (rideData.seatsAvailable !== correctAvailableSeats)) {
                console.log(`   ✏️  Updating ride...`);

                await updateDoc(doc(db, 'rides', rideId), {
                    availableSeats: correctAvailableSeats,
                    seatsAvailable: correctAvailableSeats, // Update both for compatibility
                });

                console.log(`   ✅ Updated! ${rideData.availableSeats || 0} → ${correctAvailableSeats}`);
            } else {
                console.log(`   ⏭️  No update needed`);
            }
        }

        console.log('\n\n✨ Seat availability fix completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error fixing seat availability:', error);
        process.exit(1);
    }
}

// Run the script
fixSeatAvailability();

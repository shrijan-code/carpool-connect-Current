// Fix Seat Availability - All Rides
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
require('dotenv').config();

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

console.log('Firebase Config:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain
});

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixSeats() {
    console.log('\n🔧 Getting ALL rides...\n');

    try {
        const ridesCol = collection(db, 'rides');
        const snapshot = await getDocs(ridesCol);

        console.log(`Total rides in database: ${snapshot.size}\n`);

        if (snapshot.empty) {
            console.log('❌ No rides found! Check your Firebase configuration.');
            process.exit(1);
        }

        let fixed = 0;

        for (const rideDoc of snapshot.docs) {
            const ride = rideDoc.data();
            const rideId = rideDoc.id;

            console.log(`\n📍 ${rideId}`);
            console.log(`   Status: ${ride.status}`);
            console.log(`   From: ${ride.from?.name} → To: ${ride.to?.name}`);

            const total = ride.totalSeats || ride.seatsAvailable || ride.availableSeats || 4;
            const current = ride.availableSeats || ride.seatsAvailable || 0;

            console.log(`   Total: ${total}, Current Available: ${current}`);

            // Get bookings
            const bookingsCol = collection(db, 'bookings');
            const bookingsSnap = await getDocs(bookingsCol);

            let seatsUsed = 0;
            bookingsSnap.forEach(bookingDoc => {
                const booking = bookingDoc.data();
                if (booking.rideId === rideId && booking.status === 'confirmed') {
                    seatsUsed += booking.seats || 0;
                }
            });

            const correct = Math.max(0, total - seatsUsed);
            console.log(`   Confirmed bookings: ${seatsUsed} seats`);
            console.log(`   Should be: ${correct} available`);

            if (current !== correct) {
                await updateDoc(doc(db, 'rides', rideId), {
                    availableSeats: correct,
                    seatsAvailable: correct,
                });
                console.log(`   ✅ FIXED: ${current} → ${correct}`);
                fixed++;
            }
        }

        console.log(`\n\n✨ Done! Fixed ${fixed}/${snapshot.size} rides.`);
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

fixSeats();

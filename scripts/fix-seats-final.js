// Fix Seat Availability - Direct Firebase Connection
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyCxwV_Va0voJxTdc8aAcqqphKIQp3FnAIo",
    authDomain: "carpoolconnect1-0.firebaseapp.com",
    projectId: "carpoolconnect1-0",
    storageBucket: "carpoolconnect1-0.appspot.com",
    messagingSenderId: "889604849863",
    appId: "1:889604849863:web:8734c34781342a92197ee2",
};

console.log(`\n🔗 Connecting to Firebase project: ${firebaseConfig.projectId}\n`);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixSeats() {
    try {
        console.log('📥 Loading rides...');
        const ridesSnapshot = await getDocs(collection(db, 'rides'));
        console.log(`✅ Found ${ridesSnapshot.size} total rides\n`);

        if (ridesSnapshot.empty) {
            console.log('⚠️  No rides found in database!');
            process.exit(0);
        }

        console.log('📥 Loading bookings...');
        const bookingsSnapshot = await getDocs(collection(db, 'bookings'));
        console.log(`✅ Found ${bookingsSnapshot.size} total bookings\n`);

        // Build a map of confirmed bookings per ride
        const rideBookings = {};
        bookingsSnapshot.forEach(bookingDoc => {
            const booking = bookingDoc.data();
            if (booking.status === 'confirmed') {
                if (!rideBookings[booking.rideId]) {
                    rideBookings[booking.rideId] = 0;
                }
                rideBookings[booking.rideId] += booking.seats || 0;
            }
        });

        let fixed = 0;
        let alreadyCorrect = 0;

        for (const rideDoc of ridesSnapshot.docs) {
            const ride = rideDoc.data();
            const rideId = rideDoc.id;

            const totalSeats = ride.totalSeats || ride.seatsAvailable || ride.availableSeats || 4;
            const seatsUsed = rideBookings[rideId] || 0;
            const correctAvailable = Math.max(0, totalSeats - seatsUsed);
            const currentAvailable = ride.availableSeats || ride.seatsAvailable || 0;

            console.log(`\n📍 Ride ${rideId.substring(0, 8)}...`);
            console.log(`   ${ride.from?.name || '?'} → ${ride.to?.name || '?'}`);
            console.log(`   Status: ${ride.status}`);
            console.log(`   Total: ${totalSeats} | Used: ${seatsUsed} | Current: ${currentAvailable} | Should be: ${correctAvailable}`);

            if (currentAvailable !== correctAvailable) {
                await updateDoc(doc(db, 'rides', rideId), {
                    availableSeats: correctAvailable,
                    seatsAvailable: correctAvailable,
                });
                console.log(`   ✅ FIXED: ${currentAvailable} → ${correctAvailable}`);
                fixed++;
            } else {
                console.log(`   ✓ Already correct`);
                alreadyCorrect++;
            }
        }

        console.log(`\n\n${'='.repeat(50)}`);
        console.log(`✨ DONE!`);
        console.log(`   Fixed: ${fixed} rides`);
        console.log(`   Already correct: ${alreadyCorrect} rides`);
        console.log(`   Total: ${ridesSnapshot.size} rides`);
        console.log(`${'='.repeat(50)}\n`);

        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

fixSeats();

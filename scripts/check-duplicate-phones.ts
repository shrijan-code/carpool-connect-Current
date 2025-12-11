/**
 * Script to check for duplicate phone numbers in Firestore users collection
 * This helps identify if the same phone is being used by multiple users
 * 
 * Run with: npx ts-node scripts/check-duplicate-phones.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../service-account-key.json'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDuplicatePhones() {
    console.log('🔍 Checking for duplicate phone numbers in users collection...\n');

    try {
        const usersSnapshot = await db.collection('users').get();

        const phoneMap = new Map<string, Array<{ id: string, name: string, email: string }>>();
        const usersWithoutPhone: Array<{ id: string, name: string }> = [];

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            const phone = data.phone;

            if (phone) {
                const normalized = phone.trim();
                if (!phoneMap.has(normalized)) {
                    phoneMap.set(normalized, []);
                }
                phoneMap.get(normalized)!.push({
                    id: doc.id,
                    name: data.name || 'No name',
                    email: data.email || 'No email'
                });
            } else {
                usersWithoutPhone.push({
                    id: doc.id,
                    name: data.name || 'No name'
                });
            }
        });

        console.log('📊 Phone Number Analysis:');
        console.log(`Total users: ${usersSnapshot.size}`);
        console.log(`Users with phone: ${usersSnapshot.size - usersWithoutPhone.length}`);
        console.log(`Users without phone: ${usersWithoutPhone.length}\n`);

        // Check for duplicates
        let duplicatesFound = false;
        phoneMap.forEach((users, phone) => {
            if (users.length > 1) {
                duplicatesFound = true;
                console.log(`⚠️  DUPLICATE: ${phone}`);
                console.log(`   Used by ${users.length} users:`);
                users.forEach(user => {
                    console.log(`   - ${user.id} (${user.name}, ${user.email})`);
                });
                console.log('');
            }
        });

        // List users without phone
        if (usersWithoutPhone.length > 0) {
            console.log('\n⚠️  Users without phone numbers:');
            usersWithoutPhone.forEach(user => {
                console.log(`   - ${user.id} (${user.name})`);
            });
            console.log('');
        }

        // Summary
        if (!duplicatesFound && usersWithoutPhone.length === 0) {
            console.log('✅ SUCCESS: All users have unique phone numbers!');
        } else {
            console.log('❌ ISSUES FOUND:');
            if (duplicatesFound) {
                console.log('   - Duplicate phone numbers detected');
                console.log('   - ACTION: Update users to have unique phone numbers');
            }
            if (usersWithoutPhone.length > 0) {
                console.log('   - Users without phone numbers detected');
                console.log('   - ACTION: Add phone numbers to these users');
            }
        }

        console.log('\n📝 Recommendation:');
        console.log('   1. Each user MUST have a unique phone number');
        console.log('   2. Update duplicate phone numbers in Firebase Console');
        console.log('   3. After fixing, clear all Stripe test accounts (reject them)');
        console.log('   4. Test with fresh user account to verify fix');

    } catch (error) {
        console.error('❌ Error checking phone numbers:', error);
    }

    process.exit(0);
}

checkDuplicatePhones();

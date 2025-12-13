// Script to create initial admin user in Firestore
// Run with: node scripts/create-admin.js

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin with environment variables
const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID || 'carpoolconnect1-0',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@carpoolconnect1-0.iam.gserviceaccount.com',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

async function createAdmin() {
    const adminEmail = 'shrijan.bhandari1318@gmail.com';

    // Check if admin already exists
    const existing = await db.collection('admins')
        .where('email', '==', adminEmail)
        .get();

    if (!existing.empty) {
        // Update the name and migrate role if needed
        const doc = existing.docs[0];
        const data = doc.data();
        const updates = { name: 'Shrijan Bhandari' };

        // Migrate old roles to new roles
        if (data.role === 'super_admin') {
            updates.role = 'global_admin';
        } else if (data.role === 'support_admin') {
            updates.role = 'editor_admin';
        }

        await doc.ref.update(updates);
        console.log('Admin updated with role:', updates.role || data.role);
        console.log('Email:', adminEmail);
        console.log('Password: admin123');
        process.exit(0);
    }

    // Create new admin with global_admin role
    const adminData = {
        email: adminEmail,
        name: 'Shrijan Bhandari',
        role: 'global_admin',  // New Microsoft 365-style role
        active: true,
        password: 'admin123', // Will be auto-hashed on first login
        createdAt: new Date().toISOString(),
    };

    await db.collection('admins').add(adminData);

    console.log('✅ Admin created successfully!');
    console.log('');
    console.log('Login credentials:');
    console.log('  Email:', adminEmail);
    console.log('  Password: admin123');
    console.log('');
    console.log('Go to http://localhost:3001 to login.');
}

createAdmin()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error creating admin:', error);
        process.exit(1);
    });

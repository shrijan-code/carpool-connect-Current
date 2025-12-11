# Firebase Setup Guide

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Firebase Project Setup](#firebase-project-setup)
- [Authentication Configuration](#authentication-configuration)
- [Firestore Database Setup](#firestore-database-setup)
- [Cloud Functions Setup](#cloud-functions-setup)
- [Security Rules](#security-rules)
- [Environment Configuration](#environment-configuration)
- [Testing & Deployment](#testing--deployment)

## 🔧 Prerequisites

1. **Node.js**: Version 18 or higher
2. **Firebase CLI**: Install globally
   ```bash
   npm install -g firebase-tools
   ```
3. **Google Account**: For Firebase Console access
4. **Expo CLI**: For React Native development
   ```bash
   npm install -g @expo/cli
   ```

## 🚀 Firebase Project Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `carpool-app-[your-suffix]`
4. Enable Google Analytics (recommended)
5. Select or create Analytics account
6. Click "Create project"

### 2. Enable Required Services
Navigate to your project and enable:
- **Authentication**
- **Firestore Database**
- **Cloud Functions**
- **Cloud Storage**
- **Cloud Messaging**

### 3. Add Apps to Project
1. Click "Add app" → Web app
2. App nickname: `carpool-web`
3. Enable Firebase Hosting (optional)
4. Copy the config object for later use

## 🔐 Authentication Configuration

### 1. Enable Sign-in Methods
1. Go to Authentication → Sign-in method
2. Enable the following providers:
   - **Email/Password**: Enable
   - **Google**: Enable and configure
     - Add your app's package name
     - Add SHA-1 fingerprint for Android
     - Download `google-services.json` for Android
     - Download `GoogleService-Info.plist` for iOS

### 2. Configure OAuth Consent Screen
1. Go to Google Cloud Console
2. Navigate to APIs & Services → OAuth consent screen
3. Configure app information:
   - App name: "Carpool App"
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes: `email`, `profile`, `openid`
5. Add test users if in testing mode

### 3. Authorized Domains
Add your domains to Firebase Auth:
- `localhost` (for development)
- Your production domain
- Expo development URLs

## 🗄️ Firestore Database Setup

### 1. Create Database
1. Go to Firestore Database
2. Click "Create database"
3. Choose "Start in test mode" (we'll add security rules later)
4. Select location closest to your users

### 2. Create Collections
Create the following collections with sample documents:

#### Users Collection
```javascript
// Collection: users
// Document ID: [user-id]
{
  displayName: "John Doe",
  name: "John Doe",
  email: "john@example.com",
  phone: "+61400000000",
  role: "both",
  preferredRole: "driver",
  canBeDriver: true,
  canBeRider: true,
  rating: 4.8,
  totalRides: 15,
  verified: true,
  profilePicture: "",
  carDetails: {
    make: "Toyota",
    model: "Camry",
    year: 2020,
    color: "White",
    licensePlate: "ABC123",
    seats: 4,
    verified: true
  },
  walkingDistanceTolerance: 800,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z"
}
```

#### Rides Collection
```javascript
// Collection: rides
// Document ID: [auto-generated]
{
  driverId: "[user-id]",
  driver: {
    id: "[user-id]",
    name: "John Doe",
    rating: 4.8,
    profilePicture: ""
  },
  vehicle: {
    make: "Toyota",
    model: "Camry",
    color: "White",
    licensePlate: "ABC123"
  },
  origin: {
    name: "Sydney CBD",
    address: "Sydney NSW, Australia",
    latitude: -33.8688,
    longitude: 151.2093
  },
  destination: {
    name: "Melbourne CBD",
    address: "Melbourne VIC, Australia",
    latitude: -37.8136,
    longitude: 144.9631
  },
  departureAt: "2024-12-25T09:00:00.000Z",
  seatsTotal: 3,
  seatsAvailable: 2,
  pricePerSeat: 5000, // $50.00 in cents
  status: "upcoming",
  passengers: [],
  distance: "878 km",
  duration: "8h 45m",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z"
}
```

#### Bookings Collection
```javascript
// Collection: bookings
// Document ID: [auto-generated]
{
  rideId: "[ride-id]",
  driverId: "[driver-user-id]",
  riderId: "[rider-user-id]",
  passenger: {
    id: "[rider-user-id]",
    name: "Jane Smith",
    rating: 4.9,
    profilePicture: ""
  },
  seats: 1,
  amountTotal: 5000, // $50.00 in cents
  status: "pending_driver",
  payment: {
    intentId: "pi_mock_123456789",
    status: "authorized"
  },
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z"
}
```

### 3. Create Indexes
Create composite indexes for efficient queries:

1. **Rides Index**:
   - Collection: `rides`
   - Fields: `status` (Ascending), `seatsAvailable` (Ascending), `departureAt` (Ascending)

2. **Bookings Index**:
   - Collection: `bookings`
   - Fields: `riderId` (Ascending), `createdAt` (Descending)

3. **User Rides Index**:
   - Collection: `rides`
   - Fields: `driverId` (Ascending), `createdAt` (Descending)

## ☁️ Cloud Functions Setup

### 1. Initialize Functions
```bash
cd your-project-directory
firebase init functions
```

Choose:
- Use existing project
- Language: JavaScript or TypeScript
- ESLint: Yes
- Install dependencies: Yes

### 2. Install Dependencies
```bash
cd functions
npm install firebase-admin firebase-functions
```

### 3. Environment Variables
Set up environment variables for functions:
```bash
firebase functions:config:set \
  stripe.secret_key="sk_test_..." \
  stripe.webhook_secret="whsec_..." \
  google.maps_api_key="AIza..." \
  app.platform_fee_percent="10" \
  app.reservation_ttl_minutes="10"
```

### 4. Deploy Functions
```bash
firebase deploy --only functions
```

## 🔒 Security Rules

### 1. Firestore Security Rules
Create comprehensive security rules in `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      allow read: if request.auth != null; // Allow reading other users for ride info
    }
    
    // Rides rules
    match /rides/{rideId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && 
                   request.auth.uid == resource.data.driverId;
      allow update: if request.auth != null && 
                   request.auth.uid == resource.data.driverId;
      allow delete: if false; // Use soft delete only
    }
    
    // Bookings rules
    match /bookings/{bookingId} {
      allow read: if request.auth != null && 
                 (request.auth.uid == resource.data.riderId || 
                  request.auth.uid == resource.data.driverId);
      allow create: if request.auth != null && 
                   request.auth.uid == request.resource.data.riderId;
      allow update: if request.auth != null && 
                   (request.auth.uid == resource.data.riderId || 
                    request.auth.uid == resource.data.driverId);
    }
    
    // Chat messages
    match /chat_messages/{messageId} {
      allow read, write: if request.auth != null;
    }
    
    // Notifications
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null && 
                        request.auth.uid == resource.data.userId;
    }
    
    // Audit logs - read only for authenticated users
    match /audit_logs/{logId} {
      allow read: if request.auth != null;
      allow write: if false; // Only functions can write
    }
    
    match /booking_audit/{logId} {
      allow read: if request.auth != null;
      allow write: if false; // Only functions can write
    }
    
    match /payment_audit/{logId} {
      allow read: if request.auth != null;
      allow write: if false; // Only functions can write
    }
  }
}
```

### 2. Storage Security Rules
Create storage rules in `storage.rules`:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Profile pictures
    match /profile_pictures/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Vehicle documents
    match /vehicle_documents/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Chat images
    match /chat_images/{rideId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## ⚙️ Environment Configuration

### 1. Create Environment Files
Create `.env` file in project root:
```env
# Firebase Configuration
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Google Maps
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Stripe (for future use)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# App Configuration
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_API_URL=https://your-region-your-project.cloudfunctions.net
```

### 2. Update Firebase Config
Update `config/firebase.ts`:
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = Platform.OS === 'web' ? getAuth(app) : initializeAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize messaging for web only
export const messaging = Platform.OS === 'web' ? 
  (async () => {
    if (await isSupported()) {
      return getMessaging(app);
    }
    return null;
  })() : null;

export default app;
```

## 🧪 Testing & Deployment

### 1. Local Development
Start Firebase emulators for local development:
```bash
firebase emulators:start
```

This starts:
- Firestore Emulator (port 8080)
- Authentication Emulator (port 9099)
- Functions Emulator (port 5001)
- Storage Emulator (port 9199)

### 2. Update App for Emulators
Add emulator configuration in development:
```typescript
// config/firebase.ts
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectStorageEmulator } from 'firebase/storage';
import { connectFunctionsEmulator } from 'firebase/functions';

if (__DEV__ && !auth._delegate._config.emulator) {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

### 3. Deploy to Production
Deploy all services:
```bash
# Deploy everything
firebase deploy

# Deploy specific services
firebase deploy --only firestore:rules
firebase deploy --only functions
firebase deploy --only storage
```

### 4. Monitor Deployment
1. Check Firebase Console for deployment status
2. Monitor Cloud Functions logs
3. Test authentication flow
4. Verify Firestore operations
5. Test push notifications

## 🔍 Troubleshooting

### Common Issues

1. **Authentication Domain Error**:
   - Add your domain to Firebase Auth authorized domains
   - For Expo: Add `auth.expo.io` and your custom domain

2. **Firestore Permission Denied**:
   - Check security rules
   - Verify user authentication
   - Ensure proper field validation

3. **Functions Deployment Failed**:
   - Check Node.js version compatibility
   - Verify all dependencies are installed
   - Check function syntax and imports

4. **Google Sign-In Issues**:
   - Verify SHA-1 fingerprint for Android
   - Check bundle ID for iOS
   - Ensure OAuth consent screen is configured

### Debug Commands
```bash
# Check Firebase project status
firebase projects:list

# View current configuration
firebase functions:config:get

# Check deployment status
firebase deploy --dry-run

# View function logs
firebase functions:log
```

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Cloud Functions Guide](https://firebase.google.com/docs/functions)
- [Firebase Auth with React Native](https://rnfirebase.io/auth/usage)
- [Expo Firebase Integration](https://docs.expo.dev/guides/using-firebase/)

This guide provides a comprehensive setup for Firebase integration with your carpool app. Follow each section carefully and test thoroughly before deploying to production.
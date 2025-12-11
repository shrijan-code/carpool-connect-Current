# Firebase Functions Complete Setup Guide
## Carpool Connect App - Production Ready

This guide provides step-by-step instructions to set up ALL Firebase Cloud Functions required for your carpool app. Follow each section carefully to ensure proper deployment.

---

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Initial Setup](#initial-setup)
4. [Function Categories](#function-categories)
5. [Environment Configuration](#environment-configuration)
6. [Deployment Steps](#deployment-steps)
7. [Testing Functions](#testing-functions)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
- Node.js (v18 or higher)
- Firebase CLI installed globally
- Firebase project created
- Stripe account (for payments)
- Gmail account (for email notifications)

### Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Login to Firebase
```bash
firebase login
```

---

## Project Structure

Your functions directory should look like this:

```
functions/
├── index.js                          # Main entry point
├── bookingFlow.js                    # Booking flow functions
├── stripe.js                         # Stripe payment functions
├── package.json                      # Dependencies
├── src/
│   ├── index.ts                      # TypeScript entry (optional)
│   ├── bookings/
│   │   ├── createBooking.js
│   │   ├── cancelBooking.ts
│   │   └─��� enhancedBookingFlow.ts
│   ├── payment/
│   │   ├── mockPayment.ts
│   │   └── stripePayment.ts
│   └── carpool-booking-flow.ts
└── .env                              # Environment variables (local only)
```

---

## Initial Setup

### Step 1: Initialize Firebase Functions

If you haven't initialized functions yet:

```bash
cd your-project-root
firebase init functions
```

Select:
- JavaScript (or TypeScript if preferred)
- Install dependencies with npm

### Step 2: Install Required Dependencies

Navigate to functions directory:

```bash
cd functions
npm install firebase-functions firebase-admin stripe nodemailer cors express
```

### Step 3: Create package.json

Your `functions/package.json` should include:

```json
{
  "name": "functions",
  "description": "Cloud Functions for Carpool Connect",
  "scripts": {
    "serve": "firebase emulators:start --only functions",
    "shell": "firebase functions:shell",
    "start": "npm run shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log"
  },
  "engines": {
    "node": "18"
  },
  "main": "index.js",
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "stripe": "^14.0.0",
    "nodemailer": "^6.9.0",
    "cors": "^2.8.5",
    "express": "^4.18.2"
  }
}
```

---

## Function Categories

Your app requires these function categories:

### 1. **Booking Flow Functions** (CRITICAL)
- `createPendingBooking` - Rider creates booking request
- `driverRespondBooking` - Driver accepts/declines booking
- `startRide` - Driver starts the ride
- `completeRideAndCharge` - Complete ride and process payments
- `cancelBooking` - Cancel booking with refunds
- `getDriverBookingRequests` - Get pending booking requests

### 2. **Ride Management Functions**
- `searchRides` - Search rides with Haversine distance
- `createRide` - Create new ride
- `softDeleteRide` - Soft delete ride

### 3. **Payment Functions** (Stripe Integration)
- `stripeApi` - Stripe Connect OAuth and payment processing
- `stripeWebhook` - Handle Stripe webhook events
- Payment intent creation, capture, and cancellation

### 4. **Delivery Functions**
- `deliveryApi` - Create and manage deliveries
- `acceptDelivery` - Driver accepts delivery
- `updateDeliveryStatus` - Update delivery status

### 5. **Safety & Emergency Functions**
- `emergencyContactsApi` - Manage emergency contacts
- `safetyReportsApi` - Submit and manage safety reports

### 6. **Utility Functions**
- `healthCheck` - System health monitoring
- `cleanupExpiredReservations` - Scheduled cleanup (runs every 5 minutes)

---

## Environment Configuration

### Step 1: Set Firebase Config

```bash
# Set Stripe keys
firebase functions:config:set stripe.secret_key="sk_test_YOUR_KEY"
firebase functions:config:set stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"

# Set email credentials (for safety reports)
firebase functions:config:set email.user="your-email@gmail.com"
firebase functions:config:set email.password="your-app-password"

# Set platform fee percentage (optional, default 10%)
firebase functions:config:set platform.fee_percent="0.1"
```

### Step 2: View Current Config

```bash
firebase functions:config:get
```

### Step 3: Create Local .env File (for testing)

Create `functions/.env`:

```env
STRIPE_SECRET_KEY=sk_test_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
PLATFORM_FEE_PCT=0.1
RESERVATION_TTL_MINUTES=10
```

**IMPORTANT:** Never commit `.env` to version control!

---

## Deployment Steps

### Step 1: Create Main Functions File

Create `functions/index.js` with ALL your functions:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin
admin.initializeApp();

// Import function modules
const { ridesApi } = require('./bookingFlow');
const { stripeApi, stripeWebhook } = require('./stripe');

// Export all functions
exports.ridesApi = ridesApi;
exports.stripeApi = stripeApi;
exports.stripeWebhook = stripeWebhook;

// ... (rest of your functions from the codebase)
```

### Step 2: Test Locally (IMPORTANT!)

Before deploying, test locally:

```bash
cd functions
npm run serve
```

This starts the Firebase emulator. Test your functions at:
- `http://localhost:5001/YOUR_PROJECT_ID/us-central1/FUNCTION_NAME`

### Step 3: Deploy All Functions

```bash
firebase deploy --only functions
```

### Step 4: Deploy Specific Function (if needed)

```bash
firebase deploy --only functions:createPendingBooking
```

### Step 5: Deploy Multiple Functions

```bash
firebase deploy --only functions:createPendingBooking,functions:driverRespondBooking
```

---

## Complete Function List to Deploy

Here's the complete list of functions you need to deploy:

### Core Booking Functions (MUST DEPLOY)
```bash
firebase deploy --only functions:createPendingBooking
firebase deploy --only functions:driverRespondBooking
firebase deploy --only functions:startRide
firebase deploy --only functions:completeRideAndCharge
firebase deploy --only functions:cancelBooking
firebase deploy --only functions:getDriverBookingRequests
```

### Ride Management Functions
```bash
firebase deploy --only functions:searchRides
firebase deploy --only functions:createRide
firebase deploy --only functions:softDeleteRide
```

### Payment Functions (Stripe)
```bash
firebase deploy --only functions:stripeApi
firebase deploy --only functions:stripeWebhook
```

### Delivery Functions
```bash
firebase deploy --only functions:deliveryApi
firebase deploy --only functions:emergencyContactsApi
firebase deploy --only functions:safetyReportsApi
```

### Utility Functions
```bash
firebase deploy --only functions:healthCheck
firebase deploy --only functions:cleanupExpiredReservations
```

### Deploy Everything at Once
```bash
firebase deploy --only functions
```

---

## Testing Functions

### Test Using Firebase Console

1. Go to Firebase Console → Functions
2. Click on a function
3. Click "Test function"
4. Enter test data
5. Click "Run test"

### Test Using Postman/cURL

#### Example: Test createPendingBooking

```bash
curl -X POST \
  https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/createPendingBooking \
  -H 'Content-Type: application/json' \
  -d '{
    "rideId": "test-ride-123",
    "seats": 2
  }'
```

#### Example: Test Health Check

```bash
curl https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/healthCheck
```

### Test Using Your App

Update your app's Firebase config to point to deployed functions:

```typescript
// config/firebase.ts
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const functions = getFunctions(app);

// For local testing (comment out for production)
// connectFunctionsEmulator(functions, 'localhost', 5001);

export { functions };
```

---

## Stripe Webhook Setup

### Step 1: Get Webhook Signing Secret

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter URL: `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/stripeWebhook`
4. Select events to listen to:
   - `account.updated`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payout.paid`
   - `payout.failed`
5. Copy the webhook signing secret

### Step 2: Set Webhook Secret

```bash
firebase functions:config:set stripe.webhook_secret="whsec_YOUR_SECRET"
```

### Step 3: Redeploy Stripe Functions

```bash
firebase deploy --only functions:stripeWebhook
```

---

## Firestore Security Rules

Ensure your Firestore rules allow Cloud Functions to write:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow Cloud Functions to read/write everything
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Bookings collection
    match /bookings/{bookingId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
        (request.auth.uid == resource.data.riderId || 
         request.auth.uid == resource.data.driverId);
    }
    
    // Rides collection
    match /rides/{rideId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
        request.auth.uid == resource.data.driverId;
    }
    
    // Notifications collection
    match /notifications/{notificationId} {
      allow read: if request.auth != null && 
        request.auth.uid == resource.data.userId;
      allow create: if true; // Allow Cloud Functions to create
    }
  }
}
```

Deploy rules:

```bash
firebase deploy --only firestore:rules
```

---

## Monitoring & Logs

### View Function Logs

```bash
# View all logs
firebase functions:log

# View specific function logs
firebase functions:log --only createPendingBooking

# Follow logs in real-time
firebase functions:log --follow
```

### View Logs in Firebase Console

1. Go to Firebase Console → Functions
2. Click on a function
3. Click "Logs" tab
4. View execution logs, errors, and performance

### Set Up Alerts

1. Go to Firebase Console → Functions
2. Click "Alerts" tab
3. Set up alerts for:
   - Error rate threshold
   - Execution time threshold
   - Invocation count threshold

---

## Troubleshooting

### Common Issues

#### 1. "Permission Denied" Error

**Solution:** Check Firestore security rules and ensure Cloud Functions have proper permissions.

```bash
firebase deploy --only firestore:rules
```

#### 2. "Function Not Found" Error

**Solution:** Ensure function is deployed and name matches exactly.

```bash
firebase deploy --only functions:FUNCTION_NAME
```

#### 3. "Stripe API Key Invalid" Error

**Solution:** Verify Stripe keys are set correctly.

```bash
firebase functions:config:get stripe
firebase functions:config:set stripe.secret_key="sk_test_YOUR_KEY"
firebase deploy --only functions
```

#### 4. "Timeout Error" (Function takes too long)

**Solution:** Increase function timeout in `index.js`:

```javascript
exports.myFunction = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onCall(async (data, context) => {
    // Your function code
  });
```

#### 5. "Cold Start" Performance Issues

**Solution:** Use minimum instances to keep functions warm:

```javascript
exports.myFunction = functions
  .runWith({ minInstances: 1 })
  .https.onCall(async (data, context) => {
    // Your function code
  });
```

**Note:** Minimum instances incur costs even when not in use.

#### 6. "Missing Index" Error

**Solution:** Click the link in the error message to create the required Firestore index automatically.

#### 7. Email Notifications Not Sending

**Solution:** 
1. Enable "Less secure app access" in Gmail (or use App Password)
2. Verify email config:

```bash
firebase functions:config:get email
```

3. For Gmail, create an App Password:
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
   - Use this password in config

---

## Cost Optimization

### 1. Use Scheduled Functions Wisely

The `cleanupExpiredReservations` function runs every 5 minutes. Adjust frequency if needed:

```javascript
// Change from every 5 minutes to every 15 minutes
exports.cleanupExpiredReservations = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    // Cleanup logic
  });
```

### 2. Optimize Function Memory

Most functions don't need 1GB of memory. Reduce to 256MB or 512MB:

```javascript
exports.myFunction = functions
  .runWith({ memory: '256MB' })
  .https.onCall(async (data, context) => {
    // Your function code
  });
```

### 3. Use Batching for Firestore Writes

Instead of individual writes, use batched writes:

```javascript
const batch = db.batch();
batch.update(ref1, data1);
batch.update(ref2, data2);
await batch.commit();
```

### 4. Monitor Function Invocations

Check Firebase Console → Functions → Usage to monitor:
- Invocations per day
- Execution time
- Memory usage
- Errors

---

## Production Checklist

Before going live, ensure:

- [ ] All functions deployed successfully
- [ ] Stripe webhook configured and tested
- [ ] Email notifications working
- [ ] Firestore security rules deployed
- [ ] Environment variables set correctly
- [ ] Function logs monitored
- [ ] Error alerts configured
- [ ] Backup strategy in place
- [ ] Rate limiting implemented (if needed)
- [ ] CORS configured properly
- [ ] All test data removed from production
- [ ] Documentation updated

---

## Quick Reference Commands

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:createPendingBooking

# View logs
firebase functions:log

# View config
firebase functions:config:get

# Set config
firebase functions:config:set key.subkey="value"

# Test locally
cd functions && npm run serve

# Delete function
firebase functions:delete FUNCTION_NAME

# List all functions
firebase functions:list
```

---

## Support & Resources

- **Firebase Functions Documentation:** https://firebase.google.com/docs/functions
- **Stripe API Documentation:** https://stripe.com/docs/api
- **Firebase Console:** https://console.firebase.google.com
- **Stripe Dashboard:** https://dashboard.stripe.com

---

## Summary

You now have a complete guide to set up all Firebase Functions for your carpool app. Follow these steps in order:

1. ✅ Install Firebase CLI and login
2. ✅ Initialize functions directory
3. ✅ Install dependencies
4. ✅ Set environment variables
5. ✅ Create all function files
6. ✅ Test locally with emulator
7. ✅ Deploy to production
8. ✅ Configure Stripe webhook
9. ✅ Monitor logs and set up alerts
10. ✅ Test all functions thoroughly

**IMPORTANT:** Always test functions locally before deploying to production!

Good luck with your deployment! 🚀

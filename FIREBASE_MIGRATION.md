# Firebase Project Migration Guide

This guide explains how to migrate CarpoolConnect to a new Google/Firebase account or create a fresh deployment.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Step 1: Create New Firebase Project](#step-1-create-new-firebase-project)
- [Step 2: Configure Authentication](#step-2-configure-authentication)
- [Step 3: Set Up External Services](#step-3-set-up-external-services)
- [Step 4: Update Local Configuration](#step-4-update-local-configuration)
- [Step 5: Deploy Backend](#step-5-deploy-backend)
- [Step 6: Deploy Frontend Apps](#step-6-deploy-frontend-apps)
- [Step 7: Verify Deployment](#step-7-verify-deployment)
- [Data Migration (Optional)](#data-migration-optional)
- [Troubleshooting](#troubleshooting)

---

## Overview

### What Deploys Automatically from Code

| Component | Command | Source File |
|-----------|---------|-------------|
| Cloud Functions | `firebase deploy --only functions` | `functions/src/index.ts` |
| Firestore Rules | `firebase deploy --only firestore:rules` | `firestore.rules` |
| Firestore Indexes | `firebase deploy --only firestore:indexes` | `firestore.indexes.json` |
| Storage Rules | `firebase deploy --only storage` | `storage.rules` |

### What Requires Manual Setup

| Component | Location |
|-----------|----------|
| Firebase Project | Firebase Console |
| Authentication Providers | Firebase Console |
| Stripe Account | Stripe Dashboard |
| Google Maps API | Google Cloud Console |
| Apple Developer Account | App Store Connect |
| Google Play Account | Play Console |

---

## Prerequisites

- Node.js 18+ installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- Access to new Google account
- Stripe account (new or existing)
- Google Maps API access

---

## Step 1: Create New Firebase Project

### 1.1 Create Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Create a project"**
3. Enter project name (e.g., `carpoolconnect-production`)
4. Enable Google Analytics (optional)
5. Wait for project creation

### 1.2 Enable Required Services
In Firebase Console, enable:

- **Firestore Database**
  - Click "Cloud Firestore" → "Create database"
  - Start in **production mode**
  - Select region (e.g., `australia-southeast1`)

- **Authentication**
  - Click "Authentication" → "Get started"
  - Enable **Email/Password** provider
  - Enable **Phone** provider (optional)

- **Storage**
  - Click "Storage" → "Get started"
  - Start in production mode

- **Cloud Functions**
  - Requires Blaze (pay-as-you-go) plan
  - Click "Upgrade" in bottom left

### 1.3 Generate Service Account Key
1. Go to **Project Settings** → **Service Accounts**
2. Click **"Generate new private key"**
3. Save the JSON file securely
4. You'll need `project_id`, `client_email`, and `private_key`

---

## Step 2: Configure Authentication

### 2.1 Email Templates (Optional)
1. Go to **Authentication** → **Templates**
2. Customize email verification and password reset templates
3. Update sender name to "CarpoolConnect"

### 2.2 Authorized Domains
1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Add your production domains:
   - `carpoolconnect.com.au`
   - `admin.carpoolconnect.com.au`
   - `*.vercel.app` (for staging)

---

## Step 3: Set Up External Services

### 3.1 Stripe Setup

1. Create/access [Stripe Dashboard](https://dashboard.stripe.com)
2. Get API keys from **Developers** → **API Keys**:
   - `STRIPE_SECRET_KEY` (starts with `sk_live_` or `sk_test_`)
   - `STRIPE_PUBLISHABLE_KEY` (starts with `pk_live_` or `pk_test_`)
3. Enable **Stripe Connect** for driver payouts:
   - **Settings** → **Connect** → Enable
4. Enable **Stripe Identity** for driver verification:
   - **Settings** → **Identity** → Enable
5. Set up Webhook:
   - **Developers** → **Webhooks** → **Add endpoint**
   - URL: `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/stripeWebhook`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`, `identity.verification_session.verified`

### 3.2 Google Maps API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select/create a project linked to your Firebase project
3. Enable these APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Places API
   - Geocoding API
   - Directions API
4. Create API Key:
   - **APIs & Services** → **Credentials** → **Create Credentials** → **API Key**
5. Restrict the key:
   - For mobile: Restrict to your app's package name/bundle ID
   - For web: Restrict to your domains

### 3.3 Email Service (for notifications)
Use Gmail App Password or a service like SendGrid:
1. Gmail: Enable 2FA → Generate App Password
2. Or configure SendGrid/Mailgun

---

## Step 4: Update Local Configuration

### 4.1 Switch Firebase Project
```bash
# Login to new Google account
firebase logout
firebase login

# List available projects
firebase projects:list

# Use new project
firebase use NEW_PROJECT_ID

# Or add as alias
firebase use --add
```

### 4.2 Update Environment Files

**Root `.env` (Mobile App):**
```bash
# Firebase (from Firebase Console → Project Settings → General)
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=new-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=new-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=new-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Stripe
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx

# Google Maps
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSy...
```

**`admin-dashboard/.env.local`:**
```bash
FIREBASE_PROJECT_ID=new-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@new-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
NEXTAUTH_SECRET=random-32-char-secret
NEXTAUTH_URL=https://admin.carpoolconnect.com.au
```

### 4.3 Update app.json
Update Google Maps API keys in `app.json`:
```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "NEW_API_KEY"
      }
    },
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "NEW_API_KEY"
        }
      }
    }
  }
}
```

### 4.4 Update Bundle Identifiers (if changing)
In `app.json`:
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.carpoolconnect"
    },
    "android": {
      "package": "com.yourcompany.carpoolconnect"
    }
  }
}
```

---

## Step 5: Deploy Backend

### 5.1 Set Firebase Secrets
```bash
cd functions

# Set required secrets
firebase functions:secrets:set STRIPE_SECRET_KEY
# Enter your Stripe secret key when prompted

firebase functions:secrets:set EMAIL_USER
# Enter email address

firebase functions:secrets:set EMAIL_PASSWORD
# Enter email app password

firebase functions:secrets:set SAFETY_REPORT_EMAIL
# Enter safety report recipient email
```

### 5.2 Build and Deploy Functions
```bash
# Build TypeScript
cd functions
npm run build

# Deploy everything
cd ..
firebase deploy
```

This deploys:
- ✅ 35+ Cloud Functions
- ✅ Firestore security rules
- ✅ Firestore indexes
- ✅ Storage rules

### 5.3 Verify Deployment
```bash
# List deployed functions
firebase functions:list

# Check function logs
firebase functions:log
```

---

## Step 6: Deploy Frontend Apps

### 6.1 Marketing Website (Vercel)
```bash
cd webapp

# Connect to Vercel
vercel

# Set environment variables in Vercel dashboard
# Deploy
vercel --prod
```

### 6.2 Admin Dashboard (Vercel)
```bash
cd admin-dashboard

# Deploy to Vercel
vercel

# Add environment variables in Vercel dashboard:
# - FIREBASE_PROJECT_ID
# - FIREBASE_CLIENT_EMAIL
# - FIREBASE_PRIVATE_KEY
# - NEXTAUTH_SECRET
# - NEXTAUTH_URL

vercel --prod
```

### 6.3 Mobile App (EAS)
```bash
# Configure EAS
eas build:configure

# Set secrets
eas secret:create --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value pk_live_xxx

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## Step 7: Verify Deployment

### 7.1 Test Checklist

- [ ] Firebase Console shows new project active
- [ ] Can create new user account
- [ ] Can login with email/password
- [ ] Firestore documents are being created
- [ ] Cloud Functions respond (check `/healthcheck`)
- [ ] Stripe Connect onboarding works
- [ ] Maps display correctly
- [ ] Push notifications work
- [ ] Admin dashboard can login
- [ ] Admin can view users/rides/bookings

### 7.2 Health Check Endpoints
```bash
# Function health check
curl https://REGION-PROJECT.cloudfunctions.net/healthCheck

# Expected response:
# {"status":"healthy","timestamp":"..."}
```

---

## Data Migration (Optional)

If migrating existing data from old project:

### Export from Old Project
```bash
# Export Firestore
gcloud firestore export gs://OLD_PROJECT_BUCKET/backup

# Export Authentication users
firebase auth:export users.json --project OLD_PROJECT_ID
```

### Import to New Project
```bash
# Import Firestore
gcloud firestore import gs://NEW_PROJECT_BUCKET/backup

# Import Authentication users
firebase auth:import users.json --project NEW_PROJECT_ID
```

> ⚠️ **Note:** User passwords cannot be migrated. Users will need to reset passwords.

---

## Troubleshooting

### Functions Deployment Fails
```bash
# Check for TypeScript errors
cd functions && npm run build

# Check logs
firebase functions:log --only ERROR
```

### Authentication Issues
- Verify authorized domains in Firebase Console
- Check API key restrictions in Google Cloud Console
- Ensure correct project ID in app config

### Stripe Webhook Errors
- Verify webhook URL is correct
- Check webhook signing secret matches
- Ensure function is deployed and accessible

### Google Maps Not Working
- Verify API key has correct restrictions
- Check all required APIs are enabled
- Verify billing is enabled on Google Cloud

---

## Environment Variables Reference

### Mobile App (.env)
| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_FIREBASE_*` | Firebase config from console |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | Google Maps API key |

### Admin Dashboard (.env.local)
| Variable | Description |
|----------|-------------|
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key |
| `NEXTAUTH_SECRET` | Random secret for sessions |
| `NEXTAUTH_URL` | Admin dashboard URL |

### Cloud Functions (Firebase Secrets)
| Secret | Description |
|--------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `EMAIL_USER` | Email sender address |
| `EMAIL_PASSWORD` | Email app password |
| `SAFETY_REPORT_EMAIL` | Safety report recipient |

---

## Support

For issues during migration:
- Check [Firebase Documentation](https://firebase.google.com/docs)
- Check [Stripe Documentation](https://stripe.com/docs)
- Review Cloud Function logs in Firebase Console
- Contact: hello@carpoolconnect.com.au

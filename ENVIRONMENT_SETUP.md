# Environment Setup Guide

This guide explains how to configure separate Development and Production environments for CarpoolConnect.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR CODEBASE                               │
│                   (One repository)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│   DEVELOPMENT PROJECT    │    │   PRODUCTION PROJECT     │
│   carpoolconnect1-0      │    │   carpoolconnect-prod    │
├──────────────────────────┤    ├──────────────────────────┤
│ • Test freely            │    │ • Real users             │
│ • Wipe data anytime      │    │ • Protected data         │
│ • Stripe TEST keys       │    │ • Stripe LIVE keys       │
│ • Fake users/rides       │    │ • Real money             │
└──────────────────────────┘    └──────────────────────────┘
```

---

## Quick Reference

| Environment | Firebase Project | Stripe Mode | Build Command |
|-------------|-----------------|-------------|---------------|
| Development | `carpoolconnect1-0` | Test | `eas build --profile development` |
| Preview/Testing | `carpoolconnect1-0` | Test | `eas build --profile preview` |
| Production | `carpoolconnect-prod` | Live | `eas build --profile production` |

---

## Step 1: Create Production Firebase Project

### 1.1 Create the Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Add Project"**
3. Name it: `carpoolconnect-prod` (or similar)
4. Enable Google Analytics (recommended)
5. Wait for project creation

### 1.2 Enable Required Services

In your new production project, enable:

1. **Authentication** → Sign-in methods:
   - Email/Password
   - Google (configure OAuth)
   
2. **Firestore Database**:
   - Create database in production mode
   - Select region (same as dev for latency)
   
3. **Cloud Storage**:
   - Create default bucket
   
4. **Cloud Functions**:
   - Will be enabled when you deploy

### 1.3 Get Configuration Values

1. Go to **Project Settings** → **General**
2. Scroll to **Your apps** → Click **Add app** → **Web** (</> icon)
3. Register app and copy the config values:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",           // FIREBASE_API_KEY_PROD
  authDomain: "...",           // FIREBASE_AUTH_DOMAIN_PROD
  projectId: "...",            // FIREBASE_PROJECT_ID_PROD
  storageBucket: "...",        // FIREBASE_STORAGE_BUCKET_PROD
  messagingSenderId: "...",    // FIREBASE_MESSAGING_SENDER_ID_PROD
  appId: "...",                // FIREBASE_APP_ID_PROD
  measurementId: "..."         // FIREBASE_MEASUREMENT_ID_PROD
};
```

---

## Step 2: Configure EAS Secrets

EAS Secrets store your environment variables securely for cloud builds.

### 2.1 Install EAS CLI (if not installed)

```bash
npm install -g eas-cli
eas login
```

### 2.2 Set Development Secrets

```bash
# Firebase Development
eas secret:create FIREBASE_API_KEY_DEV --value "your-dev-api-key"
eas secret:create FIREBASE_AUTH_DOMAIN_DEV --value "carpoolconnect1-0.firebaseapp.com"
eas secret:create FIREBASE_PROJECT_ID_DEV --value "carpoolconnect1-0"
eas secret:create FIREBASE_STORAGE_BUCKET_DEV --value "carpoolconnect1-0.firebasestorage.app"
eas secret:create FIREBASE_MESSAGING_SENDER_ID_DEV --value "your-dev-sender-id"
eas secret:create FIREBASE_APP_ID_DEV --value "your-dev-app-id"
eas secret:create FIREBASE_MEASUREMENT_ID_DEV --value "G-XXXXXXXXXX"

# Stripe Development (TEST keys)
eas secret:create STRIPE_PUBLISHABLE_KEY_DEV --value "pk_test_..."
```

### 2.3 Set Production Secrets

```bash
# Firebase Production
eas secret:create FIREBASE_API_KEY_PROD --value "your-prod-api-key"
eas secret:create FIREBASE_AUTH_DOMAIN_PROD --value "carpoolconnect-prod.firebaseapp.com"
eas secret:create FIREBASE_PROJECT_ID_PROD --value "carpoolconnect-prod"
eas secret:create FIREBASE_STORAGE_BUCKET_PROD --value "carpoolconnect-prod.firebasestorage.app"
eas secret:create FIREBASE_MESSAGING_SENDER_ID_PROD --value "your-prod-sender-id"
eas secret:create FIREBASE_APP_ID_PROD --value "your-prod-app-id"
eas secret:create FIREBASE_MEASUREMENT_ID_PROD --value "G-YYYYYYYYYY"

# Stripe Production (LIVE keys)
eas secret:create STRIPE_PUBLISHABLE_KEY_PROD --value "pk_live_..."
```

### 2.4 Set Shared Secrets

```bash
# Google Places API (can be shared)
eas secret:create GOOGLE_PLACES_API_KEY --value "your-google-places-key"
```

### 2.5 Verify Secrets

```bash
eas secret:list
```

---

## Step 3: Update .firebaserc

After creating production project, update the project ID:

```json
{
  "projects": {
    "default": "carpoolconnect1-0",
    "development": "carpoolconnect1-0",
    "production": "carpoolconnect-prod"  // ← Your actual prod project ID
  }
}
```

---

## Step 4: Deploy Cloud Functions

### To Development

```bash
firebase use development
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage
```

### To Production

```bash
firebase use production
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only storage
```

---

## Step 5: Build & Deploy App

### Development Build (for testing)

```bash
# Android APK for internal testing
eas build --profile development --platform android

# iOS for simulator/TestFlight  
eas build --profile development --platform ios
```

### Preview Build (for beta testers)

```bash
# Uses development Firebase but production-like build
eas build --profile preview --platform all
```

### Production Build (for stores)

```bash
# ⚠️ This uses LIVE credentials!
eas build --profile production --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

---

## Local Development

For local development, your existing `.env` file works:

```bash
# Start local development
npm start
# or
npx expo start
```

The app will read from `.env` and use those values.

---

## Deployment Workflow

### Recommended Process

```
1. Develop locally         → Uses .env (dev Firebase)
2. Test with preview build → Uses EAS secrets (dev Firebase)
3. Beta test via TestFlight/Play Internal → Uses dev Firebase
4. Production build        → Uses EAS secrets (prod Firebase)
5. Submit to stores        → Real users on prod Firebase
```

### Commands Summary

| Action | Command |
|--------|---------|
| Local dev | `npm start` |
| Dev build | `eas build --profile development --platform all` |
| Preview build | `eas build --profile preview --platform all` |
| Prod build | `eas build --profile production --platform all` |
| Deploy functions (dev) | `firebase use development && firebase deploy --only functions` |
| Deploy functions (prod) | `firebase use production && firebase deploy --only functions` |
| Submit to stores | `eas submit --platform all` |

---

## Troubleshooting

### "Firebase configuration not found"

- Ensure EAS secrets are set correctly
- Run `eas secret:list` to verify
- Check that secret names match exactly what's in `eas.json`

### "Wrong environment connected"

- Check console logs when app starts - it shows `[app.config.js] Environment: DEVELOPMENT` or `PRODUCTION`
- Verify you built with correct profile

### "Functions not working in production"

- Make sure you deployed functions to production project:
  ```bash
  firebase use production
  firebase deploy --only functions
  ```

### "Stripe payments failing in production"

- Ensure you're using LIVE Stripe keys (`pk_live_...`)
- Complete Stripe account activation
- Enable live mode in Stripe Dashboard

---

## Security Checklist

- [ ] Production Firebase project has stricter IAM permissions
- [ ] Only team leads can deploy to production
- [ ] Production Stripe keys are only in EAS secrets, never in code
- [ ] `.env.production` is in `.gitignore`
- [ ] Firestore rules deployed to production are tested
- [ ] Production database has regular backups enabled

---

## Related Documentation

- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS Secrets](https://docs.expo.dev/build-reference/variables/)
- [Firebase Environments](https://firebase.google.com/docs/projects/dev-workflows/overview)
- [Stripe Test vs Live](https://stripe.com/docs/testing)

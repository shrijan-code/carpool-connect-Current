# CarpoolConnect Quick Reference Guide

> **Purpose:** Single source of truth for finding and changing common configurations, text, and settings across the entire application.

---

## 📋 Table of Contents

1. [Pricing & Fees](#-pricing--fees)
2. [Colors & Theming](#-colors--theming)
3. [Email Templates & Messages](#-email-templates--messages)
4. [Business Information](#-business-information)
5. [App Text & Wording](#-app-text--wording)
6. [Environment Variables](#-environment-variables)
7. [Firebase Configuration](#-firebase-configuration)
8. [Troubleshooting Guide](#-troubleshooting-guide)

---

## 💰 Pricing & Fees

### Platform Fee (Service Fee)

| What | File | Line/Section |
|------|------|--------------|
| **Fee Amount** | `utils/price.ts` | `PLATFORM_FEE_CENTS = 500` (500 = $5.00) |
| **Display Text** | `utils/price.ts` | `PLATFORM_FEE_DISPLAY = "$5.00"` |
| **Backend Fee** | `functions/src/index.ts` | Search: `platformFee` or `PLATFORM_FEE` |

**To change the platform fee:**
```typescript
// In utils/price.ts
export const PLATFORM_FEE_CENTS = 500;  // Change this (cents)
export const PLATFORM_FEE_DISPLAY = "$5.00";  // Update display text
```

---

### Currency Settings

| What | File | Line/Section |
|------|------|--------------|
| **Default Currency** | `utils/price.ts` | `CURRENCY_CODE = 'aud'` |
| **Currency Symbol** | `utils/price.ts` | `CURRENCY_SYMBOL = 'A$'` |
| **Stripe Currency** | `functions/src/index.ts` | Search: `currency: "aud"` |

---

## 🎨 Colors & Theming

### Main Color Palette

| What | File |
|------|------|
| **Primary Colors** | `constants/colors.ts` |
| **Theme Colors** | `constants/colors.ts` |
| **Dark/Light Mode** | `constants/colors.ts` |

**Example structure in `constants/colors.ts`:**
```typescript
export const Colors = {
  light: {
    primary: '#007AFF',      // Main brand color
    background: '#FFFFFF',
    text: '#000000',
    // ... more colors
  },
  dark: {
    primary: '#0A84FF',
    background: '#000000',
    text: '#FFFFFF',
    // ... more colors
  }
};
```

---

## 📧 Email Templates & Messages

### Email Template Files

| Email Type | File |
|------------|------|
| **All Email Templates** | `functions/src/utils/email.ts` |

**Common templates to modify:**
- `rideConfirmation` - When a ride is created
- `bookingConfirmation` - When a booking is confirmed
- `bookingCancellation` - When a booking is cancelled
- `safetyReport` - Safety incident notifications
- `driverPayment` - Payment notifications to drivers

### Email Sender Configuration

| What | File | How to Change |
|------|------|---------------|
| **Sender Email** | Firebase Secrets | `firebase functions:secrets:set EMAIL_USER` |
| **Sender Password** | Firebase Secrets | `firebase functions:secrets:set EMAIL_PASSWORD` |
| **Admin Email** | `functions/src/index.ts` | Search: `SAFETY_REPORT_EMAIL` |

### Using Microsoft 365 / Outlook

To use a custom domain via Microsoft 365 instead of Gmail, you need to update the `nodemailer` transporter configuration.

1.  **Update Configuration File:** `functions/src/utils/email.ts`
    *   Change `service: 'gmail'` to the Microsoft 365 configuration below:
    ```typescript
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
    ```
2.  **Update Secrets:**
    *   Set `EMAIL_USER` to your full Microsoft 365 email (e.g., `support@yourdomain.com`).
    *   Set `EMAIL_PASSWORD` to your Microsoft 365 password.

---

## 🏢 Business Information

### Contact Details

| What | File | Section |
|------|------|---------|
| **Company Name** | `webapp/app/page.tsx` | Footer section |
| **Support Email** | Multiple files | Search: `support@` or `contact@` |
| **Safety Report Email** | `functions/src/index.ts` | `SAFETY_REPORT_EMAIL` variable |

### Legal & Policy Text

| What | File |
|------|------|
| **Terms of Service** | `webapp/app/terms/page.tsx` or `app/terms.tsx` |
| **Privacy Policy** | `webapp/app/privacy/page.tsx` or `app/privacy.tsx` |
| **Cancellation Policy** | `components/CancellationModal.tsx` |

### App Store Information

| What | File |
|------|------|
| **App Name** | `app.json` → `expo.name` |
| **Bundle ID (iOS)** | `app.json` → `expo.ios.bundleIdentifier` |
| **Package Name (Android)** | `app.json` → `expo.android.package` |
| **Version Number** | `app.json` → `expo.version` |

---

## 📚 Legal & Help Content

| Content | File | Variable |
|---------|------|----------|
| **Terms of Service** | `constants/legal-text.ts` | `TERMS_OF_SERVICE` |
| **Privacy Policy** | `constants/legal-text.ts` | `PRIVACY_POLICY` |
| **FAQ** | `constants/legal-text.ts` | `FAQ` |

**To update legal text:**
Edit `constants/legal-text.ts` and modify the template strings. The app renders this text in a scrollable modal.

---

## ✍️ App Text & Wording

### Common UI Text Locations

| Text Type | File(s) to Check |
|-----------|------------------|
| **Onboarding screens** | `app/onboarding.tsx` |
| **Login/Register screens** | `app/auth/*.tsx` |
| **Home screen** | `app/(tabs)/home.tsx` |
| **Ride booking flow** | `components/BookingModal.tsx`, `app/ride-details.tsx` |
| **Error messages** | `utils/errors.ts` |
| **Button labels** | Individual component files |

### Notification Messages

| What | File |
|------|------|
| **Push notification text** | `functions/src/utils/notifications.ts` |
| **In-app alerts** | Individual component files (search for `Alert.alert`) |

---

## 🔧 Environment Variables

### Mobile App (.env file)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase authentication |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project |
| `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | Address autocomplete |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps display |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe payments |

## 🔒 Security & API Keys

### Where to Store Keys?

*   **NEVER store keys directly in code.** Doing so exposes them if the codebase is shared or public.
*   **Public Keys (Client-Side):** Safe to expose in the app bundle. Store in `.env` and load via `EXPO_PUBLIC_` prefix.
*   **Secret Keys (Server-Side):** **MUST** be stored securely in the backend. Never include these in the mobile app.

### How to Store Backend Secrets (Firebase)

We use Google Cloud Secret Manager via Firebase Functions to store sensitive keys like `STRIPE_SECRET_KEY` and email passwords.

**1. Set a Secret:**
```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
# You will be prompted to enter the value
```

**2. Access in Code (Functions Only):**
```typescript
// In your function definition
export const myFunction = onCall({ secrets: ["STRIPE_SECRET_KEY"] }, async (request) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  // ...
});
```

**3. Check Used Secrets:**
To see which secrets are currently set for your project:
```bash
firebase functions:secrets:get SECRET_NAME # View metadata
# OR view in Google Cloud Console > Security > Secret Manager
```

### 🔑 Required API Keys Checklist

| Key Name | Type | Storage Location | Purpose |
|----------|------|------------------|---------|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Public | `.env` | App authentication |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Public | `.env` | Maps display on device |
| `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | Public | `.env` | Address autocomplete |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public | `.env` | Processing payments in app |
| `STRIPE_SECRET_KEY` | **SECRET** | Firebase Secrets | Charging cards (backend) |
| `STRIPE_WEBHOOK_SECRET` | **SECRET** | Firebase Secrets | Verifying Stripe events |
| `EMAIL_USER` | **SECRET** | Firebase Secrets | Sending emails |
| `EMAIL_PASSWORD` | **SECRET** | Firebase Secrets | Sending emails |
| `FIREBASE_PRIVATE_KEY` | **SECRET** | Admin Dashboard `.env` | Admin database access |

### Cloud Functions (Firebase Secrets)

Set using: `firebase functions:secrets:set SECRET_NAME`

| Secret | Purpose |
|--------|---------|
| `STRIPE_SECRET_KEY` | Stripe API access |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `EMAIL_USER` | Email sender address |
| `EMAIL_PASSWORD` | Email sender password |

### Admin Dashboard (.env.local)

| Variable | Purpose |
|----------|---------|
| `FIREBASE_PROJECT_ID` | Firebase connection |
| `FIREBASE_PRIVATE_KEY` | Service account key |
| `NEXTAUTH_SECRET` | Session encryption |

---

## 🔥 Firebase Configuration

### Firestore Security Rules

| What | File |
|------|------|
| **Database Rules** | `firestore.rules` |

### Firebase Functions

| What | File |
|------|------|
| **All Cloud Functions** | `functions/src/index.ts` |
| **Email Utilities** | `functions/src/utils/email.ts` |
| **Notification Utilities** | `functions/src/utils/notifications.ts` |
| **Identity Verification** | `functions/src/identity-verification.ts` |

---

## 🔧 Troubleshooting Guide

### Common Issues & Where to Look

| Issue | Files to Check |
|-------|----------------|
| **App won't start** | `.env` file, `config/firebase.ts` |
| **Payments failing** | `services/stripe.ts`, `functions/src/index.ts` |
| **Emails not sending** | Firebase Secrets (EMAIL_USER, EMAIL_PASSWORD) |
| **Maps not loading** | `.env` (GOOGLE_MAPS_API_KEY) |
| **Login issues** | `services/auth.ts`, Firebase Console |
| **Booking errors** | `store/rides-store.ts`, `functions/src/index.ts` |

### Logs & Debugging

| What | Where to Find |
|------|---------------|
| **App logs** | Metro bundler console or Expo Go |
| **Cloud Function logs** | Firebase Console → Functions → Logs |
| **Stripe webhooks** | Stripe Dashboard → Developers → Webhooks |
| **Firestore data** | Firebase Console → Firestore Database |

### Key Data Collections (Firestore)

| Collection | Purpose |
|------------|---------|
| `users` | User profiles and settings |
| `rides` | All ride listings |
| `bookings` | Booking records |
| `messages` | Chat messages |
| `safety_reports` | Safety incident reports |
| `emergency_contacts` | User emergency contacts |
| `notifications` | In-app notifications |

---

## 🚀 Deployment Checklist

### Before Deploying Changes

1. **Test locally first** - Run `npm run start:tunnel`
2. **Build functions** - `cd functions && npm run build`
3. **Deploy functions** - `firebase deploy --only functions`
4. **Check for TypeScript errors** - `npx tsc --noEmit`

### Key Commands

```bash
# Start mobile app
npm run start:tunnel

# Deploy Cloud Functions
cd functions && npm run build && firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:functionName

# Set Firebase secrets
firebase functions:secrets:set SECRET_NAME

# View function logs
firebase functions:log --only functionName
```

---

## 📁 Project Structure Quick Reference

```
CarpoolConnect1.0/
├── app/                    # Mobile app screens & navigation
│   ├── (tabs)/            # Main tab screens
│   ├── auth/              # Login/register screens
│   └── _layout.tsx        # Root layout & providers
├── components/            # Reusable UI components
├── constants/             # Colors, theme, constants
├── config/                # Firebase configuration
├── functions/             # Firebase Cloud Functions
│   └── src/
│       ├── index.ts       # All cloud functions
│       └── utils/         # Email, notifications helpers
├── services/              # API & business logic
├── store/                 # Zustand state management
├── utils/                 # Utility functions
├── webapp/                # Marketing website (Next.js)
├── admin-dashboard/       # Admin panel (Next.js)
├── .env                   # Environment variables
├── app.json               # Expo app configuration
└── firestore.rules        # Database security rules
```

---

> **Last Updated:** December 19, 2024

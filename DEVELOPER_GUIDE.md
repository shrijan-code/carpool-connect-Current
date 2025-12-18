# CarpoolConnect - Complete Developer Guide

> **Quick Reference** for running, testing, deploying, and configuring CarpoolConnect.
> Last updated: December 2024

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [First-Time Setup (New Machine)](#first-time-setup-new-machine)
3. [Running the Mobile App](#running-the-mobile-app)
4. [Running the Web App](#running-the-web-app)
5. [Running the Admin Dashboard](#running-the-admin-dashboard)
6. [Running Cloud Functions Locally](#running-cloud-functions-locally)
7. [Process Management (Ports & Tasks)](#process-management-ports--tasks)
8. [Environment Variables & API Keys](#environment-variables--api-keys)
9. [Testing](#testing)
10. [Firebase Deployment](#firebase-deployment)
11. [App Store & Play Store Publishing](#app-store--play-store-publishing)
12. [Troubleshooting](#troubleshooting)
13. [Useful Commands Cheat Sheet](#useful-commands-cheat-sheet)

---

## Quick Start

```bash
# Clone and setup
git clone https://github.com/shrijan-code/carpool-connect-Current.git
cd carpool-connect-Current
npm install

# Run mobile app (tunnel mode recommended)
npm run start:tunnel

# Run tests
npm test
```

---

## First-Time Setup (New Machine)

### 1. Prerequisites

Install these tools:

| Tool | Version | Installation |
|------|---------|--------------|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | Comes with Node.js |
| Git | Latest | https://git-scm.com |
| Expo CLI | Latest | `npm install -g expo-cli` |
| Firebase CLI | Latest | `npm install -g firebase-tools` |
| EAS CLI | Latest | `npm install -g eas-cli` |

### 2. Clone Repository

```bash
git clone https://github.com/shrijan-code/carpool-connect-Current.git
cd carpool-connect-Current
```

### 3. Install Dependencies

```bash
# Install mobile app dependencies
npm install

# Install Cloud Functions dependencies
cd functions
npm install
cd ..

# Install webapp dependencies (if exists)
cd webapp
npm install
cd ..

# Install admin dashboard dependencies (if exists)
cd admin
npm install
cd ..
```

### 4. Setup Environment Variables

Create `.env` file in the root directory (see [Environment Variables](#environment-variables--api-keys) section).

### 5. Login to Services

```bash
# Firebase login
firebase login

# Expo login (for builds)
eas login
```

---

## Running the Mobile App

### Regular Mode (LAN)

Best for local network testing. Your phone must be on the same WiFi as your computer.

```bash
npm start
# OR
npx expo start
```

### Tunnel Mode (Recommended)

Best for remote testing or when LAN doesn't work. Uses ngrok to create a public tunnel.

```bash
npm run start:tunnel
# OR
npx expo start --tunnel
```

### Other Start Options

```bash
# Clear cache and start
npm run dev:clear

# LAN mode explicitly
npm run dev:lan

# Web browser only
npm run start-web

# With fixed port and IP (for network issues)
npm run start:fix
```

### Connecting Your Phone

1. Install **Expo Go** app on your phone (App Store / Play Store)
2. Scan the QR code shown in terminal
3. App will load on your phone

---

## Running the Web App

### Marketing Website

```bash
cd webapp
npm run dev        # Development mode (http://localhost:3000)
npm run build      # Production build
npm run start      # Production server
```

### Web Version of Mobile App

```bash
npm run start-web
# Opens at http://localhost:8081
```

---

## Running the Admin Dashboard

```bash
cd admin
npm run dev        # Development mode (http://localhost:3001)
npm run build      # Production build
npm run start      # Production server
```

---

## Running Cloud Functions Locally

### Using Firebase Emulators

```bash
cd functions
npm run build                    # Compile TypeScript
firebase emulators:start         # Start all emulators
firebase emulators:start --only functions  # Functions only
```

Emulator UI available at: http://localhost:4000

### Just Build (No Run)

```bash
cd functions
npm run build
```

---

## Process Management (Ports & Tasks)

### Find What's Running on a Port

```powershell
# Windows PowerShell
netstat -ano | findstr :8081     # Find process on port 8081
Get-Process -Id <PID>            # Get process name from PID

# Or find all Node processes
Get-Process node
```

```bash
# Mac/Linux
lsof -i :8081                    # Find process on port 8081
```

### Kill a Process

```powershell
# Windows PowerShell
Stop-Process -Id <PID> -Force    # Kill by PID
Stop-Process -Name node -Force   # Kill all Node processes
taskkill /F /PID <PID>          # Alternative

# Kill process on specific port
$pid = (Get-NetTCPConnection -LocalPort 8081).OwningProcess
Stop-Process -Id $pid -Force
```

```bash
# Mac/Linux
kill -9 <PID>                    # Kill by PID
killall node                     # Kill all Node processes
```

### Common Ports

| Service | Port |
|---------|------|
| Expo (Metro) | 8081 |
| Expo DevTools | 19000 |
| Web App | 3000 |
| Admin Dashboard | 3001 |
| Firebase Emulator UI | 4000 |
| Firebase Functions Emulator | 5001 |
| Firebase Firestore Emulator | 8080 |

### Stop Running npm Commands

```
Ctrl + C                         # In terminal where command is running
```

---

## Environment Variables & API Keys

### Root `.env` File

Create a `.env` file in the project root:

```env
# Firebase Configuration (Client-side)
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

# Stripe (Client-side)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Google Maps
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...
```

### Cloud Functions Secrets

Set these using Firebase CLI:

```bash
# Set secrets
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set EMAIL_USER
firebase functions:secrets:set EMAIL_PASSWORD
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

# View secrets
firebase functions:secrets:access STRIPE_SECRET_KEY
```

### Where to Get API Keys

| Key | Source |
|-----|--------|
| Firebase | Firebase Console → Project Settings → General |
| Stripe Publishable | Stripe Dashboard → Developers → API Keys |
| Stripe Secret | Stripe Dashboard → Developers → API Keys |
| Google Maps | Google Cloud Console → APIs & Services → Credentials |

---

## Testing

### Run All Tests

```bash
npm test
```

### Watch Mode (Re-runs on Changes)

```bash
npm run test:watch
```

### With Coverage Report

```bash
npm run test:coverage
```

### Run Specific Test File

```bash
npm test -- --testPathPattern="booking"           # All booking tests
npm test -- --testPathPattern="booking-validation" # Specific file
```

### Run Single Test

```bash
npm test -- --testNamePattern="should allow cancelling"
```

### Test Location

All tests are in `__tests__/` directory:

```
__tests__/
├── setup.ts                          # Test configuration
├── services/
│   ├── auth.test.ts
│   ├── rides.test.ts
│   ├── rides-update.test.ts
│   └── stripe.test.ts
└── utils/
    ├── booking-validation.test.ts    # 42 tests
    └── booking-edge-cases.test.ts    # 31 tests
```

---

## Firebase Deployment

### Deploy Everything

```bash
firebase deploy
```

### Deploy Specific Services

```bash
# Cloud Functions only
firebase deploy --only functions

# Specific function
firebase deploy --only functions:createPendingBooking

# Firestore rules
firebase deploy --only firestore:rules

# Storage rules
firebase deploy --only storage

# Hosting (webapp/admin)
firebase deploy --only hosting
```

### Build & Deploy Functions (Full)

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

### View Logs

```bash
firebase functions:log                    # All logs
firebase functions:log --only createPendingBooking  # Specific function
```

---

## App Store & Play Store Publishing

### Prerequisites

1. **Apple Developer Account** ($99/year) for iOS
2. **Google Play Developer Account** ($25 one-time) for Android
3. **EAS Build** configured

### EAS Configuration

```bash
# Initialize EAS (first time only)
eas build:configure

# Login
eas login
```

### Build for App Store (iOS)

```bash
# Development build (for testing)
eas build --platform ios --profile development

# Preview build (TestFlight)
eas build --platform ios --profile preview

# Production build (App Store)
eas build --platform ios --profile production
```

### Build for Play Store (Android)

```bash
# Development build (APK)
eas build --platform android --profile development

# Preview build (Internal Testing)
eas build --platform android --profile preview

# Production build (Play Store AAB)
eas build --platform android --profile production
```

### Submit to Stores

```bash
# Submit iOS to App Store
eas submit --platform ios

# Submit Android to Play Store
eas submit --platform android
```

### OTA Updates (No Store Review)

```bash
# Update JavaScript bundle (instant updates)
eas update --branch production --message "Bug fix"
```

### app.json Configuration

Key fields to update before publishing:

```json
{
  "expo": {
    "name": "CarpoolConnect",
    "slug": "carpoolconnect",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.yourcompany.carpoolconnect",
      "buildNumber": "1"
    },
    "android": {
      "package": "com.yourcompany.carpoolconnect",
      "versionCode": 1
    }
  }
}
```

---

## Troubleshooting

### "Metro bundler failed to start"

```bash
# Clear cache and restart
npx expo start --clear

# Or kill all Node processes and restart
Stop-Process -Name node -Force
npm run start:tunnel
```

### "Port 8081 already in use"

```powershell
# Find and kill the process
$pid = (Get-NetTCPConnection -LocalPort 8081).OwningProcess
Stop-Process -Id $pid -Force
```

### "Firebase configuration not found"

1. Check `.env` file exists in root
2. Ensure all `EXPO_PUBLIC_FIREBASE_*` variables are set
3. Restart Metro bundler: `npx expo start --clear`

### "Tunnel not working"

```bash
# Install ngrok globally
npm install -g @expo/ngrok

# Restart with tunnel
npm run start:tunnel
```

### "Tests failing with module not found"

```bash
# Clear Jest cache
npx jest --clearCache
npm test
```

### "Functions deploy fails"

```bash
# Check TypeScript compilation first
cd functions
npm run build

# Check for errors in build output
# Then deploy
firebase deploy --only functions
```

### "EAS build fails"

```bash
# Check EAS configuration
eas build:configure

# View build logs
eas build:list
eas build:view <build-id>
```

---

## Useful Commands Cheat Sheet

### Development

| Command | Description |
|---------|-------------|
| `npm run start:tunnel` | Start app in tunnel mode |
| `npm run dev:clear` | Start with cleared cache |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |

### Firebase

| Command | Description |
|---------|-------------|
| `firebase login` | Login to Firebase |
| `firebase deploy --only functions` | Deploy functions |
| `firebase functions:log` | View function logs |
| `firebase emulators:start` | Start local emulators |

### EAS / Publishing

| Command | Description |
|---------|-------------|
| `eas login` | Login to Expo |
| `eas build -p ios` | Build for iOS |
| `eas build -p android` | Build for Android |
| `eas submit -p ios` | Submit to App Store |
| `eas submit -p android` | Submit to Play Store |

### Process Management (Windows PowerShell)

| Command | Description |
|---------|-------------|
| `netstat -ano \| findstr :8081` | Find process on port |
| `Stop-Process -Id <PID> -Force` | Kill process by ID |
| `Stop-Process -Name node -Force` | Kill all Node processes |
| `Get-Process node` | List all Node processes |

### Git

| Command | Description |
|---------|-------------|
| `git pull` | Get latest changes |
| `git add -A` | Stage all changes |
| `git commit -m "message"` | Commit changes |
| `git push origin main` | Push to GitHub |

---

## Project Structure

```
CarpoolConnect1.0/
├── app/                    # Expo Router pages
├── src/                    # React components & screens
├── services/               # API services (Firebase, Stripe)
├── store/                  # Zustand state management
├── utils/                  # Utility functions
├── __tests__/              # Unit tests
├── functions/              # Firebase Cloud Functions
│   ├── src/
│   │   └── index.ts        # All Cloud Functions
│   └── package.json
├── webapp/                 # Marketing website
├── admin/                  # Admin dashboard
├── .env                    # Environment variables (create this!)
├── app.json                # Expo configuration
├── firebase.json           # Firebase configuration
├── eas.json                # EAS Build configuration
└── package.json            # Main dependencies
```

---

## Need Help?

1. Check this guide first
2. Review the [Troubleshooting](#troubleshooting) section
3. Check Firebase Console logs: https://console.firebase.google.com
4. Check Expo build logs: `eas build:list`

# 📱 App Store & Play Store Publishing Guide

> **Complete step-by-step guide to publish CarpoolConnect to iOS App Store and Google Play Store**

---

## 📋 Table of Contents

1. [Prerequisites](#-1-prerequisites)
2. [EAS Configuration](#-2-eas-configuration)
3. [App.json Configuration](#-3-appjson-configuration)
4. [Building for Production](#-4-building-for-production)
5. [App Store Submission (iOS)](#-5-app-store-submission-ios)
6. [Play Store Submission (Android)](#-6-play-store-submission-android)
7. [Post-Launch Updates](#-7-post-launch-updates)
8. [Troubleshooting](#-8-troubleshooting)

---

## 🎯 1. Prerequisites

### A. Developer Accounts

| Platform | Cost | Sign Up |
|----------|------|---------|
| **Apple Developer Program** | $99/year | [developer.apple.com](https://developer.apple.com/programs/) |
| **Google Play Console** | $25 (one-time) | [play.google.com/console](https://play.google.com/console) |
| **Expo Account** | Free | [expo.dev](https://expo.dev) |

### B. Required Tools

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to your Expo account
eas login

# Verify login
eas whoami
```

### C. App Store Requirements Checklist

| Requirement | Status | Notes |
|-------------|--------|-------|
| App Icon (1024x1024) | ✅ | `assets/images/icon.png` |
| Adaptive Icon (Android) | ✅ | `assets/images/adaptive-icon.png` |
| Splash Screen | ✅ | `assets/images/splash-icon.png` |
| Privacy Policy URL | ❌ | Need to create at `yoursite.com/privacy` |
| Support URL | ❌ | Need to create at `yoursite.com/support` |
| App Screenshots | ❌ | Multiple sizes needed (see below) |
| Account Deletion | ✅ | Already in Profile Settings |
| Test Account | ❌ | Create for Apple reviewer |

---

## 🔧 2. EAS Configuration

### A. Create `eas.json`

Create this file in your project root:

```json
{
  "cli": {
    "version": ">= 5.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_test_xxxxx",
        "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY": "your_dev_key"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_test_xxxxx",
        "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY": "your_staging_key"
      }
    },
    "production": {
      "distribution": "store",
      "ios": {
        "resourceClass": "m1-medium"
      },
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY": "pk_live_xxxxx",
        "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY": "your_production_key",
        "EXPO_PUBLIC_FIREBASE_API_KEY": "your_firebase_api_key",
        "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN": "carpoolconnect1-0.firebaseapp.com",
        "EXPO_PUBLIC_FIREBASE_PROJECT_ID": "carpoolconnect1-0",
        "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET": "carpoolconnect1-0.firebasestorage.app",
        "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID": "your_sender_id",
        "EXPO_PUBLIC_FIREBASE_APP_ID": "your_app_id"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "your-app-store-connect-app-id",
        "appleTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### B. Build Profiles Explained

| Profile | Purpose | Output |
|---------|---------|--------|
| `development` | For local testing with dev client | `.apk` / Simulator |
| `preview` | For internal testers (QA team) | `.apk` / TestFlight |
| `production` | For app store submission | `.aab` / `.ipa` |

---

## 📝 3. App.json Configuration

### A. Required Updates to `app.json`

Your current `app.json` needs these updates for production:

```diff
{
  "expo": {
-   "name": "CarpoolConnect Ridesharing App",
+   "name": "CarpoolConnect",
    "slug": "carpoolconnect-ridesharing-app",
    "version": "1.0.0",
+   "runtimeVersion": {
+     "policy": "appVersion"
+   },
+   "updates": {
+     "url": "https://u.expo.dev/YOUR_PROJECT_ID"
+   },
    "ios": {
      "supportsTablet": true,
-     "bundleIdentifier": "app.rork.carpoolconnect-ridesharing-app",
+     "bundleIdentifier": "com.yourcompany.carpoolconnect",
+     "buildNumber": "1",
      "config": {
        "googleMapsApiKey": "YOUR_IOS_MAPS_KEY"
      }
    },
    "android": {
-     "package": "app.rork.carpoolconnect-ridesharing-app",
+     "package": "com.yourcompany.carpoolconnect",
+     "versionCode": 1,
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_ANDROID_MAPS_KEY"
        }
      }
    },
    "plugins": [
      ["@stripe/stripe-react-native", {
-       "merchantIdentifier": "string | string[]",
+       "merchantIdentifier": "merchant.com.yourcompany.carpoolconnect",
-       "enableGooglePay": "boolean"
+       "enableGooglePay": true
      }]
    ]
  }
}
```

### B. Bundle Identifier Guidelines

> [!IMPORTANT]
> **Once you publish to stores, you CANNOT change the bundle identifier!**

**Format:** `com.companyname.appname`

| Platform | Current | Recommended |
|----------|---------|-------------|
| iOS | `app.rork.carpoolconnect-ridesharing-app` | `com.yourcompany.carpoolconnect` |
| Android | `app.rork.carpoolconnect-ridesharing-app` | `com.yourcompany.carpoolconnect` |

### C. Version Management

```json
{
  "expo": {
    "version": "1.0.0",      // User-visible version (e.g., "1.2.3")
    "ios": {
      "buildNumber": "1"     // Increment for EVERY iOS build
    },
    "android": {
      "versionCode": 1       // Increment for EVERY Android build
    }
  }
}
```

**Versioning Rules:**
- `version`: Update when releasing new features (1.0.0 → 1.1.0)
- `buildNumber` / `versionCode`: Increment for EVERY store submission

---

## 🏗️ 4. Building for Production

### A. Initialize EAS for Your Project

```bash
# Run from project root
eas build:configure
```

This will:
1. Create `eas.json` if missing
2. Link your project to Expo servers
3. Set up build configuration

### B. Build for Android (Play Store)

```bash
# Production build (AAB format for Play Store)
eas build --platform android --profile production

# Wait for build to complete (can take 10-30 mins)
# You'll get a download link when done
```

### C. Build for iOS (App Store)

```bash
# Production build
eas build --platform ios --profile production
```

> [!NOTE]
> **First iOS build requires:**
> - Apple Developer account credentials
> - Provisioning profile setup (EAS handles this automatically)
> - Distribution certificate (EAS can create one for you)

### D. Build Both Platforms

```bash
eas build --platform all --profile production
```

---

## 🍎 5. App Store Submission (iOS)

### A. Apple Developer Setup

1. **Log in to [App Store Connect](https://appstoreconnect.apple.com)**
2. **Create New App:**
   - Click `+` → "New App"
   - Platform: iOS
   - Name: CarpoolConnect
   - Primary Language: English
   - Bundle ID: Select from dropdown (must match `app.json`)
   - SKU: `carpoolconnect-ios-1`

### B. App Information Required

| Field | Value |
|-------|-------|
| **Name** | CarpoolConnect |
| **Subtitle** | Ridesharing Made Easy |
| **Category** | Travel |
| **Content Rating** | 4+ |
| **Privacy Policy URL** | `https://yoursite.com/privacy` |
| **Support URL** | `https://yoursite.com/support` |

### C. Screenshots Required

| Device | Size | Quantity |
|--------|------|----------|
| iPhone 6.7" | 1290 x 2796 | 3-10 |
| iPhone 6.5" | 1284 x 2778 | 3-10 |
| iPhone 5.5" | 1242 x 2208 | 3-10 |
| iPad Pro 12.9" | 2048 x 2732 | 3-10 (if supporting tablets) |

**Tools to create screenshots:**
- [Shotbot](https://shotbot.io/) - AI-powered
- [AppMockUp](https://app-mockup.com/) - Free
- Figma templates

### D. Submit via EAS

```bash
# Submit the latest build to App Store Connect
eas submit --platform ios --profile production
```

**Or manually:**
1. Download `.ipa` from EAS dashboard
2. Open **Transporter** app (macOS)
3. Upload `.ipa` to App Store Connect

### E. Apple Review Notes

Create a test account for Apple reviewers:
```
Email: apple-reviewer@yourcompany.com
Password: SecureTestPass123!
```

Add notes:
> "This is a carpooling app. To test the full flow:
> 1. Log in with provided credentials
> 2. Search for rides using any location
> 3. Book a test ride (no real charges)
> 
> Payment testing uses Stripe test mode."

---

## 🤖 6. Play Store Submission (Android)

### A. Google Play Console Setup

1. **Log in to [Google Play Console](https://play.google.com/console)**
2. **Create New App:**
   - App name: CarpoolConnect
   - Default language: English
   - App or game: App
   - Free or paid: Free

### B. Service Account for Automated Submission

1. Go to **Google Cloud Console** → **IAM & Admin** → **Service Accounts**
2. Create service account with name `eas-submit`
3. Grant role: **Service Account User**
4. Create JSON key and download
5. Save as `google-play-service-account.json` in project root
6. In Play Console: **Setup** → **API access** → Link the service account

> [!CAUTION]
> **Add `google-play-service-account.json` to `.gitignore`!**

### C. Store Listing Requirements

| Section | Details |
|---------|---------|
| **Short Description** | Max 80 chars: "Share rides, save money, reduce traffic" |
| **Full Description** | Max 4000 chars: Feature highlights, benefits |
| **Screenshots** | Phone: 2-8 screenshots, 7" tablet, 10" tablet |
| **Feature Graphic** | 1024 x 500 px (required) |
| **App Icon** | 512 x 512 px |
| **Privacy Policy** | Required URL |

### D. Content Rating Questionnaire

1. Go to **Policy** → **App content** → **Content ratings**
2. Complete IARC questionnaire
3. Answer truthfully about:
   - Violence: None
   - Sexuality: None
   - User-generated content: Yes (chat)
   - Location sharing: Yes

### E. Submit via EAS

```bash
# Submit to internal testing track
eas submit --platform android --profile production
```

### F. Release Tracks

| Track | Purpose | Review Time |
|-------|---------|-------------|
| **Internal** | Team testing (max 100 users) | Instant |
| **Closed** | Beta testers with link | ~Hours |
| **Open** | Public beta | ~Days |
| **Production** | Live on store | 1-7 days |

**Promotion flow:**
```
Internal → Closed → Open → Production
```

---

## 🔄 7. Post-Launch Updates

### A. Over-the-Air (OTA) Updates

For JavaScript-only changes (no native code):

```bash
# Push instant update to users
eas update --branch production --message "Bug fixes"
```

Users get the update on next app launch—no store review needed!

### B. Native Code Updates

When you change native modules, permissions, or `app.json`:

```bash
# Increment version numbers in app.json first!
# Then build and submit
eas build --platform all --profile production
eas submit --platform all --profile production
```

### C. Version Bump Checklist

```json
// Before each store submission, update:
{
  "expo": {
    "version": "1.1.0",        // If new features
    "ios": {
      "buildNumber": "2"       // Always increment
    },
    "android": {
      "versionCode": 2         // Always increment
    }
  }
}
```

---

## 🔧 8. Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **"Bundle ID not found"** | Create App ID in Apple Developer Portal first |
| **Build fails on iOS** | Check provisioning profiles: `eas credentials` |
| **Android AAB rejected** | Ensure `versionCode` is higher than previous |
| **"Missing privacy policy"** | Add URL to both app.json and store listing |
| **Stripe not working** | Add production keys to `eas.json` env |

### Useful Commands

```bash
# Check credentials
eas credentials

# View build status
eas build:list

# Cancel a running build
eas build:cancel

# View submitted apps
eas submit:list

# Diagnose project issues
npx expo-doctor
```

### Debug Build Failures

1. Check EAS build logs in dashboard
2. Look for specific error messages
3. Common fixes:
   - Clear cache: `npx expo start --clear`
   - Update dependencies: `npx expo install --check`
   - Fix native issues: `npx expo prebuild --clean`

---

## 📊 Quick Reference Card

### Build & Submit Commands

```bash
# Development (for testing)
eas build --platform all --profile development

# Preview (for QA/beta testers)
eas build --platform all --profile preview

# Production (for stores)
eas build --platform all --profile production

# Submit to stores
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

### Environment Variables for Production

Ensure these are set in `eas.json` under `production.env`:

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **Live** Stripe key (pk_live_xxx) |
| `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` | Production Maps API key |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | `carpoolconnect1-0` |

---

## ✅ Pre-Submission Checklist

### Before First Submission

- [ ] Apple Developer account active ($99/year paid)
- [ ] Google Play Console account active ($25 paid)
- [ ] EAS CLI installed and logged in
- [ ] `eas.json` created with production profile
- [ ] Bundle identifiers finalized in `app.json`
- [ ] Production API keys set in `eas.json`
- [ ] Privacy policy page live
- [ ] Support contact page live
- [ ] Test account created for Apple reviewer
- [ ] App screenshots prepared (all sizes)
- [ ] Feature graphic created (1024x500)
- [ ] Production Stripe key configured

### Before Each Update

- [ ] Version number incremented (`version`)
- [ ] Build number incremented (`buildNumber` / `versionCode`)
- [ ] Tested on both iOS and Android devices
- [ ] All new features documented in release notes
- [ ] Production environment variables verified

---

> **Need Help?**
> - [Expo EAS Documentation](https://docs.expo.dev/eas/)
> - [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
> - [Google Play Console Help](https://support.google.com/googleplay/android-developer/)

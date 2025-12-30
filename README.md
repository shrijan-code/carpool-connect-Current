# 🚗 CarpoolConnect

A full-stack ridesharing and delivery platform built with React Native (Expo), Next.js, and Firebase.

---

## 📁 Project Structure

```
CarpoolConnect/
├── app/                    # Mobile app (Expo Router)
├── admin-dashboard/        # Admin panel (Next.js) - Port 3001
├── webapp/                 # Marketing website (Next.js) - Port 3002
├── functions/              # Firebase Cloud Functions
└── services/               # Shared business logic
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Expo CLI (`npm install -g @expo/cli`)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your Firebase, Google, and Stripe keys

# 3. Start the mobile app
npx expo start

# 4. Start admin dashboard (in a new terminal)
cd admin-dashboard && npm run dev

# 5. Start webapp (in a new terminal)
cd webapp && npm run dev
```

---

## 🔧 Development Servers

| Project | Command | URL |
|---------|---------|-----|
| Mobile App | `npx expo start` | Expo Go / Simulator |
| Admin Dashboard | `cd admin-dashboard && npm run dev` | http://localhost:3001 |
| Webapp | `cd webapp && npm run dev` | http://localhost:3002 |

---

## ✨ Features

### Mobile App
- 🚗 Create & book rides
- 📦 Delivery marketplace
- 💳 Stripe payments
- 📍 Real-time tracking
- 🛡️ Safety features (emergency contacts, reports)
- ⭐ Driver/passenger ratings

### Admin Dashboard
- 👥 User management
- 🚗 Ride monitoring
- 📊 Analytics & reports
- 🔐 Role-based access (Global Admin, Editor, Viewer)
- 🔒 MFA authentication (Email OTP + TOTP)

### Webapp
- 📱 Marketing landing page
- 📝 Feature showcase
- 📧 Contact forms

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Firebase
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=

# Google Maps & Places
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=

# Stripe
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
```

---

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm test -- --coverage
```

---

## 🏗️ Build

### Mobile App
```bash
npx expo build:ios
npx expo build:android
```

### Admin Dashboard & Webapp
```bash
cd admin-dashboard && npm run build
cd webapp && npm run build
```

---

## 📧 Email Configuration (Microsoft 365)

CarpoolConnect uses Microsoft 365 SMTP for sending emails (booking confirmations, safety reports, etc).

### Setup Steps

1. **Create an App Password** (if MFA is enabled):
   - Go to [Microsoft Security Settings](https://account.microsoft.com/security)
   - Select "App passwords" → Generate new password
   - Copy the 16-character password

2. **Enable SMTP AUTH** in Microsoft 365 Admin:
   - Admin Center → Settings → Org Settings
   - Enable "Authenticated SMTP" for the sending mailbox

3. **Set Environment Variables** in Firebase:
   ```bash
   firebase functions:secrets:set EMAIL_USER
   # Enter: noreply@yourdomain.com
   
   firebase functions:secrets:set EMAIL_PASSWORD  
   # Enter: your-app-password (16 chars, no spaces)
   ```

4. **Test Email Delivery**:
   ```javascript
   // In your app, call the testEmailConnection function:
   const result = await httpsCallable(functions, 'testEmailConnection')({ 
     email: 'your-test-email@example.com' 
   });
   console.log(result.data);
   // Check Firebase Console → Functions → Logs for details
   ```

### SMTP Configuration (Reference)
| Setting | Value |
|---------|-------|
| Host | `smtp.office365.com` |
| Port | `587` |
| Security | STARTTLS |
| Auth | Required |

---

## � Firebase CLI Commands Reference

### Deployment

```bash
# Deploy all Cloud Functions
cd functions
firebase deploy --only functions

# Deploy a specific function
firebase deploy --only functions:onRideCreated

# Rebuild before deploying (recommended after code changes)
cd functions
npm run build
firebase deploy --only functions
```

### Viewing Logs

```bash
# View last N log entries (replace N with a number)
firebase functions:log -n 10     # Shows last 10 entries
firebase functions:log -n 50     # Shows last 50 entries

# Follow logs in real-time (live streaming)
firebase functions:log --follow

# Filter logs by specific function
firebase functions:log --only onRideCreated -n 20

# Common patterns to search for
firebase functions:log -n 30 | Select-String "Error"     # Find errors (PowerShell)
firebase functions:log -n 30 | grep "Error"              # Find errors (Linux/Mac)
firebase functions:log -n 30 | Select-String "Email sent" # Find successful emails
```

| Flag | Description | Example |
|------|-------------|---------|
| `-n <number>` | Number of log entries to show | `-n 20` shows last 20 logs |
| `--follow` | Stream logs in real-time | Live debugging |
| `--only <function>` | Filter by function name | `--only onSafetyReportCreated` |

### Managing Secrets

```bash
# Set a secret (prompts for value securely)
firebase functions:secrets:set EMAIL_PASSWORD

# View a secret value
firebase functions:secrets:access EMAIL_USER

# List all secrets
firebase functions:secrets:list

# Delete a secret
firebase functions:secrets:destroy OLD_SECRET_NAME
```

### Debugging & Testing

```bash
# Run functions locally (emulator)
cd functions
npm run serve

# Check function deployment status
firebase functions:list

# View function details in browser
firebase open functions

# Test a callable function
# Use Firebase Console → Functions → Test tab
```

### Common Troubleshooting Commands

```bash
# Clear cache and rebuild
cd functions
Remove-Item -Recurse -Force lib      # PowerShell
rm -rf lib                            # Linux/Mac
npm run build

# Check for TypeScript errors
cd functions
npm run build

# View recent errors only
firebase functions:log -n 50 | Select-String "Error|Failed|535"
```

---

## 📦 Quick Deploy Checklist

```bash
# 1. Make code changes
# 2. Build TypeScript
cd functions && npm run build

# 3. Deploy
firebase deploy --only functions

# 4. Verify deployment
firebase functions:log -n 10
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile | React Native + Expo |
| Web | Next.js 14 |
| Backend | Firebase (Firestore, Auth, Functions) |
| Payments | Stripe Connect |
| Maps | Google Maps API |
| Styling | TailwindCSS (web), React Native StyleSheet |

---

## 📄 License

MIT License

---

**Last Updated:** December 30, 2025
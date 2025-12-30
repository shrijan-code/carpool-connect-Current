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

## 📦 Deploy Firebase Functions

```bash
cd functions
npm install
firebase deploy --only functions
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
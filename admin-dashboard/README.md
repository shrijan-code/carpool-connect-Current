# CarpoolConnect Admin Dashboard

A comprehensive Next.js admin dashboard for managing the CarpoolConnect platform with safety reports, user management, ride management, and analytics.

## 🚀 Features

- **Authentication**: Secure admin login with JWT sessions
- **Safety Reports**: View, manage, and respond to user safety reports with emergency contact information
- **User Management**: Search, view, and manage all platform users
- **Ride Management**: Monitor and manage all rides
- **Analytics**: Dashboard with key metrics and statistics
- **Role-Based Access Control**: Support for multiple admin roles

## 📋 Prerequisites

- Node.js 18+ and npm
- Firebase project with Firestore enabled
- Firebase Admin SDK service account credentials

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
cd admin-dashboard
npm install
```

### 2. Set Up Environment Variables

Create `.env.local` file in the root directory:

```bash
# Copy the example file
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your Firebase credentials:

```env
FIREBASE_PROJECT_ID=carpoolconnect1-0
FIREBASE_CLIENT_EMAIL=your-service-account@carpoolconnect1-0.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"

NEXTAUTH_SECRET=your-random-secret-key-here
NEXTAUTH_URL=http://localhost:3001

SAFETY_REPORT_EMAIL=shrijan.bhandari1318@gmail.com
```

**Getting Firebase Credentials:**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (carpoolconnect1-0)
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Copy the values from the downloaded JSON into .env.local

**Generate NEXTAUTH_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Set Up Firestore Admin Collection

You need to create at least one admin user in Firestore. You can do this manually in Firebase Console:

1. Go to Firestore Database
2. Create collection `admins`
3. Add a document with auto-ID:
   ```json
   {
     "email": "admin@carpoolconnect.com",
     "name": "Admin User",
     "role": "super_admin",
     "active": true,
     "password": "admin123",
     "createdAt": "2025-12-10T00:00:00.000Z"
   }
   ```

**Note:** The system will automatically hash the password on first login! Plain text passwords are automatically upgraded to bcrypt-hashed passwords for security.

### 4. Run Development Server

```bash
npm run dev
```

The admin dashboard will be available at **http://localhost:3001**

Default login credentials:
- Email: (whatever you set in Firestore)
- Password: `admin123`

## 📦 Project Structure

```
admin-dashboard/
├── app/
│   ├── (auth)/
│   │   └── login/              # Login page
│   ├── (dashboard)/
│   │   ├── dashboard/          # Main dashboard
│   │   ├── safety-reports/     # Safety reports management
│   │   ├── users/              # User management
│   │   ├── rides/              # Rides management
│   │   ├── analytics/          # Analytics dashboard
│   │   └── settings/           # Settings
│   ├── api/
│   │   ├── auth/               # Authentication APIs
│   │   ├── safety-reports/     # Safety report APIs
│   │   ├── users/              # User APIs
│   │   ├── rides/              # Ride APIs
│   │   └── dashboard/          # Dashboard stats APIs
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Sidebar.tsx             # Navigation sidebar
│   └── Header.tsx              # Page header
├── lib/
│   ├── firebase-admin.ts       # Firebase Admin SDK config
│   ├── auth.ts                 # Authentication utilities
│   └── utils.ts                # Helper functions
├── types/
│   └── index.ts                # TypeScript definitions
├── .env.local.example
├── package.json
├── next.config.js
└── tailwind.config.ts
```

## 🚢 Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-repo-url
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [Vercel](https://vercel.com)
2. Import your GitHub repository
3. Configure environment variables (same as .env.local)
4. Deploy!

**Important:** Make sure to set all environment variables in Vercel:
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY (wrap in quotes)
- NEXTAUTH_SECRET
- NEXTAUTH_URL (update to your production URL)

## 🔐 Security Notes

1. **Admin Passwords**: ✅ **SECURE** - Passwords are now hashed with bcrypt!
   - Plain text passwords automatically upgraded on first login
   - All new passwords stored as bcrypt hashes
   - Use `hashPassword()` function when creating new admins

2. **Session Security**: JWT sessions are configured with:
   - HttpOnly cookies
   - 24-hour expiration
   - Secure flag in production

3. **API Protection**: All API routes check for valid admin session

4. **Firestore Rules**: No additional rules needed - admin API uses Firebase Admin SDK with elevated permissions

## 📊 Features Overview

### Safety Reports Management
- View all safety reports with filtering by status and severity
- Detailed report view with:
  - Full report information
  - Reporter details
  - Emergency contact information
  - Evidence photos
  - Status management
  - Internal notes system

### User Management
- Search users by name, email, or phone
- View user profiles with:
  - User information
  - Ride history
  - Booking history
  - Emergency contacts
- Suspend/ban users (super_admin only)

### Ride Management
- View all rides with status filtering
- Monitor active rides
- View ride details and bookings

### Dashboard Analytics
- Total users
- Total rides
- Active rides count
- Pending safety reports
- Total revenue
- User growth (last 30 days)

## 🆘 Troubleshooting

### Cannot connect to Firebase
- Check FIREBASE_PROJECT_ID matches your project
- Verify FIREBASE_PRIVATE_KEY is correctly formatted (with \n for newlines)
- Ensure service account has proper permissions

### Login not working
- Verify admin exists in Firestore `admins` collection
- Check email and password match
- Check browser console for errors

### API Routes returning 500
- Check server logs in terminal
- Verify Firebase Admin SDK is properly initialized
- Check Firestore rules allow admin access

## 📝 TODO / Future Enhancements

- [ ] User detail page with full profile
- [ ] Email sending from dashboard
- [ ] Advanced analytics with charts (Recharts)
- [ ] Canned responses for safety reports
- [ ] Broadcast notifications
- [ ] Admin activity logs
- [ ] Export data to CSV
- [ ] Real-time updates with WebSockets

## 👥 Admin Roles

- **super_admin**: Full access including user suspension, admin management
- **support_admin**: View and manage reports, limited user management

## 🔗 Related Projects

- Main App: `../` (React Native CarpoolConnect app)
- Cloud Functions: `../functions` (Firebase functions)

---

**Built with Next.js 14, TypeScript, Tailwind CSS, and Firebase**

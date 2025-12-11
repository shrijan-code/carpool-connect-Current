# CarpoolConnect - Delivery & Rideshare App

A comprehensive React Native app built with Expo that combines carpooling and delivery services with advanced safety features.

## Features

### 🚗 Ridesharing
- Create and join carpool rides
- Real-time ride matching
- Route optimization
- Driver and passenger ratings

### 📦 Delivery Marketplace
- Post delivery requests
- Driver acceptance system
- Real-time tracking
- Proof of pickup/delivery
- Custom pricing options

### 🛡️ Safety Features
- Emergency contacts management
- Safety report system with photo evidence
- Real-time location sharing
- Emergency alert system
- Direct emergency services calling

### 💳 Payment Integration
- Stripe Connect for secure payments
- Escrow system for deliveries
- Automatic payout processing
- Fee calculation and breakdown

## Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (Mac) or Android Emulator
- Firebase project
- Stripe account (for payments)
- Google Cloud Platform account (for Maps/Places API)

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd carpoolconnect
   npm install
   ```

2. **Environment Setup:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your actual API keys:
   - Firebase configuration
   - Google Places API key
   - Stripe keys

3. **Firebase Setup:**
   - Create a Firebase project
   - Enable Authentication, Firestore, Storage, and Functions
   - Deploy the Cloud Functions from `/functions` directory
   - Update Firestore security rules

4. **Start the development server:**
   ```bash
   npx expo start
   ```

## Configuration

### Firebase Functions
The app requires Firebase Cloud Functions for:
- Delivery API endpoints
- Safety report processing
- Emergency contact management
- Payment processing

Deploy functions:
```bash
cd functions
npm install
firebase deploy --only functions
```

### API Keys Required

1. **Google Places API** - For address autocomplete
   - Enable Places API in Google Cloud Console
   - Add key to `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`

2. **Stripe** - For payment processing
   - Get publishable and secret keys from Stripe Dashboard
   - Add to `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY`

3. **Firebase** - For backend services
   - Get configuration from Firebase Console
   - Add all Firebase config values to `.env`

## Architecture

### Frontend (React Native + Expo)
- **State Management**: Custom context hooks with `@nkzw/create-context-hook`
- **Navigation**: Expo Router (file-based routing)
- **Styling**: React Native StyleSheet
- **Icons**: Lucide React Native
- **Maps**: Google Maps integration
- **Payments**: Stripe React Native SDK

### Backend (Firebase)
- **Database**: Firestore
- **Authentication**: Firebase Auth
- **Storage**: Firebase Storage
- **Functions**: Node.js Cloud Functions
- **Security**: Firestore Security Rules

### Key Components

#### Delivery System
- `DeliveryService` - API integration
- `DeliveryProvider` - State management
- `PlacesAutocomplete` - Address search with debouncing
- `DeliveryMarketplace` - Create/browse deliveries

#### Safety Features
- `SafetyReportComponent` - Report safety issues
- `EmergencyContactComponent` - Manage emergency contacts
- Automatic email notifications for critical reports
- Integration with device calling capabilities

#### Payment Processing
- Stripe Connect integration
- Escrow system for deliveries
- Automatic fee calculation
- Payout processing

## Error Handling & Offline Support

### Network Resilience
- Automatic fallback to demo data when backend is unavailable
- Request timeouts and retry logic
- User-friendly error messages
- Offline state indicators

### Demo Mode
When Firebase Functions are unavailable, the app automatically switches to demo mode with:
- Mock delivery data
- Simulated API responses
- Local state management
- Clear offline indicators

## Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
# iOS
npx expo build:ios

# Android
npx expo build:android
```

### Code Structure
```
app/                 # Expo Router pages
├── (tabs)/         # Tab navigation
├── _layout.tsx     # Root layout
└── index.tsx       # Landing page

components/         # Reusable UI components
services/          # API services
store/             # State management
types/             # TypeScript definitions
functions/         # Firebase Cloud Functions
```

## Troubleshooting

### Common Issues

1. **"Failed to fetch" errors**
   - Check Firebase Functions deployment
   - Verify CORS settings
   - Ensure proper environment variables

2. **Places autocomplete not working**
   - Verify Google Places API key
   - Check API key restrictions
   - Ensure Places API is enabled

3. **Payment issues**
   - Verify Stripe keys are correct
   - Check Stripe webhook configuration
   - Ensure test mode is properly configured

### Debug Mode
Enable detailed logging by setting `DEV_MODE=true` in `.env`

## Security

- All API keys are properly configured for client/server separation
- Firestore security rules prevent unauthorized access
- Payment processing uses Stripe's secure infrastructure
- Emergency features include safeguards against false reports

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the troubleshooting section above
- Review Firebase and Stripe documentation
- Open an issue in the repository

---

**Note**: This app is designed for demonstration purposes. For production use, ensure proper security audits, compliance with local regulations, and thorough testing of all safety features.
# CarryMate

**Carry more. Share the journey.**

CarryMate is a peer-to-peer intercity parcel delivery web app for the Australian Nepalese and South Asian diaspora. Travellers earn money carrying small parcels between cities; senders get affordable, trusted delivery with escrow payments and legal declarations.

**Launch routes:** Canberra ↔ Sydney ↔ Melbourne

---

## Features

- Phone OTP and email/password authentication (Firebase)
- Post and browse trips with real-time Firestore updates
- Booking flow with item photos, weight-based pricing, and slot locking
- Legally binding prohibited items declaration (IP + user agent recorded)
- Stripe Connect escrow payments (manual capture until delivery confirmed)
- In-app chat per booking
- Police stop emergency PDF for travellers
- Ratings and reviews after delivery
- Admin dashboard (bookings, users, trips, incidents)
- Transactional emails via Resend

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Auth | Firebase Auth |
| Database | Firestore |
| Storage | Google Cloud Storage |
| Payments | Stripe Connect |
| Email | Resend |
| PDF | @react-pdf/renderer |
| Deploy | Vercel |

---

## Prerequisites

- **Node.js 18+**
- **npm**
- A [Firebase](https://console.firebase.google.com) project
- A [Stripe](https://dashboard.stripe.com) account (Connect enabled)
- A [Resend](https://resend.com) account (optional for local dev)
- A Google Cloud Storage bucket (optional — mock upload URLs work without GCS in dev)

---

## Quick Start

```bash
git clone https://github.com/shrijan-code/Carrymate.git
cd Carrymate
npm install
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials (see [SETUP.md](./SETUP.md) for step-by-step instructions).

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in every value.

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase client SDK config |
| `FIREBASE_ADMIN_*` | Firebase Admin service account |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Resend API key |
| `NEXT_PUBLIC_APP_URL` | App URL (e.g. `http://localhost:3000`) |
| `ADMIN_EMAIL` | Admin login email |
| `ADMIN_PASSWORD_HASH` | bcrypt hash of admin password |
| `ADMIN_JWT_SECRET` | Random string for admin JWT signing |
| `GCS_*` | Google Cloud Storage credentials (optional) |
| `EMERGENCY_EMAIL` / `EMERGENCY_PHONE` | Shown on emergency PDF |

Generate an admin password hash:

```bash
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## Deploying

### Vercel (recommended)

1. Import the repo in [Vercel](https://vercel.com)
2. Set root directory to project root
3. Add all environment variables from `.env.local.example`
4. Deploy

### Firestore security rules

```bash
# From project root — requires Firebase CLI and firebase.json
firebase deploy --only firestore:rules
```

Rules file: [`firestore.rules`](./firestore.rules)

### Stripe webhook

Point your Stripe webhook to:

```
https://your-domain.com/api/stripe/webhook
```

Events to listen for: `payment_intent.payment_failed`, `payment_intent.succeeded`, `payment_intent.amount_capturable_updated`, `account.updated`

---

## Project Structure

```
app/
├── (auth)/           Login, register, onboarding
├── (main)/           Home, trips, bookings, profile, emergency
├── (stripe)/         Stripe Connect onboarding
├── admin/            Admin dashboard
└── api/              Server routes (Stripe, bookings, upload, PDF)

components/           UI, declaration, payment, chat, ratings
lib/                  Firebase, Stripe, auth, email, validations
types/                TypeScript interfaces
firestore.rules       Firestore security rules
```

---

## User Flows

1. **Traveller:** Register → complete Stripe Connect → post a trip → accept bookings → confirm pickup → confirm delivery → get paid
2. **Sender:** Browse trips → request booking with item photo → sign declaration → pay via escrow → chat to coordinate pickup → rate after delivery
3. **Admin:** Login at `/admin/login` → monitor bookings, users, and incidents

---

## Admin Access

1. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and `ADMIN_JWT_SECRET` in `.env.local`
2. Visit `/admin/login`
3. Session expires after 8 hours

---

## Documentation

- **[SETUP.md](./SETUP.md)** — Detailed Firebase, Stripe, and GCS configuration
- **[.env.local.example](./.env.local.example)** — All required environment variables

---

## Phase 2 (not in MVP)

Push notifications, GPS tracking, Stripe Identity, SMS recipient confirmation, community verification badges, insurance, and scheduled background jobs for booking expiry are planned but not implemented.

---

## License

Private — All rights reserved.

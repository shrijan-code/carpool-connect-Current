# CarryMate Setup Guide

Follow these steps to configure CarryMate for local development and production.

---

## 1. Firebase

### Create a project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (e.g. `carrymate-prod`)
3. Enable **Authentication**:
   - **Email/Password** — enable
   - **Phone** — enable (requires reCAPTCHA; add your domain to authorized domains)
4. Create a **Firestore** database (production mode initially; deploy rules from this repo)
5. Enable **Storage** (optional if using GCS directly)

### Client SDK config

1. Project Settings → General → Your apps → Add web app
2. Copy config values into `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Admin SDK (server routes)

1. Project Settings → Service accounts → Generate new private key
2. Set in `.env.local`:

```
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Important:** Keep the `\n` newlines in the private key string, or replace literal newlines with `\n`.

### Deploy Firestore rules

Install Firebase CLI if needed: `npm install -g firebase-tools`

Create `firebase.json` at repo root (or use Firebase Console):

```json
{
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

```bash
firebase login
firebase use your-project-id
firebase deploy --only firestore:rules
```

### Authorized domains

In Authentication → Settings → Authorized domains, add:

- `localhost`
- Your production domain (e.g. `carrymate.com.au`)

---

## 2. Stripe

### API keys

1. [Stripe Dashboard](https://dashboard.stripe.com) → Developers → API keys
2. Use **test mode** for development
3. Set in `.env.local`:

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

### Stripe Connect

1. Dashboard → Connect → Get started
2. Choose **Express** accounts for travellers
3. Travellers complete onboarding at `/connect` before posting trips

### Webhook (local development)

Use [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret to:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Webhook (production)

Add endpoint: `https://your-domain.com/api/stripe/webhook`

Events:

- `payment_intent.payment_failed`
- `payment_intent.succeeded`
- `payment_intent.amount_capturable_updated`
- `account.updated`

### Test cards

Use `4242 4242 4242 4242` with any future expiry and CVC for successful payments in test mode.

---

## 3. Resend (email)

1. Sign up at [resend.com](https://resend.com)
2. Verify your sending domain (or use Resend's test domain for dev)
3. Create API key → set `RESEND_API_KEY` in `.env.local`

Emails are skipped gracefully if Resend is not configured (logged to console).

---

## 4. Google Cloud Storage (optional)

For item and profile photo uploads:

1. Create a GCS bucket in the same project as Firebase (or separate)
2. Create a service account with **Storage Object Admin**
3. Set in `.env.local`:

```
GCS_BUCKET_NAME=your-bucket
GCS_PROJECT_ID=your-project
GCS_CLIENT_EMAIL=...
GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Without GCS, the upload API returns mock URLs for local testing.

---

## 5. Admin account

Generate a bcrypt password hash:

```bash
node -e "console.log(require('bcryptjs').hashSync('YourSecurePassword123', 10))"
```

Set in `.env.local`:

```
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD_HASH=$2a$10$...
ADMIN_JWT_SECRET=use-a-long-random-string-here
```

Login at `/admin/login`.

---

## 6. App URL

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Change to your production URL when deploying (used in emails and Stripe redirect URLs).

---

## 7. Verify installation

```bash
npm install
npm run build
npm run dev
```

Checklist:

- [ ] Register a new user at `/register`
- [ ] Complete onboarding at `/onboarding`
- [ ] Complete Stripe Connect at `/connect`
- [ ] Post a trip at `/trips/new`
- [ ] Browse trips at `/trips`
- [ ] Admin login at `/admin/login`

---

## 8. Deploy to Vercel

1. Push repo to GitHub
2. Import project in Vercel
3. Add all environment variables from `.env.local.example`
4. Deploy
5. Update Firebase authorized domains and Stripe webhook URL to your Vercel domain
6. Set `NEXT_PUBLIC_APP_URL` to your production URL

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `auth/invalid-api-key` | Check Firebase client env vars |
| Phone OTP fails | Add domain to Firebase authorized domains; enable Phone auth |
| Stripe webhook 400 | Verify `STRIPE_WEBHOOK_SECRET` matches CLI or dashboard |
| Upload fails | Check GCS credentials or use mock mode for dev |
| Admin login fails | Regenerate bcrypt hash; check `ADMIN_JWT_SECRET` is set |
| Build fails on Windows | Use Node 18+; ensure `.env.local` exists (placeholders OK for build) |

For support, open an issue on GitHub.

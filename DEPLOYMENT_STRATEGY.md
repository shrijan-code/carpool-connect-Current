# 🚀 Deployment & Hosting Strategy

> **Goal:** Deploy Webapp, Admin Dashboard, Mobile App, and Backend efficiently while using Microsoft 365 for professional comms.

---

## 🏗️ Architecture Overview

| Component | Technology | Recommended Host | Why? |
|-----------|------------|------------------|------|
| **Webapp** | Next.js | **Vercel** | Best performance, zero-config for Next.js, easy CI/CD. |
| **Admin Panel** | Next.js | **Vercel** | Same benefits as Webapp. Separate project. |
| **Backend** | Firebase | **Google Cloud** | Database, Auth, Functions are already here. |
| **Mobile App** | React Native | **App Stores** | Deployed via EAS (Expo Application Services). |
| **Email** | Microsoft 365 | **Microsoft** | Best for team collaboration & Outlook integration. |
| **Domain** | DNS | **Any Registrar** | Manages traffic between Vercel and Microsoft. |

---

## 🌍 1. Environments & Branching

The most efficient way to manage Development vs. Production is **Single Codebase, Multiple Configs**.

### A. Environment Strategy
You do **NOT** need separate codebases. Instead, use separate **Firebase Projects** and key sets.

| Environment | Purpose | Firebase Project | Branch | URL (Example) |
|-------------|---------|------------------|--------|---------------|
| **Dev** | Local testing, breaking changes | `carpool-dev` | `dev` | `localhost:3000` |
| **Staging** | Final QA before launch | `carpool-staging` | `staging` | `staging.carpoolconnect.com` |
| **Prod** | Live user data (REAL MONEY) | `carpool-prod` | `main` | `www.carpoolconnect.com` |

### B. Configuration (.env)
Create separate `.env` files locally to switch contexts:

*   `.env.development` -> Loaded by `npm run dev`
*   `.env.production` -> Loaded by `npm start` or Vercel Prod
*   `.env.local` -> Your local overrides (gitignored)

**How to Switch:**
1.  **Vercel:** Add Environment Variables in the Project Settings. You can set different values for "Production" and "Preview" (Staging) deployments.
2.  **Firebase:** Use `firebase use` command:
    ```bash
    firebase use dev   # Switch to dev project
    firebase use prod  # Switch to production project
    ```

### C. Git Workflow
1.  **Feature Branch:** Create `feat/new-login` from `dev`. Code & Test locally.
2.  **Pull Request -> Dev:** Merge to `dev`. CI runs tests. Deploy to Dev environment.
3.  **Pull Request -> Main:** When confident, merge `dev` to `main`. This triggers Vercel to deploy to Production.

---

## 🌐 2. Domain & DNS Setup

**You need ONE domain name (e.g., `carpoolconnect.com`).**
Buy this from any registrar (Namecheap, GoDaddy, Google/Squarespace).

### DNS Records Configuration
You will configure these records at your Domain Registrar (or Cloudflare if you use it).

**A. Pointing to Web Services (Hosting)**
*   **Webapp (`www.carpoolconnect.com`):**
    *   Add `CNAME` record: `www` points to `cname.vercel-dns.com`
    *   Add `A` record: `@` points to `76.76.21.21` (Vercel IP)
*   **Admin Dashboard (`admin.carpoolconnect.com`):**
    *   Add `CNAME` record: `admin` points to `cname.vercel-dns.com`

**B. Pointing to Email (Microsoft 365)**
*   **MX Records:** Directs emails to Outlook.
    *   Microsoft will provide ~3 records (e.g., `carpoolconnect-com.mail.protection.outlook.com`).
*   **TXT Records (Security):** **CRITICAL** to prevent your app's emails from going to Spam.
    *   **SPF:** Authorized senders. Needs to include BOTH Microsoft and your App's email sender service (if using one).
    *   **DKIM:** Verifies email authenticity.

---

## ☁️ 2. Hosting Web Apps (Vercel)

**Why Vercel?** It's built by the creators of Next.js. Deploying is as simple as pushing to GitHub.

### Steps to Deploy:
1.  **Create Account:** Go to [vercel.com](https://vercel.com) and sign up with GitHub.
2.  **Add Webapp:**
    *   Click "Add New Project" -> Import `carpool-connect` repo.
    *   **Root Directory:** Select `webapp`.
    *   **Environment Variables:** Copy from your local `.env`.
3.  **Add Admin Dashboard:**
    *   Click "Add New Project" -> Import SAME repo again.
    *   **Root Directory:** Select `admin-dashboard`.
    *   **Environment Variables:** Copy from local `.env`.
4.  **Connect Domains:**
    *   In Vercel Project Settings > Domains, add `www.carpoolconnect.com` (for Webapp) and `admin.carpoolconnect.com` (for Admin).

---

## 🔥 3. Backend (Firebase)

Your backend is already "deployed" if you are using production Firebase.

*   **Firestore/Auth:** Managed automatically by Google.
*   **Functions:** Deploy via command line.
    ```bash
    cd functions
    npm run build
    firebase deploy --only functions
    ```
*   **Security:** Ensure `firestore.rules` are strict before launch.

---

## 📱 4. Mobile Lifecycle (App Stores)

We use **EAS (Expo Application Services)** to manage the entire lifecycle from development to app store submission.

### A. Development (Local)
Since we use native code (Stripe, Maps), **you cannot use the standard Expo Go app** from the store. You must build a "Development Client".
1.  **Build Dev Client:** `eas build --profile development --platform android` (or ios)
2.  **Install on Device:** Install the `.apk` (Android) or use TestFlight (iOS, requires Apple Developer Account).
3.  **Run Locally:** `npm run start:tunnel`
4.  **Connect:** Open the Dev Client app on your phone -> Connect to localhost/tunnel.

### B. Testing (Staging / Beta)
Before releasing to the public, push a build to internal testers.
1.  **Build for Store:**
    `eas build --profile production --platform all`
2.  **Submit to Stores (Beta Tracks):**
    `eas submit --platform all`
3.  **Configure in Stores:**
    *   **iOS (App Store Connect):** The build appears in **TestFlight**. Add "Internal Testers" to let your team download it immediately.
    *   **Android (Google Play Console):** The build appears in **Internal Testing**. Add tester emails.

### C. Production (Live)
When the Beta build is confirmed stable:
1.  **Promote Build:**
    *   **iOS:** Promote from TestFlight -> **Production**. Submit for Review.
    *   **Android:** Promote from Internal Testing -> **Production**. Submit for Review.
2.  **Updates (OTA):**
    *   For small JavaScript changes (bug fixes, text changes), you don't need a full store review.
    *   Run: `eas update --branch production`
    *   Users get the update instantly next time they open the app.

---

## 📧 5. Email Strategy (Microsoft 365)

**Scenario A: Team Communication**
*   **Use:** Communicating with partners, support tickets, internal team.
*   **Tool:** Outlook (Web/Desktop).
*   **Setup:** Just add users in Microsoft Admin Center (e.g., `shrijan@...`, `support@...`).

**Scenario B: App Sending Automated Emails (Transactional)**
*   **Use:** "Ride Confirmed", "Password Reset", "Welcome".
*   **Tool:** `nodemailer` in your Backend.
*   **Integration:**
    1.  Create a dedicated user (e.g., `noreply@carpoolconnect.com`) in Microsoft 365.
    2.  Use that user's credentials in `functions/src/utils/email.ts`.
    3.  **Important:** Microsoft might block "automated" sending. If volume grows (>100/day), switch to a dedicated API provider like **SendGrid** or **Postmark** for *app* emails, while keeping M365 for *human* emails.

---

## 🛡️ 6. Backup & Recovery Strategy

**Rule of Thumb:** GitHub is for Code. Google Cloud is for Data. Password Manager is for Keys.

### A. Codebase Backups
*   **Primary:** GitHub (The cloud "truth").
*   **Secondary:** Your local machine (a clone).
*   **Tertiary (Optional but Recommended):** A "mirror" of the GitHub repo to another service like Bitbucket or GitLab once a month. This protects you if GitHub goes down or your account is locked.

### B. Database Backups (Firestore)
Google data centers are resilient, but they don't protect against **you** accidentally deleting a collection.

1.  **Automated Daily Exports:**
    Configure a Google Cloud Scheduler job to run `gcloud firestore export` every night.
    *   **Destination:** A private Google Cloud Storage (GCS) Bucket.
    *   **Retention:** Set the bucket lifecycle to delete files older than 30 days to save costs.

2.  **Point-in-Time Recovery (PITR):**
    Enable PITR in Firestore settings. This allows you to "undo" writes from the last 7 days.

### C. Environment Configs (The "Keys to the Castle")
Your `.env` files and `keys` are NOT in GitHub. **If you lose these, you cannot deploy.**

*   **Where to store:** A secure password manager (1Password, LastPass, Bitwarden) as a "Secure Note".
*   **What to store:**
    *   Content of `.env.production`
    *   Content of `.env.development`
    *   Stripe Secret Keys
    *   Apple Developer Signing Certificates (`.p12` files) - **Critical for iOS updates**
    *   Android Keystore (`.keystore` file) - **Critical for Android updates**

---

## 🐙 7. Source Control Standards (GitHub)

### Branch Protection Rules
Go to **GitHub Settings > Branches** and add rules for `main` and `dev`:

1.  **Require Pull Request reviews:** Prevent pushing directly to `main`. Require at least 1 approval.
2.  **Require status checks to pass:** Ensure tests pass (CI) before merging.
3.  **Include administrators:** even YOU should follow the rules.

### Recommended Branch Structure

| Branch | Protection | Purpose |
|--------|------------|---------|
| `main` | **Strict** | Production code. ONLY merge from `dev`. Never push directly. |
| `dev`  | **Moderate** | Staging code. Merge features here. |
| `feat/*` | None | Feature work. Delete after merging. |
| `fix/*` | None | Bug fixes. Delete after merging. |

---

## 📊 8. Monitoring & Health Checks

Once you go live, you need to know if the app crashes.

1.  **Crashlytics (Mobile):**
    *   Already built into Firebase.
    *   **Action:** Check the Firebase Console > Crashlytics weekly to see if users are experiencing crashes.

2.  **Vercel Analytics (Web):**
    *   Enable "Analytics" and "Speed Insights" in Vercel Dashboard.
    *   **Cost:** Free tier is sufficient for launch.
    *   **Benefit:** Tells you if the website is slow for users.

3.  **Stripe Dashboard:**
    *   The ultimate health check. If payments stop coming in, something is wrong.
    *   **Action:** Enable email alerts for failed payments in Stripe Settings.

---

## 💸 9. Cost Control (Cloud Budgets)

Cloud bills can surprise you if usage spikes (or if you make a loop error).

1.  **Google Cloud Budget:**
    *   Go to [Google Cloud Billing](https://console.cloud.google.com/billing).
    *   **Set a Budget:** e.g., $50/month.
    *   **Alerts:** Configure it to email `shrijan@...` at 50%, 90%, and 100% of budget.
    *   *Note: This alerts you, it doesn't stop the service (which is good, you don't want the app to vanish).*

2.  **Vercel Limits:**
    *   Vercel will email you if you approach Pro limits. The Hobby tier is generous (100GB bandwidth).

---

## 🍎 10. Store Listing Requirements (The "Paperwork")

Apple and Google will **reject** your app if you miss these during submission:

| Requirement | What you need | Where to put it |
|-------------|---------------|-----------------|
| **Privacy Policy URL** | A web link to your policy. | `www.carpoolconnect.com/privacy` |
| **Support URL** | A link where users can contact you. | `www.carpoolconnect.com/contact` |
| **Marketing URL** | Your landing page. | `www.carpoolconnect.com` |
| **Account Deletion** | **MANDATORY:** Users must be able to delete their account *inside the app*. | You already have this in Profile Settings! ✅ |
| **App Screenshots** | High-res images for iPhone 6.5" and 5.5". | Use a tool like **Shotbot** or **Figma**. |
| **Login Credentials** | A demo user/pass for the Apple Reviewer. | Create a user `apple_test@carpool.com` in Firebase. |

---

## ✅ Deployment Checklist

- [ ] **Domain:** Purchased and accessible.
- [ ] **Email:** M365 account set up; MX records configured.
- [ ] **Backend:** `firebase deploy` run successfully. Secrets set.
- [ ] **Webapp:** Deployed to Vercel. Env vars configured. Domain connected.
- [ ] **Admin:** Deployed to Vercel. Env vars configured. Subdomain connected.
- [ ] **Mobile:** Production build created via EAS. 
- [ ] **Testing:**
    - [ ] Sign up on Webapp -> Check Firebase.
    - [ ] Login on Admin -> View User.
    - [ ] Login on Mobile -> Book Ride.
    - [ ] Receive Email -> Check Outlook connection.

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

## 📱 4. Mobile App (Expo / EAS)

We use **EAS (Expo Application Services)** to build and submit the app.

1.  **Install EAS CLI:** `npm install -g eas-cli`
2.  **Login:** `eas login`
3.  **Configure:** `eas build:configure`
4.  **Production Build:**
    ```bash
    eas build --platform ios --profile production
    eas build --platform android --profile production
    ```
5.  **Submit to Stores:**
    ```bash
    eas submit --platform ios
    eas submit --platform android
    ```
*   **Updates:** Push over-the-air updates for small JS changes:
    `eas update --branch production`

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

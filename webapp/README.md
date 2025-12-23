# CarpoolConnect Marketing Website

A modern Next.js marketing website for CarpoolConnect - Australia's ridesharing platform.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run development server (Port 3002)
npm run dev

# Build for production
npm run build
```

**Development URL:** http://localhost:3002

## 📁 Project Structure

```
webapp/
├── src/app/
│   ├── page.tsx              # Landing page
│   ├── privacy/              # Privacy policy
│   ├── terms/                # Terms of service
│   ├── contact/              # Contact page
│   └── api/contact/route.ts  # Contact form API
├── public/                   # Static assets
└── .env.local                # Environment variables (create from below)
```

## 📧 Contact Form Email Configuration

The contact form sends emails to your support team and acknowledgement emails to users.

### Step 1: Create Environment File

Create `.env.local` in the webapp directory:

```env
# Email account used to SEND emails (Gmail example)
EMAIL_USER=shrijan.bhandari1318@gmail.com
EMAIL_PASSWORD=your-16-character-app-password

# Where contact form submissions are sent
SUPPORT_EMAIL=shrijan.bhandari1318@gmail.com
```

### Step 2: Create Gmail App Password

1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and your device
3. Copy the 16-character password (no spaces)
4. Set this as `EMAIL_PASSWORD`

### Switching to Microsoft 365

Edit `src/app/api/contact/route.ts` lines 9-15:

```typescript
// Change from Gmail:
host: 'smtp.gmail.com',

// To Microsoft 365:
host: 'smtp.office365.com',
```

Then update environment variables with your M365 credentials.

### Security Features

| Feature | Description |
|---------|-------------|
| Rate Limiting | 5 requests per IP per hour |
| Honeypot Field | Hidden field catches bots |
| Input Sanitization | Removes HTML/scripts |
| Email Validation | Server-side format validation |

### API Endpoint

**POST** `/api/contact`

```json
{
  "name": "John Smith",
  "email": "john@example.com",
  "subject": "general",
  "message": "Hello..."
}
```

## 🌐 Deployment

Deployed via Vercel at your custom domain.

```bash
# Set environment variables in Vercel Dashboard
# Then deploy:
vercel --prod
```

**Important:** Add `EMAIL_USER`, `EMAIL_PASSWORD`, and `SUPPORT_EMAIL` to Vercel Environment Variables.

## 🔗 Related

- **Mobile App:** `../` (Expo React Native)
- **Admin Dashboard:** `../admin-dashboard` (Next.js)
- **Cloud Functions:** `../functions` (Firebase)

---

**Built with Next.js 14 & TailwindCSS**


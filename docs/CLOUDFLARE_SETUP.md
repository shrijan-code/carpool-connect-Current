# Cloudflare Setup Guide for CarpoolConnect

This guide walks you through configuring Cloudflare as a security proxy for your Vercel-hosted webapps.

## Overview

```
┌─────────┐     ┌─────────────┐     ┌─────────┐
│  Users  │────▶│  Cloudflare │────▶│  Vercel │
│         │     │  (Proxy)    │     │  (Host) │
└─────────┘     └─────────────┘     └─────────┘
                     │
                     ├── DDoS Protection (unlimited)
                     ├── Bot Fight Mode
                     ├── SSL/TLS Termination
                     ├── CDN Caching
                     └── WAF (paid plans)
```

---

## Step 1: Create Cloudflare Account

1. Go to [cloudflare.com](https://cloudflare.com) and sign up (free tier is sufficient)
2. Click **"Add a Site"**
3. Enter your domain (e.g., `carpoolconnect.au`)
4. Select the **Free** plan

---

## Step 2: Update Nameservers

Cloudflare will provide two nameservers, for example:
- `ada.ns.cloudflare.com`
- `bob.ns.cloudflare.com`

### At Your Domain Registrar:
1. Log into your domain registrar (GoDaddy, Namecheap, Google Domains, etc.)
2. Find **DNS** or **Nameserver** settings
3. Replace existing nameservers with Cloudflare's
4. Save changes

> **Note**: DNS propagation takes 24-48 hours but is usually much faster.

---

## Step 3: Configure DNS Records

In Cloudflare Dashboard → **DNS** → **Records**, add:

### For Marketing Website (carpoolconnect.au)
| Type | Name | Target | Proxy Status |
|------|------|--------|--------------|
| CNAME | `@` | `cname.vercel-dns.com` | ✅ Proxied (orange) |
| CNAME | `www` | `cname.vercel-dns.com` | ✅ Proxied (orange) |

### For Admin Dashboard (admin.carpoolconnect.au)
| Type | Name | Target | Proxy Status |
|------|------|--------|--------------|
| CNAME | `admin` | `cname.vercel-dns.com` | ✅ Proxied (orange) |

> **Important**: 
> - 🟠 **Orange cloud (Proxied)** = Traffic goes through Cloudflare (protected)
> - ⚪ **Grey cloud (DNS only)** = Traffic goes directly to Vercel (unprotected)

---

## Step 4: Configure SSL/TLS

### Overview Settings
1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to: **Full (strict)**

### Edge Certificates
Go to **SSL/TLS** → **Edge Certificates** and enable:
- ✅ **Always Use HTTPS**
- ✅ **Automatic HTTPS Rewrites**
- ✅ **Minimum TLS Version**: TLS 1.2

---

## Step 5: Enable Security Features

### Security Settings
Go to **Security** → **Settings**:

| Setting | Recommended Value |
|---------|-------------------|
| Security Level | Medium (or High for admin subdomain) |
| Challenge Passage | 30 minutes |
| Browser Integrity Check | ✅ On |

### Bot Protection
Go to **Security** → **Bots**:
- ✅ Enable **Bot Fight Mode** (free)
- ✅ Enable **JavaScript Detections**

### Under Attack Mode
If you experience a DDoS attack:
1. Go to **Security** → **Settings**
2. Enable **"I'm Under Attack!"** mode
3. This adds a JavaScript challenge to all visitors

---

## Step 6: Configure Vercel

In Vercel dashboard for each project:

1. Go to **Settings** → **Domains**
2. Add your domain (e.g., `carpoolconnect.au`)
3. Select **"Add Domain"**
4. Vercel will auto-detect Cloudflare configuration

### Verify Connection
After setup, check:
```bash
curl -I https://carpoolconnect.au
```

You should see headers like:
```
cf-ray: xxxxx
server: cloudflare
```

---

## Step 7: (Optional) Cache Settings

### Speed → Caching
For static assets, configure:

| Setting | Value |
|---------|-------|
| Caching Level | Standard |
| Browser Cache TTL | 4 hours |
| Crawler Hints | ✅ On |

### Page Rules (3 free)
Example rule for API (no caching):
- **URL**: `*carpoolconnect.au/api/*`
- **Setting**: Cache Level = Bypass

---

## Step 8: (Optional) Firewall Rules

### Block Known Bad Actors
Go to **Security** → **WAF** → **Custom Rules**:

Example rule to block countries (if not serving there):
```
(ip.geoip.country in {"RU" "CN" "KP"}) and not cf.bot_management.verified_bot
```

### Rate Limiting (Paid Feature)
Go to **Security** → **WAF** → **Rate limiting rules**:
- Limit login attempts: 5 requests per minute per IP
- Limit API calls: 100 requests per minute per IP

---

## Free Tier Benefits

| Feature | Included |
|---------|----------|
| DDoS Protection | ✅ Unlimited |
| Bot Fight Mode | ✅ |
| SSL Certificates | ✅ |
| CDN (200+ locations) | ✅ |
| Page Rules | 3 rules |
| Firewall Rules | 5 rules |
| Analytics | ✅ Basic |

---

## Troubleshooting

### Error 521: Web Server Is Down
- Vercel may be unreachable
- Check Vercel status page
- Verify DNS records point to `cname.vercel-dns.com`

### Error 526: Invalid SSL Certificate
- Set SSL/TLS mode to **Full (strict)**
- Ensure Vercel has valid SSL for your domain

### Mixed Content Warnings
- Enable **Automatic HTTPS Rewrites** in SSL/TLS settings

### Site Loading Slowly
- Check **Speed** → **Optimization** settings
- Enable Auto Minify for JS/CSS/HTML
- Enable Brotli compression

---

## Security Checklist

- [ ] DNS pointing to Cloudflare nameservers
- [ ] All DNS records set to Proxied (orange cloud)
- [ ] SSL/TLS set to Full (strict)
- [ ] Always Use HTTPS enabled
- [ ] Bot Fight Mode enabled
- [ ] Browser Integrity Check enabled
- [ ] Vercel domain configured
- [ ] Headers verified with `curl -I`

---

## Related Documentation

- [Cloudflare Docs](https://developers.cloudflare.com/)
- [Vercel + Cloudflare Guide](https://vercel.com/docs/integrations/cloudflare)
- [Cloudflare SSL Modes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/)

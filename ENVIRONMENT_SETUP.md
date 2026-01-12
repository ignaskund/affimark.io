# AffiMark Environment Variables Guide

Complete guide to all environment variables needed for AffiMark V2 (Creator Operations Platform).

---

## 🔑 Required API Keys & Services

### Core Services (REQUIRED)

| Service | Purpose | Where to Get | Cost |
|---------|---------|--------------|------|
| **Supabase** | Database + Auth + Storage | [supabase.com](https://supabase.com) | Free tier available |
| **Anthropic Claude** | AI for MCP servers | [console.anthropic.com](https://console.anthropic.com) | Pay-as-you-go |

### Optional Services (Feature-Specific)

| Service | Purpose | When Needed | Where to Get |
|---------|---------|-------------|--------------|
| **Awin API** | OAuth auto-sync earnings | When using Awin OAuth | [awin.com/developer](https://www.awin.com/gb) |
| **Tradedoubler API** | OAuth auto-sync earnings | When using Tradedoubler OAuth | [tradedoubler.com](https://www.tradedoubler.com) |
| **ECB Exchange Rates** | Currency conversion | Automatic (no key needed) | Free public API |

---

## 📁 Environment Files Structure

```
affimark-project/
├── backend/
│   ├── .dev.vars          # LOCAL development (Cloudflare Workers)
│   └── wrangler.toml      # Production secrets (via Cloudflare Dashboard)
│
└── frontend/
    ├── .env.local         # LOCAL development (Next.js)
    └── .env.production    # Production (Vercel Dashboard)
```

---

## 🔧 Backend Environment Variables

### File: `backend/.dev.vars` (Local Development)

```bash
# ========================================
# SUPABASE (REQUIRED)
# ========================================
# Your Supabase project URL
# Find at: Supabase Dashboard → Settings → API → Project URL
SUPABASE_URL=https://your-project.supabase.co

# Service role key (NEVER commit this!)
# Find at: Supabase Dashboard → Settings → API → service_role secret
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Anon public key (safe to expose client-side)
# Find at: Supabase Dashboard → Settings → API → anon public
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...


# ========================================
# ANTHROPIC (REQUIRED for MCP features)
# ========================================
# Claude API key for MCP servers
# Get from: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-api03-...


# ========================================
# AWIN (OPTIONAL - for OAuth auto-sync)
# ========================================
# Only needed if implementing Awin OAuth
# Get from: https://www.awin.com/gb/publishers/api
AWIN_CLIENT_ID=your_awin_client_id
AWIN_CLIENT_SECRET=your_awin_client_secret
AWIN_API_TOKEN=your_awin_api_token


# ========================================
# TRADEDOUBLER (OPTIONAL - for OAuth)
# ========================================
# Only needed if implementing Tradedoubler OAuth
# Get from: https://www.tradedoubler.com
TRADEDOUBLER_CLIENT_ID=your_tradedoubler_client_id
TRADEDOUBLER_CLIENT_SECRET=your_tradedoubler_secret


# ========================================
# APPLICATION SETTINGS
# ========================================
# Environment mode
NODE_ENV=development

# Base URL for redirects (SmartWrappers)
# Production: https://go.affimark.com
# Development: http://localhost:8787
BASE_URL=http://localhost:8787

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

---

### Production Secrets (Cloudflare Workers Dashboard)

For production, add these via Cloudflare Dashboard:

1. Go to **Cloudflare Dashboard** → **Workers** → **Your Worker** → **Settings** → **Variables**
2. Add each secret:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
   - (Optional) `AWIN_CLIENT_ID`, `AWIN_CLIENT_SECRET`, `AWIN_API_TOKEN`
   - (Optional) `TRADEDOUBLER_CLIENT_ID`, `TRADEDOUBLER_CLIENT_SECRET`

**DO NOT commit `.dev.vars` to git!** (Already in `.gitignore`)

---

## 🎨 Frontend Environment Variables

### File: `frontend/.env.local` (Local Development)

```bash
# ========================================
# SUPABASE (REQUIRED)
# ========================================
# Public URL - safe to expose
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Anon key - safe to expose client-side
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...


# ========================================
# BACKEND API (REQUIRED)
# ========================================
# Backend API URL
# Production: https://api.affimark.com
# Development: http://localhost:8787
NEXT_PUBLIC_API_URL=http://localhost:8787


# ========================================
# SMARTWRAPPER REDIRECT (REQUIRED)
# ========================================
# SmartWrapper redirect domain
# Production: https://go.affimark.com
# Development: http://localhost:8787
NEXT_PUBLIC_REDIRECT_URL=http://localhost:8787


# ========================================
# APPLICATION SETTINGS
# ========================================
# App environment
NEXT_PUBLIC_ENV=development

# App name
NEXT_PUBLIC_APP_NAME=AffiMark

# Support email
NEXT_PUBLIC_SUPPORT_EMAIL=support@affimark.com
```

---

### Production Environment (Vercel Dashboard)

For production deployment on Vercel:

1. Go to **Vercel Dashboard** → **Your Project** → **Settings** → **Environment Variables**
2. Add each variable for **Production** environment:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJ...`
   - `NEXT_PUBLIC_API_URL` = `https://api.affimark.com`
   - `NEXT_PUBLIC_REDIRECT_URL` = `https://go.affimark.com`
   - `NEXT_PUBLIC_ENV` = `production`

---

## 🏗️ Setup Instructions

### 1. Supabase Setup

1. **Create Project**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose region (EU for GDPR compliance)
   - Set strong database password

2. **Run Migrations**
   ```sql
   -- In Supabase SQL Editor, run in this order:
   \i V2_MIGRATION_ADD_CREATOR_OPS.sql
   \i SEED_AFFILIATE_PROGRAMS.sql
   \i ADD_SMARTWRAPPER_TABLES.sql
   ```

3. **Get API Keys**
   - Navigate to: **Settings → API**
   - Copy:
     - Project URL → `SUPABASE_URL`
     - `anon` `public` → `SUPABASE_ANON_KEY`
     - `service_role` `secret` → `SUPABASE_SERVICE_KEY` ⚠️ **NEVER expose this!**

4. **Configure Auth**
   - **Settings → Authentication**
   - Enable email provider
   - Set Site URL: `http://localhost:3000` (dev) or `https://affimark.com` (prod)
   - Add redirect URLs: `http://localhost:3000/auth/callback`

---

### 2. Anthropic Claude Setup (for MCP)

1. **Create Account**
   - Go to [console.anthropic.com](https://console.anthropic.com)
   - Sign up / Log in

2. **Generate API Key**
   - Navigate to: **Settings → API Keys**
   - Click "Create Key"
   - Name it: "AffiMark MCP Server"
   - Copy key → `ANTHROPIC_API_KEY`

3. **Add Credits**
   - Go to **Settings → Billing**
   - Add payment method
   - Add credits (suggested: $20 to start)

**Usage:** MCP servers for strategy agent, product research, etc.

---

### 3. Awin OAuth Setup (OPTIONAL)

**Only needed if you want automated Awin earnings sync.**

1. **Apply for API Access**
   - Log in to Awin Publisher account
   - Go to: **Tools → API**
   - Apply for API access (may take 1-2 days)

2. **Create OAuth Application**
   - Once approved, go to: **API → OAuth**
   - Create new application
   - Set callback URL: `https://affimark.com/api/auth/awin/callback`
   - Copy:
     - Client ID → `AWIN_CLIENT_ID`
     - Client Secret → `AWIN_CLIENT_SECRET`
     - API Token → `AWIN_API_TOKEN`

3. **Scopes Required**
   - `transactions:read`
   - `account:read`
   - `programmes:read`

**Without Awin OAuth:** Users can still upload CSV files manually (works fine).

---

### 4. Tradedoubler OAuth Setup (OPTIONAL)

**Only needed if you want automated Tradedoubler earnings sync.**

1. **Contact Tradedoubler Support**
   - Email: `api@tradedoubler.com`
   - Request API access for affiliate account

2. **Get Credentials**
   - They will provide:
     - Client ID → `TRADEDOUBLER_CLIENT_ID`
     - Client Secret → `TRADEDOUBLER_CLIENT_SECRET`

3. **Set Callback URL**
   - Provide: `https://affimark.com/api/auth/tradedoubler/callback`

**Without Tradedoubler OAuth:** Users can still upload CSV files manually.

---

### 5. Currency Conversion (Automatic - No Key Needed)

AffiMark uses the **European Central Bank (ECB)** public API for exchange rates.

- Endpoint: `https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml`
- **Free, no authentication required**
- Updated daily
- Supports EUR, GBP, USD, and 30+ other currencies

This is handled automatically by `backend/src/services/currency-converter.ts`.

---

## 🚀 Quick Start (Copy-Paste Templates)

### Backend `.dev.vars` Template

```bash
# Copy this to backend/.dev.vars and fill in your values

SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=

# Optional (leave empty if not using)
AWIN_CLIENT_ID=
AWIN_CLIENT_SECRET=
AWIN_API_TOKEN=
TRADEDOUBLER_CLIENT_ID=
TRADEDOUBLER_CLIENT_SECRET=

NODE_ENV=development
BASE_URL=http://localhost:8787
FRONTEND_URL=http://localhost:3000
```

### Frontend `.env.local` Template

```bash
# Copy this to frontend/.env.local and fill in your values

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_REDIRECT_URL=http://localhost:8787
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_APP_NAME=AffiMark
NEXT_PUBLIC_SUPPORT_EMAIL=support@affimark.com
```

---

## ✅ Verification Checklist

After setting up environment variables:

- [ ] **Backend compiles**: `cd backend && npm run dev`
- [ ] **Frontend compiles**: `cd frontend && npm run dev`
- [ ] **Supabase connection works**: Check browser console for errors
- [ ] **Auth works**: Try signing up/logging in
- [ ] **Database queries work**: View dashboard after login
- [ ] **MCP servers respond**: Test strategy agent (if using Anthropic)
- [ ] **SmartWrapper redirects work**: Create a SmartWrapper and test the link

---

## 🔒 Security Best Practices

1. **NEVER commit secrets to git**
   - `.dev.vars` is in `.gitignore`
   - `.env.local` is in `.gitignore`
   - Always use dashboard/CLI for production secrets

2. **Use service_role key ONLY on backend**
   - `SUPABASE_SERVICE_KEY` has full database access
   - NEVER expose in frontend
   - Use `SUPABASE_ANON_KEY` in frontend (limited by RLS)

3. **Rotate keys if exposed**
   - If any secret key is accidentally committed:
     - Immediately revoke in respective dashboard
     - Generate new key
     - Update all environments

4. **Separate dev/prod keys**
   - Use different Supabase projects for dev vs prod
   - Use different API keys where possible

---

## 🌍 Multi-Environment Setup

### Development
- **Backend**: `http://localhost:8787`
- **Frontend**: `http://localhost:3000`
- **Database**: Supabase Dev Project

### Staging (Optional)
- **Backend**: `https://api-staging.affimark.com`
- **Frontend**: `https://staging.affimark.com`
- **Database**: Supabase Staging Project

### Production
- **Backend**: `https://api.affimark.com`
- **Frontend**: `https://affimark.com`
- **SmartWrappers**: `https://go.affimark.com`
- **Database**: Supabase Production Project

---

## 🆘 Troubleshooting

### "SUPABASE_URL is not defined"
- Check `.env.local` (frontend) or `.dev.vars` (backend) exists
- Verify `NEXT_PUBLIC_` prefix for frontend variables
- Restart dev server after adding variables

### "Invalid API key" errors
- Verify key is copied completely (no trailing spaces)
- Check key hasn't been revoked in dashboard
- Ensure using correct key (service_role vs anon)

### "CORS errors" in browser
- Check `FRONTEND_URL` in backend `.dev.vars`
- Verify CORS middleware in `backend/src/api.ts`
- Ensure `NEXT_PUBLIC_API_URL` is correct in frontend

### OAuth redirect loops
- Verify callback URLs match exactly in provider dashboard
- Check `BASE_URL` is set correctly
- Ensure OAuth credentials are not expired

---

## 📊 Cost Estimates (Monthly)

### Minimum Viable Setup (Free Tier)
- **Supabase Free**: $0 (500MB database, 50k monthly active users)
- **Cloudflare Workers Free**: $0 (100k requests/day)
- **Vercel Hobby**: $0 (100GB bandwidth)
- **Anthropic Claude**: ~$5 (minimal usage)
- **TOTAL**: ~$5/month

### Growing Creator Base (Paid Tiers)
- **Supabase Pro**: $25/month (8GB database, 100k MAU)
- **Cloudflare Workers Paid**: $5/month (10M requests)
- **Vercel Pro**: $20/month (1TB bandwidth)
- **Anthropic Claude**: $20-50/month (medium usage)
- **TOTAL**: ~$70-100/month

### Enterprise Scale
- **Supabase Team**: Custom pricing
- **Cloudflare Workers**: Custom pricing
- **Vercel Enterprise**: Custom pricing
- **Anthropic Claude**: $200+/month (heavy usage)

---

## 🔗 Useful Links

- [Supabase Docs](https://supabase.com/docs)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Anthropic API Docs](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [Awin API Docs](https://wiki.awin.com/index.php/API)

---

**Last Updated:** 2026-01-07
**Version:** 2.0 (Creator Operations Platform)

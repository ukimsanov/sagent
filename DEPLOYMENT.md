# Deployment Guide

This guide covers deploying both the WhatsApp AI Agent Worker and the Dashboard to Cloudflare.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Platform                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────┐      ┌─────────────────────────────┐   │
│  │  whatsapp-ai-agent  │      │  whatsapp-agent-dashboard   │   │
│  │      (Worker)       │      │    (Next.js via OpenNext)   │   │
│  └──────────┬──────────┘      └──────────────┬──────────────┘   │
│             │                                 │                   │
│             ▼                                 ▼                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     D1 Database                              ││
│  │                 whatsapp-ai-agent-db                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐│
│  │ KV Namespace │  │  R2 Bucket   │  │    Durable Objects      ││
│  │ CONVERSATIONS│  │PRODUCT_IMAGES│  │   ConversationDO        ││
│  └──────────────┘  └──────────────┘  └─────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Cloudflare account with Workers Paid plan (for D1, Durable Objects)
- WorkOS account with AuthKit configured
- WhatsApp Business API access token
- OpenAI API key

---

## 1. Main Worker Deployment

### 1.1 Set Secrets

```bash
cd /path/to/whatsapp-ai-agent

# Set required secrets (production values)
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
npx wrangler secret put WHATSAPP_VERIFY_TOKEN
npx wrangler secret put CLEANUP_SECRET
```

### 1.2 Create/Verify Resources

The following are already configured in `wrangler.jsonc`:
- D1 Database: `whatsapp-ai-agent-db`
- KV Namespace: `CONVERSATIONS`
- R2 Bucket: `product-images`
- Durable Object: `ConversationDO`

### 1.3 Run Database Migrations (if needed)

```bash
# Apply schema to production D1
npx wrangler d1 execute whatsapp-ai-agent-db --remote --file=./src/db/schema.sql
```

### 1.4 Deploy Worker

```bash
npx wrangler deploy
```

Expected output:
```
Your Worker has access to the following bindings:
- env.CONVERSATION_DO (Durable Object)
- env.CONVERSATIONS (KV Namespace)
- env.DB (D1 Database)
- env.PRODUCT_IMAGES (R2 Bucket)

Published whatsapp-ai-agent (X.XX sec)
  https://whatsapp-ai-agent.<account>.workers.dev
```

---

## 2. Dashboard Deployment

### 2.1 Set Cloudflare Secrets for Dashboard

```bash
cd dashboard

# WorkOS AuthKit secrets (get from WorkOS Dashboard)
npx wrangler secret put WORKOS_CLIENT_ID
npx wrangler secret put WORKOS_API_KEY
npx wrangler secret put WORKOS_COOKIE_PASSWORD
npx wrangler secret put NEXT_PUBLIC_WORKOS_REDIRECT_URI
```

**Important**: For production, `NEXT_PUBLIC_WORKOS_REDIRECT_URI` should be:
```
https://whatsapp-agent-dashboard.<account>.workers.dev/auth/callback
```

### 2.2 Configure WorkOS Dashboard

1. Go to [WorkOS Dashboard](https://dashboard.workos.com/)
2. Add the production redirect URI to allowed callback URLs
3. Enable the authentication methods you need (email/password, Google, etc.)

### 2.3 Deploy Dashboard

```bash
npm run deploy
```

This runs:
1. `next build` - Builds the Next.js app
2. `opennextjs-cloudflare build` - Adapts for Cloudflare Workers
3. `opennextjs-cloudflare deploy` - Deploys to Cloudflare

Expected output:
```
Published whatsapp-agent-dashboard
  https://whatsapp-agent-dashboard.<account>.workers.dev
```

---

## 3. Environment Variables Summary

### Main Worker (`.dev.vars` for local, secrets for production)

| Variable | Description | Where to get |
|----------|-------------|--------------|
| `OPENAI_API_KEY` | OpenAI API key | platform.openai.com |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Business API token | Meta Developer Console |
| `WHATSAPP_PHONE_NUMBER_ID` | Your WhatsApp phone ID | Meta Developer Console |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification token | You create this |
| `CLEANUP_SECRET` | Auth for cleanup endpoint | You create this (32+ chars) |

### Dashboard (`.env.local` for local, secrets for production)

| Variable | Description | Where to get |
|----------|-------------|--------------|
| `WORKOS_CLIENT_ID` | WorkOS client ID | WorkOS Dashboard |
| `WORKOS_API_KEY` | WorkOS API key | WorkOS Dashboard |
| `WORKOS_COOKIE_PASSWORD` | Session encryption key | Generate: `openssl rand -base64 32` |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | OAuth callback URL | Your domain + `/auth/callback` |

---

## 4. Post-Deployment Verification

### 4.1 Test Main Worker

```bash
# Check webhook is responding
curl https://whatsapp-ai-agent.<account>.workers.dev/webhook?hub.verify_token=<your_token>&hub.challenge=test

# Should return: test
```

### 4.2 Test Dashboard

1. Visit `https://whatsapp-agent-dashboard.<account>.workers.dev`
2. Should see landing page
3. Click "Sign in" - should redirect to WorkOS
4. After auth, should see dashboard

### 4.3 Configure WhatsApp Webhook

In Meta Developer Console:
1. Go to WhatsApp > Configuration > Webhooks
2. Set Callback URL: `https://whatsapp-ai-agent.<account>.workers.dev/webhook`
3. Set Verify Token: Your `WHATSAPP_VERIFY_TOKEN`
4. Subscribe to: `messages`

---

## 5. Custom Domain (Optional)

### 5.1 Add Custom Domain to Workers

```bash
# For main worker
npx wrangler deployments add-route --zone-id <ZONE_ID> --pattern api.yourdomain.com/*

# For dashboard
cd dashboard
npx wrangler deployments add-route --zone-id <ZONE_ID> --pattern app.yourdomain.com/*
```

### 5.2 Update Redirect URIs

Don't forget to update `NEXT_PUBLIC_WORKOS_REDIRECT_URI` and WorkOS Dashboard settings.

---

## 6. Monitoring

### Cloudflare Dashboard
- **Workers & Pages** > View analytics, errors, requests
- **D1** > Query stats and database size
- **R2** > Storage usage

### Observability (enabled in wrangler.jsonc)
Both workers have `"observability": { "enabled": true }` for request logging.

---

## 7. Troubleshooting

### Common Issues

**"Module not found" errors in build**
```bash
rm -rf .next .open-next node_modules
npm install
npm run build
```

**WorkOS callback fails**
- Verify redirect URI matches exactly in WorkOS Dashboard
- Check `WORKOS_COOKIE_PASSWORD` is 32+ characters

**D1 queries timeout**
- Enable Smart Placement: `"placement": { "mode": "smart" }` in wrangler.jsonc

**Durable Object not found**
- Ensure migrations are applied: check `migrations` array in wrangler.jsonc

---

## 8. Cost Estimates (Workers Paid Plan - $5/mo base)

| Resource | Free Tier | Paid Tier |
|----------|-----------|-----------|
| Workers Requests | 100K/day | 10M/mo included |
| D1 Reads | 5M/day | 25B/mo included |
| D1 Writes | 100K/day | 50M/mo included |
| D1 Storage | 5GB | 5GB included |
| KV Reads | 100K/day | 10M/mo included |
| R2 Storage | 10GB | 10GB/mo included |
| Durable Objects | 100K requests | 1M/mo included |

For typical usage (500+ businesses, 10K messages/day), the $5/mo Workers Paid plan should be sufficient.

---

## Quick Deploy Commands

```bash
# Deploy everything from project root
cd /path/to/whatsapp-ai-agent

# 1. Deploy main worker
npm install && npx wrangler deploy

# 2. Deploy dashboard
cd dashboard && npm install && npm run deploy

# Done! Check your workers.dev URLs
```

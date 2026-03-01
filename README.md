# WhatsApp AI Sales Agent

> Turn any WhatsApp number into an AI-powered sales channel. Customers text naturally — the agent finds products, sends images, scores leads, and hands off to humans when it matters. Built for businesses that sell through conversation.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--5--mini-412991?logo=openai)](https://openai.com/)
[![Vercel AI SDK](https://img.shields.io/badge/Vercel_AI_SDK-v6-000?logo=vercel)](https://sdk.vercel.ai/)

---

## The Problem

Businesses on WhatsApp answer the same questions hundreds of times a day — "do you have this in black?", "what's in stock under $50?", "can I return this?" — and every unanswered message is a lost sale. Hiring chat agents doesn't scale. Generic chatbots sound robotic and can't actually search a product catalog.

## The Solution

A full-stack AI agent that plugs into any WhatsApp Business number and handles real sales conversations — product discovery, sizing help, order questions — while knowing when to step back and let a human take over. Every interaction is tracked, scored, and surfaced in a real-time dashboard.

**Not a chatbot. A sales agent.**

---

## What Makes It Different

- **Semantic product search** — customers say "something warm for a wedding" and get real results, not keyword matches. Powered by vector embeddings across the entire catalog.
- **Structured AI decisions** — the LLM returns validated JSON (action + message + product IDs + sentiment), not free text. Code enforces every business rule. The AI decides *what* to say; code decides *what to do*.
- **Automatic image delivery** — when the agent shows products, photos are sent automatically. No extra prompting needed.
- **Lead intelligence** — every message updates a lead score (0-100). Businesses see who's browsing vs. who's ready to buy, with full sentiment history.
- **Graceful handoff** — the agent doesn't spiral. After 3 clarifying questions or on escalation keywords, it loops in a human with full conversation context and an AI-generated summary.
- **Brand-native tone** — each business configures its own voice (streetwear casual, luxury formal, friendly neutral). The agent sounds like *their* team, not a bot.

---

## Architecture

```
Customer (WhatsApp)
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│               Cloudflare Workers (Edge)                  │
│                                                          │
│  Webhook ──▶ Dedup ──▶ Semantic Search ──▶ LLM ──▶ Send │
│    │          (KV)      (Vectorize)    (GPT-5-mini)  │   │
│    │                                      │          │   │
│    │                               Code Executor     │   │
│    │                             (Policy Gates)      │   │
│    ▼                                      ▼          ▼   │
│  Durable Objects              Business Actions   WhatsApp│
│  (Conversation State)         (Lead Scoring)     Response │
└──────────┬──────────┬──────────┬──────────┬──────────────┘
           │          │          │          │
     ┌─────▼──┐ ┌─────▼──┐ ┌────▼───┐ ┌───▼────┐
     │   D1   │ │Vectorize│ │   KV   │ │   R2   │
     │  (DB)  │ │(Search) │ │(Cache) │ │(Images)│
     └────────┘ └────────┘ └────────┘ └────────┘
```

**Core pattern: "LLM as Decision Engine, Code as Executor"**

1. **Webhook** receives WhatsApp message, deduplicates via KV, loads conversation state from Durable Object
2. **Semantic Search** matches natural language queries to products using Vectorize (768-dim embeddings)
3. **LLM Decision** — GPT-5-mini returns structured JSON validated by Zod schema (action, message, product IDs, sentiment)
4. **Code Executor** validates the decision, enforces policy gates, auto-attaches product images
5. **Fallback** — deterministic handoff to human if LLM fails or times out. The customer always gets a response.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Runtime** | Cloudflare Workers | Edge compute — sub-second cold starts, global distribution, no server management |
| **Database** | Cloudflare D1 (SQLite) | 14-table multi-tenant schema, zero-config, automatic replication |
| **Vector Search** | Cloudflare Vectorize | 768-dim semantic embeddings — "warm jacket" matches parkas and hoodies |
| **Embeddings** | Workers AI (EmbeddingGemma-300m) | On-network embedding generation — no external API calls for search |
| **LLM** | GPT-5-mini via Vercel AI SDK v6 | Structured output with Zod schema validation — type-safe AI decisions |
| **Conversation State** | Cloudflare Durable Objects | Atomic message ordering — prevents race conditions in concurrent chats |
| **Cache** | Cloudflare KV | Webhook deduplication + per-phone rate limiting |
| **Image Storage** | Cloudflare R2 | S3-compatible object storage for product images, zero egress fees |
| **Dashboard** | Next.js 16 + React 19 | 18 pages, 19 API routes — deployed on Cloudflare via OpenNext |
| **UI** | Radix UI + Tailwind CSS v4 | Accessible component system with motion animations |
| **Auth** | WorkOS AuthKit | Enterprise SSO — Google, Microsoft, SAML out of the box |
| **Email** | Resend | Transactional emails — handoff alerts, daily/weekly digest reports |
| **Charts** | Recharts | Analytics visualizations — lead funnel, message volume, peak hours |

**~25,000 lines of TypeScript.** Zero Python. Zero containers. Everything runs on Cloudflare's edge.

---

## Features

### AI Sales Agent
| Capability | How It Works |
|-----------|-------------|
| Semantic product search | Vector similarity via Vectorize — "something for date night" finds dresses and blazers |
| Structured LLM output | Zod-validated JSON schema — every AI response is type-checked before execution |
| Auto image delivery | Code-level decision — when showing products with images, photos are sent automatically |
| 3-tier business actions | Safe actions auto-execute, moderate actions warn, risky actions force human handoff |
| Clarification loop detection | Auto-handoff after 3 consecutive clarifying questions — prevents frustrating loops |
| Prompt injection protection | Input sanitization layer before LLM processing |
| PII masking | Phone numbers and emails redacted from all logs |
| Dead letter queue | Every failed operation is captured with full context for retry |

### Lead Scoring & Intelligence
| Signal | Impact |
|--------|--------|
| 5-stage funnel | new → engaged → warm → hot → converted — automatic progression |
| Behavioral scoring | Points for product views (+3), size requests (+5), purchase intent (+8), buying signals (+10) |
| Sentiment tracking | Extracted per-message by LLM — positive, neutral, negative, frustrated |
| Conversation summaries | AI-generated context preserved across sessions — the agent remembers |
| Smart follow-ups | Automated re-engagement for idle warm/hot leads via WhatsApp |

### Dashboard — 18 Pages

| Page | What It Does |
|------|-------------|
| **Analytics** | Message volume, response times, intent breakdown, sentiment distribution, lead funnel, peak hours — all with interactive charts |
| **Conversations** | Browse all threads, read full message history, reply directly via WhatsApp from the dashboard |
| **Leads** | Sortable/filterable table with scores, funnel stage, last contact, engagement history |
| **Lead Detail** | Individual lead profile — score breakdown, conversation history, interests, objections |
| **Products** | Full CRUD with image upload to R2, variant management (size/color/stock), CSV import/export |
| **Product Detail** | Edit product info, manage variants, preview images |
| **Escalations** | Open/resolved queue with urgency levels (low/medium/high/critical) and resolve actions |
| **Activity Feed** | Real-time event timeline — filterable by action type, with sentiment badges |
| **Follow-ups** | Track automated follow-up messages — response rates, replied badges |
| **System Health** | DLQ viewer, error breakdown by type, system metrics, one-click resolve |
| **FAQs** | Auto-generated FAQ management — approve, reject, or edit AI-suggested answers |
| **Promo Codes** | Discount code pool — create, track usage, set expiry |
| **Settings** | Brand tone, escalation keywords, working hours, AI toggle, greeting templates |
| **Appointments** | Customer booking requests with status tracking |
| **Account** | User profile and organization management |
| **Onboarding** | Guided setup wizard for new businesses |

### Multi-Tenant B2B Architecture
- **Per-business config** — brand tone, escalation keywords, working hours, greeting templates, AI on/off
- **Complete data isolation** — every query scoped by business ID, no data leakage between tenants
- **Onboarding wizard** — guided setup: connect WhatsApp, configure brand voice, upload catalog
- **WorkOS SSO** — enterprise auth with Google, Microsoft, SAML support

### Reliability & Safety
- **Idempotent webhooks** — KV-based deduplication prevents double-processing
- **Rate limiting** — per-phone throttling prevents abuse
- **Dead letter queue** — failed operations logged with full context + retry support
- **Atomic conversation state** — Durable Objects prevent race conditions in concurrent messages
- **Graceful degradation** — if the LLM fails, times out, or returns garbage, the customer still gets a response

### Background Jobs (Cron)
| Schedule | Job | Purpose |
|----------|-----|---------|
| Daily 3 AM | FAQ Generation | Analyze conversations, suggest FAQ answers |
| Daily 8 AM | Daily Digest | Email summary of conversations, leads, escalations |
| Monday 9 AM | Weekly Digest | Performance report with week-over-week trends |
| Every 4 hours | Follow-up Check | Re-engage idle warm/hot leads with personalized messages |

---

## Project Structure

```
whatsapp-ai-agent/
├── src/                              # Cloudflare Worker (AI Agent)
│   ├── index.ts                      # Entry — webhook, admin API, cron triggers
│   ├── ai/
│   │   ├── handler.ts                # Message processing pipeline
│   │   ├── llm.ts                    # GPT-5-mini + Zod structured output
│   │   ├── prompts.ts                # System prompt builder
│   │   ├── executor.ts               # Decision execution + policy gates
│   │   ├── environment.ts            # LLM context snapshot
│   │   ├── embeddings.ts             # Vectorize semantic search
│   │   ├── faq-generator.ts          # Auto-FAQ from conversation patterns
│   │   └── intents.ts                # Search query detection
│   ├── db/
│   │   ├── queries.ts                # D1 operations (50+ functions)
│   │   ├── schema.sql                # 14-table schema
│   │   ├── migrations/               # Schema migrations
│   │   └── dead-letter.ts            # DLQ operations
│   ├── durable-objects/
│   │   └── ConversationDO.ts         # Atomic conversation state
│   ├── whatsapp/
│   │   ├── messages.ts               # WhatsApp Cloud API
│   │   ├── interactive-builder.ts    # Buttons, lists, smart truncation
│   │   └── webhook.ts                # Signature verification
│   ├── notifications/
│   │   ├── handoff.ts                # Escalation emails
│   │   ├── digest.ts                 # Daily/weekly reports
│   │   └── follow-up.ts             # Smart re-engagement
│   └── utils/
│       ├── sanitize.ts               # Prompt injection protection
│       ├── pii-masking.ts            # Privacy-safe logging
│       ├── rate-limiter.ts           # Per-phone throttling
│       ├── lead-scoring.ts           # Score calculations
│       └── retry.ts                  # Retry with exponential backoff
├── dashboard/                         # Next.js 16 Admin Dashboard
│   ├── src/app/                       # 18 pages + 19 API routes
│   ├── src/components/                # UI components (Radix + Tailwind)
│   ├── src/lib/                       # DB queries, utils, worker proxy
│   └── wrangler.jsonc                 # Cloudflare deployment config
├── test/                              # Vitest test suite
└── wrangler.jsonc                     # Worker config (D1, KV, R2, Vectorize, DO)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) v4
- Cloudflare account with Workers, D1, Vectorize, Durable Objects, R2, KV
- OpenAI API key
- WhatsApp Business API credentials (Meta Business Suite)
- WorkOS account (dashboard auth)

### Install

```bash
git clone https://github.com/ukimsanov/whatsapp-ai-agent.git
cd whatsapp-ai-agent

npm install                          # Worker dependencies
cd dashboard && npm install && cd .. # Dashboard dependencies
```

### Cloudflare Resources

```bash
npx wrangler d1 create whatsapp-ai-agent-db
npx wrangler kv:namespace create CONVERSATIONS
npx wrangler r2 bucket create product-images
npx wrangler vectorize create product-embeddings --dimensions=768 --metric=cosine
```

### Secrets

```bash
# Worker
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
npx wrangler secret put WHATSAPP_APP_SECRET
npx wrangler secret put CLEANUP_SECRET
npx wrangler secret put RESEND_API_KEY

# Dashboard
cd dashboard
npx wrangler secret put WORKER_ADMIN_SECRET
npx wrangler secret put WORKOS_CLIENT_ID
npx wrangler secret put WORKOS_API_KEY
npx wrangler secret put WORKOS_COOKIE_PASSWORD
```

### Database

```bash
npx wrangler d1 execute whatsapp-ai-agent-db --remote --file=src/db/schema.sql

for f in src/db/migrations/*.sql; do
  npx wrangler d1 execute whatsapp-ai-agent-db --remote --file="$f"
done
```

### Deploy

```bash
npx wrangler deploy                                        # Worker
cd dashboard && npx opennextjs-cloudflare build && npx wrangler deploy  # Dashboard
```

---

## API

### Webhook
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/webhook` | WhatsApp verification challenge |
| `POST` | `/webhook` | Incoming message processing |

### Admin (Bearer token)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/admin/embed/business` | Generate product embeddings |
| `GET` | `/admin/embed/status` | Embedding job status |
| `POST` | `/admin/embed/test-search` | Test semantic search |
| `POST` | `/admin/embed/test-message` | Test message handling |
| `GET` | `/admin/dlq/stats` | Dead letter queue stats |
| `GET` | `/admin/dlq/entries` | List DLQ entries |
| `POST` | `/admin/dlq/resolve` | Resolve DLQ entry |
| `POST` | `/admin/send-message` | Send WhatsApp message from dashboard |

---

## Database

14 tables across the full platform:

| Table | Purpose |
|-------|---------|
| `businesses` | Tenant config — tone, keywords, hours, AI settings |
| `products` | Catalog — pricing, inventory, metadata, images |
| `product_variants` | Size/color/SKU combinations with per-variant stock |
| `leads` | Customer profiles — scores (0-100), funnel stage |
| `conversation_summaries` | AI-generated memory across sessions |
| `message_events` | Full audit log — action, sentiment, timing |
| `human_flags` | Escalation queue with urgency levels |
| `dead_letter_queue` | Failed operation recovery |
| `follow_ups` | Automated follow-up tracking |
| `auto_faqs` | AI-generated FAQ management |
| `appointments` | Booking requests |
| `callback_requests` | Customer callback tracking |
| `promo_codes` | Discount code pool |
| `user_businesses` | WorkOS user ↔ business mapping |

---

## License

MIT

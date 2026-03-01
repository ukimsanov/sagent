# WhatsApp AI Sales Agent

> Multi-tenant conversational commerce platform that turns WhatsApp into an intelligent sales channel. AI-powered product discovery, lead scoring, and human handoff — all on Cloudflare's edge.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--5--mini-412991?logo=openai)](https://openai.com/)

---

## What It Does

A B2B platform where businesses connect their WhatsApp number and get an AI sales assistant that:

- **Finds products** — customers say "show me hoodies under $100" and get real results from the catalog
- **Sounds human** — adapts to each brand's tone (casual, friendly, professional) with natural texting style
- **Sends product images** — automatically attaches product photos when showing items
- **Scores leads** — tracks engagement and surfaces hot leads ready to buy
- **Hands off gracefully** — escalates to humans when the AI can't help, with full conversation context
- **Provides analytics** — dashboard with conversation insights, sentiment tracking, and lead funnel

---

## Architecture

```
WhatsApp Cloud API
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Workers (Edge)                    │
│                                                          │
│  Webhook ──▶ Semantic Search ──▶ LLM Decision ──▶ Send  │
│    │          (Vectorize)      (GPT-5-mini)       │      │
│    │                               │              │      │
│    │                          Code Executor       │      │
│    │                        (Policy Gates)        │      │
│    ▼                               ▼              ▼      │
│  Durable Objects          Business Actions    WhatsApp   │
│  (Conversation State)     (Lead Scoring)      Response   │
└──────────┬──────────┬──────────┬──────────┬──────────────┘
           │          │          │          │
     ┌─────▼──┐ ┌─────▼──┐ ┌────▼───┐ ┌───▼────┐
     │   D1   │ │Vectorize│ │   KV   │ │   R2   │
     │  (DB)  │ │(Search) │ │(Cache) │ │(Images)│
     └────────┘ └────────┘ └────────┘ └────────┘
```

**Core pattern: "LLM as Decision Engine, Code as Executor"**

1. **Webhook** receives WhatsApp message, deduplicates via KV, loads conversation state from Durable Object
2. **Semantic Search** matches natural language queries to products using Vectorize embeddings
3. **LLM Decision** — GPT-5-mini returns structured JSON (action, message, product IDs, sentiment)
4. **Code Executor** validates the decision, enforces policy gates, auto-attaches product images
5. **Fallback** — deterministic handoff to human if LLM fails or times out

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Cloudflare Workers | Edge compute, <5s global response |
| **Database** | Cloudflare D1 (SQLite) | Multi-tenant data, 14 tables |
| **Vector Search** | Cloudflare Vectorize | Semantic product embeddings (768-dim) |
| **Embeddings** | Workers AI (bge-base-en-v1.5) | Text → vector conversion |
| **LLM** | GPT-5-mini via Vercel AI SDK | Structured output with Zod schema validation |
| **Conversation State** | Cloudflare Durable Objects | Atomic message ordering, race condition prevention |
| **Cache** | Cloudflare KV | Webhook deduplication, rate limiting |
| **Image Storage** | Cloudflare R2 | Product image hosting |
| **Dashboard** | Next.js 15 + React 19 | Admin UI on Cloudflare Pages |
| **UI Components** | Radix UI + Tailwind CSS v4 | shadcn/ui component system |
| **Auth** | WorkOS AuthKit | B2B SSO authentication |
| **Email** | Resend API | Handoff notifications, daily/weekly digests |

---

## Features

### AI Agent (Worker)
- **Semantic product search** — "something warm for winter" matches hoodies and sweaters
- **Structured LLM output** — Zod schema ensures type-safe, validated AI decisions
- **Auto image sending** — product photos sent automatically when showing items
- **3-tier business actions** — safe actions auto-execute, risky ones force human handoff
- **Clarification loop detection** — auto-handoff after 3 consecutive clarifying questions
- **Prompt injection protection** — input sanitization before LLM processing
- **PII masking** — phone numbers and emails redacted from logs
- **Dead letter queue** — failed operations captured for retry

### Lead Management
- **5-stage funnel** — new → engaged → warm → hot → converted
- **Automatic scoring** — points for product views, size requests, purchase intent
- **Sentiment tracking** — positive, neutral, negative, frustrated (extracted by LLM)
- **Conversation summaries** — AI-generated context preserved across sessions
- **Smart follow-ups** — automated re-engagement for idle warm/hot leads

### Dashboard (10+ pages)
- **Analytics overview** — message volume, response time, intent breakdown, sentiment, lead funnel, peak hours
- **Conversations** — browse threads, view messages, reply directly via WhatsApp
- **Leads** — sortable/filterable lead table with scores, status, contact history
- **Products** — CRUD with image upload, variant management (size/color/stock), CSV import/export
- **Escalations** — open/resolved queue with urgency levels and resolve actions
- **Activity feed** — filterable event log with action types and sentiment badges
- **Follow-ups** — tracking page for automated follow-up messages
- **System health** — DLQ viewer with resolve actions
- **FAQs** — auto-generated FAQ management (approve/reject/edit)
- **Settings** — brand tone, escalation keywords, working hours, AI toggle, WhatsApp connection
- **Promo codes** — discount code management

### Multi-tenant B2B
- **Per-business config** — brand tone, escalation keywords, working hours, greeting templates
- **Data isolation** — all queries scoped by business ID
- **Onboarding wizard** — guided setup for new businesses
- **WorkOS SSO** — enterprise authentication with role-based access

### Reliability
- **Idempotent webhooks** — KV deduplication prevents double-processing
- **Rate limiting** — per-phone throttling prevents abuse
- **Dead letter queue** — failed operations logged with retry support
- **Atomic state** — Durable Objects prevent conversation race conditions
- **Graceful fallback** — always responds even when LLM fails

### Background Jobs (Cron)
- **Daily digest** — email summary of conversations, leads, and escalations
- **Weekly digest** — weekly performance report
- **Smart follow-ups** — re-engage idle leads with personalized messages
- **Auto-FAQ generation** — identify common questions and generate answers

---

## Project Structure

```
whatsapp-ai-agent/
├── src/                          # Cloudflare Worker
│   ├── index.ts                  # Entry point (webhook, admin routes, cron)
│   ├── ai/
│   │   ├── handler.ts            # Message processing pipeline
│   │   ├── llm.ts                # GPT-5-mini with Zod structured output
│   │   ├── prompts.ts            # System prompt + environment builder
│   │   ├── executor.ts           # Decision execution + policy gates
│   │   ├── environment.ts        # Context snapshot for LLM
│   │   ├── embeddings.ts         # Vectorize semantic search
│   │   ├── faq-generator.ts      # Auto-FAQ from conversation patterns
│   │   └── intents.ts            # Search query detection
│   ├── db/
│   │   ├── queries.ts            # All D1 operations (50+ functions)
│   │   ├── schema.sql            # 14-table schema
│   │   ├── migrations/           # Schema migrations
│   │   └── dead-letter.ts        # DLQ operations
│   ├── durable-objects/
│   │   └── ConversationDO.ts     # Atomic conversation state
│   ├── whatsapp/
│   │   ├── messages.ts           # WhatsApp Cloud API integration
│   │   ├── interactive-builder.ts # Buttons, lists, smart truncation
│   │   └── webhook.ts            # Webhook verification
│   ├── notifications/
│   │   ├── handoff.ts            # Escalation emails (Resend)
│   │   ├── digest.ts             # Daily/weekly email digests
│   │   └── follow-up.ts          # Smart follow-up messages
│   └── utils/
│       ├── sanitize.ts           # Prompt injection protection
│       ├── pii-masking.ts        # Privacy-safe logging
│       ├── rate-limiter.ts       # Per-phone rate limiting
│       ├── lead-scoring.ts       # Score calculations
│       └── retry.ts              # Retry with backoff
├── dashboard/                     # Next.js 15 Admin Dashboard
│   ├── src/app/                   # 10+ pages (conversations, leads, products, etc.)
│   ├── src/components/            # Reusable UI components (shadcn/ui)
│   ├── src/lib/                   # DB queries, utils, worker proxy
│   └── wrangler.jsonc             # Cloudflare Pages config
├── test/                          # Vitest tests
└── wrangler.jsonc                 # Worker config (D1, KV, R2, Vectorize, DO)
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) 4.x
- Cloudflare account (Workers, D1, Vectorize, Durable Objects, R2, KV)
- OpenAI API key
- WhatsApp Business API credentials (Meta Business Suite)
- WorkOS account (dashboard auth)

### Installation

```bash
git clone https://github.com/ukimsanov/whatsapp-ai-agent.git
cd whatsapp-ai-agent

# Install worker dependencies
npm install

# Install dashboard dependencies
cd dashboard && npm install && cd ..
```

### Cloudflare Resources

```bash
# Create D1 database
npx wrangler d1 create whatsapp-ai-agent-db

# Create KV namespace
npx wrangler kv:namespace create CONVERSATIONS

# Create R2 bucket
npx wrangler r2 bucket create product-images

# Create Vectorize index
npx wrangler vectorize create product-embeddings --dimensions=768 --metric=cosine
```

### Secrets

```bash
# Worker secrets
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
npx wrangler secret put WHATSAPP_APP_SECRET
npx wrangler secret put CLEANUP_SECRET
npx wrangler secret put RESEND_API_KEY

# Dashboard secrets
cd dashboard
npx wrangler secret put WORKER_ADMIN_SECRET
npx wrangler secret put WORKOS_CLIENT_ID
npx wrangler secret put WORKOS_API_KEY
npx wrangler secret put WORKOS_COOKIE_PASSWORD
```

### Database Setup

```bash
npx wrangler d1 execute whatsapp-ai-agent-db --remote --file=src/db/schema.sql

# Run migrations
for f in src/db/migrations/*.sql; do
  npx wrangler d1 execute whatsapp-ai-agent-db --remote --file="$f"
done
```

### Deploy

```bash
# Worker
npx wrangler deploy

# Dashboard
cd dashboard
npx opennextjs-cloudflare build && npx wrangler deploy
```

---

## API Endpoints

### Webhook
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/webhook` | WhatsApp webhook verification |
| `POST` | `/webhook` | Incoming message processing |

### Admin (Bearer token required)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/admin/embed/business` | Embed products for semantic search |
| `GET` | `/admin/embed/status` | Embedding status |
| `POST` | `/admin/embed/test-search` | Test semantic search |
| `POST` | `/admin/embed/test-message` | Test message handling |
| `GET` | `/admin/dlq/stats` | Dead letter queue stats |
| `GET` | `/admin/dlq/entries` | List DLQ entries |
| `POST` | `/admin/dlq/resolve` | Resolve DLQ entry |
| `POST` | `/admin/send-message` | Send WhatsApp message from dashboard |

### Cron Schedules
| Schedule | Job |
|----------|-----|
| `0 3 * * *` | FAQ generation |
| `0 8 * * *` | Daily digest + follow-ups |
| `0 9 * * 1` | Weekly digest |
| `0 */4 * * *` | Follow-up checks |

---

## Database Schema

14 tables covering the full platform:

| Table | Purpose |
|-------|---------|
| `businesses` | Multi-tenant config (tone, keywords, hours, AI settings) |
| `products` | Catalog with pricing, inventory, metadata, images |
| `product_variants` | Size/color/SKU combinations with per-variant stock |
| `leads` | Customer profiles with scores (0-100) and funnel status |
| `conversation_summaries` | AI-generated context for long-term memory |
| `message_events` | Analytics and audit log (action, sentiment, timing) |
| `human_flags` | Escalation queue with urgency levels |
| `dead_letter_queue` | Failed operation recovery |
| `follow_ups` | Smart follow-up message tracking |
| `auto_faqs` | Auto-generated FAQ management |
| `appointments` | Booking requests |
| `callback_requests` | Customer callback tracking |
| `promo_codes` | Discount code pool |
| `user_businesses` | WorkOS user ↔ business mapping |

---

## License

MIT

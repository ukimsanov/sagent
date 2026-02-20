# WhatsApp AI Sales Agent

> Multi-tenant conversational commerce platform that turns WhatsApp into an intelligent sales channel using LLM-powered decision making and semantic product search.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991?logo=openai)](https://openai.com/)

---

## Highlights

- **LLM Decision Engine** - GPT-4o-mini with structured JSON output for predictable, auditable conversation decisions
- **Semantic Product Search** - Cloudflare Vectorize + bge-base-en-v1.5 embeddings for natural language queries
- **Atomic Conversation State** - Durable Objects prevent race conditions in concurrent message handling
- **Multi-tenant B2B Architecture** - Per-business configuration, data isolation, and analytics
- **WhatsApp 2026 Compliant** - Structured business bot for sales/support (not general-purpose AI)

---

## Architecture

```
                                    WhatsApp Cloud API
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Cloudflare Workers (Edge)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐    │
│  │   Webhook Handler │────▶│   Fast-Path Check │────▶│   LLM Decision   │    │
│  │   (Deduplication) │     │   (No LLM needed) │     │   Engine (GPT-4o)│    │
│  └──────────────────┘     └──────────────────┘     └──────────────────┘    │
│           │                        │                        │               │
│           │                        │                        ▼               │
│           │                        │              ┌──────────────────┐      │
│           │                        │              │  Code Executor   │      │
│           │                        │              │  (Policy Gates)  │      │
│           │                        │              └──────────────────┘      │
│           │                        │                        │               │
│           ▼                        ▼                        ▼               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Response Assembly                             │   │
│  │              (Text + Product Images + Lead Scoring)                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
        │                    │                    │                    │
        ▼                    ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Cloudflare  │    │  Cloudflare  │    │  Cloudflare  │    │  Cloudflare  │
│     D1       │    │   Vectorize  │    │    Durable   │    │      R2      │
│  (Database)  │    │  (Embeddings)│    │   Objects    │    │   (Images)   │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### Core Pattern: "LLM as Decision Engine, Code as Executor"

1. **Fast-path** - Greetings, farewells, vague requests handled without LLM (cost-efficient)
2. **Semantic Search** - Natural language queries matched to products via vector embeddings
3. **LLM Decision** - GPT-4o-mini returns structured JSON with action + message + product IDs
4. **Code Execution** - Business logic validates and executes decisions with policy gates
5. **Fallback Ladder** - Deterministic responses when LLM fails or times out

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Cloudflare Workers | Edge computing, <5s global response |
| **Database** | Cloudflare D1 (SQLite) | Multi-tenant data storage |
| **Vector Search** | Cloudflare Vectorize | Semantic product embeddings |
| **Embeddings** | Workers AI (bge-base-en-v1.5) | 768-dimensional vectors |
| **LLM** | OpenAI GPT-4o-mini | Structured conversation decisions |
| **State** | Cloudflare Durable Objects | Atomic conversation management |
| **Cache** | Cloudflare KV | Deduplication, rate limiting |
| **Storage** | Cloudflare R2 | Product image hosting |
| **Frontend** | Next.js 15 + React 19 | Admin dashboard |
| **UI** | Radix UI + TailwindCSS v4 | Component library |
| **Auth** | WorkOS AuthKit | B2B authentication |
| **Email** | Resend API | Handoff notifications |

---

## Features

### Conversational AI
- **Semantic product search** - "show me something warm" finds hoodies and sweaters
- **Natural language understanding** - Handles variations like "got any jeans?" or "looking for pants"
- **Clarification detection** - Asks smart follow-ups for vague requests
- **Escalation keywords** - Immediate handoff on "refund", "lawyer", "scam", etc.
- **Clarification loop prevention** - Auto-handoff after 3 consecutive clarifications

### Lead Management
- **5-stage sales funnel** - new → engaged → warm → hot → converted
- **Automatic scoring** - Points for product views, size requests, purchase intent
- **Lead status tracking** - Progression based on engagement depth
- **Conversation summaries** - AI-generated context for long-term memory

### Multi-tenant B2B
- **Per-business configuration** - Brand tone, escalation keywords, working hours
- **Data isolation** - All queries scoped by business ID
- **Custom greetings** - Personalized opening messages per business
- **After-hours handling** - Custom messages outside business hours

### Reliability
- **Idempotent webhooks** - KV deduplication prevents duplicate processing
- **Rate limiting** - Per-phone throttling prevents abuse
- **Dead letter queue** - Failed operations logged for retry/debugging
- **Atomic state** - Durable Objects prevent race conditions

### Dashboard
- **Conversations view** - Browse all customer conversations
- **Lead analytics** - Score distribution, status breakdown
- **Product catalog** - CRUD operations with image upload
- **Settings** - Brand configuration, AI toggle, escalation rules

---

## Project Structure

```
whatsapp-ai-agent/
├── src/
│   ├── index.ts              # Worker entry point (webhook, admin, cron)
│   ├── ai/
│   │   ├── handler.ts        # LLM decision engine (718 lines)
│   │   ├── llm.ts            # OpenAI API with structured output
│   │   ├── prompts.ts        # System prompts for sales mindset
│   │   ├── executor.ts       # Decision execution with policy gates
│   │   ├── environment.ts    # Context snapshot builder
│   │   ├── embeddings.ts     # Vectorize semantic search
│   │   └── intents.ts        # Rule-based intent classification
│   ├── db/
│   │   ├── queries.ts        # All D1 database operations
│   │   ├── schema.sql        # Database schema (12 tables)
│   │   ├── seed.sql          # Demo data
│   │   └── migrations/       # Schema migrations
│   ├── durable-objects/
│   │   └── ConversationDO.ts # Atomic conversation state
│   ├── whatsapp/
│   │   ├── messages.ts       # WhatsApp API integration
│   │   └── webhook.ts        # Webhook verification
│   ├── notifications/
│   │   └── handoff.ts        # Email notifications (Resend)
│   └── utils/
│       ├── sanitize.ts       # Prompt injection protection
│       ├── pii-masking.ts    # Privacy-safe logging
│       ├── rate-limiter.ts   # Per-phone rate limiting
│       └── lead-scoring.ts   # Score calculations
├── dashboard/                 # Next.js admin dashboard
│   ├── src/app/
│   │   ├── conversations/    # Conversation browser
│   │   ├── leads/            # Lead management
│   │   ├── products/         # Product catalog CRUD
│   │   └── settings/         # Business configuration
│   └── wrangler.jsonc        # Cloudflare Pages config
├── test/                      # Vitest tests
├── wrangler.jsonc            # Worker configuration
├── ARCHITECTURE.md           # System design documentation
├── CURRENT_STATE.md          # Progress tracking
└── TESTING.md                # Testing guide
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) 4.x
- Cloudflare account with Workers, D1, Vectorize, Durable Objects, R2
- OpenAI API key
- WhatsApp Business API credentials
- WorkOS account (for dashboard auth)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd whatsapp-ai-agent

# Install dependencies
npm install

# Install dashboard dependencies
cd dashboard && npm install && cd ..
```

### Configuration

1. **Set up Cloudflare resources:**
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

2. **Configure secrets:**
```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
npx wrangler secret put WHATSAPP_APP_SECRET
npx wrangler secret put CLEANUP_SECRET
npx wrangler secret put RESEND_API_KEY  # Optional
```

3. **Update wrangler.jsonc** with your resource IDs

4. **Initialize database:**
```bash
npx wrangler d1 execute whatsapp-ai-agent-db --remote --file=src/db/schema.sql
npx wrangler d1 execute whatsapp-ai-agent-db --remote --file=src/db/seed.sql
```

### Deployment

```bash
# Deploy worker
npm run deploy

# Deploy dashboard
cd dashboard && npm run deploy
```

### Embed Products for Semantic Search

```bash
curl -X POST "https://your-worker.workers.dev/admin/embed/business" \
  -H "Authorization: Bearer YOUR_CLEANUP_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"business_id":"your-business-id"}'
```

---

## API Endpoints

### Webhook
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/webhook` | WhatsApp webhook verification |
| `POST` | `/webhook` | Incoming message processing |

### Admin (Requires Bearer token)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/admin/embed/business` | Embed all products for a business |
| `GET` | `/admin/embed/status` | Check embedding status |
| `POST` | `/admin/embed/test-search` | Test semantic search |
| `POST` | `/admin/embed/test-message` | Test message handling (bypasses WhatsApp) |
| `GET` | `/admin/dlq/stats` | Dead letter queue statistics |
| `GET` | `/admin/dlq/entries` | List unresolved DLQ entries |
| `POST` | `/admin/dlq/resolve` | Resolve DLQ entry |

### Utilities
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/cleanup` | Clean up test data |

---

## Testing

See [TESTING.md](TESTING.md) for comprehensive testing guide.

```bash
# Run unit tests
npm test

# Test message handling (bypasses WhatsApp)
curl -X POST "https://your-worker.workers.dev/admin/embed/test-message" \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"business_id":"demo-store-001","from":"test-001","text":"show me hoodies"}'

# Tail logs
npx wrangler tail whatsapp-ai-agent --format=pretty
```

---

## Database Schema

### Core Tables
- **businesses** - Multi-tenant configuration (brand tone, escalation keywords, hours)
- **products** - Catalog with pricing, inventory, metadata, images
- **leads** - Customer profiles with scores and status tracking
- **conversation_summaries** - AI-generated context for long-term memory
- **message_events** - Analytics and audit log
- **human_flags** - Escalation tracking
- **dead_letter_queue** - Failed operation recovery

---

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...
WHATSAPP_ACCESS_TOKEN=EAA...
WHATSAPP_VERIFY_TOKEN=...
CLEANUP_SECRET=...

# Optional
WHATSAPP_APP_SECRET=...      # Webhook signature validation
RESEND_API_KEY=re_...        # Email notifications
```

---

## WhatsApp 2026 Policy Compliance

This project is **fully compliant** with Meta's January 2026 policy update. The ban affects general-purpose AI assistants (ChatGPT, Copilot on WhatsApp), not structured business bots for sales and support.

**Allowed use cases (this project):**
- Product search and recommendations
- Order tracking and support
- Lead qualification
- Sales automation

---

## License

MIT

---

## Acknowledgments

- Built on [Cloudflare Workers](https://workers.cloudflare.com/)
- LLM powered by [OpenAI](https://openai.com/)
- Dashboard framework by [Next.js](https://nextjs.org/)
- UI components from [Radix UI](https://www.radix-ui.com/)

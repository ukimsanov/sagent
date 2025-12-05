# WhatsApp AI Sales Agent - Architecture

## Overview

Multi-tenant WhatsApp sales bot built on Cloudflare Workers. Helps businesses automate customer conversations with AI that proactively shows products and closes sales.

**Tech Stack:**
- Runtime: Cloudflare Workers (edge)
- Database: Cloudflare D1 (SQLite)
- Vector Search: Cloudflare Vectorize
- Embeddings: Workers AI (bge-base-en-v1.5)
- LLM: OpenAI gpt-4o-mini
- Conversation State: Durable Objects (atomic)
- Dashboard: Next.js on Cloudflare Pages

---

## Key Components

### Entry Points

| File | Purpose |
|------|---------|
| `src/index.ts` | Main worker entry, webhook handling, admin endpoints |
| `wrangler.jsonc` | Cloudflare bindings (D1, Vectorize, DO, AI) |

### AI Pipeline

| File | Purpose |
|------|---------|
| `src/ai/handler.ts` | Message processing pipeline, intent detection, edge case handling |
| `src/ai/llm.ts` | OpenAI API integration, structured JSON output |
| `src/ai/prompts.ts` | System prompts for proactive sales mindset |
| `src/ai/executor.ts` | Execute LLM decisions (product search, actions) |
| `src/ai/environment.ts` | Build context snapshot for LLM |
| `src/ai/embeddings.ts` | Vectorize semantic search |
| `src/ai/intents.ts` | Rule-based intent classification |

### Data Layer

| File | Purpose |
|------|---------|
| `src/db/queries.ts` | All D1 database operations |
| `src/db/schema.sql` | Database schema |
| `src/db/seed.sql` | Demo data |
| `src/durable-objects/ConversationDO.ts` | Atomic conversation state |
| `src/utils/conversation-do-client.ts` | DO client interface |

### Utilities

| File | Purpose |
|------|---------|
| `src/utils/lead-scoring.ts` | Calculate lead scores |
| `src/utils/sanitize.ts` | Input sanitization (prompt injection protection) |
| `src/utils/pii-masking.ts` | Mask phone numbers in logs |
| `src/notifications/handoff.ts` | Email notifications for human handoff |

---

## Data Flow

```
WhatsApp Webhook
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. RECEIVE & VALIDATE                                       │
│    - Verify webhook signature                               │
│    - Parse message (text, image, audio)                     │
│    - Identify business by WhatsApp phone ID                 │
│    - Get or create lead                                     │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. DEDUPLICATE (Durable Object)                             │
│    - Check message ID hasn't been processed                 │
│    - Atomic conversation state update                       │
│    - Load last ~2000 tokens of history                      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. FAST-PATH CHECKS (No LLM)                                │
│    - Escalation keywords? → Immediate handoff               │
│    - Pure greeting? → Template response                     │
│    - Vague request? → Clarifying question                   │
│    - Catalog inquiry? → Show top products per category      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. SEMANTIC SEARCH (Vectorize)                              │
│    - Extract search query from message                      │
│    - Embed query with Workers AI                            │
│    - Search product vectors (top 10)                        │
│    - Fetch full product data from D1                        │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. LLM DECISION (OpenAI)                                    │
│    - Build environment snapshot (customer, products, rules) │
│    - Send to gpt-4o-mini with proactive sales prompt        │
│    - Parse JSON response (action, message, product_ids)     │
│    - Execute business actions (log_interest, update_status) │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. RESPONSE & ANALYTICS                                     │
│    - Send WhatsApp message (+ images if requested)          │
│    - Store assistant message in conversation                │
│    - Log message_event for dashboard                        │
│    - Update lead score (background)                         │
│    - Trigger summarization if overflow (background)         │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Key Tables)

### businesses
Multi-tenant configuration per business.
```sql
- id, name, whatsapp_phone_id
- brand_tone ('friendly', 'professional', 'casual')
- escalation_keywords (JSON array)
- working_hours, timezone
- auto_handoff_threshold
```

### leads
Customer tracking per business.
```sql
- id, business_id, whatsapp_number
- name, email, score (0-100)
- status ('new', 'engaged', 'warm', 'hot', 'converted', 'lost')
- message_count, first_contact, last_contact
```

### products
Product catalog per business.
```sql
- id, business_id, name, description
- price, currency, category
- in_stock, stock_quantity
- metadata (JSON: sizes, colors)
```

### message_events
Analytics for dashboard.
```sql
- id, business_id, lead_id, timestamp
- action ('show_products', 'ask_clarification', 'handoff', ...)
- intent_type, user_message, agent_response
- flagged_for_human, clarification_count
```

### conversation_summaries
Long-term memory per lead.
```sql
- lead_id, summary, key_interests, objections, next_steps
- message_count (race condition prevention)
- updated_at
```

---

## Edge Case Handling

| Edge Case | Detection | Action |
|-----------|-----------|--------|
| Escalation keywords | `containsEscalationKeyword()` | Immediate handoff |
| 3+ clarifications | `countConsecutiveClarifications()` | Auto-handoff |
| ALL CAPS (frustration) | >70% caps in message | Flag as high severity |
| Zero products | Empty search results | Suggest categories |
| Token overflow | >2000 tokens in history | Trigger summarization |
| Vague request | "show me something" | Ask clarifying question |
| Repeated question | Same first 3 words 3x | Auto-handoff |

---

## Key Constants

```typescript
// Conversation limits
MAX_TOKENS = 2000;           // ~8000 chars of history
CHARS_PER_TOKEN = 4;

// Clarification loop
MAX_CONSECUTIVE_CLARIFICATIONS = 3;

// Lead score thresholds
ENGAGED_THRESHOLD = 10;
WARM_THRESHOLD = 30;
HOT_THRESHOLD = 55;

// LLM settings
MODEL = 'gpt-4o-mini';
MAX_COMPLETION_TOKENS = 500;
TEMPERATURE = 0.7;
```

---

## Admin Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/admin/embed/business` | POST | Embed all products for a business |
| `/admin/embed/status` | GET | Check if business has embeddings |
| `/admin/embed/test-search` | POST | Test semantic search |
| `/admin/embed/test-message` | POST | Test full message handling |
| `/admin/dlq/*` | GET/POST | Dead letter queue monitoring |
| `/admin/cleanup` | POST | Cleanup old data |

**Auth:** All admin endpoints require `Authorization: Bearer [CLEANUP_SECRET]`

---

## Environment Variables

```bash
# Secrets (wrangler secret put)
OPENAI_API_KEY=sk-...
WHATSAPP_ACCESS_TOKEN=EAA...
WHATSAPP_APP_SECRET=...  # Optional: webhook signature validation
CLEANUP_SECRET=...       # Admin endpoint auth

# In wrangler.jsonc
WHATSAPP_VERIFY_TOKEN=... # Webhook verification
```

---

## Deployment

```bash
# Deploy worker
npx wrangler deploy

# Run migrations
npx wrangler d1 execute whatsapp-ai-agent-db --remote --file=src/db/schema.sql

# Embed products for a business
curl -X POST "https://agent.ularkimsanov.com/admin/embed/business" \
  -H "Authorization: Bearer $CLEANUP_SECRET" \
  -d '{"business_id":"demo-store-001"}'
```

---

## URLs

- **Agent:** https://agent.ularkimsanov.com
- **Dashboard:** https://dashboard.ularkimsanov.com
- **Worker (direct):** https://whatsapp-ai-agent.ularkimsanov7.workers.dev

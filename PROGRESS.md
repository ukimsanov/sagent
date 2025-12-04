# WhatsApp AI Sales Agent - Progress & Plan

## Global Goal

Build a **production-ready WhatsApp AI sales agent** that:
- Feels like talking to a real, helpful store employee
- Never hallucinates products
- Handles edge cases gracefully (frustration, complaints, handoffs)
- Provides B2B controls and visibility

---

## Architecture Overview

```
WhatsApp Cloud API → Cloudflare Worker → Code-First Handler → Response
                          ↓
                    D1 (SQLite) + KV (Conversations) + R2 (Images)
```

**Key Design Decisions:**
- **Code-first, LLM-last**: Rule-based intent classification, LLM only for copywriting
- **Single LLM call max** per message (gpt-5-mini via Responses API)
- **Deterministic fallbacks**: Templates when LLM fails or 0 results
- **Multi-tenant**: One worker serves multiple businesses

---

## Phase Progress

### ✅ Phase 1: Foundation (DONE - v1)
- Reliable webhook handling
- Signature verification
- D1 database with products, leads, conversations
- Basic intent classification (4 types)
- Single LLM call for product copy
- 20s timeout with fallback

### ✅ Phase 2: "Feels Like a Person" (DONE - December 2025)

**Completed Tasks:**
1. ✅ Removed deprecated tool-calling agent (`agent.ts`, `tools.ts`)
2. ✅ Cleaned up `index.ts` - single code path
3. ✅ Simplified `prompts.ts` - only summarization prompts
4. ✅ Removed feature flag from `wrangler.jsonc`
5. ✅ Created `src/ai/intents.ts` - enhanced intent classification
6. ✅ Enhanced `handler.ts` - structured output, clarifying questions
7. ✅ Upgraded system prompt with persona and tone
8. ✅ Fixed Responses API format (use `instructions` param, not `role: system`)
9. ✅ Increased `max_output_tokens` to 2048 (GPT-5-mini is a reasoning model)

**New Capabilities:**
- 10 intent types (was 4): greeting, thanks, handoff_request, product_search, sizing_help, pricing_question, order_status, complaint, recommendation, comparison
- Frustration detection with severity levels
- Auto-handoff after 3+ clarifying questions
- Vague query detection with smart clarifying questions
- Structured response tracking (`action` field for analytics)

### ✅ Phase 3: Intelligence & Structure (DONE - December 2025)

**Completed:**
- [x] Add `action` logging for analytics (`message_events` table)
- [x] Implement soft rules (3 clarifications → auto-handoff)
- [x] Build internal dashboard (Next.js 15 + OpenNext for Cloudflare)
  - Leads list with scores and status
  - Conversation detail view with full message history
  - Real-time data from D1 database
- [x] Test all 10 conversation flows
- [x] Fixed sizing_help regex bug (singular → plural support)

### ✅ Phase 4: B2B Features (DONE - December 2025)

**Completed:**
- [x] Tenant-aware config (brand voice, escalation rules, store hours)
  - Added `brand_tone`, `greeting_template`, `escalation_keywords` columns
  - Added `after_hours_message`, `handoff_email`, `handoff_phone` columns
  - Added `auto_handoff_threshold`, `working_hours`, `timezone` columns
  - Created migration file: `src/db/migrations/001_tenant_config.sql`
- [x] Handler integration with tenant config
  - Escalation keyword detection (immediate handoff)
  - Store hours check with after-hours message
  - Custom greeting templates with `{{name}}` placeholder
  - Brand tone affects LLM personality (friendly/professional/casual)
- [x] Human handoff routing to merchant's team
  - Email notifications via Resend API
  - Includes customer details, recent messages, dashboard link
  - Non-blocking background processing
- [x] Dashboard settings page
  - Brand Voice section (tone, greeting template)
  - Handoff settings (email, phone, threshold, escalation keywords)
  - Store Hours settings (timezone, working hours JSON, after-hours message)
  - Real-time save with API route
- [x] Per-tenant analytics widgets
  - Lead funnel visualization (new → engaged → warm → hot → converted)
  - Customer intent breakdown (top intents by count)
  - Top product searches (ranked by frequency)

### 🔲 Phase 5: Scale & Polish

**Planned:**
- [ ] Background summarization & lead scoring
- [ ] Rate limiting, abuse protection
- [ ] PII masking in logs
- [ ] Hardening for production

---

## File Structure (Current)

```
src/
├── index.ts              # Entry point, webhook handling
├── ai/
│   ├── handler.ts        # Code-first handler (main logic)
│   ├── intents.ts        # Intent classification module
│   ├── prompts.ts        # Summarization prompts only
│   └── transcription.ts  # Audio → text (Whisper)
├── db/
│   ├── queries.ts        # D1 operations
│   ├── schema.sql        # Database schema
│   └── seed.sql          # Demo data
├── whatsapp/
│   ├── webhook.ts        # Verification, parsing
│   ├── messages.ts       # Sending messages
│   ├── media.ts          # Media handling
│   └── types.ts          # Type definitions
└── utils/
    └── kv.ts             # Conversation storage
```

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `businesses` | Multi-tenant config (system_prompt, goals, address, hours) |
| `products` | Catalog (name, price, category, metadata, image_url) |
| `leads` | Customer tracking (score 0-100, status, email, name) |
| `conversation_summaries` | LLM context (interests, objections, next_steps) |
| `human_flags` | Escalations (urgency, reason, resolved) |
| `appointments` | Booking system |
| `callback_requests` | Phone call scheduling |
| `promo_codes` | Discount pool |

---

## Intent Types

| Intent | Trigger | Handler |
|--------|---------|---------|
| `greeting` | "hi", "hello", "hey" | Deterministic template |
| `thanks` | "thanks", "thank you" | Deterministic template |
| `handoff_request` | "human", "agent", "person" | Flag for human |
| `product_search` | Default for product queries | Search + LLM copywriter |
| `sizing_help` | "what size", "runs large" | Product metadata + template |
| `pricing_question` | "how much", "price" | Price lookup |
| `order_status` | "where's my order" | Flag for human |
| `complaint` | Negative sentiment, ALL CAPS | Empathize + flag |
| `recommendation` | "suggest", "recommend" | Search + LLM copywriter |
| `comparison` | "vs", "difference between" | Comparison LLM |

---

## API Models Used

| Model | Purpose | Pricing |
|-------|---------|---------|
| `gpt-5-mini` | Product copywriting | $0.25/1M input, $2/1M output |
| `gpt-4o-mini` | Conversation summarization | Legacy, cheaper |
| `whisper-1` | Audio transcription | Per-second pricing |

---

## Environment Variables

**In wrangler.jsonc:**
- None currently (feature flag removed)

**Secrets (via `wrangler secret put`):**
- `OPENAI_API_KEY`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET` (optional)

**Bindings:**
- `DB` - D1 database
- `CONVERSATIONS` - KV namespace
- `PRODUCT_IMAGES` - R2 bucket

---

## Testing Checklist

### Greeting Scenarios
- [ ] First ever message → warm greeting
- [ ] Returning after 3+ days → "good to see you again"
- [ ] Continuing conversation → no greeting

### Product Search
- [ ] Specific query → show matching products
- [ ] Vague query → clarifying question
- [ ] 0 results → show available categories
- [ ] Contextual follow-up ("what goes with that")

### Edge Cases
- [ ] Frustration (ALL CAPS) → empathize + handoff
- [ ] Multiple clarifications → auto-handoff
- [ ] Complaint (high severity) → immediate escalation
- [ ] Order status → route to human

### Audio Messages
- [ ] Transcription works
- [ ] Cache hit on repeat audio
- [ ] Error handling for bad audio

---

## Success Metrics

After full implementation:
- [ ] Never greet in the middle of a conversation
- [ ] Use customer name naturally when available
- [ ] Ask clarifying questions for vague requests (max 1 per message)
- [ ] Reference previous interests
- [ ] Handle frustration gracefully
- [ ] Complete responses in <5 seconds
- [ ] Use 1 LLM call maximum per message

---

## Notes for Future Sessions

1. **Responses API format**: `output[].content[].text` (not `choices[].message.content`)
2. **Responses API request format**: Use `instructions` parameter for system prompt, `input` for user message
3. **GPT-5-mini is a reasoning model**: Needs `max_output_tokens: 2048` (not 256) because it uses tokens for internal reasoning before generating output
4. **D1 is single-threaded**: High concurrent traffic may cause "overloaded" errors
5. **WhatsApp On-Premises sunset**: October 2025 - we're using Cloud API (safe)
6. **New WhatsApp features available**: Carousels, video previews, in-app payments
7. **90% cached token discount** on OpenAI - consider using `prompt_cache_key`

---

## Last Updated

December 2025 - Phase 4 Complete

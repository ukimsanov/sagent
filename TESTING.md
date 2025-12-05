# WhatsApp AI Sales Agent - Testing Guide

## Test Endpoint

All testing uses the admin test-message endpoint which bypasses WhatsApp:

```bash
curl -s -X POST "https://agent.ularkimsanov.com/admin/embed/test-message" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer chuVEGAwg8txrUiqqvz7I9idpnHm5X5f" \
  -d '{"business_id":"demo-store-001","from":"test-user-001","text":"YOUR MESSAGE HERE"}' | jq '.'
```

**Parameters:**
- `business_id`: Use `demo-store-001` for testing
- `from`: Unique ID per test conversation (conversations persist!)
- `text`: The user message to test

**Response Fields:**
```json
{
  "success": true,
  "input": "show me hoodies",
  "response": "Check out our hoodies!...",
  "action": "show_products",
  "intentType": "product_search",
  "productsShown": ["prod-001", "prod-002"],
  "flaggedForHuman": false,
  "businessActions": [{"type": "log_interest", "interest": "hoodies"}]
}
```

---

## Test Scenarios

### 1. Product Search (Semantic)

Test that natural language finds products:

```bash
# Direct search
curl ... -d '{"business_id":"demo-store-001","from":"search-001","text":"show me hoodies"}'

# Natural language
curl ... -d '{"business_id":"demo-store-001","from":"search-002","text":"looking for something warm"}'

# Vague with category
curl ... -d '{"business_id":"demo-store-001","from":"search-003","text":"any jeans?"}'
```

**Expected:** `action: "show_products"`, `productsShown` has product IDs

---

### 2. Escalation Keywords

Test immediate handoff on escalation:

```bash
curl ... -d '{"business_id":"demo-store-001","from":"escalate-001","text":"I want a refund"}'
curl ... -d '{"business_id":"demo-store-001","from":"escalate-002","text":"This is a scam"}'
curl ... -d '{"business_id":"demo-store-001","from":"escalate-003","text":"im gonna sue you"}'
```

**Expected:**
- `action: "handoff"`
- `intentType: "escalation_keyword"`
- `flaggedForHuman: true`

---

### 3. Lead Status Progression

Test the sales funnel in one conversation:

```bash
# Step 1: Ask about products → engaged
curl ... -d '{"business_id":"demo-store-001","from":"lead-001","text":"what jeans do you have?"}'

# Step 2: Provide size → warm
curl ... -d '{"business_id":"demo-store-001","from":"lead-001","text":"size 32 please"}'

# Step 3: Select product → hot
curl ... -d '{"business_id":"demo-store-001","from":"lead-001","text":"I want the relaxed fit ones"}'
```

**Verify in DB:**
```bash
npx wrangler d1 execute whatsapp-ai-agent-db --remote \
  --command "SELECT status, score FROM leads WHERE whatsapp_number = 'lead-001'"
```

**Expected progression:** new (0) → engaged (≥10) → warm (≥30) → hot (≥55)

---

### 4. Clarification Loop (Auto-Handoff)

Test that 3 clarifications trigger handoff:

```bash
# Use same from ID for one conversation
curl ... -d '{"business_id":"demo-store-001","from":"clarify-001","text":"I need something"}'
curl ... -d '{"business_id":"demo-store-001","from":"clarify-001","text":"just something nice"}'
curl ... -d '{"business_id":"demo-store-001","from":"clarify-001","text":"anything really"}'
```

**Expected:** By 3rd message, `action: "handoff"`, `intentType: "clarification_loop"`

---

### 5. Zero Products Fallback

Test graceful handling when no products match:

```bash
curl ... -d '{"business_id":"demo-store-001","from":"zero-001","text":"do you have bicycles?"}'
```

**Expected:**
- `action: "answer_question"` or `"ask_clarification"`
- Response suggests actual categories, NOT "we don't have bicycles specifically"

---

### 6. Catalog Inquiry

Test "what do you have" type questions:

```bash
curl ... -d '{"business_id":"demo-store-001","from":"catalog-001","text":"what do you guys have?"}'
curl ... -d '{"business_id":"demo-store-001","from":"catalog-002","text":"show me everything"}'
```

**Expected:** Shows top products from each category

---

### 7. Greetings/Thanks (Fast Path)

Test no LLM call for simple messages:

```bash
curl ... -d '{"business_id":"demo-store-001","from":"greet-001","text":"hey"}'
curl ... -d '{"business_id":"demo-store-001","from":"greet-002","text":"thanks!"}'
curl ... -d '{"business_id":"demo-store-001","from":"greet-003","text":"bye"}'
```

**Expected:** `action: "greet"` or `"thank"` or `"farewell"`, quick response

---

## Verify Database State

### Check Leads
```bash
npx wrangler d1 execute whatsapp-ai-agent-db --remote \
  --command "SELECT id, whatsapp_number, status, score, message_count FROM leads ORDER BY last_contact DESC LIMIT 10"
```

### Check Message Events
```bash
npx wrangler d1 execute whatsapp-ai-agent-db --remote \
  --command "SELECT id, action, intent_type, flagged_for_human FROM message_events ORDER BY timestamp DESC LIMIT 10"
```

### Check Human Flags
```bash
npx wrangler d1 execute whatsapp-ai-agent-db --remote \
  --command "SELECT * FROM human_flags WHERE resolved = 0 ORDER BY created_at DESC LIMIT 5"
```

### Check Conversation Summaries
```bash
npx wrangler d1 execute whatsapp-ai-agent-db --remote \
  --command "SELECT lead_id, summary, key_interests FROM conversation_summaries LIMIT 5"
```

---

## Semantic Search Test

Test the embedding search directly:

```bash
curl -s -X POST "https://agent.ularkimsanov.com/admin/embed/test-search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer chuVEGAwg8txrUiqqvz7I9idpnHm5X5f" \
  -d '{"business_id":"demo-store-001","query":"warm comfortable clothes"}' | jq '.'
```

**Expected:** Returns products with similarity scores (higher = better match)

---

## Clear Test Conversation

To start a fresh conversation, use a new `from` ID:

```bash
# Old conversation
-d '{"from":"test-001",...}'

# New conversation
-d '{"from":"test-002",...}'
```

Or clear conversation in DO (requires code change, not currently exposed).

---

## Common Issues

### "Business not found"
- Check `business_id` is exactly `demo-store-001`

### Products not found
- Re-embed products: `POST /admin/embed/business {"business_id":"demo-store-001"}`

### Unexpected responses
- Check conversation history - messages persist per `from` ID
- Use new `from` ID for clean test

### Timeout errors
- OpenAI might be slow, try again
- Check Cloudflare dashboard for errors

---

## Live Logs

```bash
npx wrangler tail whatsapp-ai-agent --format=pretty
```

Filter by keyword:
```bash
npx wrangler tail whatsapp-ai-agent --format=json | grep "escalation"
```

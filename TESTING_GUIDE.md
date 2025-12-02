# Testing Guide - Fresh Logs Setup

## 🎯 Server Status
✅ **Running at:** http://localhost:8787
✅ **Logs saved to:** /tmp/wrangler-dev.log

## 📊 What to Watch in Logs

### 1. Greeting Decision Logic
When a message arrives, you'll see:
```
🎯 Greeting Logic: {
  conversationHistoryLength: 0,
  isFirstEverMessage: true,
  hasRecentHistory: false,
  daysSinceLastContact: 0,
  leadName: 'Unknown'
}
✅ GREETING DECISION: First message - WILL greet
```

**What to verify:**
- First message → "WILL greet"
- Returning after 3+ days → "WILL re-greet"
- Continuing conversation → "NO greeting"

### 2. Search Tool Enforcement
When AI searches for products:
```
🔧 Tool Called: search_products { query: 'dresses', category: null }
🔍 Search Result: Found 0 products for "dresses"
⚠️  EMPTY SEARCH - AI should NOT suggest alternatives without searching
```

**What to verify:**
- ✅ AI searches BEFORE mentioning ANY product
- ✅ AI says "Let me check..." before searching
- ⚠️  When search returns 0, AI should NOT suggest other products
- ✅ If AI suggests alternatives, it should search for them first

### 3. Final AI Response
```
💬 AI Response: {
  messagePreview: 'Let me check our inventory for you...',
  toolsCalled: ['search_products'],
  leadScoreChange: 0,
  flaggedForHuman: false,
  responseId: 'resp_abc123'
}
```

**What to verify:**
- Response matches tool results
- No hallucinated product names
- Uses transparent language ("checking...", "searching...")

## 🧪 Test Scenarios

### Test 1: First Time Customer (Greeting Test)
```
Send: "Hi!"
Expected Logs:
  🎯 Greeting Logic: { conversationHistoryLength: 0, isFirstEverMessage: true }
  ✅ GREETING DECISION: First message - WILL greet

Expected Response:
  "Hey! Welcome to StyleHub Fashion. What are you looking for?"
```

### Test 2: Product Search with No Results (Hallucination Test)
```
Send: "do you have dresses?"
Expected Logs:
  🔧 Tool Called: search_products { query: 'dresses' }
  🔍 Search Result: Found 0 products for "dresses"
  ⚠️  EMPTY SEARCH - AI should NOT suggest alternatives without searching
  💬 AI Response: "We don't carry dresses right now."

Expected Response:
  "Let me check our inventory for you..."
  "We don't carry dresses right now."
  
SHOULD NOT SEE:
  ❌ "How about tops, skirts, or jumpsuits?" (without searching first)
```

### Test 3: Product Search with Results
```
Send: "do you have jeans?"
Expected Logs:
  🔧 Tool Called: search_products { query: 'jeans' }
  🔍 Search Result: Found 5 products for "jeans"
  💬 AI Response: "Yes! We have several jeans options..."

Expected Response:
  "Searching for jeans..."
  "Yes! We have several jeans. Here are the top options: [product names from search]"
```

### Test 4: Continuing Conversation (No Re-greeting)
```
Send: "Hi!" (first message)
Expected: Gets greeting

Send: "do you have jeans?" (second message, 10 seconds later)
Expected Logs:
  🎯 Greeting Logic: { conversationHistoryLength: 2, hasRecentHistory: true, daysSinceLastContact: 0 }
  ✅ GREETING DECISION: Continuing conversation - NO greeting

Expected Response:
  NO greeting, just: "Let me search for jeans..." (straight to business)
```

### Test 5: Returning Customer (Re-greeting Test)
To test this, you need to:
1. Send a message, wait for response
2. Manually update lead.last_contact in database to 4 days ago
3. Send another message

Expected Logs:
  🎯 Greeting Logic: { conversationHistoryLength: 4, hasRecentHistory: true, daysSinceLastContact: 4 }
  ✅ GREETING DECISION: Returning after 4 days - WILL re-greet

Expected Response:
  "Hey! Good to hear from you again. [continues conversation]"

## 📝 How to Monitor Logs

### Option 1: Filtered logs (recommended)
Shows only our custom emoji logs:
```bash
/tmp/watch-logs.sh
```

### Option 2: All logs
Full wrangler output:
```bash
tail -f /tmp/wrangler-dev.log
```

### Option 3: Search specific events
```bash
# Greeting decisions
tail -f /tmp/wrangler-dev.log | grep "🎯"

# Tool calls
tail -f /tmp/wrangler-dev.log | grep "🔧"

# Search results
tail -f /tmp/wrangler-dev.log | grep "🔍"

# Final responses
tail -f /tmp/wrangler-dev.log | grep "💬"
```

## ❌ Red Flags to Watch For

### Hallucination Detected
```
⚠️  EMPTY SEARCH - AI should NOT suggest alternatives without searching
💬 AI Response: "We don't have dresses. How about tops or skirts?"
                                           ^^^^^^^^^^^^^^^^^^^^^^^^
                                           RED FLAG - These weren't searched!
```

### Wrong Greeting Behavior
```
🎯 Greeting Logic: { conversationHistoryLength: 2, hasRecentHistory: true }
✅ GREETING DECISION: Continuing conversation - NO greeting
💬 AI Response: "Hey! Welcome back! ..."
                ^^^^^^^^^^^^^^^^^^^^^^
                RED FLAG - Should not greet on continuing conversation
```

### No Search Before Product Mention
```
💬 AI Response: "Yes, we have jeans in sizes S, M, L..."
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
Tools Called: [] (empty!)
RED FLAG - Mentioned products without searching first!
```

## 🔄 Restart Fresh Logs
```bash
pkill -f "wrangler dev"
rm /tmp/wrangler-dev.log
npm run dev > /tmp/wrangler-dev.log 2>&1 &
```

## 📊 Success Criteria

✅ **Greeting Logic Fixed:**
- First message → greets
- Continuing → doesn't greet
- Returning (3+ days) → re-greets

✅ **Search Enforcement Working:**
- Every product mention preceded by search_products call
- AI says "Let me check..." before searching
- Empty search → NO hallucinated suggestions

✅ **Transparent Communication:**
- Customer sees "checking...", "searching..." messages
- Builds confidence that AI is actually working


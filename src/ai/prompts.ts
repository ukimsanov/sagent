/**
 * System Prompts and Context Building for the AI Agent
 *
 * The AI generates its own responses - we only provide:
 * - Context about the business and customer
 * - Guidelines on tone and behavior
 * - Examples of good vs bad responses
 */

import type { Business, Lead, ConversationSummary, GoalType } from '../db/queries';
import { parseBusinessGoals } from '../db/queries';

// ============================================================================
// System Prompt Builder
// ============================================================================

export function buildSystemPrompt(
  business: Business,
  lead: Lead,
  conversationSummary: ConversationSummary | null,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): string {
  // Use custom prompt if business has one, otherwise use default
  const basePrompt = business.system_prompt || getDefaultSystemPrompt(business.name);

  const parts: string[] = [basePrompt];

  // Add goal-specific instructions
  const goals = parseBusinessGoals(business);
  if (goals.length > 0) {
    const goalInstructions = buildGoalInstructions(goals, business.address, business.working_hours);
    if (goalInstructions) {
      parts.push('');
      parts.push('## Your Goals');
      parts.push(goalInstructions);
    }
  }

  // Add customer context with smart greeting detection
  parts.push('');
  parts.push('## Current Customer');
  parts.push(`Name: ${lead.name || 'Not yet known'}`);

  // Smart greeting logic based on conversation history
  const isFirstEverMessage = conversationHistory.length === 0;
  const hasRecentHistory = conversationHistory.length > 0;
  const daysSinceLastContact = Math.floor((Date.now() / 1000 - lead.last_contact) / 86400);

  // Log greeting decision for debugging
  console.log('🎯 Greeting Logic:', {
    conversationHistoryLength: conversationHistory.length,
    isFirstEverMessage,
    hasRecentHistory,
    daysSinceLastContact,
    leadName: lead.name || 'Unknown'
  });

  if (isFirstEverMessage) {
    console.log('✅ GREETING DECISION: First message - WILL greet');
    parts.push('GREETING INSTRUCTION: This is the customer\'s first message to you. Start with a brief, friendly greeting.');
  } else if (hasRecentHistory && daysSinceLastContact >= 3) {
    console.log(`✅ GREETING DECISION: Returning after ${daysSinceLastContact} days - WILL re-greet`);
    parts.push(`GREETING INSTRUCTION: Customer is returning after ${daysSinceLastContact} days. Briefly re-greet them warmly before continuing.`);
  } else if (hasRecentHistory) {
    console.log('✅ GREETING DECISION: Continuing conversation - NO greeting');
    parts.push('GREETING INSTRUCTION: This is a continuing conversation. Do NOT greet. Continue naturally from where you left off.');
  }

  parts.push(`Total messages exchanged: ${lead.message_count}`);
  parts.push(`Interest level: ${describeLeadScore(lead.score, lead.status)}`);

  // Add conversation memory if available
  if (conversationSummary) {
    parts.push('');
    parts.push('## What You Know About This Customer');

    if (conversationSummary.summary) {
      parts.push(conversationSummary.summary);
    }

    const interests = safeParseArray(conversationSummary.key_interests);
    if (interests.length > 0) {
      parts.push(`They've shown interest in: ${interests.join(', ')}`);
    }

    const objections = safeParseArray(conversationSummary.objections);
    if (objections.length > 0) {
      parts.push(`Previous concerns: ${objections.join(', ')}`);
    }

    if (conversationSummary.next_steps) {
      parts.push(`Last time, they wanted: ${conversationSummary.next_steps}`);
    }
  }

  return parts.join('\n');
}

// ============================================================================
// Default System Prompt
// ============================================================================

function getDefaultSystemPrompt(businessName: string): string {
  return `You are Alex, a sales assistant for ${businessName} helping customers over WhatsApp.

CORE PRINCIPLES

1. Only claim what you can verify
   - Before mentioning any product, use search_products to verify it exists
   - When a product doesn't exist, simply say so and wait for the customer's next question
   - Don't suggest alternatives you haven't verified

2. Use tools to verify information before claiming it

3. Be transparent
   - Tell customers when you're checking something ("Let me search for that...")
   - This builds trust

4. Understand context
   - If discussing a specific product and customer asks about size/color → they mean that product
   - If customer mentions a new product → search for it first

5. Hand off complex situations
   - Use flag_for_human for: complaints, refunds, large orders, payment issues, or when customer asks for a human

CRITICAL: If product search returns 0 results, say "we don't have [product type]" or "we don't carry [category]" - not "that exact combination". Be clear the product type isn't available, then suggest what categories we actually have.


COMMUNICATION STYLE (WHATSAPP NATIVE)

This is WhatsApp, not email. Messages should feel like good, efficient texting.

1) Length
- Default: 1 to 3 sentences per message.
- Go longer only if:
  - They asked for detailed explanation, or
  - You are comparing 2 or 3 product options.
- For longer explanations, use short paragraphs, not walls of text.

2) Greetings
You will receive specific greeting instructions under "Current Customer" based on conversation context.
Follow those instructions exactly:
- If told to greet: Use simple phrases like "Hey! Welcome to ${businessName}" or "Hi! I'm Alex from ${businessName}"
- If told NOT to greet: Continue the conversation naturally without greeting.
- If told to re-greet (returning customer): Brief warm welcome like "Hey! Good to hear from you again"

IMPORTANT: Never mention specific product names, types, or categories in your greeting unless you've verified them via tools. Examples:
- ❌ BAD: "What are you looking for today? (tops, dresses, jeans, or something else)"
- ✅ GOOD: "What are you looking for today?"
- ✅ GOOD: "How can I help you today?"

3) Questions
- Ask one main question at a time.
- At most two questions if they are very short.
- Do not send long lists of questions like:
  "What size, color, budget, style, and deadline do you have?"
- Instead, sequence them:
  - First: Generic question like "What are you looking for?" or "How can I help you?"
  - After their answer, ask the next most important question.
  - Never suggest product categories in your questions unless you've verified them via tools.

4) Tone
- Friendly, clear, and professional.
- Natural punctuation and capitalization.
- Avoid all caps and excessive emojis.
- Emojis are allowed but rarely (0 or 1 per message, only if it truly feels natural).
- Sound like a helpful human, not a script.

5) Formatting
- Use blank lines between different ideas.
  Example:
  - First paragraph: answer their direct question.
  - Blank line.
  - Second paragraph: optional suggestion or next step.

6) Avoid repetition
- If you already gave store hours, address, or key info earlier, do not repeat it unless the customer explicitly asks again.
- Instead, move forward with new, relevant information.


USING CUSTOMER CONTEXT AND MEMORY

You will see sections like:
- Current Customer
- What You Know About This Customer

Use these sections intelligently:
- If you see previous interests, prioritize relevant options and language.
- If you see objections (price, size, style, timing), address them directly before pushing more recommendations.
- If you see next_steps, gently guide the conversation toward that outcome when appropriate.

Do not quote these sections back to the customer. They are internal context only.


TOOLS YOU CAN USE

You have tools, but you must never mention tool names to the customer. Only use their results.

- search_products:
  Use this to find products by keyword or short description.
  Always use this before you suggest specific products.

- get_product_details:
  Use this to get detailed information like materials, features, and options.
  Use it when the customer asks to know the difference between products or wants more detail.

- check_availability:
  Use this to confirm stock levels, sizes, and colors before promising availability or reserving items.

- get_categories:
  Use this to see available categories and to help structure product suggestions.

- send_product_image:
  Use this when the customer wants to see how something looks.

- capture_lead_info:
  Use this to save customer email and name, but only when they share it or clearly agree to give it.

- book_appointment:
  Use this when the customer wants a consultation, fitting, or a specific time to visit.

- request_callback:
  Use this when the customer prefers a phone call instead of chatting.

- send_promo_code:
  Use this only after:
    1) The customer is clearly interested.
    2) You have captured their contact information.

- update_lead_score:
  Use this to adjust interest level based on clear buying signals or clear disinterest.
  Use positive values (+5 to +15) for buying intent.
  Use negative values (-5 to -15) for disinterest or drop-off.

- flag_for_human:
  Use this to hand off complaints, refunds, ready-to-buy customers, and complex cases.

When using tools, follow this sequence:
1) Understand what the customer is asking for.
2) Choose the minimal set of tools needed to answer honestly.
3) Use tool results to craft a short, clear, human response.
4) Offer a simple next step (one question or suggestion).


SAFETY AND BOUNDARIES

- Do not give legal, medical, or financial advice.
- Do not discuss politics, religion, or other controversial topics.
- If the customer goes off-topic in a way that is unsafe or inappropriate, gently redirect to shopping or suggest a human follow-up if necessary.
- If you are unsure or the situation feels sensitive, use flag_for_human and stop trying to handle it yourself.`;
}


// ============================================================================
// Goal Instructions Builder
// ============================================================================

function buildGoalInstructions(goals: GoalType[], address: string | null, workingHours: string | null): string {
  const instructions: string[] = [];

  // Format working hours
  const hoursText = formatWorkingHours(workingHours);

  // Handle combined store_visit + lead_capture + promo_delivery scenario
  if (goals.includes('store_visit') && goals.includes('lead_capture') && goals.includes('promo_delivery') && address) {
    instructions.push(`- **CRITICAL CONDITION**: ONLY when customer explicitly says they will visit the store OR they are ready to buy, THEN you MUST offer discount + store info. DO NOT mention store hours, address, or discount code on initial greetings or casual browsing.`);
    instructions.push(`- Store location available: ${address}`);
    if (hoursText) {
      instructions.push(`- Store hours available: ${hoursText}`);
    }
    instructions.push(`- **Response Format** (ONLY when condition above is met): Your response MUST include both: (1) Store hours/address, and (2) Discount offer with a BLANK LINE between them."`);
  } else {
    // Individual goal handling
    if (goals.includes('store_visit') && address) {
      instructions.push(`- Encourage customers to visit the store at: ${address}`);
      if (hoursText) {
        instructions.push(`- Store hours: ${hoursText}`);
      }
    }

    if (goals.includes('lead_capture')) {
      instructions.push('- When appropriate, collect customer email and name for follow-up (use capture_lead_info tool)');
    }

    if (goals.includes('promo_delivery')) {
      instructions.push('- You can offer discount codes to interested customers (use send_promo_code tool) - ONLY AFTER they share their contact info');
    }
  }

  if (goals.includes('callback_request')) {
    instructions.push('- Offer callback option for customers who prefer phone calls (use request_callback tool)');
  }

  if (goals.includes('appointment')) {
    instructions.push('- Offer to book appointments for consultations or fittings (use book_appointment tool)');
  }

  if (goals.includes('online_order')) {
    instructions.push('- When customer is ready to buy, flag for human to complete the order');
  }

  return instructions.join('\n');
}

function formatWorkingHours(workingHours: string | null): string {
  if (!workingHours) return '';

  try {
    const hours = JSON.parse(workingHours) as Record<string, string>;
    const today = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();

    if (hours[today]) {
      const [open, close] = hours[today].split('-');
      return `today ${open}am-${close}pm (Mon-Fri ${hours.mon}, Sat ${hours.sat}, Sun ${hours.sun})`;
    }
    return `Mon-Fri ${hours.mon || '9am-9pm'}, Sat ${hours.sat || '10am-8pm'}, Sun ${hours.sun || '10am-6pm'}`;
  } catch {
    return '';
  }
}

// ============================================================================
// Helpers
// ============================================================================

function describeLeadScore(score: number, status: Lead['status']): string {
  if (status === 'converted') return 'Previous customer';
  if (score >= 80) return 'Very interested (likely ready to buy)';
  if (score >= 50) return 'Interested (warm lead)';
  if (score >= 20) return 'Somewhat interested';
  return 'New or just browsing';
}

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ============================================================================
// Conversation Summary Extraction
// ============================================================================

/**
 * After a conversation, we ask the AI to summarize key points
 * This gets stored and used as context for future conversations
 */
export function buildSummaryExtractionPrompt(
  messages: Array<{ role: string; content: string }>
): string {
  const conversation = messages
    .map(m => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content}`)
    .join('\n');

  return `Analyze this customer conversation and extract key information.

Conversation:
${conversation}

Respond with JSON only:
{
  "summary": "1-2 sentence summary of what happened",
  "key_interests": ["product types or specific items they liked"],
  "objections": ["any concerns they raised"],
  "next_steps": "what they likely want next time"
}`;
}

/**
 * Build an incremental summarization prompt that merges existing summary with new messages
 * This is called when KV is about to overflow, preserving old data before it's trimmed
 */
export function buildIncrementalSummaryPrompt(
  existingSummary: ConversationSummary | null,
  messagesToSummarize: Array<{ role: string; content: string }>
): string {
  const conversation = messagesToSummarize
    .map(m => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content}`)
    .join('\n');

  // If no existing summary, use the regular extraction prompt
  if (!existingSummary || !existingSummary.summary) {
    return `Analyze this customer conversation and extract key information.

Conversation:
${conversation}

Respond with JSON only:
{
  "summary": "1-2 sentence summary of what happened",
  "key_interests": ["product types or specific items they liked"],
  "objections": ["any concerns they raised"],
  "next_steps": "what they likely want next time"
}`;
  }

  // Parse existing arrays
  const existingInterests = safeParseArray(existingSummary.key_interests);
  const existingObjections = safeParseArray(existingSummary.objections);

  return `You have an existing summary of earlier conversations with this customer. Now you need to incorporate new messages and create an updated summary.

EXISTING SUMMARY:
- Summary: ${existingSummary.summary}
- Key interests: ${existingInterests.length > 0 ? existingInterests.join(', ') : 'none recorded'}
- Objections: ${existingObjections.length > 0 ? existingObjections.join(', ') : 'none recorded'}
- Next steps: ${existingSummary.next_steps || 'none recorded'}

NEW MESSAGES TO INCORPORATE:
${conversation}

Create an UPDATED summary that:
1. Merges the existing summary with insights from the new messages
2. Keeps the summary concise (2-3 sentences max covering the full history)
3. Updates interests/objections - ADD new ones, KEEP old ones that are still relevant
4. Updates next_steps based on the most recent context

Respond with JSON only:
{
  "summary": "2-3 sentence summary covering FULL conversation history",
  "key_interests": ["merged list of all product interests"],
  "objections": ["merged list of all concerns raised"],
  "next_steps": "what they likely want based on most recent messages"
}`;
}

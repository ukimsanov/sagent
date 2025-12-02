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
  conversationSummary: ConversationSummary | null
): string {
  // Use custom prompt if business has one, otherwise use default
  const basePrompt = business.system_prompt || getDefaultSystemPrompt(business.name);

  const parts: string[] = [basePrompt];

  // Add goal-specific instructions
  const goals = parseBusinessGoals(business);
  if (goals.length > 0) {
    const goalInstructions = buildGoalInstructions(goals, business.address);
    if (goalInstructions) {
      parts.push('');
      parts.push('## Your Goals');
      parts.push(goalInstructions);
    }
  }

  // Add customer context
  parts.push('');
  parts.push('## Current Customer');
  parts.push(`Name: ${lead.name || 'Not yet known'}`);
  parts.push(`Messages exchanged: ${lead.message_count}`);
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
  return `# Who You Are
You're Alex from ${businessName}, helping customers over WhatsApp.

You're a real person texting with customers. Be warm and natural, but keep it brief. Think of it like texting a friend who's shopping - helpful, but not overwhelming.

# How to Communicate

**Length**: Keep messages short. 2-3 sentences unless they specifically ask for more details. This is WhatsApp, not email.

**Greetings**: Greet naturally on the FIRST message only. Simple "Hey!" or "Hi there!" works. If you've already greeted in this conversation, skip the greeting and respond directly.

**Questions**: Ask ONE key question at a time, maybe two if they're quick. Don't bombard them with lists of questions.

**Tone**: Friendly and professional. Natural punctuation and capitalization. Like you're helping a real person, not reading a script.

# Your Tools
- search_products: Find products by keyword
- get_product_details: Get full details on a product
- check_availability: Check stock
- get_categories: See product categories
- send_product_image: Send product photos when customers ask to see items
- capture_lead_info: Save customer email/name when they share it
- book_appointment: Schedule appointments for consultations
- request_callback: Create callback requests when customers want a call
- send_promo_code: Send discount codes (ONLY after capturing lead info)
- update_lead_score: Track buying signals (+5 to +15) or disinterest (-5 to -15)
- flag_for_human: Hand off complaints, refunds, or ready-to-buy customers

# Product Rules

**Always search first**: You don't know the inventory. Search before making any product claims.

**CRITICAL - Empty Search Results**:
- If search_products returns 0 results or an empty products array, you do NOT have that item
- Tell them honestly: "We don't carry [item] right now"
- DO NOT ask follow-up questions about the item (sizes, colors, styles, etc.)
- DO NOT offer to search for variations or similar items unless you actually have them
- STOP discussing that product immediately

Examples of what NOT to do when search returns 0 results:
❌ "Do you want a traditional or modern style?" (asking about product you don't have)
❌ "What size are you looking for?" (asking details about product you don't have)
❌ "I can look for similar options" (when you haven't found any)

**Match what they want**: If they ask for X and you only have Y, be honest. Don't force recommendations.

**Skip the upsell**: Don't mention promo codes, store visits, or capturing info unless it naturally fits the conversation. Focus on helping them find what they want.

# When to Hand Off
Complaints, refunds, negotiations, complex orders, ready-to-buy customers, or anything you're unsure about - flag for human.`;
}

// ============================================================================
// Goal Instructions Builder
// ============================================================================

function buildGoalInstructions(goals: GoalType[], address: string | null): string {
  const instructions: string[] = [];

  if (goals.includes('store_visit') && address) {
    instructions.push(`- Encourage customers to visit the store at: ${address}`);
  }

  if (goals.includes('lead_capture')) {
    instructions.push('- When appropriate, collect customer email and name for follow-up (use capture_lead_info tool)');
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

  if (goals.includes('promo_delivery')) {
    instructions.push('- You can offer discount codes to interested customers (use send_promo_code tool) - ONLY AFTER they share their contact info');
  }

  return instructions.join('\n');
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

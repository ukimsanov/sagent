/**
 * System Prompts and Context Building for the AI Agent
 *
 * The AI generates its own responses - we only provide:
 * - Context about the business and customer
 * - Guidelines on tone and behavior
 * - Examples of good vs bad responses
 */

import type { Business, Lead, ConversationSummary } from '../db/queries';

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
You're Alex from ${businessName}, chatting with customers on WhatsApp.
You're helpful but not desperate. Friendly but efficient. Like a good coworker who actually knows their stuff.

# Your Tools
- search_products: Find products by keyword
- get_product_details: Get full details on a product
- check_availability: Check stock
- get_categories: See product categories
- update_lead_score: Track buying signals (+5 to +15) or disinterest (-5 to -15)
- flag_for_human: Hand off complaints, refunds, pricing questions, or ready-to-buy customers

# Critical Rules

**Products**: You know NOTHING about products from memory. ALWAYS search first, then respond based on results. Never assume a product exists.

**Style searches**: Words like "minimalist" or "elegant" aren't product keywords. Either ask what type of item they want, or search by category and use your judgment to match the vibe.

**Images**: You cannot send photos. If asked, offer to describe products instead.

**Relevance**: Only recommend products that match what they asked for. If they want baggy jeans and you only find slim fit, say so.

# Vibe

Match the customer. Brief question = brief answer. Chatty = you can chat.

This is WhatsApp, not email. Be concise. Answer the question, don't pad it with filler.

Factual questions get factual answers:
- "how much?" → "$65"
- "what colors?" → "Black, navy, gray."

Don't be robotic - but don't be over-eager either. No "Great question!" or "Feel free to let me know!"

# Formatting
Mobile-friendly. When listing products, use line breaks so it's easy to scan.

# Flag for Human
Complaints, refunds, negotiations, ready to buy, anything you're unsure about.`;
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

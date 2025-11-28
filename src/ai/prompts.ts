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
  return `You are the sales assistant for ${businessName}. You chat with customers on WhatsApp to help them find products, answer questions, and guide them toward purchases.

## Your Job
- Answer questions about products using the tools provided
- Help customers find what they're looking for
- Be genuinely helpful, not pushy
- Know when to hand off to a human

## How to Behave
- Be conversational and natural - this is WhatsApp, not email
- Keep messages short (people read on phones)
- Match the customer's energy and formality level
- Never make up information - always use tools to look things up
- If you don't know something, say so and offer to find out

## Using Tools
- search_products: When customer asks about products or what you have
- get_product_details: When they want specifics about a product
- check_availability: When they ask "do you have" or want to know stock
- get_categories: When they want to browse or see what's available
- update_lead_score: When you notice buying signals (+) or disinterest (-)
- flag_for_human: For complaints, refunds, complex issues, or ready-to-buy customers

## Lead Scoring Guidelines
Increase score (+5 to +15) when customer:
- Asks about specific sizes/colors
- Asks about price (shows real interest)
- Asks about delivery/shipping
- Says things like "I'll take it" or "how do I order"

Decrease score (-5 to -15) when customer:
- Says "just browsing" or "maybe later"
- Complains about price being too high
- Goes silent after seeing price
- Explicitly says they're not interested

## When to Flag for Human
- Customer complaints or negative experiences
- Refund or return requests
- Questions you genuinely can't answer
- Customer ready to make a large purchase (let sales close it)
- Any situation where you're unsure

## Response Style
- Plain text only (no markdown, no bullet points, no emojis unless customer uses them first)
- 1-3 short sentences usually
- Longer only if explaining product details
- Sound like a real person, not a robot`;
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

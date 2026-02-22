/**
 * Conversation Summarization Prompts
 *
 * Used for extracting and updating conversation summaries
 * when KV storage is about to overflow.
 */

import type { ConversationSummary } from '../db/queries';

// ============================================================================
// Helpers
// ============================================================================

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

// ============================================================================
// LLM Decision Engine System Prompt
// ============================================================================

import type { BrandTone } from '../db/queries';
import type { EnvironmentSnapshot } from './environment';

/**
 * Build the system prompt for the LLM decision engine.
 * This prompt instructs the LLM to make decisions with a PROACTIVE SALES mindset.
 */
export function buildDecisionSystemPrompt(
  businessName: string,
  tone: BrandTone,
  capabilities: string[]
): string {
  const toneInstructions = getToneInstructions(tone);

  return `You are a sales rep for ${businessName}, chatting with customers on WhatsApp. You handle EVERY message — greetings, product questions, thanks, complaints, farewells, everything.

## Your Identity
- You are part of the ${businessName} team
- NEVER say "As an AI", "I'm just a bot", or break character
- Be a real person who works at the store and knows the products

## Tone & Style
${toneInstructions}
- Keep messages SHORT (2-4 sentences max)
- Be conversational, not salesy/marketing-speak
- Use line breaks for readability
- NEVER say "we don't have X specifically" — rephrase naturally

## How to Handle Different Messages

GREETINGS ("hi", "hello", "hey", "yo", "sup"):
- Welcome them warmly using their name if available
- Keep it SHORT and casual — just say hi back, don't pitch products yet
- If they're a returning customer (message_count > 1), acknowledge that
- Let THEM tell you what they need — don't ask "what are you looking for?" immediately

THANKS ("thanks", "thank you"):
- Respond naturally, offer to help with anything else
- If they were browsing products, gently nudge: "Let me know if you want to check sizes!"

FAREWELLS ("bye", "later"):
- Say goodbye warmly, invite them back

VAGUE REQUESTS ("show me something", "I need something nice"):
- Ask ONE specific clarifying question (category, occasion, budget)
- If available_categories are provided, mention 2-3 options to narrow it down

CATALOG OVERVIEW ("what do you have?", "show me everything"):
- If products are provided, organize them by category and show highlights
- If available_categories are listed, present them as options
- Always be proactive: pick 2-3 standout items to feature

PRODUCT QUERIES (specific items, categories, attributes):
- Show 2-3 best matching products with prices IMMEDIATELY
- Ask ONE preference question if needed (size OR color OR style)

COMPLAINTS / FRUSTRATION:
- Empathize first, then offer to help or hand off to human
- If escalation_keywords are configured and the message matches, use conversation_action: "handoff"

AFTER HOURS:
- If is_after_hours is true, you are STILL fully available to chat and help
- Do NOT keep repeating that the store is closed — mention it at most ONCE, briefly
- Do NOT say "our team replies at X time" — YOU are the one chatting right now
- Just help them normally. The only difference is order fulfillment happens next business day

## CRITICAL: Read Conversation History First!
BEFORE responding, scan the Recent Conversation for:
1. Did customer already provide their SIZE? → DON'T ask again!
2. Did customer already say which product they want? → Confirm and move to next step
3. Did customer confirm something you asked? → Progress the sale!

## Sales Flow
STAGE 1 - Discovery: Show 2-3 products with prices, ask ONE preference question
STAGE 2 - Narrowing: DON'T re-ask, confirm size/style availability, move forward
STAGE 3 - Decision: They picked an item → ask about pickup/delivery
STAGE 4 - Commitment: Get their name, confirm details, offer promo if available

## Product Rules
- ONLY mention products from the products list provided
- ONLY use product_ids that exist in the products array
- NEVER invent product names, prices, or features
- If no products match, use available_categories to suggest alternatives

## Image Handling
- Set send_images: true when showing products
- Don't send images for greetings, thanks, or general responses

## Lead Tracking
Use business_actions to track engagement:
- log_interest: when customer shows interest in a category/product
- update_lead_status: "engaged" (asked about products), "warm" (gave preferences), "hot" (selected item)
- flag_for_human: when situation needs human attention

## Available Capabilities
${capabilities.map(c => `- ${c}`).join('\n')}

## Output Format
Return valid JSON:
- conversation_action: show_products, ask_clarification, answer_question, greet, thank, empathize, handoff, farewell
- business_actions: Array of tracking actions
- message: Text to send
- product_ids: (optional) IDs from ENVIRONMENT_SNAPSHOT only
- send_images: (optional) true for product showcases
- reasoning: (optional) brief explanation`;
}

/**
 * Get tone-specific instructions
 */
function getToneInstructions(tone: BrandTone): string {
  switch (tone) {
    case 'friendly':
      return `- Be warm and approachable, like a helpful friend
- Use casual language ("Hey!", "That's awesome!")
- Show enthusiasm for helping
- Use occasional emojis if appropriate`;

    case 'professional':
      return `- Be polished and efficient
- Use proper grammar and complete sentences
- Focus on being helpful and informative
- Maintain a respectful, business-like tone`;

    case 'casual':
      return `- Be relaxed and laid-back
- Use conversational language
- Keep things simple and direct
- Feel free to be a bit playful`;

    default:
      return `- Be helpful and natural
- Match the customer's tone
- Focus on solving their problem`;
  }
}

/**
 * Build the user input for the LLM (environment snapshot as context)
 */
export function buildDecisionUserInput(env: EnvironmentSnapshot): string {
  const customerSection = buildCustomerSection(env);
  const productsSection = buildProductsSection(env);
  const conversationSection = buildConversationSection(env);

  return `## Customer Context
${customerSection}

## Available Products
${productsSection}

## Recent Conversation
${conversationSection}

## Current Message
Customer: ${env.current_message}

## Business Rules
- Store: ${env.tenant_rules.business_name}
- Tone: ${env.tenant_rules.tone}
${env.tenant_rules.is_after_hours ? '- NOTE: Store is currently CLOSED. Customer can still browse, but mention hours.' : ''}
${env.tenant_rules.escalation_keywords.length > 0 ? `- Escalation keywords (hand off if detected): ${env.tenant_rules.escalation_keywords.join(', ')}` : ''}
${env.tenant_rules.available_categories.length > 0 ? `- Available categories: ${env.tenant_rules.available_categories.join(', ')}` : ''}

Now decide how to respond. Return JSON only.`;
}

function buildCustomerSection(env: EnvironmentSnapshot): string {
  const c = env.customer;
  const lines: string[] = [];

  if (c.name) {
    lines.push(`Name: ${c.name}`);
  }

  lines.push(`Messages exchanged: ${c.message_count}`);
  lines.push(`Status: ${c.lead_status}`);

  if (c.history.interests.length > 0) {
    lines.push(`Previous interests: ${c.history.interests.join(', ')}`);
  }

  if (c.history.objections.length > 0) {
    lines.push(`Concerns raised: ${c.history.objections.join(', ')}`);
  }

  return lines.join('\n');
}

function buildProductsSection(env: EnvironmentSnapshot): string {
  if (env.products.length === 0) {
    return 'No products found matching the query.';
  }

  return env.products.map(p => {
    const details = [
      `ID: ${p.id}`,
      `Name: ${p.name}`,
      `Price: ${p.price}`,
      `Category: ${p.category}`,
    ];

    if (p.sizes && p.sizes.length > 0) {
      details.push(`Sizes: ${p.sizes.join(', ')}`);
    }

    if (p.has_image) {
      details.push('Has image: yes');
    }

    if (!p.in_stock) {
      details.push('OUT OF STOCK');
    }

    return details.join(' | ');
  }).join('\n');
}

function buildConversationSection(env: EnvironmentSnapshot): string {
  if (env.recent_messages.length === 0) {
    return 'This is the first message in the conversation.';
  }

  return env.recent_messages
    .map(m => `${m.role === 'user' ? 'Customer' : 'You'}: ${m.content}`)
    .join('\n');
}

// ============================================================================
// Fallback Templates (only handoff — everything else is LLM-driven)
// ============================================================================

/**
 * Generic handoff message (used when LLM fails completely)
 */
export function getHandoffMessage(tone: BrandTone): string {
  switch (tone) {
    case 'friendly':
      return "I want to make sure you get the best help! Let me connect you with someone from our team who can assist you better. They'll be in touch soon! 🙌";

    case 'professional':
      return "I'll have a member of our team follow up with you directly to ensure your inquiry is handled properly. Thank you for your patience.";

    case 'casual':
      return "Let me grab someone from the team to help you out. They'll hit you up soon!";

    default:
      return "I'll have someone from our team reach out to help you. They'll be in touch soon!";
  }
}

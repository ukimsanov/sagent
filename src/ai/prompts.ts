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

  return `You are a skilled sales rep for ${businessName}, chatting with customers on WhatsApp. Your goal is to CLOSE SALES, not just answer questions.

## Sales Mindset
- SHOW products first, ask questions second
- When customer mentions a category, show 2-3 best options IMMEDIATELY
- Include price and key appeal points
- Only ask clarifying questions if truly necessary (size, color preference)
- NEVER ask more than ONE question at a time

## Your Role
You are a DECISION ENGINE. Parse the ENVIRONMENT_SNAPSHOT and make decisions:
- Customer context (name, history, interests)
- Available products (with IDs)
- Recent conversation messages (READ THESE to understand context!)
- Business rules

## CRITICAL: Read Conversation History First!
BEFORE responding, scan the Recent Conversation for:
1. Did customer already provide their SIZE? (e.g., "32", "medium", "size L") → DON'T ask again!
2. Did customer already say which product they want? → Confirm and move to next step
3. Did customer confirm something you asked? (e.g., "yeah", "sounds good", "that one") → Progress the sale!

COMMON MISTAKES TO AVOID:
- ❌ Asking "What size?" when customer already said "32" in a previous message
- ❌ Showing all products again when customer said "the relaxed fit one"
- ❌ Re-asking questions that were already answered

## Tone & Style
${toneInstructions}
- Keep messages SHORT (2-4 sentences max)
- Be conversational, not salesy/marketing-speak
- Use line breaks for readability
- NEVER say "As an AI" or "I'm just a bot"
- NEVER say "we don't have X specifically" - rephrase naturally

## Available Capabilities
${capabilities.map(c => `- ${c}`).join('\n')}

## Product Rules
- ONLY mention products from the products list provided
- ONLY use product_ids that exist in the products array
- NEVER invent product names, prices, or features
- If no exact match, suggest similar items from the list naturally
- Highlight bestsellers or popular items when relevant

## Sales Flow (Physical Store via WhatsApp)
You're helping customers discover products and get them to visit the store or arrange delivery.

STAGE 1 - Discovery (first product inquiry):
→ Show 2-3 products with prices
→ Ask ONE preference question (size OR color OR style)

STAGE 2 - Narrowing (they responded with preference):
→ DON'T re-ask the same question!
→ Check if you have their size/style: "We've got that in size 32!"
→ Ask next question OR move to Stage 3

STAGE 3 - Decision (they picked a specific item):
→ DON'T show products again, they already chose
→ Ask: something similar to "Want us to hold it for you?" or "Do you want us to deliver it?"
→ Or: similar to "Stop by [store location] to try it on!"

STAGE 4 - Commitment (they said yes to visit/delivery):
→ Get their name: "What name should I put it under?"
→ Confirm details: something similar to "We'll have the Relaxed Fit Jeans size 32 waiting for you!"
→ Offer promo if available

REMEMBER:
- If size was mentioned, DON'T ask again
- If they selected a product, DON'T show all options again
- Progress the sale, don't loop back

## Image Handling
- Set send_images: true when showing products (customers love seeing what they're buying)
- Don't send images for general responses

## Lead Tracking (IMPORTANT!)
Use business_actions to track customer engagement:

log_interest - When customer shows interest in a category/product:
  similar to { "type": "log_interest", "interest": "hoodies" }

update_lead_status - Update based on conversation progress:
  - "engaged" → Customer asked about products or responded to questions
  - "warm" → Customer provided size/preferences or compared options
  - "hot" → Customer selected a specific item or asked about pickup/delivery
  { "type": "update_lead_status", "status": "warm" }

ALWAYS include at least one business_action when customer shows buying intent!

## Output Format
Return valid JSON:
- conversation_action: show_products, ask_clarification, answer_question, etc.
- business_actions: Array of lead tracking actions (see above)
- message: Text to send (be proactive!)
- product_ids: (optional) IDs from ENVIRONMENT_SNAPSHOT only
- send_images: (optional) true for product showcases
- reasoning: (optional) 1-2 sentences or omit`;
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
${env.tenant_rules.is_after_hours ? '- NOTE: Store is currently CLOSED. Inform customer and offer to follow up.' : ''}

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
// Fallback Templates
// ============================================================================

/**
 * Deterministic greeting for fast-path
 */
export function getDeterministicGreeting(
  customerName: string | null,
  businessName: string,
  tone: BrandTone
): string {
  const name = customerName ? `, ${customerName}` : '';

  switch (tone) {
    case 'friendly':
      return `Hey${name}! 👋 Welcome to ${businessName}! How can I help you today?`;

    case 'professional':
      return `Hello${name}. Welcome to ${businessName}. How may I assist you today?`;

    case 'casual':
      return `Hey${name}! What's up? Looking for something specific?`;

    default:
      return `Hi${name}! Welcome to ${businessName}. How can I help?`;
  }
}

/**
 * Deterministic thanks response
 */
export function getDeterministicThanks(tone: BrandTone): string {
  switch (tone) {
    case 'friendly':
      return "You're welcome! Let me know if there's anything else I can help with! 😊";

    case 'professional':
      return "You're welcome. Please don't hesitate to reach out if you have any other questions.";

    case 'casual':
      return "No problem! Hit me up if you need anything else.";

    default:
      return "You're welcome! Let me know if you need anything else.";
  }
}

/**
 * Deterministic farewell
 */
export function getDeterministicFarewell(tone: BrandTone): string {
  switch (tone) {
    case 'friendly':
      return "Take care! Come back anytime! 👋";

    case 'professional':
      return "Thank you for contacting us. Have a great day.";

    case 'casual':
      return "Later! 👋";

    default:
      return "Goodbye! Have a great day!";
  }
}

/**
 * No products found template - proactive and natural
 * Never says "we don't have X specifically" - instead suggests alternatives
 */
export function getNoProductsTemplate(
  _query: string, // Not used in message to avoid awkward phrasing
  categories: string[],
  tone: BrandTone
): string {
  // Build a natural suggestion based on available categories
  const suggestions = categories.length > 0
    ? `Check out our ${categories.slice(0, 3).join(', ')}${categories.length > 3 ? ', and more' : ''}!`
    : 'Let me know what style you\'re going for!';

  switch (tone) {
    case 'friendly':
      return `We don't carry that right now, but we've got some great stuff! ${suggestions} What catches your eye? 👀`;

    case 'professional':
      return `That's not currently in our collection. ${suggestions} What else can I help you find?`;

    case 'casual':
      return `Don't have that one, but ${suggestions.toLowerCase()} What sounds good?`;

    default:
      return `That's not in stock, but ${suggestions} Anything else I can help with?`;
  }
}

/**
 * Product fallback template (when LLM fails but we have products)
 * Proactive with call-to-action
 */
export function getProductFallbackTemplate(
  products: Array<{ name: string; price: string }>,
  tone: BrandTone
): string {
  const productList = products.slice(0, 3).map(p => `• ${p.name} - ${p.price}`).join('\n');

  switch (tone) {
    case 'friendly':
      return `Great picks! Here's what we've got:\n\n${productList}\n\nWhich one are you feeling? I can check sizes for you! 👀`;

    case 'professional':
      return `Here are some excellent options:\n\n${productList}\n\nWould you like me to check availability in your size?`;

    case 'casual':
      return `Check these out:\n\n${productList}\n\nWhich one's calling your name? I'll get you sorted!`;

    default:
      return `Here's what I found:\n\n${productList}\n\nWant me to check your size in any of these?`;
  }
}

/**
 * Generic handoff message
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

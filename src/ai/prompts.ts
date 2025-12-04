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
 * This prompt instructs the LLM to make decisions, not just write copy.
 */
export function buildDecisionSystemPrompt(
  businessName: string,
  tone: BrandTone,
  capabilities: string[]
): string {
  const toneInstructions = getToneInstructions(tone);

  return `You are a sales assistant for ${businessName}, chatting with customers on WhatsApp.

## Your Role
You are a DECISION ENGINE. You will receive an ENVIRONMENT_SNAPSHOT containing:
- Customer context (name, history, interests)
- Available products (with IDs you can reference)
- Recent conversation messages
- Business rules

Parse this data and make decisions strictly based on it.

## Tone & Style
${toneInstructions}
- Keep messages SHORT (2-4 sentences max)
- Use natural language, not marketing speak
- Use line breaks for readability
- NEVER use phrases like "As an AI" or "I'm just a bot"

## Available Capabilities
${capabilities.map(c => `- ${c}`).join('\n')}

## Critical Rules

### Product Information
- ONLY mention products from the provided list in ENVIRONMENT_SNAPSHOT
- ONLY use product_ids that exist in the products array you received
- NEVER invent or hallucinate product names, prices, or features
- If you don't have the product, say so honestly and suggest alternatives from the list

### Customer Understanding
- Read the conversation history to understand context
- Use the customer's name naturally if available
- Reference their previous interests when relevant
- Detect frustration and respond with empathy

### Decision Making
- For vague queries, ask ONE clarifying question
- If you can't help, use the handoff action
- Don't over-promise - only propose actions you can actually execute

### Image Handling
- If products have images (has_image: true) and would benefit from showing them, set send_images: true
- Only set send_images when showing products, not for general responses

## Output Format
You MUST respond with valid JSON matching the schema. Your response should include:
- conversation_action: The type of move (show_products, ask_clarification, etc.)
- business_actions: Array of actions to execute (can be empty)
- message: The actual text to send to the customer
- product_ids: (optional) ONLY use IDs from the products in ENVIRONMENT_SNAPSHOT
- send_images: (optional) true to include product images
- reasoning: (optional) 1-2 sentences max, or omit if obvious`;
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
 * No products found template
 */
export function getNoProductsTemplate(
  query: string,
  categories: string[],
  tone: BrandTone
): string {
  const categoryList = categories.length > 0
    ? `We do carry ${categories.slice(0, 3).join(', ')}${categories.length > 3 ? ' and more' : ''}.`
    : '';

  switch (tone) {
    case 'friendly':
      return `Hmm, I couldn't find anything matching "${query}". ${categoryList} Can you tell me more about what you're looking for?`;

    case 'professional':
      return `I wasn't able to find products matching "${query}". ${categoryList} Could you provide more details about what you're looking for?`;

    case 'casual':
      return `No luck finding "${query}". ${categoryList} What else did you have in mind?`;

    default:
      return `I couldn't find "${query}". ${categoryList} What else can I help you find?`;
  }
}

/**
 * Product fallback template (when LLM fails but we have products)
 */
export function getProductFallbackTemplate(
  products: Array<{ name: string; price: string }>,
  tone: BrandTone
): string {
  const productList = products.slice(0, 3).map(p => `• ${p.name} - ${p.price}`).join('\n');

  switch (tone) {
    case 'friendly':
      return `Here's what I found for you!\n\n${productList}\n\nWant more details on any of these?`;

    case 'professional':
      return `Here are some options:\n\n${productList}\n\nWould you like more information about any of these products?`;

    case 'casual':
      return `Check these out:\n\n${productList}\n\nLet me know which one catches your eye!`;

    default:
      return `Here's what I found:\n\n${productList}\n\nInterested in any of these?`;
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

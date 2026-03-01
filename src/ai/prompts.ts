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
 * Simplified: examples teach tone, not rules.
 */
export function buildDecisionSystemPrompt(
  businessName: string,
  tone: BrandTone,
  capabilities: string[]
): string {
  const toneInstructions = getToneInstructions(tone);

  return `You work at ${businessName}. Chat with customers on WhatsApp — help them find products, answer questions, handle complaints. You're the knowledgeable friend at the shop.

## Voice
${toneInstructions}
- Match the customer's energy. Short → short. Detailed → more detail.
- Text naturally: contractions, fragments, how a real person texts.
- Never sound like a chatbot. No "Certainly!", "Great question!", "I'd be happy to help", "Feel free to ask".

## Format
- Separate message bubbles with \\n\\n (double newline)
- 1-2 sentences per bubble. 2-3 bubbles per response.
- Greetings and farewells: 1 bubble only.

## Examples

GOOD — showing products:
"we got a few hoodies rn 👀\\n\\nthe Essential Pullover is $59.99 — super cozy, comes in black, gray, navy\\n\\nand the Zip-Up is $64.99 if you want something easier to throw on"

BAD — never do numbered lists:
"1) Essential Pullover — USD59.99 — S, M, L\\n2) Zip-Up — USD64.99 — S, M, L"

GOOD — greeting:
"hey! 👋 what's up"

BAD — greeting:
"Hey there! Welcome to ${businessName}! How can I help you today?"

GOOD — clarification:
"ooh date night — nice 😏\\n\\nwhat vibe are you going for?"

GOOD — product detail:
"solid pick 🔥\\n\\n$99, comes in S to XL. really clean fit"

## Rules

CONVERSATION AWARENESS — read the history first:
- Already greeted → skip greetings, jump to helping
- Already asked about size → don't ask again
- Customer picked a product → give details, don't re-pitch others

PRODUCTS:
- ONLY mention products from the provided list
- ONLY use product_ids from the products array
- NEVER invent names, prices, or features
- Use $ for prices, not "USD"
- Show 2-3 best matches conversationally

NEVER DO:
- Say "sending pics" or mention images/photos — the system handles images automatically
- Mention "add to cart", "checkout", "buy now" — we don't handle orders
- Ask the same question twice (size, color, preference)
- Mention store hours or "we're closed"

VAGUE REQUESTS ("something for a date", "gift ideas"):
- Ask a clarifying question with reply_type: "buttons" and 2-3 options
- Set conversation_action: "ask_clarification"

ESCALATION (conversation_action: "handoff"):
- Customer explicitly asks for a human
- Customer is angry AND you can't resolve it
- Same unresolved complaint repeated

## Interactive Messages
- reply_type: "buttons" → ask_clarification with 2-3 options (titles ≤20 chars)
- reply_type: "list" → auto-generated for show_products (don't fill reply_options)
- reply_type: null → greetings, conversation, farewells

## Lead Tracking
- log_interest: customer shows interest in a product
- update_lead_status: "engaged" / "warm" / "hot"
- flag_for_human: needs human attention

## Capabilities
${capabilities.map(c => `- ${c}`).join('\n')}`;
}

/**
 * Get tone-specific instructions
 */
function getToneInstructions(tone: BrandTone): string {
  switch (tone) {
    case 'friendly':
      return `- Warm, approachable. Like texting a friend who happens to work at the store.
- Emojis are fine but don't overdo it — 1-2 per response max.`;

    case 'professional':
      return `- Polished but not stiff. Think concierge, not corporate email.
- Complete sentences, but keep them short. No emojis.`;

    case 'casual':
      return `- Super laid back. Sentence fragments ok. Lowercase ok.
- Light humor and playfulness welcome. Emojis welcome.`;

    default:
      return `- Natural and helpful. Mirror the customer's vibe.`;
  }
}

/**
 * Build the user input for the LLM (environment snapshot as context)
 */
export function buildDecisionUserInput(env: EnvironmentSnapshot): string {
  const customerSection = buildCustomerSection(env);
  const productsSection = buildProductsSection(env);
  const conversationSection = buildConversationSection(env);

  // Build FAQ section if FAQs exist
  const faqSection = env.faqs && env.faqs.length > 0
    ? `\n## Frequently Asked Questions\nUse these answers when relevant. Adapt to conversation tone.\n${env.faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}\n`
    : '';

  return `## Customer Context
${customerSection}

## Available Products
${productsSection}

## Recent Conversation
${conversationSection}
${faqSection}
## Current Message
Customer: ${env.current_message}

## Business Rules
- Store: ${env.tenant_rules.business_name}
- Tone: ${env.tenant_rules.tone}
${env.tenant_rules.is_after_hours ? '- After hours: store is closed. Do NOT mention this unless the customer asks about it — just help normally.' : ''}
${env.tenant_rules.escalation_keywords.length > 0 ? `- High-priority escalation topics for this business: ${env.tenant_rules.escalation_keywords.join(', ')}` : ''}
${env.tenant_rules.available_categories.length > 0 ? `- Available categories: ${env.tenant_rules.available_categories.join(', ')}` : ''}

Now decide how to respond.`;
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
      details.push(`Sizes: ${compressSizes(p.sizes)}`);
    }

    if (p.colors && p.colors.length > 0) {
      details.push(`Colors: ${p.colors.join(', ')}`);
    }

    // Per-size stock info helps the LLM recommend available sizes
    if (p.size_stock) {
      details.push(`Stock: ${p.size_stock}`);
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

/**
 * Compress size arrays into readable ranges.
 * ["24", "26", "28", "30", "32"] → "24-32"
 * ["S", "M", "L", "XL"] → "S-XL"
 * ["S/M", "L/XL"] → "S/M, L/XL"
 */
function compressSizes(sizes: string[]): string {
  if (sizes.length <= 2) return sizes.join(', ');

  // Check if all sizes are numeric (jeans-style)
  const allNumeric = sizes.every(s => /^\d+$/.test(s));
  if (allNumeric) {
    return `${sizes[0]}-${sizes[sizes.length - 1]}`;
  }

  // Check if standard letter sizes
  const letterOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const allLetters = sizes.every(s => letterOrder.includes(s));
  if (allLetters && sizes.length >= 3) {
    return `${sizes[0]}-${sizes[sizes.length - 1]}`;
  }

  // Mixed or unusual sizes — just join
  return sizes.join(', ');
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

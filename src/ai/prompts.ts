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

  return `You work at ${businessName}. You're chatting with customers on WhatsApp — helping them find stuff, answering questions, handling complaints. Think of yourself as the knowledgeable friend who works at the shop. You know the products, you're direct, you don't over-explain.

## Voice
${toneInstructions}
- Match the customer's energy. Short message → short reply. Detailed question → more detail.
- Use contractions (you're, that's, we've). Use sentence fragments. The way a person actually texts.
- One idea per message bubble. Never cram everything into one message.

## NEVER say these (they sound robotic):
- "Certainly!", "Of course!", "Great question!", "Absolutely!", "Sure thing!", "I'd be happy to help"
- "As an AI assistant", "I'm just a bot"
- "Feel free to ask if you have any other questions"
- "I hope that helps!"
- "Based on your preferences", "Based on what you've shared"
- "Let me know if there's anything else I can assist you with"
- Numbered lists like "1) Product — Price — Sizes" (never list products this way)
- Bullet points for conversational replies
- Starting with "Great choice!" or "Awesome!" before every response

## Message Format
- Use \\n\\n (double newline) to separate each message bubble
- Each bubble: 1-2 sentences MAX
- 2-3 bubbles per response. Greetings: 1 bubble. Farewells: 1 bubble.

## EXAMPLES — this is how you should actually sound

### Showing products (GOOD):
"we got a few hoodies rn 👀\\n\\nthe Essential Pullover is $59.99 — super cozy, comes in black, gray, navy\\n\\nand the Zip-Up is $64.99 if you want something easier to throw on\\n\\nwhat size are you?"

### Showing products (BAD — never do this):
"Here are our available hoodies:\\n\\n1) Essential Pullover Hoodie — USD59.99 — sizes S, M, L, XL, XXL\\n2) Zip-Up Hoodie — USD64.99 — sizes S, M, L, XL\\n3) Oversized Hoodie — USD69.99 — OUT OF STOCK\\n\\nWhich one interests you?"

### Greeting (GOOD):
"hey! 👋 what's up"

### Greeting (BAD):
"Hey there! 👋 Welcome to StyleHub Fashion! How can I help you today? We have T-Shirts, Jeans, Hoodies, and Accessories."

### Clarification (GOOD):
"ooh date night — nice 😏\\n\\nwhat vibe are you going for?"
(with buttons: "Casual" / "Dressy" / "Sporty")

### Clarification (BAD):
"Great choice! I'd love to help you find the perfect date night outfit. Are you looking for something casual, dressy, or sporty? We have options in all categories."

### Out of stock (GOOD):
"ah the Oversized Hoodie is sold out rn 😩 restocking soon tho\\n\\nthe Essential Pullover has a similar vibe if you want something cozy — $59.99"

### Customer picked a product (GOOD):
"solid pick — the High-Rise Skinny Jeans are 🔥\\n\\n$89.99, sizes 24-32. what size do you need?"

### Customer picked a product (BAD):
"Nice choice! The High-Rise Skinny Jeans are a great option. They're priced at USD89.99 and are available in sizes 24, 26, 28, 30, and 32. What size would you like?"

## Conversation Rules

READ THE CONVERSATION HISTORY FIRST:
- Already greeted? → DO NOT greet again. Jump straight to helping.
- Customer gave their size? → Don't ask again.
- Customer picked a product? → Move forward, don't re-pitch.
- If Recent Conversation has ANY messages, skip greetings/intros entirely.

GREETINGS: Short. Use their name if you have it. Don't pitch products — let them tell you what they want.

VAGUE REQUESTS ("something for a date", "gift ideas", "show me something nice"):
- Ask a clarifying question FIRST — do NOT jump to products
- Use reply_type: "buttons" with 2-3 options
- Set conversation_action: "ask_clarification"

PRODUCT QUERIES ("show me hoodies", "got jeans?"):
- Show 2-3 best matches conversationally (not as a numbered list)
- Mention the standout feature of each, not every spec
- Ask ONE follow-up (size or color, not both)

ESCALATION:
- Use conversation_action: "handoff" when:
  - Customer explicitly asks for a human
  - Customer is angry AND you can't resolve it
  - Same complaint repeated and unresolved
  - ALL CAPS anger about unresolved issues
- Do NOT hand off for general frustration you can address
- Always add flag_for_human business action with a reason

AFTER HOURS:
- NEVER mention store hours, "we're closed", or availability
- You are always here. Just help normally.

## Product Rules
- ONLY mention products from the provided product list
- ONLY use product_ids that exist in the products array
- NEVER invent product names, prices, or features
- If no products match, suggest categories that do exist
- When mentioning prices, use the currency symbol ($ for USD) not the code

## Image & Interactive Rules
- send_images: true only when showing products with "Has image: yes"
- reply_type: "buttons" → for ask_clarification with 2-3 options (titles ≤20 chars)
- reply_type: "list" → auto-generated for show_products (you don't fill reply_options)
- reply_type: null → for greetings, conversation, farewells
- reply_options: Array of {id, title, description} — only for buttons

## Sales Flow
1. Discovery: Show 2-3 products, ask ONE preference question
2. Narrowing: Don't re-ask info they gave. Move forward.
3. Decision: They picked something → ask about size/delivery
4. Commitment: Confirm details, offer promo if available

## Lead Tracking
- log_interest: when customer shows interest
- update_lead_status: "engaged" / "warm" / "hot"
- flag_for_human: when situation needs human attention

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

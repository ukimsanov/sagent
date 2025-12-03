/**
 * Code-First Message Handler
 *
 * This handler implements the "code-first, LLM-last" pattern:
 * - Rule-based intent classification (no LLM)
 * - Deterministic business logic (search, 0 results handling)
 * - LLM only used as copywriter for product descriptions
 *
 * Benefits:
 * - Single API call max per message
 * - All business rules enforced in TypeScript
 * - No tool calling loops
 * - Predictable responses, no timeouts
 */

import { searchProducts, getAllCategories } from '../db/queries';
import type { Business, Lead, ProductWithMetadata, ConversationSummary } from '../db/queries';

// ============================================================================
// Types
// ============================================================================

export interface HandlerContext {
  db: D1Database;
  businessId: string;
  business: Business;
  lead: Lead;
  messageText: string;
  openaiApiKey: string;
  // v2: Conversation context for "feels like a person" responses
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversationSummary: ConversationSummary | null;
}

type Intent =
  | { type: 'greeting' }
  | { type: 'thanks' }
  | { type: 'handoff_request' }
  | { type: 'product_search'; query: string };

interface HandlerResponse {
  message: string;
  flaggedForHuman: boolean;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main entry point for code-first message handling.
 * Worker calls this instead of the tool-calling agent.
 */
export async function handleIncomingMessage(ctx: HandlerContext): Promise<HandlerResponse> {
  const intent = classifyIntent(ctx.messageText, ctx.conversationHistory);

  console.log('🎯 Intent classified:', intent.type);

  switch (intent.type) {
    case 'greeting':
      return { message: handleGreeting(ctx), flaggedForHuman: false };
    case 'thanks':
      return { message: handleThanks(ctx), flaggedForHuman: false };
    case 'handoff_request':
      return { message: handleHandoff(ctx), flaggedForHuman: true };
    case 'product_search':
      return await handleProductSearch(intent, ctx);
  }
}

// ============================================================================
// Intent Classification (Rule-Based, NO LLM)
// ============================================================================

function classifyIntent(text: string, conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>): Intent {
  const lower = text.toLowerCase().trim();

  // Greetings (must be at start of message)
  if (/^(hi|hello|hey|hola|good morning|good afternoon|good evening|yo|sup)\b/.test(lower)) {
    return { type: 'greeting' };
  }

  // Thanks (must be at start of message)
  if (/^(thanks|thank you|thx|ty|appreciate it)\b/.test(lower)) {
    return { type: 'thanks' };
  }

  // Handoff request (anywhere in message)
  if (/\b(human|agent|person|representative|talk to someone|speak to someone|real person)\b/.test(lower)) {
    return { type: 'handoff_request' };
  }

  // Everything else is a product search - extract the actual query
  const query = extractSearchQuery(text, conversationHistory);
  return { type: 'product_search', query };
}

/**
 * Extract the actual product search terms from a message.
 * Removes common conversational prefixes like "show me", "I want", etc.
 * Also detects contextual references like "what goes with that" and uses conversation history.
 */
function extractSearchQuery(text: string, conversationHistory?: Array<{ role: string; content: string }>): string {
  let query = text.toLowerCase().trim();

  // Check for contextual follow-up patterns like "what goes with that"
  const contextualPatterns = [
    /^what (goes|pairs|matches|looks good) with (that|this|it|them)\??$/i,
    /^(something|anything) (to go|that goes|to match|that matches) with (that|this|it|them)\??$/i,
    /^(and|what about) (pants|jeans|shoes|accessories|tops|bottoms) (to go with|for) (that|this|it|them)\??$/i,
  ];

  const isContextualFollowUp = contextualPatterns.some(p => p.test(query));

  if (isContextualFollowUp && conversationHistory && conversationHistory.length > 0) {
    // Find the last product category mentioned in the conversation
    const lastAssistantMessage = [...conversationHistory]
      .reverse()
      .find(m => m.role === 'assistant');

    if (lastAssistantMessage) {
      // Extract category hints from the last response
      const content = lastAssistantMessage.content.toLowerCase();
      if (content.includes('hoodie')) {
        // For hoodies, suggest complementary items
        return 'jeans pants';
      } else if (content.includes('jeans') || content.includes('pants')) {
        return 't-shirts tops';
      } else if (content.includes('t-shirt') || content.includes('tee')) {
        return 'jeans pants';
      }
    }
    // Default: search for complementary items broadly
    return 'jeans pants accessories';
  }

  // Remove common conversational prefixes
  const prefixes = [
    /^(can you )?(please )?(show me|let me see|i('d)? (want|like|need) (to see)?|do you have|got any|looking for|searching for|find me|get me)\s*/i,
    /^(i('m)? (interested in|looking for))\s*/i,
    /^(what|which) .* do you have\??$/i,
    /^(any|some)\b\s*/i,
    /^something (for|to wear to|to go with)\s*/i,  // "something for a wedding" → "a wedding"
  ];

  for (const prefix of prefixes) {
    query = query.replace(prefix, '');
  }

  // Remove trailing question marks and leading articles, clean up
  query = query.replace(/\?+$/, '').replace(/^(a|an|the)\s+/i, '').trim();

  // If we've stripped everything, use original text
  return query || text;
}

// ============================================================================
// Deterministic Handlers (NO LLM)
// ============================================================================

function handleGreeting(ctx: HandlerContext): string {
  const name = ctx.lead.name;
  const businessName = ctx.business.name;

  if (name) {
    return `Hey ${name}! Welcome back to ${businessName}. What can I help you find today?`;
  }
  return `Hey! Welcome to ${businessName}. What can I help you find today?`;
}

function handleThanks(_ctx: HandlerContext): string {
  return `You're welcome! Let me know if you need anything else.`;
}

function handleHandoff(_ctx: HandlerContext): string {
  return `I'll have someone from our team reach out to you shortly!`;
}

// ============================================================================
// Product Search Handler (Code-First)
// ============================================================================

async function handleProductSearch(
  intent: { type: 'product_search'; query: string },
  ctx: HandlerContext
): Promise<HandlerResponse> {
  console.log('🔍 Searching for:', intent.query);

  // 1. Search products directly in code (from queries.ts)
  const products = await searchProducts(ctx.db, ctx.businessId, intent.query);
  console.log(`🔍 Found ${products.length} products for query "${intent.query}"`);

  // 2. DETERMINISTIC: 0 results = template, NO LLM
  if (products.length === 0) {
    const categories = await getAllCategories(ctx.db, ctx.businessId);
    console.log('📂 Available categories:', categories);
    console.log('📋 Using: TEMPLATE (0 results, no LLM)');
    const message = buildNoProductsTemplate(intent.query, categories);
    return { message, flaggedForHuman: false };
  }

  // 3. Products found = LLM as copywriter (one call, no tools)
  const trimmed = products.slice(0, 8); // Hard cap at 8 products
  console.log(`📋 Using: LLM COPYWRITER (${trimmed.length} products)`);
  const message = await generateProductCopy(trimmed, ctx);
  return { message, flaggedForHuman: false };
}

/**
 * 100% deterministic - no LLM needed for "we don't have X" response
 */
function buildNoProductsTemplate(query: string, categories: string[]): string {
  if (categories.length === 0) {
    return `We don't carry "${query}" right now. Let me know what else I can help you find!`;
  }

  return `We don't carry "${query}" right now.\n\n` +
    `Here's what we do have: ${categories.join(', ')}.\n\n` +
    `What are you most interested in?`;
}

// ============================================================================
// LLM Copywriter (Single Call, No Tools)
// ============================================================================

/**
 * Build system prompt with persona, tone, and conversation logic.
 * v2: Makes responses feel like a real person.
 */
function buildSystemPrompt(ctx: HandlerContext): string {
  return `You are a WhatsApp sales assistant for ${ctx.business.name}.

PERSONALITY
- Friendly, relaxed, confident - like a helpful store employee
- Short messages: 1-3 sentences max
- Natural language: "yeah", "sure", "got it" when appropriate
- Never say you're an AI or bot

BEHAVIOR
- ONLY mention products from PRODUCTS list below
- If request is vague, ask ONE clarifying question first
- If PRODUCTS has many options, highlight 2-4 best matches
- Always end with a simple next step ("Want to see more?" / "Any color preference?")

CONVERSATION LOGIC
- If customer gave specific details (size, color, occasion) → recommend matching items
- If request is vague → ask ONE question to narrow down
- Never ask more than one question per message
- Reference previous messages naturally when relevant`;
}

/**
 * Build customer context from lead data and conversation summary.
 * v2: Personalizes responses using stored customer info.
 */
function buildCustomerContext(ctx: HandlerContext): string {
  const parts: string[] = [];

  if (ctx.lead.name) {
    parts.push(`Customer name: ${ctx.lead.name}`);
  }

  if (ctx.conversationSummary?.key_interests) {
    const interests = safeParseArray(ctx.conversationSummary.key_interests);
    if (interests.length > 0) {
      parts.push(`Previous interests: ${interests.join(', ')}`);
    }
  }

  if (ctx.conversationSummary?.objections) {
    const objections = safeParseArray(ctx.conversationSummary.objections);
    if (objections.length > 0) {
      parts.push(`Past concerns: ${objections.join(', ')}`);
    }
  }

  return parts.length > 0 ? `CUSTOMER CONTEXT:\n${parts.join('\n')}\n` : '';
}

/**
 * Safely parse a JSON array string, returning empty array on failure.
 */
function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Uses LLM only for natural language generation when products are found.
 * Falls back to deterministic template if LLM fails.
 * v2: Includes conversation history and customer context.
 */
async function generateProductCopy(
  products: ProductWithMetadata[],
  ctx: HandlerContext
): Promise<string> {
  // Format recent conversation (last 4 messages for context)
  const recentHistory = ctx.conversationHistory.slice(-4);
  const historyText = recentHistory.length > 0
    ? recentHistory.map(m =>
        `${m.role === 'user' ? 'Customer' : 'You'}: ${m.content}`
      ).join('\n')
    : '';

  // Build customer context from lead + summary
  const customerContext = buildCustomerContext(ctx);

  const llmResponse = await callLLMForCopy(
    [
      {
        role: 'system',
        content: buildSystemPrompt(ctx)
      },
      {
        role: 'user',
        content: `${customerContext}
${historyText ? `RECENT CONVERSATION:\n${historyText}\n\n` : ''}CURRENT MESSAGE: "${ctx.messageText}"

PRODUCTS:
${JSON.stringify(products.map(p => ({
  name: p.name,
  price: p.price,
  description: p.description?.substring(0, 100),
  category: p.category
})))}`
      }
    ],
    ctx.openaiApiKey
  );

  // Fallback if LLM fails or returns empty
  if (llmResponse) {
    return llmResponse;
  }

  console.log('📋 Using: FALLBACK TEMPLATE (LLM failed)');
  return buildProductFallback(products);
}

/**
 * Deterministic fallback if LLM call fails or times out
 */
function buildProductFallback(products: ProductWithMetadata[]): string {
  const list = products
    .map(p => `• ${p.name} - $${p.price}`)
    .join('\n');

  return `Here's what I found:\n\n${list}\n\nWant details on any of these?`;
}

// ============================================================================
// LLM Wrapper with Timeout
// ============================================================================

// Response shape from OpenAI Responses API
interface ResponsesAPIResponse {
  output: Array<{
    type: string;
    content?: Array<{
      type: string;
      text?: string;
    }>;
  }>;
}

/**
 * Central wrapper for all LLM calls.
 * - 20 second timeout (leaves 10s buffer for Worker)
 * - Returns null on failure (triggers deterministic fallback)
 * - Uses gpt-5-mini (more reliable than nano)
 */
async function callLLMForCopy(
  input: Array<{ role: string; content: string }>,
  apiKey: string
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000); // 20s timeout
  const startTime = Date.now();

  try {
    console.log('🤖 Calling LLM for copy (gpt-5-mini)...');

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-5-mini', // NOT nano - more reliable for this use case
        input,
        max_output_tokens: 256 // Small, bounded - enough for WhatsApp messages
        // NO reasoning config
        // NO tools - pure copywriting
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ LLM API error:', res.status, errorText);
      return null;
    }

    const json = await res.json() as ResponsesAPIResponse;

    // Extract text from Responses API format: output[].content[].text
    const messageItem = json.output?.find(item => item.type === 'message');
    const textContent = messageItem?.content?.find(c => c.type === 'output_text');
    const text = textContent?.text?.trim();

    const duration = Date.now() - startTime;
    console.log(`⏱️ LLM call completed in ${duration}ms`);

    if (text && text.length > 0) {
      console.log('✅ LLM response received:', text.substring(0, 100) + '...');
      return text;
    }

    console.warn('⚠️ LLM returned empty response, output:', JSON.stringify(json.output?.map(o => o.type)));
    return null;

  } catch (err) {
    const duration = Date.now() - startTime;

    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`⏱️ LLM call timed out after ${duration}ms`);
    } else {
      console.error(`❌ LLM call failed after ${duration}ms:`, err);
    }

    return null; // Fallback to template
  } finally {
    clearTimeout(timeout);
  }
}

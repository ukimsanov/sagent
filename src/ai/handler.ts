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

import { searchProducts, getAllCategories, createHumanFlag } from '../db/queries';
import type { Business, Lead, ProductWithMetadata, ConversationSummary } from '../db/queries';
import {
  classifyIntent,
  isVagueQuery,
  getClarifyingQuestion,
  shouldAutoHandoff,
  type Intent,
  type ConversationContext
} from './intents';

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
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversationSummary: ConversationSummary | null;
}

/** Structured response with action tracking for analytics */
export interface HandlerResponse {
  message: string;
  action: ResponseAction;
  flaggedForHuman: boolean;
  // Analytics fields (optional - for Phase 3)
  intentType?: string;
  searchQuery?: string;
  productsShown?: string[];
  clarificationCount?: number;
}

type ResponseAction =
  | 'show_products'
  | 'ask_clarification'
  | 'answer_question'
  | 'empathize'
  | 'greet'
  | 'thank'
  | 'handoff';

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main entry point for code-first message handling.
 * Worker calls this instead of the tool-calling agent.
 */
export async function handleIncomingMessage(ctx: HandlerContext): Promise<HandlerResponse> {
  // Build conversation context for intent classification
  const convContext: ConversationContext = {
    history: ctx.conversationHistory,
    recentClarifications: countRecentClarifications(ctx.conversationHistory)
  };

  // Check for auto-handoff conditions
  if (shouldAutoHandoff(convContext)) {
    console.log('🚨 Auto-handoff triggered: too many clarifications or repeated messages');
    await createHumanFlag(ctx.db, ctx.lead.id, 'medium', 'Auto-handoff: conversation stuck');
    return {
      message: handleAutoHandoff(ctx),
      action: 'handoff',
      flaggedForHuman: true
    };
  }

  // Classify intent
  const intent = classifyIntent(ctx.messageText, convContext);
  console.log('🎯 Intent classified:', intent.type);

  // Track clarification count for analytics
  const clarificationCount = convContext.recentClarifications;

  // Route to appropriate handler
  switch (intent.type) {
    case 'greeting':
      return {
        message: handleGreeting(ctx),
        action: 'greet',
        flaggedForHuman: false,
        intentType: 'greeting',
        clarificationCount
      };

    case 'thanks':
      return {
        message: handleThanks(ctx),
        action: 'thank',
        flaggedForHuman: false,
        intentType: 'thanks',
        clarificationCount
      };

    case 'handoff_request':
      await createHumanFlag(ctx.db, ctx.lead.id, 'low', 'Customer requested human');
      return {
        message: handleHandoff(ctx),
        action: 'handoff',
        flaggedForHuman: true,
        intentType: 'handoff_request',
        clarificationCount
      };

    case 'complaint':
      return await handleComplaint(intent, ctx, clarificationCount);

    case 'order_status':
      return handleOrderStatus(ctx, clarificationCount);

    case 'sizing_help':
      return await handleSizingHelp(intent, ctx, clarificationCount);

    case 'pricing_question':
      return await handlePricingQuestion(intent, ctx, clarificationCount);

    case 'comparison':
      return await handleComparison(intent, ctx, clarificationCount);

    case 'recommendation':
      return await handleRecommendation(intent, ctx, clarificationCount);

    case 'product_search':
      return await handleProductSearch(intent, ctx, clarificationCount);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function countRecentClarifications(history: Array<{ role: string; content: string }>): number {
  // Count assistant messages that end with questions in last 6 messages
  const recent = history.slice(-6);
  return recent.filter(m =>
    m.role === 'assistant' && m.content.trim().endsWith('?')
  ).length;
}

// ============================================================================
// Deterministic Handlers (NO LLM)
// ============================================================================

function handleGreeting(ctx: HandlerContext): string {
  const name = ctx.lead.name;
  const businessName = ctx.business.name;

  // Check if returning customer
  const daysSinceLastContact = Math.floor((Date.now() / 1000 - ctx.lead.last_contact) / 86400);
  const isReturning = ctx.lead.message_count > 1 && daysSinceLastContact >= 3;

  if (isReturning && name) {
    return `Hey ${name}! Good to see you again. What can I help you with today?`;
  }

  if (name) {
    return `Hey ${name}! Welcome to ${businessName}. What are you looking for today?`;
  }

  return `Hey! Welcome to ${businessName}. What can I help you find?`;
}

function handleThanks(ctx: HandlerContext): string {
  const name = ctx.lead.name;
  if (name) {
    return `You're welcome, ${name}! Let me know if you need anything else.`;
  }
  return `You're welcome! Let me know if you need anything else.`;
}

function handleHandoff(ctx: HandlerContext): string {
  const name = ctx.lead.name;
  if (name) {
    return `Got it, ${name}! I'll have someone from our team reach out to you shortly.`;
  }
  return `No problem! I'll have someone from our team reach out to you shortly.`;
}

function handleAutoHandoff(ctx: HandlerContext): string {
  const name = ctx.lead.name;
  const base = "I want to make sure you get the help you need.";
  const action = "Let me connect you with someone from our team who can assist better.";

  if (name) {
    return `${name}, ${base} ${action}`;
  }
  return `${base} ${action}`;
}

function handleOrderStatus(ctx: HandlerContext, clarificationCount: number): HandlerResponse {
  // We don't have order system access - flag for human
  return {
    message: "I'd love to help with your order! Let me connect you with someone who can look that up for you.",
    action: 'handoff',
    flaggedForHuman: true,
    intentType: 'order_status',
    clarificationCount
  };
}

// ============================================================================
// Complaint Handler
// ============================================================================

async function handleComplaint(
  intent: { type: 'complaint'; severity: 'low' | 'medium' | 'high' },
  ctx: HandlerContext,
  clarificationCount: number
): Promise<HandlerResponse> {
  const name = ctx.lead.name ? `${ctx.lead.name}, ` : '';

  // Always flag complaints for human review
  await createHumanFlag(ctx.db, ctx.lead.id, intent.severity, `Customer complaint: ${ctx.messageText.substring(0, 100)}`);

  if (intent.severity === 'high') {
    return {
      message: `${name}I'm really sorry you're having this experience. This is important and I want to make sure it's handled properly. Let me get someone from our team to help you right away.`,
      action: 'empathize',
      flaggedForHuman: true,
      intentType: 'complaint',
      clarificationCount
    };
  }

  if (intent.severity === 'medium') {
    return {
      message: `${name}I'm sorry to hear that. I understand this is frustrating. Would you like me to connect you with someone who can help resolve this?`,
      action: 'empathize',
      flaggedForHuman: true,
      intentType: 'complaint',
      clarificationCount
    };
  }

  // Low severity - try to help first
  return {
    message: `${name}I'm sorry for any confusion. Let me try to help - can you tell me a bit more about what's going on?`,
    action: 'empathize',
    flaggedForHuman: true,
    intentType: 'complaint',
    clarificationCount
  };
}

// ============================================================================
// Sizing Help Handler
// ============================================================================

async function handleSizingHelp(
  intent: { type: 'sizing_help'; query: string },
  ctx: HandlerContext,
  clarificationCount: number
): Promise<HandlerResponse> {
  // Search for products to get sizing info
  const products = await searchProducts(ctx.db, ctx.businessId, intent.query);

  if (products.length === 0) {
    return {
      message: "I can help with sizing! What item are you looking at?",
      action: 'ask_clarification',
      flaggedForHuman: false,
      intentType: 'sizing_help',
      searchQuery: intent.query,
      clarificationCount
    };
  }

  // Check if products have size metadata
  const product = products[0];
  const metadata = product.metadata as Record<string, unknown> | null;

  if (metadata?.sizes) {
    const sizes = metadata.sizes as string[];
    return {
      message: `The ${product.name} comes in: ${sizes.join(', ')}.\n\nMost customers find it runs true to size. What size do you usually wear?`,
      action: 'answer_question',
      flaggedForHuman: false,
      intentType: 'sizing_help',
      searchQuery: intent.query,
      productsShown: [product.id],
      clarificationCount
    };
  }

  // Generic sizing response
  return {
    message: `For the ${product.name}, I'd recommend going with your usual size. If you're between sizes or prefer a looser fit, size up. What size are you thinking?`,
    action: 'answer_question',
    flaggedForHuman: false,
    intentType: 'sizing_help',
    searchQuery: intent.query,
    productsShown: [product.id],
    clarificationCount
  };
}

// ============================================================================
// Pricing Question Handler
// ============================================================================

async function handlePricingQuestion(
  intent: { type: 'pricing_question'; query: string },
  ctx: HandlerContext,
  clarificationCount: number
): Promise<HandlerResponse> {
  const products = await searchProducts(ctx.db, ctx.businessId, intent.query);

  if (products.length === 0) {
    const categories = await getAllCategories(ctx.db, ctx.businessId);
    return {
      message: `What kind of items are you looking to price check? We have ${categories.join(', ')}.`,
      action: 'ask_clarification',
      flaggedForHuman: false,
      intentType: 'pricing_question',
      searchQuery: intent.query,
      clarificationCount
    };
  }

  if (products.length === 1) {
    const p = products[0];
    return {
      message: `The ${p.name} is $${p.price}. Want to know more about it?`,
      action: 'answer_question',
      flaggedForHuman: false,
      intentType: 'pricing_question',
      searchQuery: intent.query,
      productsShown: [p.id],
      clarificationCount
    };
  }

  // Multiple products - show price range
  const prices = products.map(p => p.price || 0).filter(p => p > 0);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  if (min === max) {
    return {
      message: `Those are $${min} each. Want me to show you the options?`,
      action: 'answer_question',
      flaggedForHuman: false,
      intentType: 'pricing_question',
      searchQuery: intent.query,
      productsShown: products.map(p => p.id),
      clarificationCount
    };
  }

  return {
    message: `Prices range from $${min} to $${max}. Want me to show you what's available?`,
    action: 'answer_question',
    flaggedForHuman: false,
    intentType: 'pricing_question',
    searchQuery: intent.query,
    productsShown: products.map(p => p.id),
    clarificationCount
  };
}

// ============================================================================
// Comparison Handler
// ============================================================================

async function handleComparison(
  intent: { type: 'comparison'; items: string[] },
  ctx: HandlerContext,
  clarificationCount: number
): Promise<HandlerResponse> {
  // Search for both items
  const query = intent.items.join(' ');
  const products = await searchProducts(ctx.db, ctx.businessId, query);

  if (products.length < 2) {
    return {
      message: "I can help you compare! Which two items are you looking at?",
      action: 'ask_clarification',
      flaggedForHuman: false,
      intentType: 'comparison',
      searchQuery: query,
      clarificationCount
    };
  }

  // Use LLM to generate a natural comparison
  const comparedProducts = products.slice(0, 2);
  const message = await generateComparisonCopy(comparedProducts, ctx);
  return {
    message,
    action: 'answer_question',
    flaggedForHuman: false,
    intentType: 'comparison',
    searchQuery: query,
    productsShown: comparedProducts.map(p => p.id),
    clarificationCount
  };
}

// ============================================================================
// Recommendation Handler
// ============================================================================

async function handleRecommendation(
  intent: { type: 'recommendation'; context: string },
  ctx: HandlerContext,
  clarificationCount: number
): Promise<HandlerResponse> {
  // Use context to guide search
  let searchQuery = intent.context;

  // Map occasions to product categories
  const occasionMap: Record<string, string> = {
    'wedding': 'dress shirt formal',
    'party': 'dress accessories',
    'work': 'shirts pants formal',
    'casual': 'jeans t-shirts hoodies',
    'date': 'dress shirt jeans',
    'gym': 'athletic sports',
    'beach': 'shorts casual',
    'formal': 'suit dress formal',
    'streetwear': 'hoodies jeans sneakers',
  };

  if (occasionMap[intent.context.toLowerCase()]) {
    searchQuery = occasionMap[intent.context.toLowerCase()];
  }

  const products = await searchProducts(ctx.db, ctx.businessId, searchQuery);

  if (products.length === 0) {
    // Try a broader search
    const allProducts = await searchProducts(ctx.db, ctx.businessId, 'popular');
    if (allProducts.length > 0) {
      const shownProducts = allProducts.slice(0, 4);
      const message = await generateProductCopy(shownProducts, ctx);
      return {
        message,
        action: 'show_products',
        flaggedForHuman: false,
        intentType: 'recommendation',
        searchQuery,
        productsShown: shownProducts.map(p => p.id),
        clarificationCount
      };
    }

    return {
      message: "I'd love to help you find something! What style are you into - casual, dressy, or somewhere in between?",
      action: 'ask_clarification',
      flaggedForHuman: false,
      intentType: 'recommendation',
      searchQuery,
      clarificationCount
    };
  }

  const shownProducts = products.slice(0, 4);
  const message = await generateProductCopy(shownProducts, ctx);
  return {
    message,
    action: 'show_products',
    flaggedForHuman: false,
    intentType: 'recommendation',
    searchQuery,
    productsShown: shownProducts.map(p => p.id),
    clarificationCount
  };
}

// ============================================================================
// Product Search Handler
// ============================================================================

async function handleProductSearch(
  intent: { type: 'product_search'; query: string },
  ctx: HandlerContext,
  clarificationCount: number
): Promise<HandlerResponse> {
  console.log('🔍 Searching for:', intent.query);

  // Check if query is too vague
  if (isVagueQuery(intent.query)) {
    const clarifyingQuestion = getClarifyingQuestion(intent.query);
    console.log('📋 Vague query - asking clarifying question');
    return {
      message: clarifyingQuestion,
      action: 'ask_clarification',
      flaggedForHuman: false,
      intentType: 'product_search',
      searchQuery: intent.query,
      clarificationCount
    };
  }

  // Search products
  const products = await searchProducts(ctx.db, ctx.businessId, intent.query);
  console.log(`🔍 Found ${products.length} products for query "${intent.query}"`);

  // DETERMINISTIC: 0 results = template, NO LLM
  if (products.length === 0) {
    const categories = await getAllCategories(ctx.db, ctx.businessId);
    console.log('📂 Available categories:', categories);
    console.log('📋 Using: TEMPLATE (0 results, no LLM)');
    return {
      message: buildNoProductsTemplate(intent.query, categories),
      action: 'answer_question',
      flaggedForHuman: false,
      intentType: 'product_search',
      searchQuery: intent.query,
      clarificationCount
    };
  }

  // Products found = LLM as copywriter
  const trimmed = products.slice(0, 6);
  console.log(`📋 Using: LLM COPYWRITER (${trimmed.length} products)`);
  const message = await generateProductCopy(trimmed, ctx);
  return {
    message,
    action: 'show_products',
    flaggedForHuman: false,
    intentType: 'product_search',
    searchQuery: intent.query,
    productsShown: trimmed.map(p => p.id),
    clarificationCount
  };
}

/**
 * 100% deterministic - no LLM needed for "we don't have X" response
 */
function buildNoProductsTemplate(query: string, categories: string[]): string {
  if (categories.length === 0) {
    return `We don't carry "${query}" right now. Let me know what else I can help you find!`;
  }

  return `We don't have "${query}" at the moment.\n\nWe do have: ${categories.join(', ')}.\n\nAnything there catch your eye?`;
}

// ============================================================================
// LLM Copywriter Functions
// ============================================================================

/**
 * Build system prompt with persona, tone, and conversation logic.
 */
function buildSystemPrompt(ctx: HandlerContext): string {
  const name = ctx.lead.name;
  const greeting = name ? `You're chatting with ${name}.` : '';

  return `You are a WhatsApp sales assistant for ${ctx.business.name}. ${greeting}

PERSONALITY
- Friendly, relaxed, confident - like a helpful store employee
- Short messages: 2-4 sentences max
- Natural language: "yeah", "sure", "got it" when appropriate
- Never say you're an AI or bot
- Use their name occasionally but not every message

BEHAVIOR
- ONLY mention products from PRODUCTS list below
- Highlight 2-3 best matches, not everything
- Always end with a simple next step or question
- If comparing products, be concise and helpful

FORMATTING
- Keep it WhatsApp-friendly: short paragraphs, easy to read
- One idea per paragraph
- Use natural breaks, not bullet points for product lists`;
}

/**
 * Build customer context from lead data and conversation summary.
 */
function buildCustomerContext(ctx: HandlerContext): string {
  const parts: string[] = [];

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
 * Generate natural product copy using LLM.
 */
async function generateProductCopy(
  products: ProductWithMetadata[],
  ctx: HandlerContext
): Promise<string> {
  const recentHistory = ctx.conversationHistory.slice(-4);
  const historyText = recentHistory.length > 0
    ? recentHistory.map(m =>
        `${m.role === 'user' ? 'Customer' : 'You'}: ${m.content}`
      ).join('\n')
    : '';

  const customerContext = buildCustomerContext(ctx);

  const userContent = `${customerContext}
${historyText ? `RECENT CONVERSATION:\n${historyText}\n\n` : ''}CURRENT MESSAGE: "${ctx.messageText}"

PRODUCTS TO RECOMMEND:
${JSON.stringify(products.map(p => ({
  name: p.name,
  price: p.price,
  description: p.description?.substring(0, 80),
  category: p.category
})), null, 2)}`;

  const llmResponse = await callLLMForCopy(
    buildSystemPrompt(ctx),
    userContent,
    ctx.openaiApiKey
  );

  return llmResponse ?? buildProductFallback(products);
}

/**
 * Generate comparison copy for two products.
 */
async function generateComparisonCopy(
  products: ProductWithMetadata[],
  ctx: HandlerContext
): Promise<string> {
  const [p1, p2] = products;

  const userContent = `Customer wants to compare products. Give a brief, helpful comparison.

PRODUCT 1: ${p1.name} - $${p1.price}
${p1.description || 'No description'}

PRODUCT 2: ${p2.name} - $${p2.price}
${p2.description || 'No description'}

Keep it short and end with a question to help them decide.`;

  const llmResponse = await callLLMForCopy(
    buildSystemPrompt(ctx),
    userContent,
    ctx.openaiApiKey
  );

  if (llmResponse) return llmResponse;

  // Fallback
  return `The ${p1.name} is $${p1.price} and the ${p2.name} is $${p2.price}.\n\nBoth are great choices! Which vibe are you going for?`;
}

/**
 * Deterministic fallback if LLM fails.
 */
function buildProductFallback(products: ProductWithMetadata[]): string {
  const top3 = products.slice(0, 3);
  const list = top3
    .map(p => `${p.name} - $${p.price}`)
    .join('\n');

  return `Here's what I found:\n\n${list}\n\nWant details on any of these?`;
}

// ============================================================================
// LLM Wrapper
// ============================================================================

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
 * Central wrapper for all LLM calls with timeout and fallback.
 * Uses OpenAI Responses API format with instructions parameter.
 */
async function callLLMForCopy(
  instructions: string,
  userContent: string,
  apiKey: string
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
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
        model: 'gpt-5-mini',
        instructions,
        input: userContent,
        // GPT-5-mini is a reasoning model - needs higher token limit
        // for internal reasoning + actual output
        max_output_tokens: 2048
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ LLM API error:', res.status, errorText);
      return null;
    }

    const json = await res.json() as ResponsesAPIResponse;
    const duration = Date.now() - startTime;
    console.log(`⏱️ LLM call completed in ${duration}ms`);

    const messageItem = json.output?.find(item => item.type === 'message');
    const textContent = messageItem?.content?.find(c => c.type === 'output_text');
    const text = textContent?.text?.trim();

    if (text && text.length > 0) {
      console.log('✅ LLM response received:', text.substring(0, 80) + '...');
      return text;
    }

    console.warn('⚠️ LLM returned empty response');
    return null;

  } catch (err) {
    const duration = Date.now() - startTime;
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`⏱️ LLM call timed out after ${duration}ms`);
    } else {
      console.error(`❌ LLM call failed after ${duration}ms:`, err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

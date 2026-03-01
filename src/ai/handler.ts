/**
 * LLM Decision Engine Handler
 *
 * Every message goes through the LLM. No deterministic fast-paths.
 * The LLM decides the conversational action; code validates and executes.
 * Fallback to handoff only when LLM fails completely.
 */

import {
  searchProducts,
  getAllCategories,
  createHumanFlag,
  getBusinessConfig,
  getProductsByIds,
} from '../db/queries';
import type { Business, Lead, ProductWithMetadata, ConversationSummary } from '../db/queries';

// Phase 2: Semantic search
import { searchProductsVectorize } from './embeddings';

// Modules
import { callLLMForDecision, isValidDecision, type LLMDecision, type ConversationAction } from './llm';
import { buildEnvironmentSnapshot, extractSearchQuery, needsProductSearch } from './environment';
import { executeDecision, validateDecision, shouldSendImages, getProductsWithImages } from './executor';
import {
  buildDecisionSystemPrompt,
  buildDecisionUserInput,
  getHandoffMessage,
} from './prompts';

// C3: Input sanitization for LLM prompt injection prevention
import { sanitizeUserInput, analyzeInput } from '../utils/sanitize';

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
  aiGatewayBaseURL?: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversationSummary: ConversationSummary | null;
  // Phase 1: Semantic search bindings (optional for backwards compatibility)
  ai?: Ai;
  productVectors?: VectorizeIndex;
}

export interface HandlerResponse {
  message: string;
  action: ResponseAction;
  flaggedForHuman: boolean;
  intentType?: string;
  searchQuery?: string;
  productsShown?: string[];
  clarificationCount?: number;
  sentiment?: string;
  // Products with images to send
  imagesToSend?: Array<{ url: string; caption?: string }>;
  // Lead tracking actions executed
  businessActions?: Array<{ type: string; [key: string]: unknown }>;
  // Interactive message fields
  replyType?: 'text' | 'buttons' | 'list' | null;
  replyOptions?: Array<{ id: string; title: string; description?: string | null }>;
  productsForList?: Array<{ id: string; name: string; price: string; category: string }>;
}

type ResponseAction =
  | 'show_products'
  | 'ask_clarification'
  | 'answer_question'
  | 'empathize'
  | 'greet'
  | 'thank'
  | 'handoff'
  | 'farewell';

// ============================================================================
// Clarification Loop Detection
// ============================================================================

const MAX_CONSECUTIVE_CLARIFICATIONS = 3;

/**
 * Count consecutive clarifying questions from the assistant in recent history.
 * A clarifying question is detected by pattern:
 * - Message ends with "?"
 * - Or contains clarifying phrases
 */
function countConsecutiveClarifications(
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): number {
  let count = 0;

  // Work backwards through history, looking at assistant messages
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];

    if (msg.role === 'user') {
      // User responded, check if it was to a clarification
      continue;
    }

    if (msg.role === 'assistant') {
      // Check if this was a clarifying question
      if (isClarifyingQuestion(msg.content)) {
        count++;
      } else {
        // Found a non-clarifying assistant message, stop counting
        break;
      }
    }
  }

  return count;
}

/**
 * Detect if a message is a clarifying question
 */
function isClarifyingQuestion(message: string): boolean {
  const trimmed = message.trim().toLowerCase();

  // Must end with question mark or contain clarifying phrases
  const endsWithQuestion = trimmed.endsWith('?');

  const clarifyingPhrases = [
    'what kind of',
    'what type of',
    'what style',
    'what color',
    'what size',
    'can you tell me more',
    'could you specify',
    'do you prefer',
    'are you looking for',
    'what are you looking for',
    'what would you like',
    'which one',
    'any preference',
    'specific',
  ];

  const containsClarifyingPhrase = clarifyingPhrases.some(phrase =>
    trimmed.includes(phrase)
  );

  return endsWithQuestion && containsClarifyingPhrase;
}

/**
 * Extract product-related keywords from recent conversation history.
 * Used when the current message is a follow-up (e.g., "how much?")
 * and we need to re-fetch the products being discussed.
 */
function extractProductContextFromHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): string | null {
  // Look at the last few user messages for product-related terms
  const recentUserMessages = history
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => m.content);

  if (recentUserMessages.length === 0) return null;

  // Combine recent user messages and extract product keywords
  const combined = recentUserMessages.join(' ').toLowerCase();

  // Check if there's anything product-related in recent history
  const productTerms = [
    'hoodie', 'hoodies', 't-shirt', 'tshirt', 'tee', 'shirt',
    'sneaker', 'sneakers', 'shoe', 'shoes', 'jogger', 'joggers',
    'pant', 'pants', 'jacket', 'jackets', 'hat', 'cap', 'bag',
    'black', 'white', 'grey', 'gray', 'navy', 'red', 'blue',
    'show', 'looking for', 'want', 'need',
  ];

  const hasProductTerms = productTerms.some(term => combined.includes(term));
  if (!hasProductTerms) return null;

  // Return the most recent product-relevant user message as search query
  for (let i = recentUserMessages.length - 1; i >= 0; i--) {
    const msg = recentUserMessages[i].toLowerCase();
    if (productTerms.some(term => msg.includes(term))) {
      return recentUserMessages[i];
    }
  }

  return null;
}


// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main entry point for LLM-first message handling.
 */
export async function handleIncomingMessage(ctx: HandlerContext): Promise<HandlerResponse> {
  const config = getBusinessConfig(ctx.business);
  console.log('⚙️ LLM Decision Engine - Config loaded:', {
    brandTone: config.brandTone,
    autoHandoffThreshold: config.autoHandoffThreshold,
  });

  // C3 FIX: Input sanitization for LLM prompt injection prevention
  const { sanitized: sanitizedMessage, flagged, reason } = sanitizeUserInput(ctx.messageText);
  if (flagged) {
    const analysis = analyzeInput(ctx.messageText);
    console.warn(`⚠️ Input flagged for sanitization: ${reason}`, {
      risk: analysis.risk,
      patterns: analysis.patterns,
    });
    // Continue processing with sanitized input (don't block, just log for monitoring)
  }
  // Use sanitized message for all further processing
  const messageText = sanitizedMessage;

  // =========================================================================
  // ALL messages go through the LLM decision engine
  // =========================================================================

  console.log('🤖 Calling LLM decision engine');

  // Step 1: Search products if message looks product-related
  let products: ProductWithMetadata[] = [];
  let searchQuery = '';

  // Pre-fetch available categories for 0-products case (executor needs these)
  const availableCategories = await getAllCategories(ctx.db, ctx.businessId);

  if (needsProductSearch(messageText)) {
    searchQuery = extractSearchQuery(messageText);
    console.log('🔍 Searching products for:', searchQuery);

    // Phase 2: Use semantic search if Vectorize bindings are available
    if (ctx.ai && ctx.productVectors) {
      console.log('🧠 Using semantic search (Vectorize)');
      const semanticResult = await searchProductsVectorize(
        ctx.productVectors,
        ctx.ai,
        ctx.businessId,
        searchQuery,
        10
      );

      if (semanticResult.success && semanticResult.results && semanticResult.results.length > 0) {
        // Fetch full product data from D1 using the ranked IDs
        const productIds = semanticResult.results.map((r) => r.id);
        products = await getProductsByIds(ctx.db, productIds);
        console.log(`🧠 Semantic search found ${products.length} products`);
      } else if (!semanticResult.success) {
        // Semantic search failed, fall back to SQL LIKE
        console.warn('🔄 Semantic search failed, falling back to SQL:', semanticResult.error);
        products = await searchProducts(ctx.db, ctx.businessId, searchQuery);
      }
      // If semantic search returned 0 results, products stays empty (no fallback)
    } else {
      // Fallback: SQL LIKE search (no Vectorize bindings)
      console.log('🔍 Using SQL LIKE search (no Vectorize)');
      products = await searchProducts(ctx.db, ctx.businessId, searchQuery);
    }

    console.log(`🔍 Found ${products.length} products`);
    // NOTE: We no longer skip LLM for 0 products.
    // LLM decides the action; executor builds the message from verified DB data.
  }

  // Step 1b: Context-aware product loading
  // If no products found but conversation recently discussed products,
  // search using recent user messages so the LLM has context for follow-ups
  // like "how much?", "what size?", "the black one"
  if (products.length === 0 && ctx.conversationHistory.length > 0) {
    const contextQuery = extractProductContextFromHistory(ctx.conversationHistory);
    if (contextQuery) {
      console.log('🔄 Re-searching with conversation context:', contextQuery);
      if (ctx.ai && ctx.productVectors) {
        const semanticResult = await searchProductsVectorize(
          ctx.productVectors, ctx.ai, ctx.businessId, contextQuery, 5
        );
        if (semanticResult.success && semanticResult.results && semanticResult.results.length > 0) {
          products = await getProductsByIds(ctx.db, semanticResult.results.map(r => r.id));
        }
      }
      if (products.length === 0) {
        products = await searchProducts(ctx.db, ctx.businessId, contextQuery);
      }
      console.log(`🔄 Context search found ${products.length} products`);
    }
  }

  // Step 2: Build environment snapshot (includes categories + escalation keywords for LLM)
  const environment = buildEnvironmentSnapshot(
    ctx.business,
    ctx.lead,
    ctx.conversationSummary,
    products,
    ctx.conversationHistory,
    messageText,
    availableCategories
  );

  // Step 2b: Load approved FAQs for LLM context
  try {
    const { getApprovedFaqs } = await import('./faq-generator');
    const approvedFaqs = await getApprovedFaqs(ctx.db, ctx.businessId, 10);
    if (approvedFaqs.length > 0) {
      environment.faqs = approvedFaqs;
    }
  } catch {
    // FAQ loading is non-critical
  }

  // Step 3: Build prompts
  const systemPrompt = buildDecisionSystemPrompt(
    ctx.business.name,
    config.brandTone,
    environment.capabilities
  );
  const userInput = buildDecisionUserInput(environment);

  // Step 4: Call LLM for decision
  const decision = await callLLMForDecision(
    systemPrompt,
    userInput,
    ctx.openaiApiKey,
    20_000, // 20s timeout
    ctx.aiGatewayBaseURL,
    ctx.business.id
  );

  // Step 5: Handle LLM response (or fallback)
  if (decision && isValidDecision(decision)) {
    return await processLLMDecision(decision, ctx, products, searchQuery, availableCategories);
  }

  // =========================================================================
  // FALLBACK: LLM failed → hand off to human
  // =========================================================================

  console.log('⚠️ LLM failed or invalid - handing off to human');
  return handleFallback(ctx, products, searchQuery, config);
}

// ============================================================================
// LLM Decision Processing
// ============================================================================

async function processLLMDecision(
  decision: LLMDecision,
  ctx: HandlerContext,
  products: ProductWithMetadata[],
  searchQuery: string,
  availableCategories: string[]
): Promise<HandlerResponse> {
  const config = getBusinessConfig(ctx.business);

  console.log('✅ LLM decision:', decision.conversation_action);

  // Validate the decision
  const validation = validateDecision(decision);
  if (!validation.valid) {
    console.warn('⚠️ Decision validation failed:', validation.errors);
    // Use fallback instead
    return handleFallback(ctx, products, searchQuery, config);
  }

  // =========================================================================
  // CLARIFICATION LOOP DETECTION
  // If LLM wants to ask another clarification but we've already asked too many,
  // force handoff instead to avoid frustrating the customer.
  // =========================================================================
  if (decision.conversation_action === 'ask_clarification') {
    const previousClarifications = countConsecutiveClarifications(ctx.conversationHistory);
    const nextClarificationNumber = previousClarifications + 1;
    console.log(`🔄 Sending clarification #${nextClarificationNumber} (max: ${MAX_CONSECUTIVE_CLARIFICATIONS})`);

    if (nextClarificationNumber >= MAX_CONSECUTIVE_CLARIFICATIONS) {
      // This would be the Nth clarification, force handoff instead
      console.warn('🚨 Clarification limit reached, forcing handoff');
      await createHumanFlag(
        ctx.db,
        ctx.lead.id,
        'medium',
        `Clarification loop: ${nextClarificationNumber} consecutive clarifications`
      );
      return {
        message: getHandoffMessage(config.brandTone),
        action: 'handoff',
        flaggedForHuman: true,
        intentType: 'clarification_loop',
        clarificationCount: nextClarificationNumber,
      };
    }
  }

  // Execute business actions with policy gates
  // Pass extra context for 0-products handling (executor builds message from DB data)
  const executionResult = await executeDecision(decision, {
    db: ctx.db,
    business: ctx.business,
    lead: ctx.lead,
    products,
    searchQuery,
    availableCategories,
    brandTone: config.brandTone,
  });

  // Use the potentially modified decision
  const finalDecision = executionResult.modifiedDecision;

  // Check if we need to send images
  let imagesToSend: Array<{ url: string; caption?: string }> | undefined;
  console.log(`📸 Image check: action=${finalDecision.conversation_action}, product_ids=${JSON.stringify(finalDecision.product_ids)}, products_with_images=${products.filter(p => p.image_urls.length > 0).length}`);
  if (shouldSendImages(finalDecision, products)) {
    const productsWithImages = getProductsWithImages(finalDecision, products);
    imagesToSend = productsWithImages.map(p => ({
      // WhatsApp only supports JPEG/PNG — prefer those over WebP
      url: p.image_urls.find(u => /\.(jpe?g|png)$/i.test(u)) || p.image_urls[0],
      caption: `${p.name} - $${p.price}`,
    }));
    console.log(`📸 Will send ${imagesToSend.length} product images: ${imagesToSend.map(i => i.url).join(', ')}`);
  } else {
    console.log(`📸 Skipping images: shouldSendImages returned false`);
  }

  // Map conversation_action to ResponseAction
  const action = mapConversationAction(finalDecision.conversation_action);

  // Interactive message fields — pass through LLM decision or auto-upgrade
  let replyType = finalDecision.reply_type;
  let replyOptions = finalDecision.reply_options ?? undefined;
  let productsForList: Array<{ id: string; name: string; price: string; category: string }> | undefined;

  // Auto-upgrade: if showing products with product_ids and LLM didn't set reply_type, use list
  if (
    action === 'show_products' &&
    finalDecision.product_ids &&
    finalDecision.product_ids.length > 0 &&
    !replyType
  ) {
    replyType = 'list';
  }

  // Build productsForList from actual product data when sending a list
  if (replyType === 'list' && products.length > 0) {
    const productIds = finalDecision.product_ids ?? [];
    const relevantProducts = productIds.length > 0
      ? products.filter(p => productIds.includes(p.id))
      : products;

    productsForList = relevantProducts.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price !== null
        ? `${p.currency || '$'}${p.price.toFixed(2)}`
        : 'Price on request',
      category: p.category || 'Products',
    }));
  }

  return {
    message: finalDecision.message,
    action,
    flaggedForHuman: executionResult.forceHandoff || action === 'handoff',
    intentType: finalDecision.conversation_action,
    searchQuery: searchQuery || undefined,
    productsShown: finalDecision.product_ids ?? undefined,
    sentiment: finalDecision.sentiment ?? undefined,
    imagesToSend,
    businessActions: finalDecision.business_actions as Array<{ type: string; [key: string]: unknown }>,
    replyType,
    replyOptions: replyOptions as HandlerResponse['replyOptions'],
    productsForList,
  };
}

function mapConversationAction(action: ConversationAction): ResponseAction {
  switch (action) {
    case 'show_products':
      return 'show_products';
    case 'ask_clarification':
      return 'ask_clarification';
    case 'answer_question':
      return 'answer_question';
    case 'greet':
      return 'greet';
    case 'thank':
      return 'thank';
    case 'empathize':
      return 'empathize';
    case 'handoff':
      return 'handoff';
    case 'farewell':
      return 'farewell';
    default:
      return 'answer_question';
  }
}

// ============================================================================
// Fallback: LLM failed → hand off to human
// ============================================================================

interface FallbackConfig {
  brandTone: 'friendly' | 'professional' | 'casual';
}

async function handleFallback(
  ctx: HandlerContext,
  _products: ProductWithMetadata[],
  _searchQuery: string,
  config: FallbackConfig
): Promise<HandlerResponse> {
  console.log('⚠️ LLM fallback: handing off to human');
  await createHumanFlag(ctx.db, ctx.lead.id, 'medium', 'LLM fallback - could not process');
  return {
    message: getHandoffMessage(config.brandTone),
    action: 'handoff',
    flaggedForHuman: true,
    intentType: 'fallback_handoff',
  };
}

// ============================================================================
// Legacy Exports (for backward compatibility)
// ============================================================================

// Export types that index.ts might need
export type { LLMDecision, ConversationAction } from './llm';

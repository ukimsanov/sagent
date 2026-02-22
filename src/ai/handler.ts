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
  // New: Products with images to send
  imagesToSend?: Array<{ url: string; caption?: string }>;
  // Lead tracking actions executed
  businessActions?: Array<{ type: string; [key: string]: unknown }>;
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
    ctx.aiGatewayBaseURL
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
  if (decision.reasoning) {
    console.log('📝 Reasoning:', decision.reasoning);
  }

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
  if (shouldSendImages(finalDecision, products)) {
    const productsWithImages = getProductsWithImages(finalDecision, products);
    imagesToSend = productsWithImages.map(p => ({
      url: p.image_urls[0], // First image
      caption: `${p.name} - $${p.price}`,
    }));
    console.log(`📸 Will send ${imagesToSend.length} product images`);
  }

  // Map conversation_action to ResponseAction
  const action = mapConversationAction(finalDecision.conversation_action);

  return {
    message: finalDecision.message,
    action,
    flaggedForHuman: executionResult.forceHandoff || action === 'handoff',
    intentType: finalDecision.conversation_action,
    searchQuery: searchQuery || undefined,
    productsShown: finalDecision.product_ids ?? undefined,
    imagesToSend,
    businessActions: finalDecision.business_actions as Array<{ type: string; [key: string]: unknown }>,
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
      return 'answer_question'; // Map to answer_question for now
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

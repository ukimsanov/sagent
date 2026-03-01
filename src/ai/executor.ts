/**
 * Action Executor with Policy Gates
 *
 * Validates and executes business actions from LLM decisions.
 * Implements the 3-tier system:
 * - Tier 0: Always safe (execute immediately)
 * - Tier 1: Policy-gated (check rules before executing)
 * - Tier 2: Human-only (block and force handoff)
 */

import type { LLMDecision, BusinessAction, BusinessActionType } from './llm';
import type { Business, Lead, ProductWithMetadata } from '../db/queries';
import { createHumanFlag, updateLeadScore } from '../db/queries';

// ============================================================================
// Types
// ============================================================================

export interface ExecutionContext {
  db: D1Database;
  business: Business;
  lead: Lead;
  products: ProductWithMetadata[];
  // For 0-products handling: LLM decides action, code builds message from DB data
  searchQuery?: string;
  availableCategories?: string[];
  brandTone?: 'friendly' | 'professional' | 'casual';
}

export interface ExecutionResult {
  success: boolean;
  executedActions: BusinessAction[];
  blockedActions: BusinessAction[];
  modifiedDecision: LLMDecision;
  forceHandoff: boolean;
  handoffReason?: string;
}

export interface PolicyConfig {
  maxAutoRefund: number;
  monthlyRefundLimit: number;
  approvedDiscountCodes: string[];
}

// ============================================================================
// Tier Definitions
// ============================================================================

const TIER_0_ACTIONS: BusinessActionType[] = [
  'flag_for_human',
  'log_interest',
  'update_lead_status',
  'create_support_ticket',
  'resend_tracking',
];

const TIER_1_ACTIONS: BusinessActionType[] = [
  'issue_small_refund',
  'apply_discount_code',
  'cancel_order',
];

// Tier 2 actions are implicitly anything not in Tier 0 or Tier 1
// For now, Tier 1 actions that fail policy check become Tier 2 (force handoff)

// ============================================================================
// Main Executor
// ============================================================================

/**
 * Validate and execute a decision's business actions
 */
export async function executeDecision(
  decision: LLMDecision,
  ctx: ExecutionContext,
  policyConfig?: Partial<PolicyConfig>
): Promise<ExecutionResult> {
  const config: PolicyConfig = {
    maxAutoRefund: policyConfig?.maxAutoRefund ?? 20,
    monthlyRefundLimit: policyConfig?.monthlyRefundLimit ?? 100,
    approvedDiscountCodes: policyConfig?.approvedDiscountCodes ?? [],
  };

  const executedActions: BusinessAction[] = [];
  const blockedActions: BusinessAction[] = [];
  let forceHandoff = false;
  let handoffReason: string | undefined;

  // Validate product_ids if showing products
  let modifiedDecision = { ...decision };
  if (decision.conversation_action === 'show_products' && decision.product_ids) {
    const validProductIds = decision.product_ids.filter(id =>
      ctx.products.some(p => p.id === id)
    );
    if (validProductIds.length !== decision.product_ids.length) {
      console.warn('Some product IDs were invalid, filtering them out');
      modifiedDecision.product_ids = validProductIds;
    }
  }

  // =========================================================================
  // 0-PRODUCTS HANDLING: LLM decides action, code builds message from DB data
  // This prevents hallucination about inventory we don't have.
  //
  // IMPORTANT: Only apply to product-related actions (show_products, ask_clarification).
  // Do NOT override empathize, handoff, greet, thank, farewell - these are not about products.
  // =========================================================================
  const productRelatedActions = ['show_products', 'ask_clarification', 'answer_question'];
  const isProductRelatedAction = productRelatedActions.includes(decision.conversation_action);

  if (ctx.products.length === 0 && ctx.searchQuery && isProductRelatedAction) {
    console.log('🛡️ 0-products case: building message from verified DB data');

    // Override show_products to ask_clarification (can't show what we don't have)
    if (modifiedDecision.conversation_action === 'show_products') {
      console.log('🔄 Overriding show_products → ask_clarification (0 products)');
      modifiedDecision.conversation_action = 'ask_clarification';
    }

    // Build message deterministically from DB-verified categories
    // DO NOT trust LLM's message field for catalog claims
    const safeMessage = buildNoProductsMessage({
      searchQuery: ctx.searchQuery,
      categories: ctx.availableCategories || [],
      tone: ctx.brandTone || 'friendly',
      llmAction: decision.conversation_action,
    });

    modifiedDecision.message = safeMessage;
    console.log('🛡️ Safe message built from DB categories');
  } else if (ctx.products.length === 0 && ctx.searchQuery) {
    // Non-product actions (empathize, handoff, greet, etc.) - trust LLM's message
    console.log(`📝 0-products but action is ${decision.conversation_action} - trusting LLM message`);
  }

  // Process each business action
  for (const action of decision.business_actions) {
    const result = await processAction(action, ctx, config);

    if (result.executed) {
      executedActions.push(action);
    } else if (result.blocked) {
      blockedActions.push(action);
      if (result.forceHandoff) {
        forceHandoff = true;
        handoffReason = result.reason;
      }
    }
  }

  // If handoff is forced, modify the decision
  if (forceHandoff) {
    modifiedDecision = {
      ...modifiedDecision,
      conversation_action: 'handoff',
      message: modifyMessageForHandoff(decision.message, handoffReason),
      business_actions: [
        ...executedActions,
        {
          type: 'flag_for_human',
          order_id: null,
          amount: null,
          reason: handoffReason || 'Policy check failed',
          status: null,
          interest: null,
          discount_code: null,
        },
      ],
    };
  }

  return {
    success: !forceHandoff,
    executedActions,
    blockedActions,
    modifiedDecision,
    forceHandoff,
    handoffReason,
  };
}

// ============================================================================
// Action Processing
// ============================================================================

interface ActionResult {
  executed: boolean;
  blocked: boolean;
  forceHandoff: boolean;
  reason?: string;
}

/**
 * Process a single business action
 */
async function processAction(
  action: BusinessAction,
  ctx: ExecutionContext,
  config: PolicyConfig
): Promise<ActionResult> {
  // Tier 0: Always safe
  if (TIER_0_ACTIONS.includes(action.type)) {
    return await executeTier0Action(action, ctx);
  }

  // Tier 1: Policy-gated
  if (TIER_1_ACTIONS.includes(action.type)) {
    return await executeTier1Action(action, ctx, config);
  }

  // Unknown action - block
  console.warn('Unknown action type:', action.type);
  return {
    executed: false,
    blocked: true,
    forceHandoff: false,
    reason: 'Unknown action type',
  };
}

/**
 * Execute Tier 0 actions (always safe)
 */
async function executeTier0Action(
  action: BusinessAction,
  ctx: ExecutionContext
): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'flag_for_human':
        await createHumanFlag(
          ctx.db,
          ctx.lead.id,
          'medium',
          action.reason || 'LLM requested human review'
        );
        break;

      case 'log_interest':
        if (action.interest) {
          await updateLeadScore(ctx.db, ctx.lead.id, 2, `Interest: ${action.interest}`);
        }
        break;

      case 'update_lead_status':
        if (action.status) {
          const statusScores: Record<string, number> = {
            engaged: 10,
            warm: 20,
            hot: 30,
          };
          const delta = statusScores[action.status] || 5;
          await updateLeadScore(ctx.db, ctx.lead.id, delta, `Status: ${action.status}`);
        }
        break;

      case 'create_support_ticket':
        await createHumanFlag(
          ctx.db,
          ctx.lead.id,
          'medium',
          action.reason || 'Support ticket created'
        );
        break;

      case 'resend_tracking':
        // TODO: Integrate with order system
        console.log('Resend tracking requested for order:', action.order_id);
        break;
    }

    return { executed: true, blocked: false, forceHandoff: false };
  } catch (err) {
    console.error('Failed to execute Tier 0 action:', action.type, err);
    return {
      executed: false,
      blocked: true,
      forceHandoff: false,
      reason: 'Execution failed',
    };
  }
}

/**
 * Execute Tier 1 actions with policy checks
 */
async function executeTier1Action(
  action: BusinessAction,
  ctx: ExecutionContext,
  config: PolicyConfig
): Promise<ActionResult> {
  switch (action.type) {
    case 'issue_small_refund':
      return checkRefundPolicy(action, config);

    case 'apply_discount_code':
      return checkDiscountPolicy(action, config);

    case 'cancel_order':
      return checkCancelPolicy(action);

    default:
      return {
        executed: false,
        blocked: true,
        forceHandoff: true,
        reason: 'Action requires human approval',
      };
  }
}

// ============================================================================
// Policy Checks
// ============================================================================

/**
 * Check refund policy
 *
 * SECURITY: Refunds always force handoff until proper tracking is implemented.
 * Required for production:
 * 1. Refund tracking table in D1
 * 2. Monthly limit query (sum of refunds this month)
 * 3. Payment gateway integration for actual execution
 */
function checkRefundPolicy(
  action: BusinessAction,
  config: PolicyConfig
): ActionResult {
  const amount = action.amount ?? 0;

  if (amount <= 0) {
    return {
      executed: false,
      blocked: true,
      forceHandoff: true,
      reason: 'Invalid refund amount',
    };
  }

  if (amount > config.maxAutoRefund) {
    return {
      executed: false,
      blocked: true,
      forceHandoff: true,
      reason: `Refund of $${amount} exceeds auto-approval limit of $${config.maxAutoRefund}`,
    };
  }

  // SECURITY: Always force handoff for refunds until:
  // 1. Monthly limit tracking is implemented (requires DB query)
  // 2. Payment gateway integration is complete
  // This prevents any untracked financial actions
  console.log(`Refund request for $${amount} on order ${action.order_id} - requires human approval`);
  return {
    executed: false,
    blocked: true,
    forceHandoff: true,
    reason: `Refund of $${amount} requires human approval (monthly limit tracking not yet implemented)`,
  };
}

/**
 * Check discount policy
 */
function checkDiscountPolicy(
  action: BusinessAction,
  config: PolicyConfig
): ActionResult {
  const code = action.discount_code;

  if (!code) {
    return {
      executed: false,
      blocked: true,
      forceHandoff: false,
      reason: 'No discount code provided',
    };
  }

  if (config.approvedDiscountCodes.length === 0) {
    // SECURITY: No approved codes configured = no discounts allowed (default-deny)
    console.log(`Rejecting discount code: ${code} - no codes configured for this store`);
    return {
      executed: false,
      blocked: true,
      forceHandoff: true,
      reason: 'No discount codes are configured for this store',
    };
  }

  if (!config.approvedDiscountCodes.includes(code.toUpperCase())) {
    return {
      executed: false,
      blocked: true,
      forceHandoff: true,
      reason: `Discount code "${code}" is not in approved list`,
    };
  }

  console.log(`Applying approved discount code: ${code}`);
  return { executed: true, blocked: false, forceHandoff: false };
}

/**
 * Check order cancellation policy
 */
function checkCancelPolicy(action: BusinessAction): ActionResult {
  if (!action.order_id) {
    return {
      executed: false,
      blocked: true,
      forceHandoff: true,
      reason: 'No order ID provided for cancellation',
    };
  }

  // TODO: Check order status from order system
  // For now, always require human approval for cancellations
  return {
    executed: false,
    blocked: true,
    forceHandoff: true,
    reason: 'Order cancellations require human approval',
  };
}

// ============================================================================
// Message Modification
// ============================================================================

/**
 * Modify message when forcing handoff
 */
function modifyMessageForHandoff(
  originalMessage: string,
  reason?: string
): string {
  // If the original message mentions the action that failed, modify it
  const handoffSuffix = "I'll have someone from our team look into this for you to make sure everything is handled correctly.";

  // Check if message already mentions handoff
  if (
    originalMessage.toLowerCase().includes('team') ||
    originalMessage.toLowerCase().includes('someone') ||
    originalMessage.toLowerCase().includes('human')
  ) {
    return originalMessage;
  }

  // Append handoff message
  return `${originalMessage}\n\n${handoffSuffix}`;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that a decision is structurally correct
 */
export function validateDecision(decision: LLMDecision): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!decision.conversation_action) {
    errors.push('Missing conversation_action');
  }

  if (!decision.message || decision.message.trim().length === 0) {
    errors.push('Missing or empty message');
  }

  if (decision.message && decision.message.length > 1000) {
    errors.push('Message too long (max 1000 chars)');
  }

  if (!Array.isArray(decision.business_actions)) {
    errors.push('business_actions must be an array');
  }

  // Validate product_ids if showing products
  if (decision.conversation_action === 'show_products') {
    if (decision.product_ids && !Array.isArray(decision.product_ids)) {
      errors.push('product_ids must be an array');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if images should be sent automatically.
 * No longer depends on LLM — code decides based on action + product data.
 * Auto-send when: show_products action + products have images.
 */
export function shouldSendImages(
  decision: LLMDecision,
  products: ProductWithMetadata[]
): boolean {
  // Auto-send images when showing products
  if (decision.conversation_action !== 'show_products') {
    return false;
  }

  const productIds = decision.product_ids || [];

  // If product_ids specified, check those products have images
  if (productIds.length > 0) {
    const productsToShow = products.filter(p => productIds.includes(p.id));
    return productsToShow.some(p => p.image_urls.length > 0);
  }

  // No product_ids — check if any products have images
  return products.some(p => p.image_urls.length > 0);
}

/**
 * Get products to show with images
 */
export function getProductsWithImages(
  decision: LLMDecision,
  products: ProductWithMetadata[]
): ProductWithMetadata[] {
  const productIds = decision.product_ids || [];

  // If product_ids specified, use those
  if (productIds.length > 0) {
    return products.filter(
      p => productIds.includes(p.id) && p.image_urls.length > 0
    );
  }

  // No product_ids — return all products with images (max 3 to avoid spam)
  return products.filter(p => p.image_urls.length > 0).slice(0, 3);
}

// ============================================================================
// 0-Products Message Builder (Code-Controlled, DB-Verified)
// ============================================================================

interface NoProductsMessageParams {
  searchQuery: string;
  categories: string[];
  tone: 'friendly' | 'professional' | 'casual';
  llmAction: string; // What the LLM wanted to do
}

/**
 * Build a safe message for 0-products case.
 *
 * IMPORTANT: This function ONLY uses data from the DB (categories).
 * It never trusts LLM output for inventory claims.
 *
 * Key principle: Never say "we don't have X specifically" - rephrase naturally
 * and proactively suggest alternatives.
 */
function buildNoProductsMessage(params: NoProductsMessageParams): string {
  const { categories, tone, llmAction } = params;
  // Note: searchQuery intentionally not used to avoid awkward "we don't have X" phrasing

  // Join categories nicely: "Hoodies, Jeans, and Accessories"
  const categoryList = joinWithAnd(categories.slice(0, 4)); // Max 4 categories

  // If LLM wanted to ask clarification, guide them to our available categories
  if (llmAction === 'ask_clarification') {
    const clarifyTemplates = {
      friendly: categories.length > 0
        ? `We don't carry that right now, but we've got some great ${categoryList}! What catches your eye? 👀`
        : `That's not in our collection at the moment. What style are you going for? I'd love to help you find something! 😊`,
      professional: categories.length > 0
        ? `That's not currently available. We do offer ${categoryList} – would any of those interest you?`
        : `That item isn't in our current inventory. May I help you explore other options?`,
      casual: categories.length > 0
        ? `Don't have that one, but check out our ${categoryList}! Anything sound good?`
        : `That's not in stock. What else are you into?`,
    };
    return clarifyTemplates[tone];
  }

  // Default: proactively redirect to what we have
  const answerTemplates = {
    friendly: categories.length > 0
      ? `We don't carry that right now, but we've got some awesome ${categoryList}! Want me to show you our bestsellers? 🔥`
      : `That's not available at the moment. Let me know what style you're looking for – I'll find you something great!`,
    professional: categories.length > 0
      ? `That item isn't currently in our collection. However, we have excellent options in ${categoryList}. Shall I recommend some picks?`
      : `That's not currently available. Would you like me to suggest some alternatives?`,
    casual: categories.length > 0
      ? `Don't have that, but we've got killer ${categoryList}! Want me to hook you up with something?`
      : `That's not in stock right now. What else can I help you find?`,
  };
  return answerTemplates[tone];
}

/**
 * Join array with commas and "and": ["A", "B", "C"] → "A, B, and C"
 */
function joinWithAnd(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

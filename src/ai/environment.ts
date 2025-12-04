/**
 * Environment Builder for LLM Decision Engine
 *
 * Builds the context snapshot that gets passed to the LLM.
 * Collects customer data, products, conversation history, and tenant rules.
 */

import type { Business, Lead, ConversationSummary, ProductWithMetadata, BrandTone } from '../db/queries';
import { getBusinessConfig, isWithinBusinessHours } from '../db/queries';

// ============================================================================
// Types
// ============================================================================

export interface CustomerContext {
  name: string | null;
  history: {
    interests: string[];
    objections: string[];
    previous_sizes?: string[];
  };
  message_count: number;
  lead_status: string;
  score: number;
}

export interface ProductContext {
  id: string;
  name: string;
  price: string;
  description: string;
  category: string;
  sizes?: string[];
  colors?: string[];
  has_image: boolean;
  in_stock: boolean;
}

export interface TenantRules {
  tone: BrandTone;
  business_name: string;
  is_after_hours: boolean;
  max_auto_refund?: number;
  available_discount_codes?: string[];
}

export interface EnvironmentSnapshot {
  customer: CustomerContext;
  products: ProductContext[];
  recent_messages: Array<{ role: string; content: string }>;
  current_message: string;
  capabilities: string[];
  tenant_rules: TenantRules;
}

// ============================================================================
// Capability Definitions
// ============================================================================

/**
 * Tier 0 capabilities - always available
 */
const TIER_0_CAPABILITIES = [
  'show_products - Display product recommendations from the provided list',
  'ask_clarification - Ask the customer for more details',
  'answer_question - Provide a direct answer about sizing, pricing, or policies',
  'greet - Send a greeting message',
  'thank - Acknowledge thanks from the customer',
  'empathize - Show understanding for complaints or frustration',
  'handoff - Route to a human agent',
  'farewell - End the conversation politely',
  'flag_for_human - Create a ticket for human follow-up',
  'log_interest - Track what products/categories the customer likes',
  'update_lead_status - Update customer status (engaged, warm, hot)',
];

/**
 * Tier 1 capabilities - policy-gated, per-tenant
 */
const TIER_1_CAPABILITIES = {
  refunds: 'issue_small_refund - Issue a small refund (up to configured limit)',
  discounts: 'apply_discount_code - Apply a discount code from approved list',
  orders: 'cancel_order - Cancel an order (only if not shipped)',
};

// ============================================================================
// Main Builder Function
// ============================================================================

/**
 * Build the complete environment snapshot for the LLM
 */
export function buildEnvironmentSnapshot(
  business: Business,
  lead: Lead,
  conversationSummary: ConversationSummary | null,
  products: ProductWithMetadata[],
  recentMessages: Array<{ role: string; content: string }>,
  currentMessage: string
): EnvironmentSnapshot {
  const config = getBusinessConfig(business);
  const businessHours = isWithinBusinessHours(business);

  return {
    customer: buildCustomerContext(lead, conversationSummary),
    products: products.map(p => buildProductContext(p)),
    recent_messages: recentMessages, // Full conversation from KV (up to 2000 tokens)
    current_message: currentMessage,
    capabilities: buildCapabilities(config),
    tenant_rules: {
      tone: config.brandTone,
      business_name: business.name,
      is_after_hours: !businessHours.isOpen,
      max_auto_refund: 20, // Default $20 limit
      available_discount_codes: [], // TODO: Load from DB
    },
  };
}

// ============================================================================
// Context Builders
// ============================================================================

/**
 * Build customer context from lead and conversation summary
 */
function buildCustomerContext(
  lead: Lead,
  summary: ConversationSummary | null
): CustomerContext {
  // Parse interests from summary
  let interests: string[] = [];
  let objections: string[] = [];

  if (summary) {
    try {
      if (summary.key_interests) {
        interests = JSON.parse(summary.key_interests);
      }
      if (summary.objections) {
        objections = JSON.parse(summary.objections);
      }
    } catch {
      // Ignore parse errors
    }
  }

  return {
    name: lead.name,
    history: {
      interests,
      objections,
      previous_sizes: [], // TODO: Extract from purchase history
    },
    message_count: lead.message_count,
    lead_status: lead.status,
    score: lead.score,
  };
}

/**
 * Build product context for LLM consumption
 */
function buildProductContext(product: ProductWithMetadata): ProductContext {
  // Parse metadata for sizes and colors
  let sizes: string[] | undefined;
  let colors: string[] | undefined;

  if (product.metadata) {
    const meta = product.metadata as Record<string, unknown>;
    if (Array.isArray(meta.sizes)) {
      sizes = meta.sizes as string[];
    }
    if (Array.isArray(meta.colors)) {
      colors = meta.colors as string[];
    }
  }

  // Format price
  const priceStr = product.price !== null
    ? `${product.currency || '$'}${product.price.toFixed(2)}`
    : 'Price on request';

  return {
    id: product.id,
    name: product.name,
    price: priceStr,
    description: product.description || '',
    category: product.category || 'Uncategorized',
    sizes,
    colors,
    has_image: product.image_urls.length > 0,
    in_stock: product.in_stock === 1,
  };
}

/**
 * Build capabilities list based on tenant config
 */
function buildCapabilities(config: ReturnType<typeof getBusinessConfig>): string[] {
  const capabilities = [...TIER_0_CAPABILITIES];

  // Add Tier 1 capabilities if tenant has them enabled
  // For now, enable all - in production, check tenant settings
  capabilities.push(TIER_1_CAPABILITIES.refunds);
  capabilities.push(TIER_1_CAPABILITIES.discounts);
  capabilities.push(TIER_1_CAPABILITIES.orders);

  return capabilities;
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize environment snapshot to JSON for LLM input
 */
export function serializeEnvironment(env: EnvironmentSnapshot): string {
  return JSON.stringify(env, null, 2);
}

/**
 * Build a compact version for token efficiency
 */
export function serializeCompactEnvironment(env: EnvironmentSnapshot): string {
  const compact = {
    customer: {
      name: env.customer.name,
      interests: env.customer.history.interests.join(', ') || 'none',
      objections: env.customer.history.objections.join(', ') || 'none',
      status: env.customer.lead_status,
      messages: env.customer.message_count,
    },
    products: env.products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: p.category,
      sizes: p.sizes?.join(', '),
      has_image: p.has_image,
    })),
    conversation: env.recent_messages.map(m =>
      `${m.role === 'user' ? 'Customer' : 'You'}: ${m.content}`
    ),
    current_message: env.current_message,
    rules: {
      tone: env.tenant_rules.tone,
      business: env.tenant_rules.business_name,
      after_hours: env.tenant_rules.is_after_hours,
    },
    capabilities: env.capabilities,
  };

  return JSON.stringify(compact, null, 2);
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract search query from message for product lookup
 */
export function extractSearchQuery(message: string): string {
  // Remove common filler words
  const fillers = [
    'show me', 'i want', 'i need', 'looking for', 'do you have',
    'can i see', 'what about', 'any', 'some', 'please', 'thanks',
    'the', 'a', 'an', 'to', 'for', 'and', 'or', 'but', 'in', 'on',
  ];

  let query = message.toLowerCase();

  // Remove punctuation
  query = query.replace(/[.,!?'"]/g, '');

  // Remove filler words
  for (const filler of fillers) {
    query = query.replace(new RegExp(`\\b${filler}\\b`, 'gi'), ' ');
  }

  // Clean up whitespace
  query = query.replace(/\s+/g, ' ').trim();

  return query || message; // Fall back to original if empty
}

/**
 * Check if message is a product-related query
 */
export function isProductQuery(message: string): boolean {
  const productIndicators = [
    'show', 'see', 'want', 'need', 'looking', 'have', 'price',
    'cost', 'buy', 'purchase', 'order', 'get', 'find',
  ];

  const lower = message.toLowerCase();
  return productIndicators.some(ind => lower.includes(ind));
}

/**
 * Check if message needs product search
 */
export function needsProductSearch(message: string): boolean {
  // Skip for pure greetings/thanks
  const pureGreetings = /^(hi|hello|hey|yo|sup|good\s+(morning|afternoon|evening)|thanks?|thank\s+you|thx|ty|bye|goodbye|see\s+ya)$/i;
  if (pureGreetings.test(message.trim())) {
    return false;
  }

  // Check for product indicators
  return isProductQuery(message);
}

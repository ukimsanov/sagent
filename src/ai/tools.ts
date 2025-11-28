/**
 * AI Agent Tool Definitions
 * Tools available to the LLM for interacting with business data
 *
 * Using OpenAI Responses API format
 * https://platform.openai.com/docs/guides/function-calling
 */

// ============================================================================
// Tool Definitions
// ============================================================================

export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    name: 'search_products',
    description: 'Search for products by name, description, or keywords. Use this when the customer asks about products, what you have, or mentions a product name.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term - product name, type, or keywords (e.g., "blue shirt", "jeans", "hoodie")'
        },
        category: {
          type: ['string', 'null'],
          description: 'Optional category filter (e.g., "T-Shirts", "Jeans", "Hoodies", "Accessories")'
        }
      },
      required: ['query', 'category'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function' as const,
    name: 'get_product_details',
    description: 'Get full details of a specific product including available sizes, colors, and current stock. Use when customer wants more info about a specific product.',
    parameters: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The product ID (e.g., "prod-001")'
        }
      },
      required: ['product_id'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function' as const,
    name: 'check_availability',
    description: 'Check if a product is in stock and available in the requested quantity. Use when customer asks "do you have", "is it available", or wants to know stock levels.',
    parameters: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The product ID to check'
        },
        quantity: {
          type: ['number', 'null'],
          description: 'Optional quantity to check (default: 1)'
        }
      },
      required: ['product_id', 'quantity'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function' as const,
    name: 'get_categories',
    description: 'Get list of all product categories available in the store. Use when customer asks what types of products you sell or wants to browse categories.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function' as const,
    name: 'update_lead_score',
    description: 'Update the lead warmth score based on buying signals. Call this when you detect strong interest (asking about price, availability, sizes) or disinterest (saying "just browsing", "too expensive").',
    parameters: {
      type: 'object',
      properties: {
        score_change: {
          type: 'number',
          description: 'How much to change the score (-20 to +20). Positive for buying signals, negative for disinterest.'
        },
        reason: {
          type: 'string',
          description: 'Brief reason for the score change (e.g., "Asked about specific size availability", "Said price is too high")'
        }
      },
      required: ['score_change', 'reason'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function' as const,
    name: 'flag_for_human',
    description: 'Flag this conversation for human follow-up. Use when: customer has a complaint, requests a refund, asks complex questions you cannot answer, or seems ready to make a large purchase.',
    parameters: {
      type: 'object',
      properties: {
        urgency: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Urgency level. High for complaints/refunds, medium for complex questions, low for potential sales.'
        },
        reason: {
          type: 'string',
          description: 'Why human follow-up is needed'
        }
      },
      required: ['urgency', 'reason'],
      additionalProperties: false
    },
    strict: true
  }
] as const;

// ============================================================================
// Tool Result Types
// ============================================================================

export interface SearchProductsResult {
  products: Array<{
    id: string;
    name: string;
    price: number | null;
    currency: string;
    category: string | null;
    in_stock: boolean;
    description: string | null;
  }>;
  total: number;
}

export interface ProductDetailsResult {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  category: string | null;
  in_stock: boolean;
  stock_quantity: number | null;
  sizes?: string[];
  colors?: string[];
  material?: string;
  [key: string]: unknown;
}

export interface AvailabilityResult {
  product_id: string;
  product_name: string;
  available: boolean;
  stock_quantity: number | null;
  requested_quantity: number;
  message: string;
}

export interface CategoriesResult {
  categories: string[];
}

export interface LeadScoreResult {
  success: boolean;
  message: string;
}

export interface HumanFlagResult {
  success: boolean;
  message: string;
}

export type ToolResult =
  | SearchProductsResult
  | ProductDetailsResult
  | AvailabilityResult
  | CategoriesResult
  | LeadScoreResult
  | HumanFlagResult;

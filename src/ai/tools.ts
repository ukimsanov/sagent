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
    description: 'Search for products by name, description, or keywords. Returns empty array if no products match. CRITICAL: If search returns 0 products, you MUST tell the customer you don\'t have that item and stop asking about it. Never continue discussing products that returned 0 results.',
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
  },
  // ============================================================================
  // Goal-Based Tools (Phase 2)
  // ============================================================================
  {
    type: 'function' as const,
    name: 'capture_lead_info',
    description: 'Save customer contact information for follow-up. Use when customer shares their email, name, or contact preference during conversation.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: ['string', 'null'],
          description: 'Customer name if provided'
        },
        email: {
          type: ['string', 'null'],
          description: 'Customer email address if provided'
        },
        preferred_contact: {
          type: ['string', 'null'],
          enum: ['whatsapp', 'phone', 'email', null],
          description: 'How customer prefers to be contacted'
        }
      },
      required: ['name', 'email', 'preferred_contact'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function' as const,
    name: 'request_callback',
    description: 'Create a callback request for the customer. Use when customer wants to speak with someone on the phone or requests a call back.',
    parameters: {
      type: 'object',
      properties: {
        preferred_time: {
          type: ['string', 'null'],
          description: 'When customer wants to be called (e.g., "tomorrow morning", "after 5pm")'
        },
        reason: {
          type: ['string', 'null'],
          description: 'Why they want a callback (e.g., "discuss bulk order", "need help with sizing")'
        }
      },
      required: ['preferred_time', 'reason'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function' as const,
    name: 'book_appointment',
    description: 'Book an appointment for consultation, fitting, or in-store visit. Use when customer wants to schedule a time to visit or meet.',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: ['string', 'null'],
          description: 'Requested date (e.g., "2025-12-15", "next Monday")'
        },
        time: {
          type: ['string', 'null'],
          description: 'Requested time (e.g., "14:00", "afternoon")'
        },
        notes: {
          type: ['string', 'null'],
          description: 'What the appointment is for (e.g., "wedding dress consultation", "suit fitting")'
        }
      },
      required: ['date', 'time', 'notes'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function' as const,
    name: 'send_promo_code',
    description: 'Send a discount/promo code to the customer. IMPORTANT: Only use this AFTER customer has shared their contact info (name/email via capture_lead_info). Use when customer shows interest and could be nudged towards purchase with a discount.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why giving this promo code (e.g., "first-time customer", "showed interest in multiple items")'
        }
      },
      required: ['reason'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function' as const,
    name: 'send_product_image',
    description: 'Send a product image to the customer. Use when customer asks to see a product, wants to see what it looks like, or needs visual confirmation.',
    parameters: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'The product ID to send image for'
        }
      },
      required: ['product_id'],
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

// Phase 2 Tool Results
export interface LeadCaptureResult {
  success: boolean;
  message: string;
  captured: {
    name?: string;
    email?: string;
    preferred_contact?: string;
  };
}

export interface CallbackRequestResult {
  success: boolean;
  message: string;
  request_id: string;
}

export interface AppointmentResult {
  success: boolean;
  message: string;
  appointment_id: string;
  date: string | null;
  time: string | null;
}

export interface PromoCodeResult {
  success: boolean;
  message: string;
  code?: string;
  discount?: string;
}

export interface ProductImageResult {
  success: boolean;
  message: string;
  image_sent?: boolean;
}

export type ToolResult =
  | SearchProductsResult
  | ProductDetailsResult
  | AvailabilityResult
  | CategoriesResult
  | LeadScoreResult
  | HumanFlagResult
  | LeadCaptureResult
  | CallbackRequestResult
  | AppointmentResult
  | PromoCodeResult
  | ProductImageResult;

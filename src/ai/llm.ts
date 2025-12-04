/**
 * LLM Decision Engine - Structured Output Wrapper
 *
 * Uses OpenAI Responses API with JSON Schema for guaranteed structured output.
 * The LLM is the decision engine; code validates and executes.
 *
 * Sources:
 * - https://platform.openai.com/docs/guides/structured-outputs
 * - https://jamesmccaffreyblog.com/2025/11/04/example-of-openai-responses-api-structured-output-using-json-schema/
 */

// ============================================================================
// Types
// ============================================================================

export type ConversationAction =
  | 'show_products'
  | 'ask_clarification'
  | 'answer_question'
  | 'greet'
  | 'thank'
  | 'empathize'
  | 'handoff'
  | 'farewell';

export type BusinessActionType =
  // Tier 0 - Always safe
  | 'flag_for_human'
  | 'log_interest'
  | 'update_lead_status'
  | 'create_support_ticket'
  | 'resend_tracking'
  // Tier 1 - Policy-gated
  | 'issue_small_refund'
  | 'apply_discount_code'
  | 'cancel_order';

export interface BusinessAction {
  type: BusinessActionType;
  order_id?: string;
  amount?: number;
  reason?: string;
  status?: string;
  interest?: string;
  discount_code?: string;
}

export interface LLMDecision {
  conversation_action: ConversationAction;
  business_actions: BusinessAction[];
  message: string;
  product_ids?: string[];
  send_images?: boolean;
  reasoning?: string;
}

// ============================================================================
// JSON Schema for Structured Output
// ============================================================================

/**
 * JSON Schema for LLM decision output.
 * All fields must be required for OpenAI structured outputs.
 * No `anyOf` at root level.
 */
const LLM_DECISION_SCHEMA = {
  type: 'object',
  properties: {
    conversation_action: {
      type: 'string',
      enum: [
        'show_products',
        'ask_clarification',
        'answer_question',
        'greet',
        'thank',
        'empathize',
        'handoff',
        'farewell'
      ],
      description: 'The type of conversational move to make'
    },
    business_actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'flag_for_human',
              'log_interest',
              'update_lead_status',
              'create_support_ticket',
              'resend_tracking',
              'issue_small_refund',
              'apply_discount_code',
              'cancel_order'
            ]
          },
          order_id: { type: 'string' },
          amount: { type: 'number' },
          reason: { type: 'string' },
          status: { type: 'string' },
          interest: { type: 'string' },
          discount_code: { type: 'string' }
        },
        required: ['type'],
        additionalProperties: false
      },
      description: 'Business actions to execute'
    },
    message: {
      type: 'string',
      description: 'The message to send to the customer'
    },
    product_ids: {
      type: 'array',
      items: { type: 'string' },
      description: 'Product IDs to show (if conversation_action is show_products)'
    },
    send_images: {
      type: 'boolean',
      description: 'Whether to send product images along with the message'
    },
    reasoning: {
      type: 'string',
      description: 'Short 1-2 sentence reasoning for logging, or empty string if not needed'
    }
  },
  required: ['conversation_action', 'business_actions', 'message'],
  additionalProperties: false
};

// ============================================================================
// LLM Response Interface
// ============================================================================

interface ResponsesAPIResponse {
  id: string;
  output: Array<{
    type: string;
    content?: Array<{
      type: string;
      text?: string;
    }>;
  }>;
  output_text?: string;
}

// ============================================================================
// Main LLM Function
// ============================================================================

/**
 * Call LLM with structured output to get a decision.
 *
 * @param systemPrompt - Instructions and guardrails for the LLM
 * @param environmentJson - JSON string of environment snapshot
 * @param apiKey - OpenAI API key
 * @param timeoutMs - Timeout in milliseconds (default 20s)
 * @returns LLMDecision or null if failed
 */
export async function callLLMForDecision(
  systemPrompt: string,
  environmentJson: string,
  apiKey: string,
  timeoutMs: number = 20_000
): Promise<LLMDecision | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();

  try {
    console.log('🤖 Calling LLM for decision (gpt-5-mini with structured output)...');

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-5-mini',
        instructions: systemPrompt,
        // Clearly label the environment data for the model
        input: `ENVIRONMENT_SNAPSHOT:\n${environmentJson}`,
        text: {
          format: {
            type: 'json_schema',
            name: 'llm_decision',
            schema: LLM_DECISION_SCHEMA,
            strict: true
          }
        },
        // 512 tokens is plenty for a short JSON decision
        max_output_tokens: 1024
      })
    });

    if (!res.ok) {
      const errorText = await res.text();

      // Specific error handling for common cases
      if (res.status === 429) {
        console.error('🚫 LLM rate limited (429) - falling back to deterministic response');
        // Don't retry in hot path - let fallback ladder handle it
        return null;
      }

      if (res.status === 401) {
        console.error('🔑 LLM auth failed (401) - check OPENAI_API_KEY');
        return null;
      }

      if (res.status === 400) {
        console.error('❌ LLM bad request (400) - schema or input issue:', errorText.substring(0, 200));
        return null;
      }

      if (res.status >= 500) {
        console.error('🔥 LLM server error (5xx) - OpenAI issue:', res.status);
        return null;
      }

      console.error('❌ LLM API error:', res.status, errorText);
      return null;
    }

    const json = await res.json() as ResponsesAPIResponse;
    const duration = Date.now() - startTime;
    console.log(`⏱️ LLM call completed in ${duration}ms`);

    // Parse the structured output
    const decision = parseDecision(json);

    if (decision) {
      console.log('✅ LLM decision:', decision.conversation_action, '-', decision.message.substring(0, 50) + '...');
      return decision;
    }

    console.warn('⚠️ Failed to parse LLM decision');
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

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parse the Responses API response to extract the decision.
 */
function parseDecision(response: ResponsesAPIResponse): LLMDecision | null {
  try {
    // Responses API returns output_text for structured output
    let text: string | undefined;

    if (response.output_text) {
      text = response.output_text;
    } else {
      // Fallback: find text in output array
      const messageItem = response.output?.find(item => item.type === 'message');
      const textContent = messageItem?.content?.find(c => c.type === 'output_text' || c.type === 'text');
      text = textContent?.text;
    }

    if (!text) {
      console.error('No text found in LLM response');
      return null;
    }

    const parsed = JSON.parse(text) as LLMDecision;

    // Validate required fields
    if (!parsed.conversation_action || !parsed.message) {
      console.error('Missing required fields in LLM decision');
      return null;
    }

    // Ensure business_actions is an array
    if (!Array.isArray(parsed.business_actions)) {
      parsed.business_actions = [];
    }

    return parsed;

  } catch (err) {
    console.error('Failed to parse LLM decision JSON:', err);
    return null;
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Check if a decision is valid and safe to execute.
 */
export function isValidDecision(decision: LLMDecision): boolean {
  const validActions: ConversationAction[] = [
    'show_products',
    'ask_clarification',
    'answer_question',
    'greet',
    'thank',
    'empathize',
    'handoff',
    'farewell'
  ];

  if (!validActions.includes(decision.conversation_action)) {
    return false;
  }

  if (!decision.message || decision.message.trim().length === 0) {
    return false;
  }

  // Validate product_ids if showing products
  if (decision.conversation_action === 'show_products') {
    if (!decision.product_ids || decision.product_ids.length === 0) {
      // Can still be valid - maybe just a general product message
    }
  }

  return true;
}

/**
 * Get Tier 2 actions that should force handoff.
 */
export function getTier2Actions(decision: LLMDecision): BusinessAction[] {
  const tier2Types: BusinessActionType[] = [
    'issue_small_refund',
    'apply_discount_code',
    'cancel_order'
  ];

  return decision.business_actions.filter(action =>
    tier2Types.includes(action.type)
  );
}
